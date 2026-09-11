import { Router, Request, Response } from 'express';
import { AnomalyService } from '../services/anomaly.service.js';
import { RiskLevel } from '../types/index.js';

export const anomaliesRouter = Router();

// Get anomalies
anomaliesRouter.get('/', (req: Request, res: Response) => {
  try {
    const { status, severity, entityId } = req.query;
    const list = AnomalyService.getAnomalies({
      status: status ? String(status) : undefined,
      severity: severity ? (String(severity) as RiskLevel) : undefined,
      entityId: entityId ? String(entityId) : undefined,
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Run anomaly detection scan
anomaliesRouter.post('/scan', (req: Request, res: Response) => {
  try {
    const results = AnomalyService.runAllDetectors();
    res.json({ success: true, count: results.length, anomalies: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update anomaly status
anomaliesRouter.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['OPEN', 'INVESTIGATING', 'DISMISSED', 'CONFIRMED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updated = AnomalyService.updateStatus(req.params.id, status);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
