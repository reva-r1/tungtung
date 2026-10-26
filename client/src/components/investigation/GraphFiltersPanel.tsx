import React, { useState } from 'react';
import {
  Filter,
  Layers,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  MapPin,
  Car,
  Calendar,
  Clock,
  RotateCcw,
} from 'lucide-react';

interface GraphFiltersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeEntityTypes: string[];
  onToggleEntityType: (type: string) => void;
  activeRelationshipTypes: string[];
  onToggleRelationshipType: (type: string) => void;
  onSelectAllEntityTypes: () => void;
  onSelectAllRelationshipTypes: () => void;
  onClearFilters: () => void;
  timeRange: string;
  onChangeTimeRange: (range: string) => void;
}

export const GraphFiltersPanel: React.FC<GraphFiltersPanelProps> = ({
  isOpen,
  onClose,
  activeEntityTypes,
  onToggleEntityType,
  activeRelationshipTypes,
  onToggleRelationshipType,
  onSelectAllEntityTypes,
  onSelectAllRelationshipTypes,
  onClearFilters,
  timeRange,
  onChangeTimeRange,
}) => {
  const [activeTab, setActiveTab] = useState<'filters' | 'legend'>('filters');
  const [relSearch, setRelSearch] = useState('');
  const [isEntitySectionOpen, setIsEntitySectionOpen] = useState(true);
  const [isRelSectionOpen, setIsRelSectionOpen] = useState(true);
  const [isTimeSectionOpen, setIsTimeSectionOpen] = useState(true);

  if (!isOpen) return null;

  const entityTypeOptions = [
    { id: 'PERSON', label: 'People', icon: User, count: 12 },
    { id: 'ORGANIZATION', label: 'Organizations', icon: Building2, count: 6 },
    { id: 'LOCATION', label: 'Locations', icon: MapPin, count: 8 },
    { id: 'VEHICLE', label: 'Vehicles', icon: Car, count: 4 },
    { id: 'EVENT', label: 'Events', icon: Calendar, count: 3 },
  ];

  const relationshipOptions = [
    { id: 'works_at', label: 'works_at' },
    { id: 'visited', label: 'visited' },
    { id: 'used_for', label: 'used_for' },
    { id: 'colleague', label: 'colleague' },
    { id: 'involved_in', label: 'involved_in' },
    { id: 'headquarters', label: 'headquarters' },
    { id: 'associated_with', label: 'associated_with' },
    { id: 'lives_in', label: 'lives_in' },
    { id: 'traveled_to', label: 'traveled_to' },
    { id: 'reports_to', label: 'reports_to' },
    { id: 'leases', label: 'leases' },
    { id: 'occurred_at', label: 'occurred_at' },
  ];

  const filteredRelationships = relationshipOptions.filter((r) =>
    r.label.toLowerCase().includes(relSearch.toLowerCase())
  );

  return (
    <aside className="w-64 h-full bg-[#0E1624] border-l border-[#243247] flex flex-col shrink-0 select-none overflow-hidden z-20">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between border-b border-[#243247] px-3 bg-[#0E1624]">
        <div className="flex items-center text-xs font-medium">
          <button
            onClick={() => setActiveTab('filters')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'filters'
                ? 'border-[#4C90F0] text-[#E6EDF7]'
                : 'border-transparent text-[#95A4BA] hover:text-[#E6EDF7]'
            }`}
          >
            Filters
          </button>
          <button
            onClick={() => setActiveTab('legend')}
            className={`py-3 px-3 border-b-2 transition ${
              activeTab === 'legend'
                ? 'border-[#4C90F0] text-[#E6EDF7]'
                : 'border-transparent text-[#95A4BA] hover:text-[#E6EDF7]'
            }`}
          >
            Legend
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {activeTab === 'filters' && (
          <>
            {/* 1. Entity Types */}
            <div className="space-y-2">
              <div
                onClick={() => setIsEntitySectionOpen(!isEntitySectionOpen)}
                className="flex items-center justify-between text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider cursor-pointer hover:text-[#E6EDF7]"
              >
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Entity Types</span>
                </div>
                {isEntitySectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>

              {isEntitySectionOpen && (
                <div className="space-y-1.5 pt-1">
                  {entityTypeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isChecked = activeEntityTypes.includes(opt.id);

                    return (
                      <label
                        key={opt.id}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-[#131E30] cursor-pointer transition text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggleEntityType(opt.id)}
                            className="rounded border-[#243247] bg-[#131E30] text-[#4C90F0] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <Icon className="w-3.5 h-3.5 text-[#6F91BA]" />
                          <span className={isChecked ? 'text-[#E6EDF7] font-medium' : 'text-[#95A4BA]'}>
                            {opt.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#95A4BA]">{opt.count}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Relationships */}
            <div className="space-y-2 pt-2 border-t border-[#243247]/60">
              <div
                onClick={() => setIsRelSectionOpen(!isRelSectionOpen)}
                className="flex items-center justify-between text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider cursor-pointer hover:text-[#E6EDF7]"
              >
                <span>Relationships</span>
                {isRelSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>

              {isRelSectionOpen && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <Search className="w-3 h-3 text-[#95A4BA] absolute left-2 top-2" />
                    <input
                      type="text"
                      placeholder="Search relationships..."
                      value={relSearch}
                      onChange={(e) => setRelSearch(e.target.value)}
                      className="w-full bg-[#131E30] border border-[#243247] rounded pl-7 pr-2 py-1 text-[11px] text-[#E6EDF7] placeholder-[#95A4BA] focus:outline-none focus:border-[#4C90F0]"
                    />
                  </div>

                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {filteredRelationships.map((r) => {
                      const isChecked = activeRelationshipTypes.includes(r.id);

                      return (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 p-1 rounded hover:bg-[#131E30] cursor-pointer transition text-[11px]"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => onToggleRelationshipType(r.id)}
                            className="rounded border-[#243247] bg-[#131E30] text-[#4C90F0] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                          <span className={`font-mono ${isChecked ? 'text-[#E6EDF7]' : 'text-[#95A4BA]'}`}>
                            {r.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-[#6F91BA] pt-0.5 font-medium">
                    Show all ({relationshipOptions.length})
                  </div>
                </div>
              )}
            </div>

            {/* 3. Time Range */}
            <div className="space-y-2 pt-2 border-t border-[#243247]/60">
              <div
                onClick={() => setIsTimeSectionOpen(!isTimeSectionOpen)}
                className="flex items-center justify-between text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider cursor-pointer hover:text-[#E6EDF7]"
              >
                <span>Time Range</span>
                {isTimeSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>

              {isTimeSectionOpen && (
                <div className="pt-1">
                  <select
                    value={timeRange}
                    onChange={(e) => onChangeTimeRange(e.target.value)}
                    className="w-full bg-[#131E30] border border-[#243247] rounded px-2.5 py-1.5 text-xs text-[#E6EDF7] focus:outline-none focus:border-[#4C90F0]"
                  >
                    <option value="ALL">All time</option>
                    <option value="TODAY">Today (Last 24 Hours)</option>
                    <option value="WEEK">Last 7 Days</option>
                    <option value="MONTH">Last 30 Days</option>
                    <option value="NIGHT_SHIFT">Night Shifts (20:00 - 06:00 IST)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Clear All Filters Button */}
            <div className="pt-2">
              <button
                onClick={onClearFilters}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#131E30] hover:bg-[#1A2B42] text-[11px] font-medium text-[#95A4BA] hover:text-[#E6EDF7] border border-[#243247] transition"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </button>
            </div>
          </>
        )}

        {/* Legend Tab */}
        {activeTab === 'legend' && (
          <div className="space-y-3.5 text-xs">
            <div>
              <div className="text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider mb-2">
                Entity Shapes
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <User className="w-3.5 h-3.5 text-[#4C90F0]" />
                  <span className="text-[#E6EDF7]">Person (Individual)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <Building2 className="w-3.5 h-3.5 text-[#4C90F0]" />
                  <span className="text-[#E6EDF7]">Organization (Corporate)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <MapPin className="w-3.5 h-3.5 text-[#4C90F0]" />
                  <span className="text-[#E6EDF7]">Location (Depot, City)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <Car className="w-3.5 h-3.5 text-[#4C90F0]" />
                  <span className="text-[#E6EDF7]">Vehicle (Asset)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <Calendar className="w-3.5 h-3.5 text-[#4C90F0]" />
                  <span className="text-[#E6EDF7]">Event (Movement / Shift)</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#243247]/60">
              <div className="text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider mb-2">
                Evidence Semantics
              </div>
              <div className="space-y-1.5 text-[10.5px]">
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3DB46D]" />
                  <span className="text-[#E6EDF7]">Verified Direct Observation</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F5A524]" />
                  <span className="text-[#E6EDF7]">Inferred Link (Requires Check)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-[#131E30] rounded border border-[#243247]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E5484D]" />
                  <span className="text-[#E6EDF7]">Conflicting Document Citation</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
