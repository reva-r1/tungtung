import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/test_aegis_intel.db');
const db = new Database(dbPath);

const danglingSources = db.prepare(`
  SELECT r.id, r.source_id, r.target_id, r.relationship_type, r.source, r.evidence
  FROM world_relationships r 
  LEFT JOIN world_entities e ON r.source_id = e.id 
  WHERE e.id IS NULL
`).all();

console.log('Dangling Sources in test_aegis_intel.db:', JSON.stringify(danglingSources, null, 2));

const prodDbPath = path.join(__dirname, '../data/aegis_intel.db');
const prodDb = new Database(prodDbPath);
const prodDanglingSources = prodDb.prepare(`
  SELECT r.id, r.source_id, r.target_id, r.relationship_type, r.source, r.evidence
  FROM world_relationships r 
  LEFT JOIN world_entities e ON r.source_id = e.id 
  WHERE e.id IS NULL
`).all();
console.log('Dangling Sources in prod aegis_intel.db:', JSON.stringify(prodDanglingSources, null, 2));
