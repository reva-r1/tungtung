# Operation Phantom Cargo — Cross-Source Multi-Modal Fusion Benchmark
## Revana Technologies Benchmark Specification: Fusing Static Business Data with Physical Telemetry

---

## 1. Executive Summary & Benchmark Purpose

**Operation Phantom Cargo** is an advanced intelligence and data-fusion benchmark designed to evaluate platforms (such as Revana Technologies, Palantir Foundry, or autonomous analytical agents) on **Cross-Source Multi-Modal Correlation**.

Unlike traditional single-source benchmarks (which only inspect logs or a collection of CSVs), this benchmark tests the **"Two Halves of the Puzzle"** paradigm:
1. **Source A (Internal Business Data / The Paper Trail):** Ingested via tabular `.csv` files (Customs declarations, corporate registries, bills of lading, bank wire transfers). It contains legal intent, declared cargo, and financial identities, but **has zero visibility into physical reality**.
2. **Source B (External Physical Data / The Ground Reality):** Streaming via real-world telemetry feeds (AIS vessel transponders, satellite observation records, draught displacement sensors, coastal port radars). It contains physical coordinates, speeds, and timestamps, but **has zero visibility into corporate contracts, invoices, or fraud intent**.

### Core Evaluation Principle
**Neither dataset contains the answer on its own.**
* An analyst reading *only* the CSV sees standard legal shipments with valid tax declarations.
* An analyst looking *only* at the real-world map sees ships moving and anchoring normally across the Indian Ocean.
* **The covert pattern ONLY emerges when the platform resolves identities across both worlds, identifies where physical reality contradicts legal paperwork, and fuses the graph.**

---

## 2. Directory Architecture & Airgap Layout

To ensure valid evaluation without benchmark contamination or data leakage, the test suite is structured into two isolated directories:

```
test-data/operation-phantom-cargo/
├── investigation/                      <-- ONLY THIS PACKAGE IS INGESTED BY REVANA / AI
│   ├── 01_customs_declarations.csv     (Bills of lading, declared cargo, declared routes)
│   ├── 02_corporate_registry.csv       (Company entities, directors, beneficial ownership)
│   ├── 03_wire_transfers.csv           (Financial transactions, escrow payments, invoices)
│   ├── 04_port_clearance_records.csv   (Declared port arrival notifications, cargo manifests)
│   └── telemetry/
│       ├── ais_vessel_positions.csv    (Raw spatial points: MMSI, IMO, lat, lon, SOG, COG)
│       ├── ais_transponder_events.csv  (Transponder on/off logs, gap timestamps)
│       └── vessel_draught_changes.csv  (Waterline displacement observations)
├── sealed/                             <-- GROUND TRUTH & EVALUATION HARNESS (EVALUATOR ONLY)
│   ├── answer-key.md                   (Canonical ground-truth evidence chain)
│   ├── scoring-rubric.md               (100-point rigorous evaluation grading scale)
│   └── solution_graph.json             (Expected entity-relationship topology)
├── build_dataset.js                    (Deterministic, zero-dependency data generator)
├── validate.js                         (Automated referential integrity & leak validator)
└── BENCHMARK_SPECIFICATION.md          (This document — master architecture blueprint)
```

---

## 3. The Covert Scenario: "Operation Phantom Cargo"

### Background & Plot
A transnational syndicate is executing an illicit **Ship-to-Ship (STS) Crude Oil Transshipment and Sanction-Evasion Scheme** in the Northern Arabian Sea. 

* **The Cover:** A legitimate Mumbai-based storage facility (*Pacific Horizon Storage Pvt Ltd*) orders 4,500 metric tons of low-tariff, non-hazardous **"Refined Lubricant Base Oil"** from a supplier in the UAE (*Apex Petrochem FZE*). The paperwork declares direct transit aboard the Indian-flagged tanker **`BHARAT GAURAV` (IMO: 9435678, MMSI: 419001248)** from Fujairah to Mumbai JNPT with a 4-day non-stop sailing time.
* **The Crime:** Mid-voyage in international waters, `BHARAT GAURAV` turns off its AIS transponder for 14.5 hours. While running dark, it rendezvouses with an unflagged feeder tanker (**`OCEAN VALOR` (IMO: 9214567, MMSI: 419003412)**) carrying sanctioned heavy crude. `BHARAT GAURAV` pumps 40,000 barrels of heavy crude into its holds, increasing its water draught from 8.4m to 13.9m.
* **The Financial Link:** An offshore shell company in the Seychelles (*Gulf Crest Escrow Ltd*) issues a fragmented escrow payment ostensibly for "solvent expediting fees", but the beneficial owner of *Gulf Crest Escrow* is secretly the registered operator of `OCEAN VALOR`.
* **The Arrival Fraud:** `BHARAT GAURAV` arrives at JNPT Mumbai 38 hours behind schedule, claiming mechanical engine slowdown, and submits paperwork for the lightweight lubricant, attempting to discharge high-value contraband crude under false classification.

---

## 4. Multi-Source Evidence Matrix: Who Holds What Piece?

| Investigation Question | Piece in CSV Business Records | Piece in Real-World Telemetry | How Fusion Exposes the Truth |
| :--- | :--- | :--- | :--- |
| **1. What was the vessel supposed to carry?** | `01_customs_declarations.csv`: Declares 4,500 MT of *Refined Lubricant Base Oil* (Density: 0.85 g/cm³). | *No record.* Telemetry does not inspect cargo documents. | Baseline intent established. |
| **2. Did the vessel sail directly as declared?** | `01_customs_declarations.csv`: Declares non-stop route Fujairah -> JNPT (Estimated 96 hours). | `ais_vessel_positions.csv`: Vessel diverted 140 NM south into open ocean, stationary for 14 hours. | **Contradiction:** Spatial track violates declared maritime corridor. |
| **3. Why is there a 14.5-hour blind spot?** | *No record.* Paperwork says transit was continuous. | `ais_transponder_events.csv`: Intentional transponder shutdown at `(20.41°N, 65.23°E)`. | **Covert Action:** Intentional blackout in international waters. |
| **4. Did a cargo transfer happen during blackout?** | *No record.* Paperwork hides offshore operations. | `vessel_draught_changes.csv`: Vessel draught increased from **8.4m to 13.9m** upon AIS reactivation. | **Physical Proof:** A ship cannot gain 5.5 meters of water displacement at sea without loading massive weight. |
| **5. Who was the transshipment partner?** | *No record.* Feeder ship is not mentioned on invoice. | `ais_vessel_positions.csv`: Vessel `OCEAN VALOR` co-located at same coordinates (`< 50m` distance, `< 0.5 kts`) during the dark window. | **Spatial Co-location:** Establishes rendezvous partner. |
| **6. Who financed and organized the transfer?** | `03_wire_transfers.csv`: *Gulf Crest Escrow* wired $1.85M to *Apex Petrochem* tagged as "marine solvent clearance". | `02_corporate_registry.csv`: Director of *Gulf Crest Escrow* is also beneficial owner of *OCEAN VALOR*. | **Graph Resolution:** Ties the secret rendezvous tanker directly to the financial wire. |

---

## 5. Noise & Decoy Elements (Preventing False Positives)

To prevent AI systems from guessing based on simple keyword matches, the benchmark injects realistic background noise:

1. **Decoy Vessel 1 (`SWARNA KAMAL` — IMO: 9381023):**
   * *Telemetry:* Shows drifting and speed drop to 1.2 knots for 10 hours.
   * *Paperwork:* `04_port_clearance_records.csv` contains an official DG Shipping Notice of Scheduled Auxiliary Generator Maintenance and Maritime Safety Broadcast.
   * *Truth:* **Completely benign.** Must NOT be flagged as suspicious.
2. **Decoy Vessel 2 (`MSC INES` — IMO: 9708681):**
   * *Telemetry:* Diverted 60 nautical miles off standard shipping corridor.
   * *Weather Telemetry:* Severe tropical squall and wave height > 4.5m logged on route.
   * *Truth:* **Legitimate maritime weather avoidance.** Must NOT be flagged.
3. **Decoy Financial Anomaly:**
   * A large $2.4M urgent wire transfer from *Tata Global Logistics* to *Colombo Marine Services*.
   * *Truth:* Standard dry-dock refurbishment fee, fully backed by legitimate invoices and tax certificates.

---

## 6. The 100-Point Evaluation Scoring Rubric

The automated benchmark evaluates the output of an analytical system across four categories:

```
┌───────────────────────────────────────────────────────────┬────────┐
│ Scoring Dimension                                         │ Points │
├───────────────────────────────────────────────────────────┼────────┤
│ 1. Cross-Source Entity Resolution                         │  25    │
│    - Linked CSV Bill of Lading to live BHARAT GAURAV      │  (10)  │
│    - Linked Ocean Valor to Gulf Crest Escrow owner        │  (15)  │
├───────────────────────────────────────────────────────────┼────────┤
│ 2. Physical vs. Paperwork Discrepancy Detection          │  30    │
│    - Identified 14.5-hour AIS transponder blackout        │  (10)  │
│    - Correlated draught change (8.4m -> 13.9m) to crude   │  (10)  │
│    - Reconstructed 38-hour arrival delay contradiction    │  (10)  │
├───────────────────────────────────────────────────────────┼────────┤
│ 3. Pattern Synthesis & Criminal Tradecraft Recognition    │  25    │
│    - Classified as Ship-to-Ship (STS) Dark Transshipment  │  (15)  │
│    - Identified customs tariff misclassification fraud    │  (10)  │
├───────────────────────────────────────────────────────────┼────────┤
│ 4. Noise Discrimination & Uncertainty Calibration         │  20    │
│    - Correctly exonerated SWARNA KAMAL (maintenance)      │  (10)  │
│    - Correctly exonerated MSC INES (weather deviation)    │  (10)  │
│    - Deductions for hallucinations (-10 per phantom fact) │  VAR   │
├───────────────────────────────────────────────────────────┴────────┤
│ TOTAL EVALUATION SCORE: 100 POINTS                                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. Instructions for ChatGPT & Claude: How to Review and Refine

When sharing this specification with ChatGPT or Claude, prompt them with the following structured review tasks:

### Prompt Template to send to ChatGPT / Claude:
```text
I am building an intelligence data fusion benchmark called "Operation Phantom Cargo" for an analytical platform like Palantir Foundry / Revana.

Here is the master specification document: [Attach or paste this file]

Please review this specification and perform the following 4 tasks:
1. Integrity Audit: Are there any logical holes in the scenario? Can an investigator deduce the fraud without checking BOTH the CSV and the telemetry data? (Ensure neither source leaks the complete answer alone).
2. Schema & Field Validation: Review the proposed CSV schemas and Telemetry schemas. Suggest exact column names, data types, and sample row values (including edge cases like GPS coordinate drift, timestamps, and MMSI formatting).
3. Decoy Calibration: Are the decoy vessels (Swarna Kamal, MSC Ines) realistic? How can we make them challenging enough to test an AI agent's discernment without making them ambiguous?
4. Generation Code: Generate or optimize a deterministic Node.js script (build_dataset.js) that generates all synthetic CSVs and telemetry records with realistic noise, consistent timestamps, and mathematical integrity.
```

---

## 8. Status & Next Steps

* [x] Master Benchmark Specification document created (`BENCHMARK_SPECIFICATION.md`).
* [ ] Review with Claude & ChatGPT for edge-case validation and schema tuning.
* [ ] Generate deterministic mock data generator (`build_dataset.js`).
* [ ] Generate canonical ground truth answer key and scoring harness (`sealed/answer-key.md`, `validate.js`).
* [ ] Run automated test suite against Revana's investigation and pattern detector pipeline.
