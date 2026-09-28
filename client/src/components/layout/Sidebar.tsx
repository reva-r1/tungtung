import React from 'react';
import { useInvestigation, ActiveView } from '../../context/InvestigationContext';
import {
  LayoutDashboard,
  Globe,
  Database,
  Users,
  Search,
  Network,
  MapPin,
  Clock,
  GitMerge,
  Layers,
} from 'lucide-react';

interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView } = useInvestigation();

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'mirror',
      label: 'Digital Mirror',
      icon: Globe,
    },
    {
      id: 'sources',
      label: 'Data Sources',
      icon: Database,
    },
    {
      id: 'ingestion',
      label: 'Datasets',
      icon: Layers,
    },
    {
      id: 'entities',
      label: 'Entities',
      icon: Users,
    },
    {
      id: 'investigation',
      label: 'Investigation',
      icon: Search,
    },
    {
      id: 'graph',
      label: 'Graph',
      icon: Network,
    },
    {
      id: 'map',
      label: 'Map',
      icon: MapPin,
    },
    {
      id: 'resolution',
      label: 'Entity Resolution',
      icon: GitMerge,
    },
  ];

  return (
    <aside className="w-56 bg-[#090d16] border-r border-[#1e293b] flex flex-col justify-between select-none shrink-0 py-4">
      <div>
        <div className="px-4 mb-3">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Navigation
          </span>
        </div>

        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition text-left ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a] border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System info */}
      <div className="px-4 py-3 mx-2 rounded bg-[#0b1120] border border-[#1e293b] text-[11px] text-slate-400">
        <div className="font-semibold text-slate-300 mb-1">Intelligence Platform</div>
        <div className="text-[10px] text-slate-500">Cross-Dataset Entity Engine</div>
      </div>
    </aside>
  );
};
