import { InvestigationContext, EvidenceItem, Domain } from './types.js';
import { getActiveTools, toOpenAiTools, executeToolByName, toolRegistry } from './tools/index.js';
import { DOMAIN_SYSTEM_PROMPTS } from './prompts.js';
import { parseProviderError } from './reason.js';
import dotenv from 'dotenv';

dotenv.config();

export const MAX_EXPLORE_ITERATIONS = 3;

import { getCloudLlmConfig, getOllamaConfig, isOllamaAvailable, LlmConfig } from './providers.js';

export function getLlmConfig(): LlmConfig {
  return getCloudLlmConfig();
}

export interface RetrieveResult {
  evidence: EvidenceItem[];
  context: InvestigationContext;
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
}

/**
 * Execute tool-calling loop using any OpenAI-compatible provider (Gemini, Groq, or Ollama)
 */
async function executeToolLoop(context: InvestigationContext, config: LlmConfig): Promise<RetrieveResult> {
  const { apiKey, baseUrl, model, provider } = config;
  const systemPrompt = DOMAIN_SYSTEM_PROMPTS[context.primaryDomain] || DOMAIN_SYSTEM_PROMPTS.cross;
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (context.conversationHistory && context.conversationHistory.length > 0) {
    for (const turn of context.conversationHistory) {
      messages.push({ role: turn.role, content: turn.content });
    }
  }

  messages.push({
    role: 'user',
    content: `Explore and investigate this question using available tools:\n"${context.prompt}"${
      context.seedEntityId ? `\n(Focus Entity: ${context.seedEntityId})` : ''
    }\n\nYou may call tools speculatively to explore patterns, cross-correlate, or test ideas. You have up to ${MAX_EXPLORE_ITERATIONS} iterations. When you have sufficient evidence, stop calling tools.`,
  });

  let iteration = 0;
  let evidenceCounter = context.evidence.length + 1;

  while (iteration < MAX_EXPLORE_ITERATIONS) {
    iteration++;
    const currentActiveTools = getActiveTools(context.primaryDomain, context.unlockedDomains);
    const openAiTools = toOpenAiTools(currentActiveTools);

    context.trace.push({
      step: `explore_iteration_${iteration}`,
      detail: {
        provider,
        model,
        activeToolCount: currentActiveTools.length,
        unlockedDomains: Array.from(context.unlockedDomains),
      },
      timestamp: new Date().toISOString(),
    });

    const timeoutMs = baseUrl.includes('11434') ? 60000 : 25000;
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: openAiTools,
        tool_choice: iteration === MAX_EXPLORE_ITERATIONS ? 'none' : 'auto',
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`${provider} HTTP ${res.status}: ${errorText}`);
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
}

/**
 * Explore Stage: Autonomous tool-calling loop (Up to 3 iterations)
 * Uses local Ollama LLaMA (llama3.2:3b) as sole LLM model, with fast deterministic local data retrieval fallback.
 */
export async function retrieveEvidence(context: InvestigationContext): Promise<RetrieveResult> {
  // 1. Primary AI Tool-calling Engine: Local Ollama LLaMA
  if (await isOllamaAvailable()) {
    try {
      const ollamaConfig = getOllamaConfig();
      context.trace.push({
        step: 'ollama_primary_selected',
        detail: { provider: ollamaConfig.provider, model: ollamaConfig.model },
        timestamp: new Date().toISOString(),
      });
      return await executeToolLoop(context, ollamaConfig);
    } catch (ollamaErr: any) {
      console.warn('[Ollama Retrieve Warning]:', ollamaErr.message);
      context.trace.push({
        step: 'ollama_failed',
        detail: { error: ollamaErr.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 2. Local Deterministic Retrieval across database, datasets & sensors
  context.trace.push({
    step: 'retrieve_engine_selected',
    detail: { engine: 'deterministic-fallback', reason: 'Running local deterministic sensor & dataset retrieval' },
    timestamp: new Date().toISOString(),
  });
  return runDeterministicRetrieve(context, 'Operating with local intelligence store');
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
    await pushEv('detect_data_patterns', {});

    // Target specific identifiers if extracted from query
    if (context.targetIdentifiers && context.targetIdentifiers.length > 0) {
      for (const tid of context.targetIdentifiers) {
        await pushEv('search_records', { query: tid, limit: 15 });
        await pushEv('search_entity', { query: tid, limit: 8 });
      }
    } else {
      await pushEv('search_records', { query: context.prompt, limit: 10 });
      await pushEv('search_entity', { query: context.prompt, limit: 8 });
    }

    // Check if user specifically requested a CSV file
    const csvMatches = context.prompt.match(/[a-zA-Z0-9_\-]+\.csv/gi);
    if (csvMatches) {
      for (const csv of csvMatches) {
        await pushEv('search_records', { datasetFilename: csv, limit: 15 });
      }
    }

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
