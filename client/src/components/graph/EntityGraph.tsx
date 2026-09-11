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
            'color': '#f8fafc',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
            'text-background-color': '#090d16',
            'text-background-opacity': 0.85,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'width': 36,
            'height': 36,
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#22d3ee',
            'border-width': 5,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.8,
            'line-color': 'data(lineColor)',
            'target-arrow-color': 'data(lineColor)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '8px',
            'color': '#94a3b8',
            'text-background-color': '#0b1120',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
            'text-rotation': 'autorotate',
            'arrow-scale': 0.8,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#22d3ee',
            'target-arrow-color': '#22d3ee',
            'width': 3,
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
    <div className={`relative flex flex-col h-full bg-[#090d16] border border-[#1e293b] rounded-lg overflow-hidden ${className}`}>
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#0b1120] border-b border-[#1e293b] z-10 shrink-0">
        {/* Left: Search & Node Count */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleSearchNode} className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find in graph..."
              className="w-36 sm:w-44 bg-[#090d16] border border-[#1e293b] rounded px-2.5 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </form>

          <span className="text-[11px] font-mono text-slate-400">
            Nodes: <strong className="text-cyan-400">{internalGraph?.nodes.length || 0}</strong> • Edges: <strong className="text-blue-400">{internalGraph?.edges.length || 0}</strong>
          </span>
        </div>

        {/* Center/Right Controls */}
        <div className="flex items-center gap-1.5">
          {/* Hop Expansion Buttons */}
          {selectedEntityId && (
            <div className="flex items-center gap-1 bg-[#090d16] p-0.5 rounded border border-[#1e293b]">
              <button
                onClick={() => handleExpandNode(1)}
                disabled={loading}
                className="px-2 py-0.5 text-[10px] font-mono text-cyan-300 hover:bg-cyan-950/60 rounded transition"
                title="Expand selected entity by 1 Hop"
              >
                +1 HOP
              </button>
              <button
                onClick={() => handleExpandNode(2)}
                disabled={loading}
                className="px-2 py-0.5 text-[10px] font-mono text-cyan-300 hover:bg-cyan-950/60 rounded transition"
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
            className="bg-[#090d16] border border-[#1e293b] rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="cose">Force (COSE)</option>
            <option value="concentric">Concentric (Risk)</option>
            <option value="breadthfirst">Hierarchy Tree</option>
            <option value="circle">Circular</option>
          </select>

          {/* Shortest Path Finder Trigger */}
          <button
            onClick={() => setIsPathModalOpen(true)}
            className="p-1.5 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] text-amber-400 hover:text-amber-300 transition"
            title="Find Shortest Path between entities"
          >
            <Route className="w-3.5 h-3.5" />
          </button>

          {/* View Controls */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] text-slate-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] text-slate-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFit}
            className="p-1.5 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] text-slate-300 transition"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Cytoscape Canvas */}
      <div ref={containerRef} className="flex-1 w-full h-full min-h-[300px] cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="flex items-center gap-2 px-4 py-2 rounded bg-[#0b1120] border border-cyan-500/40 text-cyan-300 text-xs font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>TRAVERSING GRAPH TOPOLOGY...</span>
          </div>
        </div>
      )}

      {/* Legend */}
      {!isCompact && (
        <div className="absolute bottom-2 left-2 p-2 rounded bg-[#0b1120]/90 border border-[#1e293b] backdrop-blur-xs z-10 flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span> Company
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></span> Person
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></span> Vehicle
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]"></span> Shipment
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span> Warehouse
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-rose-500 bg-transparent"></span> High Risk Ring
          </span>
        </div>
      )}

      {/* Shortest Path Modal */}
      {isPathModalOpen && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-30">
          <div className="w-full max-w-md p-4 rounded-lg bg-[#0b1120] border border-amber-500/50 shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Route className="w-4 h-4" />
                <span>SHORTEST PATH DISCOVERY ENGINE</span>
              </div>
              <button
                onClick={() => setIsPathModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">SOURCE ENTITY ID</label>
                <input
                  type="text"
                  value={pathSource}
                  onChange={(e) => setPathSource(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">TARGET ENTITY ID</label>
                <input
                  type="text"
                  value={pathTarget}
                  onChange={(e) => setPathTarget(e.target.value)}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded p-2 text-slate-200"
                />
              </div>

              <button
                onClick={handleFindShortestPath}
                className="w-full py-2 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/60 text-amber-200 font-bold rounded transition"
              >
                EXECUTE DIJKSTRA TRAVERSAL
              </button>

              {pathResult && (
                <div className="p-3 rounded bg-[#090d16] border border-[#1e293b] space-y-2">
                  <div className="text-[10px] text-slate-400 uppercase">
                    Path Result ({pathResult.path?.length || 0} Hops)
                  </div>
                  {pathResult.path && pathResult.path.length > 0 ? (
                    <div className="space-y-1">
                      {pathResult.path.map((nodeId: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-300">
                          <span className="text-amber-400 font-bold">{idx + 1}.</span>
                          <span className="text-cyan-300">{nodeId}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-rose-400">No reachable path discovered within 4 hops.</div>
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
