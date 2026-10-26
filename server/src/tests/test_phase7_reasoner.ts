import { db, initDatabase } from '../db/database.js';
import { KgReasonerService } from '../services/graph/kgReasoner.js';
import { graphStore, SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';
import { ProvenancedTriple } from '../types/kg.types.js';

console.log('--- Running Phase 7 Epistemic Reasoner Verification ---');

// 1. Initialize DB
initDatabase();
const store = new SQLiteGraphStore();
const now = new Date().toISOString();

async function runTest() {
  const testSource = 'p7_investigation_network.csv';

  // Pre-test cleanup
  await store.purgeBySource(testSource);
  db.prepare("DELETE FROM entities WHERE id IN ('ent_p7_ali', 'p7_phone_99', 'ent_p7_vance', 'vessel_p7_valor')").run();

  console.log('1. Ingesting multi-hop intelligence network...');
  const t1: ProvenancedTriple = {
    id: '',
    subjectEntityId: 'ent_p7_ali',
    subjectName: 'Ali Hassan (P7)',
    subjectType: 'Person',
    predicate: 'CALLED',
    objectEntityId: 'p7_phone_99',
    objectName: '+919988776655',
    objectType: 'Phone',
    sourceFile: testSource,
    sourceRow: 1,
    sourceSpan: 'Ali Hassan placed call to +919988776655 prior to vessel docking',
    extractorModel: 'deterministic_csv',
    extractorVersion: '1.0.0',
    confidence: 1.0,
    status: 'verified',
    observedAt: '2024-10-14T09:00:00Z',
    properties: {},
    createdAt: now,
  };

  const t2: ProvenancedTriple = {
    id: '',
    subjectEntityId: 'p7_phone_99',
    subjectName: '+919988776655',
    subjectType: 'Phone',
    predicate: 'CALLED',
    objectEntityId: 'ent_p7_vance',
    objectName: 'Captain Vance (P7)',
    objectType: 'Person',
    sourceFile: testSource,
    sourceRow: 2,
    sourceSpan: '+919988776655 contacted Captain Vance',
    extractorModel: 'deterministic_csv',
    extractorVersion: '1.0.0',
    confidence: 1.0,
    status: 'verified',
    observedAt: '2024-10-14T09:30:00Z',
    properties: {},
    createdAt: now,
  };

  const t3: ProvenancedTriple = {
    id: '',
    subjectEntityId: 'ent_p7_vance',
    subjectName: 'Captain Vance (P7)',
    subjectType: 'Person',
    predicate: 'OPERATES',
    objectEntityId: 'vessel_p7_valor',
    objectName: 'Tanker Valor',
    objectType: 'Vessel',
    sourceFile: testSource,
    sourceRow: 3,
    sourceSpan: 'Captain Vance commands tanker Tanker Valor',
    extractorModel: 'deterministic_csv',
    extractorVersion: '1.0.0',
    confidence: 1.0,
    status: 'verified',
    observedAt: '2024-10-14T10:00:00Z',
    properties: {},
    createdAt: now,
  };

  const e1 = await store.upsertTriple(t1);
  const e2 = await store.upsertTriple(t2);
  const e3 = await store.upsertTriple(t3);
  console.log(`✔ Ingested 3 network edges:`, [e1, e2, e3]);

  // 2. Run Epistemic Reasoner over Ali Hassan (2 hops)
  console.log('\n2. Running KgReasonerService on seed entity "Ali Hassan (P7)" (2 hops)...');
  const result = await KgReasonerService.analyzeEntity({
    entityId: 'ent_p7_ali',
    hops: 2,
    question: 'How does Ali Hassan connect to maritime vessels and who are his intermediaries?',
  });

  console.log('\n3. Inspecting Reasoner Output & Grounding:');
  console.log('   Entity:', result.entityName, `[ID: ${result.entityId}]`);
  console.log('   Subgraph Stats:', result.subgraphStats);
  console.log('   Summary:', result.reasoning.summary);
  console.log(`   Verified Facts (${result.reasoning.verifiedFacts.length}):`);
  result.reasoning.verifiedFacts.forEach((f, idx) => {
    console.log(`     [Fact ${idx + 1}] "${f.text}" | Evidence Cites: [${f.evidenceIds.join(', ')}]`);
  });
  console.log(`   Verified Inferences (${result.reasoning.verifiedInferences.length}):`);
  result.reasoning.verifiedInferences.forEach((inf, idx) => {
    console.log(`     [Inference ${idx + 1}] "${inf.text}" | Based on Facts: [${inf.basedOnFactIndexes.join(', ')}]`);
  });
  console.log(`   Hypotheses (${result.reasoning.hypotheses.length}):`);
  result.reasoning.hypotheses.forEach((h, idx) => {
    console.log(`     [Hypothesis ${idx + 1}] (${h.plausibility.toUpperCase()} Plausibility) "${h.text}"`);
    console.log(`       Confirm: ${h.confirmWith} | Refute: ${h.refuteWith}`);
  });

  // Verification metrics
  console.log('\n4. Verification & Grounding Metrics:');
  console.log('   Grounded Ratio:', result.verification.groundedRatio);
  console.log('   Total Facts Examined:', result.verification.totalFactsExamined);
  console.log('   Demoted Claims Count:', result.reasoning.demotedClaims.length);
  console.log('   Is Fully Grounded:', result.verification.isFullyGrounded);

  if (result.subgraphStats.edgeCount < 2) {
    throw new Error('Expected at least 2 edges in 2-hop neighborhood');
  }

  // Ensure plausibility values are strictly valid
  for (const h of result.reasoning.hypotheses) {
    if (!['low', 'medium', 'high'].includes(h.plausibility)) {
      throw new Error(`Invalid plausibility value "${h.plausibility}" (must be low, medium, or high)`);
    }
  }

  // 5. Cleanup
  await store.purgeBySource(testSource);
  db.prepare("DELETE FROM entities WHERE id IN ('ent_p7_ali', 'p7_phone_99', 'ent_p7_vance', 'vessel_p7_valor')").run();
  console.log('\n✔ Cleanup complete.');

  console.log('--- Phase 7 Epistemic Reasoner Verification PASSED Successfully! ---');
}

runTest().catch((err) => {
  console.error('FAIL in Phase 7 test:', err);
  process.exit(1);
});
