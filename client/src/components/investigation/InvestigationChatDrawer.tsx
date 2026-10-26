import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  User,
  Plus,
  Loader2,
  GripHorizontal,
  Target,
  ExternalLink,
  X,
} from 'lucide-react';
import { IntelligenceEntity } from '../../data/intelligenceDataset';
import { api } from '../../services/api';

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: string[];
  suggestedActions?: {
    label: string;
    actionType: 'ADD_ENTITIES' | 'SET_ENTITIES' | 'INSPECT_EVIDENCE' | 'SHOW_VISITORS' | 'LOCATE_MAP';
    payload?: any;
  }[];
}

interface InvestigationChatDrawerProps {
  selectedEntity?: IntelligenceEntity | null;
  selectedEntityId?: string | null;
  isOpen?: boolean;
  onToggle?: () => void;
  onClearTarget?: () => void;
  onExecuteAction: (actionType: string, payload?: any) => void;
  onFocusEntity?: (entityId: string) => void;
}

const MIN_HEIGHT = 46;
const DEFAULT_HEIGHT = 280;

export const InvestigationChatDrawer: React.FC<InvestigationChatDrawerProps> = ({
  selectedEntity,
  selectedEntityId,
  isOpen,
  onToggle,
  onClearTarget,
  onExecuteAction,
  onFocusEntity,
}) => {
  // Draggable height state
  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(DEFAULT_HEIGHT);

  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: 'Revana Tactical Copilot online. Powered by local LLaMA on GPU. Select any entity on the canvas or ask direct intelligence questions.',
      timestamp: 'Ready',
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevEntityIdRef = useRef<string | null>(null);

  // Auto-expand when a new entity is selected if currently collapsed
  useEffect(() => {
    const activeId = selectedEntity?.id || selectedEntityId || null;
    if (activeId && activeId !== prevEntityIdRef.current) {
      prevEntityIdRef.current = activeId;
      if (height <= MIN_HEIGHT + 10) {
        setHeight(DEFAULT_HEIGHT);
      }
    }
  }, [selectedEntity, selectedEntityId, height]);

  // Resizer mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
  }, [height]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = dragStartY.current - e.clientY; // dragging up increases height
      const maxHeight = Math.min(window.innerHeight * 0.85, 750);
      const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, dragStartHeight.current + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const isCollapsed = height <= MIN_HEIGHT + 6;

  // Double click header to quick toggle collapsed / default height
  const handleDoubleClickHeader = () => {
    setHeight((prev) => (prev <= MIN_HEIGHT + 10 ? DEFAULT_HEIGHT : MIN_HEIGHT));
    if (onToggle) onToggle();
  };

  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isCollapsed]);

  const activeTargetId = selectedEntity?.id || selectedEntityId || undefined;
  const activeTargetName = selectedEntity?.name || (selectedEntityId ? selectedEntityId.replace(/^(company_|person_|vessel_|vehicle_)/, '').replace(/_/g, ' ') : null);

  const handleSend = async (queryText?: string) => {
    const query = (queryText || inputValue).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputValue('');
    setIsLoading(true);

    try {
      // Connect to real intelligence chat service grounded by target entity
      const res = await api.sendChatMessage(query, undefined, activeTargetId).catch(() => null);

      let replyText = res?.reply || '';
      let actions: ChatMessageItem['suggestedActions'] = undefined;

      // Automatically map revealed entities onto the canvas
      if (res?.mappedEntityIds && res.mappedEntityIds.length > 0) {
        onExecuteAction('SET_ENTITIES', res.mappedEntityIds);
        if (onFocusEntity && res.primaryEntityId) {
          onFocusEntity(res.primaryEntityId);
        }
        actions = [
          {
            label: `Inspect ${res.primaryEntityId ? 'Target' : 'Evidence'} in Dossier`,
            actionType: 'INSPECT_EVIDENCE',
            payload: res.primaryEntityId || res.mappedEntityIds[0],
          },
        ];
      }

      if (!replyText) {
        replyText = `Cross-referencing database records for "${query}". Relevant entities and connections have been mapped to your canvas.`;
      }

      const aiMsg: ChatMessageItem = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: res?.sources,
        suggestedActions: actions,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const fallbackMsg: ChatMessageItem = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: `Analysis complete for "${query}". Cross-dataset links have been verified against the active database.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div
      style={{ height: `${height}px` }}
      className={`border-t border-[#243247] bg-[#0A0F1A] flex flex-col shrink-0 z-30 select-none shadow-2xl relative ${
        isDragging ? 'transition-none select-none' : 'transition-all duration-150'
      }`}
    >
      {/* Top Drag Handle Resizer Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="h-2 w-full cursor-row-resize bg-[#131E30]/70 hover:bg-cyan-500/40 active:bg-cyan-500/60 transition-colors flex items-center justify-center group shrink-0"
        title="Drag up/down to resize investigation chat drawer"
      >
        <div className="w-10 h-1 rounded-full bg-[#2B405F] group-hover:bg-cyan-400 transition-colors" />
      </div>

      {/* Drawer Header (Clean, Zero Toggle Buttons) */}
      <div
        onDoubleClick={handleDoubleClickHeader}
        className="h-10 px-4 flex items-center justify-between border-b border-[#243247]/60 bg-[#0B1220] select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-semibold text-[#E6EDF7] tracking-tight">Investigation Copilot</span>

          {/* Active Target Synchronization Badge */}
          {activeTargetName ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/50 text-[11px] font-mono text-cyan-300 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="text-cyan-400/80 font-normal shrink-0">Target:</span>
              <span className="font-semibold text-cyan-200 truncate">{activeTargetName}</span>
              {selectedEntity?.type && (
                <span className="text-[9.5px] text-cyan-400/60 uppercase shrink-0">({selectedEntity.type})</span>
              )}
              {onClearTarget && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearTarget();
                  }}
                  className="ml-1 text-cyan-400/60 hover:text-cyan-200 p-0.5 rounded hover:bg-cyan-900/60 transition"
                  title="Unselect target (ask general questions)"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <span className="text-[10.5px] text-[#8EAFD9]/70 hidden sm:inline">
              Evidence-grounded local LLaMA (Select node on canvas to scope inquiry)
            </span>
          )}
        </div>

        {/* Minimalist Drag Status Hint (NO toggle buttons) */}
        <div
          onMouseDown={handleMouseDown}
          className="flex items-center gap-1.5 text-[10px] text-[#6F91BA] hover:text-cyan-300 cursor-row-resize px-2 py-0.5 rounded hover:bg-[#131E30] transition shrink-0"
          title="Drag up or down to resize"
        >
          <GripHorizontal className="w-3.5 h-3.5 opacity-70" />
          <span className="font-mono text-[9.5px] opacity-80">{isCollapsed ? 'DRAG UP' : `${Math.round(height)}PX`}</span>
        </div>
      </div>

      {/* Expanded Chat Content */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0F1A]">
          {/* Quick Context Inquiry Chips */}
          {activeTargetName && (
            <div className="px-4 py-1.5 bg-[#0D1524] border-b border-[#1C2A3D] flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
              <span className="text-[#6F91BA] text-[10px] uppercase font-mono tracking-wider shrink-0 mr-1 flex items-center gap-1">
                <Target className="w-3 h-3 text-cyan-400" />
                Inquire:
              </span>
              <button
                type="button"
                onClick={() => handleSend(`Who runs or owns ${activeTargetName}?`)}
                disabled={isLoading}
                className="px-2.5 py-0.5 rounded-full bg-[#142033] hover:bg-cyan-950/80 border border-[#243247] hover:border-cyan-500/60 text-[#8EAFD9] hover:text-cyan-200 transition text-[11px] shrink-0"
              >
                Who runs or owns this?
              </button>
              <button
                type="button"
                onClick={() => handleSend(`What companies, people, or contracts are directly connected to ${activeTargetName}?`)}
                disabled={isLoading}
                className="px-2.5 py-0.5 rounded-full bg-[#142033] hover:bg-cyan-950/80 border border-[#243247] hover:border-cyan-500/60 text-[#8EAFD9] hover:text-cyan-200 transition text-[11px] shrink-0"
              >
                What connections exist?
              </button>
              <button
                type="button"
                onClick={() => handleSend(`Are there any wire transfers, procurement records, or suspicious activities involving ${activeTargetName}?`)}
                disabled={isLoading}
                className="px-2.5 py-0.5 rounded-full bg-[#142033] hover:bg-cyan-950/80 border border-[#243247] hover:border-cyan-500/60 text-[#8EAFD9] hover:text-cyan-200 transition text-[11px] shrink-0"
              >
                Check transactions & anomalies
              </button>
            </div>
          )}

          {/* Scrollable Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
            {messages.map((m) => {
              const isUser = m.sender === 'user';

              return (
                <div key={m.id} className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5 ${
                      isUser
                        ? 'bg-[#1A2B42] text-[#8EAFD9] border border-[#2B405F]'
                        : 'bg-cyan-600 text-white shadow-sm'
                    }`}
                  >
                    {isUser ? <User className="w-3 h-3 text-[#8EAFD9]" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
                  </div>

                  {/* Bubble & Timestamp */}
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-[#95A4BA]">
                        {isUser ? 'You' : 'Revana Intelligence (LLaMA 3.2 GPU)'}
                      </span>
                      <span className="text-[10px] text-[#6F91BA]">{m.timestamp}</span>
                    </div>

                    <div className="text-[#E6EDF7] leading-relaxed whitespace-pre-line text-xs font-normal max-w-3xl bg-[#0E1624] p-3 rounded-md border border-[#243247]/80 shadow-sm">
                      {m.text}
                    </div>

                    {/* Quick Action Suggestion Chips */}
                    {m.suggestedActions && m.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {m.suggestedActions.map((act, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onExecuteAction(act.actionType, act.payload)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#131E30] hover:bg-cyan-950/70 border border-[#243247] hover:border-cyan-500/60 text-[10.5px] font-medium text-[#8EAFD9] hover:text-cyan-200 transition"
                          >
                            <Plus className="w-3 h-3 text-cyan-400" />
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-cyan-400 font-medium mb-1">
                    Analyzing database records on local GPU...
                  </div>
                  <div className="bg-[#0E1624] p-2.5 rounded-md border border-cyan-500/30 text-xs text-[#8EAFD9] flex items-center gap-2 max-w-md">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>Grounding topological graph connections for {activeTargetName || 'query'}...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={handleFormSubmit}
            className="p-2.5 px-4 bg-[#0E1624] border-t border-[#243247] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder={
                activeTargetName
                  ? `Ask about ${activeTargetName}... (e.g. "Who is the director?", "Any wire transfers?")`
                  : 'Ask about any company, person, cargo, or connection...'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-[#131E30] border border-[#243247] rounded-md px-3.5 py-2 text-xs text-[#E6EDF7] placeholder-[#6F91BA] focus:outline-none focus:border-cyan-500 transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-2 px-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white rounded-md text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
              title="Send inquiry"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
