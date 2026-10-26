import { db } from '../src/db/database.js';

const raw = db.prepare(`SELECT payload, received_at FROM raw_observations WHERE provider = 'cwc_india_wris' ORDER BY received_at DESC LIMIT 1`).get() as any;

if (raw) {
  let parsed: any;
  try {
    parsed = JSON.parse(raw.payload);
  } catch (e: any) {
    console.error('Failed to parse raw payload:', e.message);
  }
  const dataArr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : []);
  console.log('Total records in raw payload:', dataArr.length);
  if (dataArr.length > 0) {
    console.log('Sample record keys:', Object.keys(dataArr[0]));
    console.log('Sample record 0:', JSON.stringify(dataArr[0], null, 2));
    if (dataArr.length > 1) {
      console.log('Sample record 1:', JSON.stringify(dataArr[1], null, 2));
    }
  }
} else {
  console.log('No raw record found for cwc_india_wris');
}
