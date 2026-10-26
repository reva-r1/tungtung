import crypto from 'crypto';
import { db } from '../../db/database.js';
import { FileType, PipelineJob } from '../../types/kg.types.js';
import { DeterministicCsvParser } from './deterministicCsvParser.js';
import { LlmExtractor } from './llmExtractor.js';
import { graphStore } from './sqliteGraphStore.js';

export class JobController {
  /**
   * Create and record a new background pipeline job.
   */
  static createJob(params: {
    fileName: string;
    fileType: FileType;
    filePath?: string;
    metadata?: Record<string, any>;
  }): PipelineJob {
    const jobId = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const job: PipelineJob = {
      id: jobId,
      fileName: params.fileName,
      filePath: params.filePath,
      fileType: params.fileType,
      status: 'queued',
      progress: 0,
      triplesExtracted: 0,
      entitiesResolved: 0,
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(`
      INSERT INTO pipeline_jobs 
      (id, file_name, file_path, file_type, status, progress, triples_extracted, entities_resolved, error, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.id,
      job.fileName,
      job.filePath || null,
      job.fileType,
      job.status,
      job.progress,
      job.triplesExtracted,
      job.entitiesResolved,
      null,
      JSON.stringify(job.metadata || {}),
      job.createdAt,
      job.updatedAt
    );

    return job;
  }

  /**
   * Fetch a job by ID.
   */
  static getJob(jobId: string): PipelineJob | null {
    const row = db.prepare('SELECT * FROM pipeline_jobs WHERE id = ?').get(jobId) as any;
    if (!row) return null;

    return {
      id: row.id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type as FileType,
      status: row.status,
      progress: row.progress,
      triplesExtracted: row.triples_extracted,
      entitiesResolved: row.entities_resolved,
      error: row.error,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List recent pipeline jobs.
   */
  static listJobs(limit: number = 50): PipelineJob[] {
    const rows = db.prepare('SELECT * FROM pipeline_jobs ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type as FileType,
      status: row.status,
      progress: row.progress,
      triplesExtracted: row.triples_extracted,
      entitiesResolved: row.entities_resolved,
      error: row.error,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Update job progress and counters.
   */
  static updateJob(jobId: string, updates: Partial<PipelineJob>) {
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.status !== undefined) {
      sets.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progress !== undefined) {
      sets.push('progress = ?');
      values.push(updates.progress);
    }
    if (updates.triplesExtracted !== undefined) {
      sets.push('triples_extracted = ?');
      values.push(updates.triplesExtracted);
    }
    if (updates.entitiesResolved !== undefined) {
      sets.push('entities_resolved = ?');
      values.push(updates.entitiesResolved);
    }
    if (updates.error !== undefined) {
      sets.push('error = ?');
      values.push(updates.error);
    }
    if (updates.metadata !== undefined) {
      sets.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    values.push(jobId);
    db.prepare(`UPDATE pipeline_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  /**
   * Asynchronously process a file in the background without blocking HTTP responses.
   */
  static async processFileAsync(
    jobId: string,
    fileContent: string,
    fileName: string,
    fileType: FileType
  ): Promise<void> {
    try {
      this.updateJob(jobId, { status: 'running', progress: 10 });

      let triples: any[] = [];
      let metadata: Record<string, any> = {};

      if (fileType === 'csv') {
        this.updateJob(jobId, { progress: 30 });
        const parseResult = DeterministicCsvParser.parse(fileContent, fileName);
        triples = parseResult.triples;
        metadata = { stats: parseResult.stats };
        this.updateJob(jobId, { progress: 60, triplesExtracted: triples.length, metadata });
      } else {
        // Unstructured text / memo / report
        this.updateJob(jobId, { progress: 30 });
        const extractResult = await LlmExtractor.extract(fileContent, fileName);
        triples = extractResult.triples;
        metadata = { stats: extractResult.stats };
        this.updateJob(jobId, { progress: 60, triplesExtracted: triples.length, metadata });
      }

      // Ingest all triples through graphStore (which automatically invokes EntityResolutionHook)
      let ingestedCount = 0;
      for (let i = 0; i < triples.length; i++) {
        await graphStore.upsertTriple(triples[i]);
        ingestedCount++;

        // Incremental progress updates
        if (triples.length > 5 && i % Math.max(1, Math.floor(triples.length / 5)) === 0) {
          const currentProgress = 60 + Math.floor((i / triples.length) * 35);
          this.updateJob(jobId, { progress: currentProgress });
        }
      }

      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        triplesExtracted: ingestedCount,
        metadata: { ...metadata, completedAt: new Date().toISOString() },
      });
    } catch (err: any) {
      console.error(`[JobController] Job ${jobId} failed:`, err);
      this.updateJob(jobId, {
        status: 'failed',
        progress: 100,
        error: err.message || 'Unknown processing error',
      });
    }
  }
}
