import { Router, Request, Response } from 'express';
import { earthquakeService } from '../services/earthquake/earthquake.service.js';

export const earthquakeRouter = Router();

/**
 * GET /api/earthquakes/status
 * Decoupled provider connection diagnostics and data freshness metrics
 */
earthquakeRouter.get('/status', (req: Request, res: Response) => {
  try {
    const status = earthquakeService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/earthquakes/events
 * Returns historical and active earthquake epicenters
 */
earthquakeRouter.get('/events', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const events = earthquakeService.getAllEvents(limit);
    const status = earthquakeService.getStatus();

    res.json({
      meta: {
        provider: 'USGS Earthquake Hazards Program',
        sourceUrl: 'https://earthquake.usgs.gov/earthquakes/feed/',
        license: 'Public Domain (USGS)',
        dataKind: 'DIRECT_OBSERVATION',
        connectionState: status.connectionState,
        dataFreshness: status.dataFreshness,
        operationalState: status.operationalState,
        lastSuccessfulPollAt: status.lastSuccessfulPollAt,
        newestObservationAt: status.newestObservationAt,
        count: events.length,
      },
      events,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/earthquakes/events/:id
 * Retrieve single earthquake epicenter by ID
 */
earthquakeRouter.get('/events/:id', (req: Request, res: Response) => {
  try {
    const event = earthquakeService.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: `Earthquake event ${req.params.id} not found` });
    }
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/earthquakes/poll
 * Manual trigger for bounded USGS seismic feed sync
 */
earthquakeRouter.post('/poll', async (req: Request, res: Response) => {
  try {
    const feedType = (req.body?.feedType as 'hour' | 'day') || 'hour';
    const result = await earthquakeService.pollNow(feedType);
    if (!result.success && result.cooldownRemainingSec) {
      return res.status(429).json(result);
    }
    if (!result.success) {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
