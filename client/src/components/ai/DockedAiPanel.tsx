import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useInvestigation } from '../../context/InvestigationContext';
import {
  Send,
  X,
  Trash2,
  Cpu,
  ChevronDown,
  CheckCircle2,
  Bot,
  User,
  Sparkles,
  Layers,
  Database,
  MapPin,
  Network,
  Users,
  Search,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  sources?: string[];
  timestamp: string;
}

export const DockedAiPanel: React.FC = () => {
  const {
    isAiPanelOpen,
    setIsAiPanelOpen,
    activeView,
    setActiveView,
    selectedEntity,
    selectedEntityId,
    activeDataset,
    mapInquiryToGraph,
  } = useInvestigation();

  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize persistent session ID from localStorage
  useEffect(() => {
    let savedSession = localStorage.getItem('revana_reasoning_session_id');
    if (!savedSession) {
      savedSession = `session_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('revana_reasoning_session_id', savedSession);
    }
    setSessionId(savedSession);

    // Load initial chat history from backend
    api.getChatHistory(savedSession)
      .then((res) => {
        if (res.history && res.history.length > 0) {
          setMessages(res.history);
        } else {
          setMessages([
            {
              id: 'welcome_msg',
              role: 'assistant',
              content:
                'AI Analytical Assistant ready. Ask questions about active datasets, graph relationships, map telemetry, or cross-database entity records. Context is automatically synced with your current workspace.',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      })
      .catch((err) => console.error('Failed to load chat history:', err));
  }, []);

  // Keyboard shortcut Ctrl+J / Cmd+J to toggle AI panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsAiPanelOpen(!isAiPanelOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiPanelOpen, setIsAiPanelOpen]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isAiPanelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiPanelOpen, loading]);

  // Dynamic context tag based on current user workspace & selection
  const currentContextTag = React.useMemo(() => {
    if (selectedEntity) {
      return {
        icon: Users,
        label: `Entity: ${selectedEntity.name || selectedEntity.id}`,
        type: 'entity',
      };
    }
    if (activeView === 'map') {
      return { icon: MapPin, label: 'Tactical Map Workspace', type: 'map' };
    }
    if (activeView === 'graph') {
      return { icon: Network, label: 'Entity Relationship Graph', type: 'graph' };
    }
    if (activeView === 'ingestion' || activeView === 'sources') {
      return {
        icon: Database,
        label: activeDataset ? `Dataset: ${activeDataset.name}` : 'Datasets Workspace',
        type: 'dataset',
      };
    }
    if (activeView === 'investigation') {
      return { icon: Search, label: 'Investigation Workspace', type: 'investigation' };
    }
    return { icon: Layers, label: 'Global Intelligence Workspace', type: 'general' };
  }, [activeView, selectedEntity, activeDataset]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    // Attach concise workspace context prompt prefix if relevant and not already in prompt
    let contextualText = text;
    if (selectedEntity && !text.includes(selectedEntity.id)) {
      contextualText = `[Context Entity: ${selectedEntity.id} (${selectedEntity.name || selectedEntity.type})] ${text}`;
    }

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const res = await api.sendChatMessage(contextualText, sessionId);
      const assistantMessage: ChatMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        reasoning: res.reasoning,
        sources: res.sources,
        timestamp: res.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      if (res.mappedEntityIds && res.mappedEntityIds.length > 0) {
        mapInquiryToGraph(res.mappedEntityIds, res.primaryEntityId || undefined);
        setActiveView('investigation');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `Inference notice: ${err.message || 'Unable to communicate with AI engine.'}`,
          timestamp: new Date().toISOString(),
        },
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
          content: 'Session memory cleared. Ready for fresh analytical inquiries.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error('Failed to clear chat memory:', err);
    }
  };

  if (!isAiPanelOpen) return null;

  const ContextIcon = currentContextTag.icon;

  return (
    <aside
      className={`fixed top-12 bottom-0 right-0 z-40 bg-[#151618] border-l border-[#26292D] flex flex-col shadow-2xl transition-all duration-200 select-none ${
        isMaximized ? 'w-[640px]' : 'w-[400px]'
      }`}
    >
      {/* Panel Header */}
      <div className="h-12 border-b border-[#26292D] px-4 flex items-center justify-between shrink-0 bg-[#151618]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#1C1E21] border border-[#26292D] flex items-center justify-center text-[#4C90F0]">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-[#E6E7E9] tracking-tight">AI Assistant</span>
        </div>

        <div className="flex items-center gap-1 text-[#8B9097]">
          <button
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-1 hover:text-[#E6E7E9] hover:bg-[#1C1E21] rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore Width' : 'Expand Width'}
            className="p-1 hover:text-[#E6E7E9] hover:bg-[#1C1E21] rounded transition"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsAiPanelOpen(false)}
            title="Close Panel (Ctrl+J)"
            className="p-1 hover:text-[#E6E7E9] hover:bg-[#1C1E21] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Workspace Context Tag */}
      <div className="px-3.5 py-1.5 bg-[#1C1E21] border-b border-[#26292D] flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-[#8B9097] truncate">
          <ContextIcon className="w-3.5 h-3.5 text-[#4C90F0] shrink-0" />
          <span className="truncate text-[#E6E7E9] font-medium">{currentContextTag.label}</span>
        </div>
        <span className="text-[10px] font-mono text-[#8B9097] shrink-0">Ctrl+J</span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-1 ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {/* Sender & Timestamp */}
            <div className="flex items-center gap-1.5 text-[10px] text-[#8B9097] px-1">
              {msg.role === 'user' ? (
                <span>You</span>
              ) : (
                <span className="text-[#4C90F0] font-medium">Revana Analyst</span>
              )}
              <span>•</span>
              <span>
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {/* Bubble */}
            <div
              className={`p-3 rounded text-xs leading-relaxed max-w-[92%] ${
                msg.role === 'user'
                  ? 'bg-[#4C90F0] text-white'
                  : 'bg-[#1C1E21] text-[#E6E7E9] border border-[#26292D]'
              }`}
            >
              {/* Optional Collapsible Reasoning */}
              {msg.reasoning && (
                <div className="mb-2 pb-2 border-b border-[#26292D]">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReasoningIds((prev) => ({
                        ...prev,
                        [msg.id]: !prev[msg.id],
                      }))
                    }
                    className="flex items-center gap-1 text-[10px] text-[#4C90F0] font-mono"
                  >
                    <Cpu className="w-3 h-3" />
                    <span>
                      {expandedReasoningIds[msg.id] ? 'Hide Reasoning' : 'Reasoning Process'}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transform transition-transform ${
                        expandedReasoningIds[msg.id] ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedReasoningIds[msg.id] && (
                    <div className="mt-1.5 p-2 rounded bg-[#151618] border border-[#26292D] text-[10px] text-[#8B9097] font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {msg.reasoning}
                    </div>
                  )}
                </div>
              )}

              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Verified Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-1.5 border-t border-[#26292D] flex flex-wrap gap-1">
                  {msg.sources.map((s, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 rounded bg-[#151618] border border-[#26292D] text-[9px] font-mono text-[#8B9097]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-2.5 rounded bg-[#1C1E21] border border-[#26292D] text-xs text-[#8B9097]">
            <div className="w-2 h-2 rounded-full bg-[#4C90F0] animate-ping" />
            <span>Analyzing contextual evidence...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Dock */}
      <div className="p-3 border-t border-[#26292D] bg-[#151618] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={loading}
            placeholder={`Ask about ${currentContextTag.label}...`}
            className="flex-1 bg-[#1C1E21] border border-[#26292D] rounded px-3 py-2 text-xs text-[#E6E7E9] placeholder-[#8B9097] focus:outline-none focus:border-[#4C90F0] transition"
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="p-2 bg-[#4C90F0] hover:bg-[#3A7FE0] text-white rounded transition disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
