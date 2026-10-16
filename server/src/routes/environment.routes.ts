import { Router, Request, Response } from 'express';
import { environmentService } from '../services/environment/environment.service.js';
import { OPERATIONAL_WEATHER_NODES } from '../connectors/providers/weather/OpenMeteoWeatherProvider.js';

export const environmentRouter = Router();

/**
 * GET /api/environment/status
 * Decoupled provider connection diagnostics and model freshness metrics
 */
environmentRouter.get('/status', (req: Request, res: Response) => {
  try {
    const status = environmentService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/environment/weather
 * Returns weather conditions across configured operational nodes
 */
environmentRouter.get('/weather', (req: Request, res: Response) => {
  try {
    const nodes = environmentService.getWeatherNodes();
    const status = environmentService.getStatus();

    res.json({
      meta: {
        provider: 'Open-Meteo Weather API',
        sourceUrl: 'https://open-meteo.com/en/docs',
        license: 'CC BY 4.0',
        dataKind: 'NUMERICAL_WEATHER_PREDICTION',
        modelSource: 'ECMWF_GFS_ICON_BLEND',
        isDirectInstrumentSensor: false,
        warning: 'Numerical weather prediction model estimates; not direct ground station readings.',
        connectionState: status.weatherConnectionState,
        dataFreshness: status.weatherFreshness,
        operationalState: status.weatherOperationalState,
        lastSuccessfulPollAt: status.lastSuccessfulPollAt,
        newestObservationAt: status.newestWeatherObservationAt,
        count: nodes.length,
      },
      nodes,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/environment/air-quality
 * Returns Copernicus CAMS atmospheric pollutant estimates
 */
environmentRouter.get('/air-quality', (req: Request, res: Response) => {
  try {
    const nodes = environmentService.getAirQualityNodes();
    const status = environmentService.getStatus();

    res.json({
      meta: {
        provider: 'Open-Meteo Air Quality API',
        sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
        license: 'CC BY 4.0',
        dataKind: 'ATMOSPHERIC_MODEL_ESTIMATE',
        modelSource: 'COPERNICUS_CAMS_GLOBAL',
        isDirectInstrumentSensor: false,
        warning: 'Contains modified Copernicus Atmosphere Monitoring Service information (2026). Model estimates; not direct regulatory station telemetry.',
        connectionState: status.airQualityConnectionState,
        dataFreshness: status.airQualityFreshness,
        operationalState: status.airQualityOperationalState,
        lastSuccessfulPollAt: status.lastSuccessfulPollAt,
        newestObservationAt: status.newestAirQualityObservationAt,
        count: nodes.length,
      },
      nodes,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/environment/nodes
 * Returns configured operational monitoring nodes
 */
environmentRouter.get('/nodes', (req: Request, res: Response) => {
  res.json({
    count: OPERATIONAL_WEATHER_NODES.length,
    nodes: OPERATIONAL_WEATHER_NODES,
  });
});

/**
 * POST /api/environment/poll
 * Manual trigger for bounded environmental sync
 */
environmentRouter.post('/poll', async (req: Request, res: Response) => {
  try {
    const nodeId = req.body?.nodeId as string | undefined;
    const result = await environmentService.pollNow(nodeId);
    if (!result.success && result.errors.some(e => e.includes('cooldown'))) {
      return res.status(429).json(result);
    }
    if (!result.success && result.weatherPersisted === 0 && result.airQualityPersisted === 0) {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
