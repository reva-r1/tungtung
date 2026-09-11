import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { EntityGraph } from '../graph/EntityGraph';
import {
  FileText,
  Building2,
  Users,
  Truck,
  Package,
  Warehouse,
  ArrowRight,
  Database,
  Activity,
  CheckCircle2,
  MapPin,
  Clock,
  Layers,
} from 'lucide-react';

export const EntityProfileView: React.FC = () => {
  const { selectedEntityId, selectEntity, setActiveView } = useInvestigation();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!selectedEntityId) return;
    setLoading(true);
    api.getEntityProfile(selectedEntityId)
      .then((data) => {
        setProfile(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedEntityId]);

  const entityIcon = (type: string) => {
    switch (type) {
      case 'COMPANY': return <Building2 className="w-5 h-5 text-amber-400" />;
      case 'PERSON': return <Users className="w-5 h-5 text-blue-400" />;
      case 'VEHICLE': return <Truck className="w-5 h-5 text-cyan-400" />;
      case 'SHIPMENT': return <Package className="w-5 h-5 text-purple-400" />;
      case 'WAREHOUSE': return <Warehouse className="w-5 h-5 text-emerald-400" />;
      default: return <Activity className="w-5 h-5 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-[#090d16]">
        <div className="flex items-center gap-3 text-blue-400 font-mono text-xs">
          <Activity className="w-5 h-5 animate-spin" />
          <span>Loading Canonical Entity Dossier...</span>
        </div>
      </div>
    );
  }

  if (!profile || !profile.entity) {
    return (
      <div className="flex-1 p-8 text-center font-mono text-slate-400">
        No entity profile selected. Select an entity from the Investigation or Graph views.
      </div>
    );
  }

  const ent = profile.entity;
  const provenance = profile.provenance;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#090d16] font-mono text-xs">
      {/* Header Banner */}
      <div className="p-5 rounded-lg bg-[#0b1120] border border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded bg-[#0f172a] border border-[#1e293b]">
            {entityIcon(ent.type)}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
                {ent.type}
              </span>
              <span className="text-[10px] text-slate-400">ID: {ent.id}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">{ent.name}</h1>
            <p className="text-slate-300 text-xs mt-1 max-w-3xl leading-relaxed">
              {ent.summary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('investigation')}
            className="px-3.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <span>Open in Investigation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Provenance & Contributing Source Databases */}
      <div className="p-5 rounded-lg bg-[#0b1120] border border-[#1e293b] space-y-4">
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold">
            <Database className="w-4 h-4" />
            <span>Data Provenance // Contributing Source Databases</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {provenance?.contributingSources?.length || 0} Independent Sources
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {provenance?.contributingSources?.map((srcId: string) => (
            <div key={srcId} className="p-3 bg-[#090d16] border border-slate-800 rounded">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Source Database</div>
              <div className="text-sm font-bold text-slate-200">{srcId}</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3" /> Record Verified
              </div>
            </div>
          ))}
        </div>

        {/* Underlying Raw Records */}
        {provenance?.records?.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
            <div className="text-[11px] text-slate-400 font-bold uppercase">
              Underlying Raw Source Records ({provenance.records.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
              {provenance.records.map((r: any, i: number) => (
                <div key={i} className="p-3 bg-[#090d16] border border-slate-800 rounded">
                  <div className="flex items-center justify-between text-blue-400 font-bold text-[11px] mb-1">
                    <span>{r.sourceDbName} &gt; {r.sourceTable}</span>
                    <span className="text-slate-500 text-[10px]">PK: {r.sourceRecordId}</span>
                  </div>
                  <pre className="text-slate-300 bg-black/40 p-2 rounded overflow-x-auto text-[10px]">
                    {JSON.stringify(r.rawData, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attributes & Graph Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Properties */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Structured Attributes
            </h3>
            <div className="space-y-2">
              {Object.entries(ent.properties || {}).map(([k, v]) => (
                <div key={k} className="flex items-start justify-between border-b border-[#1e293b] pb-1.5">
                  <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                  <span className="text-slate-200 font-semibold text-right max-w-[160px] truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tags & Aliases */}
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Aliases & Source Tags
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">KNOWN ALIASES</span>
                <div className="flex flex-wrap gap-1">
                  {ent.aliases?.map((alias: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-[#090d16] border border-[#1e293b] text-blue-300 text-[10px]">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">SYSTEM TAGS</span>
                <div className="flex flex-wrap gap-1">
                  {ent.tags?.map((tag: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center & Right Column: Subgraph & Connections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subgraph */}
          <div className="h-80">
            <EntityGraph graphData={profile.subgraph} isCompact={true} />
          </div>

          {/* Connected Relationships Ledger */}
          <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Connected Relationships ({profile.relationships?.length || 0})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profile.relationships?.map((rel: any) => {
                const isTarget = rel.source_id === ent.id;
                const otherName = isTarget ? rel.target_name : rel.source_name;
                const otherId = isTarget ? rel.target_id : rel.source_id;
                const otherType = isTarget ? rel.target_type : rel.source_type;

                return (
                  <div
                    key={rel.id}
                    onClick={() => selectEntity(otherId)}
                    className="p-2.5 rounded bg-[#090d16] hover:bg-[#131d35] border border-[#1e293b] flex items-center justify-between cursor-pointer transition"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-blue-400">{rel.type}</span>
                      <div className="text-slate-200 font-semibold text-xs mt-0.5">{otherName}</div>
                      <div className="text-[9px] text-slate-400">{otherId}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#1e293b] text-[10px] text-slate-300">
                      {otherType}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
