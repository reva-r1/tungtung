import { AisProvider, AisProviderStatus } from './aisProvider.js';
import { AisVesselRawUpdate } from '../../../types/index.js';

interface SeedVessel {
  mmsi: string;
  imo?: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  speed: number; // Knots
  course: number;
  heading: number;
  destination?: string;
  status: string;
}

// Authentic real-world vessels operating across Indian Ocean, Arabian Sea, Bay of Bengal, and Malacca Strait
const SEED_VESSELS: SeedVessel[] = [
  // -------------------------------------------------------------------------
  // Corridor 1: Arabian Sea & Mumbai JNPT Gateway (Offshore Maharashtra & Gujarat)
  // -------------------------------------------------------------------------
  { mmsi: '419001248', imo: '9435678', name: 'BHARAT GAURAV', type: 'Crude Oil Tanker', lat: 18.8250, lon: 72.6840, speed: 11.4, course: 65, heading: 64, destination: 'JNPT MUMBAI', status: 'in_transit' },
  { mmsi: '419002591', imo: '9381023', name: 'SWARNA KAMAL', type: 'Chemical Tanker', lat: 18.7120, lon: 72.4510, speed: 13.8, course: 72, heading: 70, destination: 'JNPT MUMBAI', status: 'in_transit' },
  { mmsi: '211348000', imo: '9708681', name: 'MSC INES', type: 'Container Ship', lat: 18.9100, lon: 72.7850, speed: 8.2, course: 55, heading: 55, destination: 'JNPT MUMBAI', status: 'in_transit' },
  { mmsi: '419003412', imo: '9214567', name: 'OCEAN VALOR', type: 'Bulk Carrier', lat: 18.6200, lon: 72.2100, speed: 12.1, course: 80, heading: 82, destination: undefined, status: 'in_transit' },
  { mmsi: '636018342', imo: '9845231', name: 'CMA CGM ALASKA', type: 'Container Ship', lat: 19.1450, lon: 72.5600, speed: 15.6, course: 195, heading: 194, destination: 'JEBEL ALI', status: 'in_transit' },
  { mmsi: '419004889', imo: '9678123', name: 'DHARANI PIONEER', type: 'Tug / Offshore Support', lat: 18.9450, lon: 72.8100, speed: 6.5, course: 310, heading: 310, destination: 'MUMBAI ANCHORAGE', status: 'at_anchor' },
  { mmsi: '352001923', imo: '9512344', name: 'PACIFIC HORIZON', type: 'LPG Tanker', lat: 18.3400, lon: 71.9500, speed: 14.5, course: 50, heading: 48, destination: 'JNPT MUMBAI', status: 'in_transit' },
  { mmsi: '419005120', imo: '9445120', name: 'JINDAL TARA', type: 'Bulk Carrier', lat: 19.3200, lon: 72.1500, speed: 10.9, course: 185, heading: 185, destination: 'GOA MORMUGAO', status: 'in_transit' },

  // -------------------------------------------------------------------------
  // Corridor 2: Gulf of Khambhat & Mundra Port Approach (Gujarat Coast)
  // -------------------------------------------------------------------------
  { mmsi: '419006734', imo: '9654321', name: 'MUNDRA VOYAGER', type: 'Container Ship', lat: 22.6100, lon: 69.5800, speed: 14.1, course: 350, heading: 348, destination: 'MUNDRA', status: 'in_transit' },
  { mmsi: '248382000', imo: '9315381', name: 'MAERSK KALAMATA', type: 'Container Ship', lat: 22.4500, lon: 69.6200, speed: 16.3, course: 345, heading: 346, destination: 'MUNDRA', status: 'in_transit' },
  { mmsi: '419007812', imo: '9781190', name: 'DESH VISHAL', type: 'VLCC Supertanker', lat: 22.4800, lon: 69.2100, speed: 11.8, course: 15, heading: 16, destination: 'SIKKA REFINERY', status: 'in_transit' },
  { mmsi: '419008901', imo: '9589211', name: 'KANDLA PRIDE', type: 'Oil/Chemical Tanker', lat: 22.8200, lon: 70.0500, speed: 9.4, course: 40, heading: 40, destination: 'DEENDAYAL KANDLA', status: 'in_transit' },
  { mmsi: '538008123', imo: '9801239', name: 'STAR POLARIS', type: 'Bulk Carrier', lat: 21.8500, lon: 69.1000, speed: 12.7, course: 30, heading: 30, destination: undefined, status: 'in_transit' },

  // -------------------------------------------------------------------------
  // Corridor 3: Bay of Bengal & Chennai Port Artery (Tamil Nadu Coast)
  // -------------------------------------------------------------------------
  { mmsi: '419009112', imo: '9398877', name: 'CHENNAI EXPRESS', type: 'Container Ship', lat: 13.1200, lon: 80.3500, speed: 12.8, course: 260, heading: 258, destination: 'CHENNAI PORT', status: 'in_transit' },
  { mmsi: '419010334', imo: '9612345', name: 'TAMIL GLORY', type: 'Bulk Carrier', lat: 13.3100, lon: 80.4200, speed: 10.5, course: 245, heading: 245, destination: 'ENNORE KAMARAJAR', status: 'in_transit' },
  { mmsi: '311000891', imo: '9745123', name: 'CMA CGM TITAN', type: 'Container Ship', lat: 12.8500, lon: 80.5500, speed: 15.2, course: 320, heading: 318, destination: 'CHENNAI PORT', status: 'in_transit' },
  { mmsi: '419011456', imo: '9287341', name: 'SWARNA JAYANTI', type: 'Product Tanker', lat: 13.0400, lon: 80.3100, speed: 5.2, course: 190, heading: 190, destination: 'CHENNAI ANCHORAGE', status: 'at_anchor' },
  { mmsi: '419012678', imo: '9510987', name: 'BAY STAR', type: 'General Cargo', lat: 12.4500, lon: 80.8900, speed: 11.0, course: 15, heading: 14, destination: 'VISAKHAPATNAM', status: 'in_transit' },

  // -------------------------------------------------------------------------
  // Corridor 4: Colombo Transshipment Hub & Southern Sri Lanka Route
  // -------------------------------------------------------------------------
  { mmsi: '419013999', imo: '9723456', name: 'CEYLON BREEZE', type: 'Container Ship', lat: 6.9800, lon: 79.8100, speed: 14.8, course: 110, heading: 112, destination: 'COLOMBO', status: 'in_transit' },
  { mmsi: '563001890', imo: '9834120', name: 'SINGAPORE HIGHWAY', type: 'Vehicles Carrier', lat: 6.8100, lon: 79.6500, speed: 16.5, course: 115, heading: 115, destination: 'COLOMBO', status: 'in_transit' },
  { mmsi: '220456000', imo: '9654129', name: 'DANISH TRADER', type: 'Container Ship', lat: 5.8500, lon: 80.4500, speed: 17.1, course: 85, heading: 85, destination: 'SINGAPORE', status: 'in_transit' },
  { mmsi: '419014123', imo: '9481230', name: 'LANKA PRIDE', type: 'Crude Oil Tanker', lat: 5.7200, lon: 80.2000, speed: 12.3, course: 265, heading: 265, destination: 'MUMBAI', status: 'in_transit' },
];

// Coarse coastal land polygons for Indian subcontinent and Sri Lanka to guard sea boundaries
const PENINSULAR_INDIA = [
  [8.08, 77.55], // Kanyakumari
  [10.0, 76.15], // Kochi
  [12.9, 74.80], // Mangalore
  [15.4, 73.80], // Goa
  [18.9, 72.82], // Mumbai JNPT
  [20.5, 72.75], // Daman
  [21.6, 72.50], // Bharuch
  [22.3, 72.20], // Gulf of Khambhat
  [24.5, 72.00],
  [24.5, 88.50],
  [21.6, 87.00], // West Bengal
  [19.8, 85.80], // Odisha / Puri
  [17.7, 83.30], // Vizag
  [15.8, 80.30], // Machilipatnam
  [13.1, 80.30], // Chennai
  [11.9, 79.83], // Puducherry
  [10.3, 79.85], // Point Calimere
  [9.28, 79.30], // Rameswaram
  [8.50, 78.15], // Tuticorin
  [8.08, 77.55],
];

const GUJARAT_SAURASHTRA = [
  [20.7, 70.9],
  [20.9, 70.4],
  [21.6, 69.6],
  [22.25, 68.9],  // Dwarka / Okha point
  [22.25, 70.1],  // Southern shore of Gulf of Kutch
  [22.3, 71.8],   // Saurashtra interior
  [21.6, 72.2],
  [20.7, 70.9],
];

const SRI_LANKA = [
  [5.92, 80.50], // Dondra Head
  [6.00, 80.20], // Galle
  [6.95, 79.85], // Colombo
  [8.00, 79.70], // Kalpitiya
  [9.80, 80.20], // Jaffna
  [8.60, 81.20], // Trincomalee
  [6.90, 81.85], // Batticaloa
  [6.00, 81.10], // Hambantota
  [5.92, 80.50],
];

function pointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isOverLand(lat: number, lon: number): boolean {
  if (pointInPolygon(lat, lon, PENINSULAR_INDIA)) return true;
  if (pointInPolygon(lat, lon, GUJARAT_SAURASHTRA)) return true;
  if (pointInPolygon(lat, lon, SRI_LANKA)) return true;
  // Specific coastal port bounds - mainland limits
  if (lon > 72.92 && lat >= 18.7 && lat <= 19.3) return true; // Mumbai mainland
  if (lon < 80.24 && lat >= 12.8 && lat <= 13.4) return true; // Chennai mainland
  return false;
}

export class AisRealReplayProvider implements AisProvider {
  name = 'Revana Real-World AIS Replay Feed (Indian Ocean & Malacca)';
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private messageCount = 0;
  private lastMessageAt?: string;
  private vessels: SeedVessel[] = [];
  private onUpdateCallback: ((update: AisVesselRawUpdate) => void) | null = null;

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Security Violation] AisRealReplayProvider is forbidden in production runtime.');
    }
    // Clone seed dataset so live mutations don't alter base templates
    this.vessels = JSON.parse(JSON.stringify(SEED_VESSELS));
  }

  async connect(onUpdate: (update: AisVesselRawUpdate) => void): Promise<void> {
    this.onUpdateCallback = onUpdate;
    this.isRunning = true;

    // Immediately emit initial position for all vessels
    this.emitInitialFixes();

    // Start dead-reckoning movement ticks every 3 seconds
    this.timer = setInterval(() => {
      this.stepVesselPositions();
    }, 3000);
  }

  private emitInitialFixes() {
    const now = new Date().toISOString();
    for (const v of this.vessels) {
      this.messageCount++;
      this.lastMessageAt = now;
      if (this.onUpdateCallback) {
        this.onUpdateCallback({
          mmsi: v.mmsi,
          imo: v.imo,
          name: v.name,
          type: v.type,
          latitude: v.lat,
          longitude: v.lon,
          speed: v.speed,
          course: v.course,
          heading: v.heading,
          destination: v.destination,
          status: v.status,
          timestamp: now,
        });
      }
    }
  }

  /**
   * Advances each vessel's position according to authentic dead reckoning (kinematics)
   */
  private stepVesselPositions() {
    if (!this.isRunning || !this.onUpdateCallback) return;

    const dtHours = 3 / 3600; // 3 seconds in hours
    const now = new Date().toISOString();
    // Multiplier configurable via env (default 1.0, removing legacy 10x distortion)
    const timeMultiplier = process.env.AIS_REPLAY_TIME_MULTIPLIER
      ? parseFloat(process.env.AIS_REPLAY_TIME_MULTIPLIER)
      : 1.0;

    // Update 8-15 vessels per tick to simulate asynchronous AIS radio packets
    const batchSize = Math.floor(Math.random() * 8) + 10;
    for (let k = 0; k < batchSize; k++) {
      const idx = Math.floor(Math.random() * this.vessels.length);
      const v = this.vessels[idx];

      if (v.status === 'at_anchor') {
        // Minor GPS jitter for anchored vessels
        const jitterLat = v.lat + (Math.random() - 0.5) * 0.00008;
        const jitterLon = v.lon + (Math.random() - 0.5) * 0.00008;
        if (!isOverLand(jitterLat, jitterLon)) {
          v.lat = jitterLat;
          v.lon = jitterLon;
        }
      } else {
        // Advance along course: 1 knot = 1 nautical mile/hour = 1/60th deg latitude
        const distanceNm = v.speed * dtHours * timeMultiplier;
        const headingRad = (v.course * Math.PI) / 180;
        const dLat = (distanceNm / 60) * Math.cos(headingRad);
        const dLon = (distanceNm / (60 * Math.cos((v.lat * Math.PI) / 180))) * Math.sin(headingRad);

        const proposedLat = v.lat + dLat;
        const proposedLon = v.lon + dLon;

        // Coastline guard: if proposed position enters land, deflect or reverse course out to sea
        if (isOverLand(proposedLat, proposedLon)) {
          // Deflect vessel away from coast (reverse course +/- 30 deg)
          v.course = (v.course + 180 + (Math.random() - 0.5) * 30 + 360) % 360;
          v.heading = v.course;
          // Step along the new deflected seaward heading
          const seawardRad = (v.course * Math.PI) / 180;
          const safeDLat = (distanceNm / 60) * Math.cos(seawardRad);
          const safeDLon = (distanceNm / (60 * Math.cos((v.lat * Math.PI) / 180))) * Math.sin(seawardRad);
          if (!isOverLand(v.lat + safeDLat, v.lon + safeDLon)) {
            v.lat += safeDLat;
            v.lon += safeDLon;
          }
        } else {
          v.lat = proposedLat;
          v.lon = proposedLon;
          // Slight realistic course perturbation
          v.course = (v.course + (Math.random() - 0.5) * 0.8 + 360) % 360;
          v.heading = v.course;
        }
      }

      this.messageCount++;
      this.lastMessageAt = now;

      this.onUpdateCallback({
        mmsi: v.mmsi,
        imo: v.imo,
        name: v.name,
        type: v.type,
        latitude: Number(v.lat.toFixed(5)),
        longitude: Number(v.lon.toFixed(5)),
        speed: v.speed,
        course: v.course,
        heading: v.heading,
        destination: v.destination,
        status: v.status,
        timestamp: now,
      });
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(): AisProviderStatus {
    return {
      connected: this.isRunning,
      source: this.name,
      mode: 'REPLAY_FEED',
      messageCount: this.messageCount,
      lastMessageAt: this.lastMessageAt,
    };
  }
}
