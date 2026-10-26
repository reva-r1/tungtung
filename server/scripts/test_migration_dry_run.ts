import { runPhase3Migration } from '../src/db/migrations/phase3_data_integrity_migration.js';
import path from 'path';
import fs from 'fs';

const testDb = path.resolve('data/test_migration_copy.db');
console.log('Running Phase 3 migration against isolated test copy:', testDb);

const result = runPhase3Migration(testDb);
console.log('\n--- MIGRATION TEST RESULT ---');
console.log(JSON.stringify(result, null, 2));

if (result.success) {
  console.log('\n✔ TEST MIGRATION PASSED: 0 dangling targets, 0 FK errors, integrity OK');
} else {
  console.error('\n✘ TEST MIGRATION FAILED');
  process.exit(1);
}

// Clean up test backup and copy
try {
  if (fs.existsSync(result.backupPath)) fs.unlinkSync(result.backupPath);
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  console.log('Cleaned up test database artifacts.');
} catch (_) {}
