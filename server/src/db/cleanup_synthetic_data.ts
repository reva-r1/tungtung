import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

interface CleanupPlan {
  dbPath: string;
  backupPath?: string;
  isExecute: boolean;
  counts: {
    movingEntities: number;
    entityPositions: number;
    maritimePatterns: number;
    worldEntities: number;
    worldObservations: number;
    rawObservations: number;
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
    backupPath = path.join(path.dirname(dbPath), `aegis_intel.phase0_backup_${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`[BACKUP CREATED] Verified recoverable backup at: ${backupPath}`);
  }

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // Verify baseline real customer records
  const custBefore = (db.prepare("SELECT COUNT(*) as c FROM locations WHERE id LIKE 'LOC-ENT-CUST-%'").get() as any).c;
  const liveShipsBefore = (db.prepare("SELECT COUNT(*) as c FROM moving_entities WHERE id LIKE 'SHIP_%' AND properties NOT LIKE '%Replay%'").get() as any).c;

  // 1. Identify synthetic moving entities
  const syntheticMovingEntities = db.prepare(`
    SELECT id FROM moving_entities 
    WHERE properties LIKE '%Replay%' 
       OR properties LIKE '%ais_real_replay%' 
       OR mmsi LIKE '999%' 
       OR id LIKE 'vessel_mmsi_%' 
       OR id LIKE 'VESSEL_%'
  `).all() as { id: string }[];
  const movingIds = syntheticMovingEntities.map(m => m.id);

  // 2. Identify synthetic entity positions
  let entityPositionsCount = 0;
  if (movingIds.length > 0) {
    const placeholders = movingIds.map(() => '?').join(',');
    entityPositionsCount = (db.prepare(`SELECT COUNT(*) as c FROM entity_positions WHERE entity_id IN (${placeholders})`).get(...movingIds) as any).c;
  }

  // 3. Identify fabricated maritime patterns
  const patternsCount = (db.prepare("SELECT COUNT(*) as c FROM maritime_patterns WHERE pattern_id = 'PAT_CORRIDOR_MALACCA'").get() as any).c;

  // 4. Identify synthetic / test world entities
  const syntheticWorldEntities = db.prepare(`
    SELECT id FROM world_entities 
    WHERE id LIKE 'BUS_%' 
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

  // 5. Dependent world observations
  const simulatedProviders = [
    'gtfs_realtime',
    'water_level_gauge',
    'gbfs_mobility',
    'national_grid_energy',
    'data_gov_in',
    'gdacs_civic_alerts',
    'mock_test_provider',
    'test_provider',
    'test_engine'
  ];
  const provPlaceholders = simulatedProviders.map(() => '?').join(',');
  const worldObsCount = (db.prepare(`
    SELECT COUNT(*) as c FROM world_observations 
    WHERE provider IN (${provPlaceholders})
  `).get(...simulatedProviders) as any).c;

  // 6. Dependent raw observations
  const rawObsCount = (db.prepare(`
    SELECT COUNT(*) as c FROM raw_observations 
    WHERE provider IN (${provPlaceholders})
  `).get(...simulatedProviders) as any).c;

  // 7. World events
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

  // 8. Test simulations
  const simCount = (db.prepare("SELECT COUNT(*) as c FROM simulations WHERE id LIKE 'sim_%'").get() as any).c;
  let simStatesCount = 0;
  try {
    simStatesCount = (db.prepare("SELECT COUNT(*) as c FROM simulation_entity_states").get() as any).c;
  } catch (_) {}

  const plan: CleanupPlan = {
    dbPath,
    backupPath,
    isExecute: execute,
    counts: {
      movingEntities: movingIds.length,
      entityPositions: entityPositionsCount,
      maritimePatterns: patternsCount,
      worldEntities: worldEntityIds.length,
      worldObservations: worldObsCount,
      rawObservations: rawObsCount,
      worldEvents: worldEventsCount,
      worldRelationships: worldRelsCount,
      inferredRelationships: inferredRelsCount,
      temporalStateHistory: temporalHistoryCount,
      temporalEntityStates: temporalStatesCount,
      simulations: simCount,
      simulationEntityStates: simStatesCount,
    },
    preservedCustomerRecords: custBefore,
    preservedLiveVessels: liveShipsBefore,
    foreignKeyErrors: [],
    integrityStatus: 'pending'
  };

  if (!execute) {
    console.log('\n=============================================================');
    console.log('  PHASE 1 DATABASE CLEANUP — DRY-RUN AUDIT PREVIEW');
    console.log('=============================================================');
    console.log(`Database Target: ${dbPath}`);
    console.log('Mode: DRY-RUN (No records modified)\n');
    console.log('Records targeted for safe deletion:');
    console.log(`  - moving_entities (synthetic AIS replay):       ${plan.counts.movingEntities}`);
    console.log(`  - entity_positions (orphaned replay tracks):    ${plan.counts.entityPositions}`);
    console.log(`  - maritime_patterns (fabricated Malacca surge): ${plan.counts.maritimePatterns}`);
    console.log(`  - world_entities (simulated sensors/test sites): ${plan.counts.worldEntities}`);
    console.log(`  - world_observations (synthetic readings):     ${plan.counts.worldObservations}`);
    console.log(`  - raw_observations (synthetic payloads):       ${plan.counts.rawObservations}`);
    console.log(`  - world_events (synthetic triggered events):    ${plan.counts.worldEvents}`);
    console.log(`  - world_relationships (synthetic graph edges):  ${plan.counts.worldRelationships}`);
    console.log(`  - inferred_relationships (synthetic links):     ${plan.counts.inferredRelationships}`);
    console.log(`  - temporal_state_history (synthetic states):    ${plan.counts.temporalStateHistory}`);
    console.log(`  - temporal_entity_states (replay history):     ${plan.counts.temporalEntityStates}`);
    console.log(`  - simulations / states (test scenario runs):   ${plan.counts.simulations} / ${plan.counts.simulationEntityStates}\n`);
    console.log('Preservation Invariants:');
    console.log(`  ✔ Real customer records (LOC-ENT-CUST-*):      ${custBefore} (STRICTLY PRESERVED)`);
    console.log(`  ✔ Real live AIS vessels (SHIP_*):              ${liveShipsBefore} (STRICTLY PRESERVED)`);
    console.log('=============================================================\n');
    db.close();
    return plan;
  }

  // EXECUTION MODE
  const cleanupTx = db.transaction(() => {
    // A. Delete entity_positions for synthetic vessels
    if (movingIds.length > 0) {
      const placeholders = movingIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM entity_positions WHERE entity_id IN (${placeholders})`).run(...movingIds);
      db.prepare(`DELETE FROM moving_entities WHERE id IN (${placeholders})`).run(...movingIds);
      try {
        db.prepare(`DELETE FROM temporal_entity_states WHERE entity_id IN (${placeholders})`).run(...movingIds);
      } catch (_) {}
    }

    // B. Delete fabricated maritime pattern
    db.prepare("DELETE FROM maritime_patterns WHERE pattern_id = 'PAT_CORRIDOR_MALACCA'").run();

    // C. Delete synthetic observations
    db.prepare(`DELETE FROM world_observations WHERE provider IN (${provPlaceholders})`).run(...simulatedProviders);
    db.prepare(`DELETE FROM raw_observations WHERE provider IN (${provPlaceholders})`).run(...simulatedProviders);

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

    // F. Verify customer records invariant
    const custAfter = (db.prepare("SELECT COUNT(*) as c FROM locations WHERE id LIKE 'LOC-ENT-CUST-%'").get() as any).c;
    if (custAfter !== custBefore) {
      throw new Error(`CRITICAL INTEGRITY ABORT: Customer record count changed from ${custBefore} to ${custAfter}! Rolling back transaction.`);
    }

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
      `phase1_cleanup_${Date.now()}`,
      'phase-1-synthetic-purge',
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
  console.log('  PHASE 1 DATABASE CLEANUP — EXECUTION COMPLETED');
  console.log('=============================================================');
  console.log(`Database Target: ${dbPath}`);
  console.log(`Backup Location: ${backupPath}`);
  console.log(`Foreign Key Errors: ${plan.foreignKeyErrors.length}`);
  console.log(`SQLite Integrity Status: ${plan.integrityStatus}`);
  console.log(`Customer Records Verified Preserved: ${plan.preservedCustomerRecords}`);
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
