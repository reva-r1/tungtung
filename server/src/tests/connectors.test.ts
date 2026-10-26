import { MockDataProvider } from '../connectors/providers/mock/MockDataProvider.js';
import { providerRegistry } from '../connectors/registry/ProviderRegistry.js';
import { worldModelService } from '../services/world_model/world_model.service.js';
import { simulationService } from '../services/simulation/simulation.service.js';
import { initDatabase } from '../db/database.js';
import { runWorldModelLogicTests } from './world_model_logic.test.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✘ [FAIL] ${name}: ${err.message}`);
  }
}

export async function runAllConnectorTests() {
  console.log('\n=============================================================');
  console.log('  RUNNING DATA CONNECTOR & WORLD MODEL VERIFICATION SUITE');
  console.log('=============================================================\n');

  initDatabase();

  // Test 1: Successful ingestion
  await runTest('1. Successful Ingestion & Normalization', async () => {
    const mock = new MockDataProvider('test_ingest_01');
    mock.setMode('NONE');
    const { rawData, latencyMs } = await mock.fetch();
    assert(latencyMs >= 0, 'Latency must be recorded');
    
    const observations = await mock.normalize(rawData);
    assert(observations.length === 1, 'Should normalize 1 observation');
    assert(observations[0].entity_id === 'SENSOR_TEST_RADAR_01', 'Entity ID mismatch');
    
    const ingestRes = worldModelService.ingestObservation(observations[0]);
    assert(ingestRes.entity.id === 'SENSOR_TEST_RADAR_01', 'World entity should be upserted');
    assert(mock.getHealth().status === 'HEALTHY', 'Provider should report HEALTHY');
  });

  // Test 2: Malformed response handling
  await runTest('2. Malformed Response Handling (Resilience)', async () => {
    const mock = new MockDataProvider('test_malformed_01');
    mock.setMode('MALFORMED_JSON');
    const { rawData } = await mock.fetch();
    const observations = await mock.normalize(rawData);
    assert(observations.length === 0, 'Malformed payload must produce 0 normalized records');
    assert(mock.getHealth().lastError !== null, 'Provider should record error');
  });

  // Test 3: Provider timeout & Circuit Breaker trip
  await runTest('3. Provider Timeout & Circuit Breaker', async () => {
    const mock = new MockDataProvider('test_timeout_01');
    mock.setMode('TIMEOUT');

    let errorCount = 0;
    for (let i = 0; i < 3; i++) {
      try {
        await mock.fetch();
      } catch (err) {
        errorCount++;
      }
    }
    assert(errorCount === 3, 'Must capture 3 timeouts');
    const health = mock.getHealth();
    assert(health.consecutiveFailures >= 3, 'Consecutive failures must be tracked');
    assert(health.status === 'CIRCUIT_OPEN', 'Circuit breaker must trip to OPEN after 3 failures');
  });

  // Test 4: Rate limit protection (429 handling & backoff)
  await runTest('4. Rate Limit 429 Protection', async () => {
    const mock = new MockDataProvider('test_ratelimit_01');
    mock.setMode('RATE_LIMIT_429');
    try {
      await mock.fetch();
      assert(false, 'Expected fetch to throw 429');
    } catch (err: any) {
      assert(err.message.includes('429'), 'Should capture 429 error');
      const health = mock.getHealth();
      assert(health.status === 'RATE_LIMITED' || Boolean(health.lastError?.includes('429')), 'Health should reflect rate limit');
    }
  });

  // Test 5: Missing coordinates rejection
  await runTest('5. Missing Coordinates Rejection', async () => {
    const mock = new MockDataProvider('test_missing_coords');
    mock.setMode('MISSING_COORDINATES');
    const { rawData } = await mock.fetch();
    const observations = await mock.normalize(rawData);
    assert(observations.length === 0, 'Missing coordinates must be rejected');
    assert(mock.getHealth().recordsRejected > 0, 'Rejected records counter must increment');
  });

  // Test 6: Invalid coordinates validation (latitude > 90 or longitude < -180)
  await runTest('6. Invalid Coordinate Validation (Boundary Bounds)', async () => {
    const mock = new MockDataProvider('test_invalid_coords');
    mock.setMode('INVALID_COORDINATES');
    const { rawData } = await mock.fetch();
    const observations = await mock.normalize(rawData);
    assert(observations.length === 0, 'Out-of-bound coords (lat 195.4) must be rejected');
    assert(mock.getHealth().recordsRejected > 0, 'Rejected counter must increment');
  });

  // Test 7: Duplicate observation idempotency
  await runTest('7. Duplicate Observation Idempotency', async () => {
    const mock = new MockDataProvider('test_duplicate_id');
    mock.setMode('NONE');
    const { rawData } = await mock.fetch();
    const observations = await mock.normalize(rawData);
    
    // Ingest first time
    const res1 = worldModelService.ingestObservation(observations[0]);
    // Ingest second time with exact same observation ID and values
    const res2 = worldModelService.ingestObservation(observations[0]);
    assert(res1.entity.id === res2.entity.id, 'Duplicate observation should cleanly upsert without database crash');
  });

  // Test 8: Out-of-order event preservation
  await runTest('8. Out-of-Order Event Temporal Preservation', async () => {
    const mock = new MockDataProvider('test_out_of_order');
    mock.setMode('OUT_OF_ORDER');
    const { rawData } = await mock.fetch();
    const observations = await mock.normalize(rawData);
    assert(observations.length === 1, 'Should normalize observation');
    
    const ingestRes = worldModelService.ingestObservation(observations[0]);
    assert(ingestRes.entity.id.includes('TEST_RADAR_01'), 'Entity should be updated with historical state');
  });

  // Test 9: Stale data detection
  await runTest('9. Stale Data Detection', async () => {
    const mock = new MockDataProvider('test_stale_data');
    mock.setMode('STALE_DATA');
    const { rawData } = await mock.fetch();
    const observations = await mock.normalize(rawData);
    const obsTime = new Date(observations[0].observed_at).getTime();
    const now = Date.now();
    const ageHours = (now - obsTime) / (3600 * 1000);
    assert(ageHours >= 24, 'Stale data (>24h old) correctly flagged');
  });

  // Test 10: Event detection triggers
  await runTest('10. Event Detection Triggers (Rain & Thresholds)', async () => {
    const mock = new MockDataProvider('test_event_detection');
    const testSensorId = `WEATHER_BLR_${Date.now()}`;

    // Step A: Baseline observation (clear skies, zero rain, normal AQI)
    mock.customPayload = {
      sensor_id: testSensorId,
      latitude: 12.9716,
      longitude: 77.5946,
      timestamp: new Date().toISOString(),
      temperature_c: 24.0,
      precipitation_mm: 0.0,
      us_aqi: 45,
      status: 'OPERATIONAL',
    };
    const { rawData: baseData } = await mock.fetch();
    const baseObs = await mock.normalize(baseData);
    baseObs[0].entity_type = 'WEATHER_STATION';
    worldModelService.ingestObservation(baseObs[0]);

    // Step B: Heavy storm crossing threshold
    mock.customPayload = {
      sensor_id: testSensorId,
      latitude: 12.9716,
      longitude: 77.5946,
      timestamp: new Date().toISOString(),
      temperature_c: 24.0,
      precipitation_mm: 22.5, // Exceeds heavy rainfall threshold of 15mm
      us_aqi: 165, // Exceeds unhealthy threshold of 150
      status: 'OPERATIONAL',
    };

    const { rawData } = await mock.fetch();
    const observations = await mock.normalize(rawData);
    observations[0].entity_type = 'WEATHER_STATION';
    const result = worldModelService.ingestObservation(observations[0]);
    
    assert(result.detectedEvents.length > 0, 'Must detect threshold event');
    const eventTypes = result.detectedEvents.map(e => e.event_type);
    assert(
      eventTypes.includes('RAINFALL_THRESHOLD_EXCEEDED') || eventTypes.includes('AQI_CROSSED_THRESHOLD'),
      'Must flag rainfall threshold exceeded event'
    );
  });

  // Test 11: Simulation Isolation (Crucial Requirement)
  await runTest('11. Simulation Mode State Isolation (Zero Live Contamination)', async () => {
    // 1. Ensure baseline live entity exists
    const testEntId = 'SIM_TEST_CORRIDOR_NH48';
    worldModelService.ingestObservation({
      id: `obs_live_${Date.now()}`,
      entity_id: testEntId,
      entity_type: 'ROAD_CORRIDOR',
      data_type: 'TRAFFIC_FLOW',
      value: { road_capacity: 100, rainfall_mm: 10, traffic: 'normal' },
      location: { latitude: 12.95, longitude: 77.60, city: 'Bangalore' },
      timestamp: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      source: 'test_engine',
      provider: 'test_provider',
      confidence: 1.0,
      quality: 'VERIFIED',
      ttl: 60,
      provenance: {
        source: 'test',
        provider: 'test',
        endpoint: '/test',
        retrievedAt: new Date().toISOString(),
        observedAt: new Date().toISOString(),
      },
    });

    const liveBefore = worldModelService.getEntityById(testEntId);
    assert(liveBefore.entity !== null, 'Live entity must exist');
    assert(liveBefore.entity?.current_state.rainfall_mm === 10, 'Live rainfall must be 10mm');
    assert(liveBefore.entity?.current_state.road_capacity === 100, 'Live capacity must be 100%');

    // 2. Create simulation clone
    const sim = simulationService.createSimulation('Flood Scenario Alpha', 'Isolated stress test');
    assert(sim.id.startsWith('sim_'), 'Simulation ID must be generated');

    // 3. Modify simulation variables
    simulationService.modifySimulation(sim.id, [
      {
        entity_id: testEntId,
        properties: {
          rainfall_mm: 85, // 85mm deluge
          road_capacity: 45, // 45% throttled
        },
      }
    ]);

    // 4. Verify simulation state reflects modified variables & cascading analysis
    const simState = simulationService.getSimulationState(sim.id);
    const simEntity = simState.entities.find(e => e.id === testEntId);
    assert(simEntity !== undefined, 'Simulated entity must exist in simulation state');
    assert(simEntity?.is_simulated === true, 'Entity must be tagged as simulated');
    assert(simEntity?.current_state.rainfall_mm === 85, 'Simulated rainfall must be 85mm');
    assert(simEntity?.current_state.road_capacity === 45, 'Simulated capacity must be 45%');
    assert(simState.cascading_events.length > 0, 'Cascading events must be simulated');

    // 5. CRITICAL VERIFICATION: Verify live entity was NOT changed!
    const liveAfter = worldModelService.getEntityById(testEntId);
    assert(liveAfter.entity?.current_state.rainfall_mm === 10, 'CRITICAL: Live rainfall must remain exactly 10mm');
    assert(liveAfter.entity?.current_state.road_capacity === 100, 'CRITICAL: Live road capacity must remain exactly 100%');

    // 6. Reset simulation
    simulationService.resetSimulation(sim.id);
    const simStateReset = simulationService.getSimulationState(sim.id);
    const simEntityReset = simStateReset.entities.find(e => e.id === testEntId);
    assert(simEntityReset?.current_state.rainfall_mm === 10, 'Reset simulation must revert to baseline');
  });

  // Execute Phase 3 World Model Logic Verification Suite
  await runWorldModelLogicTests();

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log('\n=============================================================');
  console.log(`  TEST RESULTS: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log('=============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (process.argv[1]?.includes('connectors.test')) {
  runAllConnectorTests().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  });
}
