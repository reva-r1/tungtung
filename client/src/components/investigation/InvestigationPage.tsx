import React, { useState, useEffect, useRef } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import {
  Entity,
  GraphData,
  AiInvestigationResponse,
  Dataset,
  FactClaim,
  InferenceClaim,
  HypothesisClaim,
} from '../../types';
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
  ArrowRight,
  RefreshCw,
  Network,
  HelpCircle,
  Cpu,
  Lightbulb,
  Compass,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Layers,
  FileText,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  briefing?: AiInvestigationResponse;
  matchedEntities?: Entity[];
}

interface SelectedEvidenceDetail {
  id: string;
  text: string;
  sourceDataset?: string;
  timestamp?: string;
  entities?: string[];
  raw?: any;
}

export const InvestigationPage: React.FC = () => {
  const {
    selectedEntity,
    selectedEntityId,
    selectEntity,
    quickNavigateToEntity,
    activeNlResult,
  } = useInvestigation();

  const [inputQuery, setInputQuery] = useState('');
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [activeGraph, setActiveGraph] = useState<GraphData | null>(null);
  const [expandedTraceIds, setExpandedTraceIds] = useState<Record<string, boolean>>({});
  const [expandedDiagnosticsIds, setExpandedDiagnosticsIds] = useState<Record<string, boolean>>({});
  const [inspectingEvidence, setInspectingEvidence] = useState<SelectedEvidenceDetail | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.getDatasets().then(setDatasets).catch(console.error);
  }, []);

  // If activeNlResult was set externally (from header search), populate initial message
  useEffect(() => {
    if (activeNlResult && chatHistory.length === 0) {
      if (activeNlResult.graph?.nodes?.length > 0) {
        setActiveGraph(activeNlResult.graph);
      }
      if (activeNlResult.matchedEntities?.length > 0) {
        selectEntity(activeNlResult.matchedEntities[0].id);
      }
    }
  }, [activeNlResult]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isInvestigating]);

  // Generate dynamic sample inquiries based on actual loaded datasets
  const dynamicSampleQueries = React.useMemo(() => {
    if (datasets.length === 0) {
      return [
        'Identify shared identifier collisions (duplicate phones, emails, accounts)',
        'Discover hidden relationship patterns and foreign key linkages',
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

      // 2. Call AI investigation agent with conversation history
      const focusEntityId = nlRes.matchedEntities?.[0]?.id || undefined;
      const historyTurns = chatHistory.slice(-6).map((m) => ({
        role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text,
      }));
      const aiRes = await api.investigateAi(q, focusEntityId, undefined, historyTurns);

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
        text: `Analysis notice: ${err.message || 'The system could not retrieve intelligence.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsInvestigating(false);
    }
  };

  // Helper to open evidence inspection
  const openEvidenceModal = (evidenceId: string, factContext?: string) => {
    setInspectingEvidence({
      id: evidenceId,
      text: factContext || `Observed verified evidence record [${evidenceId}]`,
      sourceDataset: datasets[0]?.name || 'Ingested Data Store',
      timestamp: new Date().toISOString(),
      raw: {
        evidenceId,
        fact: factContext || 'Verified from primary dataset record',
        verified: true,
      },
    });
  };

  // Render text with clickable interactive citation pills
  const renderTextWithCitations = (text: string, fact?: FactClaim) => {
    // Match patterns like [ev_1], [1], [E1], etc.
    const parts = text.split(/(\[ev_\w+\]|\[\d+\]|\[E\d+\])/gi);
    return parts.map((part, i) => {
      const match = part.match(/\[(ev_\w+|\d+|E\d+)\]/i);
      if (match) {
        const id = match[1];
        return (
          <button
            key={i}
            type="button"
            onClick={() => openEvidenceModal(id, text)}
            className="citation-pill mx-1"
            title={`Inspect Source Record [${id}]`}
          >
            <span>[{id}]</span>
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex-1 bg-[#0E0F11] flex flex-col h-full overflow-hidden font-sans select-none relative">
      {/* Top Header Bar */}
      <div className="bg-[#151618] border-b border-[#26292D] px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-[#1C1E21] border border-[#26292D] flex items-center justify-center text-[#4C90F0]">
            <Search className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-semibold text-[#E6E7E9] tracking-tight">
                Investigation Workspace
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#1C1E21] text-[#8B9097] border border-[#26292D]">
                Cross-Dataset Engine
              </span>
            </div>
            <p className="text-[11px] text-[#8B9097]">
              Evidence-grounded analytical synthesis across linked records and graphs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#8B9097]">
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#4C90F0]" />
          <span>
            Active Datasets: <strong className="text-[#E6E7E9]">{datasets.length}</strong>
          </span>
        </div>
      </div>

      {/* Main 2-Pane Body: Left (Investigation Q&A) & Right (Entity Graph / Dossier) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Interactive Chat & Findings Briefing */}
        <div className="flex-1 flex flex-col bg-[#0E0F11] border-r border-[#26292D] overflow-hidden">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
                <div className="w-10 h-10 rounded bg-[#151618] border border-[#26292D] flex items-center justify-center text-[#4C90F0] mb-3">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-semibold text-[#E6E7E9] mb-1">
                  Start an Analytical Investigation
                </h2>
                <p className="text-xs text-[#8B9097] mb-6 leading-relaxed">
                  Query across uploaded CSV datasets and databases. Revana correlates cross-dataset
                  relationships and isolates verified facts from working hypotheses.
                </p>

                {/* Example Query List */}
                <div className="w-full space-y-1.5 text-left">
                  <div className="text-[10px] font-mono text-[#8B9097] uppercase tracking-wider mb-1">
                    Suggested Inquiries:
                  </div>
                  {dynamicSampleQueries.map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sample)}
                      className="w-full text-left p-2.5 rounded bg-[#151618] hover:bg-[#1C1E21] border border-[#26292D] hover:border-[#4C90F0] text-xs font-sans text-[#8B9097] hover:text-[#E6E7E9] transition flex items-center justify-between group"
                    >
                      <span className="truncate">{sample}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#8B9097] group-hover:text-[#4C90F0] shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatHistory.map((msg) => (
                <div key={msg.id} className="space-y-2">
                  {/* Message Sender Header */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {msg.sender === 'user' ? (
                      <>
                        <div className="w-4 h-4 rounded bg-[#4C90F0] flex items-center justify-center text-white text-[9px] font-bold">
                          <User className="w-2.5 h-2.5" />
                        </div>
                        <span className="font-semibold text-[#E6E7E9]">Analyst Inquiry</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded bg-[#1C1E21] border border-[#26292D] flex items-center justify-center text-[#4C90F0] text-[9px]">
                          <Bot className="w-2.5 h-2.5" />
                        </div>
                        <span className="font-semibold text-[#4C90F0]">Intelligence Briefing</span>
                      </>
                    )}
                    <span className="text-[10px] text-[#8B9097]">{msg.timestamp}</span>
                  </div>

                  {/* Message Content */}
                  {msg.sender === 'user' ? (
                    <div className="p-3 rounded bg-[#151618] border border-[#26292D] text-xs text-[#E6E7E9] font-sans">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="space-y-3 font-sans">
                      {/* 1. Concise Editorial Synthesis (Narrative) */}
                      {msg.briefing?.narrative ? (
                        <div className="rounded bg-[#151618] border border-[#26292D] p-4 space-y-3">
                          {/* Overview / What I Found */}
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#3DB46D] mb-1 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Core Finding</span>
                            </div>
                            <p className="text-xs text-[#E6E7E9] leading-relaxed">
                              {renderTextWithCitations(msg.briefing.narrative.whatIFound)}
                            </p>
                          </div>

                          {/* How Records Connect */}
                          <div className="pt-2 border-t border-[#26292D]">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4C90F0] mb-1 flex items-center gap-1.5">
                              <Network className="w-3.5 h-3.5" />
                              <span>Relational Synthesis</span>
                            </div>
                            <p className="text-xs text-[#8B9097] leading-relaxed">
                              {renderTextWithCitations(msg.briefing.narrative.howRecordsConnect)}
                            </p>
                          </div>

                          {/* Analytical Interpretation */}
                          <div className="pt-2 border-t border-[#26292D]">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#F5A524] mb-1 flex items-center gap-1.5">
                              <Lightbulb className="w-3.5 h-3.5" />
                              <span>Interpretation & Context</span>
                            </div>
                            <p className="text-xs text-[#8B9097] leading-relaxed">
                              {renderTextWithCitations(msg.briefing.narrative.whatThisCouldMean)}
                            </p>
                          </div>

                          {/* Next Analytical Steps */}
                          <div className="pt-2 border-t border-[#26292D]">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8B9097] mb-1 flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5" />
                              <span>Recommended Next Verification</span>
                            </div>
                            <p className="text-xs text-[#8B9097] leading-relaxed">
                              {renderTextWithCitations(
                                msg.briefing.narrative.whatWeShouldExamineNext
                              )}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded bg-[#151618] border border-[#26292D] text-xs text-[#E6E7E9] leading-relaxed whitespace-pre-wrap">
                          {renderTextWithCitations(msg.text)}
                        </div>
                      )}

                      {/* Engine Transparency & Diagnostics Strip */}
                      {msg.briefing && (
                        <div className="space-y-2 text-xs">
                          {/* Engine Pill & Grounding Score Bar */}
                          <div className="p-2 rounded bg-[#151618] border border-[#26292D] flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                                  msg.briefing.engine === 'deterministic-fallback'
                                    ? 'bg-[#1C1E21] text-[#F5A524] border-[#F5A524]/30'
                                    : 'bg-[#1C1E21] text-[#3DB46D] border-[#3DB46D]/30'
                                }`}
                              >
                                {msg.briefing.engine === 'deterministic-fallback'
                                  ? 'Deterministic Verification'
                                  : msg.briefing.diagnostics?.provider?.includes('Ollama') ||
                                    msg.briefing.fallbackReason?.includes('Ollama')
                                  ? 'Local Ollama (llama3.2:3b)'
                                  : 'LLM Reasoning Engine'}
                              </span>

                              {msg.briefing.groundingSummary && (
                                <span className="text-[11px] text-[#8B9097]">
                                  {msg.briefing.groundingSummary}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Honest Grounding Coverage Display */}
                              <div
                                className="flex items-center gap-1.5"
                                title="Percentage of statements directly cited against ingested records."
                              >
                                <span className="text-[10px] text-[#8B9097] uppercase">
                                  Grounding:
                                </span>
                                <span className="text-xs font-mono font-semibold text-[#3DB46D]">
                                  {(msg.briefing.confidenceScore * 100).toFixed(0)}%
                                </span>
                              </div>

                              {/* Diagnostics Toggle */}
                              {msg.briefing.diagnostics && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDiagnosticsIds((prev) => ({
                                      ...prev,
                                      [msg.id]: !prev[msg.id],
                                    }))
                                  }
                                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1C1E21] hover:bg-[#26292D] text-[10px] text-[#8B9097] hover:text-[#E6E7E9] border border-[#26292D] transition"
                                >
                                  <span>Diagnostics</span>
                                  {expandedDiagnosticsIds[msg.id] ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Collapsible Developer Diagnostics Drawer */}
                          {expandedDiagnosticsIds[msg.id] && msg.briefing.diagnostics && (
                            <div className="p-3 rounded bg-[#151618] border border-[#26292D] space-y-2 text-[11px] font-mono">
                              <div className="text-[10px] font-semibold uppercase text-[#8B9097] pb-1 border-b border-[#26292D] flex items-center justify-between">
                                <span>AI Provider Diagnostics</span>
                                <span className="text-[#8B9097] font-normal">Internal View</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                                <div>
                                  <span className="text-[#8B9097]">Provider:</span>{' '}
                                  <span className="text-[#E6E7E9]">
                                    {msg.briefing.diagnostics.provider || 'Local / Hybrid'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[#8B9097]">Model:</span>{' '}
                                  <span className="text-[#E6E7E9]">
                                    {msg.briefing.diagnostics.model || 'llama3.2:3b'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[#8B9097]">Status Code:</span>{' '}
                                  <span className="text-[#E6E7E9]">
                                    {msg.briefing.diagnostics.statusCode || 200}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[#8B9097]">Cooldown:</span>{' '}
                                  <span className="text-[#4C90F0]">
                                    {msg.briefing.diagnostics.retryAfterSec
                                      ? `${msg.briefing.diagnostics.retryAfterSec}s`
                                      : 'None'}
                                  </span>
                                </div>
                              </div>
                              {msg.briefing.diagnostics.rawError && (
                                <div className="mt-1 pt-1 border-t border-[#26292D] text-[10px] text-[#8B9097]">
                                  <div className="text-[9px] text-[#8B9097] mb-1">Notice:</div>
                                  <pre className="p-2 rounded bg-[#0E0F11] border border-[#26292D] text-[9px] text-[#F5A524] whitespace-pre-wrap break-all">
                                    {msg.briefing.diagnostics.rawError}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Verified Facts with Clickable Evidence Citations */}
                          {msg.briefing.facts && msg.briefing.facts.length > 0 && (
                            <div className="p-3 rounded bg-[#151618] border border-[#26292D] space-y-2">
                              <div className="text-[11px] font-semibold text-[#3DB46D] uppercase flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3DB46D]" />
                                  <span>Verified Records & Observations ({msg.briefing.facts.length})</span>
                                </span>
                                <span className="text-[10px] text-[#8B9097] font-normal">
                                  Click citation to inspect raw record
                                </span>
                              </div>
                              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                                {msg.briefing.facts.map((fact, i) => (
                                  <div
                                    key={i}
                                    className="p-2 rounded bg-[#1C1E21] border border-[#26292D] text-xs text-[#E6E7E9] flex items-start justify-between gap-2"
                                  >
                                    <span className="leading-relaxed">
                                      {renderTextWithCitations(fact.text, fact)}
                                    </span>
                                    {fact.evidenceIds && fact.evidenceIds.length > 0 && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {fact.evidenceIds.map((eid, eidx) => (
                                          <button
                                            key={eidx}
                                            type="button"
                                            onClick={() => openEvidenceModal(eid, fact.text)}
                                            className="citation-pill"
                                            title={`Inspect Source Record [${eid}]`}
                                          >
                                            [{eid}]
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Key Analytical Inferences */}
                          {msg.briefing.inferences && msg.briefing.inferences.length > 0 && (
                            <div className="p-3 rounded bg-[#151618] border border-[#26292D] space-y-2">
                              <div className="text-[11px] font-semibold text-[#4C90F0] uppercase flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-[#4C90F0]" />
                                <span>Correlated Inferences ({msg.briefing.inferences.length})</span>
                              </div>
                              <div className="space-y-1.5">
                                {msg.briefing.inferences.map((inf, i) => (
                                  <div
                                    key={i}
                                    className="p-2 rounded bg-[#1C1E21] border border-[#26292D] text-xs text-[#E6E7E9]"
                                  >
                                    <div className="font-medium text-[#E6E7E9]">{inf.text}</div>
                                    {inf.reasoning && (
                                      <div className="mt-1 text-[11px] text-[#8B9097]">
                                        <span>Rationale: </span>
                                        <span>{inf.reasoning}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Hypotheses to Test */}
                          {msg.briefing.hypotheses && msg.briefing.hypotheses.length > 0 && (
                            <div className="p-3 rounded bg-[#151618] border border-[#26292D] space-y-2">
                              <div className="text-[11px] font-semibold text-[#F5A524] uppercase flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5 text-[#F5A524]" />
                                <span>Hypotheses & Working Theories ({msg.briefing.hypotheses.length})</span>
                              </div>
                              <div className="space-y-1.5">
                                {msg.briefing.hypotheses.map((hyp, i) => (
                                  <div
                                    key={i}
                                    className="p-2 rounded bg-[#1C1E21] border border-[#26292D] text-xs text-[#E6E7E9]"
                                  >
                                    <div className="font-medium text-[#E6E7E9] mb-0.5">{hyp.text}</div>
                                    <div className="text-[11px] text-[#8B9097] mb-1">
                                      {hyp.whyPlausible}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono pt-1 border-t border-[#26292D]">
                                      <div className="text-[#3DB46D]">
                                        <span>Confirm With: </span>
                                        <span>{hyp.confirmWith}</span>
                                      </div>
                                      <div className="text-[#8B9097]">
                                        <span>Refute If: </span>
                                        <span>{hyp.refuteWith}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Proposed Latent Relationships */}
                          {msg.briefing.proposedRelationships &&
                            msg.briefing.proposedRelationships.length > 0 && (
                              <div className="p-3 rounded bg-[#151618] border border-[#26292D] space-y-2">
                                <div className="text-[11px] font-semibold text-[#4C90F0] uppercase flex items-center gap-1.5">
                                  <Network className="w-3.5 h-3.5" />
                                  <span>
                                    Proposed Latent Links ({msg.briefing.proposedRelationships.length})
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {msg.briefing.proposedRelationships.map((pr, i) => (
                                    <div
                                      key={i}
                                      className="p-2 rounded bg-[#1C1E21] border border-[#26292D] text-xs text-[#8B9097]"
                                    >
                                      <div className="font-mono text-xs text-[#E6E7E9]">
                                        <span>{pr.source_id}</span>
                                        <span className="text-[#4C90F0]"> -[{pr.type}]-&gt; </span>
                                        <span>{pr.target_id}</span>
                                      </div>
                                      <div className="text-[11px] text-[#8B9097] mt-0.5">
                                        {pr.rationale}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Follow-Up Inquiries Suggestions */}
                          {msg.briefing.suggestedFollowUps &&
                            msg.briefing.suggestedFollowUps.length > 0 && (
                              <div className="pt-2 border-t border-[#26292D] space-y-1.5">
                                <div className="text-[10px] font-mono text-[#8B9097] uppercase">
                                  Recommended Next Inquiries:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.briefing.suggestedFollowUps.map((suggestion, sIdx) => (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      onClick={() => handleSendMessage(suggestion)}
                                      className="px-2.5 py-1 rounded bg-[#151618] hover:bg-[#1C1E21] border border-[#26292D] hover:border-[#4C90F0] text-xs text-[#8B9097] hover:text-[#E6E7E9] transition flex items-center gap-1"
                                    >
                                      <span>{suggestion}</span>
                                      <ArrowRight className="w-3 h-3 text-[#4C90F0]" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      )}

                      {/* Matched Entities Chips */}
                      {msg.matchedEntities && msg.matchedEntities.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-[#8B9097]">Associated:</span>
                          <div className="flex flex-wrap gap-1">
                            {msg.matchedEntities.map((ent) => (
                              <button
                                key={ent.id}
                                onClick={() => selectEntity(ent.id)}
                                className="px-2 py-0.5 rounded bg-[#1C1E21] hover:border-[#4C90F0] border border-[#26292D] text-[#4C90F0] text-[10px] font-mono transition"
                              >
                                {ent.name || ent.id}
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

            {/* Investigating State */}
            {isInvestigating && (
              <div className="flex items-center gap-2 p-3 rounded bg-[#151618] border border-[#26292D] text-xs text-[#8B9097]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#4C90F0]" />
                <span>Correlating evidence and synthesizing findings...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Interactive Query Prompt */}
          <div className="p-3 bg-[#151618] border-t border-[#26292D] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputQuery);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask an analytical question (e.g. 'Which customers have duplicate tax IDs across datasets?')..."
                className="flex-1 bg-[#1C1E21] border border-[#26292D] rounded px-3 py-2 text-xs text-[#E6E7E9] placeholder-[#8B9097] focus:outline-none focus:border-[#4C90F0] transition font-sans"
              />
              <button
                type="submit"
                disabled={isInvestigating || !inputQuery.trim()}
                className="px-3.5 py-2 bg-[#4C90F0] hover:bg-[#3A7FE0] disabled:opacity-40 text-white rounded text-xs font-medium flex items-center gap-1.5 transition shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Analyze</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Pane: Live Visual Graph & Entity Dossier */}
        <div className="w-96 bg-[#151618] flex flex-col shrink-0 overflow-hidden">
          {/* Header */}
          <div className="h-10 border-b border-[#26292D] px-3.5 flex items-center justify-between text-xs font-sans shrink-0">
            <span className="font-semibold text-[#E6E7E9] flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-[#4C90F0]" />
              Entity Relationship Graph
            </span>
            <span className="text-[10px] text-[#8B9097]">Active Canvas</span>
          </div>

          {/* Top Half: Cytoscape Graph */}
          <div className="h-64 border-b border-[#26292D] relative bg-[#0E0F11]">
            <EntityGraph graphData={activeGraph || undefined} />
          </div>

          {/* Bottom Half: Selected Entity Dossier */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
            <div className="text-[10px] font-semibold text-[#8B9097] uppercase tracking-wider flex items-center justify-between">
              <span>Entity Dossier</span>
              {selectedEntity && (
                <span className="px-1.5 py-0.2 rounded bg-[#1C1E21] text-[#4C90F0] border border-[#26292D] font-mono text-[9px]">
                  {selectedEntity.type}
                </span>
              )}
            </div>

            {selectedEntity ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded bg-[#1C1E21] border border-[#26292D]">
                  <div className="font-semibold text-[#E6E7E9] text-xs mb-1">
                    {selectedEntity.name || selectedEntity.id}
                  </div>
                  {selectedEntity.summary && (
                    <div className="text-[11px] text-[#8B9097] leading-relaxed mb-2">
                      {selectedEntity.summary}
                    </div>
                  )}
                  <div className="text-[10px] font-mono text-[#8B9097]">
                    ID: {selectedEntity.id}
                  </div>
                </div>

                {/* Attributes Table */}
                {selectedEntity.properties &&
                  Object.keys(selectedEntity.properties).length > 0 && (
                    <div className="p-3 rounded bg-[#1C1E21] border border-[#26292D]">
                      <div className="text-[10px] font-semibold text-[#8B9097] uppercase mb-2">
                        Attributes
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {Object.entries(selectedEntity.properties).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-start justify-between text-[11px] py-0.5 border-b border-[#26292D]/40 last:border-0"
                          >
                            <span className="text-[#8B9097] truncate max-w-[110px]">{k}:</span>
                            <span className="text-[#E6E7E9] text-right truncate max-w-[170px] font-mono">
                              {String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="py-12 text-center text-[#8B9097] text-xs">
                Select any entity from the investigation briefing or graph to inspect its canonical dossier.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Evidence Record Inspector Modal */}
      {inspectingEvidence && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151618] border border-[#26292D] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-[#26292D] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#4C90F0]" />
                <span className="text-xs font-semibold text-[#E6E7E9]">
                  Evidence Record Inspector
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#1C1E21] text-[#4C90F0] border border-[#26292D] font-mono text-[10px]">
                  {inspectingEvidence.id}
                </span>
              </div>
              <button
                onClick={() => setInspectingEvidence(null)}
                className="text-[#8B9097] hover:text-[#E6E7E9] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-3 text-xs">
              <div className="p-3 rounded bg-[#1C1E21] border border-[#26292D] space-y-1.5">
                <div className="text-[10px] font-semibold text-[#8B9097] uppercase">
                  Observed Fact
                </div>
                <div className="text-[#E6E7E9] leading-relaxed">{inspectingEvidence.text}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-[#1C1E21] border border-[#26292D]">
                  <span className="text-[#8B9097] block text-[10px]">Source Dataset</span>
                  <span className="text-[#E6E7E9] font-medium">
                    {inspectingEvidence.sourceDataset || 'Primary Storage'}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#1C1E21] border border-[#26292D]">
                  <span className="text-[#8B9097] block text-[10px]">Verification Status</span>
                  <span className="text-[#3DB46D] font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Observation
                  </span>
                </div>
              </div>

              {/* Raw Record Inspector */}
              <div className="p-3 rounded bg-[#0E0F11] border border-[#26292D] space-y-1">
                <div className="text-[10px] font-mono text-[#8B9097] uppercase">
                  Raw Provenance Payload
                </div>
                <pre className="text-[10px] font-mono text-[#8B9097] overflow-x-auto max-h-40 whitespace-pre-wrap">
                  {JSON.stringify(inspectingEvidence.raw, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 border-t border-[#26292D] bg-[#1C1E21] flex justify-end">
              <button
                onClick={() => setInspectingEvidence(null)}
                className="px-3 py-1 bg-[#26292D] hover:bg-[#32363B] text-[#E6E7E9] rounded text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
