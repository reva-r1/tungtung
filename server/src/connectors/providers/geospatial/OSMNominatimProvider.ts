import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class OSMNominatimProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'osm_nominatim',
      name: 'OpenStreetMap / Nominatim Reverse Geocoding',
      category: 'GEOSPATIAL',
      description: 'OpenStreetMap search and reverse geocoding engine for physical infrastructure and administrative boundaries.',
      coverage: 'global',
      coverageDetails: 'Worldwide street, district, highway, and building level resolution',
      updateFrequency: 'daily',
      authentication: 'none',
      endpointUrl: 'https://nominatim.openstreetmap.org/reverse',
      rateLimit: {
        requestsPerMinute: 30, // Nominatim usage policy: max 1 request/sec
        maxBurst: 2,
        backoffMs: 3000,
        pollIntervalMs: 60000,
        cacheTtlSeconds: 86400, // 24hr cache for static geo entities
      },
      legal: {
        license: 'ODbL (Open Database License)',
        attribution: '© OpenStreetMap contributors',
        commercialUse: 'allowed',
        commercialUseNotes: 'Attribution required on any map or geocoded result',
        rateLimitTerms: 'Absolute maximum 1 request per second; valid User-Agent mandatory',
        termsUrl: 'https://operations.osmfoundation.org/policies/nominatim/',
      },
    };
    super(metadata);
  }

  public async fetch(params: { latitude?: number; longitude?: number } = {}): Promise<{ rawData: any; latencyMs: number }> {
    const lat = params.latitude ?? 12.9716;
    const lon = params.longitude ?? 77.5946;

    const cacheKey = `nominatim_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 1 };
    }

    const url = `${this.metadata.endpointUrl}?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1`;

    try {
      const { data, latency } = await this.secureFetch(url, {
        headers: {
          'User-Agent': 'Revana-WorldModel/2.0 (contact: ops@revana.io)',
        }
      }, 8000);
      this.setCached(cacheKey, data, this.metadata.rateLimit.cacheTtlSeconds);
      return { rawData: data, latencyMs: latency };
    } catch (err: any) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !rawData.lat || !rawData.lon) {
      return [];
    }

    const lat = parseFloat(rawData.lat);
    const lon = parseFloat(rawData.lon);

    if (!this.isValidCoordinate(lat, lon)) {
      this.recordFailure(`Invalid coordinate in Nominatim response: ${lat}, ${lon}`);
      return [];
    }

    const addr = rawData.address || {};
    const osmId = rawData.osm_id || `${Math.round(lat * 1000)}_${Math.round(lon * 1000)}`;
    const entityId = `GEO_${rawData.osm_type ? rawData.osm_type.toUpperCase() : 'NODE'}_${osmId}`;

    const observation: NormalizedObservation = {
      id: `obs_osm_${osmId}_${Date.now()}`,
      entity_id: entityId,
      entity_type: 'INFRASTRUCTURE_LOCATION',
      data_type: 'GEOSPATIAL_CONTEXT',
      value: {
        display_name: rawData.display_name,
        category: rawData.category,
        type: rawData.type,
        road: addr.road,
        suburb: addr.suburb || addr.neighbourhood,
        city: addr.city || addr.town || addr.county,
        district: addr.state_district || addr.county,
        state: addr.state,
        postcode: addr.postcode,
        country: addr.country,
        osm_type: rawData.osm_type,
      },
      location: {
        latitude: lat,
        longitude: lon,
        district: addr.state_district || addr.county,
        city: addr.city || addr.town,
        state: addr.state,
        country: addr.country,
      },
      timestamp: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      source: this.metadata.endpointUrl,
      provider: this.metadata.id,
      confidence: 0.99,
      quality: 'VERIFIED',
      ttl: 86400,
      provenance: {
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        endpoint: `/reverse?lat=${lat}&lon=${lon}`,
        retrievedAt: new Date().toISOString(),
        observedAt: new Date().toISOString(),
        originalId: String(rawData.place_id || osmId),
      },
      raw_payload: rawData,
    };

    this.recordSuccess(10, 1, 1, 0);
    return [observation];
  }
}
