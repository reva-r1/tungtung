# Operation Glass Lantern — Investigation Data Package Specification
## Northstar Research Group Synthetic Investigation Dataset

---

## 1. Case Overview & Briefing

### Initial Incident Briefing
> A fictional organization called **Northstar Research Group** has reported unusual activity across several internal systems.
>
> An account was used in an unexpected context. Subsequent records indicate activity involving internal assets, access to a protected resource, and unusual network communication. The organization needs to reconstruct the sequence of events, identify the affected assets and identities, determine what the records establish, and identify what remains uncertain.

### Nature of Data
This dataset is **100% synthetic**. All identities, server hostnames, IP addresses, organizational units, and event identifiers are fictional constructs generated for testing defensive digital forensics, entity resolution, and timeline correlation capabilities.
- IP addresses use documentation-reserved ranges per RFC 5737 (`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) and private RFC 1918 space (`10.40.0.0/16`).
- No actual production credentials, personal data, or operational exploits are included.

---

## 2. Investigation Package Contents

The `investigation/` directory contains eight core tabular CSV files:

| File Name | Purpose | Primary Key | Key Join Fields |
| :--- | :--- | :--- | :--- |
| `01_identity_directory.csv` | Active Directory / LDAP identity catalog | `identity_id` | `authorized_asset_ids` |
| `02_asset_inventory.csv` | CMDB / Asset inventory and network zones | `asset_id` | `owner_identity_id` |
| `03_authentication_events.csv` | VPN, Kerberos, SSH, and DB auth logs | `auth_event_id` | `identity_id`, `destination_asset_id`, `session_id` |
| `04_network_connections.csv` | Zeek flow telemetry & NetFlow v9 records | `network_event_id` | `source_asset_id`, `destination_asset_id`, `session_id` |
| `05_endpoint_events.csv` | Linux Auditd & Sysmon process execution | `endpoint_event_id` | `asset_id`, `identity_id`, `session_id`, `related_resource_id` |
| `06_data_access_audit.csv` | PostgreSQL database audit records | `access_event_id` | `identity_id`, `session_id`, `asset_id`, `resource_id` |
| `07_incident_tickets.csv` | IT Helpdesk and SOC alert tickets | `ticket_id` | `affected_asset_id`, `related_record_ids` |
| `08_evidence_registry.csv` | Provenance, integrity status & sensor notes | `evidence_id` | `source_file`, `source_record_id` |

---

## 3. Detailed File Schemas

### 01 — `01_identity_directory.csv`
- **`identity_id`** *(string)*: Unique identifier for the account (e.g., `USR_0142_MCHEN`, `SVC_NIGHTLY_BACKUP`).
- **`display_name`** *(string)*: Full name or system service description.
- **`department`** *(string)*: Department or functional division.
- **`role`** *(string)*: Assigned functional title.
- **`authorized_asset_ids`** *(string)*: Semicolon-delimited list of asset IDs the identity is normally authorized to access.
- **`account_type`** *(string)*: `USER`, `ADMIN`, or `SERVICE`.
- **`account_status`** *(string)*: `ACTIVE` or `DISABLED`.
- **`valid_from_utc`** *(ISO 8601 UTC timestamp)*: Account provisioning timestamp.
- **`valid_until_utc`** *(ISO 8601 UTC timestamp)*: Account expiration timestamp.

### 02 — `02_asset_inventory.csv`
- **`asset_id`** *(string)*: Unique system identifier (e.g., `AST-GW-01`, `AST-SRV-04`, `AST-WRK-088`).
- **`asset_name`** *(string)*: FQDN or internal hostname.
- **`asset_type`** *(string)*: `VPN_GATEWAY`, `DOMAIN_CONTROLLER`, `DATABASE_SERVER`, `COMPUTE_NODE`, `WORKSTATION`, etc.
- **`owner_identity_id`** *(string)*: Primary administrator or custodian identity ID.
- **`network_zone`** *(string)*: Network tier (`DMZ_INGRESS`, `CORE_INFRA`, `RESTRICTED_DATA_VAULT`, `RESEARCH_LAB_LAN`, etc.).
- **`sensitivity`** *(string)*: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **`expected_role`** *(string)*: Functional architectural description.
- **`inventory_updated_at_utc`** *(ISO 8601 UTC timestamp)*: Last CMDB inventory review.

### 03 — `03_authentication_events.csv`
- **`auth_event_id`** *(string)*: Unique event ID (e.g., `AUTH-20261014-013`).
- **`event_time_utc`** *(ISO 8601 UTC timestamp)*: Sensor-observed event timestamp.
- **`ingested_at_utc`** *(ISO 8601 UTC timestamp)*: SIEM ingestion timestamp.
- **`identity_id`** *(string)*: Authenticating user or service identity.
- **`source_ip`** *(string)*: Originating IP address.
- **`destination_asset_id`** *(string)*: Target asset receiving the authentication request.
- **`session_id`** *(string)*: Unique logon session identifier (e.g., `SES_20261014_9102`).
- **`authentication_method`** *(string)*: `KERBEROS`, `SSH_PUBKEY`, `CERT_MFA_PUSH`, `PASSWORD_PLUS_MFA_BYPASS_TOKEN`, etc.
- **`result`** *(string)*: `SUCCESS`, `ACCOUNT_DISABLED`, `AUTH_DENIED_UNAUTHORIZED_TARGET`, etc.
- **`event_notes`** *(string)*: Supplemental log details.

### 04 — `04_network_connections.csv`
- **`network_event_id`** *(string)*: Unique network record ID (e.g., `NET-77402`).
- **`event_time_utc`** *(ISO 8601 UTC timestamp)*: Flow start timestamp.
- **`source_asset_id`** *(string)*: Originating asset ID (`AST-WRK-088`, etc.).
- **`destination_asset_id`** *(string)*: Destination asset ID or `EXTERNAL`.
- **`source_ip`** *(string)*: Originating IP address.
- **`destination_ip`** *(string)*: Destination IP address.
- **`destination_port`** *(integer)*: Destination TCP/UDP port number.
- **`protocol`** *(string)*: Protocol name (`TCP`, `UDP`).
- **`bytes_sent`** *(integer)*: Total payload bytes transmitted from source.
- **`bytes_received`** *(integer)*: Total payload bytes received from destination.
- **`session_id`** *(string)*: Associated session identifier when linkable.
- **`collection_source`** *(string)*: Sensor origin (`ZEEK_CONN_LOG`, `NETFLOW_V9`).

### 05 — `05_endpoint_events.csv`
- **`endpoint_event_id`** *(string)*: Unique endpoint event ID (e.g., `EPT-8841`).
- **`event_time_utc`** *(ISO 8601 UTC timestamp)*: Execution timestamp.
- **`asset_id`** *(string)*: Asset where execution occurred.
- **`identity_id`** *(string)*: Security principal context.
- **`session_id`** *(string)*: Associated logon session.
- **`process_event_type`** *(string)*: `PROCESS_START`, `SCRIPT_EXECUTE`, `FILE_CREATE`, `FILE_DELETE`, `FILE_READ`.
- **`process_name`** *(string)*: Executable command line or process invocation.
- **`related_resource_id`** *(string)*: Resource or asset accessed by the process.
- **`result`** *(string)*: Execution outcome (`SUCCESS`, `FAILED`).
- **`source_record_id`** *(string)*: Host sensor audit event reference.

### 06 — `06_data_access_audit.csv`
- **`access_event_id`** *(string)*: Unique audit event ID (e.g., `ACC-88319`).
- **`event_time_utc`** *(ISO 8601 UTC timestamp)*: Query execution timestamp.
- **`identity_id`** *(string)*: Authenticated database role / identity.
- **`session_id`** *(string)*: Associated logon session.
- **`asset_id`** *(string)*: Database server asset ID.
- **`resource_id`** *(string)*: Target database table or resource (`RES_GENOME_CORE_DB`, `RES_METRIC_STORE`).
- **`action`** *(string)*: `SELECT_QUERY`, `SELECT_EXPORT`, `DUMP_BACKUP`.
- **`record_count`** *(integer)*: Number of records returned or affected.
- **`result`** *(string)*: `SUCCESS`, `PERMISSION_DENIED`.
- **`audit_record_version`** *(string)*: Audit engine schema version.

### 07 — `07_incident_tickets.csv`
- **`ticket_id`** *(string)*: Unique ticket identifier (e.g., `TCK-2026-0912`).
- **`created_at_utc`** *(ISO 8601 UTC timestamp)*: Ticket creation timestamp.
- **`updated_at_utc`** *(ISO 8601 UTC timestamp)*: Ticket resolution/update timestamp.
- **`reporting_team`** *(string)*: Originating team (Helpdesk, SecOps, Lab).
- **`affected_asset_id`** *(string)*: Primary asset flagged in ticket.
- **`reported_event_time_utc`** *(ISO 8601 UTC timestamp)*: Timestamp of the phenomenon reported.
- **`incident_category`** *(string)*: Classification category.
- **`description`** *(string)*: Free-text narrative notes submitted by the reporter.
- **`status`** *(string)*: `OPEN`, `RESOLVED`, `CLOSED`, `INVESTIGATING`.
- **`related_record_ids`** *(string)*: Semicolon-delimited references to correlated event records.

### 08 — `08_evidence_registry.csv`
- **`evidence_id`** *(string)*: Unique evidence tracking ID (`EVD-001`, etc.).
- **`source_file`** *(string)*: Name of the originating CSV file.
- **`source_record_id`** *(string)*: Primary key in the originating file.
- **`source_system`** *(string)*: Originating logging or management system.
- **`collected_at_utc`** *(ISO 8601 UTC timestamp)*: Evidence snapshot timestamp.
- **`integrity_status`** *(string)*: Cryptographic or transmission verification state.
- **`timestamp_quality`** *(string)*: Sensor clock source precision (`NTP_SYNCHRONIZED`, `HIGH_PRECISION_HARDWARE_STAMP`, `SIEM_INGESTION_TIMESTAMP`, `WEB_APPLICATION_CLOCK`).
- **`known_limitation`** *(string)*: Technical constraints or caveat regarding this record.
- **`notes`** *(string)*: Contextual notes for digital forensics analysis.

---

## 4. Analytical Guidelines

1. **Multi-Source Correlation:** No individual record or single CSV file is sufficient to reconstruct the full sequence. Conclusions should be synthesized by joining across authentication, asset inventory, endpoint telemetry, database audits, network flows, and tickets.
2. **Session Tracing:** Session identifiers (`session_id`) bridge authentication, endpoint commands, and network telemetry across different hosts.
3. **Event Time vs. Ingestion Time:** Pay strict attention to timestamp semantics. Do not confuse `ingested_at_utc` or ticket creation times with real-world `event_time_utc`.
4. **Distinguish Facts from Inferences:** A database query records rows selected; it does not prove egress. A network flow records transmitted bytes; it does not prove the unencrypted contents of a TLS payload. Clearly articulate known evidence versus defensible inferences.
