import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { Anomaly, RiskLevel, AnomalyType } from '../types/index.js';

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class AnomalyService {
  /**
   * Fetch anomalies with optional filters
   */
  static getAnomalies(options?: { status?: string; severity?: RiskLevel; entityId?: string }): Anomaly[] {
    let query = 'SELECT * FROM anomalies WHERE 1=1';
    const params: any[] = [];

    if (options?.status) {
      query += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.severity) {
      query += ' AND severity = ?';
      params.push(options.severity);
    }
    if (options?.entityId) {
      query += ' AND entity_id = ?';
      params.push(options.entityId);
    }

    query += ' ORDER BY detected_at DESC';

    const records = db.prepare(query).all(...params) as any[];
    return records.map((r) => ({
      ...r,
      entityId: r.entity_id,
      entityName: r.entity_name,
      entityType: r.entity_type,
      evidence: JSON.parse(r.evidence || '[]'),
      detectedAt: r.detected_at,
    }));
  }

  /**
   * Update anomaly status (e.g. Open -> Investigating -> Confirmed/Dismissed)
   */
  static updateStatus(id: string, status: 'OPEN' | 'INVESTIGATING' | 'DISMISSED' | 'CONFIRMED') {
    db.prepare('UPDATE anomalies SET status = ? WHERE id = ?').run(status, id);
    return { success: true, id, status };
  }

  /**
   * Run all rule-based anomaly detectors across the current database
   */
  static runAllDetectors() {
    const newlyDetected: Anomaly[] = [];

    // --- Rule 1: Impossible Speed / Teleportation Detector ---
    const rawEvents = db
      .prepare(`
        SELECT * FROM events 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL 
        ORDER BY timestamp ASC
      `)
      .all() as any[];

    const eventsByEntity: Record<string, any[]> = {};
    for (const ev of rawEvents) {
      const eIds = JSON.parse(ev.entity_ids || '[]');
      for (const eId of eIds) {
        if (!eventsByEntity[eId]) eventsByEntity[eId] = [];
        eventsByEntity[eId].push(ev);
      }
    }

    for (const [entityId, evList] of Object.entries(eventsByEntity)) {
      for (let i = 0; i < evList.length - 1; i++) {
        const ev1 = evList[i];
        const ev2 = evList[i + 1];

        const t1 = new Date(ev1.timestamp).getTime();
        const t2 = new Date(ev2.timestamp).getTime();
        const diffHours = Math.abs(t2 - t1) / (1000 * 3600);

        if (diffHours > 0 && diffHours < 12) {
          const distKm = haversineDistanceKm(ev1.latitude, ev1.longitude, ev2.latitude, ev2.longitude);
          const impliedSpeed = distKm / diffHours;

          if (impliedSpeed > 130 && distKm > 30) {
            // Speed anomaly detected!
            const ent = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as any;
            if (ent) {
              const anomalyId = `ANOM-SPD-${entityId.replace('ENT-', '')}`;
              const exists = db.prepare('SELECT id FROM anomalies WHERE id = ?').get(anomalyId);
              if (!exists) {
                const anom: Anomaly = {
                  id: anomalyId,
                  title: `Impossible Ground Speed: ${impliedSpeed.toFixed(0)} km/h Detected`,
                  type: 'IMPOSSIBLE_SPEED',
                  severity: impliedSpeed > 200 ? 'CRITICAL' : 'HIGH',
                  status: 'OPEN',
                  entityId: ent.id,
                  entityName: ent.name,
                  entityType: ent.type,
                  description: `Entity registered sequential checkpoints (${distKm.toFixed(1)} km apart) within ${(diffHours * 60).toFixed(0)} minutes, requiring a ground speed of ${impliedSpeed.toFixed(1)} km/h. Exceeds physical operational limits for commercial vehicles.`,
                  evidence: [
                    { title: `Origin: ${ev1.title}`, detail: `Time: ${ev1.timestamp}`, timestamp: ev1.timestamp },
                    { title: `Destination: ${ev2.title}`, detail: `Time: ${ev2.timestamp}`, timestamp: ev2.timestamp },
                    { title: 'Ground Speed', detail: `${impliedSpeed.toFixed(1)} km/h (Limit: 80-100 km/h)`, metric: `${impliedSpeed.toFixed(0)} km/h` },
                  ],
                  detectedAt: new Date().toISOString(),
                  confidence: 0.96,
                };

                db.prepare(`
                  INSERT INTO anomalies (id, title, type, severity, status, entity_id, entity_name, entity_type, description, evidence, detected_at, confidence)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  anom.id,
                  anom.title,
                  anom.type,
                  anom.severity,
                  anom.status,
                  anom.entityId,
                  anom.entityName,
                  anom.entityType,
                  anom.description,
                  JSON.stringify(anom.evidence),
                  anom.detectedAt,
                  anom.confidence
                );

                newlyDetected.push(anom);
              }
            }
          }
        }
      }
    }

    // --- Rule 2: Orphaned Shipment Manifest Detector ---
    const shipments = db.prepare("SELECT * FROM entities WHERE type = 'SHIPMENT'").all() as any[];
    for (const shp of shipments) {
      const rels = db.prepare('SELECT * FROM relationships WHERE source_id = ? OR target_id = ?').all(shp.id, shp.id) as any[];
      const hasOrigin = rels.some((r) => r.type === 'ORIGINATED_FROM' || r.type === 'SHIPPED_BY');
      const hasDest = rels.some((r) => r.type === 'DESTINED_FOR' || r.type === 'CONSIGNED_TO');

      if (!hasOrigin || !hasDest) {
        const anomalyId = `ANOM-ORP-${shp.id.replace('ENT-', '')}`;
        const exists = db.prepare('SELECT id FROM anomalies WHERE id = ?').get(anomalyId);
        if (!exists) {
          const anom: Anomaly = {
            id: anomalyId,
            title: `Orphaned Consignment Manifest (${shp.name})`,
            type: 'ORPHANED_MANIFEST',
            severity: 'MEDIUM',
            status: 'OPEN',
            entityId: shp.id,
            entityName: shp.name,
            entityType: 'SHIPMENT',
            description: `Shipment ${shp.name} is missing a verified linked origin depot or consignee facility relationship in the active customs manifest.`,
            evidence: [
              { title: 'Missing Relationship', detail: !hasOrigin ? 'Missing Origin Depot' : 'Missing Destination Facility' },
              { title: 'Regulatory Flag', detail: 'Mandatory customs compliance check required' },
            ],
            detectedAt: new Date().toISOString(),
            confidence: 0.89,
          };

          db.prepare(`
            INSERT INTO anomalies (id, title, type, severity, status, entity_id, entity_name, entity_type, description, evidence, detected_at, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            anom.id,
            anom.title,
            anom.type,
            anom.severity,
            anom.status,
            anom.entityId,
            anom.entityName,
            anom.entityType,
            anom.description,
            JSON.stringify(anom.evidence),
            anom.detectedAt,
            anom.confidence
          );

          newlyDetected.push(anom);
        }
      }
    }

    return this.getAnomalies();
  }
}
