import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { GraphService } from '../services/graph.service.js';

export const entitiesRouter = Router();

// Global search & list entities
entitiesRouter.get('/', (req: Request, res: Response) => {
  try {
    const { query, type, minRisk, limit = 100 } = req.query;
    let sql = 'SELECT * FROM entities WHERE 1=1';
    const params: any[] = [];

    if (query) {
      sql += ' AND (name LIKE ? OR label LIKE ? OR summary LIKE ? OR properties LIKE ?)';
      const q = `%${query}%`;
      params.push(q, q, q, q);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (minRisk) {
      sql += ' AND risk_score >= ?';
      params.push(Number(minRisk));
    }

    sql += ' ORDER BY risk_score DESC LIMIT ?';
    params.push(Number(limit));

    const records = db.prepare(sql).all(...params) as any[];
    const parsed = records.map((e) => ({
      ...e,
      properties: JSON.parse(e.properties || '{}'),
      tags: JSON.parse(e.tags || '[]'),
      aliases: JSON.parse(e.aliases || '[]'),
    }));

    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Search entity counts by type (faceted search summary)
entitiesRouter.get('/search/facets', (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query) {
      const counts = db.prepare('SELECT type, count(*) as count FROM entities GROUP BY type').all();
      return res.json(counts);
    }

    const q = `%${query}%`;
    const counts = db
      .prepare(`
        SELECT type, count(*) as count 
        FROM entities 
        WHERE name LIKE ? OR label LIKE ? OR summary LIKE ? OR properties LIKE ?
        GROUP BY type
      `)
      .all(q, q, q, q);

    res.json(counts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single entity details & deep profile dossier
entitiesRouter.get('/:id/profile', (req: Request, res: Response) => {
  try {
    const profile = GraphService.getEntityProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: `Entity ${req.params.id} not found` });
    }
    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single raw entity
entitiesRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(req.params.id) as any;
    if (!entity) return res.status(404).json({ error: 'Entity not found' });
    res.json({
      ...entity,
      properties: JSON.parse(entity.properties || '{}'),
      tags: JSON.parse(entity.tags || '[]'),
      aliases: JSON.parse(entity.aliases || '[]'),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
