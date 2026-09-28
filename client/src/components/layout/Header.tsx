import React, { useState } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { 
  Search, 
  RefreshCw, 
  Database,
  Layers,
  Sparkles
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    globalSearchQuery, 
    setGlobalSearchQuery, 
    setActiveView, 
    setActiveNlResult,
    sources,
    syncAllSources,
    loading 
  } = useInvestigation();

  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setIsSearching(true);
    try {
      const result = await api.executeNlQuery(searchInput);
      setActiveNlResult(result);
      setGlobalSearchQuery(searchInput);
      setActiveView('investigation');
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const connectedCount = sources.filter((s) => s.status === 'CONNECTED').length;

  return (
    <header className="h-14 bg-[#0b1120] border-b border-[#1e293b] flex items-center justify-between px-5 select-none z-30 shrink-0">
      {/* Brand & System */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-sm text-white tracking-tight">REVANA TECHNOLOGIES</span>
            <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
              Multi-Database Engine
            </span>
          </div>
        </div>
      </div>

      {/* Global Natural Language & Entity Search */}
      <div className="flex-1 max-w-xl mx-6">
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search entities or ask: 'What is connected to shipment S1001?'"
            className="w-full bg-[#090d16] border border-[#1e293b] rounded pl-9 pr-20 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
          />
          <button
            type="submit"
            disabled={isSearching || !searchInput.trim()}
            className="absolute right-1 top-1 bottom-1 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition disabled:opacity-40"
          >
            Investigate
          </button>
        </form>
      </div>

      {/* Status & Sync All */}
      <div className="flex items-center gap-3">
        {/* Connected Sources Status */}
        <div 
          onClick={() => setActiveView('sources')}
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0f172a] border border-[#1e293b] cursor-pointer hover:border-slate-600 transition"
          title="Click to view Data Sources"
        >
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-slate-300">
            {connectedCount}/4 Sources Connected
          </span>
        </div>

        {/* Sync All Sources Button */}
        <button
          onClick={syncAllSources}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition disabled:opacity-50"
          title="Extract & synchronize records from all 4 source databases"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync All Sources</span>
        </button>
      </div>
    </header>
  );
};
