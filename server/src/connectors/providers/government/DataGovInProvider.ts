import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class DataGovInProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'data_gov_in',
      name: 'Open Government Data (OGD) Platform India',
      category: 'INDIA_GOVERNMENT',
      description: 'National and Karnataka State open public datasets covering commodity markets, reservoir levels, and public utilities.',
      coverage: 'country',
      coverageDetails: 'All India states with district level granularity for agricultural produce and reservoir storage',
      updateFrequency: 'daily',
      authentication: 'api_key',
      envKeyName: 'DATA_GOV_API_KEY',
      endpointUrl: 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
      rateLimit: {
        requestsPerMinute: 30,
        maxBurst: 5,
        backoffMs: 3000,
        pollIntervalMs: 86400000, // 24 hours
        cacheTtlSeconds: 3600,
      },
      legal: {
        license: 'Government Open Data License - India (GODL)',
        attribution: 'Open Government Data (OGD) Platform India / Ministry of Electronics & IT',
        commercialUse: 'allowed',
        commercialUseNotes: 'Users are permitted to use, adapt, and distribute the data with mandatory attribution',
        rateLimitTerms: 'Requires registered API key from data.gov.in',
        termsUrl: 'https://data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf',
      },
    };
    super(metadata);
  }

  public async fetch(params: { state?: string; district?: string } = {}): Promise<{ rawData: any; latencyMs: number }> {
    const apiKey = process.env.DATA_GOV_API_KEY;

    // If API key is present in environment, query live data.gov.in endpoint
    if (apiKey) {
      const url = `${this.metadata.endpointUrl}?api-key=${apiKey}&format=json&limit=10&filters%5Bstate%5D=Karnataka`;
      try {
        const { data, latency } = await this.secureFetch(url, {}, 8000);
        return { rawData: data, latencyMs: latency };
      } catch (err: any) {
        this.recordFailure(err.message);
        throw err;
      }
    }

    this.recordFailure('DATA_GOV_API_KEY not configured');
    return { rawData: null, latencyMs: 0 };
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData) {
      return [];
    }
    const records = rawData.records || rawData.data || [];
    if (!Array.isArray(records) || records.length === 0) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const rec of records) {
      const lat = rec.latitude;
      const lon = rec.longitude;

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `GOV_MARKET_${rec.market.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
      const observedAt = rec.reported_date ? new Date(rec.reported_date).toISOString() : new Date().toISOString();

      observations.push({
        id: `obs_gov_${entityId}_${Date.now()}`,
        entity_id: entityId,
        entity_type: 'CIVIC_INFRASTRUCTURE',
        data_type: 'GOVERNMENT_OPEN_DATA',
        value: {
          facility_name: rec.market,
          commodity: rec.commodity,
          modal_price_inr_quintal: rec.modal_price_inr_quintal,
          arrivals_tonnes: rec.arrivals_tonnes,
        },
        location: {
          latitude: lat,
          longitude: lon,
          district: rec.district,
          state: rec.state,
          country: 'India',
        },
        timestamp: new Date().toISOString(),
        observed_at: observedAt,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: 0.99,
        quality: 'VERIFIED',
        ttl: 86400,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/resource/agricultural-inflows',
          retrievedAt: new Date().toISOString(),
          observedAt,
          originalId: rec.market,
        },
        raw_payload: rec,
      });
    }

    this.recordSuccess(5, records.length, observations.length, rejected);
    return observations;
  }
}
