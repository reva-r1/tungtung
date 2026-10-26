import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export type MockFailureMode = 
  | 'NONE'
  | 'TIMEOUT'
  | 'RATE_LIMIT_429'
  | 'MALFORMED_JSON'
  | 'MISSING_COORDINATES'
  | 'INVALID_COORDINATES'
  | 'SCHEMA_DRIFT'
  | 'OUT_OF_ORDER'
  | 'STALE_DATA'
  | 'DUPLICATE_EVENTS';

export class MockDataProvider extends DataProvider {
  public failureMode: MockFailureMode = 'NONE';
  public customPayload: any = null;

  constructor(customId: string = 'mock_provider') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Security Violation] MockDataProvider is strictly forbidden in production runtime.');
    }
    const metadata: ProviderMetadata = {
      id: customId,
      name: 'Deterministic Test Mock Sensor',
      category: 'MOCK',
      description: 'Configurable test harness for verifying fault tolerance, backoff, and schema validation.',
      coverage: 'city',
      coverageDetails: 'Simulated local sandbox grid',
      updateFrequency: 'realtime',
      authentication: 'none',
      endpointUrl: 'mock://internal/sensor/stream',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 5,
        backoffMs: 1000,
        pollIntervalMs: 5000,
        cacheTtlSeconds: 10,
      },
      legal: {
        license: 'MIT',
        attribution: 'Internal Revana Test Engine',
        commercialUse: 'allowed',
        commercialUseNotes: 'Unrestricted test provider',
        termsUrl: 'https://example.com/terms',
      },
    };
    super(metadata);
  }

  public setMode(mode: MockFailureMode): void {
    this.failureMode = mode;
  }

  public async fetch(params: any = {}): Promise<{ rawData: any; latencyMs: number }> {
    if (this.failureMode === 'TIMEOUT') {
      this.recordFailure('Request timeout after 5000ms');
      throw new Error('Request timeout after 5000ms');
    }

    if (this.failureMode === 'RATE_LIMIT_429') {
      this.recordFailure('Provider returned 429 Too Many Requests');
      throw new Error('Provider returned 429 Too Many Requests');
    }

    if (this.failureMode === 'MALFORMED_JSON') {
      return { rawData: '{{{{INVALID_JSON_STREAM%%%%', latencyMs: 5 };
    }

    if (this.customPayload) {
      return { rawData: this.customPayload, latencyMs: 5 };
    }

    // Default valid mock payload
    const now = new Date();
    const data = {
      sensor_id: 'TEST_RADAR_01',
      latitude: 12.9716,
      longitude: 77.5946,
      timestamp: now.toISOString(),
      temperature_c: 26.5,
      precipitation_mm: 5.0,
      status: 'OPERATIONAL',
    };

    if (this.failureMode === 'MISSING_COORDINATES') {
      delete (data as any).latitude;
      delete (data as any).longitude;
    } else if (this.failureMode === 'INVALID_COORDINATES') {
      data.latitude = 195.4; // Latitude > 90 is invalid!
      data.longitude = -240.2; // Longitude < -180 is invalid!
    } else if (this.failureMode === 'OUT_OF_ORDER') {
      // 5 hours in the past
      data.timestamp = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    } else if (this.failureMode === 'STALE_DATA') {
      // 3 days in the past
      data.timestamp = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    }

    return { rawData: data, latencyMs: 5 };
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (typeof rawData === 'string') {
      try {
        rawData = JSON.parse(rawData);
      } catch (err: any) {
        this.recordFailure('Malformed payload: failed to parse JSON');
        return [];
      }
    }

    if (!rawData) {
      return [];
    }

    const lat = rawData.latitude;
    const lon = rawData.longitude;

    if (!this.isValidCoordinate(lat, lon)) {
      this.health.recordsRejected++;
      this.recordFailure(`Rejected invalid coordinate: lat=${lat}, lon=${lon}`);
      return [];
    }

    const observation: NormalizedObservation = {
      id: `obs_mock_${rawData.sensor_id}_${rawData.timestamp}`,
      entity_id: `SENSOR_${rawData.sensor_id}`,
      entity_type: 'ENVIRONMENTAL_SENSOR',
      data_type: 'TELEMETRY_MOCK',
      value: {
        temperature_c: rawData.temperature_c,
        precipitation_mm: rawData.precipitation_mm,
        status: rawData.status,
        ...rawData,
      },
      location: {
        latitude: lat,
        longitude: lon,
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
      },
      timestamp: new Date().toISOString(),
      observed_at: rawData.timestamp,
      source: this.metadata.endpointUrl,
      provider: this.metadata.id,
      confidence: 1.0,
      quality: 'VERIFIED',
      ttl: 60,
      provenance: {
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        endpoint: '/sensor/stream',
        retrievedAt: new Date().toISOString(),
        observedAt: rawData.timestamp,
        originalId: rawData.sensor_id,
      },
      raw_payload: rawData,
    };

    this.recordSuccess(5, 1, 1, 0);
    return [observation];
  }
}
