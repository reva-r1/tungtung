import { db } from '../../db/database.js';
import { CwcHydrologyProvider, CwcQueryOptions } from '../../connectors/providers/water/CwcHydrologyProvider.js';
import { NormalizedObservation } from '../../connectors/base/types.js';
import { worldModelService } from '../world_model/world_model.service.js';
import { MaritimeService } from '../maritime/maritime.service.js';

export interface HydrologyPollResult {
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

export interface HydrologyStationRecord {
  id: string;
  name: string;
  type: string;
  category: string;
  latitude: number;
  longitude: number;
  district?: string;
  state?: string;
  river?: string;
  basin?: string;
  current_live_storage_bmc: number;
  current_live_storage_tmc: number;
  full_capacity_bmc: number;
  capacity_pct: number | null;
  observation_date: string;
  observed_at: string;
  last_updated_at: string;
  provider: string;
  provenance: any;
}

export interface HydrologyServiceStatus {
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
  newestObservationAgeDays: number | null;
  totalStationsInDb: number;
  totalLiveStorageBmc: number;
  totalFullCapacityBmc: number;
  overallCapacityPct: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  rateLimitRemaining: number;
}

export class HydrologyService {
  private static instance: HydrologyService;
  private provider: CwcHydrologyProvider;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isRunningPoll = false;
  private lastPollAt: string | null = null;
  private lastPollEpochMs = 0;
  private lastSuccessfulPollAt: string | null = null;
  private pollIntervalMs = 3600000; // 1 hour standard poll interval
  private minPollIntervalMs = 10000; // 10s cooldown

  private constructor() {
    this.provider = new CwcHydrologyProvider();
    const envPoll = Number(process.env.CWC_POLL_INTERVAL_MS);
    if (!isNaN(envPoll) && envPoll >= 30000) {
      this.pollIntervalMs = envPoll;
    }
  }

  public static getInstance(): HydrologyService {
    if (!HydrologyService.instance) {
      HydrologyService.instance = new HydrologyService();
    }
    return HydrologyService.instance;
  }

  public getProvider(): CwcHydrologyProvider {
    return this.provider;
  }

  /**
   * Executes a single, validated Central Water Commission fetch and ingestion cycle
   */
  public async pollNow(options: CwcQueryOptions = {}): Promise<HydrologyPollResult> {
    return this.pollOnce(options);
  }

  public async pollOnce(options: CwcQueryOptions = {}): Promise<HydrologyPollResult> {
    if (this.isRunningPoll) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        recordsReceived: 0,
        recordsNormalized: 0,
        recordsPersisted: 0,
        rawPayloadId: null,
        error: 'Hydrological ingestion cycle is already running',
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
        cooldownRemainingSec: cooldownSec,
        error: `Rate limit cooldown active. Please wait ${cooldownSec}s before polling India-WRIS again.`,
      };
    }

    this.isRunningPoll = true;
    this.lastPollEpochMs = nowMs;
    this.lastPollAt = new Date().toISOString();

    try {
      // 1. Fetch from authentic India-WRIS endpoint
      const { rawData, latencyMs } = await this.provider.fetch(options);
      const rawCount = rawData?.data?.length ?? 0;

      // 2. Persist raw payload for provenance audit
      const rawPayloadId = worldModelService.storeRawPayload(
        this.provider.id,
        this.provider.metadata.endpointUrl,
        rawData
      );

      // 3. Normalize into canonical observations
      const observations = await this.provider.normalize(rawData);
      
      // 4. Ingest into canonical world_observations and world_entities
      const persistedCount = this.ingestObservations(observations, rawPayloadId);

      this.lastSuccessfulPollAt = new Date().toISOString();
      return {
        success: true,
        timestamp: this.lastSuccessfulPollAt,
        latencyMs,
        recordsReceived: rawCount,
        recordsNormalized: observations.length,
        recordsPersisted: persistedCount,
        rawPayloadId,
      };
    } catch (err: any) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        recordsReceived: 0,
        recordsNormalized: 0,
        recordsPersisted: 0,
        rawPayloadId: null,
        error: err.message || 'Unknown India-WRIS ingestion error',
      };
    } finally {
      this.isRunningPoll = false;
    }
  }

  /**
   * Directly ingests an array of normalized hydrological observations into canonical world model
   */
  public ingestObservations(observations: NormalizedObservation[], rawPayloadId?: string | null): number {
    let persistedCount = 0;
    for (const obs of observations) {
      try {
        worldModelService.ingestObservation(obs, rawPayloadId || undefined);
        persistedCount++;

        // Broadcast real-time SSE update
        MaritimeService.broadcastHydroUpdate({
          id: obs.entity_id,
          name: obs.value.station_name,
          latitude: obs.location.latitude,
          longitude: obs.location.longitude,
          river: obs.value.river,
          basin: obs.value.basin,
          district: obs.value.district,
          current_live_storage_bmc: obs.value.current_live_storage_bmc,
          current_live_storage_tmc: obs.value.current_live_storage_tmc,
          full_capacity_bmc: obs.value.full_capacity_bmc,
          capacity_pct: obs.value.capacity_pct,
          observed_at: obs.observed_at,
        });
      } catch (err: any) {
        console.warn(`[HydrologyService] Failed to ingest station observation ${obs.id}:`, err.message);
      }
    }
    return persistedCount;
  }

  /**
   * Retrieves all monitored water reservoir stations with their latest observations
   */
  public getAllStations(): HydrologyStationRecord[] {
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
      WHERE e.type = 'WATER_RESERVOIR_GAUGE' OR (e.category = 'HYDROLOGICAL' AND e.last_provider = 'cwc_india_wris')
      ORDER BY e.name ASC
    `).all() as any[];

    return rows.map((r) => {
      let state: any = {};
      try {
        state = JSON.parse(r.current_state || '{}');
      } catch (_) {}

      return {
        id: r.id,
        name: r.name,
        type: r.type,
        category: r.category,
        latitude: r.latitude,
        longitude: r.longitude,
        district: state.district,
        state: state.state || 'Karnataka',
        river: state.river,
        basin: state.basin,
        current_live_storage_bmc: state.current_live_storage_bmc ?? 0,
        current_live_storage_tmc: state.current_live_storage_tmc ?? 0,
        full_capacity_bmc: state.full_capacity_bmc ?? 0,
        capacity_pct: state.capacity_pct ?? null,
        observation_date: state.observation_date || r.last_observed_at?.split('T')[0],
        observed_at: r.last_observed_at,
        last_updated_at: r.last_updated_at || r.last_observed_at,
        provider: r.last_provider,
        provenance: {
          agency: state.agency || 'CWC',
          source: 'https://indiawris.gov.in/Dataset/Reservoir',
          license: 'Open Government Data License - India (OGDL)',
        },
      };
    });
  }

  /**
   * Retrieves a single station by ID
   */
  public getStationById(id: string): HydrologyStationRecord | null {
    const r = db.prepare(`
      SELECT * FROM world_entities
      WHERE id = ? AND (type = 'WATER_RESERVOIR_GAUGE' OR category = 'HYDROLOGICAL')
    `).get(id) as any;

    if (!r) return null;

    let state: any = {};
    try {
      state = JSON.parse(r.current_state || '{}');
    } catch (_) {}

    return {
      id: r.id,
      name: r.name,
      type: r.type,
      category: r.category,
      latitude: r.latitude,
      longitude: r.longitude,
      district: state.district,
      state: state.state || 'Karnataka',
      river: state.river,
      basin: state.basin,
      current_live_storage_bmc: state.current_live_storage_bmc ?? 0,
      current_live_storage_tmc: state.current_live_storage_tmc ?? 0,
      full_capacity_bmc: state.full_capacity_bmc ?? 0,
      capacity_pct: state.capacity_pct ?? null,
      observation_date: state.observation_date || r.last_observed_at?.split('T')[0],
      observed_at: r.last_observed_at,
      last_updated_at: r.last_updated_at || r.last_observed_at,
      provider: r.last_provider,
      provenance: {
        agency: state.agency || 'CWC',
        source: 'https://indiawris.gov.in/Dataset/Reservoir',
        license: 'Open Government Data License - India (OGDL)',
      },
    };
  }

  /**
   * Retrieves chronological observation history for a station
   */
  public getStationHistory(id: string, limit: number = 50): any[] {
    const boundedLimit = Math.min(Math.max(1, limit), 200);
    const rows = db.prepare(`
      SELECT id, entity_id, observed_at, value, source, provider
      FROM world_observations
      WHERE entity_id = ?
      ORDER BY observed_at ASC
      LIMIT ?
    `).all(id, boundedLimit) as any[];

    return rows.map((r) => {
      let val: any = {};
      try {
        val = JSON.parse(r.value || '{}');
      } catch (_) {}
      return {
        id: r.id,
        entity_id: r.entity_id,
        observed_at: r.observed_at,
        date: val.observation_date || r.observed_at?.split('T')[0],
        current_live_storage_bmc: val.current_live_storage_bmc,
        current_live_storage_tmc: val.current_live_storage_tmc,
        capacity_pct: val.capacity_pct,
      };
    });
  }

  /**
   * Returns complete health, diagnostics, and independent data freshness status
   */
  public getStatus(): HydrologyServiceStatus {
    const health = this.provider.getHealth();
    const stations = this.getAllStations();

    let totalLiveBmc = 0;
    let totalCapBmc = 0;
    let newestObsIso: string | null = null;

    for (const s of stations) {
      totalLiveBmc += s.current_live_storage_bmc;
      totalCapBmc += s.full_capacity_bmc;
      if (!newestObsIso || s.observed_at > newestObsIso) {
        newestObsIso = s.observed_at;
      }
    }

    const overallPct = totalCapBmc > 0 ? Math.round((totalLiveBmc / totalCapBmc) * 100) : null;
    const now = Date.now();
    const newestAgeDays = newestObsIso
      ? Math.max(0, Math.floor((now - new Date(newestObsIso).getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // Independent connection state
    let connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY' = 'STANDBY';
    if (health.status === 'RATE_LIMITED') {
      connectionState = 'RATE_LIMITED';
    } else if (health.status === 'CIRCUIT_OPEN') {
      connectionState = 'DISCONNECTED';
    } else if (health.consecutiveFailures > 0 && health.consecutiveFailures < 3) {
      connectionState = 'DEGRADED';
    } else if (this.lastSuccessfulPollAt) {
      connectionState = 'CONNECTED';
    }

    // Independent data freshness (Daily reporting cadence: < 3 days fresh, < 30 days stale, >= 30 days historical)
    let dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN' = 'UNKNOWN';
    if (stations.length === 0) {
      dataFreshness = 'EMPTY';
    } else if (newestAgeDays !== null) {
      if (newestAgeDays <= 3) {
        dataFreshness = 'FRESH';
      } else if (newestAgeDays <= 30) {
        dataFreshness = 'STALE';
      } else {
        dataFreshness = 'HISTORICAL';
      }
    }

    // Combined operational state
    let operationalState: 'CONNECTED_FRESH' | 'CONNECTED_STALE' | 'CONNECTED_EMPTY' | 'CONNECTED_HISTORICAL' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY' = 'STANDBY';
    if (connectionState === 'RATE_LIMITED') {
      operationalState = 'RATE_LIMITED';
    } else if (connectionState === 'DISCONNECTED') {
      operationalState = 'DISCONNECTED';
    } else if (connectionState === 'CONNECTED' || connectionState === 'DEGRADED') {
      if (dataFreshness === 'FRESH') operationalState = 'CONNECTED_FRESH';
      else if (dataFreshness === 'EMPTY') operationalState = 'CONNECTED_EMPTY';
      else if (dataFreshness === 'STALE') operationalState = 'CONNECTED_STALE';
      else operationalState = 'CONNECTED_HISTORICAL';
    }

    return {
      providerId: this.provider.id,
      providerName: this.provider.name,
      status: health.status,
      connectionState,
      dataFreshness,
      operationalState,
      isPollingActive: this.isPolling,
      pollIntervalMs: this.pollIntervalMs,
      lastPollAt: this.lastPollAt,
      lastSuccessfulPollAt: this.lastSuccessfulPollAt,
      newestObservationAt: newestObsIso,
      newestObservationAgeDays: newestAgeDays,
      totalStationsInDb: stations.length,
      totalLiveStorageBmc: Math.round(totalLiveBmc * 100) / 100,
      totalFullCapacityBmc: Math.round(totalCapBmc * 100) / 100,
      overallCapacityPct: overallPct,
      lastError: health.lastError,
      consecutiveFailures: health.consecutiveFailures,
      rateLimitRemaining: health.rateLimitRemaining,
    };
  }

  /**
   * Starts background scheduler
   */
  public startPolling(intervalMs?: number): void {
    if (this.isPolling) return;
    if (intervalMs && intervalMs >= 30000) {
      this.pollIntervalMs = intervalMs;
    }
    this.isPolling = true;

    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }

    // Trigger initial poll
    this.pollOnce().catch((err) => console.warn('[HydrologyService] Initial poll note:', err.message));

    // Schedule recurring poll
    this.pollIntervalTimer = setInterval(() => {
      this.pollOnce().catch((err) => console.warn('[HydrologyService] Scheduled poll note:', err.message));
    }, this.pollIntervalMs);
  }

  /**
   * Stops background scheduler cleanly
   */
  public stopPolling(): void {
    this.isPolling = false;
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
  }
}

export const hydrologyService = HydrologyService.getInstance();
