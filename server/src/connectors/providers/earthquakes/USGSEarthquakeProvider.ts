import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class USGSEarthquakeProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'usgs_earthquake',
      name: 'USGS Earthquake Hazards Program',
      category: 'EARTHQUAKES',
      description: 'Real-time global seismic feeds and earthquake hazard monitoring.',
      coverage: 'global',
      coverageDetails: 'Worldwide seismic stations with M2.5+ hourly and daily summaries',
      updateFrequency: 'near_realtime',
      authentication: 'none',
      endpointUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 60000, // 1 min
        cacheTtlSeconds: 60,
      },
      legal: {
        license: 'Public Domain (USGS)',
        attribution: 'U.S. Geological Survey',
        commercialUse: 'allowed',
        commercialUseNotes: 'US Government public domain work, free for all uses',
        rateLimitTerms: 'No strict limit; be polite to servers',
        termsUrl: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
      },
    };
    super(metadata);
  }

  public async fetch(params: { feedType?: 'hour' | 'day' } = {}): Promise<{ rawData: any; latencyMs: number }> {
    const feed = params.feedType === 'day' ? 'all_day' : 'all_hour';
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`;

    const cacheKey = `usgs_eq_${feed}`;
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
    if (!rawData || !Array.isArray(rawData.features)) {
      this.recordFailure('Invalid USGS GeoJSON structure');
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const feature of rawData.features) {
      const props = feature.properties || {};
      const geom = feature.geometry || {};
      const coords = geom.coordinates || [];

      const lon = coords[0];
      const lat = coords[1];
      const depthKm = coords[2] ?? 0;

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `SEISMIC_EVENT_${feature.id || Math.round(lat * 1000) + '_' + Math.round(lon * 1000)}`;
      const observedAt = props.time ? new Date(props.time).toISOString() : new Date().toISOString();

      observations.push({
        id: `obs_eq_${feature.id || Date.now()}`,
        entity_id: entityId,
        entity_type: 'EARTHQUAKE_EPICENTER',
        data_type: 'SEISMIC',
        value: {
          magnitude: props.mag,
          magType: props.magType,
          depth_km: depthKm,
          place: props.place,
          status: props.status,
          tsunami_alert: props.tsunami,
          significance: props.sig,
          felt_reports: props.felt,
        },
        location: {
          latitude: lat,
          longitude: lon,
          altitudeM: -depthKm * 1000,
          city: props.place,
        },
        timestamp: new Date().toISOString(),
        observed_at: observedAt,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: props.status === 'reviewed' ? 0.98 : 0.8,
        quality: props.status === 'reviewed' ? 'VERIFIED' : 'PRELIMINARY',
        ttl: 3600,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/summary/all_hour.geojson',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: feature.id,
        },
        raw_payload: feature,
      });
    }

    this.recordSuccess(15, rawData.features.length, observations.length, rejected);
    return observations;
  }
}
