import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class NationalGridEnergyProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'national_grid_energy',
      name: 'Grid Controller of India & KPTCL Load Despatch',
      category: 'ENERGY',
      description: 'Public electrical grid telemetry: grid frequency, state power demand, solar/wind generation, and transmission substation status.',
      coverage: 'state',
      coverageDetails: 'Southern Regional Grid and Karnataka Power Transmission Corporation (KPTCL)',
      updateFrequency: 'near_realtime',
      authentication: 'none',
      endpointUrl: 'https://grid-india.in/api/v1/grid-summary',
      rateLimit: {
        requestsPerMinute: 30,
        maxBurst: 5,
        backoffMs: 2000,
        pollIntervalMs: 300000,
        cacheTtlSeconds: 300,
      },
      legal: {
        license: 'Open Government Data (OGD)',
        attribution: 'Grid Controller of India Ltd. / KPTCL',
        commercialUse: 'allowed',
        commercialUseNotes: 'Civic transparency dataset',
        rateLimitTerms: 'Standard 5-minute interval',
        termsUrl: 'https://grid-india.in',
      },
    };
    super(metadata);
  }

  public async fetch(params: any = {}): Promise<{ rawData: any; latencyMs: number }> {
    const externalUrl = process.env.GRID_TELEMETRY_URL;
    if (externalUrl) {
      try {
        return await this.secureFetch(externalUrl, {}, 6000);
      } catch (err: any) {
        this.recordFailure(err.message);
        throw err;
      }
    }

    this.recordFailure('GRID_TELEMETRY_URL not configured');
    return { rawData: null, latencyMs: 0 };
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !Array.isArray(rawData.substations)) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const sub of rawData.substations) {
      const lat = sub.latitude;
      const lon = sub.longitude;

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `GRID_${sub.id}`;
      const observedAt = rawData.timestamp || new Date().toISOString();

      observations.push({
        id: `obs_energy_${sub.id}_${Date.now()}`,
        entity_id: entityId,
        entity_type: 'ENERGY_SUBSTATION',
        data_type: 'GRID_TELEMETRY',
        value: {
          substation_name: sub.name,
          demand_mw: sub.demand_mw,
          capacity_mw: sub.capacity_mw,
          load_pct: sub.transformer_load_pct,
          grid_frequency_hz: rawData.grid_frequency_hz,
          status: sub.status,
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
        ttl: 300,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/grid-summary',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: sub.id,
        },
        raw_payload: sub,
      });
    }

    this.recordSuccess(3, rawData.substations.length, observations.length, rejected);
    return observations;
  }
}
