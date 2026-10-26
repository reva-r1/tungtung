import fs from 'fs';
import path from 'path';
import { db, initDatabase } from '../db/database.js';
import { DeterministicCsvParser } from '../services/graph/deterministicCsvParser.js';
import { SQLiteGraphStore } from '../services/graph/sqliteGraphStore.js';
import { MaritimeDetectorEngine } from '../services/detection/maritimeDetectors.js';
import { KgReasonerService } from '../services/graph/kgReasoner.js';

console.log('========================================================================');
console.log('--- RUNNING PHASE 9: MUTATION TESTING & NEGATIVE CONTROLS SUITE ---');
console.log('========================================================================\n');

initDatabase();
const store = new SQLiteGraphStore();

async function runTestSuite() {
  console.log('------------------------------------------------------------------------');
  console.log('TEST 1: PARAMETRIC MUTATION TEST (Zero Hardcoding Generalization)');
  console.log('------------------------------------------------------------------------');
  console.log('Mutating dataset:');
  console.log(' - Target Vessel: "SEA EMPEROR" (IMO: 9811223) [replaces BHARAT GAURAV]');
  console.log(' - Feeder Vessel: "NORDIC STAR" (IMO: 9733445) [replaces OCEAN VALOR]');
  console.log(' - Location: North Sea (56.20°N, 3.40°E) [replaces Arabian Sea 20.41°N, 65.23°E]');
  console.log(' - AIS Blackout: 9.0 hours [replaces 14.5 hours]');
  console.log(' - Declared Cargo: 5,000 MT Biofuel; Observed Displacement Surge: +35,000 MT\n');

  // Synthetic mutated CSV data
  const mutatedCustomsCsv = `bill_of_lading,vessel_name,imo,mmsi,shipper,consignee,declared_cargo,cargo_weight_mt,declared_route,estimated_hours,departure_port,arrival_port,declaration_date
BL-2024-NS-001,SEA EMPEROR,9811223,211001122,Viking Biofuels AS,Rotterdam Terminal B,Refined Biofuel Feedstock,5000,Bergen -> Rotterdam,48,Bergen,Rotterdam,2024-10-10T08:00:00Z
`;

  const mutatedAisPositionsCsv = `vessel_name,imo,mmsi,latitude,longitude,speed_knots,course_deg,timestamp
SEA EMPEROR,9811223,211001122,56.20,3.40,0.4,180.0,2024-10-11T02:00:00Z
NORDIC STAR,9733445,211002233,56.20,3.40,0.3,178.0,2024-10-11T03:00:00Z
`;

  const mutatedAisEventsCsv = `vessel_name,imo,mmsi,event_type,latitude,longitude,timestamp,gap_duration_hours
SEA EMPEROR,9811223,211001122,TRANSPONDER_OFF,56.20,3.40,2024-10-11T02:00:00Z,9.0
SEA EMPEROR,9811223,211001122,TRANSPONDER_ON,56.20,3.40,2024-10-11T11:00:00Z,0.0
`;

  const mutatedDraughtCsv = `vessel_name,imo,mmsi,reported_draught_meters,observed_draught_meters,displacement_delta_mt,timestamp,observation_method
SEA EMPEROR,9811223,211001122,8.0,8.0,0,2024-10-10T08:00:00Z,Bergen Port departure sensor
SEA EMPEROR,9811223,211001122,8.0,13.2,35000,2024-10-11T11:30:00Z,North Sea SAR waterline radar
`;

  const filesToClean = [
    'mutated_customs.csv',
    'mutated_ais_pos.csv',
    'mutated_ais_events.csv',
    'mutated_draught.csv',
    'algorithmic_rendezvous_detector',
    'hydrostatic_discrepancy_detector',
  ];

  for (const f of filesToClean) {
    await store.purgeBySource(f);
  }

  // Parse & Ingest mutated data
  const p1 = DeterministicCsvParser.parse(mutatedCustomsCsv, 'mutated_customs.csv');
  const p2 = DeterministicCsvParser.parse(mutatedAisPositionsCsv, 'mutated_ais_pos.csv');
  const p3 = DeterministicCsvParser.parse(mutatedAisEventsCsv, 'mutated_ais_events.csv');
  const p4 = DeterministicCsvParser.parse(mutatedDraughtCsv, 'mutated_draught.csv');

  for (const t of [...p1.triples, ...p2.triples, ...p3.triples, ...p4.triples]) {
    await store.upsertTriple(t);
  }

  // Run Generic Detectors
  const stats = await MaritimeDetectorEngine.runDetectors(store);
  console.log(`✔ Detectors ran dynamically on mutated data:`);
  console.log(`   Rendezvous detected: ${stats.rendezvousCount}`);
  console.log(`   Discrepancies detected: ${stats.discrepancyCount}`);

  if (stats.rendezvousCount === 0 || stats.discrepancyCount === 0) {
    throw new Error('FAIL: Generic detectors failed to detect rendezvous or discrepancy on mutated vessels!');
  }

  // Run Reasoner on mutated vessel
  const seaEmperorNode = db.prepare("SELECT * FROM entities WHERE name LIKE '%SEA EMPEROR%'").get() as any;
  const reasonerRes = await KgReasonerService.analyzeEntity({
    entityId: seaEmperorNode.id,
    hops: 2,
    question: 'Analyze SEA EMPEROR for potential anomalies.',
  });

  const fullText = JSON.stringify(reasonerRes).toLowerCase();
  console.log(`✔ Mutated Reasoner Summary:\n"${reasonerRes.reasoning.summary}"`);

  // Assertions:
  // Must cite NORDIC STAR as the partner (NOT OCEAN VALOR!)
  if (!fullText.includes('nordic star')) {
    throw new Error('FAIL: Reasoner failed to dynamically identify NORDIC STAR as rendezvous partner!');
  }
  if (fullText.includes('ocean valor')) {
    throw new Error('FAIL: Leaked hardcoded OCEAN VALOR on mutated dataset!');
  }
  if (fullText.includes('bharat gaurav')) {
    throw new Error('FAIL: Leaked hardcoded BHARAT GAURAV on mutated dataset!');
  }
  console.log('✔ PASS: Parametric Mutation Test successfully identified "NORDIC STAR" with zero benchmark leakage!\n');

  // Clean mutated test data
  for (const f of filesToClean) {
    await store.purgeBySource(f);
  }

  console.log('------------------------------------------------------------------------');
  console.log('TEST 2: NEGATIVE CONTROL A (AIS Gap with NO Draught Surge / Legitimate Silence)');
  console.log('------------------------------------------------------------------------');
  console.log('Scenario: Vessel "PACIFIC TRADER" experiences 10h AIS gap in storm, but NO draught change (0 MT).');

  const negControlAis = `vessel_name,imo,mmsi,latitude,longitude,speed_knots,course_deg,timestamp
PACIFIC TRADER,9111222,333001122,15.20,68.40,11.0,90.0,2024-10-12T00:00:00Z
`;
  const negControlEvents = `vessel_name,imo,mmsi,event_type,latitude,longitude,timestamp,gap_duration_hours
PACIFIC TRADER,9111222,333001122,TRANSPONDER_OFF,15.20,68.40,2024-10-12T04:00:00Z,10.0
PACIFIC TRADER,9111222,333001122,TRANSPONDER_ON,15.20,68.40,2024-10-12T14:00:00Z,0.0
`;
  const negControlDraught = `vessel_name,imo,mmsi,reported_draught_meters,observed_draught_meters,displacement_delta_mt,timestamp,observation_method
PACIFIC TRADER,9111222,333001122,9.0,9.0,0,2024-10-12T15:00:00Z,Waterline inspection (no change)
`;

  const negFiles = ['neg_pos.csv', 'neg_events.csv', 'neg_draught.csv', 'algorithmic_rendezvous_detector', 'hydrostatic_discrepancy_detector'];
  for (const f of negFiles) {
    await store.purgeBySource(f);
  }

  for (const t of [
    ...DeterministicCsvParser.parse(negControlAis, 'neg_pos.csv').triples,
    ...DeterministicCsvParser.parse(negControlEvents, 'neg_events.csv').triples,
    ...DeterministicCsvParser.parse(negControlDraught, 'neg_draught.csv').triples,
  ]) {
    await store.upsertTriple(t);
  }

  await MaritimeDetectorEngine.runDetectors(store);

  const pacificNode = db.prepare("SELECT * FROM entities WHERE name LIKE '%PACIFIC TRADER%'").get() as any;
  const pacificReasonerRes = await KgReasonerService.analyzeEntity({
    entityId: pacificNode.id,
    hops: 2,
    question: 'Analyze PACIFIC TRADER.',
  });

  const pacificText = JSON.stringify(pacificReasonerRes).toLowerCase();
  console.log(`✔ Negative Control Reasoner Summary:\n"${pacificReasonerRes.reasoning.summary}"`);

  // Assert: Must NOT claim Ship-to-Ship transfer or dark transshipment!
  const falselyClaimedSTS = pacificText.includes('ship-to-ship') || /\bsts\b/i.test(pacificText) || pacificText.includes('dark transshipment');
  if (falselyClaimedSTS) {
    throw new Error('FAIL: Negative Control Failed! System falsely accused PACIFIC TRADER of STS transshipment when draught did not change and no partner was present!');
  }
  console.log('✔ PASS: Negative Control A correctly avoided accusing PACIFIC TRADER of STS transfer!\n');

  for (const f of negFiles) {
    await store.purgeBySource(f);
  }

  console.log('------------------------------------------------------------------------');
  console.log('TEST 3: NEGATIVE CONTROL B (Missing Corporate Registry Link)');
  console.log('------------------------------------------------------------------------');
  console.log('Scenario: Corporate notes DO NOT mention vessel ownership. Beneficial owner must NOT be invented.');

  const compCsv = `company_name,registration_cin,jurisdiction,director_name,beneficial_owner,registered_address,shareholder_notes
Atlas Holdings Ltd,IBC-9901,BVI,John Smith,John Smith,Tortola BVI,Standard asset holding company with no maritime registrations
`;

  for (const t of DeterministicCsvParser.parse(compCsv, 'atlas_holdings.csv').triples) {
    await store.upsertTriple(t);
  }

  const atlasNode = db.prepare("SELECT * FROM entities WHERE name LIKE '%Atlas Holdings%'").get() as any;
  const atlasRels = db.prepare("SELECT * FROM relationships WHERE source_id = ?").all(atlasNode.id) as any[];
  const inventedVesselLink = atlasRels.some(r => r.type === 'OPERATES' || r.type === 'OWNS_VESSEL');

  if (inventedVesselLink) {
    throw new Error('FAIL: System invented an operated vessel relationship when none was declared in the notes!');
  }
  console.log('✔ PASS: Negative Control B confirmed no ghost ownership links created.\n');

  await store.purgeBySource('atlas_holdings.csv');

  console.log('========================================================================');
  console.log('✔ ALL PHASE 9 MUTATION & NEGATIVE CONTROL TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('FAIL in Phase 9 test suite:', err);
  process.exit(1);
});
