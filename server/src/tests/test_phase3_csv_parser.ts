import fs from 'fs';
import path from 'path';
import { DeterministicCsvParser } from '../services/graph/deterministicCsvParser.js';
import { SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';
import { initDatabase, db } from '../db/database.js';

console.log('--- Running Phase 3 Deterministic CSV Parser Verification ---');

// 1. Initialize DB
initDatabase();
const store = new SQLiteGraphStore();

// 2. Test Telephony CDR parsing
const cdrCsv = `caller_id,callee_id,call_time,duration_sec
+919876543210,+919123456789,2024-10-14T08:30:00Z,125
+919123456789,+971501234567,2024-10-14T09:15:00Z,420
`;

const cdrResult = DeterministicCsvParser.parse(cdrCsv, 'call_records_oct14.csv');
console.log('✔ Telephony CDR Result:', {
  detectedProfile: cdrResult.stats.detectedProfile,
  totalRows: cdrResult.stats.totalRows,
  triplesGenerated: cdrResult.stats.triplesGenerated,
});

if (cdrResult.stats.detectedProfile !== 'TELECOMMUNICATIONS_CDR' || cdrResult.triples.length !== 2) {
  throw new Error(`Expected TELECOMMUNICATIONS_CDR with 2 triples, got ${cdrResult.stats.detectedProfile} (${cdrResult.triples.length})`);
}

// 3. Test Financial Wire Transfers
const wireCsv = `remitter,beneficiary,amount,currency,transfer_date,reference_memo
Gulf Crest Escrow Ltd,Apex Petrochem FZE,1850000,USD,2024-10-15T11:00:00Z,EXPEDITE-SOLVENT-01
Apex Petrochem FZE,Pacific Horizon Storage Pvt Ltd,450000,USD,2024-10-16T14:30:00Z,COMMISSION-TR-44
`;

const wireResult = DeterministicCsvParser.parse(wireCsv, 'wire_transfers_audit.csv');
console.log('✔ Wire Transfers Result:', {
  detectedProfile: wireResult.stats.detectedProfile,
  totalRows: wireResult.stats.totalRows,
  triplesGenerated: wireResult.stats.triplesGenerated,
});

if (wireResult.stats.detectedProfile !== 'FINANCIAL_WIRE_TRANSFERS' || wireResult.triples.length !== 2) {
  throw new Error(`Expected FINANCIAL_WIRE_TRANSFERS with 2 triples, got ${wireResult.stats.detectedProfile}`);
}

// 4. Test Maritime Customs Manifest
const customsCsv = `vessel_name,imo,captain,port,cargo,timestamp
BHARAT GAURAV,9435678,Captain K. Raman,JNPT Mumbai,Refined Lubricant Base Oil,2024-10-12T06:00:00Z
`;

const customsResult = DeterministicCsvParser.parse(customsCsv, 'customs_declaration_bg.csv');
console.log('✔ Customs Manifest Result:', {
  detectedProfile: customsResult.stats.detectedProfile,
  totalRows: customsResult.stats.totalRows,
  triplesGenerated: customsResult.stats.triplesGenerated,
  triples: customsResult.triples.map(t => `${t.subjectName} --[${t.predicate}]--> ${t.objectName}`),
});

if (customsResult.stats.detectedProfile !== 'MARITIME_CUSTOMS_MANIFEST' || customsResult.triples.length !== 3) {
  throw new Error(`Expected MARITIME_CUSTOMS_MANIFEST with 3 triples, got ${customsResult.stats.detectedProfile}`);
}

// 5. Test with real sample_logistics_intel.csv
const sampleCsvPath = path.join(__dirname, '../../../sample_logistics_intel.csv');
if (fs.existsSync(sampleCsvPath)) {
  const sampleContent = fs.readFileSync(sampleCsvPath, 'utf-8');
  const logisticsResult = DeterministicCsvParser.parse(sampleContent, 'sample_logistics_intel.csv');
  console.log('✔ sample_logistics_intel.csv Result:', {
    detectedProfile: logisticsResult.stats.detectedProfile,
    totalRows: logisticsResult.stats.totalRows,
    triplesGenerated: logisticsResult.stats.triplesGenerated,
  });

  if (logisticsResult.triples.length === 0) {
    throw new Error('Expected at least 1 triple from sample_logistics_intel.csv');
  }
}

// 6. Test Ingesting Parsed Triples into GraphStore
async function testIngestion() {
  console.log('\nTesting ingestion of parsed triples into SQLiteGraphStore...');
  for (const triple of wireResult.triples) {
    const edgeId = await store.upsertTriple(triple);
    console.log(`   Ingested wire triple -> Edge ID: ${edgeId}`);
  }

  // Verify neighbors on "Gulf Crest Escrow Ltd"
  const escrowId = DeterministicCsvParser.makeEntityId('account', 'Gulf Crest Escrow Ltd');
  const neighbors = await store.neighbors(escrowId, 1);
  console.log(`✔ Neighbors for '${escrowId}':`, {
    nodes: neighbors.nodes.map(n => n.data.name),
    edges: neighbors.edges.map(e => e.data.label),
  });

  if (neighbors.nodes.length < 2) {
    throw new Error('Expected at least 2 nodes in wire transfer neighborhood');
  }

  // Purge test wire data
  const purged = await store.purgeBySource('wire_transfers_audit.csv');
  console.log(`✔ Cleaned up ${purged} test triples.`);
  console.log('\n--- Phase 3 Deterministic CSV Parser Verification PASSED Successfully! ---');
}

testIngestion().catch((err) => {
  console.error('FAIL in Phase 3 test:', err);
  process.exit(1);
});
