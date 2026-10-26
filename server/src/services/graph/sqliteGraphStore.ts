import crypto from 'crypto';
import { db } from '../../db/database.js';
import { Entity, EntityType, GraphData, GraphEdge, GraphNode, Relationship } from '../../types/index.js';
import { GraphStore, ProvenancedTriple } from '../../types/kg.types.js';
import { SchemaMapper } from './schemaMapper.js';
import { EntityResolutionHook } from './resolutionHook.js';

export class SQLiteGraphStore implements GraphStore {
  /**
   * Generates a deterministic SHA-256 hash ID for a triple based on its core components.
   */
  static generateTripleId(subjectId: string, predicate: string, objectId: string, sourceFile: string): string {
    return crypto
      .createHash('sha256')
      .update(`${subjectId.trim()}:${predicate.trim().toUpperCase()}:${objectId.trim()}:${sourceFile.trim()}`)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Upsert a provenanced triple into extracted_triples and synchronize corresponding
   * entity nodes and relationship edges into the main graph tables.
   */
  async upsertTriple(triple: ProvenancedTriple): Promise<string> {
    const normSub = SchemaMapper.normalizeEntityType(triple.subjectType);
    const normObj = SchemaMapper.normalizeEntityType(triple.objectType);
    const normPred = SchemaMapper.normalizePredicate(triple.predicate);

    // Entity Resolution Hook: resolve subject and object against existing entities before write
    const resolvedSub = EntityResolutionHook.resolve({
      rawId: triple.subjectEntityId,
      name: triple.subjectName,
      type: normSub.canonicalType,
      category: normSub.category,
      sourceFile: triple.sourceFile,
      properties: triple.properties,
    });

    const resolvedObj = EntityResolutionHook.resolve({
      rawId: triple.objectEntityId,
      name: triple.objectName,
      type: normObj.canonicalType,
      category: normObj.category,
      sourceFile: triple.sourceFile,
      properties: triple.properties,
    });

    const finalSubjectId = resolvedSub.canonicalId;
    const finalSubjectName = resolvedSub.canonicalName;
    const finalObjectId = resolvedObj.canonicalId;
    const finalObjectName = resolvedObj.canonicalName;

    const tripleId = triple.id || SQLiteGraphStore.generateTripleId(
      finalSubjectId,
      triple.predicate,
      finalObjectId,
      triple.sourceFile
    );

    const now = new Date().toISOString();
    const observedAt = triple.observedAt || now;
    const edgeId = `rel_${tripleId}`;

    const executeTransaction = db.transaction(() => {
      // 1. Ensure Subject Entity exists in `entities`
      const existingSub = db.prepare('SELECT id FROM entities WHERE id = ?').get(finalSubjectId);
      if (!existingSub) {
        db.prepare(`
          INSERT INTO entities 
          (id, name, type, label, category, risk_level, risk_score, summary, properties, tags, aliases, dataset_id, source_dataset_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          finalSubjectId,
          finalSubjectName,
          normSub.canonicalType,
          finalSubjectName,
          normSub.category,
          normSub.defaultRisk,
          10,
          `Entity extracted from ${triple.sourceFile}`,
          JSON.stringify({ raw_type: triple.subjectType, first_seen: now }),
          JSON.stringify(['extracted', normSub.category.toLowerCase()]),
          JSON.stringify([finalSubjectName]),
          null,
          triple.sourceFile,
          now,
          now
        );
      }

      // 2. Ensure Object Entity exists in `entities`
      const existingObj = db.prepare('SELECT id FROM entities WHERE id = ?').get(finalObjectId);
      if (!existingObj) {
        db.prepare(`
          INSERT INTO entities 
          (id, name, type, label, category, risk_level, risk_score, summary, properties, tags, aliases, dataset_id, source_dataset_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          finalObjectId,
          finalObjectName,
          normObj.canonicalType,
          finalObjectName,
          normObj.category,
          normObj.defaultRisk,
          10,
          `Entity extracted from ${triple.sourceFile}`,
          JSON.stringify({ raw_type: triple.objectType, first_seen: now }),
          JSON.stringify(['extracted', normObj.category.toLowerCase()]),
          JSON.stringify([finalObjectName]),
          null,
          triple.sourceFile,
          now,
          now
        );
      }

      // 3. Upsert into extracted_triples
      db.prepare(`
        INSERT INTO extracted_triples 
        (id, subject_entity_id, subject_name, subject_type, predicate, object_entity_id, object_name, object_type, source_file, source_row, source_span, extractor_model, extractor_version, confidence, status, observed_at, properties, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          confidence = excluded.confidence,
          status = excluded.status,
          properties = excluded.properties,
          observed_at = excluded.observed_at
      `).run(
        tripleId,
        finalSubjectId,
        finalSubjectName,
        normSub.canonicalType,
        normPred.label,
        finalObjectId,
        finalObjectName,
        normObj.canonicalType,
        triple.sourceFile,
        triple.sourceRow ?? null,
        triple.sourceSpan ?? null,
        triple.extractorModel,
        triple.extractorVersion,
        triple.confidence,
        triple.status || 'unreviewed',
        observedAt,
        JSON.stringify(triple.properties || {}),
        triple.createdAt || now
      );

      // 4. Synchronize into relationships table (so UI graph & investigation views see it)
      const edgeProps = {
        source_file: triple.sourceFile,
        source_row: triple.sourceRow,
        source_span: triple.sourceSpan,
        extractor_model: triple.extractorModel,
        extractor_version: triple.extractorVersion,
        observed_at: observedAt,
        triple_id: tripleId,
        ...(triple.properties || {})
      };

      db.prepare(`
        INSERT INTO relationships 
        (id, source_id, target_id, type, label, confidence, properties, risk_level, source_dataset_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          label = excluded.label,
          confidence = excluded.confidence,
          properties = excluded.properties
      `).run(
        edgeId,
        finalSubjectId,
        finalObjectId,
        normPred.canonicalPredicate,
        normPred.label,
        triple.confidence,
        JSON.stringify(edgeProps),
        normSub.defaultRisk,
        triple.sourceFile,
        triple.createdAt || now
      );
    });

    executeTransaction();
    return edgeId;
  }

  /**
   * Returns N-hop neighborhood graph around an entity formatted as GraphData.
   */
  async neighbors(entityId: string, hops: number = 1): Promise<GraphData> {
    const visitedNodes = new Set<string>([entityId]);
    const discoveredEdges = new Map<string, any>();
    let currentLevel = new Set<string>([entityId]);

    const maxHops = Math.min(Math.max(1, hops), 4);

    for (let h = 0; h < maxHops; h++) {
      if (currentLevel.size === 0) break;
      const nextLevel = new Set<string>();

      const placeholders = Array.from(currentLevel).map(() => '?').join(',');
      const query = `
        SELECT * FROM relationships 
        WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})
      `;

      const rels = db.prepare(query).all(...Array.from(currentLevel), ...Array.from(currentLevel)) as any[];

      for (const r of rels) {
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
        riskLevel: e.risk_level,
        riskScore: e.risk_score,
        category: e.category,
        label: e.label || e.name,
        properties: typeof e.properties === 'string' ? JSON.parse(e.properties || '{}') : (e.properties || {}),
      },
    }));

    const edges: GraphEdge[] = Array.from(discoveredEdges.values()).map((r) => ({
      data: {
        id: r.id,
        source: r.source_id,
        target: r.target_id,
        type: r.type,
        label: r.label || r.type,
        confidence: r.confidence,
        riskLevel: r.risk_level,
        properties: typeof r.properties === 'string' ? JSON.parse(r.properties || '{}') : (r.properties || {}),
      },
    }));

    return { nodes, edges };
  }

  /**
   * Finds the shortest path between two entities and returns the entities along that chain.
   */
  async shortestPath(sourceId: string, targetId: string, maxDepth: number = 4): Promise<Entity[]> {
    if (sourceId === targetId) {
      const ent = db.prepare('SELECT * FROM entities WHERE id = ?').get(sourceId) as any;
      return ent ? [{ ...ent, properties: JSON.parse(ent.properties || '{}'), tags: JSON.parse(ent.tags || '[]'), aliases: JSON.parse(ent.aliases || '[]') }] : [];
    }

    const queue: { nodeId: string; path: string[] }[] = [{ nodeId: sourceId, path: [sourceId] }];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxDepth + 1) break;

      const rels = db
        .prepare('SELECT source_id, target_id FROM relationships WHERE source_id = ? OR target_id = ?')
        .all(current.nodeId, current.nodeId) as { source_id: string; target_id: string }[];

      for (const r of rels) {
        const neighborId = r.source_id === current.nodeId ? r.target_id : r.source_id;

        if (neighborId === targetId) {
          const finalPath = [...current.path, targetId];
          const placeholders = finalPath.map(() => '?').join(',');
          const rawEntities = db
            .prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`)
            .all(...finalPath) as any[];

          const entityMap = new Map(rawEntities.map((e) => [e.id, {
            ...e,
            properties: JSON.parse(e.properties || '{}'),
            tags: JSON.parse(e.tags || '[]'),
            aliases: JSON.parse(e.aliases || '[]'),
          }]));

          return finalPath.map((id) => entityMap.get(id)!).filter(Boolean);
        }

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push({
            nodeId: neighborId,
            path: [...current.path, neighborId],
          });
        }
      }
    }

    return [];
  }

  /**
   * Cascade purge all triples and corresponding relationships originating from a given source file.
   */
  async purgeBySource(sourceFile: string): Promise<number> {
    const cleanSource = sourceFile.trim();
    let purgedCount = 0;

    const executePurge = db.transaction(() => {
      // Count triples to be purged
      const countRow = db.prepare('SELECT count(*) as c FROM extracted_triples WHERE source_file = ?').get(cleanSource) as any;
      purgedCount = countRow ? countRow.c : 0;

      // 1. Delete matching extracted_triples
      db.prepare('DELETE FROM extracted_triples WHERE source_file = ?').run(cleanSource);

      // 2. Delete relationships tied to this source_dataset_id
      db.prepare('DELETE FROM relationships WHERE source_dataset_id = ?').run(cleanSource);
    });

    executePurge();
    return purgedCount;
  }

  /**
   * Fetch all extracted triples for a given source file.
   */
  getTriplesBySource(sourceFile: string): ProvenancedTriple[] {
    const rows = db.prepare('SELECT * FROM extracted_triples WHERE source_file = ? ORDER BY created_at ASC').all(sourceFile) as any[];
    return rows.map((r) => ({
      id: r.id,
      subjectEntityId: r.subject_entity_id,
      subjectName: r.subject_name,
      subjectType: r.subject_type,
      predicate: r.predicate,
      objectEntityId: r.object_entity_id,
      objectName: r.object_name,
      objectType: r.object_type,
      sourceFile: r.source_file,
      sourceRow: r.source_row,
      sourceSpan: r.source_span,
      extractorModel: r.extractor_model,
      extractorVersion: r.extractor_version,
      confidence: r.confidence,
      status: r.status,
      observedAt: r.observed_at,
      properties: JSON.parse(r.properties || '{}'),
      createdAt: r.created_at,
    }));
  }

  /**
   * Update the review status of an extracted triple.
   */
  updateTripleStatus(tripleId: string, status: 'unreviewed' | 'verified' | 'rejected'): boolean {
    const result = db.prepare('UPDATE extracted_triples SET status = ? WHERE id = ?').run(status, tripleId);
    return result.changes > 0;
  }
}

export const graphStore: GraphStore = new SQLiteGraphStore();
