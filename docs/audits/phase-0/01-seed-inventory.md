# REVANA TECHNOLOGIES — COMPLETE SEED, MOCK & SYNTHETIC DATA INVENTORY
**Phase 0B Deliverable — Exhaustive Repository Data Source Audit**
**Date:** 2026-10-15  
**Auditor:** Principal Software Architect & Production-Readiness Auditor  

---

## Executive Summary

This inventory catalogues **every instance of synthetic, simulated, mock, hardcoded demonstration, and fake data** discovered across the Revana Technologies repository. Each item has been analyzed for its definition point, data structure, schema compliance, generation mechanism, and potential for production contamination.

The inventory is divided into 7 distinct categories:
1. **Core Database Benchmark Seed (`seedData.ts`)**
2. **Independent Synthetic Source Databases (`sourceDatabases.ts`)**
3. **Simulated Maritime AIS Replay Feed & Anomaly (`aisRealReplayProvider.ts`)**
4. **Mock Data Connector (`MockDataProvider.ts`)**
5. **Silent Synthetic Fallbacks in Production Data Connectors (`connectors/providers/`)**
6. **Integration Verification Fixtures (`verify_multi_database.ts`, test suites)**
7. **Client UI Hardcoded Identifiers & Fallback Badges**

---

## Category 1: Core Database Benchmark Seed (`seedData.ts`)

- **File Path:** `server/src/db/seedData.ts`
- **Total Lines:** 1,217 lines
- **Entry Method:** `seedDatabase(force: boolean = false)`
- **Format Tag:** `'SYNTHETIC'`
- **Dataset ID:** `DS-SYNTHETIC-LOGISTICS-2026`

### Detailed Breakdown of Hardcoded Entities & Tables Seeded:

| Data Type / Table | Count | Key Identifiers / Records Seeded |
|---|---|---|
| **Locations** (`locations`) | 6 | `LOC-BLR-WFD` (Whitefield ICD Hub), `LOC-BLR-PEE` (Peenya Industrial Yard), `LOC-BLR-ECITY` (Electronic City Freight Gate), `LOC-CHK-HOSUR` (Hosur Interstate Border Checkpoint), `LOC-KRI-UNMON` (Krishnagiri Industrial Transit Yard), `LOC-CHK-VEL` (Vellore Highway Toll) |
| **Companies** (`entities`) | 10 | `COMP-KSWC-01` (Karnataka State Warehousing Corp), `COMP-BEL-02` (Bharath Electronics Logistics), `COMP-SCL-03` (South Central Logistics), `COMP-APX-04` (Apex Global Logistics), `COMP-GLD-05` (Golden Freight Carriers), `COMP-HRZ-06` (Horizon Logistics), `COMP-RYL-07` (Royal Logistics Solutions), `COMP-TIC-08` (Trans-India Carrier), `COMP-QL-09` (QuickLogistics), `COMP-BD-10` (BlueDart South) |
| **Vehicles** (`entities`) | 8 | `VEH-KA-01-AB-1234` (Tata Prima Container), `VEH-KA-04-XY-9876` (Ashok Leyland Multi-Axle), `VEH-KA-51-MM-4455` (BharatBenz Heavy Hauler), `VEH-TN-23-ZZ-8899` (Eicher Pro Cargo), `VEH-KA-03-CD-5678` (Mahindra Blazo), `VEH-TN-09-QQ-1122` (Tata Signa), `VEH-KA-19-EE-7766` (Ashok Leyland 2820), `VEH-TN-04-WW-3344` (BharatBenz 3528C) |
| **Drivers** (`entities`) | 4 | `DRV-RAMESH-01` (Ramesh Kumar), `DRV-SURESH-02` (Suresh Gowda), `DRV-VIJAY-03` (Vijay Nair), `DRV-MANJUNATH-04` (Manjunath Swamy) |
| **Officers** (`entities`) | 2 | `OFF-SHARMA-01` (Inspector Rajesh Sharma), `OFF-ANAND-02` (Officer Anand Rao) |
| **Warehouses & Facilities** (`entities`) | 4 | `FAC-WFD-WH1` (Whitefield Central CFS), `FAC-PEE-WH2` (Peenya Heavy Depot), `FAC-KRI-YARD` (Krishnagiri Unmonitored Storage), `FAC-VEL-YARD` (Vellore Staging Ground) |
| **Toll Plazas** (`entities`) | 2 | `TOLL-HOSUR-01` (NH44 Hosur Interstate Toll Gate), `TOLL-VEL-02` (NH48 Vellore Highway Toll Plaza) |
| **Relationships** (`relationships`) | 28 | Types: `OWNS`, `EMPLOYS`, `OPERATES_FROM`, `TRANSITED_THROUGH`, `DELIVERED_TO`, `ASSOCIATED_WITH`, `SHAREHOLDER_OF`. Connects vehicles to companies, drivers to vehicles, and trips to checkpoints. |
| **Raw Records** (`raw_records`) | 28 | Synthetic JSON representations mimicking logistics dispatch slips and toll logs. |
| **Datasets** (`datasets`) | 1 | `DS-SYNTHETIC-LOGISTICS-2026` ("Karnataka-South Transit Intelligence Benchmark Dataset"). |
| **Events** (`events`) | 6 | `EVT-2026-001` (Weighbridge discrepancy +3.8T), `EVT-2026-002` (Toll Plaza FastTag bypass), `EVT-2026-003` (Unauthorized cargo transfer at Krishnagiri), `EVT-2026-004` (Overloading violation), `EVT-2026-005` (Tampered GPS transponder detected), `EVT-2026-006` (Off-route corridor diversion). |
| **Anomalies** (`anomalies`) | 5 | `ANM-CIRC-01` (Circular Ownership & Entity Ring), `ANM-ROUTE-02` (Physical Speed/Teleportation Impossibility), `ANM-WT-03` (Gross Weight Discrepancy), `ANM-UNMON-04` (Unmonitored Night Transit Clustering), `ANM-TAX-05` (Cross-Border Invoice Arbitrage). |
| **Merge Candidates** (`merge_candidates`) | 2 | `MC-001` (`COMP-APX-04` vs `COMP-APX-04-VAR` "Apex Logistics"), `MC-002` (`VEH-KA-01-AB-1234` vs `VEH-KA-01-AB-1234-DUP`). |
| **Investigations** (`investigations`) | 3 | `INV-2026-001` ("Operation Falcon: Cross-Border Evasion Ring"), `INV-2026-002` ("Krishnagiri Transit Diversion"), `INV-2026-003` ("FastTag Impersonation Network"). |

---

## Category 2: Independent Synthetic Source Databases (`sourceDatabases.ts`)

- **File Path:** `server/src/db/sourceDatabases.ts`
- **Output Directory:** `server/data/sources/`
- **Files Created:**
  1. `server/data/sources/logistics.db`
  2. `server/data/sources/company_registry.db`
  3. `server/data/sources/facilities.db`
  4. `server/data/sources/transactions.db`
- **Entry Method:** `initSourceDatabases(forceRecreate: boolean = false)`

### Table-by-Table Content:

1. **`logistics.db`**
   - `shipments` (3 rows): `SHP-001` (Electronics, ₹85L), `SHP-002` (Auto Components, ₹42L), `SHP-003` (Industrial Machinery, ₹1.2Cr).
   - `vehicles` (3 rows): `KA01AB1234`, `KA04XY9876`, `TN23ZZ8899`.
   - `drivers` (3 rows): `Ramesh Kumar`, `Suresh Gowda`, `Vijay Nair`.
   - `routes` (2 rows): Bangalore to Chennai via NH48, Bangalore to Hosur via NH44.

2. **`company_registry.db`**
   - `companies` (3 rows): `Karnataka State Warehousing Corp` (CIN: U63022KA1957SGC000001), `Bharath Electronics Logistics`, `South Central Logistics`.
   - `directors` (3 rows): `Ravi Kumar`, `Anil Hegde`, `Lakshmi Narayanan`.
   - `registrations` (3 rows): Corporate filing certificates.
   - `addresses` (2 rows): Registered offices in Bangalore and Chennai.

3. **`facilities.db`**
   - `warehouses` (3 rows): `W45` (Whitefield ICD), `W12` (Peenya Yard), `W89` (Krishnagiri Transit).
   - `locations` (3 rows): Geographic coordinates corresponding to warehouse entries.
   - `checkpoints` (2 rows): `CP-HOSUR-01`, `CP-VELLORE-02`.
   - `location_events` (4 rows): Telemetry entries for vehicle scans.

4. **`transactions.db`**
   - `transactions` (3 rows): `T991` (₹12,50,000 to ABC Logistics), `T992` (₹4,20,000), `T993` (₹18,00,000).
   - `accounts` (3 rows): Banking accounts linked to logistics entities.
   - `company_references` (2 rows): Cross-referencing entity numbers.
   - `payment_records` (2 rows): Settled invoices.

---

## Category 3: Simulated Maritime AIS Replay Feed & Anomaly (`aisRealReplayProvider.ts`)

- **File Path:** `server/src/services/maritime/providers/aisRealReplayProvider.ts`
- **Class Name:** `AisRealReplayProvider implements AisProvider`
- **Mode Reported:** `'REPLAY_FEED'`
- **Target Table:** `moving_entities`, `entity_positions`, `maritime_patterns`

### Fabricated Data Components:

1. **`SEED_VESSELS` Constant (Lines 19–63):**
   - 22 hardcoded vessels across 4 corridors:
     - Corridor 1 (Mumbai JNPT Gateway): 8 vessels (`BHARAT GAURAV`, `SWARNA KAMAL`, `MSC INES`, `OCEAN VALOR`, `CMA CGM ALASKA`, `DHARANI PIONEER`, `PACIFIC HORIZON`, `JINDAL TARA`).
     - Corridor 2 (Gulf of Khambhat / Mundra): 5 vessels (`MUNDRA VOYAGER`, `MAERSK KALAMATA`, `DESH VISHAL`, `KANDLA PRIDE`, `STAR POLARIS`).
     - Corridor 3 (Chennai Port Artery): 5 vessels (`CHENNAI EXPRESS`, `TAMIL GLORY`, `CMA CGM TITAN`, `SWARNA JAYANTI`, `BAY STAR`).
     - Corridor 5 (Colombo Hub): 4 vessels (`CEYLON BREEZE`, `SINGAPORE HIGHWAY`, `DANISH TRADER`, `LANKA PRIDE`).

2. **`generateMalaccaConvergenceFleet()` Function (Lines 69–114):**
   - Dynamically constructs **62 fake ships** along the Malacca Strait corridor.
   - Explicit comment in code: `"Intentional statistically significant traffic anomaly matching user scenario"`.
   - Fabricated MMSIs: `563100000` to `563100061`.
   - Fabricated IMOs: `9700000` to `9700061`.
   - Fabricated Names: `EVER GIVEN`, `MSC OSCAR`, `COSCO SHIPPING TAURUS`, `OOCL HONG KONG`, down to `CHRONOS VOYAGER`.
   - Baseline engineered: 41 vessels baseline vs 62 observed (+51.2% deviation).

3. **Kinematic Jitter / Dead-Reckoning Loop (Lines 138–219):**
   - `setInterval(..., 3000)` ticks every 3 seconds.
   - Picks 8–15 vessels per tick, recalculates positions with `10x accelerated` speed, adds random degree perturbation, and emits updates via callbacks to simulate live radio transmission.

4. **Synthetic Historical Trails Seeder (`maritime.service.ts` Lines 146–190):**
   - `seedInitialHistoricalTrailsIfEmpty()` queries `moving_entities` and creates 12 artificial historical positions per ship backtracking along its heading.

---

## Category 4: Mock Data Connector (`MockDataProvider.ts`)

- **File Path:** `server/src/connectors/providers/mock/MockDataProvider.ts`
- **Class Name:** `MockDataProvider extends DataProvider`
- **Registered In:** `server/src/connectors/registry/ProviderRegistry.ts` (Line 63)
- **Category:** `'MOCK'`
- **ID:** `'mock_provider'`

### Mock Payloads & Failure Modes:
- **Default Payload (Lines 74–82):**
  - `sensor_id`: `'TEST_RADAR_01'`
  - `latitude`: `12.9716`, `longitude`: `77.5946`
  - `temperature_c`: `26.5`, `precipitation_mm`: `5.0`
- **Configurable Modes:**
  - `TIMEOUT` (throws synthetic 5000ms timeout)
  - `RATE_LIMIT_429` (throws HTTP 429)
  - `MALFORMED_JSON` (returns `{{{{INVALID_JSON_STREAM%%%%`)
  - `MISSING_COORDINATES` (strips lat/lon)
  - `INVALID_COORDINATES` (lat `195.4`, lon `-240.2`)
  - `OUT_OF_ORDER` (timestamps 5 hours in past)
  - `STALE_DATA` (timestamps 72 hours in past)

---

## Category 5: Silent Synthetic Fallbacks in Data Providers (`connectors/providers/`)

The following production connector classes attempt a live fetch or environment check, but **silently fall back to hardcoded synthetic objects** if an API key, endpoint, or external variable is missing:

| Provider File | Provider ID | Trigger Condition | Fabricated Payload Generated |
|---|---|---|---|
| `transit/GTFSRealtimeProvider.ts` (Line 45) | `gtfs_transit` | `process.env.GTFS_FEED_URL` is undefined | `simulatedFeed`: 4 hardcoded Bangalore transit units (`BUS_BMTC_335E_01`, `BUS_BMTC_500D_04`, `METRO_PURPLE_TRAIN_08`, `BUS_BMTC_201_03`) with current timestamp |
| `water/PublicWaterLevelProvider.ts` (Line 42) | `water_level_gauge` | Always (endpoint is `https://cwc.example.gov/api/v1/levels`) | `simulatedGauges`: 3 hardcoded southern reservoirs (`GAUGE_KRS_DAM`, `GAUGE_KABINI_DAM`, `GAUGE_HEMAVATHI`) |
| `mobility/GBFSProvider.ts` (Line 42) | `gbfs_mobility` | Always (endpoint is `https://mobility.example.gov/gbfs/2.3/station_status`) | `simulatedData`: 4 hardcoded micromobility hubs (`STATION_MG_ROAD_METRO`, `STATION_INDIRANAGAR_100FT`, `STATION_KORAMANGALA_SONY`, `STATION_HSR_SECTOR1`) |
| `energy/NationalGridEnergyProvider.ts` (Line 41) | `national_grid_energy` | Always (endpoint is `https://grid-telemetry.example.org/api/substations`) | `simulatedGrid`: 3 major power stations (`SUBSTN_PAVAGADA_SOLAR_01`, `SUBSTN_SHARAVATHI_HYDRO`, `SUBSTN_KUDGI_THERMAL`) |
| `government/DataGovInProvider.ts` (Line 51) | `data_gov_in` | `process.env.DATA_GOV_API_KEY` is undefined | `karnatakaGovRecords`: APMC mandi commodity records (`Yeshwanthpur APMC Yard`, `Binny Mill Cotton Market`) |
| `finance/ExchangeRateProvider.ts` (Line 54) | `frankfurter_fx` | Live Frankfurter API call fails | Hardcoded static fallback currency rates (`INR: 86.85, EUR: 0.94, GBP: 0.79...`) |
| `news/PublicFeedProvider.ts` (Line 36) | `gdacs_civic_alerts` | Always (endpoint is `https://alerts.example.org/rss/civic_events.xml`) | Hardcoded emergency bulletins (`Bay of Bengal Deep Depression Advisory`, `Cauvery River Basin Inflow High Stage Notice`) |

---

## Category 6: Integration Verification Fixtures

- **`server/src/verify_multi_database.ts`:**
  - Script designed to verify cross-source resolution across the 4 synthetic source databases.
  - Line 29: Calls `initSourceDatabases(true)` to wipe and recreate the 4 SQLite files.
  - Lines 21–27: Wipes `entities`, `relationships`, `source_records`, `entity_source_links`, `data_sources` in `aegis_intel.db` before execution.
- **`server/src/tests/connectors.test.ts`:**
  - Employs `MockDataProvider` to test error handling, rate limiting, and simulation isolation.
- **`server/src/tests/world_model_logic.test.ts`:**
  - Pure unit tests verifying haversine math, corridor proximity, and confidence decay. Contains no database mutations.

---

## Category 7: Client UI Hardcoded Identifiers & Fallback Badges

- **`client/src/components/map/TacticalMap.tsx`:**
  - Line 291: Hardcoded search for `PAT_CORRIDOR_MALACCA`:
    ```tsx
    const malaccaPattern = patterns.find((p) => p.pattern_id === 'PAT_CORRIDOR_MALACCA');
    ```
  - Lines 329–339: Hardcoded banner rendering:
    ```tsx
    <span>MALACCA CHOKEPOINT: +{malaccaPattern.deviation_percent}% SURGE</span>
    ```
  - Line 301: Hardcoded zoom logic:
    ```tsx
    if (region.includes('Malacca')) { zoomToLocation(3.2, 100.5, 7); }
    ```
- **`client/src/services/api.ts`:**
  - Line 276: `reloadDemoDataset()` calling `POST /api/ingestion/demo/reload`.
- **`client/src/components/ingestion/DataIngestionView.tsx`:**
  - Line 400 & 555: Hardcoded check for `format === 'SYNTHETIC'` to render `'DEMO / SYNTHETIC'` badge.
