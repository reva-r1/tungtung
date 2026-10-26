import { Router, Request, Response } from 'express';
import { providerRegistry } from '../connectors/registry/ProviderRegistry.js';
import { worldModelService } from '../services/world_model/world_model.service.js';

export const providersRouter = Router();

// GET /providers/status
providersRouter.get('/status', (req: Request, res: Response) => {
  try {
    const statusMatrix = providerRegistry.getStatusMatrix();
    res.json({
      timestamp: new Date().toISOString(),
      provider_count: statusMatrix.length,
      providers: statusMatrix,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /providers/health-check
providersRouter.post('/health-check', async (req: Request, res: Response) => {
  try {
    const results = await providerRegistry.runHealthChecks();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /providers/sync-all
// Ingests one cycle from core initial providers (Weather, AQI, USGS Earthquakes, Transport, Water, Grid)
providersRouter.post('/sync-all', async (req: Request, res: Response) => {
  try {
    const coreProviders = [
      'open_meteo_weather',
      'open_meteo_air_quality',
      'usgs_earthquake',
      'gtfs_transit',
      'gbfs_mobility',
      'data_gov_in',
      'water_level_gauge',
      'national_grid_energy',
      'frankfurter_fx',
      'gdacs_civic_alerts',
    ];

    const results: Record<string, any> = {};

    for (const pid of coreProviders) {
      const provider = providerRegistry.getProvider(pid);
      if (!provider) continue;

      try {
        const { rawData, latencyMs } = await provider.fetch();
        const rawId = worldModelService.storeRawPayload(pid, provider.metadata.endpointUrl, rawData);
        const observations = await provider.normalize(rawData);

        for (const obs of observations) {
          worldModelService.ingestObservation(obs, rawId);
        }

        results[pid] = {
          status: 'SUCCESS',
          latency_ms: latencyMs,
          observations: observations.length,
        };
      } catch (err: any) {
        results[pid] = {
          status: 'FAILED',
          error: err.message,
        };
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
