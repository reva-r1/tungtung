import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import {
  ShieldAlert,
  Network,
  Users,
  Building2,
  Truck,
  Package,
  Warehouse,
  AlertTriangle,
  FolderKanban,
  ArrowRight,
  TrendingUp,
  Activity,
  Flame,
  Search,
  ExternalLink,
  Zap
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { setActiveView, quickNavigateToEntity, setGlobalSearchQuery, setActiveNlResult, activeDataset } = useInvestigation();
  const [stats, setStats] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [statsData, anomalyData, invData, datasetsData] = await Promise.all([
          api.getDashboardStats(activeDataset?.id),
          api.getAnomalies(),
          api.getInvestigations(),
          api.getDatasets(),
        ]);
        setStats(statsData);
        setAnomalies(anomalyData);
        setInvestigations(invData);
        setDatasets(datasetsData);
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, [activeDataset]);

  const dynamicQuickPrompts = React.useMemo(() => {
    if (datasets.length === 0) {
      return [
        'Upload your first CSV dataset in the Datasets module to begin intelligence analysis',
        'Discover hidden relationship patterns and foreign key linkages across files',
        'Detect anomalous clusters and high-degree hub entities in uploaded records',
      ];
    }

    const prompts: string[] = [
      'Detect high-degree hub entities and key brokers across all datasets',
      'Discover cross-dataset relationship bridges and shared foreign keys',
      'Identify shared identifier collisions (duplicate phones, emails, accounts, addresses)',
    ];

    if (datasets.length >= 2) {
      prompts.push(`Correlate entities linking "${datasets[0].name}" and "${datasets[1].name}"`);
    }

    if (datasets[0]?.detectedSchema?.columns?.length > 0) {
      const topCol = datasets[0].detectedSchema.columns[0]?.name;
      prompts.push(`Analyze statistical distributions and outliers for column "${topCol}" in ${datasets[0].name}`);
    }

    prompts.push('Find isolated / orphaned records that have zero graph linkages');
    return prompts.slice(0, 6);
  }, [datasets]);

  const handleQuickPrompt = async (queryText: string) => {
    setGlobalSearchQuery(queryText);
    try {
      const res = await api.executeNlQuery(queryText);
      setActiveNlResult(res);
      setActiveView('investigation');
    } catch (err) {
      console.error(err);
    }
  };

  const entityIcon = (type: string) => {
    switch (type) {
      case 'COMPANY': return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'PERSON': return <Users className="w-3.5 h-3.5 text-blue-400" />;
      case 'VEHICLE': return <Truck className="w-3.5 h-3.5 text-cyan-400" />;
      case 'SHIPMENT': return <Package className="w-3.5 h-3.5 text-purple-400" />;
      case 'WAREHOUSE': return <Warehouse className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#090d16]">
        <div className="flex items-center gap-3 text-cyan-400 font-mono text-xs">
          <Activity className="w-5 h-5 animate-spin" />
          <span>SYNCHRONIZING AEGIS GRAPH METRICS...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#090d16]">
      {/* Top Banner / Operational Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-[#0b1120] border border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <h1 className="text-lg font-mono font-bold text-white tracking-wide">
              TACTICAL INTELLIGENCE COMMAND // OVERVIEW
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            {datasets.length === 0
              ? 'Active Intelligence Ledger • No Datasets Ingested (Upload CSV in Datasets Module)'
              : `Active Multi-Source Graph • ${datasets.length} Ingested Dataset(s) • ${stats?.entityCount || 0} Correlated Entities`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('investigation')}
            className="px-3.5 py-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <span>OPEN INVESTIGATION DOCK</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-lg bg-[#0f172a] border border-[#1e293b]">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">ENTITIES</div>
          <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">{stats?.entityCount || 0}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400">Canonical</span> Graph Nodes
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0f172a] border border-[#1e293b]">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">RELATIONSHIPS</div>
          <div className="text-2xl font-mono font-bold text-blue-400 mt-1">{stats?.relCount || 0}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-cyan-400">Cross-Dataset</span> Edges
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0f172a] border border-rose-500/30 bg-rose-950/10">
          <div className="text-[10px] font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <Flame className="w-3 h-3 text-rose-400" />
            OPEN ANOMALIES
          </div>
          <div className="text-2xl font-mono font-bold text-rose-400 mt-1">{stats?.anomalyCount || 0}</div>
          <div className="text-[10px] font-mono text-rose-300/70 mt-1">Rule Breaches</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0f172a] border border-[#1e293b]">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">DOCKETS</div>
          <div className="text-2xl font-mono font-bold text-amber-400 mt-1">{stats?.invCount || 0}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Active Cases</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0f172a] border border-[#1e293b]">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">EVENTS</div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">{stats?.eventCount || 0}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Telemetry Logs</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#0f172a] border border-[#1e293b]">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">DATASETS</div>
          <div className="text-2xl font-mono font-bold text-purple-400 mt-1">{stats?.datasetCount || datasets.length}</div>
          <div className="text-[10px] font-mono text-slate-400 mt-1">Ingested Sources</div>
        </div>
      </div>

      {/* Suggested Quick Intelligence Queries */}
      <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b]">
        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-cyan-400" />
          <span>TACTICAL NATURAL-LANGUAGE PATTERN LEADS (CLICK TO EXECUTE)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {dynamicQuickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickPrompt(prompt)}
              className="text-left p-2.5 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-cyan-200 transition group flex items-start justify-between"
            >
              <span className="line-clamp-2 pr-2">{prompt}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      </div>


      {/* Main Grid: Anomalies & Active Investigations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High-Risk Anomalies */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
                PRIORITY ANOMALIES & THREAT INDICATORS
              </h2>
            </div>
            <button
              onClick={() => setActiveView('anomalies')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>VIEW ALL ({anomalies.length})</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {anomalies.slice(0, 4).map((anom) => (
              <div
                key={anom.id}
                className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] hover:border-cyan-500/40 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                        anom.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : anom.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}
                    >
                      {anom.severity}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-200">{anom.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    Confidence: {(anom.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <p className="text-xs font-mono text-slate-400 mt-2 leading-relaxed">
                  {anom.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">Target:</span>
                    <button
                      onClick={() => quickNavigateToEntity(anom.entityId)}
                      className="px-2 py-0.5 rounded bg-[#1e293b] text-cyan-300 text-xs font-mono hover:bg-cyan-950 hover:border-cyan-500/40 border border-transparent transition"
                    >
                      {anom.entityName}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      quickNavigateToEntity(anom.entityId, 'investigation');
                    }}
                    className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <span>INVESTIGATE IN WORKSPACE</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Active Investigations & Recent Telemetry */}
        <div className="space-y-6">
          {/* Active Cases */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
                  ACTIVE INVESTIGATIONS
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {investigations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-lg bg-[#0f172a] border border-[#1e293b] hover:border-amber-500/40 transition cursor-pointer"
                  onClick={() => {
                    setActiveView('investigation');
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30">
                      {inv.priority} PRIORITY
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{inv.id}</span>
                  </div>
                  <h3 className="text-xs font-mono font-bold text-slate-100">{inv.title}</h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-1 line-clamp-2">
                    {inv.description}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2.5 pt-2 border-t border-[#1e293b]">
                    <span>Lead: {inv.leadAnalyst}</span>
                    <span className="text-cyan-400">{inv.entityIds.length} Entities Linked</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Stream */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-mono font-bold text-slate-200 uppercase tracking-wider">
                  RECENT TELEMETRY FEED
                </h2>
              </div>
              <button
                onClick={() => setActiveView('map')}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300"
              >
                RADAR MAP
              </button>
            </div>

            <div className="space-y-2">
              {stats?.recentEvents?.slice(0, 4).map((ev: any) => (
                <div key={ev.id} className="p-2.5 rounded bg-[#0b1120] border border-[#1e293b] text-xs font-mono">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="text-emerald-400 font-semibold">{ev.event_type}</span>
                    <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-slate-200 text-[11px] font-medium">{ev.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
