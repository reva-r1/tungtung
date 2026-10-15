# REVANA TECHNOLOGIES — BASELINE FREEZE MANIFEST
**Phase 0A Deliverable — Operational Intelligence Baseline**
**Date/Time:** 2026-10-15T21:50:00+05:30  
**Auditor / Principal Software Architect:** Google DeepMind Advanced Agentic Coding Pair  
**Repository Branch:** `cleanup/architecture`  
**Git Commit SHA:** `782a1631b04ede3de6539474a782886e97ca55a9` (Head: `refactor(ai): restructure AI investigation agent into 4-stage pipeline with claim tiers`)

---

## 1. Executive Summary & Baseline Status

This manifest establishes a strict, auditable baseline freeze for Revana Technologies ahead of any synthetic data remediation.
- The codebase compiles with zero TypeScript errors across both `server` and `client`.
- All automated test suites (`test:connectors`, `world_model_logic.test.ts`) pass cleanly (24 passed, 0 failed).
- Production build pipelines (`npm run build:client` via Vite and `npm run build:server` via `tsc`) succeed with zero errors.
- The working tree is preserved: `codebase.md` contains an uncommitted documentation dump from the preceding AI investigation refactor, which is explicitly retained without alteration.

---

## 2. Environment & Repository Architecture

| Attribute | Specification | Notes |
|---|---|---|
| **Repository Root** | `d:\zenism` | Monorepo layout containing `server/`, `client/`, and config files |
| **Operating System** | Windows (PowerShell Shell execution) | Tested with Node.js v24.14.1 |
| **Package Manager** | npm (isolated `package.json` in root, `server/`, `client/`) | Root workspace orchestration scripts |
| **Server Framework** | Express 4.21.2 on Node.js / TypeScript 5.5.4 | Executed via `tsx` (dev) or `tsc` (prod) |
| **Client Framework** | React 18.3.1, Vite 5.4.3, TailwindCSS 3.4.11 | UI visualization with Leaflet 1.9.4 & Cytoscape 3.30.2 |
| **Database Engine** | SQLite 3 via `better-sqlite3` 11.8.1 | WAL mode enabled, foreign keys ON |
| **Primary Database File** | `server/data/aegis_intel.db` (34.5 MB) | Houses core entities, world model, maritime tracking |
| **Source Database Files** | `server/data/sources/*.db` (4 files, 36 KB each) | `logistics.db`, `company_registry.db`, `facilities.db`, `transactions.db` |
| **Ignored Submodules** | `gods-eye-view/`, `graphify-out/`, `.claude/` | Documented in root `.gitignore` |

---

## 3. Git Status & Working-Tree State

```
On branch cleanup/architecture
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   codebase.md

no changes added to commit (use "git add" and/or "git commit -a")
Untracked files: none
```

### Uncommitted Modification Justification:
- `codebase.md`: An 863 KB generated concatenation created by `generate_codebase.js`. It reflects the source modifications introduced in commit `782a163` (`refactor(ai): restructure AI investigation agent into 4-stage pipeline with claim tiers`). Per Safety Rule Phase 0A-3, this local file is recorded and preserved.

---

## 4. Baseline Verification Checks & Results

### 4.1 Server Type-Check (`server/`)
- **Command:** `npx tsc --noEmit`
- **Result:** **PASS (Exit code 0)**
- **Diagnostic Output:** Clean, zero diagnostics.

### 4.2 Client Type-Check (`client/`)
- **Command:** `npx tsc --noEmit`
- **Result:** **PASS (Exit code 0)**
- **Diagnostic Output:** Clean, zero diagnostics.

### 4.3 Data Connectors & Simulation Verification Suite (`server/src/tests/connectors.test.ts`)
- **Command:** `npm run test:connectors` (`tsx src/tests/connectors.test.ts`)
- **Result:** **PASS (11/11 tests passed)**
  1. Successful Ingestion & Normalization: PASS
  2. Malformed Response Handling (Resilience): PASS
  3. Provider Timeout & Circuit Breaker: PASS
  4. Rate Limit 429 Protection: PASS
  5. Missing Coordinates Rejection: PASS
  6. Invalid Coordinate Validation (Boundary Bounds): PASS
  7. Duplicate Observation Idempotency: PASS
  8. Out-of-Order Event Temporal Preservation: PASS
  9. Stale Data Detection: PASS
  10. Event Detection Triggers (Rain & Thresholds): PASS
  11. Simulation Mode State Isolation (Zero Live Contamination): PASS

### 4.4 World Model Geometry & Pure Confidence Logic Suite (`server/src/tests/world_model_logic.test.ts`)
- **Command:** `npx tsx src/tests/world_model_logic.test.ts`
- **Result:** **PASS (13/13 tests passed)**
  - Suite 1 (Geometric Math Verification): 2/2 PASSED
  - Suite 2 (Spatial Corridor Ingestion Rules): 6/6 PASSED
  - Suite 3 (Pure Confidence Decay Math): 5/5 PASSED

### 4.5 Production Bundle Compilation
- **Client Build:** `npm run build` in `client/` -> Vite production bundle generated (`dist/index.html` 1.40 kB, `dist/assets/index-DvYl_t60.js` 1,118 kB, `dist/assets/index-CRyk000X.css` 60.14 kB).
- **Server Build:** `npm run build` in `server/` -> TypeScript compiler generated JavaScript in `dist/`.

---

## 5. Live Database Inventory at Baseline

Inspection performed on `server/data/aegis_intel.db` (read-only SQLite inspection):

| Table Name | Record Count | Description & Provenance |
|---|---|---|
| `entities` | 0 | Canonical entity registry (Currently clean of seed records) |
| `relationships` | 0 | Canonical entity graph edges (Currently clean of seed records) |
| `locations` | 3 | User-imported customer transit hubs (`Apex Global Logistics`, `Zenith Freight`, `Orion Supply`) |
| `events` | 0 | Operational events ledger |
| `anomalies` | 0 | Deterministic anomaly detections |
| `merge_candidates` | 0 | Entity deduplication merge candidates |
| `investigations` | 0 | Analyst investigation dossiers |
| `datasets` | 0 | Ingested file datasets |
| `raw_records` | 0 | Raw tabular rows from dataset uploads |
| `data_sources` | 0 | Registered external database connectors |
| `source_records` | 0 | Extracted source records |
| `entity_source_links` | 0 | Cross-source provenance links |
| `moving_entities` | 84 | Maritime vessels (Previous replay engine run: 22 seed + 62 convergence fleet) |
| `entity_positions` | 126,074 | Cumulative historical position fixes from AIS ticks |
| `maritime_patterns` | 1 | Malacca Strait traffic concentration record (`PAT_CORRIDOR_MALACCA`) |
| `raw_observations` | 18 | Raw connector payloads from historical `/providers/sync-all` runs |
| `world_observations` | 144 | Normalized sensor fixes from connectors |
| `world_entities` | 142 | Resolved physical infrastructure entities |
| `world_relationships` | 19 | Geospatial / infrastructure relationships |
| `world_events` | 123 | Real-world alerts (weather, earthquake, transit, etc.) |
| `temporal_state_history` | 103 | State progression deltas |
| `simulations` | 17 | What-If sandbox scenarios |
| `simulation_entity_overrides` | 0 | Isolated parameter overrides |
| `ai_chat_messages` | 32 | Historical AI analyst chat log |

---

## 6. Known Baseline Limitations & Constraints

1. **AISStream Key & Free Tier:** `server/.env` contains `AISSTREAM_API_KEY`. Node.js 22/24 `globalThis.WebSocket` sends `Blob` message instances; legacy `AisStreamProvider` was string-dependent and did not decode binary Blobs.
2. **Provider Registry Silent Fallbacks:** 6 providers in `server/src/connectors/providers/` (`GTFSRealtimeProvider`, `PublicWaterLevelProvider`, `GBFSProvider`, `NationalGridEnergyProvider`, `DataGovInProvider`, `PublicFeedProvider`) return hardcoded synthetic payloads when external feeds or API keys are absent.
3. **Seed Reload Endpoint:** `server/src/routes/ingestion.routes.ts` exposes `POST /api/ingestion/demo/reload` which triggers `seedDatabase(true)`, capable of wiping relationships and inserting 1,217 lines of static demo data.
4. **Safety Protocol:** Zero destructive queries will be executed against `aegis_intel.db` or `server/data/sources/` without explicit isolation safeguards.
