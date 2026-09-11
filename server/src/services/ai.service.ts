import { db } from '../db/database.js';
import { GraphService } from './graph.service.js';
import { ResolutionService } from './resolution.service.js';
import { SourceService } from './source.service.js';
import { AiInvestigationResponse, EntityType } from '../types/index.js';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.XAI_API_KEY || '';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || process.env.XAI_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || process.env.XAI_MODEL || 'llama-3.3-70b-versatile';

// Controlled Backend Tools Definitions for Groq Function Calling
const GROQ_TOOLS = [
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
  static executeTool(toolName: string, args: Record<string, any>): any {
    switch (toolName) {
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
You are the Lead Intelligence Strategist and Pattern Discovery AI for the AEGIS Intel Platform.
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

          const toolResult = this.executeTool(toolName, toolArgs);

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
}
