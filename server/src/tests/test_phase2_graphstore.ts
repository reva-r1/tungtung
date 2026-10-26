import { db, initDatabase } from '../db/database.js';
import { SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';
import { ProvenancedTriple } from '../types/kg.types.js';

console.log('--- Running Phase 2 SQLiteGraphStore Verification ---');

// 1. Initialize DB
initDatabase();

const store = new SQLiteGraphStore();
const testSource = 'test_investigation_feed.csv';
const now = new Date().toISOString();

// Prepare test triples:
// Chain: Ali Hassan (Person) -> CALLED -> +91-9876543210 (Phone) -> CALLED -> Captain Vance (Person) -> OPERATES -> PHANTOM-4 (Vessel)

const triple1: ProvenancedTriple = {
  id: '',
  subjectEntityId: 'p2_smith',
  subjectName: 'Phase2 Investigator Smith',
  subjectType: 'Person',
  predicate: 'CALLED',
  objectEntityId: 'p2_phone_1',
  objectName: '+919999000001',
  objectType: 'Phone',
  sourceFile: testSource,
  sourceRow: 12,
  sourceSpan: 'Phase2 Investigator Smith placed call to +919999000001',
  extractorModel: 'deterministic_csv',
  extractorVersion: '1.0.0',
  confidence: 0.98,
  status: 'verified',
  observedAt: '2024-10-14T10:00:00.000Z',
  properties: { call_duration_sec: 140 },
  createdAt: now,
};

const triple2: ProvenancedTriple = {
  id: '',
  subjectEntityId: 'p2_phone_1',
  subjectName: '+919999000001',
  subjectType: 'Phone',
  predicate: 'CALLED',
  objectEntityId: 'p2_davis',
  objectName: 'Phase2 Officer Davis',
  objectType: 'Person',
  sourceFile: testSource,
  sourceRow: 14,
  sourceSpan: '+919999000001 dialed Phase2 Officer Davis',
  extractorModel: 'deterministic_csv',
  extractorVersion: '1.0.0',
  confidence: 0.95,
  status: 'verified',
  observedAt: '2024-10-14T10:15:00.000Z',
  properties: { call_duration_sec: 210 },
  createdAt: now,
};

const triple3: ProvenancedTriple = {
  id: '',
  subjectEntityId: 'p2_davis',
  subjectName: 'Phase2 Officer Davis',
  subjectType: 'Person',
  predicate: 'OPERATES',
  objectEntityId: 'p2_aurora',
  objectName: 'Phase2 Tanker Aurora',
  objectType: 'Vessel',
  sourceFile: testSource,
  sourceRow: 18,
  sourceSpan: 'Phase2 Officer Davis operates tanker Aurora',
  extractorModel: 'deterministic_csv',
  extractorVersion: '1.0.0',
  confidence: 0.99,
  status: 'verified',
  observedAt: '2024-10-14T11:00:00.000Z',
  properties: { imo: '9876543' },
  createdAt: now,
};

async function runTest() {
  // Pre-test cleanup for idempotency
  await store.purgeBySource(testSource);
  db.prepare("DELETE FROM entities WHERE id IN ('p2_smith', 'p2_phone_1', 'p2_davis', 'p2_aurora')").run();

  // 1. Test upsertTriple
  console.log('1. Testing upsertTriple...');
  const edge1Id = await store.upsertTriple(triple1);
  const edge2Id = await store.upsertTriple(triple2);
  const edge3Id = await store.upsertTriple(triple3);

  console.log('✔ Upserted 3 triples successfully. Edge IDs:', [edge1Id, edge2Id, edge3Id]);

  // Check extracted_triples count
  const storedTriples = store.getTriplesBySource(testSource);
  console.log('✔ getTriplesBySource count:', storedTriples.length);
  if (storedTriples.length !== 3) {
    throw new Error(`Expected 3 triples, got ${storedTriples.length}`);
  }

  // 2. Test neighbors (2 hops from Phase2 Investigator Smith)
  console.log('\n2. Testing neighbors BFS traversal (2 hops)...');
  const neighborhood = await store.neighbors('p2_smith', 2);
  console.log('✔ 2-hop neighborhood retrieved:', {
    nodesCount: neighborhood.nodes.length,
    edgesCount: neighborhood.edges.length,
    nodeNames: neighborhood.nodes.map(n => n.data.name),
  });

  const nodeIds = neighborhood.nodes.map(n => n.data.id);
  if (!nodeIds.includes('p2_smith') || !nodeIds.includes('p2_phone_1') || !nodeIds.includes('p2_davis')) {
    throw new Error('2-hop neighborhood is missing expected connected nodes');
  }

  // 3. Test shortestPath from Smith to Aurora
  console.log('\n3. Testing shortestPath (Smith -> Aurora)...');
  const path = await store.shortestPath('p2_smith', 'p2_aurora', 4);
  console.log('✔ Shortest path entities chain:');
  path.forEach((ent, idx) => {
    console.log(`   Step ${idx + 1}: ${ent.name} [Type: ${ent.type}, ID: ${ent.id}]`);
  });

  if (path.length !== 4) {
    throw new Error(`Expected path length 4, got ${path.length}`);
  }
  if (path[0].id !== 'p2_smith' || path[3].id !== 'p2_aurora') {
    throw new Error('Shortest path endpoints do not match expectations');
  }

  // 4. Test purgeBySource
  console.log('\n4. Testing purgeBySource...');
  const purged = await store.purgeBySource(testSource);
  console.log(`✔ Successfully purged ${purged} triples from source '${testSource}'.`);

  const remainingTriples = store.getTriplesBySource(testSource);
  if (remainingTriples.length !== 0) {
    throw new Error(`Expected 0 remaining triples after purge, got ${remainingTriples.length}`);
  }

  // Cleanup test entities from entities table
  db.prepare(`
    DELETE FROM entities WHERE id IN ('p2_smith', 'p2_phone_1', 'p2_davis', 'p2_aurora')
  `).run();

  console.log('✔ Cleanup complete.');
  console.log('\n--- Phase 2 SQLiteGraphStore Verification PASSED Successfully! ---');
}

runTest().catch((err) => {
  console.error('FAIL in Phase 2 test:', err);
  process.exit(1);
});
