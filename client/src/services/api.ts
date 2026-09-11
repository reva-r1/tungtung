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
  async investigateAi(prompt: string, entityId?: string, investigationId?: string): Promise<AiInvestigationResponse> {
    const res = await fetch(`${API_BASE}/ai/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, entityId, investigationId }),
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
};
