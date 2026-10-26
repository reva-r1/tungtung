# Operation Glass Lantern — Synthetic Cyber Incident Investigation Benchmark
## Revana Technologies Multi-Table Correlation & Forensics Evaluation Dataset

---

## 1. Benchmark Overview

**Operation Glass Lantern** is a medium-difficulty, defensive cyber incident investigation benchmark designed to test Revana Technologies' ability to:
1. Ingest and correlate records across eight heterogeneous CSV datasets.
2. Reconstruct complex, multi-stage event timelines across disparate timestamps.
3. Resolve entities, shared session keys, and host relationships.
4. Distinguish authentic malicious activities from legitimate background operations and deceptive noise.
5. Accurately calibrate conclusions and articulate unresolved uncertainties in natural language.

---

## 2. Directory Architecture & Airgap Isolation

The benchmark repository is structured into two strictly segregated packages:

```
test-data/operation-glass-lantern/
├── investigation/              <-- ONLY THIS PACKAGE IS PROVIDED TO REVANA
│   ├── 01_identity_directory.csv
│   ├── 02_asset_inventory.csv
│   ├── 03_authentication_events.csv
│   ├── 04_network_connections.csv
│   ├── 05_endpoint_events.csv
│   ├── 06_data_access_audit.csv
│   ├── 07_incident_tickets.csv
│   ├── 08_evidence_registry.csv
│   └── SCHEMA.md
├── sealed/                     <-- EVALUATOR-ONLY GROUND TRUTH (DO NOT UPLOAD)
│   ├── answer-key.md
│   └── scoring-rubric.md
├── build_dataset.js            <-- Deterministic generator script
├── validate.js                 <-- Local offline integrity test runner
├── VALIDATION_REPORT.md        <-- Machine-generated validation audit report
└── README.md                   <-- Benchmark orientation and test protocol
```

### Strict Isolation Rules
- **Candidate Airgap:** When evaluating Revana or any AI agent, **only the contents of `investigation/` may be provided, uploaded, or exposed**.
- **Sealed Boundary:** The `sealed/` directory contains the complete ground truth, evidence chains, decoys, and 100-point scoring rubric. It is intended solely for the human evaluator or grading harness.
- **No Automatic Imports:** Do not run automated database migrations, loaders, or system modifications against Revana's production environment.

---

## 3. Case Briefing (Presented to Investigator)

> **Northstar Research Group Incident Briefing**
>
> A fictional organization called **Northstar Research Group** has reported unusual activity across several internal systems.
>
> An account was used in an unexpected context. Subsequent records indicate activity involving internal assets, access to a protected resource, and unusual network communication. The organization needs to reconstruct the sequence of events, identify the affected assets and identities, determine what the records establish, and identify what remains uncertain.

---

## 4. File Inventory & Specifications

The investigation package contains eight tabular CSV files representing standard enterprise telemetry:

| File Name | Records | Sensor / System Source | Purpose |
| :--- | :---: | :--- | :--- |
| `01_identity_directory.csv` | 25 | Active Directory / LDAP | Organizational identities, roles, and authorized assets. |
| `02_asset_inventory.csv` | 22 | CMDB / ServiceNow | Host systems, network tiers, sensitivities, and roles. |
| `03_authentication_events.csv` | 45 | Palo Alto VPN, Kerberos, SSH, DB Auth | Logon sessions, authentication mechanisms, and outcomes. |
| `04_network_connections.csv` | 50 | Zeek Core & NetFlow v9 | Internal and perimeter network flows and byte counts. |
| `05_endpoint_events.csv` | 42 | Linux Auditd & Windows Sysmon | Process launches, script executions, and file operations. |
| `06_data_access_audit.csv` | 38 | PostgreSQL pgaudit | Resource queries, table extracts, and row counts. |
| `07_incident_tickets.csv` | 14 | Jira Service Management | Helpdesk requests and security alert tickets. |
| `08_evidence_registry.csv` | 32 | Forensic Evidence Tracker | Record provenance, sensor quality, and known limits. |
| **TOTAL** | **268** | — | **8 Interconnected Forensics Tables** |

---

## 5. Synthetic Data Safety & Ethics

- **100% Invented Data:** All company names, users, accounts, systems, ticket descriptions, and logs are synthetic.
- **Reserved IP Addressing:** External addresses utilize standard RFC 5737 documentation test blocks (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`). Internal addresses utilize private RFC 1918 space (`10.40.0.0/16`).
- **No Exploits / Tooling:** No functional malware payloads, exploit code, offensive tradecraft, or operational credentials are included.

---

## 6. Verification & Validation Protocol

To independently verify dataset integrity, schema conformity, and referential constraints:

```bash
# Execute local integrity validation suite
node test-data/operation-glass-lantern/validate.js
```

The validation suite inspects:
1. File existence and CSV parsability across all 8 tables.
2. Header correctness and uniqueness.
3. Primary key uniqueness within each file.
4. Foreign key referential integrity (`identity_id`, `asset_id`, `session_id`, `resource_id`).
5. ISO 8601 UTC timestamp format compliance.
6. Absence of solution leakage in the `investigation/` package.
7. Total record count consistency.
