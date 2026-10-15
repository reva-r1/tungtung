import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// Force test environment & isolated test database
process.env.NODE_ENV = 'test';
const TEST_DB_PATH = path.join(__dirname, '../../data/test_phase1_isolation.db');
process.env.DATABASE_FILE = TEST_DB_PATH;

// Ensure clean test DB
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

import { initDatabase, db } from '../db/database.js';
import { validateEnvironment } from '../config/environment.js';
import { MockDataProvider } from '../connectors/providers/mock/MockDataProvider.js';
import { providerRegistry } from '../connectors/registry/ProviderRegistry.js';
import { AisRealReplayProvider } from '../services/maritime/providers/aisRealReplayProvider.js';
import { seedDatabase } from '../db/seedData.js';
import { initSourceDatabases } from '../db/sourceDatabases.js';
import { runCleanup } from '../db/cleanup_synthetic_data.js';

// Unconfigured providers to verify fail-closed behavior
import { GTFSRealtimeProvider } from '../connectors/providers/transit/GTFSRealtimeProvider.js';
import { PublicWaterLevelProvider } from '../connectors/providers/water/PublicWaterLevelProvider.js';
import { GBFSProvider } from '../connectors/providers/mobility/GBFSProvider.js';
import { NationalGridEnergyProvider } from '../connectors/providers/energy/NationalGridEnergyProvider.js';
import { DataGovInProvider } from '../connectors/providers/government/DataGovInProvider.js';
import { PublicFeedProvider } from '../connectors/providers/news/PublicFeedProvider.js';
import { ExchangeRateProvider } from '../connectors/providers/finance/ExchangeRateProvider.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  ✘ [FAIL] ${name}: ${err.message}`);
  }
}

export async function runPhase1IsolationTests() {
  console.log('\n=============================================================');
  console.log('  REVANA TECHNOLOGIES — PHASE 1 ENVIRONMENT ISOLATION SUITE');
  console.log('=============================================================\n');

  initDatabase();

  // 1. Production startup rejects seedDatabase
  await runTest('1. Seed routine cannot execute in production mode', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      seedDatabase(true);
      assert(false, 'Expected seedDatabase to throw in production mode');
    } catch (err: any) {
      assert(err.message.includes('[Security Violation]'), 'Error message must specify Security Violation');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // 2. Production environment rejects REVANA_DEMO_MODE=true
  await runTest('2. Environment validation rejects REVANA_DEMO_MODE in production', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevDemo = process.env.REVANA_DEMO_MODE;
    process.env.NODE_ENV = 'production';
    process.env.REVANA_DEMO_MODE = 'true';
    try {
      validateEnvironment();
      assert(false, 'Expected validateEnvironment to fail when DEMO_MODE is true in production');
    } catch (err: any) {
      assert(err.message.includes('[SECURITY FAULT]'), 'Must throw fatal security fault');
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.REVANA_DEMO_MODE = prevDemo;
    }
  });

  // 3. Production environment rejects MARITIME_DEMO_MODE=true
  await runTest('3. Environment validation rejects MARITIME_DEMO_MODE in production', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevMaritime = process.env.MARITIME_DEMO_MODE;
    process.env.NODE_ENV = 'production';
    process.env.MARITIME_DEMO_MODE = 'true';
    try {
      validateEnvironment();
      assert(false, 'Expected validateEnvironment to fail when MARITIME_DEMO_MODE is true in production');
    } catch (err: any) {
      assert(err.message.includes('[SECURITY FAULT]'), 'Must throw fatal security fault');
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.MARITIME_DEMO_MODE = prevMaritime;
    }
  });

  // 4. Production mode rejects MockDataProvider instantiation
  await runTest('4. MockDataProvider instantiation fails closed in production', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      new MockDataProvider('test_prod_mock');
      assert(false, 'Expected MockDataProvider constructor to throw in production');
    } catch (err: any) {
      assert(err.message.includes('[Security Violation]'), 'Must throw Security Violation on mock instantiation');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // 5. Production mode rejects MockDataProvider registration in ProviderRegistry
  await runTest('5. ProviderRegistry rejects MOCK category in production', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // Create a mock provider while temporarily bypassing constructor check to test registry defense-in-depth
      process.env.NODE_ENV = 'test';
      const mock = new MockDataProvider('test_registry_mock');
      process.env.NODE_ENV = 'production';

      providerRegistry.register(mock);
      assert(false, 'Expected ProviderRegistry.register to throw for MOCK provider in production');
    } catch (err: any) {
      assert(err.message.includes('[Security Violation]'), 'Must reject mock provider in registry');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // 6. Production mode rejects AisRealReplayProvider instantiation
  await runTest('6. AisRealReplayProvider constructor fails closed in production', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      new AisRealReplayProvider();
      assert(false, 'Expected AisRealReplayProvider to throw in production');
    } catch (err: any) {
      assert(err.message.includes('[Security Violation]'), 'Must throw Security Violation on replay feed in production');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // 7. Unconfigured GTFS provider returns 0 observations and records failure
  await runTest('7. GTFSRealtimeProvider fails closed without fake buses', async () => {
    const prevUrl = process.env.GTFS_FEED_URL;
    delete process.env.GTFS_FEED_URL;
    const provider = new GTFSRealtimeProvider();
    const { rawData } = await provider.fetch();
    assert(rawData === null, 'Unconfigured GTFS rawData must be null');
    const observations = await provider.normalize(rawData);
    assert(observations.length === 0, 'Unconfigured GTFS must produce exactly 0 observations');
    assert(provider.getHealth().status === 'DEGRADED', 'Provider status must be DEGRADED on missing config');
    process.env.GTFS_FEED_URL = prevUrl;
  });

  // 8. Unconfigured Water Level provider returns 0 observations and records failure
  await runTest('8. PublicWaterLevelProvider fails closed without fake gauges', async () => {
    const prevUrl = process.env.WATER_GAUGE_URL;
    delete process.env.WATER_GAUGE_URL;
    const provider = new PublicWaterLevelProvider();
    const { rawData } = await provider.fetch();
    assert(rawData === null, 'Unconfigured water provider rawData must be null');
    const observations = await provider.normalize(rawData);
    assert(observations.length === 0, 'Unconfigured water provider must produce 0 observations');
    assert(provider.getHealth().status === 'DEGRADED', 'Provider status must be DEGRADED');
    process.env.WATER_GAUGE_URL = prevUrl;
  });

  // 9. Unconfigured GBFS provider returns 0 observations and records failure
  await runTest('9. GBFSProvider fails closed without fake mobility hubs', async () => {
    const prevUrl = process.env.GBFS_FEED_URL;
    delete process.env.GBFS_FEED_URL;
    const provider = new GBFSProvider();
    const { rawData } = await provider.fetch();
    assert(rawData === null, 'Unconfigured GBFS rawData must be null');
    const observations = await provider.normalize(rawData);
    assert(observations.length === 0, 'Unconfigured GBFS must produce 0 observations');
    assert(provider.getHealth().status === 'DEGRADED', 'Provider status must be DEGRADED');
    process.env.GBFS_FEED_URL = prevUrl;
  });

  // 10. Unconfigured Energy provider returns 0 observations and records failure
  await runTest('10. NationalGridEnergyProvider fails closed without fake substations', async () => {
    const prevUrl = process.env.GRID_TELEMETRY_URL;
    delete process.env.GRID_TELEMETRY_URL;
    const provider = new NationalGridEnergyProvider();
    const { rawData } = await provider.fetch();
    assert(rawData === null, 'Unconfigured Energy rawData must be null');
    const observations = await provider.normalize(rawData);
    assert(observations.length === 0, 'Unconfigured Energy must produce 0 observations');
    assert(provider.getHealth().status === 'DEGRADED', 'Provider status must be DEGRADED');
    process.env.GRID_TELEMETRY_URL = prevUrl;
  });

  // 11. Unconfigured DataGovIn provider returns 0 observations and records failure
  await runTest('11. DataGovInProvider fails closed without fake APMC mandi records', async () => {
    const prevKey = process.env.DATA_GOV_API_KEY;
    delete process.env.DATA_GOV_API_KEY;
    const provider = new DataGovInProvider();
    const { rawData } = await provider.fetch();
    assert(rawData === null, 'Unconfigured DataGovIn rawData must be null');
    const observations = await provider.normalize(rawData);
    assert(observations.length === 0, 'Unconfigured DataGovIn must produce 0 observations');
    assert(provider.getHealth().status === 'DEGRADED', 'Provider status must be DEGRADED');
    process.env.DATA_GOV_API_KEY = prevKey;
  });

  // 12. Unconfigured PublicFeedProvider returns 0 observations and records failure
  await runTest('12. PublicFeedProvider fails closed without fake cyclone alerts', async () => {
    const prevUrl = process.env.CIVIC_ALERTS_FEED_URL;
    delete process.env.CIVIC_ALERTS_FEED_URL;
    const provider = new PublicFeedProvider();
    const { rawData } = await provider.fetch();
    assert(rawData === null, 'Unconfigured Civic alerts rawData must be null');
    const observations = await provider.normalize(rawData);
    assert(observations.length === 0, 'Unconfigured alerts must produce 0 observations');
    assert(provider.getHealth().status === 'DEGRADED', 'Provider status must be DEGRADED');
    process.env.CIVIC_ALERTS_FEED_URL = prevUrl;
  });

  // 13. Offline ExchangeRateProvider throws and does not fabricate rates
  await runTest('13. ExchangeRateProvider does not fabricate static fallback rates', async () => {
    const provider = new ExchangeRateProvider();
    // Pass an invalid endpoint / offline simulation by overriding endpointUrl temporarily
    (provider as any).metadata.endpointUrl = 'https://invalid-non-existent-domain-12345.xyz';
    try {
      await provider.fetch();
      assert(false, 'Expected fetch to throw on network error rather than returning fake rates');
    } catch (err: any) {
      assert(err.message.length > 0, 'Must throw error on failure');
      assert(provider.getHealth().status === 'DEGRADED', 'Health must reflect failure');
    }
  });

  // 14. Database cleanup idempotency and customer data preservation
  await runTest('14. Database cleanup strictly preserves customer data and passes integrity', async () => {
    // Populate test DB with real customer location, real ship, and synthetic data
    db.prepare(`
      INSERT OR REPLACE INTO locations (id, name, city, state, latitude, longitude, type)
      VALUES ('LOC-ENT-CUST-TEST01', 'Test Customer Logistics Hub', 'Bangalore', 'Karnataka', 12.97, 77.59, 'TRANSIT_POINT')
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO moving_entities (id, name, type, latitude, longitude, last_updated_at, properties)
      VALUES ('SHIP_REAL_001', 'Real Streamed Vessel', 'ship', 12.0, 80.0, datetime('now'), '{"providerSource":"AISStream.io"}')
    `).run();

    // Insert synthetic items
    db.prepare(`
      INSERT OR REPLACE INTO moving_entities (id, name, type, latitude, longitude, last_updated_at, properties)
      VALUES ('SHIP_REPLAY_001', 'Synthetic Replay Vessel', 'ship', 12.0, 80.0, datetime('now'), '{"providerSource":"AEGIS Real-World AIS Replay Feed"}')
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO maritime_patterns (pattern_id, type, region, time_window, entities_observed, baseline, deviation_percent, observation, hypotheses, status, detected_at, updated_at)
      VALUES ('PAT_CORRIDOR_MALACCA', 'traffic_concentration', 'Malacca', '24h', 62, 41, 51.2, 'Synthetic', '[]', 'detected', datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT OR REPLACE INTO world_entities (id, type, name, category, latitude, longitude, current_state, created_at, updated_at, last_observed_at, last_updated_at, source_providers, last_provider)
      VALUES ('BUS_BMTC_335E', 'TRANSIT_VEHICLE', 'BMTC Volvo Bus', 'TRANSIT', 12.97, 77.59, '{}', datetime('now'), datetime('now'), datetime('now'), datetime('now'), '[]', 'gtfs_realtime')
    `).run();

    // Run cleanup in execute mode against active test database
    const plan = runCleanup(true, db.name);
    assert(plan.preservedCustomerRecords >= 1, 'Must preserve customer records');
    assert(plan.foreignKeyErrors.length === 0, 'Must have 0 foreign key errors');
    assert(plan.integrityStatus === 'ok', 'SQLite integrity check must be ok');

    // Verify synthetic records are gone
    const replayLeft = (db.prepare("SELECT COUNT(*) as c FROM moving_entities WHERE id = 'SHIP_REPLAY_001'").get() as any).c;
    const malaccaLeft = (db.prepare("SELECT COUNT(*) as c FROM maritime_patterns WHERE pattern_id = 'PAT_CORRIDOR_MALACCA'").get() as any).c;
    const busLeft = (db.prepare("SELECT COUNT(*) as c FROM world_entities WHERE id = 'BUS_BMTC_335E'").get() as any).c;
    assert(replayLeft === 0, 'Synthetic replay vessel must be deleted');
    assert(malaccaLeft === 0, 'Fabricated Malacca pattern must be deleted');
    assert(busLeft === 0, 'Simulated world entity must be deleted');

    // Verify real records remain
    const custLeft = (db.prepare("SELECT COUNT(*) as c FROM locations WHERE id = 'LOC-ENT-CUST-TEST01'").get() as any).c;
    const realShipLeft = (db.prepare("SELECT COUNT(*) as c FROM moving_entities WHERE id = 'SHIP_REAL_001'").get() as any).c;
    assert(custLeft === 1, 'Real customer record must remain intact');
    assert(realShipLeft === 1, 'Real AIS vessel must remain intact');
  });

  // 15. Production mode rejects initSourceDatabases
  await runTest('15. initSourceDatabases fails closed in production mode', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      initSourceDatabases();
      assert(false, 'Expected initSourceDatabases to throw in production mode');
    } catch (err: any) {
      assert(err.message.includes('[Security Violation]'), 'Must throw Security Violation on source DB init in production');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log('\n=============================================================');
  console.log(`  PHASE 1 ISOLATION SUITE: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log('=============================================================\n');

  // Clean up test DB
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (process.argv[1]?.includes('phase1_isolation.test')) {
  runPhase1IsolationTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
