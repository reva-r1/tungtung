import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { EntityGraph } from '../graph/EntityGraph';
import { TacticalMap } from '../map/TacticalMap';
import { Entity, GraphData, LocationRecord } from '../../types';
import {
  Crosshair,
  Search,
  Network,
  MapPin,
  FileText,
  Bot,
  AlertTriangle,
  Send,
  Sparkles,
  Layers,
  Building2,
  Users,
  Truck,
  Package,
  Warehouse,
  ChevronRight,
  Shield,
  Activity,
  Plus
} from 'lucide-react';

export const InvestigationWorkspace: React.FC = () => {
  const {
    selectedEntityId,
    selectedEntity,
    selectEntity,
    quickNavigateToEntity,
    activeInvestigation,
    activeNlResult,
    isMapEnabled,
    toggleMap,
  } = useInvestigation();

  const [entitiesList, setEntitiesList] = useState<Entity[]>([]);
  const [explorerSearch, setExplorerSearch] = useState<string>('');
  const [profileData, setProfileData] = useState<any | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [rightTab, setRightTab] = useState<'dossier' | 'ai' | 'anomalies'>('dossier');

  // AI Assistant in right pane
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<any | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Notes
  const [newNote, setNewNote] = useState<string>('');

  useEffect(() => {
    api.searchEntities({ limit: 50 }).then(setEntitiesList).catch(console.error);
    api.getLocations().then(setLocations).catch(console.error);
  }, []);

  // When selected entity changes, load deep profile & neighborhood graph
  useEffect(() => {
    if (!selectedEntityId) return;

    api.getEntityProfile(selectedEntityId).then((res) => {
      setProfileData(res);
      if (res && res.subgraph) {
        setGraphData(res.subgraph);
      }
    }).catch(console.error);
  }, [selectedEntityId]);

  // When active natural language query results are set
  useEffect(() => {
    if (activeNlResult) {
      if (activeNlResult.graph) setGraphData(activeNlResult.graph);
      if (activeNlResult.locations) setLocations(activeNlResult.locations);
      if (activeNlResult.aiBriefing) {
        setAiResponse(activeNlResult.aiBriefing);
        setRightTab('ai');
      }
    }
  }, [activeNlResult]);

  const handleAskAi = async (customPrompt?: string) => {
    const promptToSend = customPrompt || aiPrompt;
    if (!promptToSend.trim()) return;

    setIsAiLoading(true);
    setRightTab('ai');
    try {
      const result = await api.investigateAi(promptToSend, selectedEntityId || undefined, activeInvestigation?.id);
      setAiResponse(result);
      setAiPrompt('');
    } catch (err) {
      console.error('AI query error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredExplorerEntities = entitiesList.filter((e) =>
    !explorerSearch ||
    e.name.toLowerCase().includes(explorerSearch.toLowerCase()) ||
    e.type.toLowerCase().includes(explorerSearch.toLowerCase()) ||
    e.id.toLowerCase().includes(explorerSearch.toLowerCase())
  );

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'COMPANY': return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'PERSON': return <Users className="w-3.5 h-3.5 text-blue-400" />;
      case 'VEHICLE': return <Truck className="w-3.5 h-3.5 text-cyan-400" />;
      case 'SHIPMENT': return <Package className="w-3.5 h-3.5 text-purple-400" />;
      case 'WAREHOUSE': return <Warehouse className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090d16] overflow-hidden">
      {/* Top Docket Bar */}
      <div className="h-10 bg-[#0b1120] border-b border-[#1e293b] flex items-center justify-between px-4 text-xs font-mono shrink-0">
        <div className="flex items-center gap-3">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200">WORKSPACE:</span>
          <span className="text-cyan-400 font-semibold">
            {activeInvestigation ? activeInvestigation.title : 'General Intelligence Grid'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">FOCUS ENTITY:</span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
            {selectedEntity?.name || selectedEntityId || 'None Selected'}
          </span>
        </div>
      </div>

      {/* Main Multi-Pane Body */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Pane: Entity Explorer & Hop Tree */}
        <div className="w-64 bg-[#0b1120] border-r border-[#1e293b] flex flex-col shrink-0">
          <div className="p-2.5 border-b border-[#1e293b] space-y-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
              ENTITY EXPLORER
            </span>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                placeholder="Filter entities..."
                className="w-full bg-[#090d16] border border-[#1e293b] rounded pl-8 pr-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredExplorerEntities.map((ent) => {
              const isSelected = ent.id === selectedEntityId;
              return (
                <button
                  key={ent.id}
                  onClick={() => selectEntity(ent.id)}
                  className={`w-full text-left p-2 rounded flex items-center justify-between text-xs font-mono transition border ${
                    isSelected
                      ? 'bg-cyan-950/60 text-cyan-200 border-cyan-500/50 shadow-sm'
                      : 'hover:bg-[#1e293b]/60 text-slate-300 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {getEntityIcon(ent.type)}
                    <div className="truncate">
                      <div className="truncate font-semibold text-slate-200 text-[11px]">{ent.name}</div>
                      <div className="text-[9px] text-slate-400">{ent.type}</div>
                    </div>
                  </div>
                  {ent.riskScore !== undefined && ent.riskScore > 60 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                      {ent.riskScore}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center Panes: Graph (Top) & Map (Bottom) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Center Top: Interactive Cytoscape Graph */}
          <div className="flex-1 p-2 min-h-[320px]">
            <EntityGraph graphData={graphData} />
          </div>

          {/* Center Bottom: Geospatial Radar Map / Pure Data Mode */}
          {isMapEnabled ? (
            <div className="h-[340px] border-t border-[#1e293b] flex flex-col p-2 bg-[#090d16]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold border bg-cyan-950/60 text-cyan-300 border-cyan-500/50">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>GEOSPATIAL RADAR (MAP ACTIVE)</span>
                </div>
                <button
                  onClick={toggleMap}
                  className="px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-white bg-[#1e293b] hover:bg-[#334155] rounded border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3 h-3 text-cyan-400" />
                  <span>Turn Map OFF (Full Graph Data Mode)</span>
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                <TacticalMap locations={locations} />
              </div>
            </div>
          ) : (
            <div className="h-10 border-t border-[#1e293b] bg-[#090d16] px-4 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span className="text-slate-300 font-medium">Map is OFF</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-400">Pure Graph & Data Mode Active ({locations.length} geospatial records loaded)</span>
              </div>
              <button
                onClick={toggleMap}
                className="px-3 py-1 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/60 rounded border border-cyan-700/60 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Turn Map ON</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Pane: Entity Dossier Inspector & Grok AI Analyst */}
        <div className="w-96 bg-[#0b1120] border-l border-[#1e293b] flex flex-col shrink-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b border-[#1e293b] p-1 bg-[#090d16] text-xs font-mono">
            <button
              onClick={() => setRightTab('dossier')}
              className={`flex-1 py-1.5 text-center font-bold rounded transition ${
                rightTab === 'dossier' ? 'bg-[#0f172a] text-cyan-300 border border-[#1e293b]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DOSSIER
            </button>
            <button
              onClick={() => setRightTab('ai')}
              className={`flex-1 py-1.5 text-center font-bold rounded transition flex items-center justify-center gap-1 ${
                rightTab === 'ai' ? 'bg-[#0f172a] text-cyan-300 border border-[#1e293b]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI ANALYST</span>
            </button>
            <button
              onClick={() => setRightTab('anomalies')}
              className={`flex-1 py-1.5 text-center font-bold rounded transition ${
                rightTab === 'anomalies' ? 'bg-[#0f172a] text-rose-300 border border-[#1e293b]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              THREATS ({profileData?.anomalies?.length || 0})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
            {rightTab === 'dossier' && (
              <>
                {selectedEntity ? (
                  <div className="space-y-4">
                    {/* Header Card */}
                    <div className="p-3.5 rounded bg-[#0f172a] border border-[#1e293b] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                          {selectedEntity.type}
                        </span>
                        <span className="text-[10px] text-slate-400">{selectedEntity.id}</span>
                      </div>
                      <h2 className="text-sm font-bold text-white">{selectedEntity.name}</h2>
                      {selectedEntity.summary && (
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {selectedEntity.summary}
                        </p>
                      )}
                    </div>

                    {/* Quick AI Questions */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        AI QUICK INVESTIGATION
                      </span>
                      <div className="space-y-1">
                        <button
                          onClick={() => handleAskAi(`Analyze all direct and indirect risks for ${selectedEntity.name}`)}
                          className="w-full text-left p-1.5 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] text-[11px] text-cyan-300 transition flex items-center justify-between"
                        >
                          <span>Analyze risk vectors & connections</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleAskAi(`Summarize timeline and physical movements for ${selectedEntity.name}`)}
                          className="w-full text-left p-1.5 rounded bg-[#090d16] hover:bg-[#1e293b] border border-[#1e293b] text-[11px] text-cyan-300 transition flex items-center justify-between"
                        >
                          <span>Summarize 72h movement history</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Properties Grid */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">KEY ATTRIBUTES</span>
                      <div className="p-2.5 rounded bg-[#090d16] border border-[#1e293b] space-y-1.5">
                        {Object.entries(selectedEntity.properties || {}).map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between text-[11px] border-b border-[#1e293b]/50 pb-1">
                            <span className="text-slate-400 capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                            <span className="text-slate-200 font-semibold text-right max-w-[180px] truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Relationships List */}
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">
                        CONNECTED ENTITIES ({profileData?.relationships?.length || 0})
                      </span>
                      <div className="space-y-1.5">
                        {profileData?.relationships?.map((rel: any) => {
                          const isTarget = rel.source_id === selectedEntity.id;
                          const otherName = isTarget ? rel.target_name : rel.source_name;
                          const otherId = isTarget ? rel.target_id : rel.source_id;
                          const otherType = isTarget ? rel.target_type : rel.source_type;

                          return (
                            <div
                              key={rel.id}
                              onClick={() => selectEntity(otherId)}
                              className="p-2 rounded bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] flex items-center justify-between cursor-pointer transition"
                            >
                              <div>
                                <span className="text-[9px] font-bold text-cyan-400">{rel.type}</span>
                                <div className="text-[11px] font-semibold text-slate-200">{otherName}</div>
                              </div>
                              <span className="text-[9px] text-slate-400">{otherType}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">Select an entity in the graph or explorer to inspect dossier.</div>
                )}
              </>
            )}

            {rightTab === 'ai' && (
              <div className="space-y-4">
                {/* AI Query Input */}
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder={`Ask Grok AI about ${selectedEntity?.name || 'this investigation'}...`}
                      rows={3}
                      className="w-full bg-[#090d16] border border-[#1e293b] rounded p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
                    />
                    <button
                      onClick={() => handleAskAi()}
                      disabled={isAiLoading || !aiPrompt.trim()}
                      className="absolute right-2 bottom-2 px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-xs font-bold rounded flex items-center gap-1 transition disabled:opacity-40"
                    >
                      <Send className="w-3 h-3" />
                      <span>{isAiLoading ? 'THINKING...' : 'RUN'}</span>
                    </button>
                  </div>
                </div>

                {/* AI Grounded Synthesis Display */}
                {aiResponse && (
                  <div className="space-y-3">
                    {/* Known Facts */}
                    <div className="p-3 rounded bg-[#0f172a] border border-cyan-500/30 space-y-1.5">
                      <div className="text-[10px] font-bold text-cyan-400 uppercase flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>VERIFIED KNOWN FACTS</span>
                      </div>
                      <ul className="space-y-1">
                        {aiResponse.knownFacts?.map((fact: string, idx: number) => (
                          <li key={idx} className="text-[11px] text-slate-300 pl-2 border-l-2 border-cyan-400">
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* AI Interpretation */}
                    <div className="p-3 rounded bg-[#0f172a] border border-[#1e293b] space-y-1">
                      <div className="text-[10px] font-bold text-purple-400 uppercase">
                        AI ANALYST ASSESSMENT & HYPOTHESIS
                      </div>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        {aiResponse.aiInterpretation}
                      </p>
                    </div>

                    {/* Uncertainty & Telemetry Gaps */}
                    {aiResponse.uncertainty && (
                      <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-200 space-y-1">
                        <div className="text-[10px] font-bold uppercase text-amber-400">UNCERTAINTY / GAPS</div>
                        <p>{aiResponse.uncertainty}</p>
                      </div>
                    )}

                    {/* Recommended Actions */}
                    {aiResponse.recommendedActions && aiResponse.recommendedActions.length > 0 && (
                      <div className="p-3 rounded bg-[#0f172a] border border-[#1e293b] space-y-1.5">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase">
                          RECOMMENDED TACTICAL ACTIONS
                        </div>
                        <ul className="space-y-1">
                          {aiResponse.recommendedActions.map((act: string, idx: number) => (
                            <li key={idx} className="text-[11px] text-slate-300 pl-2 border-l-2 border-emerald-400">
                              {act}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {rightTab === 'anomalies' && (
              <div className="space-y-3">
                {profileData?.anomalies?.length > 0 ? (
                  profileData.anomalies.map((anom: any) => (
                    <div key={anom.id} className="p-3 rounded bg-rose-950/20 border border-rose-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-400">{anom.type}</span>
                        <span className="text-[10px] text-slate-400">{anom.severity}</span>
                      </div>
                      <h4 className="font-bold text-white text-xs">{anom.title}</h4>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{anom.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400">No active threat anomalies recorded for this entity.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
