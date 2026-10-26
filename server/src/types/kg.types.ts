import { Entity, EntityType, GraphData, RelationshipType, RiskLevel } from './index.js';

export type TripleStatus = 'unreviewed' | 'verified' | 'rejected';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type FileType = 'csv' | 'text' | 'pdf' | 'json';

export interface ProvenancedTriple {
  id: string; // Deterministic sha256(subject_id + predicate + object_id + source_file)
  subjectEntityId: string;
  subjectName: string;
  subjectType: string;
  predicate: string;
  objectEntityId: string;
  objectName: string;
  objectType: string;
  sourceFile: string;
  sourceRow?: number;
  sourceSpan?: string; // Text excerpt or offset
  extractorModel: string; // e.g. 'revana_adapter_universal_v1' | 'deterministic_csv'
  extractorVersion: string;
  confidence: number; // 0.0 to 1.0 (uncalibrated model or rule score)
  status: TripleStatus;
  observedAt?: string; // ISO 8601 timestamp of event/call/transaction
  properties?: Record<string, any>;
  createdAt: string;
}

export interface PipelineJob {
  id: string;
  fileName: string;
  filePath?: string;
  fileType: FileType;
  status: JobStatus;
  progress: number; // 0 to 100
  triplesExtracted: number;
  entitiesResolved: number;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Universal GraphStore contract.
 * Backed by SQLiteGraphStore today, swappable to FalkorDB or any graph store in the future.
 */
export interface GraphStore {
  /**
   * Upsert a verified or unreviewed triple into the store.
   * Returns deterministic edge ID.
   */
  upsertTriple(triple: ProvenancedTriple): Promise<string>;

  /**
   * Retrieve N-hop neighborhood subgraph around an entity.
   */
  neighbors(entityId: string, hops?: number): Promise<GraphData>;

  /**
   * Shortest path traversal between two entities.
   */
  shortestPath(sourceId: string, targetId: string, maxDepth?: number): Promise<Entity[]>;

  /**
   * Cascade purge all triples and derived graph artifacts originating from a source file.
   * Returns count of purged records.
   */
  purgeBySource(sourceFile: string): Promise<number>;
}

export interface CanonicalMapping {
  canonicalType: EntityType;
  category: string;
  defaultRisk: RiskLevel;
}

export interface PredicateRule {
  canonicalPredicate: RelationshipType;
  allowedSubjectTypes: string[];
  allowedObjectTypes: string[];
  description: string;
}
