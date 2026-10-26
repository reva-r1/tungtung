import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { LocationRecord, MovingEntity, MaritimePattern, DataMode } from '../../types';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { MaritimePatternModal } from '../maritime/MaritimePatternModal';
import {
  Compass,
  Layers,
  X,
  Navigation,
  TrendingUp,
} from 'lucide-react';

interface TacticalMapProps {
  locations?: LocationRecord[];
  className?: string;
  selectedLocationId?: string;
  onSelectEntity?: (entityId: string) => void;
}

interface InspectorState {
  id: string;
  title: string;
  type: string;
  data_mode: DataMode;
  statusDot: 'ok' | 'warn' | 'danger' | 'muted';
  lat: number;
  lng: number;
  lastUpdated: string;
  keyValues: { label: string; value: string | number }[];
  hasTrail: boolean;
  entityType: 'vessel' | 'aircraft' | 'facility' | 'reservoir' | 'earthquake' | 'environment';
}

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Color categorization for vessels
const getVesselColor = (type?: string): string => {
  if (!type) return '#38bdf8';
  const t = type.toLowerCase();
  if (t.includes('tanker') || t.includes('crude') || t.includes('oil') || t.includes('chemical') || t.includes('lpg')) {
    return '#f59e0b'; // Amber (Tankers)
  }
  if (t.includes('container') || t.includes('cargo')) {
    return '#10b981'; // Emerald (Container/Cargo)
  }
  if (t.includes('bulk')) {
    return '#06b6d4'; // Cyan (Bulk carriers)
  }
  if (t.includes('tug') || t.includes('support') || t.includes('pilot')) {
    return '#a855f7'; // Purple (Tug/Service)
  }
  return '#38bdf8';
};

// Facility color
const getFacilityColor = (type: string): string => {
  switch (type) {
    case 'WAREHOUSE': return '#10b981';
    case 'PORT': return '#4C90F0';
    case 'CHECKPOINT': return '#06b6d4';
    case 'TOLL_PLAZA': return '#f5a524';
    case 'INCIDENT_SITE': return '#e5484d';
    case 'TRANSIT_POINT': return '#a855f7';
    default: return '#8B9097';
  }
};

// 10-12px flat marker generators with 1.5px dark outline (#0E0F11) or 2px accent (#4C90F0) on selection
const createVesselIcon = (vessel: MovingEntity, isSelected: boolean, currentZoom: number): L.DivIcon => {
  if (currentZoom < 5) {
    return L.divIcon({ className: '', html: '', iconSize: [0, 0] });
  }
  const color = getVesselColor(vessel.vessel_type);
  const heading = vessel.heading ?? vessel.course ?? 0;
  const stroke = isSelected ? '#4C90F0' : '#0E0F11';
  const strokeWidth = isSelected ? '2' : '1.5';

  return L.divIcon({
    className: '',
    html: `
      <div style="width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg);">
        <svg width="12" height="12" viewBox="0 0 12 12" style="overflow: visible;">
          <polygon points="6,1 11,11 6,8.5 1,11" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
        </svg>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const createAircraftIcon = (aircraft: MovingEntity, isSelected: boolean): L.DivIcon => {
  const altitude = aircraft.properties?.altitude_ft ?? aircraft.properties?.geo_altitude ?? 0;
  let color = '#f59e0b';
  if (altitude >= 25000) color = '#06b6d4';
  else if (altitude >= 10000) color = '#10b981';

  const heading = aircraft.heading ?? aircraft.course ?? 0;
  const stroke = isSelected ? '#4C90F0' : '#0E0F11';
  const strokeWidth = isSelected ? '2' : '1.5';

  return L.divIcon({
    className: '',
    html: `
      <div style="width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg);">
        <svg width="12" height="12" viewBox="0 0 12 12" style="overflow: visible;">
          <path d="M6,1 L11,10 L6,7.5 L1,10 Z" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
        </svg>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const createFacilityIcon = (type: string, isSelected: boolean): L.DivIcon => {
  const color = getFacilityColor(type);
  const stroke = isSelected ? '#4C90F0' : '#0E0F11';
  const strokeWidth = isSelected ? '2' : '1.5';

  return L.divIcon({
    className: '',
    html: `
      <div style="width: 12px; height: 12px;">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="1" width="10" height="10" rx="1" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />
        </svg>
      </div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const createWaterGaugeIcon = (fillPct: number, isSelected: boolean): L.DivIcon => {
  let color = '#f59e0b';
  if (fillPct >= 70) color = '#06b6d4';
  else if (fillPct >= 40) color = '#10b981';

  const stroke = isSelected ? '#4C90F0' : '#0E0F11';
  const strokeWidth = isSelected ? '2' : '1.5';

  return L.divIcon({
    className: '',
    html: `
      <div style="width: 12px; height: 12px;">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <polygon points="6,1 11,6 6,11 1,6" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" />
        </svg>
      </div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const createQuakeIcon = (magnitude: number, isSelected: boolean): L.DivIcon => {
  const size = Math.max(8, Math.min(20, Math.round(magnitude * 2.8)));
  const half = size / 2;
  let color = '#38bdf8';
  if (magnitude >= 5.0) color = '#e5484d';
  else if (magnitude >= 4.0) color = '#f5a524';

  const stroke = isSelected ? '#4C90F0' : '#0E0F11';
  const strokeWidth = isSelected ? '2' : '1.5';

  return L.divIcon({
    className: '',
    html: `
      <div style="width: ${size}px; height: ${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${half}" cy="${half}" r="${Math.max(1, half - 1.5)}" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" />
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
};

const createEnvIcon = (isSelected: boolean): L.DivIcon => {
  const stroke = isSelected ? '#4C90F0' : '#0E0F11';
  const strokeWidth = isSelected ? '2' : '1.5';

  return L.divIcon({
    className: '',
    html: `
      <div style="width: 10px; height: 10px;">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="3.5" fill="#3DB46D" stroke="${stroke}" stroke-width="${strokeWidth}" />
        </svg>
      </div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
};

// Map View Controller
const MapFlyController: React.FC<{ target: { lat: number; lng: number; zoom?: number; id: number } | null }> = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom || map.getZoom(), {
        duration: 1.2,
      });
    }
  }, [target, map]);
  return null;
};

// Map Zoom Listener to trigger cluster rendering & zoom thresholds
const MapZoomTracker: React.FC<{ onZoomChange: (zoom: number) => void }> = ({ onZoomChange }) => {
  const map = useMap();
  useEffect(() => {
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    map.on('zoomend', handleZoom);
    onZoomChange(map.getZoom());
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map, onZoomChange]);
  return null;
};

// Cluster Layer for Land Facilities
const FacilityClusterLayer: React.FC<{
  locations: LocationRecord[];
  selectedId: string | null;
  onSelect: (loc: LocationRecord) => void;
}> = ({ locations, selectedId, onSelect }) => {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 35,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        return L.divIcon({
          html: `<div class="flat-cluster-badge" style="width: 24px; height: 24px; line-height: 24px; text-align: center;">${count}</div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      },
    });

    clusterRef.current = cluster;
    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [map]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();

    locations.forEach((loc) => {
      const isSelected = selectedId === loc.id;
      const icon = createFacilityIcon(loc.type, isSelected);
      const marker = L.marker([loc.latitude, loc.longitude], { icon });

      marker.bindTooltip(`<span>${loc.name}</span>`, {
        direction: 'top',
        offset: [0, -10],
        opacity: 1,
        className: 'flat-map-tooltip',
      });

      marker.on('click', () => {
        onSelect(loc);
      });

      cluster.addLayer(marker);
    });
  }, [locations, selectedId, onSelect]);

  return null;
};

// Cluster Layer for Maritime AIS Vessels
const VesselClusterLayer: React.FC<{
  vessels: MovingEntity[];
  currentZoom: number;
  selectedId: string | null;
  onSelect: (vessel: MovingEntity) => void;
}> = ({ vessels, currentZoom, selectedId, onSelect }) => {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 40,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        return L.divIcon({
          html: `<div class="flat-cluster-badge" style="width: 24px; height: 24px; line-height: 24px; text-align: center;">${count}</div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      },
    });

    clusterRef.current = cluster;
    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [map]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();

    vessels.forEach((vessel) => {
      const isSelected = selectedId === vessel.id;
      const icon = createVesselIcon(vessel, isSelected, currentZoom);
      const marker = L.marker([vessel.latitude, vessel.longitude], { icon });

      if (currentZoom >= 5) {
        marker.bindTooltip(`<span>${vessel.name || vessel.id}</span>`, {
          direction: 'top',
          offset: [0, -10],
          opacity: 1,
          className: 'flat-map-tooltip',
        });
      }

      marker.on('click', () => {
        onSelect(vessel);
      });

      cluster.addLayer(marker);
    });
  }, [vessels, currentZoom, selectedId, onSelect]);

  return null;
};

// Cluster Layer for Aircraft
const AircraftClusterLayer: React.FC<{
  aircraftList: MovingEntity[];
  currentZoom: number;
  selectedId: string | null;
  onSelect: (aircraft: MovingEntity) => void;
}> = ({ aircraftList, currentZoom, selectedId, onSelect }) => {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 40,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        return L.divIcon({
          html: `<div class="flat-cluster-badge" style="width: 24px; height: 24px; line-height: 24px; text-align: center;">${count}</div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      },
    });

    clusterRef.current = cluster;
    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
    };
  }, [map]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();

    // Hide aircraft below zoom 6
    if (currentZoom < 6) {
      return;
    }

    aircraftList.forEach((ac) => {
      const isSelected = selectedId === ac.id;
      const icon = createAircraftIcon(ac, isSelected);
      const marker = L.marker([ac.latitude, ac.longitude], { icon });

      marker.bindTooltip(`<span>${ac.name || ac.id}</span>`, {
        direction: 'top',
        offset: [0, -10],
        opacity: 1,
        className: 'flat-map-tooltip',
      });

      marker.on('click', () => {
        onSelect(ac);
      });

      cluster.addLayer(marker);
    });
  }, [aircraftList, currentZoom, selectedId, onSelect]);

  return null;
};

export const TacticalMap: React.FC<TacticalMapProps> = ({
  locations: propLocations,
  className = '',
  selectedLocationId,
  onSelectEntity,
}) => {
  const { quickNavigateToEntity, isMapEnabled, toggleMap, selectedEntityId } = useInvestigation();

  // Pure Data Mode States (when map is OFF)
  const [telemetryFilter, setTelemetryFilter] = useState<'all' | 'vessels' | 'aircraft' | 'facilities' | 'earthquakes'>('all');
  const [telemetrySearch, setTelemetrySearch] = useState<string>('');

  // Core Data State
  const [locations, setLocations] = useState<LocationRecord[]>(propLocations || []);
  const [vessels, setVessels] = useState<MovingEntity[]>([]);
  const [aircraftList, setAircraftList] = useState<MovingEntity[]>([]);
  const [hydrologyStations, setHydrologyStations] = useState<any[]>([]);
  const [earthquakes, setEarthquakes] = useState<any[]>([]);
  const [weatherNodes, setWeatherNodes] = useState<any[]>([]);
  const [airQualityNodes, setAirQualityNodes] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<MaritimePattern[]>([]);
  const [activePatternModal, setActivePatternModal] = useState<MaritimePattern | null>(null);

  // Status Feeds
  const [maritimeStatus, setMaritimeStatus] = useState<{ connected: boolean; source: string; mode: string } | null>(null);
  const [aviationStatus, setAviationStatus] = useState<any | null>(null);
  const [earthquakeStatus, setEarthquakeStatus] = useState<any | null>(null);

  // Map Controls State
  const [mapMode, setMapMode] = useState<'DARK' | 'STREET' | 'SATELLITE'>('DARK');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showVessels, setShowVessels] = useState<boolean>(true);
  const [showAircraft, setShowAircraft] = useState<boolean>(true);
  const [showHydrology, setShowHydrology] = useState<boolean>(true);
  const [showEarthquakes, setShowEarthquakes] = useState<boolean>(true);
  const [showAtmosphere, setShowAtmosphere] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [showLayersPanel, setShowLayersPanel] = useState<boolean>(false);

  // Map Navigation & Zoom
  const [currentZoom, setCurrentZoom] = useState<number>(6);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number; id: number } | null>(null);

  // Inspector State
  const [selectedEntity, setSelectedEntity] = useState<InspectorState | null>(null);
  const [vesselTrack, setVesselTrack] = useState<[number, number][]>([]);

  // Esc key listener to close Inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEntity(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Initial Data Fetching
  useEffect(() => {
    if (!propLocations) {
      api.getLocations().then(setLocations).catch(console.error);
    } else {
      setLocations(propLocations);
    }

    api.getMaritimeStatus().then(setMaritimeStatus).catch(() => setMaritimeStatus({ connected: false, source: 'AISStream.io', mode: 'STANDBY' }));

    const refreshAviation = () => {
      api.getAviationStatus().then(setAviationStatus).catch(() => setAviationStatus(null));
    };
    refreshAviation();
    const aviationInterval = setInterval(refreshAviation, 15000);

    const refreshSeismic = () => {
      api.getEarthquakeStatus().then(setEarthquakeStatus).catch(() => setEarthquakeStatus(null));
      api.getEarthquakeEvents(100).then((data) => {
        if (data?.events) setEarthquakes(data.events);
      }).catch(console.error);
    };
    refreshSeismic();
    const seismicInterval = setInterval(refreshSeismic, 20000);

    const refreshEnv = () => {
      api.getWeatherNodes().then((data) => {
        if (data?.nodes) setWeatherNodes(data.nodes);
      }).catch(console.error);
      api.getAirQualityNodes().then((data) => {
        if (data?.nodes) setAirQualityNodes(data.nodes);
      }).catch(console.error);
    };
    refreshEnv();
    const envInterval = setInterval(refreshEnv, 30000);

    api.getMaritimeVessels(300).then((data) => {
      if (data?.vessels) setVessels(data.vessels);
    }).catch(console.error);

    api.getAviationAircraft(300).then((data) => {
      if (data?.aircraft) setAircraftList(data.aircraft);
    }).catch(console.error);

    api.getHydrologyStations().then((data) => {
      if (data?.stations) setHydrologyStations(data.stations);
    }).catch(console.error);

    api.getMaritimePatterns().then((data) => {
      if (data?.patterns) setPatterns(data.patterns);
    }).catch(console.error);

    return () => {
      clearInterval(aviationInterval);
      clearInterval(seismicInterval);
      clearInterval(envInterval);
    };
  }, [propLocations]);

  // Auto-focus selected location or entity from Knowledge Graph or context
  useEffect(() => {
    const targetId = selectedLocationId || selectedEntityId;
    if (!targetId) return;

    const loc = locations.find((l) => l.id === targetId || l.name === targetId);
    if (loc) {
      handleSelectFacility(loc);
      setFlyTarget({ lat: loc.latitude, lng: loc.longitude, zoom: 14, id: Date.now() });
      return;
    }

    const v = vessels.find((v) => v.id === targetId || v.mmsi === targetId || v.name === targetId);
    if (v) {
      handleSelectVessel(v);
      setFlyTarget({ lat: v.latitude, lng: v.longitude, zoom: 12, id: Date.now() });
      return;
    }
  }, [selectedLocationId, selectedEntityId, locations, vessels]);

  // 2. Real-Time Moving Entity Stream via SSE
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
        } catch (_) {}
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

            if (selectedEntity?.id === update.id) {
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

            if (selectedEntity?.id === update.id || (selectedEntity && selectedEntity.id.endsWith(update.mmsi || ''))) {
              setVesselTrack((prev) => [...prev, [update.latitude, update.longitude]]);
            }
          }
        } catch (_) {}
      });
    } catch (err) {
      console.error('SSE connection error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [selectedEntity]);

  // Derived Data Modes
  const vesselDataMode: DataMode = maritimeStatus?.connected ? 'LIVE' : 'REPLAY';
  const aircraftDataMode: DataMode = aviationStatus?.operationalState === 'CONNECTED_FRESH' ? 'LIVE' : 'REPLAY';
  const waterDataMode: DataMode = 'REPLAY';
  const seismicDataMode: DataMode = earthquakeStatus?.operationalState === 'CONNECTED_FRESH' ? 'LIVE' : 'REPLAY';
  const atmosphereDataMode: DataMode = 'SIMULATED';

  // Selection Handlers
  const handleSelectVessel = useCallback(async (vessel: MovingEntity) => {
    const isMoving = (vessel.speed || 0) > 0.5;
    const mode = maritimeStatus?.connected ? 'LIVE' : (vessel.data_mode || 'REPLAY');

    setSelectedEntity({
      id: vessel.id,
      title: vessel.name || vessel.id,
      type: vessel.vessel_type || 'Ship',
      data_mode: mode,
      statusDot: isMoving ? 'ok' : 'muted',
      lat: vessel.latitude,
      lng: vessel.longitude,
      lastUpdated: vessel.last_updated_at || 'Recent',
      hasTrail: true,
      entityType: 'vessel',
      keyValues: [
        { label: 'MMSI', value: vessel.mmsi || 'N/A' },
        { label: 'IMO', value: vessel.imo || 'N/A' },
        { label: 'Speed', value: vessel.speed ? `${vessel.speed} kts` : '0 kts' },
        { label: 'Course', value: `${vessel.course ?? vessel.heading ?? 0}°` },
        { label: 'Heading', value: `${vessel.heading ?? 0}°` },
        { label: 'Destination', value: vessel.destination || 'Unspecified' },
        { label: 'Status', value: vessel.status || (isMoving ? 'Underway' : 'At Anchor') },
        { label: 'Coordinates', value: `${vessel.latitude.toFixed(4)}, ${vessel.longitude.toFixed(4)}` },
      ],
    });

    try {
      const trackRes = await api.getMaritimeVesselTrack(vessel.id, 64);
      if (trackRes?.track && trackRes.track.length > 0) {
        setVesselTrack(trackRes.track.map((t) => [t.latitude, t.longitude]));
      } else {
        setVesselTrack([[vessel.latitude, vessel.longitude]]);
      }
    } catch (_) {
      setVesselTrack([[vessel.latitude, vessel.longitude]]);
    }
  }, [maritimeStatus]);

  const handleSelectAircraft = useCallback(async (aircraft: MovingEntity) => {
    const mode: DataMode = aviationStatus?.operationalState === 'CONNECTED_FRESH' ? 'LIVE' : 'REPLAY';
    const altitude = aircraft.properties?.altitude_ft ?? aircraft.properties?.geo_altitude;

    setSelectedEntity({
      id: aircraft.id,
      title: aircraft.name || aircraft.id,
      type: 'Aircraft',
      data_mode: mode,
      statusDot: mode === 'LIVE' ? 'ok' : 'muted',
      lat: aircraft.latitude,
      lng: aircraft.longitude,
      lastUpdated: aircraft.last_updated_at || 'Recent',
      hasTrail: true,
      entityType: 'aircraft',
      keyValues: [
        { label: 'Callsign', value: aircraft.name || 'N/A' },
        { label: 'ICAO24', value: aircraft.properties?.icao24 || aircraft.id.replace('AIRCRAFT_', '') },
        { label: 'Altitude', value: altitude ? `${altitude.toLocaleString()} ft` : 'Ground' },
        { label: 'Velocity', value: aircraft.speed ? `${aircraft.speed} kts` : '0 kts' },
        { label: 'Heading', value: `${aircraft.heading ?? aircraft.course ?? 0}°` },
        { label: 'Vertical rate', value: aircraft.properties?.vertical_rate ? `${aircraft.properties.vertical_rate} m/s` : 'Level' },
        { label: 'Country', value: aircraft.properties?.origin_country || 'Unknown' },
        { label: 'Coordinates', value: `${aircraft.latitude.toFixed(4)}, ${aircraft.longitude.toFixed(4)}` },
      ],
    });

    try {
      const trackRes = await api.getAviationAircraftTrack(aircraft.id, 64);
      if (trackRes?.track && trackRes.track.length > 0) {
        setVesselTrack(trackRes.track.map((t) => [t.latitude, t.longitude]));
      } else {
        setVesselTrack([[aircraft.latitude, aircraft.longitude]]);
      }
    } catch (_) {
      setVesselTrack([[aircraft.latitude, aircraft.longitude]]);
    }
  }, [aviationStatus]);

  const handleSelectFacility = useCallback((loc: LocationRecord) => {
    setSelectedEntity({
      id: loc.id,
      title: loc.name,
      type: loc.type,
      data_mode: 'REPLAY',
      statusDot: 'muted',
      lat: loc.latitude,
      lng: loc.longitude,
      lastUpdated: 'Static record',
      hasTrail: false,
      entityType: 'facility',
      keyValues: [
        { label: 'Type', value: loc.type },
        { label: 'City', value: loc.city },
        { label: 'State', value: loc.state },
        { label: 'Country', value: loc.country },
        { label: 'Address', value: loc.address || 'N/A' },
        { label: 'Coordinates', value: `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` },
      ],
    });
    setVesselTrack([]);
  }, []);

  const handleSelectReservoir = useCallback((station: any) => {
    const pct = station.percentage_full ?? 0;
    setSelectedEntity({
      id: station.id,
      title: station.name || station.station_name,
      type: 'Reservoir',
      data_mode: waterDataMode,
      statusDot: pct >= 40 ? 'ok' : 'warn',
      lat: station.latitude,
      lng: station.longitude,
      lastUpdated: station.bulletin_date || 'Archived bulletin',
      hasTrail: false,
      entityType: 'reservoir',
      keyValues: [
        { label: 'Basin', value: station.river_basin || 'N/A' },
        { label: 'Current storage', value: `${station.current_storage_mcm ?? station.storage_mcm ?? 0} MCM` },
        { label: 'Capacity', value: `${station.full_reservoir_level_mcm ?? station.capacity_mcm ?? 0} MCM` },
        { label: 'Storage level', value: `${pct}%` },
        { label: 'Coordinates', value: `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}` },
      ],
    });
    setVesselTrack([]);
  }, [waterDataMode]);

  const handleSelectEarthquake = useCallback((eq: any) => {
    setSelectedEntity({
      id: eq.id,
      title: eq.place || `M${eq.magnitude} Seismic Event`,
      type: 'Earthquake',
      data_mode: seismicDataMode,
      statusDot: eq.magnitude >= 5 ? 'danger' : 'warn',
      lat: eq.latitude,
      lng: eq.longitude,
      lastUpdated: eq.time ? new Date(eq.time).toISOString() : 'Recent',
      hasTrail: false,
      entityType: 'earthquake',
      keyValues: [
        { label: 'Magnitude', value: `M ${eq.magnitude?.toFixed(1) ?? 'N/A'}` },
        { label: 'Depth', value: `${eq.depth_km ?? eq.depth ?? 0} km` },
        { label: 'Location', value: eq.place || 'Unknown' },
        { label: 'Coordinates', value: `${eq.latitude.toFixed(4)}, ${eq.longitude.toFixed(4)}` },
      ],
    });
    setVesselTrack([]);
  }, [seismicDataMode]);

  const handleSelectEnvironment = useCallback((node: any) => {
    setSelectedEntity({
      id: node.id,
      title: node.name,
      type: 'Atmosphere Model',
      data_mode: atmosphereDataMode,
      statusDot: 'muted',
      lat: node.latitude,
      lng: node.longitude,
      lastUpdated: node.updated_at || 'Forecast step',
      hasTrail: false,
      entityType: 'environment',
      keyValues: [
        { label: 'Temperature', value: node.temperature_c != null ? `${node.temperature_c}°C` : 'N/A' },
        { label: 'Humidity', value: node.relative_humidity_pct != null ? `${node.relative_humidity_pct}%` : 'N/A' },
        { label: 'Precipitation', value: `${node.precipitation_mm ?? 0} mm` },
        { label: 'Pressure', value: node.surface_pressure_hpa != null ? `${node.surface_pressure_hpa} hPa` : 'N/A' },
        { label: 'Wind speed', value: node.wind_speed_kmh != null ? `${node.wind_speed_kmh} km/h` : 'N/A' },
        { label: 'Coordinates', value: `${node.latitude.toFixed(4)}, ${node.longitude.toFixed(4)}` },
      ],
    });
    setVesselTrack([]);
  }, [atmosphereDataMode]);

  // Center on Indian Ocean / Subcontinent
  const defaultCenter: [number, number] = locations.length > 0
    ? [locations[0].latitude, locations[0].longitude]
    : [13.0, 80.2];

  const malaccaPattern = patterns.find((p) => p.region.includes('Malacca')) || patterns[0];

  const handleCenterSelected = () => {
    if (selectedEntity) {
      setFlyTarget({
        lat: selectedEntity.lat,
        lng: selectedEntity.lng,
        zoom: Math.max(currentZoom, 13),
        id: Date.now(),
      });
    }
  };

  const handleOpenInGraph = () => {
    if (selectedEntity) {
      if (onSelectEntity) {
        onSelectEntity(selectedEntity.id);
      } else {
        quickNavigateToEntity(selectedEntity.id, 'investigation');
      }
    }
  };

  // Filtered telemetry list for pure data mode (when map is OFF)
  const getCombinedTelemetryData = () => {
    let list: Array<{
      id: string;
      title: string;
      category: 'VESSEL' | 'AIRCRAFT' | 'FACILITY' | 'SEISMIC';
      type: string;
      lat: number;
      lng: number;
      metrics: string;
      mode: string;
      original: any;
    }> = [];

    if (telemetryFilter === 'all' || telemetryFilter === 'vessels') {
      vessels.forEach((v) => {
        list.push({
          id: v.id,
          title: v.name || v.id,
          category: 'VESSEL',
          type: v.vessel_type || 'Ship',
          lat: v.latitude,
          lng: v.longitude,
          metrics: `Speed: ${v.speed ?? 0} kts • Course: ${v.course ?? v.heading ?? 0}° • Draught: ${v.properties?.draught ?? 'N/A'} m`,
          mode: v.data_mode || (maritimeStatus?.connected ? 'LIVE' : 'REPLAY'),
          original: v,
        });
      });
    }

    if (telemetryFilter === 'all' || telemetryFilter === 'aircraft') {
      aircraftList.forEach((a) => {
        list.push({
          id: a.id,
          title: a.name || a.id,
          category: 'AIRCRAFT',
          type: 'Aircraft',
          lat: a.latitude,
          lng: a.longitude,
          metrics: `Alt: ${a.properties?.altitude_ft ?? a.properties?.geo_altitude ?? 0} ft • Speed: ${a.speed ?? 0} kts • Country: ${a.properties?.origin_country || 'N/A'}`,
          mode: aviationStatus?.operationalState === 'CONNECTED_FRESH' ? 'LIVE' : 'REPLAY',
          original: a,
        });
      });
    }

    if (telemetryFilter === 'all' || telemetryFilter === 'facilities') {
      locations.forEach((loc) => {
        list.push({
          id: loc.id,
          title: loc.name,
          category: 'FACILITY',
          type: loc.type,
          lat: loc.latitude,
          lng: loc.longitude,
          metrics: `City: ${loc.city || 'N/A'} • State: ${loc.state || 'N/A'} • Country: ${loc.country || 'N/A'}`,
          mode: 'RECORD',
          original: loc,
        });
      });
    }

    if (telemetryFilter === 'all' || telemetryFilter === 'earthquakes') {
      earthquakes.forEach((eq) => {
        list.push({
          id: eq.id,
          title: eq.place || `M${eq.magnitude} Seismic Event`,
          category: 'SEISMIC',
          type: 'Earthquake',
          lat: eq.latitude,
          lng: eq.longitude,
          metrics: `Magnitude: M${eq.magnitude?.toFixed(1) ?? 'N/A'} • Depth: ${eq.depth_km ?? eq.depth ?? 0} km`,
          mode: seismicDataMode,
          original: eq,
        });
      });
    }

    if (telemetrySearch.trim()) {
      const q = telemetrySearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.metrics.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const handleItemClick = (item: any) => {
    if (item.category === 'VESSEL') handleSelectVessel(item.original);
    else if (item.category === 'AIRCRAFT') handleSelectAircraft(item.original);
    else if (item.category === 'FACILITY') handleSelectFacility(item.original);
    else if (item.category === 'SEISMIC') handleSelectEarthquake(item.original);
  };

  return (
    <div className={`relative flex flex-col h-full bg-bg rounded overflow-hidden select-none ${className}`}>
      {/* Pattern Modal */}
      {activePatternModal && (
        <MaritimePatternModal
          pattern={activePatternModal}
          onClose={() => setActivePatternModal(null)}
          onSelectCorridor={(region) => {
            if (region.includes('Malacca')) {
              setFlyTarget({ lat: 3.2, lng: 100.5, zoom: 7, id: Date.now() });
            }
            setActivePatternModal(null);
          }}
        />
      )}

      {/* 1. Slim Header Row (36px) */}
      <div className="h-9 px-3 bg-panel border-b border-line flex items-center justify-between z-10 shrink-0 text-[13px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-fg">{isMapEnabled ? 'Geospatial Radar Map' : 'Telemetry & Geospatial Data'}</span>
          <span className="text-line">·</span>
          <span className="text-muted truncate">
            {vessels.length} vessels · {aircraftList.length} aircraft · {earthquakes.length} quakes · {locations.length} facilities
          </span>
          {malaccaPattern && (
            <button
              onClick={() => setActivePatternModal(malaccaPattern)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-fg ml-3 transition"
              title="View detected corridor pattern"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-warn" />
              <span>Malacca pattern alert</span>
            </button>
          )}
        </div>

        {/* Global Map Toggle Button (Default: OFF) */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMap}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition cursor-pointer ${
              isMapEnabled
                ? 'bg-cyan-950/70 border-cyan-500/80 text-cyan-300'
                : 'bg-[#1C1E21] border-[#26292D] text-[#8B9097] hover:text-[#E6E7E9] hover:border-[#3E4247]'
            }`}
            title={isMapEnabled ? 'Map is ON — click to turn OFF map and switch to fast Data Mode' : 'Map is OFF (Data Mode) — click to enable map'}
          >
            <span>{isMapEnabled ? 'Map Canvas: ON' : 'Map Canvas: OFF'}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${isMapEnabled ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          </button>
        </div>
      </div>

      {/* Map Canvas Container / Pure Data View */}
      <div className="flex-1 w-full h-full relative z-0 flex flex-col overflow-hidden">
        {isMapEnabled ? (
          <>
            <MapContainer
          center={defaultCenter}
          zoom={6}
          minZoom={3}
          maxZoom={20}
          scrollWheelZoom={true}
          zoomControl={true}
          className="w-full h-full"
          style={{ background: '#0E0F11' }}
        >
          {/* Zoom State Tracker */}
          <MapZoomTracker onZoomChange={setCurrentZoom} />

          {/* Active Fly Controller */}
          <MapFlyController target={flyTarget} />

          {/* Basemaps */}
          {mapMode === 'DARK' && (
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
          )}

          {mapMode === 'STREET' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          {mapMode === 'SATELLITE' && (
            <TileLayer
              attribution='Tiles &copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          {/* Optional Labels Overlay */}
          {showLabels && mapMode === 'DARK' && (
            <TileLayer
              attribution='&copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
              opacity={0.85}
            />
          )}

          {showLabels && mapMode === 'SATELLITE' && (
            <TileLayer
              attribution='&copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              opacity={0.8}
            />
          )}

          {/* Static Land Facilities Cluster Layer */}
          <FacilityClusterLayer
            locations={locations}
            selectedId={selectedEntity?.id || null}
            onSelect={handleSelectFacility}
          />

          {/* Maritime AIS Vessels Cluster Layer */}
          {showVessels && (
            <VesselClusterLayer
              vessels={vessels}
              currentZoom={currentZoom}
              selectedId={selectedEntity?.id || null}
              onSelect={handleSelectVessel}
            />
          )}

          {/* Aircraft ADS-B Cluster Layer (hidden < zoom 6) */}
          {showAircraft && (
            <AircraftClusterLayer
              aircraftList={aircraftList}
              currentZoom={currentZoom}
              selectedId={selectedEntity?.id || null}
              onSelect={handleSelectAircraft}
            />
          )}

          {/* Historical Trail Polyline */}
          {showTrails && vesselTrack.length > 1 && (
            <>
              <Polyline
                positions={vesselTrack}
                pathOptions={{
                  color: '#4C90F0',
                  weight: 2,
                  dashArray: '3, 5',
                  opacity: 0.85,
                }}
              />
              {vesselTrack.map((pt, i) => (
                <CircleMarker
                  key={i}
                  center={pt}
                  radius={i === vesselTrack.length - 1 ? 3 : 1.5}
                  pathOptions={{
                    color: '#4C90F0',
                    fillColor: '#4C90F0',
                    fillOpacity: 0.9,
                    weight: 1,
                  }}
                />
              ))}
            </>
          )}

          {/* Water Gauges Layer */}
          {showHydrology && hydrologyStations.map((station) => (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={createWaterGaugeIcon(station.percentage_full ?? 50, selectedEntity?.id === station.id)}
              eventHandlers={{
                click: () => handleSelectReservoir(station),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1} className="flat-map-tooltip">
                <span>{station.name || station.station_name} ({station.percentage_full ?? 0}%)</span>
              </Tooltip>
            </Marker>
          ))}

          {/* Seismic / USGS Earthquakes Layer */}
          {showEarthquakes && earthquakes.map((eq) => (
            <Marker
              key={eq.id}
              position={[eq.latitude, eq.longitude]}
              icon={createQuakeIcon(eq.magnitude ?? 4.0, selectedEntity?.id === eq.id)}
              eventHandlers={{
                click: () => handleSelectEarthquake(eq),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1} className="flat-map-tooltip">
                <span>M {eq.magnitude?.toFixed(1) ?? 'N/A'} - {eq.place || 'Seismic event'}</span>
              </Tooltip>
            </Marker>
          ))}

          {/* Environmental Atmosphere Model Nodes */}
          {showAtmosphere && weatherNodes.map((wn) => (
            <Marker
              key={wn.id}
              position={[wn.latitude, wn.longitude]}
              icon={createEnvIcon(selectedEntity?.id === wn.id)}
              eventHandlers={{
                click: () => handleSelectEnvironment(wn),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1} className="flat-map-tooltip">
                <span>{wn.name} ({wn.temperature_c ?? '--'}°C)</span>
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {/* Top-Right Overlay: Layers Button */}
        <div className={`absolute top-3 ${selectedEntity ? 'right-[332px]' : 'right-3'} z-[1000] transition-all`}>
          <button
            onClick={() => setShowLayersPanel(!showLayersPanel)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-raised hover:bg-line text-muted hover:text-fg rounded text-xs transition border border-line"
            title="Toggle map layers and legend"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="font-normal">Layers</span>
            {showLayersPanel && <span className="w-1.5 h-1.5 rounded-full bg-accent ml-0.5" />}
          </button>
        </div>

        {/* Layers & Legend Panel (~260px) */}
        {showLayersPanel && (
          <div
            className={`absolute top-12 ${selectedEntity ? 'right-[332px]' : 'right-3'} z-[1000] w-[260px] bg-panel border border-line rounded p-3 space-y-3.5 max-h-[calc(100%-60px)] overflow-y-auto text-[13px] text-fg transition-all`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <span className="text-xs text-muted">Map settings</span>
              <button
                onClick={() => setShowLayersPanel(false)}
                className="text-muted hover:text-fg p-0.5 rounded transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Basemap Radio */}
            <div>
              <div className="text-xs text-muted mb-1.5">Basemap</div>
              <div className="space-y-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="radio"
                    name="basemap"
                    checked={mapMode === 'DARK'}
                    onChange={() => setMapMode('DARK')}
                    className="accent-[#4C90F0]"
                  />
                  <span>Dark</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="radio"
                    name="basemap"
                    checked={mapMode === 'STREET'}
                    onChange={() => setMapMode('STREET')}
                    className="accent-[#4C90F0]"
                  />
                  <span>Street</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="radio"
                    name="basemap"
                    checked={mapMode === 'SATELLITE'}
                    onChange={() => setMapMode('SATELLITE')}
                    className="accent-[#4C90F0]"
                  />
                  <span>Satellite</span>
                </label>
              </div>
            </div>

            {/* Layer Toggles */}
            <div className="pt-2 border-t border-line">
              <div className="text-xs text-muted mb-1.5">Layers</div>
              <div className="space-y-1.5 text-xs">
                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showVessels}
                      onChange={(e) => setShowVessels(e.target.checked)}
                      className="accent-[#4C90F0] rounded"
                    />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4C90F0]" />
                    <span>AIS ships</span>
                  </div>
                  <span className="text-[11px] text-muted capitalize">{vesselDataMode.toLowerCase()}</span>
                </label>
                {vessels.length === 0 && (
                  <p className="text-[11px] text-muted pl-6">No maritime vessels reported</p>
                )}

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showAircraft}
                      onChange={(e) => setShowAircraft(e.target.checked)}
                      className="accent-[#4C90F0] rounded"
                    />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                    <span>Aircraft</span>
                  </div>
                  <span className="text-[11px] text-muted capitalize">{aircraftDataMode.toLowerCase()}</span>
                </label>
                {aircraftList.length === 0 && (
                  <p className="text-[11px] text-muted pl-6">No aircraft reported</p>
                )}

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showHydrology}
                      onChange={(e) => setShowHydrology(e.target.checked)}
                      className="accent-[#4C90F0] rounded"
                    />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>Water gauges</span>
                  </div>
                  <span className="text-[11px] text-muted capitalize">{waterDataMode.toLowerCase()}</span>
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showEarthquakes}
                      onChange={(e) => setShowEarthquakes(e.target.checked)}
                      className="accent-[#4C90F0] rounded"
                    />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                    <span>Seismic</span>
                  </div>
                  <span className="text-[11px] text-muted capitalize">{seismicDataMode.toLowerCase()}</span>
                </label>

                <label className="flex items-center justify-between cursor-pointer py-0.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showAtmosphere}
                      onChange={(e) => setShowAtmosphere(e.target.checked)}
                      className="accent-[#4C90F0] rounded"
                    />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3DB46D]" />
                    <span>Atmosphere</span>
                  </div>
                  <span className="text-[11px] text-muted capitalize">{atmosphereDataMode.toLowerCase()}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={showTrails}
                    onChange={(e) => setShowTrails(e.target.checked)}
                    className="accent-[#4C90F0] rounded"
                  />
                  <span>Historical trails</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="accent-[#4C90F0] rounded"
                  />
                  <span>Map labels</span>
                </label>
              </div>
            </div>

            {/* Legend inside Layers panel */}
            <div className="pt-2 border-t border-line">
              <div className="text-xs text-muted mb-2">Legend</div>
              <div className="space-y-2 text-[11px] text-muted">
                <div>
                  <div className="text-fg mb-1">Vessels</div>
                  <div className="grid grid-cols-2 gap-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Container
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Tanker
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" /> Bulk
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" /> Service
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-fg mb-1">Aircraft</div>
                  <div className="space-y-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" /> FL250+ (high)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> FL100–250 (mid)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> &lt;FL100 (low)
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-fg mb-1">Seismic</div>
                  <div className="space-y-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e5484d]" /> M5+ strong
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f5a524]" /> M4–M5 moderate
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" /> &lt;M4 light
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        ) : (
          /* Pure Data Mode View (when map is OFF) */
          <div className="flex-1 flex flex-col overflow-hidden bg-[#090d16] p-3">
            {/* Top Bar for Data Mode */}
            <div className="mb-3 flex items-center justify-between gap-3 shrink-0">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 bg-[#141d2e] p-1 rounded border border-slate-800 text-xs font-mono">
                {(
                  [
                    { id: 'all', label: `All (${vessels.length + aircraftList.length + locations.length + earthquakes.length})` },
                    { id: 'vessels', label: `Vessels (${vessels.length})` },
                    { id: 'aircraft', label: `Aircraft (${aircraftList.length})` },
                    { id: 'facilities', label: `Facilities (${locations.length})` },
                    { id: 'earthquakes', label: `Seismic (${earthquakes.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTelemetryFilter(tab.id)}
                    className={`px-2.5 py-1 rounded transition cursor-pointer font-medium ${
                      telemetryFilter === tab.id
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter data stream..."
                  value={telemetrySearch}
                  onChange={(e) => setTelemetrySearch(e.target.value)}
                  className="bg-[#141d2e] border border-slate-800 text-xs text-slate-200 placeholder-slate-500 rounded px-3 py-1 font-mono focus:outline-none focus:border-cyan-500 w-56"
                />
                <button
                  onClick={toggleMap}
                  className="px-3 py-1 text-xs font-mono font-semibold text-cyan-400 hover:text-white bg-cyan-950/60 hover:bg-cyan-900/60 rounded border border-cyan-700/60 transition cursor-pointer flex items-center gap-1"
                >
                  <span>Turn Map Canvas ON</span>
                </button>
              </div>
            </div>

            {/* Status Notification Banner */}
            <div className="mb-2 px-3 py-1.5 rounded bg-[#0b1220] border border-cyan-900/30 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>Map Canvas is OFF by default. High-frequency telemetry stream processed directly in data table.</span>
              </div>
              <span className="text-[11px] text-cyan-400/80">Click any row to inspect telemetry & telemetry trail</span>
            </div>

            {/* High-Density Data Table */}
            <div className="flex-1 border border-slate-800/80 rounded bg-[#060910] overflow-y-auto">
              {(() => {
                const items = getCombinedTelemetryData();
                if (items.length === 0) {
                  return (
                    <div className="h-48 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
                      <span>No records found matching filter criteria.</span>
                    </div>
                  );
                }
                return (
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0b1220] border-b border-slate-800 sticky top-0 text-slate-400 text-[11px] uppercase tracking-wider z-10">
                      <tr>
                        <th className="py-2.5 px-3">Entity / Object</th>
                        <th className="py-2.5 px-3">Domain</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Coordinates (Lat, Lng)</th>
                        <th className="py-2.5 px-3">Telemetry / Operational Metrics</th>
                        <th className="py-2.5 px-3">Feed Mode</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {items.map((item) => {
                        const isSelected = selectedEntity?.id === item.id;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className={`hover:bg-slate-800/40 transition cursor-pointer ${
                              isSelected ? 'bg-cyan-950/40 border-l-2 border-l-cyan-400' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-200">{item.title}</div>
                              <div className="text-[10px] text-slate-500">ID: {item.id}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  item.category === 'VESSEL'
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-600/40'
                                    : item.category === 'AIRCRAFT'
                                    ? 'bg-sky-950/60 text-sky-300 border-sky-600/40'
                                    : item.category === 'SEISMIC'
                                    ? 'bg-rose-950/60 text-rose-300 border-rose-600/40'
                                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40'
                                }`}
                              >
                                {item.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 text-[11px]">{item.type}</td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 text-[11px] max-w-sm truncate">
                              {item.metrics}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  item.mode === 'LIVE'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/50'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {item.mode}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(item);
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
                );
              })()}
            </div>
          </div>
        )}

        {/* Phase 3: Inspector Panel (320px, panel bg) */}
        {selectedEntity && (
          <div className="absolute top-0 right-0 bottom-0 w-[320px] bg-panel border-l border-line z-[1100] flex flex-col overflow-hidden text-fg text-[13px]">
            {/* Header */}
            <div className="p-3 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    selectedEntity.statusDot === 'ok'
                      ? 'bg-ok'
                      : selectedEntity.statusDot === 'warn'
                      ? 'bg-warn'
                      : selectedEntity.statusDot === 'danger'
                      ? 'bg-danger'
                      : 'bg-muted'
                  }`}
                />
                <div className="min-w-0">
                  <h2 className="text-[13px] font-medium text-fg truncate">{selectedEntity.title}</h2>
                  <div className="text-[11px] text-muted flex items-center gap-1.5">
                    <span className="capitalize">{selectedEntity.type}</span>
                    <span>·</span>
                    <span className="font-mono text-[10px] text-muted uppercase">{selectedEntity.data_mode}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEntity(null)}
                className="p-1 rounded text-muted hover:text-fg hover:bg-raised transition"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Inspector Details */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Data Mode Row */}
              <div className="flex items-center justify-between py-1.5 px-2 bg-raised rounded text-xs">
                <span className="text-muted">Data mode</span>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedEntity.data_mode === 'LIVE' ? 'bg-ok' : 'bg-muted'}`} />
                  <span className="font-mono text-[11px] text-fg uppercase">{selectedEntity.data_mode}</span>
                </div>
              </div>

              {/* Key/Value List */}
              <div className="space-y-1">
                {selectedEntity.keyValues.map((kv, i) => (
                  <div key={i} className="flex items-baseline justify-between py-1 text-xs border-b border-line/40 last:border-b-0">
                    <span className="text-muted">{kv.label}</span>
                    <span className="font-mono text-fg text-right max-w-[170px] truncate">{kv.value}</span>
                  </div>
                ))}
              </div>

              {/* Last Updated Timestamp */}
              <div className="pt-2 text-[11px] text-muted flex items-center justify-between">
                <span>Last updated</span>
                <span className="font-mono text-fg">{selectedEntity.lastUpdated}</span>
              </div>
            </div>

            {/* Inspector Actions */}
            <div className="p-3 border-t border-line flex flex-col gap-1.5 bg-panel">
              {selectedEntity.hasTrail && (
                <button
                  onClick={() => setShowTrails(true)}
                  className="w-full py-1.5 px-3 bg-raised hover:bg-line text-fg rounded text-xs font-medium transition text-left flex items-center justify-between"
                >
                  <span>Show trail</span>
                  <Navigation className="w-3.5 h-3.5 text-muted" />
                </button>
              )}
              <button
                onClick={handleCenterSelected}
                className="w-full py-1.5 px-3 bg-raised hover:bg-line text-fg rounded text-xs font-medium transition text-left flex items-center justify-between"
              >
                <span>Center</span>
                <Compass className="w-3.5 h-3.5 text-muted" />
              </button>
              <button
                onClick={handleOpenInGraph}
                className="w-full py-1.5 px-3 bg-accent text-white rounded text-xs font-medium hover:bg-accent/90 transition text-left flex items-center justify-between"
              >
                <span>Open in graph</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
