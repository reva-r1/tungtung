import { db } from '../../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { worldModelService } from '../world_model/world_model.service.js';
import { WorldEntityState, WorldEvent } from '../../connectors/base/types.js';

export interface SimulationModification {
  entity_id: string;
  properties: Record<string, any>;
}

export interface SimulationStateResult {
  simulation_id: string;
  name: string;
  description: string;
  created_at: string;
  base_snapshot_time: string;
  mode: 'SIMULATION';
  is_isolated: boolean;
  total_entities: number;
  modified_entity_count: number;
  entities: (WorldEntityState & { is_simulated: boolean; simulation_deltas?: Record<string, any> })[];
  cascading_events: WorldEvent[];
  impact_analysis: {
    affected_corridors: string[];
    risk_escalation: string;
    evidence: string[];
  };
}

export class SimulationService {
  private static instance: SimulationService;

  private constructor() {}

  public static getInstance(): SimulationService {
    if (!SimulationService.instance) {
      SimulationService.instance = new SimulationService();
    }
    return SimulationService.instance;
  }

  /**
   * POST /simulation/create
   * Creates an isolated digital twin sandbox cloned from current live state
   */
  public createSimulation(name: string, description: string = ''): { id: string; name: string; base_snapshot_time: string } {
    const id = `sim_${uuidv4().substring(0, 10)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO simulations (id, name, description, base_timestamp, base_snapshot_time, status, parameters, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', '{}', ?, ?)
    `);
    stmt.run(id, name, description, now, now, now, now);

    return {
      id,
      name,
      base_snapshot_time: now,
    };
  }

  /**
   * POST /simulation/:id/modify
   * Modifies variables within the sandbox WITHOUT altering live data
   */
  public modifySimulation(
    simulationId: string,
    modifications: { entity_id: string; properties: Record<string, any> }[]
  ): { simulation_id: string; modified_count: number } {
    const sim = db.prepare(`SELECT * FROM simulations WHERE id = ?`).get(simulationId) as any;
    if (!sim) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }

    const now = new Date().toISOString();
    const upsertStmt = db.prepare(`
      INSERT INTO simulation_entity_overrides (simulation_id, entity_id, properties, is_modified, updated_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(simulation_id, entity_id) DO UPDATE SET
        properties = excluded.properties,
        is_modified = 1,
        updated_at = excluded.updated_at
    `);

    const updateTx = db.transaction(() => {
      for (const mod of modifications) {
        // Fetch current override or live entity state to merge
        const existingOverride = db.prepare(`
          SELECT properties FROM simulation_entity_overrides WHERE simulation_id = ? AND entity_id = ?
        `).get(simulationId, mod.entity_id) as any;

        let mergedProps = { ...mod.properties };
        if (existingOverride) {
          try {
            mergedProps = { ...JSON.parse(existingOverride.properties), ...mod.properties };
          } catch (_) {}
        }

        upsertStmt.run(simulationId, mod.entity_id, JSON.stringify(mergedProps), now);
      }

      db.prepare(`UPDATE simulations SET updated_at = ? WHERE id = ?`).run(now, simulationId);
    });

    updateTx();

    const countRow = db.prepare(`
      SELECT COUNT(*) as cnt FROM simulation_entity_overrides WHERE simulation_id = ?
    `).get(simulationId) as any;

    return {
      simulation_id: simulationId,
      modified_count: countRow?.cnt || modifications.length,
    };
  }

  /**
   * GET /simulation/:id/state
   * Retrieves the combined simulated world state and calculates cascading events
   */
  public getSimulationState(simulationId: string): SimulationStateResult {
    const sim = db.prepare(`SELECT * FROM simulations WHERE id = ?`).get(simulationId) as any;
    if (!sim) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }

    // Get live entities as the baseline
    const liveEntities = worldModelService.getEntities();

    // Get overrides for this simulation
    const overrides = db.prepare(`
      SELECT entity_id, properties FROM simulation_entity_overrides WHERE simulation_id = ?
    `).all(simulationId) as any[];

    const overrideMap = new Map<string, Record<string, any>>();
    for (const ov of overrides) {
      try {
        overrideMap.set(ov.entity_id, JSON.parse(ov.properties));
      } catch (_) {}
    }

    const mergedEntities: (WorldEntityState & { is_simulated: boolean; simulation_deltas?: Record<string, any> })[] = [];
    const cascadingEvents: WorldEvent[] = [];
    const affectedCorridors = new Set<string>();
    const evidenceList: string[] = [];

    for (const liveEnt of liveEntities) {
      const override = overrideMap.get(liveEnt.id);
      if (override) {
        const simulatedState = { ...liveEnt.current_state, ...override };
        const deltas: Record<string, any> = {};
        for (const k of Object.keys(override)) {
          deltas[k] = {
            live_value: liveEnt.current_state[k],
            simulated_value: override[k],
          };
        }

        mergedEntities.push({
          ...liveEnt,
          current_state: simulatedState,
          is_simulated: true,
          simulation_deltas: deltas,
        });

        // Run cascading analysis for this modified entity
        if (override.precipitation_mm !== undefined && Number(override.precipitation_mm) >= 50) {
          cascadingEvents.push({
            event_id: `sim_evt_flash_flood_${liveEnt.id}`,
            event_type: 'SIMULATED_SEVERE_WATERLOGGING_WARNING',
            entity_id: liveEnt.id,
            previous_state: liveEnt.current_state,
            current_state: simulatedState,
            detected_at: new Date().toISOString(),
            source: 'simulation_twin_engine',
            confidence: 0.95,
            severity: 'CRITICAL',
          });

          affectedCorridors.add('NH48_GOLDEN_CORRIDOR');
          affectedCorridors.add('OUTER_RING_ROAD_SILKBOARD');
          evidenceList.push(
            `Simulated rainfall raised to ${override.precipitation_mm}mm on ${liveEnt.name} (live baseline: ${liveEnt.current_state.precipitation_mm || 0}mm). Runoff threshold exceeded.`
          );
        }

        if (override.road_capacity !== undefined && Number(override.road_capacity) <= 60) {
          cascadingEvents.push({
            event_id: `sim_evt_road_constriction_${liveEnt.id}`,
            event_type: 'SIMULATED_CORRIDOR_CAPACITY_DROP',
            entity_id: liveEnt.id,
            previous_state: liveEnt.current_state,
            current_state: simulatedState,
            detected_at: new Date().toISOString(),
            source: 'simulation_twin_engine',
            confidence: 0.9,
            severity: 'HIGH',
          });

          affectedCorridors.add(liveEnt.name);
          evidenceList.push(
            `Corridor capacity throttled to ${override.road_capacity}% on ${liveEnt.name}. Projected queue delay +45 minutes.`
          );
        }

        if (override.water_level_m !== undefined && Number(override.water_level_m) >= 72.0) {
          cascadingEvents.push({
            event_id: `sim_evt_reservoir_overflow_${liveEnt.id}`,
            event_type: 'SIMULATED_RESERVOIR_SLUICE_DISCHARGE',
            entity_id: liveEnt.id,
            previous_state: liveEnt.current_state,
            current_state: simulatedState,
            detected_at: new Date().toISOString(),
            source: 'simulation_twin_engine',
            confidence: 0.98,
            severity: 'CRITICAL',
          });

          evidenceList.push(
            `Reservoir level elevated to ${override.water_level_m}m on ${liveEnt.name}. Emergency spillway discharge required.`
          );
        }
      } else {
        mergedEntities.push({
          ...liveEnt,
          is_simulated: false,
        });
      }
    }

    return {
      simulation_id: sim.id,
      name: sim.name,
      description: sim.description,
      created_at: sim.created_at,
      base_snapshot_time: sim.base_snapshot_time,
      mode: 'SIMULATION',
      is_isolated: true,
      total_entities: mergedEntities.length,
      modified_entity_count: overrides.length,
      entities: mergedEntities,
      cascading_events: cascadingEvents,
      impact_analysis: {
        affected_corridors: Array.from(affectedCorridors),
        risk_escalation: cascadingEvents.some(e => e.severity === 'CRITICAL') ? 'CRITICAL_INTERVENTION_NEEDED' : cascadingEvents.length > 0 ? 'ELEVATED_WATCH' : 'NOMINAL',
        evidence: evidenceList,
      },
    };
  }

  /**
   * POST /simulation/:id/reset
   * Reverts all simulated overrides back to the original baseline state
   */
  public resetSimulation(simulationId: string): { simulation_id: string; reset: boolean } {
    const sim = db.prepare(`SELECT * FROM simulations WHERE id = ?`).get(simulationId) as any;
    if (!sim) {
      throw new Error(`Simulation not found: ${simulationId}`);
    }

    db.prepare(`DELETE FROM simulation_entity_overrides WHERE simulation_id = ?`).run(simulationId);
    db.prepare(`UPDATE simulations SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), simulationId);

    return {
      simulation_id: simulationId,
      reset: true,
    };
  }

  /**
   * List all simulations
   */
  public listSimulations(): any[] {
    const sims = db.prepare(`SELECT * FROM simulations ORDER BY created_at DESC`).all() as any[];
    return sims.map(s => {
      const cnt = db.prepare(`SELECT COUNT(*) as c FROM simulation_entity_overrides WHERE simulation_id = ?`).get(s.id) as any;
      return {
        ...s,
        modified_entity_count: cnt?.c || 0,
      };
    });
  }

  public deleteSimulation(simulationId: string): boolean {
    db.prepare(`DELETE FROM simulation_entity_overrides WHERE simulation_id = ?`).run(simulationId);
    const result = db.prepare(`DELETE FROM simulations WHERE id = ?`).run(simulationId);
    return result.changes > 0;
  }
}

export const simulationService = SimulationService.getInstance();
