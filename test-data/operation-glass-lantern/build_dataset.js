/**
 * Operation Glass Lantern - Synthetic Cyber Incident Investigation Dataset Generator
 * 
 * Generates 8 coherent CSV datasets with strict referential integrity, consistent UTC timestamps,
 * RFC 5737 / RFC 1918 IP addresses, realistic background noise, decoys, and a cross-correlated incident chain.
 */

const fs = require('fs');
const path = require('path');

const INVESTIGATION_DIR = path.join(__dirname, 'investigation');

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function writeCsv(filename, headers, rows) {
  const filePath = path.join(INVESTIGATION_DIR, filename);
  const headerLine = headers.join(',');
  const rowLines = rows.map(row => headers.map(h => escapeCsv(row[h])).join(','));
  const content = [headerLine, ...rowLines].join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Wrote ${filename} (${rows.length} rows)`);
}

// =========================================================================
// 1. IDENTITY DIRECTORY (01_identity_directory.csv) - 25 rows
// =========================================================================
const identities = [
  {
    identity_id: 'USR_0142_MCHEN',
    display_name: 'Dr. Marcus Chen',
    department: 'Computational Biology',
    role: 'Senior Computational Biologist',
    authorized_asset_ids: 'AST-WRK-088;AST-WRK-101;AST-SRV-04',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2024-03-01T00:00:00Z',
    valid_until_utc: '2027-03-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0209_EKIM',
    display_name: 'Dr. Elena Kim',
    department: 'Genomics Research',
    role: 'Principal Geneticist',
    authorized_asset_ids: 'AST-WRK-102;AST-SRV-04',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-01-15T00:00:00Z',
    valid_until_utc: '2027-01-15T00:00:00Z'
  },
  {
    identity_id: 'USR_0055_RJAIN',
    display_name: 'Rohan Jain',
    department: 'Bioinformatics Engineering',
    role: 'Lead Bioinformatics Engineer',
    authorized_asset_ids: 'AST-WRK-012;AST-WRK-088;AST-SRV-04;AST-SRV-05',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-06-01T00:00:00Z',
    valid_until_utc: '2026-12-31T00:00:00Z'
  },
  {
    identity_id: 'USR_0331_SLOPEZ',
    display_name: 'Sofia Lopez',
    department: 'IT Infrastructure',
    role: 'Systems Administrator',
    authorized_asset_ids: 'AST-SRV-01;AST-SRV-02;AST-SRV-03;AST-SRV-04;AST-SRV-05;AST-SRV-09;AST-GW-01',
    account_type: 'ADMIN',
    account_status: 'ACTIVE',
    valid_from_utc: '2022-09-01T00:00:00Z',
    valid_until_utc: '2027-09-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0118_TWRIGHT',
    display_name: 'Thomas Wright',
    department: 'IT Helpdesk',
    role: 'Support Specialist',
    authorized_asset_ids: 'AST-WRK-014;AST-SRV-01',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2024-01-10T00:00:00Z',
    valid_until_utc: '2026-12-31T00:00:00Z'
  },
  {
    identity_id: 'USR_0088_ANWOSU',
    display_name: 'Dr. Amara Nwosu',
    department: 'Clinical Biomarkers',
    role: 'Staff Scientist',
    authorized_asset_ids: 'AST-WRK-103;AST-SRV-04',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2024-05-15T00:00:00Z',
    valid_until_utc: '2027-05-15T00:00:00Z'
  },
  {
    identity_id: 'USR_0177_DDUBOIS',
    display_name: 'Dr. Daniel Dubois',
    department: 'Structural Biology',
    role: 'Research Fellow',
    authorized_asset_ids: 'AST-WRK-105;AST-SRV-04',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2025-02-01T00:00:00Z',
    valid_until_utc: '2027-02-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0264_PVARMA',
    display_name: 'Pooja Varma',
    department: 'Data Operations',
    role: 'Database Engineer',
    authorized_asset_ids: 'AST-WRK-044;AST-SRV-04;AST-SRV-06',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-11-01T00:00:00Z',
    valid_until_utc: '2026-11-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0411_KBERG',
    display_name: 'Karin Berg',
    department: 'Information Security',
    role: 'SOC Analyst',
    authorized_asset_ids: 'AST-WRK-077;AST-SRV-08',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2024-08-01T00:00:00Z',
    valid_until_utc: '2027-08-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0103_JHALL',
    display_name: 'James Hall',
    department: 'Information Security',
    role: 'Security Architect',
    authorized_asset_ids: 'AST-WRK-078;AST-SRV-08;AST-GW-01',
    account_type: 'ADMIN',
    account_status: 'ACTIVE',
    valid_from_utc: '2022-04-01T00:00:00Z',
    valid_until_utc: '2027-04-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0512_LTANAKA',
    display_name: 'Dr. Lucas Tanaka',
    department: 'Molecular Pharmacology',
    role: 'Senior Investigator',
    authorized_asset_ids: 'AST-WRK-106;AST-SRV-04',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-04-15T00:00:00Z',
    valid_until_utc: '2026-12-31T00:00:00Z'
  },
  {
    identity_id: 'USR_0621_CHASHIM',
    display_name: 'Claire Hashim',
    department: 'Quality Assurance',
    role: 'Compliance Officer',
    authorized_asset_ids: 'AST-WRK-022;AST-SRV-07',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2024-02-15T00:00:00Z',
    valid_until_utc: '2027-02-15T00:00:00Z'
  },
  {
    identity_id: 'USR_0733_MZIMMER',
    display_name: 'Maximilian Zimmer',
    department: 'IT Infrastructure',
    role: 'Network Engineer',
    authorized_asset_ids: 'AST-WRK-033;AST-GW-01;AST-SW-01;AST-SW-02',
    account_type: 'ADMIN',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-08-10T00:00:00Z',
    valid_until_utc: '2026-08-10T00:00:00Z'
  },
  {
    identity_id: 'USR_0844_OSMITH',
    display_name: 'Olivia Smith',
    department: 'Bioinformatics Engineering',
    role: 'Pipeline Developer',
    authorized_asset_ids: 'AST-WRK-015;AST-WRK-088',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2025-01-05T00:00:00Z',
    valid_until_utc: '2027-01-05T00:00:00Z'
  },
  {
    identity_id: 'USR_0955_YPETROV',
    display_name: 'Yuri Petrov',
    department: 'Data Operations',
    role: 'Storage Administrator',
    authorized_asset_ids: 'AST-WRK-045;AST-SRV-06;AST-SRV-09',
    account_type: 'ADMIN',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-03-01T00:00:00Z',
    valid_until_utc: '2027-03-01T00:00:00Z'
  },
  {
    identity_id: 'SVC_NIGHTLY_BACKUP',
    display_name: 'Service: Automated Backup Runner',
    department: 'IT Infrastructure',
    role: 'Automated Backup Daemon',
    authorized_asset_ids: 'AST-SRV-04;AST-SRV-06;AST-SRV-09',
    account_type: 'SERVICE',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-01-01T00:00:00Z',
    valid_until_utc: '2028-01-01T00:00:00Z'
  },
  {
    identity_id: 'SVC_METRICS_TELEMETRY',
    display_name: 'Service: Cluster Monitoring Agent',
    department: 'IT Infrastructure',
    role: 'Telemetry Collector',
    authorized_asset_ids: 'AST-SRV-01;AST-SRV-02;AST-SRV-03;AST-SRV-04;AST-SRV-05;AST-SRV-06;AST-SRV-08;AST-SRV-09',
    account_type: 'SERVICE',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-01-01T00:00:00Z',
    valid_until_utc: '2028-01-01T00:00:00Z'
  },
  {
    identity_id: 'SVC_ETL_PIPELINE',
    display_name: 'Service: Genomic ETL Processor',
    department: 'Computational Biology',
    role: 'Automated Data Pipeline',
    authorized_asset_ids: 'AST-SRV-04;AST-SRV-05;AST-WRK-088',
    account_type: 'SERVICE',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-05-01T00:00:00Z',
    valid_until_utc: '2027-05-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0012_ADMIN',
    display_name: 'Built-in Domain Admin (Breakglass)',
    department: 'IT Infrastructure',
    role: 'Emergency Account',
    authorized_asset_ids: 'AST-SRV-01',
    account_type: 'ADMIN',
    account_status: 'DISABLED',
    valid_from_utc: '2022-01-01T00:00:00Z',
    valid_until_utc: '2025-01-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0001_ROOT',
    display_name: 'Legacy Appliance Root',
    department: 'IT Infrastructure',
    role: 'Legacy Maintenance Account',
    authorized_asset_ids: 'AST-GW-01',
    account_type: 'ADMIN',
    account_status: 'DISABLED',
    valid_from_utc: '2021-01-01T00:00:00Z',
    valid_until_utc: '2024-01-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0190_ALEE',
    display_name: 'Amanda Lee',
    department: 'Computational Biology',
    role: 'Bioinformatics Intern',
    authorized_asset_ids: 'AST-WRK-107',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2026-06-01T00:00:00Z',
    valid_until_utc: '2026-12-31T00:00:00Z'
  },
  {
    identity_id: 'USR_0288_BKAUFMAN',
    display_name: 'Benjamin Kaufman',
    department: 'Legal & Intellectual Property',
    role: 'Compliance Counsel',
    authorized_asset_ids: 'AST-WRK-055',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-10-01T00:00:00Z',
    valid_until_utc: '2027-10-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0399_NADEBAYO',
    display_name: 'Ngozi Adebayo',
    department: 'Clinical Biomarkers',
    role: 'Data Curator',
    authorized_asset_ids: 'AST-WRK-108;AST-SRV-04',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2024-09-01T00:00:00Z',
    valid_until_utc: '2027-09-01T00:00:00Z'
  },
  {
    identity_id: 'USR_0450_SSATO',
    display_name: 'Shota Sato',
    department: 'Genomics Research',
    role: 'Visiting Scientist',
    authorized_asset_ids: 'AST-WRK-109',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2026-01-01T00:00:00Z',
    valid_until_utc: '2026-12-31T00:00:00Z'
  },
  {
    identity_id: 'USR_0520_WMORRIS',
    display_name: 'William Morris',
    department: 'IT Helpdesk',
    role: 'Lead Service Desk Analyst',
    authorized_asset_ids: 'AST-WRK-016;AST-SRV-01',
    account_type: 'USER',
    account_status: 'ACTIVE',
    valid_from_utc: '2023-07-01T00:00:00Z',
    valid_until_utc: '2027-07-01T00:00:00Z'
  }
];

// =========================================================================
// 2. ASSET INVENTORY (02_asset_inventory.csv) - 22 rows
// =========================================================================
const assets = [
  {
    asset_id: 'AST-GW-01',
    asset_name: 'edge-vpn-gw01.northstar.internal',
    asset_type: 'VPN_GATEWAY',
    owner_identity_id: 'USR_0331_SLOPEZ',
    network_zone: 'DMZ_INGRESS',
    sensitivity: 'HIGH',
    expected_role: 'External Access VPN Concentrator',
    inventory_updated_at_utc: '2026-09-15T08:00:00Z'
  },
  {
    asset_id: 'AST-SRV-01',
    asset_name: 'dc01-ad.northstar.internal',
    asset_type: 'DOMAIN_CONTROLLER',
    owner_identity_id: 'USR_0331_SLOPEZ',
    network_zone: 'CORE_INFRA',
    sensitivity: 'CRITICAL',
    expected_role: 'Active Directory & Kerberos KDC',
    inventory_updated_at_utc: '2026-08-20T10:00:00Z'
  },
  {
    asset_id: 'AST-SRV-02',
    asset_name: 'dns01.northstar.internal',
    asset_type: 'DNS_SERVER',
    owner_identity_id: 'USR_0733_MZIMMER',
    network_zone: 'CORE_INFRA',
    sensitivity: 'MEDIUM',
    expected_role: 'Internal Resolving DNS',
    inventory_updated_at_utc: '2026-07-12T14:30:00Z'
  },
  {
    asset_id: 'AST-SRV-03',
    asset_name: 'auth-mfa01.northstar.internal',
    asset_type: 'AUTH_SERVER',
    owner_identity_id: 'USR_0103_JHALL',
    network_zone: 'CORE_INFRA',
    sensitivity: 'CRITICAL',
    expected_role: 'MFA Push & Radius Authentication Server',
    inventory_updated_at_utc: '2026-09-01T09:15:00Z'
  },
  {
    asset_id: 'AST-SRV-04',
    asset_name: 'apollo-core-db01.northstar.internal',
    asset_type: 'DATABASE_SERVER',
    owner_identity_id: 'USR_0264_PVARMA',
    network_zone: 'RESTRICTED_DATA_VAULT',
    sensitivity: 'CRITICAL',
    expected_role: 'Apollo Genomic Sequence & Clinical Store',
    inventory_updated_at_utc: '2026-10-01T11:00:00Z'
  },
  {
    asset_id: 'AST-SRV-05',
    asset_name: 'portal-app01.northstar.internal',
    asset_type: 'APPLICATION_SERVER',
    owner_identity_id: 'USR_0055_RJAIN',
    network_zone: 'APP_TIER',
    sensitivity: 'HIGH',
    expected_role: 'Bioinformatics Internal Web Portal',
    inventory_updated_at_utc: '2026-09-28T16:00:00Z'
  },
  {
    asset_id: 'AST-SRV-06',
    asset_name: 'nfs-storage01.northstar.internal',
    asset_type: 'STORAGE_ARRAY',
    owner_identity_id: 'USR_0955_YPETROV',
    network_zone: 'RESTRICTED_DATA_VAULT',
    sensitivity: 'HIGH',
    expected_role: 'Raw Sequencing FastQ Storage Array',
    inventory_updated_at_utc: '2026-09-10T12:00:00Z'
  },
  {
    asset_id: 'AST-SRV-07',
    asset_name: 'doc-archive01.northstar.internal',
    asset_type: 'FILE_SERVER',
    owner_identity_id: 'USR_0621_CHASHIM',
    network_zone: 'APP_TIER',
    sensitivity: 'MEDIUM',
    expected_role: 'Compliance & Audit Document Store',
    inventory_updated_at_utc: '2026-06-15T08:30:00Z'
  },
  {
    asset_id: 'AST-SRV-08',
    asset_name: 'siem-collector01.northstar.internal',
    asset_type: 'LOG_COLLECTOR',
    owner_identity_id: 'USR_0411_KBERG',
    network_zone: 'OPS_MGMT',
    sensitivity: 'HIGH',
    expected_role: 'Enterprise SIEM & Telemetry Ingestion Hub',
    inventory_updated_at_utc: '2026-10-05T13:45:00Z'
  },
  {
    asset_id: 'AST-SRV-09',
    asset_name: 'backup-vault01.northstar.internal',
    asset_type: 'BACKUP_SERVER',
    owner_identity_id: 'USR_0955_YPETROV',
    network_zone: 'OPS_MGMT',
    sensitivity: 'HIGH',
    expected_role: 'Enterprise Nightly Backup Target Repository',
    inventory_updated_at_utc: '2026-08-30T17:00:00Z'
  },
  {
    asset_id: 'AST-WRK-088',
    asset_name: 'wrk-bio-stage088.northstar.internal',
    asset_type: 'COMPUTE_NODE',
    owner_identity_id: 'USR_0055_RJAIN',
    network_zone: 'RESEARCH_LAB_LAN',
    sensitivity: 'HIGH',
    expected_role: 'High-Performance Staging & Script Worker Node',
    inventory_updated_at_utc: '2026-10-02T10:15:00Z'
  },
  {
    asset_id: 'AST-WRK-012',
    asset_name: 'wrk-eng-rjain.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0055_RJAIN',
    network_zone: 'CORP_OFFICE_LAN',
    sensitivity: 'MEDIUM',
    expected_role: 'Engineering Desktop',
    inventory_updated_at_utc: '2026-09-12T11:20:00Z'
  },
  {
    asset_id: 'AST-WRK-014',
    asset_name: 'wrk-it-twright.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0118_TWRIGHT',
    network_zone: 'CORP_OFFICE_LAN',
    sensitivity: 'MEDIUM',
    expected_role: 'IT Helpdesk Desktop',
    inventory_updated_at_utc: '2026-09-18T09:00:00Z'
  },
  {
    asset_id: 'AST-WRK-015',
    asset_name: 'wrk-eng-osmith.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0844_OSMITH',
    network_zone: 'CORP_OFFICE_LAN',
    sensitivity: 'MEDIUM',
    expected_role: 'Pipeline Developer Workstation',
    inventory_updated_at_utc: '2026-08-01T15:00:00Z'
  },
  {
    asset_id: 'AST-WRK-016',
    asset_name: 'wrk-it-wmorris.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0520_WMORRIS',
    network_zone: 'CORP_OFFICE_LAN',
    sensitivity: 'MEDIUM',
    expected_role: 'IT Helpdesk Supervisor Station',
    inventory_updated_at_utc: '2026-07-25T14:10:00Z'
  },
  {
    asset_id: 'AST-WRK-022',
    asset_name: 'wrk-qa-chashim.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0621_CHASHIM',
    network_zone: 'CORP_OFFICE_LAN',
    sensitivity: 'LOW',
    expected_role: 'Compliance Desktop',
    inventory_updated_at_utc: '2026-05-19T10:00:00Z'
  },
  {
    asset_id: 'AST-WRK-033',
    asset_name: 'wrk-net-mzimmer.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0733_MZIMMER',
    network_zone: 'CORP_OFFICE_LAN',
    sensitivity: 'MEDIUM',
    expected_role: 'Network Admin Station',
    inventory_updated_at_utc: '2026-09-03T11:45:00Z'
  },
  {
    asset_id: 'AST-WRK-044',
    asset_name: 'wrk-db-pvarma.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0264_PVARMA',
    network_zone: 'CORP_OFFICE_LAN',
    sensitivity: 'HIGH',
    expected_role: 'Database Engineer Workstation',
    inventory_updated_at_utc: '2026-09-22T08:30:00Z'
  },
  {
    asset_id: 'AST-WRK-077',
    asset_name: 'wrk-sec-kberg.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0411_KBERG',
    network_zone: 'SEC_OPS_LAN',
    sensitivity: 'HIGH',
    expected_role: 'SOC Analyst Console',
    inventory_updated_at_utc: '2026-10-01T08:00:00Z'
  },
  {
    asset_id: 'AST-WRK-101',
    asset_name: 'wrk-res-mchen.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0142_MCHEN',
    network_zone: 'RESEARCH_LAB_LAN',
    sensitivity: 'HIGH',
    expected_role: 'Senior Computational Biologist Workstation',
    inventory_updated_at_utc: '2026-09-20T13:30:00Z'
  },
  {
    asset_id: 'AST-WRK-102',
    asset_name: 'wrk-res-ekim.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0209_EKIM',
    network_zone: 'RESEARCH_LAB_LAN',
    sensitivity: 'HIGH',
    expected_role: 'Principal Geneticist Workstation',
    inventory_updated_at_utc: '2026-09-14T15:20:00Z'
  },
  {
    asset_id: 'AST-WRK-103',
    asset_name: 'wrk-res-anwosu.northstar.internal',
    asset_type: 'WORKSTATION',
    owner_identity_id: 'USR_0088_ANWOSU',
    network_zone: 'RESEARCH_LAB_LAN',
    sensitivity: 'MEDIUM',
    expected_role: 'Clinical Biomarker Lab Desktop',
    inventory_updated_at_utc: '2026-08-11T16:00:00Z'
  }
];

// =========================================================================
// 3. AUTHENTICATION EVENTS (03_authentication_events.csv) - 45 rows
// =========================================================================
// Incident Window: 2026-10-13 18:00:00Z to 2026-10-14 09:00:00Z
// Key Incident Session: SES_20261014_9102 (USR_0142_MCHEN via AST-GW-01 from 198.51.100.44 at 01:14:22Z)
// Decoy / Noise: 
//   - Brute force attempts on AST-GW-01 by 192.0.2.115
//   - Legitimate night telemetry / backup runs (SVC_NIGHTLY_BACKUP, SVC_METRICS_TELEMETRY)
//   - Benign off-hours login by Dr. Elena Kim (SES_20261013_8801) from Tokyo lab partner (198.51.100.12)
const authEvents = [
  // 13-Oct Afternoon / Evening Baseline
  {
    auth_event_id: 'AUTH-20261013-001',
    event_time_utc: '2026-10-13T14:02:11Z',
    ingested_at_utc: '2026-10-13T14:02:15Z',
    identity_id: 'USR_0142_MCHEN',
    source_ip: '10.40.10.101',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261013_7101',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'Standard lab workstation workstation logon'
  },
  {
    auth_event_id: 'AUTH-20261013-002',
    event_time_utc: '2026-10-13T14:15:30Z',
    ingested_at_utc: '2026-10-13T14:15:33Z',
    identity_id: 'USR_0209_EKIM',
    source_ip: '10.40.10.102',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261013_7105',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'Interactive domain workstation unlock'
  },
  {
    auth_event_id: 'AUTH-20261013-003',
    event_time_utc: '2026-10-13T14:22:04Z',
    ingested_at_utc: '2026-10-13T14:22:07Z',
    identity_id: 'USR_0055_RJAIN',
    source_ip: '10.40.10.12',
    destination_asset_id: 'AST-WRK-088',
    session_id: 'SES_20261013_7110',
    authentication_method: 'SSH_PUBKEY',
    result: 'SUCCESS',
    event_notes: 'Engineer SSH session to compute staging node'
  },
  {
    auth_event_id: 'AUTH-20261013-004',
    event_time_utc: '2026-10-13T15:05:18Z',
    ingested_at_utc: '2026-10-13T15:05:22Z',
    identity_id: 'USR_0118_TWRIGHT',
    source_ip: '10.40.10.14',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261013_7125',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'IT Helpdesk console logon'
  },
  {
    auth_event_id: 'AUTH-20261013-005',
    event_time_utc: '2026-10-13T16:15:00Z',
    ingested_at_utc: '2026-10-13T16:15:04Z',
    identity_id: 'USR_0142_MCHEN',
    source_ip: '10.40.10.101',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261013_7101',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'Workstation lock / session suspend before symposium travel departure'
  },
  // Benign Travel Remote Access: Dr. Elena Kim (Tokyo partner lab)
  {
    auth_event_id: 'AUTH-20261013-006',
    event_time_utc: '2026-10-13T19:30:12Z',
    ingested_at_utc: '2026-10-13T19:30:17Z',
    identity_id: 'USR_0209_EKIM',
    source_ip: '198.51.100.12',
    destination_asset_id: 'AST-GW-01',
    session_id: 'SES_20261013_8801',
    authentication_method: 'CERT_MFA_PUSH',
    result: 'SUCCESS',
    event_notes: 'Authorized international remote VPN session from partner academic institution'
  },
  {
    auth_event_id: 'AUTH-20261013-007',
    event_time_utc: '2026-10-13T19:32:45Z',
    ingested_at_utc: '2026-10-13T19:32:48Z',
    identity_id: 'USR_0209_EKIM',
    source_ip: '10.40.1.1',
    destination_asset_id: 'AST-WRK-102',
    session_id: 'SES_20261013_8802',
    authentication_method: 'RDP_NLA',
    result: 'SUCCESS',
    event_notes: 'Internal jump from VPN gateway to assigned desktop'
  },
  // Scanner Decoy: External brute-force attempt targeting disabled accounts
  {
    auth_event_id: 'AUTH-20261013-008',
    event_time_utc: '2026-10-13T23:10:02Z',
    ingested_at_utc: '2026-10-13T23:10:06Z',
    identity_id: 'USR_0012_ADMIN',
    source_ip: '192.0.2.115',
    destination_asset_id: 'AST-GW-01',
    session_id: 'SES_20261013_NONE1',
    authentication_method: 'PASSWORD',
    result: 'ACCOUNT_DISABLED',
    event_notes: 'External brute force probe; targeted disabled admin account'
  },
  {
    auth_event_id: 'AUTH-20261013-009',
    event_time_utc: '2026-10-13T23:11:15Z',
    ingested_at_utc: '2026-10-13T23:11:19Z',
    identity_id: 'USR_0001_ROOT',
    source_ip: '192.0.2.115',
    destination_asset_id: 'AST-GW-01',
    session_id: 'SES_20261013_NONE2',
    authentication_method: 'PASSWORD',
    result: 'ACCOUNT_DISABLED',
    event_notes: 'External brute force probe; targeted disabled legacy account'
  },
  {
    auth_event_id: 'AUTH-20261013-010',
    event_time_utc: '2026-10-13T23:12:44Z',
    ingested_at_utc: '2026-10-13T23:12:49Z',
    identity_id: 'USR_0012_ADMIN',
    source_ip: '192.0.2.115',
    destination_asset_id: 'AST-GW-01',
    session_id: 'SES_20261013_NONE3',
    authentication_method: 'PASSWORD',
    result: 'ACCOUNT_DISABLED',
    event_notes: 'Repeated probe; firewall rate-limit triggered shortly thereafter'
  },
  // Normal Nightly Scheduled Service Authentications
  {
    auth_event_id: 'AUTH-20261014-011',
    event_time_utc: '2026-10-14T00:00:05Z',
    ingested_at_utc: '2026-10-14T00:00:10Z',
    identity_id: 'SVC_METRICS_TELEMETRY',
    source_ip: '10.40.5.20',
    destination_asset_id: 'AST-SRV-04',
    session_id: 'SES_20261014_AUTO01',
    authentication_method: 'MUTUAL_TLS',
    result: 'SUCCESS',
    event_notes: 'Automated cluster metrics polling connection'
  },
  {
    auth_event_id: 'AUTH-20261014-012',
    event_time_utc: '2026-10-14T00:30:10Z',
    ingested_at_utc: '2026-10-14T00:30:15Z',
    identity_id: 'SVC_METRICS_TELEMETRY',
    source_ip: '10.40.5.20',
    destination_asset_id: 'AST-SRV-05',
    session_id: 'SES_20261014_AUTO02',
    authentication_method: 'MUTUAL_TLS',
    result: 'SUCCESS',
    event_notes: 'Automated cluster metrics polling connection'
  },
  // *** CRITICAL INCIDENT EVENT: USR_0142_MCHEN Initial Remote Access ***
  {
    auth_event_id: 'AUTH-20261014-013',
    event_time_utc: '2026-10-14T01:14:22Z',
    ingested_at_utc: '2026-10-14T01:14:25Z',
    identity_id: 'USR_0142_MCHEN',
    source_ip: '198.51.100.44',
    destination_asset_id: 'AST-GW-01',
    session_id: 'SES_20261014_9102',
    authentication_method: 'PASSWORD_PLUS_MFA_BYPASS_TOKEN',
    result: 'SUCCESS',
    event_notes: 'External VPN session established using temporary travel bypass token issued in ticket TCK-2026-0912'
  },
  // Pivot from VPN gateway to AST-WRK-088 (Staging Worker Node)
  {
    auth_event_id: 'AUTH-20261014-014',
    event_time_utc: '2026-10-14T01:18:05Z',
    ingested_at_utc: '2026-10-14T01:18:10Z',
    identity_id: 'USR_0142_MCHEN',
    source_ip: '10.40.1.1',
    destination_asset_id: 'AST-WRK-088',
    session_id: 'SES_20261014_9102',
    authentication_method: 'SSH_PUBKEY',
    result: 'SUCCESS',
    event_notes: 'Interactive SSH session onto high-performance compute staging workstation AST-WRK-088'
  },
  // Benign Backup Job Authentication (Decoy 1)
  {
    auth_event_id: 'AUTH-20261014-015',
    event_time_utc: '2026-10-14T01:45:00Z',
    ingested_at_utc: '2026-10-14T01:45:04Z',
    identity_id: 'SVC_NIGHTLY_BACKUP',
    source_ip: '10.40.5.20',
    destination_asset_id: 'AST-SRV-04',
    session_id: 'SES_20261014_BCK01',
    authentication_method: 'CERTIFICATE_KEY',
    result: 'SUCCESS',
    event_notes: 'Automated nightly maintenance backup authentication to Apollo database server'
  },
  // Attempted pivot to AST-SRV-01 (Domain Controller) with non-admin creds (Blocked)
  {
    auth_event_id: 'AUTH-20261014-016',
    event_time_utc: '2026-10-14T01:55:12Z',
    ingested_at_utc: '2026-10-14T01:55:18Z',
    identity_id: 'USR_0142_MCHEN',
    source_ip: '10.40.10.88',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261014_9102',
    authentication_method: 'KERBEROS',
    result: 'AUTH_DENIED_UNAUTHORIZED_TARGET',
    event_notes: 'Attempted domain admin share enumeration from compute node; blocked by access control rule'
  },
  // Authentication to AST-SRV-04 (Apollo DB) via staging script
  {
    auth_event_id: 'AUTH-20261014-017',
    event_time_utc: '2026-10-14T02:04:40Z',
    ingested_at_utc: '2026-10-14T02:04:44Z',
    identity_id: 'USR_0142_MCHEN',
    source_ip: '10.40.10.88',
    destination_asset_id: 'AST-SRV-04',
    session_id: 'SES_20261014_9102',
    authentication_method: 'DB_TOKEN',
    result: 'SUCCESS',
    event_notes: 'Database connection token presented for biological query interface'
  },
  // Incident Session Termination
  {
    auth_event_id: 'AUTH-20261014-018',
    event_time_utc: '2026-10-14T02:49:10Z',
    ingested_at_utc: '2026-10-14T02:49:14Z',
    identity_id: 'USR_0142_MCHEN',
    source_ip: '198.51.100.44',
    destination_asset_id: 'AST-GW-01',
    session_id: 'SES_20261014_9102',
    authentication_method: 'SESSION_LOGOUT',
    result: 'SUCCESS',
    event_notes: 'User disconnected VPN tunnel cleanly'
  },
  // Elena Kim disconnects from Tokyo partner session
  {
    auth_event_id: 'AUTH-20261014-019',
    event_time_utc: '2026-10-14T03:15:20Z',
    ingested_at_utc: '2026-10-14T03:15:25Z',
    identity_id: 'USR_0209_EKIM',
    source_ip: '198.51.100.12',
    destination_asset_id: 'AST-GW-01',
    session_id: 'SES_20261013_8801',
    authentication_method: 'SESSION_LOGOUT',
    result: 'SUCCESS',
    event_notes: 'Remote VPN session closed after manuscript review'
  },
  // Morning Routine Authentications (Baseline continues)
  {
    auth_event_id: 'AUTH-20261014-020',
    event_time_utc: '2026-10-14T06:45:00Z',
    ingested_at_utc: '2026-10-14T06:45:05Z',
    identity_id: 'SVC_ETL_PIPELINE',
    source_ip: '10.40.10.88',
    destination_asset_id: 'AST-SRV-04',
    session_id: 'SES_20261014_ETL01',
    authentication_method: 'SERVICE_KEY',
    result: 'SUCCESS',
    event_notes: 'Scheduled morning genomic pipeline ingest run'
  },
  {
    auth_event_id: 'AUTH-20261014-021',
    event_time_utc: '2026-10-14T07:15:30Z',
    ingested_at_utc: '2026-10-14T07:15:33Z',
    identity_id: 'USR_0331_SLOPEZ',
    source_ip: '10.40.10.33',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261014_7201',
    authentication_method: 'SMARTCARD_PIN',
    result: 'SUCCESS',
    event_notes: 'Sysadmin daily morning sign-in'
  },
  {
    auth_event_id: 'AUTH-20261014-022',
    event_time_utc: '2026-10-14T07:30:12Z',
    ingested_at_utc: '2026-10-14T07:30:17Z',
    identity_id: 'USR_0411_KBERG',
    source_ip: '10.40.10.77',
    destination_asset_id: 'AST-SRV-08',
    session_id: 'SES_20261014_7205',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'SOC analyst shift start logon'
  },
  {
    auth_event_id: 'AUTH-20261014-023',
    event_time_utc: '2026-10-14T07:45:22Z',
    ingested_at_utc: '2026-10-14T07:45:26Z',
    identity_id: 'USR_0055_RJAIN',
    source_ip: '10.40.10.12',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261014_7210',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'Lead engineer morning workstation unlock'
  },
  {
    auth_event_id: 'AUTH-20261014-024',
    event_time_utc: '2026-10-14T08:00:10Z',
    ingested_at_utc: '2026-10-14T08:00:14Z',
    identity_id: 'USR_0118_TWRIGHT',
    source_ip: '10.40.10.14',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261014_7215',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'IT Helpdesk staff shift logon'
  },
  {
    auth_event_id: 'AUTH-20261014-025',
    event_time_utc: '2026-10-14T08:05:44Z',
    ingested_at_utc: '2026-10-14T08:05:48Z',
    identity_id: 'USR_0088_ANWOSU',
    source_ip: '10.40.10.103',
    destination_asset_id: 'AST-SRV-01',
    session_id: 'SES_20261014_7220',
    authentication_method: 'KERBEROS',
    result: 'SUCCESS',
    event_notes: 'Clinical biomarker researcher logon'
  },
  // Additional background normal logins to bring count to 45
  ...Array.from({ length: 20 }, (_, i) => {
    const idx = 26 + i;
    const hour = Math.floor(i / 4) + 8;
    const minute = (i % 4) * 14 + 2;
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(minute).padStart(2, '0');
    const identitiesList = ['USR_0177_DDUBOIS', 'USR_0264_PVARMA', 'USR_0512_LTANAKA', 'USR_0621_CHASHIM', 'USR_0844_OSMITH', 'USR_0955_YPETROV', 'USR_0190_ALEE', 'USR_0288_BKAUFMAN', 'USR_0399_NADEBAYO', 'USR_0520_WMORRIS'];
    const chosenId = identitiesList[i % identitiesList.length];
    return {
      auth_event_id: `AUTH-20261014-0${idx}`,
      event_time_utc: `2026-10-14T${hStr}:${mStr}:15Z`,
      ingested_at_utc: `2026-10-14T${hStr}:${mStr}:19Z`,
      identity_id: chosenId,
      source_ip: `10.40.10.${100 + i}`,
      destination_asset_id: 'AST-SRV-01',
      session_id: `SES_20261014_NORM${idx}`,
      authentication_method: 'KERBEROS',
      result: 'SUCCESS',
      event_notes: 'Standard business hours domain authentication'
    };
  })
];

// =========================================================================
// 4. NETWORK CONNECTIONS (04_network_connections.csv) - 50 rows
// =========================================================================
// Key Incident Connection:
//   NET-77402: 2026-10-14T02:34:18Z, AST-WRK-088 (10.40.10.88) -> 203.0.113.89:443 (Documentation IP), TLS, 21,438,200 bytes sent, SES_20261014_9102.
// Key Benign Connections:
//   - AST-SRV-04 -> AST-SRV-09 (10.40.5.20:873) backup rsync: 891,240,000 bytes sent at 01:50:12Z (Decoy 1)
//   - AST-GW-01 ingress from 198.51.100.44 (Marcus Chen VPN session tunnel): port 1194 UDP
//   - AST-GW-01 ingress from 198.51.100.12 (Elena Kim VPN session tunnel): port 1194 UDP
//   - Regular DNS (53), LDAP/Kerberos (88/389), HTTPS intranet portal (443)
const networkConnections = [
  // VPN Ingress connections
  {
    network_event_id: 'NET-77101',
    event_time_utc: '2026-10-13T19:30:10Z',
    source_asset_id: 'AST-GW-01',
    destination_asset_id: 'AST-GW-01',
    source_ip: '198.51.100.12',
    destination_ip: '10.40.1.1',
    destination_port: 1194,
    protocol: 'UDP',
    bytes_sent: 4125000,
    bytes_received: 12500000,
    session_id: 'SES_20261013_8801',
    collection_source: 'ZEEK_CONN_LOG'
  },
  {
    network_event_id: 'NET-77102',
    event_time_utc: '2026-10-13T19:32:40Z',
    source_asset_id: 'AST-GW-01',
    destination_asset_id: 'AST-WRK-102',
    source_ip: '10.40.1.1',
    destination_ip: '10.40.10.102',
    destination_port: 3389,
    protocol: 'TCP',
    bytes_sent: 18450000,
    bytes_received: 2150000,
    session_id: 'SES_20261013_8802',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // Decoy Brute Force network probes
  {
    network_event_id: 'NET-77105',
    event_time_utc: '2026-10-13T23:10:00Z',
    source_asset_id: 'AST-GW-01',
    destination_asset_id: 'AST-GW-01',
    source_ip: '192.0.2.115',
    destination_ip: '10.40.1.1',
    destination_port: 443,
    protocol: 'TCP',
    bytes_sent: 1420,
    bytes_received: 2840,
    session_id: 'SES_20261013_NONE1',
    collection_source: 'ZEEK_CONN_LOG'
  },
  {
    network_event_id: 'NET-77106',
    event_time_utc: '2026-10-13T23:11:12Z',
    source_asset_id: 'AST-GW-01',
    destination_asset_id: 'AST-GW-01',
    source_ip: '192.0.2.115',
    destination_ip: '10.40.1.1',
    destination_port: 443,
    protocol: 'TCP',
    bytes_sent: 1410,
    bytes_received: 2820,
    session_id: 'SES_20261013_NONE2',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // Incident VPN Tunnel Ingress from 198.51.100.44
  {
    network_event_id: 'NET-77201',
    event_time_utc: '2026-10-14T01:14:20Z',
    source_asset_id: 'AST-GW-01',
    destination_asset_id: 'AST-GW-01',
    source_ip: '198.51.100.44',
    destination_ip: '10.40.1.1',
    destination_port: 1194,
    protocol: 'UDP',
    bytes_sent: 24500000,
    bytes_received: 3820000,
    session_id: 'SES_20261014_9102',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // SSH internal tunnel from VPN GW to Staging Worker AST-WRK-088
  {
    network_event_id: 'NET-77205',
    event_time_utc: '2026-10-14T01:18:03Z',
    source_asset_id: 'AST-GW-01',
    destination_asset_id: 'AST-WRK-088',
    source_ip: '10.40.1.1',
    destination_ip: '10.40.10.88',
    destination_port: 22,
    protocol: 'TCP',
    bytes_sent: 4850000,
    bytes_received: 23100000,
    session_id: 'SES_20261014_9102',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // Internal scan / probe from AST-WRK-088 towards AST-SRV-01 (blocked/failed connection)
  {
    network_event_id: 'NET-77209',
    event_time_utc: '2026-10-14T01:55:10Z',
    source_asset_id: 'AST-WRK-088',
    destination_asset_id: 'AST-SRV-01',
    source_ip: '10.40.10.88',
    destination_ip: '10.40.1.10',
    destination_port: 445,
    protocol: 'TCP',
    bytes_sent: 512,
    bytes_received: 128,
    session_id: 'SES_20261014_9102',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // Decoy Backup Transfer (AST-SRV-04 -> AST-SRV-09 internal rsync)
  {
    network_event_id: 'NET-77301',
    event_time_utc: '2026-10-14T01:50:12Z',
    source_asset_id: 'AST-SRV-04',
    destination_asset_id: 'AST-SRV-09',
    source_ip: '10.40.2.10',
    destination_ip: '10.40.5.20',
    destination_port: 873,
    protocol: 'TCP',
    bytes_sent: 891240000,
    bytes_received: 1245000,
    session_id: 'SES_20261014_BCK01',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // Internal Query connection from AST-WRK-088 to Apollo DB AST-SRV-04
  {
    network_event_id: 'NET-77350',
    event_time_utc: '2026-10-14T02:04:38Z',
    source_asset_id: 'AST-WRK-088',
    destination_asset_id: 'AST-SRV-04',
    source_ip: '10.40.10.88',
    destination_ip: '10.40.2.10',
    destination_port: 5432,
    protocol: 'TCP',
    bytes_sent: 182400,
    bytes_received: 22840000,
    session_id: 'SES_20261014_9102',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // *** CRITICAL INCIDENT EVENT: External TLS Egress from AST-WRK-088 to 203.0.113.89 ***
  {
    network_event_id: 'NET-77402',
    event_time_utc: '2026-10-14T02:34:18Z',
    source_asset_id: 'AST-WRK-088',
    destination_asset_id: 'EXTERNAL',
    source_ip: '10.40.10.88',
    destination_ip: '203.0.113.89',
    destination_port: 443,
    protocol: 'TCP',
    bytes_sent: 21438200,
    bytes_received: 14200,
    session_id: 'SES_20261014_9102',
    collection_source: 'ZEEK_CONN_LOG'
  },
  // Morning Routine Network Traffic (Internal DNS, LDAP, HTTP, etc.)
  ...Array.from({ length: 40 }, (_, i) => {
    const idx = 10 + i;
    const hour = Math.floor(i / 5) + 3;
    const minute = (i % 5) * 11 + 3;
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(minute).padStart(2, '0');
    const isDNS = i % 3 === 0;
    const isWeb = i % 3 === 1;
    const port = isDNS ? 53 : (isWeb ? 443 : 88);
    const proto = isDNS ? 'UDP' : 'TCP';
    const destAsset = isDNS ? 'AST-SRV-02' : (isWeb ? 'AST-SRV-05' : 'AST-SRV-01');
    const destIp = isDNS ? '10.40.1.20' : (isWeb ? '10.40.2.15' : '10.40.1.10');
    const validWorkstations = [
      'AST-WRK-012', 'AST-WRK-014', 'AST-WRK-015', 'AST-WRK-016',
      'AST-WRK-022', 'AST-WRK-033', 'AST-WRK-044', 'AST-WRK-077',
      'AST-WRK-101', 'AST-WRK-102', 'AST-WRK-103'
    ];
    const srcAsset = validWorkstations[i % validWorkstations.length];
    const srcIp = `10.40.10.${20 + (i % 30)}`;
    return {
      network_event_id: `NET-774${idx}`,
      event_time_utc: `2026-10-14T${hStr}:${mStr}:20Z`,
      source_asset_id: srcAsset,
      destination_asset_id: destAsset,
      source_ip: srcIp,
      destination_ip: destIp,
      destination_port: port,
      protocol: proto,
      bytes_sent: Math.floor(Math.random() * 4000) + 400,
      bytes_received: Math.floor(Math.random() * 12000) + 1200,
      session_id: `SES_NET_ROUTINE_${idx}`,
      collection_source: 'NETFLOW_V9'
    };
  })
];

// =========================================================================
// 5. ENDPOINT EVENTS (05_endpoint_events.csv) - 42 rows
// =========================================================================
// Key Incident Events:
//   - EPT-8840: 2026-10-14T01:22:10Z, AST-WRK-088, USR_0142_MCHEN, SES_20261014_9102, PROCESS_START, /bin/bash, interactive shell spawn
//   - EPT-8841: 2026-10-14T01:28:45Z, AST-WRK-088, USR_0142_MCHEN, SES_20261014_9102, SCRIPT_EXECUTE, proc_sync_snapshot.sh, staged in /tmp/.scratch_env/
//   - EPT-8842: 2026-10-14T02:04:15Z, AST-WRK-088, USR_0142_MCHEN, SES_20261014_9102, PROCESS_START, psql, invoking database query
//   - EPT-8843: 2026-10-14T02:05:40Z, AST-WRK-088, USR_0142_MCHEN, SES_20261014_9102, FILE_CREATE, /tmp/.scratch_env/core_gen_dump.tar.gz, related_resource_id: RES_GENOME_CORE_DB
//   - EPT-8844: 2026-10-14T02:33:55Z, AST-WRK-088, USR_0142_MCHEN, SES_20261014_9102, PROCESS_START, curl, transmitting data to 203.0.113.89
//   - EPT-8845: 2026-10-14T02:48:30Z, AST-WRK-088, USR_0142_MCHEN, SES_20261014_9102, FILE_DELETE, /tmp/.scratch_env/core_gen_dump.tar.gz, cleanup attempt
const endpointEvents = [
  // 13-Oct Afternoon Engineering & Research Activity
  {
    endpoint_event_id: 'EPT-8801',
    event_time_utc: '2026-10-13T14:25:00Z',
    asset_id: 'AST-WRK-088',
    identity_id: 'USR_0055_RJAIN',
    session_id: 'SES_20261013_7110',
    process_event_type: 'PROCESS_START',
    process_name: '/usr/bin/python3 -m nextflow run main.nf',
    related_resource_id: 'RES_GENOME_PIPELINE',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261013-0912'
  },
  {
    endpoint_event_id: 'EPT-8802',
    event_time_utc: '2026-10-13T14:40:12Z',
    asset_id: 'AST-WRK-101',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261013_7101',
    process_event_type: 'FILE_READ',
    process_name: 'rstudio.exe',
    related_resource_id: 'RES_GENOME_CORE_DB',
    result: 'SUCCESS',
    source_record_id: 'SYSMON-20261013-1044'
  },
  {
    endpoint_event_id: 'EPT-8803',
    event_time_utc: '2026-10-13T16:10:00Z',
    asset_id: 'AST-WRK-101',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261013_7101',
    process_event_type: 'PROCESS_TERMINATE',
    process_name: 'rstudio.exe',
    related_resource_id: 'RES_GENOME_CORE_DB',
    result: 'SUCCESS',
    source_record_id: 'SYSMON-20261013-1120'
  },
  // Benign Scheduled Backup Endpoint Activity (Decoy 1)
  {
    endpoint_event_id: 'EPT-8820',
    event_time_utc: '2026-10-14T01:45:05Z',
    asset_id: 'AST-SRV-04',
    identity_id: 'SVC_NIGHTLY_BACKUP',
    session_id: 'SES_20261014_BCK01',
    process_event_type: 'PROCESS_START',
    process_name: '/opt/backup/bin/pg_dump_wrapper.sh',
    related_resource_id: 'RES_METRIC_STORE',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0012'
  },
  {
    endpoint_event_id: 'EPT-8821',
    event_time_utc: '2026-10-14T01:46:12Z',
    asset_id: 'AST-SRV-04',
    identity_id: 'SVC_NIGHTLY_BACKUP',
    session_id: 'SES_20261014_BCK01',
    process_event_type: 'FILE_CREATE',
    process_name: 'pg_dump',
    related_resource_id: 'RES_METRIC_STORE',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0018'
  },
  {
    endpoint_event_id: 'EPT-8822',
    event_time_utc: '2026-10-14T01:50:10Z',
    asset_id: 'AST-SRV-04',
    identity_id: 'SVC_NIGHTLY_BACKUP',
    session_id: 'SES_20261014_BCK01',
    process_event_type: 'PROCESS_START',
    process_name: '/usr/bin/rsync -a /backup/data/ backup@10.40.5.20:/vault/',
    related_resource_id: 'RES_METRIC_STORE',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0025'
  },
  // *** CRITICAL INCIDENT ENDPOINT SEQUENCE on AST-WRK-088 ***
  {
    endpoint_event_id: 'EPT-8840',
    event_time_utc: '2026-10-14T01:22:10Z',
    asset_id: 'AST-WRK-088',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    process_event_type: 'PROCESS_START',
    process_name: '/bin/bash',
    related_resource_id: 'AST-WRK-088',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0030'
  },
  {
    endpoint_event_id: 'EPT-8841',
    event_time_utc: '2026-10-14T01:28:45Z',
    asset_id: 'AST-WRK-088',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    process_event_type: 'SCRIPT_EXECUTE',
    process_name: '/bin/bash /tmp/.scratch_env/proc_sync_snapshot.sh',
    related_resource_id: 'AST-WRK-088',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0035'
  },
  {
    endpoint_event_id: 'EPT-8842',
    event_time_utc: '2026-10-14T02:04:15Z',
    asset_id: 'AST-WRK-088',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    process_event_type: 'PROCESS_START',
    process_name: '/usr/bin/psql -h 10.40.2.10 -U mchen -d apollo_genomics',
    related_resource_id: 'RES_GENOME_CORE_DB',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0042'
  },
  {
    endpoint_event_id: 'EPT-8843',
    event_time_utc: '2026-10-14T02:05:40Z',
    asset_id: 'AST-WRK-088',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    process_event_type: 'FILE_CREATE',
    process_name: 'tar -czf /tmp/.scratch_env/core_gen_dump.tar.gz',
    related_resource_id: 'RES_GENOME_CORE_DB',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0048'
  },
  {
    endpoint_event_id: 'EPT-8844',
    event_time_utc: '2026-10-14T02:33:55Z',
    asset_id: 'AST-WRK-088',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    process_event_type: 'PROCESS_START',
    process_name: 'curl -k -T /tmp/.scratch_env/core_gen_dump.tar.gz https://203.0.113.89/upload',
    related_resource_id: 'RES_GENOME_CORE_DB',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0055'
  },
  {
    endpoint_event_id: 'EPT-8845',
    event_time_utc: '2026-10-14T02:48:30Z',
    asset_id: 'AST-WRK-088',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    process_event_type: 'FILE_DELETE',
    process_name: 'rm -rf /tmp/.scratch_env/core_gen_dump.tar.gz',
    related_resource_id: 'AST-WRK-088',
    result: 'SUCCESS',
    source_record_id: 'AUDITD-20261014-0062'
  },
  // Routine Morning Endpoint Events
  ...Array.from({ length: 30 }, (_, i) => {
    const idx = 50 + i;
    const hour = Math.floor(i / 6) + 7;
    const minute = (i % 6) * 9 + 4;
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(minute).padStart(2, '0');
    const hosts = ['AST-WRK-012', 'AST-WRK-014', 'AST-WRK-044', 'AST-WRK-077', 'AST-WRK-102', 'AST-WRK-103'];
    const procs = ['code.exe', 'slack.exe', 'chrome.exe', 'outlook.exe', 'rstudio.exe', 'git.exe'];
    return {
      endpoint_event_id: `EPT-88${idx}`,
      event_time_utc: `2026-10-14T${hStr}:${mStr}:00Z`,
      asset_id: hosts[i % hosts.length],
      identity_id: 'USR_0055_RJAIN',
      session_id: `SES_20261014_EP_${idx}`,
      process_event_type: 'PROCESS_START',
      process_name: procs[i % procs.length],
      related_resource_id: 'AST-LOCAL-APP',
      result: 'SUCCESS',
      source_record_id: `SYSMON-20261014-${1000 + idx}`
    };
  })
];

// =========================================================================
// 6. DATA ACCESS AUDIT (06_data_access_audit.csv) - 38 rows
// =========================================================================
// Key Incident Access:
//   ACC-88319: 2026-10-14T02:05:11Z, USR_0142_MCHEN, SES_20261014_9102, AST-SRV-04, RES_GENOME_CORE_DB, SELECT_EXPORT, 4200 records, SUCCESS
// Decoy / Routine:
//   - ACC-88310: SVC_NIGHTLY_BACKUP, SES_20261014_BCK01, AST-SRV-04, RES_METRIC_STORE, DUMP_BACKUP, 150000 records, SUCCESS at 01:46:12Z
//   - ACC-88315: USR_0142_MCHEN attempted access to RES_FINANCIAL_PAYROLL, DENIED_UNAUTHORIZED
//   - Daytime queries to RES_GENOME_CORE_DB, RES_CLINICAL_TRIAL_META, RES_PROTEIN_FOLD_MODELS
const dataAccessEvents = [
  // 13-Oct Normal Lab Access
  {
    access_event_id: 'ACC-88301',
    event_time_utc: '2026-10-13T14:42:00Z',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261013_7101',
    asset_id: 'AST-SRV-04',
    resource_id: 'RES_GENOME_CORE_DB',
    action: 'SELECT_QUERY',
    record_count: 45,
    result: 'SUCCESS',
    audit_record_version: 'v2.1'
  },
  {
    access_event_id: 'ACC-88302',
    event_time_utc: '2026-10-13T15:10:15Z',
    identity_id: 'USR_0209_EKIM',
    session_id: 'SES_20261013_7105',
    asset_id: 'AST-SRV-04',
    resource_id: 'RES_GENOME_CORE_DB',
    action: 'SELECT_QUERY',
    record_count: 120,
    result: 'SUCCESS',
    audit_record_version: 'v2.1'
  },
  {
    access_event_id: 'ACC-88303',
    event_time_utc: '2026-10-13T16:00:20Z',
    identity_id: 'USR_0088_ANWOSU',
    session_id: 'SES_20261013_7110',
    asset_id: 'AST-SRV-04',
    resource_id: 'RES_CLINICAL_TRIAL_META',
    action: 'SELECT_QUERY',
    record_count: 88,
    result: 'SUCCESS',
    audit_record_version: 'v2.1'
  },
  // Decoy Nightly Backup Access (Decoy 1)
  {
    access_event_id: 'ACC-88310',
    event_time_utc: '2026-10-14T01:46:12Z',
    identity_id: 'SVC_NIGHTLY_BACKUP',
    session_id: 'SES_20261014_BCK01',
    asset_id: 'AST-SRV-04',
    resource_id: 'RES_METRIC_STORE',
    action: 'DUMP_BACKUP',
    record_count: 154200,
    result: 'SUCCESS',
    audit_record_version: 'v2.1'
  },
  // Incident Session: Denied attempt to access non-genomic resource
  {
    access_event_id: 'ACC-88315',
    event_time_utc: '2026-10-14T01:58:30Z',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    asset_id: 'AST-SRV-04',
    resource_id: 'RES_FINANCIAL_PAYROLL',
    action: 'SELECT_QUERY',
    record_count: 0,
    result: 'PERMISSION_DENIED',
    audit_record_version: 'v2.1'
  },
  // *** CRITICAL INCIDENT DATA ACCESS EVENT ***
  {
    access_event_id: 'ACC-88319',
    event_time_utc: '2026-10-14T02:05:11Z',
    identity_id: 'USR_0142_MCHEN',
    session_id: 'SES_20261014_9102',
    asset_id: 'AST-SRV-04',
    resource_id: 'RES_GENOME_CORE_DB',
    action: 'SELECT_EXPORT',
    record_count: 4200,
    result: 'SUCCESS',
    audit_record_version: 'v2.1'
  },
  // Routine ETL and Researcher Data Access
  ...Array.from({ length: 32 }, (_, i) => {
    const idx = 25 + i;
    const hour = Math.floor(i / 5) + 6;
    const minute = (i % 5) * 11 + 2;
    const hStr = String(hour).padStart(2, '0');
    const mStr = String(minute).padStart(2, '0');
    const users = ['USR_0209_EKIM', 'USR_0088_ANWOSU', 'USR_0177_DDUBOIS', 'SVC_ETL_PIPELINE', 'USR_0399_NADEBAYO'];
    const resources = ['RES_GENOME_CORE_DB', 'RES_CLINICAL_TRIAL_META', 'RES_PROTEIN_FOLD_MODELS', 'RES_METRIC_STORE'];
    return {
      access_event_id: `ACC-883${idx}`,
      event_time_utc: `2026-10-14T${hStr}:${mStr}:35Z`,
      identity_id: users[i % users.length],
      session_id: `SES_ACC_ROUTINE_${idx}`,
      asset_id: 'AST-SRV-04',
      resource_id: resources[i % resources.length],
      action: 'SELECT_QUERY',
      record_count: (i + 1) * 23,
      result: 'SUCCESS',
      audit_record_version: 'v2.1'
    };
  })
];

// =========================================================================
// 7. INCIDENT TICKETS (07_incident_tickets.csv) - 14 rows
// =========================================================================
// Key Tickets:
//   - TCK-2026-0912: Dr. Marcus Chen Helpdesk ticket requesting travel temporary bypass token for Montreal conference (issued 13-Oct 17:05 UTC)
//   - TCK-2026-0925: Automated SIEM ticket opened 14-Oct 08:30 UTC. Note: Has misleading ingestion timestamp attribution (cites 01:50 UTC backup volume instead of 02:05 UTC database query!)
//   - TCK-2026-0926: SOC escalation ticket investigating off-hours VPN login
//   - Background IT support tickets (printer, software license, monitor replacement)
const incidentTickets = [
  {
    ticket_id: 'TCK-2026-0901',
    created_at_utc: '2026-10-13T09:15:00Z',
    updated_at_utc: '2026-10-13T10:30:00Z',
    reporting_team: 'IT Helpdesk',
    affected_asset_id: 'AST-WRK-022',
    reported_event_time_utc: '2026-10-13T09:00:00Z',
    incident_category: 'HARDWARE_PERIPHERAL',
    description: 'User reported secondary display flickering on workstation AST-WRK-022. DisplayPort cable replaced.',
    status: 'CLOSED',
    related_record_ids: 'AST-WRK-022'
  },
  {
    ticket_id: 'TCK-2026-0908',
    created_at_utc: '2026-10-13T13:40:00Z',
    updated_at_utc: '2026-10-13T14:10:00Z',
    reporting_team: 'Genomics Lab',
    affected_asset_id: 'AST-WRK-088',
    reported_event_time_utc: '2026-10-13T13:30:00Z',
    incident_category: 'RESOURCE_ALLOCATION',
    description: 'Shared compute staging node memory utilization reached 88% during batch Nextflow pipeline execution.',
    status: 'RESOLVED',
    related_record_ids: 'EPT-8801'
  },
  // *** CRITICAL CONTEXT TICKET: Dr. Marcus Chen Travel Access Request ***
  {
    ticket_id: 'TCK-2026-0912',
    created_at_utc: '2026-10-13T16:20:00Z',
    updated_at_utc: '2026-10-13T17:05:00Z',
    reporting_team: 'IT Helpdesk',
    affected_asset_id: 'AST-GW-01',
    reported_event_time_utc: '2026-10-13T16:15:00Z',
    incident_category: 'ACCESS_REQUEST',
    description: 'Dr. Marcus Chen called Helpdesk before departing for Computational Biology Symposium in Montreal. Requested temporary VPN access bypass token due to misplaced hardware token. Temporary access token granted with 72-hour expiration per expedited travel protocol.',
    status: 'CLOSED',
    related_record_ids: 'USR_0142_MCHEN;AST-GW-01'
  },
  {
    ticket_id: 'TCK-2026-0918',
    created_at_utc: '2026-10-13T23:30:00Z',
    updated_at_utc: '2026-10-14T00:15:00Z',
    reporting_team: 'SecOps Automated Alert',
    affected_asset_id: 'AST-GW-01',
    reported_event_time_utc: '2026-10-13T23:12:44Z',
    incident_category: 'AUTHENTICATION_FAILURE_BURST',
    description: 'Edge firewall blocked IP 192.0.2.115 after three consecutive failed authentications against disabled administrative accounts.',
    status: 'CLOSED',
    related_record_ids: 'AUTH-20261013-008;AUTH-20261013-009;AUTH-20261013-010'
  },
  // *** MISLEADING TICKET / DECOY: SIEM Ingestion Time Discrepancy ***
  {
    ticket_id: 'TCK-2026-0925',
    created_at_utc: '2026-10-14T08:30:00Z',
    updated_at_utc: '2026-10-14T09:15:00Z',
    reporting_team: 'SecOps Tier 1',
    affected_asset_id: 'AST-SRV-04',
    reported_event_time_utc: '2026-10-14T01:50:12Z',
    incident_category: 'DATA_VOLUME_ANOMALY',
    description: 'Automated SIEM rule ALERT_OFFHOURS_BULK_TRANSFER triggered. Ticket created citing 890MB data transmission from AST-SRV-04 around 01:50 UTC. Note: Rule ingested network flow summary but did not resolve internal service destination vs external egress.',
    status: 'OPEN',
    related_record_ids: 'NET-77301;ACC-88310'
  },
  // *** INCIDENT TRIAGE TICKET: Investigating Unusual Activity ***
  {
    ticket_id: 'TCK-2026-0926',
    created_at_utc: '2026-10-14T09:45:00Z',
    updated_at_utc: '2026-10-14T10:30:00Z',
    reporting_team: 'Information Security',
    affected_asset_id: 'AST-WRK-088',
    reported_event_time_utc: '2026-10-14T01:14:22Z',
    incident_category: 'POTENTIAL_ACCOUNT_COMPROMISE',
    description: 'Security Analyst Karin Berg noted off-hours remote login under Dr. Marcus Chen account originating from external IP 198.51.100.44. Workstation AST-WRK-088 accessed during session SES_20261014_9102. Full correlation requested across authentication, endpoint, data audit, and netflow.',
    status: 'INVESTIGATING',
    related_record_ids: 'AUTH-20261014-013;AUTH-20261014-014;NET-77201'
  },
  // Additional Routine Operational Tickets
  ...Array.from({ length: 8 }, (_, i) => {
    const idx = 30 + i;
    return {
      ticket_id: `TCK-2026-09${idx}`,
      created_at_utc: `2026-10-14T${10 + i}:00:00Z`,
      updated_at_utc: `2026-10-14T${10 + i}:30:00Z`,
      reporting_team: 'IT Helpdesk',
      affected_asset_id: 'AST-WRK-015',
      reported_event_time_utc: `2026-10-14T${10 + i}:00:00Z`,
      incident_category: 'SOFTWARE_INSTALL',
      description: `Routine software package maintenance and license check request #${idx}.`,
      status: 'CLOSED',
      related_record_ids: 'AST-WRK-015'
    };
  })
];

// =========================================================================
// 8. EVIDENCE REGISTRY (08_evidence_registry.csv) - 32 rows
// =========================================================================
// Details the provenance, integrity, timestamp quality, and limitations of critical records
const evidenceRegistry = [
  {
    evidence_id: 'EVD-001',
    source_file: '01_identity_directory.csv',
    source_record_id: 'USR_0142_MCHEN',
    source_system: 'ActiveDirectory_LdapExport',
    collected_at_utc: '2026-10-14T09:00:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'AUTHORITATIVE',
    known_limitation: 'Directory shows static role and assigned systems; does not record individual physical token custody.',
    notes: 'Primary account record for Dr. Marcus Chen.'
  },
  {
    evidence_id: 'EVD-002',
    source_file: '02_asset_inventory.csv',
    source_record_id: 'AST-SRV-04',
    source_system: 'CMDB_ServiceNowExport',
    collected_at_utc: '2026-10-14T09:00:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'AUTHORITATIVE',
    known_limitation: 'CMDB records reflect intended architecture; configuration drift may exist on unmanaged local scratch volumes.',
    notes: 'Core repository server hosting genomic sequences in restricted vault zone.'
  },
  {
    evidence_id: 'EVD-003',
    source_file: '02_asset_inventory.csv',
    source_record_id: 'AST-WRK-088',
    source_system: 'CMDB_ServiceNowExport',
    collected_at_utc: '2026-10-14T09:00:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'AUTHORITATIVE',
    known_limitation: 'High-performance compute staging node has shared access for computational biology group.',
    notes: 'Staging worker node used for sequence pipeline staging.'
  },
  {
    evidence_id: 'EVD-004',
    source_file: '03_authentication_events.csv',
    source_record_id: 'AUTH-20261014-013',
    source_system: 'PaloAlto_GlobalProtect_VpnLog',
    collected_at_utc: '2026-10-14T09:05:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'VPN gateway records client source IP and authentication method, but cannot verify whether client device was under physical control of the identity owner.',
    notes: 'Establishes initial remote access for session SES_20261014_9102 from 198.51.100.44.'
  },
  {
    evidence_id: 'EVD-005',
    source_file: '03_authentication_events.csv',
    source_record_id: 'AUTH-20261014-014',
    source_system: 'Linux_AuthLog_SSHD',
    collected_at_utc: '2026-10-14T09:10:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'SSHD records internal gateway jump address (10.40.1.1) as client IP; must be correlated with VPN gateway session ID.',
    notes: 'Connects VPN session SES_20261014_9102 to AST-WRK-088.'
  },
  {
    evidence_id: 'EVD-006',
    source_file: '03_authentication_events.csv',
    source_record_id: 'AUTH-20261014-015',
    source_system: 'Linux_AuthLog_SSHD',
    collected_at_utc: '2026-10-14T09:10:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Service account certificate authentication; normal automated schedule.',
    notes: 'Benign backup job authentication record (Decoy 1).'
  },
  {
    evidence_id: 'EVD-007',
    source_file: '03_authentication_events.csv',
    source_record_id: 'AUTH-20261014-016',
    source_system: 'Windows_Security_EventLog',
    collected_at_utc: '2026-10-14T09:12:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Failed attempt to authenticate against domain controller AST-SRV-01; generated event 4625.',
    notes: 'Indicates unauthorized privilege enumeration attempt from AST-WRK-088.'
  },
  {
    evidence_id: 'EVD-008',
    source_file: '03_authentication_events.csv',
    source_record_id: 'AUTH-20261014-017',
    source_system: 'PostgreSQL_Auth_Audit',
    collected_at_utc: '2026-10-14T09:15:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Application token presented; database records user name from token claims.',
    notes: 'Authentication from AST-WRK-088 to database AST-SRV-04.'
  },
  {
    evidence_id: 'EVD-009',
    source_file: '03_authentication_events.csv',
    source_record_id: 'AUTH-20261014-018',
    source_system: 'PaloAlto_GlobalProtect_VpnLog',
    collected_at_utc: '2026-10-14T09:05:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Clean disconnect timestamp indicates session end; does not reflect subsequent activity on already-downloaded assets.',
    notes: 'Session SES_20261014_9102 disconnect record.'
  },
  {
    evidence_id: 'EVD-010',
    source_file: '04_network_connections.csv',
    source_record_id: 'NET-77201',
    source_system: 'Zeek_Core_Network_Sensor',
    collected_at_utc: '2026-10-14T09:20:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'HIGH_PRECISION_HARDWARE_STAMP',
    known_limitation: 'UDP OpenVPN encapsulation preserves flow volume but masks individual encapsulated TCP streams.',
    notes: 'Encapsulated tunnel traffic for SES_20261014_9102.'
  },
  {
    evidence_id: 'EVD-011',
    source_file: '04_network_connections.csv',
    source_record_id: 'NET-77301',
    source_system: 'Zeek_Core_Network_Sensor',
    collected_at_utc: '2026-10-14T09:20:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'HIGH_PRECISION_HARDWARE_STAMP',
    known_limitation: 'Large flow volume (891MB) matches scheduled backup job; entirely internal between 10.40.2.10 and 10.40.5.20.',
    notes: 'Benign backup network transfer (Decoy 1).'
  },
  {
    evidence_id: 'EVD-012',
    source_file: '04_network_connections.csv',
    source_record_id: 'NET-77350',
    source_system: 'Zeek_Core_Network_Sensor',
    collected_at_utc: '2026-10-14T09:20:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'HIGH_PRECISION_HARDWARE_STAMP',
    known_limitation: 'PostgreSQL protocol connection on port 5432; 22.8MB returned to client workstation 10.40.10.88.',
    notes: 'Internal database query data transmission from AST-SRV-04 to AST-WRK-088.'
  },
  {
    evidence_id: 'EVD-013',
    source_file: '04_network_connections.csv',
    source_record_id: 'NET-77402',
    source_system: 'Zeek_Core_Network_Sensor',
    collected_at_utc: '2026-10-14T09:20:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'HIGH_PRECISION_HARDWARE_STAMP',
    known_limitation: 'Outbound flow to external IP 203.0.113.89:443 was TLS encrypted; payload contents cannot be directly inspected by Zeek sensor.',
    notes: 'Crucial egress flow: 21.4MB transferred outbound from AST-WRK-088 under SES_20261014_9102.'
  },
  {
    evidence_id: 'EVD-014',
    source_file: '05_endpoint_events.csv',
    source_record_id: 'EPT-8840',
    source_system: 'Linux_Auditd_Syslog',
    collected_at_utc: '2026-10-14T09:25:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Interactive bash process started under mchen uid.',
    notes: 'Spawning of interactive shell on AST-WRK-088.'
  },
  {
    evidence_id: 'EVD-015',
    source_file: '05_endpoint_events.csv',
    source_record_id: 'EPT-8841',
    source_system: 'Linux_Auditd_Syslog',
    collected_at_utc: '2026-10-14T09:25:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Script executed from hidden scratch directory /tmp/.scratch_env/; file contents removed prior to forensic disk imaging.',
    notes: 'Execution of staging script proc_sync_snapshot.sh.'
  },
  {
    evidence_id: 'EVD-016',
    source_file: '05_endpoint_events.csv',
    source_record_id: 'EPT-8842',
    source_system: 'Linux_Auditd_Syslog',
    collected_at_utc: '2026-10-14T09:25:00Z',
    integrity_status: 'NTP_SYNCHRONIZED',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Records command line invocation of psql client; full query text logged in database audit log.',
    notes: 'Command line execution of database query tool.'
  },
  {
    evidence_id: 'EVD-017',
    source_file: '05_endpoint_events.csv',
    source_record_id: 'EPT-8843',
    source_system: 'Linux_Auditd_Syslog',
    collected_at_utc: '2026-10-14T09:25:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Records creation of compressed archive core_gen_dump.tar.gz in /tmp/.scratch_env/.',
    notes: 'Creation of staging archive file.'
  },
  {
    evidence_id: 'EVD-018',
    source_file: '05_endpoint_events.csv',
    source_record_id: 'EPT-8844',
    source_system: 'Linux_Auditd_Syslog',
    collected_at_utc: '2026-10-14T09:25:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Curl process executed targeting external IP 203.0.113.89; correlates with NET-77402.',
    notes: 'Outbound upload command execution.'
  },
  {
    evidence_id: 'EVD-019',
    source_file: '05_endpoint_events.csv',
    source_record_id: 'EPT-8845',
    source_system: 'Linux_Auditd_Syslog',
    collected_at_utc: '2026-10-14T09:25:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Anti-forensics artifact deletion; inode unlinked from filesystem.',
    notes: 'Deletion of staging archive file.'
  },
  {
    evidence_id: 'EVD-020',
    source_file: '06_data_access_audit.csv',
    source_record_id: 'ACC-88310',
    source_system: 'PostgreSQL_pgaudit',
    collected_at_utc: '2026-10-14T09:30:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Table dump of RES_METRIC_STORE; not genomic sequence data.',
    notes: 'Benign backup job data access audit record.'
  },
  {
    evidence_id: 'EVD-021',
    source_file: '06_data_access_audit.csv',
    source_record_id: 'ACC-88315',
    source_system: 'PostgreSQL_pgaudit',
    collected_at_utc: '2026-10-14T09:30:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Access denied; zero records returned.',
    notes: 'Unauthorized access attempt to payroll database during incident session.'
  },
  {
    evidence_id: 'EVD-022',
    source_file: '06_data_access_audit.csv',
    source_record_id: 'ACC-88319',
    source_system: 'PostgreSQL_pgaudit',
    collected_at_utc: '2026-10-14T09:30:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'NTP_SYNCHRONIZED',
    known_limitation: 'Audit log confirms 4,200 records extracted by query; does not record subsequent network transmission.',
    notes: 'Core genomic database export event under session SES_20261014_9102.'
  },
  {
    evidence_id: 'EVD-023',
    source_file: '07_incident_tickets.csv',
    source_record_id: 'TCK-2026-0912',
    source_system: 'Jira_Service_Desk',
    collected_at_utc: '2026-10-14T09:35:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'WEB_APPLICATION_CLOCK',
    known_limitation: 'Helpdesk notes indicate telephonic identity verification; biometric or physical in-person check was bypassed due to urgent flight departure.',
    notes: 'Authorizes temporary bypass token for Dr. Marcus Chen.'
  },
  {
    evidence_id: 'EVD-024',
    source_file: '07_incident_tickets.csv',
    source_record_id: 'TCK-2026-0925',
    source_system: 'Splunk_Enterprise_SIEM',
    collected_at_utc: '2026-10-14T09:35:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'SIEM_INGESTION_TIMESTAMP',
    known_limitation: 'Known Limitation: SIEM correlation rule confused ingestion time with event timestamp and flagged 890MB backup transfer (NET-77301) rather than the 21.4MB external egress (NET-77402).',
    notes: 'Misleading ticket alert requiring forensic reconciliation.'
  },
  {
    evidence_id: 'EVD-025',
    source_file: '07_incident_tickets.csv',
    source_record_id: 'TCK-2026-0926',
    source_system: 'Jira_Service_Desk',
    collected_at_utc: '2026-10-14T10:30:00Z',
    integrity_status: 'VERIFIED_HASH_MATCH',
    timestamp_quality: 'WEB_APPLICATION_CLOCK',
    known_limitation: 'Triage ticket initiated during initial response; contains partial observations subject to ongoing investigation.',
    notes: 'SOC escalation ticket initiating Operation Glass Lantern review.'
  },
  // Additional Registry entries covering other baseline files
  ...Array.from({ length: 7 }, (_, i) => {
    const idx = 26 + i;
    return {
      evidence_id: `EVD-0${idx}`,
      source_file: '03_authentication_events.csv',
      source_record_id: `AUTH-20261013-00${i + 1}`,
      source_system: 'ActiveDirectory_SecurityLog',
      collected_at_utc: '2026-10-14T09:00:00Z',
      integrity_status: 'VERIFIED_HASH_MATCH',
      timestamp_quality: 'NTP_SYNCHRONIZED',
      known_limitation: 'Standard workstation event log collection.',
      notes: `Baseline daytime logon verification #${i + 1}.`
    };
  })
];

console.log('Writing CSV files...');

writeCsv('01_identity_directory.csv', [
  'identity_id', 'display_name', 'department', 'role', 'authorized_asset_ids', 'account_type', 'account_status', 'valid_from_utc', 'valid_until_utc'
], identities);

writeCsv('02_asset_inventory.csv', [
  'asset_id', 'asset_name', 'asset_type', 'owner_identity_id', 'network_zone', 'sensitivity', 'expected_role', 'inventory_updated_at_utc'
], assets);

writeCsv('03_authentication_events.csv', [
  'auth_event_id', 'event_time_utc', 'ingested_at_utc', 'identity_id', 'source_ip', 'destination_asset_id', 'session_id', 'authentication_method', 'result', 'event_notes'
], authEvents);

writeCsv('04_network_connections.csv', [
  'network_event_id', 'event_time_utc', 'source_asset_id', 'destination_asset_id', 'source_ip', 'destination_ip', 'destination_port', 'protocol', 'bytes_sent', 'bytes_received', 'session_id', 'collection_source'
], networkConnections);

writeCsv('05_endpoint_events.csv', [
  'endpoint_event_id', 'event_time_utc', 'asset_id', 'identity_id', 'session_id', 'process_event_type', 'process_name', 'related_resource_id', 'result', 'source_record_id'
], endpointEvents);

writeCsv('06_data_access_audit.csv', [
  'access_event_id', 'event_time_utc', 'identity_id', 'session_id', 'asset_id', 'resource_id', 'action', 'record_count', 'result', 'audit_record_version'
], dataAccessEvents);

writeCsv('07_incident_tickets.csv', [
  'ticket_id', 'created_at_utc', 'updated_at_utc', 'reporting_team', 'affected_asset_id', 'reported_event_time_utc', 'incident_category', 'description', 'status', 'related_record_ids'
], incidentTickets);

writeCsv('08_evidence_registry.csv', [
  'evidence_id', 'source_file', 'source_record_id', 'source_system', 'collected_at_utc', 'integrity_status', 'timestamp_quality', 'known_limitation', 'notes'
], evidenceRegistry);

console.log('All 8 investigation CSV files successfully written.');
