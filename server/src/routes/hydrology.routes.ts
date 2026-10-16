import { Router, Request, Response } from 'express';
import { hydrologyService } from '../services/hydrology/hydrology.service.js';

export const hydrologyRouter = Router();

/**
 * GET /api/hydrology/status
 * Returns provider connection health, independent data freshness, and regional storage metrics
 */
hydrologyRouter.get('/status', (req: Request, res: Response) => {
  try {
    const status = hydrologyService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/hydrology/stations
 * Returns all surveyed reservoir monitoring stations with latest CWC observations
 */
hydrologyRouter.get('/stations', (req: Request, res: Response) => {
  try {
    const stations = hydrologyService.getAllStations();
    const status = hydrologyService.getStatus();

    res.json({
      total: stations.length,
      stations,
      status: {
        providerStatus: status.status,
        connectionState: status.connectionState,
        dataFreshness: status.dataFreshness,
        operationalState: status.operationalState,
        totalLiveStorageBmc: status.totalLiveStorageBmc,
        totalFullCapacityBmc: status.totalFullCapacityBmc,
        overallCapacityPct: status.overallCapacityPct,
        newestObservationAt: status.newestObservationAt,
        newestObservationAgeDays: status.newestObservationAgeDays,
        lastPollAt: status.lastPollAt,
        lastSuccessfulPollAt: status.lastSuccessfulPollAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/hydrology/stations/:id
 * Returns single station details and telemetry
 */
hydrologyRouter.get('/stations/:id', (req: Request, res: Response) => {
  try {
    const station = hydrologyService.getStationById(req.params.id);
    if (!station) {
      return res.status(404).json({ error: `Hydrological station not found: ${req.params.id}` });
    }
    res.json(station);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/hydrology/stations/:id/history
 * Returns chronological observation history for a station
 */
hydrologyRouter.get('/stations/:id/history', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const history = hydrologyService.getStationHistory(req.params.id, limit);
    res.json({
      entity_id: req.params.id,
      count: history.length,
      history,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/hydrology/poll
 * Triggers an immediate validated ingestion cycle
 */
hydrologyRouter.post('/poll', async (req: Request, res: Response) => {
  try {
    const { stateName, districtName, agencyName, startdate, enddate } = req.body || {};
    const result = await hydrologyService.pollOnce({
      stateName,
      districtName,
      agencyName,
      startdate,
      enddate,
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
        error: result.error || 'Failed to poll India-WRIS hydrology service',
        details: result,
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
