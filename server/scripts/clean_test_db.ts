import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/test_aegis_intel.db');
const db = new Database(dbPath);

db.prepare("DELETE FROM world_observations WHERE id = 'obs_cauvery_res_test_01'").run();
db.prepare("DELETE FROM world_entities WHERE id = 'RESERVOIR_ANEKAL_CAUVERY_01'").run();
db.prepare("DELETE FROM world_relationships WHERE source_id = 'RESERVOIR_ANEKAL_CAUVERY_01'").run();
console.log('Cleaned test_aegis_intel.db successfully.');
db.close();
