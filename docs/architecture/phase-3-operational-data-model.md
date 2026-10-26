# REVANA TECHNOLOGIES — OPERATIONAL DATA MODEL ARCHITECTURE SPECIFICATION
## Phase 3: Canonical Entity Contracts, Data Integrity, Provenance & World Model Consistency

- **Document Identifier:** `docs/architecture/phase-3-operational-data-model.md`
- **Status:** APPROVED & IMPLEMENTED
- **Revision:** 3.0.0
- **Authors:** Senior Software Architect, Data-Platform Engineer & Systems Reliability Specialist

---

## 1. ARCHITECTURAL OVERVIEW

The Revana Technologies Operational Data Platform establishes a unified, evidence-backed world model that ingests heterogeneous real-world telemetry (aviation ADS-B, maritime AIS, seismic solutions, numerical weather predictions, atmospheric chemical dispersion models, and hydrological reservoir measurements).

The architecture enforces strict separation of concerns across six core operational concepts:

```
  ┌─────────────────────────┐         ┌─────────────────────────┐
  │   RAW SOURCE PAYLOAD    │────────▶│ CANONICAL OBSERVATION   │
  │   (raw_observations)    │         │  (world_observations)   │
  └─────────────────────────┘         └────────────┬────────────┘
                                                   │ updates state
                                                   ▼
  ┌─────────────────────────┐         ┌─────────────────────────┐
  │   GRAPH RELATIONSHIP    │◀────────│    CANONICAL ENTITY     │
  │  (world_relationships)  │         │    (world_entities)     │
  └─────────────────────────┘         └─────────────────────────┘
               ▲
               │ spatial / temporal join
  ┌────────────┴────────────┐
  │ REFERENCE ANCHOR ENTITY │
  │ (world_entities: REF)   │
  └─────────────────────────┘
```

1. **Entity (`world_entities`):** The identifiable real-world object or persistent physical phenomenon (e.g. aircraft, reservoir, weather hub, fault epicenter, trade corridor).
2. **Observation (`world_observations`):** An immutable, time-stamped fact, measurement, or status report regarding an entity, traceable to a source.
3. **Raw Payload (`raw_observations`):** The unmodified source response preserved for reproducible audit, verification, and transformation replay.
4. **Relationship (`world_relationships`):** A typed, directed edge connecting two entities, supported by verifiable spatial, temporal, or operational evidence.
5. **State Transition History (`temporal_state_history`):** An append-only delta log tracking every state mutation of an entity over time.
6. **Provider Health & Connection State:** Decoupled metrics representing HTTP transport status, independent of the underlying telemetry's freshness.

---

## 2. CANONICAL ENTITY IDENTITY & DEDUPLICATION

### 2.1 Entity Identity Rules
Every entity possesses a deterministic canonical identifier formatted according to its real-world domain. An entity's canonical ID never changes due to label edits, polling cycles, or coordinate shifts:

| Domain | Entity ID Format | Example | Source Key |
| :--- | :--- | :--- | :--- |
| **Aviation** | `AIRCRAFT_${ICAO24.toUpperCase()}` | `AIRCRAFT_80162C` | 24-bit ICAO transponder hex |
| **Maritime** | `SHIP_${MMSI}` | `SHIP_412345678` | 9-digit Maritime Mobile Service Identity |
| **Seismic** | `SEISMIC_EVENT_${FEATURE_ID}` | `SEISMIC_EVENT_nc75450451` | Official USGS Feature ID |
| **Weather** | `WEATHER_NODE_${NODE_ID}` | `WEATHER_NODE_BLR_CENTRAL` | Configured operational hub ID |
| **Air Quality** | `AQI_NODE_${NODE_ID}` | `AQI_NODE_BLR_CENTRAL` | Configured operational hub ID |
| **Hydrology** | `RESERVOIR_${CODE}_KARNATAKA` | `RESERVOIR_ALMATTI_KARNATAKA` | National Register of Large Dams code |
| **Infrastructure** | `ROAD_CORRIDOR_${NAME}` | `ROAD_CORRIDOR_NH48` | Surveyed corridor identifier |
| **Aviation Hub** | `AIRPORT_${NAME}` | `AIRPORT_KEMPEGOWDA_BLR` | Official ICAO/IATA facility code |
| **Hydrological Basin** | `CATCHMENT_${NAME}` | `CATCHMENT_CAUVERY_SOUTH` | River basin hydrological registry |

### 2.2 Cross-Provider Entity Resolution & Provenance Merging
When multiple providers report telemetry regarding the same physical entity (e.g. Open-Meteo Weather and Open-Meteo Air Quality observing the Bengaluru hub):
- The canonical entity ID remains stable (`WEATHER_NODE_BLR_CENTRAL`, `AQI_NODE_BLR_CENTRAL`).
- `source_providers` records a JSON array of all providers that have contributed verified telemetry.
- `last_provider` records the provider responsible for the most recent observation.
- Merging across domains is prohibited unless backed by an explicit natural key (e.g., ICAO24 for flights, MMSI for vessels, NRLD code for dams). Two entities are **never** merged based solely on proximity or name similarity.

---

## 3. CANONICAL OBSERVATION IDENTITY & DEDUPLICATION

### 3.1 Observation ID Generation
Observations are uniquely identified by deterministic keys that guarantee idempotent ingestion across repeated polling cycles:

- **Seismic Events:** `obs_usgs_${featureId}_${updatedEpoch}`
  - *Revision Semantics:* If the USGS updates magnitude or depth, `updatedEpoch` changes. The new solution is persisted as a distinct historical record while the entity's current state is updated.
- **Meteorological Telemetry:** `obs_meteo_${nodeId}_${validTimeUtc.replace(/[:.]/g, '_')}`
  - *Deduplication:* Polling the same forecast interval multiple times produces identical IDs, resulting in an idempotent SQLite update with zero duplicate writes.
- **Air Quality Telemetry:** `obs_aqi_${nodeId}_${validTimeUtc.replace(/[:.]/g, '_')}`
- **Hydrological Bulletins:** `obs_cwc_${stationCode}_${observationDate}`
  - *Daily Cadence:* Exactly one observation is recorded per reservoir per calendar date.
- **Aviation State Vectors:** `obs_flight_${icao24}_${timePosition || epochSec}`
- **Deterministic Fallback:** For unkeyed observations: `obs_${provider}_${entityId}_${Math.floor(Date.now()/1000)}`.

---

## 4. TIMESTAMP SEMANTICS & TIMEZONE CORRECTNESS

### 4.1 Temporal Taxonomy
Every record across the platform explicitly distinguishes four temporal instants:

1. **`observed_at` (ISO 8601 UTC):** The exact instant when the physical phenomenon occurred or when the source measured it.
2. **`ingested_at` / `created_at` (ISO 8601 UTC):** The instant when Revana accepted and persisted the record into canonical storage.
3. **`source_updated_at` (ISO 8601 UTC):** The instant when the upstream provider modified or recalculated the observation.
4. **`fetched_at` (ISO 8601 UTC):** The instant when the provider client executed the network request.

### 4.2 Date-Only Precision & Hydrology Reconciliation
When an official provider reports a calendar date without a time of day (e.g., Central Water Commission daily reservoir bulletins reporting `"date": "2024-01-15"`):
- The original calendar date is preserved explicitly in `value.source_date` and `provenance.source_date`.
- The temporal precision is explicitly recorded as `date_precision: "DAY"`.
- If an ISO instant is required for B-tree index ordering, it is normalized to UTC with explicit documentation:
  - CWC daily bulletins represent reservoir storage measured at **08:30 AM Indian Standard Time (IST, UTC+05:30)**.
  - The corresponding UTC instant is **`03:00:00.000Z`**.
  - Provenance flags: `derived_from_date: true`, `source_reporting_standard: "08:30 IST Daily Bulletin"`.

### 4.3 Data Freshness Policies (Decoupled from Connectivity)
Data freshness is evaluated strictly against `observed_at`, never `lastPollAt`:

| Domain | Provider Cadence | Fresh Threshold | Stale Threshold | Historical Archive |
| :--- | :--- | :---: | :---: | :---: |
| **Aviation (ADS-B)** | 10–30 seconds | < 120 seconds | 2–10 minutes | > 10 minutes |
| **Seismic (USGS)** | Real-time continuous | < 2 hours | 2–24 hours | > 24 hours |
| **Weather (Open-Meteo)** | Hourly NWP updates | < 2 hours | 2–6 hours | > 6 hours |
| **Air Quality (CAMS)** | Hourly CAMS updates | < 3 hours | 3–12 hours | > 12 hours |
| **Hydrology (CWC)** | Daily bulletin | < 3 days | 3–30 days | > 30 days (1004d archive) |

---

## 5. OUT-OF-ORDER PROTECTION & CONFLICT RESOLUTION

### 5.1 Out-of-Order Ingestion Protection
To prevent delayed network packets or backfilled historical data from overwriting newer real-time states in `world_entities`:
- In `worldModelService.ingestObservation`:
  ```ts
  const isNewer = !existing || !existing.last_observed_at ||
    (new Date(obs.observed_at).getTime() >= new Date(existing.last_observed_at).getTime());
  ```
- **If `isNewer` is true:** `current_state`, coordinates, and `last_observed_at` are updated to reflect the latest valid telemetry.
- **If `isNewer` is false:** The observation is persisted into `world_observations` for complete historical audit, but `world_entities.current_state` and `last_observed_at` remain preserved at the newer state.

---

## 6. GRAPH RELATIONSHIP INTEGRITY

### 6.1 Canonical Reference Anchors
To guarantee 100% referential integrity across the operational graph without dangling edges, reference infrastructure geometries are registered directly into `world_entities`:
1. `ROAD_CORRIDOR_NH48` (`type: 'INFRASTRUCTURE_CORRIDOR'`, `category: 'REFERENCE_GEOMETRY'`)
2. `AIRPORT_KEMPEGOWDA_BLR` (`type: 'AIRPORT'`, `category: 'REFERENCE_GEOMETRY'`)
3. `CATCHMENT_CAUVERY_SOUTH` (`type: 'HYDROLOGICAL_CATCHMENT'`, `category: 'REFERENCE_GEOMETRY'`)

### 6.2 Evidence-Backed Relationship Structure
Every edge in `world_relationships` must maintain:
- `id`: Deterministic edge key (`rel_${sourceId}_${targetId}_${type}`).
- `source_id`: Valid foreign entity ID in `world_entities`.
- `target_id`: Valid foreign entity ID in `world_entities`.
- `relationship_type`: Explicit taxonomy (`IN_FINAL_APPROACH`, `EN_ROUTE_TERMINAL_CONTROL_AREA`, `MONITORS_ATMOSPHERE_AROUND`, `IMPACTS_SURFACE_TRACTION`, `FEEDS_WATERSHED_CATCHMENT`).
- `confidence`: Decayed score (0.0 to 1.0) derived mathematically from distance and observation age.
- `evidence`: JSON array of verifiable quantitative statements (e.g. exact distance in kilometers, threshold values).

---

## 7. MIGRATION & DATA SAFETY STRATEGY

All database modifications follow a strict, non-destructive lifecycle:
1. Physical snapshot backup created prior to DDL execution.
2. In-memory and test-database verification before targeting `aegis_intel.db`.
3. Additive DDL with idempotent checks (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
4. Reversible backfills recorded in `data_migration_log`.
5. Pre- and post-migration row counts and foreign-key checks recorded.
