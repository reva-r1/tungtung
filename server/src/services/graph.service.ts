import { db } from '../db/database.js';
import { Entity, Relationship, GraphData, GraphNode, GraphEdge, RiskLevel, EntityType } from '../types/index.js';
import { ResolutionService } from './resolution.service.js';

export class GraphService {
  /**
   * Get complete or filtered graph nodes and edges
   */
  static getGraph(options?: {
    entityTypes?: EntityType[];
    relationshipTypes?: string[];
    sourceIds?: string[];
    minRiskScore?: number;
    limit?: number;
  }): GraphData {
    let entityQuery = 'SELECT * FROM entities WHERE 1=1';
    const params: any[] = [];

    if (options?.entityTypes && options.entityTypes.length > 0) {
      const placeholders = options.entityTypes.map(() => '?').join(',');
      entityQuery += ` AND type IN (${placeholders})`;
      params.push(...options.entityTypes);
    }

    if (options?.sourceIds && options.sourceIds.length > 0) {
      // Filter entities linked to the specified source databases
      const placeholders = options.sourceIds.map(() => '?').join(',');
      entityQuery += ` AND (source_db_id IN (${placeholders}) OR id IN (SELECT entity_id FROM entity_source_links WHERE source_db_id IN (${placeholders})))`;
      params.push(...options.sourceIds, ...options.sourceIds);
    }

    if (options?.minRiskScore !== undefined) {
      entityQuery += ' AND risk_score >= ?';
      params.push(options.minRiskScore);
    }

    if (options?.limit) {
      entityQuery += ' LIMIT ?';
      params.push(options.limit);
    }

    const rawEntities = db.prepare(entityQuery).all(...params) as any[];
    const entityIdSet = new Set(rawEntities.map((e) => e.id));

    let relQuery = 'SELECT * FROM relationships WHERE 1=1';
    const relParams: any[] = [];

    if (options?.relationshipTypes && options.relationshipTypes.length > 0) {
      const placeholders = options.relationshipTypes.map(() => '?').join(',');
      relQuery += ` AND type IN (${placeholders})`;
      relParams.push(...options.relationshipTypes);
    }

    if (options?.sourceIds && options.sourceIds.length > 0) {
      const placeholders = options.sourceIds.map(() => '?').join(',');
      relQuery += ` AND (source_db_id IS NULL OR source_db_id IN (${placeholders}))`;
      relParams.push(...options.sourceIds);
    }

    const rawRelationships = db.prepare(relQuery).all(...relParams) as any[];

    // Filter relationships where both source and target exist in selected entities
    const filteredRels = rawRelationships.filter(
      (r) => entityIdSet.has(r.source_id) && entityIdSet.has(r.target_id)
    );

    const nodes: GraphNode[] = rawEntities.map((e) => ({
      data: {
        id: e.id,
        name: e.name,
        type: e.type as EntityType,
        riskLevel: e.risk_level as RiskLevel,
        riskScore: e.risk_score,
        category: e.category,
        label: e.label || e.name,
        sourceDbId: e.source_db_id,
        sourceTable: e.source_table,
        sourceRecordId: e.source_record_id,
        properties: JSON.parse(e.properties || '{}'),
      } as any,
    }));

    const edges: GraphEdge[] = filteredRels.map((r) => ({
      data: {
        id: r.id,
        source: r.source_id,
        target: r.target_id,
        type: r.type,
        label: r.label || r.type,
        confidence: r.confidence,
        riskLevel: r.risk_level as RiskLevel,
        sourceDbId: r.source_db_id,
        sourceTable: r.source_table,
        sourceRecordId: r.source_record_id,
        properties: JSON.parse(r.properties || '{}'),
      } as any,
    }));

    return { nodes, edges };
  }

  /**
   * Expand entity N-hops in the graph
   */
  static expandEntity(entityId: string, hops: number = 1, edgeTypes?: string[]): GraphData {
    const visitedNodes = new Set<string>([entityId]);
    const discoveredEdges = new Map<string, any>();
    let currentLevel = new Set<string>([entityId]);

    for (let h = 0; h < hops; h++) {
      if (currentLevel.size === 0) break;
      const nextLevel = new Set<string>();

      const placeholders = Array.from(currentLevel).map(() => '?').join(',');
      let query = `
        SELECT * FROM relationships 
        WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})
      `;

      const rels = db.prepare(query).all(...Array.from(currentLevel), ...Array.from(currentLevel)) as any[];

      for (const r of rels) {
        if (edgeTypes && edgeTypes.length > 0 && !edgeTypes.includes(r.type)) {
          continue;
        }

        discoveredEdges.set(r.id, r);
        if (!visitedNodes.has(r.source_id)) {
          visitedNodes.add(r.source_id);
          nextLevel.add(r.source_id);
        }
        if (!visitedNodes.has(r.target_id)) {
          visitedNodes.add(r.target_id);
          nextLevel.add(r.target_id);
        }
      }

      currentLevel = nextLevel;
    }

    const nodePlaceholders = Array.from(visitedNodes).map(() => '?').join(',');
    const entities = db
      .prepare(`SELECT * FROM entities WHERE id IN (${nodePlaceholders})`)
      .all(...Array.from(visitedNodes)) as any[];

    const nodes: GraphNode[] = entities.map((e) => ({
      data: {
        id: e.id,
        name: e.name,
        type: e.type as EntityType,
        riskLevel: e.risk_level as RiskLevel,
        riskScore: e.risk_score,
        category: e.category,
        label: e.label || e.name,
        sourceDbId: e.source_db_id,
        sourceTable: e.source_table,
        sourceRecordId: e.source_record_id,
        properties: JSON.parse(e.properties || '{}'),
      } as any,
    }));

    const edges: GraphEdge[] = Array.from(discoveredEdges.values()).map((r) => ({
      data: {
        id: r.id,
        source: r.source_id,
        target: r.target_id,
        type: r.type,
        label: r.label || r.type,
        confidence: r.confidence,
        riskLevel: r.risk_level as RiskLevel,
        sourceDbId: r.source_db_id,
        sourceTable: r.source_table,
        sourceRecordId: r.source_record_id,
        properties: JSON.parse(r.properties || '{}'),
      } as any,
    }));

    return { nodes, edges };
  }

  /**
   * Get full Profile Dossier for an Entity (including connected entities, timeline events, map coordinates, anomalies, and source provenance)
   */
  static getEntityProfile(entityId: string) {
    const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as any;
    if (!entity) return null;

    // Get 1-hop relationships
    const rels = db
      .prepare(`
        SELECT r.*, 
          src.name as source_name, src.type as source_type, src.risk_score as source_risk,
          tgt.name as target_name, tgt.type as target_type, tgt.risk_score as target_risk
        FROM relationships r
        JOIN entities src ON r.source_id = src.id
        JOIN entities tgt ON r.target_id = tgt.id
        WHERE r.source_id = ? OR r.target_id = ?
      `)
      .all(entityId, entityId) as any[];

    // Get events involving this entity
    const events = db
      .prepare(`
        SELECT * FROM events 
        WHERE entity_ids LIKE ? 
        ORDER BY timestamp DESC
      `)
      .all(`%${entityId}%`) as any[];

    // Get anomalies for this entity
    const anomalies = db
      .prepare('SELECT * FROM anomalies WHERE entity_id = ? ORDER BY detected_at DESC')
      .all(entityId) as any[];

    // 1-hop graph for profile widget
    const graph = this.expandEntity(entityId, 2);

    // Provenance: contributing source databases & raw records
    const provenance = ResolutionService.getEntityProvenance(entityId);

    return {
      entity: {
        ...entity,
        sourceDbId: entity.source_db_id,
        sourceTable: entity.source_table,
        sourceRecordId: entity.source_record_id,
        properties: JSON.parse(entity.properties || '{}'),
        tags: JSON.parse(entity.tags || '[]'),
        aliases: JSON.parse(entity.aliases || '[]'),
      },
      provenance,
      relationships: rels.map((r) => ({
        ...r,
        properties: JSON.parse(r.properties || '{}'),
      })),
      events: events.map((ev) => ({
        ...ev,
        entityIds: JSON.parse(ev.entity_ids || '[]'),
        evidence: JSON.parse(ev.evidence || '[]'),
        properties: JSON.parse(ev.properties || '{}'),
      })),
      anomalies: anomalies.map((a) => ({
        ...a,
        evidence: JSON.parse(a.evidence || '[]'),
      })),
      subgraph: graph,
    };
  }

  /**
   * Shortest Path between any two entities (Breadth-First Search)
   */
  static findShortestPath(sourceId: string, targetId: string, maxDepth: number = 4) {
    if (sourceId === targetId) return { path: [sourceId], edges: [] };

    const queue: { nodeId: string; path: string[]; edgePath: string[] }[] = [
      { nodeId: sourceId, path: [sourceId], edgePath: [] },
    ];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxDepth + 1) break;

      const rels = db
        .prepare(`
          SELECT * FROM relationships 
          WHERE source_id = ? OR target_id = ?
        `)
        .all(current.nodeId, current.nodeId) as any[];

      for (const r of rels) {
        const neighborId = r.source_id === current.nodeId ? r.target_id : r.source_id;

        if (neighborId === targetId) {
          const finalPath = [...current.path, targetId];
          const finalEdges = [...current.edgePath, r.id];

          // Fetch entities
          const placeholders = finalPath.map(() => '?').join(',');
          const entities = db
            .prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`)
            .all(...finalPath) as any[];

          const edgePlaceholders = finalEdges.map(() => '?').join(',');
          const edges = db
            .prepare(`SELECT * FROM relationships WHERE id IN (${edgePlaceholders})`)
            .all(...finalEdges) as any[];

          return {
            path: finalPath,
            entities: entities.map((e) => ({
              ...e,
              properties: JSON.parse(e.properties || '{}'),
            })),
            edges: edges.map((e) => ({
              ...e,
              properties: JSON.parse(e.properties || '{}'),
            })),
          };
        }

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({
            nodeId: neighborId,
            path: [...current.path, neighborId],
            edgePath: [...current.edgePath, r.id],
          });
        }
      }
    }

    return { path: [], entities: [], edges: [] };
  }

  /**
   * Summary Dashboard Metrics — filtered by active dataset if datasetId is provided
   */
  static getGlobalMetrics(datasetId?: string) {
    let entityCount: number;
    let relCount: number;
    let datasetCount: number;
    let entitiesByType: { type: string; count: number }[];

    if (datasetId) {
      // Filtered: only show counts for the active dataset
      entityCount = (db.prepare('SELECT count(*) as c FROM entities WHERE dataset_id = ?').get(datasetId) as any).c;
      relCount = (db.prepare('SELECT count(*) as c FROM relationships WHERE dataset_id = ?').get(datasetId) as any).c;
      datasetCount = 1;
      entitiesByType = db
        .prepare('SELECT type, count(*) as count FROM entities WHERE dataset_id = ? GROUP BY type ORDER BY count DESC')
        .all(datasetId) as { type: string; count: number }[];
    } else {
      // Unfiltered global counts (legacy behavior for when no dataset is selected)
      entityCount = (db.prepare('SELECT count(*) as c FROM entities').get() as any).c;
      relCount = (db.prepare('SELECT count(*) as c FROM relationships').get() as any).c;
      datasetCount = (db.prepare('SELECT count(*) as c FROM datasets').get() as any).c;
      entitiesByType = db
        .prepare('SELECT type, count(*) as count FROM entities GROUP BY type ORDER BY count DESC')
        .all() as { type: string; count: number }[];
    }

    // Anomalies, investigations, and events are not dataset-scoped yet — use global counts
    const anomalyCount = (db.prepare("SELECT count(*) as c FROM anomalies WHERE status = 'OPEN'").get() as any).c;
    const invCount = (db.prepare("SELECT count(*) as c FROM investigations WHERE status = 'ACTIVE'").get() as any).c;
    const eventCount = (db.prepare('SELECT count(*) as c FROM events').get() as any).c;

    const anomaliesBySeverity = db
      .prepare('SELECT severity, count(*) as count FROM anomalies GROUP BY severity')
      .all() as { severity: string; count: number }[];

    const recentEvents = db
      .prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT 8')
      .all() as any[];

    return {
      entityCount,
      relCount,
      datasetCount,
      anomalyCount,
      invCount,
      eventCount,
      entitiesByType,
      anomaliesBySeverity,
      activeDatasetId: datasetId || null,
      recentEvents: recentEvents.map((ev) => ({
        ...ev,
        entityIds: JSON.parse(ev.entity_ids || '[]'),
        evidence: JSON.parse(ev.evidence || '[]'),
      })),
    };
  }
}
