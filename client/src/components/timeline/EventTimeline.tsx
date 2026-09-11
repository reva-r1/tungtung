import React, { useState, useEffect } from 'react';
import { TimelineEvent, RiskLevel } from '../../types';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  FileCheck,
  Truck,
  ArrowRight,
  Shield,
  Search,
  Filter,
  DollarSign
} from 'lucide-react';

interface EventTimelineProps {
  events?: TimelineEvent[];
  className?: string;
  onSelectEvent?: (event: TimelineEvent) => void;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events: propEvents,
  className = '',
  onSelectEvent,
}) => {
  const { selectedEntityId, quickNavigateToEntity } = useInvestigation();
  const [events, setEvents] = useState<TimelineEvent[]>(propEvents || []);
  const [filteredType, setFilteredType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);

  useEffect(() => {
    if (!propEvents) {
      api.getEvents().then((data) => {
        // Sort chronologically ascending for timeline scrubber
        const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setEvents(sorted);
      }).catch(console.error);
    } else {
      const sorted = [...propEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setEvents(sorted);
    }
  }, [propEvents]);

  // Playback timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= events.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, events.length]);

  const filteredEvents = events.filter((ev) => {
    const typeMatch = filteredType === 'ALL' || (ev.event_type || ev.eventType) === filteredType;
    const searchMatch = !searchQuery || 
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      ev.description.toLowerCase().includes(searchQuery.toLowerCase());
    return typeMatch && searchMatch;
  });

  const getSeverityBadge = (sev: RiskLevel) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  const getEventIcon = (type?: string) => {
    switch (type) {
      case 'ANOMALY_DETECTED': return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
      case 'ROUTE_DEVIATION': return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
      case 'FINANCIAL_WIRE': return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'DEPARTURE':
      case 'ARRIVAL':
      case 'CHECKPOINT_PASS': return <Truck className="w-3.5 h-3.5 text-cyan-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#090d16] border border-[#1e293b] rounded-lg overflow-hidden ${className}`}>
      {/* Top Controls & Time Scrubber */}
      <div className="p-3 bg-[#0b1120] border-b border-[#1e293b] space-y-3 z-10 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              CHRONOLOGICAL TELEMETRY TIMELINE
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              ({filteredEvents.length} Events)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event logs..."
              className="bg-[#090d16] border border-[#1e293b] rounded px-2 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
            />

            <select
              value={filteredType}
              onChange={(e) => setFilteredType(e.target.value)}
              className="bg-[#090d16] border border-[#1e293b] rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Event Types</option>
              <option value="ANOMALY_DETECTED">Anomalies Detected</option>
              <option value="ROUTE_DEVIATION">Route Deviations</option>
              <option value="CHECKPOINT_PASS">Checkpoint Passes</option>
              <option value="DEPARTURE">Departures</option>
              <option value="ARRIVAL">Arrivals</option>
              <option value="FINANCIAL_WIRE">Financial Wires</option>
            </select>
          </div>
        </div>

        {/* Playback & Scrubber Controls */}
        <div className="flex items-center gap-3 bg-[#090d16] p-2 rounded border border-[#1e293b]">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 transition flex items-center gap-1 text-xs font-mono font-bold"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY STEP'}</span>
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setPlaybackIndex(0);
            }}
            className="p-1.5 rounded bg-[#1e293b] hover:bg-[#334155] text-slate-300 transition"
            title="Reset Scrubber to Start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              STEP {playbackIndex + 1}/{events.length}
            </span>
            <input
              type="range"
              min="0"
              max={events.length - 1}
              value={playbackIndex}
              onChange={(e) => setPlaybackIndex(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#1e293b] rounded-lg appearance-none"
            />
            <span className="text-[10px] font-mono text-cyan-300 shrink-0">
              {events[playbackIndex] ? new Date(events[playbackIndex].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredEvents.map((ev, index) => {
          const isHighlighted = index === playbackIndex;
          const evType = ev.event_type || ev.eventType;
          const isCritical = ev.severity === 'CRITICAL';

          return (
            <div
              key={ev.id}
              onClick={() => {
                setPlaybackIndex(index);
                if (onSelectEvent) onSelectEvent(ev);
              }}
              className={`p-3.5 rounded-lg transition border text-xs font-mono cursor-pointer ${
                isHighlighted
                  ? 'bg-cyan-950/30 border-cyan-500 shadow-md shadow-cyan-950/50'
                  : 'bg-[#0f172a] hover:bg-[#131d35] border-[#1e293b]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-[#090d16] border border-[#1e293b]">
                    {getEventIcon(evType)}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${getSeverityBadge(ev.severity)}`}>
                    {evType}
                  </span>
                  <span className="font-bold text-slate-100">{ev.title}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {new Date(ev.timestamp).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed my-2">
                {ev.description}
              </p>

              {/* Evidence Points */}
              {ev.evidence && ev.evidence.length > 0 && (
                <div className="p-2 rounded bg-[#090d16] border border-[#1e293b] my-2 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <FileCheck className="w-3 h-3 text-cyan-400" />
                    <span>RECORDED EVIDENCE & AUDIT LOGS</span>
                  </div>
                  {ev.evidence.map((item, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 pl-3 border-l-2 border-cyan-500/40">
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Linked Entities */}
              {ev.entityIds && ev.entityIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#1e293b] mt-2">
                  <span className="text-[10px] text-slate-400">Linked:</span>
                  {ev.entityIds.map((eId) => (
                    <button
                      key={eId}
                      onClick={(e) => {
                        e.stopPropagation();
                        quickNavigateToEntity(eId);
                      }}
                      className="px-2 py-0.5 rounded bg-[#1e293b] hover:bg-cyan-950 text-cyan-300 text-[10px] border border-transparent hover:border-cyan-500/40 transition"
                    >
                      {eId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
