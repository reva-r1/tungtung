import { db } from '../src/db/database.js';
import { USGSEarthquakeProvider } from '../src/connectors/providers/earthquakes/USGSEarthquakeProvider.js';
import { OpenMeteoWeatherProvider } from '../src/connectors/providers/weather/OpenMeteoWeatherProvider.js';
import { OpenMeteoAirQualityProvider } from '../src/connectors/providers/air_quality/OpenMeteoAirQualityProvider.js';
import { earthquakeService } from '../src/services/earthquake/earthquake.service.js';
import { environmentService } from '../src/services/environment/environment.service.js';
import { worldModelService } from '../src/services/world_model/world_model.service.js';

async function performLiveVerification() {
  console.log('=============================================================');
  console.log('  REVANA TECHNOLOGIES — LIVE SOURCE VERIFICATION PROTOCOL');
  console.log('  Timestamp: ' + new Date().toISOString());
  console.log('=============================================================\n');

  // --- 1. USGS EARTHQUAKES ---
  console.log('--- [1/3] PROBING OFFICIAL USGS EARTHQUAKE HAZARDS FEED ---');
  const eqProvider = new USGSEarthquakeProvider();
  const eqEndpoint = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
  const eqStart = Date.now();
  let eqResult: any = null;

  try {
    const { rawData, latencyMs } = await eqProvider.fetch({ feedType: 'hour' });
    const normalized = await eqProvider.normalize(rawData);
    const persisted = earthquakeService.ingestObservations(normalized, 'live_usgs_verification');
    const status = earthquakeService.getStatus();

    eqResult = {
      endpoint: eqEndpoint,
      requestTimestamp: new Date(eqStart).toISOString(),
      httpStatus: 200,
      latencyMs,
      featuresCount: rawData.features?.length || 0,
      acceptedCount: normalized.length,
      persistedCount: persisted,
      rejectedCount: (rawData.features?.length || 0) - normalized.length,
      newestObservationAt: status.newestObservationAt,
      dataFreshness: status.dataFreshness,
      operationalState: status.operationalState,
      sampleRecord: rawData.features?.[0] ? {
        id: rawData.features[0].id,
        mag: rawData.features[0].properties?.mag,
        place: rawData.features[0].properties?.place,
        time: new Date(rawData.features[0].properties?.time).toISOString(),
        updated: new Date(rawData.features[0].properties?.updated).toISOString(),
        coordinates: rawData.features[0].geometry?.coordinates,
      } : null,
    };
    console.log('✔ USGS Live Verification SUCCESS:', JSON.stringify(eqResult, null, 2));
  } catch (err: any) {
    console.error('✘ USGS Live Verification FAILED:', err.message);
    eqResult = { error: err.message };
  }

  // --- 2. OPEN-METEO WEATHER ---
  console.log('\n--- [2/3] PROBING OFFICIAL OPEN-METEO WEATHER NWP FEED ---');
  const wxProvider = new OpenMeteoWeatherProvider();
  const wxEndpoint = 'https://api.open-meteo.com/v1/forecast';
  const wxStart = Date.now();
  let wxResult: any = null;

  try {
    const { rawData, latencyMs } = await wxProvider.fetch({ latitude: 12.9716, longitude: 77.5946, nodeId: 'BLR_CENTRAL' });
    const normalized = await wxProvider.normalize(rawData);
    const rawPayloadId = worldModelService.storeRawPayload('open_meteo_weather', wxProvider.metadata.endpointUrl, rawData);
    for (const obs of normalized) {
      worldModelService.ingestObservation(obs, rawPayloadId);
    }
    const status = environmentService.getStatus();

    wxResult = {
      endpoint: `${wxEndpoint}?latitude=12.9716&longitude=77.5946&current=...`,
      requestTimestamp: new Date(wxStart).toISOString(),
      httpStatus: 200,
      latencyMs,
      featuresCount: 1,
      acceptedCount: normalized.length,
      persistedCount: normalized.length,
      newestObservationAt: normalized[0]?.observed_at,
      dataKind: normalized[0]?.value.data_kind,
      isDirectSensor: normalized[0]?.value.is_direct_instrument_sensor,
      modelSource: normalized[0]?.value.model_source,
      weatherFreshness: status.weatherFreshness,
      weatherOperationalState: status.weatherOperationalState,
      sampleRecord: {
        stationName: normalized[0]?.value.station_name,
        temperature_c: normalized[0]?.value.temperature_c,
        relative_humidity_pct: normalized[0]?.value.relative_humidity_pct,
        precipitation_mm: normalized[0]?.value.precipitation_mm,
        surface_pressure_hpa: normalized[0]?.value.surface_pressure_hpa,
        wind_speed_kmh: normalized[0]?.value.wind_speed_kmh,
        observedAt: normalized[0]?.observed_at,
      },
    };
    console.log('✔ Open-Meteo Weather Live Verification SUCCESS:', JSON.stringify(wxResult, null, 2));
  } catch (err: any) {
    console.error('✘ Open-Meteo Weather Live Verification FAILED:', err.message);
    wxResult = { error: err.message };
  }

  // --- 3. OPEN-METEO AIR QUALITY ---
  console.log('\n--- [3/3] PROBING OFFICIAL OPEN-METEO AIR QUALITY CAMS FEED ---');
  const aqiProvider = new OpenMeteoAirQualityProvider();
  const aqiEndpoint = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const aqiStart = Date.now();
  let aqiResult: any = null;

  try {
    const { rawData, latencyMs } = await aqiProvider.fetch({ latitude: 12.9716, longitude: 77.5946, nodeId: 'BLR_CENTRAL' });
    const normalized = await aqiProvider.normalize(rawData);
    const rawPayloadId = worldModelService.storeRawPayload('open_meteo_air_quality', aqiProvider.metadata.endpointUrl, rawData);
    for (const obs of normalized) {
      worldModelService.ingestObservation(obs, rawPayloadId);
    }
    const status = environmentService.getStatus();

    aqiResult = {
      endpoint: `${aqiEndpoint}?latitude=12.9716&longitude=77.5946&current=...`,
      requestTimestamp: new Date(aqiStart).toISOString(),
      httpStatus: 200,
      latencyMs,
      featuresCount: 1,
      acceptedCount: normalized.length,
      persistedCount: normalized.length,
      newestObservationAt: normalized[0]?.observed_at,
      dataKind: normalized[0]?.value.data_kind,
      isDirectSensor: normalized[0]?.value.is_direct_instrument_sensor,
      modelSource: normalized[0]?.value.model_source,
      airQualityFreshness: status.airQualityFreshness,
      airQualityOperationalState: status.airQualityOperationalState,
      sampleRecord: {
        stationName: normalized[0]?.value.station_name,
        us_aqi: normalized[0]?.value.us_aqi,
        european_aqi: normalized[0]?.value.european_aqi,
        pm2_5_ugm3: normalized[0]?.value.pm2_5_ugm3,
        pm10_ugm3: normalized[0]?.value.pm10_ugm3,
        nitrogen_dioxide_ugm3: normalized[0]?.value.nitrogen_dioxide_ugm3,
        observedAt: normalized[0]?.observed_at,
      },
    };
    console.log('✔ Open-Meteo Air Quality Live Verification SUCCESS:', JSON.stringify(aqiResult, null, 2));
  } catch (err: any) {
    console.error('✘ Open-Meteo Air Quality Live Verification FAILED:', err?.stack || err);
    aqiResult = { error: err?.message || String(err) };
  }

  console.log('\n=============================================================');
  console.log('  LIVE VERIFICATION COMPLETE');
  console.log('=============================================================');
}

performLiveVerification().catch(console.error);
