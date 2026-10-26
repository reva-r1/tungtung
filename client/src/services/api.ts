import {
  Entity,
  GraphData,
  TimelineEvent,
  LocationRecord,
  Anomaly,
  MergeCandidate,
  Dataset,
  Investigation,
  AiInvestigationResponse,
  DataSource,
  SourceInspection,
  SourceRecord,
  MovingEntity,
  EntityPositionHistory,
  MaritimePattern,
  AisProviderStatus,
} from '../types';

const API_BASE = '/api';

export const api = {
  // Data Sources (Multi-Database Testing System)
  async getSources(): Promise<DataSource[]> {
    const res = await fetch(`${API_BASE}/sources`);
    if (!res.ok) throw new Error('Failed to fetch data sources');
    return res.json();
  },

  async getSource(id: string): Promise<DataSource> {
    const res = await fetch(`${API_BASE}/sources/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch source ${id}`);
    return res.json();
  },

  async getSourceSchema(id: string): Promise<SourceInspection> {
    const res = await fetch(`${API_BASE}/sources/${id}/schema`);
    if (!res.ok) throw new Error(`Failed to inspect schema for source ${id}`);
    return res.json();
  },

  async connectSource(id: string) {
    const res = await fetch(`${API_BASE}/sources/${id}/connect`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to connect to source ${id}`);
    return res.json();
  },

  async syncSource(id: string) {
    const res = await fetch(`${API_BASE}/sources/${id}/sync`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to synchronize source ${id}`);
    return res.json();
  },

  async syncAllSources() {
    const res = await fetch(`${API_BASE}/sources/sync-all`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to synchronize all sources');
    return res.json();
  },

  async getSourceRecords(id: string, limit: number = 50, offset: number = 0): Promise<{ total: number; records: SourceRecord[] }> {
    const res = await fetch(`${API_BASE}/sources/${id}/records?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`Failed to fetch records for source ${id}`);
    return res.json();
  },

  // Dashboard & Metrics
  async getDashboardStats(datasetId?: string) {
    const url = datasetId 
      ? `${API_BASE}/dashboard/stats?datasetId=${encodeURIComponent(datasetId)}`
      : `${API_BASE}/dashboard/stats`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  // Entities
  async searchEntities(params?: { query?: string; type?: string; minRisk?: number; limit?: number }): Promise<Entity[]> {
    const queryParams = new URLSearchParams();
    if (params?.query) queryParams.set('query', params.query);
    if (params?.type) queryParams.set('type', params.type);
    if (params?.minRisk) queryParams.set('minRisk', String(params.minRisk));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/entities?${queryParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch entities');
    return res.json();
  },

  async getEntityFacets(query?: string) {
    const queryParams = query ? `?query=${encodeURIComponent(query)}` : '';
    const res = await fetch(`${API_BASE}/entities/search/facets${queryParams}`);
    if (!res.ok) throw new Error('Failed to fetch entity facets');
    return res.json();
  },

  async getEntityProfile(id: string) {
    const res = await fetch(`${API_BASE}/entities/${id}/profile`);
    if (!res.ok) throw new Error(`Failed to fetch profile for entity ${id}`);
    return res.json();
  },

  // Graph
  async getGraph(params?: { types?: string[]; edgeTypes?: string[]; sources?: string[]; minRisk?: number; limit?: number }): Promise<GraphData> {
    const queryParams = new URLSearchParams();
    if (params?.types?.length) queryParams.set('types', params.types.join(','));
    if (params?.edgeTypes?.length) queryParams.set('edgeTypes', params.edgeTypes.join(','));
    if (params?.sources?.length) queryParams.set('sources', params.sources.join(','));
    if (params?.minRisk) queryParams.set('minRisk', String(params.minRisk));
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/graph?${queryParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch graph data');
    return res.json();
  },

  async expandEntity(id: string, hops: number = 1, edgeTypes?: string[]): Promise<GraphData> {
    const queryParams = new URLSearchParams({ hops: String(hops) });
    if (edgeTypes?.length) queryParams.set('edgeTypes', edgeTypes.join(','));

    const res = await fetch(`${API_BASE}/graph/expand/${id}?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`Failed to expand entity ${id}`);
    return res.json();
  },

  async findShortestPath(sourceId: string, targetId: string) {
    const res = await fetch(`${API_BASE}/graph/path?sourceId=${sourceId}&targetId=${targetId}`);
    if (!res.ok) throw new Error('Failed to calculate shortest path');
    return res.json();
  },

  async searchGraphInquiry(query: string): Promise<{
    nodes: any[];
    edges: any[];
    primaryId: string | null;
    matchedEntities: any[];
    summary: string;
  }> {
    const res = await fetch(`${API_BASE}/graph/inquiry?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to query graph inquiry');
    return res.json();
  },

  // Events & Timeline
  async getEvents(params?: { entityId?: string; eventType?: string; severity?: string; limit?: number }): Promise<TimelineEvent[]> {
    const queryParams = new URLSearchParams();
    if (params?.entityId) queryParams.set('entityId', params.entityId);
    if (params?.eventType) queryParams.set('eventType', params.eventType);
    if (params?.severity) queryParams.set('severity', params.severity);
    if (params?.limit) queryParams.set('limit', String(params.limit));

    const res = await fetch(`${API_BASE}/events?${queryParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch timeline events');
    return res.json();
  },

  // Locations / Map
  async getLocations(params?: { city?: string; type?: string }): Promise<LocationRecord[]> {
    const queryParams = new URLSearchParams();
    if (params?.city) queryParams.set('city', params.city);
    if (params?.type) queryParams.set('type', params.type);

    const res = await fetch(`${API_BASE}/locations?${queryParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch locations');
    return res.json();
  },

  // Anomalies
  async getAnomalies(params?: { status?: string; severity?: string; entityId?: string }): Promise<Anomaly[]> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.severity) queryParams.set('severity', params.severity);
    if (params?.entityId) queryParams.set('entityId', params.entityId);

    const res = await fetch(`${API_BASE}/anomalies?${queryParams.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch anomalies');
    return res.json();
  },

  async scanAnomalies() {
    const res = await fetch(`${API_BASE}/anomalies/scan`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to run anomaly scan');
    return res.json();
  },

  async updateAnomalyStatus(id: string, status: string) {
    const res = await fetch(`${API_BASE}/anomalies/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update anomaly status');
    return res.json();
  },

  // Entity Resolution
  async getMergeCandidates(status?: string): Promise<MergeCandidate[]> {
    const queryParams = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE}/resolution/candidates${queryParams}`);
    if (!res.ok) throw new Error('Failed to fetch merge candidates');
    return res.json();
  },

  async scanMergeCandidates() {
    const res = await fetch(`${API_BASE}/resolution/scan`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to scan for duplicate candidates');
    return res.json();
  },

  async resolveCandidate(id: string, action: 'MERGE' | 'REJECT', analystNotes?: string) {
    const res = await fetch(`${API_BASE}/resolution/candidates/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, analystNotes }),
    });
    if (!res.ok) throw new Error('Failed to resolve candidate');
    return res.json();
  },

  // Datasets & Ingestion
  async getDatasets(): Promise<Dataset[]> {
    const res = await fetch(`${API_BASE}/ingestion/datasets`);
    if (!res.ok) throw new Error('Failed to fetch datasets');
    return res.json();
  },

  async getDataset(id: string): Promise<Dataset> {
    const res = await fetch(`${API_BASE}/ingestion/datasets/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch dataset ${id}`);
    return res.json();
  },

  async getActiveDataset(): Promise<Dataset> {
    const res = await fetch(`${API_BASE}/ingestion/datasets/active`);
    if (!res.ok) throw new Error('Failed to fetch active dataset');
    return res.json();
  },

  async setActiveDataset(id: string): Promise<Dataset> {
    const res = await fetch(`${API_BASE}/ingestion/datasets/${id}/activate`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to activate dataset ${id}`);
    return res.json();
  },

  async getDatasetRecords(id: string, limit: number = 50, offset: number = 0, search: string = ''): Promise<{ total: number; columns: string[]; records: any[] }> {
    const queryParams = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) queryParams.set('search', search);
    const res = await fetch(`${API_BASE}/ingestion/datasets/${id}/records?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch records for dataset ${id}`);
    return res.json();
  },

  async inspectFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/ingestion/inspect`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to inspect file');
    }
    return res.json();
  },

  async commitIngestion(payload: { datasetName: string; format: string; rows: any[] }) {
    const res = await fetch(`${API_BASE}/ingestion/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to commit dataset');
    return res.json();
  },

  async deleteDataset(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/ingestion/datasets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete dataset ${id}`);
    return res.json();
  },

  async deleteAllDatasets(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/ingestion/datasets`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to purge all datasets');
    return res.json();
  },

  async reloadDemoDataset() {
    const res = await fetch(`${API_BASE}/ingestion/demo/reload`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reload demo dataset');
    return res.json();
  },


  // AI & Natural Language
  async investigateAi(prompt: string, entityId?: string, investigationId?: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>): Promise<AiInvestigationResponse> {
    const res = await fetch(`${API_BASE}/ai/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, entityId, investigationId, history }),
    });
    if (!res.ok) throw new Error('AI investigation request failed');
    return res.json();
  },

  async executeNlQuery(query: string) {
    const res = await fetch(`${API_BASE}/ai/nl-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error('Natural language query failed');
    return res.json();
  },

  async getAiStatus() {
    const res = await fetch(`${API_BASE}/ai/status`);
    if (!res.ok) throw new Error('Failed to fetch AI configuration status');
    return res.json();
  },

  // Investigations
  async getInvestigations(): Promise<Investigation[]> {
    const res = await fetch(`${API_BASE}/investigations`);
    if (!res.ok) throw new Error('Failed to fetch investigations');
    return res.json();
  },

  async getInvestigation(id: string): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch investigation');
    return res.json();
  },

  async createInvestigation(payload: { title: string; description?: string; leadAnalyst?: string; priority?: string; entityIds?: string[] }) {
    const res = await fetch(`${API_BASE}/investigations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create investigation');
    return res.json();
  },

  async addInvestigationNote(id: string, note: { author: string; content: string }) {
    const res = await fetch(`${API_BASE}/investigations/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    if (!res.ok) throw new Error('Failed to add note');
    return res.json();
  },

  // Maritime AIS Tracking & Pattern Discovery
  async getMaritimeVessels(limit: number = 300): Promise<{ total: number; vessels: MovingEntity[] }> {
    const res = await fetch(`${API_BASE}/maritime/vessels?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch maritime vessels');
    return res.json();
  },

  async getMaritimeVessel(id: string): Promise<MovingEntity> {
    const res = await fetch(`${API_BASE}/maritime/vessels/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch vessel ${id}`);
    return res.json();
  },

  async getMaritimeVesselTrack(id: string, limit: number = 64): Promise<{ entity_id: string; point_count: number; track: EntityPositionHistory[] }> {
    const res = await fetch(`${API_BASE}/maritime/vessels/${id}/track?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch historical track for vessel ${id}`);
    return res.json();
  },

  async getMaritimePatterns(): Promise<{ total: number; patterns: MaritimePattern[] }> {
    const res = await fetch(`${API_BASE}/maritime/patterns`);
    if (!res.ok) throw new Error('Failed to fetch maritime patterns');
    return res.json();
  },

  async investigateMaritimePattern(patternId: string): Promise<{ pattern: MaritimePattern; analysis: any }> {
    const res = await fetch(`${API_BASE}/maritime/patterns/${patternId}/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Failed to investigate pattern ${patternId}`);
    return res.json();
  },

  async getMaritimeStatus(): Promise<AisProviderStatus> {
    const res = await fetch(`${API_BASE}/maritime/status`);
    if (!res.ok) throw new Error('Failed to fetch maritime AIS status');
    return res.json();
  },

  // Aviation OpenSky Live Tracking
  async getAviationStatus(): Promise<{
    providerId: string;
    providerName: string;
    status: string;
    connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
    operationalState: 'CONNECTED_FRESH' | 'CONNECTED_STALE' | 'CONNECTED_EMPTY' | 'CONNECTED_HISTORICAL' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    isPollingActive: boolean;
    pollIntervalMs: number;
    lastPollAt: string | null;
    lastSuccessfulPollAt: string | null;
    newestObservationAt: string | null;
    newestObservationAgeSec: number | null;
    freshAircraftCount: number;
    staleAircraftCount: number;
    historicalCount: number;
    totalAircraftInDb: number;
    airborneCount: number;
    onGroundCount: number;
    lastError: string | null;
    rateLimitRemaining: number;
  }> {
    const res = await fetch(`${API_BASE}/aviation/status`);
    if (!res.ok) throw new Error('Failed to fetch aviation status');
    return res.json();
  },

  async getAviationAircraft(limit: number = 300): Promise<{ total: number; aircraft: MovingEntity[]; status: any }> {
    const res = await fetch(`${API_BASE}/aviation/aircraft?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch aviation aircraft');
    return res.json();
  },

  async getAviationAircraftById(id: string): Promise<MovingEntity> {
    const res = await fetch(`${API_BASE}/aviation/aircraft/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch aircraft ${id}`);
    return res.json();
  },

  async getAviationAircraftTrack(id: string, limit: number = 64): Promise<{ entity_id: string; point_count: number; track: EntityPositionHistory[] }> {
    const res = await fetch(`${API_BASE}/aviation/aircraft/${id}/track?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch aircraft track for ${id}`);
    return res.json();
  },

  async pollAviation(): Promise<any> {
    const res = await fetch(`${API_BASE}/aviation/poll`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to poll aviation');
    return res.json();
  },

  // Hydrological Central Water Commission (India-WRIS) Telemetry
  async getHydrologyStatus(): Promise<{
    providerId: string;
    providerName: string;
    status: string;
    connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
    operationalState: 'CONNECTED_FRESH' | 'CONNECTED_STALE' | 'CONNECTED_EMPTY' | 'CONNECTED_HISTORICAL' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    isPollingActive: boolean;
    lastPollAt: string | null;
    lastSuccessfulPollAt: string | null;
    newestObservationAt: string | null;
    newestObservationAgeDays: number | null;
    totalStationsInDb: number;
    totalLiveStorageBmc: number;
    totalFullCapacityBmc: number;
    overallCapacityPct: number | null;
    lastError: string | null;
    rateLimitRemaining: number;
  }> {
    const res = await fetch(`${API_BASE}/hydrology/status`);
    if (!res.ok) throw new Error('Failed to fetch hydrology status');
    return res.json();
  },

  async getHydrologyStations(): Promise<{
    total: number;
    stations: Array<{
      id: string;
      name: string;
      type: string;
      category: string;
      latitude: number;
      longitude: number;
      district?: string;
      state?: string;
      river?: string;
      basin?: string;
      current_live_storage_bmc: number;
      current_live_storage_tmc: number;
      full_capacity_bmc: number;
      capacity_pct: number | null;
      observation_date: string;
      observed_at: string;
      last_updated_at: string;
      provider: string;
      provenance: any;
    }>;
    status: any;
  }> {
    const res = await fetch(`${API_BASE}/hydrology/stations`);
    if (!res.ok) throw new Error('Failed to fetch hydrology stations');
    return res.json();
  },

  async getHydrologyStationById(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/hydrology/stations/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch hydrology station ${id}`);
    return res.json();
  },

  async getHydrologyStationHistory(id: string, limit: number = 50): Promise<{ entity_id: string; count: number; history: any[] }> {
    const res = await fetch(`${API_BASE}/hydrology/stations/${id}/history?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch hydrology station history for ${id}`);
    return res.json();
  },

  async pollHydrology(params: any = {}): Promise<any> {
    const res = await fetch(`${API_BASE}/hydrology/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to poll hydrology');
    return res.json();
  },

  // =========================================================================
  // USGS EARTHQUAKE HAZARDS PROGRAM (SEISMIC FEEDS)
  // =========================================================================
  async getEarthquakeStatus(): Promise<{
    providerId: string;
    providerName: string;
    status: string;
    connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
    operationalState: 'CONNECTED_FRESH' | 'CONNECTED_STALE' | 'CONNECTED_EMPTY' | 'CONNECTED_HISTORICAL' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    isPollingActive: boolean;
    lastPollAt: string | null;
    lastSuccessfulPollAt: string | null;
    newestObservationAt: string | null;
    newestObservationAgeMinutes: number | null;
    totalEventsInDb: number;
    maxMagnitude: number | null;
    lastError: string | null;
    rateLimitRemaining: number;
  }> {
    const res = await fetch(`${API_BASE}/earthquakes/status`);
    if (!res.ok) throw new Error('Failed to fetch earthquake status');
    return res.json();
  },

  async getEarthquakeEvents(limit: number = 100): Promise<{
    meta: any;
    events: Array<{
      id: string;
      name: string;
      type: string;
      category: string;
      latitude: number;
      longitude: number;
      depth_km: number;
      magnitude: number | null;
      magType: string;
      place: string;
      status: string;
      tsunami_alert: number;
      significance: number;
      felt_reports: number | null;
      origin_time: string;
      updated_at: string;
      observed_at: string;
      last_updated_at: string;
      provider: string;
      source_network: string;
      data_kind: string;
      is_direct_instrument_sensor: boolean;
      provenance: any;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/earthquakes/events?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch earthquake events');
    return res.json();
  },

  async pollEarthquakes(params: any = {}): Promise<any> {
    const res = await fetch(`${API_BASE}/earthquakes/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to poll earthquakes');
    return res.json();
  },

  // =========================================================================
  // OPEN-METEO WEATHER & AIR QUALITY (ENVIRONMENTAL NODES)
  // =========================================================================
  async getEnvironmentStatus(): Promise<{
    weatherProviderId: string;
    weatherConnectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    weatherFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
    weatherOperationalState: string;
    airQualityProviderId: string;
    airQualityConnectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    airQualityFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
    airQualityOperationalState: string;
    configuredNodesCount: number;
    totalWeatherNodesInDb: number;
    totalAirQualityNodesInDb: number;
    lastPollAt: string | null;
    lastSuccessfulPollAt: string | null;
    newestWeatherObservationAt: string | null;
    newestAirQualityObservationAt: string | null;
    isPollingActive: boolean;
    lastErrors: string[];
  }> {
    const res = await fetch(`${API_BASE}/environment/status`);
    if (!res.ok) throw new Error('Failed to fetch environment status');
    return res.json();
  },

  async getWeatherNodes(): Promise<{
    meta: any;
    nodes: Array<{
      id: string;
      name: string;
      type: string;
      category: string;
      latitude: number;
      longitude: number;
      temperature_c: number | null;
      relative_humidity_pct: number | null;
      precipitation_mm: number;
      rain_mm: number;
      surface_pressure_hpa: number | null;
      wind_speed_kmh: number | null;
      wind_direction_deg: number | null;
      weather_code: number | null;
      elevation_m: number | null;
      model_source: string;
      data_kind: string;
      is_direct_instrument_sensor: boolean;
      observed_at: string;
      last_updated_at: string;
      provider: string;
      provenance: any;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/environment/weather`);
    if (!res.ok) throw new Error('Failed to fetch weather nodes');
    return res.json();
  },

  async getAirQualityNodes(): Promise<{
    meta: any;
    nodes: Array<{
      id: string;
      name: string;
      type: string;
      category: string;
      latitude: number;
      longitude: number;
      us_aqi: number | null;
      european_aqi: number | null;
      pm2_5_ugm3: number | null;
      pm10_ugm3: number | null;
      nitrogen_dioxide_ugm3: number | null;
      sulphur_dioxide_ugm3: number | null;
      ozone_ugm3: number | null;
      carbon_monoxide_ugm3: number | null;
      model_source: string;
      data_kind: string;
      is_direct_instrument_sensor: boolean;
      observed_at: string;
      last_updated_at: string;
      provider: string;
      provenance: any;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/environment/air-quality`);
    if (!res.ok) throw new Error('Failed to fetch air quality nodes');
    return res.json();
  },

  async pollEnvironment(params: any = {}): Promise<any> {
    const res = await fetch(`${API_BASE}/environment/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to poll environment');
    return res.json();
  },

  // =========================================================================
  // LIVE WORLD MODEL & DATA CONNECTOR LAYER
  // =========================================================================
  async getWorldState(): Promise<any> {
    const res = await fetch(`${API_BASE}/world/state`);
    if (!res.ok) throw new Error('Failed to fetch world state');
    return res.json();
  },

  async getWorldEntities(type?: string, category?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (category) params.append('category', category);
    const res = await fetch(`${API_BASE}/world/entities?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch world entities');
    return res.json();
  },

  async getWorldEntity(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/world/entities/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch world entity ${id}`);
    return res.json();
  },

  async getWorldChanges(minutes: number = 60, since?: string): Promise<any> {
    const params = new URLSearchParams();
    if (minutes) params.append('minutes', String(minutes));
    if (since) params.append('since', since);
    const res = await fetch(`${API_BASE}/world/changes?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch temporal changes');
    return res.json();
  },

  async getWorldEvents(severity?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    const res = await fetch(`${API_BASE}/world/events?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch world events');
    return res.json();
  },

  async getWorldRelationships(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/world/relationships`);
    if (!res.ok) throw new Error('Failed to fetch world relationships');
    return res.json();
  },

  async getProviderStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/providers/status`);
    if (!res.ok) throw new Error('Failed to fetch provider status');
    return res.json();
  },

  async syncAllProviders(): Promise<any> {
    const res = await fetch(`${API_BASE}/providers/sync-all`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to sync all providers');
    return res.json();
  },

  // =========================================================================
  // SIMULATION / DIGITAL TWIN SANDBOX
  // =========================================================================
  async listSimulations(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/simulation`);
    if (!res.ok) throw new Error('Failed to list simulations');
    return res.json();
  },

  async createSimulation(name: string, description: string = ''): Promise<any> {
    const res = await fetch(`${API_BASE}/simulation/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) throw new Error('Failed to create simulation');
    return res.json();
  },

  async modifySimulation(id: string, modifications: { entity_id: string; properties: Record<string, any> }[]): Promise<any> {
    const res = await fetch(`${API_BASE}/simulation/${id}/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modifications }),
    });
    if (!res.ok) throw new Error(`Failed to modify simulation ${id}`);
    return res.json();
  },

  async getSimulationState(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/simulation/${id}/state`);
    if (!res.ok) throw new Error(`Failed to fetch simulation state ${id}`);
    return res.json();
  },

  async resetSimulation(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/simulation/${id}/reset`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to reset simulation ${id}`);
    return res.json();
  },

  async deleteSimulation(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/simulation/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete simulation ${id}`);
    return res.json();
  },

  // =========================================================================
  // OMNI-SENSOR AI REASONING SPACE & CHAT MEMORY
  async sendChatMessage(message: string, sessionId?: string, entityId?: string): Promise<{
    sessionId: string;
    reply: string;
    reasoning?: string;
    sources: string[];
    timestamp: string;
    matchedEntities?: any[];
    mappedEntityIds?: string[];
    primaryEntityId?: string | null;
    edges?: any[];
  }> {
    const res = await fetch(`${API_BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, entityId }),
    });
    if (!res.ok) throw new Error('Failed to send message to AI reasoning space');
    return res.json();
  },

  async getChatHistory(sessionId: string): Promise<{ sessionId: string; history: any[] }> {
    const res = await fetch(`${API_BASE}/ai/chat/history/${sessionId}`);
    if (!res.ok) throw new Error('Failed to load chat history');
    return res.json();
  },

  async clearChatHistory(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/ai/chat/history/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear chat history');
    return res.json();
  },
};

