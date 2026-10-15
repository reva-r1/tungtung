import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class PublicWaterLevelProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'water_level_gauge',
      name: 'Central Water Commission & Basin Hydro-Telemetry',
      category: 'WATER',
      description: 'Public hydrological river gauge levels, reservoir storage percentages, and flood warning thresholds.',
      coverage: 'state',
      coverageDetails: 'Cauvery, Krishna, and Arkavathi river basins & urban lake catchments',
      updateFrequency: 'hourly',
      authentication: 'none',
      endpointUrl: 'https://waterwatch.gov.in/api/v1/telemetry',
      rateLimit: {
        requestsPerMinute: 30,
        maxBurst: 5,
        backoffMs: 2000,
        pollIntervalMs: 3600000,
        cacheTtlSeconds: 1800,
      },
      legal: {
        license: 'Open Government Data License',
        attribution: 'Central Water Commission / Karnataka State Natural Disaster Monitoring Centre',
        commercialUse: 'allowed',
        commercialUseNotes: 'Public safety and hydrological monitoring open feed',
        rateLimitTerms: 'Hourly polling permitted',
        termsUrl: 'https://cwc.gov.in',
      },
    };
    super(metadata);
  }

  public async fetch(params: any = {}): Promise<{ rawData: any; latencyMs: number }> {
    const externalUrl = process.env.WATER_GAUGE_URL;
    if (externalUrl) {
      try {
        return await this.secureFetch(externalUrl, {}, 6000);
      } catch (err: any) {
        this.recordFailure(err.message);
        throw err;
      }
    }

    this.recordFailure('WATER_GAUGE_URL not configured');
    return { rawData: null, latencyMs: 0 };
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !Array.isArray(rawData.stations)) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const station of rawData.stations) {
      const lat = station.latitude;
      const lon = station.longitude;

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `HYDRO_${station.id}`;
      const observedAt = rawData.timestamp || new Date().toISOString();

      observations.push({
        id: `obs_hydro_${station.id}_${Date.now()}`,
        entity_id: entityId,
        entity_type: 'WATER_GAUGE',
        data_type: 'HYDROLOGICAL',
        value: {
          station_name: station.name,
          river: station.river,
          basin: station.basin,
          water_level_m: station.water_level_m,
          danger_level_m: station.danger_level_m,
          discharge_cusecs: station.discharge_cusecs,
          status: station.status,
          capacity_pct: Math.round((station.water_level_m / station.max_level_m) * 100),
        },
        location: {
          latitude: lat,
          longitude: lon,
          state: 'Karnataka',
          country: 'India',
        },
        timestamp: new Date().toISOString(),
        observed_at: observedAt,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: 0.98,
        quality: 'VERIFIED',
        ttl: 3600,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/telemetry/water-level',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: station.id,
        },
        raw_payload: station,
      });
    }

    this.recordSuccess(3, rawData.stations.length, observations.length, rejected);
    return observations;
  }
}
