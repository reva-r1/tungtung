import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class GBFSProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'gbfs_mobility',
      name: 'General Bikeshare Feed Specification (GBFS)',
      category: 'MOBILITY',
      description: 'Standardized micro-mobility telemetry for shared bicycles, electric bikes, and mobility hubs.',
      coverage: 'city',
      coverageDetails: 'Urban mobility hubs, docked stations, and active fleet availability',
      updateFrequency: 'near_realtime',
      authentication: 'none',
      endpointUrl: 'https://gbfs.example.com/gbfs/2.3/station_status.json',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 60000,
        cacheTtlSeconds: 60,
      },
      legal: {
        license: 'NABSA Open GBFS Specification',
        attribution: 'North American Bikeshare Association / Urban Mobility Open Data',
        commercialUse: 'allowed',
        commercialUseNotes: 'Standardized open specification for civic mobility interoperability',
        rateLimitTerms: 'Provider specific rate limits',
        termsUrl: 'https://github.com/NABSA/gbfs',
      },
    };
    super(metadata);
  }

  public async fetch(params: any = {}): Promise<{ rawData: any; latencyMs: number }> {
    const externalUrl = process.env.GBFS_FEED_URL;
    if (externalUrl) {
      try {
        return await this.secureFetch(externalUrl, {}, 6000);
      } catch (err: any) {
        this.recordFailure(err.message);
        throw err;
      }
    }

    this.recordFailure('GBFS_FEED_URL not configured');
    return { rawData: null, latencyMs: 0 };
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !rawData.data || !Array.isArray(rawData.data.stations)) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const station of rawData.data.stations) {
      const lat = station.lat;
      const lon = station.lon;

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `MOBILITY_HUB_${station.station_id}`;
      const observedAt = rawData.last_updated ? new Date(rawData.last_updated * 1000).toISOString() : new Date().toISOString();

      observations.push({
        id: `obs_gbfs_${station.station_id}_${Date.now()}`,
        entity_id: entityId,
        entity_type: 'MOBILITY_HUB',
        data_type: 'MICRO_MOBILITY',
        value: {
          station_name: station.name,
          bikes_available: station.num_bikes_available,
          ebikes_available: station.num_ebikes_available,
          docks_available: station.num_docks_available,
          is_renting: Boolean(station.is_renting),
          is_returning: Boolean(station.is_returning),
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
        confidence: 0.98,
        quality: 'VERIFIED',
        ttl: 60,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/gbfs/2.3/station_status.json',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: station.station_id,
        },
        raw_payload: station,
      });
    }

    this.recordSuccess(4, rawData.data.stations.length, observations.length, rejected);
    return observations;
  }
}
