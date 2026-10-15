import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class GTFSRealtimeProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'gtfs_transit',
      name: 'General Transit Feed Specification (GTFS-RT)',
      category: 'PUBLIC_TRANSPORT',
      description: 'Public transit vehicle positions, trip updates, and transit alerts.',
      coverage: 'city',
      coverageDetails: 'Metropolitan public transit bus & metro telemetry (e.g. Bangalore BMTC/Namma Metro corridor)',
      updateFrequency: 'realtime',
      authentication: 'none',
      envKeyName: 'TRANSIT_API_KEY',
      endpointUrl: 'https://transit.example.gov/gtfs-rt/vehicle-positions',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 30000,
        cacheTtlSeconds: 20,
      },
      legal: {
        license: 'Open Government Data License (OGDL)',
        attribution: 'Metropolitan Urban Transport Authority',
        commercialUse: 'allowed',
        commercialUseNotes: 'Permitted under Open Data Policy',
        rateLimitTerms: 'Up to 60 calls/minute',
        termsUrl: 'https://data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf',
      },
    };
    super(metadata);
  }

  public async fetch(params: { routeId?: string } = {}): Promise<{ rawData: any; latencyMs: number }> {
    // In production or when external GTFS URL is provided via ENV or params:
    const externalFeedUrl = process.env.GTFS_FEED_URL;
    if (externalFeedUrl) {
      try {
        return await this.secureFetch(externalFeedUrl, {}, 6000);
      } catch (err: any) {
        this.recordFailure(err.message);
        throw err;
      }
    }

    this.recordFailure('GTFS_FEED_URL not configured');
    return { rawData: null, latencyMs: 0 };
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !Array.isArray(rawData.entity)) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const item of rawData.entity) {
      const v = item.vehicle;
      if (!v || !v.position) {
        rejected++;
        continue;
      }

      const lat = v.position.latitude;
      const lon = v.position.longitude;

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `TRANSIT_${item.id}`;
      const observedAt = v.timestamp ? new Date(v.timestamp * 1000).toISOString() : new Date().toISOString();

      observations.push({
        id: `obs_transit_${item.id}_${Date.now()}`,
        entity_id: entityId,
        entity_type: 'TRANSIT_VEHICLE',
        data_type: 'TELEMETRY_TRANSIT',
        value: {
          route_id: v.trip?.route_id,
          trip_id: v.trip?.trip_id,
          speed_kmh: v.position.speed ? Math.round(v.position.speed * 3.6) : 0,
          bearing_deg: v.position.bearing,
          status: v.current_status,
          stop_id: v.stop_id,
          vehicle_label: v.vehicle?.label,
          congestion_level: v.congestion_level,
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
        confidence: 0.96,
        quality: 'VERIFIED',
        ttl: 30,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/gtfs-rt/vehicle-positions',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: item.id,
        },
        raw_payload: item,
      });
    }

    this.recordSuccess(5, rawData.entity.length, observations.length, rejected);
    return observations;
  }
}
