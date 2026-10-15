# REVANA TECHNOLOGIES — FILE-BY-FILE REMOVAL & REMEDIATION PLAN
**Phase 0F Deliverable — Safe Execution Blueprint & Production Hardening**
**Date:** 2026-10-15  
**Auditor:** Principal Software Architect & Production-Readiness Auditor  

---

## 1. Remediation Philosophy & Non-Negotiable Rules

1. **Zero Data Loss for Legitimate Assets:** Never execute blanket table truncations. The 3 user-imported locations in `locations` (`Apex Global`, `Zenith Freight`, `Orion Supply`) must be preserved.
2. **Honest Failure Over Fabricated Success:** When an external data provider lacks an API key or endpoint, it must fail honestly (`UNCONFIGURED` or `FAILED`), never manufacture synthetic telemetry.
3. **Auditability & Reversibility:** Every modification must be granular, covered by unit/integration tests, and tracked with git commits.
4. **Phased Execution:** Only safe, unambiguous removals are executed during Phase 0; ambiguous items are flagged for human review.

---

## 2. File-by-File Remediation Matrix

### Phase 0 Immediate Remediations (Safe & Unambiguous)

| Target File | Component / Line | Exact Modification | Rationale / Verification |
|---|---|---|---|
| `server/src/connectors/registry/ProviderRegistry.ts` | Line 17 & Line 63 | Remove `import { MockDataProvider }` and `this.register(new MockDataProvider());` from `registerDefaults()`. | **Zero Risk.** `connectors.test.ts` instantiates `MockDataProvider` directly. Prevents test sensor from polluting production `/providers/status` and `/providers/sync-all`. |
| `server/src/services/maritime/providers/aisRealReplayProvider.ts` | Lines 54, 69–114 | 1. Remove `generateMalaccaConvergenceFleet()` and its comment entirely.<br>2. Remove `...generateMalaccaConvergenceFleet()` from `SEED_VESSELS`. | Eliminates the pre-scripted 62-ship Malacca surge anomaly. Replay feed (if demo mode enabled) contains only standard baseline vessels. |
| `client/src/components/map/TacticalMap.tsx` | Lines 290–292, 328–339 | Replace hardcoded `patterns.find(p => p.pattern_id === 'PAT_CORRIDOR_MALACCA')` with dynamic `activeSurgePattern = patterns.find(p => p.deviation_percent >= 30)`. | Prevents client from displaying a hardcoded "MALACCA CHOKEPOINT: +51.2% SURGE" banner unless an active surge pattern actually exists in currently loaded data. |
| `server/src/routes/ingestion.routes.ts` | Lines 129–136 | Guard `POST /api/ingestion/demo/reload`: require `process.env.REVANA_DEMO_MODE === 'true'`. Return 403 Forbidden in production mode. | Prevents accidental or unauthorized execution of destructive table wipe in production. |
| `server/src/services/maritime/patternDetector.service.ts` | Lines 86–88 | When a corridor vessel count drops below threshold, execute `DELETE FROM maritime_patterns WHERE pattern_id = ?`. | Ensures stale anomaly alerts are actively purged when traffic normalizes. |

---

### Phase 1 Remediations (Connector De-Simulation — Requires Human Review)

The following connectors contain silent synthetic fallbacks. Each must be refactored to fail cleanly when unconfigured:

| Provider File | Current Silent Fallback | Target Clean Behavior | Risk / Review Note |
|---|---|---|---|
| `transit/GTFSRealtimeProvider.ts` | Lines 45–93: Returns `simulatedFeed` when `GTFS_FEED_URL` not set. | If `!process.env.GTFS_FEED_URL`, record `UNCONFIGURED` and return `{ rawData: null, latencyMs: 0 }`. | **REQUIRES HUMAN REVIEW:** Confirm if local developers require simulated buses when developing transit UI. If so, isolate behind `REVANA_DEMO_MODE=true`. |
| `water/PublicWaterLevelProvider.ts` | Lines 42–87: Returns `simulatedGauges` for dummy example.gov URL. | If endpoint is unconfigured or dummy, record failure and return `{ rawData: null }`. | **REQUIRES HUMAN REVIEW:** Identify real government hydrological API (e.g., India WRIS or USGS Water Services). |
| `mobility/GBFSProvider.ts` | Lines 42–86: Returns `simulatedData` for dummy example.gov URL. | If endpoint is dummy, return `UNCONFIGURED`. | **REQUIRES HUMAN REVIEW:** Wire to authentic GBFS endpoint (e.g., Yulu open feed or city-specific micromobility GBFS). |
| `energy/NationalGridEnergyProvider.ts` | Lines 41–78: Returns `simulatedGrid`. | If endpoint is dummy, return `UNCONFIGURED`. | **REQUIRES HUMAN REVIEW:** Wire to real power grid telemetry (e.g., UK National Grid ESO or POSOCO India). |
| `government/DataGovInProvider.ts` | Lines 51–75: Returns `karnatakaGovRecords` when `DATA_GOV_API_KEY` not set. | If `!apiKey`, throw error `DATA_GOV_API_KEY required for Open Government Data ingestion`. | Safe to remove fallback; real API integration exists at lines 41–44. |
| `news/PublicFeedProvider.ts` | Lines 36–65: Returns hardcoded cyclone/flood advisory. | Wire to authentic GDACS RSS feed (`https://www.gdacs.org/xml/rss.xml`) using XML parser. | Safe to replace dummy endpoint with genuine live GDACS RSS feed. |
| `finance/ExchangeRateProvider.ts` | Lines 54–61: Static currency rates fallback when offline. | If offline, report error and return cached rates or mark stale; do not present static rates as live. | Safe to remove static fallback. |

---

## 3. Database Remediation & Sanitization Protocol

### 3.1 What Must Be Kept:
- `locations` rows with IDs `LOC-ENT-CUST-*` (User-uploaded operational hubs).
- `world_observations` and `world_entities` from authentic providers (`open_meteo_weather`, `open_meteo_air_quality`, `open_meteo_marine`, `usgs_earthquake`, `nasa_eonet`, `opensky_network`, `osm_nominatim`).
- `simulations` table (Isolated what-if scenarios).

### 3.2 What Can Be Selectively Sanitized:
- `DELETE FROM moving_entities WHERE properties LIKE '%Replay%'`: Removes historical fake vessels seeded during previous unconfigured runs.
- `DELETE FROM entity_positions WHERE entity_id NOT IN (SELECT id FROM moving_entities)`: Cleans orphaned trail points.
- `DELETE FROM maritime_patterns WHERE pattern_id = 'PAT_CORRIDOR_MALACCA'`: Removes the pre-scripted 62-ship anomaly.
- `DELETE FROM raw_observations WHERE provider = 'mock_provider'`: Removes mock test records from operational audit logs.

---

## 4. Verification & Reversibility Strategy

1. **Pre-Remediation Check:** Run `npm run test:connectors` and `npx tsx src/tests/world_model_logic.test.ts`.
2. **Atomic Execution:** Apply Phase 0 immediate removals.
3. **Post-Remediation Verification:**
   - Type-check: `cd server && npx tsc --noEmit`
   - Client type-check: `cd client && npx tsc --noEmit`
   - Test execution: `cd server && npm run test:connectors`
   - Verification that `mock_provider` is not in `/providers/status`.
4. **Git Checkpoint:** One concise commit with complete audit trail.
