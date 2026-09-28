import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class OpenSkyProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'opensky_aviation',
      name: 'OpenSky Network Live Flight Tracking',
      category: 'AVIATION',
      description: 'Crowdsourced ADS-B and Mode S live flight state vectors.',
      coverage: 'global',
      coverageDetails: 'Worldwide coverage where OpenSky receiver network exists',
      updateFrequency: 'realtime',
      authentication: 'none',
      envKeyName: 'OPENSKY_CREDENTIALS',
      endpointUrl: 'https://opensky-network.org/api/states/all',
      rateLimit: {
        requestsPerMinute: 10, // Anonymous users: 10s limit
        maxBurst: 2,
        backoffMs: 5000,
        pollIntervalMs: 60000,
        cacheTtlSeconds: 15,
      },
      legal: {
        license: 'OpenSky Network Terms of Use (CC BY-NC-SA 4.0 for non-commercial)',
        attribution: 'Data provided by The OpenSky Network (https://opensky-network.org)',
        commercialUse: 'restricted',
        commercialUseNotes: 'Commercial use requires commercial licensing agreement with OpenSky',
        rateLimitTerms: 'Anonymous requests limited to 10s per request and 400 requests/day',
        termsUrl: 'https://opensky-network.org/about/terms-of-use',
      },
    };
    super(metadata);
  }

  public async fetch(params: { lamin?: number; lomin?: number; lamax?: number; lomax?: number } = {}): Promise<{ rawData: any; latencyMs: number }> {
    // Default bounding box: South India air corridor (Bangalore / Chennai / Hyderabad)
    const lamin = params.lamin ?? 11.5;
    const lomin = params.lomin ?? 76.0;
    const lamax = params.lamax ?? 14.5;
    const lomax = params.lomax ?? 79.5;

    const cacheKey = `opensky_${lamin}_${lomin}_${lamax}_${lomax}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    const url = `${this.metadata.endpointUrl}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

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
    if (!rawData || !Array.isArray(rawData.states)) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const state of rawData.states) {
      // OpenSky state vector format:
      // [0: icao24, 1: callsign, 2: origin_country, 3: time_position, 4: last_contact,
      //  5: longitude, 6: latitude, 7: baro_altitude, 8: on_ground, 9: velocity (m/s),
      //  10: true_track, 11: vertical_rate, 12: sensors, 13: geo_altitude, 14: squawk, 15: spi, 16: position_source]
      const icao24 = state[0];
      const callsign = (state[1] || '').trim();
      const originCountry = state[2];
      const lon = state[5];
      const lat = state[6];
      const baroAltitudeM = state[7];
      const onGround = Boolean(state[8]);
      const velocityMs = state[9];
      const trueTrackDeg = state[10];

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `AIRCRAFT_${icao24.toUpperCase()}`;
      const observedAt = state[3] ? new Date(state[3] * 1000).toISOString() : new Date().toISOString();

      observations.push({
        id: `obs_flight_${icao24}_${Date.now()}`,
        entity_id: entityId,
        entity_type: 'AIRCRAFT',
        data_type: 'TELEMETRY_FLIGHT',
        value: {
          icao24,
          callsign,
          origin_country: originCountry,
          speed_kmh: velocityMs ? Math.round(velocityMs * 3.6) : null,
          altitude_m: baroAltitudeM,
          heading_deg: trueTrackDeg,
          on_ground: onGround,
        },
        location: {
          latitude: lat,
          longitude: lon,
          altitudeM: baroAltitudeM,
          country: originCountry,
        },
        timestamp: new Date().toISOString(),
        observed_at: observedAt,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: 0.95,
        quality: 'VERIFIED',
        ttl: 30,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/api/states/all',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: icao24,
        },
        raw_payload: state,
      });
    }

    this.recordSuccess(12, rawData.states.length, observations.length, rejected);
    return observations;
  }
}
