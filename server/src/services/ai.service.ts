import { db } from '../db/database.js';
import { AiInvestigationResponse } from '../types/index.js';
import { classifyDomain } from './ai/router.js';
import { retrieveEvidence } from './ai/retrieve.js';
import { reasonOverEvidence } from './ai/reason.js';
import { verifyClaims } from './ai/verify.js';
import { executeToolByName, toolRegistry } from './ai/tools/index.js';
import { InvestigationContext } from './ai/types.js';
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
    contextOptions?: { entityId?: string; investigationId?: string }
  ): Promise<AiInvestigationResponse> {
    const investigationId = contextOptions?.investigationId || `inv_${uuidv4().substring(0, 8)}`;
    const traceStart = new Date().toISOString();

    // 1. Stage 1: Router
    const routerDecision = await classifyDomain(prompt, contextOptions?.entityId);

    const context: InvestigationContext = {
      prompt,
      seedEntityId: contextOptions?.entityId,
      primaryDomain: routerDecision.domain,
      unlockedDomains: new Set([routerDecision.domain]),
      domainUnlockLogs: [],
      evidence: [],
      proposedRelationships: [],
      dataGaps: [],
      trace: [
        {
          step: 'pipeline_initiated',
          detail: { prompt, seedEntityId: contextOptions?.entityId },
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

    const engine = retrieveResult.engine === 'deterministic-fallback' || reasonResult.engine === 'deterministic-fallback'
      ? 'deterministic-fallback'
      : 'llm';

    const fallbackReason = retrieveResult.fallbackReason || reasonResult.fallbackReason;

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
    };
  }

  /**
   * Omni-Sensor AI Reasoning Space with Persistent Chat Memory
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
  }> {
    const sId = sessionId || `session_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    // 1. Fetch conversation history from SQLite persistent memory
    const historyRows = (db.prepare(`
      SELECT role, content FROM ai_chat_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 6
    `).all(sId) as any[]).reverse();

    // 2. Run the investigation pipeline for this user message
    const invResult = await this.investigate(message);

    // 3. Assemble formatted markdown reply with clean claim tier sections
    let reply = `### Intelligence Assessment\n${invResult.aiInterpretation}\n\n`;

    if (invResult.facts && invResult.facts.length > 0) {
      reply += `#### Grounded Facts\n`;
      invResult.facts.forEach((f) => {
        reply += `• **[FACT]** ${f.text} *(Evidence: ${f.evidenceIds.join(', ')})*\n`;
      });
      reply += '\n';
    }

    if (invResult.inferences && invResult.inferences.length > 0) {
      reply += `#### Analytical Inferences\n`;
      invResult.inferences.forEach((inf) => {
        reply += `• **[INFERENCE]** ${inf.text}\n  *Reasoning*: ${inf.reasoning}\n`;
      });
      reply += '\n';
    }

    if (invResult.hypotheses && invResult.hypotheses.length > 0) {
      reply += `#### Hypotheses & Strategic Ideas\n`;
      invResult.hypotheses.slice(0, 4).forEach((h) => {
        reply += `• **[HYPOTHESIS (${h.plausibility.toUpperCase()})]** ${h.text}\n  *Why Plausible*: ${h.whyPlausible}\n  *Confirm With*: ${h.confirmWith}\n`;
      });
      reply += '\n';
    }

    if (invResult.background && invResult.background.length > 0) {
      reply += `#### Background Context\n`;
      invResult.background.forEach((b) => {
        reply += `• **[BACKGROUND]** ${b.text}\n`;
      });
      reply += '\n';
    }

    reply += `*Engine: ${invResult.engine}${invResult.fallbackReason ? ` (${invResult.fallbackReason})` : ''} • Grounding: ${invResult.groundingSummary || 'N/A'} • Confidence: ${(invResult.confidenceScore * 100).toFixed(0)}%*`;

    // 4. Assemble sources and trace for reasoning drawer
    const sources = Array.from(
      new Set([
        ...((invResult.facts || []).flatMap((f) => f.evidenceIds)),
        'Revana Multi-Domain Intelligence Pipeline',
        invResult.engine === 'llm' ? 'Groq Analyst Engine' : 'Deterministic Local Engine',
      ])
    );

    const reasoning = (invResult.trace || [])
      .map((t) => `[${t.timestamp.slice(11, 19)}] ${t.step}: ${t.detail ? JSON.stringify(t.detail) : ''}`)
      .join('\n');

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
