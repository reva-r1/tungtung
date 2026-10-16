import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocationRecord, MovingEntity, MaritimePattern } from '../../types';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { MaritimePatternModal } from '../maritime/MaritimePatternModal';
import {
  MapPin,
  Compass,
  Layers,
  Globe,
  Tag,
  Building2,
  Anchor,
  Activity,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  Navigation,
  Eye,
  EyeOff,
  Plane
} from 'lucide-react';

interface TacticalMapProps {
  locations?: LocationRecord[];
  className?: string;
  selectedLocationId?: string;
  onSelectEntity?: (entityId: string) => void;
}

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom SVG Icons for Static Land Facilities (Warehouses, Ports, Checkpoints)
const createFacilityIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-tactical-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #090d16;
        border: 2px solid ${color};
        box-shadow: 0 0 12px ${color}aa;
      ">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${color};
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// Vessel color categorization based on commercial ship type
const getVesselColor = (type?: string): string => {
  if (!type) return '#38bdf8'; // Sky blue
  const t = type.toLowerCase();
  if (t.includes('tanker') || t.includes('crude') || t.includes('oil') || t.includes('chemical') || t.includes('lpg')) {
    return '#f59e0b'; // Amber (Tankers)
  }
  if (t.includes('container')) {
    return '#10b981'; // Emerald (Container carriers)
  }
  if (t.includes('bulk')) {
    return '#06b6d4'; // Cyan (Bulk carriers)
  }
  if (t.includes('tug') || t.includes('support') || t.includes('pilot')) {
    return '#a855f7'; // Purple (Tugs/Service)
  }
  return '#38bdf8'; // Default
};

// Dynamic Vessel Marker with True Course/Heading Directional Rotation
const createVesselIcon = (vessel: MovingEntity, isSelected: boolean) => {
  const color = getVesselColor(vessel.vessel_type);
  const heading = vessel.heading ?? vessel.course ?? 0;
  const isMoving = (vessel.speed || 0) > 0.5;

  return L.divIcon({
    className: 'custom-vessel-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
      ">
        ${isSelected ? `
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px dashed #06b6d4;
            animation: pulse-ring 2s infinite ease-in-out;
          "></div>
        ` : ''}
        <div style="
          transform: rotate(${heading}deg);
          transition: transform 0.6s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(9, 13, 22, 0.92);
          border: 1.5px solid ${color};
          box-shadow: 0 0 10px ${color}88;
        ">
          <!-- Sleek Directional Ship Glyph -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 19 21 12 17 5 21 12 2" fill="${color}" fill-opacity="${isMoving ? '0.45' : '0.15'}"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Dynamic Aircraft Marker with Altitude-Aware Colors and Heading Rotation
const getAircraftColor = (altitudeFt?: number, onGround?: boolean) => {
  if (onGround) return '#94a3b8'; // Slate (On Ground)
  if (!altitudeFt) return '#38bdf8'; // Sky
  if (altitudeFt >= 25000) return '#06b6d4'; // Cyan (Cruising FL250+)
  if (altitudeFt >= 10000) return '#10b981'; // Emerald (Mid Flight Level)
  return '#f59e0b'; // Amber (Low Approach / Departure)
};

const createAircraftIcon = (aircraft: MovingEntity, isSelected: boolean) => {
  const altFt = aircraft.properties?.altitude_ft;
  const onGround = aircraft.status === 'on_ground' || Boolean(aircraft.properties?.on_ground);
  const color = getAircraftColor(altFt, onGround);
  const heading = aircraft.heading ?? aircraft.course ?? 0;

  return L.divIcon({
    className: 'custom-aircraft-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
      ">
        ${isSelected ? `
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px dashed ${color};
            animation: pulse-ring 2s infinite ease-in-out;
          "></div>
        ` : ''}
        <div style="
          transform: rotate(${heading}deg);
          transition: transform 0.6s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(9, 13, 22, 0.94);
          border: 1.5px solid ${color};
          box-shadow: 0 0 10px ${color}88;
        ">
          <!-- Sleek Directional Airplane SVG Glyph -->
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Smooth Camera Controller
const MapFlyController: React.FC<{
  target: { lat: number; lng: number; zoom: number; id: number } | null;
}> = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, {
        duration: 1.8,
        easeLinearity: 0.25,
      });
    }
  }, [target, map]);
  return null;
};

export const TacticalMap: React.FC<TacticalMapProps> = ({
  locations: propLocations,
  className = '',
  onSelectEntity,
}) => {
  const { selectEntity, quickNavigateToEntity } = useInvestigation();
  const [locations, setLocations] = useState<LocationRecord[]>(propLocations || []);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [mapMode, setMapMode] = useState<'GOOGLE_HYBRID' | 'ESRI_SATELLITE' | 'DARK' | 'STREET'>('GOOGLE_HYBRID');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showPinNames, setShowPinNames] = useState<boolean>(true);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number; id: number } | null>(null);

  // Revana Maritime & Aviation Moving Entity States
  const [showMaritime, setShowMaritime] = useState<boolean>(true);
  const [showAviation, setShowAviation] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [vessels, setVessels] = useState<MovingEntity[]>([]);
  const [aircraftList, setAircraftList] = useState<MovingEntity[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [vesselTrack, setVesselTrack] = useState<[number, number][]>([]);
  const [patterns, setPatterns] = useState<MaritimePattern[]>([]);
  const [activePatternModal, setActivePatternModal] = useState<MaritimePattern | null>(null);
  const [maritimeStatus, setMaritimeStatus] = useState<{ connected: boolean; source: string; mode: string } | null>(null);
  const [aviationStatus, setAviationStatus] = useState<{
    status: string;
    connectionState: 'CONNECTED' | 'DEGRADED' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    dataFreshness: 'FRESH' | 'STALE' | 'HISTORICAL' | 'EMPTY' | 'UNKNOWN';
    operationalState: 'CONNECTED_FRESH' | 'CONNECTED_STALE' | 'CONNECTED_EMPTY' | 'CONNECTED_HISTORICAL' | 'RATE_LIMITED' | 'DISCONNECTED' | 'STANDBY';
    lastPollAt: string | null;
    lastSuccessfulPollAt: string | null;
    newestObservationAt: string | null;
    newestObservationAgeSec: number | null;
    freshAircraftCount: number;
    staleAircraftCount: number;
    historicalCount: number;
    totalAircraftInDb: number;
    airborneCount: number;
  } | null>(null);

  // 1. Initial Data Fetching & Periodic Freshness Refresh
  useEffect(() => {
    if (!propLocations) {
      api.getLocations().then(setLocations).catch(console.error);
    } else {
      setLocations(propLocations);
    }

    // Fetch live feed connectivity status
    api.getMaritimeStatus().then(setMaritimeStatus).catch(() => setMaritimeStatus({ connected: false, source: 'AISStream.io', mode: 'STANDBY' }));
    
    const refreshAviationStatus = () => {
      api.getAviationStatus().then(setAviationStatus).catch(() => setAviationStatus({
        status: 'STANDBY',
        connectionState: 'STANDBY',
        dataFreshness: 'UNKNOWN',
        operationalState: 'STANDBY',
        lastPollAt: null,
        lastSuccessfulPollAt: null,
        newestObservationAt: null,
        newestObservationAgeSec: null,
        freshAircraftCount: 0,
        staleAircraftCount: 0,
        historicalCount: 0,
        totalAircraftInDb: 0,
        airborneCount: 0,
      }));
    };
    refreshAviationStatus();
    const aviationInterval = setInterval(refreshAviationStatus, 15000);

    // Fetch initial maritime vessels
    api.getMaritimeVessels(300).then((data) => {
      if (data?.vessels) setVessels(data.vessels);
    }).catch(console.error);

    // Fetch initial aviation aircraft
    api.getAviationAircraft(300).then((data) => {
      if (data?.aircraft) setAircraftList(data.aircraft);
    }).catch(console.error);

    // Fetch detected patterns
    api.getMaritimePatterns().then((data) => {
      if (data?.patterns) setPatterns(data.patterns);
    }).catch(console.error);

    return () => {
      clearInterval(aviationInterval);
    };
  }, [propLocations]);

  // 2. Real-Time Moving Entity Stream via Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/maritime/events/stream');

      eventSource.addEventListener('entity_position_update', (event) => {
        try {
          const update = JSON.parse(event.data) as MovingEntity;

          if (update.type === 'aircraft' || update.id?.startsWith('AIRCRAFT_')) {
            setAircraftList((prev) => {
              const index = prev.findIndex((a) => a.id === update.id);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = { ...updated[index], ...update };
                return updated;
              }
              return [update, ...prev];
            });

            if (selectedVesselId && selectedVesselId === update.id) {
              setVesselTrack((prev) => [...prev, [update.latitude, update.longitude]]);
            }
          } else {
            setVessels((prev) => {
              const index = prev.findIndex((v) => v.id === update.id || v.mmsi === update.mmsi);
              if (index !== -1) {
                const updated = [...prev];
                updated[index] = { ...updated[index], ...update };
                return updated;
              }
              return [update, ...prev];
            });

            // If updated vessel is currently selected, append to track
            if (selectedVesselId && (selectedVesselId === update.id || selectedVesselId.endsWith(update.mmsi || ''))) {
              setVesselTrack((prev) => [...prev, [update.latitude, update.longitude]]);
            }
          }
        } catch (_) { }
      });
    } catch (err) {
      console.error('SSE connection error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedVesselId]);

  // 3. Historical Track Retrieval on Entity Selection
  const handleSelectVessel = async (entity: MovingEntity) => {
    setSelectedVesselId(entity.id);
    try {
      const trackRes = entity.type === 'aircraft'
        ? await api.getAviationAircraftTrack(entity.id, 64)
        : await api.getMaritimeVesselTrack(entity.id, 64);
      if (trackRes?.track && trackRes.track.length > 0) {
        const coords: [number, number][] = trackRes.track.map((t) => [t.latitude, t.longitude]);
        setVesselTrack(coords);
      } else {
        setVesselTrack([[entity.latitude, entity.longitude]]);
      }
    } catch (_) {
      setVesselTrack([[entity.latitude, entity.longitude]]);
    }
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'WAREHOUSE': return '#10b981'; // Emerald
      case 'PORT': return '#3b82f6'; // Blue
      case 'CHECKPOINT': return '#06b6d4'; // Cyan
      case 'TOLL_PLAZA': return '#eab308'; // Yellow
      case 'INCIDENT_SITE': return '#f43f5e'; // Ruby
      case 'TRANSIT_POINT': return '#a855f7'; // Purple
      default: return '#38bdf8'; // Sky
    }
  };

  const filteredLocations = filterType === 'ALL'
    ? locations
    : locations.filter((l) => l.type === filterType);

  const defaultCenter: [number, number] = filteredLocations.length > 0
    ? [filteredLocations[0].latitude, filteredLocations[0].longitude]
    : [13.0, 80.2]; // Default Indian Ocean / South India center

  const zoomToLevel = (zoom: number) => {
    const centerLoc = filteredLocations[0] || { latitude: 12.9716, longitude: 77.5946 };
    setFlyTarget({
      lat: centerLoc.latitude,
      lng: centerLoc.longitude,
      zoom,
      id: Date.now(),
    });
  };

  const zoomToLocation = (lat: number, lon: number, zoom: number = 17) => {
    setFlyTarget({
      lat,
      lng: lon,
      zoom,
      id: Date.now(),
    });
  };

  return (
    <div className={`relative flex flex-col h-full bg-[#090d16] border border-[#1e293b] rounded-lg overflow-hidden ${className}`}>
      {/* Pattern Modal */}
      {activePatternModal && (
        <MaritimePatternModal
          pattern={activePatternModal}
          onClose={() => setActivePatternModal(null)}
          onSelectCorridor={(region) => {
            if (region.includes('Malacca')) {
              zoomToLocation(3.2, 100.5, 7);
            }
            setActivePatternModal(null);
          }}
        />
      )}

      {/* Top Header / Tactical Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#0b1120] border-b border-[#1e293b] z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            GEOSPATIAL RADAR
          </span>
          <span className="text-[11px] font-mono text-cyan-400/90 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
            {filteredLocations.length} Land Points
          </span>
          {showMaritime && (
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                maritimeStatus?.connected
                  ? 'text-emerald-400/90 bg-emerald-950/60 border-emerald-800/40'
                  : 'text-amber-400/90 bg-amber-950/60 border-amber-800/40'
              }`}
              title={maritimeStatus?.connected ? 'Real-time WebSocket streaming active' : 'Feed standby/offline; displaying verified historical vessel telemetry'}
            >
              <Anchor className={`w-3 h-3 ${maritimeStatus?.connected ? 'text-emerald-400' : 'text-amber-400'}`} />
              {vessels.length} {maritimeStatus?.connected ? 'Live Vessels' : 'Recorded Vessels'}
            </span>
          )}
          {showAviation && (() => {
            const opState = aviationStatus?.operationalState || 'STANDBY';
            const freshCount = aviationStatus?.freshAircraftCount ?? 0;
            const totalCount = aircraftList.length;

            let badgeStyle = 'text-slate-400 bg-slate-900/60 border-slate-800/40';
            let iconStyle = 'text-slate-400';
            let label = `${totalCount} Aircraft (Standby)`;
            let title = 'Aviation feed standby / waiting for poll';

            if (opState === 'CONNECTED_FRESH') {
              badgeStyle = 'text-emerald-300 bg-emerald-950/60 border-emerald-800/40';
              iconStyle = 'text-emerald-400';
              label = `${freshCount} Live Aircraft`;
              title = `OpenSky connected & live: ${freshCount} active flights verified in airspace (< 2m)`;
            } else if (opState === 'CONNECTED_EMPTY') {
              badgeStyle = 'text-sky-300 bg-sky-950/60 border-sky-800/40';
              iconStyle = 'text-sky-400';
              label = `0 Active Flights (Live)`;
              title = 'OpenSky connected; 0 aircraft currently reported in sector';
            } else if (opState === 'CONNECTED_STALE' || opState === 'CONNECTED_HISTORICAL') {
              badgeStyle = 'text-amber-300 bg-amber-950/60 border-amber-800/40';
              iconStyle = 'text-amber-400';
              const ageMin = Math.max(1, Math.round((aviationStatus?.newestObservationAgeSec || 0) / 60));
              label = `${totalCount} Aircraft (Stale ${ageMin}m)`;
              title = `OpenSky connected but observation is stale (${ageMin}m ago); displaying recorded positions`;
            } else if (opState === 'RATE_LIMITED') {
              badgeStyle = 'text-amber-400 bg-amber-950/60 border-amber-800/40';
              iconStyle = 'text-amber-400';
              label = `Aviation: Rate Limited`;
              title = 'OpenSky API rate limit reached (cooling down)';
            } else if (opState === 'DISCONNECTED') {
              badgeStyle = 'text-rose-400 bg-rose-950/60 border-rose-800/40';
              iconStyle = 'text-rose-400';
              label = `Aviation: Disconnected`;
              title = 'OpenSky provider connection failed or network offline';
            }

            return (
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${badgeStyle}`} title={title}>
                <Plane className={`w-3 h-3 ${iconStyle}`} />
                {label}
              </span>
            );
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Zoom Shortcuts */}
          <div className="flex items-center bg-[#090d16] border border-[#1e293b] rounded p-0.5 text-[10px] font-mono">
            <span className="text-slate-500 px-1.5 text-[9px] uppercase font-bold">Zoom:</span>
            <button
              onClick={() => zoomToLevel(18)}
              className="px-2 py-0.5 rounded text-amber-300 hover:bg-amber-950/40 transition flex items-center gap-1 font-bold"
              title="Street Level Map View"
            >
              <Building2 className="w-3 h-3 text-amber-400" />
              Street
            </button>
            <button
              onClick={() => zoomToLevel(13)}
              className="px-2 py-0.5 rounded text-slate-300 hover:bg-slate-800 transition"
              title="City Level Overview"
            >
              City
            </button>
            <button
              onClick={() => zoomToLevel(6)}
              className="px-2 py-0.5 rounded text-slate-300 hover:bg-slate-800 transition"
              title="Regional / Maritime Overview"
            >
              Regional
            </button>
          </div>

          {/* Map Layer Mode Buttons */}
          <div className="flex items-center bg-[#090d16] border border-[#1e293b] rounded p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setMapMode('GOOGLE_HYBRID')}
              className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                mapMode === 'GOOGLE_HYBRID'
                  ? 'bg-cyan-600/30 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Google Satellite Hybrid: High-Res Building Rooftops + Roadmaps + Streets"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              Google Hybrid
            </button>
            <button
              onClick={() => setMapMode('ESRI_SATELLITE')}
              className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                mapMode === 'ESRI_SATELLITE'
                  ? 'bg-cyan-600/30 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Esri Satellite
            </button>
            <button
              onClick={() => setMapMode('DARK')}
              className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
                mapMode === 'DARK'
                  ? 'bg-cyan-600/30 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3 text-slate-400" />
              Dark
            </button>
            <button
              onClick={() => setMapMode('STREET')}
              className={`px-2 py-0.5 rounded transition ${
                mapMode === 'STREET'
                  ? 'bg-cyan-600/30 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Streets
            </button>
          </div>

          {/* Maritime AIS Moving Entity Layer Toggle */}
          <button
            onClick={() => setShowMaritime(!showMaritime)}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1.5 ${
              showMaritime
                ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                : 'bg-[#090d16] border-[#1e293b] text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Live AIS Maritime Moving Entity Layer"
          >
            <Anchor className="w-3 h-3" />
            AIS Ships: {showMaritime ? 'ON' : 'OFF'}
          </button>

          {/* Aviation OpenSky Moving Entity Layer Toggle */}
          <button
            onClick={() => setShowAviation(!showAviation)}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1.5 ${
              showAviation
                ? 'bg-sky-950/70 border-sky-500/50 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                : 'bg-[#090d16] border-[#1e293b] text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Live OpenSky Aviation ADS-B Entity Layer"
          >
            <Plane className="w-3 h-3" />
            Aircraft: {showAviation ? 'ON' : 'OFF'}
          </button>

          {/* Historical Trails Toggle */}
          {showMaritime && (
            <button
              onClick={() => setShowTrails(!showTrails)}
              className={`px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1 ${
                showTrails
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#090d16] border-[#1e293b] text-slate-500 hover:text-slate-300'
              }`}
              title="Toggle historical trajectory trails for selected vessels"
            >
              Trails: {showTrails ? 'ON' : 'OFF'}
            </button>
          )}

          {/* Pin Name Badges Toggle */}
          <button
            onClick={() => setShowPinNames(!showPinNames)}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1 ${
              showPinNames
                ? 'bg-sky-950/60 border-sky-600/50 text-sky-300'
                : 'bg-[#090d16] border-[#1e293b] text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle entity name badges above markers"
          >
            <Tag className="w-3 h-3" />
            Tags: {showPinNames ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 w-full h-full min-h-[300px] z-0 relative">
        <MapContainer
          center={defaultCenter}
          zoom={6}
          minZoom={3}
          maxZoom={21}
          scrollWheelZoom={true}
          className="w-full h-full"
          style={{ background: '#090d16' }}
        >
          {/* Active Flight Camera Controller */}
          <MapFlyController target={flyTarget} />

          {/* Base Layer: Google Hybrid (Ultra-crisp satellite, building footprints, street roadmaps) */}
          {mapMode === 'GOOGLE_HYBRID' && (
            <TileLayer
              attribution='&copy; Google Maps Satellite & Roadmaps'
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              maxZoom={21}
              maxNativeZoom={20}
            />
          )}

          {/* Base Layer: Esri World Imagery (Satellite tile layer) */}
          {mapMode === 'ESRI_SATELLITE' && (
            <>
              <TileLayer
                attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={21}
                maxNativeZoom={19}
              />
              {showLabels && (
                <>
                  <TileLayer
                    attribution='&copy; Esri Boundaries & Places'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={21}
                    maxNativeZoom={19}
                    opacity={0.9}
                  />
                  <TileLayer
                    attribution='&copy; Esri Transportation'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                    maxZoom={21}
                    maxNativeZoom={19}
                    opacity={0.8}
                  />
                </>
              )}
            </>
          )}

          {/* Base Layer: Dark Tactical */}
          {mapMode === 'DARK' && (
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
          )}

          {/* Base Layer: OpenStreetMap */}
          {mapMode === 'STREET' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          {/* ================================================================= */}
          {/* STATIC LAND ENTITIES (Warehouses, Ports, Checkpoints)            */}
          {/* ================================================================= */}
          {filteredLocations.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.latitude, loc.longitude]}
              icon={createFacilityIcon(getMarkerColor(loc.type))}
              eventHandlers={{
                click: () => zoomToLocation(loc.latitude, loc.longitude, 18),
              }}
            >
              {showPinNames && (
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -14]}
                  className="tactical-marker-tooltip"
                >
                  <span>{loc.name}</span>
                </Tooltip>
              )}

              <Popup className="tactical-popup">
                <div className="p-1 font-mono text-xs text-slate-200 min-w-[220px]">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300">
                      {loc.type}
                    </span>
                    <span className="text-[10px] text-slate-400">{loc.city}</span>
                  </div>

                  <div className="font-bold text-white text-xs mb-1">{loc.name}</div>
                  {loc.address && (
                    <div className="text-[10px] text-slate-400 mb-2">{loc.address}</div>
                  )}

                  <div className="text-[10px] text-slate-300 bg-slate-900 p-1.5 rounded mb-2">
                    Coordinates: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => zoomToLocation(loc.latitude, loc.longitude, 18)}
                      className="flex-1 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[10px] font-bold rounded transition flex items-center justify-center gap-1"
                    >
                      <Building2 className="w-3 h-3" />
                      BUILDINGS
                    </button>
                    <button
                      onClick={() => {
                        if (onSelectEntity) onSelectEntity(loc.id);
                        else quickNavigateToEntity(loc.id);
                      }}
                      className="flex-1 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-[10px] font-bold rounded transition"
                    >
                      INSPECT
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ================================================================= */}
          {/* HISTORICAL TRACK / TRAIL POLYLINE FOR SELECTED VESSEL             */}
          {/* ================================================================= */}
          {showMaritime && showTrails && vesselTrack.length > 1 && (
            <>
              <Polyline
                positions={vesselTrack}
                pathOptions={{
                  color: '#06b6d4',
                  weight: 3,
                  dashArray: '4, 6',
                  opacity: 0.9,
                }}
              />
              {/* Breadcrumb points along historical trail */}
              {vesselTrack.map((pt, i) => (
                <CircleMarker
                  key={i}
                  center={pt}
                  radius={i === vesselTrack.length - 1 ? 4 : 2}
                  pathOptions={{
                    color: '#0891b2',
                    fillColor: '#06b6d4',
                    fillOpacity: 0.8,
                    weight: 1,
                  }}
                />
              ))}
            </>
          )}

          {/* ================================================================= */}
          {/* DYNAMIC MOVING-ENTITY LAYER (AIS VESSELS)                        */}
          {/* ================================================================= */}
          {showMaritime && vessels.map((vessel) => {
            const isSelected = selectedVesselId === vessel.id;
            const heading = vessel.heading ?? vessel.course ?? 0;

            return (
              <Marker
                key={vessel.id}
                position={[vessel.latitude, vessel.longitude]}
                icon={createVesselIcon(vessel, isSelected)}
                eventHandlers={{
                  click: () => handleSelectVessel(vessel),
                }}
              >
                {showPinNames && (
                  <Tooltip
                    direction="top"
                    offset={[0, -16]}
                    className="tactical-marker-tooltip"
                  >
                    <span>{vessel.name}</span>
                  </Tooltip>
                )}

                <Popup className="tactical-popup">
                  <div className="p-1 font-mono text-xs text-slate-200 min-w-[240px]">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 flex items-center gap-1">
                        <Anchor className="w-3 h-3 text-cyan-400" />
                        {vessel.vessel_type || 'SHIP'}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">
                        {vessel.status || 'in_transit'}
                      </span>
                    </div>

                    <div className="font-bold text-white text-sm mb-1">{vessel.name}</div>

                    <div className="grid grid-cols-2 gap-1.5 my-2 text-[10px] bg-slate-900/90 p-2 rounded border border-slate-800">
                      <div>
                        <span className="text-slate-500">MMSI:</span>{' '}
                        <span className="text-slate-300 font-bold">{vessel.mmsi || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">IMO:</span>{' '}
                        <span className="text-slate-300 font-bold">{vessel.imo || 'Unavailable'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">SPEED (SOG):</span>{' '}
                        <span className="text-amber-400 font-bold">{vessel.speed ? `${vessel.speed} kts` : '0 kts'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">HEADING:</span>{' '}
                        <span className="text-cyan-400 font-bold">{heading}°</span>
                      </div>
                    </div>

                    {/* Origin / Destination - Strictly distinguishes unknown data from missing implementation */}
                    <div className="p-2 rounded bg-cyan-950/30 border border-cyan-900/40 text-[11px] mb-2">
                      <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">VOYAGE DESTINATION:</div>
                      {vessel.destination ? (
                        <div className="text-cyan-300 font-bold flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-cyan-400" />
                          <span>{vessel.destination}</span>
                        </div>
                      ) : (
                        <div className="text-slate-400 italic flex items-center gap-1">
                          <EyeOff className="w-3 h-3 text-slate-500" />
                          <span>Unknown destination</span>
                          <span className="text-[9px] text-slate-500">(Not declared in AIS)</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 mb-2">
                      Coordinates: {vessel.latitude.toFixed(4)}, {vessel.longitude.toFixed(4)}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleSelectVessel(vessel)}
                        className="flex-1 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-[10px] font-bold rounded transition flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        TRACE TRAIL
                      </button>
                      <button
                        onClick={() => zoomToLocation(vessel.latitude, vessel.longitude, 16)}
                        className="py-1.5 px-2 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[10px] font-bold rounded transition"
                        title="Zoom to vessel position"
                      >
                        CENTER
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ================================================================= */}
          {/* DYNAMIC MOVING-ENTITY LAYER (OPENSKY AIRCRAFT)                   */}
          {/* ================================================================= */}
          {showAviation && aircraftList.map((aircraft) => {
            const isSelected = selectedVesselId === aircraft.id;
            const heading = aircraft.heading ?? aircraft.course ?? 0;
            const props = aircraft.properties || {};

            return (
              <Marker
                key={aircraft.id}
                position={[aircraft.latitude, aircraft.longitude]}
                icon={createAircraftIcon(aircraft, isSelected)}
                eventHandlers={{
                  click: () => handleSelectVessel(aircraft),
                }}
              >
                {showPinNames && (
                  <Tooltip
                    direction="top"
                    offset={[0, -16]}
                    className="tactical-marker-tooltip"
                  >
                    <span>{aircraft.name}</span>
                  </Tooltip>
                )}

                <Popup className="tactical-popup">
                  <div className="p-1 font-mono text-xs text-slate-200 min-w-[250px]">
                    {(() => {
                      const obsAgeSec = Math.max(0, Math.floor((Date.now() - new Date(aircraft.last_updated_at).getTime()) / 1000));
                      const isObsFresh = obsAgeSec <= 120;
                      const isObsStale = obsAgeSec > 120 && obsAgeSec <= 900;
                      const vRate = props.vertical_rate_mps ?? props.vertical_rate_ms;

                      let statusBadge = 'bg-slate-800 text-slate-400';
                      let statusText = `RECORDED (${Math.max(1, Math.round(obsAgeSec / 60))}m AGO)`;

                      if (isObsFresh) {
                        statusBadge = aircraft.status === 'on_ground' ? 'bg-slate-800 text-slate-300' : 'bg-emerald-950 text-emerald-300';
                        statusText = aircraft.status === 'on_ground' ? 'ON GROUND (LIVE)' : 'AIRBORNE (LIVE)';
                      } else if (isObsStale) {
                        statusBadge = 'bg-amber-950 text-amber-300';
                        statusText = `STALE (${Math.round(obsAgeSec / 60)}m AGO)`;
                      }

                      return (
                        <>
                          <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 flex items-center gap-1">
                              <Plane className="w-3 h-3 text-sky-400" />
                              ADS-B / FLIGHT
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${statusBadge}`}>
                              {statusText}
                            </span>
                          </div>

                          <div className="font-bold text-white text-sm mb-1 flex items-center justify-between">
                            <span>{aircraft.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{props.icao24 ? String(props.icao24).toUpperCase() : ''}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 my-2 text-[10px] bg-slate-900/90 p-2 rounded border border-slate-800">
                            <div>
                              <span className="text-slate-500">ALTITUDE:</span>{' '}
                              <span className="text-cyan-400 font-bold">
                                {props.altitude_ft ? `${props.altitude_ft.toLocaleString()} ft` : (props.altitude_m ? `${props.altitude_m} m` : 'N/A')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">AIRSPEED:</span>{' '}
                              <span className="text-amber-400 font-bold">
                                {aircraft.speed ? `${aircraft.speed} kts` : (props.speed_knots ? `${props.speed_knots} kts` : (props.speed_kmh ? `${props.speed_kmh} km/h` : '0 kts'))}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">HEADING:</span>{' '}
                              <span className="text-sky-300 font-bold">{heading}°</span>
                            </div>
                            <div>
                              <span className="text-slate-500">V/RATE:</span>{' '}
                              <span className="text-slate-300 font-bold">
                                {vRate != null ? `${vRate > 0 ? '+' : ''}${vRate} m/s` : '0 m/s'}
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {/* Origin / Provenance Banner */}
                    <div className="p-2 rounded bg-sky-950/30 border border-sky-900/40 text-[11px] mb-2">
                      <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">SOURCE PROVENANCE:</div>
                      <div className="text-sky-300 text-[10px] font-bold flex items-center gap-1">
                        <span>The OpenSky Network (ADS-B / Mode S)</span>
                      </div>
                      {props.origin_country && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Origin: <span className="text-slate-200">{props.origin_country}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 mb-2">
                      Coordinates: {aircraft.latitude.toFixed(4)}, {aircraft.longitude.toFixed(4)}
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleSelectVessel(aircraft)}
                        className="flex-1 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/50 text-sky-200 text-[10px] font-bold rounded transition flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        TRACE FLIGHT PATH
                      </button>
                      <button
                        onClick={() => zoomToLocation(aircraft.latitude, aircraft.longitude, 14)}
                        className="py-1.5 px-2 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[10px] font-bold rounded transition"
                        title="Zoom to aircraft position"
                      >
                        CENTER
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Map Legend */}
      <div className="p-2 bg-[#0b1120] border-t border-[#1e293b] flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10b981]"></span> Container / Cargo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span> Crude / Chemical Tanker
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#06b6d4]"></span> Bulk Carrier
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span> Tug / Support
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            | Aircraft: <span className="w-2 h-2 rounded-full bg-[#06b6d4] inline-block"></span> FL250+ <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block"></span> FL100-250 <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block"></span> &lt;FL100
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            | Land: <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block"></span> Facility
          </span>
        </div>

        <div className="text-cyan-400/80 font-mono text-[10px] flex items-center gap-2">
          <span>
            {mapMode === 'GOOGLE_HYBRID'
              ? '🛰️ Google Hybrid Satellite + Live AIS Vessel Stream (Heading & Trails)'
              : mapMode === 'ESRI_SATELLITE'
              ? '🛰️ Esri Optical Satellite + Live AIS Moving Entities'
              : mapMode === 'DARK'
              ? '🌑 CartoDB Dark Matter Tactical Layer + Live AIS'
              : '🗺️ OpenStreetMap Vector Layer + Live AIS'}
          </span>
        </div>
      </div>
    </div>
  );
};
