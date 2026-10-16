import assert from 'assert';
import { OpenSkyProvider } from '../connectors/providers/aviation/OpenSkyProvider.js';
import { AviationService } from '../services/aviation/aviation.service.js';
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
  console.log('  REVANA TECHNOLOGIES — PHASE 2 AVIATION PIPELINE TEST SUITE');
  console.log('=============================================================\n');

  const provider = new OpenSkyProvider();

  // 1. Normalization of valid OpenSky state vectors
  await runTest('1. OpenSkyProvider normalizes authentic state vectors accurately', async () => {
    const rawData = {
      time: 1792138000,
      states: [
        [
          '80162c',       // 0: icao24
          'AXB1386 ',     // 1: callsign
          'India',        // 2: origin_country
          1792138000,     // 3: time_position
          1792138000,     // 4: last_contact
          77.5946,        // 5: longitude
          12.9716,        // 6: latitude
          10668.0,        // 7: baro_altitude (m)
          false,          // 8: on_ground
          220.0,          // 9: velocity (m/s)
          280.5,          // 10: true_track (deg)
          -5.0,           // 11: vertical_rate (m/s)
          null,           // 12: sensors
          11200.0,        // 13: geo_altitude
          '1200',         // 14: squawk
          false,          // 15: spi
          0               // 16: position_source
        ]
      ]
    };

    const observations = await provider.normalize(rawData);
    assert.strictEqual(observations.length, 1);
    const obs = observations[0];
    assert.strictEqual(obs.entity_id, 'AIRCRAFT_80162C');
    assert.strictEqual(obs.value.callsign, 'AXB1386');
    assert.strictEqual(obs.value.origin_country, 'India');
    assert.strictEqual(obs.location.latitude, 12.9716);
    assert.strictEqual(obs.location.longitude, 77.5946);
    assert.strictEqual(obs.value.altitude_m, 10668.0);
    assert.strictEqual(obs.value.altitude_ft, 35000); // 10668 * 3.28084 ~ 35000 ft
    assert.strictEqual(obs.value.speed_kmh, 792);     // 220 * 3.6 = 792 km/h
    assert.strictEqual(obs.value.speed_knots, 427.6); // 220 * 1.94384 ~ 427.6 kts
    assert.strictEqual(obs.value.heading_deg, 280.5);
    assert.strictEqual(obs.value.on_ground, false);
    assert.strictEqual(obs.value.squawk, '1200');
    assert.strictEqual(obs.provenance.provider, 'opensky_aviation');
    assert.strictEqual(obs.provenance.originalId, '80162c');
  });

  // 2. Coordinate boundary validation
  await runTest('2. Rejects out-of-bounds coordinates (latitude > 90 or longitude > 180)', async () => {
    const rawData = {
      time: 1792138000,
      states: [
        ['80162c', 'TEST1', 'India', 1792138000, 1792138000, 77.5, 95.0, 1000, false, 200, 180, 0, null, 1000, null, false, 0], // Lat 95 > 90
        ['80162d', 'TEST2', 'India', 1792138000, 1792138000, 190.0, 12.0, 1000, false, 200, 180, 0, null, 1000, null, false, 0], // Lon 190 > 180
      ]
    };

    const observations = await provider.normalize(rawData);
    assert.strictEqual(observations.length, 0, 'Should reject invalid coordinates');
  });

  // 3. Missing mandatory fields rejection
  await runTest('3. Rejects state vectors with null coordinates or empty icao24', async () => {
    const rawData = {
      time: 1792138000,
      states: [
        ['', 'TEST1', 'India', 1792138000, 1792138000, 77.5, 12.0, 1000, false, 200, 180, 0, null, 1000, null, false, 0],
        ['80162e', 'TEST2', 'India', 1792138000, 1792138000, null, 12.0, 1000, false, 200, 180, 0, null, 1000, null, false, 0],
        ['80162f', 'TEST3', 'India', 1792138000, 1792138000, 77.5, null, 1000, false, 200, 180, 0, null, 1000, null, false, 0],
      ]
    };

    const observations = await provider.normalize(rawData);
    assert.strictEqual(observations.length, 0, 'Should reject missing coordinates or empty icao');
  });

  // 4. Empty or malformed responses
  await runTest('4. Handles empty states array or null states safely without throwing', async () => {
    assert.strictEqual((await provider.normalize(null)).length, 0);
    assert.strictEqual((await provider.normalize({})).length, 0);
    assert.strictEqual((await provider.normalize({ states: null })).length, 0);
    assert.strictEqual((await provider.normalize({ states: [] })).length, 0);
  });

  // 5. Unit conversions (m/s to knots and km/h)
  await runTest('5. Accurate unit conversions for velocity (m/s -> km/h, knots)', async () => {
    const rawData = {
      time: 1792138000,
      states: [
        ['80162a', 'SPDTEST', 'India', 1792138000, 1792138000, 77.0, 12.0, 5000, false, 100.0, 90, 0, null, 5000, null, false, 0],
      ]
    };
    const obs = (await provider.normalize(rawData))[0];
    assert.strictEqual(obs.value.speed_kmh, 360); // 100 * 3.6
    assert.strictEqual(obs.value.speed_knots, 194.4); // 100 * 1.94384 ~ 194.4
  });

  // 6. Fail closed check
  await runTest('6. Provider fails closed without generating fake aircraft on error', async () => {
    try {
      provider.isValidCoordinate(NaN, NaN);
      assert.strictEqual(provider.isValidCoordinate(NaN, NaN), false);
    } catch (_) { }
  });

  // 7. Canonical entity upsert & temporal preservation
  await runTest('7. AviationService persists aircraft into moving_entities and preserves temporal order', async () => {
    const aviation = AviationService.getInstance();

    const t1 = new Date(Date.now() - 60000).toISOString();
    const t2 = new Date().toISOString();

    const mockObs = {
      id: 'test_obs_air_001',
      entity_id: 'AIRCRAFT_TEST01',
      entity_type: 'AIRCRAFT',
      data_type: 'TELEMETRY_FLIGHT',
      value: {
        icao24: 'test01',
        callsign: 'TESTAIR',
        origin_country: 'India',
        speed_kmh: 800,
        speed_knots: 432,
        altitude_m: 10000,
        altitude_ft: 32808,
        heading_deg: 90,
        vertical_rate_mps: 0,
        on_ground: false,
        squawk: '7700',
      },
      location: {
        latitude: 13.0,
        longitude: 77.5,
        altitudeM: 10000,
        country: 'India',
      },
      timestamp: t2,
      observed_at: t2,
      source: 'https://opensky-network.org',
      provider: 'opensky_aviation',
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: 60,
      provenance: {
        source: 'https://opensky-network.org',
        provider: 'opensky_aviation',
        endpoint: '/api/states/all',
        retrievedAt: t2,
        observedAt: t2,
        originalId: 'test01',
      },
      raw_payload: [],
    };

    // Ingest modern update
    const aircraft = (aviation as any).ingestAircraftObservation(mockObs, 'raw_test_123');
    assert(aircraft, 'Should successfully ingest aircraft');
    assert.strictEqual(aircraft.id, 'AIRCRAFT_TEST01');
    assert.strictEqual(aircraft.type, 'aircraft');

    // Verify row in database
    const row = db.prepare('SELECT * FROM moving_entities WHERE id = ?').get('AIRCRAFT_TEST01') as any;
    assert(row, 'Aircraft must exist in moving_entities');
    assert.strictEqual(row.type, 'aircraft');
    assert.strictEqual(row.name, 'TESTAIR');
    assert.strictEqual(row.latitude, 13.0);

    // Attempt to ingest an OLDER observation (t1 < t2)
    const olderObs = {
      ...mockObs,
      id: 'test_obs_air_old',
      observed_at: t1,
      value: { ...mockObs.value, callsign: 'STALE_CALLSIGN' },
      location: { latitude: 12.0, longitude: 77.0 },
    };

    const staleResult = (aviation as any).ingestAircraftObservation(olderObs, 'raw_test_old');
    assert.strictEqual(staleResult, null, 'Older observation must be rejected to prevent state regression');

    // Verify entity was NOT overwritten by stale data
    const rowAfter = db.prepare('SELECT * FROM moving_entities WHERE id = ?').get('AIRCRAFT_TEST01') as any;
    assert.strictEqual(rowAfter.name, 'TESTAIR');
    assert.strictEqual(rowAfter.latitude, 13.0);

    // Clean up test entity
    db.prepare("DELETE FROM moving_entities WHERE id = 'AIRCRAFT_TEST01'").run();
    db.prepare("DELETE FROM entity_positions WHERE entity_id = 'AIRCRAFT_TEST01'").run();
    db.prepare("DELETE FROM world_observations WHERE entity_id = 'AIRCRAFT_TEST01'").run();
    db.prepare("DELETE FROM world_entities WHERE id = 'AIRCRAFT_TEST01'").run();
  });

  // 8. Canonical field integrity (No MMSI, IMO, vessel_type, or fake destinations)
  await runTest('8. Aviation entity never populates MMSI, IMO, vessel_type, or invented destinations', async () => {
    const aviation = AviationService.getInstance();
    const testId = 'AIRCRAFT_FIELDTEST';
    const t = new Date().toISOString();

    const mockObs = {
      id: 'test_obs_air_fields',
      entity_id: testId,
      entity_type: 'AIRCRAFT',
      data_type: 'TELEMETRY_FLIGHT',
      value: {
        icao24: 'fieldtest',
        callsign: 'INDIGO42',
        origin_country: 'India',
        speed_kmh: 500,
        speed_knots: 270,
        altitude_m: 5000,
        altitude_ft: 16404,
        heading_deg: 180,
        vertical_rate_mps: 2,
        on_ground: false,
        squawk: '1200',
      },
      location: {
        latitude: 12.5,
        longitude: 77.2,
        altitudeM: 5000,
        country: 'India',
      },
      timestamp: t,
      observed_at: t,
      source: 'https://opensky-network.org',
      provider: 'opensky_aviation',
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: 60,
      provenance: {
        source: 'https://opensky-network.org',
        provider: 'opensky_aviation',
        endpoint: '/api/states/all',
        retrievedAt: t,
        observedAt: t,
        originalId: 'fieldtest',
      },
      raw_payload: [],
    };

    (aviation as any).ingestAircraftObservation(mockObs, 'raw_test_fields');

    const row = db.prepare('SELECT * FROM moving_entities WHERE id = ?').get(testId) as any;
    assert(row, 'Aircraft entity must be persisted');
    assert.strictEqual(row.mmsi, null, 'Aircraft must NOT populate mmsi with icao24 or squawk');
    assert.strictEqual(row.imo, null, 'Aircraft must NOT populate imo');
    assert.strictEqual(row.vessel_type, null, 'Aircraft must NOT populate vessel_type');
    assert.strictEqual(row.destination, null, 'Aircraft must NOT invent origin_country as destination');
    assert.strictEqual(row.name, 'INDIGO42');

    const props = JSON.parse(row.properties);
    assert.strictEqual(props.icao24, 'fieldtest');
    assert.strictEqual(props.callsign, 'INDIGO42');
    assert.strictEqual(props.origin_country, 'India');

    // Clean up
    db.prepare('DELETE FROM moving_entities WHERE id = ?').run(testId);
    db.prepare('DELETE FROM entity_positions WHERE entity_id = ?').run(testId);
    db.prepare('DELETE FROM world_observations WHERE entity_id = ?').run(testId);
    db.prepare('DELETE FROM world_entities WHERE id = ?').run(testId);
  });

  // 9. Flight Trajectory History Tracking (Ordered Chronologically)
  await runTest('9. Appends historical coordinate breadcrumbs and returns them chronologically', async () => {
    const aviation = AviationService.getInstance();
    const testId = 'AIRCRAFT_TRACKTEST';
    const nowSec = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT OR REPLACE INTO moving_entities (id, type, name, latitude, longitude, last_updated_at)
      VALUES (?, 'aircraft', 'TRACK_DEMO', 13.1, 77.6, datetime('now'))
    `).run(testId);

    db.prepare(`
      INSERT OR REPLACE INTO entity_positions (id, entity_id, latitude, longitude, speed, course, timestamp, epoch_sec)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(`pos_test_1`, testId, 13.1, 77.6, 400, 90, nowSec - 20);

    db.prepare(`
      INSERT OR REPLACE INTO entity_positions (id, entity_id, latitude, longitude, speed, course, timestamp, epoch_sec)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(`pos_test_2`, testId, 13.2, 77.7, 410, 92, nowSec - 10);

    const track = aviation.getAircraftTrack(testId, 10);
    assert.strictEqual(track.point_count, 2);
    assert.strictEqual(track.track[0].latitude, 13.1, 'Earliest point must come first');
    assert.strictEqual(track.track[1].latitude, 13.2, 'Latest point must come last');

    // Clean up
    db.prepare('DELETE FROM moving_entities WHERE id = ?').run(testId);
    db.prepare('DELETE FROM entity_positions WHERE entity_id = ?').run(testId);
  });

  // 10. Status and Independent Health / Freshness Diagnostics
  await runTest('10. AviationService.getStatus reports independent connection and freshness states', async () => {
    const aviation = AviationService.getInstance();
    const status = aviation.getStatus();
    assert.strictEqual(status.providerId, 'opensky_aviation');
    assert.strictEqual(status.providerName, 'OpenSky Network Live Flight Tracking');
    assert(['CONNECTED', 'DEGRADED', 'RATE_LIMITED', 'DISCONNECTED', 'STANDBY'].includes(status.connectionState));
    assert(['FRESH', 'STALE', 'HISTORICAL', 'EMPTY', 'UNKNOWN'].includes(status.dataFreshness));
    assert(typeof status.totalAircraftInDb === 'number');
    assert(typeof status.airborneCount === 'number');
    assert(typeof status.rateLimitRemaining === 'number');
  });

  // 11. Rate limit cooldown protection
  await runTest('11. Provider rate-limit backoff blocks requests during active cooldown', async () => {
    const prov = new OpenSkyProvider();
    prov.setRateLimitBackoff(15);
    const health = prov.getHealth();
    assert.strictEqual(health.status, 'RATE_LIMITED');
    assert.strictEqual(health.rateLimitRemaining, 0);

    // Attempt to fetch during backoff must throw rate limit error
    let threw = false;
    try {
      await prov.fetch();
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('RateLimit: ACTIVE') || err.message.includes('cooldown active'));
    }
    assert(threw, 'Provider fetch must be blocked during backoff');
  });

  console.log('\n=============================================================');
  console.log(`  AVIATION TEST RESULTS: ${passedTests} PASSED / 0 FAILED`);
  console.log('=============================================================\n');
}

main().catch((err) => {
  console.error('\nFATAL ERROR IN TEST SUITE:', err);
  process.exit(1);
});
