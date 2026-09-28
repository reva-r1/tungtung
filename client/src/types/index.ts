// Client Domain Types

export type EntityType = 
  | 'COMPANY'
  | 'PERSON'
  | 'VEHICLE'
  | 'SHIPMENT'
  | 'WAREHOUSE'
  | 'LOCATION'
  | 'EVENT'
  | 'TRANSACTION'
  | 'ROUTE'
  | 'ENTITY';

export type RelationshipType =
  | 'OWNS'
  | 'WORKS_FOR'
  | 'OPERATES'
  | 'SHIPPED_BY'
  | 'CONTAINS'
  | 'LOCATED_AT'
  | 'ORIGINATED_FROM'
  | 'DESTINED_FOR'
  | 'TRAVELS_ALONG'
  | 'ASSOCIATED_WITH'
  | 'INVOLVED_IN'
  | 'RECORDED_AT'
  | 'TRANSACTED_WITH'
  | 'CONSIGNED_TO';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface DataSource {
  id: string;
  name: string;
  dbType: 'sqlite';
  dbPath: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastSync: string | null;
  tableCount: number;
  recordCount: number;
  createdAt: string;
}

export interface SourceColumnInfo {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  sampleValue?: any;
}

export interface SourceTableSchema {
  tableName: string;
  rowCount: number;
  columns: SourceColumnInfo[];
  sampleRows: Record<string, any>[];
}

export interface SourceInspection {
  sourceId: string;
  sourceName: string;
  dbType: string;
  status: string;
  tables: SourceTableSchema[];
  totalRecords: number;
}

export interface SourceRecord {
  id: string;
  sourceDbId: string;
  sourceTable: string;
  sourceRecordId: string;
  rawData: Record<string, any>;
  extractedAt: string;
}

export interface EntityProvenance {
  entityId: string;
  contributingSources: string[];
  records: {
    sourceRecordId: string;
    sourceDbId: string;
    sourceDbName: string;
    sourceTable: string;
    extractedField?: string;
    rawData: Record<string, any>;
    extractedAt: string;
  }[];
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  label?: string;
  category?: string;
  riskLevel?: RiskLevel;
  risk_level?: RiskLevel;
  riskScore?: number;
  risk_score?: number;
  summary?: string;
  properties: Record<string, any>;
  tags: string[];
  aliases: string[];
  datasetId?: string;
  sourceDbId?: string;
  source_db_id?: string;
  sourceTable?: string;
  source_table?: string;
  sourceRecordId?: string;
  source_record_id?: string;
  provenance?: EntityProvenance;
  created_at?: string;
  updated_at?: string;
}

export interface Relationship {
  id: string;
  source_id: string;
  target_id: string;
  type: RelationshipType;
  label?: string;
  confidence: number;
  risk_level?: RiskLevel;
  sourceDbId?: string;
  source_db_id?: string;
  sourceTable?: string;
  source_table?: string;
  sourceRecordId?: string;
  source_record_id?: string;
  properties: Record<string, any>;
}

export interface LocationRecord {
  id: string;
  name: string;
  address?: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  type: 'WAREHOUSE' | 'CHECKPOINT' | 'PORT' | 'TOLL_PLAZA' | 'INCIDENT_SITE' | 'OFFICE' | 'TRANSIT_POINT';
  properties: Record<string, any>;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  eventType?: string;
  event_type?: string;
  timestamp: string;
  entityIds: string[];
  locationId?: string;
  location_id?: string;
  latitude?: number;
  longitude?: number;
  severity: RiskLevel;
  evidence: string[];
  properties: Record<string, any>;
}

export interface Anomaly {
  id: string;
  title: string;
  type: string;
  severity: RiskLevel;
  status: 'OPEN' | 'INVESTIGATING' | 'DISMISSED' | 'CONFIRMED';
  entityId: string;
  entityName: string;
  entityType: EntityType;
  description: string;
  evidence: {
    title: string;
    detail: string;
    timestamp?: string;
    metric?: string;
  }[];
  detectedAt: string;
  confidence: number;
}

export interface MergeCandidate {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  sourceName: string;
  targetName: string;
  type: EntityType;
  confidence: number;
  matchReasons: string[];
  status: 'PENDING' | 'MERGED' | 'REJECTED';
  sourceProps: Record<string, any>;
  targetProps: Record<string, any>;
  createdAt: string;
}

export interface Investigation {
  id: string;
  title: string;
  description: string;
  leadAnalyst: string;
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  entityIds: string[];
  entities?: Entity[];
  notes: {
    id: string;
    author: string;
    content: string;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  format: string;
  recordCount: number;
  entityCount: number;
  relationshipCount: number;
  uploadedAt: string;
  status: string;
  isActive?: boolean;
  isDemo?: boolean;
  detectedSchema?: any;
}

export interface GraphNode {
  data: {
    id: string;
    name: string;
    type: EntityType;
    riskLevel?: RiskLevel;
    riskScore?: number;
    category?: string;
    label?: string;
    sourceDbId?: string;
    sourceTable?: string;
    sourceRecordId?: string;
    properties: Record<string, any>;
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    type: RelationshipType;
    label?: string;
    confidence: number;
    riskLevel?: RiskLevel;
    sourceDbId?: string;
    sourceTable?: string;
    sourceRecordId?: string;
    properties: Record<string, any>;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AiInvestigationResponse {
  investigationId?: string;
  entitySummary?: string;
  knownFacts: string[];
  possibleRelationships: string[];
  discoveredPatterns?: string[];
  aiInterpretation: string;
  uncertainty: string;
  anomalyIndicators: string[];
  recommendedActions: string[];
  suggestedHopExpansions: string[];
  confidenceScore: number;
  rawGrokResponse?: string;
}

// AEGIS R1 Moving Entity & Maritime Types
export interface MovingEntity {
  id: string; // e.g. SHIP_419001234
  type: 'ship' | 'aircraft' | 'truck' | 'train' | 'shipment' | 'vehicle';
  mmsi?: string;
  imo?: string;
  name: string;
  vessel_type?: string;
  latitude: number;
  longitude: number;
  speed?: number; // Knots
  course?: number; // Degrees
  heading?: number; // Degrees
  destination?: string;
  eta?: string;
  status?: string; // in_transit, at_anchor, moored, etc.
  last_updated_at: string;
  properties?: Record<string, any>;
}

export interface EntityPositionHistory {
  id: string;
  entity_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  course?: number;
  timestamp: string;
  epoch_sec: number;
}

export interface MaritimePatternHypothesis {
  id: string;
  description: string;
  supporting_evidence: string[];
  confidence: number | null;
  status: 'supported' | 'weakly_supported' | 'unsupported' | 'unresolved' | 'investigating';
}

export interface MaritimePattern {
  pattern_id: string;
  type: string; // traffic_concentration, corridor_convergence, route_divergence
  region: string;
  time_window: string;
  entities_observed: number;
  baseline: number;
  deviation_percent: number;
  observation: string;
  hypotheses: MaritimePatternHypothesis[];
  status: 'detected' | 'investigating' | 'supported' | 'weakly_supported' | 'unsupported' | 'unresolved';
  detected_at: string;
  updated_at: string;
  ai_reasoning?: string;
}

export interface AisProviderStatus {
  connected: boolean;
  source: string;
  mode: 'LIVE_STREAM' | 'REPLAY_FEED';
  messageCount: number;
  lastMessageAt?: string;
  error?: string;
}


