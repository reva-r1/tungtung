import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class NASAEonetProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'nasa_eonet',
      name: 'NASA Earth Observatory Natural Event Tracker (EONET)',
      category: 'NATURAL_EVENTS',
      description: 'Curation of actively occurring natural hazard events (wildfires, severe storms, volcanoes, floods).',
      coverage: 'global',
      coverageDetails: 'Global natural hazard events sourced from USGS, NOAA, and international observatories',
      updateFrequency: 'hourly',
      authentication: 'none',
      endpointUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events',
      rateLimit: {
        requestsPerMinute: 30,
        maxBurst: 5,
        backoffMs: 3000,
        pollIntervalMs: 600000,
        cacheTtlSeconds: 600,
      },
      legal: {
        license: 'NASA Open Data Policy',
        attribution: 'NASA Earth Observatory Natural Event Tracker (EONET)',
        commercialUse: 'allowed',
        commercialUseNotes: 'Freely available for use in research, educational, and commercial applications',
        rateLimitTerms: 'Generous API rate limits; cache requests where possible',
        termsUrl: 'https://eonet.gsfc.nasa.gov/docs/v3',
      },
    };
    super(metadata);
  }

  public async fetch(params: { status?: 'open' | 'closed'; limit?: number } = {}): Promise<{ rawData: any; latencyMs: number }> {
    const status = params.status || 'open';
    const limit = params.limit || 20;
    const url = `${this.metadata.endpointUrl}?status=${status}&limit=${limit}`;

    const cacheKey = `nasa_eonet_${status}_${limit}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    try {
      const { data, latency } = await this.secureFetch(url, {}, 8000);
      this.setCached(cacheKey, data, this.metadata.rateLimit.cacheTtlSeconds);
      return { rawData: data, latencyMs: latency };
    } catch (err: any) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !Array.isArray(rawData.events)) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const event of rawData.events) {
      const geometry = Array.isArray(event.geometry) && event.geometry.length > 0
        ? event.geometry[event.geometry.length - 1] // most recent geometry point
        : null;

      if (!geometry || !geometry.coordinates) {
        rejected++;
        continue;
      }

      const lon = geometry.coordinates[0];
      const lat = geometry.coordinates[1];

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const category = event.categories?.[0]?.title || 'Natural Event';
      const observedAt = geometry.date ? new Date(geometry.date).toISOString() : new Date().toISOString();

      observations.push({
        id: `obs_eonet_${event.id}_${Date.now()}`,
        entity_id: `HAZARD_${event.id}`,
        entity_type: 'NATURAL_HAZARD',
        data_type: 'ENVIRONMENTAL_EVENT',
        value: {
          title: event.title,
          category,
          status: event.closed ? 'CLOSED' : 'OPEN',
          magnitude_value: geometry.magnitudeValue,
          magnitude_unit: geometry.magnitudeUnit,
          sources: event.sources?.map((s: any) => s.url) || [],
        },
        location: {
          latitude: lat,
          longitude: lon,
        },
        timestamp: new Date().toISOString(),
        observed_at: observedAt,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: 0.95,
        quality: 'VERIFIED',
        ttl: 1800,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/api/v3/events',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: event.id,
        },
        raw_payload: event,
      });
    }

    this.recordSuccess(20, rawData.events.length, observations.length, rejected);
    return observations;
  }
}
