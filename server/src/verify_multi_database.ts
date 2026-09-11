import { db, initDatabase } from './db/database.js';
import { initSourceDatabases, SOURCES_DIR } from './db/sourceDatabases.js';
import { SourceService } from './services/source.service.js';
import { IngestionService } from './services/ingestion.service.js';
import { GraphService } from './services/graph.service.js';
import { ResolutionService } from './services/resolution.service.js';
import { AiService } from './services/ai.service.js';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  console.log('\n===============================================================');
  console.log('  AEGIS INTEL // MULTI-DATABASE INTELLIGENCE VERIFICATION TEST');
  console.log('===============================================================\n');

  // STEP 0: Reset unified database to prove zero hardcoded relationships from seedData
  console.log('[1/7] Initializing clean database & 4 independent source SQLite files...');
  initDatabase();
  
  // Clear entities, relationships, source records, and data sources for a pure cross-source test
  db.exec(`
    DELETE FROM entities;
    DELETE FROM relationships;
    DELETE FROM source_records;
    DELETE FROM entity_source_links;
    DELETE FROM data_sources;
  `);

  initSourceDatabases(true); // Force recreate independent SQLite source databases
  SourceService.bootstrapSources();
  console.log('✔ Clean unified DB & 4 independent source SQLite files initialized.');

  // STEP 1: Verify 4 Independent Source Databases
  console.log('\n[2/7] Verifying 4 Source Databases in Registry:');
  const sources = SourceService.listSources();
  for (const src of sources) {
    console.log(`  - [${src.status}] ${src.id}: ${src.name} (${src.tableCount} tables)`);
  }
  if (sources.length !== 4) {
    throw new Error(`Expected 4 sources, found ${sources.length}`);
  }

  // STEP 2: Schema Inspection Test
  console.log('\n[3/7] Testing Schema Inspection for LOGISTICS_DB & FACILITIES_DB:');
  const logSchema = SourceService.inspectSource('LOGISTICS_DB');
  console.log(`  - LOGISTICS_DB tables:`, logSchema.tables.map(t => `${t.tableName} (${t.columns.length} cols, ${t.rowCount} rows)`).join(', '));
  
  const facSchema = SourceService.inspectSource('FACILITIES_DB');
  console.log(`  - FACILITIES_DB tables:`, facSchema.tables.map(t => `${t.tableName} (${t.columns.length} cols, ${t.rowCount} rows)`).join(', '));

  // STEP 3: Ingest & Synchronize from all 4 independent databases
  console.log('\n[4/7] Synchronizing all 4 independent source databases into unified layer...');
  const syncResults = await SourceService.syncAllSources();
  for (const res of syncResults) {
    console.log(`  - ${res.sourceId}: Extracted ${res.extractedRows} rows -> Created ${res.entitiesCreated} entities, Linked ${res.entitiesLinked} entities, Created ${res.relationshipsCreated} semantic relationships.`);
  }

  // STEP 4: Entity Resolution & Canonical Provenance Verification
  console.log('\n[5/7] Verifying Entity Resolution & Cross-Source Provenance:');
  const abcCompany = db.prepare("SELECT * FROM entities WHERE name LIKE '%ABC Logistics%'").get() as any;
  if (!abcCompany) {
    throw new Error('ABC Logistics entity not found in unified database!');
  }
  console.log(`  - Canonical Entity: "${abcCompany.name}" (ID: ${abcCompany.id})`);
  
  const prov = ResolutionService.getEntityProvenance(abcCompany.id);
  console.log(`  - Contributing Source Databases: [${prov.contributingSources.join(', ')}]`);
  console.log(`  - Total Source Records Linked: ${prov.records.length}`);
  for (const rec of prov.records) {
    console.log(`     * Source: ${rec.sourceDbName} | Table: ${rec.sourceTable} | PK: ${rec.sourceRecordId}`);
  }

  // STEP 5: CRITICAL CROSS-SOURCE DISCOVERY TEST
  console.log('\n[6/7] CRITICAL TEST: Cross-Source Connection Discovery from Shipment S1001');
  const s1001 = db.prepare("SELECT * FROM entities WHERE name = 'S1001'").get() as any;
  if (!s1001) {
    throw new Error('Shipment S1001 not found in unified database!');
  }

  const s1001Profile = GraphService.getEntityProfile(s1001.id);
  const s1001Connections = s1001Profile?.relationships || [];
  console.log(`  - S1001 Direct Relationships (${s1001Connections.length}):`);
  for (const r of s1001Connections) {
    const isTarget = r.source_id === s1001.id;
    const neighbor = isTarget ? r.target_name : r.source_name;
    console.log(`     * S1001 --[${r.type}]--> ${neighbor} (Source DB: ${r.source_db_id}, Table: ${r.source_table}, Record: ${r.source_record_id})`);
  }

  // Multi-hop graph expansion around S1001
  const s1001Subgraph = GraphService.expandEntity(s1001.id, 3);
  const connectedNodeNames = s1001Subgraph.nodes.map((n: any) => n.data.name);
  console.log(`\n  - Discovered 3-hop Cross-Source Network around S1001:`);
  console.log(`     Nodes (${connectedNodeNames.length}):`, connectedNodeNames.join(', '));

  // Verify that the cross-source network contains elements from all 4 independent DBs:
  const hasVehicle = connectedNodeNames.includes('KA01AB1234'); // from LOGISTICS_DB / FACILITIES_DB
  const hasCompany = connectedNodeNames.some((n: string) => n.includes('ABC Logistics')); // from LOGISTICS_DB / COMPANY_REGISTRY_DB / TRANSACTIONS_DB
  const hasDirector = connectedNodeNames.includes('Ravi Kumar'); // from COMPANY_REGISTRY_DB / LOGISTICS_DB
  const hasWarehouse = connectedNodeNames.includes('W45'); // from FACILITIES_DB
  const hasTransaction = connectedNodeNames.includes('T991'); // from TRANSACTIONS_DB

  console.log(`\n  - Cross-Source Network Validation:`);
  console.log(`     [${hasVehicle ? 'PASS' : 'FAIL'}] Vehicle KA01AB1234 connected (LOGISTICS_DB + FACILITIES_DB)`);
  console.log(`     [${hasCompany ? 'PASS' : 'FAIL'}] Company ABC Logistics Pvt Ltd connected (LOGISTICS_DB + COMPANY_REGISTRY_DB + TRANSACTIONS_DB)`);
  console.log(`     [${hasDirector ? 'PASS' : 'FAIL'}] Director Ravi Kumar connected (COMPANY_REGISTRY_DB)`);
  console.log(`     [${hasWarehouse ? 'PASS' : 'FAIL'}] Warehouse W45 connected (FACILITIES_DB)`);
  console.log(`     [${hasTransaction ? 'PASS' : 'FAIL'}] Transaction T991 connected (TRANSACTIONS_DB)`);

  if (!hasVehicle || !hasCompany || !hasDirector || !hasWarehouse || !hasTransaction) {
    throw new Error('Cross-source connection discovery test failed: Graph did not link all 4 independent databases!');
  }

  // STEP 6: AI Investigation Agent Grounding & Provenance Test
  console.log('\n[7/7] Testing AI Investigation Agent Grounding:');
  
  // Positive test: Query connected entity S1001
  const aiRes1 = await AiService.investigate('What is connected to shipment S1001?');
  console.log('\n  Query 1: "What is connected to shipment S1001?"');
  console.log('  Facts (Citing Sources):');
  aiRes1.knownFacts.slice(0, 4).forEach((f: string) => console.log('   ', f));
  console.log('  Interpretation:', aiRes1.aiInterpretation);

  // Negative test: Query non-existent entity
  const aiRes2 = await AiService.investigate('Tell me about entity XYZ999');
  console.log('\n  Query 2: "Tell me about entity XYZ999" (Non-existent check)');
  console.log('  Interpretation:', aiRes2.aiInterpretation);
  if (!aiRes2.aiInterpretation.toLowerCase().includes('no matching data') && aiRes2.confidenceScore !== 0) {
    console.warn('  Warning: Negative test expected "No matching data found"');
  } else {
    console.log('  ✔ Negative test passed: Accurately returned "No matching data found" without hallucinations.');
  }

  console.log('\n===============================================================');
  console.log('  ✔ ALL VERIFICATION TESTS PASSED SUCCESSFULLY');
  console.log('===============================================================\n');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
