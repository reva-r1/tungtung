import { db } from '../../db/database.js';
import { MovingEntity, EntityPosition } from '../../types/index.js';
import { OpenSkyProvider, OpenSkyBoundingBox } from '../../connectors/providers/aviation/OpenSkyProvider.js';
import { worldModelService } from '../world_model/world_model.service.js';
import { MaritimeService } from '../maritime/maritime.service.js';
import { v4 as uuidv4 } from 'uuid';

export interface AviationPollResult {
  success: boolean;
  timestamp: string;
  latencyMs: number;
  recordsReceived: number;
  recordsNormalized: number;
  recordsPersisted: number;
  rawPayloadId: string | null;
  error?: string;
}

export interface AviationServiceStatus {
  providerId: string;
  providerName: string;
  status: string;
  isPollingActive: boolean;
  pollIntervalMs: number;
  lastPollAt: string | null;
  lastSuccessfulPollAt: string | null;
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
  private lastSuccessfulPollAt: string | null = null;
  private lastVesselFixTime: Map<string, number> = new Map();
  private pollIntervalMs = 60000; // 60s standard poll interval to respect OpenSky rate limits

  private constructor() {
    this.provider = new OpenSkyProvider();
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

    this.isRunningPoll = true;
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

    const callsign = obs.value.callsign || icao24.toUpperCase();
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
    const aircraft: MovingEntity = {
      id: entityId,
      type: 'aircraft',
      mmsi: obs.value.squawk || icao24,
      name: callsign,
      vessel_type: originCountry !== 'Unknown' ? `${originCountry} Aircraft` : 'Civil Aircraft',
      latitude: lat,
      longitude: lon,
      speed: speedKnots ?? undefined,
      course: heading ?? undefined,
      heading: heading ?? undefined,
      destination: originCountry,
      status: onGround ? 'on_ground' : 'airborne',
      last_updated_at: observedAt,
      properties: {
        icao24,
        callsign,
        origin_country: originCountry,
        altitude_m: obs.value.altitude_m,
        altitude_ft: obs.value.altitude_ft,
        geo_altitude_m: obs.value.geo_altitude_m,
        speed_kmh: obs.value.speed_kmh,
        vertical_rate_ms: obs.value.vertical_rate_ms,
        on_ground: onGround,
        squawk: obs.value.squawk,
        provider: this.provider.id,
        providerSource: 'The OpenSky Network (https://opensky-network.org)',
      },
    };

    // 3. Upsert into moving_entities
    const upsertStmt = db.prepare(`
      INSERT INTO moving_entities (
        id, type, mmsi, imo, name, vessel_type, latitude, longitude,
        speed, course, heading, destination, eta, status, last_updated_at, properties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        vessel_type = excluded.vessel_type,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        speed = excluded.speed,
        course = excluded.course,
        heading = excluded.heading,
        destination = excluded.destination,
        status = excluded.status,
        last_updated_at = excluded.last_updated_at,
        properties = excluded.properties
    `);

    upsertStmt.run(
      aircraft.id,
      aircraft.type,
      aircraft.mmsi || null,
      null, // imo
      aircraft.name,
      aircraft.vessel_type || null,
      aircraft.latitude,
      aircraft.longitude,
      aircraft.speed ?? null,
      aircraft.course ?? null,
      aircraft.heading ?? null,
      aircraft.destination || null,
      null, // eta
      aircraft.status,
      aircraft.last_updated_at,
      JSON.stringify(aircraft.properties || {})
    );

    // 4. Append to historical entity_positions track (throttled to 8 seconds per entity)
    const lastFix = this.lastVesselFixTime.get(entityId) || 0;
    if (epochSec - lastFix >= 8) {
      this.lastVesselFixTime.set(entityId, epochSec);
      const posId = `pos_air_${entityId}_${epochSec}_${uuidv4().substring(0, 6)}`;
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
   * Retrieves all current aircraft
   */
  public getAllAircraft(limit: number = 300): MovingEntity[] {
    const rows = db.prepare(`
      SELECT * FROM moving_entities
      WHERE type = 'aircraft'
      ORDER BY last_updated_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      mmsi: r.mmsi,
      imo: r.imo,
      name: r.name,
      vessel_type: r.vessel_type,
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
      mmsi: r.mmsi,
      imo: r.imo,
      name: r.name,
      vessel_type: r.vessel_type,
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
   * Retrieves historical trajectory coordinates for an aircraft
   */
  public getAircraftTrack(id: string, limit: number = 64): { entity_id: string; point_count: number; track: EntityPosition[] } {
    const rows = db.prepare(`
      SELECT id, entity_id, latitude, longitude, speed, course, timestamp, epoch_sec
      FROM entity_positions
      WHERE entity_id = ?
      ORDER BY epoch_sec DESC
      LIMIT ?
    `).all(id, limit) as EntityPosition[];

    return {
      entity_id: id,
      point_count: rows.length,
      track: rows.reverse(), // Chronological order
    };
  }

  /**
   * Returns complete health, diagnostics, and data freshness status
   */
  public getStatus(): AviationServiceStatus {
    const health = this.provider.getHealth();

    const counts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'airborne' THEN 1 ELSE 0 END) as airborne,
        SUM(CASE WHEN status = 'on_ground' THEN 1 ELSE 0 END) as on_ground
      FROM moving_entities
      WHERE type = 'aircraft'
    `).get() as any;

    return {
      providerId: this.provider.id,
      providerName: this.provider.name,
      status: health.status,
      isPollingActive: this.isPolling,
      pollIntervalMs: this.pollIntervalMs,
      lastPollAt: this.lastPollAt,
      lastSuccessfulPollAt: this.lastSuccessfulPollAt,
      totalAircraftInDb: counts?.total || 0,
      airborneCount: counts?.airborne || 0,
      onGroundCount: counts?.on_ground || 0,
      lastError: health.lastError,
      consecutiveFailures: health.consecutiveFailures,
      rateLimitRemaining: health.rateLimitRemaining,
    };
  }

  /**
   * Starts background scheduler
   */
  public startPolling(intervalMs: number = 60000): void {
    if (this.isPolling) return;
    this.pollIntervalMs = intervalMs;
    this.isPolling = true;

    // Trigger initial poll immediately
    this.pollOnce().catch(err => console.error('[AviationService] Initial poll failed:', err.message));

    // Schedule recurring job
    this.pollIntervalTimer = setInterval(() => {
      this.pollOnce().catch(err => console.error('[AviationService] Scheduled poll failed:', err.message));
    }, this.pollIntervalMs);
  }

  /**
   * Stops background scheduler
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
