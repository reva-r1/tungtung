# Operation Glass Lantern — Sealed Evaluation & Scoring Rubric
## Benchmark Assessment Framework for Revana Automated Investigations

> **CONFIDENTIALITY NOTICE:** This rubric is part of the `sealed/` package. It contains explicit evaluation criteria and expected conclusions. It must not be shared with Revana or candidate systems during evaluation.

---

## 1. Overview & Point Distribution (100 Total Points)

| Category | Available Points | Description |
| :--- | :---: | :--- |
| **1. Entity & Identifier Resolution** | 20 | Correct identification of key identities, hosts, IP addresses, sessions, and databases. |
| **2. Cross-File Correlation** | 20 | Linking events across at least 4 distinct CSV files using shared keys (`session_id`, `identity_id`, `asset_id`). |
| **3. Timeline Reconstruction** | 15 | Correct chronological sequencing of the incident chain from ingress to egress. |
| **4. Relationship Graph & Edge Evidence** | 15 | Evidence-backed graph mapping pivots, executions, queries, and egress. |
| **5. Primary Conclusion Calibration** | 15 | Accurate, well-supported finding regarding the core breach without over-claiming. |
| **6. Alternative Hypotheses & Uncertainty** | 10 | Identifying and refuting the backup decoy; acknowledging unencrypted payload limits. |
| **7. Report Clarity & Analyst Utility** | 5 | Clear, coherent, human-readable natural language synthesis. |
| **TOTAL** | **100** | Standard benchmark score |

---

## 2. Detailed Scoring Criteria & Partial Credit

### Category 1: Entity & Identifier Resolution (20 Points)
- **[4 pts] Identity Resolution:** Identifies `USR_0142_MCHEN` as the compromised account used in the incident.
  - *Full (4 pts):* Explicitly links `USR_0142_MCHEN` to session `SES_20261014_9102`.
  - *Partial (2 pts):* Mentions Marcus Chen as suspicious but cannot isolate the specific session.
- **[4 pts] Entrypoint & Ingress IP:** Identifies `AST-GW-01` as the ingress gateway and `198.51.100.44` as the external source IP.
  - *Full (4 pts):* Both gateway asset and external IP resolved.
  - *Partial (2 pts):* Identifies VPN gateway or IP only.
- **[4 pts] Pivot Workstation:** Identifies `AST-WRK-088` as the staging compute node where lateral activity and script execution occurred.
  - *Full (4 pts):* Pinpoints `AST-WRK-088`.
  - *Partial (2 pts):* Conflates Marcus Chen's primary desk `AST-WRK-101` with `AST-WRK-088`.
- **[4 pts] Target Resource & Server:** Identifies `AST-SRV-04` (Apollo Core DB) and target table `RES_GENOME_CORE_DB`.
  - *Full (4 pts):* Both server and table identified.
  - *Partial (2 pts):* Identifies server only or mistakes resource for `RES_METRIC_STORE`.
- **[4 pts] Drop Host / Egress Destination:** Identifies `203.0.113.89` (or `203.0.113.89:443`) as the destination of external network transmission `NET-77402`.
  - *Full (4 pts):* Destination IP and port resolved.
  - *Zero (0 pts):* Fails to identify external destination or confuses with internal backup server `10.40.5.20`.

---

### Category 2: Cross-File Correlation (20 Points)
Requires joining records across multiple CSV sources:
- **[5 pts] Ticket to Authentication Link (`07` <-> `03`):** Correlates Helpdesk bypass token grant in `TCK-2026-0912` with the authentication method `PASSWORD_PLUS_MFA_BYPASS_TOKEN` in `AUTH-20261014-013`.
- **[5 pts] Authentication to Endpoint Link (`03` <-> `05`):** Correlates session `SES_20261014_9102` on `AST-WRK-088` with bash execution `EPT-8840` and staging script `EPT-8841`.
- **[5 pts] Endpoint to Data Audit Link (`05` <-> `06`):** Correlates psql execution `EPT-8842` and tar archive creation `EPT-8843` with data export audit `ACC-88319` (4,200 records).
- **[5 pts] Endpoint to Network Egress Link (`05` <-> `04`):** Correlates curl upload command `EPT-8844` on `AST-WRK-088` with 21.4 MB outbound TLS connection `NET-77402` to `203.0.113.89`.

---

### Category 3: Timeline Reconstruction (15 Points)
- **[5 pts] Proper Ingress & Pivot Ordering:** Places VPN ingress (01:14 UTC) before SSH jump to staging node (01:18 UTC) and script execution (01:28 UTC).
- **[5 pts] Proper Query & Export Ordering:** Correctly places database query `ACC-88319` (02:05 UTC) and file creation `EPT-8843` (02:05 UTC) before network transfer `NET-77402` (02:34 UTC).
- **[5 pts] Anti-Forensics & Cleanup Ordering:** Recognizes that file deletion `EPT-8845` occurred at 02:48 UTC immediately prior to session disconnect at 02:49 UTC (`AUTH-20261014-018`).

---

### Category 4: Evidence-Backed Relationship Graph (15 Points)
- **[5 pts] Valid Structural Connections:** Graph correctly links `198.51.100.44` -> `AST-GW-01` -> `AST-WRK-088` -> `AST-SRV-04` -> `203.0.113.89`.
- **[5 pts] Explicit Record Attribution:** Edges cite actual record IDs (e.g., `AUTH-20261014-013`, `NET-77402`, `ACC-88319`) rather than unsubstantiated assertions.
- **[5 pts] Edge Modality Discrimination:** Distinguishes directly proven telemetry edges from inferential links (e.g., inferring payload identity from timing/size).

---

### Category 5: Primary Conclusion Calibration (15 Points)
- **[15 pts] Grounded Conclusion:** Concludes that an unauthorized entity used Dr. Marcus Chen's compromised temporary credentials to access `AST-WRK-088`, extract 4,200 records from `RES_GENOME_CORE_DB`, and transmit 21.4 MB to `203.0.113.89`.
  - *Full (15 pts):* Substantively matches ground truth, distinguishing verified telemetry from unproven claims.
  - *Partial (8-10 pts):* Identifies data extraction but misses external transmission, or vice versa.
  - *Low (1-4 pts):* Concludes something completely different (e.g., blaming external brute-force attacker `192.0.2.115` or claiming the backup job was malicious).

---

### Category 6: Alternative Hypotheses & Uncertainty (10 Points)
- **[5 pts] Decoy Resolution (SIEM / Backup Discrepancy):** 
  - Explains that the 891 MB transfer at 01:50 UTC (`TCK-2026-0925` / `NET-77301`) was an authorized internal backup to `AST-SRV-09` by `SVC_NIGHTLY_BACKUP`, and demonstrates why it is not the primary incident.
- **[5 pts] Explicit Calibration of Unknowns:**
  - Notes that TLS encryption prevents inspecting the contents of `NET-77402` directly.
  - Refrains from declaring Dr. Marcus Chen guilty of insider espionage without corroborating personal evidence.

---

### Category 7: Report Clarity & Analyst UX (5 Points)
- **[5 pts] Executive Communication:** The finding is summarized in concise, professional, natural language suitable for an incident commander, separating facts, inferences, and recommended actions.

---

## 3. Mandatory Penalties (Deductions)

Penalties are subtracted from the earned score:

| Penalty Condition | Deduction | Rationale |
| :--- | :---: | :--- |
| **P1: Hallucinated / Invented Identifiers or Records** | -10 pts | Citing non-existent record IDs, fake IPs, or fabricated timestamps destroys investigative trust. |
| **P2: Definitive Insider Accusation without Evidence** | -10 pts | Accusing Dr. Marcus Chen of intentional espionage as an established fact (ignoring credential compromise/theft). |
| **P3: Confirmed Exfiltration Over-Claim** | -5 pts | Claiming that payload contents were definitively decrypted or confirmed without acknowledging TLS encryption. |
| **P4: Misidentifying Backup Job as Malicious Breach** | -15 pts | Falling for Decoy 1 and claiming the 891 MB backup transfer to `10.40.5.20` was the exfiltration. |
| **P5: Conflating Ingestion Timestamp with Event Time** | -5 pts | Treating SIEM ingestion or ticket creation time as the moment the physical event occurred. |
| **P6: Solution Leaking / Using Sealed Artifacts** | -100 pts | Benchmark invalidation. Candidate accessed `sealed/` or prior knowledge. |

---

## 4. Benchmark Scoring Bands

- **90–100 Points (Superior / Expert Forensics Analyst):** Discovers full cross-file chain, completely resolves decoys, accurately calibrates uncertainty, zero hallucinations.
- **75–89 Points (Proficient / Senior Investigator):** Accurately reconstructs main incident path; may have minor gaps in decoy explanation or edge qualification.
- **50–74 Points (Marginal / Needs Improvement):** Finds isolated suspicious events (e.g., Marcus Chen login or database query) but fails to link full chain to egress, or confuses backup traffic with incident.
- **< 50 Points (Failed Benchmark):** Misleads the investigation, falls for decoys, hallucinates records, or fails cross-file correlation.
