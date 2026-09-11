import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { LocationRecord, TimelineEvent } from '../../types';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import {
  MapPin,
  Warehouse,
  Truck,
  AlertTriangle,
  Radio,
  Maximize2,
  Filter,
  Navigation,
  Compass
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

// Custom SVG Icons for Tactical Map
const createCustomIcon = (color: string, label: string) => {
  return L.divIcon({
    className: 'custom-tactical-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #090d16;
        border: 2px solid ${color};
        box-shadow: 0 0 10px ${color}88;
      ">
        <div style="
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${color};
        "></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

export const TacticalMap: React.FC<TacticalMapProps> = ({
  locations: propLocations,
  className = '',
  onSelectEntity,
}) => {
  const { selectEntity, quickNavigateToEntity } = useInvestigation();
  const [locations, setLocations] = useState<LocationRecord[]>(propLocations || []);
  const [filterType, setFilterType] = useState<string>('ALL');
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!propLocations) {
      api.getLocations().then(setLocations).catch(console.error);
    } else {
      setLocations(propLocations);
    }
  }, [propLocations]);

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
    : [20.5937, 78.9629]; // Default geographic view

  return (
    <div className={`relative flex flex-col h-full bg-[#090d16] border border-[#1e293b] rounded-lg overflow-hidden ${className}`}>
      {/* Top Header / Filter */}
      <div className="flex items-center justify-between p-2.5 bg-[#0b1120] border-b border-[#1e293b] z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
            GEOSPATIAL RADAR
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ({filteredLocations.length} Geocoded Entities)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#090d16] border border-[#1e293b] rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Categories</option>
            <option value="WAREHOUSE">Warehouses</option>
            <option value="CHECKPOINT">Checkpoints</option>
            <option value="PORT">Ports</option>
            <option value="TRANSIT_POINT">Transit Points</option>
          </select>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 w-full h-full min-h-[300px] z-0 relative">
        {filteredLocations.length === 0 && (
          <div className="absolute inset-0 z-[1000] pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
            <div className="p-4 rounded-lg bg-[#0b1120]/90 border border-[#1e293b] text-center max-w-sm">
              <MapPin className="w-6 h-6 text-cyan-400 mx-auto mb-2 opacity-75" />
              <div className="text-xs font-mono font-bold text-slate-200 mb-1">No Geographic Coordinates Found</div>
              <div className="text-[11px] text-slate-400">
                Upload a CSV containing latitude and longitude columns to visualize data points on the radar.
              </div>
            </div>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={filteredLocations.length > 0 ? 9 : 4}
          scrollWheelZoom={true}
          className="w-full h-full"
          style={{ background: '#090d16' }}
        >
          {/* OpenStreetMap Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Real Uploaded Locations Markers */}
          {filteredLocations.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.latitude, loc.longitude]}
              icon={createCustomIcon(getMarkerColor(loc.type), loc.name)}
            >
              <Popup className="tactical-popup">
                <div className="p-1 font-mono text-xs text-slate-200 min-w-[200px]">
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

                  <button
                    onClick={() => {
                      if (onSelectEntity) onSelectEntity(loc.id);
                      else quickNavigateToEntity(loc.id);
                    }}
                    className="w-full py-1 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-200 text-[10px] font-bold rounded transition"
                  >
                    INSPECT ENTITY
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Map Legend */}
      <div className="p-2 bg-[#0b1120] border-t border-[#1e293b] flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10b981]"></span> Warehouse
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span> Port
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#06b6d4]"></span> Checkpoint
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span> Point of Interest
          </span>
        </div>
        <div className="text-slate-500">
          Geographic Radar Layer
        </div>
      </div>
    </div>
  );
};
