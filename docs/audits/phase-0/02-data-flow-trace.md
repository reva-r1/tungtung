# REVANA TECHNOLOGIES — END-TO-END DATA FLOW TRACE
**Phase 0C Deliverable — Pipeline & Architectural Path Analysis**
**Date:** 2026-10-15  
**Auditor:** Principal Software Architect & Production-Readiness Auditor  

---

## 1. Trace Overview & Objectives

This document maps the exact data flow pathways through which synthetic, mock, and simulated records propagate through Revana Technologies. For each identified source, the path is traced across:
1. **Definition / Genesis**
2. **Ingestion & Persistence Layer**
3. **Internal Processing & Graph / Entity Resolution**
4. **Backend REST APIs & Event Streams (SSE)**
5. **AI Reasoning / Context Engine Retrieval**
6. **Frontend Consumption & Tactical Visualizations**

---

## 2. Trace 1: Core Logistics Benchmark (`seedData.ts`)

```
[seedData.ts] (Hardcoded Arrays: 10 Companies, 8 Vehicles, 4 Drivers, etc.)
      │
      ▼
[POST /api/ingestion/demo/reload] (ingestion.routes.ts line 129)
      │
      ▼
[SQLite: aegis_intel.db]
├── entities (COMP-*, VEH-*, DRV-*, FAC-*, TOLL-*)
├── relationships (28 semantic links)
├── locations (6 Karnataka/TN points)
├── events (EVT-2026-001..006)
├── anomalies (ANM-CIRC-01, ANM-ROUTE-02, etc.)
├── merge_candidates (MC-001, MC-002)
├── investigations (INV-2026-001..003)
└── datasets (DS-SYNTHETIC-LOGISTICS-2026)
      │
      ├──► [GraphService.ts] ────────► [GET /api/graph] ──────────► [TacticalGraphCanvas.tsx]
      │                                                               (Cytoscape Graph Visualizer)
      │
      ├──► [ResolutionService.ts] ───► [GET /api/resolution] ─────► [EntityResolutionView.tsx]
      │                                                               (Merge/Dedup Review)
      │
      ├──► [AI Router & Retrieve] ───► [POST /api/ai/chat] ───────► [AiInvestigationWorkspace.tsx]
      │    (ai.service.ts)             (Chat Context & Tools)          (Lead Intelligence Dossier)
      │
      └──► [ingestion.service.ts] ───► [GET /api/ingestion/datasets]► [DataIngestionView.tsx]
                                                                       (Datasets Ledger: "DEMO / SYNTHETIC")
```

### Critical Flow Observations:
- When seeded, synthetic vehicles (e.g., `VEH-KA-01-AB-1234`) and companies (`COMP-APX-04`) populate the primary graph canvas.
- The AI Investigation Agent (`server/src/services/ai/retrieve.ts`) queries `get_entity`, `get_connections`, and `get_anomalies`. When asked about "Apex Global Logistics" or "Operation Falcon", the agent retrieves these seeded rows as factual intelligence claims.
- The Entity Resolution UI surfaces `MC-001` and `MC-002` as pending canonical merge tasks.

---

## 3. Trace 2: Synthetic Source Databases (`sourceDatabases.ts`)

```
[sourceDatabases.ts] (Creates 4 SQLite DBs in server/data/sources/)
      │
      ▼
[POST /api/sources/sync-all] (sources.routes.ts line 17)
      │
      ▼
[SourceService.ts & IngestionService.ts]
      │
      ▼
[SQLite: aegis_intel.db]
├── data_sources (LOGISTICS_DB, COMPANY_REGISTRY_DB, FACILITIES_DB, TRANSACTIONS_DB)
├── source_records (Shipment S1001, Vehicle KA01AB1234, Director Ravi Kumar, Account T991)
├── entity_source_links (Cross-database link mappings)
└── entities & relationships (Derived canonical cross-source graph)
      │
      ├──► [SourceService.ts] ────────► [GET /api/sources] ──────► [DataSourcesView.tsx]
      │                                 [GET /api/sources/:id/tables] (Multi-DB Explorer)
      │
      └──► [ResolutionService.ts] ───► [GET /api/resolution/provenance/:id]
                                        (Provenance drill-down showing source table/row)
```

### Critical Flow Observations:
- These independent databases were architected to demonstrate Revana's cross-source entity resolution (correlating `S1001` from `logistics.db` with `Ravi Kumar` in `company_registry.db` and transaction `T991` in `transactions.db`).
- Currently, `SourceService.bootstrapSources()` is set to a no-op, preventing automatic initialization on startup. However, calling `POST /api/sources/sync-all` or executing `verify_multi_database.ts` repopulates this data.

---

## 4. Trace 3: Maritime Telemetry & Malacca Fleet Anomaly (`aisRealReplayProvider.ts`)

```
[aisRealReplayProvider.ts] (22 SEED_VESSELS + 62 Malacca Convergence Fleet)
      │
      ▼
[setInterval 3000ms dead-reckoning loop]
      │
      ▼
[MaritimeService.ts (ingestRawUpdate)]
      │
      ▼
[SQLite: aegis_intel.db]
├── moving_entities (84 vessels, providerSource: 'Replay Feed')
├── entity_positions (126,000+ kinematic position fixes)
└── maritime_patterns (PAT_CORRIDOR_MALACCA: 62 observed vs 41 baseline = +51.2%)
      │
      ├──► [maritime.routes.ts] ───► [GET /api/maritime/vessels] ─► [TacticalMap.tsx]
      │                              (Polling ship array)           (Map Markers & Ship Count)
      │
      ├──► [SSE Event Stream] ────► [GET /api/maritime/events/stream]
      │                              (Real-time position push)
      │
      ├──► [Pattern Detector] ────► [GET /api/maritime/patterns] ─► [TacticalMap.tsx (Banner)]
      │                                                             [MaritimePatternModal.tsx]
      │
      └──► [AI Router & Tools] ───► [POST /api/ai/chat] ──────────► [Maritime Pattern Dossier]
           (maritimeTools.ts)        (get_maritime_corridor_patterns)
```

### Critical Flow Observations:
- **Startup Infiltration:** `server/src/index.ts` calls `MaritimeService.initialize()` unconditionally on startup. If `AISSTREAM_API_KEY` was missing or unreadable (or failed to parse WebSocket Blobs), `MaritimeService` fell back to `AisRealReplayProvider`, instantly seeding 84 fake ships.
- **Visual Alert Injection:** `TacticalMap.tsx` line 329 checked specifically for `patterns.find(p => p.pattern_id === 'PAT_CORRIDOR_MALACCA')`, flashing a prominent red warning banner: `"MALACCA CHOKEPOINT: +51.2% SURGE"` with an `"INVESTIGATE"` button.
- **AI Tool Contamination:** When an analyst clicks "Investigate", `POST /api/maritime/patterns/:id/investigate` triggers `MaritimeReasoningService.ts`, which passes the fabricated 62-vessel observation into the LLM prompt.

---

## 5. Trace 4: World Model Silent Fallbacks (`connectors/providers/`)

```
[User clicks "Sync All" in Digital Mirror] OR [POST /providers/sync-all]
      │
      ▼
[ProviderRegistry.ts (sync-all loop)]
      │
      ├──► [GTFSRealtimeProvider] ─── (No GTFS_FEED_URL) ───► Generates simulated BMTC buses
      ├──► [PublicWaterLevelProvider] (example.gov endpoint) ──► Generates simulated KRS/Kabini dams
      ├──► [GBFSProvider] ─────────── (example.gov endpoint) ──► Generates simulated Yulu/Bounce hubs
      ├──► [NationalGridEnergyProvider](example.org endpoint) ─► Generates simulated Pavagada solar
      ├──► [DataGovInProvider] ────── (No DATA_GOV_KEY) ────► Generates simulated Yeshwanthpur mandi
      ├──► [PublicFeedProvider] ───── (example.org endpoint) ──► Generates simulated Cyclone advisory
      └──► [MockDataProvider] ────── (Internal test harness) ─► Generates TEST_RADAR_01 fix
      │
      ▼
[worldModelService.ingestObservation()]
      │
      ▼
[SQLite: aegis_intel.db]
├── raw_observations (Payloads stored with endpoint URL)
├── world_observations (144 normalized records)
├── world_entities (142 physical entities: BUS_*, GAUGE_*, STATION_*, SUBSTN_*)
├── world_relationships (19 spatial containment & corridor links)
└── world_events (123 alerts: Weather, High Stage, Congestion)
      │
      ├──► [world.routes.ts] ──────► [GET /world/state] ──────────► [DigitalMirrorView.tsx]
      │                              (GeoJSON & Entity Graph)       (Tactical Mirror Map & Layer Toggles)
      │
      └──► [AI World Tools] ───────► [POST /api/ai/chat] ──────────► [AiInvestigationWorkspace.tsx]
           (worldTools.ts)           (get_active_world_events,      (Synthesizes claims citing fake
                                      get_nearby_sensors)            dam levels or bus telemetry)
```

### Critical Flow Observations:
- **Silent Fabrication:** These providers do not fail with HTTP 500 or record an unconfigured state; they return an HTTP 200 payload containing synthetic records as if they were retrieved from live government feeds.
- **Digital Mirror Infiltration:** The Digital Mirror view (`client/src/components/mirror/DigitalMirrorView.tsx`) renders these as live physical infrastructure in Karnataka and Tamil Nadu.
- **AI Tool Grounding Risk:** Revana's AI reasoning layer explicitly grounds its claims in `world_observations`. When it queries `get_active_world_events`, it treats the hardcoded `Cauvery River Basin Inflow High Stage Notice` as verified real-world telemetry.
