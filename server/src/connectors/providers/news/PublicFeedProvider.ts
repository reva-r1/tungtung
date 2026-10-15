import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export class PublicFeedProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'gdacs_civic_alerts',
      name: 'Global Disaster Alert and Coordination System (GDACS)',
      category: 'NEWS_EVENTS',
      description: 'UN and European Commission multi-hazard disaster alerts and impact assessments.',
      coverage: 'global',
      coverageDetails: 'Worldwide tropical cyclones, floods, volcanoes, earthquakes, and droughts',
      updateFrequency: 'near_realtime',
      authentication: 'none',
      endpointUrl: 'https://www.gdacs.org/xml/rss.xml',
      rateLimit: {
        requestsPerMinute: 30,
        maxBurst: 5,
        backoffMs: 3000,
        pollIntervalMs: 300000,
        cacheTtlSeconds: 300,
      },
      legal: {
        license: 'Open Access (UN OCHA / EC JRC)',
        attribution: 'GDACS (Global Disaster Alert and Coordination System) - Joint Research Centre',
        commercialUse: 'allowed',
        commercialUseNotes: 'Humanitarian and disaster preparedness open feed',
        rateLimitTerms: '5 minute polling interval',
        termsUrl: 'https://www.gdacs.org/About/disclaimer.aspx',
      },
    };
    super(metadata);
  }

  public async fetch(params: any = {}): Promise<{ rawData: any; latencyMs: number }> {
    const externalUrl = process.env.CIVIC_ALERTS_FEED_URL;
    if (externalUrl) {
      try {
        return await this.secureFetch(externalUrl, {}, 6000);
      } catch (err: any) {
        this.recordFailure(err.message);
        throw err;
      }
    }

    this.recordFailure('CIVIC_ALERTS_FEED_URL not configured');
    return { rawData: null, latencyMs: 0 };
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !Array.isArray(rawData.items)) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const item of rawData.items) {
      const lat = item.latitude;
      const lon = item.longitude;

      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const entityId = `ALERT_${item.guid}`;

      observations.push({
        id: `obs_alert_${item.guid}_${Date.now()}`,
        entity_id: entityId,
        entity_type: 'CIVIC_ALERT',
        data_type: 'DISASTER_ADVISORY',
        value: {
          title: item.title,
          event_type: item.event_type,
          alert_level: item.alert_level,
          description: item.description,
          severity: item.severity,
        },
        location: {
          latitude: lat,
          longitude: lon,
          country: 'India',
        },
        timestamp: new Date().toISOString(),
        observed_at: item.published,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: 0.95,
        quality: 'VERIFIED',
        ttl: 1800,
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/xml/rss.xml',
          retrievedAt: new Date().toISOString(),
          observedAt: item.published,
          originalId: item.guid,
        },
        raw_payload: item,
      });
    }

    this.recordSuccess(2, rawData.items.length, observations.length, rejected);
    return observations;
  }
}
