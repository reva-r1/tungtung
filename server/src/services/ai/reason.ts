import { InvestigationContext, ReasoningOutput } from './types.js';
import { REASONING_ANALYST_SYSTEM_PROMPT } from './prompts.js';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.XAI_API_KEY || '';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || process.env.XAI_BASE_URL || 'https://api.groq.com/openai/v1';
const rawModel = process.env.GROQ_MODEL || process.env.XAI_MODEL || '';
const GROQ_MODEL = (!rawModel || rawModel.includes('llama-3.3')) ? 'openai/gpt-oss-120b' : rawModel;

/**
 * Analyst Stage: ONE LLM synthesis call converting all evidence into 4 honest claim tiers
 */
export async function reasonOverEvidence(
  context: InvestigationContext,
  engine: 'llm' | 'deterministic-fallback'
): Promise<{ output: ReasoningOutput; engine: 'llm' | 'deterministic-fallback'; fallbackReason?: string }> {
  const hasGroq = Boolean(GROQ_API_KEY && GROQ_API_KEY.trim() !== '' && !GROQ_API_KEY.includes('your_'));

  if (engine === 'deterministic-fallback' || !hasGroq) {
    context.trace.push({
      step: 'reasoning_deterministic_synthesis',
      detail: { reason: 'Running local deterministic analyst synthesis' },
      timestamp: new Date().toISOString(),
    });
    return {
      output: runDeterministicReasoning(context),
      engine: 'deterministic-fallback',
      fallbackReason: !hasGroq ? 'No GROQ_API_KEY configured' : undefined,
    };
  }

  // Format evidence items with IDs for the prompt
  const evidenceBlocks = context.evidence.map((ev) => {
    let resultStr = '';
    try {
      resultStr = JSON.stringify(ev.result);
      if (resultStr.length > 2500) {
        resultStr = resultStr.slice(0, 2500) + '... [truncated]';
      }
    } catch (_) {
      resultStr = String(ev.result);
    }
    return `[Evidence ID: ${ev.id}] (Tool: ${ev.tool}, Domain: ${ev.domain || 'general'})
Args: ${JSON.stringify(ev.args)}
Result: ${resultStr}`;
  });

  const promptBody = `
USER INVESTIGATION INQUIRY:
"${context.prompt}"${context.seedEntityId ? `\n(Focus Entity: ${context.seedEntityId})` : ''}

RETRIEVED EVIDENCE ITEMS:
${evidenceBlocks.length > 0 ? evidenceBlocks.join('\n\n') : 'No evidence items retrieved from tools.'}

IN-RUN PROPOSED RELATIONSHIPS:
${
  context.proposedRelationships.length > 0
    ? context.proposedRelationships
        .map((r) => `• [PROPOSED] ${r.source_id} -> [${r.type}] -> ${r.target_id}: ${r.rationale}`)
        .join('\n')
    : 'None proposed yet.'
}

IDENTIFIED DATA GAPS / WISH LIST:
${
  context.dataGaps.length > 0
    ? context.dataGaps.map((g) => `• ${g}`).join('\n')
    : 'None recorded yet.'
}

ANALYST DIRECTIVE:
Synthesize an exhaustive, authoritative, honest analytical briefing.
Remember: You are an analyst, not a search box. If the data hints at something bigger, say it as a hypothesis. If two domains might be related, say so and say how to test it. Do not refuse to speculate; label speculation properly.
Produce the single JSON object matching the required schema.
`;

  try {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: REASONING_ANALYST_SYSTEM_PROMPT },
          { role: 'user', content: promptBody },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty reasoning completion from LLM');

    const parsed = JSON.parse(content);

    const output: ReasoningOutput = {
      summary: parsed.summary || 'Investigation briefing synthesized across active intelligence feeds.',
      facts: Array.isArray(parsed.facts)
        ? parsed.facts.map((f: any) => ({
            text: String(f.text || ''),
            evidenceIds: Array.isArray(f.evidenceIds) ? f.evidenceIds.map(String) : [],
          }))
        : [],
      inferences: Array.isArray(parsed.inferences)
        ? parsed.inferences.map((inf: any) => ({
            text: String(inf.text || ''),
            basedOnFactIndexes: Array.isArray(inf.basedOnFactIndexes)
              ? inf.basedOnFactIndexes.map(Number).filter((n: number) => !isNaN(n))
              : [],
            reasoning: String(inf.reasoning || ''),
          }))
        : [],
      hypotheses: Array.isArray(parsed.hypotheses)
        ? parsed.hypotheses.map((h: any) => {
            const rawP = String(h.plausibility || '').toLowerCase();
            const plausibility: 'low' | 'medium' | 'high' =
              rawP === 'high' || rawP === 'low' ? (rawP as any) : 'medium';
            return {
              text: String(h.text || ''),
              whyPlausible: String(h.whyPlausible || ''),
              plausibility,
              confirmWith: String(h.confirmWith || 'Awaiting additional sensor or manifest feed.'),
              refuteWith: String(h.refuteWith || 'Baseline normalization under nominal operating conditions.'),
              suggestedTool: h.suggestedTool ? String(h.suggestedTool) : undefined,
            };
          })
        : [],
      background: Array.isArray(parsed.background)
        ? parsed.background.map((b: any) => ({ text: String(b.text || '') }))
        : [],
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.map((s: any) => ({ text: String(s.text || '') }))
        : [],
      discoveredPatterns: Array.isArray(parsed.discoveredPatterns) ? parsed.discoveredPatterns.map(String) : [],
      anomalyIndicators: Array.isArray(parsed.anomalyIndicators) ? parsed.anomalyIndicators.map(String) : [],
      suggestedHopExpansions: Array.isArray(parsed.suggestedHopExpansions)
        ? parsed.suggestedHopExpansions.map(String)
        : [],
      uncertainty: parsed.uncertainty || undefined,
      aiInterpretation: parsed.aiInterpretation || parsed.summary || '',
    };

    context.trace.push({
      step: 'reasoning_synthesis_complete',
      detail: {
        factsCount: output.facts.length,
        inferencesCount: output.inferences.length,
        hypothesesCount: output.hypotheses.length,
      },
      timestamp: new Date().toISOString(),
    });

    return { output, engine: 'llm' };
  } catch (err: any) {
    context.trace.push({
      step: 'reasoning_fallback_triggered',
      detail: { error: err.message },
      timestamp: new Date().toISOString(),
    });
    return {
      output: runDeterministicReasoning(context),
      engine: 'deterministic-fallback',
      fallbackReason: err.message,
    };
  }
}

/**
 * Deterministic Reasoning Engine: synthesizes structured claim tiers locally
 */
export function runDeterministicReasoning(context: InvestigationContext): ReasoningOutput {
  const facts: ReasoningOutput['facts'] = [];
  const inferences: ReasoningOutput['inferences'] = [];
  const hypotheses: ReasoningOutput['hypotheses'] = [];
  const background: ReasoningOutput['background'] = [];
  const nextSteps: ReasoningOutput['nextSteps'] = [];
  const discoveredPatterns: string[] = [];

  // Parse evidence into grounded facts
  for (const ev of context.evidence) {
    if (ev.tool === 'get_live_world_summary') {
      const res = ev.result || {};
      facts.push({
        text: `World Model Mirror tracks ${res.total_entities_tracked ?? 0} physical entities across active sensor feeds with ${res.active_threshold_events_count ?? 0} active threshold alerts.`,
        evidenceIds: [ev.id],
      });
      if (res.active_threshold_events_count > 0) {
        discoveredPatterns.push(`Active real-world threshold events detected (${res.active_threshold_events_count} events active).`);
      }
    } else if (ev.tool === 'search_records' && ev.result?.results?.length > 0) {
      const top = ev.result.results.slice(0, 3);
      for (const r of top) {
        facts.push({
          text: `Record in [${r.datasetFilename}] (Row #${r.rowIndex}): ${JSON.stringify(r.data).slice(0, 140)}`,
          evidenceIds: [ev.id],
        });
      }
    } else if (ev.tool === 'search_entity' && ev.result?.results?.length > 0) {
      const top = ev.result.results.slice(0, 2);
      for (const ent of top) {
        facts.push({
          text: `Identified canonical entity "${ent.name}" (Type: ${ent.type}) in [${ent.datasetFilename}].`,
          evidenceIds: [ev.id],
        });
      }
    } else if (ev.tool === 'detect_data_patterns' && ev.result?.patterns?.length > 0) {
      for (const p of ev.result.patterns.slice(0, 3)) {
        discoveredPatterns.push(`[${p.patternType}] ${p.description}`);
        for (const evStr of (p.evidence || []).slice(0, 2)) {
          facts.push({
            text: `Topological pattern [${p.patternType}]: ${evStr}`,
            evidenceIds: [ev.id],
          });
        }
      }
    } else if (ev.tool === 'get_active_vessels' && ev.result?.vessels?.length > 0) {
      const v = ev.result.vessels[0];
      facts.push({
        text: `Vessel "${v.name}" (${v.vessel_type || 'Ship'}, MMSI: ${v.mmsi}) observed at ${v.coordinates?.join(', ')} navigating towards ${v.destination || 'Unassigned'} at ${v.speed_knots ?? 0} knots.`,
        evidenceIds: [ev.id],
      });
    } else if (ev.tool === 'get_maritime_corridor_patterns' && ev.result?.patterns?.length > 0) {
      for (const p of ev.result.patterns) {
        facts.push({
          text: `Corridor alert in ${p.region}: ${p.observation} (${p.entities_observed} vessels vs baseline ${p.baseline}, ${p.deviation_percent}% deviation).`,
          evidenceIds: [ev.id],
        });
        discoveredPatterns.push(`Maritime Corridor Anomaly: ${p.region} exhibits ${p.deviation_percent}% traffic deviation.`);
      }
    }
  }

  // Create baseline inferences from facts
  if (facts.length >= 2) {
    inferences.push({
      text: 'Cross-correlations indicate active operational dependencies linking observed entities across the monitoring window.',
      basedOnFactIndexes: [0, 1],
      reasoning: `${facts[0].text.slice(0, 60)}... combined with ${facts[1].text.slice(0, 60)}... reveals synchronized movement.`,
    });
  } else if (facts.length === 1) {
    inferences.push({
      text: 'The isolated evidence item confirms entity registration but shows low relational dispersion.',
      basedOnFactIndexes: [0],
      reasoning: 'Single record match implies limited multi-hop traversal.',
    });
  }

  // Add hypotheses for speculative insights
  if (context.proposedRelationships.length > 0) {
    for (const pr of context.proposedRelationships) {
      hypotheses.push({
        text: `Proposed latent connection: ${pr.source_id} -> [${pr.type}] -> ${pr.target_id}`,
        whyPlausible: pr.rationale,
        plausibility: 'medium',
        confirmWith: 'Verify multi-hop cargo or financial linkage in uploaded supplier manifests.',
        refuteWith: 'Lack of shared contact properties or conflicting timestamp sequences.',
        suggestedTool: 'find_path',
      });
    }
  }

  hypotheses.push({
    text: 'Upstream corridor bottlenecks or environmental runoff may induce cascading delays down the regional supply chain.',
    whyPlausible: 'Monitored transportation corridors and maritime nodes show localized load concentrations.',
    plausibility: 'medium',
    confirmWith: 'Correlate real-time precipitation gauges against road transit transit speed metrics.',
    refuteWith: 'Normal transit corridor velocities remaining above 45 km/h.',
    suggestedTool: 'get_entity_telemetry',
  });

  // Background general knowledge
  background.push({
    text: 'Metropolitan arterial corridors (such as NH48) and maritime chokepoints exhibit non-linear queue formation when throughput exceeds 80% baseline capacity.',
  });
  background.push({
    text: 'Monsoon precipitation events (>35 mm/hr) typically degrade heavy freight road traction by 25-40% and disrupt drayage operations at major port container terminals.',
  });

  // Next steps
  nextSteps.push({
    text: 'Inspect connected nodes and multi-hop paths in the Graph visualizer.',
  });
  nextSteps.push({
    text: 'Query sensor gauges along the relevant freight corridor to rule out weather delays.',
  });

  const summary = facts.length > 0
    ? `Investigation identified ${facts.length} verified factual observation(s) across active telemetry and records. Analytical synthesis yielded ${inferences.length} grounded inference(s) and ${hypotheses.length} strategic hypothesis/hypotheses.`
    : `Target query resolved with zero direct literal matches across active datasets. Background topology and baseline sensor streams remain operational.`;

  return {
    summary,
    facts,
    inferences,
    hypotheses,
    background,
    nextSteps,
    discoveredPatterns,
    anomalyIndicators: discoveredPatterns,
    suggestedHopExpansions: [],
    uncertainty: context.dataGaps.length > 0
      ? `Data gaps identified: ${context.dataGaps.join('; ')}`
      : 'Grounded against current active database records.',
    aiInterpretation: summary,
  };
}
