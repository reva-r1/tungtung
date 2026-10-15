import { DataProvider } from '../base/DataProvider.js';
import { ProviderMetadata, ProviderHealthMetrics } from '../base/types.js';
import { OpenMeteoWeatherProvider } from '../providers/weather/OpenMeteoWeatherProvider.js';
import { OpenMeteoAirQualityProvider } from '../providers/air_quality/OpenMeteoAirQualityProvider.js';
import { OpenMeteoMarineProvider } from '../providers/marine/OpenMeteoMarineProvider.js';
import { USGSEarthquakeProvider } from '../providers/earthquakes/USGSEarthquakeProvider.js';
import { NASAEonetProvider } from '../providers/natural_events/NASAEonetProvider.js';
import { OSMNominatimProvider } from '../providers/geospatial/OSMNominatimProvider.js';
import { OpenSkyProvider } from '../providers/aviation/OpenSkyProvider.js';
import { GTFSRealtimeProvider } from '../providers/transit/GTFSRealtimeProvider.js';
import { GBFSProvider } from '../providers/mobility/GBFSProvider.js';
import { DataGovInProvider } from '../providers/government/DataGovInProvider.js';
import { PublicWaterLevelProvider } from '../providers/water/PublicWaterLevelProvider.js';
import { NationalGridEnergyProvider } from '../providers/energy/NationalGridEnergyProvider.js';
import { ExchangeRateProvider } from '../providers/finance/ExchangeRateProvider.js';
import { PublicFeedProvider } from '../providers/news/PublicFeedProvider.js';

export interface ProviderStatusSummary {
  id: string;
  name: string;
  category: string;
  coverage: string;
  update_frequency: string;
  authentication: string;
  commercial_use: string;
  rate_limit: any;
  legal: any;
  health: ProviderHealthMetrics;
}

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, DataProvider> = new Map();
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  private registerDefaults(): void {
    this.register(new OpenMeteoWeatherProvider());
    this.register(new OpenMeteoAirQualityProvider());
    this.register(new OpenMeteoMarineProvider());
    this.register(new USGSEarthquakeProvider());
    this.register(new NASAEonetProvider());
    this.register(new OSMNominatimProvider());
    this.register(new OpenSkyProvider());
    this.register(new GTFSRealtimeProvider());
    this.register(new GBFSProvider());
    this.register(new DataGovInProvider());
    this.register(new PublicWaterLevelProvider());
    this.register(new NationalGridEnergyProvider());
    this.register(new ExchangeRateProvider());
    this.register(new PublicFeedProvider());
  }

  public register(provider: DataProvider): void {
    if (process.env.NODE_ENV === 'production' && (provider.category === 'MOCK' || provider.id.includes('mock'))) {
      throw new Error(`[Security Violation] Mock provider "${provider.id}" cannot be registered in production runtime.`);
    }
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): DataProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders(): DataProvider[] {
    return Array.from(this.providers.values());
  }

  public getProvidersByCategory(category: string): DataProvider[] {
    return this.getAllProviders().filter(p => p.category === category);
  }

  /**
   * Health and Observability matrix
   */
  public getStatusMatrix(): ProviderStatusSummary[] {
    return this.getAllProviders().map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      coverage: p.metadata.coverage,
      update_frequency: p.metadata.updateFrequency,
      authentication: p.metadata.authentication,
      commercial_use: p.metadata.legal.commercialUse,
      rate_limit: p.metadata.rateLimit,
      legal: p.metadata.legal,
      health: p.getHealth(),
    }));
  }

  public async runHealthChecks(): Promise<Record<string, ProviderHealthMetrics>> {
    const results: Record<string, ProviderHealthMetrics> = {};
    for (const [id, provider] of this.providers.entries()) {
      results[id] = await provider.health_check();
    }
    return results;
  }

  /**
   * Safe fetch and normalize with telemetry
   */
  public async ingestFromProvider(id: string, params: any = {}): Promise<any[]> {
    const provider = this.getProvider(id);
    if (!provider) {
      throw new Error(`Provider not found: ${id}`);
    }

    const { rawData } = await provider.fetch(params);
    return await provider.normalize(rawData);
  }
}

export const providerRegistry = ProviderRegistry.getInstance();
