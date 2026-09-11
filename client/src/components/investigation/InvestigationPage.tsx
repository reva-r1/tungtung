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
  HelpCircle
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
                          {/* Discovered Patterns */}
                          {msg.briefing.discoveredPatterns && msg.briefing.discoveredPatterns.length > 0 && (
                            <div className="p-3 rounded bg-purple-950/20 border border-purple-500/40">
                              <div className="text-[11px] font-bold text-purple-400 uppercase mb-2 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Discovered Intelligence & Graph Patterns
                              </div>
                              <ul className="space-y-1.5">
                                {msg.briefing.discoveredPatterns.map((pat, i) => (
                                  <li key={i} className="text-purple-200 text-[11px] bg-purple-950/40 p-2 rounded border border-purple-800/40 leading-relaxed">
                                    {pat}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Discovered Relationships */}
                            {msg.briefing.possibleRelationships?.length > 0 && (
                              <div className="p-3 rounded bg-[#090d16] border border-cyan-500/30">
                                <div className="text-[11px] font-bold text-cyan-400 uppercase mb-2 flex items-center gap-1.5">
                                  <Network className="w-3.5 h-3.5" /> Discovered Cross-Dataset Paths
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

                            {/* Known Facts with exact CSV provenance */}
                            {msg.briefing.knownFacts?.length > 0 && (
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
                            )}
                          </div>
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

