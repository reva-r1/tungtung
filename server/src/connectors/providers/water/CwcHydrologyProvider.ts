import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';
import https from 'https';

export interface CwcReservoirMeta {
  code: string;
  name: string;
  district: string;
  river: string;
  basin: string;
  latitude: number;
  longitude: number;
  fullCapacityBmc: number;
}

export const CWC_KARNATAKA_RESERVOIRS: Record<string, CwcReservoirMeta> = {
  'Almatti Reservoir': {
    code: 'ALMATTI',
    name: 'Almatti Reservoir (Lal Bahadur Shastri Sagar)',
    district: 'Bagalkote',
    river: 'Krishna',
    basin: 'Krishna Basin',
    latitude: 16.3314,
    longitude: 75.8872,
    fullCapacityBmc: 3.44,
  },
  'GhatPrabha\\Hidkal Reservoir': {
    code: 'HIDKAL',
    name: 'Ghataprabha / Hidkal Reservoir (Raja Lakhamagouda)',
    district: 'Belagavi',
    river: 'Ghataprabha',
    basin: 'Krishna Basin',
    latitude: 16.1436,
    longitude: 74.6364,
    fullCapacityBmc: 1.44,
  },
  'Malaprabha Reservoir': {
    code: 'MALAPRABHA',
    name: 'Malaprabha Reservoir (Renuka Sagar)',
    district: 'Belagavi',
    river: 'Malaprabha',
    basin: 'Krishna Basin',
    latitude: 15.8192,
    longitude: 75.1189,
    fullCapacityBmc: 1.07,
  },
  'Bhadra Reservoir': {
    code: 'BHADRA',
    name: 'Bhadra Reservoir',
    district: 'Chikkamagaluru',
    river: 'Bhadra',
    basin: 'Krishna Basin',
    latitude: 13.7003,
    longitude: 75.6375,
    fullCapacityBmc: 2.025,
  },
  'Vanivilasa Sagar': {
    code: 'VANIVILASA',
    name: 'Vanivilasa Sagar (Mari Kanive)',
    district: 'Chitradurga',
    river: 'Vedavathi',
    basin: 'Krishna Basin',
    latitude: 13.9875,
    longitude: 76.4792,
    fullCapacityBmc: 0.85,
  },
  'Hemavathy Reservoir': {
    code: 'HEMAVATHY',
    name: 'Hemavathy Reservoir (Gorur Dam)',
    district: 'Hassan',
    river: 'Hemavati',
    basin: 'Cauvery Basin',
    latitude: 12.9125,
    longitude: 76.0506,
    fullCapacityBmc: 1.05,
  },
  'Harangi Reservoir': {
    code: 'HARANGI',
    name: 'Harangi Reservoir',
    district: 'Kodagu',
    river: 'Harangi',
    basin: 'Cauvery Basin',
    latitude: 12.4897,
    longitude: 75.9039,
    fullCapacityBmc: 0.241,
  },
  'Tungabhadra Reservoir': {
    code: 'TUNGABHADRA',
    name: 'Tungabhadra Reservoir (Pampa Sagar)',
    district: 'Koppal',
    river: 'Tungabhadra',
    basin: 'Krishna Basin',
    latitude: 15.2600,
    longitude: 76.3383,
    fullCapacityBmc: 3.75,
  },
  'Kabini Reservoir': {
    code: 'KABINI',
    name: 'Kabini Reservoir',
    district: 'Mysuru',
    river: 'Kabini',
    basin: 'Cauvery Basin',
    latitude: 11.9731,
    longitude: 76.3533,
    fullCapacityBmc: 0.552,
  },
  'Krishnaraja Sagar': {
    code: 'KRS',
    name: 'Krishnaraja Sagar (KRS Dam)',
    district: 'Mysuru',
    river: 'Kaveri (Cauvery)',
    basin: 'Cauvery Basin',
    latitude: 12.4284,
    longitude: 76.5728,
    fullCapacityBmc: 1.399,
  },
  'Linganamakki Reservoir': {
    code: 'LINGANAMAKKI',
    name: 'Linganamakki Reservoir',
    district: 'Shivamogga',
    river: 'Sharavathi',
    basin: 'West Flowing Rivers',
    latitude: 14.2381,
    longitude: 74.8439,
    fullCapacityBmc: 4.368,
  },
  'Mani Dam': {
    code: 'MANI',
    name: 'Mani Dam (Varahi Reservoir)',
    district: 'Shivamogga',
    river: 'Varahi',
    basin: 'West Flowing Rivers',
    latitude: 13.7258,
    longitude: 75.0211,
    fullCapacityBmc: 0.95,
  },
  'Gerusoppa Reservoir': {
    code: 'GERUSOPPA',
    name: 'Gerusoppa Reservoir (Sharavathi Tailrace)',
    district: 'Uttara Kannada',
    river: 'Sharavathi',
    basin: 'West Flowing Rivers',
    latitude: 14.2508,
    longitude: 74.6547,
    fullCapacityBmc: 0.15,
  },
  'Supa Reservoir': {
    code: 'SUPA',
    name: 'Supa Reservoir',
    district: 'Uttara Kannada',
    river: 'Kali',
    basin: 'West Flowing Rivers',
    latitude: 15.2783,
    longitude: 74.5292,
    fullCapacityBmc: 4.178,
  },
  'Tattihalla': {
    code: 'TATTIHALLA',
    name: 'Tattihalla Reservoir',
    district: 'Uttara Kannada',
    river: 'Tattihalla',
    basin: 'Kali Basin',
    latitude: 15.2344,
    longitude: 74.7083,
    fullCapacityBmc: 0.28,
  },
  'Narayanapura Reservoir': {
    code: 'NARAYANAPURA',
    name: 'Narayanapura Reservoir (Basava Sagar)',
    district: 'Vijayapura',
    river: 'Krishna',
    basin: 'Krishna Basin',
    latitude: 16.3150,
    longitude: 76.4950,
    fullCapacityBmc: 1.066,
  },
};

export interface CwcQueryOptions {
  stateName?: string;
  districtName?: string;
  agencyName?: string;
  startdate?: string;
  enddate?: string;
  page?: number;
  size?: number;
}

export class CwcHydrologyProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'cwc_india_wris',
      name: 'Central Water Commission (India-WRIS) Reservoir Telemetry',
      category: 'WATER',
      description: 'Official Government of India hydrological telemetry for major reservoir live storage and basin capacity.',
      coverage: 'country',
      coverageDetails: 'Monitored major reservoir storage across Karnataka and major river basins in India',
      updateFrequency: 'daily',
      authentication: 'none',
      endpointUrl: 'https://indiawris.gov.in/Dataset/Reservoir',
      rateLimit: {
        requestsPerMinute: 20,
        maxBurst: 5,
        backoffMs: 5000,
        pollIntervalMs: 3600000, // 1 hour standard interval
        cacheTtlSeconds: 1800,   // 30 min cache TTL
      },
      legal: {
        license: 'Open Government Data License - India (OGDL)',
        attribution: 'Central Water Commission / National Water Informatics Centre (India-WRIS, Ministry of Jal Shakti)',
        commercialUse: 'allowed',
        commercialUseNotes: 'Public safety, flood monitoring, and water resource management open government data',
        rateLimitTerms: 'Rate limited to reasonable public API usage',
        termsUrl: 'https://indiawris.gov.in',
      },
    };
    super(metadata);
  }

  /**
   * Resilient HTTP POST with IPv4 resolution and bounded timeout
   */
  private resilientPost(url: string, timeoutMs: number = 10000): Promise<{ data: any; latency: number }> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const parsedUrl = new URL(url);

      const req = https.request(
        parsedUrl,
        {
          method: 'POST',
          family: 4, // Enforce IPv4 on Windows
          headers: {
            'User-Agent': 'Revana-WorldModel/2.0 (Hydrological Telemetry Client)',
            'Accept': 'application/json',
            'Content-Length': '0',
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
              this.health.status = 'RATE_LIMITED';
              reject(new Error('India-WRIS returned HTTP 429 (Too Many Requests)'));
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

  public async fetch(options: CwcQueryOptions = {}): Promise<{ rawData: any; latencyMs: number }> {
    const stateName = options.stateName ?? (process.env.CWC_STATE || 'Karnataka');
    const districtName = options.districtName ?? '0';
    const agencyName = options.agencyName ?? 'CWC';

    // Default to surveyed CWC reference date if not provided in environment
    const startdate = options.startdate ?? (process.env.CWC_START_DATE || '2024-01-15');
    const enddate = options.enddate ?? (process.env.CWC_END_DATE || startdate);
    const page = options.page ?? 0;
    const size = options.size ?? 50;

    const cacheKey = `cwc_res_${stateName}_${startdate}_${enddate}_${page}_${size}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    if (this.isCircuitOpen()) {
      throw new Error(`[CircuitBreaker: OPEN] Provider ${this.metadata.id} is temporarily blocked due to repeated failures.`);
    }

    if (!this.checkRateLimit()) {
      throw new Error(`[RateLimit: EXCEEDED] Provider ${this.metadata.id} rate limit exceeded. Backing off.`);
    }

    const queryParams = new URLSearchParams({
      stateName,
      districtName,
      agencyName,
      startdate,
      enddate,
      page: String(page),
      size: String(size),
    });

    const fullUrl = `${this.metadata.endpointUrl}?${queryParams.toString()}`;

    try {
      const { data, latency } = await this.resilientPost(fullUrl, 10000);
      this.setCached(cacheKey, data, this.metadata.rateLimit.cacheTtlSeconds);
      return { rawData: data, latencyMs: latency };
    } catch (err: any) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  private resolveReservoirMeta(rawName: string): CwcReservoirMeta | null {
    if (!rawName) return null;
    if (CWC_KARNATAKA_RESERVOIRS[rawName]) {
      return CWC_KARNATAKA_RESERVOIRS[rawName];
    }
    const clean = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key, meta] of Object.entries(CWC_KARNATAKA_RESERVOIRS)) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanName = meta.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCode = meta.code.toLowerCase();
      if (
        cleanKey.includes(clean) || clean.includes(cleanKey) ||
        cleanName.includes(clean) || clean.includes(cleanName) ||
        clean.includes(cleanCode) || cleanCode.includes(clean)
      ) {
        return meta;
      }
    }
    return null;
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    const records = Array.isArray(rawData)
      ? rawData
      : (Array.isArray(rawData?.data) ? rawData.data : []);

    if (records.length === 0) {
      return [];
    }

    const observations: NormalizedObservation[] = [];
    let rejected = 0;

    for (const record of records) {
      const rawName = record.reservoirName || record.reservoir_name || record.name
        ? String(record.reservoirName || record.reservoir_name || record.name).trim()
        : '';

      if (!rawName) {
        rejected++;
        continue;
      }

      // Resolve surveyed coordinates and metadata
      const meta = this.resolveReservoirMeta(rawName);
      if (!meta) {
        // Unknown reservoir without verified surveyed coordinates - fail safe
        rejected++;
        continue;
      }

      const lat = meta.latitude;
      const lon = meta.longitude;
      if (!this.isValidCoordinate(lat, lon)) {
        rejected++;
        continue;
      }

      const rawStorageVal = record.currentLiveStorage_BMC ?? record.current_live_storage ?? record.live_storage;
      if (rawStorageVal == null) {
        rejected++;
        continue;
      }

      const liveStorageBmc = typeof rawStorageVal === 'number'
        ? rawStorageVal
        : parseFloat(String(rawStorageVal));

      if (isNaN(liveStorageBmc) || liveStorageBmc < 0) {
        rejected++;
        continue;
      }

      const entityId = `RESERVOIR_${meta.code}_KARNATAKA`;
      const observedDate = record.observation_date || record.date || new Date().toISOString().split('T')[0];
      // India-WRIS CWC publishes daily reservoir bulletins measured at 08:30 AM Indian Standard Time (IST, UTC+05:30).
      // Converting 08:30 IST to UTC produces 03:00:00.000Z.
      const observedAt = new Date(`${observedDate}T08:30:00+05:30`).toISOString();

      // 1 BMC = 35.3147 TMC (Thousand Million Cubic Feet)
      const liveStorageTmc = Math.round(liveStorageBmc * 35.3147 * 100) / 100;
      const capacityPct = meta.fullCapacityBmc > 0
        ? Math.min(100, Math.round((liveStorageBmc / meta.fullCapacityBmc) * 100))
        : null;

      observations.push({
        id: `obs_cwc_${meta.code}_${observedDate}`,
        entity_id: entityId,
        entity_type: 'WATER_RESERVOIR_GAUGE',
        data_type: 'HYDROLOGICAL',
        value: {
          station_name: meta.name,
          reservoir_name: meta.name,
          reservoir_code: meta.code,
          river: meta.river,
          basin: meta.basin,
          district: record.districtName || record.district || meta.district,
          state: record.stateName || record.state || 'Karnataka',
          agency: record.agencyName || record.agency || 'CWC',
          current_live_storage_bmc: liveStorageBmc,
          current_live_storage_tmc: liveStorageTmc,
          full_capacity_bmc: meta.fullCapacityBmc,
          full_capacity_tmc: Math.round(meta.fullCapacityBmc * 35.3147 * 100) / 100,
          capacity_pct: capacityPct,
          observation_date: observedDate,
          source_date: observedDate,
          date_precision: 'DAY',
          is_date_only: true,
          source_reporting_standard: '08:30 IST Daily Bulletin',
          derived_utc_instant: observedAt,
          measurement_type: 'RESERVOIR_LIVE_STORAGE',
          unit: 'BMC',
        },
        location: {
          latitude: lat,
          longitude: lon,
          district: meta.district,
          state: record.stateName || 'Karnataka',
          country: 'India',
        },
        timestamp: new Date().toISOString(),
        observed_at: observedAt,
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        confidence: 0.98,
        quality: 'VERIFIED',
        ttl: 86400, // Daily reporting interval
        provenance: {
          source: this.metadata.endpointUrl,
          provider: this.metadata.id,
          endpoint: '/Dataset/Reservoir',
          retrievedAt: new Date().toISOString(),
          observedAt,
          source_date: observedDate,
          source_reporting_standard: '08:30 IST Daily Bulletin',
          derived_from_date: true,
          originalId: meta.code,
        },
        raw_payload: record,
      });
    }

    this.recordSuccess(10, records.length, observations.length, rejected);
    return observations;
  }
}
