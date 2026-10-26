import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  User,
  Building2,
  MapPin,
  Car,
  Calendar,
  FileText,
  CreditCard,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  Crosshair,
  RotateCcw,
  Eye,
  Sliders,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { IntelligenceEntity, IntelligenceEdge } from '../../data/intelligenceDataset';

interface CanvasNodePosition {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

interface CanvasGraphProps {
  entities: Record<string, IntelligenceEntity>;
  visibleEntityIds: string[];
  edges: IntelligenceEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onOpenHiddenConnections: (entityId: string) => void;
  onAddEntityClick?: () => void;
  onAddEntityToCanvas?: (entityId: string) => void;
  onNavigateToIngestion?: () => void;
  isFiltersOpen?: boolean;
  onToggleFilters?: () => void;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  onClearCanvas?: () => void;
  searchFilterQuery?: string;
  activeEntityTypes?: string[];
  activeRelationshipTypes?: string[];
  onInquirySearch?: (query: string) => void;
  className?: string;
}

export const CanvasGraph: React.FC<CanvasGraphProps> = ({
  entities,
  visibleEntityIds,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onOpenHiddenConnections,
  onAddEntityClick,
  onAddEntityToCanvas,
  onNavigateToIngestion,
  isFiltersOpen,
  onToggleFilters,
  isInspectorOpen,
  onToggleInspector,
  onClearCanvas,
  searchFilterQuery = '',
  activeEntityTypes,
  activeRelationshipTypes,
  onInquirySearch,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inquiryInput, setInquiryInput] = useState('');

  const handleExecuteInquiry = () => {
    const q = inquiryInput.trim();
    if (!q) return;
    if (onInquirySearch) {
      onInquirySearch(q);
      setInquiryInput('');
    } else if (onAddEntityToCanvas) {
      const qLower = q.toLowerCase();
      const match = Object.values(entities).find(
        (e) => e.name.toLowerCase().includes(qLower) || e.id.toLowerCase().includes(qLower)
      );
      if (match) {
        onAddEntityToCanvas(match.id);
        setInquiryInput('');
      }
    }
  };

  // Transform state: pan (x, y) and zoom scale
  const [transform, setTransform] = useState<{ x: number; y: number; k: number }>({
    x: 0,
    y: 0,
    k: 1,
  });

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // Dynamic entity node coordinates (persisted once placed)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Deterministic, Widescreen Collision-Aware Force Placement
  const computeDeterministicLayout = useCallback(
    (nodeIds: string[], currentPositions: Record<string, { x: number; y: number }>, forceFresh: boolean = false) => {
      if (nodeIds.length === 0) return currentPositions;

      // If all nodes already have positions and we are not forcing a fresh layout, keep them pinned!
      const unplacedIds = nodeIds.filter((id) => !currentPositions[id]);
      if (!forceFresh && unplacedIds.length === 0) {
        return currentPositions;
      }

      const containerWidth = containerRef.current?.clientWidth || 1400;
      const containerHeight = containerRef.current?.clientHeight || 800;
      const centerX = Math.round(containerWidth / 2);
      const centerY = Math.round(containerHeight / 2);

      const isFreshQuery = forceFresh || Object.keys(currentPositions).length === 0;
      const posMap: Record<string, { x: number; y: number }> = isFreshQuery ? {} : { ...currentPositions };

      // Calculate relationship degrees for hub detection
      const degreeMap: Record<string, number> = {};
      edges.forEach((e) => {
        degreeMap[e.source] = (degreeMap[e.source] || 0) + 1;
        degreeMap[e.target] = (degreeMap[e.target] || 0) + 1;
      });

      const sorted = [...nodeIds].sort((a, b) => (degreeMap[b] || 0) - (degreeMap[a] || 0));
      const hubId = sorted[0] || nodeIds[0];

      if (isFreshQuery) {
        // Place primary hub at center
        posMap[hubId] = { x: centerX, y: centerY };
        const others = nodeIds.filter((id) => id !== hubId);
        const count = others.length;

        // Widescreen elliptical orbits matching 16:9 monitor aspect ratio
        const radiusX = Math.max(480, Math.min(680, 280 + count * 45));
        const radiusY = Math.max(260, Math.min(380, 160 + count * 25));

        others.forEach((id, idx) => {
          const angle = (idx * (2 * Math.PI)) / Math.max(count, 1) - Math.PI / 2;
          posMap[id] = {
            x: Math.round(centerX + Math.cos(angle) * radiusX),
            y: Math.round(centerY + Math.sin(angle) * radiusY),
          };
        });
      } else {
        // Incremental placement ONLY for genuinely unplaced nodes
        unplacedIds.forEach((id, idx) => {
          const conn = edges.find((e) => (e.source === id && posMap[e.target]) || (e.target === id && posMap[e.source]));
          const anchorId = conn ? (conn.source === id ? conn.target : conn.source) : hubId;
          const anchorPos = anchorId && posMap[anchorId] ? posMap[anchorId] : { x: centerX, y: centerY };

          const angle = (idx * (2 * Math.PI)) / Math.max(unplacedIds.length, 3) - Math.PI / 4;
          const dist = 280 + (idx % 2) * 60;
          posMap[id] = {
            x: Math.round(anchorPos.x + Math.cos(angle) * dist * 1.3),
            y: Math.round(anchorPos.y + Math.sin(angle) * dist * 0.9),
          };
        });
      }

      // Relaxation loop: ensure generous spacing to prevent node and edge-badge collisions
      const minDistanceX = 300;
      const minDistanceY = 220;

      for (let iter = 0; iter < 40; iter++) {
        for (let i = 0; i < nodeIds.length; i++) {
          for (let j = i + 1; j < nodeIds.length; j++) {
            const idA = nodeIds[i];
            const idB = nodeIds[j];
            const pA = posMap[idA];
            const pB = posMap[idB];
            if (!pA || !pB) continue;

            const dx = pB.x - pA.x;
            const dy = pB.y - pA.y;

            const normX = dx / minDistanceX;
            const normY = dy / minDistanceY;
            const distNorm = Math.sqrt(normX * normX + normY * normY) || 0.01;

            if (distNorm < 1) {
              const push = (1 - distNorm) * 0.5;
              const pushX = Math.round((normX / distNorm) * push * minDistanceX);
              const pushY = Math.round((normY / distNorm) * push * minDistanceY);

              if (idA !== hubId) {
                pA.x -= pushX;
                pA.y -= pushY;
              }
              if (idB !== hubId) {
                pB.x += pushX;
                pB.y += pushY;
              }
            }
          }
        }
      }

      return posMap;
    },
    [edges]
  );

  // Auto-calculate positions when visible entities change
  useEffect(() => {
    setPositions((prev) => computeDeterministicLayout(visibleEntityIds, prev));
  }, [visibleEntityIds, computeDeterministicLayout]);

  // Center / Fit to View - Guarantees all nodes fit completely on screen
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    if (visibleEntityIds.length === 0) {
      setTransform({ x: Math.round(clientWidth / 2 - 450), y: Math.round(clientHeight / 2 - 280), k: 1 });
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let validCount = 0;

    visibleEntityIds.forEach((id) => {
      const pos = positions[id];
      if (!pos) return;
      validCount++;
      minX = Math.min(minX, pos.x - 140);
      maxX = Math.max(maxX, pos.x + 140);
      minY = Math.min(minY, pos.y - 90);
      maxY = Math.max(maxY, pos.y + 110);
    });

    if (validCount === 0) return;

    const graphWidth = Math.max(maxX - minX, 100);
    const graphHeight = Math.max(maxY - minY, 100);
    const paddingX = 80;
    const paddingY = 60;

    const scaleX = (clientWidth - paddingX * 2) / graphWidth;
    const scaleY = (clientHeight - paddingY * 2) / graphHeight;
    const k = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.2);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTransform({
      x: Math.round(clientWidth / 2 - centerX * k),
      y: Math.round(clientHeight / 2 - centerY * k),
      k,
    });
  }, [visibleEntityIds, positions]);

  // Re-run layout completely on user demand
  const handleRearrange = useCallback(() => {
    const freshPositions = computeDeterministicLayout(visibleEntityIds, {}, true);
    setPositions(freshPositions);
    setTimeout(handleFitView, 60);
  }, [visibleEntityIds, computeDeterministicLayout, handleFitView]);

  // Auto-fit view when new inquiry nodes arrive
  useEffect(() => {
    const timer = setTimeout(handleFitView, 100);
    return () => clearTimeout(timer);
  }, [visibleEntityIds.length, handleFitView]);

  // Initialize view and observe container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    handleFitView();
    const timer = setTimeout(handleFitView, 150);

    const ro = new ResizeObserver(() => {
      handleFitView();
    });
    ro.observe(el);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [handleFitView]);

  // Zoom helpers
  const handleZoomIn = () => {
    setTransform((prev) => ({ ...prev, k: Math.min(prev.k * 1.25, 2.8) }));
  };

  const handleZoomOut = () => {
    setTransform((prev) => ({ ...prev, k: Math.max(prev.k * 0.8, 0.4) }));
  };

  const handleReset = () => {
    setPositions({});
    handleFitView();
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newK = Math.min(Math.max(transform.k * zoomFactor, 0.35), 3.0);

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setTransform((prev) => ({
        k: newK,
        x: mouseX - ((mouseX - prev.x) / prev.k) * newK,
        y: mouseY - ((mouseY - prev.y) / prev.k) * newK,
      }));
    }
  };

  // Drag Canvas / Node handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking background canvas, start pan
    if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      onSelectNode(null);
      onSelectEdge(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
    } else if (draggedNodeId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseCanvasX = (e.clientX - rect.left - transform.x) / transform.k;
      const mouseCanvasY = (e.clientY - rect.top - transform.y) / transform.k;

      setPositions((prev) => ({
        ...prev,
        [draggedNodeId]: {
          x: Math.round(mouseCanvasX - dragOffset.x),
          y: Math.round(mouseCanvasY - dragOffset.y),
        },
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Global mouseup safeguard
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggedNodeId(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Entity Icon Helper
  const getEntityIcon = (type: string, isCenter: boolean = false) => {
    const size = isCenter ? 'w-5 h-5 text-white' : 'w-4 h-4 text-[#8B9097]';
    switch (type) {
      case 'PERSON':
        return <User className={size} />;
      case 'ORGANIZATION':
        return <Building2 className={size} />;
      case 'LOCATION':
        return <MapPin className={size} />;
      case 'VEHICLE':
        return <Car className={size} />;
      case 'EVENT':
        return <Calendar className={size} />;
      case 'DOCUMENT':
        return <FileText className={size} />;
      default:
        return <CreditCard className={size} />;
    }
  };

  // Filtering Logic
  const visibleEntitiesList = visibleEntityIds
    .map((id) => entities[id])
    .filter(Boolean)
    .filter((entity) => {
      if (activeEntityTypes && activeEntityTypes.length > 0 && !activeEntityTypes.includes(entity.type)) {
        return false;
      }
      if (searchFilterQuery.trim()) {
        const q = searchFilterQuery.toLowerCase();
        return entity.name.toLowerCase().includes(q) || entity.roleOrCategory.toLowerCase().includes(q);
      }
      return true;
    });

  const visibleNodeIdSet = new Set(visibleEntitiesList.map((e) => e.id));

  const visibleEdgesList = edges.filter((edge) => {
    if (!visibleNodeIdSet.has(edge.source) || !visibleNodeIdSet.has(edge.target)) {
      return false;
    }
    if (activeRelationshipTypes && activeRelationshipTypes.length > 0) {
      const match = activeRelationshipTypes.some(
        (t) => t.toLowerCase() === edge.relationshipType.toLowerCase() || t === edge.relationshipType
      );
      if (!match) return false;
    }
    return true;
  });

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative w-full h-full select-none overflow-hidden bg-[#080D16] ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle, #1E2838 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        backgroundPosition: `${transform.x % 24}px ${transform.y % 24}px`,
      }}
    >
      {/* Canvas Top Bar */}
      <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#0E1624]/90 backdrop-blur-md px-3 py-1.5 rounded-md border border-[#243247] pointer-events-auto shadow-lg text-xs font-mono text-[#8EAFD9]">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span className="font-semibold text-xs text-[#E6EDF7] font-sans">Investigation Canvas</span>
          <span className="text-[#6F91BA] text-[10px]">({Object.keys(entities).length} indexed records)</span>
        </div>

        {/* Inquiry Search & Direct Map Bar */}
        <div className="flex items-center gap-1.5 bg-[#0E1624]/95 backdrop-blur-md px-2 py-1 rounded-md border border-[#2B405F] pointer-events-auto shadow-2xl w-80 md:w-96">
          <input
            type="text"
            value={inquiryInput}
            onChange={(e) => setInquiryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleExecuteInquiry();
            }}
            placeholder="Search & map entity (e.g. Victor Vance, CRX-9942, Elena)..."
            className="w-full bg-transparent text-xs text-[#E6EDF7] placeholder-[#6F91BA] focus:outline-none px-1.5 py-0.5"
          />
          <button
            onClick={handleExecuteInquiry}
            className="px-2.5 py-1 text-[11px] font-semibold bg-[#1A3356] hover:bg-[#234574] text-[#8EAFD9] hover:text-[#E6EDF7] rounded border border-[#3A5B88] transition shrink-0"
          >
            Map
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-[#0E1624]/90 backdrop-blur-md p-1 rounded-md border border-[#243247] pointer-events-auto shadow-lg">
          {/* Fit View Button */}
          <button
            onClick={handleFitView}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
            title="Fit graph to view / Recenter"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit View</span>
          </button>

          {/* Rearrange / Relax Layout Button */}
          <button
            onClick={handleRearrange}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
            title="Rearrange nodes with optimal collision spacing"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rearrange</span>
          </button>

          {/* Clear Canvas (when nodes exist) */}
          {visibleEntityIds.length > 0 && onClearCanvas && (
            <button
              onClick={onClearCanvas}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#F43F5E] hover:bg-[#2A1720] border border-transparent hover:border-[#4C1D2A] rounded transition"
              title="Remove all entities from canvas"
            >
              <span>Clear</span>
            </button>
          )}

          {/* Show Inspector toggle (if closed) */}
          {isInspectorOpen === false && onToggleInspector && (
            <button
              onClick={onToggleInspector}
              className="px-2.5 py-1 text-xs font-medium text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
            >
              Show Inspector
            </button>
          )}

          {/* Filters Panel Toggle */}
          {onToggleFilters && (
            <button
              onClick={onToggleFilters}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition ${
                isFiltersOpen
                  ? 'bg-[#1A2B42] text-[#E6EDF7] border border-[#4C90F0]'
                  : 'text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42]'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-[#6F91BA]" />
              <span>Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Main SVG Graph Surface - Fixed 100% full screen surface */}
      <svg className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden">
        <defs>
          {/* Subtle directional arrow marker */}
          <marker
            id="edge-arrow"
            viewBox="0 0 10 10"
            refX="24"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#4B607E" />
          </marker>
          <marker
            id="edge-arrow-selected"
            viewBox="0 0 10 10"
            refX="24"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6F91BA" />
          </marker>
        </defs>

        {/* Global zoom and pan viewport group - gives infinite unclipped canvas */}
        <g
          className="graph-viewport-layer"
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
        >
          {/* 1. Relationship Edges */}
          <g className="edges-layer">
          {visibleEdgesList.map((edge) => {
            const sourcePos = positions[edge.source] || { x: 500, y: 350 };
            const targetPos = positions[edge.target] || { x: 500, y: 350 };

            const isSelected = selectedEdgeId === edge.id;
            const isHovered = hoveredEdgeId === edge.id;
            const isConnectedToSelectedNode =
              selectedNodeId === edge.source || selectedNodeId === edge.target;

            // Compute edge midpoint and curve offset
            const dx = targetPos.x - sourcePos.x;
            const dy = targetPos.y - sourcePos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2;

            // Path curve
            const pathD = `M ${sourcePos.x} ${sourcePos.y} Q ${midX} ${midY - 8} ${targetPos.x} ${targetPos.y}`;

            const isDirect = (edge as any).status === 'DIRECTLY_SUPPORTED';
            const isInferred = (edge as any).status === 'INFERRED';

            const strokeColor = isSelected
              ? '#4C90F0'
              : isHovered || isConnectedToSelectedNode
              ? '#8EAFD9'
              : isInferred
              ? '#D99B35'
              : '#3B5272';

            const strokeWidth = isSelected ? 2.5 : isHovered ? 2 : 1.6;
            const strokeDasharray = isInferred ? '5 4' : undefined;

            return (
              <g
                key={edge.id}
                className="cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEdge(edge.id);
                  onSelectNode(null);
                }}
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId(null)}
              >
                {/* Invisible wider hit area */}
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="20" />

                {/* Visible relationship edge */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  markerEnd={isSelected ? 'url(#edge-arrow-selected)' : 'url(#edge-arrow)'}
                />

                {/* Edge Label Badge */}
                {(() => {
                  const labelText = isInferred ? `[INFERRED] ${edge.label}` : edge.label;
                  const textWidth = Math.max(labelText.length * 6.4 + 16, 40);
                  return (
                    <g transform={`translate(${midX}, ${midY - 4})`}>
                      <rect
                        x={-(textWidth / 2)}
                        y="-10"
                        width={textWidth}
                        height="20"
                        rx="4"
                        fill="#0A101C"
                        stroke={isSelected ? '#4C90F0' : isInferred ? '#D99B35' : '#243247'}
                        strokeWidth={isSelected ? '1.5' : '1'}
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fill={isSelected ? '#E6EDF7' : isInferred ? '#F6C177' : '#95A4BA'}
                        fontSize="9.5"
                        fontFamily="Inter, sans-serif"
                        fontWeight="500"
                      >
                        {labelText}
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}
        </g>

        {/* 2. Entity Nodes */}
        <g className="nodes-layer">
          {visibleEntitiesList.map((entity) => {
            const pos = positions[entity.id] || { x: 500, y: 350 };
            const isSelected = selectedNodeId === entity.id;
            const isHovered = hoveredNodeId === entity.id;
            const isCenterNode = entity.id === selectedNodeId || entity.id === visibleEntityIds[0];
            const nodeRadius = isCenterNode ? 30 : 25;

            // Ring styling
            let ringColor = '#243247';
            if (isSelected) ringColor = '#4C90F0';
            else if (isHovered) ringColor = '#6F91BA';
            else if (entity.riskStatus === 'CRITICAL') ringColor = '#E5484D';
            else if (entity.uncertaintyNote) ringColor = '#F5A524';

            return (
              <g
                key={entity.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const mouseCanvasX = (e.clientX - rect.left - transform.x) / transform.k;
                    const mouseCanvasY = (e.clientY - rect.top - transform.y) / transform.k;
                    setDragOffset({
                      x: mouseCanvasX - pos.x,
                      y: mouseCanvasY - pos.y,
                    });
                  }
                  setDraggedNodeId(entity.id);
                  onSelectNode(entity.id);
                  onSelectEdge(null);
                }}
                onMouseEnter={() => setHoveredNodeId(entity.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Node Outer Circle */}
                <circle
                  r={nodeRadius + 4}
                  fill="#0E1624"
                  stroke={ringColor}
                  strokeWidth={isSelected ? 3 : isCenterNode ? 2.5 : 1.5}
                  className="transition-all duration-150"
                  style={{
                    filter: isSelected ? 'drop-shadow(0 0 12px rgba(76, 144, 240, 0.45))' : undefined,
                  }}
                />

                {/* Inner Circle Fill */}
                <circle
                  r={nodeRadius}
                  fill={isCenterNode ? '#1A2F4C' : isSelected ? '#162338' : '#111B2B'}
                />

                {/* Icon in Center */}
                <foreignObject
                  x={-12}
                  y={-12}
                  width={24}
                  height={24}
                  className="pointer-events-none"
                >
                  <div className="w-full h-full flex items-center justify-center">
                    {getEntityIcon(entity.type, isCenterNode)}
                  </div>
                </foreignObject>

                {/* +N Hidden Connections Badge Pill */}
                {entity.hiddenCount > 0 && (
                  <g
                    transform={`translate(${nodeRadius - 4}, ${nodeRadius - 8})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(entity.id);
                      onOpenHiddenConnections(entity.id);
                    }}
                    className="cursor-pointer hover:opacity-90"
                  >
                    <title>{`Click to view +${entity.hiddenCount} connections`}</title>
                    <rect
                      x="-11"
                      y="-7"
                      width="22"
                      height="15"
                      rx="7.5"
                      fill="#162942"
                      stroke="#4A6A92"
                      strokeWidth="1.2"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#8EAFD9"
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="600"
                    >
                      +{entity.hiddenCount}
                    </text>
                  </g>
                )}

                {/* Primary Entity Name Label */}
                <text
                  x="0"
                  y={nodeRadius + 16}
                  textAnchor="middle"
                  fill="#E6EDF7"
                  fontSize={isCenterNode ? '12' : '11'}
                  fontFamily="Inter, sans-serif"
                  fontWeight="600"
                  className="pointer-events-none select-none"
                >
                  {entity.name}
                </text>

                {/* Subtitle / Entity Type Label */}
                <text
                  x="0"
                  y={nodeRadius + 28}
                  textAnchor="middle"
                  fill="#95A4BA"
                  fontSize="9.5"
                  fontFamily="Inter, sans-serif"
                  fontWeight="400"
                  className="pointer-events-none select-none"
                >
                  {entity.type.charAt(0) + entity.type.slice(1).toLowerCase()}
                </text>

                {/* Specific Multi-Line Event Details (Dynamic from entity properties) */}
                {entity.type === 'EVENT' && entity.properties && (
                  <g transform={`translate(0, ${nodeRadius + 40})`} className="pointer-events-none">
                    {entity.properties.timestamp && (
                      <text
                        x="0"
                        y="0"
                        textAnchor="middle"
                        fill="#8193AA"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {String(entity.properties.timestamp)}
                      </text>
                    )}
                    {entity.properties.sourceDataset && (
                      <text
                        x="0"
                        y="11"
                        textAnchor="middle"
                        fill="#64768E"
                        fontSize="8.5"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {String(entity.properties.sourceDataset)}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </g>
    </svg>

      {/* Empty State Overlay when no query has been initiated */}
      {visibleEntitiesList.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none p-6">
          <div className="max-w-md w-full bg-[#0E1624]/90 backdrop-blur-md border border-[#243247] rounded-lg p-6 shadow-2xl text-center pointer-events-auto">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#162338] border border-[#2A3E5C] flex items-center justify-center text-[#4C90F0]">
              <Crosshair className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-[#E6EDF7] tracking-wide mb-1">
              Investigation Graph Idle // Awaiting Inquiry
            </h3>
            <p className="text-xs text-[#8EAFD9] leading-relaxed mb-4">
              {Object.keys(entities).length > 0
                ? "The canvas does not populate nodes by default. Search an entity or ask a question in the investigation drawer to map relevant intelligence connections."
                : "No datasets are currently indexed. Upload files in Data Ingestion to begin mapping entities and relationships."}
            </p>

            {Object.keys(entities).length > 0 ? (
              <div className="space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#6F91BA]">
                  Available Indexed Entities ({Object.keys(entities).length})
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center max-h-36 overflow-y-auto pr-1">
                  {Object.values(entities)
                    .filter((e) => e.candidateConnections && e.candidateConnections.length > 0)
                    .concat(Object.values(entities))
                    .filter((e, idx, arr) => arr.findIndex((x) => x.id === e.id) === idx)
                    .slice(0, 10)
                    .map((ent) => (
                      <button
                        key={ent.id}
                        onClick={() => {
                          if (onAddEntityToCanvas) {
                            onAddEntityToCanvas(ent.id);
                          } else {
                            onSelectNode(ent.id);
                          }
                        }}
                        className="px-2.5 py-1 text-xs bg-[#162338] hover:bg-[#1E314D] border border-[#2B405F] hover:border-[#4C90F0] text-[#DCE6F5] rounded transition flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4C90F0]" />
                        <span>{ent.name}</span>
                        {ent.candidateConnections && ent.candidateConnections.length > 0 && (
                          <span className="text-[10px] text-[#6F91BA] font-mono">+{ent.candidateConnections.length}</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              onNavigateToIngestion && (
                <button
                  onClick={onNavigateToIngestion}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#1A2B42] hover:bg-[#243754] border border-[#3A5377] text-[#E6EDF7] rounded shadow-lg transition"
                >
                  Go to Data Ingestion
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Floating Bottom-Left Zoom Toolbar */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 bg-[#0E1624]/90 backdrop-blur-md p-1 rounded-md border border-[#243247] shadow-xl">
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
          title="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
          title="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-[#243247] mx-0.5" />
        <button
          onClick={handleFitView}
          className="p-1.5 text-[#95A4BA] hover:text-[#E6EDF7] hover:bg-[#1A2B42] rounded transition"
          title="Recenter"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Bottom-Right Radar Minimap (Only active when entities are visible) */}
      {visibleEntitiesList.length > 0 && (
        <div className="absolute bottom-4 right-4 z-20 w-36 h-28 bg-[#0E1624]/90 backdrop-blur-md border border-[#243247] rounded-md overflow-hidden p-1 shadow-2xl flex flex-col justify-between pointer-events-none">
          <div className="text-[9px] font-mono text-[#6F91BA] uppercase tracking-wider px-1">
            Radar View
          </div>
          <div className="relative w-full h-full flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 1000 700">
              {/* Miniature grid line */}
              <circle cx="500" cy="350" r="280" fill="none" stroke="#1E2A3C" strokeWidth="1" strokeDasharray="3 3" />
              {/* Edges in minimap */}
              {visibleEdgesList.map((e) => {
                const sp = positions[e.source] || { x: 500, y: 350 };
                const tp = positions[e.target] || { x: 500, y: 350 };
                return (
                  <line
                    key={`mm-${e.id}`}
                    x1={sp.x}
                    y1={sp.y}
                    x2={tp.x}
                    y2={tp.y}
                    stroke="#243750"
                    strokeWidth="2"
                  />
                );
              })}
              {/* Nodes in minimap */}
              {visibleEntitiesList.map((e) => {
                const p = positions[e.id] || { x: 500, y: 350 };
                const isCenter = e.id === selectedNodeId || e.id === visibleEntityIds[0];
                return (
                  <circle
                    key={`mm-${e.id}`}
                    cx={p.x}
                    cy={p.y}
                    r={isCenter ? 12 : 8}
                    fill={isCenter ? '#4C90F0' : '#8B9097'}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
