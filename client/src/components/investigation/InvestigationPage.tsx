import React, { useState, useEffect, useRef } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { Entity, GraphData, AiInvestigationResponse, Dataset } from '../../types';
import { EntityGraph } from '../graph/EntityGraph';
import {
  Search,
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  RefreshCw,
  CornerDownLeft,
  ChevronRight,
  Database,
  Network,
  HelpCircle,
  ShieldCheck,
  Cpu,
  Lightbulb,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  briefing?: AiInvestigationResponse;
  matchedEntities?: Entity[];
}

export const InvestigationPage: React.FC = () => {
  const {
    selectedEntity,
    selectedEntityId,
    selectEntity,
    quickNavigateToEntity,
  } = useInvestigation();

  const [inputQuery, setInputQuery] = useState('');
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeGraph, setActiveGraph] = useState<GraphData | null>(null);
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.getDatasets().then(setDatasets).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isInvestigating]);

  // Generate dynamic sample suggestions based on actual uploaded files
  const dynamicSampleQueries = React.useMemo(() => {
    if (datasets.length === 0) {
      return [
        'Upload your first CSV dataset in the Datasets module to begin intelligence analysis',
        'Discover hidden relationship patterns and foreign key linkages across files',
        'Detect anomalous clusters and high-degree hub entities in uploaded records',
      ];
    }
    const names = datasets.map((d) => d.name);
    return [
      `Discover hidden structural patterns and hub entities connecting ${names.slice(0, 2).join(' and ')}`,
      `Identify shared identifier collisions (duplicate phones, emails, accounts, addresses)`,
      `Find all cross-dataset bridges linking records in ${names[0]} to other datasets`,
      'Detect anomalous outliers or isolated records with zero graph links',
    ];
  }, [datasets]);


  const handleSendMessage = async (queryToRun: string) => {
    const q = queryToRun.trim();
    if (!q || isInvestigating) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsInvestigating(true);

    try {
      // 1. Run natural language / unified query
      const nlRes = await api.executeNlQuery(q);

      if (nlRes.matchedEntities?.length > 0) {
        selectEntity(nlRes.matchedEntities[0].id);
      }
      if (nlRes.graph && nlRes.graph.nodes?.length > 0) {
        setActiveGraph(nlRes.graph);
      }

      // 2. Call AI investigation agent
      const aiRes = await api.investigateAi(q, nlRes.matchedEntities?.[0]?.id);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiRes.aiInterpretation || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        briefing: aiRes,
        matchedEntities: nlRes.matchedEntities,
      };

      setChatHistory((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('Investigation error:', err);
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: `Error analyzing query: ${err.message || 'The system could not retrieve intelligence.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsInvestigating(false);
    }
  };

  return (
    <div className="flex-1 bg-[#090d16] flex flex-col h-full overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="bg-[#0b1120] border-b border-[#1e293b] px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                Interactive AI Reasoning Analyst
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800/40">
                Cross-Dataset Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Ask natural language questions to discover connections across all uploaded CSV datasets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
          <span>Active Datasets: <strong className="text-cyan-300">{datasets.length}</strong></span>
        </div>
      </div>

      {/* Main 2-Pane Body: Left (Chat/Q&A) & Right (Graph / Dossier) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Interactive Chat & Reasoning Thread */}
        <div className="flex-1 flex flex-col bg-[#090d16] border-r border-[#1e293b] overflow-hidden">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-10">
                <div className="w-12 h-12 rounded-full bg-[#0b1120] border border-[#1e293b] flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-sm font-bold text-slate-200 mb-1">
                  Start an Intelligence Query
                </h2>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  The AI analyst traverses through all uploaded CSV datasets to find direct links, foreign-key relationships, and matching records.
                </p>

                {/* Example Query Pills */}
                <div className="w-full space-y-2">
                  <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-2">
                    Suggested Inquiries:
                  </div>
                  {dynamicSampleQueries.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sample)}
                      className="w-full text-left p-2.5 rounded bg-[#0b1120] hover:bg-[#0f172a] border border-[#1e293b] hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-cyan-300 transition flex items-center justify-between group shadow-sm"
                    >
                      <span className="truncate">{sample}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <div key={msg.id} className="space-y-2 animate-fade-in">
                  {/* Message Header */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {msg.sender === 'user' ? (
                      <>
                        <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                          <User className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-slate-200">Analyst</span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded bg-cyan-600 flex items-center justify-center text-white text-[10px] font-bold">
                          <Bot className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-cyan-400">AI Intelligence Agent</span>
                      </>
                    )}
                    <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                  </div>

                  {/* Message Content */}
                  {msg.sender === 'user' ? (
                    <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-500/30 text-xs text-slate-100 font-mono">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* AI Synthesis / Answer */}
                      <div className="p-4 rounded-lg bg-[#0b1120] border border-[#1e293b] text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                        {msg.text}
                      </div>

                      {/* Evidence & Provenance Accordion / Blocks */}
                      {msg.briefing && (
                        <div className="space-y-3 font-mono text-xs">
                          {/* Engine Transparency & Grounding Status Bar */}
                          <div className="p-2.5 rounded-lg bg-[#060a14] border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                  msg.briefing.engine === 'deterministic-fallback'
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-600/40'
                                    : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                                }`}
                              >
                                {msg.briefing.engine === 'deterministic-fallback' ? '⚡ Deterministic Fallback' : '🧠 LLM Analyst Engine'}
                              </span>
                              {msg.briefing.groundingSummary && (
                                <span className="text-[11px] text-slate-300 font-sans">
                                  {msg.briefing.groundingSummary}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold">Grounded Score:</span>
                                <span className={`text-xs font-bold font-mono ${
                                  msg.briefing.confidenceScore >= 0.8
                                    ? 'text-emerald-400'
                                    : msg.briefing.confidenceScore >= 0.5
                                    ? 'text-cyan-400'
                                    : 'text-amber-400'
                                }`}>
                                  {(msg.briefing.confidenceScore * 100).toFixed(0)}%
                                </span>
                              </div>

                              {msg.briefing.trace && msg.briefing.trace.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedTraceIds(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-cyan-300 border border-slate-800 transition"
                                >
                                  <span>Trace ({msg.briefing.trace.length})</span>
                                  {expandedTraceIds[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Fallback Reason Warning Banner if present */}
                          {msg.briefing.fallbackReason && (
                            <div className="p-2 rounded bg-amber-950/30 border border-amber-600/40 text-[11px] text-amber-300 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              <span><strong>Engine Fallback Notice:</strong> {msg.briefing.fallbackReason}</span>
                            </div>
                          )}

                          {/* Collapsible Execution Trace Drawer */}
                          {expandedTraceIds[msg.id] && msg.briefing.trace && (
                            <div className="p-3 rounded-lg bg-black/60 border border-slate-800 space-y-1.5 max-h-56 overflow-y-auto font-mono text-[10px]">
                              <div className="text-[10px] font-bold uppercase text-slate-400 pb-1 border-b border-slate-800">
                                Autonomous Investigation Execution Trace:
                              </div>
                              {msg.briefing.trace.map((step, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-slate-300">
                                  <span className="text-slate-600 shrink-0">{step.timestamp.slice(11, 19)}</span>
                                  <span className="text-cyan-400 font-bold shrink-0">[{step.step}]</span>
                                  <span className="text-slate-400 break-all">{step.detail ? JSON.stringify(step.detail) : ''}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 4 CLAIM TIERS: Rendered Visually Distinct */}
                          {msg.briefing.facts && msg.briefing.facts.length > 0 && (
                            <div className="p-3 rounded-lg bg-emerald-950/15 border border-emerald-500/30">
                              <div className="text-[11px] font-bold text-emerald-400 uppercase mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Tier 1: Grounded Facts ({msg.briefing.facts.length})
                                </span>
                                <span className="text-[9px] text-emerald-300/60 font-normal">Strictly Verified Against Tool Telemetry</span>
                              </div>
                              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                {msg.briefing.facts.map((fact, i) => (
                                  <div key={i} className="p-2 rounded bg-slate-900/80 border border-emerald-900/40 text-[11px] text-slate-200">
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="leading-relaxed">{fact.text}</span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {fact.evidenceIds?.map((id, ei) => (
                                          <span key={ei} className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 text-[9px] font-mono border border-emerald-700/50">
                                            {id}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tier 2: Analytical Inferences */}
                          {msg.briefing.inferences && msg.briefing.inferences.length > 0 && (
                            <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/30">
                              <div className="text-[11px] font-bold text-indigo-300 uppercase mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Tier 2: Analytical Inferences ({msg.briefing.inferences.length})
                                </span>
                                <span className="text-[9px] text-indigo-300/60 font-normal">Derived from Verified Facts with Reasoning Chains</span>
                              </div>
                              <div className="space-y-1.5">
                                {msg.briefing.inferences.map((inf, i) => (
                                  <div key={i} className="p-2 rounded bg-slate-900/80 border border-indigo-900/40 text-[11px] text-slate-200">
                                    <div className="font-semibold text-slate-100">{inf.text}</div>
                                    <div className="mt-1 pt-1 border-t border-indigo-900/30 flex items-center justify-between text-[10px] text-indigo-300/90 font-mono">
                                      <span>⚡ Chain: <em>{inf.reasoning}</em></span>
                                      <span className="text-slate-500 shrink-0 ml-2">
                                        Based on Fact(s): {inf.basedOnFactIndexes?.map(idx => `#${idx + 1}`).join(', ') || 'N/A'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tier 3: Hypotheses & Speculative Ideas */}
                          {msg.briefing.hypotheses && msg.briefing.hypotheses.length > 0 && (
                            <div className="p-3 rounded-lg bg-amber-950/15 border border-amber-500/30">
                              <div className="text-[11px] font-bold text-amber-300 uppercase mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Tier 3: Hypotheses & Strategic Speculation ({msg.briefing.hypotheses.length})
                                </span>
                                <span className="text-[9px] text-amber-300/60 font-normal">Forward-Looking Ideas with Verification Criteria</span>
                              </div>
                              <div className="space-y-2">
                                {msg.briefing.hypotheses.map((hyp, i) => (
                                  <div key={i} className="p-2.5 rounded bg-slate-900/80 border border-amber-900/40 text-[11px]">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-bold text-slate-100">{hyp.text}</span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0 border ${
                                          hyp.plausibility === 'high'
                                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                                            : hyp.plausibility === 'low'
                                            ? 'bg-slate-900 text-slate-400 border-slate-700'
                                            : 'bg-amber-950 text-amber-300 border-amber-700/50'
                                        }`}
                                      >
                                        {hyp.plausibility} PLAUSIBILITY
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-300 mb-1.5 leading-relaxed">
                                      <span className="text-amber-300/90 font-semibold">Why Plausible:</span> {hyp.whyPlausible}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-[9px] font-mono pt-1 border-t border-amber-900/30">
                                      <div className="text-emerald-300">
                                        <span className="font-bold">✔ Confirm With:</span> {hyp.confirmWith}
                                      </div>
                                      <div className="text-red-300">
                                        <span className="font-bold">✖ Refute With:</span> {hyp.refuteWith}
                                      </div>
                                    </div>
                                    {hyp.suggestedTool && (
                                      <div className="mt-1 text-[9px] font-mono text-cyan-300">
                                        Suggested Test Tool: <code className="bg-slate-950 px-1 py-0.5 rounded border border-slate-800">{hyp.suggestedTool}</code>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tier 4: Background World Knowledge */}
                          {msg.briefing.background && msg.briefing.background.length > 0 && (
                            <div className="p-3 rounded-lg bg-purple-950/15 border border-purple-800/30">
                              <div className="text-[11px] font-bold text-purple-300 uppercase mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-purple-400" /> Tier 4: General Domain Background ({msg.briefing.background.length})
                                </span>
                                <span className="text-[9px] text-purple-300/60 font-normal">Real-World Knowledge (Not from Database)</span>
                              </div>
                              <ul className="space-y-1">
                                {msg.briefing.background.map((bg, i) => (
                                  <li key={i} className="text-slate-300 text-[10px] bg-slate-900/60 p-2 rounded border border-purple-900/30 leading-relaxed">
                                    • {bg.text}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Proposed Relationships & Data Gaps */}
                          {((msg.briefing.proposedRelationships && msg.briefing.proposedRelationships.length > 0) || (msg.briefing.dataGaps && msg.briefing.dataGaps.length > 0)) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {msg.briefing.proposedRelationships && msg.briefing.proposedRelationships.length > 0 && (
                                <div className="p-3 rounded-lg bg-[#090d16] border border-cyan-500/30">
                                  <div className="text-[11px] font-bold text-cyan-400 uppercase mb-1.5 flex items-center gap-1.5">
                                    <Network className="w-3.5 h-3.5" /> Proposed Latent Links ({msg.briefing.proposedRelationships.length})
                                  </div>
                                  <div className="space-y-1">
                                    {msg.briefing.proposedRelationships.map((pr, i) => (
                                      <div key={i} className="p-1.5 rounded bg-slate-900/80 border border-cyan-900/40 text-[10px] text-slate-300">
                                        <div className="font-bold text-cyan-300">
                                          {pr.source_id} <span className="text-slate-500">-[{pr.type}]-&gt;</span> {pr.target_id}
                                        </div>
                                        <div className="text-[9px] text-slate-400 mt-0.5">{pr.rationale}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {msg.briefing.dataGaps && msg.briefing.dataGaps.length > 0 && (
                                <div className="p-3 rounded-lg bg-[#090d16] border border-slate-700/50">
                                  <div className="text-[11px] font-bold text-slate-300 uppercase mb-1.5 flex items-center gap-1.5">
                                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Analyst Data Wish List ({msg.briefing.dataGaps.length})
                                  </div>
                                  <ul className="space-y-1">
                                    {msg.briefing.dataGaps.map((gap, i) => (
                                      <li key={i} className="p-1.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-300">
                                        • {gap}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Fallback Legacy Display if facts was empty */}
                          {(!msg.briefing.facts || msg.briefing.facts.length === 0) && msg.briefing.knownFacts?.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {msg.briefing.possibleRelationships?.length > 0 && (
                                <div className="p-3 rounded bg-[#090d16] border border-cyan-500/30">
                                  <div className="text-[11px] font-bold text-cyan-400 uppercase mb-2 flex items-center gap-1.5">
                                    <Network className="w-3.5 h-3.5" /> Discovered Paths
                                  </div>
                                  <ul className="space-y-1.5">
                                    {msg.briefing.possibleRelationships.map((rel, i) => (
                                      <li key={i} className="text-slate-300 text-[11px] bg-slate-900/60 p-1.5 rounded border border-slate-800">
                                        {rel}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="p-3 rounded bg-[#090d16] border border-emerald-500/30">
                                <div className="text-[11px] font-bold text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Grounded Evidence & Records
                                </div>
                                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                                  {msg.briefing.knownFacts.map((fact, i) => (
                                    <li key={i} className="text-slate-300 text-[10px] bg-slate-900/60 p-1.5 rounded border border-slate-800">
                                      {fact}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      )}


                      {/* Matched Entities Chips */}
                      {msg.matchedEntities && msg.matchedEntities.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-mono text-slate-500">Related Entities:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.matchedEntities.map((ent) => (
                              <button
                                key={ent.id}
                                onClick={() => selectEntity(ent.id)}
                                className="px-2 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold transition"
                              >
                                {ent.name} ({ent.type})
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading Indicator */}
            {isInvestigating && (
              <div className="flex items-center gap-2 p-3 rounded bg-[#0b1120] border border-cyan-500/30 text-xs font-mono text-cyan-300 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Traversing datasets and correlating cross-dataset relationships...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Interactive Prompt Input */}
          <div className="p-4 bg-[#0b1120] border-t border-[#1e293b] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputQuery);
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask any question about your data (e.g. 'Which customers made payments above 10,000?')..."
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded pl-3 pr-10 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isInvestigating || !inputQuery.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition shadow shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Pane: Live Visual Graph & Entity Dossier */}
        <div className="w-96 bg-[#0b1120] flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="h-10 border-b border-[#1e293b] px-4 flex items-center justify-between text-xs font-mono shrink-0">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              INTELLIGENCE GRAPH
            </span>
            <span className="text-[10px] text-slate-500">Live Visual Explorer</span>
          </div>

          {/* Top Half: Cytoscape Graph */}
          <div className="h-64 border-b border-[#1e293b] relative">
            <EntityGraph graphData={activeGraph || undefined} />
          </div>

          {/* Bottom Half: Selected Entity Dossier */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Entity Dossier</span>
              {selectedEntity && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {selectedEntity.type}
                </span>
              )}
            </div>

            {selectedEntity ? (
              <div className="space-y-3">
                <div className="p-3 rounded bg-[#090d16] border border-[#1e293b]">
                  <div className="font-bold text-white text-xs mb-1">{selectedEntity.name}</div>
                  <div className="text-[10px] text-slate-400 leading-relaxed mb-2">
                    {selectedEntity.summary}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    ID: {selectedEntity.id}
                  </div>
                </div>

                {/* Attributes Table */}
                {Object.keys(selectedEntity.properties || {}).length > 0 && (
                  <div className="p-3 rounded bg-[#090d16] border border-[#1e293b]">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                      Record Attributes
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {Object.entries(selectedEntity.properties).map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between text-[10px]">
                          <span className="text-slate-500 truncate max-w-[100px]">{k}:</span>
                          <span className="text-slate-200 text-right truncate max-w-[180px] font-semibold">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                Click any entity or link from the investigation chat to inspect its dossier.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

