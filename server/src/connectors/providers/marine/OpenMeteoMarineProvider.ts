import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class OpenMeteoMarineProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'open_meteo_marine',
      name: 'Open-Meteo Marine API',
      category: 'MARINE',
      description: 'Ocean wave height, swell direction, sea surface temperature, and wave period.',
      coverage: 'global',
      coverageDetails: 'Global ocean coverage based on NOAA WaveWatch III and ECMWF WAM',
      updateFrequency: 'hourly',
      authentication: 'none',
      envKeyName: 'OPEN_METEO_API_KEY',
      endpointUrl: 'https://marine-api.open-meteo.com/v1/marine',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 300000,
        cacheTtlSeconds: 300,
      },
      legal: {
        license: 'CC BY 4.0',
        attribution: 'Marine data by Open-Meteo.com',
        commercialUse: 'allowed',
        commercialUseNotes: 'Attribution required',
        rateLimitTerms: '10,000 calls/day',
        termsUrl: 'https://open-meteo.com/en/terms',
      },
    };
    super(metadata);
  }

  public async fetch(params: { latitude?: number; longitude?: number } = {}): Promise<{ rawData: any; latencyMs: number }> {
    // Default to Indian Ocean / Arabian Sea offshore Mangalore/Chennai
    const lat = params.latitude ?? 13.0827;
    const lon = params.longitude ?? 80.2707;

    const cacheKey = `marine_${lat}_${lon}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    const url = `${this.metadata.endpointUrl}?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,wind_wave_height,ocean_current_velocity,ocean_current_direction&timezone=auto`;

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
      return [];
    }

    const lat = rawData.latitude;
    const lon = rawData.longitude;

    if (!this.isValidCoordinate(lat, lon)) {
      this.recordFailure(`Invalid marine coordinates: ${lat}, ${lon}`);
      return [];
    }

    const current = rawData.current;
    const buoyId = `BUOY_OFFSHORE_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;

    const observation: NormalizedObservation = {
      id: `obs_marine_${buoyId}_${Date.now()}`,
      entity_id: buoyId,
      entity_type: 'MARINE_BUOY',
      data_type: 'OCEANOGRAPHIC',
      value: {
        wave_height_m: current.wave_height,
        wave_direction_deg: current.wave_direction,
        wave_period_s: current.wave_period,
        wind_wave_height_m: current.wind_wave_height,
        ocean_current_velocity_ms: current.ocean_current_velocity,
        ocean_current_direction_deg: current.ocean_current_direction,
      },
      location: {
        latitude: lat,
        longitude: lon,
        country: 'Maritime Zone',
      },
      timestamp: new Date().toISOString(),
      observed_at: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
      source: this.metadata.endpointUrl,
      provider: this.metadata.id,
      confidence: 0.9,
      quality: 'VERIFIED',
      ttl: this.metadata.rateLimit.cacheTtlSeconds,
      provenance: {
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        endpoint: `/v1/marine?latitude=${lat}&longitude=${lon}`,
        retrievedAt: new Date().toISOString(),
        observedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
        originalId: `wavewatch_${lat}_${lon}`,
      },
      raw_payload: rawData,
    };

    this.recordSuccess(10, 1, 1, 0);
    return [observation];
  }
}
