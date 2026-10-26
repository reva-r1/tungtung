import { InvestigationContext, ReasoningOutput } from './types.js';
import { REASONING_ANALYST_SYSTEM_PROMPT } from './prompts.js';
import { getCloudLlmConfig, getOllamaConfig, isOllamaAvailable, LlmConfig } from './providers.js';
import dotenv from 'dotenv';

dotenv.config();

export function getLlmConfig(): LlmConfig {
  return getCloudLlmConfig();
}

export function parseProviderError(errMessage: string): {
  userFriendlyReason: string;
  diagnostics: {
    provider: string;
    model: string;
    statusCode?: number;
    errorType?: string;
    rawError?: string;
    retryAfterSec?: number;
  };
} {
  const is429 = errMessage.includes('429') || errMessage.toLowerCase().includes('rate limit') || errMessage.toLowerCase().includes('rate_limit');
  const isAuth = errMessage.includes('401') || errMessage.includes('403') || errMessage.toLowerCase().includes('api key');

  let retryAfterSec: number | undefined;
  const retryMatch = errMessage.match(/try again in ([\d\.]+)s/i) || errMessage.match(/retry-after[:=]\s*(\d+)/i);
  if (retryMatch) {
    retryAfterSec = Math.ceil(parseFloat(retryMatch[1]));
  }

  let errorType = 'provider_error';
  let userFriendlyReason = 'Language model service unavailable. Analysis completed using Revana\'s deterministic rule-based verification engine.';

  if (is429) {
    errorType = 'rate_limit_exceeded';
    userFriendlyReason = retryAfterSec
      ? `Language model rate limit reached (cooling down for ~${retryAfterSec}s). Switched seamlessly to local Ollama (llama3.2:3b) or rule-based verification engine.`
      : `Language model rate limit reached. Switched seamlessly to local Ollama (llama3.2:3b) or rule-based verification engine.`;
  } else if (isAuth) {
    errorType = 'authentication_failed';
    userFriendlyReason = 'Language model credentials unavailable. Operating in local Ollama or rule-based mode.';
  }

  // Scrub any potential keys or sensitive tokens from raw error for safety
  const sanitizedRaw = errMessage.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');

  const { provider, model } = getCloudLlmConfig();
  return {
    userFriendlyReason,
    diagnostics: {
      provider,
      model,
      statusCode: is429 ? 429 : (isAuth ? 401 : 500),
      errorType,
      rawError: sanitizedRaw,
      retryAfterSec,
    },
  };
}

/**
 * Execute reasoning completion with any OpenAI-compatible provider (Gemini, Groq, or Ollama)
 */
async function executeReasoningCall(
  context: InvestigationContext,
  config: LlmConfig,
  promptBody: string
): Promise<ReasoningOutput> {
  const { apiKey, baseUrl, model, provider } = config;
  const isLocalOllama = config.baseUrl.includes('11434');
  const timeoutMs = isLocalOllama ? 120000 : 25000;
  const systemPrompt = isLocalOllama
    ? `${REASONING_ANALYST_SYSTEM_PROMPT}\n\nIMPORTANT: Be concise and direct. Provide 2-5 high-confidence facts, 1-2 inferences, 1-2 hypotheses, and brief narrative sections to complete quickly.`
    : REASONING_ANALYST_SYSTEM_PROMPT;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptBody },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`${provider} HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty reasoning completion from LLM');

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error('Failed to parse JSON response from LLM');
    }
  }

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
    suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps)
      ? parsed.suggestedFollowUps.map(String)
      : [],
    uncertainty: parsed.uncertainty || undefined,
    aiInterpretation: parsed.aiInterpretation || parsed.summary || '',
    narrative: parsed.narrative && typeof parsed.narrative === 'object'
      ? {
          whatIFound: String(parsed.narrative.whatIFound || ''),
          howRecordsConnect: String(parsed.narrative.howRecordsConnect || ''),
          whatThisCouldMean: String(parsed.narrative.whatThisCouldMean || ''),
          whatWeShouldExamineNext: String(parsed.narrative.whatWeShouldExamineNext || ''),
        }
      : undefined,
  };

  return output;
}

/**
 * Analyst Stage: ONE LLM synthesis call converting all evidence into 4 honest claim tiers
 * Cascades: Cloud LLM -> Local Ollama (llama3.2:3b) -> Deterministic rule-based engine.
 */
export async function reasonOverEvidence(
  context: InvestigationContext,
  engine: 'llm' | 'deterministic-fallback'
): Promise<{
  output: ReasoningOutput;
  engine: 'llm' | 'deterministic-fallback';
  fallbackReason?: string;
  diagnostics?: {
    provider?: string;
    model?: string;
    statusCode?: number;
    errorType?: string;
    rawError?: string;
    retryAfterSec?: number;
  };
}> {
  // Format evidence items with IDs for the prompt
  // Prioritize evidence that matches prompt or target identifiers so relevant records are never missed
  const targetIds = context.targetIdentifiers || [];
  const prioritized = [...context.evidence].sort((a, b) => {
    const aStr = JSON.stringify(a.result || '').toLowerCase();
    const bStr = JSON.stringify(b.result || '').toLowerCase();
    const aMatches = targetIds.some((id) => aStr.includes(id.toLowerCase())) ? 1 : 0;
    const bMatches = targetIds.some((id) => bStr.includes(id.toLowerCase())) ? 1 : 0;
    return bMatches - aMatches;
  });
  const selectedEvidence = prioritized.slice(0, 12);

  const evidenceBlocks = selectedEvidence.map((ev) => {
    let resultStr = '';
    try {
      const res = ev.result;
      if (res && typeof res === 'object') {
        if (Array.isArray(res.results)) {
          resultStr = JSON.stringify({ totalMatches: res.totalMatches, sample: res.results.slice(0, 3) });
        } else if (Array.isArray(res.matchedRows)) {
          resultStr = JSON.stringify({ totalMatches: res.totalMatches, sample: res.matchedRows.slice(0, 3) });
        } else {
          resultStr = JSON.stringify(res);
        }
      } else {
        resultStr = String(res);
      }
      if (resultStr.length > 500) {
        resultStr = resultStr.slice(0, 500) + '...';
      }
    } catch (_) {
      resultStr = String(ev.result).slice(0, 500);
    }
    return `[Evidence ID: ${ev.id}] (${ev.tool}): ${resultStr}`;
  });

  const historyBlock =
    context.conversationHistory && context.conversationHistory.length > 0
      ? `PRIOR CONVERSATION HISTORY:\n${context.conversationHistory
          .map((h) => `${h.role === 'user' ? 'User' : 'Revana Intelligence'}: ${h.content}`)
          .join('\n\n')}\n\n`
      : '';

  const promptBody = `
${historyBlock}USER INVESTIGATION INQUIRY:
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
Synthesize an authoritative, human-sounding, evidence-driven intelligence briefing.
Explain the evidence and its significance, not merely the fact that you processed it.
Produce the single JSON object matching the required schema.
`;

  // Primary AI Engine: Local Ollama LLaMA (offline, 0 external API calls)
  if (await isOllamaAvailable()) {
    const ollamaConfig = getOllamaConfig();
    try {
      context.trace.push({
        step: 'reasoning_ollama_started',
        detail: { provider: ollamaConfig.provider, model: ollamaConfig.model },
        timestamp: new Date().toISOString(),
      });
      const output = await executeReasoningCall(context, ollamaConfig, promptBody);
      context.trace.push({
        step: 'reasoning_synthesis_complete',
        detail: {
          provider: ollamaConfig.provider,
          factsCount: output.facts.length,
          inferencesCount: output.inferences.length,
          hypothesesCount: output.hypotheses.length,
        },
        timestamp: new Date().toISOString(),
      });
      return { output, engine: 'llm' };
    } catch (ollamaErr: any) {
      console.warn('[Ollama Reason Warning]:', ollamaErr.message);
      context.trace.push({
        step: 'reasoning_ollama_fallback',
        detail: { error: ollamaErr.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Deterministic rule-based reasoning engine fallback
  context.trace.push({
    step: 'reasoning_fallback_triggered',
    detail: { reason: 'Ollama not active or completed via rule-based engine' },
    timestamp: new Date().toISOString(),
  });
  return {
    output: runDeterministicReasoning(context),
    engine: 'deterministic-fallback',
    fallbackReason: "Analysis synthesized using Revana's deterministic verification engine.",
  };
}

/**
 * Deterministic Reasoning Engine: synthesizes structured, conversational, evidence-driven claim tiers locally
 */
export function runDeterministicReasoning(context: InvestigationContext): ReasoningOutput {
  const facts: ReasoningOutput['facts'] = [];
  const inferences: ReasoningOutput['inferences'] = [];
  const hypotheses: ReasoningOutput['hypotheses'] = [];
  const background: ReasoningOutput['background'] = [];
  const nextSteps: ReasoningOutput['nextSteps'] = [];
  const discoveredPatterns: string[] = [];

  const directRecordFacts: { text: string; evidenceId: string; dataset?: string; data?: any }[] = [];
  const entityFacts: { name: string; type: string; dataset?: string; evidenceId: string }[] = [];
  let topHubEntity: { name: string; type: string; degree: number; dataset?: string } | null = null;
  let topBridgeCount = 0;
  let topCollisionCount = 0;

  // 1. Parse evidence items into grounded, natural language facts
  for (const ev of context.evidence) {
    if (ev.tool === 'get_live_world_summary') {
      const res = ev.result || {};
      facts.push({
        text: `Physical world model tracks ${res.total_entities_tracked ?? 0} physical entities across active sensor feeds with ${res.active_threshold_events_count ?? 0} active threshold alerts.`,
        evidenceIds: [ev.id],
      });
      if (res.active_threshold_events_count > 0) {
        discoveredPatterns.push(`Active physical threshold events detected (${res.active_threshold_events_count} events active).`);
      }
    } else if (ev.tool === 'search_records' && ev.result?.results?.length > 0) {
      for (const r of ev.result.results) {
        const factText = `Record in [${r.datasetFilename}] (Row #${r.rowIndex}): ${JSON.stringify(r.data).slice(0, 160)}`;
        facts.push({
          text: factText,
          evidenceIds: [ev.id],
        });
        directRecordFacts.push({
          text: factText,
          evidenceId: ev.id,
          dataset: r.datasetFilename,
          data: r.data,
        });
      }
    } else if (ev.tool === 'search_entity' && ev.result?.results?.length > 0) {
      const top = ev.result.results.slice(0, 4);
      for (const ent of top) {
        facts.push({
          text: `Identified entity "${ent.name}" (${ent.type}) registered in dataset [${ent.datasetFilename}].`,
          evidenceIds: [ev.id],
        });
        entityFacts.push({
          name: ent.name,
          type: ent.type,
          dataset: ent.datasetFilename,
          evidenceId: ev.id,
        });
        if (!topHubEntity) {
          topHubEntity = { name: ent.name, type: ent.type, degree: 1, dataset: ent.datasetFilename };
        }
      }
    } else if (ev.tool === 'detect_data_patterns' && ev.result?.patterns?.length > 0) {
      for (const p of ev.result.patterns.slice(0, 3)) {
        if (p.patternType === 'CENTRAL_HUB_NODES') {
          for (const evStr of (p.evidence || []).slice(0, 3)) {
            facts.push({
              text: evStr,
              evidenceIds: [ev.id],
            });
            const hubMatch = evStr.match(/^"([^"]+)"\s*\(([^,]+),\s*in\s*([^)]+)\)\s*has\s*(\d+)\s*direct/);
            if (hubMatch && (!topHubEntity || Number(hubMatch[4]) > topHubEntity.degree)) {
              topHubEntity = {
                name: hubMatch[1],
                type: hubMatch[2],
                dataset: hubMatch[3],
                degree: parseInt(hubMatch[4], 10),
              };
            }
          }
          discoveredPatterns.push(`Identified central connection hub: ${topHubEntity?.name || 'High-degree entity'}`);
        } else if (p.patternType === 'CROSS_DATASET_BRIDGES') {
          topBridgeCount += (p.evidence || []).length;
          for (const evStr of (p.evidence || []).slice(0, 2)) {
            facts.push({
              text: `Cross-dataset bridge: ${evStr}`,
              evidenceIds: [ev.id],
            });
          }
          discoveredPatterns.push(`Cross-dataset relationship bridges linking records across separate uploads.`);
        } else if (p.patternType === 'PROPERTY_COLLISIONS') {
          topCollisionCount += (p.evidence || []).length;
          for (const evStr of (p.evidence || []).slice(0, 2)) {
            facts.push({
              text: `Shared identifier match: ${evStr}`,
              evidenceIds: [ev.id],
            });
          }
          discoveredPatterns.push(`Shared identifier collisions detected across multiple entity records.`);
        } else {
          discoveredPatterns.push(p.description);
          for (const evStr of (p.evidence || []).slice(0, 2)) {
            facts.push({
              text: evStr,
              evidenceIds: [ev.id],
            });
          }
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

  // 2. Synthesize Human-Centered 4-Question Investigation Narrative
  let whatIFound = '';
  let howRecordsConnect = '';
  let whatThisCouldMean = '';
  let whatWeShouldExamineNext = '';

  const cleanName = topHubEntity ? topHubEntity.name.replace(/^.*Item #\d+\s*\((.+)\)$/, '$1') : '';
  const requestedIdentifiers = context.targetIdentifiers || [];

  if (directRecordFacts.length > 0) {
    // A. Query returned specific matching records (e.g. session, connection, file, or search query)
    const datasetsMatched = Array.from(new Set(directRecordFacts.map((f) => f.dataset).filter(Boolean)));
    const targetLabel = requestedIdentifiers.length > 0
      ? `for identifier(s) [${requestedIdentifiers.join(', ')}]`
      : `for "${context.prompt.slice(0, 60)}"`;
    whatIFound = `I retrieved ${directRecordFacts.length} record(s) ${targetLabel} across dataset(s) ${datasetsMatched.length > 0 ? datasetsMatched.map((d) => `[${d}]`).join(', ') : 'the uploaded logs'}.`;

    // Provide concrete detail from top matching records
    const sampleDetails = directRecordFacts.slice(0, 3).map((f, i) => {
      const rowData = f.data
        ? Object.entries(f.data).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(', ')
        : f.text;
      return `• Match #${i + 1} (${f.dataset || 'dataset'}): ${rowData}`;
    }).join('\n');
    whatIFound += `\n\n${sampleDetails}`;

    howRecordsConnect = `These records associate the target criteria with specific operational timestamps, observed endpoints, and related identifiers within the ingested dataset tables.`;
    whatThisCouldMean = `These observations establish direct factual evidence in the ingested records. They verify that activity matching your criteria was recorded at the specified dates and times.`;
    whatWeShouldExamineNext = `Examine adjacent records immediately preceding and succeeding these timestamps to verify the complete sequence and inspect connected session or host attributes.`;

    inferences.push({
      text: `Direct records confirm recorded operations for ${requestedIdentifiers.join(', ') || 'the requested criteria'}.`,
      basedOnFactIndexes: [0],
      reasoning: `${directRecordFacts.length} exact tabular matches retrieved across active datasets.`,
    });

    hypotheses.push({
      text: `Events linked to ${requestedIdentifiers[0] || 'the target'} represent an active operation or sequence of records.`,
      whyPlausible: `Direct log entries confirm existence and timestamps in the database.`,
      plausibility: 'high',
      confirmWith: 'Review full raw rows and chronological neighbors in the Datasets view.',
      refuteWith: 'Verify whether records indicate standard scheduled processes or automated service traffic.',
    });
  } else if (requestedIdentifiers.length > 0) {
    // B. User explicitly requested specific identifiers, but zero records matched
    whatIFound = `I searched across all active datasets for identifier(s) [${requestedIdentifiers.join(', ')}], but no matching records were found in the current ingestion.`;
    howRecordsConnect = `The ingested database does not contain rows referencing these identifiers.`;
    whatThisCouldMean = `The absence of these identifiers in the current files means the uploaded logs do not document activity for these specific keys. This does not preclude activity occurring in systems not captured in this dataset.`;
    whatWeShouldExamineNext = `Verify identifier spelling, check alternative session or transaction tables, or upload additional relevant log archives.`;

    inferences.push({
      text: `No active records document activity for ${requestedIdentifiers.join(', ')}.`,
      basedOnFactIndexes: [],
      reasoning: 'Tabular database search returned zero matching rows.',
    });
  } else if (topHubEntity && /hub|central|connect|network|graph|overview|top/i.test(context.prompt)) {
    // C. User explicitly asked about network topology, hubs, or central nodes
    whatIFound = `Analysis of graph topology indicates a central connection point at "${cleanName}", which connects to ${topHubEntity.degree} direct relationships across ${topHubEntity.dataset || 'the uploaded files'}.`;
    howRecordsConnect = `These records link "${cleanName}" directly to multiple systems, entities, and operational events documented in the dataset.`;
    whatThisCouldMean = `This entity sits at a central crossroad in the relationship graph. High connectivity is typical for shared infrastructure, service accounts, or central distribution hubs.`;
    whatWeShouldExamineNext = `Examine chronological connection bursts and check whether connectivity patterns deviate from baseline operations.`;

    inferences.push({
      text: `Graph connectivity converges around "${cleanName}".`,
      basedOnFactIndexes: [0],
      reasoning: `${topHubEntity.degree} direct recorded relationships connect this node.`,
    });

    hypotheses.push({
      text: `Activity linked to "${cleanName}" represents a central coordination point or shared infrastructure.`,
      whyPlausible: `High connection degree observed in graph topology.`,
      plausibility: 'medium',
      confirmWith: 'Check event timestamps for corresponding outbound or inbound transfers.',
      refuteWith: 'Establish that node represents nominal default infrastructure.',
    });
  } else if (facts.length > 0) {
    // D. General factual observations
    whatIFound = `I reviewed the records and found ${facts.length} relevant observation(s) directly related to your inquiry.`;
    howRecordsConnect = `These records document specific events, accounts, and system actions recorded in the active files.`;
    whatThisCouldMean = `These observations establish direct factual evidence in the database.`;
    whatWeShouldExamineNext = `Examine supporting evidence items and verify chronological sequences.`;

    inferences.push({
      text: 'Recorded relationships demonstrate direct links across the active records.',
      basedOnFactIndexes: facts.length >= 2 ? [0, 1] : [0],
      reasoning: 'Observations derived from ingested database records.',
    });
  } else {
    // E. No matches found
    whatIFound = `I searched across the ingested records for your inquiry, but found no direct records or entities matching those criteria.`;
    howRecordsConnect = `The current records do not show an explicit connection for this search query.`;
    whatThisCouldMean = `The absence of a record in the current files means the uploaded logs do not mention this keyword or identifier.`;
    whatWeShouldExamineNext = `Try searching for specific identifiers, dataset column names, or upload additional relevant logs.`;
  }

  // 3. Grounded Inferences & Hypotheses from proposed relationships
  if (context.proposedRelationships.length > 0) {
    for (const pr of context.proposedRelationships) {
      hypotheses.push({
        text: `Potential relationship: ${pr.source_id} -> [${pr.type}] -> ${pr.target_id}`,
        whyPlausible: pr.rationale,
        plausibility: 'medium',
        confirmWith: 'Verify multi-hop events or transaction links in uploaded files.',
        refuteWith: 'Lack of shared session identifiers or conflicting timestamp sequences.',
        suggestedTool: 'find_path',
      });
    }
  }

  // 4. Domain-Adaptive Background Standard
  const domainBackground: Record<string, string> = {
    logistics: 'Correlating structured records across tables and identifiers enables tracing transaction chains and verifying entity associations.',
    maritime: 'Monitoring vessel telemetry against historical corridors helps detect navigational deviations and unusual loitering.',
    world: 'Correlating physical sensor telemetry across geographic zones helps confirm operational state transitions.',
    cross: 'Cross-referencing multiple observational data feeds provides verifiable evidence without relying on single-source assumptions.',
  };
  background.push({
    text: domainBackground[context.primaryDomain] || domainBackground.cross,
  });

  // 5. Actionable Next Steps
  if (directRecordFacts.length > 0) {
    nextSteps.push({
      text: 'Filter datasets view by the matched timestamps to observe concurrent system events.',
    });
    nextSteps.push({
      text: 'Query the Intelligence Graph for secondary hops from the identified session or host nodes.',
    });
  } else if (topHubEntity) {
    nextSteps.push({
      text: `Inspect "${topHubEntity.name}" in the Entity Dossier and highlight its multi-hop neighborhood in the Intelligence Graph.`,
    });
    nextSteps.push({
      text: 'Examine associated identifiers to verify related organizational or infrastructure assets.',
    });
  } else {
    nextSteps.push({
      text: 'Inspect connected nodes and multi-hop paths in the Graph visualizer.',
    });
    nextSteps.push({
      text: 'Verify source records in the Datasets module to validate record authenticity.',
    });
  }

  // 6. Grounded Suggested Follow-Ups
  const suggestedFollowUps: string[] = [];
  if (directRecordFacts.length > 0) {
    if (requestedIdentifiers.length > 0) {
      suggestedFollowUps.push(`Show all events immediately preceding and following ${requestedIdentifiers[0]}`);
    }
    suggestedFollowUps.push('Which other entities share records in this dataset?');
    suggestedFollowUps.push('What is the chronological sequence of these matched records?');
  } else if (topHubEntity) {
    suggestedFollowUps.push(`Show all ${topHubEntity.degree} direct connections for "${topHubEntity.name}"`);
    suggestedFollowUps.push(`Which of these relationships have direct supporting records?`);
  } else if (facts.length > 0) {
    suggestedFollowUps.push('Which of these relationships have direct supporting evidence?');
    suggestedFollowUps.push('What is the shortest recorded path between these entities?');
    suggestedFollowUps.push('Show only records from the selected time period');
  } else {
    suggestedFollowUps.push('Search for entity aliases or partial name matches');
    suggestedFollowUps.push('List all active uploaded datasets');
    suggestedFollowUps.push('Inspect overall graph topology metrics');
  }

  const aiInterpretation = `${whatIFound}\n\n${howRecordsConnect}\n\n${whatThisCouldMean}\n\n${whatWeShouldExamineNext}`;
  const summary = whatIFound;

  return {
    summary,
    facts,
    inferences,
    hypotheses,
    background,
    nextSteps,
    discoveredPatterns,
    anomalyIndicators: discoveredPatterns,
    suggestedHopExpansions: topHubEntity ? [topHubEntity.name] : [],
    suggestedFollowUps,
    narrative: {
      whatIFound,
      howRecordsConnect,
      whatThisCouldMean,
      whatWeShouldExamineNext,
    },
    uncertainty: context.dataGaps.length > 0
      ? `Data gaps identified: ${context.dataGaps.join('; ')}`
      : 'Grounded against current active database records. A high connection count alone does not establish suspicious activity.',
    aiInterpretation,
  };
}
