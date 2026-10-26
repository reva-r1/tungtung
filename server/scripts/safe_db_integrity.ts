import Database from 'better-sqlite3';

const db = new Database('data/aegis_intel.db', { readonly: true });

console.log('=== PRAGMA INTEGRITY CHECK ===');
const integrity = db.prepare('PRAGMA integrity_check').all();
console.log(integrity);

console.log('=== PRAGMA FOREIGN KEY CHECK ===');
const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
console.log(fkCheck.length === 0 ? '✔ 0 foreign key violations' : fkCheck);

console.log('=== TABLE ROW COUNTS ===');
const tables = ['world_entities', 'world_observations', 'raw_observations', 'moving_entities', 'historical_breadcrumbs', 'entities', 'locations'];
for (const t of tables) {
  try {
    const r = db.prepare(`SELECT count(*) as c FROM ${t}`).get() as any;
    console.log(`- ${t.padEnd(25)}: ${r.c}`);
  } catch (err: any) {
    console.log(`- ${t.padEnd(25)}: Table not found or error (${err.message})`);
  }
}

console.log('\n=== ENTITY BREAKDOWN BY TYPE ===');
const entityTypes = db.prepare(`SELECT type, count(*) as c FROM world_entities GROUP BY type ORDER BY c DESC`).all();
console.table(entityTypes);

console.log('\n=== CHECK FOR FORBIDDEN / SEED OPERATIONAL NAMES ===');
const suspicious = db.prepare(`
  SELECT id, name, type FROM world_entities 
  WHERE name LIKE '%Mock%' OR name LIKE '%Synthetic%' OR name LIKE '%Seed%' OR name LIKE '%Fake%'
`).all();
console.log(suspicious.length === 0 ? '✔ 0 synthetic / mock entities in world_entities' : suspicious);
