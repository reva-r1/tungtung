# Operation Glass Lantern — Validation Audit Report
Generated: 2026-10-17T06:28:21.275Z

## Check 1: File Existence and CSV Parsing
  [PASS] File exists: investigation/01_identity_directory.csv
  [PASS] 01_identity_directory.csv parsed successfully (25 rows)
  [PASS] File exists: investigation/02_asset_inventory.csv
  [PASS] 02_asset_inventory.csv parsed successfully (22 rows)
  [PASS] File exists: investigation/03_authentication_events.csv
  [PASS] 03_authentication_events.csv parsed successfully (45 rows)
  [PASS] File exists: investigation/04_network_connections.csv
  [PASS] 04_network_connections.csv parsed successfully (50 rows)
  [PASS] File exists: investigation/05_endpoint_events.csv
  [PASS] 05_endpoint_events.csv parsed successfully (42 rows)
  [PASS] File exists: investigation/06_data_access_audit.csv
  [PASS] 06_data_access_audit.csv parsed successfully (38 rows)
  [PASS] File exists: investigation/07_incident_tickets.csv
  [PASS] 07_incident_tickets.csv parsed successfully (14 rows)
  [PASS] File exists: investigation/08_evidence_registry.csv
  [PASS] 08_evidence_registry.csv parsed successfully (32 rows)

## Check 2: Header Structure & Required Columns
  [PASS] 01_identity_directory.csv headers are unique
  [PASS] 01_identity_directory.csv has all required columns (missing: none)
  [PASS] 02_asset_inventory.csv headers are unique
  [PASS] 02_asset_inventory.csv has all required columns (missing: none)
  [PASS] 03_authentication_events.csv headers are unique
  [PASS] 03_authentication_events.csv has all required columns (missing: none)
  [PASS] 04_network_connections.csv headers are unique
  [PASS] 04_network_connections.csv has all required columns (missing: none)
  [PASS] 05_endpoint_events.csv headers are unique
  [PASS] 05_endpoint_events.csv has all required columns (missing: none)
  [PASS] 06_data_access_audit.csv headers are unique
  [PASS] 06_data_access_audit.csv has all required columns (missing: none)
  [PASS] 07_incident_tickets.csv headers are unique
  [PASS] 07_incident_tickets.csv has all required columns (missing: none)
  [PASS] 08_evidence_registry.csv headers are unique
  [PASS] 08_evidence_registry.csv has all required columns (missing: none)

## Check 3: Primary Key Uniqueness
  [PASS] 01_identity_directory.csv primary key 'identity_id' is 100% unique (25/25)
  [PASS] 02_asset_inventory.csv primary key 'asset_id' is 100% unique (22/22)
  [PASS] 03_authentication_events.csv primary key 'auth_event_id' is 100% unique (45/45)
  [PASS] 04_network_connections.csv primary key 'network_event_id' is 100% unique (50/50)
  [PASS] 05_endpoint_events.csv primary key 'endpoint_event_id' is 100% unique (42/42)
  [PASS] 06_data_access_audit.csv primary key 'access_event_id' is 100% unique (38/38)
  [PASS] 07_incident_tickets.csv primary key 'ticket_id' is 100% unique (14/14)
  [PASS] 08_evidence_registry.csv primary key 'evidence_id' is 100% unique (32/32)

## Check 4: Cross-File Referential Integrity
  [PASS] 03_authentication_events.csv: all identity_ids exist in directory (0 invalid)
  [PASS] 03_authentication_events.csv: all destination_asset_ids exist in asset inventory (0 invalid)
  [PASS] 04_network_connections.csv: all assets exist in inventory or are tagged EXTERNAL
  [PASS] 05_endpoint_events.csv: all asset_ids and identity_ids resolve correctly
  [PASS] 06_data_access_audit.csv: all asset_ids and identity_ids resolve correctly
  [PASS] 08_evidence_registry.csv: all source_file and source_record_id references exist in the dataset

## Check 5: ISO 8601 UTC Timestamp Formatting
  [PASS] All *_utc timestamp fields conform to ISO 8601 UTC ('YYYY-MM-DDTHH:MM:SSZ')

## Check 6: Numeric Value Validity
  [PASS] All numeric telemetry columns (bytes_sent, bytes_received, port, record_count) are valid integers

## Check 7: IP Address Sanitization & Compliance
  [PASS] All IP addresses belong strictly to documentation (RFC 5737) or private (RFC 1918) blocks

## Check 8: Airgap and Blindness Verification
  [PASS] No answer-key or rubric files exist inside investigation/
  [PASS] No ground truth or answer-key terminology leaked in investigation package

## Check 9: Sealed Package Integrity
  [PASS] Sealed answer-key.md exists
  [PASS] Sealed scoring-rubric.md exists
  [PASS] All core records referenced in answer-key.md exist in the investigation dataset

## Record Count Summary
  - 01_identity_directory.csv: 25 rows
  - 02_asset_inventory.csv: 22 rows
  - 03_authentication_events.csv: 45 rows
  - 04_network_connections.csv: 50 rows
  - 05_endpoint_events.csv: 42 rows
  - 06_data_access_audit.csv: 38 rows
  - 07_incident_tickets.csv: 14 rows
  - 08_evidence_registry.csv: 32 rows
  - TOTAL RECORDS: 268 rows across 8 files

---
**Summary:** ALL VALIDATION CHECKS PASSED PERFECTLY.
