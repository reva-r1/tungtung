import { db } from '../../db/database.js';
import { OpenMeteoWeatherProvider, OPERATIONAL_WEATHER_NODES, WeatherLocationConfig } from '../../connectors/providers/weather/OpenMeteoWeatherProvider.js';
import { OpenMeteoAirQualityProvider } from '../../connectors/providers/air_quality/OpenMeteoAirQualityProvider.js';
import { NormalizedObservation } from '../../connectors/base/types.js';
import { worldModelService } from '../world_model/world_model.service.js';

export interface EnvironmentPollResult {
  success: boolean;
  timestamp: string;
  weatherReceived: number;
  weatherPersisted: number;
  airQualityReceived: number;
  airQualityPersisted: number;
  errors: string[];
}

export interface WeatherNodeRecord {
  id: string;
  name: string;
  type: string;
  category: string;
  latitude: number;
  longitude: number;
  temperature_c: number | null;
  relative_humidity_pct: number | null;
  precipitation_mm: number;
  rain_mm: number;
  surface_pressure_hpa: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  weather_code: number | null;
  elevation_m: number | null;
  model_source: string;
  data_kind: string;
  is_direct_instrument_sensor: boolean;
  observed_at: string;
  last_updated_at: string;
  provider: string;
  provenance: any;
}

export interface AirQualityNodeRecord {
  id: string;
  name: string;
  type: string;
  category: string;
  latitude: number;
  longitude: number;
  us_aqi: number | null;
  european_aqi: number | null;
  pm2_5_ugm3: number | null;
  pm10_ugm3: number | null;
  nitrogen_dioxide_ugm3: number | null;
  sulphur_dioxide_ugm3: number | null;
  ozone_ugm3: number | null;
  carbon_monoxide_ugm3: number | null;
  model_source: string;
  data_kind: string;
  is_direct_instrument_sensor: boolean;
  observed_at: string;
  last_updated_at: string;
  provider: string;
  provenance: any;
}

export interface EnvironmentServiceStatus {
  weatherProviderId: string;
  weatherConnectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
  weatherFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
  weatherOperationalState: string;
  airQualityProviderId: string;
  airQualityConnectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
  airQualityFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
  airQualityOperationalState: string;
  configuredNodesCount: number;
  totalWeatherNodesInDb: number;
  totalAirQualityNodesInDb: number;
  lastPollAt: string | null;
  lastSuccessfulPollAt: string | null;
  newestWeatherObservationAt: string | null;
  newestAirQualityObservationAt: string | null;
  isPollingActive: boolean;
  pollIntervalMs: number;
  lastErrors: string[];
}

export class EnvironmentService {
  private static instance: EnvironmentService;
  private weatherProvider: OpenMeteoWeatherProvider;
  private aqiProvider: OpenMeteoAirQualityProvider;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isRunningPoll = false;
  private lastPollAt: string | null = null;
  private lastPollEpochMs = 0;
  private lastSuccessfulPollAt: string | null = null;
  private pollIntervalMs = 900000; // 15 mins
  private minPollIntervalMs = 10000; // 10s cooldown

  private constructor() {
    this.weatherProvider = new OpenMeteoWeatherProvider();
    this.aqiProvider = new OpenMeteoAirQualityProvider();

    const envPoll = Number(process.env.OPEN_METEO_POLL_INTERVAL_MS);
    if (!isNaN(envPoll) && envPoll >= 60000) {
      this.pollIntervalMs = envPoll;
    }
  }

  public static getInstance(): EnvironmentService {
    if (!EnvironmentService.instance) {
      EnvironmentService.instance = new EnvironmentService();
    }
    return EnvironmentService.instance;
  }

  public getWeatherProvider(): OpenMeteoWeatherProvider {
    return this.weatherProvider;
  }

  public getAirQualityProvider(): OpenMeteoAirQualityProvider {
    return this.aqiProvider;
  }

  public async pollNow(nodeId?: string): Promise<EnvironmentPollResult> {
    return this.pollOnce(nodeId);
  }

  public async pollOnce(nodeId?: string): Promise<EnvironmentPollResult> {
    if (this.isRunningPoll) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        weatherReceived: 0,
        weatherPersisted: 0,
        airQualityReceived: 0,
        airQualityPersisted: 0,
        errors: ['Environmental polling cycle already running'],
      };
    }

    const nowMs = Date.now();
    const elapsedSinceLastPoll = nowMs - this.lastPollEpochMs;
    if (this.lastPollEpochMs > 0 && elapsedSinceLastPoll < this.minPollIntervalMs) {
      const cooldownSec = Math.ceil((this.minPollIntervalMs - elapsedSinceLastPoll) / 1000);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        weatherReceived: 0,
        weatherPersisted: 0,
        airQualityReceived: 0,
        airQualityPersisted: 0,
        errors: [`Rate limit cooldown active. Retry in ${cooldownSec}s`],
      };
    }

    this.isRunningPoll = true;
    this.lastPollEpochMs = nowMs;
    this.lastPollAt = new Date().toISOString();

    const errors: string[] = [];
    let weatherReceived = 0;
    let weatherPersisted = 0;
    let airQualityReceived = 0;
    let airQualityPersisted = 0;

    const targets = nodeId
      ? OPERATIONAL_WEATHER_NODES.filter(n => n.id === nodeId)
      : OPERATIONAL_WEATHER_NODES;

    for (const node of targets) {
      // 1. Weather sync
      try {
        const { rawData } = await this.weatherProvider.fetch({ latitude: node.latitude, longitude: node.longitude, nodeId: node.id });
        const rawPayloadId = worldModelService.storeRawPayload(
          this.weatherProvider.metadata.id,
          this.weatherProvider.metadata.endpointUrl,
          rawData
        );
        const normalized = await this.weatherProvider.normalize(rawData);
        weatherReceived += normalized.length;
        for (const obs of normalized) {
          worldModelService.ingestObservation(obs, rawPayloadId);
          weatherPersisted++;
        }
      } catch (err: any) {
        errors.push(`Weather fetch failed for ${node.id}: ${err.message}`);
      }

      // 2. Air quality sync
      try {
        const { rawData } = await this.aqiProvider.fetch({ latitude: node.latitude, longitude: node.longitude, nodeId: node.id });
        const rawPayloadId = worldModelService.storeRawPayload(
          this.aqiProvider.metadata.id,
          this.aqiProvider.metadata.endpointUrl,
          rawData
        );
        const normalized = await this.aqiProvider.normalize(rawData);
        airQualityReceived += normalized.length;
        for (const obs of normalized) {
          worldModelService.ingestObservation(obs, rawPayloadId);
          airQualityPersisted++;
        }
      } catch (err: any) {
        errors.push(`Air quality fetch failed for ${node.id}: ${err.message}`);
      }
    }

    this.isRunningPoll = false;
    if (weatherPersisted > 0 || airQualityPersisted > 0) {
      this.lastSuccessfulPollAt = new Date().toISOString();
    }

    return {
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      weatherReceived,
      weatherPersisted,
      airQualityReceived,
      airQualityPersisted,
      errors,
    };
  }

  public getWeatherNodes(): WeatherNodeRecord[] {
    const rows = db.prepare(`
      SELECT 
        e.id,
        e.name,
        e.type,
        e.category,
        e.latitude,
        e.longitude,
        e.current_state,
        e.last_observed_at,
        e.last_updated_at,
        e.last_provider
      FROM world_entities e
      WHERE e.type = 'WEATHER_STATION' OR (e.category = 'METEOROLOGICAL' AND e.last_provider = 'open_meteo_weather')
      ORDER BY e.name ASC
    `).all() as any[];

    return rows.map((r) => {
      let state: any = {};
      try {
        state = JSON.parse(r.current_state || '{}');
      } catch (_) {}

      return {
        id: r.id,
        name: r.name || state.station_name || 'Regional Weather Node',
        type: r.type,
        category: r.category,
        latitude: r.latitude,
        longitude: r.longitude,
        temperature_c: state.temperature_c ?? null,
        relative_humidity_pct: state.relative_humidity_pct ?? null,
        precipitation_mm: state.precipitation_mm ?? 0,
        rain_mm: state.rain_mm ?? 0,
        surface_pressure_hpa: state.surface_pressure_hpa ?? null,
        wind_speed_kmh: state.wind_speed_kmh ?? null,
        wind_direction_deg: state.wind_direction_deg ?? null,
        weather_code: state.weather_code ?? null,
        elevation_m: state.elevation_m ?? null,
        model_source: state.model_source || 'ECMWF_GFS_ICON_BLEND',
        data_kind: state.data_kind || 'NUMERICAL_WEATHER_PREDICTION',
        is_direct_instrument_sensor: false,
        observed_at: r.last_observed_at,
        last_updated_at: r.last_updated_at || r.last_observed_at,
        provider: r.last_provider || 'open_meteo_weather',
        provenance: {
          agency: 'Open-Meteo',
          source: 'https://open-meteo.com/en/docs',
          license: 'CC BY 4.0',
          warning: 'Model output; not direct sensor telemetry',
        },
      };
    });
  }

  public getAirQualityNodes(): AirQualityNodeRecord[] {
    const rows = db.prepare(`
      SELECT 
        e.id,
        e.name,
        e.type,
        e.category,
        e.latitude,
        e.longitude,
        e.current_state,
        e.last_observed_at,
        e.last_updated_at,
        e.last_provider
      FROM world_entities e
      WHERE e.type = 'AIR_QUALITY_STATION' OR (e.category = 'AIR_QUALITY' AND e.last_provider = 'open_meteo_air_quality')
      ORDER BY e.name ASC
    `).all() as any[];

    return rows.map((r) => {
      let state: any = {};
      try {
        state = JSON.parse(r.current_state || '{}');
      } catch (_) {}

      return {
        id: r.id,
        name: r.name || state.station_name || 'Regional AQI Node',
        type: r.type,
        category: r.category,
        latitude: r.latitude,
        longitude: r.longitude,
        us_aqi: state.us_aqi ?? null,
        european_aqi: state.european_aqi ?? null,
        pm2_5_ugm3: state.pm2_5_ugm3 ?? null,
        pm10_ugm3: state.pm10_ugm3 ?? null,
        nitrogen_dioxide_ugm3: state.nitrogen_dioxide_ugm3 ?? null,
        sulphur_dioxide_ugm3: state.sulphur_dioxide_ugm3 ?? null,
        ozone_ugm3: state.ozone_ugm3 ?? null,
        carbon_monoxide_ugm3: state.carbon_monoxide_ugm3 ?? null,
        model_source: state.model_source || 'COPERNICUS_CAMS_GLOBAL',
        data_kind: state.data_kind || 'ATMOSPHERIC_MODEL_ESTIMATE',
        is_direct_instrument_sensor: false,
        observed_at: r.last_observed_at,
        last_updated_at: r.last_updated_at || r.last_observed_at,
        provider: r.last_provider || 'open_meteo_air_quality',
        provenance: {
          agency: 'Copernicus / Open-Meteo',
          source: 'https://open-meteo.com/en/docs/air-quality-api',
          license: 'CC BY 4.0',
          warning: 'CAMS atmospheric model estimate; not direct regulatory ground station reading',
        },
      };
    });
  }

  public getStatus(): EnvironmentServiceStatus {
    const wxHealth = this.weatherProvider.getHealth();
    const aqiHealth = this.aqiProvider.getHealth();

    const wxCountRow = db.prepare(`
      SELECT COUNT(*) as total, MAX(last_observed_at) as newest
      FROM world_entities
      WHERE type = 'WEATHER_STATION' OR (category = 'METEOROLOGICAL' AND last_provider = 'open_meteo_weather')
    `).get() as any;

    const aqiCountRow = db.prepare(`
      SELECT COUNT(*) as total, MAX(last_observed_at) as newest
      FROM world_entities
      WHERE type = 'AIR_QUALITY_STATION' OR (category = 'AIR_QUALITY' AND last_provider = 'open_meteo_air_quality')
    `).get() as any;

    const totalWeatherNodesInDb = wxCountRow?.total || 0;
    const newestWeatherObservationAt = wxCountRow?.newest || null;
    const totalAirQualityNodesInDb = aqiCountRow?.total || 0;
    const newestAirQualityObservationAt = aqiCountRow?.newest || null;

    const evaluateFreshness = (newestAt: string | null, total: number): 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN' => {
      if (!newestAt) return total === 0 ? 'EMPTY' : 'UNKNOWN';
      const dt = new Date(newestAt);
      if (isNaN(dt.getTime())) return 'UNKNOWN';
      const ageHours = (Date.now() - dt.getTime()) / 3600000;
      if (ageHours <= 3) return 'FRESH';
      if (ageHours <= 24) return 'STALE';
      return 'HISTORICAL';
    };

    const weatherFreshness = evaluateFreshness(newestWeatherObservationAt, totalWeatherNodesInDb);
    const airQualityFreshness = evaluateFreshness(newestAirQualityObservationAt, totalAirQualityNodesInDb);

    const getConnState = (health: any): 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY' => {
      if (health.status === 'RATE_LIMITED') return 'RATE_LIMITED';
      if (health.consecutiveFailures > 0 && health.status === 'DOWN') return 'DISCONNECTED';
      if (health.consecutiveFailures > 0) return 'DEGRADED';
      if (this.lastSuccessfulPollAt) return 'CONNECTED';
      return 'STANDBY';
    };

    const weatherConnectionState = getConnState(wxHealth);
    const airQualityConnectionState = getConnState(aqiHealth);

    const getOpState = (conn: string, freshness: string): string => {
      if (conn === 'RATE_LIMITED') return 'RATE_LIMITED';
      if (conn === 'DISCONNECTED') return 'DISCONNECTED';
      if (conn === 'STANDBY') return 'STANDBY';
      return `CONNECTED_${freshness}`;
    };

    const errors: string[] = [];
    if (wxHealth.lastError) errors.push(`Weather: ${wxHealth.lastError}`);
    if (aqiHealth.lastError) errors.push(`AQI: ${aqiHealth.lastError}`);

    return {
      weatherProviderId: this.weatherProvider.metadata.id,
      weatherConnectionState,
      weatherFreshness,
      weatherOperationalState: getOpState(weatherConnectionState, weatherFreshness),
      airQualityProviderId: this.aqiProvider.metadata.id,
      airQualityConnectionState,
      airQualityFreshness,
      airQualityOperationalState: getOpState(airQualityConnectionState, airQualityFreshness),
      configuredNodesCount: OPERATIONAL_WEATHER_NODES.length,
      totalWeatherNodesInDb,
      totalAirQualityNodesInDb,
      lastPollAt: this.lastPollAt,
      lastSuccessfulPollAt: this.lastSuccessfulPollAt,
      newestWeatherObservationAt,
      newestAirQualityObservationAt,
      isPollingActive: this.isPolling,
      pollIntervalMs: this.pollIntervalMs,
      lastErrors: errors,
    };
  }

  public startPolling(intervalMs?: number): void {
    if (this.isPolling) return;
    if (intervalMs && intervalMs >= 60000) {
      this.pollIntervalMs = intervalMs;
    }
    this.isPolling = true;

    // Initial safe trigger
    this.pollOnce().catch(err => console.warn('[EnvironmentService] Initial poll notice:', err.message));

    this.pollIntervalTimer = setInterval(() => {
      this.pollOnce().catch(err => console.warn('[EnvironmentService] Scheduled poll notice:', err.message));
    }, this.pollIntervalMs);
  }

  public stopPolling(): void {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    this.isPolling = false;
  }
}

export const environmentService = EnvironmentService.getInstance();
