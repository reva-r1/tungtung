import React, { useState, useEffect } from 'react';
import { useInvestigation, ActiveView } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { Dataset, Investigation } from '../../types';
import {
  Home,
  Shield,
  Database,
  FileText,
  Network,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  MapPin,
  Layers,
  GitMerge,
  FolderOpen,
} from 'lucide-react';

interface NavItem {
  id: ActiveView | 'home' | 'documents' | 'history' | 'settings';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  viewMapping?: ActiveView;
}

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView } = useInvestigation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: Home, viewMapping: 'overview' },
    { id: 'investigation', label: 'Investigations', icon: Shield, viewMapping: 'investigation' },
    { id: 'graph', label: 'Knowledge Graph', icon: Network, viewMapping: 'graph' },
    { id: 'map', label: 'Geospatial Map', icon: MapPin, viewMapping: 'map' },
    { id: 'sources', label: 'Data Sources', icon: Database, viewMapping: 'sources' },
    { id: 'ingestion', label: 'Datasets', icon: Layers, viewMapping: 'ingestion' },
    { id: 'resolution', label: 'Entity Resolution', icon: GitMerge, viewMapping: 'resolution' },
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.viewMapping) {
      setActiveView(item.viewMapping);
    }
  };

  return (
    <aside
      className={`bg-[#080D16] border-r border-[#243247] flex flex-col justify-between select-none shrink-0 transition-all duration-150 py-3 ${
        collapsed ? 'w-14' : 'w-48'
      }`}
    >
      <div className="space-y-4">
        {/* Navigation Rail Links */}
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              (item.id === 'investigation' && activeView === 'investigation') ||
              (item.id === 'graph' && activeView === 'graph') ||
              (item.id === 'map' && activeView === 'map') ||
              (item.id === 'sources' && activeView === 'sources') ||
              (item.id === 'ingestion' && activeView === 'ingestion') ||
              (item.id === 'resolution' && activeView === 'resolution') ||
              (item.id === 'home' && activeView === 'overview');

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition text-left relative ${
                  isActive
                    ? 'bg-[#1A2B42] text-[#E6EDF7]'
                    : 'text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#0E1624]'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#4C90F0] rounded-r" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#4C90F0]' : 'text-[#6F91BA]'
                  }`}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Collapse Rail */}
      {!collapsed ? (
        <div className="px-3 pt-3 border-t border-[#243247]/80 text-xs">
          <button
            onClick={() => setCollapsed(true)}
            className="w-full flex items-center justify-between p-1.5 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#0E1624] rounded text-[11px] transition"
          >
            <span>Collapse rail</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="px-2 pt-2 border-t border-[#243247]">
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center p-2 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#0E1624] rounded text-xs transition"
            title="Expand rail"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
};
