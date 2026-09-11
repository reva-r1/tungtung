import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Entity, EntityType } from '../../types';
import { useInvestigation } from '../../context/InvestigationContext';
import {
  Table,
  Search,
  Download,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Building2,
  Users,
  Truck,
  Package,
  Warehouse,
  Activity,
  ArrowRight
} from 'lucide-react';

export const DataExplorerView: React.FC = () => {
  const { quickNavigateToEntity, selectEntity } = useInvestigation();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('risk_score');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    api.searchEntities({ limit: 200 })
      .then(setEntities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportCsv = () => {
    if (entities.length === 0) return;
    const headers = ['ID', 'Name', 'Type', 'Risk Score', 'Summary', 'Properties'];
    const rows = filteredEntities.map((e) => [
      `"${e.id}"`,
      `"${e.name}"`,
      `"${e.type}"`,
      e.risk_score || e.riskScore || 0,
      `"${(e.summary || '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(e.properties).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `aegis_intel_entities_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEntities = entities
    .filter((e) => {
      const typeMatch = selectedType === 'ALL' || e.type === selectedType;
      const searchMatch =
        !searchQuery ||
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.summary && e.summary.toLowerCase().includes(searchQuery.toLowerCase()));
      return typeMatch && searchMatch;
    })
    .sort((a: any, b: any) => {
      let aVal = a[sortField] !== undefined ? a[sortField] : a.properties?.[sortField];
      let bVal = b[sortField] !== undefined ? b[sortField] : b.properties?.[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortAsc ? -1 : 1;
      if (aVal > bVal) return sortAsc ? 1 : -1;
      return 0;
    });

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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] font-mono text-xs overflow-hidden">
      {/* Top Header & Filter Controls */}
      <div className="p-4 bg-[#0b1120] border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Table className="w-4 h-4 text-cyan-400" />
            <span className="uppercase tracking-wider">DATA EXPLORER & STRUCTURED LEDGER</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all fields..."
              className="bg-[#090d16] border border-[#1e293b] rounded pl-8 pr-3 py-1 text-slate-200 focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
            />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-[#090d16] border border-[#1e293b] rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Entity Types</option>
            <option value="COMPANY">Companies</option>
            <option value="PERSON">Persons</option>
            <option value="VEHICLE">Vehicles</option>
            <option value="SHIPMENT">Shipments</option>
            <option value="WAREHOUSE">Warehouses</option>
            <option value="ROUTE">Routes</option>
            <option value="TRANSACTION">Transactions</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-[11px]">
            Showing <strong className="text-cyan-400">{filteredEntities.length}</strong> records
          </span>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-200 transition flex items-center gap-1.5 font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Tabular Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border border-[#1e293b] bg-[#0f172a] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b1120] border-b border-[#1e293b] text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <th
                  onClick={() => {
                    setSortField('id');
                    setSortAsc(!sortAsc);
                  }}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('name');
                    setSortAsc(!sortAsc);
                  }}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>NAME / IDENTIFIER</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('type');
                    setSortAsc(!sortAsc);
                  }}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>TYPE</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortField('risk_score');
                    setSortAsc(!sortAsc);
                  }}
                  className="p-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1">
                    <span>RISK SCORE</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3">KEY PROPERTIES</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b] text-slate-300">
              {filteredEntities.map((ent) => {
                const risk = ent.risk_score !== undefined ? ent.risk_score : ent.riskScore || 0;
                return (
                  <tr
                    key={ent.id}
                    onClick={() => selectEntity(ent.id)}
                    className="hover:bg-[#131d35] cursor-pointer transition"
                  >
                    <td className="p-3 font-semibold text-cyan-300 whitespace-nowrap">{ent.id}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {entityIcon(ent.type)}
                        <span className="font-bold text-white text-xs">{ent.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1e293b] text-slate-300 border border-[#334155]">
                        {ent.type}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          risk > 70
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : risk > 30
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {risk}/100
                      </span>
                    </td>
                    <td className="p-3 max-w-xs truncate text-[11px] text-slate-400">
                      {Object.entries(ent.properties || {})
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' • ')}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          quickNavigateToEntity(ent.id, 'investigation');
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold transition inline-flex items-center gap-1"
                      >
                        <span>INVESTIGATE</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
