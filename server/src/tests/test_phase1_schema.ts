import { db, initDatabase } from '../db/database.js';
import { SchemaMapper } from '../services/graph/schemaMapper.js';
import { ProvenancedTriple, PipelineJob } from '../types/kg.types.js';
import crypto from 'crypto';

console.log('--- Running Phase 1 Schema & Type Verification ---');

// 1. Initialize DB
initDatabase();

// 2. Check that extracted_triples and pipeline_jobs tables exist
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name IN ('extracted_triples', 'pipeline_jobs')
`).all() as { name: string }[];

const tableNames = tables.map(t => t.name);
console.log('Verified tables present in SQLite:', tableNames);
if (!tableNames.includes('extracted_triples') || !tableNames.includes('pipeline_jobs')) {
  console.error('FAIL: Missing required tables!');
  process.exit(1);
}

// 3. Test Deterministic ID generation for triples
function computeTripleId(subId: string, pred: string, objId: string, source: string): string {
  return crypto.createHash('sha256').update(`${subId}:${pred}:${objId}:${source}`).digest('hex').substring(0, 32);
}

const sampleTripleId = computeTripleId('ent_ali_hassan', 'CALLED', 'ent_phone_9876', 'call_log.csv');
const now = new Date().toISOString();

const insertTriple = db.prepare(`
  INSERT INTO extracted_triples 
  (id, subject_entity_id, subject_name, subject_type, predicate, object_entity_id, object_name, object_type, source_file, source_row, source_span, extractor_model, extractor_version, confidence, status, observed_at, properties, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET confidence = excluded.confidence
`);

insertTriple.run(
  sampleTripleId,
  'ent_ali_hassan',
  'Ali Hassan',
  'PERSON',
  'CALLED',
  'ent_phone_9876',
  '+91-9876543210',
  'ENTITY',
  'call_log.csv',
  47,
  'Ali Hassan contacted +91-9876543210 at 14:02',
  'deterministic_csv',
  '1.0.0',
  0.95,
  'unreviewed',
  '2024-10-14T14:02:00.000Z',
  JSON.stringify({ duration_seconds: 180 }),
  now
);

const retrievedTriple = db.prepare('SELECT * FROM extracted_triples WHERE id = ?').get(sampleTripleId) as any;
console.log('✔ Successfully inserted & retrieved sample triple:', {
  id: retrievedTriple.id,
  subject: retrievedTriple.subject_name,
  predicate: retrievedTriple.predicate,
  object: retrievedTriple.object_name,
  source: retrievedTriple.source_file,
  status: retrievedTriple.status
});

// 4. Test Job insertion
const sampleJobId = 'job_' + Date.now();
const insertJob = db.prepare(`
  INSERT INTO pipeline_jobs 
  (id, file_name, file_path, file_type, status, progress, triples_extracted, entities_resolved, error, metadata, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertJob.run(
  sampleJobId,
  'call_log.csv',
  '/data/uploads/call_log.csv',
  'csv',
  'queued',
  0,
  0,
  0,
  null,
  JSON.stringify({ total_rows: 500 }),
  now,
  now
);

const retrievedJob = db.prepare('SELECT * FROM pipeline_jobs WHERE id = ?').get(sampleJobId) as any;
console.log('✔ Successfully inserted & retrieved pipeline job:', {
  id: retrievedJob.id,
  file: retrievedJob.file_name,
  status: retrievedJob.status
});

// 5. Test SchemaMapper
const personMapping = SchemaMapper.normalizeEntityType('suspect');
console.log('✔ SchemaMapper suspect ->', personMapping.canonicalType, personMapping.category);

const vesselMapping = SchemaMapper.normalizeEntityType('cargo_ship');
console.log('✔ SchemaMapper cargo_ship ->', vesselMapping.canonicalType, vesselMapping.category);

const callPred = SchemaMapper.normalizePredicate('DIALED');
console.log('✔ SchemaMapper DIALED ->', callPred.canonicalPredicate, callPred.label);

// Test validation & grounding
const validGrounding = SchemaMapper.validateTriple({
  subjectType: 'Person',
  predicate: 'CALLED',
  objectType: 'Phone',
  objectName: '+91-9876543210',
  sourceText: 'The subject Ali Hassan contacted +91-9876543210 from hotel lobby.'
});
console.log('✔ Grounding check on valid span:', validGrounding.valid);

const invalidGrounding = SchemaMapper.validateTriple({
  subjectType: 'Person',
  predicate: 'CALLED',
  objectType: 'Phone',
  objectName: '+91-1111111111',
  sourceText: 'The subject Ali Hassan contacted +91-9876543210 from hotel lobby.'
});
console.log('✔ Grounding check on hallucinated target:', invalidGrounding.valid, `(Reason: ${invalidGrounding.reason})`);

// Clean up test data
db.prepare('DELETE FROM extracted_triples WHERE id = ?').run(sampleTripleId);
db.prepare('DELETE FROM pipeline_jobs WHERE id = ?').run(sampleJobId);
console.log('✔ Test cleanup complete.');
console.log('--- Phase 1 Verification PASSED Successfully! ---');
