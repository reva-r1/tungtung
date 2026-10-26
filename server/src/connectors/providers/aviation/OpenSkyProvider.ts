import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';
import https from 'https';
import { URL } from 'url';

export interface OpenSkyBoundingBox {
  lamin?: number;
  lomin?: number;
  lamax?: number;
  lomax?: number;
}

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
        requestsPerMinute: 10, // Anonymous users: 10s limit; Authenticated: 5s
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

  /**
   * Resilient HTTP GET using IPv4 to avoid Node Undici connect timeouts on Windows
   */
  private resilientGet(url: string, headers: Record<string, string>, timeoutMs: number = 8000): Promise<{ data: any; latency: number }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const parsedUrl = new URL(url);

      const req = https.request(
        parsedUrl,
        {
          method: 'GET',
          family: 4, // Force IPv4 resolution
          headers: {
            'User-Agent': 'Revana-WorldModel/2.0',
            'Accept': 'application/json',
            ...headers,
          },
          timeout: timeoutMs,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            const latency = Date.now() - startTime;
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(body);
                resolve({ data: parsed, latency });
              } catch (_) {
                resolve({ data: body, latency });
              }
            } else if (res.statusCode === 429) {
              // Parse Retry-After header if provided
              const retryAfterHeader = res.headers['retry-after'];
              let retryAfterSec = 60;
              if (retryAfterHeader) {
                const parsed = parseInt(Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader, 10);
                if (!isNaN(parsed) && parsed > 0) {
                  retryAfterSec = Math.min(parsed, 300);
                }
              }
              this.setRateLimitBackoff(retryAfterSec);
              reject(new Error(`Provider returned 429 Too Many Requests (Retry-After: ${retryAfterSec}s)`));
            } else if (res.statusCode === 401 || res.statusCode === 403) {
              reject(new Error(`OpenSky Authentication Error (HTTP ${res.statusCode}): Invalid credentials or unauthorized`));
            } else if (res.statusCode && res.statusCode >= 500) {
              reject(new Error(`OpenSky Provider Outage (HTTP ${res.statusCode}): ${res.statusMessage || 'Server Error'}`));
            } else {
              reject(new Error(`HTTP Error ${res.statusCode}: ${res.statusMessage || 'Bad Request'}`));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  /**
   * Set explicit rate limit backoff epoch from provider feedback
   */
  public setRateLimitBackoff(seconds: number): void {
    this.health.status = 'RATE_LIMITED';
    this.health.rateLimitRemaining = 0;
    this.health.rateLimitResetEpoch = Math.floor(Date.now() / 1000) + seconds;
    this.health.lastError = `Rate limited by OpenSky (HTTP 429). Retry after ${seconds}s`;
  }

  public async fetch(params: OpenSkyBoundingBox = {}): Promise<{ rawData: any; latencyMs: number }> {
    // Default bounding box: South India air corridor (Bengaluru, Chennai, Hyderabad airspace)
    const lamin = params.lamin ?? Number(process.env.OPENSKY_BBOX_LAMIN ?? 11.0);
    const lomin = params.lomin ?? Number(process.env.OPENSKY_BBOX_LOMIN ?? 75.5);
    const lamax = params.lamax ?? Number(process.env.OPENSKY_BBOX_LAMAX ?? 15.0);
    const lomax = params.lomax ?? Number(process.env.OPENSKY_BBOX_LOMAX ?? 80.0);

    const cacheKey = `opensky_${lamin}_${lomin}_${lamax}_${lomax}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    if (this.isCircuitOpen()) {
      throw new Error(`[CircuitBreaker: OPEN] Provider ${this.metadata.id} is temporarily blocked due to repeated failures.`);
    }

    // Check if active rate limit backoff epoch is in the future
    const nowSec = Math.floor(Date.now() / 1000);
    if (this.health.rateLimitResetEpoch && nowSec < this.health.rateLimitResetEpoch) {
      const waitSec = this.health.rateLimitResetEpoch - nowSec;
      throw new Error(`[RateLimit: ACTIVE] OpenSky rate limit cooldown active. ${waitSec}s remaining before next request.`);
    }

    if (!this.checkRateLimit()) {
      throw new Error(`[RateLimit: EXCEEDED] Provider ${this.metadata.id} rate limit exceeded. Backing off.`);
    }

    const url = `${this.metadata.endpointUrl}?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    // Optional OpenSky Basic Auth credentials
    const headers: Record<string, string> = {};
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;
    const credentials = process.env.OPENSKY_CREDENTIALS;

    if (username && password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    } else if (credentials && credentials.includes(':')) {
      headers['Authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
    }

    try {
      const { data, latency } = await this.resilientGet(url, headers, 8000);
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
      const icao24 = typeof state[0] === 'string' ? state[0].trim().toLowerCase() : '';
      if (!icao24) {
        rejected++;
        continue;
      }

      const callsign = typeof state[1] === 'string' ? state[1].trim() : '';
      const originCountry = state[2] || 'Unknown';
      const lon = state[5];
      const lat = state[6];
      const baroAltitudeM = state[7] != null ? Number(state[7]) : null;
      const onGround = Boolean(state[8]);
      const velocityMs = state[9] != null ? Number(state[9]) : null;
      const trueTrackDeg = state[10] != null ? Number(state[10]) : null;
      const verticalRateMs = state[11] != null ? Number(state[11]) : null;
      const geoAltitudeM = state[13] != null ? Number(state[13]) : null;
      const squawk = state[14] ? String(state[14]).trim() : null;

      // Coordinate boundary check
      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `AIRCRAFT_${icao24.toUpperCase()}`;
      const observedAt = state[3] ? new Date(state[3] * 1000).toISOString() : (state[4] ? new Date(state[4] * 1000).toISOString() : new Date().toISOString());

      const speedKmh = velocityMs !== null ? Math.round(velocityMs * 3.6) : null;
      const speedKnots = velocityMs !== null ? Math.round(velocityMs * 1.94384 * 10) / 10 : null;
      const altitudeFt = baroAltitudeM !== null ? Math.round(baroAltitudeM * 3.28084) : null;

      observations.push({
        id: `obs_flight_${icao24}_${state[3] || Date.now()}`,
        entity_id: entityId,
        entity_type: 'AIRCRAFT',
        data_type: 'TELEMETRY_FLIGHT',
        value: {
          icao24,
          callsign: callsign ? callsign : null,
          origin_country: originCountry,
          speed_mps: velocityMs,
          speed_kmh: speedKmh,
          speed_knots: speedKnots,
          altitude_m: baroAltitudeM,
          altitude_ft: altitudeFt,
          geo_altitude_m: geoAltitudeM,
          heading_deg: trueTrackDeg,
          vertical_rate_mps: verticalRateMs,
          on_ground: onGround,
          squawk,
        },
        location: {
          latitude: Number(lat),
          longitude: Number(lon),
          altitudeM: baroAltitudeM ?? undefined,
          country: originCountry,
        },
        timestamp: new Date().toISOString(),
        observed_at: observedAt,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: 0.95,
        quality: 'VERIFIED',
        ttl: 45,
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

    this.recordSuccess(15, rawData.states.length, observations.length, rejected);
    return observations;
  }
}
