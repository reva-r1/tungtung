import { db } from '../src/db/database.js';

console.log('=== ENTITIES (WEATHER & AQI) ===');
const entities = db.prepare(`
  SELECT id, name, type, category, latitude, longitude, last_provider, created_at, last_updated_at 
  FROM world_entities 
  WHERE category IN ('METEOROLOGICAL', 'AIR_QUALITY') OR type IN ('WEATHER_STATION', 'AIR_QUALITY_NODE')
`).all();
console.table(entities);

console.log('\n=== OBSERVATIONS COUNT BY PROVIDER ===');
const obsCount = db.prepare(`
  SELECT provider, count(id) as count 
  FROM world_observations 
  GROUP BY provider
`).all();
for (const row of obsCount) {
  console.log(`Provider: ${row.provider.padEnd(25)} | Count: ${row.count}`);
}

console.log('\n=== AIR QUALITY OBSERVATIONS (ALL) ===');
const aqiObs = db.prepare(`
  SELECT id, entity_id, provider, observed_at, created_at, substr(value, 1, 90) as val 
  FROM world_observations 
  WHERE provider = 'open_meteo_air_quality' 
  ORDER BY created_at ASC
`).all();
console.log(`Total AQI observations in DB: ${aqiObs.length}`);
for (const o of aqiObs) {
  console.log(`- ID: ${o.id.padEnd(65)} | Entity: ${o.entity_id.padEnd(25)} | Observed: ${o.observed_at}`);
}

console.log('\n=== WEATHER OBSERVATIONS ===');
const wxObs = db.prepare(`
  SELECT id, entity_id, provider, observed_at, created_at, substr(value, 1, 120) as val_summary 
  FROM world_observations 
  WHERE provider = 'open_meteo_weather' 
  ORDER BY observed_at DESC
`).all();
console.table(wxObs);

console.log('\n=== RAW OBSERVATIONS / PAYLOADS COUNT ===');
const rawCount = db.prepare(`
  SELECT provider, count(id) as count, max(received_at) as latest_received 
  FROM raw_observations 
  GROUP BY provider
`).all();
console.table(rawCount);

console.log('\n=== CWC HYDROLOGY IN DB ===');
const cwcObs = db.prepare(`
  SELECT id, entity_id, observed_at, created_at, substr(value, 1, 100) as val 
  FROM world_observations 
  WHERE provider = 'cwc_india_wris' 
  ORDER BY observed_at DESC 
  LIMIT 20
`).all();
console.table(cwcObs);

