import { worldModelService } from '../../world_model/world_model.service.js';
import { simulationService } from '../../simulation/simulation.service.js';
import { providerRegistry } from '../../../connectors/registry/ProviderRegistry.js';
import { ToolDefinition } from '../types.js';

export const worldTools: ToolDefinition[] = [
  {
    name: 'get_live_world_summary',
    description: 'Get real-time summary of the digital mirror world model: count of physical entities, active weather stations, air quality sensors, river stages, grid substations, transit vehicles, and recent detected events.',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const fullState = worldModelService.getWorldState();
      const typeCounts: Record<string, number> = {};
      fullState.entities.forEach((e: any) => {
        typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
      });
      return {
        timestamp: fullState.timestamp,
        total_entities_tracked: fullState.entity_count,
        entities_by_type: typeCounts,
        active_threshold_events_count: fullState.active_events.length,
        top_recent_events: fullState.active_events.slice(0, 5).map((ev: any) => ({
          type: ev.event_type,
          severity: ev.severity,
          entity_id: ev.entity_id,
          detected_at: ev.detected_at,
          source: ev.source,
        })),
        active_relationships_count: fullState.relationships.length,
        key_corridor_relationships: fullState.relationships.slice(0, 3).map((r: any) => ({
          type: r.relationship_type,
          source: r.source_entity_id,
          target: r.target_entity_id,
          confidence: r.confidence,
        })),
        temporal_ledger_records: fullState.recent_changes_count,
      };
    },
  },
  {
    name: 'search_world_entities',
    description: 'Search live physical entities across all categories (WEATHER, AIR_QUALITY, SEISMIC, WATER, ENERGY, TRANSIT, MOBILITY, INFRASTRUCTURE) by name, keyword, or category.',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term e.g. Bangalore, NH48, Peenya, Bellandur, Metro, Earthquake' },
        category: { type: 'string', description: 'Optional category filter: WEATHER, AIR_QUALITY, SEISMIC, WATER, ENERGY, PUBLIC_TRANSPORT, MOBILITY, INFRASTRUCTURE' },
      },
      required: ['query'],
    },
    execute: async (args) => {
      const q = String(args.query || '').trim().toLowerCase();
      const all = worldModelService.getEntities(args.type, args.category);
      const matches = q
        ? all.filter((e: any) => {
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
        entities: matches.map((e: any) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          coordinates: [Number(e.latitude.toFixed(4)), Number(e.longitude.toFixed(4))],
          current_values: e.current_state,
          last_observed: e.last_observed_at,
        })),
      };
    },
  },
  {
    name: 'get_entity_telemetry',
    description: 'Get detailed live telemetry, current environmental values, chronological temporal state transitions, and raw sensor provenance for an entity ID.',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {
        entityId: { type: 'string', description: 'The entity identifier (e.g. STATION_1297_7759, ROAD_CORRIDOR_NH48, HYDRO_GAUGE_BELLANDUR_OUTLET_WEIR)' },
      },
      required: ['entityId'],
    },
    execute: async (args) => {
      const ent = worldModelService.getEntityById(args.entityId);
      if (!ent || !ent.entity) return { error: `Entity ${args.entityId} not found` };
      return {
        id: ent.entity.id,
        name: ent.entity.name,
        type: ent.entity.type,
        current_state: ent.entity.current_state,
        last_observed_at: ent.entity.last_observed_at,
        confidence: ent.entity.confidence,
        recent_state_changes: (ent.history || []).slice(0, 3).map((h: any) => ({
          timestamp: h.timestamp,
          delta: h.delta_summary,
          source: h.source,
        })),
      };
    },
  },
  {
    name: 'get_live_events',
    description: 'Retrieve detected real-world threshold events (e.g. heavy rainfall exceeding thresholds, earthquakes, reservoir flood warnings, severe transit congestion).',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {
        severity: { type: 'string', description: 'Optional severity filter: CRITICAL, HIGH, MEDIUM, LOW' },
      },
    },
    execute: async (args) => {
      const events = worldModelService.getEvents(args.severity);
      return {
        total_count: events.length,
        events: events.slice(0, 5).map((ev: any) => ({
          event_id: ev.event_id,
          event_type: ev.event_type,
          entity_id: ev.entity_id,
          severity: ev.severity,
          source: ev.source,
          detected_at: ev.detected_at,
          current_state: ev.current_state,
        })),
      };
    },
  },
  {
    name: 'get_inferred_relationships',
    description: 'Retrieve inferred physical and infrastructure relationships with explicit evidence trails, confidence scores, and source reasoning engines.',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const rels = worldModelService.getRelationships();
      return {
        total_count: rels.length,
        relationships: rels.slice(0, 5).map((r: any) => ({
          type: r.relationship_type,
          source_entity: r.source_entity_id,
          target_entity: r.target_entity_id,
          confidence: r.confidence,
          evidence: r.evidence,
        })),
      };
    },
  },
  {
    name: 'get_provider_observability',
    description: 'Get health status, latencies, update frequencies, coverage area, and licensing terms for all 15 public data connectors (Open-Meteo, USGS, GDACS, Central Water Commission, National Grid, GTFS, GBFS, etc.).',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const matrix = providerRegistry.getStatusMatrix();
      return {
        total_providers: matrix.length,
        healthy_count: matrix.filter((p: any) => p.health.status === 'HEALTHY').length,
        providers: matrix.map((p: any) => ({
          id: p.id,
          status: p.health.status,
          latency_ms: p.health.latencyMs,
          records_normalized: p.health.recordsNormalized,
          last_success: p.health.lastSuccessfulUpdate,
        })),
      };
    },
  },
  {
    name: 'inspect_simulation_twin',
    description: 'Inspect an isolated digital twin simulation sandbox: check modified variables (deluges, capacity throttles), baseline snapshot time, and cascading consequence predictions.',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {
        simulationId: { type: 'string', description: 'Optional specific simulation ID to inspect' },
      },
    },
    execute: async (args) => {
      if (args.simulationId) {
        return simulationService.getSimulationState(args.simulationId);
      }
      return simulationService.listSimulations();
    },
  },
  {
    name: 'poll_live_sensors',
    description: 'Trigger an immediate real-time fetch from external public APIs to refresh weather, air quality, earthquakes, or grid telemetry.',
    domain: 'world',
    parameters: {
      type: 'object',
      properties: {
        providerId: { type: 'string', description: 'Optional specific provider: open_meteo_weather, open_meteo_air_quality, usgs_earthquake, etc.' },
      },
    },
    execute: async (args) => {
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
    },
  },
];
