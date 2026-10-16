import { Router, Request, Response } from 'express';
import { aviationService } from '../services/aviation/aviation.service.js';

export const aviationRouter = Router();

/**
 * GET /api/aviation/status
 * Returns provider health, connection state, freshness, and database counts
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
 * Returns all current aircraft entities in canonical format
 */
aviationRouter.get('/aircraft', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 300;
    const aircraft = aviationService.getAllAircraft(limit);
    const status = aviationService.getStatus();

    res.json({
      total: aircraft.length,
      aircraft,
      status: {
        providerStatus: status.status,
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
 * Returns historical coordinate trajectory for an aircraft
 */
aviationRouter.get('/aircraft/:id/track', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 64;
    const track = aviationService.getAircraftTrack(req.params.id, limit);
    res.json(track);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/aviation/poll
 * Triggers an immediate validated ingestion cycle
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
