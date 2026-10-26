import { db } from '../../../db/database.js';
import { GraphService } from '../../graph.service.js';
import { ToolDefinition } from '../types.js';

/**
 * Automated Pattern Recognition Engine across all uploaded datasets
 */
export function runAutomatedPatternDetection(focusTopic?: string) {
  const patterns: any[] = [];

  // 1. High-Degree Central Hub Entities
  const topHubs = db.prepare(`
    SELECT e.id, e.name, e.type, d.name as dataset_name, count(r.id) as degree
    FROM entities e
    LEFT JOIN relationships r ON (e.id = r.source_id OR e.id = r.target_id)
    LEFT JOIN datasets d ON e.dataset_id = d.id
    GROUP BY e.id
    HAVING degree >= 3
    ORDER BY degree DESC
    LIMIT 6
  `).all() as any[];

  if (topHubs.length > 0) {
    patterns.push({
      patternType: 'CENTRAL_HUB_NODES',
      description: 'Entities exhibiting high connectivity and acting as critical topological junctions or central brokers across records.',
      evidence: topHubs.map((h: any) => `"${h.name}" (${h.type}, in ${h.dataset_name || 'dataset'}) has ${h.degree} direct relationship connections.`),
    });
  }

  // 2. Cross-Dataset Bridges
  const bridges = db.prepare(`
    SELECT e1.name as source_name, e1.type as source_type, d1.name as source_dataset,
           e2.name as target_name, e2.type as target_type, d2.name as target_dataset,
           r.type as rel_type, r.properties
    FROM relationships r
    JOIN entities e1 ON r.source_id = e1.id
    JOIN entities e2 ON r.target_id = e2.id
    LEFT JOIN datasets d1 ON e1.dataset_id = d1.id
    LEFT JOIN datasets d2 ON e2.dataset_id = d2.id
    WHERE d1.id != d2.id AND d1.id IS NOT NULL AND d2.id IS NOT NULL
    LIMIT 8
  `).all() as any[];

  if (bridges.length > 0) {
    patterns.push({
      patternType: 'CROSS_DATASET_BRIDGES',
      description: 'Direct relationship bridges connecting entities across disparate uploaded datasets via shared identifiers.',
      evidence: bridges.map((b: any) => {
        const props = JSON.parse(b.properties || '{}');
        const keyInfo = props.matchKey ? ` (matched on ${props.matchKey} = ${props.matchValue})` : '';
        return `[${b.source_dataset}] "${b.source_name}" -> ${b.rel_type} -> [${b.target_dataset}] "${b.target_name}"${keyInfo}`;
      }),
    });
  }

  // 3. Shared Property Collisions / Identity Overlaps
  const allEntities = db.prepare('SELECT id, name, type, properties, dataset_id FROM entities').all() as any[];
  const propertyValueMap = new Map<string, Array<{ id: string; name: string; type: string; key: string }>>();

  for (const ent of allEntities) {
    const props = JSON.parse(ent.properties || '{}');
    for (const [k, v] of Object.entries(props)) {
      if (!v || typeof v !== 'string' || v.length < 3) continue;
      const kLower = k.toLowerCase();
      if (kLower.includes('phone') || kLower.includes('email') || kLower.includes('ip') || kLower.includes('tax') || kLower.includes('reg') || kLower.includes('account') || kLower.includes('address')) {
        const mapKey = `${kLower}:::${String(v).trim().toLowerCase()}`;
        if (!propertyValueMap.has(mapKey)) {
          propertyValueMap.set(mapKey, []);
        }
        propertyValueMap.get(mapKey)!.push({ id: ent.id, name: ent.name, type: ent.type, key: k });
      }
    }
  }

  const collisions: string[] = [];
  for (const [mapKey, entries] of propertyValueMap.entries()) {
    if (entries.length > 1) {
      const [field, val] = mapKey.split(':::');
      const entityNames = Array.from(new Set(entries.map((e) => `"${e.name}" (${e.type})`))).join(', ');
      collisions.push(`Shared ${field.toUpperCase()} "${val}" connects distinct entities: ${entityNames}`);
    }
  }

  if (collisions.length > 0) {
    patterns.push({
      patternType: 'SHARED_IDENTIFIER_COLLISIONS',
      description: 'Multiple entities sharing identical contact, account, or address attributes—indicating hidden affiliations, aliases, or shell structures.',
      evidence: collisions.slice(0, 6),
    });
  }

  // 4. Isolated / Disconnected Island Entities
  const isolated = db.prepare(`
    SELECT e.id, e.name, e.type, d.name as dataset_name
    FROM entities e
    LEFT JOIN relationships r ON (e.id = r.source_id OR e.id = r.target_id)
    LEFT JOIN datasets d ON e.dataset_id = d.id
    WHERE r.id IS NULL
    LIMIT 5
  `).all() as any[];

  if (isolated.length > 0) {
    patterns.push({
      patternType: 'ISOLATED_ENTITIES',
      description: 'Entities with zero established connections to the rest of the dataset graph (orphaned records or unlinked outliers).',
      evidence: isolated.map((i: any) => `"${i.name}" (${i.type}) in [${i.dataset_name || 'dataset'}] has no graph links.`),
    });
  }

  return {
    patternCount: patterns.length,
    patterns,
  };
}

export const logisticsTools: ToolDefinition[] = [
  {
    name: 'search_datasets',
    description: 'List all user-uploaded datasets, their record counts, and detected column schemas.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const datasets = db.prepare('SELECT id, name, format, record_count, entity_count, relationship_count, detected_schema, uploaded_at FROM datasets').all() as any[];
      return {
        totalDatasets: datasets.length,
        datasets: datasets.map((d: any) => ({
          id: d.id,
          filename: d.name,
          recordCount: d.record_count,
          entityCount: d.entity_count,
          relationshipCount: d.relationship_count,
          columns: JSON.parse(d.detected_schema || '{}')?.columns || [],
          uploadedAt: d.uploaded_at,
        })),
      };
    },
  },
  {
    name: 'search_records',
    description: 'Search raw records across all uploaded datasets for keywords, identifiers, values, emails, phone numbers, or amounts. Supports searching specific datasets.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search term, ID, session, ticket, or IP to search across datasets' },
        datasetFilename: { type: 'string', description: 'Optional: Filter search to a specific dataset filename (e.g. 07_incident_tickets.csv)' },
        limit: { type: 'number', description: 'Maximum number of results to return (default 20)' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const q = String(args.query || '').trim();
      if (!q) return { results: [] };
      const limit = Number(args.limit) || 20;
      const datasetFilter = args.datasetFilename ? String(args.datasetFilename).trim() : undefined;

      // Extract candidate tokens & identifiers from the query
      const tokens = new Set<string>();
      tokens.add(q);

      // Extract specific identifiers (SES_..., NET-..., AUTH-..., IPs, etc.)
      const extractedIds = q.match(/\b([A-Za-z]{2,5}[-_][A-Za-z0-9-_]{2,}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[A-Za-z0-9_-]{5,})\b/g) || [];
      extractedIds.forEach((id) => tokens.add(id));

      // Quoted terms
      const quoted = q.match(/['"]([^'"]{3,})['"]/g) || [];
      quoted.forEach((item) => tokens.add(item.replace(/['"]/g, '').trim()));

      let sql = `
        SELECT r.id, r.dataset_id, r.row_index, r.raw_data, d.name as dataset_name
        FROM raw_records r
        JOIN datasets d ON r.dataset_id = d.id
        WHERE 
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      // Filter by dataset filename if provided
      if (datasetFilter) {
        conditions.push(`d.name LIKE ?`);
        params.push(`%${datasetFilter}%`);
      }

      // Build OR clauses for tokens
      const tokenConditions: string[] = [];
      for (const t of Array.from(tokens).slice(0, 6)) {
        if (t.length >= 2) {
          tokenConditions.push(`r.raw_data LIKE ?`);
          params.push(`%${t}%`);
        }
      }

      if (tokenConditions.length > 0) {
        conditions.push(`(${tokenConditions.join(' OR ')})`);
      } else {
        conditions.push(`r.raw_data LIKE ?`);
        params.push(`%${q}%`);
      }

      sql += conditions.join(' AND ');
      sql += ` ORDER BY r.row_index ASC LIMIT ?`;
      params.push(limit);

      const records = db.prepare(sql).all(...params) as any[];

      return {
        query: q,
        datasetFilter: datasetFilter || 'all_datasets',
        count: records.length,
        totalMatches: records.length,
        results: records.map((r: any) => ({
          recordId: r.id,
          datasetFilename: r.dataset_name,
          rowIndex: r.row_index,
          data: JSON.parse(r.raw_data || '{}'),
        })),
      };
    },
  },
  {
    name: 'search_entity',
    description: 'Search extracted canonical entities by name, ID, type, or property across all uploaded datasets.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Entity identifier, name, or property value' },
        limit: { type: 'number', description: 'Maximum number of results to return (default 10)' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const q = String(args.query || '').trim();
      if (!q) return { results: [] };
      const qLike = `%${q}%`;
      const limit = Number(args.limit) || 10;

      const entities = db.prepare(`
        SELECT e.id, e.name, e.type, e.category, e.properties, e.dataset_id, d.name as dataset_name 
        FROM entities e
        LEFT JOIN datasets d ON e.dataset_id = d.id
        WHERE e.name LIKE ? OR e.id LIKE ? OR e.properties LIKE ?
        LIMIT ?
      `).all(qLike, qLike, qLike, limit) as any[];

      return {
        query: q,
        count: entities.length,
        results: entities.map((e: any) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          datasetFilename: e.dataset_name || 'Uploaded Dataset',
          properties: JSON.parse(e.properties || '{}'),
        })),
      };
    },
  },
  {
    name: 'get_entity',
    description: 'Get full canonical entity details including attributes, type, and source dataset provenance.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: 'The canonical entity ID' },
      },
      required: ['entityId'],
    },
    execute: async (args) => {
      const profile = GraphService.getEntityProfile(args.entityId);
      if (!profile) return { error: `Entity "${args.entityId}" not found in uploaded datasets.` };
      return {
        entity: profile.entity,
        directConnectionCount: profile.relationships.length,
        properties: profile.entity.properties,
        relationships: profile.relationships.map((r: any) => ({
          targetId: r.targetId === args.entityId ? r.sourceId : r.targetId,
          targetName: r.targetId === args.entityId ? r.sourceName : r.targetName,
          type: r.type,
          properties: r.properties,
        })),
      };
    },
  },
  {
    name: 'get_connections',
    description: 'Retrieve connected entities and relationships linking across datasets in the unified graph.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: 'Entity ID to expand connections for' },
        hops: { type: 'number', description: 'Number of hops to expand (default 1, max 2)' },
      },
      required: ['entityId'],
    },
    execute: async (args) => {
      const hops = Math.min(2, Math.max(1, Number(args.hops) || 1));
      const sub = GraphService.expandEntity(args.entityId, hops);
      return {
        entityId: args.entityId,
        hops,
        nodeCount: sub.nodes.length,
        nodes: sub.nodes.map((n: any) => ({
          id: n.data.id,
          name: n.data.name,
          type: n.data.type,
          properties: n.data.properties,
        })),
        edges: sub.edges.map((e: any) => ({
          source: e.data.source,
          target: e.data.target,
          relationshipType: e.data.type,
          label: e.data.label,
          properties: e.data.properties,
        })),
      };
    },
  },
  {
    name: 'find_path',
    description: 'Find the relationship path connecting two entities across multiple uploaded datasets.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {
        sourceId: { type: 'string', description: 'Source entity ID' },
        targetId: { type: 'string', description: 'Target entity ID' },
      },
      required: ['sourceId', 'targetId'],
    },
    execute: async (args) => {
      return GraphService.findShortestPath(args.sourceId, args.targetId);
    },
  },
  {
    name: 'detect_data_patterns',
    description: 'Run automated pattern analysis across all uploaded datasets to discover high-degree hubs, cross-file bridges, property collisions (e.g. shared phones, emails, addresses), and isolated clusters.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {
        focusTopic: { type: 'string', description: 'Optional entity name, property, or column to focus pattern detection on' },
      },
    },
    execute: async (args) => {
      return runAutomatedPatternDetection(args.focusTopic);
    },
  },
  {
    name: 'get_graph_stats',
    description: 'Get high-level graph topology metrics, top connected hub entities, relationship distributions, and dataset breakdown.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const totalEntities = (db.prepare('SELECT count(*) as c FROM entities').get() as any)?.c || 0;
      const totalRelationships = (db.prepare('SELECT count(*) as c FROM relationships').get() as any)?.c || 0;
      const totalDatasets = (db.prepare('SELECT count(*) as c FROM datasets').get() as any)?.c || 0;

      const hubs = db.prepare(`
        SELECT e.id, e.name, e.type, d.name as dataset_name, count(r.id) as degree
        FROM entities e
        LEFT JOIN relationships r ON (e.id = r.source_id OR e.id = r.target_id)
        LEFT JOIN datasets d ON e.dataset_id = d.id
        GROUP BY e.id
        ORDER BY degree DESC
        LIMIT 8
      `).all() as any[];

      const typeBreakdown = db.prepare(`
        SELECT type, count(*) as count FROM entities GROUP BY type ORDER BY count DESC
      `).all() as any[];

      const relBreakdown = db.prepare(`
        SELECT type, count(*) as count FROM relationships GROUP BY type ORDER BY count DESC
      `).all() as any[];

      return {
        totalEntities,
        totalRelationships,
        totalDatasets,
        topHubEntities: hubs.map((h: any) => ({
          id: h.id,
          name: h.name,
          type: h.type,
          dataset: h.dataset_name,
          connectedDegree: h.degree,
        })),
        entityDistribution: typeBreakdown,
        relationshipDistribution: relBreakdown,
      };
    },
  },
  {
    name: 'query_dataset_statistics',
    description: 'Inspect column statistics, value distributions, distinct counts, and numeric summaries for uploaded datasets.',
    domain: 'logistics',
    parameters: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Optional specific dataset ID to inspect' },
        columnName: { type: 'string', description: 'Optional specific column to profile' },
      },
    },
    execute: async (args) => {
      const datasetId = args.datasetId;
      let datasets = [];
      if (datasetId) {
        datasets = db.prepare('SELECT * FROM datasets WHERE id = ?').all(datasetId) as any[];
      } else {
        datasets = db.prepare('SELECT * FROM datasets').all() as any[];
      }

      const stats = datasets.map((d: any) => {
        const schema = JSON.parse(d.detected_schema || '{}');
        const sampleRecords = db.prepare('SELECT raw_data FROM raw_records WHERE dataset_id = ? LIMIT 20').all(d.id) as any[];
        return {
          datasetId: d.id,
          datasetName: d.name,
          recordCount: d.record_count,
          columns: schema.columns || [],
          samplePreview: sampleRecords.map((r: any) => JSON.parse(r.raw_data || '{}')),
        };
      });

      return { datasets: stats };
    },
  },
];
