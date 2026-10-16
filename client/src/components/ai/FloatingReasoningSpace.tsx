import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import {
  Sparkles,
  Send,
  X,
  Maximize2,
  Minimize2,
  Trash2,
  Cpu,
  Radio,
  ExternalLink,
  ChevronDown,
  RotateCcw,
  CheckCircle2,
  Bot,
  User,
  Zap,
  ShieldCheck,
  Lightbulb,
  BookOpen,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  sources?: string[];
  timestamp: string;
}

export const FloatingReasoningSpace: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize persistent session ID from localStorage
  useEffect(() => {
    let savedSession = localStorage.getItem('revana_reasoning_session_id') || localStorage.getItem('aegis_reasoning_session_id');
    if (!savedSession) {
      savedSession = `session_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('revana_reasoning_session_id', savedSession);
    }
    setSessionId(savedSession);

    // Load initial chat history from backend
    api.getChatHistory(savedSession)
      .then(res => {
        if (res.history && res.history.length > 0) {
          setMessages(res.history);
        } else {
          // Welcome greeting
          setMessages([
            {
              id: 'welcome_msg',
              role: 'assistant',
              content: `### Welcome to the Revana Technologies Omni-Sensor Reasoning Space\n\nI am continuously connected to the **Live Digital Mirror** and verified sensor telemetry feeds:\n• **Maritime & AIS**: Authentic commercial vessel telemetry (recorded historical telemetry & live AISStream WebSocket)\n• **Weather & Rain**: Open-Meteo live precipitation & forecasts\n• **Air Quality**: Real-time atmospheric pollutants (PM2.5, PM10, AQI)\n• **Seismic**: USGS global earthquake feeds\n• **Foreign Exchange**: European Central Bank reference exchange rates\n\nAsk me about verified conditions, physical entity correlations, or sensor telemetry. All answers carry persistent memory and verified sensor provenance!`,
              sources: ['Revana Technologies Live World Model', 'AISStream.io', 'USGS', 'Open-Meteo', 'Frankfurter ECB'],
              timestamp: new Date().toISOString(),
            }
          ]);
        }
      })
      .catch(err => console.error('Failed to load chat history:', err));

    api.getAiStatus()
      .then(st => setAiStatus(st))
      .catch(err => console.error('Failed to check AI status:', err));
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await api.sendChatMessage(text, sessionId);
      const assistantMessage: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        reasoning: res.reasoning,
        sources: res.sources,
        timestamp: res.timestamp || new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Reasoning Error**: ${err.message || 'Failed to connect to the reasoning engine.'}`,
          timestamp: new Date().toISOString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!sessionId) return;
    try {
      await api.clearChatHistory(sessionId);
      const newSession = `session_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('revana_reasoning_session_id', newSession);
      setSessionId(newSession);
      setMessages([
        {
          id: 'cleared_msg',
          role: 'assistant',
          content: 'Session memory cleared. Started fresh thread with access to the Live Digital Mirror and sensor streams.',
          timestamp: new Date().toISOString(),
        }
      ]);
    } catch (err) {
      console.error('Failed to clear chat memory:', err);
    }
  };

  // Helper to render markdown-like lines with distinct claim tiers
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-2.5 mb-1 flex items-center gap-1.5 border-b border-slate-800/80 pb-1">
            {line.replace('#### ', '')}
          </h4>
        );
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-sm font-bold text-cyan-300 mt-2 mb-1">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-base font-bold text-slate-100 mt-2 mb-1">{line.replace('## ', '')}</h2>;
      }

      // Check for Claim Tiers in bullet points or paragraphs
      if (line.includes('[FACT]') || line.includes('**[FACT]**')) {
        const textOnly = line.replace(/^[•\-\*]\s*/, '').replace(/\*\*\[FACT\]\*\*\s*/, '').replace(/\[FACT\]\s*/, '');
        return (
          <div key={idx} className="my-1.5 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs text-slate-200">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                FACT
              </span>
              <span className="text-[10px] text-emerald-300/80 font-mono">Verified Observation</span>
            </div>
            <div className="leading-relaxed">{renderInlineStyles(textOnly)}</div>
          </div>
        );
      }

      if (line.includes('[INFERENCE]') || line.includes('**[INFERENCE]**')) {
        const textOnly = line.replace(/^[•\-\*]\s*/, '').replace(/\*\*\[INFERENCE\]\*\*\s*/, '').replace(/\[INFERENCE\]\s*/, '');
        return (
          <div key={idx} className="my-1.5 p-2 rounded-lg bg-indigo-950/25 border border-indigo-500/30 text-xs text-slate-200">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <Cpu className="w-3 h-3 text-indigo-400" />
                INFERENCE
              </span>
              <span className="text-[10px] text-indigo-300/80 font-mono">Logical Deduction</span>
            </div>
            <div className="leading-relaxed">{renderInlineStyles(textOnly)}</div>
          </div>
        );
      }

      if (line.includes('[HYPOTHESIS') || line.includes('**[HYPOTHESIS')) {
        const textOnly = line.replace(/^[•\-\*]\s*/, '').replace(/\*\*\[HYPOTHESIS.*?\]\*\*\s*/, '').replace(/\[HYPOTHESIS.*?\]\s*/, '');
        // Extract plausibility tag if present
        const plausibilityMatch = line.match(/HYPOTHESIS\s*\(([A-Z]+)\)/i);
        const plausibility = plausibilityMatch ? plausibilityMatch[1].toUpperCase() : 'SPECULATIVE';

        return (
          <div key={idx} className="my-1.5 p-2 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-slate-200">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Lightbulb className="w-3 h-3 text-amber-400" />
                HYPOTHESIS
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-900/40 text-amber-200 border border-amber-600/30">
                {plausibility} PLAUSIBILITY
              </span>
            </div>
            <div className="leading-relaxed">{renderInlineStyles(textOnly)}</div>
          </div>
        );
      }

      if (line.includes('[BACKGROUND]') || line.includes('**[BACKGROUND]**')) {
        const textOnly = line.replace(/^[•\-\*]\s*/, '').replace(/\*\*\[BACKGROUND\]\*\*\s*/, '').replace(/\[BACKGROUND\]\s*/, '');
        return (
          <div key={idx} className="my-1.5 p-2 rounded-lg bg-slate-900/50 border border-purple-800/30 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-700/40">
                <BookOpen className="w-3 h-3 text-purple-400" />
                BACKGROUND
              </span>
              <span className="text-[10px] text-purple-300/70 font-mono">General Domain Knowledge</span>
            </div>
            <div className="leading-relaxed">{renderInlineStyles(textOnly)}</div>
          </div>
        );
      }

      // Standard Bullet points
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = line.substring(2);
        return (
          <div key={idx} className="flex items-start gap-1.5 ml-2 my-0.5 text-xs text-slate-300">
            <span className="text-cyan-400 font-bold shrink-0">•</span>
            <span>{renderInlineStyles(bulletText)}</span>
          </div>
        );
      }
      // Blank line
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      // Normal paragraph
      return <p key={idx} className="text-xs text-slate-300 leading-relaxed my-0.5">{renderInlineStyles(line)}</p>;
    });
  };

  const renderInlineStyles = (text: string) => {
    // Simple inline parser for **bold** and `code`
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="px-1 py-0.5 bg-slate-900 text-cyan-300 rounded font-mono text-[11px] border border-slate-800">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const quickPrompts = [
    '🌤️ What is Bangalore live weather & AQI right now?',
    '🌊 Check river water stages & reservoir flood status',
    '⚡ What is current electrical demand on master substations?',
    '🚗 Are there any transit bottlenecks on NH48 corridor?',
    '🧪 What happens if an 80mm deluge hits the corridor?',
  ];

  return (
    <>
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[2000] group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-2xl hover:shadow-cyan-500/30 hover:scale-105 transition-all duration-300 border border-white/20 select-none animate-bounce-subtle"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-cyan-200 animate-spin-slow" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold tracking-wider uppercase text-white flex items-center gap-1.5">
              AI Reasoning Space
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 text-[9px] font-mono border border-emerald-400/40">
                LIVE
              </span>
            </span>
            <span className="text-[10px] text-slate-200/90 font-medium">
              Multi-Sensor Intelligence & Memory
            </span>
          </div>
        </button>
      )}

      {/* Floating Reasoning Space Terminal Window */}
      {isOpen && (
        <div
          className={`fixed z-[2500] transition-all duration-300 flex flex-col bg-[#080d1a]/95 backdrop-blur-2xl border border-cyan-500/30 shadow-2xl rounded-2xl overflow-hidden ${
            isExpanded
              ? 'top-4 bottom-4 left-4 right-4 md:left-24 md:right-24'
              : 'bottom-6 right-6 w-[520px] max-w-[calc(100vw-32px)] h-[640px] max-h-[calc(100vh-48px)]'
          }`}
        >
          {/* Header Bar */}
          <div className="h-14 bg-[#0a1122] border-b border-slate-800 px-4 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-100 tracking-wide">
                    REVANA TECHNOLOGIES // OMNI-SENSOR REASONING SPACE
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                    Groq 120B & Sensor Engine
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>15 Real-Time Sensor Connectors Active</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500 font-mono">Memory: {sessionId.substring(0, 14)}...</span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Clear Memory & Start Fresh Session"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore window size' : 'Expand window'}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize Reasoning Space"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-3 py-2 bg-[#060a14] border-b border-slate-800/80 flex gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
                className="px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-600/40 whitespace-nowrap transition text-[10px] shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-600/50 flex items-center justify-center shrink-0 text-cyan-300 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-xl p-3.5 text-xs shadow-md ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                      : 'bg-[#0d1527] border border-slate-800/80 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {/* Collapsible Real-Time Reasoning Chain */}
                  {msg.reasoning && (
                    <div className="mb-2.5 pb-2 border-b border-cyan-900/40">
                      <button
                        type="button"
                        onClick={() => setExpandedReasoningIds(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                        className="flex items-center gap-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono transition"
                      >
                        <Cpu className="w-3 h-3 text-cyan-400 animate-pulse" />
                        <span>{expandedReasoningIds[msg.id] ? 'Hide AI Reasoning Chain' : 'View AI Reasoning & Decision Process'}</span>
                        <ChevronDown className={`w-3 h-3 transform transition-transform ${expandedReasoningIds[msg.id] ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedReasoningIds[msg.id] && (
                        <div className="mt-2 p-2.5 rounded bg-black/50 border border-cyan-800/40 text-[10px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                          {msg.reasoning}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    {renderFormattedContent(msg.content)}
                  </div>

                  {/* Cited Real-Time Sources Pill */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        Cited Real-Time Sources:
                      </span>
                      {msg.sources.map((src, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 bg-slate-900 text-cyan-400 rounded text-[10px] font-mono border border-slate-800"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 text-[9px] text-slate-500 text-right">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-blue-900 border border-blue-600 flex items-center justify-center shrink-0 text-blue-200 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Thinking / Tool Execution Indicator */}
            {loading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center shrink-0 text-cyan-300">
                  <Bot className="w-4 h-4 animate-spin-slow" />
                </div>
                <div className="p-3 rounded-xl bg-[#0d1527] border border-cyan-800/40 text-cyan-300 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Traversing live sensor feeds & synthesizing reasoning...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Dock */}
          <div className="p-3 bg-[#0a1122] border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2 items-center"
            >
              <input
                type="text"
                placeholder="Ask about live weather, AQI, earthquakes, dams, substations, or simulation cascades..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={loading}
                className="flex-1 bg-[#060913] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 shadow-inner"
              />
              <button
                type="submit"
                disabled={loading || !inputMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            </form>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1.5 px-1">
              <span>Enter to send • Multi-turn perpetual session memory enabled</span>
              <span className="text-cyan-400 font-mono">15 Sensors Synchronized</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
