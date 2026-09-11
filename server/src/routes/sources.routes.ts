import { Router, Request, Response } from 'express';
import { SourceService } from '../services/source.service.js';

export const sourcesRouter = Router();

// List all registered data sources
sourcesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const sources = SourceService.listSources();
    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync all data sources
sourcesRouter.post('/sync-all', async (req: Request, res: Response) => {
  try {
    const results = await SourceService.syncAllSources();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single data source details
sourcesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const source = SourceService.getSource(req.params.id);
    if (!source) {
      return res.status(404).json({ error: `Source "${req.params.id}" not found.` });
    }
    res.json(source);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Connect to & inspect source schema
sourcesRouter.get('/:id/schema', async (req: Request, res: Response) => {
  try {
    const inspection = SourceService.inspectSource(req.params.id);
    res.json(inspection);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Connect / test source connection
sourcesRouter.post('/:id/connect', async (req: Request, res: Response) => {
  try {
    const inspection = SourceService.inspectSource(req.params.id);
    res.json({ success: true, message: `Connected to ${inspection.sourceName}`, inspection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Synchronize source data into unified model
sourcesRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const result = await SourceService.syncSource(req.params.id);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get raw extracted records for a source
sourcesRouter.get('/:id/records', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const data = SourceService.getSourceRecords(req.params.id, limit, offset);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
