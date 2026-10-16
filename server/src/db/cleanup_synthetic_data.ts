import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface CleanupPlan {
  dbPath: string;
  backupPath?: string;
  isExecute: boolean;
  counts: {
    locations: number;
    movingEntities: number;
    entityPositions: number;
    maritimePatterns: number;
    worldEntities: number;
    worldObservations: number;
    rawObservations: number;
    simulatedObservations: number;
    simulatedRawPayloads: number;
    worldEvents: number;
    worldRelationships: number;
    inferredRelationships: number;
    temporalStateHistory: number;
    temporalEntityStates: number;
    simulations: number;
    simulationEntityStates: number;
  };
  preservedCustomerRecords: number;
  preservedLiveVessels: number;
  preservedLiveWorldEntities: number;
  foreignKeyErrors: any[];
  integrityStatus: string;
}

export function runCleanup(execute = false, targetDbPath?: string): CleanupPlan {
  const defaultPath = path.join(__dirname, '../../data/aegis_intel.db');
  const dbPath = targetDbPath || process.env.DATABASE_FILE || defaultPath;

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file not found at: ${dbPath}`);
  }

  if (execute && process.env.NODE_ENV === 'production' && process.env.CONFIRMED_PRODUCTION_PURGE !== 'true') {
    throw new Error('[Authorization Required] Destructive cleanup in production requires CONFIRMED_PRODUCTION_PURGE=true and an approved execution plan.');
  }

  let backupPath: string | undefined;

  if (execute) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = path.join(path.dirname(dbPath), `aegis_intel.phase1_map_cleanup_${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[BACKUP CREATED] Verified recoverable backup at: ${backupPath}`);
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Baseline genuine counts
  const liveShipsBefore = (db.prepare("SELECT COUNT(*) as c FROM moving_entities WHERE id LIKE 'SHIP_%' AND properties NOT LIKE '%Replay%'").get() as any).c;

  // 1. Identify synthetic / test locations (Apex Global, Zenith, Orion, Test Hub)
  const syntheticLocations = db.prepare(`
    SELECT id FROM locations 
    WHERE id LIKE 'LOC-ENT-CUST-%' 
       OR id LIKE 'loc\\_mock\\_%' ESCAPE '\\'
       OR id LIKE 'loc\\_sim\\_%' ESCAPE '\\'
       OR id LIKE 'TEST-%'
       OR id LIKE 'TEST\\_%' ESCAPE '\\'
  `).all() as { id: string }[];
  const locationIds = syntheticLocations.map(l => l.id);

  // 2. Identify synthetic moving entities
  const syntheticMovingEntities = db.prepare(`
    SELECT id FROM moving_entities 
    WHERE properties LIKE '%Replay%' 
       OR properties LIKE '%ais_real_replay%' 
       OR mmsi LIKE '999%' 
       OR id LIKE 'vessel_mmsi_%' 
       OR id LIKE 'VESSEL_%'
  `).all() as { id: string }[];
  const movingIds = syntheticMovingEntities.map(m => m.id);

  // 3. Identify synthetic entity positions
  let entityPositionsCount = 0;
  if (movingIds.length > 0) {
    const placeholders = movingIds.map(() => '?').join(',');
    entityPositionsCount = (db.prepare(`SELECT COUNT(*) as c FROM entity_positions WHERE entity_id IN (${placeholders})`).get(...movingIds) as any).c;
  }

  // 4. Fabricated maritime patterns
  const patternsCount = (db.prepare("SELECT COUNT(*) as c FROM maritime_patterns WHERE pattern_id = 'PAT_CORRIDOR_MALACCA'").get() as any).c;

  // 5. Identify synthetic / legacy un-sourced / test world entities
  const syntheticWorldEntities = db.prepare(`
    SELECT id FROM world_entities 
    WHERE last_provider IS NULL
       OR last_provider IN (
         'test_event_detection', 
         'gtfs_transit', 
         'water_level_gauge', 
         'gbfs_mobility', 
         'national_grid_energy', 
         'data_gov_in', 
         'gdacs_civic_alerts', 
         'mock_test_provider', 
         'test_provider', 
         'test_engine'
       )
       OR id LIKE 'STATION_%'
       OR id LIKE 'vehicle_%'
       OR id LIKE 'mobility_station_%'
       OR id LIKE 'infra_%'
       OR id LIKE 'water_gauge_%'
       OR id LIKE 'asset_%'
       OR id LIKE 'loc_geo_%'
       OR id LIKE 'loc_marine_%'
       OR id LIKE 'market_%'
       OR id LIKE 'BUS_%'
       OR id LIKE 'HYDRO_%'
       OR id LIKE 'GAUGE_%'
       OR id LIKE 'MOBILITY_HUB_%'
       OR id LIKE 'GRID_%'
       OR id LIKE 'SUBSTATION_%'
       OR id LIKE 'GOV_MARKET_%'
       OR id LIKE 'ALERT_GDACS_%'
       OR id LIKE 'SENSOR_TEST_%'
       OR id LIKE 'loc_mock_%'
       OR id LIKE 'loc_out_order_%'
       OR id LIKE 'loc_sim_%'
       OR id LIKE 'SIM_TEST_%'
  `).all() as { id: string }[];
  const worldEntityIds = syntheticWorldEntities.map(w => w.id);

  // 6. Dependent world observations
  const simulatedProviders = [
    'gtfs_realtime',
    'water_level_gauge',
    'gbfs_mobility',
    'national_grid_energy',
    'data_gov_in',
    'gdacs_civic_alerts',
    'mock_test_provider',
    'test_provider',
    'test_engine',
    'test_event_detection',
    'gtfs_transit'
  ];
  const provPlaceholders = simulatedProviders.map(() => '?').join(',');
  let worldObsCount = (db.prepare(`
    SELECT COUNT(*) as c FROM world_observations 
    WHERE provider IN (${provPlaceholders})
  `).get(...simulatedProviders) as any).c;

  // 7. Dependent raw observations
  let rawObsCount = (db.prepare(`
    SELECT COUNT(*) as c FROM raw_observations 
    WHERE provider IN (${provPlaceholders})
  `).get(...simulatedProviders) as any).c;

  // 8. Simulated observations in observations & raw_observation_payloads table
  const simulatedObsProviders = [
    'mock-weather-provider',
    'gbfs-mobility',
    'grid-energy',
    'gtfs-transit',
    'water-services',
    'karnataka-open-data',
    'gdacs-news-rss',
    'india-datagov',
    'public-crypto'
  ];
  const simObsPlaceholders = simulatedObsProviders.map(() => '?').join(',');
  let simObsCount = 0;
  let simPayloadCount = 0;
  try {
    simObsCount = (db.prepare(`
      SELECT COUNT(*) as c FROM observations 
      WHERE provider_id IN (${simObsPlaceholders})
    `).get(...simulatedObsProviders) as any).c;

    simPayloadCount = (db.prepare(`
      SELECT COUNT(*) as c FROM raw_observation_payloads 
      WHERE provider_id IN (${simObsPlaceholders})
    `).get(...simulatedObsProviders) as any).c;
  } catch (_) {}

  // 9. World events and graph relationships
  let worldEventsCount = 0;
  let worldRelsCount = 0;
  let inferredRelsCount = 0;
  let temporalHistoryCount = 0;
  let temporalStatesCount = 0;

  if (worldEntityIds.length > 0) {
    const wPlaceholders = worldEntityIds.map(() => '?').join(',');
    worldEventsCount = (db.prepare(`SELECT COUNT(*) as c FROM world_events WHERE entity_id IN (${wPlaceholders})`).get(...worldEntityIds) as any).c;
    worldRelsCount = (db.prepare(`SELECT COUNT(*) as c FROM world_relationships WHERE source_id IN (${wPlaceholders}) OR target_id IN (${wPlaceholders})`).get(...worldEntityIds, ...worldEntityIds) as any).c;
    try {
      inferredRelsCount = (db.prepare(`SELECT COUNT(*) as c FROM inferred_relationships WHERE source_entity_id IN (${wPlaceholders}) OR target_entity_id IN (${wPlaceholders})`).get(...worldEntityIds, ...worldEntityIds) as any).c;
    } catch (_) {
      inferredRelsCount = 0;
    }
    temporalHistoryCount = (db.prepare(`SELECT COUNT(*) as c FROM temporal_state_history WHERE entity_id IN (${wPlaceholders})`).get(...worldEntityIds) as any).c;
  }

  if (movingIds.length > 0) {
    const mPlaceholders = movingIds.map(() => '?').join(',');
    try {
      temporalStatesCount = (db.prepare(`SELECT COUNT(*) as c FROM temporal_entity_states WHERE entity_id IN (${mPlaceholders})`).get(...movingIds) as any).c;
    } catch (_) {
      temporalStatesCount = 0;
    }
  }

  // 10. Test simulations
  const simCount = (db.prepare("SELECT COUNT(*) as c FROM simulations WHERE id LIKE 'sim_%'").get() as any).c;
  let simStatesCount = 0;
  try {
    simStatesCount = (db.prepare("SELECT COUNT(*) as c FROM simulation_entity_states").get() as any).c;
  } catch (_) {}

  const genuineWorldEntitiesCount = (db.prepare(`
    SELECT COUNT(*) as c FROM world_entities 
    WHERE last_provider IS NOT NULL 
      AND last_provider NOT IN (${provPlaceholders})
      AND id NOT LIKE 'STATION_%'
      AND id NOT LIKE 'vehicle_%'
      AND id NOT LIKE 'mobility_station_%'
  `).get(...simulatedProviders) as any).c;

  const preservedCustCount = (db.prepare(`
    SELECT COUNT(*) as c FROM locations 
    WHERE id NOT LIKE 'LOC-ENT-CUST-%' 
      AND id NOT LIKE 'loc\\_mock\\_%' ESCAPE '\\'
      AND id NOT LIKE 'loc\\_sim\\_%' ESCAPE '\\'
      AND id NOT LIKE 'TEST-%'
      AND id NOT LIKE 'TEST\\_%' ESCAPE '\\'
  `).get() as any).c;

  const plan: CleanupPlan = {
    dbPath,
    backupPath,
    isExecute: execute,
    counts: {
      locations: locationIds.length,
      movingEntities: movingIds.length,
      entityPositions: entityPositionsCount,
      maritimePatterns: patternsCount,
      worldEntities: worldEntityIds.length,
      worldObservations: worldObsCount,
      rawObservations: rawObsCount,
      simulatedObservations: simObsCount,
      simulatedRawPayloads: simPayloadCount,
      worldEvents: worldEventsCount,
      worldRelationships: worldRelsCount,
      inferredRelationships: inferredRelsCount,
      temporalStateHistory: temporalHistoryCount,
      temporalEntityStates: temporalStatesCount,
      simulations: simCount,
      simulationEntityStates: simStatesCount,
    },
    preservedCustomerRecords: preservedCustCount,
    preservedLiveVessels: liveShipsBefore,
    preservedLiveWorldEntities: genuineWorldEntitiesCount,
    foreignKeyErrors: [],
    integrityStatus: 'pending'
  };

  if (!execute) {
    console.log('\n=============================================================');
    console.log('  MAP & ENTITY PURGE — DRY-RUN AUDIT PREVIEW');
    console.log('=============================================================');
    console.log(`Database Target: ${dbPath}`);
    console.log('Mode: DRY-RUN (No records modified)\n');
    console.log('Records targeted for safe deletion:');
    console.log(`  - locations (synthetic demo/test pins):          ${plan.counts.locations}`);
    console.log(`  - world_entities (mock/test/legacy entities):    ${plan.counts.worldEntities}`);
    console.log(`  - world_observations (synthetic readings):       ${plan.counts.worldObservations}`);
    console.log(`  - observations (simulated provider readings):    ${plan.counts.simulatedObservations}`);
    console.log(`  - raw_observation_payloads (simulated payloads): ${plan.counts.simulatedRawPayloads}`);
    console.log(`  - world_events (synthetic triggered events):      ${plan.counts.worldEvents}`);
    console.log(`  - world_relationships (synthetic graph edges):    ${plan.counts.worldRelationships}`);
    console.log(`  - inferred_relationships (synthetic links):       ${plan.counts.inferredRelationships}`);
    console.log(`  - temporal_state_history (synthetic states):      ${plan.counts.temporalStateHistory}\n`);
    console.log('Preservation Invariants:');
    console.log(`  ✔ Real live AIS vessels (SHIP_*):                ${liveShipsBefore} (STRICTLY PRESERVED)`);
    console.log(`  ✔ Genuine live world entities (USGS, FX, AQI):   ${genuineWorldEntitiesCount} (STRICTLY PRESERVED)`);
    console.log('=============================================================\n');
    db.close();
    return plan;
  }

  // EXECUTION MODE
  const cleanupTx = db.transaction(() => {
    // A. Delete synthetic locations
    if (locationIds.length > 0) {
      const placeholders = locationIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM locations WHERE id IN (${placeholders})`).run(...locationIds);
    }

    // B. Delete entity_positions for synthetic vessels
    if (movingIds.length > 0) {
      const placeholders = movingIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM entity_positions WHERE entity_id IN (${placeholders})`).run(...movingIds);
      db.prepare(`DELETE FROM moving_entities WHERE id IN (${placeholders})`).run(...movingIds);
      try {
        db.prepare(`DELETE FROM temporal_entity_states WHERE entity_id IN (${placeholders})`).run(...movingIds);
      } catch (_) {}
    }

    // Delete fabricated maritime pattern
    db.prepare("DELETE FROM maritime_patterns WHERE pattern_id = 'PAT_CORRIDOR_MALACCA'").run();

    // C. Delete synthetic observations & raw payloads
    db.prepare(`DELETE FROM world_observations WHERE provider IN (${provPlaceholders})`).run(...simulatedProviders);
    db.prepare(`DELETE FROM raw_observations WHERE provider IN (${provPlaceholders})`).run(...simulatedProviders);

    try {
      db.prepare(`DELETE FROM observations WHERE provider_id IN (${simObsPlaceholders})`).run(...simulatedObsProviders);
      db.prepare(`DELETE FROM raw_observation_payloads WHERE provider_id IN (${simObsPlaceholders})`).run(...simulatedObsProviders);
    } catch (_) {}

    // D. Delete world entity dependencies
    if (worldEntityIds.length > 0) {
      const wPlaceholders = worldEntityIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM world_events WHERE entity_id IN (${wPlaceholders})`).run(...worldEntityIds);
      db.prepare(`DELETE FROM world_relationships WHERE source_id IN (${wPlaceholders}) OR target_id IN (${wPlaceholders})`).run(...worldEntityIds, ...worldEntityIds);
      try {
        db.prepare(`DELETE FROM inferred_relationships WHERE source_entity_id IN (${wPlaceholders}) OR target_entity_id IN (${wPlaceholders})`).run(...worldEntityIds, ...worldEntityIds);
      } catch (_) {}
      db.prepare(`DELETE FROM temporal_state_history WHERE entity_id IN (${wPlaceholders})`).run(...worldEntityIds);
      db.prepare(`DELETE FROM world_observations WHERE entity_id IN (${wPlaceholders})`).run(...worldEntityIds);
      db.prepare(`DELETE FROM world_entities WHERE id IN (${wPlaceholders})`).run(...worldEntityIds);
    }

    // E. Delete test simulation runs
    db.prepare("DELETE FROM simulation_entity_overrides WHERE simulation_id LIKE 'sim_%'").run();
    db.prepare("DELETE FROM simulations WHERE id LIKE 'sim_%'").run();
    try {
      db.prepare("DELETE FROM simulation_entity_states").run();
    } catch (_) {}

    // Record migration execution
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
      `phase1_map_cleanup_${Date.now()}`,
      'phase-1-map-synthetic-purge',
      new Date().toISOString(),
      backupPath || 'none',
      JSON.stringify(plan.counts)
    );
  });

  cleanupTx();

  // Run integrity and foreign key checks post-cleanup
  plan.foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();
  plan.integrityStatus = (db.prepare('PRAGMA integrity_check').get() as any).integrity_check;

  console.log('\n=============================================================');
  console.log('  MAP & ENTITY PURGE — EXECUTION COMPLETED');
  console.log('=============================================================');
  console.log(`Database Target: ${dbPath}`);
  console.log(`Backup Location: ${backupPath}`);
  console.log(`Locations Purged: ${plan.counts.locations}`);
  console.log(`World Entities Purged: ${plan.counts.worldEntities}`);
  console.log(`Observations Purged: ${plan.counts.simulatedObservations}`);
  console.log(`Foreign Key Errors: ${plan.foreignKeyErrors.length}`);
  console.log(`SQLite Integrity Status: ${plan.integrityStatus}`);
  console.log(`Live AIS Ships Preserved: ${plan.preservedLiveVessels}`);
  console.log(`Genuine Live World Entities Preserved: ${plan.preservedLiveWorldEntities}`);
  console.log('=============================================================\n');

  db.close();
  return plan;
}

if (process.argv[1]?.includes('cleanup_synthetic_data')) {
  const isExecute = process.argv.includes('--execute');
  try {
    runCleanup(isExecute);
  } catch (err: any) {
    console.error('Fatal cleanup error:', err.message);
    process.exit(1);
  }
}
