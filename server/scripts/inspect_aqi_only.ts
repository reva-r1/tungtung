import { db } from '../src/db/database.js';

console.log('=== AQI ENTITIES ===');
const entities = db.prepare(`SELECT id, name, type, category, latitude, longitude, created_at, last_updated_at FROM world_entities WHERE category = 'AIR_QUALITY' OR last_provider = 'open_meteo_air_quality'`).all();
console.table(entities);

console.log('\n=== AQI OBSERVATIONS ===');
const obs = db.prepare(`SELECT id, entity_id, provider, observed_at, created_at FROM world_observations WHERE provider = 'open_meteo_air_quality' ORDER BY created_at ASC`).all();
console.table(obs);
