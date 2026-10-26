import React, { useState } from 'react';
import {
  User,
  Building2,
  MapPin,
  Car,
  Calendar,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  FileSpreadsheet,
  Link2,
  ArrowRight,
} from 'lucide-react';
import {
  IntelligenceEntity,
  IntelligenceEdge,
  CandidateConnection,
  EvidenceRecord,
} from '../../data/intelligenceDataset';
import { useInvestigation } from '../../context/InvestigationContext';

interface EntityInspectorProps {
  selectedEntity: IntelligenceEntity | null;
  selectedEdge: IntelligenceEdge | null;
  entities: Record<string, IntelligenceEntity>;
  evidenceCatalog: Record<string, EvidenceRecord>;
  visibleEntityIds: string[];
  onClose: () => void;
  onAddConnectionToGraph: (candidate: CandidateConnection, anchorEntityId: string) => void;
  onSelectEntity: (entityId: string) => void;
  initialTab?: 'overview' | 'connections' | 'evidence';
}

export const EntityInspector: React.FC<EntityInspectorProps> = ({
  selectedEntity,
  selectedEdge,
  entities,
  evidenceCatalog,
  visibleEntityIds,
  onClose,
  onAddConnectionToGraph,
  onSelectEntity,
  initialTab = 'overview',
}) => {
  const { setActiveView, selectEntity } = useInvestigation();
  const [activeTab, setActiveTab] = useState<'overview' | 'connections' | 'evidence'>(initialTab);
  const [connectionSearchQuery, setConnectionSearchQuery] = useState('');
  const [selectedConnectionCategory, setSelectedConnectionCategory] = useState<string>('ALL');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Reset tab when switching entities
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [selectedEntity?.id, initialTab]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Helper for entity icons
  const getEntityIcon = (type: string, className = 'w-4 h-4') => {
    switch (type) {
      case 'PERSON':
        return <User className={className} />;
      case 'ORGANIZATION':
        return <Building2 className={className} />;
      case 'LOCATION':
        return <MapPin className={className} />;
      case 'VEHICLE':
        return <Car className={className} />;
      case 'EVENT':
        return <Calendar className={className} />;
      case 'DOCUMENT':
        return <FileText className={className} />;
      default:
        return <Link2 className={className} />;
    }
  };

  // If an Edge is selected instead of a node
  if (selectedEdge && !selectedEntity) {
    const sourceNode = entities[selectedEdge.source];
    const targetNode = entities[selectedEdge.target];
    const evidence = selectedEdge.evidenceId ? evidenceCatalog[selectedEdge.evidenceId] : null;

    return (
      <aside className="w-80 h-full bg-[#0E1624] border-r border-[#243247] flex flex-col shrink-0 select-none overflow-hidden z-20">
        {/* Edge Header */}
        <div className="p-4 border-b border-[#243247] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#6F91BA]" />
            <span className="font-semibold text-xs text-[#E6EDF7]">Relationship Inspector</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Edge Label & Confidence */}
          <div className="p-3 bg-[#131E30] rounded-md border border-[#243247] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono text-[#6F91BA] tracking-wider">Predicate</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  selectedEdge.status === 'VERIFIED' || (selectedEdge.status as string) === 'DIRECTLY_SUPPORTED'
                    ? 'bg-[#3DB46D]/15 text-[#3DB46D] border border-[#3DB46D]/30'
                    : selectedEdge.status === 'INFERRED'
                    ? 'bg-[#F5A524]/15 text-[#F5A524] border border-[#F5A524]/30'
                    : 'bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30'
                }`}
              >
                {(selectedEdge.status as string) === 'DIRECTLY_SUPPORTED' ? 'DIRECTLY SUPPORTED' : selectedEdge.status}
              </span>
            </div>
            <div className="font-mono text-sm font-semibold text-[#E6EDF7]">{selectedEdge.relationshipType}</div>
            <div className="text-[11px] text-[#95A4BA]">Confidence: {Math.round(selectedEdge.confidence * 100)}%</div>
          </div>

          {/* Connected Entities */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-semibold text-[#6F91BA] tracking-wider">Connected Entities</span>
            <div className="space-y-1.5">
              <button
                onClick={() => sourceNode && onSelectEntity(sourceNode.id)}
                className="w-full flex items-center justify-between p-2 rounded bg-[#131E30] hover:bg-[#1A2B42] border border-[#243247] text-left transition"
              >
                <div className="flex items-center gap-2">
                  {sourceNode && getEntityIcon(sourceNode.type, 'w-3.5 h-3.5 text-[#6F91BA]')}
                  <span className="text-xs text-[#E6EDF7] font-medium">{sourceNode?.name || selectedEdge.source}</span>
                </div>
                <span className="text-[10px] text-[#95A4BA] font-mono">Source</span>
              </button>

              <div className="flex justify-center text-[#6F91BA]">
                <ArrowRight className="w-3.5 h-3.5 rotate-90" />
              </div>

              <button
                onClick={() => targetNode && onSelectEntity(targetNode.id)}
                className="w-full flex items-center justify-between p-2 rounded bg-[#131E30] hover:bg-[#1A2B42] border border-[#243247] text-left transition"
              >
                <div className="flex items-center gap-2">
                  {targetNode && getEntityIcon(targetNode.type, 'w-3.5 h-3.5 text-[#6F91BA]')}
                  <span className="text-xs text-[#E6EDF7] font-medium">{targetNode?.name || selectedEdge.target}</span>
                </div>
                <span className="text-[10px] text-[#95A4BA] font-mono">Target</span>
              </button>
            </div>
          </div>

          {/* Epistemic note if available */}
          {selectedEdge.epistemicNote && (
            <div className="p-3 rounded bg-[#131E30] border border-[#F5A524]/30 space-y-1">
              <div className="flex items-center gap-1.5 text-[#F5A524] text-[11px] font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Epistemic Caution
              </div>
              <p className="text-[11px] text-[#E6EDF7] leading-relaxed">{selectedEdge.epistemicNote}</p>
            </div>
          )}

          {/* Source Evidence Record */}
          {evidence && (
            <div className="p-3 bg-[#131E30] rounded-md border border-[#243247] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold text-[#6F91BA]">Supporting Provenance</span>
                <span className="text-[10px] text-[#95A4BA] font-mono">{evidence.sourceDoc}</span>
              </div>
              <div className="p-2 bg-[#080D16] rounded border border-[#243247] font-mono text-[10.5px] text-[#95A4BA] leading-relaxed">
                "{evidence.excerpt}"
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#6F91BA]">
                <span>Locator: {evidence.sourceLocator}</span>
                {evidence.timestamp && <span>{evidence.timestamp}</span>}
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // If NO entity is selected
  if (!selectedEntity) {
    return (
      <aside className="w-80 h-full bg-[#0E1624] border-r border-[#243247] flex flex-col shrink-0 select-none overflow-hidden z-20">
        <div className="p-4 border-b border-[#243247] flex items-center justify-between">
          <span className="font-semibold text-xs text-[#E6EDF7]">Entity Inspector</span>
          <button onClick={onClose} className="p-1 text-[#95A4BA] hover:text-[#E6EDF7] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-[#95A4BA] space-y-2">
          <User className="w-8 h-8 text-[#243247]" />
          <p className="font-medium text-[#E6EDF7]">No Entity Selected</p>
          <p className="text-[11px] leading-relaxed">
            Click on any node on the graph canvas or select an inquiry suggestion to inspect its canonical dossier, evidence, and connections.
          </p>
        </div>
      </aside>
    );
  }

  // Group candidate connections by entity type for the Overview accordion
  const groupedConnections: Record<string, CandidateConnection[]> = {
    ORGANIZATION: [],
    LOCATION: [],
    VEHICLE: [],
    PERSON: [],
    EVENT: [],
  };

  selectedEntity.candidateConnections.forEach((conn) => {
    if (groupedConnections[conn.entityType]) {
      groupedConnections[conn.entityType].push(conn);
    } else {
      groupedConnections[conn.entityType] = [conn];
    }
  });

  const getGroupLabel = (type: string) => {
    switch (type) {
      case 'ORGANIZATION':
        return 'Organizations';
      case 'LOCATION':
        return 'Locations';
      case 'VEHICLE':
        return 'Vehicles';
      case 'PERSON':
        return 'People';
      case 'EVENT':
        return 'Events';
      default:
        return 'Connected Items';
    }
  };

  return (
    <aside className="w-80 h-full bg-[#0E1624] border-r border-[#243247] flex flex-col shrink-0 select-none overflow-hidden z-20">
      {/* 1. Header Profile Banner */}
      <div className="p-4 border-b border-[#243247] relative bg-[#0E1624]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-[#131E30] border border-[#243247] flex items-center justify-center text-[#6F91BA] shrink-0">
            {getEntityIcon(selectedEntity.type, 'w-5 h-5')}
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h2 className="text-sm font-semibold text-[#E6EDF7] truncate">{selectedEntity.name}</h2>
            <div className="text-[11px] text-[#95A4BA] flex items-center gap-1.5 mt-0.5">
              <span>{selectedEntity.type.charAt(0) + selectedEntity.type.slice(1).toLowerCase()}</span>
              <span>•</span>
              <span className="font-mono text-[10px] text-[#6F91BA]">{selectedEntity.identifier}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Connections & Map */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {selectedEntity.hiddenCount > 0 && (
            <button
              onClick={() => setActiveTab('connections')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1A2B42] hover:bg-[#243754] border border-[#2B405F] text-[11px] font-medium text-[#8EAFD9] transition"
            >
              <span>+{selectedEntity.hiddenCount} connections</span>
            </button>
          )}

          {(selectedEntity.properties?.latitude != null || selectedEntity.type === 'LOCATION' || selectedEntity.id.startsWith('LOC-')) && (
            <button
              onClick={() => {
                selectEntity(selectedEntity.id);
                setActiveView('map');
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0d2820] hover:bg-[#133b2f] border border-[#10b981]/50 text-[11px] font-medium text-[#34d399] transition cursor-pointer"
              title="Locate coordinates on Geospatial Radar Map"
            >
              <MapPin className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Locate on Map</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Tabs Navigation */}
      <div className="flex items-center border-b border-[#243247] bg-[#0E1624] px-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 px-3 border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-[#4C90F0] text-[#E6EDF7]'
              : 'border-transparent text-[#95A4BA] hover:text-[#E6EDF7]'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('connections')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'connections'
              ? 'border-[#4C90F0] text-[#E6EDF7]'
              : 'border-transparent text-[#95A4BA] hover:text-[#E6EDF7]'
          }`}
        >
          <span>Connections</span>
          <span className="text-[10px] px-1 rounded bg-[#131E30] text-[#6F91BA]">
            {selectedEntity.candidateConnections.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'evidence'
              ? 'border-[#4C90F0] text-[#E6EDF7]'
              : 'border-transparent text-[#95A4BA] hover:text-[#E6EDF7]'
          }`}
        >
          <span>Evidence</span>
          <span className="text-[10px] px-1 rounded bg-[#131E30] text-[#6F91BA]">
            {selectedEntity.evidenceIds.length}
          </span>
        </button>
      </div>

      {/* 3. Tab Body Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* ===================== TAB: OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Basic Information Section */}
            <div>
              <div className="text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider mb-2">
                Basic Information
              </div>
              <div className="bg-[#131E30] border border-[#243247] rounded-md divide-y divide-[#243247]/60">
                {Object.entries(selectedEntity.properties).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                    <span className="text-[#95A4BA]">{key}</span>
                    <span className="text-[#E6EDF7] font-medium text-right">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Geospatial Card if Location Available */}
            {(selectedEntity.properties?.latitude != null || selectedEntity.type === 'LOCATION' || selectedEntity.id.startsWith('LOC-')) && (
              <div className="p-2.5 rounded bg-[#0b1726] border border-[#1d3557] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[#38bdf8] text-[11px] font-medium">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Geographic Position</span>
                  </div>
                  <div className="text-[10px] text-[#95A4BA] mt-0.5 font-mono">
                    {selectedEntity.properties?.latitude != null
                      ? `${selectedEntity.properties.latitude}, ${selectedEntity.properties.longitude}`
                      : 'Geographic facility registered in repository.'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    selectEntity(selectedEntity.id);
                    setActiveView('map');
                  }}
                  className="px-2 py-1 bg-[#0d2820] hover:bg-[#133b2f] border border-[#10b981]/50 text-[#34d399] rounded text-[10.5px] font-medium transition cursor-pointer"
                >
                  View on Map
                </button>
              </div>
            )}

            {/* Epistemic Note / Caution if present */}
            {selectedEntity.uncertaintyNote && (
              <div className="p-2.5 rounded bg-[#1A2616]/40 border border-[#F5A524]/40 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F5A524] shrink-0 mt-0.5" />
                <div className="text-[10.5px] text-[#E6EDF7] leading-relaxed">
                  <span className="font-semibold text-[#F5A524]">Forensic Notice: </span>
                  {selectedEntity.uncertaintyNote}
                </div>
              </div>
            )}

            {/* Connected Entities Grouped Accordions */}
            <div>
              <div className="text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Connected Entities ({selectedEntity.candidateConnections.length})</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>

              <div className="space-y-2">
                {Object.entries(groupedConnections).map(([type, list]) => {
                  if (list.length === 0) return null;
                  const isCollapsed = collapsedGroups[type];

                  return (
                    <div
                      key={type}
                      className="bg-[#131E30] border border-[#243247] rounded-md overflow-hidden text-xs"
                    >
                      <div
                        onClick={() => toggleGroup(type)}
                        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[#1A2B42] transition"
                      >
                        <div className="flex items-center gap-2">
                          {getEntityIcon(type, 'w-3.5 h-3.5 text-[#6F91BA]')}
                          <span className="font-medium text-[#E6EDF7]">
                            {getGroupLabel(type)} <span className="text-[#95A4BA]">({list.length})</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isCollapsed ? (
                            <ChevronDown className="w-3.5 h-3.5 text-[#95A4BA]" />
                          ) : (
                            <ChevronUp className="w-3.5 h-3.5 text-[#95A4BA]" />
                          )}
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="border-t border-[#243247] divide-y divide-[#243247]/50 bg-[#0E1624]/60">
                          {list.map((item) => {
                            const isAlreadyInGraph = visibleEntityIds.includes(item.entityId);

                            return (
                              <div
                                key={item.entityId}
                                className="px-3 py-1.5 flex items-center justify-between hover:bg-[#131E30] transition text-[11px]"
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <span className="text-[#95A4BA]">•</span>
                                  <span className="text-[#E6EDF7] font-medium truncate">{item.entityName}</span>
                                  <span className="text-[10px] text-[#6F91BA] font-mono">({item.relationshipLabel})</span>
                                </div>

                                {isAlreadyInGraph ? (
                                  <span className="text-[10px] text-[#3DB46D] flex items-center gap-0.5 shrink-0">
                                    <Check className="w-3 h-3" />
                                    In graph
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => onAddConnectionToGraph(item, selectedEntity.id)}
                                    className="text-[10px] text-[#6F91BA] hover:text-[#E6EDF7] hover:underline flex items-center gap-0.5 shrink-0"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Add
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Button: View All Connections */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTab('connections')}
                className="w-full py-2 px-3 rounded bg-[#1A2B42] hover:bg-[#243754] border border-[#2B405F] text-xs font-medium text-[#E6EDF7] transition text-center"
              >
                View All Connections
              </button>
            </div>
          </div>
        )}

        {/* ===================== TAB: CONNECTIONS ===================== */}
        {activeTab === 'connections' && (
          <div className="space-y-3">
            {/* Search within connections */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#95A4BA] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search candidate connections..."
                value={connectionSearchQuery}
                onChange={(e) => setConnectionSearchQuery(e.target.value)}
                className="w-full bg-[#131E30] border border-[#243247] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#E6EDF7] placeholder-[#95A4BA] focus:outline-none focus:border-[#4C90F0]"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-1 text-[10px]">
              {['ALL', 'ORGANIZATION', 'LOCATION', 'VEHICLE', 'PERSON'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedConnectionCategory(cat)}
                  className={`px-2 py-0.5 rounded transition ${
                    selectedConnectionCategory === cat
                      ? 'bg-[#4C90F0] text-white font-medium'
                      : 'bg-[#131E30] text-[#95A4BA] hover:text-[#E6EDF7] border border-[#243247]'
                  }`}
                >
                  {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Connection Items List */}
            <div className="space-y-2 pt-1">
              {selectedEntity.candidateConnections
                .filter((conn) => {
                  if (selectedConnectionCategory !== 'ALL' && conn.entityType !== selectedConnectionCategory) {
                    return false;
                  }
                  if (connectionSearchQuery.trim()) {
                    const q = connectionSearchQuery.toLowerCase();
                    return (
                      conn.entityName.toLowerCase().includes(q) ||
                      conn.relationshipLabel.toLowerCase().includes(q) ||
                      conn.detail.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((conn) => {
                  const isAlreadyInGraph = visibleEntityIds.includes(conn.entityId);

                  return (
                    <div
                      key={conn.entityId}
                      className="p-3 bg-[#131E30] border border-[#243247] rounded-md space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[#1A2B42] flex items-center justify-center text-[#6F91BA] shrink-0">
                            {getEntityIcon(conn.entityType, 'w-3.5 h-3.5')}
                          </div>
                          <div>
                            <span className="font-semibold text-[#E6EDF7] block text-xs">{conn.entityName}</span>
                            <span className="text-[10px] text-[#95A4BA]">{conn.entityType}</span>
                          </div>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono ${
                            conn.status === 'VERIFIED'
                              ? 'bg-[#3DB46D]/15 text-[#3DB46D] border border-[#3DB46D]/30'
                              : conn.status === 'INFERRED'
                              ? 'bg-[#F5A524]/15 text-[#F5A524] border border-[#F5A524]/30'
                              : 'bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30'
                          }`}
                        >
                          {conn.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#95A4BA] leading-relaxed">
                        <span className="text-[#6F91BA] font-mono">[{conn.relationshipLabel}]</span> {conn.detail}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#243247]/60 text-[10px]">
                        <span className="text-[#6F91BA] font-mono">{conn.sourceDoc}</span>

                        {isAlreadyInGraph ? (
                          <span className="text-[#3DB46D] flex items-center gap-1 font-medium">
                            <Check className="w-3 h-3" />
                            Already in graph
                          </span>
                        ) : (
                          <button
                            onClick={() => onAddConnectionToGraph(conn, selectedEntity.id)}
                            className="px-2 py-0.5 rounded bg-[#1A2B42] hover:bg-[#243754] text-[#E6EDF7] border border-[#2B405F] flex items-center gap-1 transition"
                          >
                            <Plus className="w-3 h-3 text-[#6F91BA]" />
                            Add to graph
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ===================== TAB: EVIDENCE ===================== */}
        {activeTab === 'evidence' && (
          <div className="space-y-3">
            <div className="text-[10px] font-semibold text-[#6F91BA] uppercase tracking-wider">
              Recorded Source Excerpts ({selectedEntity.evidenceIds.length})
            </div>

            {selectedEntity.evidenceIds.map((evId) => {
              const ev = evidenceCatalog[evId];
              if (!ev) return null;

              return (
                <div
                  key={ev.id}
                  className="p-3 bg-[#131E30] border border-[#243247] rounded-md space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10.5px] text-[#6F91BA] font-semibold">{ev.sourceDoc}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono ${
                        ev.status === 'VERIFIED'
                          ? 'bg-[#3DB46D]/15 text-[#3DB46D] border border-[#3DB46D]/30'
                          : ev.status === 'INFERRED'
                          ? 'bg-[#F5A524]/15 text-[#F5A524] border border-[#F5A524]/30'
                          : 'bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>

                  <div className="p-2 bg-[#080D16] rounded border border-[#243247] text-[11px] text-[#E6EDF7] font-mono leading-relaxed">
                    "{ev.excerpt}"
                  </div>

                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex items-center justify-between text-[#95A4BA]">
                      <span>Locator: {ev.sourceLocator}</span>
                      {ev.timestamp && <span>{ev.timestamp}</span>}
                    </div>

                    {ev.epistemicNote && (
                      <div className="text-[10px] text-[#F5A524] pt-1 border-t border-[#243247]/50 leading-relaxed">
                        Note: {ev.epistemicNote}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
