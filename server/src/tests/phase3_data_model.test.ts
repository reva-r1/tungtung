import assert from 'assert';
import { db, initDatabase, DB_PATH } from '../db/database.js';
import { runPhase3Migration } from '../db/migrations/phase3_data_integrity_migration.js';
import { worldModelService } from '../services/world_model/world_model.service.js';
import { NormalizedObservation } from '../connectors/base/types.js';
import { CwcHydrologyProvider } from '../connectors/providers/water/CwcHydrologyProvider.js';

let totalTests = 0;
let passedTests = 0;

const createProvenance = (provider = 'test_provider', endpoint = '/test') => ({
  source: `https://${provider}.org`,
  provider,
  endpoint,
  retrievedAt: '2026-10-16T12:00:00.000Z',
  observedAt: '2026-10-16T12:00:00.000Z',
});

async function runTest(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✘ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('  REVANA TECHNOLOGIES — PHASE 3 DATA MODEL INTEGRITY SUITE');
  console.log('=============================================================\n');

  // Ensure DB initialized and Phase 3 migration applied on test DB
  initDatabase();
  runPhase3Migration(DB_PATH);

  // --- SUITE 1: CANONICAL IDENTITY & IDEMPOTENCY ---

  await runTest('1. Stable entity IDs and idempotent repeated observation ingestion', async () => {
    const obs: NormalizedObservation = {
      id: 'obs_test_station_01_20261016T120000Z',
      entity_id: 'WEATHER_NODE_TEST_IDEMP',
      entity_type: 'WEATHER_STATION',
      data_type: 'METEOROLOGICAL',
      value: { station_name: 'Test Idempotency Station', temperature_c: 24.5 },
      location: { latitude: 12.9716, longitude: 77.5946 },
      timestamp: '2026-10-16T12:00:00.000Z',
      observed_at: '2026-10-16T12:00:00.000Z',
      source: 'https://test.provider.org',
      provider: 'test_provider',
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: 300,
      provenance: createProvenance('test_provider'),
    };

    // Ingest first time
    worldModelService.ingestObservation(obs);
    const count1 = (db.prepare(`SELECT count(*) as c FROM world_observations WHERE id = ?`).get(obs.id) as any).c;
    assert.strictEqual(count1, 1, 'Observation must exist once');

    // Ingest second time with exact same observation
    worldModelService.ingestObservation(obs);
    const count2 = (db.prepare(`SELECT count(*) as c FROM world_observations WHERE id = ?`).get(obs.id) as any).c;
    assert.strictEqual(count2, 1, 'Repeated ingestion must not create duplicate observation rows');

    const entity = db.prepare(`SELECT * FROM world_entities WHERE id = ?`).get('WEATHER_NODE_TEST_IDEMP') as any;
    assert(entity !== undefined, 'Entity must exist in world_entities');
    assert.strictEqual(entity.type, 'WEATHER_STATION');
  });

  await runTest('2. Deterministic fallback ID generated when obs.id is omitted', async () => {
    const obsWithoutId = {
      entity_id: 'WEATHER_NODE_FALLBACK_TEST',
      entity_type: 'WEATHER_STATION',
      data_type: 'METEOROLOGICAL',
      value: { temperature_c: 22.0 },
      location: { latitude: 13.0827, longitude: 80.2707 },
      timestamp: '2026-10-16T12:00:00.000Z',
      observed_at: '2026-10-16T12:00:00.000Z',
      source: 'https://test.provider.org',
      provider: 'test_meteo',
      confidence: 0.9,
      quality: 'VERIFIED',
      ttl: 300,
      provenance: createProvenance('test_meteo'),
    };

    const res1 = worldModelService.ingestObservation(obsWithoutId as any as NormalizedObservation);
    assert(res1.entity.id === 'WEATHER_NODE_FALLBACK_TEST');

    // Query observation created
    const rows = db.prepare(`SELECT id FROM world_observations WHERE entity_id = ? AND provider = ?`).all('WEATHER_NODE_FALLBACK_TEST', 'test_meteo') as any[];
    assert(rows.length === 1, 'Exactly one observation must be created');
    assert(rows[0].id.startsWith('obs_test_meteo_WEATHER_NODE_FALLBACK_TEST_'), 'Fallback ID must be deterministic and include provider and entity_id');
  });

  // --- SUITE 2: OUT-OF-ORDER PROTECTION ---

  await runTest('3. Out-of-order observation does NOT overwrite newer entity current_state', async () => {
    const entityId = 'AIRCRAFT_OUT_OF_ORDER_TEST';

    // 1. Ingest newer observation (Time T = 14:00)
    const newObs: NormalizedObservation = {
      id: 'obs_aircraft_newer_1400',
      entity_id: entityId,
      entity_type: 'AIRCRAFT',
      data_type: 'TELEMETRY_FLIGHT',
      value: { callsign: 'AIC101', altitude_ft: 32000, speed_kmh: 850 },
      location: { latitude: 13.0, longitude: 77.5 },
      timestamp: '2026-10-16T14:00:00.000Z',
      observed_at: '2026-10-16T14:00:00.000Z',
      source: 'https://opensky-network.org',
      provider: 'opensky_aviation',
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: 60,
      provenance: createProvenance('opensky_aviation', '/api/states/all'),
    };
    worldModelService.ingestObservation(newObs);

    const entityStateAfterNew = db.prepare('SELECT current_state, last_observed_at FROM world_entities WHERE id = ?').get(entityId) as any;
    assert.strictEqual(JSON.parse(entityStateAfterNew.current_state).altitude_ft, 32000);
    assert.strictEqual(entityStateAfterNew.last_observed_at, '2026-10-16T14:00:00.000Z');

    // 2. Ingest older, delayed observation (Time T = 13:30)
    const oldObs: NormalizedObservation = {
      id: 'obs_aircraft_older_1330',
      entity_id: entityId,
      entity_type: 'AIRCRAFT',
      data_type: 'TELEMETRY_FLIGHT',
      value: { callsign: 'AIC101', altitude_ft: 18000, speed_kmh: 600 },
      location: { latitude: 12.8, longitude: 77.2 },
      timestamp: '2026-10-16T13:30:00.000Z',
      observed_at: '2026-10-16T13:30:00.000Z',
      source: 'https://opensky-network.org',
      provider: 'opensky_aviation',
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: 60,
      provenance: createProvenance('opensky_aviation', '/api/states/all'),
    };
    worldModelService.ingestObservation(oldObs);

    // 3. Verify: Observation was logged in world_observations for historical audit
    const oldObsRow = db.prepare('SELECT id FROM world_observations WHERE id = ?').get('obs_aircraft_older_1330');
    assert(oldObsRow !== undefined, 'Older observation must be retained in world_observations');

    // 4. Verify: world_entities current_state was PROTECTED from overwrite and remains at 32000 ft
    const entityStateAfterOld = db.prepare('SELECT current_state, last_observed_at FROM world_entities WHERE id = ?').get(entityId) as any;
    const currentVal = JSON.parse(entityStateAfterOld.current_state);
    assert.strictEqual(currentVal.altitude_ft, 32000, 'Entity current_state altitude must remain 32000 ft (not reverted to 18000 ft)');
    assert.strictEqual(entityStateAfterOld.last_observed_at, '2026-10-16T14:00:00.000Z', 'last_observed_at must remain the newer 14:00 timestamp');
  });

  // --- SUITE 3: CROSS-PROVIDER PROVENANCE MERGING ---

  await runTest('4. Cross-provider source array tracking without duplicate entries', async () => {
    const hubId = 'WEATHER_NODE_BLR_CENTRAL';

    // Ingest weather observation from open_meteo_weather
    worldModelService.ingestObservation({
      id: 'obs_merge_wx_01',
      entity_id: hubId,
      entity_type: 'WEATHER_STATION',
      data_type: 'METEOROLOGICAL',
      value: { temperature_c: 23.0 },
      location: { latitude: 12.9716, longitude: 77.5946 },
      timestamp: '2026-10-16T12:00:00.000Z',
      observed_at: '2026-10-16T12:00:00.000Z',
      source: 'open_meteo_weather',
      provider: 'open_meteo_weather',
      confidence: 0.9,
      quality: 'VERIFIED',
      ttl: 300,
      provenance: createProvenance('open_meteo_weather', '/v1/forecast'),
    });

    // Ingest air quality observation from open_meteo_air_quality
    worldModelService.ingestObservation({
      id: 'obs_merge_aqi_01',
      entity_id: hubId,
      entity_type: 'WEATHER_STATION',
      data_type: 'METEOROLOGICAL',
      value: { pm2_5: 35.0 },
      location: { latitude: 12.9716, longitude: 77.5946 },
      timestamp: '2026-10-16T12:05:00.000Z',
      observed_at: '2026-10-16T12:05:00.000Z',
      source: 'open_meteo_air_quality',
      provider: 'open_meteo_air_quality',
      confidence: 0.9,
      quality: 'VERIFIED',
      ttl: 300,
      provenance: createProvenance('open_meteo_air_quality', '/v1/air-quality'),
    });

    const row = db.prepare('SELECT source_providers, last_provider FROM world_entities WHERE id = ?').get(hubId) as any;
    const providers = JSON.parse(row.source_providers);
    assert(providers.includes('open_meteo_weather'), 'Must include open_meteo_weather');
    assert(providers.includes('open_meteo_air_quality'), 'Must include open_meteo_air_quality');
    assert.strictEqual(row.last_provider, 'open_meteo_air_quality');
  });

  // --- SUITE 4: HYDROLOGY TIMESTAMP & DATE PRECISION ---

  await runTest('5. CwcHydrologyProvider preserves calendar date precision and derives 08:30 IST to UTC', async () => {
    const provider = new CwcHydrologyProvider();
    const rawPayload = [
      {
        agencyName: 'CWC',
        stateName: 'Karnataka',
        districtName: 'Vijayapura',
        reservoirName: 'Almatti Reservoir',
        current_live_storage: 2.50,
        observation_date: '2024-01-16',
      }
    ];

    const observations = await provider.normalize(rawPayload);
    assert.strictEqual(observations.length, 1);

    const obs = observations[0];
    assert.strictEqual(obs.value.source_date, '2024-01-16', 'Must explicitly preserve original calendar date');
    assert.strictEqual(obs.value.date_precision, 'DAY', 'Must explicitly record DAY precision');
    assert.strictEqual(obs.value.is_date_only, true, 'is_date_only flag must be true');
    assert.strictEqual(obs.observed_at, '2024-01-16T03:00:00.000Z', '08:30 IST must normalize to 03:00:00.000Z in UTC');
    assert.strictEqual(obs.provenance.source_reporting_standard, '08:30 IST Daily Bulletin');
    assert.strictEqual(obs.provenance.derived_from_date, true);
  });

  // --- SUITE 5: GRAPH RELATIONSHIP & REFERENCE ANCHOR INTEGRITY ---

  await runTest('6. Canonical reference anchors exist and eliminate all dangling graph edges', async () => {
    // 1. Verify the 3 anchor entities exist
    const anchors = db.prepare(`
      SELECT id, type, category FROM world_entities 
      WHERE id IN ('ROAD_CORRIDOR_NH48', 'AIRPORT_KEMPEGOWDA_BLR', 'CATCHMENT_CAUVERY_SOUTH')
    `).all() as any[];
    assert.strictEqual(anchors.length, 3, 'All 3 reference anchor entities must be registered in world_entities');

    // 2. Verify zero dangling targets in world_relationships
    const dangling = db.prepare(`
      SELECT r.id, r.source_id, r.target_id 
      FROM world_relationships r 
      LEFT JOIN world_entities e ON r.target_id = e.id 
      WHERE e.id IS NULL
    `).all();
    assert.strictEqual(dangling.length, 0, 'Must have ZERO dangling edges in world_relationships');

    // 3. Verify zero dangling sources in world_relationships
    const danglingSources = db.prepare(`
      SELECT r.id, r.source_id, r.target_id 
      FROM world_relationships r 
      LEFT JOIN world_entities e ON r.source_id = e.id 
      WHERE e.id IS NULL
    `).all();
    assert.strictEqual(danglingSources.length, 0, 'Must have ZERO dangling sources in world_relationships');
  });

  await runTest('7. Spatial joins connect WATER_RESERVOIR_GAUGE to Cauvery Basin catchment', async () => {
    // Ingest reservoir observation within Cauvery South catchment boundary
    const reservoirObs: NormalizedObservation = {
      id: 'obs_cauvery_res_test_01',
      entity_id: 'RESERVOIR_ANEKAL_CAUVERY_01',
      entity_type: 'WATER_RESERVOIR_GAUGE',
      data_type: 'HYDROLOGICAL',
      value: {
        station_name: 'Anekal South Catchment Reservoir',
        current_live_storage_tmc: 4.5,
        water_level_m: 885.0,
      },
      location: { latitude: 12.8600, longitude: 77.6100 }, // Within CATCHMENT_CAUVERY_SOUTH (2.4 km from center)
      timestamp: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      source: 'cwc_india_wris',
      provider: 'cwc_india_wris',
      confidence: 0.98,
      quality: 'VERIFIED',
      ttl: 86400,
      provenance: createProvenance('cwc_india_wris', '/api/reservoir-data'),
    };

    const res = worldModelService.ingestObservation(reservoirObs);
    const catchmentRel = res.inferredRelationships.find(r => r.target_entity_id === 'CATCHMENT_CAUVERY_SOUTH');
    assert(catchmentRel !== undefined, 'Reservoir must connect to CATCHMENT_CAUVERY_SOUTH');
    assert.strictEqual(catchmentRel?.relationship_type, 'FEEDS_WATERSHED_CATCHMENT');
    assert(catchmentRel?.confidence > 0.8, 'Confidence must be > 0.8');
    assert(catchmentRel?.evidence.length >= 2, 'Must include distance and storage evidence');

    // Clean up test observation and entity so test database state remains pristine
    db.prepare("DELETE FROM world_observations WHERE id = 'obs_cauvery_res_test_01'").run();
    db.prepare("DELETE FROM world_entities WHERE id = 'RESERVOIR_ANEKAL_CAUVERY_01'").run();
    db.prepare("DELETE FROM world_relationships WHERE source_id = 'RESERVOIR_ANEKAL_CAUVERY_01'").run();
  });

  // --- SUITE 6: MIGRATION LEDGER & DATABASE PRAGMAS ---

  await runTest('8. Database migration ledger tracks Phase 3 execution and PRAGMAs pass', async () => {
    // 1. Verify PRAGMA integrity_check
    const integrity = db.prepare('PRAGMA integrity_check').all() as any[];
    assert.strictEqual(integrity[0].integrity_check, 'ok', 'PRAGMA integrity_check must be ok');

    // 2. Verify PRAGMA foreign_key_check
    const fkErrors = db.prepare('PRAGMA foreign_key_check').all();
    assert.strictEqual(fkErrors.length, 0, 'Must have zero foreign key violations');

    // 3. Verify data_migration_log has phase 3 recorded
    const migLog = db.prepare("SELECT * FROM data_migration_log WHERE migration_name = 'phase-3-operational-data-model-integrity'").get() as any;
    assert(migLog !== undefined, 'Phase 3 migration must be logged in data_migration_log');
    assert(migLog.backup_path && migLog.backup_path.includes('phase3'), 'Must record backup snapshot path');
  });

  console.log('\n=============================================================');
  console.log(`  PHASE 3 TEST RESULTS: ${passedTests} PASSED / ${totalTests - passedTests} FAILED`);
  console.log('=============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
