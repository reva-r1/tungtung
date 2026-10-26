import React, { useState, useCallback, useEffect } from 'react';
import {
  IntelligenceEntity,
  IntelligenceEdge,
  CandidateConnection,
  EvidenceRecord,
} from '../../data/intelligenceDataset';
import { fetchRealInvestigationGraph } from '../../services/graphAdapter';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { CanvasGraph } from './CanvasGraph';
import { EntityInspector } from './EntityInspector';
import { GraphFiltersPanel } from './GraphFiltersPanel';
import { InvestigationChatDrawer } from './InvestigationChatDrawer';
import { Filter, Sliders, Eye, RefreshCw, Plus, CheckCircle2, MapPin, Database } from 'lucide-react';

export const GraphInvestigationDashboard: React.FC = () => {
  const { selectedEntityId: contextEntityId, selectEntity, setActiveView, inquiryTarget } = useInvestigation();

  // Master intelligence data from SQLite / Ingestion Pipeline
  const [entities, setEntities] = useState<Record<string, IntelligenceEntity>>({});
  const [edges, setEdges] = useState<IntelligenceEdge[]>([]);
  const [evidenceCatalog, setEvidenceCatalog] = useState<Record<string, EvidenceRecord>>({});
  const [visibleEntityIds, setVisibleEntityIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selections
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Inspector Tab target
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'connections' | 'evidence'>('overview');

  // Panel visibility toggles (Chat collapsed by default as approved)
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Global search & filters within the graph
  const [searchFilterQuery, setSearchFilterQuery] = useState('');
  const [activeEntityTypes, setActiveEntityTypes] = useState<string[]>([
    'PERSON',
    'ORGANIZATION',
    'LOCATION',
    'VEHICLE',
    'EVENT',
    'DOCUMENT',
  ]);
  const [activeRelationshipTypes, setActiveRelationshipTypes] = useState<string[]>([
    'works_at',
    'visited',
    'used_for',
    'colleague',
    'involved_in',
    'headquarters',
    'associated_with',
    'lives_in',
    'traveled_to',
    'reports_to',
    'leases',
    'occurred_at',
    'REFERENCES',
    'facility_access',
  ]);
  const [timeRange, setTimeRange] = useState<string>('ALL');

  // Notification / Toast
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(null);
    }, 2500);
  };

  // Load real records on mount from database
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchRealInvestigationGraph()
      .then((payload) => {
        if (!isMounted) return;
        setEntities(payload.entities);
        setEdges(payload.edges);
        setEvidenceCatalog(payload.evidenceCatalog);

        // Dynamically add all edge relationship types so no edges are ever hidden
        const edgeRelTypes = Array.from(new Set(payload.edges.map((e) => e.relationshipType)));
        setActiveRelationshipTypes((prev) => Array.from(new Set([...prev, ...edgeRelTypes])));

        const initialTarget = contextEntityId && payload.entities[contextEntityId]
          ? contextEntityId
          : '';

        const initialVisible = initialTarget ? [initialTarget] : [];
        setVisibleEntityIds(initialVisible);
        setSelectedNodeId(initialTarget || null);
        if (initialTarget) {
          selectEntity(initialTarget);
        }
      })
      .catch((err) => {
        console.error('Failed to load grounded graph data:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync inquiry target (triggered from chat inquiry, search bar or direct inquiry)
  useEffect(() => {
    if (inquiryTarget && inquiryTarget.entityIds.length > 0) {
      setVisibleEntityIds(inquiryTarget.entityIds);

      const primary = inquiryTarget.primaryId || inquiryTarget.entityIds[0];
      if (primary) {
        setSelectedNodeId(primary);
        selectEntity(primary);
        setIsInspectorOpen(true);
      }
      showNotification(`Mapped inquiry: ${inquiryTarget.entityIds.length} entities & connections on canvas.`);
    }
  }, [inquiryTarget, selectEntity]);

  // Sync external context entity selection with local graph
  useEffect(() => {
    if (contextEntityId && entities[contextEntityId]) {
      setSelectedNodeId(contextEntityId);
      setSelectedEdgeId(null);
      setIsInspectorOpen(true);
      if (!visibleEntityIds.includes(contextEntityId)) {
        setVisibleEntityIds((prev) => [...prev, contextEntityId]);
      }
    }
  }, [contextEntityId, entities]);

  // Node Selection Handler
  const handleSelectNode = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      if (nodeId) {
        selectEntity(nodeId);
        setIsInspectorOpen(true);
        setVisibleEntityIds((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      }
    },
    [selectEntity]
  );

  // Quick inquiry action to map an entity and its immediate connections
  const handleAddEntityToCanvas = useCallback(
    (entityId: string) => {
      const ent = entities[entityId];
      if (!ent) return;
      const idsToAdd = [entityId];
      ent.candidateConnections.slice(0, 4).forEach((c) => {
        if (!idsToAdd.includes(c.entityId)) idsToAdd.push(c.entityId);
      });
      setVisibleEntityIds((prev) => {
        const set = new Set([...prev, ...idsToAdd]);
        return Array.from(set);
      });
      setSelectedNodeId(entityId);
      selectEntity(entityId);
      setIsInspectorOpen(true);
      showNotification(`Mapped inquiry for ${ent.name} (${idsToAdd.length} entities)`);
    },
    [entities, selectEntity]
  );

  // Direct inquiry search from graph canvas toolbar
  const handleInquirySearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      setIsLoading(true);
      try {
        const res = await api.searchGraphInquiry(q);
        if (res.nodes && res.nodes.length > 0) {
          const matchedIds = res.nodes.map((n: any) => n.data.id);
          setVisibleEntityIds(matchedIds);
          if (res.primaryId) {
            setSelectedNodeId(res.primaryId);
            selectEntity(res.primaryId);
            setIsInspectorOpen(true);
          }
          showNotification(res.summary);
        } else {
          showNotification(`No graph entities found matching "${q}".`);
        }
      } catch (err: any) {
        showNotification(`Query notice: ${err.message || 'Error querying intelligence graph'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [selectEntity]
  );

  // Edge Selection Handler
  const handleSelectEdge = useCallback((edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    if (edgeId) {
      setIsInspectorOpen(true);
    }
  }, []);

  // Add a candidate connection onto the canvas without duplication
  const handleAddConnectionToGraph = useCallback(
    (candidate: CandidateConnection, anchorEntityId: string) => {
      // 1. Add entity if not visible
      if (!visibleEntityIds.includes(candidate.entityId)) {
        setVisibleEntityIds((prev) => [...prev, candidate.entityId]);
      }

      // 2. Add connecting edge if not existing
      const existingEdge = edges.find(
        (e) =>
          (e.source === anchorEntityId && e.target === candidate.entityId) ||
          (e.source === candidate.entityId && e.target === anchorEntityId)
      );

      if (!existingEdge) {
        const newEdge: IntelligenceEdge = {
          id: `edge_${anchorEntityId}_${candidate.entityId}_${Date.now()}`,
          source: candidate.direction === 'INCOMING' ? candidate.entityId : anchorEntityId,
          target: candidate.direction === 'INCOMING' ? anchorEntityId : candidate.entityId,
          relationshipType: candidate.relationshipType,
          label: candidate.relationshipLabel,
          status: candidate.status,
          confidence: candidate.status === 'VERIFIED' ? 0.98 : candidate.status === 'INFERRED' ? 0.8 : 0.6,
          timestamp: candidate.timestamp,
          evidenceId: candidate.evidenceRefId,
        };

        setEdges((prev) => [...prev, newEdge]);
      }

      // 3. Update hidden count on anchor entity
      setEntities((prev) => {
        const anchor = prev[anchorEntityId];
        if (!anchor) return prev;
        return {
          ...prev,
          [anchorEntityId]: {
            ...anchor,
            hiddenCount: Math.max(anchor.hiddenCount - 1, 0),
          },
        };
      });

      showNotification(`Added ${candidate.entityName} to investigation graph.`);
    },
    [visibleEntityIds, edges]
  );

  // Open hidden connections in Inspector
  const handleOpenHiddenConnections = (entityId: string) => {
    setSelectedNodeId(entityId);
    setSelectedEdgeId(null);
    selectEntity(entityId);
    setIsInspectorOpen(true);
    setInspectorTab('connections');
  };

  // Filter handlers
  const handleToggleEntityType = (type: string) => {
    setActiveEntityTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleToggleRelationshipType = (type: string) => {
    setActiveRelationshipTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleClearFilters = () => {
    setActiveEntityTypes(['PERSON', 'ORGANIZATION', 'LOCATION', 'VEHICLE', 'EVENT', 'DOCUMENT']);
    setActiveRelationshipTypes([
      'works_at',
      'visited',
      'used_for',
      'colleague',
      'involved_in',
      'headquarters',
      'associated_with',
      'lives_in',
      'traveled_to',
      'reports_to',
      'leases',
      'occurred_at',
      'REFERENCES',
      'facility_access',
    ]);
    setTimeRange('ALL');
    setSearchFilterQuery('');
    showNotification('Graph filters reset to default.');
  };

  // Chat action dispatcher
  const handleExecuteChatAction = (actionType: string, payload?: any) => {
    if (actionType === 'ADD_ENTITIES' && Array.isArray(payload)) {
      setVisibleEntityIds((prev) => {
        const nextSet = new Set(prev);
        payload.forEach((id: string) => nextSet.add(id));
        return Array.from(nextSet);
      });
      if (payload[0]) {
        setSelectedNodeId(payload[0]);
        selectEntity(payload[0]);
      }
      showNotification(`Mapped ${payload.length} entities to canvas`);
    } else if (actionType === 'SET_ENTITIES' && Array.isArray(payload)) {
      setVisibleEntityIds(payload);
      if (payload[0]) {
        setSelectedNodeId(payload[0]);
        selectEntity(payload[0]);
      }
      showNotification(`Mapped inquiry: ${payload.length} entities to canvas`);
    } else if (actionType === 'INSPECT_EVIDENCE') {
      const targetId = typeof payload === 'string' ? payload : selectedNodeId;
      if (targetId) setSelectedNodeId(targetId);
      setIsInspectorOpen(true);
      setInspectorTab('evidence');
    } else if (actionType === 'SHOW_VISITORS' && typeof payload === 'string') {
      setSelectedNodeId(payload);
      selectEntity(payload);
      setIsInspectorOpen(true);
      setInspectorTab('connections');
    } else if (actionType === 'LOCATE_MAP' && typeof payload === 'string') {
      selectEntity(payload);
      setActiveView('map');
    }
  };

  const selectedEntity = selectedNodeId ? entities[selectedNodeId] || null : null;
  const selectedEdge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) || null : null;

  return (
    <div className="flex-1 h-full w-full flex flex-col bg-[#080D16] text-[#E6EDF7] overflow-hidden select-none relative">
      {/* Toast Notification Alert */}
      {statusNotification && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-[#162338] border border-[#4C90F0] text-[#E6EDF7] px-3.5 py-1.5 rounded-md shadow-2xl text-xs flex items-center gap-2 animate-fade-in pointer-events-none">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#3DB46D]" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Main Workspace Horizontal Split */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 1. Left-Side Entity Inspector (sits immediately adjacent to Navigation Rail) */}
        {isInspectorOpen && (
          <EntityInspector
            selectedEntity={selectedEntity}
            selectedEdge={selectedEdge}
            entities={entities}
            evidenceCatalog={evidenceCatalog}
            visibleEntityIds={visibleEntityIds}
            onClose={() => setIsInspectorOpen(false)}
            onAddConnectionToGraph={handleAddConnectionToGraph}
            onSelectEntity={(id) => handleSelectNode(id)}
            initialTab={inspectorTab}
          />
        )}

        {/* 2. Central Graph Canvas (~60-65% width) */}
        <div className="flex-1 h-full flex flex-col overflow-hidden relative bg-[#080D16]">
          {/* Interactive Graph Surface */}
          <div className="flex-1 w-full h-full relative">
            {isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-2 text-xs font-mono text-[#95A4BA]">
                <RefreshCw className="w-5 h-5 text-[#4C90F0] animate-spin" />
                <span>Loading intelligence graph from repository...</span>
              </div>
            ) : (
              <CanvasGraph
                entities={entities}
                visibleEntityIds={visibleEntityIds}
                edges={edges}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                onSelectNode={handleSelectNode}
                onSelectEdge={handleSelectEdge}
                onOpenHiddenConnections={handleOpenHiddenConnections}
                onAddEntityToCanvas={handleAddEntityToCanvas}
                onNavigateToIngestion={() => setActiveView('ingestion')}
                isFiltersOpen={isFiltersOpen}
                onToggleFilters={() => setIsFiltersOpen(!isFiltersOpen)}
                isInspectorOpen={isInspectorOpen}
                onToggleInspector={() => setIsInspectorOpen(true)}
                onClearCanvas={() => {
                  setVisibleEntityIds([]);
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                  showNotification('Canvas cleared. Awaiting inquiry.');
                }}
                searchFilterQuery={searchFilterQuery}
                activeEntityTypes={activeEntityTypes}
                activeRelationshipTypes={activeRelationshipTypes}
                onInquirySearch={handleInquirySearch}
              />
            )}
          </div>

          {/* Draggable Bottom Investigation Copilot Chat */}
          <InvestigationChatDrawer
            selectedEntity={selectedNodeId ? entities[selectedNodeId] || null : null}
            selectedEntityId={selectedNodeId}
            onExecuteAction={handleExecuteChatAction}
            onFocusEntity={handleSelectNode}
          />
        </div>

        {/* 3. Right-Side Filters & Legend Panel (Collapsible) */}
        {isFiltersOpen && (
          <GraphFiltersPanel
            isOpen={isFiltersOpen}
            onClose={() => setIsFiltersOpen(false)}
            activeEntityTypes={activeEntityTypes}
            onToggleEntityType={handleToggleEntityType}
            activeRelationshipTypes={activeRelationshipTypes}
            onToggleRelationshipType={handleToggleRelationshipType}
            onSelectAllEntityTypes={() =>
              setActiveEntityTypes(['PERSON', 'ORGANIZATION', 'LOCATION', 'VEHICLE', 'EVENT', 'DOCUMENT'])
            }
            onSelectAllRelationshipTypes={() =>
              setActiveRelationshipTypes([
                'works_at',
                'visited',
                'used_for',
                'colleague',
                'involved_in',
                'headquarters',
                'associated_with',
                'lives_in',
                'traveled_to',
                'reports_to',
                'leases',
                'occurred_at',
                'REFERENCES',
                'facility_access',
              ])
            }
            onClearFilters={handleClearFilters}
            timeRange={timeRange}
            onChangeTimeRange={setTimeRange}
          />
        )}
      </div>
    </div>
  );
};
