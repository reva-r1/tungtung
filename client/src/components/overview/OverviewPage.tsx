import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { Dataset } from '../../types';
import {
  Layers,
  Network,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  UploadCloud,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  MapPin,
  GitMerge,
  Eye,
  RefreshCw,
  FolderOpen
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const { setActiveView, activeDataset, switchActiveDataset, refreshActiveDataset } = useInvestigation();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dsList, dashboardStats] = await Promise.all([
        api.getDatasets(),
        api.getDashboardStats(activeDataset?.id),
      ]);
      setDatasets(dsList);
      setStats(dashboardStats);
    } catch (err) {
      console.error('Error fetching overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDataset]);

  return (
    <div className="flex-1 bg-[#090d16] p-6 overflow-y-auto font-sans">
      {/* Top Header Banner */}
      <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-6 mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-blue-900/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/40 text-[11px] font-mono font-semibold mb-3">
            GOTHAM AI // INTELLIGENCE PLATFORM
          </div>
          <h1 className="text-xl font-bold text-white mb-2 tracking-tight">
            Multi-Dataset Graph & Cross-Reference Intelligence Engine
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed mb-5 font-normal">
            Upload and correlate disparate CSV datasets, PDF reports, Word memos, and scanned manifests into a unified semantic intelligence graph. Discover cross-dataset connections, shared identifiers, and investigate multi-hop relationships with the autonomous AI reasoning analyst.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView('ingestion')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition shadow-md"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Document / Dataset
            </button>
            <button
              onClick={() => setActiveView('investigation')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold border border-slate-700 transition"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              Ask AI Question
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded text-xs font-semibold border border-slate-700/60 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold flex items-center justify-between">
            <span>Uploaded Datasets</span>
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{datasets.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {datasets.length === 0 ? 'No files uploaded yet' : `${datasets.reduce((acc, d) => acc + (d.recordCount || 0), 0).toLocaleString()} total records`}
          </div>
        </div>

        <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold flex items-center justify-between">
            <span>Extracted Entities</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2">{stats?.entityCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Normalized across datasets</div>
        </div>

        <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold flex items-center justify-between">
            <span>Cross-Dataset Links</span>
            <Network className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 mt-2">{stats?.relCount || 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">Shared keys & identifiers</div>
        </div>

        <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-4">
          <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold flex items-center justify-between">
            <span>AI Engine</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-200 mt-2">Active</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Grounded Tool Calling
          </div>
        </div>
      </div>

      {/* Uploaded Datasets Section */}
      <div className="bg-[#0b1120] border border-[#1e293b] rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide font-mono">
              Uploaded Datasets ({datasets.length})
            </h2>
          </div>
          <button
            onClick={() => setActiveView('ingestion')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-mono font-semibold flex items-center gap-1"
          >
            + Upload More <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {datasets.length === 0 ? (
          <div className="py-12 px-4 rounded border border-dashed border-[#1e293b] bg-[#090d16]/50 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-[#0b1120] border border-[#1e293b] flex items-center justify-center text-cyan-400 mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-200 mb-1">No Datasets Uploaded Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
              The intelligence ledger is empty. Upload CSV tables, PDF reports, Word .docx memos, or scanned images to begin automated entity resolution and cross-dataset graph discovery.
            </p>
            <button
              onClick={() => setActiveView('ingestion')}
              className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded text-xs font-mono font-bold transition flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              UPLOAD DOCUMENT OR DATASET
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map((ds) => {
              let columnsList: string[] = [];
              try {
                const schema = typeof ds.detectedSchema === 'string' ? JSON.parse(ds.detectedSchema) : ds.detectedSchema;
                columnsList = schema?.columns || [];
              } catch (_) {}

              const isActive = ds.isActive || activeDataset?.id === ds.id;

              return (
                <div
                  key={ds.id}
                  className={`p-4 rounded-lg border transition flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#0f172a]/90 border-cyan-500/50 shadow-sm ring-1 ring-cyan-500/20'
                      : 'bg-[#090d16] border-[#1e293b] hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileSpreadsheet className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="font-bold text-slate-100 text-xs truncate font-mono" title={ds.name}>
                          {ds.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                            ACTIVE
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                          {ds.format || 'CSV'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Specs */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded bg-[#0b1120] border border-[#1e293b] text-xs font-mono mb-3">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Rows</div>
                        <div className="font-bold text-white mt-0.5">{(ds.recordCount || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Columns</div>
                        <div className="font-bold text-cyan-400 mt-0.5">{columnsList.length || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Status</div>
                        <div className="font-bold text-emerald-400 mt-0.5">Ready</div>
                      </div>
                    </div>

                    {/* Column Badges */}
                    {columnsList.length > 0 && (
                      <div className="mb-3">
                        <div className="text-[10px] font-mono text-slate-400 mb-1">Detected Columns:</div>
                        <div className="flex flex-wrap gap-1">
                          {columnsList.slice(0, 6).map((col) => (
                            <span
                              key={col}
                              className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300"
                            >
                              {col}
                            </span>
                          ))}
                          {columnsList.length > 6 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                              +{columnsList.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#1e293b] text-xs font-mono mt-2">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(ds.uploadedAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <button
                          onClick={async () => {
                            await switchActiveDataset(ds.id);
                            await refreshActiveDataset();
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition border border-slate-700"
                        >
                          SET ACTIVE
                        </button>
                      )}
                      <button
                        onClick={() => setActiveView('ingestion')}
                        className="px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-[10px] font-bold transition border border-cyan-500/40"
                      >
                        INSPECT
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveView('investigation')}
          className="p-4 rounded-lg bg-[#0b1120] border border-[#1e293b] hover:border-cyan-500/40 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-xs">AI Investigation Q&A</div>
              <div className="text-[11px] text-slate-400">Ask natural language questions across datasets</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
        </div>

        <div
          onClick={() => setActiveView('graph')}
          className="p-4 rounded-lg bg-[#0b1120] border border-[#1e293b] hover:border-purple-500/40 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-xs">Unified Graph Visualizer</div>
              <div className="text-[11px] text-slate-400">Explore multi-hop relationships interactively</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition" />
        </div>

        <div
          onClick={() => setActiveView('resolution')}
          className="p-4 rounded-lg bg-[#0b1120] border border-[#1e293b] hover:border-blue-500/40 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-blue-950/60 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-xs">Entity Resolution</div>
              <div className="text-[11px] text-slate-400">Review cross-dataset entity candidates</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition" />
        </div>
      </div>
    </div>
  );
};

