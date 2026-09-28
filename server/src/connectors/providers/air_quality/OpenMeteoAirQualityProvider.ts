import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

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

  public async fetch(params: { latitude?: number; longitude?: number } = {}): Promise<{ rawData: any; latencyMs: number }> {
    const lat = params.latitude ?? 12.9716;
    const lon = params.longitude ?? 77.5946;

    const cacheKey = `aqi_${lat}_${lon}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    const url = `${this.metadata.endpointUrl}?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi&timezone=auto`;

    try {
      const { data, latency } = await this.secureFetch(url, {}, 6000);
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
    const stationId = `AQI_SENSOR_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;

    const observation: NormalizedObservation = {
      id: `obs_aqi_${stationId}_${Date.now()}`,
      entity_id: stationId,
      entity_type: 'AIR_QUALITY_STATION',
      data_type: 'AIR_QUALITY',
      value: {
        us_aqi: current.us_aqi,
        european_aqi: current.european_aqi,
        pm2_5_ugm3: current.pm2_5,
        pm10_ugm3: current.pm10,
        nitrogen_dioxide_ugm3: current.nitrogen_dioxide,
        sulphur_dioxide_ugm3: current.sulphur_dioxide,
        ozone_ugm3: current.ozone,
        carbon_monoxide_ugm3: current.carbon_monoxide,
      },
      location: {
        latitude: lat,
        longitude: lon,
        city: 'Bangalore',
        state: 'Karnataka',
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
