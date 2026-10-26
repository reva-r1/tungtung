import { db, initDatabase } from '../db/database.js';
import { JobController } from '../services/graph/jobController.js';
import { graphStore, SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';

console.log('--- Running Phase 6 Async Job Controller & Routes Verification ---');

// 1. Initialize DB
initDatabase();

async function runTest() {
  const testFileName = 'phase6_async_wire_intel.csv';
  const testContent = `remitter,beneficiary,amount,currency,transfer_date,reference_memo
P6 Escrow Holdings,P6 Maritime Logistics,2400000,USD,2024-10-14T09:00:00Z,REFURB-DRYDOCK-44
P6 Maritime Logistics,P6 Drydock Yard,1100000,USD,2024-10-15T10:30:00Z,EQUIPMENT-SUPPLY-12
`;

  // Pre-test cleanup
  await graphStore.purgeBySource(testFileName);

  // 1. Create a job
  console.log('1. Creating async pipeline job...');
  const job = JobController.createJob({
    fileName: testFileName,
    fileType: 'csv',
    metadata: { test_suite: 'phase6' },
  });

  console.log(`✔ Created Job: ${job.id} (Status: ${job.status}, Progress: ${job.progress}%)`);
  if (job.status !== 'queued' || job.progress !== 0) {
    throw new Error('Expected new job to be in queued state with 0% progress');
  }

  // 2. Execute processFileAsync
  console.log('\n2. Executing asynchronous processing in background...');
  await JobController.processFileAsync(job.id, testContent, testFileName, 'csv');

  // 3. Inspect updated job
  const completedJob = JobController.getJob(job.id);
  console.log(`✔ Job status after processing:`, {
    id: completedJob?.id,
    status: completedJob?.status,
    progress: completedJob?.progress,
    triplesExtracted: completedJob?.triplesExtracted,
  });

  if (!completedJob || completedJob.status !== 'completed' || completedJob.progress !== 100) {
    throw new Error('Expected job to transition to completed status with 100% progress');
  }
  if (completedJob.triplesExtracted !== 2) {
    throw new Error(`Expected 2 extracted triples, got ${completedJob.triplesExtracted}`);
  }

  // 4. Test Subgraph Query on Ingested Entity
  console.log('\n3. Testing Subgraph Neighbor Query on Ingested Account...');
  const centerEntityId = 'account_p6_maritime_logistics';
  const subgraph = await graphStore.neighbors(centerEntityId, 1);
  console.log(`✔ Retrieved Subgraph for '${centerEntityId}':`, {
    nodesCount: subgraph.nodes.length,
    edgesCount: subgraph.edges.length,
    nodes: subgraph.nodes.map(n => n.data.name),
  });

  if (subgraph.nodes.length < 2) {
    throw new Error('Expected at least 2 nodes in 1-hop subgraph');
  }

  // 5. Test Shortest Path
  console.log('\n4. Testing Shortest Path Query...');
  const startId = 'account_p6_escrow_holdings';
  const targetId = 'account_p6_drydock_yard';
  const path = await graphStore.shortestPath(startId, targetId, 4);
  console.log(`✔ Shortest Path (${startId} -> ${targetId}):`);
  path.forEach((ent, i) => console.log(`   Step ${i + 1}: ${ent.name} [${ent.id}]`));

  if (path.length !== 3) {
    throw new Error(`Expected 3-step path, got ${path.length}`);
  }

  // 6. Test Review Status Update
  console.log('\n5. Testing Triple Review Status Patching...');
  const triples = (graphStore as SQLiteGraphStore).getTriplesBySource(testFileName);
  if (triples.length > 0) {
    const firstTripleId = triples[0].id;
    const patched = (graphStore as SQLiteGraphStore).updateTripleStatus(firstTripleId, 'verified');
    console.log(`✔ Patched triple ${firstTripleId} to 'verified':`, patched);

    const verifiedRow = db.prepare('SELECT status FROM extracted_triples WHERE id = ?').get(firstTripleId) as any;
    if (verifiedRow.status !== 'verified') {
      throw new Error(`Expected status 'verified', got ${verifiedRow.status}`);
    }
  }

  // 7. Cleanup
  const purgedCount = await graphStore.purgeBySource(testFileName);
  console.log(`✔ Purged ${purgedCount} triples and relationships from test source.`);

  console.log('\n--- Phase 6 Async Job Controller & Routes Verification PASSED Successfully! ---');
}

runTest().catch((err) => {
  console.error('FAIL in Phase 6 test:', err);
  process.exit(1);
});
