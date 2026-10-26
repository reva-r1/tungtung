import { db } from '../../../db/database.js';
import { MaritimeService } from '../../maritime/maritime.service.js';
import { MaritimePatternDetector } from '../../maritime/patternDetector.service.js';
import { ToolDefinition } from '../types.js';

export const maritimeTools: ToolDefinition[] = [
  {
    name: 'get_active_vessels',
    description: 'Retrieve live moving commercial vessels and cargo ships tracked via AIS telemetry, including coordinates, speed, course, heading, destination, and status.',
    domain: 'maritime',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of vessels to retrieve (default 15)' },
        vesselType: { type: 'string', description: 'Optional vessel type filter: Cargo, Tanker, Container Ship, etc.' },
      },
    },
    execute: async (args) => {
      const limit = Number(args.limit) || 15;
      const all = MaritimeService.getAllVessels(100);
      const filtered = args.vesselType
        ? all.filter((v: any) => (v.vessel_type || '').toLowerCase().includes(String(args.vesselType).toLowerCase()))
        : all;
      return {
        total_tracked: all.length,
        returned_count: Math.min(filtered.length, limit),
        vessels: filtered.slice(0, limit).map((v: any) => ({
          id: v.id,
          name: v.name,
          mmsi: v.mmsi,
          imo: v.imo,
          vessel_type: v.vessel_type,
          coordinates: [Number(v.latitude.toFixed(4)), Number(v.longitude.toFixed(4))],
          speed_knots: v.speed,
          course_deg: v.course,
          destination: v.destination,
          eta: v.eta,
          status: v.status,
          last_updated_at: v.last_updated_at,
        })),
      };
    },
  },
  {
    name: 'get_vessel_details',
    description: 'Get full AIS profile and recent navigational track fixes for a specific vessel identifier (ID or MMSI).',
    domain: 'maritime',
    parameters: {
      type: 'object',
      properties: {
        vesselId: { type: 'string', description: 'Vessel ID (e.g. SHIP_419001234) or MMSI number' },
      },
      required: ['vesselId'],
    },
    execute: async (args) => {
      const q = String(args.vesselId || '').trim();
      let vessel = MaritimeService.getVesselById(q);
      if (!vessel) {
        // Try looking up by MMSI
        const row = db.prepare('SELECT id FROM moving_entities WHERE mmsi = ?').get(q) as any;
        if (row) {
          vessel = MaritimeService.getVesselById(row.id);
        }
      }
      if (!vessel) {
        return { error: `Vessel "${args.vesselId}" not found in active AIS ledger.` };
      }
      const track = MaritimeService.getVesselTrack(vessel.id, 10);
      return {
        vessel,
        recentTrackFixesCount: track.length,
        recentTrack: track.map((p: any) => ({
          coordinates: [p.latitude, p.longitude],
          speed: p.speed,
          course: p.course,
          timestamp: p.timestamp,
        })),
      };
    },
  },
  {
    name: 'get_maritime_corridor_patterns',
    description: 'Inspect monitored maritime transit corridors (Malacca Strait, Mumbai JNPT Gateway, Mundra Port Approach, Chennai Port Artery, Colombo Hub) for congestion anomalies and traffic deviations.',
    domain: 'maritime',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const patterns = MaritimePatternDetector.runDetection();
      return {
        detected_patterns_count: patterns.length,
        patterns: patterns.map((p: any) => ({
          pattern_id: p.pattern_id,
          region: p.region,
          observation: p.observation,
          entities_observed: p.entities_observed,
          baseline: p.baseline,
          deviation_percent: p.deviation_percent,
          confidence: p.confidence,
          cluster_characteristics: p.cluster_characteristics,
          detected_at: p.detected_at,
        })),
      };
    },
  },
  {
    name: 'search_vessels',
    description: 'Search vessels by name, destination port, IMO, or cargo type.',
    domain: 'maritime',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term for vessel name, destination port, or IMO' },
        limit: { type: 'number', description: 'Maximum results to return (default 10)' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const q = String(args.query || '').trim().toLowerCase();
      if (!q) return { results: [] };
      const limit = Number(args.limit) || 10;
      const all = MaritimeService.getAllVessels(200);
      const matches = all.filter((v: any) =>
        v.name.toLowerCase().includes(q) ||
        (v.destination && v.destination.toLowerCase().includes(q)) ||
        (v.imo && v.imo.toLowerCase().includes(q)) ||
        (v.mmsi && v.mmsi.toLowerCase().includes(q)) ||
        (v.vessel_type && v.vessel_type.toLowerCase().includes(q))
      ).slice(0, limit);

      return {
        query: args.query,
        count: matches.length,
        vessels: matches.map((v: any) => ({
          id: v.id,
          name: v.name,
          mmsi: v.mmsi,
          vessel_type: v.vessel_type,
          coordinates: [Number(v.latitude.toFixed(4)), Number(v.longitude.toFixed(4))],
          speed_knots: v.speed,
          destination: v.destination,
          status: v.status,
          last_updated_at: v.last_updated_at,
        })),
      };
    },
  },
];
