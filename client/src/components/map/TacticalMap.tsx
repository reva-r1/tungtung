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
  Plane,
  Droplets,
  CloudRain,
  Radio
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

// Official Water-Level & Reservoir Monitoring Station Marker
const getReservoirColor = (percent?: number) => {
  if (percent == null || isNaN(percent)) return '#38bdf8'; // Sky blue default
  if (percent >= 70) return '#06b6d4'; // Cyan (Abundant / High capacity)
  if (percent >= 40) return '#10b981'; // Emerald (Normal capacity)
  return '#f59e0b'; // Amber (Low / Depleted capacity)
};

const createReservoirIcon = (station: any, isSelected: boolean) => {
  const percent = station.properties?.capacity_percent ?? station.capacity_percent;
  const color = getReservoirColor(percent);

  return L.divIcon({
    className: 'custom-reservoir-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
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
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(9, 13, 22, 0.94);
          border: 2px solid ${color};
          box-shadow: 0 0 10px ${color}aa;
        ">
          <!-- Water Droplet / Dam Reservoir SVG Glyph -->
          <svg width="13" height="13" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

// Custom SVG Icon for Earthquake Epicenters (pulsing ring sized and colored by magnitude)
const createEarthquakeIcon = (eq: any, isSelected: boolean) => {
  const mag = typeof eq.magnitude === 'number' ? eq.magnitude : 3.0;
  const color = mag >= 5.0 ? '#ef4444' : mag >= 4.0 ? '#f59e0b' : '#38bdf8';
  const size = Math.min(42, Math.max(22, Math.round(18 + mag * 3.5)));

  return L.divIcon({
    className: 'custom-earthquake-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${size}px;
        height: ${size}px;
      ">
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: ${color}22;
          border: 1.5px solid ${color};
          animation: pulse-ring 2.5s infinite ease-in-out;
        "></div>
        ${isSelected ? `
          <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px dashed ${color};
          "></div>
        ` : ''}
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${color};
          box-shadow: 0 0 8px ${color};
        "></div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Custom SVG Icon for Weather & Environmental Monitoring Nodes
const createEnvironmentIcon = (node: any, isSelected: boolean) => {
  const color = '#10b981'; // Emerald
  return L.divIcon({
    className: 'custom-env-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
      ">
        ${isSelected ? `
          <div style="
            position: absolute;
            inset: -3px;
            border-radius: 50%;
            border: 2px dashed ${color};
          "></div>
        ` : ''}
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(9, 13, 22, 0.94);
          border: 2px solid ${color};
          box-shadow: 0 0 10px ${color}88;
        ">
          <!-- Environmental Atmosphere / Cloud Glyph -->
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
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

  // Revana Maritime, Aviation, Hydrological & Environmental States
  const [showMaritime, setShowMaritime] = useState<boolean>(true);
  const [showAviation, setShowAviation] = useState<boolean>(true);
  const [showHydrology, setShowHydrology] = useState<boolean>(true);
  const [showEarthquakes, setShowEarthquakes] = useState<boolean>(true);
  const [showEnvironment, setShowEnvironment] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [vessels, setVessels] = useState<MovingEntity[]>([]);
  const [aircraftList, setAircraftList] = useState<MovingEntity[]>([]);
  const [hydrologyStations, setHydrologyStations] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [weatherNodes, setWeatherNodes] = useState<any[]>([]);
  const [airQualityNodes, setAirQualityNodes] = useState<any[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedEarthquakeId, setSelectedEarthquakeId] = useState<string | null>(null);
  const [selectedEnvNodeId, setSelectedEnvNodeId] = useState<string | null>(null);
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
  const [hydrologyStatus, setHydrologyStatus] = useState<any | null>(null);
  const [earthquakeStatus, setEarthquakeStatus] = useState<any | null>(null);
  const [environmentStatus, setEnvironmentStatus] = useState<any | null>(null);

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

    const refreshHydrologyStatus = () => {
      api.getHydrologyStatus().then(setHydrologyStatus).catch(() => setHydrologyStatus(null));
    };
    refreshHydrologyStatus();
    const hydroInterval = setInterval(refreshHydrologyStatus, 15000);

    const refreshEarthquakeData = () => {
      api.getEarthquakeStatus().then(setEarthquakeStatus).catch(() => setEarthquakeStatus(null));
      api.getEarthquakeEvents(100).then((data) => {
        if (data?.events) setEarthquakes(data.events);
      }).catch(console.error);
    };
    refreshEarthquakeData();
    const eqInterval = setInterval(refreshEarthquakeData, 20000);

    const refreshEnvironmentData = () => {
      api.getEnvironmentStatus().then(setEnvironmentStatus).catch(() => setEnvironmentStatus(null));
      api.getWeatherNodes().then((data) => {
        if (data?.nodes) setWeatherNodes(data.nodes);
      }).catch(console.error);
      api.getAirQualityNodes().then((data) => {
        if (data?.nodes) setAirQualityNodes(data.nodes);
      }).catch(console.error);
    };
    refreshEnvironmentData();
    const envInterval = setInterval(refreshEnvironmentData, 30000);

    // Fetch initial maritime vessels
    api.getMaritimeVessels(300).then((data) => {
      if (data?.vessels) setVessels(data.vessels);
    }).catch(console.error);

    // Fetch initial aviation aircraft
    api.getAviationAircraft(300).then((data) => {
      if (data?.aircraft) setAircraftList(data.aircraft);
    }).catch(console.error);

    // Fetch initial hydrology stations
    api.getHydrologyStations().then((data) => {
      if (data?.stations) setHydrologyStations(data.stations);
    }).catch(console.error);

    // Fetch detected patterns
    api.getMaritimePatterns().then((data) => {
      if (data?.patterns) setPatterns(data.patterns);
    }).catch(console.error);

    return () => {
      clearInterval(aviationInterval);
      clearInterval(hydroInterval);
      clearInterval(eqInterval);
      clearInterval(envInterval);
    };
  }, [propLocations]);

  // 2. Real-Time Moving Entity Stream via Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/maritime/events/stream');

      eventSource.addEventListener('hydro_observation_update', (event) => {
        try {
          const update = JSON.parse(event.data);
          setHydrologyStations((prev) => {
            const index = prev.findIndex((s) => s.id === update.id);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...update };
              return updated;
            }
            return [update, ...prev];
          });
        } catch (_) { }
      });

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
          {showHydrology && (() => {
            const opState = hydrologyStatus?.operationalState || 'STANDBY';
            const totalCount = hydrologyStatus?.totalStationsInDb ?? hydrologyStations.length;
            const freshCount = totalCount;

            let badgeStyle = 'text-slate-400 bg-slate-900/60 border-slate-800/40';
            let iconStyle = 'text-slate-400';
            let label = `${totalCount} Reservoirs (Standby)`;
            let title = 'CWC Hydrology feed standby / waiting for poll';

            if (opState === 'CONNECTED_FRESH') {
              badgeStyle = 'text-cyan-300 bg-cyan-950/60 border-cyan-800/40';
              iconStyle = 'text-cyan-400';
              label = `${freshCount} Reservoirs (Fresh <3d)`;
              title = `CWC / India-WRIS connected & fresh: ${freshCount} reservoirs updated within 3 days`;
            } else if (opState === 'CONNECTED_HISTORICAL') {
              badgeStyle = 'text-slate-300 bg-slate-900/80 border-slate-700/60';
              iconStyle = 'text-slate-400';
              const ageDays = hydrologyStatus?.newestObservationAgeDays ?? 1004;
              label = `${totalCount} Reservoirs (Historical Archive)`;
              title = `CWC / India-WRIS connected; displaying official archived bulletin data (${ageDays}d old)`;
            } else if (opState === 'CONNECTED_STALE') {
              badgeStyle = 'text-amber-300 bg-amber-950/60 border-amber-800/40';
              iconStyle = 'text-amber-400';
              label = `${totalCount} Reservoirs (Stale Bulletin)`;
              title = 'CWC / India-WRIS connected; bulletin is older than 3 days';
            } else if (opState === 'CONNECTED_EMPTY') {
              badgeStyle = 'text-sky-300 bg-sky-950/60 border-sky-800/40';
              iconStyle = 'text-sky-400';
              label = `0 Reservoirs (Empty)`;
              title = 'CWC feed connected; 0 records returned';
            } else if (opState === 'RATE_LIMITED') {
              badgeStyle = 'text-amber-400 bg-amber-950/60 border-amber-800/40';
              iconStyle = 'text-amber-400';
              label = `Hydrology: Rate Limited`;
              title = 'CWC provider cooldown active';
            } else if (opState === 'DISCONNECTED') {
              badgeStyle = 'text-rose-400 bg-rose-950/60 border-rose-800/40';
              iconStyle = 'text-rose-400';
              label = `Hydrology: Disconnected`;
              title = 'CWC provider connection failed or network offline';
            }

            return (
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${badgeStyle}`} title={title}>
                <Droplets className={`w-3 h-3 ${iconStyle}`} />
                {label}
              </span>
            );
          })()}
          {showEarthquakes && (() => {
            const opState = earthquakeStatus?.operationalState || 'STANDBY';
            const totalCount = earthquakes.length || earthquakeStatus?.totalEventsInDb || 0;

            let badgeStyle = 'text-slate-400 bg-slate-900/60 border-slate-800/40';
            let iconStyle = 'text-slate-400';
            let label = `${totalCount} Earthquakes (Standby)`;
            let title = 'USGS Earthquake feed standby / waiting for poll';

            if (opState === 'CONNECTED_FRESH') {
              badgeStyle = 'text-amber-300 bg-amber-950/60 border-amber-800/40';
              iconStyle = 'text-amber-400';
              label = `${totalCount} Earthquakes (Fresh <3h)`;
              title = `USGS Seismic feed connected: ${totalCount} seismic events reported`;
            } else if (opState === 'CONNECTED_STALE') {
              badgeStyle = 'text-amber-400/80 bg-amber-950/40 border-amber-800/30';
              iconStyle = 'text-amber-400';
              label = `${totalCount} Earthquakes (Past 24h)`;
              title = 'USGS connected; latest events in 24h window';
            } else if (opState === 'CONNECTED_HISTORICAL') {
              badgeStyle = 'text-slate-300 bg-slate-900/80 border-slate-700/60';
              iconStyle = 'text-slate-400';
              label = `${totalCount} Earthquakes (Historical)`;
              title = 'USGS feed connected; displaying historical seismic events';
            } else if (opState === 'CONNECTED_EMPTY') {
              badgeStyle = 'text-sky-300 bg-sky-950/60 border-sky-800/40';
              iconStyle = 'text-sky-400';
              label = `0 Earthquakes (Live Feed)`;
              title = 'USGS feed connected; zero seismic events in query window';
            } else if (opState === 'RATE_LIMITED') {
              badgeStyle = 'text-amber-400 bg-amber-950/60 border-amber-800/40';
              iconStyle = 'text-amber-400';
              label = `Seismic: Rate Limited`;
              title = 'USGS provider cooldown active';
            } else if (opState === 'DISCONNECTED') {
              badgeStyle = 'text-rose-400 bg-rose-950/60 border-rose-800/40';
              iconStyle = 'text-rose-400';
              label = `Seismic: Disconnected`;
              title = 'USGS provider connection failed';
            }

            return (
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${badgeStyle}`} title={title}>
                <Activity className={`w-3 h-3 ${iconStyle}`} />
                {label}
              </span>
            );
          })()}
          {showEnvironment && (() => {
            const wxCount = weatherNodes.length || environmentStatus?.totalWeatherNodesInDb || 0;
            const aqiCount = airQualityNodes.length || environmentStatus?.totalAirQualityNodesInDb || 0;
            const wxConn = environmentStatus?.weatherConnectionState || 'STANDBY';

            let badgeStyle = 'text-emerald-300 bg-emerald-950/60 border-emerald-800/40';
            let iconStyle = 'text-emerald-400';
            let label = `${wxCount} Weather / ${aqiCount} AQI Nodes (NWP & CAMS Models)`;
            let title = 'Open-Meteo & Copernicus CAMS numerical models; not direct station telemetry';

            if (wxConn === 'DISCONNECTED') {
              badgeStyle = 'text-rose-400 bg-rose-950/60 border-rose-800/40';
              iconStyle = 'text-rose-400';
              label = `Environment: Disconnected`;
              title = 'Open-Meteo provider connection failed';
            } else if (wxConn === 'RATE_LIMITED') {
              badgeStyle = 'text-amber-400 bg-amber-950/60 border-amber-800/40';
              iconStyle = 'text-amber-400';
              label = `Environment: Rate Limited`;
              title = 'Open-Meteo cooldown active';
            }

            return (
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${badgeStyle}`} title={title}>
                <CloudRain className={`w-3 h-3 ${iconStyle}`} />
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

          {/* Hydrology CWC Reservoir Monitoring Layer Toggle */}
          <button
            onClick={() => setShowHydrology(!showHydrology)}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1.5 ${
              showHydrology
                ? 'bg-teal-950/70 border-teal-500/50 text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.2)]'
                : 'bg-[#090d16] border-[#1e293b] text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Official CWC Water-Level & Reservoir Monitoring Layer"
          >
            <Droplets className="w-3 h-3" />
            Water: {showHydrology ? 'ON' : 'OFF'}
          </button>

          {/* USGS Earthquakes Seismic Layer Toggle */}
          <button
            onClick={() => setShowEarthquakes(!showEarthquakes)}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1.5 ${
              showEarthquakes
                ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                : 'bg-[#090d16] border-[#1e293b] text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle USGS Real-Time Global Seismic & Earthquake Hazard Layer"
          >
            <Activity className="w-3 h-3" />
            Seismic: {showEarthquakes ? 'ON' : 'OFF'}
          </button>

          {/* Environmental Weather & Air Quality Models Layer Toggle */}
          <button
            onClick={() => setShowEnvironment(!showEnvironment)}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition flex items-center gap-1.5 ${
              showEnvironment
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : 'bg-[#090d16] border-[#1e293b] text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Open-Meteo Weather & Copernicus CAMS Air Quality Models Layer"
          >
            <CloudRain className="w-3 h-3" />
            Atmosphere: {showEnvironment ? 'ON' : 'OFF'}
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

          {/* ================================================================= */}
          {/* OFFICIAL WATER-LEVEL & RESERVOIR MONITORING LAYER (CWC INDIA-WRIS) */}
          {/* ================================================================= */}
          {showHydrology && hydrologyStations.map((station) => {
            if (!station.latitude || !station.longitude) return null;
            const isSelected = selectedStationId === station.id;
            const props = station.properties || {};
            const liveStorageBmc = props.live_storage_bmc ?? station.latest_observation?.live_storage_bmc ?? props.live_storage;
            const liveStorageTmc = props.live_storage_tmc ?? station.latest_observation?.live_storage_tmc;
            const capacityBmc = props.capacity_bmc ?? station.latest_observation?.capacity_bmc;
            const capacityTmc = props.capacity_tmc ?? station.latest_observation?.capacity_tmc;
            const capacityPercent = props.capacity_percent ?? station.latest_observation?.capacity_percent;
            const obsTime = station.last_observed_at || station.latest_observation?.observed_at || station.last_updated_at;

            return (
              <Marker
                key={station.id}
                position={[station.latitude, station.longitude]}
                icon={createReservoirIcon(station, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedStationId(station.id);
                    zoomToLocation(station.latitude, station.longitude, 12);
                  },
                }}
              >
                {showPinNames && (
                  <Tooltip
                    direction="top"
                    offset={[0, -16]}
                    className="tactical-marker-tooltip"
                  >
                    <span>{station.name}</span>
                  </Tooltip>
                )}

                <Popup className="tactical-popup">
                  <div className="p-1 font-mono text-xs text-slate-200 min-w-[260px]">
                    {(() => {
                      const obsAgeDays = obsTime ? Math.max(0, Math.floor((Date.now() - new Date(obsTime).getTime()) / (1000 * 3600 * 24))) : null;
                      const isFresh = obsAgeDays != null && obsAgeDays <= 3;
                      const isStale = obsAgeDays != null && obsAgeDays > 3 && obsAgeDays <= 30;

                      let statusBadge = 'bg-slate-800 text-slate-300';
                      let statusText = `HISTORICAL ARCHIVE (${obsAgeDays ?? 'N/A'}d AGO)`;

                      if (isFresh) {
                        statusBadge = 'bg-emerald-950 text-emerald-300';
                        statusText = 'DAILY BULLETIN (FRESH)';
                      } else if (isStale) {
                        statusBadge = 'bg-amber-950 text-amber-300';
                        statusText = `STALE BULLETIN (${obsAgeDays}d AGO)`;
                      }

                      return (
                        <>
                          <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 flex items-center gap-1">
                              <Droplets className="w-3 h-3 text-teal-400" />
                              CWC / RESERVOIR
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${statusBadge}`}>
                              {statusText}
                            </span>
                          </div>

                          <div className="font-bold text-white text-sm mb-0.5 flex items-center justify-between">
                            <span>{station.name}</span>
                            <span className="text-[10px] font-mono text-cyan-400">
                              {capacityPercent != null ? `${capacityPercent}% FULL` : ''}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-400 mb-2">
                            {props.district ? `${props.district}, Karnataka` : 'Karnataka, India'}
                            {props.river ? ` • River ${props.river}` : ''}
                          </div>

                          {/* Storage Capacity Gauge Bar */}
                          {capacityPercent != null && (
                            <div className="my-2 bg-slate-900/90 p-2 rounded border border-slate-800">
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                <span>STORAGE CAPACITY:</span>
                                <span className="font-bold text-cyan-300">{capacityPercent}%</span>
                              </div>
                              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    capacityPercent >= 70 ? 'bg-cyan-400' : capacityPercent >= 40 ? 'bg-emerald-400' : 'bg-amber-400'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, capacityPercent))}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-1.5 my-2 text-[10px] bg-slate-900/90 p-2 rounded border border-slate-800">
                            <div>
                              <span className="text-slate-500">RECORDED STORAGE:</span>{' '}
                              <span className="text-cyan-400 font-bold">
                                {liveStorageBmc != null ? `${liveStorageBmc} BMC` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">STORAGE (TMC):</span>{' '}
                              <span className="text-teal-300 font-bold">
                                {liveStorageTmc != null ? `${liveStorageTmc} TMC` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">DESIGN CAPACITY:</span>{' '}
                              <span className="text-slate-300 font-bold">
                                {capacityBmc != null ? `${capacityBmc} BMC` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500">CAPACITY (TMC):</span>{' '}
                              <span className="text-slate-300 font-bold">
                                {capacityTmc != null ? `${capacityTmc} TMC` : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Source Provenance Banner */}
                          <div className="p-2 rounded bg-teal-950/30 border border-teal-900/40 text-[11px] mb-2">
                            <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">SOURCE PROVENANCE:</div>
                            <div className="text-teal-300 text-[10px] font-bold flex items-center gap-1">
                              <span>Central Water Commission (CWC)</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Portal: <span className="text-slate-200">National Water Informatics Centre / India-WRIS</span>
                            </div>
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              License: Open Government Data (OGD) India
                            </div>
                          </div>

                          <div className="text-[10px] text-slate-400 mb-2">
                            Observed Date: {obsTime ? `${obsTime.split('T')[0]} (${obsAgeDays ?? 'N/A'} days ago)` : 'N/A'}
                          </div>

                          <div className="flex gap-1.5">
                            <button
                              onClick={() => zoomToLocation(station.latitude, station.longitude, 14)}
                              className="w-full py-1.5 px-2 bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/50 text-teal-200 text-[10px] font-bold rounded transition flex items-center justify-center gap-1"
                              title="Zoom into reservoir dam site"
                            >
                              <Navigation className="w-3 h-3" />
                              FOCUS RESERVOIR
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ================================================================= */}
          {/* USGS REAL-TIME SEISMIC HAZARDS & EARTHQUAKE EPICENTER LAYER       */}
          {/* ================================================================= */}
          {showEarthquakes && earthquakes.map((eq) => {
            if (!eq.latitude || !eq.longitude) return null;
            const isSelected = selectedEarthquakeId === eq.id;
            const mag = eq.magnitude ?? (eq.properties?.magnitude ?? 0);
            const depth = eq.depth_km ?? (eq.properties?.depth_km ?? 0);
            const place = eq.place || eq.name || 'Seismic Epicenter';
            const status = eq.status || eq.properties?.status || 'preliminary';
            const originTime = eq.origin_time || eq.observed_at;

            return (
              <Marker
                key={eq.id}
                position={[eq.latitude, eq.longitude]}
                icon={createEarthquakeIcon(eq, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedEarthquakeId(eq.id);
                    zoomToLocation(eq.latitude, eq.longitude, 8);
                  },
                }}
              >
                {showPinNames && (
                  <Tooltip direction="top" offset={[0, -16]} className="tactical-marker-tooltip">
                    <span>M{typeof mag === 'number' ? mag.toFixed(1) : mag} - {place}</span>
                  </Tooltip>
                )}

                <Popup className="tactical-popup">
                  <div className="p-1 font-mono text-xs text-slate-200 min-w-[260px]">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 flex items-center gap-1">
                        <Activity className="w-3 h-3 text-amber-400" />
                        USGS / SEISMIC
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${status === 'reviewed' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-400'}`}>
                        {status.toUpperCase()}
                      </span>
                    </div>

                    <div className="font-bold text-white text-sm mb-0.5 flex items-center justify-between">
                      <span>M{typeof mag === 'number' ? mag.toFixed(1) : mag} Earthquake</span>
                      <span className="text-amber-400 text-xs font-mono">{eq.magType || 'seismic'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2 truncate" title={place}>
                      {place}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 bg-slate-900/60 p-2 rounded border border-slate-800 text-[11px] mb-2">
                      <div>
                        <span className="text-slate-500">DEPTH:</span>{' '}
                        <span className="text-amber-300 font-bold">{typeof depth === 'number' ? depth.toFixed(1) : depth} km</span>
                      </div>
                      <div>
                        <span className="text-slate-500">TSUNAMI:</span>{' '}
                        <span className={`font-bold ${eq.tsunami_alert ? 'text-rose-400' : 'text-slate-300'}`}>
                          {eq.tsunami_alert ? 'ALERT ACTIVE' : 'NO ALERT'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">LAT / LON:</span>{' '}
                        <span className="text-slate-300">{eq.latitude.toFixed(2)}, {eq.longitude.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">SIGNIFICANCE:</span>{' '}
                        <span className="text-cyan-400">{eq.significance ?? 'N/A'}</span>
                      </div>
                    </div>

                    {/* Source Provenance */}
                    <div className="p-2 rounded bg-amber-950/20 border border-amber-900/30 text-[11px] mb-2">
                      <div className="text-[9px] text-slate-400 uppercase font-bold mb-0.5">SOURCE PROVENANCE:</div>
                      <div className="text-amber-300 text-[10px] font-bold">U.S. Geological Survey (USGS)</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        Feed: Real-Time GeoJSON / Public Domain
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        Origin Time: {originTime ? new Date(originTime).toLocaleString() : 'N/A'}
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => zoomToLocation(eq.latitude, eq.longitude, 10)}
                        className="w-full py-1.5 px-2 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-[10px] font-bold rounded transition flex items-center justify-center gap-1"
                        title="Center map on seismic epicenter"
                      >
                        <Navigation className="w-3 h-3" />
                        FOCUS EPICENTER
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ================================================================= */}
          {/* OPEN-METEO WEATHER & AIR QUALITY OPERATIONAL MONITORING LAYER      */}
          {/* ================================================================= */}
          {showEnvironment && weatherNodes.map((wn) => {
            if (!wn.latitude || !wn.longitude) return null;
            const isSelected = selectedEnvNodeId === wn.id;
            const aqiNode = airQualityNodes.find(a => a.id.replace('AQI_NODE_', '') === wn.id.replace('WEATHER_NODE_', ''));

            return (
              <Marker
                key={wn.id}
                position={[wn.latitude, wn.longitude]}
                icon={createEnvironmentIcon(wn, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedEnvNodeId(wn.id);
                    zoomToLocation(wn.latitude, wn.longitude, 11);
                  },
                }}
              >
                {showPinNames && (
                  <Tooltip direction="top" offset={[0, -16]} className="tactical-marker-tooltip">
                    <span>{wn.name} ({wn.temperature_c ?? '--'}°C)</span>
                  </Tooltip>
                )}

                <Popup className="tactical-popup">
                  <div className="p-1 font-mono text-xs text-slate-200 min-w-[280px]">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 flex items-center gap-1">
                        <CloudRain className="w-3 h-3 text-emerald-400" />
                        NWP & CAMS MODELS
                      </span>
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        MODEL ESTIMATE
                      </span>
                    </div>

                    <div className="font-bold text-white text-sm mb-0.5">
                      {wn.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mb-2">
                      Coordinates: {wn.latitude.toFixed(3)}°N, {wn.longitude.toFixed(3)}°E
                    </div>

                    {/* Meteorological Conditions */}
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-900/60 p-2 rounded border border-slate-800 text-[11px] mb-2">
                      <div>
                        <span className="text-slate-500">TEMP:</span>{' '}
                        <span className="text-emerald-300 font-bold">{wn.temperature_c != null ? `${wn.temperature_c}°C` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">HUMIDITY:</span>{' '}
                        <span className="text-sky-300 font-bold">{wn.relative_humidity_pct != null ? `${wn.relative_humidity_pct}%` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">PRECIP:</span>{' '}
                        <span className="text-cyan-300 font-bold">{wn.precipitation_mm ?? 0} mm</span>
                      </div>
                      <div>
                        <span className="text-slate-500">PRESSURE:</span>{' '}
                        <span className="text-slate-300">{wn.surface_pressure_hpa != null ? `${wn.surface_pressure_hpa} hPa` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">WIND:</span>{' '}
                        <span className="text-amber-300 font-bold">{wn.wind_speed_kmh != null ? `${wn.wind_speed_kmh} km/h` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">DIRECTION:</span>{' '}
                        <span className="text-slate-300">{wn.wind_direction_deg != null ? `${wn.wind_direction_deg}°` : 'N/A'}</span>
                      </div>
                    </div>

                    {/* Air Quality Pollutants (Copernicus CAMS) */}
                    {aqiNode && (
                      <div className="grid grid-cols-2 gap-1.5 bg-teal-950/20 p-2 rounded border border-teal-900/30 text-[11px] mb-2">
                        <div>
                          <span className="text-slate-500">US AQI:</span>{' '}
                          <span className="text-teal-300 font-bold">{aqiNode.us_aqi ?? 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">EU AQI:</span>{' '}
                          <span className="text-teal-300">{aqiNode.european_aqi ?? 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">PM2.5:</span>{' '}
                          <span className="text-amber-300 font-bold">{aqiNode.pm2_5_ugm3 != null ? `${aqiNode.pm2_5_ugm3} μg/m³` : 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">PM10:</span>{' '}
                          <span className="text-slate-300">{aqiNode.pm10_ugm3 != null ? `${aqiNode.pm10_ugm3} μg/m³` : 'N/A'}</span>
                        </div>
                      </div>
                    )}

                    {/* Truth in Labeling Warning */}
                    <div className="p-2 rounded bg-amber-950/20 border border-amber-900/30 text-[10px] text-amber-300/90 mb-2">
                      ⚠️ <span className="font-bold">Model Truth:</span> Derived from ECMWF/GFS weather prediction & Copernicus Atmosphere Monitoring Service (CAMS). Not direct physical sensor telemetry.
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => zoomToLocation(wn.latitude, wn.longitude, 12)}
                        className="w-full py-1.5 px-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-200 text-[10px] font-bold rounded transition flex items-center justify-center gap-1"
                        title="Center map on environmental node"
                      >
                        <Navigation className="w-3 h-3" />
                        FOCUS NODE
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
            <span className="w-2 h-2 rounded-full bg-[#a855f7]"></span> Tug / Service
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            | Aircraft: <span className="w-2 h-2 rounded-full bg-[#06b6d4] inline-block"></span> FL250+ <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block"></span> FL100-250 <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block"></span> &lt;FL100
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            | Water: <span className="w-2 h-2 rounded-full bg-[#06b6d4] inline-block"></span> &gt;70% <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block"></span> 40-70% <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block"></span> &lt;40%
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            | Seismic: <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block"></span> M5+ <span className="w-2 h-2 rounded-full bg-[#f59e0b] inline-block"></span> M4+ <span className="w-2 h-2 rounded-full bg-[#38bdf8] inline-block"></span> &lt;M4
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            | Atmosphere: <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block"></span> NWP/CAMS Model
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
