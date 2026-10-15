# Revana Technologies — Phase 1 Data Cleanup Report
**Document ID:** `AUDIT-PHASE1-DATA-CLEANUP`  
**Phase:** 1 (Production Data Purge)  
**Executed Migration:** `server/src/db/cleanup_synthetic_data.ts`  
**Execution Timestamp:** 2026-10-15T18:28:23.918Z  
**Backup Path:** `server/data/aegis_intel.phase0_backup_2026-10-15T18-28-23-918Z.db`  

---

## 1. Cleanup Objectives & Governance

The objective of the Phase 1 database purge was to permanently eliminate all verified synthetic, simulated, and test-generated records from `server/data/aegis_intel.db` while upholding strict invariants:
1. **Zero Customer Record Loss:** All real customer logistics entities (`locations` matching `LOC-ENT-CUST-*`) must be preserved without alteration.
2. **Preserve Authentic Real-World Data:** Real-time streamed maritime vessels (`SHIP_*` from live AISStream.io), real USGS seismic observations, and real Open-Meteo observations must be preserved.
3. **Guaranteed Rollback Mechanism:** A verified file backup of the operational database must be created immediately before executing any destructive operations.
4. **ACID Transaction Execution:** All deletions across dependent tables must execute inside a single database transaction. Any constraint violation or unexpected customer count change triggers an immediate rollback.
5. **Referential Integrity Assurance:** `PRAGMA foreign_key_check` and `PRAGMA integrity_check` must pass with zero errors post-cleanup.

---

## 2. Targeting & Provenance Criteria

| Entity Category | Table | Provenance & Filter Criteria | Rationale |
| :--- | :--- | :--- | :--- |
| **Synthetic Replay Vessels** | `moving_entities` | `properties LIKE '%Replay%' OR properties LIKE '%ais_real_replay%' OR mmsi LIKE '999%' OR id LIKE 'vessel_mmsi_%' OR id LIKE 'VESSEL_%'` | Hardcoded static seed vessels from `aisRealReplayProvider.ts` and the fabricated 62-vessel Malacca surge fleet. |
| **Orphaned Replay Tracks** | `entity_positions` | `entity_id IN (synthetic_moving_entity_ids)` | Historical coordinate breadcrumbs jittered by the replay provider's interval loop. |
| **Fabricated Anomaly Pattern** | `maritime_patterns` | `pattern_id = 'PAT_CORRIDOR_MALACCA'` | Static demo pattern claiming a +51.2% vessel surge in the Malacca Strait. |
| **Simulated Sensor Entities** | `world_entities` | `id LIKE 'BUS_%' OR id LIKE 'HYDRO_%' OR id LIKE 'GAUGE_%' OR id LIKE 'MOBILITY_HUB_%' OR id LIKE 'GRID_%' OR id LIKE 'SUBSTATION_%' OR id LIKE 'GOV_MARKET_%' OR id LIKE 'ALERT_GDACS_%' OR id LIKE 'SENSOR_TEST_%' OR id LIKE 'loc_mock_%' OR id LIKE 'loc_out_order_%' OR id LIKE 'loc_sim_%' OR id LIKE 'SIM_TEST_%'` | Fabricated assets inserted by mock providers or test suites into the operational DB. |
| **Simulated Observations** | `world_observations` | `provider IN ('gtfs_realtime', 'water_level_gauge', 'gbfs_mobility', 'national_grid_energy', 'data_gov_in', 'gdacs_civic_alerts', 'mock_test_provider', 'test_provider', 'test_engine') OR entity_id IN (synthetic_world_entity_ids)` | Simulated telemetry readings with fake observations. |
| **Simulated Raw Payloads** | `raw_observations` | Same provider filter as above. | Raw mock payloads. |
| **Dependent Graph Edges** | `world_relationships` & `inferred_relationships` | `source_id / target_id IN (synthetic_world_entity_ids)` | Relationships inferred or linked to fake entities. |
| **Dependent World Events** | `world_events` | `entity_id IN (synthetic_world_entity_ids)` | Events triggered on simulated threshold breaches. |
| **State History** | `temporal_state_history` | `entity_id IN (synthetic_world_entity_ids)` | Historical states for simulated entities. |
| **Test Scenario Clones** | `simulations` & `simulation_entity_states` | `id LIKE 'sim_%'` | Leftover simulation sandboxes from connector test runs. |

---

## 3. Dry-Run Audit vs. Executed Purge Counts

| Target Table | Dry-Run Identified | Executed Purge | Post-Purge Remaining | Status |
| :--- | :--- | :--- | :--- | :--- |
| `moving_entities` (synthetic) | **84** | **84** | **73** (all live AIS ships) | ✔ Purged |
| `entity_positions` (synthetic) | **126,074** | **126,074** | **87** (real live AIS positions) | ✔ Purged |
| `maritime_patterns` | **1** | **1** | **0** | ✔ Purged |
| `world_entities` (simulated/test) | **23** | **23** | **128** (all real weather/seismic/marine) | ✔ Purged |
| `world_observations` (synthetic) | **46** | **46** | **68** (real live observations) | ✔ Purged |
| `raw_observations` (synthetic) | **10** | **10** | **8** (real live raw payloads) | ✔ Purged |
| `world_events` (synthetic) | **1** | **1** | **143** (real live events) | ✔ Purged |
| `world_relationships` (synthetic) | **3** | **3** | **22** (real physical links) | ✔ Purged |
| `inferred_relationships` (synthetic) | **107** | **107** | **108** (real grounded inferences) | ✔ Purged |
| `temporal_state_history` | **60** | **60** | **64** (real entity transitions) | ✔ Purged |
| `simulations` / overrides | **20** | **20** | **0** | ✔ Purged |
| `simulation_entity_states` | **98** | **98** | **0** | ✔ Purged |
| **TOTAL SYNTHETIC RECORDS** | **126,527** | **126,527** | — | ✔ **100% PURGED** |

---

## 4. Verified Exclusions & Preservation Invariants

The following genuine datasets and entities were verified and excluded from the purge:

1. **Customer Logistics Reference Data:**
   - `LOC-ENT-CUST-001` — Apex Global Logistics (Transit Point) [PRESERVED]
   - `LOC-ENT-CUST-002` — Zenith Freight Carriers (Transit Point) [PRESERVED]
   - `LOC-ENT-CUST-003` — Orion Supply Depot (Transit Point) [PRESERVED]
   - **Post-cleanup count:** 3 / 3 (100% preserved).

2. **Real Live Streamed AIS Maritime Vessels:**
   - 73 authentic vessels actively broadcasting via `AISStream.io` (e.g. `SHIP_351965000 KUO LUNG`, `SHIP_525601594 TB AMADEUS 1`, `SHIP_249174000 CMA CGM HONG KONG`).
   - All 87 real coordinate breadcrumbs preserved.

3. **Real Geospatial & Seismic Entities:**
   - 128 genuine operational entities preserved, including USGS global earthquakes (`quake_event_*`), Open-Meteo regional weather grids (`loc_geo_*`), and offshore marine telemetry nodes (`loc_marine_sector_*`).

---

## 5. Referential Integrity & Validation

- `PRAGMA foreign_key_check`: **0 errors**.
- `PRAGMA integrity_check`: **ok**.
- `data_migration_log`: Audit record stored under ID `phase1_cleanup_1760552903918`.
