import { db, initDatabase } from '../db/database.js';
import { SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';
import { ProvenancedTriple } from '../types/kg.types.js';

console.log('--- Running Phase 5 Entity Resolution Hook Verification ---');

// 1. Initialize DB
initDatabase();
const store = new SQLiteGraphStore();
const now = new Date().toISOString();

async function runTest() {
  // Pre-test cleanup to ensure test idempotency
  db.prepare("DELETE FROM entities WHERE id IN ('ent_p5_tariq_canonical', 'ent_p5_tareq_raw', 'p5_phone_777', 'p5_vessel_phantom5') OR name LIKE '%Tariq Al-Mansoor%' OR name LIKE '%Tareq Al-Mansoor%'").run();
  db.prepare("DELETE FROM extracted_triples WHERE source_file IN ('call_record_p5.csv', 'customs_memo_p5.txt')").run();
  db.prepare("DELETE FROM relationships WHERE source_dataset_id IN ('call_record_p5.csv', 'customs_memo_p5.txt')").run();

  console.log('1. Ingesting first record with canonical entity "Tariq Al-Mansoor"...');
  const triple1: ProvenancedTriple = {
    id: '',
    subjectEntityId: 'ent_p5_tariq_canonical',
    subjectName: 'Tariq Al-Mansoor',
    subjectType: 'Person',
    predicate: 'CALLED',
    objectEntityId: 'p5_phone_777',
    objectName: '+919877777777',
    objectType: 'Phone',
    sourceFile: 'call_record_p5.csv',
    sourceRow: 1,
    sourceSpan: 'Tariq Al-Mansoor called +919877777777',
    extractorModel: 'deterministic_csv',
    extractorVersion: '1.0.0',
    confidence: 1.0,
    status: 'verified',
    observedAt: '2024-10-14T10:00:00Z',
    properties: { phone: '9877777777' },
    createdAt: now,
  };

  const edge1Id = await store.upsertTriple(triple1);
  console.log(`✔ Triple 1 inserted. Edge ID: ${edge1Id}`);

  // Verify first entity in DB
  const ent1 = db.prepare('SELECT * FROM entities WHERE id = ?').get('ent_p5_tariq_canonical') as any;
  console.log(`✔ Canonical node created: [${ent1.id}] "${ent1.name}"`);

  console.log('\n2. Ingesting second record with misspelled variant "Tareq Al-Mansoor" and different raw ID...');
  const triple2: ProvenancedTriple = {
    id: '',
    subjectEntityId: 'ent_p5_tareq_raw', // Note the variant ID and spelling!
    subjectName: 'Tareq Al-Mansoor',
    subjectType: 'Person',
    predicate: 'OPERATES',
    objectEntityId: 'p5_vessel_phantom5',
    objectName: 'PHANTOM-5',
    objectType: 'Vessel',
    sourceFile: 'customs_memo_p5.txt',
    sourceRow: 2,
    sourceSpan: 'Tareq Al-Mansoor operates vessel PHANTOM-5',
    extractorModel: 'llm_extractor',
    extractorVersion: '1.0.0',
    confidence: 0.92,
    status: 'unreviewed',
    observedAt: '2024-10-14T12:00:00Z',
    properties: {},
    createdAt: now,
  };

  const edge2Id = await store.upsertTriple(triple2);
  console.log(`✔ Triple 2 inserted. Edge ID: ${edge2Id}`);

  // 3. Verify that variant was resolved to canonical node
  console.log('\n3. Verifying Entity Resolution Hook results...');
  const duplicateNode = db.prepare('SELECT * FROM entities WHERE id = ?').get('ent_p5_tareq_raw');
  if (duplicateNode) {
    throw new Error('FAIL: Fragmented duplicate node was created instead of resolving to canonical entity!');
  }
  console.log('✔ Confirmed: No duplicate node was created in entities table!');

  // Check aliases on canonical entity
  const updatedCanonical = db.prepare('SELECT * FROM entities WHERE id = ?').get('ent_p5_tariq_canonical') as any;
  const aliases = JSON.parse(updatedCanonical.aliases || '[]');
  console.log(`✔ Canonical entity aliases updated:`, aliases);
  if (!aliases.includes('Tareq Al-Mansoor')) {
    throw new Error('FAIL: Expected variant "Tareq Al-Mansoor" to be appended to aliases!');
  }

  // 4. Verify graph neighborhood on canonical entity
  const neighborhood = await store.neighbors('ent_p5_tariq_canonical', 1);
  console.log('\n4. Inspecting canonical entity 1-hop neighborhood:');
  console.log('   Connected nodes:', neighborhood.nodes.map(n => `"${n.data.name}" [${n.data.id}]`));
  console.log('   Connected edges:', neighborhood.edges.map(e => `${e.data.source} --[${e.data.label}]--> ${e.data.target}`));

  const sourceIds = neighborhood.edges.map(e => e.data.source);
  const targetIds = neighborhood.edges.map(e => e.data.target);
  if (sourceIds.some(s => s !== 'ent_p5_tariq_canonical')) {
    throw new Error('FAIL: All edges must originate from the canonical person node ent_p5_tariq_canonical!');
  }
  if (!targetIds.includes('p5_vessel_phantom5')) {
    throw new Error('FAIL: Vessel phantom cargo must be connected to canonical person node!');
  }
  console.log('✔ Confirmed: Both edges (Phone call AND Vessel operation) link seamlessly to the SAME canonical person node!');

  // 5. Cleanup
  await store.purgeBySource('call_record_p5.csv');
  await store.purgeBySource('customs_memo_p5.txt');
  db.prepare("DELETE FROM entities WHERE id IN ('ent_p5_tariq_canonical', 'ent_p5_tareq_raw', 'p5_phone_777', 'p5_vessel_phantom5')").run();
  console.log('✔ Cleanup complete.');

  console.log('\n--- Phase 5 Entity Resolution Hook Verification PASSED Successfully! ---');
}

runTest().catch((err) => {
  console.error('FAIL in Phase 5 test:', err);
  process.exit(1);
});
