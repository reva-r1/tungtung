import { Router, Request, Response } from 'express';
import { GraphService } from '../services/graph.service.js';
import { EntityType } from '../types/index.js';

export const graphRouter = Router();

// Full or filtered graph
graphRouter.get('/', (req: Request, res: Response) => {
  try {
    const { types, edgeTypes, sources, minRisk, limit } = req.query;

    const entityTypes = types ? (String(types).split(',') as EntityType[]) : undefined;
    const relationshipTypes = edgeTypes ? String(edgeTypes).split(',') : undefined;
    const sourceIds = sources ? String(sources).split(',') : undefined;
    const minRiskScore = minRisk ? Number(minRisk) : undefined;
    const graphLimit = limit ? Number(limit) : undefined;

    const graph = GraphService.getGraph({
      entityTypes,
      relationshipTypes,
      sourceIds,
      minRiskScore,
      limit: graphLimit,
    });

    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Expand entity by N hops
graphRouter.get('/expand/:id', (req: Request, res: Response) => {
  try {
    const { hops = 1, edgeTypes } = req.query;
    const types = edgeTypes ? String(edgeTypes).split(',') : undefined;
    const graph = GraphService.expandEntity(req.params.id, Number(hops), types);
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Shortest path between two entities
graphRouter.get('/path', (req: Request, res: Response) => {
  try {
    const { sourceId, targetId, maxDepth = 4 } = req.query;
    if (!sourceId || !targetId) {
      return res.status(400).json({ error: 'sourceId and targetId are required' });
    }

    const pathData = GraphService.findShortestPath(String(sourceId), String(targetId), Number(maxDepth));
    res.json(pathData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
