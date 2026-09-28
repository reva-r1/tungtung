import { InvestigationContext, EvidenceItem, Domain } from './types.js';
import { getActiveTools, toOpenAiTools, executeToolByName, toolRegistry } from './tools/index.js';
import { DOMAIN_SYSTEM_PROMPTS } from './prompts.js';
import dotenv from 'dotenv';

dotenv.config();

export const MAX_EXPLORE_ITERATIONS = 10;

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.XAI_API_KEY || '';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || process.env.XAI_BASE_URL || 'https://api.groq.com/openai/v1';
const rawModel = process.env.GROQ_MODEL || process.env.XAI_MODEL || '';
const GROQ_MODEL = (!rawModel || rawModel.includes('llama-3.3')) ? 'openai/gpt-oss-120b' : rawModel;

export interface RetrieveResult {
  evidence: EvidenceItem[];
  context: InvestigationContext;
  engine: 'llm' | 'deterministic-fallback';
  fallbackReason?: string;
}

/**
 * Explore Stage: Autonomous tool-calling loop (Up to 10 iterations)
 * Begins with the routed domain tools and supports mid-run unlocks via request_domain_tools
 */
export async function retrieveEvidence(context: InvestigationContext): Promise<RetrieveResult> {
  const hasGroq = Boolean(GROQ_API_KEY && GROQ_API_KEY.trim() !== '' && !GROQ_API_KEY.includes('your_'));

  if (!hasGroq) {
    context.trace.push({
      step: 'retrieve_engine_selected',
      detail: { engine: 'deterministic-fallback', reason: 'No GROQ_API_KEY configured' },
      timestamp: new Date().toISOString(),
    });
    return runDeterministicRetrieve(context, 'No GROQ_API_KEY configured');
  }

  try {
    const systemPrompt = DOMAIN_SYSTEM_PROMPTS[context.primaryDomain] || DOMAIN_SYSTEM_PROMPTS.cross;
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Explore and investigate this question using available tools:\n"${context.prompt}"${
          context.seedEntityId ? `\n(Focus Entity: ${context.seedEntityId})` : ''
        }\n\nYou may call tools speculatively to explore patterns, cross-correlate, or test ideas. You have up to ${MAX_EXPLORE_ITERATIONS} iterations. When you have sufficient evidence, stop calling tools.`,
      },
    ];

    let iteration = 0;
    let evidenceCounter = 1;

    while (iteration < MAX_EXPLORE_ITERATIONS) {
      iteration++;
      const currentActiveTools = getActiveTools(context.primaryDomain, context.unlockedDomains);
      const openAiTools = toOpenAiTools(currentActiveTools);

      context.trace.push({
        step: `explore_iteration_${iteration}`,
        detail: {
          activeToolCount: currentActiveTools.length,
          unlockedDomains: Array.from(context.unlockedDomains),
        },
        timestamp: new Date().toISOString(),
      });

      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          tools: openAiTools,
          tool_choice: iteration === MAX_EXPLORE_ITERATIONS ? 'none' : 'auto',
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq HTTP ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as any;
      const choice = data.choices?.[0];
      const responseMessage = choice?.message;

      if (!responseMessage) {
        throw new Error('Empty response from LLM during retrieval loop.');
      }

      messages.push(responseMessage);

      // If tools were called
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, any> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (_) {}

          const evidenceId = `ev_${evidenceCounter++}`;
          const toolResult = await executeToolByName(toolName, toolArgs, context);

          const toolDef = toolRegistry.get(toolName);
          const evidenceItem: EvidenceItem = {
            id: evidenceId,
            tool: toolName,
            args: toolArgs,
            result: toolResult,
            retrievedAt: new Date().toISOString(),
            domain: toolDef?.domain === 'meta' ? undefined : (toolDef?.domain as Domain),
          };

          context.evidence.push(evidenceItem);
          context.trace.push({
            step: 'evidence_collected',
            detail: { id: evidenceId, tool: toolName, args: toolArgs },
            timestamp: new Date().toISOString(),
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(toolResult),
          });
        }
      } else {
        // Agent decided it has gathered enough evidence
        context.trace.push({
          step: 'explore_concluded_by_agent',
          detail: { iteration, totalEvidenceItems: context.evidence.length },
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    return {
      evidence: context.evidence,
      context,
      engine: 'llm',
    };
  } catch (err: any) {
    context.trace.push({
      step: 'retrieve_error_fallback',
      detail: { error: err.message },
      timestamp: new Date().toISOString(),
    });
    return runDeterministicRetrieve(context, err.message);
  }
}

/**
 * Deterministic Retrieval Fallback: Runs local database/sensor queries according to domain
 */
export async function runDeterministicRetrieve(
  context: InvestigationContext,
  reason: string
): Promise<RetrieveResult> {
  let counter = context.evidence.length + 1;

  const pushEv = async (tool: string, args: Record<string, any>) => {
    const res = await executeToolByName(tool, args, context);
    const id = `ev_${counter++}`;
    const toolDef = toolRegistry.get(tool);
    context.evidence.push({
      id,
      tool,
      args,
      result: res,
      retrievedAt: new Date().toISOString(),
      domain: toolDef?.domain === 'meta' ? undefined : (toolDef?.domain as Domain),
    });
    context.trace.push({
      step: 'deterministic_evidence_collected',
      detail: { id, tool, args },
      timestamp: new Date().toISOString(),
    });
  };

  const domain = context.primaryDomain;

  if (domain === 'world' || domain === 'cross') {
    await pushEv('get_live_world_summary', {});
    await pushEv('get_live_events', {});
    if (context.seedEntityId) {
      await pushEv('get_entity_telemetry', { entityId: context.seedEntityId });
    } else {
      await pushEv('search_world_entities', { query: context.prompt });
    }
  }

  if (domain === 'logistics' || domain === 'cross') {
    await pushEv('detect_data_patterns', { focusTopic: context.prompt });
    await pushEv('search_records', { query: context.prompt, limit: 10 });
    await pushEv('search_entity', { query: context.prompt, limit: 8 });
    if (context.seedEntityId) {
      await pushEv('get_entity', { entityId: context.seedEntityId });
      await pushEv('get_connections', { entityId: context.seedEntityId, hops: 1 });
    }
  }

  if (domain === 'maritime' || domain === 'cross') {
    await pushEv('get_maritime_corridor_patterns', {});
    await pushEv('get_active_vessels', { limit: 10 });
    if (context.seedEntityId) {
      await pushEv('get_vessel_details', { vesselId: context.seedEntityId });
    } else {
      await pushEv('search_vessels', { query: context.prompt, limit: 6 });
    }
  }

  return {
    evidence: context.evidence,
    context,
    engine: 'deterministic-fallback',
    fallbackReason: reason,
  };
}
