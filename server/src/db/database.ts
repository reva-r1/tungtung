import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { ROAD_CORRIDOR_NH48, AIRPORT_KEMPEGOWDA_BLR, CATCHMENT_CAUVERY_SOUTH } from '../services/world_model/reference.js';

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const isTestRun = process.env.NODE_ENV === 'test' || Boolean(process.argv[1] && (process.argv[1].includes('.test.') || process.argv[1].includes('verify_')));

export const DB_PATH = isTestRun
  ? (process.env.TEST_DATABASE_FILE || (process.argv[1]?.includes('generalization') ? path.join(DATA_DIR, 'aegis_intel.db') : path.join(DATA_DIR, 'test_aegis_intel.db')))
  : (process.env.DATABASE_FILE || path.join(DATA_DIR, 'aegis_intel.db'));

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode for high concurrency and pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT,
      category TEXT,
      risk_level TEXT DEFAULT 'LOW',
      risk_score INTEGER DEFAULT 0,
      summary TEXT,
      properties TEXT, -- JSON
      tags TEXT, -- JSON Array
      aliases TEXT, -- JSON Array
      dataset_id TEXT,
      source_dataset_id TEXT,
      source_record_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_risk ON entities(risk_score);

    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT,
      confidence REAL DEFAULT 1.0,
      properties TEXT, -- JSON
      risk_level TEXT DEFAULT 'LOW',
      dataset_id TEXT,
      source_dataset_id TEXT,
      source_record_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_id);
    CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_id);
    CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(type);

    CREATE TABLE IF NOT EXISTS raw_records (
      id TEXT PRIMARY KEY,
      dataset_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      raw_data TEXT NOT NULL, -- JSON
      created_at TEXT NOT NULL,
      FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_raw_dataset ON raw_records(dataset_id);

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT DEFAULT 'India',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      type TEXT NOT NULL,
      properties TEXT -- JSON
    );

    CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      entity_ids TEXT NOT NULL, -- JSON Array
      location_id TEXT,
      latitude REAL,
      longitude REAL,
      severity TEXT DEFAULT 'LOW',
      evidence TEXT, -- JSON Array
      properties TEXT -- JSON
    );

    CREATE INDEX IF NOT EXISTS idx_events_time ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

    CREATE TABLE IF NOT EXISTS anomalies (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT DEFAULT 'OPEN',
      entity_id TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      description TEXT,
      evidence TEXT, -- JSON Array
      detected_at TEXT NOT NULL,
      confidence REAL DEFAULT 0.9
    );

    CREATE INDEX IF NOT EXISTS idx_anomalies_entity ON anomalies(entity_id);
    CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);

    CREATE TABLE IF NOT EXISTS merge_candidates (
      id TEXT PRIMARY KEY,
      source_entity_id TEXT NOT NULL,
      target_entity_id TEXT NOT NULL,
      source_name TEXT NOT NULL,
      target_name TEXT NOT NULL,
      type TEXT NOT NULL,
      confidence REAL NOT NULL,
      match_reasons TEXT, -- JSON Array
      status TEXT DEFAULT 'PENDING',
      source_props TEXT, -- JSON
      target_props TEXT, -- JSON
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investigations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      lead_analyst TEXT DEFAULT 'Senior Analyst',
      status TEXT DEFAULT 'ACTIVE',
      priority TEXT DEFAULT 'MEDIUM',
      entity_ids TEXT, -- JSON Array
      notes TEXT, -- JSON Array
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS datasets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      format TEXT NOT NULL,
      record_count INTEGER DEFAULT 0,
      entity_count INTEGER DEFAULT 0,
      relationship_count INTEGER DEFAULT 0,
      uploaded_at TEXT NOT NULL,
      status TEXT DEFAULT 'LOADED',
      detected_schema TEXT -- JSON
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      db_type TEXT NOT NULL DEFAULT 'sqlite',
      db_path TEXT NOT NULL,
      status TEXT DEFAULT 'DISCONNECTED',
      last_sync TEXT,
      table_count INTEGER DEFAULT 0,
      record_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_records (
      id TEXT PRIMARY KEY,
      source_db_id TEXT NOT NULL,
      source_table TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      raw_data TEXT NOT NULL, -- JSON
      extracted_at TEXT NOT NULL,
      FOREIGN KEY (source_db_id) REFERENCES data_sources(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_source_rec_db ON source_records(source_db_id);
    CREATE INDEX IF NOT EXISTS idx_source_rec_tbl ON source_records(source_table);

    CREATE TABLE IF NOT EXISTS entity_source_links (
      entity_id TEXT NOT NULL,
      source_record_id TEXT NOT NULL,
      source_db_id TEXT NOT NULL,
      source_table TEXT NOT NULL,
      extracted_field TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (entity_id, source_record_id),
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (source_record_id) REFERENCES source_records(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_esl_entity ON entity_source_links(entity_id);
    CREATE INDEX IF NOT EXISTS idx_esl_source_rec ON entity_source_links(source_record_id);
    CREATE INDEX IF NOT EXISTS idx_esl_source_db ON entity_source_links(source_db_id);

    -- =========================================================================
    -- REVANA MARITIME TRACKING & MOVING ENTITY LAYER
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS moving_entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'ship',
      mmsi TEXT,
      imo TEXT,
      name TEXT NOT NULL,
      vessel_type TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL,
      course REAL,
      heading REAL,
      destination TEXT,
      eta TEXT,
      status TEXT DEFAULT 'in_transit',
      last_updated_at TEXT NOT NULL,
      properties TEXT -- JSON
    );

    CREATE INDEX IF NOT EXISTS idx_moving_type ON moving_entities(type);
    CREATE INDEX IF NOT EXISTS idx_moving_mmsi ON moving_entities(mmsi);
    CREATE INDEX IF NOT EXISTS idx_moving_updated ON moving_entities(last_updated_at);

    CREATE TABLE IF NOT EXISTS entity_positions (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL,
      course REAL,
      timestamp TEXT NOT NULL,
      epoch_sec INTEGER NOT NULL,
      FOREIGN KEY (entity_id) REFERENCES moving_entities(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pos_entity_time ON entity_positions(entity_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_pos_entity_epoch ON entity_positions(entity_id, epoch_sec);

    CREATE TABLE IF NOT EXISTS maritime_patterns (
      pattern_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      region TEXT NOT NULL,
      time_window TEXT NOT NULL,
      entities_observed INTEGER NOT NULL,
      baseline INTEGER NOT NULL,
      deviation_percent REAL NOT NULL,
      observation TEXT NOT NULL,
      hypotheses TEXT NOT NULL, -- JSON Array of MaritimePatternHypothesis
      status TEXT NOT NULL DEFAULT 'detected',
      detected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      ai_reasoning TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_maritime_pat_status ON maritime_patterns(status);
    CREATE INDEX IF NOT EXISTS idx_maritime_pat_region ON maritime_patterns(region);

    -- =========================================================================
    -- WORLD MODEL & DATA CONNECTOR LAYER
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS raw_observations (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL, -- JSON
      received_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_raw_obs_provider ON raw_observations(provider);
    CREATE INDEX IF NOT EXISTS idx_raw_obs_time ON raw_observations(received_at);

    CREATE TABLE IF NOT EXISTS world_observations (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      data_type TEXT NOT NULL,
      value TEXT NOT NULL, -- JSON
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      district TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      timestamp TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      source TEXT NOT NULL,
      provider TEXT NOT NULL,
      confidence REAL,
      quality TEXT,
      ttl INTEGER,
      raw_payload_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wobs_entity ON world_observations(entity_id);
    CREATE INDEX IF NOT EXISTS idx_wobs_type ON world_observations(data_type);
    CREATE INDEX IF NOT EXISTS idx_wobs_time ON world_observations(observed_at);
    CREATE INDEX IF NOT EXISTS idx_wobs_coords ON world_observations(latitude, longitude);

    CREATE TABLE IF NOT EXISTS world_entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      current_state TEXT NOT NULL, -- JSON
      status TEXT DEFAULT 'ACTIVE',
      confidence REAL DEFAULT 1.0,
      last_observed_at TEXT NOT NULL,
      last_updated_at TEXT,
      source_providers TEXT,
      last_provider TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wents_type ON world_entities(type);
    CREATE INDEX IF NOT EXISTS idx_wents_category ON world_entities(category);
    CREATE INDEX IF NOT EXISTS idx_wents_coords ON world_entities(latitude, longitude);

    CREATE TABLE IF NOT EXISTS world_relationships (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      source TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence TEXT NOT NULL, -- JSON Array
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wrel_src ON world_relationships(source_id);
    CREATE INDEX IF NOT EXISTS idx_wrel_tgt ON world_relationships(target_id);
    CREATE INDEX IF NOT EXISTS idx_wrel_type ON world_relationships(relationship_type);

    CREATE TABLE IF NOT EXISTS inferred_relationships (
      id TEXT PRIMARY KEY,
      source_entity_id TEXT NOT NULL,
      target_entity_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      provenance_type TEXT NOT NULL DEFAULT 'INFERRED_RELATIONSHIP',
      confidence REAL NOT NULL,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      evidence TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inf_rel_src ON inferred_relationships(source_entity_id);
    CREATE INDEX IF NOT EXISTS idx_inf_rel_tgt ON inferred_relationships(target_entity_id);
    CREATE INDEX IF NOT EXISTS idx_inf_rel_type ON inferred_relationships(relationship_type);

    CREATE TABLE IF NOT EXISTS temporal_state_history (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      previous_state TEXT, -- JSON
      new_state TEXT NOT NULL, -- JSON
      delta_summary TEXT NOT NULL, -- JSON
      source TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tsh_entity ON temporal_state_history(entity_id);
    CREATE INDEX IF NOT EXISTS idx_tsh_time ON temporal_state_history(timestamp);

    CREATE TABLE IF NOT EXISTS world_events (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      previous_state TEXT, -- JSON
      current_state TEXT NOT NULL, -- JSON
      detected_at TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL,
      severity TEXT DEFAULT 'MEDIUM',
      evidence TEXT -- JSON
    );

    CREATE INDEX IF NOT EXISTS idx_wevt_time ON world_events(detected_at);
    CREATE INDEX IF NOT EXISTS idx_wevt_type ON world_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_wevt_entity ON world_events(entity_id);

    CREATE TABLE IF NOT EXISTS simulations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      base_timestamp TEXT,
      base_snapshot_time TEXT,
      status TEXT DEFAULT 'ACTIVE',
      parameters TEXT, -- JSON
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS simulation_entity_overrides (
      simulation_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      properties TEXT NOT NULL, -- JSON
      is_modified INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (simulation_id, entity_id),
      FOREIGN KEY (simulation_id) REFERENCES simulations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sim_overrides ON simulation_entity_overrides(simulation_id);
  `);

  // Safe schema migrations for existing tables
  try { db.exec("ALTER TABLE entities ADD COLUMN source_dataset_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE entities ADD COLUMN source_record_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE entities ADD COLUMN source_db_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE entities ADD COLUMN source_table TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE relationships ADD COLUMN source_dataset_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE relationships ADD COLUMN source_record_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE relationships ADD COLUMN source_db_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE relationships ADD COLUMN source_table TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE datasets ADD COLUMN is_active INTEGER DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN status TEXT DEFAULT 'ACTIVE';"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN confidence REAL DEFAULT 1.0;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN last_observed_at TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN last_updated_at TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN source_providers TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN last_provider TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN created_at TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_entities ADD COLUMN updated_at TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE world_events ADD COLUMN event_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE simulations ADD COLUMN base_snapshot_time TEXT;"); } catch (_) {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources TEXT,
      reasoning TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_session ON ai_chat_messages(session_id);

    -- =========================================================================
    -- KNOWLEDGE GRAPH & MULTI-MODAL PIPELINE TABLES
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS extracted_triples (
      id TEXT PRIMARY KEY,
      subject_entity_id TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      subject_type TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object_entity_id TEXT NOT NULL,
      object_name TEXT NOT NULL,
      object_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_row INTEGER,
      source_span TEXT,
      extractor_model TEXT NOT NULL,
      extractor_version TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      status TEXT DEFAULT 'unreviewed',
      observed_at TEXT,
      properties TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_triples_sub ON extracted_triples(subject_entity_id);
    CREATE INDEX IF NOT EXISTS idx_triples_obj ON extracted_triples(object_entity_id);
    CREATE INDEX IF NOT EXISTS idx_triples_pred ON extracted_triples(predicate);
    CREATE INDEX IF NOT EXISTS idx_triples_source ON extracted_triples(source_file);
    CREATE INDEX IF NOT EXISTS idx_triples_status ON extracted_triples(status);
    CREATE INDEX IF NOT EXISTS idx_triples_observed ON extracted_triples(observed_at);

    CREATE TABLE IF NOT EXISTS pipeline_jobs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_path TEXT,
      file_type TEXT NOT NULL,
      status TEXT DEFAULT 'queued',
      progress INTEGER DEFAULT 0,
      triples_extracted INTEGER DEFAULT 0,
      entities_resolved INTEGER DEFAULT 0,
      error TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON pipeline_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created ON pipeline_jobs(created_at);
  `);

  try { db.exec("ALTER TABLE ai_chat_messages ADD COLUMN reasoning TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE extracted_triples ADD COLUMN observed_at TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE extracted_triples ADD COLUMN properties TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE pipeline_jobs ADD COLUMN metadata TEXT;"); } catch (_) {}

  // Ensure Canonical Reference Anchor Entities exist in world_entities
  try {
    const existingAnchors = db.prepare("SELECT count(*) as c FROM world_entities WHERE id IN ('ROAD_CORRIDOR_NH48', 'AIRPORT_KEMPEGOWDA_BLR', 'CATCHMENT_CAUVERY_SOUTH')").get() as any;
    if (!existingAnchors || existingAnchors.c < 3) {
      const now = new Date().toISOString();
      const insertAnchor = db.prepare(`
        INSERT INTO world_entities 
        (id, type, name, category, latitude, longitude, current_state, status, confidence, last_observed_at, last_updated_at, source_providers, last_provider, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          current_state = excluded.current_state,
          last_updated_at = excluded.last_updated_at,
          updated_at = excluded.updated_at
      `);
      insertAnchor.run(
        ROAD_CORRIDOR_NH48.id,
        'INFRASTRUCTURE_CORRIDOR',
        ROAD_CORRIDOR_NH48.name,
        'REFERENCE_GEOMETRY',
        ROAD_CORRIDOR_NH48.polyline[0][0],
        ROAD_CORRIDOR_NH48.polyline[0][1],
        JSON.stringify({
          description: ROAD_CORRIDOR_NH48.description,
          maxProximityThresholdKm: ROAD_CORRIDOR_NH48.maxProximityThresholdKm,
          waypoint_count: ROAD_CORRIDOR_NH48.polyline.length,
          source: 'OpenStreetMap Digitized Centerlines / Survey of India NH Alignment',
          is_reference_anchor: true,
        }),
        'ACTIVE',
        1.0,
        '2026-10-16T00:00:00.000Z',
        now,
        JSON.stringify(['reference_geometry']),
        'reference_geometry',
        now,
        now
      );
      insertAnchor.run(
        AIRPORT_KEMPEGOWDA_BLR.id,
        'AIRPORT',
        AIRPORT_KEMPEGOWDA_BLR.name,
        'REFERENCE_GEOMETRY',
        AIRPORT_KEMPEGOWDA_BLR.lat,
        AIRPORT_KEMPEGOWDA_BLR.lon,
        JSON.stringify({
          icao: AIRPORT_KEMPEGOWDA_BLR.icao,
          iata: AIRPORT_KEMPEGOWDA_BLR.iata,
          elevationMeters: AIRPORT_KEMPEGOWDA_BLR.elevationMeters,
          terminalControlAreaRadiusKm: AIRPORT_KEMPEGOWDA_BLR.terminalControlAreaRadiusKm,
          finalApproachRadiusKm: AIRPORT_KEMPEGOWDA_BLR.finalApproachRadiusKm,
          runwayHeading: AIRPORT_KEMPEGOWDA_BLR.runwayHeading,
          source: 'AAI / DGCA Aeronautical Information Publication (AIP)',
          is_reference_anchor: true,
        }),
        'ACTIVE',
        1.0,
        '2026-10-16T00:00:00.000Z',
        now,
        JSON.stringify(['reference_geometry']),
        'reference_geometry',
        now,
        now
      );
      insertAnchor.run(
        CATCHMENT_CAUVERY_SOUTH.id,
        'HYDROLOGICAL_CATCHMENT',
        CATCHMENT_CAUVERY_SOUTH.name,
        'REFERENCE_GEOMETRY',
        CATCHMENT_CAUVERY_SOUTH.center.lat,
        CATCHMENT_CAUVERY_SOUTH.center.lon,
        JSON.stringify({
          description: CATCHMENT_CAUVERY_SOUTH.description,
          radiusKm: CATCHMENT_CAUVERY_SOUTH.radiusKm,
          center: CATCHMENT_CAUVERY_SOUTH.center,
          boundingBox: CATCHMENT_CAUVERY_SOUTH.boundingBox,
          source: 'Central Water Commission / National Water Informatics Centre Basin Atlas',
          is_reference_anchor: true,
        }),
        'ACTIVE',
        1.0,
        '2026-10-16T00:00:00.000Z',
        now,
        JSON.stringify(['reference_geometry']),
        'reference_geometry',
        now,
        now
      );
    }
  } catch (_) {}

  console.log('✔ Revana Database schema initialized.');
}

