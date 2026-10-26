# REVANA TECHNOLOGIES — PRODUCTION VS. TEST & DEMO BOUNDARY AUDIT
**Phase 0E Deliverable — Architectural Boundary & Isolation Analysis**
**Date:** 2026-10-15  
**Auditor:** Principal Software Architect & Production-Readiness Auditor  

---

## 1. Executive Summary

A core failure mode in operational intelligence software is **silent boundary erosion** — where demonstration code, test fixtures, or local mock data bleed into production-capable execution paths. 

This audit evaluates Revana Technologies against strict production isolation standards:
- **Production-Capable Path:** Any code executed by `npm start`, mounted by Express routers, bundled into client production assets, or triggered during normal operational workflows.
- **Isolated Test Path:** Code strictly invoked during test runner execution (`npm test`, `tsx src/tests/*.test.ts`) that does not mutate operational persistence.
- **Explicit Demo Path:** Sandboxed demonstration modules that require explicit opt-in flags (e.g., `DEMO_MODE=true`) and prominently signal simulation across every downstream surface.

---

## 2. Boundary Classification Matrix

| Component / File | Current Classification | Intended Boundary | Contamination Hazard | Recommended Remediation |
|---|---|---|---|---|
| `MockDataProvider.ts` | **Production-Capable** (Instantiated in `ProviderRegistry.registerDefaults()`) | **Isolated Test Only** | Appears in `/providers/status` matrix and `/providers/sync-all` cycles in production. | Remove from `registerDefaults()`. Instantiate only inside unit and integration test suites. |
| `seedData.ts` | **Production-Capable** (Invokable via `POST /api/ingestion/demo/reload`) | **Explicit Demo Only** | Destructive reload wipes real operational graph and replaces with synthetic benchmark. | Guard behind `process.env.REVANA_DEMO_MODE === 'true'`. Disable endpoint in production. |
| `sourceDatabases.ts` | **Semi-Isolated** (Files on disk in `server/data/sources/`, triggered via sync endpoint) | **Explicit Demo Only** | Can pollute canonical entity registry with synthetic corporate/shipping records. | Quarantine to demo environment; do not ship pre-seeded SQLite files in production container distributions. |
| `aisRealReplayProvider.ts` | **Production-Capable** (Fallback in `maritime.service.ts`) | **Explicit Demo Only** | Silently fakes live vessel tracking if `AISSTREAM_API_KEY` is unconfigured. | Make live AISStream the strict primary; allow replay *only* if `MARITIME_DEMO_MODE=true` is explicitly set with visible amber badges. |
| Connector Silent Fallbacks (`GTFSRealtimeProvider`, `PublicWaterLevelProvider`, etc.) | **Production-Capable** (Active in default provider registry) | **Production-Capable (Failing Honestly)** | Fabricates Bangalore buses, reservoirs, and power grid alerts without real feeds. | Remove hardcoded objects. If external URL/key is missing, throw descriptive error and report `UNCONFIGURED` status. |
| `SimulationService.ts` | **Production-Capable** (Dedicated `/simulation/*` routes) | **Production-Capable (Properly Isolated)** | Modifies entities in what-if scenarios. | **ALREADY ISOLATED.** Uses `simulation_entity_overrides` and reports `mode: 'SIMULATION'` with `is_isolated: true`. Zero live database contamination. |
| `verify_multi_database.ts` | **Developer Script** (Standalone CLI tool) | **Developer / CI Only** | Destructive SQL script. | Ensure script cannot be run against production database connection strings. |

---

## 3. Deep-Dive: Silent Fallbacks vs. Production Integrity

### 3.1 The "Deceptively Convenient" Fallback Anti-Pattern
Seven data providers currently contain code of the form:
```typescript
const externalFeedUrl = process.env.GTFS_FEED_URL;
if (externalFeedUrl) {
  return await this.secureFetch(externalFeedUrl);
}
// Silently return hardcoded synthetic feed
return { rawData: simulatedFeed, latencyMs: 5 };
```

**Why This Violates Operational Intelligence Principles:**
1. **False Grounding:** The Revana AI Reasoning Engine relies on these providers to evaluate hypotheses. If an analyst investigates regional supply chain disruptions, the AI will cite fake bus routes (`BUS_BMTC_335E_01`) or fake reservoir depths as verified truth.
2. **Masked Integration Failures:** If a production feed goes down or an API credential expires, the system appears green and operational rather than alerting engineers.
3. **Audit Impossibility:** Regulated operational platforms cannot distinguish between real-world observations and code-generated fixtures.

---

## 4. Boundary Remediation Strategy

1. **Strict Production Defaults:**
   - In production (`NODE_ENV=production`), providers missing configuration must report:
     ```json
     {
       "status": "UNCONFIGURED",
       "error": "Missing mandatory environment variable: GTFS_FEED_URL"
     }
     ```
   - Zero observations shall be written to `world_observations` or `raw_observations` for unconfigured providers.

2. **Explicit Demo Isolation:**
   - Any demonstration feature (`seedData.ts`, `AisRealReplayProvider`) must require:
     - `REVANA_DEMO_MODE=true` or `MARITIME_DEMO_MODE=true`
     - Visual badge `"SIMULATED / DEMO DATA"` (amber) across all UI cards and maps.
     - Prohibition of silent auto-activation.
