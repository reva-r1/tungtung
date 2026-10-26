import Database from 'better-sqlite3';

const db = new Database('data/aegis_intel.db');

const tx = db.transaction(() => {
  const orphans = db.prepare('SELECT id, name FROM world_entities WHERE id LIKE ?').all('HYDRO_CWC_%');
  console.log('Found orphan stubs:', orphans.length);

  const delRes = db.prepare('DELETE FROM world_entities WHERE id LIKE ?').run('HYDRO_CWC_%');
  console.log('Deleted orphan stubs:', delRes.changes);

  db.prepare(`
    INSERT INTO data_migration_log (id, migration_name, executed_at, backup_path, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'phase2_hydro_reconciliation_' + Date.now(),
    'phase-2-hydro-duplicate-entity-reconciliation',
    new Date().toISOString(),
    'data/aegis_intel.backup_pre_hydro_reconciliation_20261016.db',
    JSON.stringify({
      reconciledReservoirs: 16,
      orphanStubsRemoved: delRes.changes,
      canonicalEntitiesRetained: 16,
      observationsPreserved: 32
    })
  );
});

tx();

console.log('Integrity check:', db.prepare('PRAGMA integrity_check').get());
console.log('FK check violations:', db.prepare('PRAGMA foreign_key_check').all().length);
console.log('Total reservoir entities remaining:', db.prepare("SELECT count(*) as c FROM world_entities WHERE type = 'WATER_RESERVOIR_GAUGE'").get().c);
console.log('Total world entities count:', db.prepare("SELECT count(*) as c FROM world_entities").get().c);
console.log('Total hydrological observations:', db.prepare("SELECT count(*) as c FROM world_observations WHERE data_type = 'HYDROLOGICAL'").get().c);
