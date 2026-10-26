import * as fs from 'fs';
import * as path from 'path';

// Seeded PRNG (mulberry32) for 100% deterministic reproducibility
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

const prng = createPrng(hashSeed('0xREVANA2026'));

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(prng() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(prng() * (max - min + 1)) + min;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

const FIRST_NAMES = [
  'Alexander', 'Beatrice', 'Charles', 'Daphne', 'Edward', 'Fiona', 'George', 'Hannah',
  'Ian', 'Julia', 'Kenneth', 'Laura', 'Malcolm', 'Nora', 'Oscar', 'Penelope', 'Quentin',
  'Rachel', 'Stephen', 'Teresa', 'Victor', 'Wendy', 'Xavier', 'Yvonne', 'Zachary',
  'Brendan', 'Catherine', 'Dominic', 'Evelyn', 'Felix', 'Gloria', 'Henry', 'Iris'
];

const LAST_NAMES = [
  'Ashford', 'Blackwood', 'Carrington', 'Dunbar', 'Ellsworth', 'Fairchild', 'Greystone',
  'Hawthorne', 'Ingram', 'Jenkins', 'Kensington', 'Lancaster', 'Montague', 'Northwood',
  'Oakley', 'Pendleton', 'Quinn', 'Radcliffe', 'Sterling', 'Thornton', 'Underwood',
  'Vanderbilt', 'Waverly', 'Yardley', 'Zimmerman', 'Bexley', 'Cromwell', 'Dalton'
];

const STREETS = [
  'Harborview Blvd', 'Industrial Parkway', 'Commercial Way', 'Civic Center Lane',
  'Exchange Square', 'Foundry Row', 'Terminal Way', 'Merchants Court', 'Dockside Ave'
];

const COMPANY_SUFFIXES = ['LLC', 'Inc', 'Ltd', 'Corp', 'Enterprises', 'Group', 'Holdings', 'Services', 'Partners'];

const outDir = path.resolve('d:/zenism/experiments/blind_intelligence_v1/source_data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Generating deterministic synthetic world with seed 0xREVANA2026...');

// -----------------------------------------------------------------------------
// 1. 01_vendor_corporate_registry.csv (~75 rows)
// -----------------------------------------------------------------------------
const corpRows: string[] = [];
corpRows.push('company_name,director_name,beneficial_owner,registration_number,contact_phone,registered_address,shareholder_notes,formation_date');

// Planted Cases
// CASE-01: Julian V. Thorne director
corpRows.push('Thorne Civil Consulting Ltd,Julian V. Thorne,Julian V. Thorne,REG-1049-T,+1-555-019-4401,"Suite 310, 88 Civic Center Lane",Registered engineering consulting advisory,2021-04-12');
// CASE-02: Marcus Vance -> Apex Horizon -> Ironclad -> Valcourt
corpRows.push('Apex Horizon Properties LLC,Gareth Holbrook,Marcus Vance,REG-2018-A,+1-555-014-9920,"Floor 12, 100 Exchange Square",100% owned by ultimate beneficial owner Marcus Vance,2019-06-15');
corpRows.push('Ironclad Material Supplies Inc,Nathan Drake,Apex Horizon Properties LLC,REG-3312-I,+1-555-012-7711,"Foundry Row Shed 4B",45% equity held by corporate shareholder Apex Horizon Properties LLC,2020-09-01');
corpRows.push('Valcourt Infrastructure Group,Lucian Valcourt,Lucian Valcourt,REG-8810-V,+1-555-018-3300,"Executive Tower Suite 900, Merchants Court",Prime civil construction general contractor,2017-02-20');
corpRows.push('Zephyr Logistics Ltd,Tariq Mansour,Tariq Mansour,REG-5519-Z,+1-555-017-8899,"Unit 12, Dockside Ave",Subcontracted freight logistics and freight forwarding,2022-01-10');
// CASE-06: David A. Miller
corpRows.push('Miller Heavy Transport,David A. Miller,David A. Miller,TAX-11894,+1-555-011-2244,"Depot Yard 2, Industrial Parkway",Bulk machinery haulage and flatbed transport,2018-11-05');
// CASE-07: Solomon Crane Hire (Decoy)
corpRows.push('Solomon Crane Hire,Elias Solomon,Elias Solomon,REG-4402-S,+1-555-016-5511,"Crane Yard 1, Terminal Way",Heavy lifting crane hire and rigging equipment leasing,2016-08-14');
// CASE-10: Kestrel Urban Works Ltd (resolved from REG-9941-K)
corpRows.push('Kestrel Urban Works Ltd,Miriam Al-Hassan,Miriam Al-Hassan,REG-9941-K,+1-555-019-8821,"Suite 400, 120 Harborview Blvd",Specialized urban masonry and structural refurbishment,2023-03-18');
// CASE-11: Orion Aggregate Partners (Cassandra Vance COO)
corpRows.push('Orion Aggregate Partners,Hector Vance,Cassandra Vance,CORP-REG-1027,+1-555-015-3388,"Terminal Way Silo 3",Quarry and aggregate supply. Cassandra Vance appointed Chief Operating Officer in March 2026,2019-10-22');
// CASE-12: Veridian Environmental Testing Labs
corpRows.push('Veridian Environmental Testing Labs,Dr. Simon Cole,Dr. Simon Cole,CORP-REG-1041,+1-555-013-6644,"Science Park Building C",Certified environmental soil and hydrological testing laboratory,2015-05-30');

// Background Corporate Records
const bgCompanies = [
  'Atlas Precast Works', 'Beacon Paving Solutions', 'Crestview Engineering', 'Delta Fleet Services',
  'Echo Ridge Geotechnical', 'Frontier Demolition Ltd', 'Granite Rock Quarries', 'Harbor Dredging Corp',
  'Imperial Cable Supplies', 'Jupiter Structural Steel', 'Keystone Architectural Brass', 'Lakeside Pipeline Corp',
  'Maritime Crane Operators', 'Nexus Power Grids', 'Omega Concrete Batching', 'Pinnacle Scaffolding Inc',
  'Quantum Electrical Contracting', 'Redline Haulage Ltd', 'Summit Roadways', 'Titan Heavy Foundations',
  'Universal Asphalt Supply', 'Vanguard Safety Barriers', 'Westside Drainage Ltd', 'Zenith Surveying Services',
  'Alpine Soil Mechanics', 'Boreal Timber & Shoring', 'Canyon Aggregates LLC', 'Dover Maritime Logistics',
  'Eagle Eye Site Security', 'Fathom Underwater Surveying', 'Garrison Security Fencing', 'Haven Port Logistics',
  'Island Sound Marine Works', 'Javelin Equipment Lease', 'Kodiak Earthmoving Inc', 'Lyceum Environmental Services',
  'Monarch Structural Glazing', 'Northgate Freightways', 'Olympic Water Proofing', 'Paramount Pier Solutions',
  'Quest Geodetic Services', 'Ridgeline Excavation', 'Sapphire Coating Systems', 'Trident Rigging & Towing',
  'Unity Mechanical Services', 'Vertex Structural Surveys', 'Waypoint Traffic Systems', 'Yorkshire Steel Erectors',
  'AeroFleet Courier Cargo', 'Bayside Tug & Barge', 'Century Civil Systems', 'Drakestone Quarry Corp',
  'East Coast Pipework Ltd', 'Falcon Crane & Hoist', 'Grandview Land Surveyors', 'Highland Earthworks',
  'Inland River Barging', 'Junction Railway Logistics', 'Kensington Cableworks', 'Liberty Marine Transport',
  'Metropolitan Core Drilling', 'Noble Metal Fabricators', 'Outpost Security Solutions', 'Pacific Dredge Partners'
];

for (let i = 0; i < bgCompanies.length; i++) {
  const cName = `${bgCompanies[i]} ${randChoice(COMPANY_SUFFIXES)}`;
  const dirName = `${randChoice(FIRST_NAMES)} ${randChoice(LAST_NAMES)}`;
  const boName = prng() > 0.3 ? dirName : `${randChoice(FIRST_NAMES)} ${randChoice(LAST_NAMES)}`;
  const regNo = `REG-${randInt(1000, 9999)}-${String.fromCharCode(65 + randInt(0, 25))}`;
  const phone = `+1-555-01${randInt(10, 99)}-${randInt(1000, 9999)}`;
  const addr = `"Suite ${randInt(100, 900)}, ${randInt(10, 400)} ${randChoice(STREETS)}"`;
  const notes = `General municipal supplier for ${randChoice(['paving', 'electrical', 'drainage', 'geotechnical', 'fencing', 'aggregates'])}`;
  const fDate = `201${randInt(2, 9)}-0${randInt(1, 9)}-${randInt(10, 28)}`;
  corpRows.push(`${cName},${dirName},${boName},${regNo},${phone},${addr},${notes},${fDate}`);
}

fs.writeFileSync(path.join(outDir, '01_vendor_corporate_registry.csv'), corpRows.join('\n'), 'utf8');
console.log(`01_vendor_corporate_registry.csv written: ${corpRows.length - 1} records`);

// -----------------------------------------------------------------------------
// 2. 02_municipal_procurement_contracts.csv (~85 rows)
// -----------------------------------------------------------------------------
const contractRows: string[] = [];
contractRows.push('contract_id,project_name,vessel,port,shipper,consignee,declared_cargo,award_amount,declaration_date,contract_status,reviewer_name,notes');

// Planted Cases
// CASE-01 & CASE-03: CTR-2026-881 awarded to Valcourt Infrastructure Group reviewed by J. Vance Thorne, evaluated by Elena Rostova
contractRows.push('CTR-2026-881,"North Tunnel Berth 4 Realignment","North Tunnel Berth 4","Metro North Sector 4","Valcourt Infrastructure Group","Metro North Civil Works Authority","Structural Precast Concrete - GEO-PERMIT-401",4850000,2026-09-05T09:00:00Z,AWARDED,J. Vance Thorne,"Major tunnel stabilization project. Lead evaluator Elena Rostova."');
// CASE-02: Ironclad subcontractor declaration
contractRows.push('CTR-2026-882,"Subcontract Precast Aggregate Supply","North Tunnel Berth 4","Metro North Sector 4","Ironclad Material Supplies Inc","Valcourt Infrastructure Group","High-Tensile Foundation Gravel",420000,2026-09-08T11:30:00Z,APPROVED,Arthur Pendelton,"Subcontractor supply agreement under primary contract CTR-2026-881"');
// CASE-04: GEO-PERMIT-401 issued on 2026-09-19T10:00:00Z
contractRows.push('GEO-PERMIT-401,"Berth 4 Geotechnical Bedrock Authorization","North Tunnel Berth 4","Metro North Sector 4","Metro North Civil Works Authority","Valcourt Infrastructure Group","Geotechnical Bedrock Discharge Approval",0,2026-09-19T10:00:00Z,ISSUED,David Miller,"Official permit certifying soil compaction prior to concrete placement"');
// CASE-05: CONSIGN-STEEL-8812 official destination Central Rail Depot Alpha
contractRows.push('CTR-2026-895,"Rail Transit Rebar Delivery","Central Rail Depot Alpha","Sector 2 Logistics Hub","Zephyr Logistics Ltd","Transit Infrastructure Directorate","CONSIGN-STEEL-8812 - High Tensile Rebar",285000,2026-09-21T08:00:00Z,DISPATCHED,Claire Dunmore,"Designated storage delivery directly to Central Rail Depot Alpha yard"');
// CASE-10: CTR-2026-702 awarded to Entity Reg #9941-K
contractRows.push('CTR-2026-702,"Historic Causeway Parapet Rehabilitation","Harbor Causeway Bridge","Zone East Riverfront","Entity Reg #9941-K","Metro North Civil Works Authority","Heritage Masonry Restoration Package",310000,2026-08-15T10:00:00Z,ACTIVE,Arthur Pendelton,"Contractor contact phone +1-555-019-8821, Suite 400, 120 Harborview Blvd"');
// CASE-12: Veridian Environmental
contractRows.push('CTR-2026-104,"Harbor Catchment Ambient Water & Soil Assay","Riverfront Outfall Basin","Zone East Riverfront","Veridian Environmental Testing Labs","Metro North Civil Works Authority","Routine Environmental Assay Protocol",65000,2026-08-20T14:00:00Z,COMPLETED,Dr. Simon Cole,"Quarterly ambient sediment testing. Standard municipal environmental compliance."');

// Background Contracts
const sites = ['Pier 9 Subway Extension', 'Harbor Causeway Bridge', 'Depot Alpha Expansion', 'South Channel Dredging', 'Avenue C Overpass', 'Central Rail Depot Alpha', 'Terminal Gate 3 Widening', 'Waterfront Esplanade Pier', 'West Drainage Canal', 'Municipal Basin 2'];
const depts = ['Metro North Civil Works Authority', 'Transit Infrastructure Directorate', 'Water & Sewerage Operations', 'Port & Coastal Facilities Board', 'Urban Highway Commission'];
const cargoTypes = ['Structural Steel Beams', 'Asphalt Surface Grade 4', 'Precast Concrete Culverts', 'Riprap Armoring Stone', 'PVC Storm Conduit 600mm', 'Bridge Deck Expansion Joints', 'Traffic Signage Gantry', 'High-Mast Luminaire Poles', 'Substation Switchgear Modules', 'Geotextile Silt Barrier'];

for (let i = 0; i < 75; i++) {
  const cId = `CTR-2026-${100 + i}`;
  const site = randChoice(sites);
  const proj = `${site} ${randChoice(['Maintenance', 'Upgrades', 'Phase 2', 'Replacement', 'Structural Overhaul', 'Civil Extension'])}`;
  const supp = randChoice(bgCompanies);
  const dept = randChoice(depts);
  const cargo = randChoice(cargoTypes);
  const amt = randInt(40, 950) * 1000;
  const m = randInt(6, 9);
  const d = randInt(10, 28);
  const date = `2026-0${m}-${pad(d)}T${pad(randInt(8, 17))}:00:00Z`;
  const reviewer = `${randChoice(FIRST_NAMES)} ${randChoice(LAST_NAMES)}`;
  contractRows.push(`${cId},"${proj}","${site}","Sector ${randInt(1, 6)}","${supp}","${dept}","${cargo}",${amt},${date},AWARDED,${reviewer},"Standard procurement tender"`);
}

fs.writeFileSync(path.join(outDir, '02_municipal_procurement_contracts.csv'), contractRows.join('\n'), 'utf8');
console.log(`02_municipal_procurement_contracts.csv written: ${contractRows.length - 1} records`);

// -----------------------------------------------------------------------------
// 3. 03_escrow_financial_wire_transfers.csv (~80 rows)
// -----------------------------------------------------------------------------
const wireRows: string[] = [];
wireRows.push('wire_reference,sender,receiver,amount,transfer_date,bank_routing,purpose_memo');

// Planted Cases
// CASE-03: Valcourt -> Zephyr Logistics -> Elena Rostova
wireRows.push('WIRE-TX-9014,Valcourt Infrastructure Group,Zephyr Logistics Ltd,320000,2026-09-14T11:20:00Z,ROUT-9022-METRO,"Subcontract logistics retainer for Berth 4 heavy materials"');
wireRows.push('WIRE-TX-9019,Zephyr Logistics Ltd,Elena Rostova,175000,2026-09-18T15:45:00Z,ROUT-4411-OFFSHORE,"Private consultancy fee disbursement ref ZR-881"');
// CASE-07: Zephyr Logistics -> Solomon Crane Hire (Decoy)
wireRows.push('WIRE-TX-9011,Zephyr Logistics Ltd,Solomon Crane Hire,45000,2026-09-11T14:10:00Z,ROUT-1180-COMM,"Lease settlement 200T Crane EQUIP-LEASE-INV-1094"');
// CASE-12: Veridian Clean Control
wireRows.push('WIRE-TX-9008,Metro North Civil Works Authority,Veridian Environmental Testing Labs,65000,2026-08-30T10:00:00Z,ROUT-9000-TREAS,"Disbursement for CTR-2026-104 environmental testing"');

// Background Wires
const entitiesList = [...bgCompanies, 'Metro North Civil Works Authority', 'Transit Infrastructure Directorate', 'Lucian Valcourt', 'Miller Heavy Transport', 'Atlas Precast Works'];
for (let i = 0; i < 72; i++) {
  const wRef = `WIRE-TX-${8000 + i}`;
  const snd = randChoice(entitiesList);
  let rcv = randChoice(entitiesList);
  while (rcv === snd) rcv = randChoice(entitiesList);
  const amt = randInt(15, 450) * 1000;
  const m = randInt(6, 9);
  const d = randInt(1, 28);
  const date = `2026-0${m}-${pad(d)}T${pad(randInt(9, 16))}:${pad(randInt(10, 59))}:00Z`;
  const memo = randChoice([
    'Scheduled contractual milestone payment',
    'Concrete aggregates delivery settlement',
    'Fuel surcharge and fleet staging allowance',
    'Equipment lease monthly retainer',
    'Permit application filing fee reimbursement',
    'Subcontractor invoice clearance'
  ]);
  wireRows.push(`${wRef},"${snd}","${rcv}",${amt},${date},ROUT-${randInt(1000, 9999)}-FED,"${memo}"`);
}

fs.writeFileSync(path.join(outDir, '03_escrow_financial_wire_transfers.csv'), wireRows.join('\n'), 'utf8');
console.log(`03_escrow_financial_wire_transfers.csv written: ${wireRows.length - 1} records`);

// -----------------------------------------------------------------------------
// 4. 04_site_access_fleet_telemetry.csv (~100 rows)
// -----------------------------------------------------------------------------
const fleetRows: string[] = [];
fleetRows.push('gate_log_id,timestamp,driver_name,plate,company_name,site_location,action,cargo_manifest_ref,draught_weight_mt');

// Planted Cases
// CASE-04: Concrete pour at North Tunnel Berth 4 on 2026-09-12 (6 days before permit on 2026-09-19)
fleetRows.push('GATE-LOG-1008,2026-09-12T04:30:00Z,Carlos Ruiz,TRK-410,Valcourt Infrastructure Group,North Tunnel Berth 4,CONCRETE_POUR_DISCHARGE,Batch #441 Foundation Core,48.5');
// CASE-05: CONSIGN-STEEL-8812 entered Warehouse Omega instead of Depot Alpha
fleetRows.push('GATE-LOG-1033,2026-09-22T14:15:00Z,Stanislaw Novak,TRK-992,Zephyr Logistics Ltd,Warehouse Omega,CARGO_UNLOAD,CONSIGN-STEEL-8812 - High Tensile Rebar,32.0');
// CASE-07: Solomon Crane Hire mobilization
fleetRows.push('GATE-LOG-1025,2026-09-11T08:00:00Z,Liam Henderson,CRN-200,Solomon Crane Hire,Pier 9 Subway Extension,CRANE_MOBILIZATION,EQUIP-LEASE-INV-1094 200T Liebherr,65.0');

// CASE-09: Convoy from Quarry Site Bravo to Pier 9 Subway Extension on 2026-09-25
fleetRows.push('GATE-LOG-1051,2026-09-25T08:00:00Z,Viktor Orlov,TRK-701,Orion Aggregate Partners,Quarry Site Bravo,DEPARTURE,Convoy Aggregate Alpha,40.0');
fleetRows.push('GATE-LOG-1052,2026-09-25T08:05:00Z,Marco Rossi,TRK-702,Orion Aggregate Partners,Quarry Site Bravo,DEPARTURE,Convoy Aggregate Alpha,41.2');
fleetRows.push('GATE-LOG-1053,2026-09-25T08:10:00Z,Raymond Brooks,TRK-703,Orion Aggregate Partners,Quarry Site Bravo,DEPARTURE,Convoy Aggregate Alpha,39.8');
fleetRows.push('GATE-LOG-1054,2026-09-25T08:15:00Z,Stefan Kowalski,TRK-704,Orion Aggregate Partners,Quarry Site Bravo,DEPARTURE,Convoy Aggregate Alpha,40.5');

// Arrivals at Pier 9 (TRK-703 missing!)
fleetRows.push('GATE-LOG-1060,2026-09-25T10:15:00Z,Viktor Orlov,TRK-701,Orion Aggregate Partners,Pier 9 Subway Extension,ARRIVAL,Convoy Aggregate Alpha,40.0');
fleetRows.push('GATE-LOG-1061,2026-09-25T10:22:00Z,Marco Rossi,TRK-702,Orion Aggregate Partners,Pier 9 Subway Extension,ARRIVAL,Convoy Aggregate Alpha,41.2');
fleetRows.push('GATE-LOG-1062,2026-09-25T10:35:00Z,Stefan Kowalski,TRK-704,Orion Aggregate Partners,Pier 9 Subway Extension,ARRIVAL,Convoy Aggregate Alpha,40.5');

// Background Fleet Telemetry
const drivers = ['Jack Larson', 'Dmitri Volkov', 'Mateo Gomez', 'Chen Wei', 'Tariq Al-Mansoor', 'Samir Patel', 'Lars Lindqvist', 'Boris Petrov', 'Andre Dupont', 'Sean O’Connor'];
for (let i = 0; i < 88; i++) {
  const gId = `GATE-LOG-${2000 + i}`;
  const dName = randChoice(drivers);
  const plate = `TRK-${randInt(100, 899)}`;
  const comp = randChoice(bgCompanies);
  const site = randChoice(sites);
  const action = randChoice(['GATE_ENTRY', 'GATE_EXIT', 'DISCHARGE', 'CONTAINER_STAGING', 'INSPECTION_HOLD']);
  const manifest = `MANIFEST-${randInt(1000, 9999)}`;
  const weight = (randInt(150, 450) / 10).toFixed(1);
  const m = randInt(7, 9);
  const d = randInt(1, 28);
  const time = `2026-0${m}-${pad(d)}T${pad(randInt(6, 20))}:${pad(randInt(10, 59))}:00Z`;
  fleetRows.push(`${gId},${time},${dName},${plate},"${comp}","${site}",${action},${manifest},${weight}`);
}

fs.writeFileSync(path.join(outDir, '04_site_access_fleet_telemetry.csv'), fleetRows.join('\n'), 'utf8');
console.log(`04_site_access_fleet_telemetry.csv written: ${fleetRows.length - 1} records`);

// -----------------------------------------------------------------------------
// 5. 05_dispatch_call_logs.csv (~75 rows)
// -----------------------------------------------------------------------------
const callRows: string[] = [];
callRows.push('call_id,caller,callee,call_time,duration_seconds,call_type,cell_tower');

// Planted Cases
// CASE-01: Julian Thorne calls Elena Rostova
callRows.push('CDR-4412,Julian Thorne,Elena Rostova,2026-09-13T16:20:00Z,312,VOICE_OUTBOUND,TOWER-CIVIC-04');
// CASE-03: Elena Rostova calls Zephyr Logistics
callRows.push('CDR-4401,Elena Rostova,Zephyr Logistics Dispatch,2026-09-17T19:40:00Z,480,VOICE_OUTBOUND,TOWER-DOCKSIDE-02');
// CASE-08: Dropped 6-second call between Arthur Pendelton and Claire Dunmore
callRows.push('CDR-4407,Arthur Pendelton,Claire Dunmore,2026-09-20T08:58:00Z,6,VOICE_DROPPED,TOWER-METRO-01');

// Background Call Records
const peoplePhones = [
  'Carlos Ruiz', 'Nathan Drake', 'Lucian Valcourt', 'Tariq Mansour', 'Elias Solomon',
  'David Miller', 'David A. Miller', 'Hector Vance', 'Dr. Simon Cole', 'Arthur Pendelton',
  'Claire Dunmore', 'Gareth Holbrook', 'Miriam Al-Hassan', 'Viktor Orlov', 'Marco Rossi'
];

for (let i = 0; i < 72; i++) {
  const cId = `CDR-${5000 + i}`;
  const c1 = randChoice(peoplePhones);
  let c2 = randChoice(peoplePhones);
  while (c2 === c1) c2 = randChoice(peoplePhones);
  const m = randInt(7, 9);
  const d = randInt(1, 28);
  const time = `2026-0${m}-${pad(d)}T${pad(randInt(7, 21))}:${pad(randInt(10, 59))}:00Z`;
  const dur = randInt(25, 620);
  const tower = `TOWER-SECTOR-0${randInt(1, 8)}`;
  callRows.push(`${cId},"${c1}","${c2}",${time},${dur},VOICE_COMPLETED,${tower}`);
}

fs.writeFileSync(path.join(outDir, '05_dispatch_call_logs.csv'), callRows.join('\n'), 'utf8');
console.log(`05_dispatch_call_logs.csv written: ${callRows.length - 1} records`);

// -----------------------------------------------------------------------------
// 6. 06_regulatory_field_inspections.txt (~15 field audit memos)
// -----------------------------------------------------------------------------
const auditMemos = `
================================================================================
METRO NORTH CIVIL WORKS REGULATORY FIELD AUDIT ARCHIVE
CLASSIFICATION: OFFICIAL CIVIL LOGS
================================================================================

--- RECORD ID: AUDIT-MEMO-2026-01 ---
DATE: 2026-01-30T16:00:00Z
INSPECTOR: Senior Compliance Officer Thomas Vane
SUBJECT: Personnel Transition Review - City Building Compliance Bureau
MEMO DETAILS:
This memorandum records the official departure of Municipal Safety Engineer Cassandra Vance
from the City Building Compliance Bureau effective 2026-01-30. Officer Vance completed all
project handover files relating to North Tunnel structural safety guidelines. Official municipal
credentials and site security clearance badges were surrendered in full compliance with public
service regulations. Handover received and countersigned.

--- RECORD ID: AUDIT-MEMO-2026-04 ---
DATE: 2026-08-14T09:30:00Z
INSPECTOR: David Miller (Senior Municipal Safety Inspector, Badge ENG-404)
SUBJECT: Routine Perimeter & Scaffolding Check - Pier 9 Subway Extension
MEMO DETAILS:
Conducted quarterly compliance walk-through at the Pier 9 Subway Extension site. Inspected
perimeter hoarding, temporary electrical feeds, and scaffolding staging erected by Summit Roadways.
All physical barricades adhere to Municipal Safety Code Chapter 14. No safety infractions noted.
Site supervisor notified of scheduled crane mobilization planned for mid-September.

--- RECORD ID: AUDIT-MEMO-2026-07 ---
DATE: 2026-08-25T11:00:00Z
INSPECTOR: Dr. Simon Cole (Veridian Environmental Testing Labs)
SUBJECT: Environmental Catchment Baseline Assay - Outfall Basin
MEMO DETAILS:
Field sampling conducted under contract CTR-2026-104 for ambient water and soil contamination.
Samples collected from Riverfront Outfall Basin showed dissolved particulate concentrations of 14 ppm,
well below the statutory threshold of 45 ppm. Heavy metal traces non-detectable. Full chain of custody
maintained. Samples logged into Veridian Lab LIMS under assay batch EV-8812.

--- RECORD ID: AUDIT-MEMO-2026-09 ---
DATE: 2026-09-02T13:45:00Z
INSPECTOR: David Miller (Senior Municipal Safety Inspector, Badge ENG-404)
SUBJECT: Material Shoring Verification - Harbor Causeway Bridge
MEMO DETAILS:
Conducted on-site inspection of hydraulic shoring systems at Harbor Causeway Bridge. Contractor
Boreal Timber & Shoring has deployed rated 40-ton trench shields. Deflection measurements confirmed
within allowable tolerance of 3mm. Approved for continued excavation of southern abutment footings.

--- RECORD ID: AUDIT-MEMO-2026-12 ---
DATE: 2026-09-10T15:15:00Z
INSPECTOR: Senior Auditor Patricia Hayes
SUBJECT: Equipment Certification - Pier 9 Rigging
MEMO DETAILS:
Inspected heavy rigging documentation presented by Solomon Crane Hire for mobile crane unit CRN-200.
Manufacturer load certification current through November 2027 under equipment lease agreement
EQUIP-LEASE-INV-1094. Operators hold valid Class A heavy machinery endorsements. Cleared for site entry.

--- RECORD ID: AUDIT-MEMO-2026-15 ---
DATE: 2026-09-16T10:30:00Z
INSPECTOR: Field Compliance Officer Arthur Pendelton
SUBJECT: Drainage Culvert Grade Survey - West Drainage Canal
MEMO DETAILS:
Verified laser leveling of precast concrete storm culverts supplied by Delta Fleet Services.
Invert elevation matches civil engineering specifications Drawing C-102. Backfill compaction
tests scheduled following joint sealing.

--- RECORD ID: AUDIT-MEMO-2026-18 ---
DATE: 2026-09-21T14:00:00Z
INSPECTOR: Environmental Specialist Sarah Jenkins
SUBJECT: Soil Silt Barrier Audit - Waterfront Esplanade Pier
MEMO DETAILS:
Inspected silt curtains deployed along the waterfront bulkhead. Minor tear noted on the eastern
anchor line; contractor instructed to repair within 24 hours. Turbidity levels upstream and
downstream remain identical.

--- RECORD ID: AUDIT-MEMO-2026-20 ---
DATE: 2026-09-24T08:45:00Z
INSPECTOR: Safety Officer Dominic Cross
SUBJECT: Electrical Switchgear Pre-Commissioning - Avenue C Overpass
MEMO DETAILS:
Performed insulation resistance testing on primary feeders installed by Quantum Electrical.
All phases tested above 100 Megaohms at 1000V DC. Lockout/tagout protocol established pending
final utility grid tie-in.

--- RECORD ID: AUDIT-MEMO-2026-22 ---
DATE: 2026-09-26T16:20:00Z
INSPECTOR: David Miller (Senior Municipal Safety Inspector, Badge ENG-404)
SUBJECT: Post-Excavation Bedrock Check - Central Rail Depot Alpha
MEMO DETAILS:
Site visit following foundation trenching. Core samples indicate competent gneiss bedrock at 4.2m
depth. No unexpected subterranean water infiltration observed. Excavation signed off for slab formation.
`.trim();

fs.writeFileSync(path.join(outDir, '06_regulatory_field_inspections.txt'), auditMemos, 'utf8');
console.log('06_regulatory_field_inspections.txt written: 9 inspection memos');

console.log('Synthetic world generation complete.');
