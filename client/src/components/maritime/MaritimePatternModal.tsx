import React, { useState } from 'react';
import { MaritimePattern } from '../../types';
import { api } from '../../services/api';
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Brain,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Anchor,
  X,
  Sparkles,
  Compass
} from 'lucide-react';

interface MaritimePatternModalProps {
  pattern: MaritimePattern;
  onClose: () => void;
  onSelectCorridor?: (region: string) => void;
}

export const MaritimePatternModal: React.FC<MaritimePatternModalProps> = ({
  pattern: initialPattern,
  onClose,
  onSelectCorridor,
}) => {
  const [pattern, setPattern] = useState<MaritimePattern>(initialPattern);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);

  const handleRunAiInvestigation = async () => {
    setIsInvestigating(true);
    try {
      const res = await api.investigateMaritimePattern(pattern.pattern_id);
      setPattern(res.pattern);
      setAiAnalysis(res.analysis);
    } catch (err: any) {
      console.error('Failed to run AI investigation:', err);
    } finally {
      setIsInvestigating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'supported':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> SUPPORTED
          </span>
        );
      case 'weakly_supported':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 border border-amber-500/40 text-amber-300">
            <HelpCircle className="w-3 h-3 text-amber-400" /> WEAKLY SUPPORTED
          </span>
        );
      case 'unsupported':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 border border-rose-500/40 text-rose-300">
            <XCircle className="w-3 h-3 text-rose-400" /> UNSUPPORTED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 border border-purple-500/40 text-purple-300">
            <HelpCircle className="w-3 h-3 text-purple-400" /> UNRESOLVED / UNKNOWN
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0b1120] border border-[#1e293b] rounded-xl shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#090d16] border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Anchor className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  AEGIS MARITIME INTELLIGENCE DOSSIER
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded">
                  {pattern.pattern_id}
                </span>
              </div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {pattern.region}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-slate-300">
          {/* Key Principle Alert */}
          <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                Analytical Integrity Principle: Observation ≠ Explanation
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Observations and statistical anomalies are mathematically verified. Hypotheses represent candidate explanations and remain unproven unless verified by corroborating multi-source evidence. AEGIS never manufactures a conclusion when evidence is insufficient.
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
              <div className="text-[10px] text-slate-400 mb-1">OBSERVED TRAFFIC</div>
              <div className="text-lg font-bold text-cyan-400 font-mono">
                {pattern.entities_observed} <span className="text-xs font-normal text-slate-400">vessels</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Real-time AIS tracked</div>
            </div>

            <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
              <div className="text-[10px] text-slate-400 mb-1">HISTORICAL BASELINE</div>
              <div className="text-lg font-bold text-slate-300 font-mono">
                {pattern.baseline} <span className="text-xs font-normal text-slate-400">vessels/window</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Standard trade corridor</div>
            </div>

            <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
              <div className="text-[10px] text-slate-400 mb-1">VOLUME DEVIATION</div>
              <div className="text-lg font-bold text-amber-400 font-mono flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                +{pattern.deviation_percent}%
              </div>
              <div className="text-[9px] text-amber-500/80 mt-0.5">Statistically significant</div>
            </div>

            <div className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg">
              <div className="text-[10px] text-slate-400 mb-1">PATTERN STATUS</div>
              <div className="mt-1">
                {getStatusBadge(pattern.status)}
              </div>
              <div className="text-[9px] text-slate-500 mt-1.5">Evidence threshold check</div>
            </div>
          </div>

          {/* Section 1: Verified Observation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              <Compass className="w-4 h-4" />
              1. Verified Deterministic Observation
            </div>
            <div className="p-3.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-slate-200 leading-relaxed font-sans text-xs">
              {pattern.observation}
            </div>
          </div>

          {/* Section 2: Generated Candidate Hypotheses */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Brain className="w-4 h-4" />
                2. Candidate Hypotheses & Evidence Evaluation
              </div>
              <span className="text-[10px] text-slate-500">
                {pattern.hypotheses.length} Formulated Paths
              </span>
            </div>

            <div className="space-y-2">
              {pattern.hypotheses.map((h) => (
                <div
                  key={h.id}
                  className="p-3 bg-[#090d16] border border-[#1e293b] rounded-lg space-y-1.5 transition hover:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-400 text-xs">{h.id}:</span>
                      <span className="font-bold text-slate-200 text-xs font-sans">{h.description}</span>
                    </div>
                    {getStatusBadge(h.status)}
                  </div>

                  {h.supporting_evidence && h.supporting_evidence.length > 0 && (
                    <div className="pl-5 text-[11px] text-slate-400 border-l border-slate-800 space-y-0.5 font-sans">
                      {h.supporting_evidence.map((ev, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-cyan-500 font-mono">•</span>
                          <span>{ev}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: AI Intelligence Brief */}
          {aiAnalysis && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                3. AEGIS Lead Intelligence Synthesis
              </div>
              <div className="p-4 bg-cyan-950/20 border border-cyan-800/40 rounded-lg space-y-3 font-sans text-xs">
                <div>
                  <div className="font-bold text-cyan-300 mb-1 font-mono text-[11px]">ANALYTICAL INTERPRETATION:</div>
                  <div className="text-slate-300 whitespace-pre-line leading-relaxed">
                    {aiAnalysis.aiInterpretation}
                  </div>
                </div>

                {aiAnalysis.uncertainty && (
                  <div className="pt-2 border-t border-cyan-900/40">
                    <div className="font-bold text-amber-400 mb-1 font-mono text-[11px]">IDENTIFIED UNCERTAINTIES & EVIDENCE GAPS:</div>
                    <div className="text-slate-400">
                      {aiAnalysis.uncertainty}
                    </div>
                  </div>
                )}

                {aiAnalysis.recommendedActions && aiAnalysis.recommendedActions.length > 0 && (
                  <div className="pt-2 border-t border-cyan-900/40">
                    <div className="font-bold text-cyan-300 mb-1 font-mono text-[11px]">RECOMMENDED INVESTIGATIVE ACTIONS:</div>
                    <ul className="list-disc list-inside text-slate-400 space-y-1">
                      {aiAnalysis.recommendedActions.map((act: string, idx: number) => (
                        <li key={idx}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-3.5 bg-[#090d16] border-t border-[#1e293b]">
          <div className="text-[10px] text-slate-500 font-mono">
            Observation Recorded: {new Date(pattern.detected_at).toLocaleTimeString()}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAiInvestigation}
              disabled={isInvestigating}
              className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-xs font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              <Brain className={`w-3.5 h-3.5 ${isInvestigating ? 'animate-spin' : ''}`} />
              {isInvestigating ? 'Engaging AEGIS Reasoning...' : 'Engage AEGIS Reasoning Engine'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
