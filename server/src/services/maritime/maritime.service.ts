import { db } from '../../db/database.js';
import { MovingEntity, EntityPosition, AisVesselRawUpdate } from '../../types/index.js';
import { AisProvider, AisProviderStatus } from './providers/aisProvider.js';
import { AisStreamProvider } from './providers/aisStreamProvider.js';
import { AisRealReplayProvider } from './providers/aisRealReplayProvider.js';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';

export class MaritimeService {
  private static provider: AisProvider | null = null;
  private static sseClients: Set<Response> = new Set();
  private static lastVesselFixTime: Map<string, number> = new Map();
  private static isInitialized = false;

  /**
   * Initializes the AIS Maritime Ingestion Service
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const isProduction = process.env.NODE_ENV === 'production';
    const isDemoMode = !isProduction && process.env.MARITIME_DEMO_MODE === 'true';
    const apiKey = process.env.AISSTREAM_API_KEY;
    const hasValidApiKey = Boolean(apiKey && apiKey.trim() !== '' && !apiKey.includes('your_'));

    if (isDemoMode) {
      console.log('🚢 [Maritime] DEMO mode — using simulated vessels (MARITIME_DEMO_MODE=true)');
      this.provider = new AisRealReplayProvider();
      await this.provider.connect((rawUpdate) => {
        this.ingestRawUpdate(rawUpdate);
      });
      this.seedInitialHistoricalTrailsIfEmpty();
    } else if (hasValidApiKey) {
      console.log('📡 [Maritime] LIVE mode — connecting to AISStream.io...');
      this.provider = new AisStreamProvider(apiKey!);
      await this.provider.connect((rawUpdate) => {
        this.ingestRawUpdate(rawUpdate);
      });
    } else {
      console.log('⚠️ [Maritime] STANDBY mode — AISSTREAM_API_KEY not configured and MARITIME_DEMO_MODE is not enabled.');
      this.provider = new AisStreamProvider('');
    }
  }

  /**
   * Normalizes and stores an incoming AIS vessel position update
   */
  static ingestRawUpdate(raw: AisVesselRawUpdate): MovingEntity | null {
    if (!raw.mmsi || !Number.isFinite(raw.latitude) || !Number.isFinite(raw.longitude)) {
      return null;
    }

    const entityId = `SHIP_${raw.mmsi}`;
    const nowIso = new Date().toISOString();
    const epochSec = Math.floor(Date.now() / 1000);

    // 1. Normalized Moving Entity Model
    const normalized: MovingEntity = {
      id: entityId,
      type: 'ship',
      mmsi: raw.mmsi,
      imo: raw.imo || undefined,
      name: raw.name || `VESSEL ${raw.mmsi}`,
      vessel_type: raw.type || 'Commercial Vessel',
      latitude: raw.latitude,
      longitude: raw.longitude,
      speed: raw.speed != null ? Number(raw.speed) : undefined,
      course: raw.course != null ? Number(raw.course) : undefined,
      heading: raw.heading != null ? Number(raw.heading) : undefined,
      destination: raw.destination && raw.destination.trim() !== '' ? raw.destination.trim().toUpperCase() : undefined,
      eta: raw.eta || undefined,
      status: raw.status || 'in_transit',
      last_updated_at: raw.timestamp || nowIso,
      properties: {
        providerSource: this.provider?.name || 'AIS',
      },
    };

    // 2. Upsert into moving_entities table
    try {
      const stmt = db.prepare(`
        INSERT INTO moving_entities (
          id, type, mmsi, imo, name, vessel_type, latitude, longitude,
          speed, course, heading, destination, eta, status, last_updated_at, properties
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          speed = excluded.speed,
          course = excluded.course,
          heading = excluded.heading,
          destination = COALESCE(excluded.destination, moving_entities.destination),
          status = excluded.status,
          last_updated_at = excluded.last_updated_at
      `);

      stmt.run(
        normalized.id,
        normalized.type,
        normalized.mmsi || null,
        normalized.imo || null,
        normalized.name,
        normalized.vessel_type || null,
        normalized.latitude,
        normalized.longitude,
        normalized.speed ?? null,
        normalized.course ?? null,
        normalized.heading ?? null,
        normalized.destination || null,
        normalized.eta || null,
        normalized.status || 'in_transit',
        normalized.last_updated_at,
        JSON.stringify(normalized.properties || {})
      );

      // 3. Append to historical entity_positions table (throttled to 5 seconds per entity)
      const lastFix = this.lastVesselFixTime.get(entityId) || 0;
      if (epochSec - lastFix >= 4) {
        this.lastVesselFixTime.set(entityId, epochSec);

        const posStmt = db.prepare(`
          INSERT INTO entity_positions (id, entity_id, latitude, longitude, speed, course, timestamp, epoch_sec)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        posStmt.run(
          uuidv4(),
          entityId,
          normalized.latitude,
          normalized.longitude,
          normalized.speed ?? null,
          normalized.course ?? null,
          normalized.last_updated_at,
          epochSec
        );
      }

      // 4. Broadcast to Real-Time SSE Channel
      this.broadcastPositionUpdate(normalized);

      return normalized;
    } catch (err: any) {
      console.error(`[Maritime] Error ingesting vessel update ${entityId}:`, err.message);
      return null;
    }
  }

  /**
   * Pre-seeds synthetic historical trail points for active vessels if table has few records
   */
  private static seedInitialHistoricalTrailsIfEmpty() {
    try {
      const count = (db.prepare('SELECT count(*) as c FROM entity_positions').get() as any)?.c || 0;
      if (count > 50) return;

      const vessels = db.prepare('SELECT * FROM moving_entities').all() as any[];
      const insertPos = db.prepare(`
        INSERT INTO entity_positions (id, entity_id, latitude, longitude, speed, course, timestamp, epoch_sec)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      for (const v of vessels) {
        const headingRad = ((v.course || 0) * Math.PI) / 180;
        const speed = v.speed || 12;

        // Generate 12 historical trailing positions behind the vessel along its course
        for (let step = 12; step >= 1; step--) {
          const deltaSec = step * 120; // 2 minutes per fix
          const deltaHours = deltaSec / 3600;
          const distNm = speed * deltaHours;

          // Backtrack opposite to heading
          const backLat = v.latitude - (distNm / 60) * Math.cos(headingRad);
          const backLon = v.longitude - (distNm / (60 * Math.cos((v.latitude * Math.PI) / 180))) * Math.sin(headingRad);
          const timeIso = new Date(now - deltaSec * 1000).toISOString();
          const epoch = Math.floor((now - deltaSec * 1000) / 1000);

          insertPos.run(
            uuidv4(),
            v.id,
            Number(backLat.toFixed(5)),
            Number(backLon.toFixed(5)),
            v.speed,
            v.course,
            timeIso,
            epoch
          );
        }
      }
      console.log(`✔ [Maritime] Pre-seeded historical position trails for ${vessels.length} vessels.`);
    } catch (err: any) {
      console.error('[Maritime] Seed trails error:', err.message);
    }
  }

  /**
   * Registers a client for Server-Sent Events (SSE) real-time position updates
   */
  static addSseClient(res: Response): void {
    this.sseClients.add(res);

    // Initial greeting
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

    // Remove client on connection close
    res.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  /**
   * Broadcasts a normalized position update to all active SSE subscribers
   */
  private static broadcastPositionUpdate(vessel: MovingEntity): void {
    if (this.sseClients.size === 0) return;

    const payload = JSON.stringify({
      event: 'entity_position_update',
      entity_id: vessel.id,
      mmsi: vessel.mmsi,
      name: vessel.name,
      vessel_type: vessel.vessel_type,
      latitude: vessel.latitude,
      longitude: vessel.longitude,
      speed: vessel.speed,
      course: vessel.course,
      heading: vessel.heading,
      destination: vessel.destination,
      status: vessel.status,
      timestamp: vessel.last_updated_at,
    });

    const msg = `event: entity_position_update\ndata: ${payload}\n\n`;

    for (const client of this.sseClients) {
      try {
        client.write(msg);
      } catch (_) {
        this.sseClients.delete(client);
      }
    }
  }

  /**
   * Retrieves all current moving vessels (with optional limit)
   */
  static getAllVessels(limit: number = 300): MovingEntity[] {
    const rows = db.prepare(`
      SELECT * FROM moving_entities
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
   * Retrieves single vessel details
   */
  static getVesselById(id: string): MovingEntity | null {
    const r = db.prepare('SELECT * FROM moving_entities WHERE id = ?').get(id) as any;
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
   * Retrieves historical position trail for a vessel
   */
  static getVesselTrack(id: string, limit: number = 64): EntityPosition[] {
    const rows = db.prepare(`
      SELECT * FROM entity_positions
      WHERE entity_id = ?
      ORDER BY epoch_sec ASC
      LIMIT ?
    `).all(id, limit) as any[];

    return rows.map((p) => ({
      id: p.id,
      entity_id: p.entity_id,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed,
      course: p.course,
      timestamp: p.timestamp,
      epoch_sec: p.epoch_sec,
    }));
  }

  /**
   * Returns current AIS Provider status
   */
  static getProviderStatus(): AisProviderStatus {
    if (!this.provider) {
      return {
        connected: false,
        source: 'None',
        mode: 'REPLAY_FEED',
        messageCount: 0,
        error: 'Provider not initialized',
      };
    }
    return this.provider.getStatus();
  }
}
