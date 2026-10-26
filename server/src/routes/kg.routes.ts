import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db/database.js';
import { FileType } from '../types/kg.types.js';
import { JobController } from '../services/graph/jobController.js';
import { graphStore, SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';
import { KgReasonerService } from '../services/graph/kgReasoner.js';

export const kgRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

/**
 * POST /api/kg/analyze
 * Submits a file (CSV, TXT, JSON) or raw text for asynchronous processing.
 * Returns immediately with 202 Accepted and job ID.
 */
kgRouter.post('/analyze', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let content = '';
    let fileName = 'raw_input.txt';
    let fileType: FileType = 'text';

    if (req.file) {
      content = req.file.buffer.toString('utf-8');
      fileName = req.file.originalname || 'uploaded_document';
      const lowerName = fileName.toLowerCase();
      if (lowerName.endsWith('.csv')) fileType = 'csv';
      else if (lowerName.endsWith('.json')) fileType = 'json';
      else fileType = 'text';
    } else if (req.body && (req.body.text || req.body.content)) {
      content = req.body.text || req.body.content;
      fileName = req.body.fileName || 'submitted_text.txt';
      const lowerName = fileName.toLowerCase();
      if (lowerName.endsWith('.csv') || req.body.fileType === 'csv') fileType = 'csv';
      else if (lowerName.endsWith('.json') || req.body.fileType === 'json') fileType = 'json';
      else fileType = 'text';
    } else {
      return res.status(400).json({ error: 'No file or text content provided for analysis' });
    }

    if (!content.trim()) {
      return res.status(400).json({ error: 'Provided document content is empty' });
    }

    // 1. Create Job Record
    const job = JobController.createJob({
      fileName,
      fileType,
      metadata: { contentLength: content.length, submittedVia: req.file ? 'file_upload' : 'api_payload' },
    });

    // 2. Launch background asynchronous processing (unblocked)
    setImmediate(() => {
      JobController.processFileAsync(job.id, content, fileName, fileType).catch((err) => {
        console.error(`[kgRouter] Background processing error for job ${job.id}:`, err);
      });
    });

    // 3. Return immediate 202 Accepted response with poll URL
    return res.status(202).json({
      jobId: job.id,
      fileName: job.fileName,
      fileType: job.fileType,
      status: job.status,
      message: 'Analysis initiated. Poll status via GET /api/kg/job/' + job.id,
      pollUrl: `/api/kg/job/${job.id}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit analysis job' });
  }
});

/**
 * GET /api/kg/job/:id
 * Poll current status, progress percentage, extracted counts, and error info.
 */
kgRouter.get('/job/:id', (req: Request, res: Response) => {
  try {
    const job = JobController.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: `Job ${req.params.id} not found` });
    }
    return res.json(job);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kg/jobs
 * List recent jobs.
 */
kgRouter.get('/jobs', (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const jobs = JobController.listJobs(limit);
    return res.json(jobs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kg/subgraph/:entityId
 * Fetch N-hop neighborhood subgraph for an entity.
 */
kgRouter.get('/subgraph/:entityId', async (req: Request, res: Response) => {
  try {
    const entityId = req.params.entityId;
    const hops = Math.min(4, Math.max(1, parseInt(req.query.hops as string) || 1));
    const subgraph = await graphStore.neighbors(entityId, hops);
    return res.json(subgraph);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kg/path
 * Find shortest path between two entities: /api/kg/path?from=A&to=B
 */
kgRouter.get('/path', async (req: Request, res: Response) => {
  try {
    const from = (req.query.from || req.query.source) as string;
    const to = (req.query.to || req.query.target) as string;
    const maxDepth = Math.min(6, Math.max(1, parseInt(req.query.maxDepth as string) || 4));

    if (!from || !to) {
      return res.status(400).json({ error: 'Query parameters "from" and "to" are required.' });
    }

    const pathEntities = await graphStore.shortestPath(from, to, maxDepth);
    return res.json({
      from,
      to,
      length: pathEntities.length,
      path: pathEntities,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/kg/triples
 * Inspect extracted triples and provenance claims.
 */
kgRouter.get('/triples', (req: Request, res: Response) => {
  try {
    const sourceFile = req.query.sourceFile as string;
    const status = req.query.status as string;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100));

    let query = 'SELECT * FROM extracted_triples WHERE 1=1';
    const params: any[] = [];

    if (sourceFile) {
      query += ' AND source_file = ?';
      params.push(sourceFile);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    const triples = rows.map((r) => ({
      id: r.id,
      subjectEntityId: r.subject_entity_id,
      subjectName: r.subject_name,
      subjectType: r.subject_type,
      predicate: r.predicate,
      objectEntityId: r.object_entity_id,
      objectName: r.object_name,
      objectType: r.object_type,
      sourceFile: r.source_file,
      sourceRow: r.source_row,
      sourceSpan: r.source_span,
      extractorModel: r.extractor_model,
      extractorVersion: r.extractor_version,
      confidence: r.confidence,
      status: r.status,
      observedAt: r.observed_at,
      properties: JSON.parse(r.properties || '{}'),
      createdAt: r.created_at,
    }));

    return res.json(triples);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/kg/triple/:id/status
 * Update triple verification status ('verified', 'rejected', 'unreviewed').
 */
kgRouter.patch('/triple/:id/status', (req: Request, res: Response) => {
  try {
    const tripleId = req.params.id;
    const { status } = req.body;
    if (!['unreviewed', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be one of: unreviewed, verified, rejected' });
    }

    const updated = (graphStore as SQLiteGraphStore).updateTripleStatus(tripleId, status);
    if (!updated) {
      return res.status(404).json({ error: `Triple ${tripleId} not found` });
    }

    return res.json({ id: tripleId, status, updated: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/kg/source
 * Cascade purges all triples and relationships from a source file.
 */
kgRouter.delete('/source', async (req: Request, res: Response) => {
  try {
    const sourceFile = (req.query.sourceFile || req.body?.sourceFile) as string;
    if (!sourceFile) {
      return res.status(400).json({ error: 'Parameter "sourceFile" is required' });
    }

    const purgedCount = await graphStore.purgeBySource(sourceFile);
    return res.json({ sourceFile, purgedTriplesCount: purgedCount, success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/kg/reason
 * Runs epistemic reasoning over an entity's local graph neighborhood.
 * Body: { entityId: string, hops?: number, question?: string }
 */
kgRouter.post('/reason', async (req: Request, res: Response) => {
  try {
    const { entityId, hops, question } = req.body;
    if (!entityId) {
      return res.status(400).json({ error: 'Field "entityId" is required in request body.' });
    }

    const analysis = await KgReasonerService.analyzeEntity({
      entityId,
      hops: hops ? parseInt(hops) : 2,
      question,
    });

    return res.json(analysis);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Epistemic reasoning failed' });
  }
});
