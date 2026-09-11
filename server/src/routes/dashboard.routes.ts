import { Router, Request, Response } from 'express';
import { GraphService } from '../services/graph.service.js';

export const dashboardRouter = Router();

// Overall intelligence dashboard metrics filtered by active dataset
dashboardRouter.get('/stats', (req: Request, res: Response) => {
  try {
    const datasetId = req.query.datasetId as string | undefined;
    const stats = GraphService.getGlobalMetrics(datasetId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
