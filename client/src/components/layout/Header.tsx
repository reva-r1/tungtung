import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import {
  Search,
  RefreshCw,
  Bell,
  MapPin,
  Hexagon,
  User,
  Network,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    activeView,
    setActiveView,
    setGlobalSearchQuery,
    setActiveNlResult,
  } = useInvestigation();

  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('revana-global-search');
        input?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  return (
    <header className="h-12 bg-[#080D16] border-b border-[#243247] flex items-center justify-between px-4 select-none z-30 shrink-0">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setActiveView('investigation')}
          title="Revana Intelligence Platform"
        >
          <div className="w-6 h-6 rounded bg-[#131E30] border border-[#2B405F] flex items-center justify-center text-[#4C90F0] shadow-sm">
            <Hexagon className="w-3.5 h-3.5 fill-[#4C90F0]/20" />
          </div>
          <span className="font-bold text-xs text-[#E6EDF7] tracking-wider font-mono">
            REVANA
          </span>
        </div>
        <span className="text-[#243247]">/</span>
        <span className="text-xs text-[#6F91BA] font-medium hidden sm:inline">
          From Data to Intelligence
        </span>
      </div>

      {/* Global Search Field (Mockup Match: Ctrl + K) */}
      <div className="flex-1 max-w-lg mx-6">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 text-[#4C90F0] animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 text-[#6F91BA]" />
            )}
          </div>
          <input
            id="revana-global-search"
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search entities, people, companies, locations..."
            className="w-full bg-[#0E1624] border border-[#243247] rounded-md pl-9 pr-16 py-1.5 text-xs text-[#E6EDF7] placeholder-[#6F91BA] focus:outline-none focus:border-[#4C90F0] transition shadow-inner"
          />
          <div className="absolute right-2 flex items-center gap-1 pointer-events-none">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#6F91BA] bg-[#131E30] border border-[#243247] rounded">
              Ctrl + K
            </kbd>
          </div>
        </form>
      </div>

      {/* Right Controls: Geospatial Map Switcher & Neutral Profile */}
      <div className="flex items-center gap-3">
        {/* Geospatial Map / Knowledge Graph Quick Switcher */}
        <button
          onClick={() => setActiveView(activeView === 'map' ? 'investigation' : 'map')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition cursor-pointer ${
            activeView === 'map'
              ? 'bg-[#1A2B42] border-[#4C90F0] text-[#E6EDF7]'
              : 'bg-[#0E1624] border-[#243247] text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#131E30]'
          }`}
          title={activeView === 'map' ? 'Switch back to Knowledge Graph' : 'Switch to Geospatial Tactical Map'}
        >
          {activeView === 'map' ? (
            <>
              <Network className="w-3.5 h-3.5 text-[#4C90F0]" />
              <span className="font-mono text-[11px]">Knowledge Graph</span>
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5 text-[#6F91BA]" />
              <span className="font-mono text-[11px]">Geospatial Map</span>
            </>
          )}
        </button>

        {/* Notification Alerts */}
        <button
          className="relative p-1.5 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#131E30] rounded-md transition"
          title="System Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#4C90F0]" />
        </button>

        {/* Account Profile Icon */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#243247]">
          <button
            className="w-7 h-7 rounded-full bg-[#1A2B42] hover:bg-[#243754] border border-[#2B405F] flex items-center justify-center text-[#6F91BA] hover:text-[#E6EDF7] transition cursor-pointer"
            title="Account"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
