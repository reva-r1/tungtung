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
    <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#0E0F11] font-sans text-xs">
      {/* Header Banner */}
      <div className="p-4 rounded bg-[#151618] border border-[#26292D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-[#4C90F0]" />
            <h1 className="text-sm font-semibold text-[#E6E7E9] tracking-tight">
              Entity Resolution & Record Deduplication
            </h1>
          </div>
          <p className="text-[#8B9097] text-xs mt-1">
            Deterministic token matching and property correlation detect candidate duplicate records across datasets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleScanDuplicates}
            disabled={scanning}
            className="px-3.5 py-1.5 rounded bg-[#4C90F0] hover:bg-[#3A7FE0] disabled:opacity-40 text-white text-xs font-medium transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning...' : 'Scan for Candidates'}</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded bg-[#151618] border border-[#3DB46D]/40 text-[#3DB46D] text-xs flex items-center justify-between font-mono">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-[#8B9097] hover:text-[#E6E7E9]">✕</button>
        </div>
      )}

      {/* Main Resolution Comparison Grid */}
      {candidates.length > 0 && activeCandidate ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column: Candidates Queue */}
          <div className="space-y-2.5">
            <div className="text-[10px] font-semibold text-[#8B9097] uppercase tracking-wider">
              Pending Candidates ({candidates.length})
            </div>

            <div className="space-y-1.5">
              {candidates.map((cand) => {
                const isSelected = cand.id === activeCandidate.id;
                return (
                  <button
                    key={cand.id}
                    onClick={() => setActiveCandidateId(cand.id)}
                    className={`w-full text-left p-3 rounded border transition space-y-1.5 ${
                      isSelected
                        ? 'bg-[#1C1E21] border-[#4C90F0]'
                        : 'bg-[#151618] hover:bg-[#1C1E21] border-[#26292D]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-[#151618] border border-[#26292D] text-[#4C90F0]">
                        {cand.type}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-[#F5A524]">
                        {(cand.confidence * 100).toFixed(0)}% Match
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-[#E6E7E9] truncate">{cand.targetName}</div>
                      <div className="text-[11px] text-[#8B9097] truncate">vs. {cand.sourceName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 2 Columns: Side-by-Side Comparator */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 rounded bg-[#151618] border border-[#26292D] space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#26292D] pb-3">
                <div>
                  <span className="text-[10px] text-[#8B9097] font-mono block">CANDIDATE: {activeCandidate.id}</span>
                  <div className="text-sm font-semibold text-[#E6E7E9] mt-0.5">
                    Match Confidence: <span className="text-[#F5A524] font-mono">{(activeCandidate.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <span className="text-[10px] text-[#8B9097] block mt-0.5">
                    Calculated from field token similarity and attribute collisions.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolve(activeCandidate.id, 'REJECT')}
                    className="px-3 py-1.5 rounded bg-[#1C1E21] hover:bg-[#26292D] border border-[#26292D] text-[#E5484D] text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5 text-[#E5484D]" />
                    <span>Keep Separate</span>
                  </button>

                  <button
                    onClick={() => handleResolve(activeCandidate.id, 'MERGE')}
                    className="px-3 py-1.5 rounded bg-[#3DB46D] hover:bg-[#349e5f] text-white text-xs font-medium transition flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Confirm Merge</span>
                  </button>
                </div>
              </div>

              {/* Match Reasons */}
              <div className="p-3 rounded bg-[#1C1E21] border border-[#26292D] space-y-1">
                <span className="text-[10px] text-[#F5A524] uppercase font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F5A524]" />
                  Heuristic Match Evidence
                </span>
                <div className="space-y-1">
                  {activeCandidate.matchReasons?.map((reason, idx) => (
                    <div key={idx} className="text-xs text-[#E6E7E9] pl-2 border-l-2 border-[#F5A524]">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>

              {/* Side-by-Side Comparison Columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Target / Retained Record */}
                <div className="p-3.5 rounded bg-[#1C1E21] border border-[#4C90F0]/40 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#26292D] pb-1.5">
                    <span className="text-[10px] font-semibold text-[#4C90F0] uppercase">
                      Primary Record (Retained)
                    </span>
                    <button
                      onClick={() => quickNavigateToEntity(activeCandidate.targetEntityId)}
                      className="text-[10px] text-[#8B9097] hover:text-[#4C90F0] flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs font-semibold text-[#E6E7E9]">{activeCandidate.targetName}</div>
                  <div className="text-[10px] text-[#8B9097] font-mono">ID: {activeCandidate.targetEntityId}</div>

                  <div className="space-y-1 pt-1.5 border-t border-[#26292D]">
                    {Object.entries(activeCandidate.targetProps || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[11px] py-0.5 border-b border-[#26292D]/40 last:border-0">
                        <span className="text-[#8B9097]">{k}:</span>
                        <span className="text-[#E6E7E9] font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source / Secondary Record */}
                <div className="p-3.5 rounded bg-[#1C1E21] border border-[#F5A524]/40 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#26292D] pb-1.5">
                    <span className="text-[10px] font-semibold text-[#F5A524] uppercase">
                      Secondary Record (Merged In)
                    </span>
                    <button
                      onClick={() => quickNavigateToEntity(activeCandidate.sourceEntityId)}
                      className="text-[10px] text-[#8B9097] hover:text-[#F5A524] flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs font-semibold text-[#E6E7E9]">{activeCandidate.sourceName}</div>
                  <div className="text-[10px] text-[#8B9097] font-mono">ID: {activeCandidate.sourceEntityId}</div>

                  <div className="space-y-1 pt-1.5 border-t border-[#26292D]">
                    {Object.entries(activeCandidate.sourceProps || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[11px] py-0.5 border-b border-[#26292D]/40 last:border-0">
                        <span className="text-[#8B9097]">{k}:</span>
                        <span className="text-[#E6E7E9] font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Merge Notes */}
              <div>
                <label className="text-[10px] text-[#8B9097] uppercase block mb-1">
                  Analyst Resolution Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  value={analystNotes}
                  onChange={(e) => setAnalystNotes(e.target.value)}
                  placeholder="e.g. Verified license registry and matching tax identifiers..."
                  className="w-full bg-[#1C1E21] border border-[#26292D] rounded p-2 text-[#E6E7E9] placeholder-[#8B9097] focus:outline-none focus:border-[#4C90F0] text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-10 rounded bg-[#151618] border border-[#26292D] text-center space-y-2.5">
          <Check className="w-6 h-6 text-[#3DB46D] mx-auto" />
          <h3 className="text-sm font-semibold text-[#E6E7E9]">No Pending Entity Merges</h3>
          <p className="text-[#8B9097] text-xs max-w-md mx-auto">
            All records in the current database have been reviewed. Click "Scan for Candidates" to run fuzzy deduplication algorithms across new records.
          </p>
        </div>
      )}
    </div>
  );
};
