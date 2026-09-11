import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { MergeCandidate } from '../../types';
import { useInvestigation } from '../../context/InvestigationContext';
import {
  GitMerge,
  RefreshCw,
  Check,
  X,
  Shield,
  Layers,
  ArrowRight,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export const EntityResolutionView: React.FC = () => {
  const { quickNavigateToEntity } = useInvestigation();
  const [candidates, setCandidates] = useState<MergeCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [analystNotes, setAnalystNotes] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await api.getMergeCandidates('PENDING');
      setCandidates(data);
      if (data.length > 0) setActiveCandidateId(data[0].id);
    } catch (err) {
      console.error('Error fetching merge candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  const handleScanDuplicates = async () => {
    setScanning(true);
    try {
      await api.scanMergeCandidates();
      await loadCandidates();
      setActionMessage('Entity resolution scan complete. Duplicate candidates detected.');
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleResolve = async (candidateId: string, action: 'MERGE' | 'REJECT') => {
    try {
      await api.resolveCandidate(candidateId, action, analystNotes);
      setActionMessage(
        action === 'MERGE'
          ? 'Entities successfully merged. Relationships re-routed, aliases unified.'
          : 'Candidate marked as distinct entities.'
      );
      setAnalystNotes('');
      await loadCandidates();
    } catch (err) {
      console.error('Resolution error:', err);
    }
  };

  const activeCandidate = candidates.find((c) => c.id === activeCandidateId) || candidates[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#090d16] font-mono text-xs">
      {/* Header Banner */}
      <div className="p-5 rounded-lg bg-[#0b1120] border border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold text-white tracking-wide">
              ENTITY RESOLUTION & MERGE MANAGEMENT
            </h1>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Fuzzy matching, token set Jaccard, and property correlation identify probable duplicate records. Analyst approval required before merging.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScanDuplicates}
            disabled={scanning}
            className="px-4 py-2 rounded bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 text-xs font-bold transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'SCANNING TOKENS...' : 'SCAN FOR CANDIDATES'}</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 font-bold">✕</button>
        </div>
      )}

      {/* Main Resolution Comparison Grid */}
      {candidates.length > 0 && activeCandidate ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Candidates Queue */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              PENDING MATCHES ({candidates.length})
            </div>

            <div className="space-y-2">
              {candidates.map((cand) => {
                const isSelected = cand.id === activeCandidate.id;
                return (
                  <button
                    key={cand.id}
                    onClick={() => setActiveCandidateId(cand.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition space-y-2 ${
                      isSelected
                        ? 'bg-amber-950/30 border-amber-500 shadow-md'
                        : 'bg-[#0f172a] hover:bg-[#1e293b] border-[#1e293b]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {cand.type}
                      </span>
                      <span className="text-[11px] font-bold text-amber-400">
                        {(cand.confidence * 100).toFixed(0)}% MATCH
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white truncate">{cand.targetName}</div>
                      <div className="text-[11px] text-slate-400 truncate">vs. {cand.sourceName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 2 Columns: Side-by-Side Comparator */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e293b] pb-3">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">CANDIDATE ID: {activeCandidate.id}</span>
                  <div className="text-base font-bold text-white mt-0.5">
                    Match Confidence: <span className="text-amber-400">{(activeCandidate.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolve(activeCandidate.id, 'REJECT')}
                    className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold transition flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>KEEP SEPARATE</span>
                  </button>

                  <button
                    onClick={() => handleResolve(activeCandidate.id, 'MERGE')}
                    className="px-4 py-1.5 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-200 font-bold transition flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>MERGE ENTITIES</span>
                  </button>
                </div>
              </div>

              {/* Match Reasons */}
              <div className="p-3 rounded bg-[#090d16] border border-[#1e293b] space-y-1.5">
                <span className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  HEURISTIC MATCH INDICATORS
                </span>
                <div className="space-y-1">
                  {activeCandidate.matchReasons?.map((reason, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 pl-2 border-l-2 border-amber-500/50">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>

              {/* Side-by-Side Comparison Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target / Retained Record */}
                <div className="p-4 rounded bg-[#090d16] border border-cyan-500/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase">
                      PRIMARY RECORD (RETAINED)
                    </span>
                    <button
                      onClick={() => quickNavigateToEntity(activeCandidate.targetEntityId)}
                      className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm font-bold text-white">{activeCandidate.targetName}</div>
                  <div className="text-[10px] text-slate-400">ID: {activeCandidate.targetEntityId}</div>

                  <div className="space-y-1.5 pt-2 border-t border-[#1e293b]">
                    {Object.entries(activeCandidate.targetProps || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-slate-200 font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source / Secondary Record */}
                <div className="p-4 rounded bg-[#090d16] border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
                    <span className="text-[10px] font-bold text-amber-400 uppercase">
                      SECONDARY RECORD (MERGED IN)
                    </span>
                    <button
                      onClick={() => quickNavigateToEntity(activeCandidate.sourceEntityId)}
                      className="text-[10px] text-slate-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm font-bold text-white">{activeCandidate.sourceName}</div>
                  <div className="text-[10px] text-slate-400">ID: {activeCandidate.sourceEntityId}</div>

                  <div className="space-y-1.5 pt-2 border-t border-[#1e293b]">
                    {Object.entries(activeCandidate.sourceProps || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-slate-200 font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Merge Notes */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">
                  ANALYST RESOLUTION AUDIT NOTES (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={analystNotes}
                  onChange={(e) => setAnalystNotes(e.target.value)}
                  placeholder="e.g. Verified trade license matches registered entity..."
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded p-2 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-lg bg-[#0f172a] border border-[#1e293b] text-center space-y-3">
          <Check className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">No Pending Entity Merges</h3>
          <p className="text-slate-400 text-xs max-w-md mx-auto">
            All records in the current database have been reviewed. Click "Scan for Candidates" to run fuzzy deduplication algorithms across new records.
          </p>
        </div>
      )}
    </div>
  );
};
