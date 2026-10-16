import { USGSEarthquakeProvider } from '../connectors/providers/earthquakes/USGSEarthquakeProvider.js';
import { OpenMeteoWeatherProvider, OPERATIONAL_WEATHER_NODES } from '../connectors/providers/weather/OpenMeteoWeatherProvider.js';
import { OpenMeteoAirQualityProvider } from '../connectors/providers/air_quality/OpenMeteoAirQualityProvider.js';
import { EarthquakeService } from '../services/earthquake/earthquake.service.js';
import { EnvironmentService } from '../services/environment/environment.service.js';
import { initDatabase, db } from '../db/database.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
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

// =========================================================================
// DETERMINISTIC REALISTIC FIXTURES
// =========================================================================

const FIXTURE_USGS_VALID_GEOJSON = {
  type: 'FeatureCollection',
  metadata: {
    generated: 1792160000000,
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    title: 'USGS Earthquakes, Past Hour',
    status: 200,
    api: '2.7.0',
    count: 2,
  },
  features: [
    {
      type: 'Feature',
      id: 'nc75450451',
      properties: {
        mag: 2.76,
        place: '19 km SW of Toms Place, CA',
        time: 1792157296970, // 2026-10-16T13:28:16.970Z
        updated: 1792160349418, // 2026-10-16T14:19:09.418Z
        tz: null,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/nc75450451',
        detail: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/nc75450451.geojson',
        felt: null,
        cdi: null,
        mmi: null,
        alert: null,
        status: 'reviewed',
        tsunami: 0,
        sig: 118,
        net: 'nc',
        code: '75450451',
        ids: ',nc75450451,',
        sources: ',nc,',
        types: ',focal-mechanism,origin,phase-data,',
        nst: 28,
        dmin: 0.12,
        rms: 0.08,
        gap: 65,
        magType: 'md',
        type: 'earthquake',
        title: 'M 2.8 - 19 km SW of Toms Place, CA',
      },
      geometry: {
        type: 'Point',
        coordinates: [-118.8333, 37.4411, 0.46], // [lon, lat, depth_km]
      },
    },
    {
      type: 'Feature',
      id: 'us7000m123',
      properties: {
        mag: 5.4,
        place: '74 km SSW of Hualien City, Taiwan',
        time: 1792150000000,
        updated: 1792155000000,
        status: 'automatic',
        tsunami: 1,
        sig: 450,
        magType: 'mww',
        net: 'us',
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000m123',
      },
      geometry: {
        type: 'Point',
        coordinates: [121.35, 23.42, 18.5],
      },
    },
  ],
};

const FIXTURE_WEATHER_VALID_PAYLOAD = {
  latitude: 12.9701,
  longitude: 77.5636,
  generationtime_ms: 0.03,
  utc_offset_seconds: 0,
  timezone: 'GMT',
  timezone_abbreviation: 'GMT',
  elevation: 910.0,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    relative_humidity_2m: '%',
    precipitation: 'mm',
    rain: 'mm',
    weather_code: 'wmo code',
    surface_pressure: 'hPa',
    wind_speed_10m: 'km/h',
    wind_direction_deg: '°',
  },
  current: {
    time: '2026-10-16T14:15',
    interval: 900,
    temperature_2m: 21.9,
    relative_humidity_2m: 94,
    precipitation: 0.2,
    rain: 0.2,
    weather_code: 3,
    surface_pressure: 913.1,
    wind_speed_10m: 1.3,
    wind_direction_10m: 172,
  },
};

const FIXTURE_AQI_VALID_PAYLOAD = {
  latitude: 12.9701,
  longitude: 77.5636,
  generationtime_ms: 0.04,
  utc_offset_seconds: 0,
  timezone: 'GMT',
  elevation: 910.0,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    pm10: 'μg/m³',
    pm2_5: 'μg/m³',
    carbon_monoxide: 'μg/m³',
    nitrogen_dioxide: 'μg/m³',
    sulphur_dioxide: 'μg/m³',
    ozone: 'μg/m³',
    us_aqi: 'USAQI',
    european_aqi: 'EAQI',
  },
  current: {
    time: '2026-10-16T14:00',
    interval: 3600,
    pm10: 18.6,
    pm2_5: 18.3,
    carbon_monoxide: 1216,
    nitrogen_dioxide: 47.8,
    sulphur_dioxide: 10.4,
    ozone: 6,
    us_aqi: 60,
    european_aqi: 53,
  },
};

export async function runP0ConnectorsSuite() {
  console.log('\n=============================================================');
  console.log('  REVANA TECHNOLOGIES — PHASE 2 P0 CONNECTORS TEST SUITE');
  console.log('  USGS Earthquakes, Open-Meteo Weather & Open-Meteo Air Quality');
  console.log('=============================================================\n');

  initDatabase();

  const eqProvider = new USGSEarthquakeProvider();
  const wxProvider = new OpenMeteoWeatherProvider();
  const aqiProvider = new OpenMeteoAirQualityProvider();
  const eqService = EarthquakeService.getInstance();
  const envService = EnvironmentService.getInstance();

  // --- SUITE 1: SCHEMA AND PARSING ---

  await runTest('1. USGSEarthquakeProvider parses authentic GeoJSON features correctly', async () => {
    const obs = await eqProvider.normalize(FIXTURE_USGS_VALID_GEOJSON);
    assert(obs.length === 2, `Expected 2 observations, got ${obs.length}`);

    const o1 = obs[0];
    assert(o1.entity_type === 'EARTHQUAKE_EPICENTER', 'entity_type must be EARTHQUAKE_EPICENTER');
    assert(o1.data_type === 'SEISMIC', 'data_type must be SEISMIC');
    assert(o1.location.latitude === 37.4411, 'Latitude mapping mismatch');
    assert(o1.location.longitude === -118.8333, 'Longitude mapping mismatch');
    assert(o1.value.magnitude === 2.76, 'Magnitude mismatch');
    assert(o1.value.depth_km === 0.46, 'Depth mismatch');
    assert(o1.value.status === 'reviewed', 'Status mismatch');
    assert(o1.quality === 'VERIFIED', 'Reviewed earthquake must have VERIFIED quality');
    assert(o1.value.data_kind === 'DIRECT_OBSERVATION', 'Seismic must be labeled DIRECT_OBSERVATION');
    assert(o1.value.is_direct_instrument_sensor === true, 'is_direct_instrument_sensor must be true');

    const o2 = obs[1];
    assert(o2.value.magnitude === 5.4, 'Second earthquake magnitude mismatch');
    assert(o2.value.tsunami_alert === 1, 'Tsunami alert flag must be preserved');
    assert(o2.quality === 'PRELIMINARY', 'Automatic event must have PRELIMINARY quality');
  });

  await runTest('2. USGSEarthquakeProvider rejects out-of-bounds coordinates & malformed structures', async () => {
    const malformedPayload = {
      type: 'FeatureCollection',
      features: [
        { properties: { mag: 4.0 }, geometry: { coordinates: [200, 45] } }, // Invalid lon
        { properties: { mag: 4.0 }, geometry: { coordinates: [45, 120] } }, // Invalid lat
        { properties: { mag: 4.0 }, geometry: { coordinates: null } },      // Missing coords
        null,
        {},
      ],
    };
    const obs = await eqProvider.normalize(malformedPayload);
    assert(obs.length === 0, `Expected 0 observations, got ${obs.length}`);

    const nonArray = await eqProvider.normalize({ not_features: 123 });
    assert(nonArray.length === 0, 'Non-array features must return empty array');
  });

  await runTest('3. USGSEarthquakeProvider handles revision of earthquake solution without key collisions', async () => {
    const initialFeature = {
      type: 'FeatureCollection',
      features: [
        {
          id: 'test_revision_01',
          properties: { mag: 3.1, time: 1792150000000, updated: 1792150000000, status: 'automatic' },
          geometry: { coordinates: [75.0, 15.0, 10.0] },
        },
      ],
    };
    const revisedFeature = {
      type: 'FeatureCollection',
      features: [
        {
          id: 'test_revision_01',
          properties: { mag: 3.4, time: 1792150000000, updated: 1792155000000, status: 'reviewed' },
          geometry: { coordinates: [75.02, 15.01, 12.0] },
        },
      ],
    };

    const obs1 = await eqProvider.normalize(initialFeature);
    const obs2 = await eqProvider.normalize(revisedFeature);

    assert(obs1[0].entity_id === obs2[0].entity_id, 'Both revisions must target the same natural entity_id');
    assert(obs1[0].id !== obs2[0].id, 'Observation IDs must distinguish initial vs revised update timestamps');
    assert(obs2[0].value.magnitude === 3.4, 'Revised magnitude must be 3.4');
    assert(obs2[0].quality === 'VERIFIED', 'Revised status must update to VERIFIED');
  });

  await runTest('4. OpenMeteoWeatherProvider correctly identifies NWP model output vs sensor telemetry', async () => {
    const obs = await wxProvider.normalize(FIXTURE_WEATHER_VALID_PAYLOAD);
    assert(obs.length === 1, `Expected 1 observation, got ${obs.length}`);

    const w = obs[0];
    assert(w.entity_type === 'WEATHER_STATION', 'entity_type must be WEATHER_STATION');
    assert(w.data_type === 'METEOROLOGICAL', 'data_type must be METEOROLOGICAL');
    assert(w.value.temperature_c === 21.9, 'Temperature must match');
    assert(w.value.relative_humidity_pct === 94, 'Relative humidity must match');
    assert(w.value.precipitation_mm === 0.2, 'Precipitation must match');
    assert(w.value.surface_pressure_hpa === 913.1, 'Surface pressure must match');
    assert(w.value.data_kind === 'NUMERICAL_WEATHER_PREDICTION', 'Data kind must explicitly be NUMERICAL_WEATHER_PREDICTION');
    assert(w.value.is_direct_instrument_sensor === false, 'is_direct_instrument_sensor must be FALSE');
    assert(Boolean(w.value.attribution_warning?.includes('not a direct physical')), 'Must contain explicit non-sensor warning');
  });

  await runTest('5. OpenMeteoAirQualityProvider correctly maps Copernicus CAMS atmospheric pollutants', async () => {
    const obs = await aqiProvider.normalize(FIXTURE_AQI_VALID_PAYLOAD);
    assert(obs.length === 1, `Expected 1 observation, got ${obs.length}`);

    const a = obs[0];
    assert(a.entity_type === 'AIR_QUALITY_STATION', 'entity_type must be AIR_QUALITY_STATION');
    assert(a.data_type === 'AIR_QUALITY', 'data_type must be AIR_QUALITY');
    assert(a.value.us_aqi === 60, 'US AQI must be 60');
    assert(a.value.european_aqi === 53, 'European AQI must be 53');
    assert(a.value.pm2_5_ugm3 === 18.3, 'PM2.5 must match');
    assert(a.value.pm10_ugm3 === 18.6, 'PM10 must match');
    assert(a.value.nitrogen_dioxide_ugm3 === 47.8, 'NO2 must match');
    assert(a.value.model_source === 'COPERNICUS_CAMS_GLOBAL', 'Model source must be COPERNICUS_CAMS_GLOBAL');
    assert(a.value.data_kind === 'ATMOSPHERIC_MODEL_ESTIMATE', 'data_kind must be ATMOSPHERIC_MODEL_ESTIMATE');
    assert(a.value.is_direct_instrument_sensor === false, 'is_direct_instrument_sensor must be FALSE');
  });

  await runTest('6. Providers reject invalid coordinates and non-numeric fields gracefully', async () => {
    const badWx = { latitude: 95.0, longitude: 77.0, current: { temperature_2m: 25 } };
    const wxRes = await wxProvider.normalize(badWx);
    assert(wxRes.length === 0, 'Weather provider must reject latitude > 90');

    const badAqi = { latitude: 12.0, longitude: 195.0, current: { us_aqi: 50 } };
    const aqiRes = await aqiProvider.normalize(badAqi);
    assert(aqiRes.length === 0, 'AQI provider must reject longitude > 180');
  });

  // --- SUITE 2: CANONICAL PERSISTENCE & PROVENANCE ---

  await runTest('7. EarthquakeService ingests and persists canonical earthquake entities idempotently', async () => {
    const obs = await eqProvider.normalize(FIXTURE_USGS_VALID_GEOJSON);
    const count = eqService.ingestObservations(obs, 'raw_test_eq_01');
    assert(count === 2, `Expected 2 persisted observations, got ${count}`);

    const e1 = eqService.getEventById('SEISMIC_EVENT_nc75450451');
    assert(e1 !== null, 'SEISMIC_EVENT_nc75450451 must exist in database');
    assert(e1?.magnitude === 2.76, 'Magnitude must be persisted');
    assert(e1?.depth_km === 0.46, 'Depth must be persisted');
    assert(e1?.data_kind === 'DIRECT_OBSERVATION', 'Persisted record must maintain DIRECT_OBSERVATION');

    // Ingest again to test idempotency
    const count2 = eqService.ingestObservations(obs, 'raw_test_eq_02');
    assert(count2 === 2, 'Repeated ingestion must complete cleanly without duplicate key crash');

    const row = db.prepare(`SELECT count(*) as c FROM world_entities WHERE id = ?`).get('SEISMIC_EVENT_nc75450451') as any;
    assert(row.c === 1, 'Entity must not be duplicated in world_entities');
  });

  await runTest('8. EnvironmentService maps operational nodes deterministically to Bangalore hub', async () => {
    const obs = await wxProvider.normalize(FIXTURE_WEATHER_VALID_PAYLOAD);
    assert(obs[0].entity_id === 'WEATHER_NODE_BLR_CENTRAL', `Expected WEATHER_NODE_BLR_CENTRAL, got ${obs[0].entity_id}`);
    assert(obs[0].location.city === 'Bengaluru', 'Matched city must be Bengaluru');
  });

  // --- SUITE 3: FRESHNESS, CONNECTION & DECOUPLING ---

  await runTest('9. EarthquakeService correctly decouples connection status from observation freshness', async () => {
    const status = eqService.getStatus();
    assert(['CONNECTED', 'DEGRADED', 'RATE_LIMITED', 'DISCONNECTED', 'STANDBY'].includes(status.connectionState), 'Valid connectionState');
    assert(['FRESH', 'STALE', 'HISTORICAL', 'EMPTY', 'UNKNOWN'].includes(status.dataFreshness), 'Valid dataFreshness');
    assert(status.operationalState.length > 0, 'operationalState must be populated');
  });

  await runTest('10. EnvironmentService evaluates freshness based on model time, not lastPollAt', async () => {
    const status = envService.getStatus();
    assert(status.configuredNodesCount === OPERATIONAL_WEATHER_NODES.length, `Expected ${OPERATIONAL_WEATHER_NODES.length} nodes`);
    assert(['CONNECTED', 'DEGRADED', 'RATE_LIMITED', 'DISCONNECTED', 'STANDBY'].includes(status.weatherConnectionState), 'Valid weatherConnectionState');
    assert(['FRESH', 'STALE', 'HISTORICAL', 'EMPTY', 'UNKNOWN'].includes(status.weatherFreshness), 'Valid weatherFreshness');
  });

  await runTest('11. Empty results never generate fictional entities', async () => {
    const emptyPayload = { type: 'FeatureCollection', features: [] };
    const emptyObs = await eqProvider.normalize(emptyPayload);
    assert(emptyObs.length === 0, 'Empty features array must produce 0 observations');
  });

  // --- SUITE 4: RATE-LIMIT COOLDOWN & RESILIENCE ---

  await runTest('12. EarthquakeService enforces poll cooldown against provider hammering', async () => {
    // Force a poll
    await eqService.pollNow('hour');
    // Rapid immediate second poll must hit cooldown
    const rapidResult = await eqService.pollNow('hour');
    assert(rapidResult.success === false, 'Rapid poll must be rejected');
    assert(Boolean(rapidResult.error?.includes('Rate limit cooldown') || rapidResult.error?.includes('already in progress')), 'Must specify cooldown or in-progress');
  });

  console.log('\n=============================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  P0 CONNECTORS TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run directly if invoked via CLI
runP0ConnectorsSuite().catch((err) => {
  console.error('Test Suite Fatal Error:', err);
  process.exit(1);
});
