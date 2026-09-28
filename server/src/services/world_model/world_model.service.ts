import { db } from '../../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import {
  NormalizedObservation,
  InferredRelationship,
  WorldEvent,
  TemporalStateRecord,
  WorldEntityState,
} from '../../connectors/base/types.js';
import { haversineDistance, pointToPolylineDistance, isPointInRadius } from './geo.js';
import { ROAD_CORRIDOR_NH48, AIRPORT_KEMPEGOWDA_BLR, CATCHMENT_CAUVERY_SOUTH } from './reference.js';
import { computeConfidence, getProviderReliability } from './confidence.js';

export class WorldModelService {
  private static instance: WorldModelService;

  private constructor() {}

  public static getInstance(): WorldModelService {
    if (!WorldModelService.instance) {
      WorldModelService.instance = new WorldModelService();
    }
    return WorldModelService.instance;
  }

  /**
   * 1. Store Raw Observation payload separately (Provenance requirement)
   */
  public storeRawPayload(provider: string, endpoint: string, payload: any): string {
    const rawId = `raw_${provider}_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const receivedAt = new Date().toISOString();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const stmt = db.prepare(`
      INSERT INTO raw_observations (id, provider, endpoint, payload, received_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(rawId, provider, endpoint, payloadStr, receivedAt);
    return rawId;
  }

  /**
   * 2. Ingest Normalized Observation & trigger Entity Resolution, Temporal State & Event Detection
   */
  public ingestObservation(obs: NormalizedObservation, rawPayloadId?: string): {
    entity: WorldEntityState;
    temporalDelta: TemporalStateRecord | null;
    detectedEvents: WorldEvent[];
    inferredRelationships: InferredRelationship[];
  } {
    // Coordinate validation
    if (obs.location.latitude < -90 || obs.location.latitude > 90 ||
        obs.location.longitude < -180 || obs.location.longitude > 180) {
      throw new Error(`Invalid coordinate bounds: lat=${obs.location.latitude}, lon=${obs.location.longitude}`);
    }

    const obsId = obs.id || `obs_${uuidv4()}`;
    const valueJson = JSON.stringify(obs.value);

    // Save observation
    const insertObsStmt = db.prepare(`
      INSERT OR REPLACE INTO world_observations 
      (id, entity_id, entity_type, data_type, value, latitude, longitude, district, city, state, country, timestamp, observed_at, source, provider, confidence, quality, ttl, raw_payload_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertObsStmt.run(
      obsId,
      obs.entity_id,
      obs.entity_type,
      obs.data_type,
      valueJson,
      obs.location.latitude,
      obs.location.longitude,
      obs.location.district || null,
      obs.location.city || null,
      obs.location.state || null,
      obs.location.country || null,
      obs.timestamp,
      obs.observed_at,
      obs.source,
      obs.provider,
      obs.confidence ?? 1.0,
      obs.quality ?? 'VERIFIED',
      obs.ttl ?? 300,
      rawPayloadId || null,
      new Date().toISOString()
    );

    // Fetch existing entity state to compare
    const existingStmt = db.prepare(`SELECT * FROM world_entities WHERE id = ?`);
    const existing = existingStmt.get(obs.entity_id) as any;

    let previousState: Record<string, any> | null = null;
    let deltaSummary: Record<string, any> = {};

    if (existing) {
      try {
        previousState = JSON.parse(existing.current_state);
        // Compute delta
        for (const key of Object.keys(obs.value)) {
          if (previousState && previousState[key] !== obs.value[key]) {
            deltaSummary[key] = {
              from: previousState[key],
              to: obs.value[key],
            };
          }
        }
      } catch (_) {}
    } else {
      deltaSummary = { initial_state: obs.value };
    }

    // Upsert entity
    const now = new Date().toISOString();
    const entityName = obs.value.station_name || obs.value.title || obs.value.facility_name || obs.value.substation_name || obs.value.callsign || obs.entity_id;
    const upsertEntityStmt = db.prepare(`
      INSERT INTO world_entities 
      (id, type, name, category, latitude, longitude, current_state, status, confidence, last_observed_at, last_updated_at, source_providers, last_provider, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = excluded.name,
        category = excluded.category,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        current_state = excluded.current_state,
        status = excluded.status,
        confidence = excluded.confidence,
        last_observed_at = excluded.last_observed_at,
        last_updated_at = excluded.last_updated_at,
        source_providers = excluded.source_providers,
        last_provider = excluded.last_provider,
        updated_at = excluded.updated_at
    `);

    upsertEntityStmt.run(
      obs.entity_id,
      obs.entity_type,
      entityName,
      obs.data_type,
      obs.location.latitude,
      obs.location.longitude,
      valueJson,
      'ACTIVE',
      obs.confidence ?? 1.0,
      obs.observed_at,
      now,
      JSON.stringify([obs.provider]),
      obs.provider,
      existing ? (existing.created_at || now) : now,
      now
    );

    const updatedEntity: WorldEntityState = {
      id: obs.entity_id,
      type: obs.entity_type,
      name: entityName,
      category: obs.data_type,
      latitude: obs.location.latitude,
      longitude: obs.location.longitude,
      current_state: obs.value,
      status: 'ACTIVE',
      confidence: obs.confidence ?? 1.0,
      last_observed_at: obs.observed_at,
      last_provider: obs.provider,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };

    // Record Temporal History
    let temporalRecord: TemporalStateRecord | null = null;
    if (Object.keys(deltaSummary).length > 0) {
      const historyId = `hist_${uuidv4()}`;
      const insertHistStmt = db.prepare(`
        INSERT INTO temporal_state_history 
        (id, entity_id, timestamp, previous_state, new_state, delta_summary, source, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertHistStmt.run(
        historyId,
        obs.entity_id,
        obs.observed_at,
        previousState ? JSON.stringify(previousState) : null,
        valueJson,
        JSON.stringify(deltaSummary),
        obs.source,
        now
      );

      temporalRecord = {
        id: historyId,
        entity_id: obs.entity_id,
        timestamp: obs.observed_at,
        previous_state: previousState,
        new_state: obs.value,
        delta_summary: deltaSummary,
        source: obs.source,
        recorded_at: now,
      };
    }

    // 3. Event Detection Engine
    const detectedEvents = this.detectEvents(obs, previousState);
    for (const evt of detectedEvents) {
      const insertEvtStmt = db.prepare(`
        INSERT OR REPLACE INTO world_events 
        (id, event_id, event_type, entity_id, previous_state, current_state, detected_at, source, confidence, severity, evidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertEvtStmt.run(
        evt.event_id,
        evt.event_id,
        evt.event_type,
        evt.entity_id,
        JSON.stringify(evt.previous_state),
        JSON.stringify(evt.current_state),
        evt.detected_at,
        evt.source,
        evt.confidence,
        evt.severity,
        JSON.stringify([`Triggered by ${evt.event_type} on ${evt.entity_id}`])
      );
    }

    // 4. Entity Resolution & Inferred Relationships
    const inferredRelationships = this.resolveEntityRelationships(obs);
    for (const rel of inferredRelationships) {
      const insertRelStmt = db.prepare(`
        INSERT OR REPLACE INTO world_relationships 
        (id, source_id, target_id, relationship_type, source, timestamp, confidence, evidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertRelStmt.run(
        rel.relationship_id,
        rel.source_entity_id,
        rel.target_entity_id,
        rel.relationship_type,
        rel.source,
        rel.timestamp,
        rel.confidence,
        JSON.stringify(rel.evidence),
        now
      );
    }

    return {
      entity: updatedEntity,
      temporalDelta: temporalRecord,
      detectedEvents,
      inferredRelationships,
    };
  }

  /**
   * Event Detection: Identifies meaningful state transitions and threshold crossings
   * Uses computeConfidence() with provider reliability and observation age instead of static literals.
   */
  private detectEvents(obs: NormalizedObservation, previousState: Record<string, any> | null): WorldEvent[] {
    const events: WorldEvent[] = [];
    const now = new Date().toISOString();
    const val = obs.value;

    const obsAgeSeconds = Math.max(0, (Date.now() - new Date(obs.observed_at).getTime()) / 1000);
    const providerRel = getProviderReliability(obs.provider);
    const eventConfidence = computeConfidence({
      sourceReliability: providerRel,
      dataAgeSeconds: obsAgeSeconds,
      corroboratingSources: 1,
    });

    // A. Weather / Rainfall threshold crossing
    if (val.precipitation_mm !== undefined) {
      const precip = Number(val.precipitation_mm);
      const prevPrecip = previousState?.precipitation_mm !== undefined ? Number(previousState.precipitation_mm) : 0;

      if (precip > 0 && prevPrecip === 0) {
        events.push({
          event_id: `evt_rain_started_${obs.entity_id}_${Date.now()}`,
          event_type: 'RAIN_STARTED',
          entity_id: obs.entity_id,
          previous_state: { precipitation_mm: 0 },
          current_state: { precipitation_mm: precip },
          detected_at: now,
          source: obs.provider,
          confidence: eventConfidence,
          severity: 'LOW',
        });
      }

      if (precip >= 15.0 && prevPrecip < 15.0) {
        events.push({
          event_id: `evt_rain_heavy_${obs.entity_id}_${Date.now()}`,
          event_type: 'RAINFALL_THRESHOLD_EXCEEDED',
          entity_id: obs.entity_id,
          previous_state: { precipitation_mm: prevPrecip },
          current_state: { precipitation_mm: precip },
          detected_at: now,
          source: obs.provider,
          confidence: eventConfidence,
          severity: precip > 50 ? 'CRITICAL' : 'HIGH',
        });
      }
    }

    // B. Temperature significant change (> 4 degrees C swing)
    if (val.temperature_c !== undefined && previousState?.temperature_c !== undefined) {
      const diff = Math.abs(val.temperature_c - previousState.temperature_c);
      if (diff >= 4.0) {
        events.push({
          event_id: `evt_temp_swing_${obs.entity_id}_${Date.now()}`,
          event_type: 'TEMPERATURE_CHANGED_SIGNIFICANTLY',
          entity_id: obs.entity_id,
          previous_state: { temperature_c: previousState.temperature_c },
          current_state: { temperature_c: val.temperature_c },
          detected_at: now,
          source: obs.provider,
          confidence: eventConfidence,
          severity: 'MEDIUM',
        });
      }
    }

    // C. Air Quality index threshold (> 150 Unhealthy, > 250 Severe)
    if (val.us_aqi !== undefined) {
      const aqi = Number(val.us_aqi);
      const prevAqi = previousState?.us_aqi !== undefined ? Number(previousState.us_aqi) : 0;
      if (aqi >= 150 && prevAqi < 150) {
        events.push({
          event_id: `evt_aqi_alert_${obs.entity_id}_${Date.now()}`,
          event_type: 'AQI_CROSSED_THRESHOLD',
          entity_id: obs.entity_id,
          previous_state: { us_aqi: prevAqi },
          current_state: { us_aqi: aqi },
          detected_at: now,
          source: obs.provider,
          confidence: eventConfidence,
          severity: aqi >= 250 ? 'CRITICAL' : 'HIGH',
        });
      }
    }

    // D. Earthquake Detected
    if (obs.entity_type === 'EARTHQUAKE_EPICENTER') {
      const mag = Number(val.magnitude);
      const quakeConfidence = computeConfidence({
        sourceReliability: obs.confidence ?? providerRel,
        dataAgeSeconds: obsAgeSeconds,
        corroboratingSources: 1,
      });
      events.push({
        event_id: `evt_earthquake_${obs.entity_id}_${Date.now()}`,
        event_type: 'EARTHQUAKE_DETECTED',
        entity_id: obs.entity_id,
        previous_state: {},
        current_state: { magnitude: mag, place: val.place, depth_km: val.depth_km },
        detected_at: now,
        source: obs.provider,
        confidence: quakeConfidence,
        severity: mag >= 6.0 ? 'CRITICAL' : mag >= 4.5 ? 'HIGH' : 'MEDIUM',
      });
    }

    // E. Water Level Warning / High stage
    if (val.water_level_m !== undefined && val.danger_level_m !== undefined) {
      if (Number(val.water_level_m) >= Number(val.danger_level_m)) {
        events.push({
          event_id: `evt_water_danger_${obs.entity_id}_${Date.now()}`,
          event_type: 'WATER_LEVEL_DANGER_THRESHOLD',
          entity_id: obs.entity_id,
          previous_state: previousState || {},
          current_state: { water_level_m: val.water_level_m, danger_level_m: val.danger_level_m },
          detected_at: now,
          source: obs.provider,
          confidence: eventConfidence,
          severity: 'HIGH',
        });
      }
    }

    // F. Transit vehicle severe congestion / stopped
    if (val.congestion_level === 'SEVERE_CONGESTION' && previousState?.congestion_level !== 'SEVERE_CONGESTION') {
      events.push({
        event_id: `evt_transit_congestion_${obs.entity_id}_${Date.now()}`,
        event_type: 'TRANSIT_VEHICLE_CHANGED_STATE',
        entity_id: obs.entity_id,
        previous_state: { congestion_level: previousState?.congestion_level || 'UNKNOWN' },
        current_state: { congestion_level: val.congestion_level, stop_id: val.stop_id },
        detected_at: now,
        source: obs.provider,
        confidence: eventConfidence,
        severity: 'MEDIUM',
      });
    }

    return events;
  }

  /**
   * Entity Resolution & Relationship Discovery
   * Determines relationships based on computed geometry and real spatial joins:
   * - Weather Station within threshold km of NH48 polyline -> ROAD_CORRIDOR_NH48
   * - Aircraft within terminal radar radius of Kempegowda -> AIRPORT_KEMPEGOWDA_BLR
   * - Water Gauge within catchment drainage radius -> CATCHMENT_CAUVERY_SOUTH
   */
  private resolveEntityRelationships(obs: NormalizedObservation): InferredRelationship[] {
    const relationships: InferredRelationship[] = [];
    const now = new Date().toISOString();
    const lat = obs.location.latitude;
    const lon = obs.location.longitude;
    const obsAgeSeconds = Math.max(0, (Date.now() - new Date(obs.observed_at).getTime()) / 1000);

    // 1. Weather Station to Transportation Corridors (NH48)
    if (obs.entity_type === 'WEATHER_STATION') {
      const precip = Number(obs.value.precipitation_mm || 0);
      const { distanceKm } = pointToPolylineDistance(lat, lon, ROAD_CORRIDOR_NH48.polyline);

      // Only establish relationship when station is within corridor proximity threshold
      if (distanceKm <= ROAD_CORRIDOR_NH48.maxProximityThresholdKm) {
        const confidence = computeConfidence({
          sourceReliability: getProviderReliability(obs.provider),
          dataAgeSeconds: obsAgeSeconds,
          distanceKm,
          maxDistanceKm: ROAD_CORRIDOR_NH48.maxProximityThresholdKm,
        });

        relationships.push({
          relationship_id: `rel_${obs.entity_id}_NH48_CORRIDOR`,
          relationship_type: precip > 10 ? 'IMPACTS_SURFACE_TRACTION' : 'MONITORS_ATMOSPHERE_AROUND',
          source_entity_id: obs.entity_id,
          target_entity_id: ROAD_CORRIDOR_NH48.id,
          source: 'spatial_corridor_matcher',
          timestamp: now,
          confidence,
          evidence: [
            `Station location (${lat.toFixed(4)}, ${lon.toFixed(4)}) is ${distanceKm.toFixed(2)} km from NH48 corridor polyline (threshold: ${ROAD_CORRIDOR_NH48.maxProximityThresholdKm} km)`,
            `Observed precipitation: ${precip} mm at ${obs.observed_at}`,
          ],
        });
      }
    }

    // 2. Aircraft to Airport
    if (obs.entity_type === 'AIRCRAFT') {
      const dBlr = haversineDistance(lat, lon, AIRPORT_KEMPEGOWDA_BLR.lat, AIRPORT_KEMPEGOWDA_BLR.lon);
      if (dBlr <= AIRPORT_KEMPEGOWDA_BLR.terminalControlAreaRadiusKm) {
        const confidence = computeConfidence({
          sourceReliability: getProviderReliability(obs.provider),
          dataAgeSeconds: obsAgeSeconds,
          distanceKm: dBlr,
          maxDistanceKm: AIRPORT_KEMPEGOWDA_BLR.terminalControlAreaRadiusKm,
        });

        const inFinalApproach = dBlr <= AIRPORT_KEMPEGOWDA_BLR.finalApproachRadiusKm;
        relationships.push({
          relationship_id: `rel_${obs.entity_id}_AIRPORT_VOBL`,
          relationship_type: inFinalApproach ? 'IN_FINAL_APPROACH' : 'EN_ROUTE_TERMINAL_CONTROL_AREA',
          source_entity_id: obs.entity_id,
          target_entity_id: AIRPORT_KEMPEGOWDA_BLR.id,
          source: 'terminal_radar_geofence',
          timestamp: now,
          confidence,
          evidence: [
            `Aircraft position (${lat.toFixed(4)}, ${lon.toFixed(4)}) is ${dBlr.toFixed(2)} km from ${AIRPORT_KEMPEGOWDA_BLR.name} ARP`,
            `Reported altitude: ${obs.value.altitude_m !== undefined ? obs.value.altitude_m + ' m' : 'Unreported'}, speed: ${obs.value.speed_kmh !== undefined ? obs.value.speed_kmh + ' km/h' : 'Unreported'} at ${obs.observed_at}`,
          ],
        });
      }
    }

    // 3. Water Gauge to Catchment Basin
    if (obs.entity_type === 'WATER_GAUGE') {
      const { inRange, distanceKm } = isPointInRadius(
        lat,
        lon,
        CATCHMENT_CAUVERY_SOUTH.center.lat,
        CATCHMENT_CAUVERY_SOUTH.center.lon,
        CATCHMENT_CAUVERY_SOUTH.radiusKm
      );

      // Only establish relationship when gauge is within the catchment radius
      if (inRange) {
        const confidence = computeConfidence({
          sourceReliability: getProviderReliability(obs.provider),
          dataAgeSeconds: obsAgeSeconds,
          distanceKm,
          maxDistanceKm: CATCHMENT_CAUVERY_SOUTH.radiusKm,
        });

        relationships.push({
          relationship_id: `rel_${obs.entity_id}_DRAINAGE_GRID`,
          relationship_type: 'FEEDS_WATERSHED_CATCHMENT',
          source_entity_id: obs.entity_id,
          target_entity_id: CATCHMENT_CAUVERY_SOUTH.id,
          source: 'hydrological_basin_registry',
          timestamp: now,
          confidence,
          evidence: [
            `Gauge location (${lat.toFixed(4)}, ${lon.toFixed(4)}) is ${distanceKm.toFixed(2)} km from ${CATCHMENT_CAUVERY_SOUTH.name} center (within ${CATCHMENT_CAUVERY_SOUTH.radiusKm} km radius)`,
            `Observed water stage: ${obs.value.water_level_m !== undefined ? obs.value.water_level_m + ' m' : 'Unreported'} at ${obs.observed_at}`,
          ],
        });
      }
    }

    return relationships;
  }

  /**
   * 5. GET /world/state
   */
  public getWorldState(): {
    timestamp: string;
    entity_count: number;
    entities: WorldEntityState[];
    active_events: WorldEvent[];
    relationships: InferredRelationship[];
    recent_changes_count: number;
  } {
    const entities = db.prepare(`SELECT * FROM world_entities ORDER BY updated_at DESC LIMIT 200`).all() as any[];
    const events = db.prepare(`SELECT * FROM world_events ORDER BY detected_at DESC LIMIT 50`).all() as any[];
    const relationships = db.prepare(`SELECT * FROM world_relationships ORDER BY created_at DESC LIMIT 100`).all() as any[];
    const changeCount = db.prepare(`SELECT COUNT(*) as cnt FROM temporal_state_history`).get() as any;

    return {
      timestamp: new Date().toISOString(),
      entity_count: entities.length,
      entities: entities.map(e => ({
        id: e.id,
        type: e.type,
        name: e.name,
        category: e.category,
        latitude: e.latitude,
        longitude: e.longitude,
        current_state: JSON.parse(e.current_state),
        status: e.status,
        confidence: e.confidence,
        last_observed_at: e.last_observed_at,
        last_provider: e.last_provider,
        created_at: e.created_at,
        updated_at: e.updated_at,
      })),
      active_events: events.map(ev => ({
        event_id: ev.event_id || ev.id,
        event_type: ev.event_type,
        entity_id: ev.entity_id,
        previous_state: JSON.parse(ev.previous_state || '{}'),
        current_state: JSON.parse(ev.current_state || '{}'),
        detected_at: ev.detected_at,
        source: ev.source,
        confidence: ev.confidence,
        severity: ev.severity,
      })),
      relationships: relationships.map(r => ({
        relationship_id: r.id,
        relationship_type: r.relationship_type,
        source_entity_id: r.source_id,
        target_entity_id: r.target_id,
        source: r.source,
        timestamp: r.timestamp,
        confidence: r.confidence,
        evidence: JSON.parse(r.evidence || '[]'),
      })),
      recent_changes_count: changeCount?.cnt || 0,
    };
  }

  /**
   * 6. GET /world/entities
   */
  public getEntities(type?: string, category?: string): WorldEntityState[] {
    let query = `SELECT * FROM world_entities WHERE 1=1`;
    const params: any[] = [];
    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }
    query += ` ORDER BY updated_at DESC LIMIT 200`;

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(e => ({
      id: e.id,
      type: e.type,
      name: e.name,
      category: e.category,
      latitude: e.latitude,
      longitude: e.longitude,
      current_state: JSON.parse(e.current_state),
      status: e.status,
      confidence: e.confidence,
      last_observed_at: e.last_observed_at,
      last_provider: e.last_provider,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }));
  }

  /**
   * 7. GET /world/entities/:id
   */
  public getEntityById(id: string): {
    entity: WorldEntityState | null;
    history: TemporalStateRecord[];
    relationships: InferredRelationship[];
    recentObservations: NormalizedObservation[];
  } {
    const row = db.prepare(`SELECT * FROM world_entities WHERE id = ?`).get(id) as any;
    if (!row) {
      return { entity: null, history: [], relationships: [], recentObservations: [] };
    }

    const historyRows = db.prepare(`
      SELECT * FROM temporal_state_history WHERE entity_id = ? ORDER BY timestamp DESC LIMIT 50
    `).all(id) as any[];

    const relRows = db.prepare(`
      SELECT * FROM world_relationships WHERE source_id = ? OR target_id = ? LIMIT 50
    `).all(id, id) as any[];

    const obsRows = db.prepare(`
      SELECT * FROM world_observations WHERE entity_id = ? ORDER BY observed_at DESC LIMIT 20
    `).all(id) as any[];

    return {
      entity: {
        id: row.id,
        type: row.type,
        name: row.name,
        category: row.category,
        latitude: row.latitude,
        longitude: row.longitude,
        current_state: JSON.parse(row.current_state),
        status: row.status,
        confidence: row.confidence,
        last_observed_at: row.last_observed_at,
        last_provider: row.last_provider,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      history: historyRows.map(h => ({
        id: h.id,
        entity_id: h.entity_id,
        timestamp: h.timestamp,
        previous_state: h.previous_state ? JSON.parse(h.previous_state) : null,
        new_state: JSON.parse(h.new_state),
        delta_summary: JSON.parse(h.delta_summary),
        source: h.source,
        recorded_at: h.recorded_at,
      })),
      relationships: relRows.map(r => ({
        relationship_id: r.id,
        relationship_type: r.relationship_type,
        source_entity_id: r.source_id,
        target_entity_id: r.target_id,
        source: r.source,
        timestamp: r.timestamp,
        confidence: r.confidence,
        evidence: JSON.parse(r.evidence || '[]'),
      })),
      recentObservations: obsRows.map(o => ({
        id: o.id,
        entity_id: o.entity_id,
        entity_type: o.entity_type,
        data_type: o.data_type,
        value: JSON.parse(o.value),
        location: {
          latitude: o.latitude,
          longitude: o.longitude,
          district: o.district,
          city: o.city,
          state: o.state,
          country: o.country,
        },
        timestamp: o.timestamp,
        observed_at: o.observed_at,
        source: o.source,
        provider: o.provider,
        confidence: o.confidence,
        quality: o.quality,
        ttl: o.ttl,
        provenance: {
          source: o.source,
          provider: o.provider,
          endpoint: o.source,
          retrievedAt: o.created_at,
          observedAt: o.observed_at,
          originalPayloadReference: o.raw_payload_id,
        },
      })),
    };
  }

  /**
   * 8. GET /world/changes
   * Temporal ledger answering "What changed during the last hour?" or since timestamp
   */
  public getTemporalChanges(minutes: number = 60, since?: string): TemporalStateRecord[] {
    let query: string;
    let params: any[] = [];

    if (since) {
      query = `SELECT * FROM temporal_state_history WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 200`;
      params = [since];
    } else {
      const cutoffTime = new Date(Date.now() - (minutes * 60 * 1000)).toISOString();
      query = `SELECT * FROM temporal_state_history WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 200`;
      params = [cutoffTime];
    }

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(h => ({
      id: h.id,
      entity_id: h.entity_id,
      timestamp: h.timestamp,
      previous_state: h.previous_state ? JSON.parse(h.previous_state) : null,
      new_state: JSON.parse(h.new_state),
      delta_summary: JSON.parse(h.delta_summary),
      source: h.source,
      recorded_at: h.recorded_at,
    }));
  }

  /**
   * 9. GET /world/events
   */
  public getEvents(severity?: string): WorldEvent[] {
    let query = `SELECT * FROM world_events WHERE 1=1`;
    const params: any[] = [];
    if (severity) {
      query += ` AND severity = ?`;
      params.push(severity);
    }
    query += ` ORDER BY detected_at DESC LIMIT 100`;

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(ev => ({
      event_id: ev.event_id || ev.id,
      event_type: ev.event_type,
      entity_id: ev.entity_id,
      previous_state: JSON.parse(ev.previous_state || '{}'),
      current_state: JSON.parse(ev.current_state || '{}'),
      detected_at: ev.detected_at,
      source: ev.source,
      confidence: ev.confidence,
      severity: ev.severity,
    }));
  }

  /**
   * 10. GET /world/relationships
   */
  public getRelationships(): InferredRelationship[] {
    const rows = db.prepare(`SELECT * FROM world_relationships ORDER BY created_at DESC LIMIT 100`).all() as any[];
    return rows.map(r => ({
      relationship_id: r.id,
      relationship_type: r.relationship_type,
      source_entity_id: r.source_id,
      target_entity_id: r.target_id,
      source: r.source,
      timestamp: r.timestamp,
      confidence: r.confidence,
      evidence: JSON.parse(r.evidence || '[]'),
    }));
  }
}

export const worldModelService = WorldModelService.getInstance();
