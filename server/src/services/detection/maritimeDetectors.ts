import { db } from '../../db/database.js';
import { GraphStore, ProvenancedTriple } from '../../types/kg.types.js';

export interface PositionPoint {
  vesselId: string;
  vesselName: string;
  lat: number;
  lon: number;
  timestamp: string;
  speedKnots: number;
  sourceFile: string;
}

export interface RendezvousCandidate {
  vessel1Id: string;
  vessel1Name: string;
  vessel2Id: string;
  vessel2Name: string;
  distanceNm: number;
  timeDeltaHours: number;
  lat: number;
  lon: number;
  timestamp: string;
}

export class MaritimeDetectorEngine {
  /**
   * Calculate Great-Circle distance in Nautical Miles using Haversine formula
   */
  static haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R_NM = 3440.065; // Earth radius in nautical miles

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R_NM * c).toFixed(2));
  }

  /**
   * 1. Algorithmic Spatio-Temporal Rendezvous Detector
   * Evaluates all vessel position pairs across the graph.
   * Flags when 2 distinct vessels are within maxDistanceNm and within maxTimeDeltaHours,
   * both moving at low speed (stationary drift).
   */
  static detectRendezvous(params?: {
    maxDistanceNm?: number;
    maxTimeDeltaHours?: number;
    maxSpeedKnots?: number;
  }): RendezvousCandidate[] {
    const maxDist = params?.maxDistanceNm ?? 1.5; // <= 1.5 NM
    const maxTime = params?.maxTimeDeltaHours ?? 4.0; // <= 4 hours
    const maxSpeed = params?.maxSpeedKnots ?? 2.5; // <= 2.5 knots

    // Query all position records from extracted_triples
    const positionRows = db.prepare(`
      SELECT 
        subject_entity_id as vesselId,
        subject_name as vesselName,
        properties,
        observed_at as observedAt,
        source_file as sourceFile
      FROM extracted_triples
      WHERE predicate = 'LOCATED_AT'
    `).all() as any[];

    const points: PositionPoint[] = [];
    for (const row of positionRows) {
      try {
        const props = typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties || {};
        const lat = Number(props.latitude);
        const lon = Number(props.longitude);
        const speed = props.speed_knots !== undefined ? Number(props.speed_knots) : 0;
        const time = row.observedAt || props.timestamp;

        if (!isNaN(lat) && !isNaN(lon) && time) {
          points.push({
            vesselId: row.vesselId,
            vesselName: row.vesselName,
            lat,
            lon,
            timestamp: time,
            speedKnots: isNaN(speed) ? 0 : speed,
            sourceFile: row.sourceFile,
          });
        }
      } catch (_) {}
    }

    const detections: RendezvousCandidate[] = [];
    const seenPairs = new Set<string>();

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const p1 = points[i];
        const p2 = points[j];

        // Must be different vessels
        if (p1.vesselId === p2.vesselId) continue;

        // Check speeds (both vessels must be slow or stationary)
        if (p1.speedKnots > maxSpeed || p2.speedKnots > maxSpeed) continue;

        // Check time difference
        const t1 = new Date(p1.timestamp).getTime();
        const t2 = new Date(p2.timestamp).getTime();
        const timeDeltaHours = Math.abs(t1 - t2) / (1000 * 60 * 60);
        if (timeDeltaHours > maxTime) continue;

        // Check spatial distance
        const dist = this.haversineNm(p1.lat, p1.lon, p2.lat, p2.lon);
        if (dist <= maxDist) {
          const pairKey = [p1.vesselId, p2.vesselId].sort().join('::');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            detections.push({
              vessel1Id: p1.vesselId,
              vessel1Name: p1.vesselName,
              vessel2Id: p2.vesselId,
              vessel2Name: p2.vesselName,
              distanceNm: dist,
              timeDeltaHours: Number(timeDeltaHours.toFixed(1)),
              lat: Number(((p1.lat + p2.lat) / 2).toFixed(4)),
              lon: Number(((p1.lon + p2.lon) / 2).toFixed(4)),
              timestamp: p1.timestamp,
            });
          }
        }
      }
    }

    return detections;
  }

  /**
   * 2. Algorithmic Hydrostatic Cargo Discrepancy Detector
   * Compares declared paperwork manifest weight with physical observed displacement surge.
   */
  static detectDiscrepancies(): Array<{
    vesselId: string;
    vesselName: string;
    declaredCargoMt: number;
    observedDisplacementMt: number;
    discrepancyMt: number;
    ratio: number;
    draughtDeltaMeters: number;
  }> {
    // 1. Get declared cargo weights by vessel
    const declaredRows = db.prepare(`
      SELECT 
        subject_entity_id as vesselId,
        subject_name as vesselName,
        properties
      FROM extracted_triples
      WHERE predicate = 'CONTAINS'
    `).all() as any[];

    const declaredMap = new Map<string, { name: string; weightMt: number }>();
    for (const r of declaredRows) {
      const props = typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties || {};
      const weight = Number(props.cargo_weight_mt || props.weight_mt || props.cargo_weight);
      if (!isNaN(weight) && weight > 0) {
        declaredMap.set(r.vesselId, { name: r.vesselName, weightMt: weight });
      }
    }

    // 2. Get observed draught and displacement changes by vessel
    const draughtRows = db.prepare(`
      SELECT 
        subject_entity_id as vesselId,
        subject_name as vesselName,
        properties
      FROM extracted_triples
      WHERE predicate = 'RECORDED_AT'
    `).all() as any[];

    const displacementMap = new Map<string, { maxDeltaMt: number; maxDraughtDelta: number }>();
    for (const r of draughtRows) {
      const props = typeof r.properties === 'string' ? JSON.parse(r.properties) : r.properties || {};
      const deltaMt = Number(props.displacement_delta_mt || 0);
      const obsDraught = Number(props.observed_draught_meters || 0);
      const repDraught = Number(props.reported_draught_meters || obsDraught);
      const draughtDelta = Math.max(0, obsDraught - repDraught);

      const existing = displacementMap.get(r.vesselId) || { maxDeltaMt: 0, maxDraughtDelta: 0 };
      if (deltaMt > existing.maxDeltaMt) existing.maxDeltaMt = deltaMt;
      if (draughtDelta > existing.maxDraughtDelta) existing.maxDraughtDelta = draughtDelta;
      displacementMap.set(r.vesselId, existing);
    }

    const results: Array<{
      vesselId: string;
      vesselName: string;
      declaredCargoMt: number;
      observedDisplacementMt: number;
      discrepancyMt: number;
      ratio: number;
      draughtDeltaMeters: number;
    }> = [];

    for (const [vesselId, decl] of declaredMap.entries()) {
      const disp = displacementMap.get(vesselId);
      if (disp && disp.maxDeltaMt > 0) {
        const discrepancyMt = disp.maxDeltaMt - decl.weightMt;
        if (discrepancyMt > decl.weightMt * 0.25 || discrepancyMt >= 5000) {
          results.push({
            vesselId,
            vesselName: decl.name,
            declaredCargoMt: decl.weightMt,
            observedDisplacementMt: disp.maxDeltaMt,
            discrepancyMt,
            ratio: Number((disp.maxDeltaMt / decl.weightMt).toFixed(1)),
            draughtDeltaMeters: disp.maxDraughtDelta,
          });
        }
      }
    }

    return results;
  }

  /**
   * Run detectors across SQLite and synthesize provenanced detection triples into GraphStore.
   */
  static async runDetectors(graphStore: GraphStore): Promise<{
    rendezvousCount: number;
    discrepancyCount: number;
    triplesGenerated: number;
  }> {
    const now = new Date().toISOString();
    const triplesToUpsert: ProvenancedTriple[] = [];

    // Run Rendezvous Detector
    const rendezvous = this.detectRendezvous();
    for (const r of rendezvous) {
      // Vessel 1 -> RENDEZVOUS_WITH -> Vessel 2
      triplesToUpsert.push({
        id: '',
        subjectEntityId: r.vessel1Id,
        subjectName: r.vessel1Name,
        subjectType: 'Vessel',
        predicate: 'RENDEZVOUS_WITH',
        objectEntityId: r.vessel2Id,
        objectName: r.vessel2Name,
        objectType: 'Vessel',
        sourceFile: 'algorithmic_rendezvous_detector',
        sourceRow: 1,
        sourceSpan: `Spatial-temporal rendezvous detected: ${r.vessel1Name} and ${r.vessel2Name} co-located at (${r.lat}°N, ${r.lon}°E), distance ${r.distanceNm} NM, time window delta ${r.timeDeltaHours}h.`,
        extractorModel: 'haversine_proximity_detector',
        extractorVersion: '1.0.0',
        confidence: 0.95,
        status: 'unreviewed',
        observedAt: r.timestamp,
        properties: {
          distance_nm: r.distanceNm,
          time_delta_hours: r.timeDeltaHours,
          latitude: r.lat,
          longitude: r.lon,
        },
        createdAt: now,
      });
    }

    // Run Discrepancy Detector
    const discrepancies = this.detectDiscrepancies();
    for (const d of discrepancies) {
      const discId = `disc_${d.vesselId}`;
      triplesToUpsert.push({
        id: '',
        subjectEntityId: d.vesselId,
        subjectName: d.vesselName,
        subjectType: 'Vessel',
        predicate: 'EXHIBITS_DISCREPANCY',
        objectEntityId: discId,
        objectName: `Physical Displacement Surge (+${d.discrepancyMt} MT unmanifested)`,
        objectType: 'Observation',
        sourceFile: 'hydrostatic_discrepancy_detector',
        sourceRow: 1,
        sourceSpan: `Hydrostatic anomaly detected: Vessel ${d.vesselName} declared ${d.declaredCargoMt} MT cargo, but experienced displacement surge of +${d.observedDisplacementMt} MT (+${d.discrepancyMt} MT unmanifested, ${d.ratio}x multiplier, draught jump ${d.draughtDeltaMeters}m).`,
        extractorModel: 'hydrostatic_displacement_detector',
        extractorVersion: '1.0.0',
        confidence: 0.98,
        status: 'unreviewed',
        observedAt: now,
        properties: {
          declared_cargo_mt: d.declaredCargoMt,
          observed_displacement_mt: d.observedDisplacementMt,
          discrepancy_mt: d.discrepancyMt,
          multiplier: d.ratio,
          draught_delta_m: d.draughtDeltaMeters,
        },
        createdAt: now,
      });
    }

    // Upsert detected triples into graphStore
    for (const t of triplesToUpsert) {
      await graphStore.upsertTriple(t);
    }

    return {
      rendezvousCount: rendezvous.length,
      discrepancyCount: discrepancies.length,
      triplesGenerated: triplesToUpsert.length,
    };
  }
}
