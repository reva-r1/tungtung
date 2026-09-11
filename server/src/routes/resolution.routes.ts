import { Router, Request, Response } from 'express';
import { ResolutionService } from '../services/resolution.service.js';

export const resolutionRouter = Router();

// Get merge candidates
resolutionRouter.get('/candidates', (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const candidates = ResolutionService.getMergeCandidates(status ? String(status) : undefined);
    res.json(candidates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run resolution scan
resolutionRouter.post('/scan', (req: Request, res: Response) => {
  try {
    const candidates = ResolutionService.scanForMergeCandidates();
    res.json({ success: true, count: candidates.length, candidates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Merge or reject candidate
resolutionRouter.post('/candidates/:id/resolve', (req: Request, res: Response) => {
  try {
    const { action, analystNotes } = req.body;
    if (!['MERGE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be MERGE or REJECT' });
    }
    const result = ResolutionService.resolveCandidate(req.params.id, action, analystNotes);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
