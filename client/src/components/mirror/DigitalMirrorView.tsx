import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useInvestigation } from '../../context/InvestigationContext';
import {
  Globe,
  Radio,
  Zap,
  CloudRain,
  Wind,
  Droplets,
  Activity,
  Sliders,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  Layers,
  Sparkles,
  Server,
  FileText,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet standard icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Map resize trigger for Leaflet inside flex layouts
const MapResizer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// Custom markers for distinct category distinction
const createCustomIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 26px; height: 26px; border-radius: 50%; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; box-shadow: 0 0 10px ${color};">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

export const DigitalMirrorView: React.FC = () => {
  const { isMapEnabled, toggleMap } = useInvestigation();
  const [mode, setMode] = useState<'LIVE' | 'SIMULATION'>('LIVE');
  const [mapLayer, setMapLayer] = useState<'DARK' | 'SATELLITE' | 'STREET'>('DARK');
  const [loading, setLoading] = useState(false);
  const [worldState, setWorldState] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'entities' | 'relationships' | 'temporal' | 'events' | 'providers' | 'simulations'>('entities');
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Simulation State
  const [simulations, setSimulations] = useState<any[]>([]);
  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [simState, setSimState] = useState<any>(null);
  const [simRainfall, setSimRainfall] = useState(75);
  const [simRoadCapacity, setSimRoadCapacity] = useState(50);
  const [simWaterLevel, setSimWaterLevel] = useState(73.5);
  const [newSimName, setNewSimName] = useState('South Bangalore Deluge & Grid Stress');

  // Load Initial World State
  const loadWorld = async () => {
    setLoading(true);
    try {
      const state = await api.getWorldState();
      setWorldState(state);
      const provRes = await api.getProviderStatus();
      setProviders(provRes.providers || []);
      const simList = await api.listSimulations();
      setSimulations(simList);
      if (simList.length > 0 && !activeSimId) {
        setActiveSimId(simList[0].id);
      }
    } catch (err) {
      console.error('Failed to load world state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorld();
    const interval = setInterval(loadWorld, 20000); // 20s live refresh
    return () => clearInterval(interval);
  }, []);

  // Sync Live External Sensor APIs
  const handleSyncAll = async () => {
    setLoading(true);
    try {
      await api.syncAllProviders();
      await loadWorld();
    } catch (err) {
      console.error('Failed to trigger sync:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create Simulation Sandbox
  const handleCreateSimulation = async () => {
    if (!newSimName.trim()) return;
    setLoading(true);
    try {
      const created = await api.createSimulation(newSimName, 'User-initiated stress testing twin');
      await api.modifySimulation(created.id, [
        {
          entity_id: 'ROAD_CORRIDOR_NH48',
          properties: { road_capacity: simRoadCapacity, status: 'RESTRICTED_FLOW' },
        },
        {
          entity_id: 'STATION_1297_7759',
          properties: { precipitation_mm: simRainfall, weather_condition: 'HEAVY_MONSOON_DELUGE' },
        },
        {
          entity_id: 'HYDRO_GAUGE_BELLANDUR_OUTLET_WEIR',
          properties: { water_level_m: simWaterLevel, sluice_status: 'DISCHARGING' },
        }
      ]);
      const simList = await api.listSimulations();
      setSimulations(simList);
      setActiveSimId(created.id);
      const state = await api.getSimulationState(created.id);
      setSimState(state);
      setMode('SIMULATION');
    } catch (err) {
      console.error('Error creating simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Switch / Load Simulation State
  useEffect(() => {
    if (mode === 'SIMULATION' && activeSimId) {
      api.getSimulationState(activeSimId)
        .then(res => setSimState(res))
        .catch(err => console.error('Failed to load simulation state:', err));
    }
  }, [mode, activeSimId]);

  // Apply Changes to Simulation
  const handleApplySimulation = async () => {
    if (!activeSimId) return;
    setLoading(true);
    try {
      await api.modifySimulation(activeSimId, [
        {
          entity_id: 'ROAD_CORRIDOR_NH48',
          properties: { road_capacity: simRoadCapacity },
        },
        {
          entity_id: 'STATION_1297_7759',
          properties: { precipitation_mm: simRainfall },
        },
        {
          entity_id: 'HYDRO_GAUGE_BELLANDUR_OUTLET_WEIR',
          properties: { water_level_m: simWaterLevel },
        }
      ]);
      const state = await api.getSimulationState(activeSimId);
      setSimState(state);
    } catch (err) {
      console.error('Error updating simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset Simulation back to Live Baseline
  const handleResetSimulation = async () => {
    if (!activeSimId) return;
    setLoading(true);
    try {
      await api.resetSimulation(activeSimId);
      const state = await api.getSimulationState(activeSimId);
      setSimState(state);
      setSimRainfall(12);
      setSimRoadCapacity(100);
      setSimWaterLevel(68);
    } catch (err) {
      console.error('Error resetting simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Determine active entities based on LIVE vs SIMULATION mode
  const displayedEntities = mode === 'SIMULATION' && simState?.entities
    ? simState.entities
    : (worldState?.entities || []);

  const displayedEvents = mode === 'SIMULATION' && simState?.cascading_events
    ? [...simState.cascading_events, ...(worldState?.active_events || [])]
    : (worldState?.active_events || []);

  const filteredEntities = displayedEntities.filter((e: any) => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || e.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = Array.from(new Set(displayedEntities.map((e: any) => e.category)));

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070b12] text-slate-200 overflow-hidden font-sans">
      {/* Top Banner: Mode & Telemetry Header */}
      <header className="h-14 border-b border-slate-800 bg-[#0b111e] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-sm tracking-wider uppercase text-slate-100">
              Live Digital Mirror & World Model
            </span>
          </div>
          <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400 font-mono">
            Karnataka & South-West Transit Corridor (12.97° N, 77.59° E)
          </span>
        </div>

        {/* Center: Live Mode vs Simulation Mode Switcher */}
        <div className="flex items-center gap-2 bg-[#060911] p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setMode('LIVE')}
            className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-semibold transition ${
              mode === 'LIVE'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            LIVE WORLD MODE
          </button>
          <button
            onClick={() => setMode('SIMULATION')}
            className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-semibold transition ${
              mode === 'SIMULATION'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            SIMULATION TWIN MODE
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {mode === 'LIVE' && (
            <button
              onClick={handleSyncAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Poll External Sensors
            </button>
          )}
          {mode === 'SIMULATION' && (
            <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1 rounded">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>ISOLATED SANDBOX (Zero Live Contamination)</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace: Left Dock & Right Map */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control & Inspector Dock */}
        <div className="w-[480px] border-r border-slate-800 bg-[#090e18] flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 bg-[#080d16] px-2 pt-2 gap-1 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab('entities')}
              className={`px-3 py-1.5 rounded-t font-medium border-t border-x transition flex items-center gap-1.5 ${
                activeTab === 'entities'
                  ? 'bg-[#090e18] text-cyan-400 border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Entities ({filteredEntities.length})
            </button>
            <button
              onClick={() => setActiveTab('relationships')}
              className={`px-3 py-1.5 rounded-t font-medium border-t border-x transition flex items-center gap-1.5 ${
                activeTab === 'relationships'
                  ? 'bg-[#090e18] text-cyan-400 border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Inferred ({worldState?.relationships?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 rounded-t font-medium border-t border-x transition flex items-center gap-1.5 ${
                activeTab === 'events'
                  ? 'bg-[#090e18] text-cyan-400 border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Events ({displayedEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('temporal')}
              className={`px-3 py-1.5 rounded-t font-medium border-t border-x transition flex items-center gap-1.5 ${
                activeTab === 'temporal'
                  ? 'bg-[#090e18] text-cyan-400 border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Ledger
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-3 py-1.5 rounded-t font-medium border-t border-x transition flex items-center gap-1.5 ${
                activeTab === 'providers'
                  ? 'bg-[#090e18] text-cyan-400 border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              Sensors ({providers.length})
            </button>
            {mode === 'SIMULATION' && (
              <button
                onClick={() => setActiveTab('simulations')}
                className={`px-3 py-1.5 rounded-t font-medium border-t border-x transition flex items-center gap-1.5 ${
                  activeTab === 'simulations'
                    ? 'bg-[#090e18] text-amber-400 border-slate-700'
                    : 'text-amber-500 hover:text-amber-300 border-transparent'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Twin Controls
              </button>
            )}
          </div>

          {/* Tab 1: Entities Explorer */}
          {activeTab === 'entities' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Filter world entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-[#05080f] border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-[#05080f] border border-slate-800 rounded px-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c: any) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Entity List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredEntities.map((ent: any) => {
                  const isSim = ent.is_simulated;
                  return (
                    <div
                      key={ent.id}
                      onClick={() => setSelectedEntity(ent)}
                      className={`p-2.5 rounded border transition cursor-pointer text-xs ${
                        selectedEntity?.id === ent.id
                          ? 'border-cyan-500 bg-cyan-950/20'
                          : isSim
                          ? 'border-amber-700/60 bg-amber-950/15 hover:border-amber-600'
                          : 'border-slate-800 bg-[#070b13] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isSim ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          <span className="font-semibold text-slate-100">{ent.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isSim && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                              SIMULATED
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            {ent.category}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 my-1">
                        <div>Lat: {ent.latitude?.toFixed(4)}, Lon: {ent.longitude?.toFixed(4)}</div>
                        <div className="text-right text-slate-500 font-mono">Source: {ent.last_provider}</div>
                      </div>

                      {/* Display Key Telemetry */}
                      <div className="mt-1 pt-1 border-t border-slate-800/80 flex flex-wrap gap-2 text-[10px]">
                        {Object.entries(ent.current_state).slice(0, 4).map(([k, v]) => (
                          <div key={k} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            <span className="text-slate-500">{k}:</span>{' '}
                            <span className={isSim ? 'text-amber-300 font-bold' : 'text-slate-200'}>
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Inferred Relationships & Evidence */}
          {activeTab === 'relationships' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
              <div className="bg-blue-950/20 border border-blue-800/40 rounded p-2 text-slate-300">
                <span className="font-semibold text-blue-300 block mb-0.5">Strict Evidence Requirement</span>
                Relationships are mathematically inferred across spatial corridors, airport geofences, and river catchments. Inferred links always carry timestamp, source, and concrete physical evidence.
              </div>

              {worldState?.relationships?.map((rel: any) => (
                <div key={rel.relationship_id} className="p-3 rounded border border-slate-800 bg-[#070b13]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-cyan-400 text-[11px] font-semibold">{rel.relationship_type}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                      Confidence: {(rel.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300 mb-2 font-mono text-[11px]">
                    <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{rel.source_entity_id}</span>
                    <span>→</span>
                    <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{rel.target_entity_id}</span>
                  </div>

                  <div className="text-[10px] text-slate-400 mb-1">
                    <span className="text-slate-500">Inference Engine:</span> {rel.source}
                  </div>

                  <div className="bg-[#05080e] p-2 rounded border border-slate-850">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Evidence Trail:
                    </span>
                    <ul className="list-disc pl-3 text-[10px] text-slate-300 space-y-0.5">
                      {rel.evidence?.map((ev: string, idx: number) => (
                        <li key={idx}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Detected Events */}
          {activeTab === 'events' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
              <div className="text-slate-400 text-[11px] mb-1">
                Displaying real-world state transitions and threshold crossing triggers.
              </div>

              {displayedEvents.map((evt: any) => (
                <div key={evt.event_id} className="p-2.5 rounded border border-slate-800 bg-[#070b13]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-100">{evt.event_type}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      evt.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : evt.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {evt.severity}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 mb-1">
                    Entity: <span className="font-mono text-cyan-300">{evt.entity_id}</span>
                  </div>

                  <div className="bg-[#05080e] p-2 rounded text-[10px] font-mono text-slate-300 border border-slate-800">
                    <div className="text-slate-500">Current State:</div>
                    <div className="text-emerald-400">{JSON.stringify(evt.current_state)}</div>
                  </div>

                  <div className="mt-1 text-[10px] text-slate-500 flex justify-between">
                    <span>Source: {evt.source}</span>
                    <span>{new Date(evt.detected_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 4: Temporal Ledger */}
          {activeTab === 'temporal' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
              <div className="bg-slate-900 p-2 rounded border border-slate-800 text-[11px] text-slate-400">
                Preserves non-destructive chronological observations. Reconstructs state evolution over time.
              </div>
              <div className="text-slate-400 text-xs">
                Total Historical Transitions Recorded: <span className="text-cyan-400 font-bold">{worldState?.recent_changes_count || 0}</span>
              </div>
              <button
                onClick={async () => {
                  const changes = await api.getWorldChanges(60);
                  alert(`Retrieved ${changes.count} state transitions during the last 60 minutes.`);
                }}
                className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Inspect Past 60 Minutes Ledger
              </button>
            </div>
          )}

          {/* Tab 5: Providers & Licensing Matrix */}
          {activeTab === 'providers' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
              <div className="text-[11px] text-slate-400 mb-1">
                Every provider declares coverage, update frequency, legal license, and rate limits.
              </div>

              {providers.map((p: any) => (
                <div key={p.id} className="p-2.5 rounded border border-slate-800 bg-[#070b13]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-100">{p.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      p.health?.status === 'HEALTHY' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {p.health?.status || 'HEALTHY'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 my-1">
                    <div>Coverage: <span className="text-slate-200 capitalize">{p.coverage}</span></div>
                    <div>Frequency: <span className="text-slate-200 capitalize">{p.update_frequency}</span></div>
                    <div>Auth: <span className="text-slate-200 uppercase">{p.authentication}</span></div>
                    <div>Latency: <span className="text-cyan-300 font-mono">{p.health?.latencyMs || 0}ms</span></div>
                  </div>

                  <div className="bg-[#05080e] p-1.5 rounded border border-slate-850 mt-1 text-[10px]">
                    <div className="text-slate-400">
                      License: <span className="text-emerald-400 font-medium">{p.legal?.license}</span>
                    </div>
                    <div className="text-slate-500 truncate">
                      {p.legal?.attribution}
                    </div>
                    {p.legal?.termsUrl && (
                      <a
                        href={p.legal.termsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        Terms & Rate Limits <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 6: Simulation Twin Controls */}
          {activeTab === 'simulations' && (
            <div className="flex-1 p-3 overflow-y-auto space-y-4 text-xs">
              <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-amber-200">
                <span className="font-bold block mb-1">Interactive Alternate Reality Sandbox</span>
                Modify environmental stressors and infrastructure capacity without touching the real-world live state.
              </div>

              {/* Simulation Instance Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  Active Simulation Twin
                </label>
                <select
                  value={activeSimId || ''}
                  onChange={(e) => setActiveSimId(e.target.value)}
                  className="w-full bg-[#05080f] border border-slate-800 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {simulations.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Modifiers */}
              <div className="space-y-3 bg-[#070b13] p-3 rounded border border-slate-800">
                <span className="font-bold text-slate-200 text-xs block">Perturbation Variables:</span>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Simulated Precipitation Deluge (mm):</span>
                    <span className="font-bold text-amber-400 font-mono">{simRainfall} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="150"
                    value={simRainfall}
                    onChange={(e) => setSimRainfall(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Road Corridor Capacity (%):</span>
                    <span className="font-bold text-cyan-400 font-mono">{simRoadCapacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={simRoadCapacity}
                    onChange={(e) => setSimRoadCapacity(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Reservoir Water Stage (m):</span>
                    <span className="font-bold text-rose-400 font-mono">{simWaterLevel} m</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="80"
                    step="0.5"
                    value={simWaterLevel}
                    onChange={(e) => setSimWaterLevel(Number(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleApplySimulation}
                    disabled={loading}
                    className="flex-1 py-2 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Apply & Evaluate Cascades
                  </button>
                  <button
                    onClick={handleResetSimulation}
                    disabled={loading}
                    className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition flex items-center justify-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
              </div>

              {/* Cascade Impact Results */}
              {simState?.impact_analysis && (
                <div className="bg-[#05080e] p-3 rounded border border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">Cascading Impact Assessment:</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {simState.impact_analysis.risk_escalation}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    <span className="text-slate-500">Affected Corridors:</span>{' '}
                    {simState.impact_analysis.affected_corridors?.join(', ') || 'None'}
                  </div>
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Evidence Behind Detected Impacts:</span>
                    <ul className="list-disc pl-3 text-[10px] text-slate-300 space-y-1">
                      {simState.impact_analysis.evidence?.map((ev: string, idx: number) => (
                        <li key={idx}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Dock: Interactive Geospatial Mirror Map & Dossier / Data Grid */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#060910]">
          {/* Header Controls Bar */}
          <div className="h-10 px-3 bg-[#090e18] border-b border-slate-800 flex items-center justify-between z-10 shrink-0 select-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-slate-200">
                {isMapEnabled ? 'GEOSPATIAL DIGITAL MIRROR' : 'SENSOR & TELEMETRY DATA GRID'}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-[11px] font-mono text-slate-400">
                {displayedEntities.length} active nodes
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isMapEnabled && (
                <div className="flex bg-[#0d131f] border border-slate-700/80 rounded p-0.5 text-[11px] gap-1">
                  <button
                    onClick={() => setMapLayer('DARK')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      mapLayer === 'DARK' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setMapLayer('SATELLITE')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      mapLayer === 'SATELLITE' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Satellite
                  </button>
                  <button
                    onClick={() => setMapLayer('STREET')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      mapLayer === 'STREET' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Street
                  </button>
                </div>
              )}

              {/* Map Toggle Button (Default: OFF) */}
              <button
                onClick={toggleMap}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition cursor-pointer ${
                  isMapEnabled
                    ? 'bg-cyan-950/70 border-cyan-500/80 text-cyan-300'
                    : 'bg-[#141d2e] border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                }`}
                title={isMapEnabled ? 'Click to turn OFF map and switch to fast Data Mode' : 'Map is OFF (Data Mode). Click to turn ON map'}
              >
                <MapPin className={`w-3.5 h-3.5 ${isMapEnabled ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{isMapEnabled ? 'Map: ON' : 'Map: OFF (Data Mode)'}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isMapEnabled ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
              </button>
            </div>
          </div>

          {/* Body: Map View OR Pure Data Grid */}
          {isMapEnabled ? (
            <div className="flex-1 h-full w-full relative">
              <MapContainer
                center={[12.9716, 77.5946]}
                zoom={11}
                style={{ height: '100%', width: '100%', minHeight: '400px', backgroundColor: '#060910' }}
              >
                <MapResizer />
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url={
                    mapLayer === 'SATELLITE'
                      ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
                      : mapLayer === 'STREET'
                      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  }
                />

                {/* Render Entities as Map Pins */}
                {displayedEntities.map((ent: any) => {
                  if (!ent.latitude || !ent.longitude) return null;
                  const isSim = ent.is_simulated;
                  const color = isSim
                    ? '#f59e0b'
                    : ent.category === 'WEATHER'
                    ? '#38bdf8'
                    : ent.category === 'AIR_QUALITY'
                    ? '#a855f7'
                    : ent.category === 'SEISMIC'
                    ? '#ef4444'
                    : ent.category === 'HYDROLOGICAL'
                    ? '#06b6d4'
                    : ent.category === 'GRID_TELEMETRY'
                    ? '#eab308'
                    : '#10b981';

                  const label = isSim
                    ? 'SIM'
                    : ent.type.startsWith('WEATHER')
                    ? 'WX'
                    : ent.type.startsWith('AIR')
                    ? 'AQ'
                    : ent.type.startsWith('EARTH')
                    ? 'EQ'
                    : ent.type.startsWith('WATER')
                    ? 'H2O'
                    : ent.type.startsWith('ENERGY')
                    ? 'NRG'
                    : 'OBS';

                  return (
                    <React.Fragment key={ent.id}>
                      <Marker
                        position={[ent.latitude, ent.longitude]}
                        icon={createCustomIcon(color, label)}
                        eventHandlers={{
                          click: () => setSelectedEntity(ent),
                        }}
                      >
                        <Popup className="custom-popup">
                          <div className="text-xs p-1">
                            <div className="font-bold text-slate-900">{ent.name}</div>
                            <div className="text-[10px] text-slate-600">{ent.type} | {ent.category}</div>
                            {isSim && (
                              <div className="text-[10px] text-amber-700 font-bold mt-1">
                                *** SIMULATED ALTERNATE VALUE ***
                              </div>
                            )}
                            <div className="mt-1 font-mono text-[10px] bg-slate-100 p-1 rounded max-h-24 overflow-y-auto">
                              {JSON.stringify(ent.current_state, null, 2)}
                            </div>
                          </div>
                        </Popup>
                      </Marker>

                      {/* If simulated rainfall or flood risk, draw an impact circle */}
                      {isSim && (
                        <Circle
                          center={[ent.latitude, ent.longitude]}
                          radius={3500}
                          pathOptions={{
                            color: '#f59e0b',
                            fillColor: '#f59e0b',
                            fillOpacity: 0.15,
                            dashArray: '4, 4',
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </MapContainer>
            </div>
          ) : (
            /* Pure Data Telemetry Grid (Map is OFF) */
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0f18] p-3">
              {/* Alert notification about Data Mode */}
              <div className="mb-3 px-3 py-2 rounded bg-[#0f172a] border border-cyan-800/40 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-cyan-300">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Data Telemetry Mode Active • Maps disabled for direct data inspection</span>
                </div>
                <button
                  onClick={toggleMap}
                  className="px-2 py-0.5 rounded bg-cyan-900/50 hover:bg-cyan-800/60 text-cyan-300 border border-cyan-700/60 text-[11px] font-semibold transition cursor-pointer"
                >
                  Turn Map ON
                </button>
              </div>

              {/* Data Table */}
              <div className="flex-1 border border-slate-800 rounded bg-[#060910] overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0b1220] border-b border-slate-800 sticky top-0 text-slate-400 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Node / Entity</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Sensor Type</th>
                      <th className="py-2.5 px-3">Coordinates</th>
                      <th className="py-2.5 px-3">Telemetry Payload</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedEntities.map((ent: any) => {
                      const isSelected = selectedEntity?.id === ent.id;
                      return (
                        <tr
                          key={ent.id}
                          onClick={() => setSelectedEntity(ent)}
                          className={`hover:bg-slate-800/40 transition cursor-pointer ${
                            isSelected ? 'bg-cyan-950/40 border-l-2 border-l-cyan-400' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-200">{ent.name}</div>
                            <div className="text-[10px] text-slate-500">ID: {ent.id}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {ent.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                            {ent.type}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {ent.latitude?.toFixed(4)}, {ent.longitude?.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {Object.entries(ent.current_state || {}).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300"
                                >
                                  <span className="text-slate-500">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntity(ent);
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-cyan-400 hover:text-white bg-cyan-950/60 hover:bg-cyan-800/60 rounded border border-cyan-800/60 transition cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bottom Floating Dossier / Provenance Inspector if Entity is selected */}
          {selectedEntity && (
            <div className="absolute bottom-4 left-4 right-4 bg-[#090e18]/95 backdrop-blur-md border border-slate-700 p-4 rounded-lg shadow-2xl flex justify-between z-[1000] text-xs max-h-48 overflow-y-auto">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-cyan-300">{selectedEntity.name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                    ID: {selectedEntity.id}
                  </span>
                  {selectedEntity.is_simulated && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px]">
                      SIMULATED DATA
                    </span>
                  )}
                </div>

                <div className="text-slate-400 text-[11px]">
                  Observed Location: {selectedEntity.latitude?.toFixed(4)}, {selectedEntity.longitude?.toFixed(4)} | Last Source Sensor: {selectedEntity.last_provider}
                </div>

                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                  {Object.entries(selectedEntity.current_state).map(([k, v]) => (
                    <div key={k} className="bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      <span className="text-slate-500">{k}:</span>{' '}
                      <span className={selectedEntity.is_simulated ? 'text-amber-300 font-bold' : 'text-emerald-400'}>
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-between items-end pl-4 border-l border-slate-800 shrink-0">
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕ Close
                </button>
                <div className="text-[10px] text-slate-500">
                  Provenance: <span className="text-cyan-400">Verified Sensor Pipeline</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
