import { DataProvider } from '../../base/DataProvider.js';
import { NormalizedObservation, ProviderMetadata } from '../../base/types.js';

export interface WeatherLocationConfig {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  district?: string;
  state?: string;
  country: string;
}

export const OPERATIONAL_WEATHER_NODES: WeatherLocationConfig[] = [
  { id: 'BLR_CENTRAL', name: 'Bengaluru Operational Hub', latitude: 12.9716, longitude: 77.5946, district: 'Bangalore Urban', state: 'Karnataka', country: 'India' },
  { id: 'MAA_PORT', name: 'Chennai Port & Coastal Node', latitude: 13.0827, longitude: 80.2707, district: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  { id: 'BOM_WEST', name: 'Mumbai Maritime Command Node', latitude: 18.9220, longitude: 72.8347, district: 'Mumbai', state: 'Maharashtra', country: 'India' },
  { id: 'VTZ_EAST', name: 'Visakhapatnam Naval Sector Node', latitude: 17.6868, longitude: 83.2185, district: 'Visakhapatnam', state: 'Andhra Pradesh', country: 'India' },
  { id: 'COK_SOUTH', name: 'Kochi Southern Command Node', latitude: 9.9312, longitude: 76.2673, district: 'Ernakulam', state: 'Kerala', country: 'India' },
];

export class OpenMeteoWeatherProvider extends DataProvider {
  constructor() {
    const metadata: ProviderMetadata = {
      id: 'open_meteo_weather',
      name: 'Open-Meteo Weather API',
      category: 'WEATHER',
      description: 'Open-access weather forecast, current conditions and precipitation telemetry.',
      coverage: 'global',
      coverageDetails: 'Worldwide numerical weather prediction models (ECMWF, GFS, ICON)',
      updateFrequency: 'hourly',
      authentication: 'none',
      envKeyName: 'OPEN_METEO_API_KEY',
      endpointUrl: 'https://api.open-meteo.com/v1/forecast',
      rateLimit: {
        requestsPerMinute: 60,
        maxBurst: 10,
        backoffMs: 2000,
        pollIntervalMs: 300000, // 5 mins
        cacheTtlSeconds: 300,
      },
      legal: {
        license: 'CC BY 4.0',
        attribution: 'Weather data by Open-Meteo.com under CC BY 4.0 (NWP model estimates)',
        commercialUse: 'allowed',
        commercialUseNotes: 'Free for non-commercial and commercial use with attribution up to 10,000 daily calls',
        rateLimitTerms: 'Max 10,000 requests/day, 60 calls/minute',
        termsUrl: 'https://open-meteo.com/en/terms',
      },
    };
    super(metadata);
  }

  public async fetch(params: { latitude?: number; longitude?: number; nodeId?: string } = {}): Promise<{ rawData: any; latencyMs: number }> {
    let lat = params.latitude;
    let lon = params.longitude;

    if (params.nodeId) {
      const found = OPERATIONAL_WEATHER_NODES.find(n => n.id === params.nodeId);
      if (found) {
        lat = found.latitude;
        lon = found.longitude;
      }
    }

    // Default to primary Bangalore operational node
    if (lat === undefined || lon === undefined) {
      lat = 12.9716;
      lon = 77.5946;
    }

    const cacheKey = `weather_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) {
      return { rawData: cached, latencyMs: 2 };
    }

    const url = `${this.metadata.endpointUrl}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=precipitation_probability&timezone=auto`;

    try {
      const { data, latency } = await this.secureFetch(url, {}, 18000);
      this.setCached(cacheKey, data, this.metadata.rateLimit.cacheTtlSeconds);
      return { rawData: data, latencyMs: latency };
    } catch (err: any) {
      this.recordFailure(err.message);
      throw err;
    }
  }

  public async normalize(rawData: any): Promise<NormalizedObservation[]> {
    if (!rawData || !rawData.current) {
      this.recordFailure('Missing current conditions in Open-Meteo payload');
      return [];
    }

    const lat = rawData.latitude;
    const lon = rawData.longitude;

    if (!this.isValidCoordinate(lat, lon)) {
      this.recordFailure(`Invalid coordinates received: ${lat}, ${lon}`);
      return [];
    }

    const current = rawData.current;
    const observedAt = current.time ? new Date(current.time).toISOString() : new Date().toISOString();

    // Match closest operational node if within 0.1 degree
    const matchedNode = OPERATIONAL_WEATHER_NODES.find(n => 
      Math.abs(n.latitude - lat) < 0.15 && Math.abs(n.longitude - lon) < 0.15
    );

    const stationId = matchedNode ? `WEATHER_NODE_${matchedNode.id}` : `WEATHER_NODE_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;
    const stationName = matchedNode ? matchedNode.name : `Weather Node (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    const cityName = matchedNode ? matchedNode.name.split(' ')[0] : 'Regional Station';
    const stateName = matchedNode?.state || 'India';
    const districtName = matchedNode?.district || cityName;

    const obsId = `obs_meteo_${stationId}_${observedAt.replace(/[:.]/g, '_')}`;

    const observation: NormalizedObservation = {
      id: obsId,
      entity_id: stationId,
      entity_type: 'WEATHER_STATION',
      data_type: 'METEOROLOGICAL',
      value: {
        station_name: stationName,
        temperature_c: typeof current.temperature_2m === 'number' ? current.temperature_2m : null,
        relative_humidity_pct: typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null,
        precipitation_mm: typeof current.precipitation === 'number' ? current.precipitation : 0,
        rain_mm: typeof current.rain === 'number' ? current.rain : 0,
        surface_pressure_hpa: typeof current.surface_pressure === 'number' ? current.surface_pressure : null,
        wind_speed_kmh: typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : null,
        wind_direction_deg: typeof current.wind_direction_10m === 'number' ? current.wind_direction_10m : null,
        weather_code: current.weather_code ?? null,
        elevation_m: rawData.elevation ?? null,
        model_source: 'ECMWF_GFS_ICON_BLEND',
        data_kind: 'NUMERICAL_WEATHER_PREDICTION',
        is_direct_instrument_sensor: false,
        attribution_warning: 'Model-derived forecast & reanalysis (Open-Meteo); not a direct physical meteorological station reading.',
      },
      location: {
        latitude: lat,
        longitude: lon,
        altitudeM: rawData.elevation,
        city: cityName,
        district: districtName,
        state: stateName,
        country: 'India',
      },
      timestamp: new Date().toISOString(),
      observed_at: observedAt,
      source: this.metadata.endpointUrl,
      provider: this.metadata.id,
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: this.metadata.rateLimit.cacheTtlSeconds,
      provenance: {
        source: this.metadata.endpointUrl,
        provider: this.metadata.id,
        endpoint: `/v1/forecast?latitude=${lat}&longitude=${lon}`,
        retrievedAt: new Date().toISOString(),
        observedAt,
        originalId: `open_meteo_${lat}_${lon}`,
      },
      raw_payload: rawData,
    };

    this.recordSuccess(10, 1, 1, 0);
    return [observation];
  }
}
