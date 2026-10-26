# Blind End-to-End Intelligence Discovery Benchmark (v1)
### Revana Technologies — Public Infrastructure & Civil Works Authority

This experiment objectively tests whether Revana can discover meaningful, previously undisclosed relationships across fragmented, multi-source datasets in a fictional public works environment without leaking answers, without pre-baked links, and without human guidance.

---

## Architecture Overview

```
experiments/blind_intelligence_v1/
├── source_data/                    [Package A: Fictional Source Datasets]
│   ├── 01_vendor_corporate_registry.csv
│   ├── 02_municipal_procurement_contracts.csv
│   ├── 03_escrow_financial_wire_transfers.csv
│   ├── 04_site_access_fleet_telemetry.csv
│   ├── 05_dispatch_call_logs.csv
│   ├── 06_regulatory_field_inspections.txt
│   └── SCHEMA.md
├── blind_questions/                [Neutral Investigation Prompts]
│   └── investigation_prompts.json
├── generator/                      [Deterministic Synthetic Generator]
│   └── generate_world.ts           (Seed: 0xREVANA2026)
├── ground_truth_restricted/        [Package B: Air-Gapped Answer Key]
│   ├── ground_truth.json
│   └── ground_truth_spec.md
├── evaluation/                     [Evaluation & Automated Checks]
│   ├── verify_no_leakage.ts
│   └── run_experiment.ts
└── reports/                        [Audit Logs & Metrics Reports]
    ├── raw_execution_results.json
    └── EVALUATION_REPORT.md
```

---

## Air-Gap Isolation Guarantee

The evaluation suite enforces strict air-gap isolation between **Package A (Blind Test Data)** and **Package B (Ground-Truth Answer Key)**:
1. `ground_truth_restricted/` is kept completely outside Revana's runtime path (`server/src/`, `client/src/`).
2. Source datasets and blind questions contain **zero** expected answers, planted labels, or solution hints.
3. The automated leakage test (`evaluation/verify_no_leakage.ts`) verifies that no ground-truth symbols or answer terms are imported or indexed during ingestion.
4. Revana's inference pipeline processes queries without ground-truth access; ground truth is accessed solely by the evaluation scoring harness after execution completes.

---

## 12 Benchmark Test Cases

| Case ID | Benchmark Category | Target Subject | Description |
| :--- | :--- | :--- | :--- |
| **CASE-01** | Cross-Source Entity Resolution | Julian Vance Thorne | Cross-source entity resolution across 3 files with name variations. |
| **CASE-02** | Multi-Hop Relationship Discovery | Marcus Vance | Multi-hop beneficial ownership chain: Marcus Vance -> Apex -> Ironclad -> Valcourt. |
| **CASE-03** | Complex Pattern Discovery | Valcourt / Zephyr / Elena | Three-source kickback triangle linking contract award, freight payment, and evaluator. |
| **CASE-04** | Timeline Reconstruction | North Tunnel Berth 4 | Concrete foundation pour discharged 6 days prior to geotechnical permit issuance. |
| **CASE-05** | Conflicting Evidence | CONSIGN-STEEL-8812 | Rebar officially destined for Central Rail Depot Alpha diverted to Warehouse Omega. |
| **CASE-06** | Similar Names Disambiguation | David Miller | Safety Inspector David Miller kept distinct from Subcontractor David A. Miller. |
| **CASE-07** | Decoy Pattern Rejection | Solomon Crane Hire | Suspicious $45,000 wire refuted by legitimate 200T crane lease mobilization. |
| **CASE-08** | Epistemic Insufficiency | Arthur Pendelton / Claire Dunmore | Unverified 6-second dropped call properly recognized as insufficient evidence. |
| **CASE-09** | Missing Record / Gap Detection | Convoy Truck TRK-703 | Convoy departure recorded at Quarry Site Bravo but missing arrival scan at Pier 9. |
| **CASE-10** | Attribute-Combination Identity | Entity Reg #9941-K | Resolved to Kestrel Urban Works Ltd based on registration code, phone, and address. |
| **CASE-11** | Longitudinal Trajectory | Cassandra Vance | Traced career evolution from public compliance inspector to private supplier COO. |
| **CASE-12** | Clean Negative Control | Veridian Environmental Labs | Standard testing vendor audited with zero false positive accusations. |

---

## How to Reproduce the Experiment

### 1. Verify Zero Data Leakage
```bash
npx tsx experiments/blind_intelligence_v1/evaluation/verify_no_leakage.ts
```

### 2. (Optional) Regenerate Synthetic Source Datasets
```bash
npx tsx experiments/blind_intelligence_v1/generator/generate_world.ts
```

### 3. Run the Full Blind Pipeline & Benchmark
```bash
npx tsx experiments/blind_intelligence_v1/evaluation/run_experiment.ts
```

All raw investigation outputs and metric scorecards will be saved to `reports/raw_execution_results.json` and `reports/EVALUATION_REPORT.md`.
