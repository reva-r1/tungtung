import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

export const eventsRouter = Router();

// Get timeline events
eventsRouter.get('/', (req: Request, res: Response) => {
  try {
    const { entityId, eventType, severity, fromTime, toTime, limit = 100 } = req.query;
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (entityId) {
      sql += ' AND entity_ids LIKE ?';
      params.push(`%${entityId}%`);
    }
    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (fromTime) {
      sql += ' AND timestamp >= ?';
      params.push(fromTime);
    }
    if (toTime) {
      sql += ' AND timestamp <= ?';
      params.push(toTime);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(Number(limit));

    const records = db.prepare(sql).all(...params) as any[];
    const parsed = records.map((e) => ({
      ...e,
      entityIds: JSON.parse(e.entity_ids || '[]'),
      evidence: JSON.parse(e.evidence || '[]'),
      properties: JSON.parse(e.properties || '{}'),
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
