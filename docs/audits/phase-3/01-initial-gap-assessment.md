# REVANA TECHNOLOGIES — PHASE 3 INITIAL GAP ASSESSMENT
## Operational Data Model, Data Integrity, Provenance & World Model Consistency

- **Document Identifier:** `docs/audits/phase-3/01-initial-gap-assessment.md`
- **Assessment Date:** 2026-10-16T22:35:00+05:30
- **Lead Architect / Auditor:** Senior Staff Software Architect, Data-Platform Engineer & QA Verification Specialist
- **Git Branch:** `cleanup/architecture`
- **Baseline Commit:** `f39c726`
- **Target Database:** `server/data/aegis_intel.db` (SQLite 3 WAL)

---

## 1. PURPOSE & SCOPE

This initial gap assessment evaluates the real operational data model, schema integrity, provider ingestion pipelines, timestamp semantics, graph relationships, and moving entity stores across the Revana Technologies platform prior to executing Phase 3 implementation.

The objective is to establish an empirical baseline of what exists versus what is required by the Phase 3 target architecture, without relying on unverified assumptions from previous reports.

---

## 2. EMPIRICAL BASELINE INVENTORY

### 2.1 Database State & Table Row Counts
Inspection of `server/data/aegis_intel.db` via safe read-only queries reveals:

| Table | Current Row Count | Role / Status |
| :--- | :---: | :--- |
| `world_entities` | 310 | Canonical entities across aviation, seismic, hydrology, meteorological, AQI, and financial domains. |
| `world_observations` | 5,744 | Normalized temporal observations from real providers. |
| `raw_observations` | 586 | Retained raw payloads for provenance and auditing. |
| `moving_entities` | 1,048 | Live tracked entities (801 AIS maritime vessels + 247 ADS-B aircraft). |
| `entity_positions` | 24,192 | Historical position fixes for moving entities. |
| `world_relationships` | 56 | Spatial and operational graph edges. |
| `temporal_state_history` | 108 | Audit trail of entity state transitions. |
| `data_migration_log` | 4 | Recorded historical migration ledgers. |
| `entities` (legacy) | 0 | Empty legacy table. |
| `locations` (legacy) | 0 | Empty legacy table. |

### 2.2 Entity Distribution in `world_entities`
```text
┌─────────┬─────────────────────────┬─────┐
│ (index) │ type                    │ c   │
├─────────┼─────────────────────────┼─────┤
│ 0       │ 'AIRCRAFT'              │ 247 │
│ 1       │ 'EARTHQUAKE_EPICENTER'  │ 35  │
│ 2       │ 'WATER_RESERVOIR_GAUGE' │ 16  │
│ 3       │ 'AIR_QUALITY_STATION'   │ 6   │
│ 4       │ 'WEATHER_STATION'       │ 5   │
│ 5       │ 'FINANCIAL_INDEX'       │ 1   │
└─────────┴─────────────────────────┴─────┘
```

---

## 3. IDENTIFIED ARCHITECTURAL & DATA INTEGRITY GAPS

### Gap 1: Dangling Edges in `world_relationships`
- **Finding:** Inspection of `world_relationships` revealed that **all 56 existing graph edges** possess a `target_id` that does NOT exist in `world_entities`:
  - 54 edges point to `AIRPORT_KEMPEGOWDA_BLR` (e.g. `rel_AIRCRAFT_801465_AIRPORT_VOBL` with type `EN_ROUTE_TERMINAL_CONTROL_AREA`).
  - 2 edges point to `ROAD_CORRIDOR_NH48` (e.g. `rel_WEATHER_NODE_BLR_CENTRAL_NH48_CORRIDOR` with type `MONITORS_ATMOSPHERE_AROUND`).
- **Root Cause:** The corridor, airport, and catchment geometries are defined as static constants in TypeScript (`server/src/services/world_model/reference.ts`), but they were never registered as canonical entities in `world_entities`.
- **Integrity Impact:** A foreign key constraint `FOREIGN KEY (target_id) REFERENCES world_entities(id)` cannot be enforced until these reference anchor entities are officially registered in `world_entities`.

### Gap 2: Out-of-Order Observation Overwrite Vulnerability
- **Finding:** In `worldModelService.ingestObservation`, the `ON CONFLICT(id) DO UPDATE SET` logic in `world_entities` unconditionally overwrites `current_state`, `latitude`, `longitude`, and `last_observed_at` with the incoming observation's values:
  ```sql
  ON CONFLICT(id) DO UPDATE SET
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    current_state = excluded.current_state,
    last_observed_at = excluded.last_observed_at,
    ...
  ```
- **Integrity Impact:** If an out-of-order, delayed, or historical observation arrives after a newer observation, it overwrites the entity's current state with stale information.
- **Remediation Required:** Implement conditional updates in SQLite or application logic: only update `current_state`, coordinates, and `last_observed_at` when `excluded.last_observed_at >= world_entities.last_observed_at`.

### Gap 3: Hydrology Timestamp Semantics and Date-Only Precision
- **Finding:** Inspection of raw payloads in `raw_observations` for `cwc_india_wris` confirmed that India-WRIS returns a calendar date string only:
  ```json
  {
    "agencyName": "CWC",
    "stateName": "Karnataka",
    "reservoirName": "Almatti Reservoir",
    "currentLiveStorage_BMC": 1.04,
    "date": "2024-01-15"
  }
  ```
- **Root Cause:** `CwcHydrologyProvider.ts` appended `T08:30:00.000Z`, which:
  1. Fabricated time-of-day precision not supplied by the source.
  2. Implied 08:30 UTC rather than 08:30 Indian Standard Time (IST, UTC+05:30), which is 03:00 UTC.
- **Remediation Required:**
  1. Record explicit `source_date: "2024-01-15"` and `date_precision: "DAY"` in observation `value` and `provenance`.
  2. Explicitly document that any derived UTC instant (`03:00:00.000Z`) is a standardized conversion of the 08:30 IST bulletin cut-off time, preserving the original calendar date without ambiguity.

### Gap 4: Hydrological Catchment Spatial Joins
- **Finding:** In `world_model.service.ts`, the spatial relationship discovery rule for catchment basins checks `if (obs.entity_type === 'WATER_GAUGE')`. However, the CWC Hydrology provider outputs `obs.entity_type = 'WATER_RESERVOIR_GAUGE'`.
- **Integrity Impact:** Major reservoirs in the Cauvery Basin (KRS Dam, Harangi, Hemavathy) fail to connect to `CATCHMENT_CAUVERY_SOUTH` during automated spatial reasoning.
- **Remediation Required:** Update entity type matching to include `'WATER_RESERVOIR_GAUGE'`.

### Gap 5: Fallback Observation ID Determinism
- **Finding:** In `world_model.service.ts`:
  ```ts
  const obsId = obs.id || `obs_${uuidv4()}`;
  ```
  If an upstream provider fails to assign a deterministic `obs.id`, `uuidv4()` is generated. On repeated ingestion of the same payload, duplicate observations would be inserted into `world_observations`.
- **Remediation Required:** Implement deterministic fallback key generation based on `${provider}_${entity_id}_${epochSec}` when `obs.id` is undefined.

---

## 4. PHASE 3 IMPLEMENTATION ROADMAP

1. **Architecture Specification:** Publish `docs/architecture/phase-3-operational-data-model.md`.
2. **Pre-Migration Safety Backup:** Create and verify a physical snapshot of `aegis_intel.db`.
3. **Canonical Reference Anchor Registration:** Insert authoritative reference entities (`ROAD_CORRIDOR_NH48`, `AIRPORT_KEMPEGOWDA_BLR`, `CATCHMENT_CAUVERY_SOUTH`) into `world_entities` with complete metadata.
4. **World Model Engine Hardening:**
   - Add out-of-order protection to `worldModelService.ingestObservation`.
   - Add deterministic fallback observation ID generation.
   - Update spatial matcher to support `'WATER_RESERVOIR_GAUGE'`.
5. **CWC Hydrology Normalization Update:**
   - Preserve `source_date` and `date_precision: 'DAY'`.
   - Correct UTC conversion of 08:30 IST to `03:00:00.000Z` with provenance derivation flags.
6. **Database Migration Execution:** Record execution in `data_migration_log`.
7. **Automated Verification:** Create and execute `server/src/tests/phase3_data_model.test.ts`.
8. **Final Exit Audit:** Compile evidence in `docs/audits/phase-3/03-final-exit-audit.md`.
