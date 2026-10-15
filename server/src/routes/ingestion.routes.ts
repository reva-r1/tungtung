import { Router, Request, Response } from 'express';
import multer from 'multer';
import { IngestionService } from '../services/ingestion.service.js';
import { seedDatabase } from '../db/seedData.js';

export const ingestionRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });

// List all ingested datasets
ingestionRouter.get('/datasets', (req: Request, res: Response) => {
  try {
    const list = IngestionService.listDatasets();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get currently active dataset
ingestionRouter.get('/datasets/active', (req: Request, res: Response) => {
  try {
    const active = IngestionService.getActiveDataset();
    if (!active) {
      return res.status(404).json({ error: 'No active dataset found' });
    }
    res.json(active);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Set a dataset as active
ingestionRouter.post('/datasets/:id/activate', (req: Request, res: Response) => {
  try {
    const updated = IngestionService.setActiveDataset(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: `Dataset ${req.params.id} not found` });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single dataset details
ingestionRouter.get('/datasets/:id', (req: Request, res: Response) => {
  try {
    const dataset = IngestionService.getDataset(req.params.id);
    if (!dataset) {
      return res.status(404).json({ error: `Dataset ${req.params.id} not found.` });
    }
    res.json(dataset);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get records from a dataset with pagination/search
ingestionRouter.get('/datasets/:id/records', (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const search = String(req.query.search || '');

    const result = IngestionService.getDatasetRecords(req.params.id, limit, offset, search);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload and inspect dataset file (CSV, JSON, Excel)
ingestionRouter.post('/inspect', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileName = req.file.originalname;
    let format: 'CSV' | 'JSON' | 'EXCEL' = 'CSV';

    if (fileName.endsWith('.json')) format = 'JSON';
    else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) format = 'EXCEL';

    const preview = IngestionService.inspectDataset(fileName, req.file.buffer, format);
    res.json(preview);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'The file could not be parsed.' });
  }
});

// Commit ingestion of rows
ingestionRouter.post('/commit', (req: Request, res: Response) => {
  try {
    const { datasetName, format = 'CSV', rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Valid rows array required for ingestion commit' });
    }

    const result = IngestionService.commitIngestion(datasetName || 'Imported Dataset', format, rows);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete single dataset by ID
ingestionRouter.delete('/datasets/:id', (req: Request, res: Response) => {
  try {
    const result = IngestionService.deleteDataset(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete / Purge all datasets
ingestionRouter.delete('/datasets', (req: Request, res: Response) => {
  try {
    const result = IngestionService.deleteAllDatasets();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset / reload demo logistics dataset (Guarded by REVANA_DEMO_MODE)
ingestionRouter.post('/demo/reload', (req: Request, res: Response) => {
  if (process.env.REVANA_DEMO_MODE !== 'true') {
    return res.status(403).json({
      error: 'Demo dataset reload is disabled in production. Set REVANA_DEMO_MODE=true in environment to enable benchmark reload.',
    });
  }

  try {
    seedDatabase(true);
    res.json({ success: true, message: 'Karnataka-South logistics benchmark dataset reloaded successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

