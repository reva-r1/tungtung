import { db } from '../src/db/database.js';

console.log('=== RELATIONSHIPS IN DB ===');
const rels = db.prepare('SELECT count(*) as c FROM world_relationships').get() as any;
console.log('Total world_relationships:', rels.c);

console.log('=== CHECK DANGLING EDGES ===');
const danglingSource = db.prepare(`
  SELECT r.id, r.source_id, r.target_id, r.relationship_type 
  FROM world_relationships r 
  LEFT JOIN world_entities e ON r.source_id = e.id 
  WHERE e.id IS NULL
`).all();
console.log('Dangling sources:', danglingSource.length);

const danglingTarget = db.prepare(`
  SELECT r.id, r.source_id, r.target_id, r.relationship_type 
  FROM world_relationships r 
  LEFT JOIN world_entities e ON r.target_id = e.id 
  WHERE e.id IS NULL
`).all();
console.log('Dangling targets:', danglingTarget.length);
for (const dt of danglingTarget) {
  console.log(`- Dangling rel: ${dt.id} | source: ${dt.source_id} | target: ${dt.target_id} | type: ${dt.relationship_type}`);
}

console.log('\n=== CHECK CORRIDOR & AIRPORT REFERENCE ENTITIES ===');
const refEntities = db.prepare(`
  SELECT id, name, type FROM world_entities 
  WHERE id IN ('ROAD_CORRIDOR_NH48', 'AIRPORT_KEMPEGOWDA_BLR', 'CATCHMENT_CAUVERY_SOUTH')
`).all();
console.log('Reference entities found:', refEntities);
