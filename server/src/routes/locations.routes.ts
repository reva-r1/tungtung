import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

export const locationsRouter = Router();

// Get all locations
locationsRouter.get('/', (req: Request, res: Response) => {
  try {
    const { city, type } = req.query;
    let sql = 'SELECT * FROM locations WHERE 1=1';
    const params: any[] = [];

    if (city) {
      sql += ' AND city = ?';
      params.push(city);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    const records = db.prepare(sql).all(...params) as any[];
    const parsed = records.map((l) => ({
      ...l,
      properties: JSON.parse(l.properties || '{}'),
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
