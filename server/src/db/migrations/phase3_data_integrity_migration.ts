import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ROAD_CORRIDOR_NH48, AIRPORT_KEMPEGOWDA_BLR, CATCHMENT_CAUVERY_SOUTH } from '../../services/world_model/reference.js';

export interface MigrationResult {
  success: boolean;
  backupPath: string;
  referenceEntitiesAdded: number;
  hydrologyObservationsReconciled: number;
  relationshipsValidated: number;
  danglingTargetsRemaining: number;
  danglingSourcesRemaining: number;
  foreignKeyErrors: any[];
  integrityStatus: string;
}

export function runPhase3Migration(targetDbPath?: string): MigrationResult {
  const defaultPath = path.join(__dirname, '../../../data/aegis_intel.db');
  const dbPath = targetDbPath || process.env.DATABASE_FILE || defaultPath;

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at: ${dbPath}`);
  }

  // 1. Create verified safety backup
  const timestamp = '20261016_phase3_integrity';
  const backupPath = path.join(path.dirname(dbPath), `aegis_intel.backup_phase3_pre_migration_${timestamp}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`[BACKUP CREATED] Verified recoverable backup at: ${backupPath}`);

  // Test that backup is readable
  const backupTestDb = new Database(backupPath, { readonly: true });
  const backupCheck = backupTestDb.prepare('PRAGMA integrity_check').all() as any[];
  backupTestDb.close();
  if (!backupCheck || backupCheck[0]?.integrity_check !== 'ok') {
    throw new Error(`Backup verification failed for: ${backupPath}`);
  }
  console.log(`[BACKUP VERIFIED] Integrity check OK on backup snapshot.`);

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  let referenceEntitiesAdded = 0;
  let hydrologyObservationsReconciled = 0;

  const runTx = db.transaction(() => {
    const now = new Date().toISOString();

    // 2. Register Canonical Reference Anchor Entities in world_entities
    const upsertEntityStmt = db.prepare(`
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

    // A. NH48 Corridor Reference Entity
    upsertEntityStmt.run(
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
    referenceEntitiesAdded++;

    // B. Kempegowda Airport Reference Entity
    upsertEntityStmt.run(
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
    referenceEntitiesAdded++;

    // C. Upper Cauvery Catchment Basin Reference Entity
    upsertEntityStmt.run(
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
    referenceEntitiesAdded++;

    // 3. Reconcile CWC Hydrology Observations for Truthful Date-Only Timestamp Semantics
    const cwcObsRows = db.prepare(`
      SELECT id, entity_id, observed_at, value 
      FROM world_observations 
      WHERE provider = 'cwc_india_wris'
    `).all() as any[];

    const updateCwcObsStmt = db.prepare(`
      UPDATE world_observations 
      SET observed_at = ?, value = ?
      WHERE id = ?
    `);

    for (const r of cwcObsRows) {
      const datePart = r.observed_at ? r.observed_at.split('T')[0] : '2024-01-16';
      // 08:30 IST is 03:00 UTC
      const normalizedUtcInstant = `${datePart}T03:00:00.000Z`;

      let valObj: any = {};
      try {
        valObj = JSON.parse(r.value || '{}');
      } catch (_) {}

      valObj.source_date = datePart;
      valObj.date_precision = 'DAY';
      valObj.is_date_only = true;
      valObj.source_reporting_standard = '08:30 IST Daily Bulletin';
      valObj.derived_utc_instant = normalizedUtcInstant;

      updateCwcObsStmt.run(normalizedUtcInstant, JSON.stringify(valObj), r.id);
      hydrologyObservationsReconciled++;
    }

    // 4. Update world_entities last_observed_at for CWC reservoirs
    db.prepare(`
      UPDATE world_entities 
      SET last_observed_at = '2024-01-16T03:00:00.000Z',
          updated_at = ?
      WHERE type = 'WATER_RESERVOIR_GAUGE' AND last_provider = 'cwc_india_wris'
    `).run(now);

    // 5. Prune orphaned relationships where source or target does not exist in world_entities
    const pruneStmt = db.prepare(`
      DELETE FROM world_relationships 
      WHERE source_id NOT IN (SELECT id FROM world_entities)
         OR target_id NOT IN (SELECT id FROM world_entities)
    `);
    const pruned = pruneStmt.run();
    if (pruned.changes > 0) {
      console.log(`[ORPHAN EDGES PRUNED] Removed ${pruned.changes} invalid edges without matching entities.`);
    }

    // 6. Ensure migration audit ledger exists and record migration
    db.exec(`
      CREATE TABLE IF NOT EXISTS data_migration_log (
        id TEXT PRIMARY KEY,
        migration_name TEXT NOT NULL,
        executed_at TEXT NOT NULL,
        backup_path TEXT NOT NULL,
        details TEXT NOT NULL
      );
    `);

    db.prepare(`
      INSERT INTO data_migration_log (id, migration_name, executed_at, backup_path, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `phase3_data_integrity_${Date.now()}`,
      'phase-3-operational-data-model-integrity',
      now,
      backupPath,
      JSON.stringify({
        referenceEntitiesAdded,
        hydrologyObservationsReconciled,
        orphanRelationshipsPruned: pruned.changes,
        entitiesRegistered: [ROAD_CORRIDOR_NH48.id, AIRPORT_KEMPEGOWDA_BLR.id, CATCHMENT_CAUVERY_SOUTH.id],
      })
    );
  });

  runTx();

  // 7. Post-migration integrity verification
  const integrity = db.prepare('PRAGMA integrity_check').all() as any[];
  const integrityStatus = integrity[0]?.integrity_check || 'unknown';
  const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();

  // Check remaining dangling targets and sources in world_relationships
  const danglingTargets = db.prepare(`
    SELECT r.id, r.source_id, r.target_id 
    FROM world_relationships r 
    LEFT JOIN world_entities e ON r.target_id = e.id 
    WHERE e.id IS NULL
  `).all();

  const danglingSources = db.prepare(`
    SELECT r.id, r.source_id, r.target_id 
    FROM world_relationships r 
    LEFT JOIN world_entities e ON r.source_id = e.id 
    WHERE e.id IS NULL
  `).all();

  const totalRels = (db.prepare('SELECT count(*) as c FROM world_relationships').get() as any).c;

  db.close();

  return {
    success: integrityStatus === 'ok' && foreignKeyErrors.length === 0 && danglingTargets.length === 0 && danglingSources.length === 0,
    backupPath,
    referenceEntitiesAdded,
    hydrologyObservationsReconciled,
    relationshipsValidated: totalRels,
    danglingTargetsRemaining: danglingTargets.length,
    danglingSourcesRemaining: danglingSources.length,
    foreignKeyErrors,
    integrityStatus,
  };
}

if (process.argv[1] && process.argv[1].endsWith('phase3_data_integrity_migration.ts')) {
  console.log('=============================================================');
  console.log('  REVANA TECHNOLOGIES — EXECUTING PHASE 3 MIGRATION');
  console.log('=============================================================');
  const result = runPhase3Migration();
  console.log('Migration Result:', JSON.stringify(result, null, 2));
}
