# Revana Technologies — Phase 1 Remaining Work & Risk Register
**Document ID:** `AUDIT-PHASE1-REMAINING-WORK`  
**Phase:** 1 (Foundation Hardening & Purge)  
**Status:** READY FOR PHASE 2  
**Date:** 2026-10-16  

---

## 1. Remaining Findings & Technical Debt

| Item | Component | Current State | Risk Level | Target Phase |
| :--- | :--- | :--- | :--- | :--- |
| **Unconfigured External Telemetry Endpoints** | Connectors (Transit, Water, Mobility, Energy, Gov Mandi, GDACS) | Connectors fail closed safely with empty observations. Live URLs and API keys not configured. | **LOW** (Safe: fails closed) | **Phase 2** |
| **AIS Stream Regional Bounding Box** | Maritime (`aisStreamProvider.ts`) | Active stream successfully filters to Indian Ocean & regional chokepoints (`AIS_BBOX_*`). Currently single-connection. | **LOW** (Operational) | **Phase 2** |
| **Frontend Map Empty States** | Client UI (`TacticalMap.tsx`) | Displays genuine live vessels; sub-threshold surge banners removed. Empty states for unconfigured layers should show clear status pills. | **LOW** (UX Enhancement) | **Phase 2** |
| **Synthetic Seed Fixtures Location** | `server/src/db/seedData.ts` | Guarded by `NODE_ENV === 'production'` security check. Dataset remains in `server/src/db/` for local benchmarking. | **LOW** (Isolated) | **Phase 2** |

---

## 2. Operational Prerequisites for Phase 2

Before enabling real-time production feeds in Phase 2, the following credentials and endpoint configurations must be provisioned:

1. **GTFS-RT Feed:**
   - Procure or configure authentic BMTC/KSRTC GTFS-RT feed URL (`GTFS_FEED_URL`) with protobuf parsing.
2. **Water Telemetry:**
   - Provision Central Water Commission / KSNDMC telemetry API endpoint and authentication token (`WATER_GAUGE_URL`).
3. **GBFS Mobility:**
   - Configure active municipal bike-share or e-scooter GBFS 2.3 `station_status.json` endpoint (`GBFS_FEED_URL`).
4. **Energy Grid Telemetry:**
   - Configure Southern Regional Load Despatch Centre (SRLDC) / KPTCL telemetry URL (`GRID_TELEMETRY_URL`).
5. **Government Open Data Mandi Feed:**
   - Register for an authentic API key on `data.gov.in` and set `DATA_GOV_API_KEY`.
6. **Civic Alerting:**
   - Set `CIVIC_ALERTS_FEED_URL` with an active disaster advisory RSS/JSON feed.

---

## 3. Rollback Instructions

Should any unforeseen operational dependency require reverting to the pre-Phase 1 state:
1. Stop running server instances: `npm run dev`.
2. Locate the confirmed verified pre-purge database backup:
   `server/data/aegis_intel.phase0_backup_2026-10-15T18-28-23-918Z.db`
3. Copy the backup over `aegis_intel.db`:
   ```bash
   cp server/data/aegis_intel.phase0_backup_2026-10-15T18-28-23-918Z.db server/data/aegis_intel.db
   ```
4. Git rollback commit if necessary:
   ```bash
   git revert HEAD
   ```
