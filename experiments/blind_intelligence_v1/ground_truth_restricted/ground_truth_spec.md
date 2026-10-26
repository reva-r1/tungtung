# REVANA BLIND BENCHMARK — GROUND TRUTH SPECIFICATION (RESTRICTED)
## Package B — Sealed Answer Key & Scoring Manifest

> **CONFIDENTIAL EVALUATOR PACKAGE**
> This directory and file must remain strictly isolated outside Revana runtime paths, indices, crawlers, and LLM context windows.
> Do NOT copy or expose this file to `server/src/`, `server/data/`, `test_samples/`, or user prompts.

---

## 1. Benchmark Test Cases Manifest

### Case 01: Cross-Source Entity Resolution (Spelling & Alias Discrepancy)
* **Category:** Identity Resolution
* **Planted Ground Truth:** 
  * Canonical Entity: `Julian Vance Thorne` (Person / Senior Procurement Officer)
  * Record 1 (`01_vendor_corporate_registry.csv`): Listed as Director under name `"Julian V. Thorne"` with Driver License `DL-99420-NY` and phone `+1-555-019-4821`.
  * Record 2 (`02_municipal_procurement_contracts.csv`): Procurement reviewer listed as `"J. Vance Thorne"` approving tender `TND-7710`.
  * Record 3 (`05_dispatch_call_logs.csv`): Call participant listed as `"Julian Thorne"` using phone `+1-555-019-4821`.
* **Expected Outcome:** Revana must resolve `"Julian V. Thorne"`, `"J. Vance Thorne"`, and `"Julian Thorne"` into a single canonical entity node without creating fragmented duplicates.
* **Supporting Citations:** `01_vendor_corporate_registry.csv:Row 4`, `02_municipal_procurement_contracts.csv:Row 12`, `05_dispatch_call_logs.csv:Row 18`.

---

### Case 02: Multi-Hop Relationship Discovery (Undisclosed Beneficial Ownership & Bidder Link)
* **Category:** Multi-Hop Discovery
* **Planted Ground Truth:**
  * Node A: `Marcus Vance` (Deputy Director of Transit Infrastructure)
  * Node B: `Apex Horizon Properties LLC` (Corporate shell)
  * Node C: `Ironclad Material Supplies Inc` (Subcontractor)
  * Node D: `Valcourt Infrastructure Group` (Prime Contractor on Contract `CTR-2026-881`)
  * Hop Chain: `Marcus Vance` [OWNS / 100% UBO] -> `Apex Horizon Properties LLC` [OWNS / 45% Stake] -> `Ironclad Material Supplies Inc` [SUB-SUPPLIER TO] -> `Valcourt Infrastructure Group`.
* **Expected Outcome:** Discover that Deputy Director Marcus Vance has an undisclosed financial interest in prime contractor Valcourt Infrastructure Group via a 3-hop corporate ownership chain.
* **Supporting Citations:** `01_vendor_corporate_registry.csv:Row 9`, `01_vendor_corporate_registry.csv:Row 22`, `02_municipal_procurement_contracts.csv:Row 5`, `06_regulatory_field_inspections.txt:Memo 3`.

---

### Case 03: Complex Multi-Table Kickback Triangle (>= 3 Independent Datasets)
* **Category:** Cross-Source Synthesis
* **Planted Ground Truth:**
  * Step 1 (`02_municipal_procurement_contracts.csv`): Contract `CTR-2026-881` ($4.2M) awarded to `Valcourt Infrastructure Group`.
  * Step 2 (`03_escrow_financial_wire_transfers.csv`): On 2026-09-14, Valcourt transfers $320,000 to intermediary shell `Zephyr Logistics Ltd` (Ref: `SUB-CONSULT-4401`).
  * Step 3 (`03_escrow_financial_wire_transfers.csv`): On 2026-09-16, Zephyr Logistics transfers $175,000 offshore to account `ER-440912` belonging to `Elena Rostova` (Procurement Committee Reviewer).
  * Step 4 (`05_dispatch_call_logs.csv`): Coinciding phone calls on 2026-09-15 between Valcourt CEO `Victor Vance` and `Elena Rostova`.
* **Expected Outcome:** Identify the triangular financial kickback routing from Valcourt -> Zephyr Logistics -> Elena Rostova coinciding with contract award `CTR-2026-881`.
* **Supporting Citations:** `02_municipal_procurement_contracts.csv:Row 5`, `03_escrow_financial_wire_transfers.csv:Row 14`, `03_escrow_financial_wire_transfers.csv:Row 19`, `05_dispatch_call_logs.csv:Row 31`.

---

### Case 04: Timeline Reconstruction (Tampered Concrete Pour Before Official Permit)
* **Category:** Temporal Forensics
* **Planted Ground Truth:**
  * Site Gate Telemetry (`04_site_access_fleet_telemetry.csv`): Aggregate concrete transit mixer trucks (`TRK-8812`, `TRK-8814`) entered `North Tunnel Berth 4` and performed gross discharge pours on **2026-09-12 04:30 UTC** and **2026-09-13 02:15 UTC**.
  * Official Municipal Records (`02_municipal_procurement_contracts.csv` & `06_regulatory_field_inspections.txt`): Geotechnical Permit `GEO-PERMIT-401` was only authorized on **2026-09-19 10:00 UTC**.
* **Expected Outcome:** Establish that foundation pouring occurred 6 days prior to geotechnical permit issuance.
* **Supporting Citations:** `04_site_access_fleet_telemetry.csv:Rows 8-11`, `02_municipal_procurement_contracts.csv:Row 18`, `06_regulatory_field_inspections.txt:Memo 6`.

---

### Case 05: Conflicting Evidence (Delivery Location Dispute)
* **Category:** Contradiction Resolution
* **Planted Ground Truth:**
  * Formal Invoice Record (`02_municipal_procurement_contracts.csv`): Vendor invoice claims 80 MT of high-tensile rebar steel was delivered to municipal facility `Central Rail Depot Alpha` on 2026-09-22.
  * Physical Gate Sensor Telemetry (`04_site_access_fleet_telemetry.csv`): Hauler truck `TRK-9002` carrying the declared consignment was scanned and logged entering private off-grid facility `Warehouse Omega` (18 km away) at that exact timestamp, with zero arrival recorded at Depot Alpha.
* **Expected Outcome:** Flag the direct contradiction between formal invoice billing and physical sensor telemetry. Must NOT reconcile them as agreeing.
* **Supporting Citations:** `02_municipal_procurement_contracts.csv:Row 29`, `04_site_access_fleet_telemetry.csv:Row 44`.

---

### Case 06: Similar Names That Must NOT Be Merged (Disambiguation)
* **Category:** Negative Identity Resolution
* **Planted Ground Truth:**
  * Entity 1: `David Miller` (Senior Municipal Safety Inspector, Badge `ENG-404`, Tax ID `TAX-90412`, clean operational history).
  * Entity 2: `David A. Miller` (Managing Director of delinquent subcontractor `Miller Heavy Transport`, Tax ID `TAX-11894`, subject of regulatory stop-work order).
* **Expected Outcome:** System must keep both individuals as distinct nodes. Merging them into a single entity is a severe false-positive merge failure.
* **Supporting Citations:** `01_vendor_corporate_registry.csv:Row 15`, `01_vendor_corporate_registry.csv:Row 34`, `06_regulatory_field_inspections.txt:Memo 2`.

---

### Case 07: Apparent Relationship That Must Be Rejected (Decoy Pattern)
* **Category:** Decoy / False Lead Rejection
* **Planted Ground Truth:**
  * Decoy Pattern: `Solomon Crane Hire` received a $45,000 wire transfer from `Zephyr Logistics Ltd` (the intermediary in Case 3) 2 days before the kickback wire.
  * Verified Reality: The transfer memo explicitly references `EQUIP-LEASE-INV-1094` for standard 200-ton mobile crane hire at `Subway Portal South`. Gate logs confirm the crane was delivered and operated on-site by certified union operator `Samuel O'Connor`.
* **Expected Outcome:** Conclude that the transaction between Zephyr Logistics and Solomon Crane Hire is legitimate commercial equipment rental and reject any bribery or shell-company collusion hypothesis regarding Solomon Crane Hire.
* **Supporting Citations:** `03_escrow_financial_wire_transfers.csv:Row 11`, `04_site_access_fleet_telemetry.csv:Row 25`, `06_regulatory_field_inspections.txt:Memo 8`.

---

### Case 08: Insufficient Evidence Case (Suspicious Timing but Incomplete Proof)
* **Category:** Epistemic Calibration
* **Planted Ground Truth:**
  * Observation: A late-night phone call occurred between Contractor Representative `Arthur Pendelton` and City Council Member `Claire Dunmore` at 23:42 on 2026-09-08, 6 hours before emergency vote on zoning variance `VAR-2026-09`.
  * Context: Call duration in `05_dispatch_call_logs.csv` was 6 seconds (unanswered / dropped). No subsequent calls, no financial transfers, and no mutual meetings are documented.
* **Expected Outcome:** State clearly that **evidence is insufficient** to prove coordination or collusion. Must not assert that corruption or lobbying occurred.
* **Supporting Citations:** `05_dispatch_call_logs.csv:Row 7`, `02_municipal_procurement_contracts.csv:Row 3`.

---

### Case 09: Missing Record / Incomplete Timeline Case
* **Category:** Gap Detection
* **Planted Ground Truth:**
  * Dispatch manifests from `Quarry Site Bravo` record a convoy of 4 heavy dump trucks (`TRK-701`, `TRK-702`, `TRK-703`, `TRK-704`) dispatched at 08:00 on 2026-09-15 with structural grade aggregate for `Subway Extension Pier 9`.
  * Gate entry telemetry at Pier 9 logs arrivals of `TRK-701`, `TRK-702`, and `TRK-704` between 09:15 and 09:40.
  * Truck `TRK-703` has no arrival log and no return dispatch.
* **Expected Outcome:** Identify the specific telemetry gap: truck `TRK-703` departed Quarry Site Bravo but is missing from site arrival records.
* **Supporting Citations:** `04_site_access_fleet_telemetry.csv:Rows 51-54`, `04_site_access_fleet_telemetry.csv:Rows 60-62`.

---

### Case 10: Attribute-Combination Identity Discovery (No Exact Name Match)
* **Category:** Unnamed Entity Resolution
* **Planted Ground Truth:**
  * In `02_municipal_procurement_contracts.csv`, an anonymous subcontractor on Contract `CTR-2026-702` is identified solely as `"Entity Reg #9941-K"`.
  * In `01_vendor_corporate_registry.csv`, `Kestrel Urban Works Ltd` lists registration code `REG-9941-K`, corporate phone `+1-555-019-8821`, and registered agent address `Suite 400, 120 Harborview Blvd`.
* **Expected Outcome:** Resolve `"Entity Reg #9941-K"` to `Kestrel Urban Works Ltd` through matching registration code and shared address/phone attributes despite the missing name field.
* **Supporting Citations:** `02_municipal_procurement_contracts.csv:Row 38`, `01_vendor_corporate_registry.csv:Row 18`.

---

### Case 11: Entity With Role / Affiliation Evolution
* **Category:** Longitudinal Trajectory
* **Planted Ground Truth:**
  * `Cassandra Vance` was employed as Municipal Safety Engineer at `City Building Compliance Bureau` from 2024-01-15 until resignation on 2026-01-30 (`06_regulatory_field_inspections.txt:Memo 1`).
  * On 2026-03-01, she is registered as Chief Operating Officer of commercial contractor `Orion Aggregate Partners` (`01_vendor_corporate_registry.csv:Row 27`).
* **Expected Outcome:** Trace the career transition from public safety inspector to executive at a regulated private vendor.
* **Supporting Citations:** `06_regulatory_field_inspections.txt:Memo 1`, `01_vendor_corporate_registry.csv:Row 27`.

---

### Case 12: True Negative / Isolated Control Entity
* **Category:** Clean Control Verification
* **Planted Ground Truth:**
  * `Veridian Environmental Testing Labs` (Water and Soil Testing Vendor)
  * Clean regular contracts (`CTR-2026-104`), standard municipal rate disbursements, clean director disclosures, no offshore wires, zero phone calls with shell entities, no abnormal gate deviations.
* **Expected Outcome:** Return a clean verification with zero illicit ties or anomalous flags.
* **Supporting Citations:** `01_vendor_corporate_registry.csv:Row 41`, `02_municipal_procurement_contracts.csv:Row 2`, `03_escrow_financial_wire_transfers.csv:Row 8`.

---

## 2. Evaluation Metric Formulations

1. **Entity Resolution Precision, Recall, F1:**
   $$\text{Precision}_{ER} = \frac{\text{Correct Merges}}{\text{Total Merges Proposed}}, \quad \text{Recall}_{ER} = \frac{\text{Correct Merges}}{\text{True Ground Truth Merges}}$$
2. **Relationship Discovery Precision, Recall, F1:**
   $$\text{Precision}_{Rel} = \frac{\text{Verified Ground Truth Edges Discovered}}{\text{Total Edges Discovered}}, \quad \text{Recall}_{Rel} = \frac{\text{Verified Ground Truth Edges Discovered}}{\text{True Planted Edges}}$$
3. **Multi-Hop Traversal Accuracy:**
   $$\text{Pass Rate}_{\text{Multi-Hop}} = \frac{\text{Cases with complete, unbroken valid multi-hop path}}{\text{Total Multi-Hop Cases (Cases 2, 3)}}$$
4. **Epistemic Calibration Score:**
   - Case 7 (Decoy) correctly rejected: +10 pts
   - Case 8 (Insufficient evidence) correctly labeled insufficient: +10 pts
   - Case 5 (Contradiction) correctly flagged as contradictory: +10 pts
   - Unsupported / Hallucinated claims penalty: -5 pts per hallucinated claim
