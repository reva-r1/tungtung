import { Router, Request, Response } from 'express';
import { worldModelService } from '../services/world_model/world_model.service.js';
import { providerRegistry } from '../connectors/registry/ProviderRegistry.js';

export const worldRouter = Router();

// GET /world/state
worldRouter.get('/state', (req: Request, res: Response) => {
  try {
    const state = worldModelService.getWorldState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/entities
worldRouter.get('/entities', (req: Request, res: Response) => {
  try {
    const { type, category } = req.query;
    const entities = worldModelService.getEntities(
      type as string | undefined,
      category as string | undefined
    );
    res.json(entities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/entities/:id
worldRouter.get('/entities/:id', (req: Request, res: Response) => {
  try {
    const result = worldModelService.getEntityById(req.params.id);
    if (!result.entity) {
      return res.status(404).json({ error: `Entity not found: ${req.params.id}` });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/changes
worldRouter.get('/changes', (req: Request, res: Response) => {
  try {
    const minutes = req.query.minutes ? parseInt(req.query.minutes as string) : 60;
    const since = req.query.since as string | undefined;
    const changes = worldModelService.getTemporalChanges(minutes, since);
    res.json({
      query_window: since ? `since_${since}` : `past_${minutes}_minutes`,
      count: changes.length,
      changes,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/events
worldRouter.get('/events', (req: Request, res: Response) => {
  try {
    const { severity } = req.query;
    const events = worldModelService.getEvents(severity as string | undefined);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /world/relationships
worldRouter.get('/relationships', (req: Request, res: Response) => {
  try {
    const relationships = worldModelService.getRelationships();
    res.json(relationships);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /world/ingest/:providerId
worldRouter.post('/ingest/:providerId', async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const provider = providerRegistry.getProvider(providerId);
    if (!provider) {
      return res.status(404).json({ error: `Unknown provider: ${providerId}` });
    }

    const { rawData, latencyMs } = await provider.fetch(req.body);
    const rawId = worldModelService.storeRawPayload(providerId, provider.metadata.endpointUrl, rawData);
    const observations = await provider.normalize(rawData);

    const ingestedResults = [];
    for (const obs of observations) {
      const result = worldModelService.ingestObservation(obs, rawId);
      ingestedResults.push(result);
    }

    res.json({
      provider: providerId,
      latency_ms: latencyMs,
      observations_normalized: observations.length,
      raw_payload_id: rawId,
      results: ingestedResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
