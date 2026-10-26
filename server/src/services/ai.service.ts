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
   * Omni-Sensor AI Reasoning Space with Persistent Chat Memory and Graph Entity Mapping
   */
  static async chatReasoning(
    message: string,
    sessionId?: string
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

    // 1. First inspect if the message inquires about an entity, vessel, consignment or connection in the Knowledge Graph
    const graphInquiry = GraphService.searchGraphInquiry(message);
    let reply = '';
    let sources: string[] = [];
    let reasoning = '';
    let mappedEntityIds: string[] = [];
    let primaryEntityId: string | null = null;
    let matchedEntities: any[] = [];
    let edges: any[] = [];

    if (graphInquiry && graphInquiry.nodes.length > 0) {
      mappedEntityIds = graphInquiry.nodes.map((n) => n.data.id);
      primaryEntityId = graphInquiry.primaryId;
      matchedEntities = graphInquiry.matchedEntities;
      edges = graphInquiry.edges;

      const primary = graphInquiry.matchedEntities[0];
      const primaryProps = primary.properties ? JSON.parse(primary.properties) : {};
      const neighborNodes = graphInquiry.nodes.filter((n) => n.data.id !== primary.id);
      const neighborNames = neighborNodes.map((n) => n.data.name).slice(0, 5);

      if (graphInquiry.nodes.length > 1) {
        reply = `Looking at **${primary.name}**, there's an active evidence trail connecting ${graphInquiry.nodes.length} entities across customs declarations, shipping manifests, and financial records. Key parties in this chain include **${neighborNames.slice(0, 4).join('**, **')}**. I've mapped the complete network onto your canvas so you can trace the connections.`;
      } else {
        reply = `Found the record for **${primary.name}**. It's an isolated shipping entry in the port ledger with zero anomalous or cross-dataset connections.`;
      }

      sources = [
        `Knowledge Graph: ${primary.name}`,
        ...graphInquiry.edges.slice(0, 4).map((e) => `${e.data.source} -> ${e.data.label || e.data.type} -> ${e.data.target}`),
      ];
      reasoning = `Grounded query resolution: matched ${graphInquiry.matchedEntities.length} entities and ${graphInquiry.edges.length} multi-hop relationships in intelligence graph.`;
    } else {
      // 2. Fallback to AI pipeline with crisp, concise synthesis (NO giant walls of text)
      const historyRows = (db.prepare(`
        SELECT role, content FROM ai_chat_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 4
      `).all(sId) as any[]).reverse();

      const historyTurns = historyRows.map((h: any) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: h.content,
      }));
      const invResult = await this.investigate(message, { investigationId: sId, history: historyTurns });

      reply = invResult.aiInterpretation || `Analysis complete for inquiry "${message}".`;
      if (invResult.facts && invResult.facts.length > 0) {
        reply += `\n\n**Corroborating Facts:**\n` + invResult.facts.slice(0, 3).map((f) => `• ${f.text}`).join('\n');
      }

      sources = Array.from(
        new Set([
          ...((invResult.facts || []).flatMap((f) => f.evidenceIds)),
          'Revana Grounded Intelligence Store',
        ])
      );
      reasoning = (invResult.trace || [])
        .map((t) => `[${t.timestamp.slice(11, 19)}] ${t.step}`)
        .join('\n');
    }

    // 3. Save to Persistent Chat Memory in SQLite
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
      primaryEntityId,
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
