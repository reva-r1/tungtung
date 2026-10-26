import { db } from '../../db/database.js';
import { EvidenceItem, FactClaim, HypothesisClaim, InferenceClaim, ReasoningOutput, VerificationResult } from '../ai/types.js';
import { verifyClaims } from '../ai/verify.js';
import { getCloudLlmConfig, getOllamaConfig, isOllamaAvailable, LlmConfig } from '../ai/providers.js';
import { graphStore, SQLiteGraphStore } from './sqliteGraphStore.js';
import { GraphData } from '../../types/index.js';

export interface KgReasoningResponse {
  entityId: string;
  entityName: string;
  hopsExplored: number;
  subgraphStats: {
    nodeCount: number;
    edgeCount: number;
    contributingSources: string[];
  };
  reasoning: {
    summary: string;
    verifiedFacts: FactClaim[];
    verifiedInferences: InferenceClaim[];
    hypotheses: HypothesisClaim[];
    demotedClaims: HypothesisClaim[];
  };
  verification: {
    groundedRatio: number;
    totalFactsExamined: number;
    demotedFactsCount: number;
    demotedInferencesCount: number;
    isFullyGrounded: boolean;
  };
  evidenceEdges: Array<{
    id: string;
    source: string;
    predicate: string;
    target: string;
    sourceFile: string;
    span?: string;
  }>;
}

const EPISTEMIC_REASONER_SYSTEM_PROMPT = `You are Revana Technologies Epistemic Investigative Reasoner (Stage 3).
Your job is to analyze connected evidence from an entity's local knowledge graph neighborhood and produce evidence-grounded findings.

STRICT EPISTEMIC HIERARCHY RULES:
1. FACT TIER:
   - Must be directly and explicitly attested by one or more provided Evidence IDs (e.g. edge IDs like "rel_abc123").
   - Every fact MUST cite the exact "evidenceIds" in an array (e.g. ["rel_abc123"]).
   - Do NOT assert facts that do not exist in the evidence.

2. INFERENCE TIER:
   - Logical deductions derived from combination of two or more verified facts.
   - Must specify "basedOnFactIndexes" (zero-based integer indices of the supporting facts).
   - Must provide "reasoning" explaining the deductive link.

3. HYPOTHESIS TIER:
   - Forward-looking investigative possibilities, suspected fraud patterns, or coordination theories.
   - "plausibility" MUST be strictly one of: "low" | "medium" | "high".
   - DO NOT generate artificial numeric percentages (such as "87% confidence").
   - Specify "whyPlausible", "confirmWith", and "refuteWith".

Return STRICT JSON:
{
  "summary": "High-level investigative overview of the entity's network and activity.",
  "facts": [
    {
      "text": "Entity A called Entity B on 14 Oct.",
      "evidenceIds": ["rel_xyz"]
    }
  ],
  "inferences": [
    {
      "text": "Entity A and Entity B coordinated prior to vessel departure.",
      "basedOnFactIndexes": [0],
      "reasoning": "Phone call occurred 2 hours before declared sailing window."
    }
  ],
  "hypotheses": [
    {
      "text": "Entity A may be acting as an onshore broker for the illicit cargo transfer.",
      "whyPlausible": "Coinciding phone calls with vessel operator and financial escrow company.",
      "plausibility": "high",
      "confirmWith": "Subpoena cellular cell tower location data for time of call",
      "refuteWith": "Confirm legitimate shipping agency employment contract"
    }
  ]
}`;

export class KgReasonerService {
  /**
   * Execute epistemic reasoning over an entity's graph neighborhood.
   */
  static async analyzeEntity(params: {
    entityId: string;
    hops?: number;
    question?: string;
  }): Promise<KgReasoningResponse> {
    const { entityId, question } = params;
    const hops = Math.min(3, Math.max(1, params.hops || 2));
    const now = new Date().toISOString();

    // 1. Fetch seed entity details
    const seedEntity = db.prepare('SELECT id, name, type, category FROM entities WHERE id = ?').get(entityId) as any;
    const entityName = seedEntity ? seedEntity.name : entityId;

    // 2. Fetch local subgraph via graphStore (fixed API, no SQL generation by model)
    const subgraph: GraphData = await graphStore.neighbors(entityId, hops);

    // Collect contributing sources
    const contributingSources = Array.from(
      new Set(
        subgraph.edges
          .map((e) => e.data.properties?.source_file)
          .filter(Boolean) as string[]
      )
    );

    // Map graph edges and nodes to strict EvidenceItem objects
    const nodeMap = new Map(subgraph.nodes.map((n) => [n.data.id, n.data]));
    const evidenceItems: EvidenceItem[] = [];
    const evidenceEdges: Array<{ id: string; source: string; predicate: string; target: string; sourceFile: string; span?: string }> = [];

    for (const edge of subgraph.edges) {
      const srcName = nodeMap.get(edge.data.source)?.name || edge.data.source;
      const tgtName = nodeMap.get(edge.data.target)?.name || edge.data.target;
      const pred = edge.data.label || edge.data.type;
      const sourceFile = edge.data.properties?.source_file || 'graph';
      const span = edge.data.properties?.source_span;
      const observedAt = edge.data.properties?.observed_at;

      evidenceEdges.push({
        id: edge.data.id,
        source: srcName,
        predicate: pred,
        target: tgtName,
        sourceFile,
        span,
      });

      evidenceItems.push({
        id: edge.data.id,
        tool: 'graphStore.neighbors',
        args: { entityId, hops },
        result: {
          edgeId: edge.data.id,
          source: srcName,
          sourceType: nodeMap.get(edge.data.source)?.type || 'ENTITY',
          predicate: pred,
          target: tgtName,
          targetType: nodeMap.get(edge.data.target)?.type || 'ENTITY',
          observedAt,
          sourceFile,
          span,
        },
        retrievedAt: now,
        domain: 'cross',
      });
    }

    // 3. Prepare Prompt Body
    const evidenceText = evidenceItems
      .map(
        (ev, i) =>
          `[Evidence ID: ${ev.id}] ${ev.result.source} (${ev.result.sourceType}) --[${ev.result.predicate}]--> ${ev.result.target} (${ev.result.targetType}) | Source: ${ev.result.sourceFile}${ev.result.observedAt ? ' | Time: ' + ev.result.observedAt : ''}${ev.result.span ? ' | Detail: "' + ev.result.span + '"' : ''}`
      )
      .join('\n');

    const userPrompt = `Investigative Target: "${entityName}" (ID: ${entityId})
Graph Subgraph Neighbors (${hops} hops): ${subgraph.nodes.length} entities, ${subgraph.edges.length} relationships.
${question ? `Specific Investigation Inquiry: "${question}"\n` : ''}
Retrieved Graph Evidence Items:
${evidenceText || 'No connected edges found in local graph.'}

Analyze the network evidence above according to the strict epistemic hierarchy (FACT with cited evidenceIds, INFERENCE, HYPOTHESIS with plausibility).`;

    // 4. Invoke LLM (Local Ollama LLaMA only)
    let rawParsed: any = null;
    let config: LlmConfig | null = null;

    try {
      if (await isOllamaAvailable()) {
        config = getOllamaConfig();
      }
    } catch (_) {}

    if (config && evidenceItems.length > 0) {
      try {
        const res = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: EPISTEMIC_REASONER_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(35000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            try {
              rawParsed = JSON.parse(content);
            } catch (_) {
              const m = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (m) rawParsed = JSON.parse(m[1]);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[KgReasonerService] LLM call failed (${err?.message || err}). Generating deterministic analysis.`);
      }
    }

    // 5. Deterministic fallback if LLM offline
    if (!rawParsed) {
      const facts = evidenceEdges.map((e) => ({
        text: `${e.source} is linked to ${e.target} via ${e.predicate} in ${e.sourceFile}.`,
        evidenceIds: [e.id],
      }));

      // Dynamically detect any algorithmic anomaly edges present in this entity's graph
      const rendezvousEdges = evidenceEdges.filter((e) => e.predicate === 'RENDEZVOUS_WITH');
      const discrepancyEdges = evidenceEdges.filter((e) => e.predicate === 'EXHIBITS_DISCREPANCY');
      const blackoutEdges = evidenceEdges.filter(
        (e) => e.predicate === 'INVOLVED_IN' && (e.target.includes('TRANSPONDER_OFF') || (e.span && e.span.includes('TRANSPONDER_OFF')))
      );
      const observationEdges = evidenceEdges.filter(
        (e) => e.predicate.includes('INVOLVED_IN') || e.predicate.includes('RECORDED_AT') || e.predicate.includes('OBSERVATION') || e.predicate.includes('EXHIBITS_DISCREPANCY')
      );

      let inferences: InferenceClaim[] = [];
      let hypotheses: HypothesisClaim[] = [];
      let summary = `Graph neighborhood for "${entityName}" contains ${subgraph.nodes.length} connected entities across ${subgraph.edges.length} relationships.`;

      // Full Multi-Modal Triad: Rendezvous + Physical Displacement Surge + AIS Blackout
      if (rendezvousEdges.length > 0 && (discrepancyEdges.length > 0 || blackoutEdges.length > 0)) {
        const partnerName = rendezvousEdges[0].target;
        summary = `Investigative analysis for "${entityName}": Algorithmic fusion detected high-confidence Ship-to-Ship (STS) rendezvous with "${partnerName}" combined with physical displacement discrepancies.`;

        if (facts.length >= 2) {
          inferences.push({
            text: `Vessel "${entityName}" conducted offshore Ship-to-Ship (STS) dark cargo transfer with feeder vessel "${partnerName}".`,
            basedOnFactIndexes: [0, Math.min(1, facts.length - 1)],
            reasoning: `Spatio-temporal co-location with "${partnerName}" coincident with physical cargo discrepancy/blackout observations.`,
          });
        }

        hypotheses.push({
          text: `Target vessel "${entityName}" engaged in customs tariff misclassification fraud and illicit transshipment with "${partnerName}".`,
          whyPlausible: `Algorithmic rendezvous detection correlates with physical displacement jump exceeding declared cargo manifest.`,
          plausibility: 'high' as const,
          confirmWith: `Subpoena satellite synthetic aperture radar (SAR) imagery for rendezvous coordinates and inspect cargo manifolds.`,
          refuteWith: `Inspect certified offshore bunkering receipts and verified commercial cargo transfer licenses.`,
        });
      }
      // Partial Discrepancy without confirmed Rendezvous partner
      else if (observationEdges.length > 0) {
        const obsDescriptions = observationEdges.map((o) => o.target).slice(0, 3).join('; ');
        summary = `Investigative analysis for "${entityName}": Identified ${observationEdges.length} physical observation/telemetry records in local neighborhood (${obsDescriptions}).`;

        if (facts.length >= 2) {
          inferences.push({
            text: `Vessel "${entityName}" exhibits physical telemetry anomalies recorded in ${Array.from(new Set(observationEdges.map((o) => o.sourceFile))).join(', ')}.`,
            basedOnFactIndexes: [0, Math.min(1, facts.length - 1)],
            reasoning: `Correlated ${observationEdges.length} distinct observation records in local neighborhood.`,
          });
        }

        hypotheses.push({
          text: `Physical discrepancies for "${entityName}" indicate potential unrecorded mid-voyage activity or cargo variance requiring physical port inspection.`,
          whyPlausible: `Recorded anomalies: ${obsDescriptions}.`,
          plausibility: 'medium' as const,
          confirmWith: 'Cross-reference vessel logbooks, fuel receipts, and port authority sensor readings.',
          refuteWith: 'Verify official maintenance logs or certified surveyor inspection reports.',
        });
      } else {
        if (facts.length >= 2) {
          inferences.push({
            text: `"${entityName}" functions as a connection hub linking multiple network nodes.`,
            basedOnFactIndexes: [0, 1],
            reasoning: 'Co-occurrence across multiple relational edges in the local subgraph.',
          });
        }

        hypotheses.push({
          text: `Entity "${entityName}" warrants expanded multi-hop tracing across external financial or registry databases.`,
          whyPlausible: `Observed connectivity across ${contributingSources.length} distinct source feeds.`,
          plausibility: 'medium' as const,
          confirmWith: 'Execute 3-hop shortest-path search to known watchlist entities.',
          refuteWith: 'Establish verified commercial clearance certificates.',
        });
      }

      rawParsed = {
        summary,
        facts,
        inferences,
        hypotheses,
      };
    }

    // 6. Strict Verification using Revana's verifyClaims
    const rawFacts: FactClaim[] = Array.isArray(rawParsed.facts) ? rawParsed.facts : [];
    const rawInferences: InferenceClaim[] = Array.isArray(rawParsed.inferences) ? rawParsed.inferences : [];
    const rawHypotheses: HypothesisClaim[] = Array.isArray(rawParsed.hypotheses)
      ? rawParsed.hypotheses.map((h: any) => ({
          text: String(h.text || ''),
          whyPlausible: String(h.whyPlausible || ''),
          plausibility: ['low', 'medium', 'high'].includes(h.plausibility) ? h.plausibility : 'medium',
          confirmWith: String(h.confirmWith || ''),
          refuteWith: String(h.refuteWith || ''),
        }))
      : [];

    const verifiedResult: VerificationResult = verifyClaims(
      rawFacts,
      rawInferences,
      rawHypotheses,
      [],
      evidenceItems
    );

    const isFullyGrounded = verifiedResult.demotedFacts.length === 0 && verifiedResult.demotedInferences.length === 0;

    return {
      entityId,
      entityName,
      hopsExplored: hops,
      subgraphStats: {
        nodeCount: subgraph.nodes.length,
        edgeCount: subgraph.edges.length,
        contributingSources,
      },
      reasoning: {
        summary: rawParsed.summary || `Epistemic analysis for ${entityName}`,
        verifiedFacts: verifiedResult.verifiedFacts,
        verifiedInferences: verifiedResult.verifiedInferences,
        hypotheses: verifiedResult.allHypotheses,
        demotedClaims: [...verifiedResult.demotedFacts, ...verifiedResult.demotedInferences],
      },
      verification: {
        groundedRatio: verifiedResult.confidenceScore,
        totalFactsExamined: rawFacts.length,
        demotedFactsCount: verifiedResult.demotedFacts.length,
        demotedInferencesCount: verifiedResult.demotedInferences.length,
        isFullyGrounded,
      },
      evidenceEdges,
    };
  }
}
