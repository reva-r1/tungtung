# Operation Glass Lantern — Sealed Answer Key & Ground Truth
## Strictly Confidential — Benchmark Evaluator Reference Only
> **HANDLING INSTRUCTION:** This document belongs exclusively to the `sealed/` package. It must NEVER be moved into the `investigation/` directory, uploaded to Revana, or shown to candidate evaluation models during testing.

---

## A. Ground Truth Summary

### What Actually Happened
On the afternoon of October 13, 2026, Senior Computational Biologist Dr. Marcus Chen (`USR_0142_MCHEN`) requested an expedited 72-hour temporary VPN access bypass token via IT Helpdesk ticket `TCK-2026-0912` prior to traveling to Montreal for an academic symposium. 

During the transit window, Dr. Chen's temporary access credentials or active token claims were compromised (via credential interception, phishing, or physical compromise of transit equipment). 

In the early morning of October 14, 2026, an unauthorized external actor connected to Northstar's VPN Gateway (`AST-GW-01`) from external IP `198.51.100.44` at 01:14:22 UTC using Dr. Chen's account and the temporary token, initiating session `SES_20261014_9102`. 

From the VPN gateway, the actor pivoted internally via SSH to `AST-WRK-088`, a shared high-performance Linux staging and compute node. On this workstation, the actor:
1. Executed a staged batch script `/tmp/.scratch_env/proc_sync_snapshot.sh` at 01:28:45 UTC.
2. Attempted to enumerate administrative SMB shares on Domain Controller `AST-SRV-01` at 01:55:12 UTC (which failed due to access controls).
3. Connected directly to Apollo Core Database `AST-SRV-04` using Dr. Chen's database credentials at 02:04:40 UTC.
4. Extracted 4,200 sequence records from the protected table `RES_GENOME_CORE_DB` via `SELECT_EXPORT` at 02:05:11 UTC, archiving the dump into `/tmp/.scratch_env/core_gen_dump.tar.gz`.
5. Transmitted 21.4 MB of outbound data via TLS to external IP `203.0.113.89:443` using `curl` at 02:34:18 UTC.
6. Deleted the staging archive at 02:48:30 UTC and closed the VPN tunnel cleanly at 02:49:10 UTC.

### Organization's Initial Misinterpretation
Northstar's Security Operations Center (SOC) initially opened ticket `TCK-2026-0925` flagging an automated SIEM alert regarding an 891 MB volume anomaly at 01:50:12 UTC on `AST-SRV-04`. Tier 1 analysts initially conflated this with the incident. However, that 891 MB transfer was actually an authorized, scheduled nightly backup executed by service account `SVC_NIGHTLY_BACKUP` transferring metric snapshots to internal backup node `AST-SRV-09` (`10.40.5.20`). The real incident occurred under session `SES_20261014_9102` involving 21.4 MB of outbound data to `203.0.113.89`.

---

## B. Expected Chronological Timeline

| Timestamp (UTC) | Entity / Asset IDs | Event Description | Source File | Source Record ID | Evidence Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-10-13 16:15:00** | `USR_0142_MCHEN`, `AST-WRK-101` | Dr. Marcus Chen locks lab workstation prior to travel departure. | `03_authentication_events.csv` | `AUTH-20261013-005` | Direct Evidence |
| **2026-10-13 16:20:00** | `USR_0142_MCHEN`, `AST-GW-01` | Helpdesk ticket opened for temporary travel VPN bypass token. | `07_incident_tickets.csv` | `TCK-2026-0912` | Direct Evidence |
| **2026-10-13 17:05:00** | `USR_0118_TWRIGHT`, `USR_0142_MCHEN` | Helpdesk issues 72-hour bypass token without in-person biometric verification. | `07_incident_tickets.csv` | `TCK-2026-0912` | Direct Evidence |
| **2026-10-13 19:30:12** | `USR_0209_EKIM`, `AST-GW-01` | Dr. Elena Kim establishes benign remote VPN session from Tokyo partner lab (`198.51.100.12`). | `03_authentication_events.csv` | `AUTH-20261013-006` | Benign Decoy |
| **2026-10-13 23:10:02** | `192.0.2.115`, `AST-GW-01` | External scanner probes disabled admin accounts (`USR_0012_ADMIN`); blocked by firewall. | `03_authentication_events.csv` | `AUTH-20261013-008` | Benign Decoy |
| **2026-10-14 01:14:22** | `USR_0142_MCHEN`, `AST-GW-01` | **Incident Ingress:** VPN connection from external IP `198.51.100.44` using bypass token. Session `SES_20261014_9102` created. | `03_authentication_events.csv` | `AUTH-20261014-013` | Direct Evidence |
| **2026-10-14 01:18:05** | `USR_0142_MCHEN`, `AST-WRK-088` | **Internal Pivot:** SSH connection from VPN GW to staging node `AST-WRK-088` under session `SES_20261014_9102`. | `03_authentication_events.csv` | `AUTH-20261014-014` | Direct Evidence |
| **2026-10-14 01:28:45** | `AST-WRK-088`, `USR_0142_MCHEN` | Staging script `/tmp/.scratch_env/proc_sync_snapshot.sh` executed. | `05_endpoint_events.csv` | `EPT-8841` | Direct Evidence |
| **2026-10-14 01:45:00** | `SVC_NIGHTLY_BACKUP`, `AST-SRV-04` | Scheduled automated backup begins; accesses `RES_METRIC_STORE`. | `03_authentication_events.csv` | `AUTH-20261014-015` | Benign Decoy |
| **2026-10-14 01:50:12** | `AST-SRV-04`, `AST-SRV-09` | Backup service transfers 891 MB to internal vault `10.40.5.20:873` (rsync). | `04_network_connections.csv` | `NET-77301` | Benign Decoy |
| **2026-10-14 01:55:12** | `AST-WRK-088`, `AST-SRV-01` | Unauthorized SMB connection attempted against DC; blocked by access controls. | `03_authentication_events.csv` | `AUTH-20261014-016` | Direct Evidence |
| **2026-10-14 01:58:30** | `USR_0142_MCHEN`, `RES_FINANCIAL_PAYROLL` | Unauthorized query attempt against financial table on `AST-SRV-04`; permission denied. | `06_data_access_audit.csv` | `ACC-88315` | Direct Evidence |
| **2026-10-14 02:04:40** | `USR_0142_MCHEN`, `AST-SRV-04` | Database connection authenticated from `AST-WRK-088` to `AST-SRV-04`. | `03_authentication_events.csv` | `AUTH-20261014-017` | Direct Evidence |
| **2026-10-14 02:05:11** | `USR_0142_MCHEN`, `RES_GENOME_CORE_DB` | **Data Extraction:** `SELECT_EXPORT` executes on core genomic database, extracting 4,200 records. | `06_data_access_audit.csv` | `ACC-88319` | Direct Evidence |
| **2026-10-14 02:05:40** | `AST-WRK-088` | Compressed archive `/tmp/.scratch_env/core_gen_dump.tar.gz` created. | `05_endpoint_events.csv` | `EPT-8843` | Direct Evidence |
| **2026-10-14 02:34:18** | `AST-WRK-088`, `203.0.113.89` | **Network Egress:** 21,438,200 bytes transmitted outbound over TLS to external host `203.0.113.89:443`. | `04_network_connections.csv` | `NET-77402` | Direct Evidence |
| **2026-10-14 02:48:30** | `AST-WRK-088` | Archive file deleted from `/tmp/.scratch_env/` in cleanup attempt. | `05_endpoint_events.csv` | `EPT-8845` | Direct Evidence |
| **2026-10-14 02:49:10** | `USR_0142_MCHEN`, `AST-GW-01` | Session `SES_20261014_9102` terminated cleanly. | `03_authentication_events.csv` | `AUTH-20261014-018` | Direct Evidence |
| **2026-10-14 08:30:00** | `AST-SRV-04`, `TCK-2026-0925` | SIEM creates alert ticket referencing 01:50 UTC 891 MB backup transfer due to ingestion lag. | `07_incident_tickets.csv` | `TCK-2026-0925` | Direct Evidence (Decoy Alert) |
| **2026-10-14 09:45:00** | `AST-WRK-088`, `TCK-2026-0926` | SOC Analyst flags off-hours session from `198.51.100.44`; begins formal triage. | `07_incident_tickets.csv` | `TCK-2026-0926` | Direct Evidence |

---

## C. Entity Relationship Graph

```
[198.51.100.44 (External IP)]
         │ AUTH-20261014-013 (VPN Ingress)
         ▼
    [AST-GW-01] 
         │ AUTH-20261014-014 (SSH Internal Pivot, Session SES_20261014_9102)
         ▼
   [AST-WRK-088] (Compromised Staging Node)
     │       │
     │       ├─ EPT-8841 (proc_sync_snapshot.sh)
     │       ├─ ACC-88319 / EPT-8842 (Queries AST-SRV-04 -> RES_GENOME_CORE_DB)
     │       │       │
     │       │       ▼
     │       │   [AST-SRV-04 (Database Server)]
     │       │       └── [RES_GENOME_CORE_DB] (4,200 records extracted)
     │       │
     │       └─ NET-77402 / EPT-8844 (curl outbound TLS, 21.4 MB)
     ▼
[203.0.113.89:443 (External Drop Host)]
```

### Edge Definitions
1. **`198.51.100.44` -> `AUTHENTICATED_TO` -> `AST-GW-01`**
   - **Supporting Records:** `AUTH-20261014-013`, `NET-77201`, `EVD-004`.
   - **Type:** Direct Evidence.
   - **Limitations:** Geolocation / IP ownership masks the physical human operator.
2. **`USR_0142_MCHEN` -> `UTILIZED_SESSION` -> `SES_20261014_9102`**
   - **Supporting Records:** `AUTH-20261014-013`, `AUTH-20261014-014`, `TCK-2026-0912`.
   - **Type:** Direct Evidence (Identity context claim).
   - **Limitations:** Evidence cannot distinguish between voluntary insider action versus credential theft/compromise.
3. **`AST-GW-01` -> `PIVOTED_TO` -> `AST-WRK-088`**
   - **Supporting Records:** `AUTH-20261014-014`, `NET-77205`, `EVD-005`.
   - **Type:** Direct Evidence.
   - **Limitations:** Internal jump traffic masks raw external origin at the Linux SSH layer.
4. **`AST-WRK-088` -> `EXTRACTED_DATA` -> `AST-SRV-04:RES_GENOME_CORE_DB`**
   - **Supporting Records:** `AUTH-20261014-017`, `ACC-88319`, `EPT-8842`, `EPT-8843`, `NET-77350`.
   - **Type:** Direct Evidence.
   - **Limitations:** Database audit confirms row count (4,200), but does not inspect post-query file manipulation.
5. **`AST-WRK-088` -> `EGRESS_CONNECTION` -> `203.0.113.89:443`**
   - **Supporting Records:** `NET-77402`, `EPT-8844`, `EVD-013`, `EVD-018`.
   - **Type:** Direct Evidence.
   - **Limitations:** TLS encryption prevents packet payload decryption. Correlation with the 4,200 records is an inference based on timestamp, session ID, volume (~21.4 MB), and endpoint curl invocation.

---

## D. Key Evidence Chain (Minimum Set of Records)

The entire primary conclusion can be proven with this tight, 8-record cross-file chain:

1. **`07_incident_tickets.csv: TCK-2026-0912`**: Establishes that Dr. Marcus Chen misplaced his hardware token and was granted an expedited temporary bypass token on Oct 13 at 17:05 UTC prior to travel.
2. **`03_authentication_events.csv: AUTH-20261014-013`**: Connects Dr. Chen's identity and the bypass token to an off-hours login from external IP `198.51.100.44` establishing session `SES_20261014_9102` at 01:14:22 UTC.
3. **`03_authentication_events.csv: AUTH-20261014-014`**: Proves session `SES_20261014_9102` pivoted directly to staging workstation `AST-WRK-088` at 01:18:05 UTC.
4. **`05_endpoint_events.csv: EPT-8841`**: Shows the execution of unmanaged batch script `/tmp/.scratch_env/proc_sync_snapshot.sh` on `AST-WRK-088` under `SES_20261014_9102` at 01:28:45 UTC.
5. **`06_data_access_audit.csv: ACC-88319`**: Records the extraction (`SELECT_EXPORT`) of 4,200 sequence rows from `RES_GENOME_CORE_DB` on `AST-SRV-04` under `SES_20261014_9102` at 02:05:11 UTC.
6. **`05_endpoint_events.csv: EPT-8843`**: Correlates the creation of staging archive `/tmp/.scratch_env/core_gen_dump.tar.gz` on `AST-WRK-088` 29 seconds after the database query.
7. **`04_network_connections.csv: NET-77402`**: Records the 21.4 MB outbound TLS transfer from `AST-WRK-088` to external test IP `203.0.113.89:443` under `SES_20261014_9102` at 02:34:18 UTC.
8. **`05_endpoint_events.csv: EPT-8845`**: Shows the deletion of the staging archive at 02:48:30 UTC right before session disconnect (`AUTH-20261014-018`).

---

## E. Benign Alternative Explanations & Defeating Evidence

### Alternative Hypothesis 1: "The 891 MB transfer from AST-SRV-04 was a massive data breach"
- **Apparent Support:** SIEM ticket `TCK-2026-0925` flags an alert for bulk off-hours data transfer (890 MB) on `AST-SRV-04` at 01:50:12 UTC. Network flow `NET-77301` shows 891,240,000 bytes transmitted.
- **Why It Fails:** 
  - Destination IP in `NET-77301` is `10.40.5.20`, which `02_asset_inventory.csv` identifies as `AST-SRV-09` (internal `backup-vault01`).
  - Authentication event `AUTH-20261014-015` and data audit `ACC-88310` show this was initiated by service account `SVC_NIGHTLY_BACKUP` targeting `RES_METRIC_STORE`, not genomic data.
  - `08_evidence_registry.csv: EVD-024` explicitly documents that the SIEM correlation rule misidentified ingestion time and internal backup flows.

### Alternative Hypothesis 2: "Dr. Marcus Chen was legitimately doing urgent research from his hotel"
- **Apparent Support:** Dr. Chen is authorized to access `AST-WRK-088` and `RES_GENOME_CORE_DB`. He requested travel access in `TCK-2026-0912`.
- **Why It Weakens:**
  - The session executed batch scripts from a hidden directory `/tmp/.scratch_env/` rather than standard lab tools (e.g., RStudio / Nextflow pipelines).
  - Attempted unauthorized privilege escalation / share enumeration against Domain Controller `AST-SRV-01` (`AUTH-20261014-016`) and queried payroll data (`ACC-88315`), which has no bearing on computational biology.
  - Exfiltrated the dump to an unapproved external IP address `203.0.113.89` via raw `curl` rather than institutional repositories.
  - Deleted the scratch files immediately prior to logout (`EPT-8845`).

---

## F. Deliberate Decoys & Benign Anomalies

1. **External Scanner Brute Force (`192.0.2.115`):**
   - Events `AUTH-20261013-008` to `010` show repeated password guesses targeting `USR_0012_ADMIN` and `USR_0001_ROOT`.
   - *Resolution:* All attempts returned `ACCOUNT_DISABLED`. No session was established. Ticket `TCK-2026-0918` confirms firewall automated shun. This was routine background internet scanner noise.
2. **Dr. Elena Kim Overseas Session (`SES_20261013_8801`):**
   - Off-hours login from Tokyo IP `198.51.100.12` to `AST-GW-01` at 19:30:12 UTC (`AUTH-20261013-006`).
   - *Resolution:* Multi-factor authentication with client certificate succeeded; connected cleanly to assigned desktop `AST-WRK-102` (`AUTH-20261013-007`); performed ordinary manuscript review; no anomalous scripts, database exports, or external file transfers.
3. **Nextflow Memory Spike on `AST-WRK-088` (`TCK-2026-0908`):**
   - High memory alert on `AST-WRK-088` on the afternoon of Oct 13.
   - *Resolution:* Generated by Rohan Jain's legitimate daytime batch job `EPT-8801`. Unrelated to the overnight breach.

---

## G. Unresolved Uncertainties (Known Unknowns)

An analyst or automated intelligence system MUST explicitly acknowledge these limitations:

1. **State of Dr. Marcus Chen's Culpability:** The records cannot determine whether Dr. Chen intentionally leaked credentials, fell victim to phishing, had his laptop stolen in transit, or had his session token hijacked.
2. **Plaintext Payload Verification of `NET-77402`:** Because the outbound flow to `203.0.113.89:443` was encrypted with TLS and no SSL inspection was active on the staging worker, network logs record only byte counts (21.4 MB). The conclusion that this payload contained the 4,200 exported genomic records is a high-probability inference supported by endpoint correlation, not a decrypted byte-for-byte certainty.
3. **Integrity / Usability of Exfiltrated Data:** It is unknown whether the recipient server at `203.0.113.89` successfully reassembled or processed the uploaded `.tar.gz` archive.

---

## H. Expected Investigator Narrative Report (Gold Standard Model)

> **EXECUTIVE SUMMARY:**
> Between 01:14 UTC and 02:49 UTC on October 14, 2026, an unauthorized intrusion compromised the user account of Dr. Marcus Chen (`USR_0142_MCHEN`) using an expedited temporary VPN bypass token issued prior to travel.
>
> **TIMELINE & LATERAL MOVEMENT:**
> The adversary connected to Northstar's VPN Gateway (`AST-GW-01`) from external IP `198.51.100.44` (session `SES_20261014_9102`), then pivoted internally to shared staging node `AST-WRK-088`. On the staging node, the adversary executed staging script `/tmp/.scratch_env/proc_sync_snapshot.sh`, probed Domain Controller `AST-SRV-01` (denied), and attempted to query payroll records (denied).
>
> **RESOURCE EXTRACTION & EGRESS:**
> At 02:05:11 UTC, the session queried core genomic sequence table `RES_GENOME_CORE_DB` on database server `AST-SRV-04`, extracting 4,200 records. Endpoint logs confirm these records were compressed into `/tmp/.scratch_env/core_gen_dump.tar.gz`. At 02:34:18 UTC, 21.4 MB was transmitted outbound over TLS to external host `203.0.113.89:443` via `curl`. The staging file was deleted at 02:48:30 UTC prior to VPN disconnect.
>
> **DECOY RECONCILIATION:**
> A SIEM alert (`TCK-2026-0925`) flagging an 891 MB transfer from `AST-SRV-04` at 01:50 UTC was investigated and determined to be an authorized, scheduled nightly backup to `AST-SRV-09` by service account `SVC_NIGHTLY_BACKUP`. Similarly, external brute force probes from `192.0.2.115` were blocked by firewall controls and did not penetrate internal systems.
>
> **REMAINING UNKNOWNS:**
> While circumstantial and temporal correlation strongly indicates the 21.4 MB egress payload contained the exported genomic records, TLS encryption prevents payload inspection. Furthermore, forensic logs cannot establish whether Dr. Chen's credentials were stolen or voluntarily disclosed.

---

## I. Structured Expected Findings

### Verified Facts (Direct Evidence)
- **F1:** Temporary VPN bypass token was issued to `USR_0142_MCHEN` in ticket `TCK-2026-0912`.
- **F2:** Session `SES_20261014_9102` authenticated from `198.51.100.44` to `AST-GW-01` at 01:14:22 UTC (`AUTH-20261014-013`).
- **F3:** Session `SES_20261014_9102` pivoted to `AST-WRK-088` via SSH at 01:18:05 UTC (`AUTH-20261014-014`).
- **F4:** Script `proc_sync_snapshot.sh` executed on `AST-WRK-088` at 01:28:45 UTC (`EPT-8841`).
- **F5:** 4,200 records exported from `RES_GENOME_CORE_DB` on `AST-SRV-04` at 02:05:11 UTC (`ACC-88319`).
- **F6:** Outbound connection `NET-77402` transmitted 21,438,200 bytes from `AST-WRK-088` to `203.0.113.89:443` at 02:34:18 UTC under `SES_20261014_9102`.
- **F7:** Scratch archive deleted at 02:48:30 UTC (`EPT-8845`) and VPN session logged out at 02:49:10 UTC (`AUTH-20261014-018`).
- **F8:** The 891 MB transfer was internal backup traffic to `AST-SRV-09` by `SVC_NIGHTLY_BACKUP` (`NET-77301`, `ACC-88310`).

### Defensible Inferences
- **I1:** The actor on session `SES_20261014_9102` was not Dr. Marcus Chen operating normally, supported by off-hours timing, non-standard staging directories, unauthorized DC / payroll probing, and external egress.
- **I2:** The 21.4 MB egress to `203.0.113.89` represented the compressed 4,200 records from `RES_GENOME_CORE_DB`, supported by temporal sequence, curl command `EPT-8844`, file creation `EPT-8843`, and matching session IDs.

### Hypotheses Requiring Outside Corroboration
- **H1:** Dr. Marcus Chen's travel bypass token was intercepted in transit (airport Wi-Fi, phishing, or physical device access).
- **H2:** The destination IP `203.0.113.89` is an external drop server or adversary-controlled VPS.

### Explicit Unknowns
- **U1:** Exact unencrypted contents of the TLS egress connection `NET-77402`.
- **U2:** Identity or location of the physical person operating behind `198.51.100.44`.
- **U3:** Whether Dr. Marcus Chen had any willful involvement.
