/**
 * Revana World Model Logic & Spatial Reasoning Verification Suite
 * 
 * Tests:
 * 1. Station far from corridor -> no relationship created.
 * 2. Station near corridor -> relationship created with real computed distance in evidence.
 * 3. Confidence calculation decreases strictly monotonically as data age increases.
 * 4. Geometric point-to-polyline calculations produce verified distances.
 */

import { worldModelService } from '../services/world_model/world_model.service.js';
import { haversineDistance, pointToPolylineDistance } from '../services/world_model/geo.js';
import { ROAD_CORRIDOR_NH48 } from '../services/world_model/reference.js';
import { computeConfidence, getProviderReliability } from '../services/world_model/confidence.js';
import { NormalizedObservation } from '../connectors/base/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✔ [PASS] ${message}`);
    passed++;
  }
}

export async function runWorldModelLogicTests() {
  console.log('\n=============================================================');
  console.log('  RUNNING WORLD MODEL GEOMETRY & CONFIDENCE LOGIC SUITE');
  console.log('=============================================================\n');

  // Test 1: Geometry calculations
  console.log('--- Suite 1: Geometric Math Verification ---');
  {
    // Bangalore to Chennai (~290 km haversine)
    const distBlrChen = haversineDistance(12.9716, 77.5946, 13.0827, 80.2707);
    assert(distBlrChen > 280 && distBlrChen < 300, `Haversine BLR-MAA ~290km (got: ${distBlrChen.toFixed(1)} km)`);

    // Point right on Electronic City NH48 waypoint
    const distOnCorridor = pointToPolylineDistance(12.8450, 77.6600, ROAD_CORRIDOR_NH48.polyline);
    assert(distOnCorridor.distanceKm < 0.1, `Point directly on polyline has near-zero distance (got: ${distOnCorridor.distanceKm.toFixed(3)} km)`);
  }

  // Test 2: Station far from corridor -> no relationship
  console.log('\n--- Suite 2: Spatial Corridor Ingestion Rules ---');
  {
    const farStationId = `STATION_FAR_${Date.now()}`;
    // Coordinates in Goa / Western Ghats (~350 km away from Bangalore NH48 corridor)
    const farObs: NormalizedObservation = {
      id: `obs_far_${Date.now()}`,
      entity_id: farStationId,
      entity_type: 'WEATHER_STATION',
      data_type: 'WEATHER_SURFACE',
      value: { precipitation_mm: 25.0, temperature_c: 22.0 },
      location: { latitude: 15.2993, longitude: 74.1240, city: 'Goa Hinterland' },
      timestamp: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      source: 'test_spatial',
      provider: 'open_meteo_weather',
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: 300,
      provenance: {
        source: 'test_spatial',
        provider: 'open_meteo_weather',
        endpoint: '/test',
        retrievedAt: new Date().toISOString(),
        observedAt: new Date().toISOString(),
      },
    };

    const res = worldModelService.ingestObservation(farObs);
    const nh48Rel = res.inferredRelationships.find(r => r.target_entity_id === 'ROAD_CORRIDOR_NH48');
    assert(nh48Rel === undefined, 'Station far from corridor (>15km) must NOT produce NH48 relationship');
  }

  // Test 3: Station near corridor -> relationship with correct real distance in evidence
  {
    const nearStationId = `STATION_NEAR_${Date.now()}`;
    // Coordinates 2.5 km off Electronic City NH48 waypoint
    const nearLat = 12.8600;
    const nearLon = 77.6700;
    const expectedDist = pointToPolylineDistance(nearLat, nearLon, ROAD_CORRIDOR_NH48.polyline).distanceKm;

    const nearObs: NormalizedObservation = {
      id: `obs_near_${Date.now()}`,
      entity_id: nearStationId,
      entity_type: 'WEATHER_STATION',
      data_type: 'WEATHER_SURFACE',
      value: { precipitation_mm: 18.5, temperature_c: 23.5 },
      location: { latitude: nearLat, longitude: nearLon, city: 'Electronic City East' },
      timestamp: new Date().toISOString(),
      observed_at: new Date().toISOString(),
      source: 'test_spatial',
      provider: 'open_meteo_weather',
      confidence: 0.95,
      quality: 'VERIFIED',
      ttl: 300,
      provenance: {
        source: 'test_spatial',
        provider: 'open_meteo_weather',
        endpoint: '/test',
        retrievedAt: new Date().toISOString(),
        observedAt: new Date().toISOString(),
      },
    };

    const res = worldModelService.ingestObservation(nearObs);
    const nh48Rel = res.inferredRelationships.find(r => r.target_entity_id === 'ROAD_CORRIDOR_NH48');
    assert(nh48Rel !== undefined, 'Station near corridor (<=15km) MUST produce NH48 relationship');
    assert(nh48Rel!.confidence > 0 && nh48Rel!.confidence <= 0.99, `Confidence must be computed valid fraction (got: ${nh48Rel!.confidence})`);

    // Verify evidence string contains the real computed distance in km
    const distanceEvidence = nh48Rel!.evidence.find(e => e.includes('km from NH48 corridor'));
    assert(distanceEvidence !== undefined, 'Evidence array must contain real distance statement');
    assert(distanceEvidence!.includes(expectedDist.toFixed(2)), `Evidence must contain exact computed distance (${expectedDist.toFixed(2)} km)`);

    // Verify no uncomputed/fabricated claims exist
    const hasFabricatedModels = nh48Rel!.evidence.some(e => e.toLowerCase().includes('runoff model'));
    assert(!hasFabricatedModels, 'Evidence must NOT contain fabricated hydrological runoff model claims');
  }

  // Test 4: Confidence decreases strictly monotonically as data gets older
  console.log('\n--- Suite 3: Pure Confidence Decay Math ---');
  {
    const rel = getProviderReliability('open_meteo_weather');
    assert(rel > 0.8, `Provider reliability lookup successful (got: ${rel})`);

    const confFresh = computeConfidence({
      sourceReliability: rel,
      dataAgeSeconds: 0,
    });

    const conf1Hour = computeConfidence({
      sourceReliability: rel,
      dataAgeSeconds: 3600,
    });

    const conf6Hours = computeConfidence({
      sourceReliability: rel,
      dataAgeSeconds: 21600,
    });

    const conf24Hours = computeConfidence({
      sourceReliability: rel,
      dataAgeSeconds: 86400,
    });

    assert(confFresh > conf1Hour, `Fresh data confidence (${confFresh}) > 1-hour old data (${conf1Hour})`);
    assert(conf1Hour > conf6Hours, `1-hour data confidence (${conf1Hour}) > 6-hour old data (${conf6Hours})`);
    assert(conf6Hours > conf24Hours, `6-hour data confidence (${conf6Hours}) > 24-hour old data (${conf24Hours})`);

    // Proximity factor check: closer to corridor -> higher confidence
    const confNear = computeConfidence({
      sourceReliability: rel,
      dataAgeSeconds: 60,
      distanceKm: 1.0,
      maxDistanceKm: 15.0,
    });

    const confEdge = computeConfidence({
      sourceReliability: rel,
      dataAgeSeconds: 60,
      distanceKm: 14.5,
      maxDistanceKm: 15.0,
    });

    assert(confNear > confEdge, `Near corridor point (${confNear}) has higher confidence than edge point (${confEdge})`);
  }

  console.log('\n=============================================================');
  console.log(`  LOGIC SUITE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run immediately if executed directly via tsx
if (process.argv[1]?.includes('world_model_logic.test')) {
  runWorldModelLogicTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
