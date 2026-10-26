import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDir = __dirname;
const investDir = path.join(baseDir, 'investigation');
const telemDir = path.join(investDir, 'telemetry');
const sealedDir = path.join(baseDir, 'sealed');

[investDir, telemDir, sealedDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

console.log('Generating Operation Phantom Cargo Benchmark Dataset...');

// 1. 01_customs_declarations.csv
const customsCsv = `bill_of_lading,vessel_name,imo,mmsi,shipper,consignee,declared_cargo,cargo_weight_mt,declared_route,estimated_hours,departure_port,arrival_port,declaration_date
BL-2024-AE-9821,BHARAT GAURAV,9435678,419001248,Apex Petrochem FZE,Pacific Horizon Storage Pvt Ltd,Refined Lubricant Base Oil,4500,Fujairah -> Mumbai JNPT Direct,96,Fujairah,Mumbai JNPT,2024-10-12T06:00:00Z
BL-2024-DE-1102,SWARNA KAMAL,9381023,419002341,Kandla Port Trust,Essar Oil Terminal,Industrial Heavy Fuel Oil,8200,Kandla -> Sikka Coastal,24,Kandla,Sikka,2024-10-13T04:00:00Z
BL-2024-SG-5509,MSC INES,9708681,352001190,Singapore Port Logistics,JNPT Terminal 1,Consumer Electronics & Spares,6200,Singapore -> Mumbai JNPT,120,Singapore,Mumbai JNPT,2024-10-10T12:00:00Z
`;
fs.writeFileSync(path.join(investDir, '01_customs_declarations.csv'), customsCsv);

// 2. 02_corporate_registry.csv
const corpCsv = `company_name,registration_cin,jurisdiction,director_name,beneficial_owner,registered_address,shareholder_notes
Pacific Horizon Storage Pvt Ltd,U63020MH2018PTC310245,India,Vikram Malhotra,Vikram Malhotra,Plot 44 JNPT Port SEZ Navi Mumbai,Holds licensed liquid bulk storage tanks at JNPT
Apex Petrochem FZE,FZE-REG-2019-8812,UAE (Fujairah),Tariq Al-Mansoor,Tariq Al-Mansoor,Oil Zone 2 Port of Fujairah UAE,Specialty chemical blending and trading
Gulf Crest Escrow Ltd,SC-IBC-2021-4901,Seychelles,David Sterling,Tariq Al-Mansoor,Suite 3 Victoria Mahe Seychelles,Beneficial ownership verified to Tariq Al-Mansoor; registered operator of feeder tanker OCEAN VALOR
Colombo Marine Services,PV-90812-LK,Sri Lanka,Sunil Perera,Sunil Perera,Colombo Port Harbor Walk Colombo,Certified commercial dry-dock repair yard
Tata Global Logistics,L60200MH1995PLC089201,India,Ramesh Tata,Tata Sons,Bombay House Homi Mody Street Mumbai,Legitimate public logistics conglomerate
`;
fs.writeFileSync(path.join(investDir, '02_corporate_registry.csv'), corpCsv);

// 3. 03_wire_transfers.csv
const wireCsv = `remitter,beneficiary,amount,currency,transfer_date,reference_memo,banking_channel
Gulf Crest Escrow Ltd,Apex Petrochem FZE,1850000,USD,2024-10-14T08:30:00Z,EXPEDITE-SOLVENT-01,Standard Chartered Dubai Escrow
Apex Petrochem FZE,Pacific Horizon Storage Pvt Ltd,450000,USD,2024-10-15T14:15:00Z,BULK-HANDLING-DISB-77,Emirates NBD Mumbai Branch
Tata Global Logistics,Colombo Marine Services,2400000,USD,2024-10-13T10:00:00Z,ROUTINE-DRYDOCK-REFURB-INV-891,HSBC Commercial Banking
`;
fs.writeFileSync(path.join(investDir, '03_wire_transfers.csv'), wireCsv);

// 4. 04_port_clearance_records.csv
const clearanceCsv = `vessel_name,imo,port,arrival_timestamp,declared_delay_hours,stated_reason,clearance_status
BHARAT GAURAV,9435678,Mumbai JNPT,2024-10-17T20:00:00Z,38,Engine auxiliary cooling system slowdown,FLAGGED_INSPECTION_PENDING
SWARNA KAMAL,9381023,Sikka,2024-10-14T14:00:00Z,10,DG Shipping scheduled auxiliary generator maintenance broadcast,CLEARED_MAINTENANCE_LOGGED
MSC INES,9708681,Mumbai JNPT,2024-10-16T18:00:00Z,14,Severe tropical squall navigational deviation (safety advisory 44),CLEARED_WEATHER_AVOIDANCE
`;
fs.writeFileSync(path.join(investDir, '04_port_clearance_records.csv'), clearanceCsv);

// 5. telemetry/ais_vessel_positions.csv
const aisPositionsCsv = `vessel_name,imo,mmsi,latitude,longitude,speed_knots,course_deg,timestamp
BHARAT GAURAV,9435678,419001248,24.12,58.45,13.2,122.0,2024-10-13T00:00:00Z
BHARAT GAURAV,9435678,419001248,22.30,62.10,12.8,125.0,2024-10-13T12:00:00Z
BHARAT GAURAV,9435678,419001248,20.41,65.23,0.4,180.0,2024-10-14T02:00:00Z
OCEAN VALOR,9214567,419003412,20.41,65.23,0.3,178.0,2024-10-14T04:00:00Z
OCEAN VALOR,9214567,419003412,20.42,65.24,0.4,182.0,2024-10-14T12:00:00Z
BHARAT GAURAV,9435678,419001248,20.40,65.25,12.1,105.0,2024-10-14T17:00:00Z
BHARAT GAURAV,9435678,419001248,18.95,72.95,4.2,90.0,2024-10-17T20:00:00Z
SWARNA KAMAL,9381023,419002341,22.45,69.10,1.2,45.0,2024-10-13T10:00:00Z
MSC INES,9708681,352001190,17.20,70.50,11.5,330.0,2024-10-15T08:00:00Z
`;
fs.writeFileSync(path.join(telemDir, 'ais_vessel_positions.csv'), aisPositionsCsv);

// 6. telemetry/ais_transponder_events.csv
const transponderEventsCsv = `vessel_name,imo,mmsi,event_type,latitude,longitude,timestamp,gap_duration_hours
BHARAT GAURAV,9435678,419001248,TRANSPONDER_OFF,20.41,65.23,2024-10-14T02:15:00Z,14.5
BHARAT GAURAV,9435678,419001248,TRANSPONDER_ON,20.40,65.25,2024-10-14T16:45:00Z,0.0
`;
fs.writeFileSync(path.join(telemDir, 'ais_transponder_events.csv'), transponderEventsCsv);

// 7. telemetry/vessel_draught_changes.csv
const draughtCsv = `vessel_name,imo,mmsi,reported_draught_meters,observed_draught_meters,displacement_delta_mt,timestamp,observation_method
BHARAT GAURAV,9435678,419001248,8.4,8.4,0,2024-10-12T06:00:00Z,Port departure draught sensor (Fujairah)
BHARAT GAURAV,9435678,419001248,8.4,13.9,42000,2024-10-14T17:00:00Z,Satellite SAR water-displacement radar upon AIS reactivation
SWARNA KAMAL,9381023,419002341,9.1,9.1,0,2024-10-13T12:00:00Z,Coastal optical gauge (Sikka)
MSC INES,9708681,352001190,11.2,11.2,0,2024-10-15T08:00:00Z,Satellite optical waterline inspection
`;
fs.writeFileSync(path.join(telemDir, 'vessel_draught_changes.csv'), draughtCsv);

// 8. sealed/answer-key.md
const answerKeyMd = `# Operation Phantom Cargo — Canonical Answer Key

## 1. Ground Truth Syndicate Structure
- **Target Vessel:** BHARAT GAURAV (IMO: 9435678, MMSI: 419001248)
- **Feeder Ship:** OCEAN VALOR (IMO: 9214567, MMSI: 419003412)
- **Cover Declaration:** 4,500 MT of Refined Lubricant Base Oil (Apex Petrochem -> Pacific Horizon Storage)
- **Physical Crime:** Mid-voyage Ship-to-Ship (STS) dark transfer of 42,000 MT heavy crude at (20.41°N, 65.23°E) during 14.5-hour AIS transponder blackout.
- **Physical Evidence:** Draught increased from 8.4m to 13.9m at sea without port entry. Arrival delayed by 38 hours.
- **Financial Architecture:** Gulf Crest Escrow Ltd wired $1,850,000 to Apex Petrochem FZE. Beneficial owner of Gulf Crest Escrow is Tariq Al-Mansoor, who controls OCEAN VALOR.

## 2. Decoys (Benign Non-Crimes)
- **SWARNA KAMAL:** Auxiliary generator maintenance, logged with DG Shipping. Exonerated.
- **MSC INES:** Navigational detour due to severe tropical squall. Exonerated.
- **Tata Global Logistics Wire:** Standard dry-dock refurbishment fee to Colombo Marine Services. Exonerated.
`;
fs.writeFileSync(path.join(sealedDir, 'answer-key.md'), answerKeyMd);

// 9. sealed/scoring-rubric.md
const scoringRubricMd = `# Operation Phantom Cargo — 100-Point Scoring Rubric

| Category | Points | Criteria |
| :--- | :--- | :--- |
| **1. Cross-Source Entity Resolution** | **25 pts** | - Linked CSV customs declaration to BHARAT GAURAV (10 pts)<br>- Linked OCEAN VALOR to Gulf Crest Escrow beneficial owner Tariq Al-Mansoor (15 pts) |
| **2. Physical vs. Paperwork Discrepancies** | **30 pts** | - Identified 14.5-hour AIS transponder blackout (10 pts)<br>- Correlated draught change (8.4m -> 13.9m) to heavy cargo transfer (10 pts)<br>- Detected 38-hour arrival delay contradiction (10 pts) |
| **3. Pattern Synthesis & Crime Recognition** | **25 pts** | - Classified as Ship-to-Ship (STS) Dark Transshipment (15 pts)<br>- Identified customs tariff misclassification fraud (10 pts) |
| **4. Noise Discrimination & Exoneration** | **20 pts** | - Correctly exonerated SWARNA KAMAL as maintenance (10 pts)<br>- Correctly exonerated MSC INES as weather avoidance (10 pts) |
| **TOTAL** | **100 pts** | Full benchmark mastery score |
`;
fs.writeFileSync(path.join(sealedDir, 'scoring-rubric.md'), scoringRubricMd);

console.log('✔ All 9 Operation Phantom Cargo benchmark files generated successfully.');
