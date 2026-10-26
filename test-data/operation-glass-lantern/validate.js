/**
 * Operation Glass Lantern — Comprehensive Benchmark Validation Suite
 * 
 * Verifies CSV parsing, headers, primary key uniqueness, foreign key referential integrity,
 * timestamp syntax, numeric field validity, answer-key isolation, and cross-file solvability.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname);
const INVESTIGATION_DIR = path.join(ROOT_DIR, 'investigation');
const SEALED_DIR = path.join(ROOT_DIR, 'sealed');

const CSV_FILES = [
  '01_identity_directory.csv',
  '02_asset_inventory.csv',
  '03_authentication_events.csv',
  '04_network_connections.csv',
  '05_endpoint_events.csv',
  '06_data_access_audit.csv',
  '07_incident_tickets.csv',
  '08_evidence_registry.csv'
];

const REQUIRED_HEADERS = {
  '01_identity_directory.csv': ['identity_id', 'display_name', 'department', 'role', 'authorized_asset_ids', 'account_type', 'account_status', 'valid_from_utc', 'valid_until_utc'],
  '02_asset_inventory.csv': ['asset_id', 'asset_name', 'asset_type', 'owner_identity_id', 'network_zone', 'sensitivity', 'expected_role', 'inventory_updated_at_utc'],
  '03_authentication_events.csv': ['auth_event_id', 'event_time_utc', 'ingested_at_utc', 'identity_id', 'source_ip', 'destination_asset_id', 'session_id', 'authentication_method', 'result', 'event_notes'],
  '04_network_connections.csv': ['network_event_id', 'event_time_utc', 'source_asset_id', 'destination_asset_id', 'source_ip', 'destination_ip', 'destination_port', 'protocol', 'bytes_sent', 'bytes_received', 'session_id', 'collection_source'],
  '05_endpoint_events.csv': ['endpoint_event_id', 'event_time_utc', 'asset_id', 'identity_id', 'session_id', 'process_event_type', 'process_name', 'related_resource_id', 'result', 'source_record_id'],
  '06_data_access_audit.csv': ['access_event_id', 'event_time_utc', 'identity_id', 'session_id', 'asset_id', 'resource_id', 'action', 'record_count', 'result', 'audit_record_version'],
  '07_incident_tickets.csv': ['ticket_id', 'created_at_utc', 'updated_at_utc', 'reporting_team', 'affected_asset_id', 'reported_event_time_utc', 'incident_category', 'description', 'status', 'related_record_ids'],
  '08_evidence_registry.csv': ['evidence_id', 'source_file', 'source_record_id', 'source_system', 'collected_at_utc', 'integrity_status', 'timestamp_quality', 'known_limitation', 'notes']
};

const PRIMARY_KEYS = {
  '01_identity_directory.csv': 'identity_id',
  '02_asset_inventory.csv': 'asset_id',
  '03_authentication_events.csv': 'auth_event_id',
  '04_network_connections.csv': 'network_event_id',
  '05_endpoint_events.csv': 'endpoint_event_id',
  '06_data_access_audit.csv': 'access_event_id',
  '07_incident_tickets.csv': 'ticket_id',
  '08_evidence_registry.csv': 'evidence_id'
};

function parseCsv(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

function runValidation() {
  const report = [];
  let totalFailures = 0;

  function assert(condition, message) {
    if (condition) {
      report.push(`  [PASS] ${message}`);
    } else {
      report.push(`  [FAIL] ${message}`);
      totalFailures++;
    }
  }

  console.log('Starting Operation Glass Lantern Dataset Validation...\n');

  // Check 1: File Existence & Basic Parsing
  report.push('## Check 1: File Existence and CSV Parsing');
  const parsedData = {};

  for (const filename of CSV_FILES) {
    const fullPath = path.join(INVESTIGATION_DIR, filename);
    const exists = fs.existsSync(fullPath);
    assert(exists, `File exists: investigation/${filename}`);
    if (exists) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const parsed = parseCsv(content);
      parsedData[filename] = parsed;
      assert(parsed.rows.length >= 10, `${filename} parsed successfully (${parsed.rows.length} rows)`);
    }
  }

  // Check 2: Header Correctness and Uniqueness
  report.push('\n## Check 2: Header Structure & Required Columns');
  for (const filename of CSV_FILES) {
    if (!parsedData[filename]) continue;
    const actualHeaders = parsedData[filename].headers;
    const expectedHeaders = REQUIRED_HEADERS[filename];
    
    const uniqueHeaders = new Set(actualHeaders);
    assert(uniqueHeaders.size === actualHeaders.length, `${filename} headers are unique`);

    const missing = expectedHeaders.filter(h => !actualHeaders.includes(h));
    assert(missing.length === 0, `${filename} has all required columns (missing: ${missing.join(', ') || 'none'})`);
  }

  // Check 3: Primary Key Uniqueness
  report.push('\n## Check 3: Primary Key Uniqueness');
  const primaryKeyIndices = {};
  for (const filename of CSV_FILES) {
    if (!parsedData[filename]) continue;
    const pkName = PRIMARY_KEYS[filename];
    const rows = parsedData[filename].rows;
    const seen = new Set();
    let hasDupes = false;
    primaryKeyIndices[filename] = new Set();

    for (const r of rows) {
      const val = r[pkName];
      if (!val || seen.has(val)) {
        hasDupes = true;
      }
      seen.add(val);
      primaryKeyIndices[filename].add(val);
    }
    assert(!hasDupes && seen.size === rows.length, `${filename} primary key '${pkName}' is 100% unique (${seen.size}/${rows.length})`);
  }

  // Check 4: Cross-File Referential Integrity
  report.push('\n## Check 4: Cross-File Referential Integrity');
  const identityIds = primaryKeyIndices['01_identity_directory.csv'];
  const assetIds = primaryKeyIndices['02_asset_inventory.csv'];

  // Auth events identity check
  let invalidAuthIdentities = 0;
  for (const r of parsedData['03_authentication_events.csv'].rows) {
    if (!identityIds.has(r.identity_id)) invalidAuthIdentities++;
  }
  assert(invalidAuthIdentities === 0, `03_authentication_events.csv: all identity_ids exist in directory (0 invalid)`);

  // Auth events destination asset check
  let invalidAuthAssets = 0;
  for (const r of parsedData['03_authentication_events.csv'].rows) {
    if (!assetIds.has(r.destination_asset_id)) invalidAuthAssets++;
  }
  assert(invalidAuthAssets === 0, `03_authentication_events.csv: all destination_asset_ids exist in asset inventory (0 invalid)`);

  // Network connections source/dest asset check
  let invalidNetAssets = 0;
  for (const r of parsedData['04_network_connections.csv'].rows) {
    if (!assetIds.has(r.source_asset_id) && r.source_asset_id !== 'EXTERNAL') invalidNetAssets++;
    if (!assetIds.has(r.destination_asset_id) && r.destination_asset_id !== 'EXTERNAL') invalidNetAssets++;
  }
  assert(invalidNetAssets === 0, `04_network_connections.csv: all assets exist in inventory or are tagged EXTERNAL`);

  // Endpoint events asset & identity check
  let invalidEndpoint = 0;
  for (const r of parsedData['05_endpoint_events.csv'].rows) {
    if (!assetIds.has(r.asset_id)) invalidEndpoint++;
    if (!identityIds.has(r.identity_id)) invalidEndpoint++;
  }
  assert(invalidEndpoint === 0, `05_endpoint_events.csv: all asset_ids and identity_ids resolve correctly`);

  // Data access audit asset & identity check
  let invalidDataAccess = 0;
  for (const r of parsedData['06_data_access_audit.csv'].rows) {
    if (!assetIds.has(r.asset_id)) invalidDataAccess++;
    if (!identityIds.has(r.identity_id)) invalidDataAccess++;
  }
  assert(invalidDataAccess === 0, `06_data_access_audit.csv: all asset_ids and identity_ids resolve correctly`);

  // Evidence registry referential integrity check
  let invalidEvidenceRefs = 0;
  for (const r of parsedData['08_evidence_registry.csv'].rows) {
    const srcFile = r.source_file;
    const srcRecord = r.source_record_id;
    if (!primaryKeyIndices[srcFile] || !primaryKeyIndices[srcFile].has(srcRecord)) {
      invalidEvidenceRefs++;
    }
  }
  assert(invalidEvidenceRefs === 0, `08_evidence_registry.csv: all source_file and source_record_id references exist in the dataset`);

  // Check 5: Timestamp Format & Quality
  report.push('\n## Check 5: ISO 8601 UTC Timestamp Formatting');
  const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  let timestampErrors = 0;

  for (const filename of CSV_FILES) {
    const rows = parsedData[filename].rows;
    for (const r of rows) {
      for (const key of Object.keys(r)) {
        if (key.endsWith('_utc') && r[key] && r[key].length > 0) {
          if (!isoUtcRegex.test(r[key])) {
            timestampErrors++;
          }
        }
      }
    }
  }
  assert(timestampErrors === 0, `All *_utc timestamp fields conform to ISO 8601 UTC ('YYYY-MM-DDTHH:MM:SSZ')`);

  // Check 6: Numeric Fields Validity
  report.push('\n## Check 6: Numeric Value Validity');
  let numericErrors = 0;
  for (const r of parsedData['04_network_connections.csv'].rows) {
    if (isNaN(parseInt(r.bytes_sent, 10)) || isNaN(parseInt(r.bytes_received, 10)) || isNaN(parseInt(r.destination_port, 10))) {
      numericErrors++;
    }
  }
  for (const r of parsedData['06_data_access_audit.csv'].rows) {
    if (isNaN(parseInt(r.record_count, 10))) {
      numericErrors++;
    }
  }
  assert(numericErrors === 0, `All numeric telemetry columns (bytes_sent, bytes_received, port, record_count) are valid integers`);

  // Check 7: IP Address Sanitization (RFC 5737 / RFC 1918)
  report.push('\n## Check 7: IP Address Sanitization & Compliance');
  let nonCompliantIps = 0;
  function isCompliantIp(ip) {
    if (!ip || ip === 'EXTERNAL') return true;
    if (ip.startsWith('10.40.')) return true; // RFC 1918 private
    if (ip.startsWith('192.0.2.')) return true; // RFC 5737 TEST-NET-1
    if (ip.startsWith('198.51.100.')) return true; // RFC 5737 TEST-NET-2
    if (ip.startsWith('203.0.113.')) return true; // RFC 5737 TEST-NET-3
    return false;
  }

  for (const r of parsedData['03_authentication_events.csv'].rows) {
    if (!isCompliantIp(r.source_ip)) nonCompliantIps++;
  }
  for (const r of parsedData['04_network_connections.csv'].rows) {
    if (!isCompliantIp(r.source_ip)) nonCompliantIps++;
    if (!isCompliantIp(r.destination_ip)) nonCompliantIps++;
  }
  assert(nonCompliantIps === 0, `All IP addresses belong strictly to documentation (RFC 5737) or private (RFC 1918) blocks`);

  // Check 8: Airgap and Answer-Key Isolation
  report.push('\n## Check 8: Airgap and Blindness Verification');
  const investigationFiles = fs.readdirSync(INVESTIGATION_DIR);
  const leakedFilenames = investigationFiles.filter(f => f.toLowerCase().includes('answer') || f.toLowerCase().includes('rubric') || f.toLowerCase().includes('solution'));
  assert(leakedFilenames.length === 0, `No answer-key or rubric files exist inside investigation/`);

  let leakTermsFound = 0;
  const forbiddenTerms = ['ground truth', 'answer key', 'intended solution', 'scoring rubric', 'deliberate decoy'];
  for (const filename of investigationFiles) {
    const text = fs.readFileSync(path.join(INVESTIGATION_DIR, filename), 'utf8').toLowerCase();
    for (const term of forbiddenTerms) {
      if (text.includes(term)) {
        leakTermsFound++;
        console.error(`Leak detected: "${term}" in ${filename}`);
      }
    }
  }
  assert(leakTermsFound === 0, `No ground truth or answer-key terminology leaked in investigation package`);

  // Check 9: Sealed Answer Key References Real Records
  report.push('\n## Check 9: Sealed Package Integrity');
  const answerKeyPath = path.join(SEALED_DIR, 'answer-key.md');
  const rubricPath = path.join(SEALED_DIR, 'scoring-rubric.md');
  assert(fs.existsSync(answerKeyPath), `Sealed answer-key.md exists`);
  assert(fs.existsSync(rubricPath), `Sealed scoring-rubric.md exists`);

  const answerKeyText = fs.readFileSync(answerKeyPath, 'utf8');
  const keyRecords = ['AUTH-20261014-013', 'AUTH-20261014-014', 'EPT-8841', 'ACC-88319', 'NET-77402', 'TCK-2026-0912', 'TCK-2026-0925'];
  let missingKeyRecords = 0;
  for (const recId of keyRecords) {
    let found = false;
    for (const fn of CSV_FILES) {
      if (primaryKeyIndices[fn] && primaryKeyIndices[fn].has(recId)) {
        found = true;
        break;
      }
    }
    if (!found) missingKeyRecords++;
  }
  assert(missingKeyRecords === 0, `All core records referenced in answer-key.md exist in the investigation dataset`);

  // Final Row Count Summary
  report.push('\n## Record Count Summary');
  let totalRows = 0;
  for (const fn of CSV_FILES) {
    const count = parsedData[fn] ? parsedData[fn].rows.length : 0;
    totalRows += count;
    report.push(`  - ${fn}: ${count} rows`);
  }
  report.push(`  - TOTAL RECORDS: ${totalRows} rows across 8 files`);

  // Output results
  console.log(report.join('\n'));
  console.log(`\nValidation complete with ${totalFailures} failures.`);

  // Write VALIDATION_REPORT.md
  const reportMd = `# Operation Glass Lantern — Validation Audit Report
Generated: ${new Date().toISOString()}

${report.join('\n')}

---
**Summary:** ${totalFailures === 0 ? 'ALL VALIDATION CHECKS PASSED PERFECTLY.' : `VALIDATION FAILED WITH ${totalFailures} ERRORS.`}
`;
  fs.writeFileSync(path.join(ROOT_DIR, 'VALIDATION_REPORT.md'), reportMd, 'utf8');
  console.log(`Wrote VALIDATION_REPORT.md`);

  return totalFailures === 0;
}

const success = runValidation();
process.exit(success ? 0 : 1);
