import { db } from '../../db/database.js';
import { USGSEarthquakeProvider } from '../../connectors/providers/earthquakes/USGSEarthquakeProvider.js';
import { NormalizedObservation } from '../../connectors/base/types.js';
import { worldModelService } from '../world_model/world_model.service.js';

export interface EarthquakePollResult {
  success: boolean;
  timestamp: string;
  latencyMs: number;
  recordsReceived: number;
  recordsNormalized: number;
  recordsPersisted: number;
  rawPayloadId: string | null;
  error?: string;
  cooldownRemainingSec?: number;
}

export interface EarthquakeEventRecord {
  id: string;
  name: string;
  type: string;
  category: string;
  latitude: number;
  longitude: number;
  depth_km: number;
  magnitude: number | null;
  magType: string;
  place: string;
  status: string;
  tsunami_alert: number;
  significance: number;
  felt_reports: number | null;
  origin_time: string;
  updated_at: string;
  observed_at: string;
  last_updated_at: string;
  provider: string;
  source_network: string;
  data_kind: string;
  is_direct_instrument_sensor: boolean;
  provenance: any;
}

export interface EarthquakeServiceStatus {
  providerId: string;
  providerName: string;
  status: string;
  connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
  dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
  operationalState: 'CONNECTED_FRESH' | 'CONNECTED_STALE' | 'CONNECTED_EMPTY' | 'CONNECTED_HISTORICAL' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
  isPollingActive: boolean;
  pollIntervalMs: number;
  lastPollAt: string | null;
  lastSuccessfulPollAt: string | null;
  newestObservationAt: string | null;
  newestObservationAgeMinutes: number | null;
  totalEventsInDb: number;
  maxMagnitude: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  rateLimitRemaining: number;
}

export class EarthquakeService {
  private static instance: EarthquakeService;
  private provider: USGSEarthquakeProvider;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isRunningPoll = false;
  private lastPollAt: string | null = null;
  private lastPollEpochMs = 0;
  private lastSuccessfulPollAt: string | null = null;
  private pollIntervalMs = 300000; // 5 mins standard poll
  private minPollIntervalMs = 5000; // 5s cooldown

  private constructor() {
    this.provider = new USGSEarthquakeProvider();
    const envPoll = Number(process.env.USGS_POLL_INTERVAL_MS);
    if (!isNaN(envPoll) && envPoll >= 30000) {
      this.pollIntervalMs = envPoll;
    }
  }

  public static getInstance(): EarthquakeService {
    if (!EarthquakeService.instance) {
      EarthquakeService.instance = new EarthquakeService();
    }
    return EarthquakeService.instance;
  }

  public getProvider(): USGSEarthquakeProvider {
    return this.provider;
  }

  public async pollNow(feedType: 'hour' | 'day' = 'hour'): Promise<EarthquakePollResult> {
    return this.pollOnce(feedType);
  }

  public async pollOnce(feedType: 'hour' | 'day' = 'hour'): Promise<EarthquakePollResult> {
    if (this.isRunningPoll) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        recordsReceived: 0,
        recordsNormalized: 0,
        recordsPersisted: 0,
        rawPayloadId: null,
        error: 'Earthquake ingestion cycle is already in progress',
      };
    }

    const nowMs = Date.now();
    const elapsedSinceLastPoll = nowMs - this.lastPollEpochMs;
    if (this.lastPollEpochMs > 0 && elapsedSinceLastPoll < this.minPollIntervalMs) {
      const cooldownSec = Math.ceil((this.minPollIntervalMs - elapsedSinceLastPoll) / 1000);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        recordsReceived: 0,
        recordsNormalized: 0,
        recordsPersisted: 0,
        rawPayloadId: null,
        error: `Rate limit cooldown active. Try again in ${cooldownSec}s`,
        cooldownRemainingSec: cooldownSec,
      };
    }

    this.isRunningPoll = true;
    this.lastPollEpochMs = nowMs;
    this.lastPollAt = new Date().toISOString();

    try {
      const { rawData, latencyMs } = await this.provider.fetch({ feedType });
      const rawPayloadId = worldModelService.storeRawPayload(
        this.provider.metadata.id,
        this.provider.metadata.endpointUrl,
        rawData
      );

      const normalized = await this.provider.normalize(rawData);
      const persistedCount = this.ingestObservations(normalized, rawPayloadId);

      this.lastSuccessfulPollAt = new Date().toISOString();
      this.isRunningPoll = false;

      return {
        success: true,
        timestamp: this.lastSuccessfulPollAt,
        latencyMs,
        recordsReceived: rawData.features?.length || 0,
        recordsNormalized: normalized.length,
        recordsPersisted: persistedCount,
        rawPayloadId,
      };
    } catch (err: any) {
      this.isRunningPoll = false;
      return {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        recordsReceived: 0,
        recordsNormalized: 0,
        recordsPersisted: 0,
        rawPayloadId: null,
        error: err.message || 'USGS fetch failed',
      };
    }
  }

  public ingestObservations(observations: NormalizedObservation[], rawPayloadId?: string | null): number {
    let persistedCount = 0;
    for (const obs of observations) {
      try {
        worldModelService.ingestObservation(obs, rawPayloadId || undefined);
        persistedCount++;
      } catch (err: any) {
        console.warn(`[EarthquakeService] Ingestion note for ${obs.id}:`, err.message);
      }
    }
    return persistedCount;
  }

  public getAllEvents(limit: number = 100): EarthquakeEventRecord[] {
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
      WHERE e.type = 'EARTHQUAKE_EPICENTER' OR (e.category = 'SEISMIC' AND e.last_provider = 'usgs_earthquake')
      ORDER BY e.last_observed_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map((r) => {
      let state: any = {};
      try {
        state = JSON.parse(r.current_state || '{}');
      } catch (_) {}

      return {
        id: r.id,
        name: r.name || state.place || 'Seismic Event',
        type: r.type,
        category: r.category,
        latitude: r.latitude,
        longitude: r.longitude,
        depth_km: state.depth_km ?? 0,
        magnitude: state.magnitude ?? null,
        magType: state.magType || 'unknown',
        place: state.place || r.name,
        status: state.status || 'preliminary',
        tsunami_alert: state.tsunami_alert ?? 0,
        significance: state.significance ?? 0,
        felt_reports: state.felt_reports ?? null,
        origin_time: state.origin_time || r.last_observed_at,
        updated_at: state.updated_at || r.last_updated_at,
        observed_at: r.last_observed_at,
        last_updated_at: r.last_updated_at || r.last_observed_at,
        provider: r.last_provider || 'usgs_earthquake',
        source_network: state.source_network || 'USGS',
        data_kind: 'DIRECT_OBSERVATION',
        is_direct_instrument_sensor: true,
        provenance: {
          agency: 'USGS',
          source: 'https://earthquake.usgs.gov/earthquakes/feed/',
          license: 'Public Domain (USGS)',
          eventUrl: state.url,
        },
      };
    });
  }

  public getEventById(id: string): EarthquakeEventRecord | null {
    const r = db.prepare(`
      SELECT * FROM world_entities
      WHERE id = ? AND (type = 'EARTHQUAKE_EPICENTER' OR category = 'SEISMIC')
    `).get(id) as any;

    if (!r) return null;

    let state: any = {};
    try {
      state = JSON.parse(r.current_state || '{}');
    } catch (_) {}

    return {
      id: r.id,
      name: r.name || state.place || 'Seismic Event',
      type: r.type,
      category: r.category,
      latitude: r.latitude,
      longitude: r.longitude,
      depth_km: state.depth_km ?? 0,
      magnitude: state.magnitude ?? null,
      magType: state.magType || 'unknown',
      place: state.place || r.name,
      status: state.status || 'preliminary',
      tsunami_alert: state.tsunami_alert ?? 0,
      significance: state.significance ?? 0,
      felt_reports: state.felt_reports ?? null,
      origin_time: state.origin_time || r.last_observed_at,
      updated_at: state.updated_at || r.last_updated_at,
      observed_at: r.last_observed_at,
      last_updated_at: r.last_updated_at || r.last_observed_at,
      provider: r.last_provider || 'usgs_earthquake',
      source_network: state.source_network || 'USGS',
      data_kind: 'DIRECT_OBSERVATION',
      is_direct_instrument_sensor: true,
      provenance: {
        agency: 'USGS',
        source: 'https://earthquake.usgs.gov/earthquakes/feed/',
        license: 'Public Domain (USGS)',
        eventUrl: state.url,
      },
    };
  }

  public getStatus(): EarthquakeServiceStatus {
    const providerHealth = this.provider.getHealth();

    const countRow = db.prepare(`
      SELECT 
        COUNT(*) as total,
        MAX(last_observed_at) as newest_observed
      FROM world_entities
      WHERE type = 'EARTHQUAKE_EPICENTER' OR (category = 'SEISMIC' AND last_provider = 'usgs_earthquake')
    `).get() as any;

    const totalEventsInDb = countRow?.total || 0;
    const newestObservationAt = countRow?.newest_observed || null;

    let newestObservationAgeMinutes: number | null = null;
    let dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN' = 'UNKNOWN';

    if (newestObservationAt) {
      const obsDate = new Date(newestObservationAt);
      if (!isNaN(obsDate.getTime())) {
        const diffMs = Math.max(0, Date.now() - obsDate.getTime());
        newestObservationAgeMinutes = Math.floor(diffMs / 60000);

        if (newestObservationAgeMinutes <= 180) {
          dataFreshness = 'FRESH'; // observed within 3 hours
        } else if (newestObservationAgeMinutes <= 1440) {
          dataFreshness = 'STALE'; // observed within 24 hours
        } else {
          dataFreshness = 'HISTORICAL';
        }
      }
    } else if (totalEventsInDb === 0) {
      dataFreshness = 'EMPTY';
    }

    let connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY' = 'STANDBY';
    if (providerHealth.status === 'RATE_LIMITED') {
      connectionState = 'RATE_LIMITED';
    } else if (providerHealth.consecutiveFailures > 0 && providerHealth.status === 'DOWN') {
      connectionState = 'DISCONNECTED';
    } else if (providerHealth.consecutiveFailures > 0) {
      connectionState = 'DEGRADED';
    } else if (this.lastSuccessfulPollAt) {
      connectionState = 'CONNECTED';
    }

    let operationalState: 'CONNECTED_FRESH' | 'CONNECTED_STALE' | 'CONNECTED_EMPTY' | 'CONNECTED_HISTORICAL' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    if (connectionState === 'RATE_LIMITED') {
      operationalState = 'RATE_LIMITED';
    } else if (connectionState === 'DISCONNECTED') {
      operationalState = 'DISCONNECTED';
    } else if (connectionState === 'STANDBY') {
      operationalState = 'STANDBY';
    } else {
      switch (dataFreshness) {
        case 'FRESH':
          operationalState = 'CONNECTED_FRESH';
          break;
        case 'STALE':
          operationalState = 'CONNECTED_STALE';
          break;
        case 'EMPTY':
          operationalState = 'CONNECTED_EMPTY';
          break;
        case 'HISTORICAL':
        default:
          operationalState = 'CONNECTED_HISTORICAL';
          break;
      }
    }

    return {
      providerId: this.provider.metadata.id,
      providerName: this.provider.metadata.name,
      status: providerHealth.status,
      connectionState,
      dataFreshness,
      operationalState,
      isPollingActive: this.isPolling,
      pollIntervalMs: this.pollIntervalMs,
      lastPollAt: this.lastPollAt,
      lastSuccessfulPollAt: this.lastSuccessfulPollAt,
      newestObservationAt,
      newestObservationAgeMinutes,
      totalEventsInDb,
      maxMagnitude: null,
      lastError: providerHealth.lastError,
      consecutiveFailures: providerHealth.consecutiveFailures,
      rateLimitRemaining: providerHealth.rateLimitRemaining,
    };
  }

  public startPolling(intervalMs?: number): void {
    if (this.isPolling) return;
    if (intervalMs && intervalMs >= 30000) {
      this.pollIntervalMs = intervalMs;
    }
    this.isPolling = true;

    // Initial safe trigger in background
    this.pollOnce().catch(err => console.warn('[EarthquakeService] Initial poll notice:', err.message));

    this.pollIntervalTimer = setInterval(() => {
      this.pollOnce().catch(err => console.warn('[EarthquakeService] Scheduled poll notice:', err.message));
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

export const earthquakeService = EarthquakeService.getInstance();
