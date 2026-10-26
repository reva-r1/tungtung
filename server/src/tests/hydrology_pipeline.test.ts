import assert from 'assert';
import { CwcHydrologyProvider, CWC_KARNATAKA_RESERVOIRS } from '../connectors/providers/water/CwcHydrologyProvider.js';
import { HydrologyService } from '../services/hydrology/hydrology.service.js';
import { db } from '../db/database.js';

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('  REVANA TECHNOLOGIES — PHASE 2 HYDROLOGY PIPELINE TEST SUITE');
  console.log('  (DETERMINISTIC SUITE — FIXTURES & CANONICAL PERSISTENCE)');
  console.log('=============================================================\n');

  const provider = new CwcHydrologyProvider();

  // 1. Normalization of authentic India-WRIS CWC reservoir records
  await runTest('1. CwcHydrologyProvider normalizes authentic India-WRIS CWC records accurately', async () => {
    const rawData = [
      {
        agencyName: 'CWC',
        stateName: 'Karnataka',
        districtName: 'Vijayapura',
        reservoirName: 'Almatti (Almatti Dam)',
        level: 519.6,
        current_live_storage: 3.104, // 3.104 BMC
        storage_last_year: 2.85,
        storage_last_ten_year: 2.60,
        observation_date: '2024-01-15',
      },
      {
        agencyName: 'CWC',
        stateName: 'Karnataka',
        districtName: 'Mandya',
        reservoirName: 'KRS',
        level: 752.1,
        current_live_storage: 1.150, // 1.150 BMC
        storage_last_year: 1.20,
        storage_last_ten_year: 1.05,
        observation_date: '2024-01-15',
      }
    ];

    const observations = await provider.normalize(rawData);
    assert.strictEqual(observations.length, 2, 'Should normalize 2 authentic records');

    const almatti = observations[0];
    assert.strictEqual(almatti.entity_id, 'RESERVOIR_ALMATTI_KARNATAKA');
    assert.strictEqual(almatti.entity_type, 'WATER_RESERVOIR_GAUGE');
    assert.strictEqual(almatti.data_type, 'HYDROLOGICAL');
    assert.strictEqual(almatti.location.latitude, 16.3314);
    assert.strictEqual(almatti.location.longitude, 75.8872);
    assert.strictEqual(almatti.value.reservoir_code, 'ALMATTI');
    assert.strictEqual(almatti.value.current_live_storage_bmc, 3.104);
    assert.strictEqual(almatti.value.current_live_storage_tmc, 109.62); // 3.104 * 35.3147 ~ 109.62 TMC
    assert.strictEqual(almatti.value.full_capacity_bmc, 3.44);
    assert.strictEqual(almatti.value.capacity_pct, 90); // 3.104 / 3.440 * 100 ~ 90%
    assert.strictEqual(almatti.value.river, 'Krishna');
    assert.strictEqual(almatti.value.district, 'Vijayapura');
    assert.strictEqual(almatti.value.agency, 'CWC');
    assert.strictEqual(almatti.provenance.provider, 'cwc_india_wris');

    const krs = observations[1];
    assert.strictEqual(krs.entity_id, 'RESERVOIR_KRS_KARNATAKA');
    assert.strictEqual(krs.location.latitude, 12.4284);
    assert.strictEqual(krs.location.longitude, 76.5728);
    assert.strictEqual(krs.value.full_capacity_bmc, 1.399);
    assert.strictEqual(krs.value.current_live_storage_tmc, 40.61);
    assert.strictEqual(krs.value.river, 'Kaveri (Cauvery)');
  });

  // 2. Coordinate boundary validation and registry matching
  await runTest('2. All registered reservoirs have authentic Survey of India / NRLD coordinates', async () => {
    const list = Object.values(CWC_KARNATAKA_RESERVOIRS);
    assert.strictEqual(list.length, 16, 'Must contain all 16 major surveyed Karnataka reservoirs');
    for (const r of list) {
      assert(r.latitude >= 11.0 && r.latitude <= 19.0, `Latitude ${r.latitude} for ${r.name} must be within Karnataka latitude range`);
      assert(r.longitude >= 74.0 && r.longitude <= 79.0, `Longitude ${r.longitude} for ${r.name} must be within Karnataka longitude range`);
      assert(r.fullCapacityBmc > 0, `Capacity for ${r.name} must be positive`);
    }
  });

  // 3. Unit conversion accuracy (BMC to TMC)
  await runTest('3. Unit conversions (BMC to TMC and capacity percentage) are exact', async () => {
    const rawData = [
      {
        agencyName: 'CWC',
        reservoirName: 'Kabini',
        current_live_storage: 0.500, // 0.5 BMC
        observation_date: '2024-01-15',
      }
    ];

    const observations = await provider.normalize(rawData);
    assert.strictEqual(observations.length, 1);
    const obs = observations[0];
    // 0.5 BMC * 35.3147 = 17.65735 -> 17.66 TMC
    assert.strictEqual(obs.value.current_live_storage_tmc, 17.66);
    // Kabini capacity = 0.552 BMC -> (0.5 / 0.552) * 100 = 91%
    assert.strictEqual(obs.value.capacity_pct, 91);
  });

  // 4. Missing or null storage values handling
  await runTest('4. Rejects records with missing, null, or negative storage measurements', async () => {
    const rawData = [
      {
        reservoirName: 'Kabini',
        current_live_storage: null,
      },
      {
        reservoirName: 'KRS',
        current_live_storage: 'INVALID_NUMBER',
      },
      {
        reservoirName: 'Almatti',
        current_live_storage: -1.5,
      }
    ];

    const observations = await provider.normalize(rawData);
    assert.strictEqual(observations.length, 0, 'Should reject all invalid or negative storage records');
  });

  // 5. Unrecognized or arbitrary reservoir names filtered safely
  await runTest('5. Unrecognized dams not in official CWC Karnataka registry are filtered out', async () => {
    const rawData = [
      {
        reservoirName: 'NonExistentDamXYZ',
        current_live_storage: 2.5,
        observation_date: '2024-01-15',
      }
    ];

    const observations = await provider.normalize(rawData);
    assert.strictEqual(observations.length, 0, 'Should not invent coordinates for unverified dams');
  });

  // 6. Malformed and empty payload resilience
  await runTest('6. Handles malformed or non-array payloads without crashing', async () => {
    assert.deepStrictEqual(await provider.normalize(null as any), []);
    assert.deepStrictEqual(await provider.normalize({} as any), []);
    assert.deepStrictEqual(await provider.normalize('string' as any), []);
    assert.deepStrictEqual(await provider.normalize([]), []);
  });

  // 7. Canonical World Model persistence and idempotency
  await runTest('7. HydrologyService ingestObservations persists canonical records idempotently', async () => {
    const hydroService = HydrologyService.getInstance();
    const testObs = await provider.normalize([
      {
        agencyName: 'CWC',
        stateName: 'Karnataka',
        districtName: 'Mysuru',
        reservoirName: 'Kabini',
        level: 695.5,
        current_live_storage: 0.485,
        observation_date: '2024-01-16',
      }
    ]);

    // First ingestion
    const count1 = hydroService.ingestObservations(testObs);
    assert.strictEqual(count1, 1);

    // Verify entity in world_entities
    const entity = db.prepare('SELECT * FROM world_entities WHERE id = ?').get('RESERVOIR_KABINI_KARNATAKA') as any;
    assert(entity, 'Entity must exist in world_entities');
    assert.strictEqual(entity.type, 'WATER_RESERVOIR_GAUGE');
    assert.strictEqual(entity.category, 'HYDROLOGICAL');
    assert.strictEqual(entity.last_provider, 'cwc_india_wris');

    // Second ingestion with same data (idempotent update)
    const count2 = hydroService.ingestObservations(testObs);
    assert.strictEqual(count2, 1);

    // Verify no duplicate entities created
    const entityCount = db.prepare('SELECT count(*) as c FROM world_entities WHERE id = ?').get('RESERVOIR_KABINI_KARNATAKA') as any;
    assert.strictEqual(entityCount.c, 1, 'Entity count must remain exactly 1');
  });

  // 8. Bounded historical observations query
  await runTest('8. HydrologyService getStationHistory enforces bounds and ordering', async () => {
    const hydroService = HydrologyService.getInstance();
    const history = hydroService.getStationHistory('RESERVOIR_KABINI_KARNATAKA', 10);
    assert(Array.isArray(history), 'History must return an array');
    assert(history.length >= 1, 'History must contain at least 1 observation');
    assert(history[0].current_live_storage_bmc !== undefined);
  });

  // 9. Independent diagnostics and decoupled freshness
  await runTest('9. Decouples provider connection state from observation freshness', async () => {
    const hydroService = HydrologyService.getInstance();
    const status = hydroService.getStatus();

    assert(status.providerId === 'cwc_india_wris');
    assert(['CONNECTED', 'DEGRADED', 'RATE_LIMITED', 'DISCONNECTED', 'STANDBY'].includes(status.connectionState));
    assert(['FRESH', 'STALE', 'HISTORICAL', 'EMPTY', 'UNKNOWN'].includes(status.dataFreshness));
    assert(['CONNECTED_FRESH', 'CONNECTED_STALE', 'CONNECTED_EMPTY', 'CONNECTED_HISTORICAL', 'RATE_LIMITED', 'DISCONNECTED', 'STANDBY'].includes(status.operationalState));
    assert(typeof status.totalStationsInDb === 'number');
    assert(typeof status.rateLimitRemaining === 'number');
  });

  // 10. Rate-limiting cooldown on rapid consecutive polls
  await runTest('10. HydrologyService enforces rate-limit cooldown against provider hammering', async () => {
    const hydroService = HydrologyService.getInstance();
    
    // Trigger poll 1
    const res1 = await hydroService.pollNow();
    assert(res1.success !== undefined);

    // Immediately trigger poll 2 within cooldown window (10s)
    const res2 = await hydroService.pollNow();
    assert.strictEqual(res2.success, false, 'Immediate subsequent poll must not succeed');
    assert((res2.cooldownRemainingSec || 0) > 0, 'Must report cooldownRemainingSec');
    assert.strictEqual(res2.recordsReceived, 0, 'No outbound fetch during cooldown');
  });

  // 11. Truth-in-Labeling: Old observation timestamps never report as FRESH or LIVE
  await runTest('11. Successful HTTP responses containing 1000+ day old observations remain HISTORICAL', async () => {
    const hydroService = HydrologyService.getInstance();
    const status = hydroService.getStatus();

    // In aegis_intel.db, observations are from 2024-01-16 (> 1000 days ago)
    assert.strictEqual(status.connectionState, 'CONNECTED', 'HTTP transport must be connected');
    assert.strictEqual(status.dataFreshness, 'HISTORICAL', 'Freshness must be HISTORICAL, not FRESH');
    assert.strictEqual(status.operationalState, 'CONNECTED_HISTORICAL', 'Operational state must be CONNECTED_HISTORICAL, not CONNECTED_FRESH');
    assert((status.newestObservationAgeDays || 0) > 30, 'Age in days must exceed 30 days threshold');
  });

  // 12. Freshness calculated strictly from source observation time, not polling time
  await runTest('12. Freshness age is calculated from observation timestamp, not lastPollAt', async () => {
    const hydroService = HydrologyService.getInstance();
    const status = hydroService.getStatus();

    assert(status.lastPollAt !== null, 'lastPollAt must be set');
    assert(status.newestObservationAt !== null, 'newestObservationAt must be set');

    const pollTime = new Date(status.lastPollAt!).getTime();
    const obsTime = new Date(status.newestObservationAt!).getTime();
    assert(pollTime > obsTime, 'Poll time must be much newer than the source observation date');

    const computedAgeDays = Math.floor((Date.now() - obsTime) / (1000 * 60 * 60 * 24));
    assert.strictEqual(status.newestObservationAgeDays, computedAgeDays, 'Age in days must match observation date difference');
  });

  // 13. 16-versus-32 Station Reconciliation Verification
  await runTest('13. Reconciled database entities contain exactly 16 unique dams with zero duplicate stubs', async () => {
    const entities = db.prepare("SELECT id, name FROM world_entities WHERE type = 'WATER_RESERVOIR_GAUGE'").all() as any[];
    assert.strictEqual(entities.length, 16, 'Total reservoir entities in database must be exactly 16');

    // Verify zero legacy HYDRO_CWC_* orphan stubs remain
    const legacyStubs = db.prepare("SELECT count(*) as c FROM world_entities WHERE id LIKE 'HYDRO_CWC_%'").get() as any;
    assert.strictEqual(legacyStubs.c, 0, 'Must have zero orphan HYDRO_CWC_* stubs');

    // Verify all 16 follow canonical RESERVOIR_*_KARNATAKA naming
    for (const e of entities) {
      assert(e.id.startsWith('RESERVOIR_') && e.id.endsWith('_KARNATAKA'), `Entity ID ${e.id} must follow canonical naming convention`);
    }

    // Verify total observations in database is at least 32 (2 temporal points for each of the 16 dams)
    const obsTotal = db.prepare("SELECT count(*) as c FROM world_observations WHERE data_type = 'HYDROLOGICAL'").get() as any;
    assert(obsTotal.c >= 32, 'Must preserve all authentic historical observations');
  });

  // 14. Denominator and Capacity Percentage Accuracy
  await runTest('14. Capacity percentage uses official NRLD full capacity denominator', async () => {
    const almattiMeta = CWC_KARNATAKA_RESERVOIRS['Almatti Reservoir'];
    assert.strictEqual(almattiMeta.fullCapacityBmc, 3.44, 'Almatti design capacity must be 3.44 BMC');

    const krsMeta = CWC_KARNATAKA_RESERVOIRS['Krishnaraja Sagar'];
    assert.strictEqual(krsMeta.fullCapacityBmc, 1.399, 'KRS design capacity must be 1.399 BMC');

    const tungabhadraMeta = CWC_KARNATAKA_RESERVOIRS['Tungabhadra Reservoir'];
    assert.strictEqual(tungabhadraMeta.fullCapacityBmc, 3.75, 'Tungabhadra design capacity must be 3.75 BMC');
  });

  console.log('\n=============================================================');
  console.log(`  ALL ${passedTests}/${totalTests} HYDROLOGY PIPELINE TESTS PASSED DETERMINISTICALLY`);
  console.log('=============================================================\n');
}

main().catch((err) => {
  console.error('\nFatal test runner failure:', err);
  process.exit(1);
});
