import React, { useState, useEffect, useRef } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { AiInvestigationResponse } from '../../types';
import {
  Bot,
  Send,
  Sparkles,
  Shield,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Activity,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Layers
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  response?: AiInvestigationResponse;
  timestamp: string;
}

export const AiAnalystView: React.FC = () => {
  const { selectedEntityId, selectedEntity, quickNavigateToEntity, aiStatus } = useInvestigation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      text: 'Revana AI Lead Intelligence Analyst operational. Grounded directly in structured graph topology, speed telemetry physics, and anomaly ledgers. What entity, corridor, or threat vector would you like to investigate?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = promptToSend || inputPrompt;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await api.investigateAi(text, selectedEntityId || undefined);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: response.aiInterpretation,
        response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('AI error:', err);
      const errorMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: 'Error processing investigation query. Please verify backend connection.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] font-mono text-xs overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 bg-[#0b1120] border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-950/60 border border-cyan-500/40">
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                GROK AI INVESTIGATION ANALYST
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] bg-[#090d16] text-emerald-400 border border-emerald-500/30 font-bold">
                {aiStatus?.isLiveKeyConfigured ? 'LIVE GROK-2' : 'GROUNDED LOCAL REASONER'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Strictly grounded in database facts, multi-hop paths, and speed calculations.
            </p>
          </div>
        </div>

        {selectedEntity && (
          <div className="flex items-center gap-2 bg-[#090d16] px-3 py-1.5 rounded border border-[#1e293b]">
            <span className="text-slate-400 text-[10px]">ACTIVE FOCUS:</span>
            <span className="text-cyan-300 font-bold">{selectedEntity.name}</span>
          </div>
        )}
      </div>

      {/* Main Chat Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1">
                <span>{isUser ? 'ANALYST LEAD' : 'GROK AI ASSISTANT'}</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>

              <div
                className={`p-4 rounded-lg max-w-4xl space-y-3 ${
                  isUser
                    ? 'bg-cyan-950/40 border border-cyan-500/40 text-cyan-100'
                    : 'bg-[#0f172a] border border-[#1e293b] text-slate-200'
                }`}
              >
                <div className="leading-relaxed text-xs">{msg.text}</div>

                {/* Structured Intelligence Cards if present */}
                {msg.response && (
                  <div className="space-y-3 pt-3 border-t border-[#1e293b] mt-3">
                    {/* Known Facts */}
                    {msg.response.knownFacts && msg.response.knownFacts.length > 0 && (
                      <div className="p-3 rounded bg-[#090d16] border border-cyan-500/30 space-y-1.5">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" />
                          <span>VERIFIED KNOWN FACTS</span>
                        </span>
                        <ul className="space-y-1">
                          {msg.response.knownFacts.map((fact, idx) => (
                            <li key={idx} className="text-[11px] text-slate-300 pl-2 border-l-2 border-cyan-400">
                              {fact}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Possible Relationships */}
                    {msg.response.possibleRelationships && msg.response.possibleRelationships.length > 0 && (
                      <div className="p-3 rounded bg-[#090d16] border border-[#1e293b] space-y-1.5">
                        <span className="text-[10px] font-bold text-blue-400 uppercase">
                          INFERRED CONNECTIONS & RELATIONSHIP VECTORS
                        </span>
                        <ul className="space-y-1">
                          {msg.response.possibleRelationships.map((rel, idx) => (
                            <li key={idx} className="text-[11px] text-slate-300 pl-2 border-l-2 border-blue-400">
                              {rel}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Uncertainty */}
                    {msg.response.uncertainty && (
                      <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/30 text-amber-200 text-[11px]">
                        <span className="text-[10px] font-bold text-amber-400 uppercase block mb-1">
                          INTELLIGENCE GAPS & UNCERTAINTY:
                        </span>
                        {msg.response.uncertainty}
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {msg.response.recommendedActions && msg.response.recommendedActions.length > 0 && (
                      <div className="p-3 rounded bg-[#090d16] border border-emerald-500/30 space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">
                          RECOMMENDED TACTICAL ACTIONS
                        </span>
                        <ul className="space-y-1">
                          {msg.response.recommendedActions.map((act, idx) => (
                            <li key={idx} className="text-[11px] text-slate-300 pl-2 border-l-2 border-emerald-400">
                              {act}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Hop Expansions */}
                    {msg.response.suggestedHopExpansions && msg.response.suggestedHopExpansions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <span className="text-[10px] text-slate-400 uppercase">EXPLORE LEADS:</span>
                        {msg.response.suggestedHopExpansions.map((entityId, idx) => (
                          <button
                            key={idx}
                            onClick={() => quickNavigateToEntity(entityId)}
                            className="px-2 py-1 rounded bg-[#1e293b] hover:bg-cyan-950 text-cyan-300 text-[10px] font-bold border border-transparent hover:border-cyan-500/40 transition flex items-center gap-1"
                          >
                            <span>{entityId}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-cyan-400 p-4 rounded bg-[#0f172a] border border-[#1e293b] max-w-md">
            <Activity className="w-4 h-4 animate-spin" />
            <span>GROK ANALYZING STRUCTURED INTELLIGENCE LEDGER...</span>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Preloaded Template Buttons & Chat Input */}
      <div className="p-4 bg-[#0b1120] border-t border-[#1e293b] space-y-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            QUICK QUERIES:
          </span>
          {[
            'Investigate Truck KA-01-AB-1234 speed anomaly',
            'What companies are connected to Shipment SHP-10293?',
            'Find unusual relationships in this investigation',
            'Summarize 72-hour activity for Whitefield ICD'
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] hover:border-cyan-500/40 text-slate-300 hover:text-cyan-200 text-[10px] transition"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder="Type investigation question for Grok AI..."
            className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg pl-4 pr-24 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={isLoading || !inputPrompt.trim()}
            className="absolute right-2 top-2 bottom-2 px-4 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 font-bold rounded text-xs flex items-center gap-1.5 transition disabled:opacity-40"
          >
            <span>TRANSMIT</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
