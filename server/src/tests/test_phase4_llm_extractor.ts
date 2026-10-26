import { LlmExtractor } from '../services/graph/llmExtractor.js';
import { SchemaMapper } from '../services/graph/schemaMapper.js';
import { SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';
import { initDatabase } from '../db/database.js';

console.log('--- Running Phase 4 LLM Extractor Verification ---');

// 1. Initialize DB
initDatabase();
const store = new SQLiteGraphStore();

async function runTest() {
  // 1. Test Grounding Span Validation (Preventing Hallucinations)
  console.log('1. Testing Grounding Span Validation...');
  const sampleDocument = `
CONFIDENTIAL INTELLIGENCE MEMO - 14 OCTOBER 2024
Source: Colombo Coastal Detachment
Investigator: Sub-Inspector Rathnayake

On 14 October at approximately 14:30 hours, subject Ali Hassan was observed meeting with an unidentified associate near Colombo Port terminal 2.
Telephone intercept confirmed subject placed a cellular call from +919876543210 to contact +919123456789.
Subject referred to the cargo tanker BHARAT GAURAV commanded by Captain K. Raman scheduled to arrive next week.
`;

  // Test grounded claim (Object exists in text)
  const groundedCheck = SchemaMapper.validateTriple({
    subjectType: 'Person',
    predicate: 'SIGHTED_AT',
    objectType: 'Location',
    objectName: 'Colombo Port',
    sourceText: sampleDocument,
  });
  console.log('✔ Grounded claim validation (Colombo Port):', groundedCheck.valid);
  if (!groundedCheck.valid) throw new Error('Expected valid grounding for Colombo Port');

  // Test hallucinated claim (Object does NOT exist in text)
  const hallucinatedCheck = SchemaMapper.validateTriple({
    subjectType: 'Person',
    predicate: 'SIGHTED_AT',
    objectType: 'Location',
    objectName: 'Vladivostok Drydock',
    sourceText: sampleDocument,
  });
  console.log('✔ Hallucinated claim rejection (Vladivostok Drydock):', !hallucinatedCheck.valid, `(Reason: ${hallucinatedCheck.reason})`);
  if (hallucinatedCheck.valid) throw new Error('Expected rejection for hallucinated target');

  // Test semantic mismatch (e.g. CALLED linking Person to a Location)
  const semanticMismatchCheck = SchemaMapper.validateTriple({
    subjectType: 'Location',
    predicate: 'CALLED',
    objectType: 'Phone',
    objectName: '+919876543210',
    sourceText: sampleDocument,
  });
  console.log('✔ Semantic violation rejection (Location CALLED Phone):', !semanticMismatchCheck.valid, `(Reason: ${semanticMismatchCheck.reason})`);
  if (semanticMismatchCheck.valid) throw new Error('Expected semantic rejection');

  // 2. Test Rule-based Fallback / Unstructured Extractor
  console.log('\n2. Testing Extraction Engine on Unstructured Text...');
  const extraction = await LlmExtractor.extract(sampleDocument, 'police_memo_colombo.txt');
  console.log('✔ Extraction results:', {
    extractorUsed: extraction.stats.extractorUsed,
    validatedTriplesCount: extraction.triples.length,
    triples: extraction.triples.map(t => `${t.subjectName} --[${t.predicate}]--> ${t.objectName} (span: "${t.sourceSpan}")`),
  });

  if (extraction.triples.length === 0) {
    throw new Error('Expected at least 1 extracted triple from sample intelligence memo');
  }

  // 3. Test Ingesting Extracted Unstructured Triples into GraphStore
  console.log('\n3. Testing Ingestion of Extracted Triples into GraphStore...');
  for (const triple of extraction.triples) {
    const edgeId = await store.upsertTriple(triple);
    console.log(`   Ingested extracted triple -> Edge ID: ${edgeId}`);
  }

  // 4. Clean up test data
  const purged = await store.purgeBySource('police_memo_colombo.txt');
  console.log(`✔ Cleaned up ${purged} extracted test triples.`);

  console.log('\n--- Phase 4 LLM Extractor Verification PASSED Successfully! ---');
}

runTest().catch((err) => {
  console.error('FAIL in Phase 4 test:', err);
  process.exit(1);
});
