# Revana Technologies // Tactical Intelligence & Real-World Mirror Platform
> Inspired by the architecture and capabilities of **Palantir Gotham** — designed for multi-source data fusion, graph analytics, geospatial telemetry tracking, rule-based anomaly detection, and AI-assisted investigation powered by **Grok (xAI API)** and **Groq (120B Reasoning)**.

---

## 1. System Overview

Revana Technologies transforms fragmented, multi-agency datasets and real-time sensor telemetry into an interconnected, actionable intelligence graph:

```text
DATA INGESTION (CSV/JSON/XLSX)
   ↓
ENTITY RESOLUTION & DEDUPLICATION (Confidence Scoring & Merge Review)
   ↓
CONNECTED GRAPH & ADJACENCY TRAVERSAL (Cytoscape.js)
   ↓
GEOSPATIAL & CHRONOLOGICAL FUSION (Leaflet Map + Event Timeline)
   ↓
RULE-BASED ANOMALY & THREAT DETECTION (Speed Physics, Divergence, Cloned Identifiers)
   ↓
GROK AI INVESTIGATION AGENT & NATURAL LANGUAGE DISCOVERY (xAI Grounded Briefings)
```

---

## 2. Quickstart Guide

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation & Launch

1. **Install Dependencies**
   ```bash
   # In root directory
   cd server && npm install
   cd ../client && npm install
   ```

2. **Configure Grok API Key (Optional but Recommended)**
   Create or edit `server/.env`:
   ```env
   PORT=5000
   XAI_API_KEY=your_xai_api_key_here
   XAI_BASE_URL=https://api.x.ai/v1
   XAI_MODEL=grok-2-latest
   ```
   > **Note**: If `GROQ_API_KEY` or `XAI_API_KEY` is not provided, Revana Technologies automatically switches to its built-in **Deterministic Local Reasoning Engine**, allowing complete end-to-end testing of graph traversal, speed physics, and intelligence synthesis offline without error!

3. **Start the Platform**
   - **Terminal 1 (Backend REST API & SQLite Store)**:
     ```bash
     cd server
     npm run dev
     ```
     *Server will run at `http://localhost:5000`*

   - **Terminal 2 (Tactical React Frontend)**:
     ```bash
     cd client
     npm run dev
     ```
     *Analyst Workspace will run at `http://localhost:3000`*

---

## 3. Core Modules & Capabilities

### A. Investigation Workspace (The Flagship Multi-Dock)
- **Entity Explorer**: Search and filter through entities across 9 distinct categories.
- **Interactive Graph**: Powered by Cytoscape.js with multi-hop expansion (+1, +2, +3 hops), physics force-directed layouts (COSE, Concentric, Hierarchy, Circular), and shortest path discovery.
- **Geospatial Radar**: Interactive Leaflet dark map with NH48 Golden Corridor trade artery vectors, checkpoint pins, and anomaly detour paths.
- **Chronological Timeline**: Step-by-step telemetry scrubber with evidence ledgers and speed verification.
- **Entity Dossiers & AI Assistant**: Deep-dive profile inspector with key attributes, connected vectors, and Grok intelligence assessments.

### B. Entity Resolution Engine
- Multi-attribute token Jaccard similarity, Levenshtein distance, and GSTIN/License cross-checks.
- Interactive **Merge vs. Keep Separate** review queue with confidence scoring (e.g. *Apex Logistics Pvt Ltd* vs. *Apex Logistics Private Limited* — 94% match).
- Merges re-route all incoming/outgoing graph edges, unify aliases, and preserve audit records.

### C. Rule-Based Anomaly Detection
- **Impossible Transit Speed**: Haversine distance divided by timestamp delta. If speed > 130 km/h for heavy commercial trucks, generates a Critical Anomaly (e.g. Truck `KA-01-AB-1234` logged at Bangalore and Chennai Port 45 minutes apart = 406.9 km/h implied speed).
- **Unauthorized Route Divergence**: Telemetry blackout and off-corridor detours (e.g. 120km diversion of lithium shipment `SHP-8821` into Krishnagiri yard).
- **Dormant Shell Company Surge**: Volume surge detection for entities without physical assets (e.g. `Shadow Trade LLC` registering ₹28 Cr high-tech manifests from residential address).
- **Cloned Transponders / Identifiers**: Simultaneous electronic toll pings at distant plazas for the same registration plate (e.g. `MH-12-Q-4455` pinged at Bangalore and Pune within 15 minutes).
- **Orphaned Consignment Manifests**: Shipments referencing unverified destination depots.

### D. Grok AI Analyst & Natural Language Querying
- Type plain-language queries in the top search bar:
  - *"Which companies have shipments going from Bangalore to Chennai?"*
  - *"Investigate Truck KA-01-AB-1234 impossible speed anomaly"*
  - *"Show all entities connected to Devendra Patel within 2 hops"*
  - *"Find unusual relationships in this investigation"*
- Outputs structured Palantir Gotham-style intelligence briefings:
  - **Verified Known Facts**
  - **Possible Inferred Relationships**
  - **AI Interpretation / Tactical Hypothesis**
  - **Intelligence Gaps & Uncertainty**
  - **Recommended Tactical Actions & Next Leads**

### E. Data Ingestion & ETL
- Drag-and-drop file uploader for CSV, JSON, and Excel (.xlsx/.xls).
- Automated schema inspector detecting column types and inferring entity types (`COMPANY`, `PERSON`, `VEHICLE`, `SHIPMENT`, `WAREHOUSE`, `LOCATION`, `EVENT`, `TRANSACTION`).
- Missing values and duplicate rows detection before committing to graph.

---

## 4. Benchmark Scenario: "Karnataka & South-West Transit Corridor"

Pre-seeded with 26 interconnected entities, 30 relationship edges, 10 chronological events, and 5 pre-configured intelligence anomalies:
- **Companies**: Apex Logistics Pvt Ltd, Horizon Cargo Solutions, Shadow Trade LLC (shell company), Bharat Heavy Haulage, Silicon Components India.
- **Vehicles & Drivers**: Truck KA-01-AB-1234 (Driver Suresh Kumar), Truck KA-04-E-9988 (Driver Vikram Singh), Truck MH-12-Q-4455 (Cloned Transponder).
- **Shipments**: SHP-10293 (Semiconductor Wafers ₹4.2 Cr), SHP-8821 (Industrial Lithium Batteries), SHP-9904 (Biomedical Vaccines), SHP-6650 (Imported Telecom).
- **Locations**: Bangalore Whitefield ICD, Peenya Industrial Hub, Hosur Border Checkpoint, Krishnagiri Yard, Vellore Toll, Chennai Port Terminal, Nelamangala Gateway, Hubli Depot.

---

## 5. Security & Architecture Principles

- **No Frontend API Key Exposure**: All communications with Grok xAI API occur strictly server-side through `server/src/services/ai.service.ts`.
- **Controlled Backend Tool Execution**: AI agent interacts with database strictly through safe parameterized service functions (`search_entities`, `get_entity_dossier`, `get_connected_network`, `get_location_history`, `detect_anomalies_for_entity`, `find_path_between_entities`). No arbitrary SQL execution.
- **Relational + Graph Adjacency Performance**: High-performance SQLite engine with indexes on entity types, names, risk scores, source/target keys, and timestamps.
