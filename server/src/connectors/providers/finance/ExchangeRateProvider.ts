import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class ExchangeRateProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'frankfurter_fx',
      name: 'Frankfurter Public Currency Reference Rates',
      category: 'FINANCE',
      description: 'Free & open exchange rate data published by the European Central Bank (ECB) without authentication.',
      coverage: 'global',
      coverageDetails: 'Major 30+ global currencies referenced to USD, EUR, INR, GBP, JPY',
      updateFrequency: 'daily',
      authentication: 'none',
      endpointUrl: 'https://api.frankfurter.app/latest',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 3600000,
        cacheTtlSeconds: 3600,
      },
      legal: {
        license: 'Open Data Commons Public Domain Dedication and License (PDDL)',
        attribution: 'European Central Bank (ECB) / Frankfurter',
        commercialUse: 'allowed',
        commercialUseNotes: 'Completely free for commercial and non-commercial use with no API key requirement',
        rateLimitTerms: 'Fair use policy',
        termsUrl: 'https://frankfurter.dev',
      },
    };
    super(metadata);
  }

  public async fetch(params: { base?: string; symbols?: string } = {}): Promise<{ rawData: any; latencyMs: number }> {
    const base = params.base || 'USD';
    const symbols = params.symbols || 'INR,EUR,GBP,AED,SGD';

    const cacheKey = `fx_${base}_${symbols}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 1 };
    }

    const url = `${this.metadata.endpointUrl}?from=${base}&to=${symbols}`;

    try {
      const { data, latency } = await this.secureFetch(url, {}, 6000);
      this.setCached(cacheKey, data, this.metadata.rateLimit.cacheTtlSeconds);
      return { rawData: data, latencyMs: latency };
    } catch (err: any) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !rawData.rates) {
      return [];
    }

    const base = rawData.base || 'USD';
    const rates = rawData.rates;
    const observedAt = rawData.date ? new Date(rawData.date).toISOString() : new Date().toISOString();

    const observation: NormalizedObservation = {
      id: `obs_fx_${base}_${Date.now()}`,
      entity_id: `FX_RATES_${base}`,
      entity_type: 'FINANCIAL_INDEX',
      data_type: 'FOREIGN_EXCHANGE',
      value: {
        base_currency: base,
        rates,
        inr_per_usd: rates.INR,
        eur_per_usd: rates.EUR,
      },
      location: {
        latitude: 12.9716, // Referenced to Bangalore financial dispatch hub
        longitude: 77.5946,
        city: 'Bangalore',
        country: 'India',
      },
      timestamp: new Date().toISOString(),
      observed_at: observedAt,
      source: this.metadata.endpointUrl,
      provider: this.metadata.id,
      confidence: 0.99,
      quality: 'VERIFIED',
      ttl: 3600,
      provenance: {
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        endpoint: `/latest?from=${base}`,
        retrievedAt: new Date().toISOString(),
        observedAt,
        originalId: `ecb_${rawData.date || 'today'}`,
      },
      raw_payload: rawData,
    };

    this.recordSuccess(10, 1, 1, 0);
    return [observation];
  }
}
