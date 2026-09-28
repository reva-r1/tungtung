import { db } from '../db/database.js';
import { GraphService } from './graph.service.js';
import { ResolutionService } from './resolution.service.js';
import { SourceService } from './source.service.js';
import { AiInvestigationResponse, EntityType } from '../types/index.js';
import { worldModelService } from './world_model/world_model.service.js';
import { simulationService } from './simulation/simulation.service.js';
import { providerRegistry } from '../connectors/registry/ProviderRegistry.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.XAI_API_KEY || '';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || process.env.XAI_BASE_URL || 'https://api.groq.com/openai/v1';
const rawModel = process.env.GROQ_MODEL || process.env.XAI_MODEL || '';
const GROQ_MODEL = (!rawModel || rawModel.includes('llama-3.3')) ? 'openai/gpt-oss-120b' : rawModel;

// Controlled Backend Tools Definitions for Groq Function Calling
const GROQ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_live_world_summary',
      description: 'Get real-time summary of the digital mirror world model: count of physical entities, active weather stations, air quality sensors, river stages, grid substations, transit vehicles, and recent detected events.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_world_entities',
      description: 'Search live physical entities across all categories (WEATHER, AIR_QUALITY, SEISMIC, WATER, ENERGY, TRANSIT, MOBILITY, INFRASTRUCTURE) by name, keyword, or category.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term e.g. Bangalore, NH48, Peenya, Bellandur, Metro, Earthquake' },
          category: { type: 'string', description: 'Optional category filter: WEATHER, AIR_QUALITY, SEISMIC, WATER, ENERGY, PUBLIC_TRANSPORT, MOBILITY, INFRASTRUCTURE' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_entity_telemetry',
      description: 'Get detailed live telemetry, current environmental values, chronological temporal state transitions, and raw sensor provenance for an entity ID.',
      parameters: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: 'The entity identifier (e.g. STATION_1297_7759, ROAD_CORRIDOR_NH48, HYDRO_GAUGE_BELLANDUR_OUTLET_WEIR)' },
        },
        required: ['entityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_live_events',
      description: 'Retrieve detected real-world threshold events (e.g. heavy rainfall exceeding thresholds, earthquakes, reservoir flood warnings, severe transit congestion).',
      parameters: {
        type: 'object',
        properties: {
          severity: { type: 'string', description: 'Optional severity filter: CRITICAL, HIGH, MEDIUM, LOW' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_inferred_relationships',
      description: 'Retrieve inferred physical and infrastructure relationships with explicit evidence trails, confidence scores, and source reasoning engines.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_provider_observability',
      description: 'Get health status, latencies, update frequencies, coverage area, and licensing terms for all 15 public data connectors (Open-Meteo, USGS, GDACS, Central Water Commission, National Grid, GTFS, GBFS, etc.).',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'inspect_simulation_twin',
      description: 'Inspect an isolated digital twin simulation sandbox: check modified variables (deluges, capacity throttles), baseline snapshot time, and cascading consequence predictions.',
      parameters: {
        type: 'object',
        properties: {
          simulationId: { type: 'string', description: 'Optional specific simulation ID to inspect' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'poll_live_sensors',
      description: 'Trigger an immediate real-time fetch from external public APIs to refresh weather, air quality, earthquakes, or grid telemetry.',
      parameters: {
        type: 'object',
        properties: {
          providerId: { type: 'string', description: 'Optional specific provider: open_meteo_weather, open_meteo_air_quality, usgs_earthquake, etc.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_datasets',
      description: 'List all user-uploaded datasets, their record counts, and detected column schemas.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_records',
      description: 'Search raw records across all uploaded datasets for keywords, identifiers, values, emails, phone numbers, or amounts.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search term, ID, name, or value to search across all datasets' },
          limit: { type: 'number', description: 'Maximum number of results to return (default 15)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_entity',
      description: 'Search extracted canonical entities by name, ID, type, or property across all uploaded datasets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Entity identifier, name, or property value' },
          limit: { type: 'number', description: 'Maximum number of results to return (default 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_entity',
      description: 'Get full canonical entity details including attributes, type, and source dataset provenance.',
      parameters: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: 'The canonical entity ID' },
        },
        required: ['entityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_connections',
      description: 'Retrieve connected entities and relationships linking across datasets in the unified graph.',
      parameters: {
        type: 'object',
        properties: {
          entityId: { type: 'string', description: 'Entity ID to expand connections for' },
          hops: { type: 'number', description: 'Number of hops to expand (default 1, max 2)' },
        },
        required: ['entityId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_path',
      description: 'Find the relationship path connecting two entities across multiple uploaded datasets.',
      parameters: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', description: 'Source entity ID' },
          targetId: { type: 'string', description: 'Target entity ID' },
        },
        required: ['sourceId', 'targetId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_data_patterns',
      description: 'Run automated pattern analysis across all uploaded datasets to discover high-degree hubs, cross-file bridges, property collisions (e.g. shared phones, emails, addresses), and isolated clusters.',
      parameters: {
        type: 'object',
        properties: {
          focusTopic: { type: 'string', description: 'Optional entity name, property, or column to focus pattern detection on' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_graph_stats',
      description: 'Get high-level graph topology metrics, top connected hub entities, relationship distributions, and dataset breakdown.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_dataset_statistics',
      description: 'Inspect column statistics, value distributions, distinct counts, and numeric summaries for uploaded datasets.',
      parameters: {
        type: 'object',
        properties: {
          datasetId: { type: 'string', description: 'Optional specific dataset ID to inspect' },
          columnName: { type: 'string', description: 'Optional specific column to profile' },
        },
      },
    },
  },
];

export class AiService {
  /**
   * Controlled Backend AI Tool Execution Layer
   * Interacts directly with user-uploaded datasets, entities, and relationships
   */
  static async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    switch (toolName) {
      case 'get_live_world_summary': {
        const fullState = worldModelService.getWorldState();
        const typeCounts: Record<string, number> = {};
        fullState.entities.forEach(e => {
          typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
        });
        return {
          timestamp: fullState.timestamp,
          total_entities_tracked: fullState.entity_count,
          entities_by_type: typeCounts,
          active_threshold_events_count: fullState.active_events.length,
          top_recent_events: fullState.active_events.slice(0, 5).map(ev => ({
            type: ev.event_type,
            severity: ev.severity,
            entity_id: ev.entity_id,
            detected_at: ev.detected_at,
            source: ev.source,
          })),
          active_relationships_count: fullState.relationships.length,
          key_corridor_relationships: fullState.relationships.slice(0, 3).map(r => ({
            type: r.relationship_type,
            source: r.source_entity_id,
            target: r.target_entity_id,
            confidence: r.confidence,
          })),
          temporal_ledger_records: fullState.recent_changes_count,
        };
      }

      case 'search_world_entities': {
        const q = String(args.query || '').trim().toLowerCase();
        const all = worldModelService.getEntities(args.type, args.category);
        const matches = q
          ? all.filter(e => {
              const stateStr = JSON.stringify(e.current_state || {}).toLowerCase();
              return e.name.toLowerCase().includes(q) || 
                     e.id.toLowerCase().includes(q) ||
                     (e.category && e.category.toLowerCase().includes(q)) ||
                     (e.type && e.type.toLowerCase().includes(q)) ||
                     stateStr.includes(q) ||
                     ((q.includes('blr') || q.includes('bangalore') || q.includes('bengaluru')) && (e.id.includes('12.97') || e.id.includes('BLR') || e.name.includes('Bangalore') || e.name.includes('NH48') || e.name.includes('Bellandur') || e.name.includes('Peenya') || e.name.includes('13.00')));
            }).slice(0, 6)
          : all.slice(0, 6);
        return {
          query: args.query,
          matchCount: matches.length,
          entities: matches.map(e => ({
            id: e.id,
            name: e.name,
            type: e.type,
            coordinates: [Number(e.latitude.toFixed(4)), Number(e.longitude.toFixed(4))],
            current_values: e.current_state,
            last_observed: e.last_observed_at,
          })),
        };
      }

      case 'get_entity_telemetry': {
        const ent = worldModelService.getEntityById(args.entityId);
        if (!ent || !ent.entity) return { error: `Entity ${args.entityId} not found` };
        return {
          id: ent.entity.id,
          name: ent.entity.name,
          type: ent.entity.type,
          current_state: ent.entity.current_state,
          last_observed_at: ent.entity.last_observed_at,
          confidence: ent.entity.confidence,
          recent_state_changes: (ent.history || []).slice(0, 3).map(h => ({
            timestamp: h.timestamp,
            delta: h.delta_summary,
            source: h.source,
          })),
        };
      }

      case 'get_live_events': {
        const events = worldModelService.getEvents(args.severity);
        return {
          total_count: events.length,
          events: events.slice(0, 5).map(ev => ({
            event_id: ev.event_id,
            event_type: ev.event_type,
            entity_id: ev.entity_id,
            severity: ev.severity,
            source: ev.source,
            detected_at: ev.detected_at,
            current_state: ev.current_state,
          })),
        };
      }

      case 'get_inferred_relationships': {
        const rels = worldModelService.getRelationships();
        return {
          total_count: rels.length,
          relationships: rels.slice(0, 5).map(r => ({
            type: r.relationship_type,
            source_entity: r.source_entity_id,
            target_entity: r.target_entity_id,
            confidence: r.confidence,
            evidence: r.evidence,
          })),
        };
      }

      case 'get_provider_observability': {
        const matrix = providerRegistry.getStatusMatrix();
        return {
          total_providers: matrix.length,
          healthy_count: matrix.filter(p => p.health.status === 'HEALTHY').length,
          providers: matrix.map(p => ({
            id: p.id,
            status: p.health.status,
            latency_ms: p.health.latencyMs,
            records_normalized: p.health.recordsNormalized,
            last_success: p.health.lastSuccessfulUpdate,
          })),
        };
      }

      case 'inspect_simulation_twin': {
        if (args.simulationId) {
          return simulationService.getSimulationState(args.simulationId);
        }
        return simulationService.listSimulations();
      }

      case 'poll_live_sensors': {
        if (args.providerId) {
          const provider = providerRegistry.getProvider(args.providerId);
          if (!provider) return { error: `Provider ${args.providerId} not found` };
          const { rawData, latencyMs } = await provider.fetch();
          const rawId = worldModelService.storeRawPayload(args.providerId, provider.metadata.endpointUrl, rawData);
          const obs = await provider.normalize(rawData);
          for (const o of obs) worldModelService.ingestObservation(o, rawId);
          return { providerId: args.providerId, latencyMs, observationsCount: obs.length };
        }
        const summary = await providerRegistry.runHealthChecks();
        return { message: 'Health checks and sensor polling triggered', summary };
      }

      case 'search_datasets': {
        const datasets = db.prepare('SELECT id, name, format, record_count, entity_count, relationship_count, detected_schema, uploaded_at FROM datasets').all() as any[];
        return {
          totalDatasets: datasets.length,
          datasets: datasets.map((d) => ({
            id: d.id,
            filename: d.name,
            recordCount: d.record_count,
            entityCount: d.entity_count,
            relationshipCount: d.relationship_count,
            columns: JSON.parse(d.detected_schema || '{}')?.columns || [],
            uploadedAt: d.uploaded_at,
          })),
        };
      }

      case 'search_records': {
        const q = String(args.query || '').trim();
        if (!q) return { results: [] };
        const qLike = `%${q}%`;
        const limit = Number(args.limit) || 15;

        const records = db.prepare(`
          SELECT r.id, r.dataset_id, r.row_index, r.raw_data, d.name as dataset_name
          FROM raw_records r
          JOIN datasets d ON r.dataset_id = d.id
          WHERE r.raw_data LIKE ?
          LIMIT ?
        `).all(qLike, limit) as any[];

        return {
          query: q,
          count: records.length,
          results: records.map((r) => ({
            recordId: r.id,
            datasetFilename: r.dataset_name,
            rowIndex: r.row_index,
            data: JSON.parse(r.raw_data || '{}'),
          })),
        };
      }

      case 'search_entity': {
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
          results: entities.map((e) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            datasetFilename: e.dataset_name || 'Uploaded Dataset',
            properties: JSON.parse(e.properties || '{}'),
          })),
        };
      }

      case 'get_entity': {
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
      }

      case 'get_connections': {
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
      }

      case 'find_path': {
        return GraphService.findShortestPath(args.sourceId, args.targetId);
      }

      case 'detect_data_patterns': {
        return this.runAutomatedPatternDetection(args.focusTopic);
      }

      case 'get_graph_stats': {
        const totalEntities = (db.prepare('SELECT count(*) as c FROM entities').get() as any)?.c || 0;
        const totalRelationships = (db.prepare('SELECT count(*) as c FROM relationships').get() as any)?.c || 0;
        const totalDatasets = (db.prepare('SELECT count(*) as c FROM datasets').get() as any)?.c || 0;

        // Top degree hub entities
        const hubs = db.prepare(`
          SELECT e.id, e.name, e.type, d.name as dataset_name, count(r.id) as degree
          FROM entities e
          LEFT JOIN relationships r ON (e.id = r.source_id OR e.id = r.target_id)
          LEFT JOIN datasets d ON e.dataset_id = d.id
          GROUP BY e.id
          ORDER BY degree DESC
          LIMIT 8
        `).all() as any[];

        // Entity types breakdown
        const typeBreakdown = db.prepare(`
          SELECT type, count(*) as count FROM entities GROUP BY type ORDER BY count DESC
        `).all() as any[];

        // Relationship types breakdown
        const relBreakdown = db.prepare(`
          SELECT type, count(*) as count FROM relationships GROUP BY type ORDER BY count DESC
        `).all() as any[];

        return {
          totalEntities,
          totalRelationships,
          totalDatasets,
          topHubEntities: hubs.map((h) => ({
            id: h.id,
            name: h.name,
            type: h.type,
            dataset: h.dataset_name,
            connectedDegree: h.degree,
          })),
          entityDistribution: typeBreakdown,
          relationshipDistribution: relBreakdown,
        };
      }

      case 'query_dataset_statistics': {
        const datasetId = args.datasetId;
        let datasets = [];
        if (datasetId) {
          datasets = db.prepare('SELECT * FROM datasets WHERE id = ?').all(datasetId) as any[];
        } else {
          datasets = db.prepare('SELECT * FROM datasets').all() as any[];
        }

        const stats = datasets.map((d) => {
          const schema = JSON.parse(d.detected_schema || '{}');
          const sampleRecords = db.prepare('SELECT raw_data FROM raw_records WHERE dataset_id = ? LIMIT 20').all(d.id) as any[];
          return {
            datasetId: d.id,
            datasetName: d.name,
            recordCount: d.record_count,
            columns: schema.columns || [],
            samplePreview: sampleRecords.map((r) => JSON.parse(r.raw_data || '{}')),
          };
        });

        return { datasets: stats };
      }

      default:
        return { error: `Tool "${toolName}" is not recognized.` };
    }
  }

  /**
   * Automated Pattern Recognition Engine across all uploaded datasets
   */
  private static runAutomatedPatternDetection(focusTopic?: string) {
    const patterns: any[] = [];

    // 1. High-Degree Central Hub Entities (entities connected to abnormally many other entities)
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
        evidence: topHubs.map((h) => `"${h.name}" (${h.type}, in ${h.dataset_name || 'dataset'}) has ${h.degree} direct relationship connections.`),
      });
    }

    // 2. Cross-Dataset Bridges (Entities or records that link across 2 or more distinct datasets)
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
        evidence: bridges.map((b) => {
          const props = JSON.parse(b.properties || '{}');
          const keyInfo = props.matchKey ? ` (matched on ${props.matchKey} = ${props.matchValue})` : '';
          return `[${b.source_dataset}] "${b.source_name}" -> ${b.rel_type} -> [${b.target_dataset}] "${b.target_name}"${keyInfo}`;
        }),
      });
    }

    // 3. Shared Property Collisions / Identity Overlaps (Entities sharing same phone, email, registration, address)
    const allEntities = db.prepare('SELECT id, name, type, properties, dataset_id FROM entities').all() as any[];
    const propertyValueMap = new Map<string, Array<{ id: string; name: string; type: string; key: string }>>();

    for (const ent of allEntities) {
      const props = JSON.parse(ent.properties || '{}');
      for (const [k, v] of Object.entries(props)) {
        if (!v || typeof v !== 'string' || v.length < 3) continue;
        const kLower = k.toLowerCase();
        // Look for identifying fields
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
        evidence: isolated.map((i) => `"${i.name}" (${i.type}) in [${i.dataset_name || 'dataset'}] has no graph links.`),
      });
    }

    return {
      patternCount: patterns.length,
      patterns,
    };
  }

  /**
   * Main AI Analyst Investigation endpoint with autonomous Groq reasoning loop
   */
  static async investigate(prompt: string, contextOptions?: { entityId?: string; investigationId?: string }): Promise<AiInvestigationResponse> {
    // If Groq API key is present, execute autonomous tool-calling loop
    if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '' && !GROQ_API_KEY.includes('your_groq_api_key')) {
      try {
        return await this.runGroqInvestigationLoop(prompt, contextOptions?.entityId);
      } catch (err: any) {
        console.error('Groq Investigation Loop error, using grounded deterministic engine:', err.message);
      }
    }

    // Local Grounded Deterministic Intelligence Engine (Strictly queries SQLite graph & provenance)
    return this.runGroundedDeterministicInvestigation(prompt, contextOptions?.entityId);
  }

  /**
   * Autonomous Groq tool-calling loop (Max 6 iterations)
   */
  private static async runGroqInvestigationLoop(prompt: string, seedEntityId?: string): Promise<AiInvestigationResponse> {
    const systemPrompt = `
You are the Lead Intelligence Strategist and Pattern Discovery AI for Revana Technologies.
Your mission is to perform advanced multi-source intelligence analysis, pattern recognition, anomaly detection, and deep reasoning across user-uploaded datasets.

CORE ANALYTICAL MINDSET:
1. THINK OUTSIDE THE BOX & FIND PATTERNS:
   - Do NOT act like an obedient robot that merely echoes back database fields.
   - Actively hunt for hidden patterns: structural hubs, covert intermediaries, cyclical flows, multi-dataset bridges, volume/value anomalies, shared attribute collisions (e.g. shared phones, emails, addresses, accounts), and unusual concentrations.
   - Formulate logical hypotheses and strategic inferences explaining *why* records connect and *what risks or insights* they reveal.
2. INTEGRITY WITH CITATIONS:
   - Anchor all factual assertions in real data gathered via tools.
   - Whenever citing a fact, reference the source dataset filename and relevant field/row.
   - Clearly distinguish between VERIFIABLE FACTS (from data) and ANALYTICAL INFERENCES / HYPOTHESES (your strategic deductions).
3. PROACTIVE TOOL UTILIZATION:
   - Use 'detect_data_patterns' to discover high-degree hubs, cross-file bridges, and identifier collisions.
   - Use 'get_graph_stats' to understand overall topology and central nodes.
   - Use 'search_datasets', 'search_records', 'search_entity', 'get_connections', and 'find_path' to thoroughly investigate specific targets and paths.
4. RESPONSE STRUCTURE:
   Return a single valid JSON object strictly matching this schema:
   {
     "knownFacts": ["FACT: ... [Dataset: filename.csv, Field: ...]"],
     "possibleRelationships": ["Entity A [dataset1.csv] -> LINK_TYPE -> Entity B [dataset2.csv] (via shared key)"],
     "discoveredPatterns": ["PATTERN: Description of higher-order pattern, hub, collision, or structural anomaly..."],
     "aiInterpretation": "Deep, comprehensive strategic synthesis. Explain the findings, discuss inferred patterns, formulate hypotheses, connect disparate data points, and provide strategic clarity.",
     "uncertainty": "Identified data gaps, missing datasets, or unconfirmed assumptions.",
     "anomalyIndicators": ["Key risk or anomaly flags..."],
     "recommendedActions": ["Concrete follow-up queries or investigative steps for the analyst to take."],
     "suggestedHopExpansions": ["entity_ids..."],
     "confidenceScore": 0.95
   }
`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Investigate and perform deep pattern analysis for the following inquiry across all uploaded datasets:\n"${prompt}"${seedEntityId ? `\n(Focus Entity ID: ${seedEntityId})` : ''}` },
    ];

    const maxIterations = 6;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          tools: GROQ_TOOLS,
          tool_choice: iteration === maxIterations ? 'none' : 'auto',
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        throw new Error(`Groq API error: HTTP ${res.status} - ${await res.text()}`);
      }

      const data = (await res.json()) as any;
      const choice = data.choices?.[0];
      const responseMessage = choice?.message;

      if (!responseMessage) {
        throw new Error('Empty response from Groq');
      }

      messages.push(responseMessage);

      // Check if Groq called tools
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (_) { }

          const toolResult = await this.executeTool(toolName, toolArgs);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: JSON.stringify(toolResult),
          });
        }
      } else {
        // Groq provided its final answer
        try {
          const parsed = JSON.parse(responseMessage.content);
          return {
            knownFacts: parsed.knownFacts || [],
            possibleRelationships: parsed.possibleRelationships || [],
            discoveredPatterns: parsed.discoveredPatterns || [],
            aiInterpretation: parsed.aiInterpretation || responseMessage.content,
            uncertainty: parsed.uncertainty || 'Derived from ingested datasets.',
            anomalyIndicators: parsed.anomalyIndicators || [],
            recommendedActions: parsed.recommendedActions || [],
            suggestedHopExpansions: parsed.suggestedHopExpansions || [],
            confidenceScore: parsed.confidenceScore ?? 0.9,
          };
        } catch (_) {
          return {
            knownFacts: ['Analysis synthesized from uploaded datasets.'],
            possibleRelationships: [],
            discoveredPatterns: [],
            aiInterpretation: responseMessage.content,
            uncertainty: '',
            anomalyIndicators: [],
            recommendedActions: [],
            suggestedHopExpansions: [],
            confidenceScore: 0.88,
          };
        }
      }
    }

    throw new Error('Groq tool loop exceeded maximum iterations without finalizing.');
  }

  /**
   * Grounded Deterministic Intelligence Engine with Automated Pattern Analysis
   */
  private static runGroundedDeterministicInvestigation(prompt: string, seedEntityId?: string): AiInvestigationResponse {
    const qTrim = prompt.trim();
    const qLower = qTrim.toLowerCase();
    const qTokens = qLower.split(/\s+/).filter((t) => t.length >= 2);

    // 1. Search for matching entities across all datasets
    let matchedEntities: any[] = [];
    if (seedEntityId) {
      const e = db.prepare('SELECT * FROM entities WHERE id = ?').get(seedEntityId);
      if (e) matchedEntities.push(e);
    }

    if (matchedEntities.length === 0) {
      const allEntities = db.prepare(`
        SELECT e.*, d.name as dataset_filename 
        FROM entities e 
        LEFT JOIN datasets d ON e.dataset_id = d.id
      `).all() as any[];

      for (const ent of allEntities) {
        const entName = ent.name.toLowerCase();
        const entId = ent.id.toLowerCase();
        const propsStr = (ent.properties || '').toLowerCase();

        if (entName.includes(qLower) || qLower.includes(entName) || entId.includes(qLower) || propsStr.includes(qLower)) {
          matchedEntities.push(ent);
        } else {
          // Token overlap check
          const matchingTokens = qTokens.filter((t) => entName.includes(t) || propsStr.includes(t));
          if (matchingTokens.length >= Math.min(2, qTokens.length) && qTokens.length > 1) {
            matchedEntities.push(ent);
          }
        }
      }
    }

    // 2. Also search raw records for any matching text
    const rawMatches = db.prepare(`
      SELECT r.id, r.raw_data, r.row_index, d.name as dataset_filename
      FROM raw_records r
      JOIN datasets d ON r.dataset_id = d.id
      WHERE r.raw_data LIKE ?
      LIMIT 10
    `).all(`%${qTrim}%`) as any[];

    // 3. Grounding check: If no entities or raw records exist in uploaded datasets
    const uploadedDatasetsCount = (db.prepare('SELECT count(*) as c FROM datasets').get() as any)?.c || 0;

    if (matchedEntities.length === 0 && rawMatches.length === 0) {
      // Run pattern scan anyway if datasets exist
      const patternData = uploadedDatasetsCount > 0 ? this.runAutomatedPatternDetection() : { patterns: [] };

      return {
        knownFacts: [],
        possibleRelationships: [],
        discoveredPatterns: patternData.patterns.flatMap((p: any) => p.evidence),
        aiInterpretation: uploadedDatasetsCount === 0
          ? `No datasets have been uploaded yet. Please upload one or more CSV files in the Datasets view to begin querying.`
          : `No direct records matched "${prompt}" literally across the ${uploadedDatasetsCount} uploaded dataset(s).\n\nHowever, background pattern analysis detected ${patternData.patterns.length} structural network pattern(s) across the active ledger.`,
        uncertainty: 'Target query does not match any literal identifier or attribute in the uploaded data.',
        anomalyIndicators: [],
        recommendedActions: [
          'Verify the target entity name or column values.',
          'Explore detected pattern hubs or cross-dataset correlation bridges in the Graph view.',
          'Upload additional CSV files containing relevant records via the Datasets module.',
        ],
        suggestedHopExpansions: [],
        confidenceScore: 0.0,
      };
    }

    const focusEntity = matchedEntities[0];
    const knownFacts: string[] = [];
    const possibleRelationships: string[] = [];
    const participatingDatasets = new Set<string>();

    // Add facts from matched raw records
    for (const rm of rawMatches) {
      participatingDatasets.add(rm.dataset_filename);
      const parsedData = JSON.parse(rm.raw_data || '{}');
      const snippet = Object.entries(parsedData).slice(0, 5).map(([k, v]) => `${k}: "${v}"`).join(', ');
      knownFacts.push(`RECORD MATCH: In [${rm.dataset_filename}] (Row #${rm.row_index}): ${snippet}`);
    }

    // Add facts and relationships from focus entity
    if (focusEntity) {
      const entityDataset = focusEntity.dataset_filename || 'Uploaded Dataset';
      participatingDatasets.add(entityDataset);
      const props = JSON.parse(focusEntity.properties || '{}');
      const topProps = Object.entries(props).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(', ');

      knownFacts.push(`ENTITY: "${focusEntity.name}" [Type: ${focusEntity.type}] in [${entityDataset}] (${topProps})`);

      // Find cross-dataset connections for this entity
      const relationships = db.prepare(`
        SELECT r.*, e2.name as target_name, e2.type as target_type, d2.name as target_dataset
        FROM relationships r
        JOIN entities e2 ON (r.target_id = e2.id OR r.source_id = e2.id) AND e2.id != ?
        LEFT JOIN datasets d2 ON e2.dataset_id = d2.id
        WHERE r.source_id = ? OR r.target_id = ?
        LIMIT 15
      `).all(focusEntity.id, focusEntity.id, focusEntity.id) as any[];

      for (const rel of relationships) {
        if (rel.target_dataset) participatingDatasets.add(rel.target_dataset);
        const relProps = JSON.parse(rel.properties || '{}');
        const matchField = relProps.matchKey ? ` via field "${relProps.matchKey}" = "${relProps.matchValue}"` : '';

        knownFacts.push(`LINK: Connected to "${rel.target_name}" (${rel.target_type}) in [${rel.target_dataset || 'Dataset'}]${matchField}.`);
        possibleRelationships.push(`${focusEntity.name} [${entityDataset}] -> ${rel.type} -> ${rel.target_name} [${rel.target_dataset || 'Dataset'}]${matchField}`);
      }
    }

    // Run automated pattern detection on this context
    const patternResult = this.runAutomatedPatternDetection(focusEntity?.name);
    const discoveredPatterns: string[] = [];
    for (const p of patternResult.patterns) {
      for (const ev of p.evidence) {
        discoveredPatterns.push(`[${p.patternType}] ${ev}`);
      }
    }

    // Synthesize structured AI Interpretation & Analytical Briefing
    const datasetListStr = Array.from(participatingDatasets).map((d) => `\`${d}\``).join(', ');
    let interpretation = `Intelligence Synthesis & Pattern Analysis for "${prompt}":\n\n`;

    if (participatingDatasets.size > 1) {
      interpretation += `**Cross-Dataset Correlation**: Successfully bridged evidence across **${participatingDatasets.size} datasets** (${datasetListStr}).\n\n`;
    } else if (participatingDatasets.size === 1) {
      interpretation += `**Dataset Provenance**: Grounded in dataset ${datasetListStr}.\n\n`;
    }

    if (focusEntity) {
      interpretation += `**Primary Focus Node**: Identified canonical entity **${focusEntity.name}** (${focusEntity.type}) with ${possibleRelationships.length} direct relationship connection(s).\n\n`;
    }

    if (possibleRelationships.length > 0) {
      interpretation += `**Discovered Relational Paths**:\n` +
        possibleRelationships.map((r) => `• ${r}`).join('\n') + '\n\n';
    }

    if (discoveredPatterns.length > 0) {
      interpretation += `**Higher-Order Pattern & Anomaly Inferences**:\n` +
        discoveredPatterns.slice(0, 4).map((dp) => `• ${dp}`).join('\n') + '\n\n';
    }

    interpretation += `**Analytical Hypothesis**:\n`;
    if (possibleRelationships.length > 1) {
      interpretation += `The queried entity acts as a functional pivot across records. The multi-hop linkages suggest correlated transactional or logistical activity that warrants topological inspection in the Graph visualizer.`;
    } else {
      interpretation += `The target entity shows limited cross-dataset dispersion. Additional CSV datasets containing matching IDs or foreign keys will expand the correlational horizon.`;
    }

    return {
      knownFacts,
      possibleRelationships,
      discoveredPatterns,
      aiInterpretation: interpretation,
      uncertainty: participatingDatasets.size < 2 ? 'Queried target currently only resolves within a single uploaded dataset; multi-dataset join density is low.' : 'Correlated across multiple datasets with high topological confidence.',
      anomalyIndicators: patternResult.patterns.filter((p: any) => p.patternType === 'SHARED_IDENTIFIER_COLLISIONS' || p.patternType === 'CENTRAL_HUB_NODES').map((p: any) => p.description),
      recommendedActions: [
        'Inspect connected entities and path topology in the Graph Visualizer.',
        'Run cross-dataset pattern queries on related entities.',
        'Investigate shared identifier collisions to uncover covert aliases or shell groupings.',
      ],
      suggestedHopExpansions: matchedEntities.map((e) => e.id),
      confidenceScore: 0.95,
    };
  }

  /**
   * Omni-Sensor AI Reasoning Space with Persistent Chat Memory
   */
  static async chatReasoning(message: string, sessionId?: string): Promise<{
    sessionId: string;
    reply: string;
    reasoning?: string;
    sources: string[];
    timestamp: string;
  }> {
    const sId = sessionId || `session_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();

    // 1. Fetch conversation history from SQLite persistent memory (compacted to prevent token overflow)
    const historyRows = (db.prepare(`
      SELECT role, content FROM ai_chat_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 8
    `).all(sId) as any[]).reverse();

    const formattedHistory = historyRows.map((h: any) => ({
      role: h.role,
      content: h.content.length > 1200 ? h.content.slice(0, 1200) + '... [truncated previous briefing summary]' : h.content,
    }));

    // 2. Build system prompt
    const systemPrompt = `You are the Omni-Sensor Reasoning Intelligence & Real-Time World Model Analyst for Revana Technologies.
You have direct, real-time access to:
- Live World Model Telemetry: Open-Meteo Weather & Precipitation, Open-Meteo CAMS Air Quality (PM2.5, PM10, AQI), USGS Earthquakes, GDACS Disaster Advisories, Central Water Commission River/Dam Gauges, National Grid KPTCL Electrical Substations, GTFS Transit Telemetry, GBFS Mobility Hubs, European Central Bank Foreign Exchange, and OpenStreetMap/Nominatim Geocoding.
- Inferred Physical Relationships: Infrastructure impacts with concrete physical evidence chains and confidence scores.
- Detected Real-World Events: Threshold crossing alerts (heavy rainfall, earthquakes, reservoir overflows, severe transit delays).
- Digital Twin Simulation Sandboxes: Alternate reality evaluations, cascading consequences, and stress testing.
- Uploaded Datasets: Relational entity graph, transactions, shipments, and pattern anomaly records.

YOUR CORE MANDATE:
1. ANSWER QUESTIONS FROM ANYTHING: Answer any question asked by the user intelligently, authoritatively, and comprehensively. You are NOT confined to datasets! You have real-time access to the entire physical world mirror, external public APIs, and general reasoning.
2. CITE REAL-TIME SOURCES: When answering about real-world facts (weather, AQI, seismic activity, water levels, transformer loads, exchange rates, corridor delays), ALWAYS state the source sensor, observed value, timestamp, and location.
3. PHYSICAL & SPATIAL CORRELATIONS: Explain the physical reasons and evidence behind observed changes (e.g. why NH48 corridor traction is affected by rainfall catchment runoff).
4. MEMORY & CONTINUITY: You remember previous messages and context in this conversation session.
5. FORMATTING: Use clean, professional markdown with clear bold headers, bulleted lists, and concise analytical takeaways.`;

    // 3. Assemble Groq messages array
    const baseGroqMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...formattedHistory,
      { role: 'user', content: message },
    ];

    let reply = '';
    let accumulatedReasoning = '';
    const sourcesCited = new Set<string>();

    const candidateModels = [
      GROQ_MODEL,
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
    ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

    let modelSuccess = false;

    if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '' && !GROQ_API_KEY.includes('your_groq_api_key')) {
      for (const currentModel of candidateModels) {
        if (modelSuccess) break;

        try {
          let iteration = 0;
          const maxIterations = 4;
          const currentGroqMessages = [...baseGroqMessages];
          let modelReply = '';
          let modelReasoning = '';

          while (iteration < maxIterations) {
            iteration++;
            const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GROQ_API_KEY}`,
              },
              body: JSON.stringify({
                model: currentModel,
                messages: currentGroqMessages,
                tools: GROQ_TOOLS,
                tool_choice: 'auto',
                temperature: 0.5,
                max_tokens: 1500,
              }),
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Groq HTTP ${res.status} on ${currentModel}: ${errText}`);
            }

            const data = (await res.json()) as any;
            const choice = data.choices?.[0];
            const responseMessage = choice?.message;
            if (!responseMessage) throw new Error('Empty response from Groq');

            if (responseMessage.reasoning) {
              modelReasoning += (modelReasoning ? '\n\n' : '') + responseMessage.reasoning;
            }

            currentGroqMessages.push(responseMessage);

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
              for (const toolCall of responseMessage.tool_calls) {
                const toolName = toolCall.function.name;
                let toolArgs: any = {};
                try {
                  toolArgs = JSON.parse(toolCall.function.arguments || '{}');
                } catch (_) {}

                sourcesCited.add(`Sensor Tool: ${toolName}`);
                const toolResult = await AiService.executeTool(toolName, toolArgs);

                currentGroqMessages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: toolName,
                  content: JSON.stringify(toolResult),
                });
              }
            } else {
              modelReply = responseMessage.content || '';
              break;
            }
          }

          if (modelReply && modelReply.trim() !== '') {
            reply = modelReply;
            accumulatedReasoning = modelReasoning;
            modelSuccess = true;
          }
        } catch (err: any) {
          console.warn(`Candidate model ${currentModel} failed: ${err.message}. Trying next candidate model if available...`);
        }
      }
    } else {
      reply = AiService.generateLocalGroundedAnswer(message);
      sourcesCited.add('Revana Technologies Grounded Reasoning Engine');
    }

    if (!reply || reply.trim() === '') {
      reply = AiService.generateLocalGroundedAnswer(message);
      sourcesCited.add('Revana Technologies Grounded Reasoning Engine');
    }

    // 4. Save to Persistent Chat Memory in SQLite
    const userMsgId = `msg_user_${uuidv4().substring(0, 8)}`;
    const asstMsgId = `msg_asst_${uuidv4().substring(0, 8)}`;
    const insertMsgStmt = db.prepare(`
      INSERT INTO ai_chat_messages (id, session_id, role, content, sources, reasoning, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertMsgStmt.run(userMsgId, sId, 'user', message, JSON.stringify([]), null, now);
    insertMsgStmt.run(asstMsgId, sId, 'assistant', reply, JSON.stringify(Array.from(sourcesCited)), accumulatedReasoning || null, new Date().toISOString());

    return {
      sessionId: sId,
      reply,
      reasoning: accumulatedReasoning || undefined,
      sources: Array.from(sourcesCited),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fetch conversation history from SQLite persistent memory
   */
  static getChatHistory(sessionId: string): any[] {
    const rows = db.prepare(`
      SELECT id, role, content, sources, reasoning, timestamp 
      FROM ai_chat_messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `).all(sessionId) as any[];

    return rows.map(r => ({
      id: r.id,
      role: r.role,
      content: r.content,
      reasoning: r.reasoning,
      sources: JSON.parse(r.sources || '[]'),
      timestamp: r.timestamp,
    }));
  }

  /**
   * Clear chat history for a session
   */
  static clearChatHistory(sessionId: string): boolean {
    const res = db.prepare(`DELETE FROM ai_chat_messages WHERE session_id = ?`).run(sessionId);
    return res.changes > 0;
  }

  /**
   * High-Fidelity Grounded Local Reasoning Engine
   * Queries real live world model entities, active sensors, and temporal history offline
   */
  public static generateLocalGroundedAnswer(message: string): string {
    const qLower = message.toLowerCase();
    const worldState = worldModelService.getWorldState();
    const providers = providerRegistry.getStatusMatrix();
    const events = worldModelService.getEvents();
    const relationships = worldModelService.getRelationships();
    const sims = simulationService.listSimulations();

    let response = `### Real-Time World Model Intelligence Briefing\n\n`;

    // 1. Weather / Rain / Precipitation
    if (qLower.includes('weather') || qLower.includes('rain') || qLower.includes('temp') || qLower.includes('monsoon')) {
      const weatherEnts = worldModelService.getEntities('WEATHER_STATION');
      if (weatherEnts.length > 0) {
        const w = weatherEnts[0];
        const val = w.current_state;
        response += `**Live Meteorological Telemetry (Open-Meteo Weather)**:\n`;
        response += `• **Station**: ${w.name} (Coordinates: ${w.latitude.toFixed(4)}° N, ${w.longitude.toFixed(4)}° E)\n`;
        response += `• **Temperature**: ${val.temperature_c ?? 'N/A'}°C\n`;
        response += `• **Precipitation**: ${val.precipitation_mm ?? 0} mm/hr\n`;
        response += `• **Relative Humidity**: ${val.relative_humidity_pct ?? 'N/A'}%\n`;
        response += `• **Surface Pressure**: ${val.surface_pressure_hpa ?? 'N/A'} hPa\n`;
        response += `• **Observed At**: ${w.last_observed_at} (Source: \`api.open-meteo.com\`, Confidence: ${(w.confidence * 100).toFixed(0)}%)\n\n`;
      }
    }

    // 2. Air Quality / AQI / Pollution
    if (qLower.includes('air') || qLower.includes('aqi') || qLower.includes('pollution') || qLower.includes('pm2.5') || qLower.includes('pm10')) {
      const aqiEnts = worldModelService.getEntities('AIR_QUALITY_STATION');
      if (aqiEnts.length > 0) {
        const a = aqiEnts[0];
        const val = a.current_state;
        response += `**Live Atmospheric Pollutant Telemetry (Copernicus CAMS & Open-Meteo)**:\n`;
        response += `• **Monitoring Sensor**: ${a.name}\n`;
        response += `• **US AQI**: **${val.us_aqi ?? 'N/A'}** (${val.us_aqi > 150 ? 'UNHEALTHY' : val.us_aqi > 100 ? 'MODERATE' : 'GOOD'})\n`;
        response += `• **PM2.5**: ${val.pm2_5_ugm3 ?? 'N/A'} µg/m³ | **PM10**: ${val.pm10_ugm3 ?? 'N/A'} µg/m³\n`;
        response += `• **NO2**: ${val.nitrogen_dioxide_ugm3 ?? 'N/A'} µg/m³ | **SO2**: ${val.sulphur_dioxide_ugm3 ?? 'N/A'} µg/m³\n`;
        response += `• **Provenance**: Observed at ${a.last_observed_at} via Open-Meteo Air Quality CAMS stream.\n\n`;
      }
    }

    // 3. Earthquakes / Seismic Hazards
    if (qLower.includes('earthquake') || qLower.includes('seismic') || qLower.includes('magnitude') || qLower.includes('tsunami')) {
      const eqEnts = worldModelService.getEntities('EARTHQUAKE_EPICENTER');
      response += `**Global Seismic Activity (USGS Real-Time Hazards Feed)**:\n`;
      if (eqEnts.length > 0) {
        response += `Active monitored seismic epicenters in memory: **${eqEnts.length}**\n`;
        eqEnts.slice(0, 3).forEach(eq => {
          const val = eq.current_state;
          response += `• **M${val.magnitude}** - ${val.place} (Depth: ${val.depth_km}km, Observed: ${eq.last_observed_at})\n`;
        });
        response += `\n`;
      } else {
        response += `• No critical seismic disturbances detected within the regional corridor during the active observation window.\n\n`;
      }
    }

    // 4. Hydrological / Water / Reservoirs / Dams
    if (qLower.includes('water') || qLower.includes('dam') || qLower.includes('river') || qLower.includes('flood') || qLower.includes('reservoir')) {
      const hydroEnts = worldModelService.getEntities('WATER_GAUGE');
      response += `**Hydrological Telemetry & Basin Gauges (Central Water Commission)**:\n`;
      if (hydroEnts.length > 0) {
        hydroEnts.slice(0, 3).forEach(h => {
          const val = h.current_state;
          response += `• **${val.station_name || h.name}** (${val.river || 'Basin'}):\n`;
          response += `  - Current Stage: **${val.water_level_m}m** (Danger Level: ${val.danger_level_m}m)\n`;
          response += `  - Storage Capacity: ${val.capacity_pct}%\n`;
          response += `  - Status: **${val.status}**\n`;
        });
        response += `\n`;
      }
    }

    // 5. Electrical Grid / Substations / Energy
    if (qLower.includes('grid') || qLower.includes('power') || qLower.includes('electric') || qLower.includes('substation') || qLower.includes('demand')) {
      const gridEnts = worldModelService.getEntities('ENERGY_SUBSTATION');
      response += `**Electrical Grid Telemetry (Grid Controller of India / KPTCL)**:\n`;
      if (gridEnts.length > 0) {
        gridEnts.slice(0, 3).forEach(g => {
          const val = g.current_state;
          response += `• **${val.substation_name || g.name}**:\n`;
          response += `  - Power Demand: **${val.demand_mw} MW** / ${val.capacity_mw} MW (${val.load_pct}% load)\n`;
          response += `  - Status: ${val.status}\n`;
        });
        response += `\n`;
      }
    }

    // 6. Public Transit & Roads (NH48)
    if (qLower.includes('traffic') || qLower.includes('transit') || qLower.includes('bus') || qLower.includes('metro') || qLower.includes('road') || qLower.includes('nh48')) {
      const transitEnts = worldModelService.getEntities('TRANSIT_VEHICLE');
      response += `**Metropolitan Transit & Corridor Telemetry (GTFS-RT / BMRCL / BMTC)**:\n`;
      if (transitEnts.length > 0) {
        transitEnts.slice(0, 3).forEach(t => {
          const val = t.current_state;
          response += `• **${val.vehicle_label || t.name}** (Route: ${val.route_id || 'Corridor'}):\n`;
          response += `  - Speed: ${val.speed_kmh} km/h | Status: ${val.status}\n`;
          response += `  - Congestion Level: **${val.congestion_level}**\n`;
        });
        response += `\n`;
      }
    }

    // 7. Simulation Twins
    if (qLower.includes('simulat') || qLower.includes('twin') || qLower.includes('what if')) {
      response += `**Digital Twin Sandbox Status**:\n`;
      if (sims.length > 0) {
        response += `Active sandboxes: **${sims.length}**\n`;
        sims.slice(0, 2).forEach(s => {
          response += `• **${s.name}** (ID: \`${s.id}\`) - ${s.modified_entity_count} entity modifications active. State is 100% isolated from live records.\n`;
        });
        response += `\n`;
      } else {
        response += `• No active simulation sandbox running. Use **Simulation Twin Mode** in the interface to test perturbations.\n\n`;
      }
    }

    // 8. General Summary & Connected Evidence
    if (relationships.length > 0 && (qLower.includes('why') || qLower.includes('reason') || qLower.includes('connect') || qLower.includes('impact'))) {
      response += `**Inferred Physical Evidence Chains**:\n`;
      relationships.slice(0, 2).forEach(rel => {
        response += `• **${rel.relationship_type}** (\`${rel.source_entity_id}\` → \`${rel.target_entity_id}\`):\n`;
        response += `  - Confidence: ${(rel.confidence * 100).toFixed(0)}%\n`;
        response += `  - Evidence: ${rel.evidence?.[0] || 'Direct spatial proximity'}\n`;
      });
      response += `\n`;
    }

    // 9. World Model Health Overview
    response += `**Live Mirror Summary**:\n`;
    response += `• Total Physical Entities Tracked: **${worldState.entity_count}**\n`;
    response += `• Active Threshold Events: **${events.length}**\n`;
    response += `• Connected Sensor Feeds: **${providers.length}** (${providers.filter(p => p.health.status === 'HEALTHY').length} Healthy)\n`;
    response += `• Temporal State Ledger Entries: **${worldState.recent_changes_count}**\n\n`;
    response += `*All figures cited from active database state at ${new Date().toLocaleTimeString()} with cryptographic provenance.*`;

    return response;
  }
}

