export type Domain = 'world' | 'logistics' | 'maritime' | 'cross';

export type ClaimTier = 'FACT' | 'INFERENCE' | 'HYPOTHESIS' | 'BACKGROUND';

export type Plausibility = 'low' | 'medium' | 'high';

export interface EvidenceItem {
  id: string; // e.g. 'ev_1', 'ev_2'
  tool: string;
  args: Record<string, any>;
  result: any;
  retrievedAt: string;
  domain?: Domain;
}

export interface ProposedRelationshipItem {
  source_id: string;
  target_id: string;
  type: string;
  rationale: string;
  status: 'PROPOSED';
}

export interface TraceStep {
  step: string;
  detail?: any;
  timestamp: string;
}

export interface FactClaim {
  text: string;
  evidenceIds: string[];
  verified?: boolean;
  verificationNote?: string;
}

export interface InferenceClaim {
  text: string;
  basedOnFactIndexes: number[];
  reasoning: string;
}

export interface HypothesisClaim {
  text: string;
  whyPlausible: string;
  plausibility: Plausibility;
  confirmWith: string;
  refuteWith: string;
  suggestedTool?: string;
  unverifiedNote?: string;
}

export interface BackgroundClaim {
  text: string;
}

export interface NextStepClaim {
  text: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  domain: Domain | 'meta';
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: Record<string, any>, context: InvestigationContext) => Promise<any> | any;
}

export interface InvestigationContext {
  prompt: string;
  seedEntityId?: string;
  primaryDomain: Domain;
  unlockedDomains: Set<Domain>;
  domainUnlockLogs: Array<{ domain: string; reason: string; timestamp: string }>;
  evidence: EvidenceItem[];
  proposedRelationships: ProposedRelationshipItem[];
  dataGaps: string[];
  trace: TraceStep[];
}

export interface ReasoningOutput {
  summary: string;
  facts: FactClaim[];
  inferences: InferenceClaim[];
  hypotheses: HypothesisClaim[];
  background: BackgroundClaim[];
  nextSteps: NextStepClaim[];
  discoveredPatterns?: string[];
  anomalyIndicators?: string[];
  suggestedHopExpansions?: string[];
  uncertainty?: string;
  aiInterpretation?: string;
}

export interface VerificationResult {
  verifiedFacts: FactClaim[];
  demotedFacts: HypothesisClaim[];
  verifiedInferences: InferenceClaim[];
  demotedInferences: HypothesisClaim[];
  allHypotheses: HypothesisClaim[];
  confidenceScore: number;
  groundingSummary: string;
  stalenessSeconds: number;
}
