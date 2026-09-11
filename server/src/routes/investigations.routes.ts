import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export const investigationsRouter = Router();

// List investigations
investigationsRouter.get('/', (req: Request, res: Response) => {
  try {
    const list = db.prepare('SELECT * FROM investigations ORDER BY updated_at DESC').all() as any[];
    const parsed = list.map((inv) => ({
      ...inv,
      leadAnalyst: inv.lead_analyst,
      entityIds: JSON.parse(inv.entity_ids || '[]'),
      notes: JSON.parse(inv.notes || '[]'),
      createdAt: inv.created_at,
      updatedAt: inv.updated_at,
    }));
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single investigation details
investigationsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const inv = db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id) as any;
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });

    const entityIds = JSON.parse(inv.entity_ids || '[]');
    let entities: any[] = [];
    if (entityIds.length > 0) {
      const placeholders = entityIds.map(() => '?').join(',');
      const rawEntities = db.prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`).all(...entityIds) as any[];
      entities = rawEntities.map((e) => ({
        ...e,
        properties: JSON.parse(e.properties || '{}'),
        tags: JSON.parse(e.tags || '[]'),
        aliases: JSON.parse(e.aliases || '[]'),
      }));
    }

    res.json({
      ...inv,
      leadAnalyst: inv.lead_analyst,
      entityIds,
      entities,
      notes: JSON.parse(inv.notes || '[]'),
      createdAt: inv.created_at,
      updatedAt: inv.updated_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new investigation
investigationsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { title, description, leadAnalyst = 'Lead Analyst', priority = 'MEDIUM', entityIds = [] } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = `INV-${new Date().getFullYear()}-${uuidv4().substring(0, 4).toUpperCase()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO investigations (id, title, description, lead_analyst, status, priority, entity_ids, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      description || '',
      leadAnalyst,
      'ACTIVE',
      priority,
      JSON.stringify(entityIds),
      JSON.stringify([]),
      now,
      now
    );

    res.json({ id, title, status: 'ACTIVE', priority, entityIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add note to investigation
investigationsRouter.post('/:id/notes', (req: Request, res: Response) => {
  try {
    const { author = 'Analyst', content } = req.body;
    if (!content) return res.status(400).json({ error: 'Note content is required' });

    const inv = db.prepare('SELECT * FROM investigations WHERE id = ?').get(req.params.id) as any;
    if (!inv) return res.status(404).json({ error: 'Investigation not found' });

    const notes = JSON.parse(inv.notes || '[]');
    const newNote = {
      id: `NOTE-${uuidv4().substring(0, 6).toUpperCase()}`,
      author,
      content,
      createdAt: new Date().toISOString(),
    };
    notes.unshift(newNote);

    db.prepare('UPDATE investigations SET notes = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(notes),
      new Date().toISOString(),
      req.params.id
    );

    res.json(newNote);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
