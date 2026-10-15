# REVANA TECHNOLOGIES — STARTUP HOOKS, ENDPOINTS & RE-SEED TRIGGERS
**Phase 0D Deliverable — Ingestion Mechanisms & Re-Creation Vulnerabilities**
**Date:** 2026-10-15  
**Auditor:** Principal Software Architect & Production-Readiness Auditor  

---

## 1. Executive Summary

A critical requirement of Phase 0 is determining **how and when synthetic data is introduced or re-introduced** into Revana Technologies. This document catalogues every automated startup hook, manual REST endpoint, developer test script, and frontend user action capable of creating, mutating, or re-seeding synthetic records.

---

## 2. Server Startup Hooks (`server/src/index.ts`)

| Hook / Call | Source Line | Action Performed | Synthetic Contamination Risk |
|---|---|---|---|
| `initDatabase()` | `server/src/index.ts:76` | Creates SQLite tables (`CREATE TABLE IF NOT EXISTS`) and applies safe `ALTER TABLE` column additions. | **NONE.** Purely structural schema initialization; does not insert records. |
| `MaritimeService.initialize()` | `server/src/index.ts:77` | Bootstraps the AIS maritime ingestion service. | **HIGH (in legacy configuration).** If `AISSTREAM_API_KEY` was absent or failed WebSocket handshake, it defaulted to `AisRealReplayProvider()`, spawning 84 simulated ships and generating synthetic position trails via `seedInitialHistoricalTrailsIfEmpty()`. |
| `seedDatabase()` | `server/src/index.ts:5` | Imported at top of file: `import { seedDatabase } from './db/seedData.js';`. | **LOW.** Currently uninvoked during startup (commented out / uncalled in `index.ts`), but import remains a dormant risk. |

---

## 3. Production-Accessible REST API Endpoints

The following HTTP endpoints in the Express router can be called over the network to create, reload, or trigger synthetic data ingestion:

### 3.1 `POST /api/ingestion/demo/reload`
- **Route File:** `server/src/routes/ingestion.routes.ts` (Lines 129–136)
- **Handler Code:**
  ```typescript
  ingestionRouter.post('/demo/reload', (req: Request, res: Response) => {
    try {
      seedDatabase(true);
      res.json({ success: true, message: 'Karnataka-South logistics benchmark dataset reloaded successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  ```
- **Hazard Level:** **CRITICAL / DESTRUCTIVE.** Calling this endpoint with `force: true` executes `DELETE FROM relationships; DELETE FROM events; DELETE FROM locations; DELETE FROM anomalies; DELETE FROM merge_candidates; DELETE FROM investigations; DELETE FROM datasets; DELETE FROM entities;` and re-populates the 1,217-line static dataset.
- **Authentication:** None. Open endpoint accessible to any network client.

### 3.2 `POST /providers/sync-all` (and `/api/providers/sync-all`)
- **Route File:** `server/src/routes/providers.routes.ts` (Lines 33–83)
- **Handler Code:**
  Loops through core providers (`gtfs_transit`, `gbfs_mobility`, `water_level_gauge`, `national_grid_energy`, `data_gov_in`, `gdacs_civic_alerts`, `open_meteo_weather`, `usgs_earthquake`).
- **Hazard Level:** **HIGH.** Ingests hardcoded synthetic observations into `world_observations`, `world_entities`, and `world_events` whenever unconfigured providers are queried.
- **Authentication:** None.

### 3.3 `POST /api/sources/sync-all`
- **Route File:** `server/src/routes/sources.routes.ts` (Lines 17–28)
- **Handler Code:** Calls `SourceService.syncAllSources()`. Reads from the 4 SQLite databases in `server/data/sources/` and inserts canonical records into `entities` and `relationships`.
- **Hazard Level:** **MEDIUM.** Ingests the 4 synthetic source databases if they exist on disk.
- **Authentication:** None.

---

## 4. Standalone Developer & Test Scripts

| Script File | Execution Method | Functionality & Side Effects |
|---|---|---|
| `server/src/verify_multi_database.ts` | `npx tsx src/verify_multi_database.ts` | 1. Executes destructive deletes on `entities`, `relationships`, `source_records`, `entity_source_links`, `data_sources`.<br>2. Invokes `initSourceDatabases(true)` which unlinks and recreates the 4 SQLite files in `server/data/sources/`.<br>3. Runs end-to-end sync and resolution verification. |
| `server/src/tests/connectors.test.ts` | `npm run test:connectors` | Initializes in-memory / local test instances of `MockDataProvider`. Non-destructive to canonical operational tables. |
| `generate_codebase.js` | `node generate_codebase.js` | Scans workspace and rewrites `codebase.md`. No database mutations. |

---

## 5. Client UI Trigger Actions

| Client Component | UI Action / Trigger | Backend Call | Resulting Mutation |
|---|---|---|---|
| `client/src/components/mirror/DigitalMirrorView.tsx` (Line 108) | User clicks "Sync Providers" or "Refresh Telemetry" button | Calls `api.syncAllProviders()` -> `POST /api/providers/sync-all` | Re-injects synthetic buses, reservoirs, and grid telemetry into the active world model. |
| `client/src/components/ingestion/DataIngestionView.tsx` | Dataset Management View | Calls `api.getDatasets()` | Surfaces `DS-SYNTHETIC-LOGISTICS-2026` if seeded. |
| `client/src/components/map/TacticalMap.tsx` | Real-time Map Load | Connects to `EventSource('/api/maritime/events/stream')` | If replay provider is active, continuously receives synthetic vessel updates. |
