// Core Types for Data Connector Layer and World Model Engine

export type CoverageArea = 'global' | 'country' | 'state' | 'city';
export type UpdateFrequency = 'realtime' | 'near_realtime' | 'hourly' | 'daily' | 'static';
export type AuthRequirement = 'none' | 'api_key' | 'oauth';
export type CommercialUsePolicy = 'unknown' | 'allowed' | 'restricted';

export type ProviderHealthState = 
  | 'HEALTHY'
  | 'DEGRADED'
  | 'DOWN'
  | 'RATE_LIMITED'
  | 'CIRCUIT_OPEN';

export interface RateLimitConfig {
  requestsPerMinute: number;
  maxBurst?: number;
  backoffMs: number;
  pollIntervalMs: number;
  cacheTtlSeconds: number;
}

export interface LegalMetadata {
  license: string;
  attribution: string;
  commercialUse: CommercialUsePolicy;
  commercialUseNotes?: string;
  rateLimitTerms?: string;
  termsUrl: string;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  category: 
    | 'WEATHER'
    | 'AIR_QUALITY'
    | 'MARINE'
    | 'EARTHQUAKES'
    | 'NATURAL_EVENTS'
    | 'GEOSPATIAL'
    | 'AVIATION'
    | 'PUBLIC_TRANSPORT'
    | 'MOBILITY'
    | 'INDIA_GOVERNMENT'
    | 'WATER'
    | 'ENERGY'
    | 'FINANCE'
    | 'NEWS_EVENTS'
    | 'MOCK';
  description: string;
  coverage: CoverageArea;
  coverageDetails?: string;
  updateFrequency: UpdateFrequency;
  authentication: AuthRequirement;
  envKeyName?: string;
  endpointUrl: string;
  rateLimit: RateLimitConfig;
  legal: LegalMetadata;
}

export interface ProviderHealthMetrics {
  status: ProviderHealthState;
  consecutiveFailures: number;
  lastSuccessfulUpdate: string | null;
  lastError: string | null;
  lastErrorTimestamp: string | null;
  latencyMs: number;
  recordsReceived: number;
  recordsRejected: number;
  recordsNormalized: number;
  rateLimitRemaining: number;
  rateLimitResetEpoch: number;
  stalenessMs: number;
}

export interface ObservationLocation {
  latitude: number;
  longitude: number;
  geometry?: any | null;
  altitudeM?: number | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface ObservationProvenance {
  source: string;
  provider: string;
  endpoint: string;
  retrievedAt: string;
  observedAt: string;
  updatedAt?: string;
  originalId?: string;
  originalPayloadReference?: string;
  [key: string]: any;
}

export type ObservationQuality = 'VERIFIED' | 'PRELIMINARY' | 'ESTIMATED' | 'UNCERTAIN';

export interface NormalizedObservation {
  id: string;
  entity_id: string;
  entity_type: string;
  data_type: string;
  value: Record<string, any>;
  location: ObservationLocation;
  timestamp: string; // ISO8601
  observed_at: string; // ISO8601
  source: string;
  provider: string;
  confidence: number | null; // 0.0 - 1.0
  quality: ObservationQuality | null;
  ttl: number | null; // seconds
  provenance: ObservationProvenance;
  raw_payload?: Record<string, any>;
}

export interface InferredRelationship {
  relationship_id: string;
  relationship_type: string;
  source_entity_id: string;
  target_entity_id: string;
  source: string;
  timestamp: string;
  confidence: number;
  evidence: string[];
}

export interface WorldEvent {
  event_id: string;
  event_type: string;
  entity_id: string;
  previous_state: Record<string, any>;
  current_state: Record<string, any>;
  detected_at: string;
  source: string;
  confidence: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
}

export interface TemporalStateRecord {
  id: string;
  entity_id: string;
  timestamp: string;
  previous_state: Record<string, any> | null;
  new_state: Record<string, any>;
  delta_summary: Record<string, any>;
  source: string;
  recorded_at: string;
}

export interface WorldEntityState {
  id: string;
  type: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  current_state: Record<string, any>;
  status: string;
  confidence: number;
  last_observed_at: string;
  last_provider: string;
  created_at: string;
  updated_at: string;
  is_simulated?: boolean;
}

export interface SimulationInstance {
  id: string;
  name: string;
  description: string;
  base_snapshot_time: string;
  status: 'ACTIVE' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  modified_entity_count: number;
}
