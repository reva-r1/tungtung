import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import dagre from 'cytoscape-dagre';
import { GraphData, EntityType, RiskLevel } from '../../types';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  Search,
  Route,
  Eye,
  Layers,
  ChevronDown
} from 'lucide-react';

// Register extensions
try {
  cytoscape.use(coseBilkent);
  cytoscape.use(dagre);
} catch (e) {
  // Ignore re-registration
}

interface EntityGraphProps {
  graphData?: GraphData | null;
  onSelectNode?: (nodeId: string) => void;
  className?: string;
  isCompact?: boolean;
}

export const EntityGraph: React.FC<EntityGraphProps> = ({
  graphData,
  onSelectNode,
  className = '',
  isCompact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const { selectedEntityId, selectEntity, quickNavigateToEntity, sourceFilter } = useInvestigation();

  const [currentLayout, setCurrentLayout] = useState<string>('cose');
  const [activeEdgeFilter, setActiveEdgeFilter] = useState<string>('ALL');
  const [internalGraph, setInternalGraph] = useState<GraphData | null>(graphData || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isPathModalOpen, setIsPathModalOpen] = useState<boolean>(false);
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [pathResult, setPathResult] = useState<any | null>(null);
  const [selectedEdgeData, setSelectedEdgeData] = useState<any | null>(null);

  // Load graph if not provided
  useEffect(() => {
    if (!graphData) {
      const loadDefaultGraph = async () => {
        setLoading(true);
        try {
          const data = selectedEntityId
            ? await api.expandEntity(selectedEntityId, 2)
            : await api.getGraph({ sources: sourceFilter });
          setInternalGraph(data);
        } catch (err) {
          console.error('Error fetching graph:', err);
        } finally {
          setLoading(false);
        }
      };
      loadDefaultGraph();
    } else {
      setInternalGraph(graphData);
    }
  }, [graphData, selectedEntityId, sourceFilter]);

  // Color mapping by entity type
  const getNodeColor = (type: EntityType) => {
    switch (type) {
      case 'COMPANY': return '#f59e0b'; // Amber
      case 'PERSON': return '#3b82f6'; // Blue
      case 'VEHICLE': return '#06b6d4'; // Cyan
      case 'SHIPMENT': return '#a855f7'; // Purple
      case 'WAREHOUSE': return '#10b981'; // Emerald
      case 'LOCATION': return '#14b8a6'; // Teal
      case 'EVENT': return '#f43f5e'; // Ruby
      case 'TRANSACTION': return '#ec4899'; // Pink
      case 'ROUTE': return '#eab308'; // Yellow
      default: return '#64748b'; // Slate
    }
  };

  const getBorderColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'CRITICAL': return '#f43f5e';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#f59e0b';
      default: return '#334155';
    }
  };

  // Initialize or update Cytoscape
  useEffect(() => {
    if (!containerRef.current || !internalGraph) return;

    // Filter elements if edge filter is active
    const elements: cytoscape.ElementDefinition[] = [];

    for (const node of internalGraph.nodes) {
      elements.push({
        group: 'nodes',
        data: {
          id: node.data.id,
          name: node.data.name,
          type: node.data.type,
          riskLevel: node.data.riskLevel || 'LOW',
          riskScore: node.data.riskScore ?? 0,
          color: getNodeColor(node.data.type),
          borderColor: getBorderColor(node.data.riskLevel || 'LOW'),
          borderWidth: (node.data.riskScore || 0) > 70 ? 4 : 2,
        },
      });
    }

    for (const edge of internalGraph.edges) {
      if (activeEdgeFilter === 'ALL' || edge.data.type === activeEdgeFilter) {
        elements.push({
          group: 'edges',
          data: {
            id: edge.data.id,
            source: edge.data.source,
            target: edge.data.target,
            label: edge.data.label || edge.data.type,
            type: edge.data.type,
            lineColor: edge.data.type === 'ASSOCIATED_WITH' ? '#f43f5e' : '#334155',
          },
        });
      }
    }

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'border-color': 'data(borderColor)',
            'border-width': 'data(borderWidth)',
            'label': 'data(label)',
            'color': '#E6E7E9',
            'font-family': 'Inter, system-ui, sans-serif',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'text-background-color': '#0E0F11',
            'text-background-opacity': 0.9,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'width': 34,
            'height': 34,
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#4C90F0',
            'border-width': 4,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': 'data(lineColor)',
            'target-arrow-color': 'data(lineColor)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '8px',
            'color': '#8B9097',
            'text-background-color': '#151618',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
            'text-rotation': 'autorotate',
            'arrow-scale': 0.8,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#4C90F0',
            'target-arrow-color': '#4C90F0',
            'width': 2.5,
          },
        },
        {
          selector: '.path-highlight',
          style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'width': 4,
          },
        },
        {
          selector: '.path-node',
          style: {
            'border-color': '#f59e0b',
            'border-width': 6,
          },
        },
      ] as any,
      layout: getLayoutConfig(currentLayout),
      minZoom: 0.2,
      maxZoom: 3.5,
      wheelSensitivity: 0.3,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeId = node.id();
      setSelectedEdgeData(null);
      if (onSelectNode) {
        onSelectNode(nodeId);
      } else {
        selectEntity(nodeId);
      }
    });

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      setSelectedEdgeData(edge.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedEdgeData(null);
      }
    });

    // Select the currently active entity if in graph
    if (selectedEntityId) {
      const selectedCyNode = cy.getElementById(selectedEntityId);
      if (selectedCyNode.length > 0) {
        selectedCyNode.select();
      }
    }

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [internalGraph, currentLayout, activeEdgeFilter]);

  function getLayoutConfig(name: string): any {
    switch (name) {
      case 'concentric':
        return {
          name: 'concentric',
          concentric: (node: any) => node.data('riskScore') || 10,
          levelWidth: () => 20,
          padding: 30,
        };
      case 'breadthfirst':
        return {
          name: 'breadthfirst',
          directed: true,
          padding: 30,
          spacingFactor: 1.2,
        };
      case 'circle':
        return {
          name: 'circle',
          padding: 30,
        };
      case 'cose':
      default:
        return {
          name: 'cose',
          animate: false,
          randomize: false,
          componentSpacing: 100,
          nodeRepulsion: 400000,
          nodeOverlap: 20,
          idealEdgeLength: 120,
          edgeElasticity: 100,
          padding: 40,
        };
    }
  }

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);

  const handleExpandNode = async (hops: number = 1) => {
    if (!selectedEntityId) return;
    setLoading(true);
    try {
      const expanded = await api.expandEntity(selectedEntityId, hops);
      setInternalGraph(expanded);
    } catch (err) {
      console.error('Error expanding entity:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cyRef.current || !searchTerm.trim()) return;

    const term = searchTerm.toLowerCase();
    const found = cyRef.current.nodes().filter((n) => n.data('name').toLowerCase().includes(term));
    if (found.length > 0) {
      cyRef.current.nodes().unselect();
      found.select();
      cyRef.current.animate({
        center: { eles: found },
        zoom: 1.5,
      });
      const firstId = found[0].id();
      selectEntity(firstId);
    }
  };

  const handleFindShortestPath = async () => {
    if (!pathSource || !pathTarget) return;
    try {
      const res = await api.findShortestPath(pathSource, pathTarget);
      setPathResult(res);

      if (cyRef.current && res.path && res.path.length > 0) {
        cyRef.current.elements().removeClass('path-highlight path-node');
        for (const nodeId of res.path) {
          cyRef.current.getElementById(nodeId).addClass('path-node');
        }
        for (const edge of res.edges) {
          cyRef.current.getElementById(edge.id).addClass('path-highlight');
        }
        const eles = cyRef.current.$('.path-node, .path-highlight');
        cyRef.current.animate({ center: { eles }, zoom: 1.2 });
      }
    } catch (err) {
      console.error('Shortest path error:', err);
    }
  };

  return (
    <div className={`relative flex flex-col h-full bg-[#0E0F11] border border-[#26292D] rounded overflow-hidden ${className}`}>
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#151618] border-b border-[#26292D] z-10 shrink-0">
        {/* Left: Search & Node Count */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchNode} className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find in graph..."
              className="w-36 sm:w-44 bg-[#1C1E21] border border-[#26292D] rounded px-2.5 py-1 text-xs text-[#E6E7E9] placeholder-[#8B9097] focus:outline-none focus:border-[#4C90F0]"
            />
          </form>

          <span className="text-[11px] font-mono text-[#8B9097]">
            Nodes: <strong className="text-[#E6E7E9]">{internalGraph?.nodes.length || 0}</strong> • Edges: <strong className="text-[#8B9097]">{internalGraph?.edges.length || 0}</strong>
          </span>
        </div>

        {/* Center/Right Controls */}
        <div className="flex items-center gap-1.5">
          {/* Hop Expansion Buttons */}
          {selectedEntityId && (
            <div className="flex items-center gap-1 bg-[#1C1E21] p-0.5 rounded border border-[#26292D]">
              <button
                onClick={() => handleExpandNode(1)}
                disabled={loading}
                className="px-2 py-0.5 text-[10px] font-mono text-[#4C90F0] hover:bg-[#26292D] rounded transition"
                title="Expand selected entity by 1 Hop"
              >
                +1 HOP
              </button>
              <button
                onClick={() => handleExpandNode(2)}
                disabled={loading}
                className="px-2 py-0.5 text-[10px] font-mono text-[#4C90F0] hover:bg-[#26292D] rounded transition"
                title="Expand selected entity by 2 Hops"
              >
                +2 HOPS
              </button>
            </div>
          )}

          {/* Layout Selector */}
          <select
            value={currentLayout}
            onChange={(e) => setCurrentLayout(e.target.value)}
            className="bg-[#1C1E21] border border-[#26292D] rounded px-2 py-1 text-[11px] font-mono text-[#E6E7E9] focus:outline-none focus:border-[#4C90F0]"
          >
            <option value="cose">Force (COSE)</option>
            <option value="concentric">Concentric (Risk)</option>
            <option value="breadthfirst">Hierarchy Tree</option>
            <option value="circle">Circular</option>
          </select>

          {/* Shortest Path Finder Trigger */}
          <button
            onClick={() => setIsPathModalOpen(true)}
            className="p-1.5 rounded bg-[#1C1E21] hover:bg-[#26292D] border border-[#26292D] text-[#F5A524] transition"
            title="Find Shortest Path between entities"
          >
            <Route className="w-3.5 h-3.5" />
          </button>

          {/* View Controls */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-[#1C1E21] hover:bg-[#26292D] border border-[#26292D] text-[#8B9097] hover:text-[#E6E7E9] transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-[#1C1E21] hover:bg-[#26292D] border border-[#26292D] text-[#8B9097] hover:text-[#E6E7E9] transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 rounded bg-[#1C1E21] hover:bg-[#26292D] border border-[#26292D] text-[#8B9097] hover:text-[#E6E7E9] transition"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Cytoscape Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full min-h-[300px] cursor-grab active:cursor-grabbing bg-[#0E0F11]" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#151618] border border-[#26292D] text-[#4C90F0] text-xs font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#4C90F0]" />
            <span>Traversing graph topology...</span>
          </div>
        </div>
      )}

      {/* Legend */}
      {!isCompact && (
        <div className="absolute bottom-2 left-2 p-2 rounded bg-[#151618]/95 border border-[#26292D] backdrop-blur-xs z-10 flex flex-wrap items-center gap-3 text-[10px] font-mono text-[#8B9097]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F5A524]"></span> Company
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4C90F0]"></span> Person
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4C90F0]"></span> Vehicle
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B9097]"></span> Shipment
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3DB46D]"></span> Warehouse
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-[#E5484D] bg-transparent"></span> High Risk
          </span>
        </div>
      )}

      {/* Shortest Path Modal */}
      {isPathModalOpen && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-30">
          <div className="w-full max-w-md p-4 rounded bg-[#151618] border border-[#26292D] shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#26292D] pb-2">
              <div className="flex items-center gap-2 text-[#E6E7E9] font-medium">
                <Route className="w-4 h-4 text-[#4C90F0]" />
                <span>Shortest Path Traversal</span>
              </div>
              <button
                onClick={() => setIsPathModalOpen(false)}
                className="text-[#8B9097] hover:text-[#E6E7E9]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#8B9097] block mb-1">Source Entity ID</label>
                <input
                  type="text"
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  className="w-full bg-[#1C1E21] border border-[#26292D] rounded p-2 text-[#E6E7E9] focus:outline-none focus:border-[#4C90F0]"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#8B9097] block mb-1">Target Entity ID</label>
                <input
                  type="text"
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  className="w-full bg-[#1C1E21] border border-[#26292D] rounded p-2 text-[#E6E7E9] focus:outline-none focus:border-[#4C90F0]"
                />
              </div>

              <button
                onClick={handleFindShortestPath}
                className="w-full py-2 bg-[#4C90F0] hover:bg-[#3A7FE0] text-white font-medium rounded transition"
              >
                Find Shortest Path
              </button>

              {pathResult && (
                <div className="p-3 rounded bg-[#1C1E21] border border-[#26292D] space-y-2">
                  <div className="text-[10px] text-[#8B9097] uppercase">
                    Path Result ({pathResult.path?.length || 0} Hops)
                  </div>
                  {pathResult.path && pathResult.path.length > 0 ? (
                    <div className="space-y-1">
                      {pathResult.path.map((nodeId: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-[#E6E7E9]">
                          <span className="text-[#4C90F0] font-bold">{idx + 1}.</span>
                          <span className="text-[#E6E7E9]">{nodeId}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#E5484D]">No reachable path discovered within 4 hops.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
