import { db } from '../../db/database.js';
import { MovingEntity, EntityPosition } from '../../types/index.js';
import { OpenSkyProvider, OpenSkyBoundingBox } from '../../connectors/providers/aviation/OpenSkyProvider.js';
import { worldModelService } from '../world_model/world_model.service.js';
import { MaritimeService } from '../maritime/maritime.service.js';

export interface AviationPollResult {
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

export interface AviationServiceStatus {
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
  newestObservationAgeSec: number | null;
  freshAircraftCount: number;
  staleAircraftCount: number;
  historicalCount: number;
  totalAircraftInDb: number;
  airborneCount: number;
  onGroundCount: number;
  lastError: string | null;
  consecutiveFailures: number;
  rateLimitRemaining: number;
}

export class AviationService {
  private static instance: AviationService;
  private provider: OpenSkyProvider;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private isRunningPoll = false;
  private lastPollAt: string | null = null;
  private lastPollEpochMs = 0;
  private lastSuccessfulPollAt: string | null = null;
  private lastVesselFixTime: Map<string, number> = new Map();
  private pollIntervalMs = 60000; // 60s standard poll interval to respect OpenSky rate limits
  private minPollIntervalMs = 10000; // 10s minimum cooldown between fetches for OpenSky anonymous access

  private constructor() {
    this.provider = new OpenSkyProvider();
    const envPoll = Number(process.env.OPENSKY_POLL_INTERVAL_MS);
    if (!isNaN(envPoll) && envPoll >= 10000) {
      this.pollIntervalMs = envPoll;
    }
    const envMin = Number(process.env.OPENSKY_MIN_POLL_INTERVAL_MS);
    if (!isNaN(envMin) && envMin >= 5000) {
      this.minPollIntervalMs = envMin;
    }
  }

  public static getInstance(): AviationService {
    if (!AviationService.instance) {
      AviationService.instance = new AviationService();
    }
    return AviationService.instance;
  }

  public getProvider(): OpenSkyProvider {
    return this.provider;
  }

  /**
   * Executes a single, validated OpenSky fetch and ingestion cycle
   */
  public async pollOnce(params: OpenSkyBoundingBox = {}): Promise<AviationPollResult> {
    // 1. Prevent concurrent runs
    if (this.isRunningPoll) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs: 0,
        recordsReceived: 0,
        recordsNormalized: 0,
        recordsPersisted: 0,
        rawPayloadId: null,
        error: 'Aviation ingestion cycle is already running',
      };
    }

    // 2. Enforce minimum cooldown between requests to prevent rate limit storms
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
        error: `Rate limit cooldown active. Please wait ${cooldownSec}s before polling OpenSky again.`,
      };
    }

    this.isRunningPoll = true;
    this.lastPollEpochMs = nowMs;
    this.lastPollAt = new Date().toISOString();

    try {
      // 1. Fetch from authentic OpenSky Network endpoint
      const { rawData, latencyMs } = await this.provider.fetch(params);
      const rawCount = rawData?.states?.length ?? 0;

      // 2. Persist raw observation payload for full provenance tracking
      const rawPayloadId = worldModelService.storeRawPayload(
        this.provider.id,
        this.provider.metadata.endpointUrl,
        rawData
      );

      // 3. Validate and normalize raw state vectors into standard observations
      const observations = await this.provider.normalize(rawData);
      let persistedCount = 0;

      // 4. Ingest each validated flight state into canonical database structures
      for (const obs of observations) {
        try {
          const aircraft = this.ingestAircraftObservation(obs, rawPayloadId);
          if (aircraft) {
            persistedCount++;
            // Broadcast live position update via SSE to connected clients
            MaritimeService.broadcastPositionUpdate(aircraft);
          }
        } catch (err: any) {
          console.warn(`[AviationService] Failed to ingest aircraft observation ${obs.id}:`, err.message);
        }
      }

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
        error: err.message || 'Unknown OpenSky ingestion error',
      };
    } finally {
      this.isRunningPoll = false;
    }
  }

  /**
   * Normalizes an observation and persists to moving_entities, entity_positions, and world_observations
   */
  private ingestAircraftObservation(obs: any, rawPayloadId: string): MovingEntity | null {
    const icao24 = obs.value.icao24;
    const lat = obs.location.latitude;
    const lon = obs.location.longitude;

    if (!icao24 || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    const entityId = obs.entity_id; // e.g. AIRCRAFT_80162C
    const nowIso = new Date().toISOString();
    const observedAt = obs.observed_at || nowIso;
    const epochSec = Math.floor(new Date(observedAt).getTime() / 1000);

    const callsign = obs.value.callsign ? String(obs.value.callsign).trim() : null;
    const originCountry = obs.value.origin_country || 'Unknown';
    const onGround = Boolean(obs.value.on_ground);
    const speedKnots = obs.value.speed_knots ?? (obs.value.speed_kmh ? Math.round(obs.value.speed_kmh / 1.852) : null);
    const heading = obs.value.heading_deg ?? null;

    // 1. Check existing entity to avoid overwriting newer valid observations with older ones
    const existing = db.prepare('SELECT last_updated_at FROM moving_entities WHERE id = ?').get(entityId) as any;
    if (existing && existing.last_updated_at) {
      const existingEpoch = new Date(existing.last_updated_at).getTime();
      const currentEpoch = new Date(observedAt).getTime();
      if (currentEpoch < existingEpoch) {
        // Drop out-of-order stale update
        return null;
      }
    }

    // 2. Canonical Moving Entity
    // STRICT TRUTH-IN-DATA:
    // - Aviation entities have NO MMSI or IMO (must be null)
    // - Aviation entities have NO vessel_type or destination (must be null)
    // - ICAO24 is the source identifier preserved in properties.icao24
    // - Callsign is operating callsign, distinct from canonical entity ID
    const aircraft: MovingEntity = {
      id: entityId,
      type: 'aircraft',
      mmsi: undefined, // Never populate MMSI with ICAO24 or squawk
      imo: undefined,
      name: callsign || icao24.toUpperCase(),
      vessel_type: undefined, // Never fabricate ship types
      latitude: lat,
      longitude: lon,
      speed: speedKnots ?? undefined,
      course: heading ?? undefined,
      heading: heading ?? undefined,
      destination: undefined, // Never fabricate originCountry as destination
      eta: undefined,
      status: onGround ? 'on_ground' : 'airborne',
      last_updated_at: observedAt,
      properties: {
        icao24,
        callsign,
        origin_country: originCountry,
        altitude_m: obs.value.altitude_m,
        altitude_ft: obs.value.altitude_ft,
        geo_altitude_m: obs.value.geo_altitude_m,
        speed_mps: obs.value.speed_mps,
        speed_kmh: obs.value.speed_kmh,
        speed_knots: speedKnots,
        vertical_rate_mps: obs.value.vertical_rate_mps,
        heading_deg: heading,
        on_ground: onGround,
        squawk: obs.value.squawk || null,
        provider: this.provider.id,
        providerSource: 'The OpenSky Network (https://opensky-network.org)',
        observed_at: observedAt,
        retrieved_at: nowIso,
      },
    };

    // 3. Upsert into moving_entities
    const upsertStmt = db.prepare(`
      INSERT INTO moving_entities (
        id, type, mmsi, imo, name, vessel_type, latitude, longitude,
        speed, course, heading, destination, eta, status, last_updated_at, properties
      ) VALUES (?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        mmsi = NULL,
        imo = NULL,
        vessel_type = NULL,
        destination = NULL,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        speed = excluded.speed,
        course = excluded.course,
        heading = excluded.heading,
        status = excluded.status,
        last_updated_at = excluded.last_updated_at,
        properties = excluded.properties
    `);

    upsertStmt.run(
      aircraft.id,
      aircraft.type,
      aircraft.name,
      aircraft.latitude,
      aircraft.longitude,
      aircraft.speed ?? null,
      aircraft.course ?? null,
      aircraft.heading ?? null,
      aircraft.status,
      aircraft.last_updated_at,
      JSON.stringify(aircraft.properties || {})
    );

    // 4. Append to historical entity_positions track (throttled to 15 seconds per entity)
    const lastFix = this.lastVesselFixTime.get(entityId) || 0;
    if (epochSec - lastFix >= 15) {
      this.lastVesselFixTime.set(entityId, epochSec);
      const posId = `pos_air_${entityId}_${epochSec}`;
      db.prepare(`
        INSERT OR IGNORE INTO entity_positions (id, entity_id, latitude, longitude, speed, course, timestamp, epoch_sec)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        posId,
        entityId,
        aircraft.latitude,
        aircraft.longitude,
        aircraft.speed ?? null,
        aircraft.heading ?? null,
        aircraft.last_updated_at,
        epochSec
      );
    }

    // 5. Ingest into world_observations and world_entities
    worldModelService.ingestObservation(obs, rawPayloadId);

    return aircraft;
  }

  /**
   * Retrieves all current aircraft with optional freshness filtering
   */
  public getAllAircraft(limit: number = 300, freshOnly: boolean = false): MovingEntity[] {
    const boundedLimit = Math.min(Math.max(1, limit), 1000);
    const now = Date.now();

    let query = `
      SELECT * FROM moving_entities
      WHERE type = 'aircraft'
    `;
    const params: any[] = [];

    if (freshOnly) {
      const freshCutoff = new Date(now - 120 * 1000).toISOString();
      query += ` AND last_updated_at >= ?`;
      params.push(freshCutoff);
    }

    query += ` ORDER BY last_updated_at DESC LIMIT ?`;
    params.push(boundedLimit);

    const rows = db.prepare(query).all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      mmsi: r.mmsi || undefined,
      imo: r.imo || undefined,
      name: r.name,
      vessel_type: r.vessel_type || undefined,
      latitude: r.latitude,
      longitude: r.longitude,
      speed: r.speed,
      course: r.course,
      heading: r.heading,
      destination: r.destination || undefined,
      eta: r.eta || undefined,
      status: r.status,
      last_updated_at: r.last_updated_at,
      properties: JSON.parse(r.properties || '{}'),
    }));
  }

  /**
   * Retrieves single aircraft by ID
   */
  public getAircraftById(id: string): MovingEntity | null {
    const r = db.prepare(`
      SELECT * FROM moving_entities
      WHERE id = ? AND type = 'aircraft'
    `).get(id) as any;

    if (!r) return null;

    return {
      id: r.id,
      type: r.type,
      mmsi: r.mmsi || undefined,
      imo: r.imo || undefined,
      name: r.name,
      vessel_type: r.vessel_type || undefined,
      latitude: r.latitude,
      longitude: r.longitude,
      speed: r.speed,
      course: r.course,
      heading: r.heading,
      destination: r.destination || undefined,
      eta: r.eta || undefined,
      status: r.status,
      last_updated_at: r.last_updated_at,
      properties: JSON.parse(r.properties || '{}'),
    };
  }

  /**
   * Retrieves historical trajectory coordinates for an aircraft (chronological order)
   */
  public getAircraftTrack(id: string, limit: number = 64): { entity_id: string; point_count: number; track: EntityPosition[] } {
    const boundedLimit = Math.min(Math.max(1, limit), 200);
    const rows = db.prepare(`
      SELECT id, entity_id, latitude, longitude, speed, course, timestamp, epoch_sec
      FROM entity_positions
      WHERE entity_id = ?
      ORDER BY epoch_sec DESC
      LIMIT ?
    `).all(id, boundedLimit) as EntityPosition[];

    return {
      entity_id: id,
      point_count: rows.length,
      track: rows.reverse(), // Ensure strictly chronological order
    };
  }

  /**
   * Returns complete health, diagnostics, and independent data freshness status
   */
  public getStatus(): AviationServiceStatus {
    const health = this.provider.getHealth();
    const now = Date.now();

    const counts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'airborne' THEN 1 ELSE 0 END) as airborne,
        SUM(CASE WHEN status = 'on_ground' THEN 1 ELSE 0 END) as on_ground,
        MAX(last_updated_at) as newest_obs
      FROM moving_entities
      WHERE type = 'aircraft'
    `).get() as any;

    const newestObsIso = counts?.newest_obs || null;
    const newestAgeSec = newestObsIso ? Math.max(0, Math.floor((now - new Date(newestObsIso).getTime()) / 1000)) : null;

    // Freshness thresholds
    const freshCutoff = new Date(now - 120 * 1000).toISOString();
    const staleCutoff = new Date(now - 900 * 1000).toISOString();

    const freshnessCounts = db.prepare(`
      SELECT
        SUM(CASE WHEN last_updated_at >= ? THEN 1 ELSE 0 END) as fresh_count,
        SUM(CASE WHEN last_updated_at < ? AND last_updated_at >= ? THEN 1 ELSE 0 END) as stale_count,
        SUM(CASE WHEN last_updated_at < ? THEN 1 ELSE 0 END) as historical_count
      FROM moving_entities
      WHERE type = 'aircraft'
    `).get(freshCutoff, freshCutoff, staleCutoff, staleCutoff) as any;

    const freshAircraftCount = freshnessCounts?.fresh_count || 0;
    const staleAircraftCount = freshnessCounts?.stale_count || 0;
    const historicalCount = freshnessCounts?.historical_count || 0;

    // Independent Connection State
    let connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY' = 'STANDBY';
    if (health.status === 'RATE_LIMITED') {
      connectionState = 'RATE_LIMITED';
    } else if (health.status === 'CIRCUIT_OPEN') {
      connectionState = 'DISCONNECTED';
    } else if (health.consecutiveFailures > 0 && health.consecutiveFailures < 3) {
      connectionState = 'DEGRADED';
    } else if (this.lastSuccessfulPollAt) {
      const sinceLastSuccess = now - new Date(this.lastSuccessfulPollAt).getTime();
      if (sinceLastSuccess < this.pollIntervalMs * 3) {
        connectionState = 'CONNECTED';
      } else {
        connectionState = 'DEGRADED';
      }
    }

    // Independent Data Freshness
    let dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN' = 'UNKNOWN';
    if (!counts || counts.total === 0) {
      dataFreshness = 'EMPTY';
    } else if (newestAgeSec !== null) {
      if (newestAgeSec <= 120) {
        dataFreshness = 'FRESH';
      } else if (newestAgeSec <= 900) {
        dataFreshness = 'STALE';
      } else {
        dataFreshness = 'HISTORICAL';
      }
    }

    // Combined Operational State
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
      newestObservationAgeSec: newestAgeSec,
      freshAircraftCount,
      staleAircraftCount,
      historicalCount,
      totalAircraftInDb: counts?.total || 0,
      airborneCount: counts?.airborne || 0,
      onGroundCount: counts?.on_ground || 0,
      lastError: health.lastError,
      consecutiveFailures: health.consecutiveFailures,
      rateLimitRemaining: health.rateLimitRemaining,
    };
  }

  /**
   * Starts background scheduler with clean timer replacement
   */
  public startPolling(intervalMs?: number): void {
    if (this.isPolling) return;
    if (intervalMs && intervalMs >= 10000) {
      this.pollIntervalMs = intervalMs;
    }
    this.isPolling = true;

    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }

    // Trigger initial poll immediately
    this.pollOnce().catch(err => console.warn('[AviationService] Initial poll note:', err.message));

    // Schedule recurring job
    this.pollIntervalTimer = setInterval(() => {
      this.pollOnce().catch(err => console.warn('[AviationService] Scheduled poll note:', err.message));
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

export const aviationService = AviationService.getInstance();
