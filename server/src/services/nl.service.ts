import { db } from '../db/database.js';
import { GraphService } from './graph.service.js';
import { AiService } from './ai.service.js';
import { GraphData, LocationRecord, TimelineEvent, AiInvestigationResponse, Entity } from '../types/index.js';

export interface NlInvestigationResult {
  query: string;
  matchedEntities: Entity[];
  graph: GraphData;
  locations: LocationRecord[];
  timeline: TimelineEvent[];
  aiBriefing: AiInvestigationResponse;
  explanation: string;
}

export class NlService {
  /**
   * Execute a natural-language investigation query against the database
   */
  static async query(userQuery: string): Promise<NlInvestigationResult> {
    const qTrimmed = userQuery.trim();
    const qLower = qTrimmed.toLowerCase();

    // 1. Tokenize query & remove common question stop words
    const stopWords = new Set([
      'what', 'is', 'are', 'the', 'connected', 'to', 'for', 'with', 'about', 'and', 'show', 'me', 'find', 'get',
      'investigate', 'tell', 'between', 'how', 'any', 'from', 'where', 'who', 'which', 'entity', 'entities',
      'relationship', 'relationships', 'details', 'data', 'information', 'does', 'have', 'all'
    ]);

    const queryTokens = qLower
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !stopWords.has(t));

    // 2. Fetch all entities from database for multi-signal matching
    const allEntities = db.prepare('SELECT * FROM entities').all() as any[];
    const parsedEntities: Entity[] = allEntities.map((e) => ({
      ...e,
      properties: JSON.parse(e.properties || '{}'),
      tags: JSON.parse(e.tags || '[]'),
      aliases: JSON.parse(e.aliases || '[]'),
    }));

    const matchedEntities: Entity[] = [];
    const matchedIds = new Set<string>();

    const cleanAlphanumeric = (s: string) => (s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const qClean = cleanAlphanumeric(qLower);

    for (const ent of parsedEntities) {
      const entNameClean = cleanAlphanumeric(ent.name);
      const entIdClean = cleanAlphanumeric(ent.id);

      // Direct Match: ID, Name, or Normalized Alphanumeric substring
      const idMatch = (entIdClean.length >= 6 && qClean.includes(entIdClean)) || (qClean.length >= 6 && entIdClean.includes(qClean));
      const nameMatch = qLower.includes(ent.name.toLowerCase()) || (entNameClean.length >= 5 && qClean.includes(entNameClean));

      // Alias Match
      const aliasMatch = ent.aliases.some((a: string) => {
        const aClean = cleanAlphanumeric(a);
        return qLower.includes(a.toLowerCase()) || (aClean.length >= 4 && qClean.includes(aClean));
      });

      // Key Property Match (Plate / Registration Number, GSTIN, CIN, Driver License, Waybill)
      const p = ent.properties || {};
      const reg = cleanAlphanumeric(p.registrationNumber || p.truck_no || p.plate || '');
      const gstin = cleanAlphanumeric(p.gstin || p.taxId || '');
      const dl = cleanAlphanumeric(p.driverLicense || p.dlNumber || '');
      const waybill = cleanAlphanumeric(p.waybill || p.shipmentId || p.cargoId || '');

      const propMatch =
        (reg.length >= 6 && qClean.includes(reg)) ||
        (gstin.length >= 8 && qClean.includes(gstin)) ||
        (dl.length >= 6 && qClean.includes(dl)) ||
        (waybill.length >= 5 && qClean.includes(waybill));

      // Token overlap match (requires substantial token agreement)
      let tokenOverlapCount = 0;
      for (const token of queryTokens) {
        if (ent.name.toLowerCase().includes(token)) {
          tokenOverlapCount += 2;
        } else if (ent.tags.some((t) => t.toLowerCase() === token)) {
          tokenOverlapCount += 1;
        }
      }
      const minTokensRequired = Math.max(2, Math.ceil(queryTokens.length * 0.6) * 2);
      const tokenMatch = queryTokens.length > 0 && tokenOverlapCount >= minTokensRequired;

      if (idMatch || nameMatch || aliasMatch || propMatch || tokenMatch) {
        if (!matchedIds.has(ent.id)) {
          matchedEntities.push(ent);
          matchedIds.add(ent.id);
        }
      }
    }

    // 3. Grounding check: If no matching entity or record in database, return honest empty state
    if (matchedEntities.length === 0) {
      return {
        query: userQuery,
        matchedEntities: [],
        graph: { nodes: [], edges: [] },
        locations: [],
        timeline: [],
        aiBriefing: {
          knownFacts: [],
          possibleRelationships: [],
          aiInterpretation: `No entities, vehicles, organizations, or shipments matching query "${userQuery}" exist in the database.`,
          uncertainty: 'Query target is not present in current ingested records or benchmark telemetry ledger.',
          anomalyIndicators: [],
          recommendedActions: [
            'Verify the entity ID, vehicle registration plate, or company name.',
            'Import a dataset containing the target records via the Data Ingestion module.',
          ],
          suggestedHopExpansions: [],
          confidenceScore: 0.0,
        },
        explanation: `Zero database matches found for query: "${userQuery}". Grounded query returned no fabricated data.`,
      };
    }

    // 4. Build combined Subgraph for matched entities (1 hop expansion)
    const allNodeIds = new Set<string>();
    const allEdges: any[] = [];

    for (const ent of matchedEntities.slice(0, 5)) {
      allNodeIds.add(ent.id);
      const sub = GraphService.expandEntity(ent.id, 1);
      for (const n of sub.nodes) allNodeIds.add(n.data.id);
      for (const e of sub.edges) allEdges.push(e);
    }

    // Deduplicate edges
    const edgeMap = new Map<string, any>();
    for (const e of allEdges) edgeMap.set(e.data.id, e);

    const nodePlaceholders = Array.from(allNodeIds).map(() => '?').join(',');
    const rawNodes = db.prepare(`SELECT * FROM entities WHERE id IN (${nodePlaceholders})`).all(...Array.from(allNodeIds)) as any[];

    const graph: GraphData = {
      nodes: rawNodes.map((n) => ({
        data: {
          id: n.id,
          name: n.name,
          type: n.type,
          riskLevel: n.risk_level,
          riskScore: n.risk_score,
          label: n.label || n.name,
          category: n.category,
          properties: JSON.parse(n.properties || '{}'),
        },
      })),
      edges: Array.from(edgeMap.values()),
    };

    // 5. Fetch correlated Locations for Map View
    const locations = db.prepare('SELECT * FROM locations').all() as any[];
    const parsedLocations: LocationRecord[] = locations.map((loc) => ({
      ...loc,
      properties: JSON.parse(loc.properties || '{}'),
    }));

    // 6. Generate Grounded AI Briefing using structured DB context
    const primaryEntity = matchedEntities[0];
    const aiBriefing = await AiService.investigate(userQuery, {
      entityId: primaryEntity?.id,
    });

    const explanation = `Query translated into multi-dimensional intelligence graph with ${graph.nodes.length} connected nodes and ${parsedLocations.length} geospatial checkpoints.`;

    return {
      query: userQuery,
      matchedEntities,
      graph,
      locations: parsedLocations,
      timeline: [],
      aiBriefing,
      explanation,
    };
  }
}
