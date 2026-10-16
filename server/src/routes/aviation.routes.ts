import { Router, Request, Response } from 'express';
import { aviationService } from '../services/aviation/aviation.service.js';

export const aviationRouter = Router();

/**
 * GET /api/aviation/status
 * Returns provider health, connection state, independent data freshness, and database counts
 */
aviationRouter.get('/status', (req: Request, res: Response) => {
  try {
    const status = aviationService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/aviation/aircraft
 * Returns current aircraft entities with independent freshness classification
 */
aviationRouter.get('/aircraft', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
    const freshOnly = req.query.freshOnly === 'true';
    const aircraft = aviationService.getAllAircraft(limit, freshOnly);
    const status = aviationService.getStatus();

    res.json({
      total: aircraft.length,
      freshAircraftCount: status.freshAircraftCount,
      staleAircraftCount: status.staleAircraftCount,
      historicalCount: status.historicalCount,
      aircraft,
      status: {
        providerStatus: status.status,
        connectionState: status.connectionState,
        dataFreshness: status.dataFreshness,
        operationalState: status.operationalState,
        newestObservationAt: status.newestObservationAt,
        newestObservationAgeSec: status.newestObservationAgeSec,
        lastPollAt: status.lastPollAt,
        lastSuccessfulPollAt: status.lastSuccessfulPollAt,
        airborneCount: status.airborneCount,
        onGroundCount: status.onGroundCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/aviation/aircraft/:id
 * Returns single aircraft details
 */
aviationRouter.get('/aircraft/:id', (req: Request, res: Response) => {
  try {
    const aircraft = aviationService.getAircraftById(req.params.id);
    if (!aircraft) {
      return res.status(404).json({ error: `Aircraft not found: ${req.params.id}` });
    }
    res.json(aircraft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/aviation/aircraft/:id/track
 * Returns historical coordinate trajectory for an aircraft (strictly chronological order)
 */
aviationRouter.get('/aircraft/:id/track', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 64;
    const boundedLimit = Math.min(Math.max(1, limit), 200);
    const track = aviationService.getAircraftTrack(req.params.id, boundedLimit);
    res.json(track);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/aviation/poll
 * Triggers an immediate validated ingestion cycle respecting shared rate limits and cooldowns
 */
aviationRouter.post('/poll', async (req: Request, res: Response) => {
  try {
    const { lamin, lomin, lamax, lomax } = req.body || {};
    const result = await aviationService.pollOnce({
      lamin: lamin ? Number(lamin) : undefined,
      lomin: lomin ? Number(lomin) : undefined,
      lamax: lamax ? Number(lamax) : undefined,
      lomax: lomax ? Number(lomax) : undefined,
    });

    if (!result.success) {
      if (result.cooldownRemainingSec) {
        return res.status(429).json({
          error: result.error,
          retryAfter: result.cooldownRemainingSec,
          details: result,
        });
      }

      if (result.error?.includes('already running')) {
        return res.status(409).json({
          error: result.error,
          details: result,
        });
      }

      return res.status(502).json({
        error: result.error || 'Failed to poll OpenSky Network',
        details: result,
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
