import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';
import { OPERATIONAL_WEATHER_NODES, WeatherLocationConfig } from '../weather/OpenMeteoWeatherProvider.js';

export class OpenMeteoAirQualityProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'open_meteo_air_quality',
      name: 'Open-Meteo Air Quality API',
      category: 'AIR_QUALITY',
      description: 'Atmospheric pollutant tracking (PM2.5, PM10, NO2, SO2, O3, European AQI, US AQI).',
      coverage: 'global',
      coverageDetails: 'Worldwide CAMS (Copernicus Atmosphere Monitoring Service) global forecasting',
      updateFrequency: 'hourly',
      authentication: 'none',
      envKeyName: 'OPEN_METEO_API_KEY',
      endpointUrl: 'https://air-quality-api.open-meteo.com/v1/air-quality',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 300000,
        cacheTtlSeconds: 300,
      },
      legal: {
        license: 'CC BY 4.0',
        attribution: 'Contains modified Copernicus Atmosphere Monitoring Service information (2026)',
        commercialUse: 'allowed',
        commercialUseNotes: 'Attribution required for Copernicus and Open-Meteo',
        rateLimitTerms: 'Up to 10,000 calls/day free tier',
        termsUrl: 'https://open-meteo.com/en/terms',
      },
    };
    super(metadata);
  }

  public async fetch(params: { latitude?: number; longitude?: number; nodeId?: string } = {}): Promise<{ rawData: any; latencyMs: number }> {
    let lat = params.latitude;
    let lon = params.longitude;

    if (params.nodeId) {
      const found = OPERATIONAL_WEATHER_NODES.find(n => n.id === params.nodeId);
      if (found) {
        lat = found.latitude;
        lon = found.longitude;
      }
    }

    if (lat === undefined || lon === undefined) {
      lat = 12.9716;
      lon = 77.5946;
    }

    const cacheKey = `aqi_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    const url = `${this.metadata.endpointUrl}?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi&timezone=auto`;

    try {
      const { data, latency } = await this.secureFetch(url, {}, 15000);
      this.setCached(cacheKey, data, this.metadata.rateLimit.cacheTtlSeconds);
      return { rawData: data, latencyMs: latency };
    } catch (err: any) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !rawData.current) {
      this.recordFailure('Missing current AQI records in Open-Meteo payload');
      return [];
    }

    const lat = rawData.latitude;
    const lon = rawData.longitude;

    if (!this.isValidCoordinate(lat, lon)) {
      this.recordFailure(`Invalid coordinates for AQI station: ${lat}, ${lon}`);
      return [];
    }

    const current = rawData.current;
    const observedAt = current.time ? new Date(current.time).toISOString() : new Date().toISOString();

    const matchedNode = OPERATIONAL_WEATHER_NODES.find(n => 
      Math.abs(n.latitude - lat) < 0.15 && Math.abs(n.longitude - lon) < 0.15
    );

    const stationId = matchedNode ? `AQI_NODE_${matchedNode.id}` : `AQI_SENSOR_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;
    const stationName = matchedNode ? `${matchedNode.name.split(' ')[0]} Air Quality Monitoring` : `AQI Station (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    const cityName = matchedNode ? matchedNode.name.split(' ')[0] : 'Regional Station';
    const stateName = matchedNode?.state || 'India';
    const districtName = matchedNode?.district || cityName;

    const obsId = `obs_aqi_${stationId}_${observedAt.replace(/[:.]/g, '_')}`;

    const observation: NormalizedObservation = {
      id: obsId,
      entity_id: stationId,
      entity_type: 'AIR_QUALITY_STATION',
      data_type: 'AIR_QUALITY',
      value: {
        station_name: stationName,
        us_aqi: typeof current.us_aqi === 'number' ? current.us_aqi : null,
        european_aqi: typeof current.european_aqi === 'number' ? current.european_aqi : null,
        pm2_5_ugm3: typeof current.pm2_5 === 'number' ? current.pm2_5 : null,
        pm10_ugm3: typeof current.pm10 === 'number' ? current.pm10 : null,
        nitrogen_dioxide_ugm3: typeof current.nitrogen_dioxide === 'number' ? current.nitrogen_dioxide : null,
        sulphur_dioxide_ugm3: typeof current.sulphur_dioxide === 'number' ? current.sulphur_dioxide : null,
        ozone_ugm3: typeof current.ozone === 'number' ? current.ozone : null,
        carbon_monoxide_ugm3: typeof current.carbon_monoxide === 'number' ? current.carbon_monoxide : null,
        model_source: 'COPERNICUS_CAMS_GLOBAL',
        data_kind: 'ATMOSPHERIC_MODEL_ESTIMATE',
        is_direct_instrument_sensor: false,
        attribution_warning: 'Copernicus Atmosphere Monitoring Service (CAMS) model estimate; not a direct regulatory CPCB physical ground sensor reading.',
      },
      location: {
        latitude: lat,
        longitude: lon,
        city: cityName,
        district: districtName,
        state: stateName,
        country: 'India',
      },
      timestamp: new Date().toISOString(),
      observed_at: observedAt,
      source: this.metadata.endpointUrl,
      provider: this.metadata.id,
      confidence: 0.92,
      quality: 'VERIFIED',
      ttl: this.metadata.rateLimit.cacheTtlSeconds,
      provenance: {
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        endpoint: `/v1/air-quality?latitude=${lat}&longitude=${lon}`,
        retrievedAt: new Date().toISOString(),
        observedAt,
        originalId: `cams_aqi_${lat}_${lon}`,
      },
      raw_payload: rawData,
    };

    this.recordSuccess(10, 1, 1, 0);
    return [observation];
  }
}
