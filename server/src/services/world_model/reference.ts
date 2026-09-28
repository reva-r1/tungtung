/**
 * Named reference geometry definitions for the Revana World Model.
 * 
 * IMPORTANT: All geometries are approximate representations digitized for
 * regional corridor monitoring and hydrological spatial joins. Each entry
 * documents its source and precision level.
 */

export interface CorridorReference {
  id: string;
  name: string;
  description: string;
  maxProximityThresholdKm: number;
  /** Polyline waypoint coordinates: [latitude, longitude] */
  polyline: [number, number][];
}

export interface AirportReference {
  id: string;
  icao: string;
  iata: string;
  name: string;
  lat: number;
  lon: number;
  elevationMeters: number;
  terminalControlAreaRadiusKm: number;
  finalApproachRadiusKm: number;
  runwayHeading: string;
}

export interface CatchmentReference {
  id: string;
  name: string;
  description: string;
  center: { lat: number; lon: number };
  radiusKm: number;
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

/**
 * NH48 Golden Quadrilateral Trade Corridor (Karnataka-Tamil Nadu Section)
 * 
 * SOURCE / ASSUMPTION:
 * Approximate road alignment polyline digitized from OpenStreetMap NH48 centerlines,
 * passing from Tumakuru through Nelamangala, Peenya, Bangalore Outer Ring, Electronic City,
 * Attibele border, Hosur, and down to Krishnagiri interchange.
 * Coordinates are approximate highway reference waypoints (+/- 50m precision).
 */
export const ROAD_CORRIDOR_NH48: CorridorReference = {
  id: 'ROAD_CORRIDOR_NH48',
  name: 'NH48 Golden Quadrilateral Commercial Corridor (Tumakuru - Bangalore - Hosur - Krishnagiri)',
  description: 'Primary heavy freight corridor connecting Bangalore metropolitan manufacturing hubs to Chennai / Krishnagiri',
  maxProximityThresholdKm: 15.0, // Weather stations within 15km of this polyline are considered corridor-adjacent
  polyline: [
    [13.3408, 77.1009], // Tumakuru North Bypass
    [13.2180, 77.2910], // Dobbaspet Logistics Hub
    [13.1000, 77.3900], // Nelamangala Toll Plaza
    [13.0280, 77.5180], // Peenya Industrial Area Flyover
    [12.9850, 77.5530], // Bangalore West Link (Yeshwanthpur/Goraguntepalya)
    [12.9230, 77.6180], // BTM / Silk Board Junction Junction
    [12.8450, 77.6600], // Electronic City Phase 1 Elevated Expressway
    [12.7840, 77.7420], // Attibele Border Toll Checkpoint
    [12.7409, 77.8253], // Hosur SIPCOT Industrial Belt
    [12.6350, 78.0120], // Shoolagiri Waypoint
    [12.5200, 78.2100], // Krishnagiri Junction (Toll interchange)
  ],
};

/**
 * Kempegowda International Airport Bengaluru (VOBL / BLR)
 * 
 * SOURCE:
 * Official Aerodrome Reference Point (ARP) coordinates published by the
 * Airports Authority of India (AAI) Aeronautical Information Publication (AIP).
 */
export const AIRPORT_KEMPEGOWDA_BLR: AirportReference = {
  id: 'AIRPORT_KEMPEGOWDA_BLR',
  icao: 'VOBL',
  iata: 'BLR',
  name: 'Kempegowda International Airport Bengaluru',
  lat: 13.1986,
  lon: 77.7066,
  elevationMeters: 915,
  terminalControlAreaRadiusKm: 60.0,
  finalApproachRadiusKm: 15.0,
  runwayHeading: '09L/27R & 09R/27L',
};

/**
 * Cauvery South Hydrological Catchment Basin
 * 
 * SOURCE / ASSUMPTION:
 * Approximate hydrological drainage basin boundaries digitized from Karnataka State Natural
 * Disaster Monitoring Centre (KSNDMC) watershed micro-basin maps for the Dakshina Pinakini
 * and Arkavathi/Cauvery South sub-basins covering South Bangalore urban, Anekal, and Hosur valleys.
 * Radius and bounding box are approximate (+/- 2km precision).
 */
export const CATCHMENT_CAUVERY_SOUTH: CatchmentReference = {
  id: 'CATCHMENT_CAUVERY_SOUTH',
  name: 'Cauvery South & Dakshina Pinakini Drainage Catchment',
  description: 'Southern Bangalore urban drainage network including Bellandur, Varthur, and Anekal water flow corridors',
  center: {
    lat: 12.8800,
    lon: 77.6200,
  },
  radiusKm: 35.0,
  boundingBox: {
    minLat: 12.6000,
    maxLat: 13.1000,
    minLon: 77.3500,
    maxLon: 77.9000,
  },
};
