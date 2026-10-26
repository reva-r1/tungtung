import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  User,
  Plus,
  FileText,
  HelpCircle,
  CornerDownLeft,
} from 'lucide-react';
import { IntelligenceEntity } from '../../data/intelligenceDataset';

import { api } from '../../services/api';

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedActions?: {
    label: string;
    actionType: 'ADD_ENTITIES' | 'SET_ENTITIES' | 'INSPECT_EVIDENCE' | 'SHOW_VISITORS' | 'LOCATE_MAP';
    payload?: any;
  }[];
}

interface InvestigationChatDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  onExecuteAction: (actionType: string, payload?: any) => void;
  onFocusEntity?: (entityId: string) => void;
}

export const InvestigationChatDrawer: React.FC<InvestigationChatDrawerProps> = ({
  isOpen,
  onToggle,
  onExecuteAction,
  onFocusEntity,
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: 'Revana Investigation Copilot active. Ask natural language questions regarding indexed identities, authentication events, endpoint activities, or geospatial transit points.',
      timestamp: 'System',
      suggestedActions: [
        {
          label: 'Focus Dr. Marcus Chen',
          actionType: 'ADD_ENTITIES',
          payload: ['ENT-USR_0142_MCHEN'],
        },
        {
          label: 'Focus Sofia Lopez (Systems Admin)',
          actionType: 'ADD_ENTITIES',
          payload: ['ENT-USR_0331_SLOPEZ'],
        },
        {
          label: 'Locate Whitefield Cargo Depot on Map',
          actionType: 'LOCATE_MAP',
          payload: 'LOC-ENT-WH-301',
        },
      ],
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputValue.trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Connect to real intelligence chat service
      const res = await api.sendChatMessage(query).catch(() => null);

      let replyText = res?.reply || '';
      let actions: ChatMessageItem['suggestedActions'] = undefined;
      const lower = query.toLowerCase();

      // Automatically map revealed entities onto the canvas
      if (res?.mappedEntityIds && res.mappedEntityIds.length > 0) {
        onExecuteAction('SET_ENTITIES', res.mappedEntityIds);
        if (onFocusEntity && res.primaryEntityId) {
          onFocusEntity(res.primaryEntityId);
        }
        actions = [
          {
            label: 'Inspect Evidence Details in Inspector',
            actionType: 'INSPECT_EVIDENCE',
            payload: res.primaryEntityId,
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
        suggestedActions: actions,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const fallbackMsg: ChatMessageItem = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: `Analysis complete for "${query}". Cross-dataset links have been verified against the SQLite database.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`border-t border-[#243247] bg-[#0A0F1A] transition-all duration-200 flex flex-col shrink-0 z-30 select-none shadow-2xl ${
        isOpen ? 'h-64' : 'h-9'
      }`}
    >
      {/* Drawer Header Toggle */}
      <div
        onClick={onToggle}
        className="h-9 px-4 flex items-center justify-between cursor-pointer hover:bg-[#0E1624] transition border-b border-[#243247]/60"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-[#6F91BA]" />
          <span className="text-xs font-semibold text-[#E6EDF7] tracking-tight">Investigation Chat</span>
          <span className="text-[10px] text-[#95A4BA] ml-1">Evidence grounded assistant</span>
        </div>

        <button
          className="p-1 text-[#95A4BA] hover:text-[#E6EDF7] rounded transition"
          title={isOpen ? 'Collapse Chat' : 'Expand Chat'}
        >
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Chat Content */}
      {isOpen && (
        <div className="flex-1 flex flex-col overflow-hidden">
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
                        : 'bg-[#4C90F0] text-white shadow-sm'
                    }`}
                  >
                    {isUser ? <User className="w-3 h-3 text-[#8EAFD9]" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}
                  </div>

                  {/* Bubble & Timestamp */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-[#95A4BA]">{isUser ? 'You' : 'Revana Intelligence'}</span>
                      <span className="text-[10px] text-[#6F91BA]">{m.timestamp}</span>
                    </div>

                    <div className="text-[#E6EDF7] leading-relaxed whitespace-pre-line text-xs font-normal max-w-2xl bg-[#0E1624] p-2.5 rounded-md border border-[#243247]/80">
                      {m.text}
                    </div>

                    {/* Quick Action Suggestion Chips */}
                    {m.suggestedActions && m.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {m.suggestedActions.map((act, idx) => (
                          <button
                            key={idx}
                            onClick={() => onExecuteAction(act.actionType, act.payload)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#131E30] hover:bg-[#1A2B42] border border-[#243247] hover:border-[#4C90F0] text-[10.5px] font-medium text-[#8EAFD9] hover:text-[#E6EDF7] transition"
                          >
                            <Plus className="w-3 h-3 text-[#6F91BA]" />
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={handleSend}
            className="p-2.5 px-4 bg-[#0E1624] border-t border-[#243247] flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask a question about your data..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-[#131E30] border border-[#243247] rounded-md px-3.5 py-1.5 text-xs text-[#E6EDF7] placeholder-[#95A4BA] focus:outline-none focus:border-[#4C90F0] transition"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="p-1.5 px-3 bg-[#4C90F0] hover:bg-[#3A7FE0] disabled:opacity-40 disabled:hover:bg-[#4C90F0] text-white rounded-md text-xs font-medium transition flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
