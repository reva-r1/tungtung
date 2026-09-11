// AEGIS Intel Domain Types

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

export interface RawRecord {
  id: string;
  datasetId: string;
  rowIndex: number;
  rawData: Record<string, any>;
  createdAt: string;
}

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

export interface SourceRecord {
  id: string;
  sourceDbId: string;
  sourceTable: string;
  sourceRecordId: string;
  rawData: Record<string, any>;
  extractedAt: string;
}

export interface EntitySourceLink {
  entityId: string;
  sourceRecordId: string;
  sourceDbId: string;
  sourceTable: string;
  extractedField?: string;
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

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  label?: string;
  category?: string;
  riskLevel: RiskLevel;
  riskScore: number; // 0 to 100
  summary?: string;
  properties: Record<string, any>;
  tags: string[];
  aliases: string[];
  datasetId?: string;
  sourceDatasetId?: string;
  sourceRecordId?: string;
  sourceDbId?: string;
  sourceTable?: string;
  sourceIds?: string[];
  sourceRecords?: SourceRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  label?: string;
  confidence: number; // 0 to 1.0
  properties: Record<string, any>;
  riskLevel?: RiskLevel;
  datasetId?: string;
  sourceDatasetId?: string;
  sourceRecordId?: string;
  sourceDbId?: string;
  sourceTable?: string;
  createdAt: string;
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
  eventType: 
    | 'DEPARTURE'
    | 'ARRIVAL'
    | 'CHECKPOINT_PASS'
    | 'INSPECTION'
    | 'ANOMALY_DETECTED'
    | 'ROUTE_DEVIATION'
    | 'DRIVER_HANDOVER'
    | 'CARGO_TRANSFER'
    | 'FINANCIAL_WIRE'
    | 'CUSTOMS_CLEARANCE';
  timestamp: string;
  entityIds: string[]; // Connected entities
  locationId?: string;
  latitude?: number;
  longitude?: number;
  severity: RiskLevel;
  evidence: string[];
  properties: Record<string, any>;
}

export type AnomalyType =
  | 'IMPOSSIBLE_SPEED'
  | 'OFF_ROUTE_DEVIATION'
  | 'RELATIONSHIP_SURGE'
  | 'DUPLICATE_IDENTITY'
  | 'ORPHANED_MANIFEST'
  | 'UNAUTHORIZED_HANDOVER'
  | 'WEIGHT_DISCREPANCY';

export interface Anomaly {
  id: string;
  title: string;
  type: AnomalyType;
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
  confidence: number; // e.g. 0.92
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
  format: 'CSV' | 'JSON' | 'EXCEL' | 'REST_API' | 'SYNTHETIC';
  recordCount: number;
  entityCount: number;
  relationshipCount: number;
  uploadedAt: string;
  status: 'LOADED' | 'PROCESSING' | 'ERROR';
  detectedSchema?: {
    columns: { name: string; type: string; inferredEntity?: EntityType }[];
    missingValues: number;
    duplicateRows: number;
  };
}

export interface GraphNode {
  data: {
    id: string;
    name: string;
    type: EntityType;
    riskLevel: RiskLevel;
    riskScore: number;
    category?: string;
    label?: string;
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

