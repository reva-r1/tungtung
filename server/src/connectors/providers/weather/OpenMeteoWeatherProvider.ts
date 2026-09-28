import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class OpenMeteoWeatherProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'open_meteo_weather',
      name: 'Open-Meteo Weather API',
      category: 'WEATHER',
      description: 'Open-access weather forecast, current conditions and precipitation telemetry.',
      coverage: 'global',
      coverageDetails: 'Worldwide numerical weather prediction models (ECMWF, GFS, ICON)',
      updateFrequency: 'hourly',
      authentication: 'none',
      envKeyName: 'OPEN_METEO_API_KEY',
      endpointUrl: 'https://api.open-meteo.com/v1/forecast',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 300000, // 5 mins
        cacheTtlSeconds: 300,
      },
      legal: {
        license: 'CC BY 4.0',
        attribution: 'Weather data by Open-Meteo.com under CC BY 4.0',
        commercialUse: 'allowed',
        commercialUseNotes: 'Free for non-commercial and commercial use with attribution up to 10,000 daily calls',
        rateLimitTerms: 'Max 10,000 requests/day, 60 calls/minute',
        termsUrl: 'https://open-meteo.com/en/terms',
      },
    };
    super(metadata);
  }

  public async fetch(params: { latitude?: number; longitude?: number } = {}): Promise<{ rawData: any; latencyMs: number }> {
    const lat = params.latitude ?? 12.9716; // Default to Bangalore center
    const lon = params.longitude ?? 77.5946;

    const cacheKey = `weather_${lat}_${lon}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    const url = `${this.metadata.endpointUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability&timezone=auto`;

    try {
      const { data, latency } = await this.secureFetch(url, {}, 12000);
      this.setCached(cacheKey, data, this.metadata.rateLimit.cacheTtlSeconds);
      return { rawData: data, latencyMs: latency };
    } catch (err: any) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !rawData.current) {
      this.recordFailure('Missing current conditions in Open-Meteo payload');
      return [];
    }

    const lat = rawData.latitude;
    const lon = rawData.longitude;

    if (!this.isValidCoordinate(lat, lon)) {
      this.recordFailure(`Invalid coordinates received: ${lat}, ${lon}`);
      return [];
    }

    const current = rawData.current;
    const observedAt = current.time ? new Date(current.time).toISOString() : new Date().toISOString();
    const stationId = `STATION_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;

    const observation: NormalizedObservation = {
      id: `obs_meteo_${stationId}_${Date.now()}`,
      entity_id: stationId,
      entity_type: 'WEATHER_STATION',
      data_type: 'METEOROLOGICAL',
      value: {
        temperature_c: current.temperature_2m,
        relative_humidity_pct: current.relative_humidity_2m,
        precipitation_mm: current.precipitation ?? current.rain ?? 0,
        surface_pressure_hpa: current.surface_pressure,
        wind_speed_kmh: current.wind_speed_10m,
        wind_direction_deg: current.wind_direction_10m,
        weather_code: current.weather_code,
        elevation: rawData.elevation,
      },
      location: {
        latitude: lat,
        longitude: lon,
        altitudeM: rawData.elevation,
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
      },
      timestamp: new Date().toISOString(),
      observed_at: observedAt,
      source: this.metadata.endpointUrl,
      provider: this.metadata.id,
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: this.metadata.rateLimit.cacheTtlSeconds,
      provenance: {
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        endpoint: `/v1/forecast?latitude=${lat}&longitude=${lon}`,
        retrievedAt: new Date().toISOString(),
        observedAt,
        originalId: `open_meteo_${lat}_${lon}`,
      },
      raw_payload: rawData,
    };

    this.recordSuccess(10, 1, 1, 0);
    return [observation];
  }
}
