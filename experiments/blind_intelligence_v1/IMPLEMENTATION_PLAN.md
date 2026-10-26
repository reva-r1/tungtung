# REVANA TECHNOLOGIES — BLIND EXPERIMENT IMPLEMENTATION PLAN
## Phase 1 Inspection & Architecture Mapping

### 1. Repository Component Inventory

| Component | Repository Path | Existing Functionality & Capabilities | Experiment Role |
| :--- | :--- | :--- | :--- |
| **Ingestion Pipeline** | `server/src/services/graph/jobController.ts`<br>`server/src/services/ingestion.service.ts` | Multi-file background job runner (`JobController`). Dispatches CSV files to `DeterministicCsvParser` and unstructured text/memos to `LlmExtractor`. | Reused directly. Ingests all blind source datasets through standard job queues. |
| **Entity Extraction** | `server/src/services/graph/deterministicCsvParser.ts`<br>`server/src/services/graph/llmExtractor.ts` | Deterministic role-based CSV parsing (supports CDR, Wire Transfers, Telemetry, Manifests, Corporate Registries, Explicit Triples). LLM extractor with regex/rule fallback. | Reused directly. Generates structured `ProvenancedTriple` items with file, row, and span references. |
| **Entity Resolution** | `server/src/services/resolution.service.ts`<br>`server/src/services/graph/resolutionHook.ts` | Multi-attribute comparator (`compareEntities`): Tax/GSTIN, Corporate CIN, Vehicle Plate, Driver License, Phone, Email, Token Jaccard, Levenshtein distance, and known aliases. Intercepts writes before SQLite insertion via `EntityResolutionHook`. | Reused directly. Resolves multi-source identities and prevents duplicate node fragmentation. |
| **Graph & Database Store** | `server/src/services/graph/sqliteGraphStore.ts`<br>`server/src/db/database.ts` | Persistent SQLite database (`aegis_intel.db`). Tables: `entities`, `relationships`, `extracted_triples`, `datasets`, `pipeline_jobs`. Atomic transactional upserts with provenance. | Reused directly. Stores all extracted nodes, edges, and citation spans. |
| **Graph Query & Traversal** | `server/src/services/graph.service.ts` | 1-to-3 hop graph expansion (`expandEntity`), BFS shortest path (`findShortestPath`), inquiry anchor search with negative isolation (`searchGraphInquiry`). | Reused directly. Retrieves multi-hop subgraphs and candidate evidence chains. |
| **Epistemic Reasoning & QA** | `server/src/services/graph/kgReasoner.ts`<br>`server/src/services/ai/` | 4-tier Epistemic Hierarchy: Facts (grounded in explicit evidence IDs), Inferences (deductions from >=2 facts), Hypotheses (forward-looking theories with plausibility ratings and falsification tests). | Reused directly. Evaluates blind questions and generates structured findings. |
| **Evidence Provenance & Verification** | `server/src/services/ai/verify.ts` | Strict claim verification (`verifyClaims`): demotes ungrounded facts, validates token containment against source text spans, flags conflicting claims. | Reused directly. Enforces zero-hallucination standards. |
| **Model Configuration** | `server/src/services/ai/providers.ts` | Configured for offline local Ollama (`llama3.2:3b`) with deterministic rule-based fallback when offline. Zero cloud API dependencies. | Reused directly. Ensures air-gapped, zero-cost, reproducible execution. |
| **Dashboard UI** | `client/src/components/investigation/` | Interactive SVG investigation canvas, Entity Inspector, and natural language investigation drawer. | Preserved without modifications. Tested via backend API contracts. |
| **Automated Test Suites** | `server/src/tests/` | 18 existing test suites (`test_phase8_phantom_cargo_eval.ts`, `generalization.test.ts`, `investigation_ux.test.ts`). | Reference for benchmarking metrics and validation patterns. |

---

### 2. Experiment Execution Workflow

1. **Isolation Guarantee (Airgap):**
   * Package B (`ground_truth_restricted/`) is located in a protected directory outside any file-watcher, crawler, or prompt context accessible by the live Revana server.
   * Automated verification script (`verify_no_leakage.ts`) confirms zero file references, zero imports, and zero answer tokens in runtime indices.

2. **Ground Truth Benchmark Construction (Phase 3 first):**
   * Pre-define 12 distinct test cases with exact expected entities, true relationships, multi-hop joins, conflicting evidence, decoy patterns, and insufficient evidence cases.
   * Define objective scoring criteria and ground-truth supporting evidence citations.

3. **Deterministic Multi-Source World Generation (Phase 2):**
   * Generate 6 distinct tabular and narrative datasets (~450 records) in the fictional domain of **Municipal Public Infrastructure and Procurement** (*Metro North Civil Works Authority*).
   * Seed: Deterministic PRNG (`seed: 0xREVANA2026`).

4. **Blind Ingestion & Execution (Phase 5):**
   * Ingest Package A (`source_data/`) through Revana's `JobController.processFileAsync`.
   * Execute 12 neutral blind questions through Revana's `KgReasonerService` and `GraphService`.
   * Capture raw execution logs, retrieved subgraphs, and verified claims.

5. **Baseline Comparison & Scoring (Phase 6):**
   * Benchmark against:
     1. Baseline 1: Keyword search and isolated table filtering.
     2. Baseline 2: Manual source-by-source inspection procedure.
     3. Baseline 3: Revana end-to-end epistemic pipeline.
   * Measure Entity Resolution F1, Relationship Discovery F1, Multi-hop Case Success, False Positive Rate, and Citation Accuracy.
