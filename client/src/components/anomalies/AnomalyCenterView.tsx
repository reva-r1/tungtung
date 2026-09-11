import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { Anomaly, RiskLevel } from '../../types';
import {
  AlertTriangle,
  Flame,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  ArrowRight,
  ShieldAlert,
  FileCheck,
  Zap,
  Filter,
  ExternalLink
} from 'lucide-react';

export const AnomalyCenterView: React.FC = () => {
  const { quickNavigateToEntity, setActiveView } = useInvestigation();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadAnomalies = async () => {
    setLoading(true);
    try {
      const data = await api.getAnomalies();
      setAnomalies(data);
    } catch (err) {
      console.error('Error fetching anomalies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnomalies();
  }, []);

  const handleRunScan = async () => {
    setScanning(true);
    try {
      await api.scanAnomalies();
      await loadAnomalies();
    } catch (err) {
      console.error('Error scanning anomalies:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.updateAnomalyStatus(id, newStatus);
      setAnomalies((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus as any } : a))
      );
    } catch (err) {
      console.error('Error updating anomaly status:', err);
    }
  };

  const filtered = anomalies.filter((a) => {
    const sevMatch = severityFilter === 'ALL' || a.severity === severityFilter;
    const statMatch = statusFilter === 'ALL' || a.status === statusFilter;
    return sevMatch && statMatch;
  });

  const getSeverityStyle = (sev: RiskLevel) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-950/50';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-950/50';
      case 'MEDIUM':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-blue-950/50';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#090d16] font-mono text-xs">
      {/* Top Banner */}
      <div className="p-5 rounded-lg bg-[#0b1120] border border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-400" />
            <h1 className="text-lg font-bold text-white tracking-wide">
              RULE-BASED ANOMALY & THREAT DETECTION SYSTEM
            </h1>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Automated heuristic detection for impossible speed physics, route deviations, dormant surges, and duplicate transponders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="px-4 py-2 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 text-xs font-bold transition flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'SCANNING HEURISTICS...' : 'TRIGGER FULL RULE SCAN'}</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#0f172a] border border-[#1e293b]">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400 font-bold uppercase">FILTERS:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#090d16] border border-[#1e293b] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#090d16] border border-[#1e293b] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>

        <span className="text-slate-400">
          Displaying <strong className="text-cyan-400">{filtered.length}</strong> of {anomalies.length} total anomalies
        </span>
      </div>

      {/* Anomaly Cards Grid */}
      <div className="space-y-4">
        {filtered.map((anom) => {
          const isCritical = anom.severity === 'CRITICAL';

          return (
            <div
              key={anom.id}
              className={`p-5 rounded-lg bg-[#0f172a] border transition space-y-3 ${
                isCritical ? 'border-rose-500/40 hover:border-rose-400' : 'border-[#1e293b] hover:border-cyan-500/40'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityStyle(anom.severity)}`}>
                    {anom.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">
                    {anom.type}
                  </span>
                  <h3 className="text-sm font-bold text-white">{anom.title}</h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">
                    Confidence: {(anom.confidence * 100).toFixed(0)}%
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      anom.status === 'OPEN'
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                        : anom.status === 'INVESTIGATING'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {anom.status}
                  </span>
                </div>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed max-w-4xl">
                {anom.description}
              </p>

              {/* Evidence Ledger */}
              {anom.evidence && anom.evidence.length > 0 && (
                <div className="p-3 rounded bg-[#090d16] border border-[#1e293b] space-y-1.5">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>RECORDED EVIDENCE LEDGER</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {anom.evidence.map((ev, i) => (
                      <div key={i} className="p-2 rounded bg-[#0b1120] border border-[#1e293b]">
                        <div className="font-bold text-slate-200 text-[11px]">{ev.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{ev.detail}</div>
                        {ev.metric && (
                          <div className="text-[10px] text-amber-400 font-bold mt-1">
                            Metric: {ev.metric}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions & Target Entity */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1e293b]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Target Entity:</span>
                  <button
                    onClick={() => quickNavigateToEntity(anom.entityId)}
                    className="px-2.5 py-1 rounded bg-[#1e293b] hover:bg-cyan-950 text-cyan-300 font-bold transition flex items-center gap-1"
                  >
                    <span>{anom.entityName}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => quickNavigateToEntity(anom.entityId, 'investigation')}
                    className="px-3 py-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 font-bold transition flex items-center gap-1"
                  >
                    <span>OPEN INVESTIGATION</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <select
                    value={anom.status}
                    onChange={(e) => handleUpdateStatus(anom.id, e.target.value)}
                    className="bg-[#090d16] border border-[#1e293b] rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="OPEN">Mark Open</option>
                    <option value="INVESTIGATING">Mark Investigating</option>
                    <option value="CONFIRMED">Mark Confirmed Threat</option>
                    <option value="DISMISSED">Mark Dismissed</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
