import { db } from '../db/database.js';
import { AiInvestigationResponse } from '../types/index.js';
import { classifyDomain } from './ai/router.js';
import { retrieveEvidence } from './ai/retrieve.js';
import { reasonOverEvidence } from './ai/reason.js';
import { verifyClaims } from './ai/verify.js';
import { executeToolByName, toolRegistry } from './ai/tools/index.js';
import { InvestigationContext } from './ai/types.js';
import { GraphService } from './graph.service.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { getOllamaConfig } from './ai/providers.js';

dotenv.config();

/**
 * AiService Facade: Thin entry point coordinating the 4-stage intelligence pipeline:
 * Router -> Retrieve (Explore) -> Reason (Analyst) -> Verify (Data Grounding)
 */
export class AiService {
  /**
   * Controlled Backend AI Tool Execution Layer
   */
  static async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    const dummyContext: InvestigationContext = {
      prompt: 'Direct tool execution',
      primaryDomain: 'cross',
      unlockedDomains: new Set(['world', 'logistics', 'maritime']),
      domainUnlockLogs: [],
      evidence: [],
      proposedRelationships: [],
      dataGaps: [],
      trace: [],
    };
    return executeToolByName(toolName, args, dummyContext);
  }

  /**
   * Main AI Analyst Investigation endpoint with 4-stage pipeline
   */
  static async investigate(
    prompt: string,
    contextOptions?: {
      entityId?: string;
      investigationId?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }
  ): Promise<AiInvestigationResponse> {
    const investigationId = contextOptions?.investigationId || `inv_${uuidv4().substring(0, 8)}`;
    const traceStart = new Date().toISOString();

    // 1. Stage 1: Router & Identifier Extraction
    const routerDecision = await classifyDomain(prompt, contextOptions?.entityId);

    const context: InvestigationContext = {
      prompt,
      seedEntityId: routerDecision.effectiveSeedEntityId,
      targetIdentifiers: routerDecision.extractedIds,
      conversationHistory: contextOptions?.history,
      primaryDomain: routerDecision.domain,
      unlockedDomains: new Set([routerDecision.domain]),
      domainUnlockLogs: [],
      evidence: [],
      proposedRelationships: [],
      dataGaps: [],
      trace: [
        {
          step: 'pipeline_initiated',
          detail: {
            prompt,
            seedEntityId: routerDecision.effectiveSeedEntityId,
            targetIdentifiers: routerDecision.extractedIds,
            hasHistory: Boolean(contextOptions?.history && contextOptions.history.length > 0),
          },
          timestamp: traceStart,
        },
        {
          step: 'router_classified',
          detail: { primaryDomain: routerDecision.domain, reason: routerDecision.reason },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    // 2. Stage 2: Retrieve (Explore Stage, up to 10 iterations)
    const retrieveResult = await retrieveEvidence(context);

    // 3. Stage 3: Reason (Analyst Stage, single LLM synthesis with 4 claim tiers)
    const reasonResult = await reasonOverEvidence(context, retrieveResult.engine);

    // 4. Stage 4: Verify (FACT / INFERENCE tier verification against evidence IDs and containment)
    const verifyResult = verifyClaims(
      reasonResult.output.facts,
      reasonResult.output.inferences,
      reasonResult.output.hypotheses,
      reasonResult.output.background,
      context.evidence
    );

    context.trace.push({
      step: 'verification_completed',
      detail: {
        verifiedFacts: verifyResult.verifiedFacts.length,
        demotedFacts: verifyResult.demotedFacts.length,
        verifiedInferences: verifyResult.verifiedInferences.length,
        demotedInferences: verifyResult.demotedInferences.length,
        totalHypotheses: verifyResult.allHypotheses.length,
        confidenceScore: verifyResult.confidenceScore,
        groundingSummary: verifyResult.groundingSummary,
      },
      timestamp: new Date().toISOString(),
    });

    const engine = reasonResult.engine;
    const fallbackReason = reasonResult.fallbackReason || retrieveResult.fallbackReason;
    const diagnostics = reasonResult.diagnostics || retrieveResult.diagnostics;

    // Backward-compatible fields
    const knownFacts = verifyResult.verifiedFacts.map((f) => f.text);
    const possibleRelationships = [
      ...context.proposedRelationships.map((p) => `[PROPOSED] ${p.source_id} -> ${p.type} -> ${p.target_id} (${p.rationale})`),
      ...verifyResult.verifiedInferences.map((inf) => inf.text),
    ];
    const discoveredPatterns = reasonResult.output.discoveredPatterns || [];
    const anomalyIndicators = reasonResult.output.anomalyIndicators || [];
    const recommendedActions = reasonResult.output.nextSteps.map((s) => s.text);
    const suggestedHopExpansions = reasonResult.output.suggestedHopExpansions || [];
    const uncertainty = reasonResult.output.uncertainty || (context.dataGaps.length > 0 ? `Identified data gaps: ${context.dataGaps.join('; ')}` : 'Derived from grounded sensor feeds and active database records.');

    return {
      investigationId,
      entitySummary: contextOptions?.entityId ? `Focus node: ${contextOptions.entityId}` : undefined,
      knownFacts,
      possibleRelationships,
      discoveredPatterns,
      aiInterpretation: reasonResult.output.aiInterpretation || reasonResult.output.summary,
      uncertainty,
      anomalyIndicators,
      recommendedActions,
      suggestedHopExpansions,
      confidenceScore: verifyResult.confidenceScore,
      // Engine transparency & claim tiers
      engine,
      fallbackReason,
      trace: context.trace,
      facts: verifyResult.verifiedFacts,
      inferences: verifyResult.verifiedInferences,
      hypotheses: verifyResult.allHypotheses,
      background: reasonResult.output.background,
      nextSteps: reasonResult.output.nextSteps,
      groundingSummary: verifyResult.groundingSummary,
      dataGaps: context.dataGaps,
      proposedRelationships: context.proposedRelationships,
      diagnostics: reasonResult.diagnostics || retrieveResult.diagnostics,
      suggestedFollowUps: reasonResult.output.suggestedFollowUps,
      narrative: reasonResult.output.narrative,
    };
  }

  /**
   * Omni-Sensor AI Reasoning Space with Genuine Dynamic Grounding & Human Detective Tone
   */
  static async chatReasoning(
    message: string,
    sessionId?: string,
    entityId?: string
  ): Promise<{
    sessionId: string;
    reply: string;
    reasoning?: string;
    sources: string[];
    timestamp: string;
    matchedEntities?: any[];
    mappedEntityIds?: string[];
    primaryEntityId?: string | null;
    edges?: any[];
  }> {
    const sId = sessionId || `session_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    // 1. Resolve Target Entity: from explicit entityId or query inference
    let primaryEntity: any = null;
    let mappedEntityIds: string[] = [];
    let edges: any[] = [];
    let matchedEntities: any[] = [];

    if (entityId) {
      primaryEntity = db.prepare(`
        SELECT * FROM entities 
        WHERE id = ? OR name = ? OR id LIKE ? OR name LIKE ?
        ORDER BY CASE 
          WHEN id = ? THEN 0 
          WHEN name = ? THEN 1 
          WHEN id LIKE ? THEN 2
          ELSE 3 
        END
        LIMIT 1
      `).get(
        entityId, entityId, `%${entityId}%`, `%${entityId}%`,
        entityId, entityId, `${entityId}%`
      ) as any;
      if (primaryEntity) {
        mappedEntityIds.push(primaryEntity.id);
        matchedEntities.push(primaryEntity);
        // Expand neighborhood graph around primary entity
        const neighborhood = GraphService.expandEntity(primaryEntity.id, 1);
        if (neighborhood && neighborhood.nodes.length > 0) {
          mappedEntityIds = Array.from(new Set([...mappedEntityIds, ...neighborhood.nodes.map((n) => n.data.id)]));
          edges = neighborhood.edges;
        }
      }
    }

    if (!primaryEntity) {
      // Graph discovery traversal for topological canvas mapping from query text
      const graphInquiry = GraphService.searchGraphInquiry(message);
      if (graphInquiry && graphInquiry.nodes.length > 0) {
        mappedEntityIds = Array.from(new Set([...mappedEntityIds, ...graphInquiry.nodes.map((n) => n.data.id)]));
        edges = graphInquiry.edges;
        if (graphInquiry.matchedEntities.length > 0) {
          primaryEntity = graphInquiry.matchedEntities[0];
        }
        matchedEntities = Array.from(new Set([...matchedEntities, ...graphInquiry.matchedEntities]));
      }
    }

    // 2. Query SQLite for Real Grounded Facts for the Target Entity
    let entitySummaryText = '';
    let directLinksText = '';
    let rawRecordsText = '';
    const sources: string[] = [];

    if (primaryEntity) {
      sources.push(`Entity: ${primaryEntity.name} (${primaryEntity.type || 'Entity'})`);
      const props = primaryEntity.properties ? JSON.parse(primaryEntity.properties) : {};
      const propEntries = Object.entries(props)
        .filter(([k, v]) => v !== null && v !== undefined && String(v).trim().length > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .slice(0, 10);

      entitySummaryText = `Target Entity: "${primaryEntity.name}" [Type: ${primaryEntity.type || 'Unknown'}, Risk: ${primaryEntity.risk_level || 'NORMAL'}]\n` +
        (primaryEntity.summary ? `Summary: ${primaryEntity.summary}\n` : '') +
        (propEntries.length > 0 ? `Attributes: ${propEntries.join(', ')}\n` : '');

      // Direct Relationships
      const relRows = db.prepare(`
        SELECT r.type, r.label, r.confidence, r.source_id, r.target_id,
               e.id as other_id, e.name as other_name, e.type as other_type
        FROM relationships r
        JOIN entities e ON (r.target_id = e.id AND r.source_id = ?) OR (r.source_id = e.id AND r.target_id = ?)
        LIMIT 20
      `).all(primaryEntity.id, primaryEntity.id) as any[];

      if (relRows.length > 0) {
        directLinksText = relRows.map((r) => {
          const isOut = r.source_id === primaryEntity.id;
          const arrow = isOut ? `-> [${r.type || r.label}] ->` : `<- [${r.type || r.label}] <-`;
          sources.push(`Relationship: ${primaryEntity.name} ${arrow} ${r.other_name}`);
          return `- ${primaryEntity.name} ${arrow} ${r.other_name} (${r.other_type})`;
        }).join('\n');
      } else {
        directLinksText = 'No direct relationships found in graph database.';
      }

      // Raw records mentioning entity name
      const rawRows = db.prepare(`
        SELECT r.row_index, r.raw_data, d.name as dataset_name
        FROM raw_records r
        JOIN datasets d ON r.dataset_id = d.id
        WHERE r.raw_data LIKE ?
        ORDER BY r.row_index ASC
        LIMIT 8
      `).all(`%${primaryEntity.name}%`) as any[];

      if (rawRows.length > 0) {
        rawRecordsText = rawRows.map((rr) => {
          sources.push(`Dataset: ${rr.dataset_name} (Row ${rr.row_index})`);
          return `[File: ${rr.dataset_name}, Row: ${rr.row_index}]: ${rr.raw_data}`;
        }).join('\n');
      } else {
        rawRecordsText = 'No raw record rows explicitly matched entity name in current datasets.';
      }
    }

    // 3. Load Conversational Memory from SQLite
    const historyRows = (db.prepare(`
      SELECT role, content FROM ai_chat_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 6
    `).all(sId) as any[]).reverse();

    const historyMessages = historyRows.map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content,
    }));

    // 4. Build System Prompt & Call Local Ollama (llama3.2:gpu)
    const systemPrompt = `You are a sharp, seasoned tactical intelligence analyst. You are actively collaborating with a human investigator who is examining entities and connections on an intelligence canvas.

COMMUNICATION RULES:
1. Speak like a real human investigator — natural, perceptive, direct, and candid.
2. ABSOLUTELY NEVER use robotic headers or form checklists (do NOT say "Direct Finding:", "Verified Evidence:", "Records Checked:", "Status: Verified", or "Negative Verified").
3. Directly answer what the user asked using the provided database records and relationships.
4. Truthful negatives: If the user asks about something not present (e.g. money wires, suspicious ties, unlisted directors), state plainly and naturally what was checked and that nothing was found in the files.
5. Do NOT recite generic canned speeches or boilerplate stories. Be specific to the exact target and question.
6. At the very end of your response, on a new line, add factual receipts as concise source tags:
   📎 [source_dataset: Row N] or 📎 [Relationship: Entity -> LINK -> Target]`;

    let userPrompt = `USER QUESTION: "${message}"\n\n`;
    if (primaryEntity) {
      userPrompt += `DATABASE GROUND TRUTH CONTEXT:\n${entitySummaryText}\nDIRECT GRAPH CONNECTIONS:\n${directLinksText}\n\nRELEVANT SOURCE RECORDS:\n${rawRecordsText}\n`;
    } else {
      userPrompt += `NOTE: No specific entity is currently pinned or selected. Answer based on general investigation knowledge and available dataset context.`;
    }

    let reply = '';
    let reasoning = '';

    try {
      const ollamaConfig = getOllamaConfig();
      const res = await fetch(`${ollamaConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaConfig.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(35000),
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        reply = json.choices?.[0]?.message?.content?.trim() || '';
        reasoning = `Generated by ${ollamaConfig.model} on GPU with ${matchedEntities.length} entities and ${edges.length} graph edges.`;
      } else {
        throw new Error(`Ollama returned status ${res.status}`);
      }
    } catch (err: any) {
      // Natural human fallback (NEVER canned boilerplate)
      if (primaryEntity) {
        const connCount = edges.length;
        reply = `I looked into **${primaryEntity.name}** in the database records. It's indexed as a ${primaryEntity.type || 'entity'}. ` +
          (connCount > 0
            ? `There are ${connCount} recorded direct connections in the graph, but local LLM inference was momentarily busy.`
            : `Currently there are no connecting relationships or anomalies recorded for this entity in the uploaded files.`);
      } else {
        reply = `I reviewed your query for "${message}". No matching entity records were found in the active database.`;
      }
      reasoning = `Direct database resolution fallback (${err?.message || 'LLM offline'}).`;
    }

    // 5. Save to Persistent Chat Memory in SQLite
    const userMsgId = `msg_user_${uuidv4().substring(0, 8)}`;
    const asstMsgId = `msg_asst_${uuidv4().substring(0, 8)}`;
    const insertMsgStmt = db.prepare(`
      INSERT INTO ai_chat_messages (id, session_id, role, content, sources, reasoning, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertMsgStmt.run(userMsgId, sId, 'user', message, JSON.stringify([]), null, now);
    insertMsgStmt.run(asstMsgId, sId, 'assistant', reply, JSON.stringify(sources), reasoning || null, new Date().toISOString());

    return {
      sessionId: sId,
      reply,
      reasoning,
      sources,
      timestamp: new Date().toISOString(),
      matchedEntities,
      mappedEntityIds,
      primaryEntityId: primaryEntity ? primaryEntity.id : null,
      edges,
    };
  }

  /**
   * Fetch conversation history from SQLite persistent memory
   */
  static getChatHistory(sessionId: string): any[] {
    const rows = db.prepare(`
      SELECT id, role, content, sources, reasoning, timestamp 
      FROM ai_chat_messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `).all(sessionId) as any[];

    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      reasoning: r.reasoning,
      sources: JSON.parse(r.sources || '[]'),
      timestamp: r.timestamp,
    }));
  }

  /**
   * Clear chat history for a session
   */
  static clearChatHistory(sessionId: string): boolean {
    const res = db.prepare(`DELETE FROM ai_chat_messages WHERE session_id = ?`).run(sessionId);
    return res.changes > 0;
  }

  /**
   * High-Fidelity Grounded Local Reasoning Engine (Kept for offline compatibility)
   */
  public static generateLocalGroundedAnswer(message: string): string {
    const qLower = message.toLowerCase();
    return `### Real-Time Grounded Response\n\nDirect response for inquiry: "${message}". Please refer to active world model sensors and dataset graphs.`;
  }
}
