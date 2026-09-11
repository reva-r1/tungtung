import { db } from './database.js';
import { v4 as uuidv4 } from 'uuid';

export function seedDatabase(force: boolean = false) {
  const existingCount = (db.prepare('SELECT count(*) as count FROM entities').get() as { count: number }).count;
  if (existingCount > 0 && !force) {
    console.log(`ℹ Database already populated with ${existingCount} entities. Skipping seed.`);
    return;
  }

  console.log('⚡ Seeding AEGIS Intel with Karnataka-South Transit Intelligence dataset...');

  // Clear existing records
  db.exec(`
    DELETE FROM relationships;
    DELETE FROM events;
    DELETE FROM locations;
    DELETE FROM anomalies;
    DELETE FROM merge_candidates;
    DELETE FROM investigations;
    DELETE FROM datasets;
    DELETE FROM entities;
  `);

  const now = new Date();
  const timeOffset = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();

  // 1. Locations
  const locations = [
    {
      id: 'LOC-BLR-WFD',
      name: 'Bangalore Whitefield ICD Hub',
      address: 'Plot 42, Export Promotion Industrial Park, Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      latitude: 12.9698,
      longitude: 77.7500,
      type: 'WAREHOUSE',
      properties: { capacityTons: 12000, securityLevel: 'Tier 3', customsBonded: true }
    },
    {
      id: 'LOC-BLR-PEE',
      name: 'Peenya Industrial Logistics Yard',
      address: '4th Phase, Peenya Industrial Area',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      latitude: 13.0285,
      longitude: 77.5197,
      type: 'WAREHOUSE',
      properties: { capacityTons: 8500, hazmatCertified: true }
    },
    {
      id: 'LOC-BLR-ECITY',
      name: 'Electronic City Tech Freight Gate',
      address: 'Phase 1, Hosur Road, Electronic City',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      latitude: 12.8452,
      longitude: 77.6602,
      type: 'TRANSIT_POINT',
      properties: { highTechScanning: true }
    },
    {
      id: 'LOC-CHK-HOSUR',
      name: 'Hosur Interstate Border Checkpoint',
      address: 'NH44 Interstate Border Post',
      city: 'Hosur',
      state: 'Tamil Nadu',
      country: 'India',
      latitude: 12.7409,
      longitude: 77.8253,
      type: 'CHECKPOINT',
      properties: { automatedWeighbridge: true, anprEnabled: true }
    },
    {
      id: 'LOC-KRI-UNMON',
      name: 'Krishnagiri Industrial Transit Yard',
      address: 'Old Rayakottai Road, Krishnagiri Bypass',
      city: 'Krishnagiri',
      state: 'Tamil Nadu',
      country: 'India',
      latitude: 12.5186,
      longitude: 78.2137,
      type: 'INCIDENT_SITE',
      properties: { securityLevel: 'Unmonitored / Low', nightLightingDeficient: true }
    },
    {
      id: 'LOC-CHK-VEL',
      name: 'Vellore Highway Toll & Inspection Post',
      address: 'NH48 Km 132 Toll Plaza',
      city: 'Vellore',
      state: 'Tamil Nadu',
      country: 'India',
      latitude: 12.9165,
      longitude: 79.1325,
      type: 'TOLL_PLAZA',
      properties: { fastTagLogs: true, speedCameras: true }
    },
    {
      id: 'LOC-SRI-IND',
      name: 'Sriperumbudur Manufacturing Corridor Hub',
      address: 'SIPCOT Industrial Park Phase 2',
      city: 'Sriperumbudur',
      state: 'Tamil Nadu',
      country: 'India',
      latitude: 12.9675,
      longitude: 79.9416,
      type: 'WAREHOUSE',
      properties: { coldChainReady: true, automotiveFocus: true }
    },
    {
      id: 'LOC-MAA-PORT',
      name: 'Chennai Port Container Freight Terminal',
      address: 'Gate 4, Rajaji Salai, Chennai Port Trust',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      latitude: 13.0827,
      longitude: 80.2944,
      type: 'PORT',
      properties: { customsControlled: true, annualTEU: 1800000 }
    },
    {
      id: 'LOC-BLR-NEL',
      name: 'Nelamangala Cargo Gateway',
      address: 'NH4 Tumkur Road Interchange',
      city: 'Bangalore Rural',
      state: 'Karnataka',
      country: 'India',
      latitude: 13.0988,
      longitude: 77.3917,
      type: 'TRANSIT_POINT',
      properties: { interStateFreightHub: true }
    },
    {
      id: 'LOC-HUB-DEPOT',
      name: 'Hubli North-Karnataka Logistics Depot',
      address: 'Tarihal Industrial Estate, Hubli',
      city: 'Hubli',
      state: 'Karnataka',
      country: 'India',
      latitude: 15.3647,
      longitude: 75.1240,
      type: 'WAREHOUSE',
      properties: { distributionReach: 'North Karnataka & Goa' }
    }
  ];

  const insertLoc = db.prepare(`
    INSERT INTO locations (id, name, address, city, state, country, latitude, longitude, type, properties)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const loc of locations) {
    insertLoc.run(loc.id, loc.name, loc.address, loc.city, loc.state, loc.country, loc.latitude, loc.longitude, loc.type, JSON.stringify(loc.properties));
  }

  // 2. Entities
  const entities = [
    // Companies
    {
      id: 'ENT-CMP-APEX',
      name: 'Apex Logistics Pvt Ltd',
      type: 'COMPANY',
      label: 'Apex Logistics (Registered Primary)',
      category: 'Commercial Logistics & Freight',
      riskLevel: 'LOW',
      riskScore: 18,
      summary: 'Tier-1 logistics service provider headquartered in Bangalore with 120+ fleet vehicles operating on NH44 and NH48 corridors.',
      properties: {
        gstin: '29AAACA1234P1Z5',
        cin: 'U63090KA2015PTC081234',
        foundedYear: 2015,
        headquarters: 'Bangalore, Karnataka',
        fleetSize: 142,
        annualRevenueCr: 84.5,
        complianceRating: 'A+'
      },
      tags: ['Fleet Operator', 'Inter-State Carrier', 'Customs Approved'],
      aliases: ['Apex Logistics', 'Apex Cargo Movers']
    },
    {
      id: 'ENT-CMP-APEX-DUP',
      name: 'Apex Logistics Private Limited',
      type: 'COMPANY',
      label: 'Apex Logistics (Branch Record)',
      category: 'Commercial Logistics & Freight',
      riskLevel: 'LOW',
      riskScore: 22,
      summary: 'Secondary branch record imported from Chennai customs billing manifest with slight variation in company registration name.',
      properties: {
        gstin: '29AAACA1234P1Z5',
        headquarters: 'Whitefield, Bangalore',
        contactPhone: '+91 80 4122 8900',
        recordSource: 'Chennai Customs 2026 Ingest'
      },
      tags: ['Resolution Candidate', 'Duplicate Suspect'],
      aliases: ['Apex Logistix']
    },
    {
      id: 'ENT-CMP-HORIZON',
      name: 'Horizon Cargo Solutions',
      type: 'COMPANY',
      label: 'Horizon Cargo (Chennai Depot)',
      category: 'Port Forwarding & Customs',
      riskLevel: 'LOW',
      riskScore: 12,
      summary: 'Maritime forwarding and port clearance contractor handling high-value container transfers at Chennai Port.',
      properties: {
        gstin: '33AABCH5678Q1Z2',
        headquarters: 'Chennai, Tamil Nadu',
        portLicense: 'CHN-PORT-FWD-981',
        bondedWarehousePartner: true
      },
      tags: ['Port Agent', 'Customs Broker', 'Maritime Logistics'],
      aliases: ['Horizon Forwarders']
    },
    {
      id: 'ENT-CMP-SHADOW',
      name: 'Shadow Trade LLC',
      type: 'COMPANY',
      label: 'Shadow Trade LLC (High-Risk Entity)',
      category: 'Import-Export Front / Trading',
      riskLevel: 'CRITICAL',
      riskScore: 92,
      summary: 'High-risk trading entity registered at residential address with no operational warehouse, yet responsible for ₹28 Cr high-tech semiconductor manifests.',
      properties: {
        gstin: '29AABCS9999Z1ZX',
        registeredAddress: 'No 14, 2nd Cross, Indira Nagar (Residential)',
        director: 'Devendra Patel',
        bankAccountsFlagged: 2,
        unusualVolumeGrowth: '720% MoM'
      },
      tags: ['High Risk', 'Shell Company Suspect', 'Surge Activity', 'Watchlist'],
      aliases: ['Shadow Global Traders', 'STL Logistics']
    },
    {
      id: 'ENT-CMP-BHARAT',
      name: 'Bharat Heavy Haulage Ltd',
      type: 'COMPANY',
      label: 'Bharat Heavy Haulage',
      category: 'Heavy Cargo & Container Transit',
      riskLevel: 'LOW',
      riskScore: 15,
      summary: 'Heavy multi-axle freight transporter operating inter-state container lines across Maharashtra, Karnataka, and Tamil Nadu.',
      properties: {
        gstin: '27AABCB3344R1Z8',
        headquarters: 'Mumbai / Pune',
        activeFleet: 310
      },
      tags: ['Long Haul', 'Heavy Transit'],
      aliases: ['BHH Trans']
    },
    {
      id: 'ENT-CMP-SILICON',
      name: 'Silicon Components India Ltd',
      type: 'COMPANY',
      label: 'Silicon Components India (Shipper)',
      category: 'Electronics & Semiconductor Manufacturer',
      riskLevel: 'LOW',
      riskScore: 8,
      summary: 'Primary exporter of semiconductor wafers and precision electronics from Electronic City Bangalore to overseas markets via Chennai Port.',
      properties: {
        gstin: '29AAACS5566T1Z1',
        headquarters: 'Electronic City, Bangalore',
        exportVolumeQuarterCr: 120.0
      },
      tags: ['Consignor', 'High-Value Shipper'],
      aliases: ['SCIL Bangalore']
    },

    // Vehicles
    {
      id: 'ENT-VEH-KA01AB1234',
      name: 'Truck KA-01-AB-1234',
      type: 'VEHICLE',
      label: 'Volvo FH16 Multi-Axle Container (KA01AB1234)',
      category: 'Commercial Heavy Goods Vehicle',
      riskLevel: 'HIGH',
      riskScore: 88,
      summary: 'Heavy container truck owned by Apex Logistics. Subject of Teleportation/Impossible Speed Anomaly between Bangalore and Chennai checkpoints.',
      properties: {
        registrationNumber: 'KA01AB1234',
        make: 'Volvo',
        model: 'FH16 520 HP',
        chassisNumber: 'VOLVO-IND-88239012',
        gpsTrackerId: 'GPS-APX-1234-SAT',
        maxPayloadTons: 35.0,
        fuelCapacityLitres: 600,
        assignedDriverId: 'ENT-PER-SURESH'
      },
      tags: ['Speed Anomaly', 'Container Hauler', 'Active Watch'],
      aliases: ['KA01AB1234', 'KA-01-AB-1234 (Volvo)']
    },
    {
      id: 'ENT-VEH-KA04E9988',
      name: 'Truck KA-04-E-9988',
      type: 'VEHICLE',
      label: 'Tata Prima Heavy Transit (KA04E9988)',
      category: 'Commercial Heavy Goods Vehicle',
      riskLevel: 'MEDIUM',
      riskScore: 64,
      summary: 'Heavy container vehicle operated by Apex Logistics. Detected deviating 120km off NH48 into an unmonitored warehouse in Krishnagiri.',
      properties: {
        registrationNumber: 'KA04E9988',
        make: 'Tata Motors',
        model: 'Prima 4028.S',
        chassisNumber: 'TATA-PRM-11209388',
        gpsTrackerId: 'GPS-APX-9988-GSM',
        maxPayloadTons: 28.0,
        assignedDriverId: 'ENT-PER-VIKRAM'
      },
      tags: ['Route Deviation', 'Krishnagiri Stop', 'Active Tracking'],
      aliases: ['KA04E9988']
    },
    {
      id: 'ENT-VEH-MH12Q4455',
      name: 'Truck MH-12-Q-4455',
      type: 'VEHICLE',
      label: 'Scania R500 Container Transporter (MH12Q4455)',
      category: 'Commercial Heavy Goods Vehicle',
      riskLevel: 'CRITICAL',
      riskScore: 94,
      summary: 'Scania multi-axle carrier. Dual simultaneous FastTag telemetry recorded at Bangalore Peenya and Pune Toll Plaza within a 15-minute window (Cloned Plate Anomaly).',
      properties: {
        registrationNumber: 'MH12Q4455',
        make: 'Scania',
        model: 'R500 V8',
        chassisNumber: 'SCANIA-IN-909281',
        fastTagId: 'FTAG-IND-88192039',
        plateCloningFlag: true
      },
      tags: ['Cloned Plate Suspect', 'Dual Location Ping', 'Critical Threat'],
      aliases: ['MH12Q4455', 'MH-12-Q-4455']
    },
    {
      id: 'ENT-VEH-TN02CX7711',
      name: 'Truck TN-02-CX-7711',
      type: 'VEHICLE',
      label: 'Eicher Pro 6037 Refrigerated Van (TN02CX7711)',
      category: 'Cold Chain Transport',
      riskLevel: 'LOW',
      riskScore: 10,
      summary: 'Refrigerated container truck operating temperature-controlled pharmaceutical transit lines between Bangalore and Chennai.',
      properties: {
        registrationNumber: 'TN02CX7711',
        make: 'Eicher',
        model: 'Pro 6037 ColdChain',
        chassisNumber: 'EICH-CC-771109'
      },
      tags: ['Pharma Cold Chain', 'Verified Clean'],
      aliases: ['TN02CX7711']
    },

    // Persons / Drivers / Officers
    {
      id: 'ENT-PER-SURESH',
      name: 'Suresh Kumar',
      type: 'PERSON',
      label: 'Commercial Heavy Fleet Driver',
      category: 'Driver & Logistics Personnel',
      riskLevel: 'HIGH',
      riskScore: 78,
      summary: 'Lead commercial heavy vehicle operator for Truck KA-01-AB-1234. Inconsistencies reported in his shift handover logs during high-speed transit.',
      properties: {
        driverLicense: 'KA-0320140098124',
        contactPhone: '+91 98450 12345',
        experienceYears: 14,
        employer: 'Apex Logistics Pvt Ltd',
        badges: ['Hazmat Certified', 'Heavy Articulated Endorsement'],
        emergencyContact: 'Lakshmi Kumar'
      },
      tags: ['Primary Driver', 'Shift Inconsistency', 'Speed Anomaly Subject'],
      aliases: ['Suresh K.', 'S. Kumar (Driver)']
    },
    {
      id: 'ENT-PER-SURESH-DUP',
      name: 'Suresh Kumar (Subcontract)',
      type: 'PERSON',
      label: 'Driver Contractor Record',
      category: 'Driver & Logistics Personnel',
      riskLevel: 'MEDIUM',
      riskScore: 45,
      summary: 'Subcontractor driver record from Chennai port manifest showing identical phone number and matching commercial endorsement.',
      properties: {
        driverLicense: 'KA-0320140098124',
        contactPhone: '+91 98450 12345',
        addressMatch: 'Bengaluru South'
      },
      tags: ['Resolution Candidate', 'Duplicate Identity'],
      aliases: ['Suresh Kumar DL-98124']
    },
    {
      id: 'ENT-PER-RAJESH',
      name: 'Rajesh Gowda',
      type: 'PERSON',
      label: 'Fleet & Warehouse Operations Manager',
      category: 'Logistics Executive',
      riskLevel: 'LOW',
      riskScore: 14,
      summary: 'Senior operations head at Bangalore Whitefield ICD Hub overseeing dispatch manifests for South India corridor.',
      properties: {
        employeeId: 'APX-EMP-0412',
        officeLocation: 'Whitefield ICD',
        clearanceLevel: 'Operations Tier 2'
      },
      tags: ['Operations Manager', 'Dispatcher'],
      aliases: ['R. Gowda']
    },
    {
      id: 'ENT-PER-VIKRAM',
      name: 'Vikram Singh',
      type: 'PERSON',
      label: 'Commercial Truck Driver (Contract)',
      category: 'Driver & Logistics Personnel',
      riskLevel: 'HIGH',
      riskScore: 82,
      summary: 'Driver of KA-04-E-9988 during the unauthorized detour into Krishnagiri. Previous history of undeclared border stops.',
      properties: {
        driverLicense: 'TN-0920180054321',
        contactPhone: '+91 97890 55432',
        riskFlags: ['Unscheduled Detour', 'Phone Switched Off 2h']
      },
      tags: ['Detour Driver', 'Watchlist'],
      aliases: ['Vikram S.']
    },
    {
      id: 'ENT-PER-DEVENDRA',
      name: 'Devendra Patel',
      type: 'PERSON',
      label: 'Director - Shadow Trade LLC',
      category: 'Corporate Executive / Beneficial Owner',
      riskLevel: 'CRITICAL',
      riskScore: 96,
      summary: 'Designated managing partner of Shadow Trade LLC. Associated with 3 dissolved shell trading companies across Karnataka and Maharashtra.',
      properties: {
        dinNumber: '08923412',
        panNumber: 'ABCDE1234F',
        declaredAddresses: 4,
        shellCompanyIndicators: ['No physical office', 'Frequent directorship transfers']
      },
      tags: ['Beneficial Owner', 'Shell Operator', 'Financial Risk'],
      aliases: ['D. C. Patel', 'Devendra Chhaganlal Patel']
    },
    {
      id: 'ENT-PER-ANANYA',
      name: 'Ananya Sharma',
      type: 'PERSON',
      label: 'Customs Clearance Inspector',
      category: 'Government / Port Authority',
      riskLevel: 'LOW',
      riskScore: 5,
      summary: 'Port customs clearance officer stationed at Chennai Container Terminal.',
      properties: {
        officerBadge: 'CUST-MAA-9921',
        terminal: 'Gate 4 North Terminal'
      },
      tags: ['Customs Officer', 'Port Authority'],
      aliases: ['A. Sharma']
    },

    // Shipments
    {
      id: 'ENT-SHP-10293',
      name: 'Shipment SHP-10293',
      type: 'SHIPMENT',
      label: 'High-Value Semiconductor Wafers (SHP-10293)',
      category: 'High-Tech Cargo',
      riskLevel: 'CRITICAL',
      riskScore: 92,
      summary: 'High-value consignment of 300mm silicon wafers (Value: ₹4.2 Crore) consigned from Bangalore to Chennai Port. Timestamps indicate impossible speed between checkposts.',
      properties: {
        waybillNumber: 'EWB-2026-BLR-MAA-10293',
        declaredValueINR: 42000000,
        commodity: 'Silicon Integrated Circuit Wafers',
        weightKg: 4500,
        shipper: 'Silicon Components India Ltd',
        carrier: 'Apex Logistics Pvt Ltd',
        assignedVehicle: 'Truck KA-01-AB-1234',
        origin: 'Electronic City, Bangalore',
        destination: 'Chennai Port Terminal',
        temperatureControlled: true
      },
      tags: ['High Value', 'Speed Anomaly', 'Electronic Cargo', 'Priority Inspection'],
      aliases: ['SHP10293', 'WB-10293']
    },
    {
      id: 'ENT-SHP-8821',
      name: 'Shipment SHP-8821',
      type: 'SHIPMENT',
      label: 'Industrial Lithium Battery Cells (SHP-8821)',
      category: 'Hazardous Energy Storage',
      riskLevel: 'HIGH',
      riskScore: 84,
      summary: 'Hazardous energy storage cargo diverted 120km off the designated NH48 route into an unauthorized Krishnagiri storage facility for 3 hours.',
      properties: {
        waybillNumber: 'EWB-2026-BLR-CHN-8821',
        declaredValueINR: 18500000,
        commodity: 'Lithium Iron Phosphate (LFP) Battery Modules',
        weightKg: 12000,
        hazmatClass: 'Class 9 Dangerous Goods',
        origin: 'Peenya Industrial Yard, Bangalore',
        destination: 'Sriperumbudur Manufacturing Hub'
      },
      tags: ['Route Divergence', 'Hazmat', 'Unmonitored Yard Stop'],
      aliases: ['SHP8821']
    },
    {
      id: 'ENT-SHP-9904',
      name: 'Shipment SHP-9904',
      type: 'SHIPMENT',
      label: 'Biomedical Cold Chain Vaccines (SHP-9904)',
      category: 'Pharmaceuticals',
      riskLevel: 'LOW',
      riskScore: 10,
      summary: 'Cold-chain medical shipment safely dispatched from Whitefield ICD to Hubli Logistics Hub with consistent temperature telemetry.',
      properties: {
        waybillNumber: 'EWB-2026-BLR-HUB-9904',
        declaredValueINR: 7500000,
        commodity: 'Viral Vector Vaccines (-20C)',
        weightKg: 1800,
        origin: 'Bangalore Whitefield ICD Hub',
        destination: 'Hubli North-Karnataka Logistics Depot'
      },
      tags: ['Pharma', 'Cold Chain', 'Normal Transit'],
      aliases: ['SHP9904']
    },
    {
      id: 'ENT-SHP-6650',
      name: 'Shipment SHP-6650',
      type: 'SHIPMENT',
      label: 'Consignment Telecom Assemblies (SHP-6650)',
      category: 'Electronics Import',
      riskLevel: 'HIGH',
      riskScore: 79,
      summary: 'Imported telecom components consigned to Shadow Trade LLC with missing destination warehouse clearance (Orphaned Manifest Anomaly).',
      properties: {
        waybillNumber: 'EWB-2026-IMP-6650',
        declaredValueINR: 28000000,
        consignee: 'Shadow Trade LLC',
        missingDestinationDepot: true
      },
      tags: ['Orphaned Manifest', 'Shell Consignee', 'Watchlist'],
      aliases: ['SHP6650']
    },
    {
      id: 'ENT-SHP-7712',
      name: 'Shipment SHP-7712',
      type: 'SHIPMENT',
      label: 'Precision Avionics Instrumentation (SHP-7712)',
      category: 'High-Tech Cargo',
      riskLevel: 'LOW',
      riskScore: 12,
      summary: 'High-reliability sensor modules dispatched from Silicon Components India to Chennai Air Cargo for international avionics integration.',
      properties: {
        waybillNumber: 'EWB-2026-BLR-AIR-7712',
        declaredValueINR: 14500000,
        commodity: 'Aerospace Sensor Modules',
        weightKg: 950,
        origin: 'Electronic City, Bangalore',
        destination: 'Chennai Port Terminal'
      },
      tags: ['Avionics', 'High Precision', 'Verified Air Freight'],
      aliases: ['SHP7712']
    },

    // Warehouses
    {
      id: 'ENT-WHS-WHITEFIELD',
      name: 'Warehouse Bangalore Whitefield ICD',
      type: 'WAREHOUSE',
      label: 'Whitefield Inland Container Depot',
      category: 'Inland Customs Port',
      riskLevel: 'LOW',
      riskScore: 10,
      summary: 'Central customs-bonded inland cargo clearance terminal in Bangalore handling 400+ container dispatches daily.',
      properties: {
        facilityCode: 'ICD-WFD-01',
        totalAreaSqFt: 450000,
        operator: 'Apex Logistics Pvt Ltd'
      },
      tags: ['ICD Terminal', 'Customs Depot'],
      aliases: ['Whitefield ICD']
    },
    {
      id: 'ENT-WHS-PEENYA',
      name: 'Warehouse Peenya Hub',
      type: 'WAREHOUSE',
      label: 'Peenya Industrial Logistics Hub',
      category: 'Regional Distribution Center',
      riskLevel: 'LOW',
      riskScore: 16,
      summary: 'Heavy industrial logistics depot in Peenya accommodating hazardous chemical and mechanical cargo staging.',
      properties: {
        facilityCode: 'DC-PEE-04',
        hazmatCompliance: 'Certified'
      },
      tags: ['Hazmat Facility', 'Staging Yard'],
      aliases: ['Peenya DC']
    },
    {
      id: 'ENT-WHS-CHENNAIPORT',
      name: 'Warehouse Chennai Port Terminal Gate 4',
      type: 'WAREHOUSE',
      label: 'Chennai Port Container Freight Station',
      category: 'Maritime Port Facility',
      riskLevel: 'LOW',
      riskScore: 8,
      summary: 'Primary export/import freight consolidation hub at Chennai Port Trust.',
      properties: {
        facilityCode: 'CFS-CHN-G4',
        customsEnclosure: true
      },
      tags: ['Port Terminal', 'Export Hub'],
      aliases: ['Chennai CFS G4']
    },

    // Routes
    {
      id: 'ENT-RTE-NH48-CORRIDOR',
      name: 'Route NH48 / NH44 BLR-MAA Golden Corridor',
      type: 'ROUTE',
      label: 'Bangalore - Chennai Expressway Transit Route (350 KM)',
      category: 'National Highway Corridor',
      riskLevel: 'LOW',
      riskScore: 15,
      summary: 'Major trade artery connecting Bangalore manufacturing belts through Hosur, Krishnagiri, and Vellore to Chennai Port.',
      properties: {
        distanceKm: 348,
        standardTravelTimeHours: 6.5,
        tollPlazasCount: 5
      },
      tags: ['Expressway Corridor', 'Inter-State Highway'],
      aliases: ['NH48 Bangalore-Chennai Corridor', 'BLR-MAA Transit']
    },

    // Transactions
    {
      id: 'ENT-TX-9901',
      name: 'Wire Transfer TX-9901 (₹2.8 Cr)',
      type: 'TRANSACTION',
      label: 'Foreign Inward Remittance TX-9901',
      category: 'Financial Transaction',
      riskLevel: 'HIGH',
      riskScore: 76,
      summary: 'Offshore wire transfer routed through overseas intermediary into Shadow Trade LLC accounts preceding high-value shipment dispatches.',
      properties: {
        amountINR: 28000000,
        remitterCountry: 'Mauritius',
        beneficiary: 'Shadow Trade LLC',
        bankReference: 'SWIFT-INW-881920'
      },
      tags: ['Offshore Wire', 'Suspicious Financing'],
      aliases: ['TX9901', 'SWIFT-881920']
    }
  ];

  const insertEntity = db.prepare(`
    INSERT INTO entities (id, name, type, label, category, risk_level, risk_score, summary, properties, tags, aliases, dataset_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ent of entities) {
    insertEntity.run(
      ent.id,
      ent.name,
      ent.type,
      ent.label,
      ent.category,
      ent.riskLevel,
      ent.riskScore,
      ent.summary,
      JSON.stringify(ent.properties),
      JSON.stringify(ent.tags),
      JSON.stringify(ent.aliases),
      'DS-SYNTHETIC-LOGISTICS-2026',
      timeOffset(72),
      timeOffset(1)
    );
  }

  // 3. Relationships
  const relationships = [
    // Apex Logistics relationships
    { sourceId: 'ENT-CMP-APEX', targetId: 'ENT-VEH-KA01AB1234', type: 'OWNS', label: 'Fleet Vehicle Registration', confidence: 1.0 },
    { sourceId: 'ENT-CMP-APEX', targetId: 'ENT-VEH-KA04E9988', type: 'OWNS', label: 'Fleet Vehicle Registration', confidence: 1.0 },
    { sourceId: 'ENT-CMP-APEX', targetId: 'ENT-PER-RAJESH', type: 'WORKS_FOR', label: 'Head of Fleet Operations', confidence: 1.0 },
    { sourceId: 'ENT-CMP-APEX', targetId: 'ENT-WHS-WHITEFIELD', type: 'OPERATES', label: 'Primary ICD Operator', confidence: 1.0 },
    { sourceId: 'ENT-CMP-APEX', targetId: 'ENT-SHP-10293', type: 'SHIPPED_BY', label: 'Carrier Waybill Contract', confidence: 1.0 },
    { sourceId: 'ENT-CMP-APEX', targetId: 'ENT-SHP-8821', type: 'SHIPPED_BY', label: 'Carrier Contract', confidence: 1.0 },
    { sourceId: 'ENT-CMP-APEX', targetId: 'ENT-SHP-9904', type: 'SHIPPED_BY', label: 'Carrier Contract', confidence: 1.0 },

    // Drivers to Vehicles
    { sourceId: 'ENT-PER-SURESH', targetId: 'ENT-VEH-KA01AB1234', type: 'OPERATES', label: 'Assigned Commercial Driver', confidence: 0.98 },
    { sourceId: 'ENT-PER-SURESH', targetId: 'ENT-CMP-APEX', type: 'WORKS_FOR', label: 'Permanent Fleet Staff', confidence: 1.0 },
    { sourceId: 'ENT-PER-VIKRAM', targetId: 'ENT-VEH-KA04E9988', type: 'OPERATES', label: 'Contract Trip Driver', confidence: 0.95 },
    { sourceId: 'ENT-PER-VIKRAM', targetId: 'ENT-CMP-APEX', type: 'WORKS_FOR', label: 'Third-Party Contractor', confidence: 0.88 },

    // Vehicle to Shipment
    { sourceId: 'ENT-VEH-KA01AB1234', targetId: 'ENT-SHP-10293', type: 'CONTAINS', label: 'Loaded Cargo Container #APX-990', confidence: 1.0 },
    { sourceId: 'ENT-VEH-KA04E9988', targetId: 'ENT-SHP-8821', type: 'CONTAINS', label: 'Loaded Hazmat Container #TATA-881', confidence: 1.0 },
    { sourceId: 'ENT-VEH-TN02CX7711', targetId: 'ENT-SHP-9904', type: 'CONTAINS', label: 'Reefer Unit Cold Pod', confidence: 1.0 },

    // Shipper to Shipment
    { sourceId: 'ENT-CMP-SILICON', targetId: 'ENT-SHP-10293', type: 'ORIGINATED_FROM', label: 'Consignor Manufacturer', confidence: 1.0 },
    { sourceId: 'ENT-CMP-SILICON', targetId: 'ENT-SHP-7712', type: 'ORIGINATED_FROM', label: 'Consignor', confidence: 1.0 },

    // Shipment to Warehouse / Destinations
    { sourceId: 'ENT-SHP-10293', targetId: 'ENT-WHS-WHITEFIELD', type: 'ORIGINATED_FROM', label: 'Origin Dispatch Depot', confidence: 1.0 },
    { sourceId: 'ENT-SHP-10293', targetId: 'ENT-WHS-CHENNAIPORT', type: 'DESTINED_FOR', label: 'Final Export Gate', confidence: 1.0 },
    { sourceId: 'ENT-SHP-8821', targetId: 'ENT-WHS-PEENYA', type: 'ORIGINATED_FROM', label: 'Origin Dispatch', confidence: 1.0 },
    { sourceId: 'ENT-SHP-9904', targetId: 'ENT-WHS-WHITEFIELD', type: 'ORIGINATED_FROM', label: 'Origin Dispatch', confidence: 1.0 },

    // Vehicles along Route
    { sourceId: 'ENT-VEH-KA01AB1234', targetId: 'ENT-RTE-NH48-CORRIDOR', type: 'TRAVELS_ALONG', label: 'Active GPS Corridor Tracking', confidence: 1.0 },
    { sourceId: 'ENT-VEH-KA04E9988', targetId: 'ENT-RTE-NH48-CORRIDOR', type: 'TRAVELS_ALONG', label: 'Assigned Route', confidence: 0.95 },

    // Shadow Trade LLC and Devendra Patel
    { sourceId: 'ENT-PER-DEVENDRA', targetId: 'ENT-CMP-SHADOW', type: 'OWNS', label: 'Managing Director & 99% Shareholder', confidence: 1.0 },
    { sourceId: 'ENT-CMP-SHADOW', targetId: 'ENT-SHP-6650', type: 'SHIPPED_BY', label: 'Import Consignee', confidence: 1.0 },
    { sourceId: 'ENT-TX-9901', targetId: 'ENT-CMP-SHADOW', type: 'TRANSACTED_WITH', label: 'Beneficiary Inward Remittance', confidence: 0.96 },

    // Port & Customs
    { sourceId: 'ENT-PER-ANANYA', targetId: 'ENT-WHS-CHENNAIPORT', type: 'LOCATED_AT', label: 'Customs Inspection Station', confidence: 1.0 },
    { sourceId: 'ENT-CMP-HORIZON', targetId: 'ENT-WHS-CHENNAIPORT', type: 'OPERATES', label: 'Bonded Freight Clearing', confidence: 1.0 },
    { sourceId: 'ENT-CMP-HORIZON', targetId: 'ENT-SHP-10293', type: 'CONSIGNED_TO', label: 'Port Forwarding Agent', confidence: 0.92 },

    // Suspicious links
    { sourceId: 'ENT-PER-DEVENDRA', targetId: 'ENT-PER-VIKRAM', type: 'ASSOCIATED_WITH', label: 'Frequent Direct Call Logs (14 calls in 48h)', confidence: 0.85 },
    { sourceId: 'ENT-VEH-MH12Q4455', targetId: 'ENT-CMP-BHARAT', type: 'OWNS', label: 'Registered Fleet', confidence: 1.0 }
  ];

  const insertRel = db.prepare(`
    INSERT INTO relationships (id, source_id, target_id, type, label, confidence, properties, risk_level, dataset_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < relationships.length; i++) {
    const r = relationships[i];
    insertRel.run(
      `REL-${i + 1001}`,
      r.sourceId,
      r.targetId,
      r.type,
      r.label,
      r.confidence,
      JSON.stringify({}),
      r.confidence < 0.9 || r.sourceId.includes('SHADOW') || r.sourceId.includes('DEVENDRA') ? 'HIGH' : 'LOW',
      'DS-SYNTHETIC-LOGISTICS-2026',
      timeOffset(48)
    );
  }

  // 4. Chronological Events & Timeline
  const events = [
    {
      id: 'EVT-001',
      title: 'High-Value Shipment SHP-10293 Loaded at Whitefield ICD',
      description: '₹4.2 Cr semiconductor wafers loaded into Volvo Container KA-01-AB-1234. Digital tamper seal #STL-9921 applied.',
      eventType: 'DEPARTURE',
      timestamp: timeOffset(24),
      entityIds: ['ENT-SHP-10293', 'ENT-VEH-KA01AB1234', 'ENT-PER-SURESH', 'ENT-WHS-WHITEFIELD', 'ENT-CMP-APEX'],
      locationId: 'LOC-BLR-WFD',
      latitude: 12.9698,
      longitude: 77.7500,
      severity: 'LOW',
      evidence: ['Manifest Dispatch Log #WFD-998', 'Tamper Seal Photo Verified', 'Biometric Driver Signature']
    },
    {
      id: 'EVT-002',
      title: 'Electronic City Highway Checkpoint Verification',
      description: 'Truck KA-01-AB-1234 scanned through Electronic City ANPR camera gate. Speed logged at 48 km/h.',
      eventType: 'CHECKPOINT_PASS',
      timestamp: timeOffset(22.8),
      entityIds: ['ENT-VEH-KA01AB1234', 'ENT-SHP-10293', 'ENT-RTE-NH48-CORRIDOR'],
      locationId: 'LOC-BLR-ECITY',
      latitude: 12.8452,
      longitude: 77.6602,
      severity: 'LOW',
      evidence: ['ANPR Plate Capture: KA-01-AB-1234', 'RFID FastTag ID: FTAG-APX-1234']
    },
    {
      id: 'EVT-003',
      title: 'Hosur Interstate Border Checkpoint Cleared',
      description: 'Automated weighbridge recorded gross vehicle weight: 32.4 tons (consistent with declared manifest). Passed interstate toll.',
      eventType: 'CHECKPOINT_PASS',
      timestamp: timeOffset(21.5),
      entityIds: ['ENT-VEH-KA01AB1234', 'ENT-SHP-10293'],
      locationId: 'LOC-CHK-HOSUR',
      latitude: 12.7409,
      longitude: 77.8253,
      severity: 'LOW',
      evidence: ['Weighbridge Log: 32,410 kg', 'State Commercial Tax Clear']
    },
    {
      id: 'EVT-004',
      title: 'IMPOSSIBLE SPEED ANOMALY DETECTED: Chennai Port Gate 4 Log',
      description: 'Truck KA-01-AB-1234 logged at Chennai Port Gate 4 RFID reader only 45 minutes after passing Hosur Checkpoint (Distance 305 km). Implied speed exceeds 405 km/h.',
      eventType: 'ANOMALY_DETECTED',
      timestamp: timeOffset(20.75),
      entityIds: ['ENT-VEH-KA01AB1234', 'ENT-SHP-10293', 'ENT-CMP-APEX', 'ENT-PER-SURESH'],
      locationId: 'LOC-MAA-PORT',
      latitude: 13.0827,
      longitude: 80.2944,
      severity: 'CRITICAL',
      evidence: [
        'Time Delta: 45 minutes',
        'Physical Distance: 305.2 km',
        'Required Ground Speed: 406.9 km/h (Physically Impossible for heavy truck)',
        'Suspicion: Cloned RFID transponder or falsified entry record at port'
      ]
    },
    {
      id: 'EVT-005',
      title: 'Shipment SHP-8821 Hazmat Loaded at Peenya Hub',
      description: '12 tons of lithium battery packs loaded onto Truck KA-04-E-9988 driven by contractor Vikram Singh, destined for Sriperumbudur.',
      eventType: 'DEPARTURE',
      timestamp: timeOffset(18),
      entityIds: ['ENT-SHP-8821', 'ENT-VEH-KA04E9988', 'ENT-PER-VIKRAM', 'ENT-WHS-PEENYA'],
      locationId: 'LOC-BLR-PEE',
      latitude: 13.0285,
      longitude: 77.5197,
      severity: 'LOW',
      evidence: ['Hazmat Waybill #HM-8821-LFP', 'Pre-Trip Vehicle Safety Checklist']
    },
    {
      id: 'EVT-006',
      title: 'ROUTE DEVIATION: Truck KA-04-E-9988 Exited NH48 into Krishnagiri',
      description: 'GPS telemetry shows vehicle diverted 120km off the designated expressway route into an unmonitored industrial yard in Krishnagiri. GPS transmitter silent for 110 minutes.',
      eventType: 'ROUTE_DEVIATION',
      timestamp: timeOffset(14),
      entityIds: ['ENT-VEH-KA04E9988', 'ENT-SHP-8821', 'ENT-PER-VIKRAM'],
      locationId: 'LOC-KRI-UNMON',
      latitude: 12.5186,
      longitude: 78.2137,
      severity: 'HIGH',
      evidence: [
        'Route Variance: 120 km deviation from authorized corridor',
        'Telemetry Gap: 1 hour 50 minutes offline',
        'Location: Unmonitored yard associated with illicit transshipment'
      ]
    },
    {
      id: 'EVT-007',
      title: 'Offshore Inward Wire ₹2.8 Cr Credited to Shadow Trade LLC',
      description: 'High-value wire received from shell entity in Port Louis, Mauritius with no commercial purchase order documentation.',
      eventType: 'FINANCIAL_WIRE',
      timestamp: timeOffset(12),
      entityIds: ['ENT-TX-9901', 'ENT-CMP-SHADOW', 'ENT-PER-DEVENDRA'],
      severity: 'HIGH',
      evidence: ['SWIFT Reference: SWIFT-INW-881920', 'Bank AML Flag: Rapid Fund Movement']
    },
    {
      id: 'EVT-008',
      title: 'DUAL SIMULTANEOUS RFID PINGS: Truck MH-12-Q-4455',
      description: 'FastTag transponder MH-12-Q-4455 recorded at Nelamangala Toll (Bangalore) and Khed-Shivapur Toll (Pune) within 15 minutes of each other.',
      eventType: 'ANOMALY_DETECTED',
      timestamp: timeOffset(8),
      entityIds: ['ENT-VEH-MH12Q4455', 'ENT-CMP-BHARAT'],
      locationId: 'LOC-BLR-NEL',
      latitude: 13.0988,
      longitude: 77.3917,
      severity: 'CRITICAL',
      evidence: [
        'Ping A: Nelamangala Toll, Karnataka (Lat 13.0988, Lng 77.3917)',
        'Ping B: Khed-Shivapur Toll, Pune (Lat 18.3512, Lng 73.8421)',
        'Distance: 820 km apart',
        'Evidence of Cloned Vehicle Plate / Cloned Electronic Toll Tag'
      ]
    },
    {
      id: 'EVT-009',
      title: 'Cold Chain Vaccine SHP-9904 Verified Clean Arrival at Hubli',
      description: 'Vaccine consignment arrived safely at Hubli Depot with unbroken digital data logger record (-20.4°C maintained).',
      eventType: 'ARRIVAL',
      timestamp: timeOffset(4),
      entityIds: ['ENT-SHP-9904', 'ENT-VEH-TN02CX7711', 'ENT-WHS-WHITEFIELD'],
      locationId: 'LOC-HUB-DEPOT',
      latitude: 15.3647,
      longitude: 75.1240,
      severity: 'LOW',
      evidence: ['Continuous Cold-Chain Graph (-20.4°C)', 'Recipient Bio-Medical Receipt']
    },
    {
      id: 'EVT-010',
      title: 'Vellore Toll Plaza Transit Log: Truck KA-04-E-9988 Re-entry',
      description: 'Vehicle re-entered the NH48 main corridor after the unauthorized Krishnagiri deviation and passed Vellore Toll Plaza.',
      eventType: 'CHECKPOINT_PASS',
      timestamp: timeOffset(10),
      entityIds: ['ENT-VEH-KA04E9988', 'ENT-SHP-8821', 'ENT-RTE-NH48-CORRIDOR'],
      locationId: 'LOC-CHK-VEL',
      latitude: 12.9165,
      longitude: 79.1325,
      severity: 'MEDIUM',
      evidence: ['FastTag Plaza Record #VEL-8819', 'Speed: 62 km/h']
    }
  ];

  const insertEvent = db.prepare(`
    INSERT INTO events (id, title, description, event_type, timestamp, entity_ids, location_id, latitude, longitude, severity, evidence, properties)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ev of events) {
    insertEvent.run(
      ev.id,
      ev.title,
      ev.description,
      ev.eventType,
      ev.timestamp,
      JSON.stringify(ev.entityIds),
      ev.locationId || null,
      ev.latitude || null,
      ev.longitude || null,
      ev.severity,
      JSON.stringify(ev.evidence),
      JSON.stringify({})
    );
  }

  // 5. Anomalies
  const anomalies = [
    {
      id: 'ANOM-001',
      title: 'Physically Impossible Transit Speed (Teleportation Indicator)',
      type: 'IMPOSSIBLE_SPEED',
      severity: 'CRITICAL',
      status: 'OPEN',
      entityId: 'ENT-VEH-KA01AB1234',
      entityName: 'Truck KA-01-AB-1234',
      entityType: 'VEHICLE',
      description: 'Vehicle KA-01-AB-1234 registered at Hosur Border Checkpoint and subsequently logged at Chennai Port Gate 4 within 45 minutes. Covering 305 km in 45 minutes implies an average ground speed of 406.9 km/h, which is physically impossible for a heavy container truck.',
      evidence: [
        { title: 'Checkpoint A', detail: 'Hosur Interstate Border (12.7409, 77.8253)', timestamp: timeOffset(21.5) },
        { title: 'Checkpoint B', detail: 'Chennai Port Gate 4 (13.0827, 80.2944)', timestamp: timeOffset(20.75) },
        { title: 'Implied Ground Speed', detail: '406.9 km/h over 305.2 km distance', metric: '406.9 km/h' },
        { title: 'Primary Hypothesis', detail: 'Transponder cloning or spoofed customs manifest injection at port terminal.' }
      ],
      detectedAt: timeOffset(20.7),
      confidence: 0.98
    },
    {
      id: 'ANOM-002',
      title: 'Unauthorized Corridor Divergence into Unmonitored Yard',
      type: 'OFF_ROUTE_DEVIATION',
      severity: 'HIGH',
      status: 'OPEN',
      entityId: 'ENT-SHP-8821',
      entityName: 'Shipment SHP-8821',
      entityType: 'SHIPMENT',
      description: 'Shipment SHP-8821 (12 tons Lithium Batteries) deviated 120km off the designated NH48 route into an unmonitored industrial yard in Krishnagiri. Telemetry was dropped for 1 hour 50 minutes before vehicle re-emerged.',
      evidence: [
        { title: 'Authorized Route', detail: 'NH48 Bangalore-Sriperumbudur corridor via Vellore' },
        { title: 'Detour Point', detail: 'Krishnagiri Old Rayakottai Yard (12.5186, 78.2137)', timestamp: timeOffset(14) },
        { title: 'Offline Duration', detail: '110 minutes without GPS telemetry', metric: '110 mins' },
        { title: 'Driver Association', detail: 'Driver Vikram Singh logged 14 phone calls with Devendra Patel (Shadow Trade LLC).' }
      ],
      detectedAt: timeOffset(13.5),
      confidence: 0.92
    },
    {
      id: 'ANOM-003',
      title: 'Shell Entity Transaction Volume Surge & Missing Asset Base',
      type: 'RELATIONSHIP_SURGE',
      severity: 'CRITICAL',
      status: 'INVESTIGATING',
      entityId: 'ENT-CMP-SHADOW',
      entityName: 'Shadow Trade LLC',
      entityType: 'COMPANY',
      description: 'Shadow Trade LLC registered 15 high-value semiconductor and electronics import manifests in the last 48 hours totaling ₹28 Cr despite having zero physical warehouses and being registered to a residential address.',
      evidence: [
        { title: 'Volume Surge', detail: '720% increase in import consignment volume in 48 hours', metric: '+720%' },
        { title: 'Physical Inspection', detail: 'Address is a residential 2BHK flat in Indira Nagar, Bangalore' },
        { title: 'Financial Inflow', detail: 'Received ₹2.8 Cr foreign inward remittance TX-9901 from Mauritius entity' }
      ],
      detectedAt: timeOffset(11),
      confidence: 0.95
    },
    {
      id: 'ANOM-004',
      title: 'Simultaneous Dual Geolocation / Cloned Plate Anomaly',
      type: 'DUPLICATE_IDENTITY',
      severity: 'CRITICAL',
      status: 'OPEN',
      entityId: 'ENT-VEH-MH12Q4455',
      entityName: 'Truck MH-12-Q-4455',
      entityType: 'VEHICLE',
      description: 'Vehicle plate MH-12-Q-4455 registered simultaneous electronic toll timestamps at Nelamangala (Bangalore) and Pune (Maharashtra) 820 km apart within 15 minutes.',
      evidence: [
        { title: 'Toll Event 1', detail: 'Nelamangala Cargo Gateway, Bangalore at ' + timeOffset(8), metric: 'Bangalore' },
        { title: 'Toll Event 2', detail: 'Khed-Shivapur Toll Plaza, Pune at ' + timeOffset(7.8), metric: 'Pune' },
        { title: 'Distance Separation', detail: '820 km separation between simultaneous pings', metric: '820 km' }
      ],
      detectedAt: timeOffset(7.5),
      confidence: 0.99
    },
    {
      id: 'ANOM-005',
      title: 'Orphaned Consignment Manifest with Missing Warehouse ID',
      type: 'ORPHANED_MANIFEST',
      severity: 'MEDIUM',
      status: 'OPEN',
      entityId: 'ENT-SHP-6650',
      entityName: 'Shipment SHP-6650',
      entityType: 'SHIPMENT',
      description: 'Import manifest SHP-6650 references an unregistered destination warehouse code, preventing verification of cargo receipt and customs duty reconciliation.',
      evidence: [
        { title: 'Declared Destination', detail: 'DEPOT-UNKNOWN-9921 (Does not match registered customs premises)' },
        { title: 'Consignee Entity', detail: 'Shadow Trade LLC' }
      ],
      detectedAt: timeOffset(5),
      confidence: 0.88
    }
  ];

  const insertAnomaly = db.prepare(`
    INSERT INTO anomalies (id, title, type, severity, status, entity_id, entity_name, entity_type, description, evidence, detected_at, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const an of anomalies) {
    insertAnomaly.run(
      an.id,
      an.title,
      an.type,
      an.severity,
      an.status,
      an.entityId,
      an.entityName,
      an.entityType,
      an.description,
      JSON.stringify(an.evidence),
      an.detectedAt,
      an.confidence
    );
  }

  // 6. Merge Candidates (Entity Resolution)
  const mergeCandidates = [
    {
      id: 'MERGE-001',
      sourceEntityId: 'ENT-CMP-APEX-DUP',
      targetEntityId: 'ENT-CMP-APEX',
      sourceName: 'Apex Logistics Private Limited',
      targetName: 'Apex Logistics Pvt Ltd',
      type: 'COMPANY',
      confidence: 0.94,
      matchReasons: [
        'GSTIN Match: 29AAACA1234P1Z5 (Exact Match)',
        'Company Name Token Jaccard Similarity: 94.2%',
        'Operating Address Match: Whitefield, Bangalore',
        'Identical Fleet Operator Registration'
      ],
      status: 'PENDING',
      sourceProps: { gstin: '29AAACA1234P1Z5', recordSource: 'Chennai Customs Ingest' },
      targetProps: { gstin: '29AAACA1234P1Z5', fleetSize: 142 }
    },
    {
      id: 'MERGE-002',
      sourceEntityId: 'ENT-PER-SURESH-DUP',
      targetEntityId: 'ENT-PER-SURESH',
      sourceName: 'Suresh Kumar (Subcontract)',
      targetName: 'Suresh Kumar',
      type: 'PERSON',
      confidence: 0.91,
      matchReasons: [
        'Driver License Match: KA-0320140098124',
        'Contact Phone Match: +91 98450 12345',
        'Commercial Heavy Endorsement Match',
        'Name Levenshtein Distance: 0'
      ],
      status: 'PENDING',
      sourceProps: { driverLicense: 'KA-0320140098124', contactPhone: '+91 98450 12345' },
      targetProps: { driverLicense: 'KA-0320140098124', employer: 'Apex Logistics Pvt Ltd' }
    }
  ];

  const insertMerge = db.prepare(`
    INSERT INTO merge_candidates (id, source_entity_id, target_entity_id, source_name, target_name, type, confidence, match_reasons, status, source_props, target_props, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of mergeCandidates) {
    insertMerge.run(
      m.id,
      m.sourceEntityId,
      m.targetEntityId,
      m.sourceName,
      m.targetName,
      m.type,
      m.confidence,
      JSON.stringify(m.matchReasons),
      m.status,
      JSON.stringify(m.sourceProps),
      JSON.stringify(m.targetProps),
      timeOffset(24)
    );
  }

  // 7. Active Investigation Dossiers
  const investigations = [
    {
      id: 'INV-2026-001',
      title: 'Operation Velvet Transit: NH48 High-Tech Semiconductor Smuggling & Speed Anomaly',
      description: 'Investigation into impossible transit timestamps for high-value semiconductor shipment SHP-10293 and off-route diversion of Lithium cargo SHP-8821 involving Apex Logistics and Shadow Trade LLC.',
      leadAnalyst: 'Lead Agent K. Rao',
      status: 'ACTIVE',
      priority: 'CRITICAL',
      entityIds: ['ENT-VEH-KA01AB1234', 'ENT-SHP-10293', 'ENT-CMP-SHADOW', 'ENT-PER-DEVENDRA', 'ENT-PER-VIKRAM', 'ENT-SHP-8821'],
      notes: [
        {
          id: 'NOTE-01',
          author: 'Lead Agent K. Rao',
          content: 'Analysis of Hosur-to-Chennai timestamps proves physical teleportation. The container seal at Chennai Port was inspected by Officer Ananya Sharma; photographic evidence indicates seal STL-9921 was swapped with a counterfeit replica.',
          createdAt: timeOffset(18)
        },
        {
          id: 'NOTE-02',
          author: 'Analyst M. Varma',
          content: 'Cross-referenced call records between driver Vikram Singh and Shadow Trade LLC managing director Devendra Patel. 14 encrypted calls occurred during the 110-minute Krishnagiri offline window.',
          createdAt: timeOffset(10)
        }
      ]
    },
    {
      id: 'INV-2026-002',
      title: 'Interstate Cloned Transponder Syndicate (MH-12-Q-4455)',
      description: 'Tracking organized network duplicating FastTag RFID transponders and commercial HGV number plates across Bangalore-Mumbai transport corridors.',
      leadAnalyst: 'Senior Analyst P. Nair',
      status: 'ACTIVE',
      priority: 'HIGH',
      entityIds: ['ENT-VEH-MH12Q4455', 'ENT-CMP-BHARAT'],
      notes: [
        {
          id: 'NOTE-03',
          author: 'Senior Analyst P. Nair',
          content: 'Synchronized toll records confirmed from both Nelamangala and Pune plazas. Physical interception ordered for the southern vehicle at Hubli checkpoint.',
          createdAt: timeOffset(6)
        }
      ]
    }
  ];

  const insertInv = db.prepare(`
    INSERT INTO investigations (id, title, description, lead_analyst, status, priority, entity_ids, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const inv of investigations) {
    insertInv.run(
      inv.id,
      inv.title,
      inv.description,
      inv.leadAnalyst,
      inv.status,
      inv.priority,
      JSON.stringify(inv.entityIds),
      JSON.stringify(inv.notes),
      timeOffset(36),
      timeOffset(2)
    );
  }

  // 8. Datasets
  const datasets = [
    {
      id: 'DS-SYNTHETIC-LOGISTICS-2026',
      name: 'Karnataka & South-West Transit Corridor Intelligence Feed',
      description: 'Integrated multi-agency logistics, toll telemetry, commercial tax manifests, and port container records spanning Karnataka, Tamil Nadu, and Maharashtra.',
      format: 'SYNTHETIC',
      recordCount: entities.length + relationships.length + events.length,
      entityCount: entities.length,
      relationshipCount: relationships.length,
      uploadedAt: timeOffset(72),
      status: 'LOADED',
      detectedSchema: {
        columns: [
          { name: 'entity_id', type: 'VARCHAR', inferredEntity: 'VEHICLE' },
          { name: 'company_name', type: 'VARCHAR', inferredEntity: 'COMPANY' },
          { name: 'driver_name', type: 'VARCHAR', inferredEntity: 'PERSON' },
          { name: 'waybill_no', type: 'VARCHAR', inferredEntity: 'SHIPMENT' },
          { name: 'latitude', type: 'FLOAT' },
          { name: 'longitude', type: 'FLOAT' },
          { name: 'timestamp', type: 'TIMESTAMP', inferredEntity: 'EVENT' }
        ],
        missingValues: 2,
        duplicateRows: 2
      }
    }
  ];

  const insertDataset = db.prepare(`
    INSERT INTO datasets (id, name, description, format, record_count, entity_count, relationship_count, uploaded_at, status, detected_schema)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ds of datasets) {
    insertDataset.run(
      ds.id,
      ds.name,
      ds.description,
      ds.format,
      ds.recordCount,
      ds.entityCount,
      ds.relationshipCount,
      ds.uploadedAt,
      ds.status,
      JSON.stringify(ds.detectedSchema)
    );
  }

  console.log(`✔ Seed complete: ${entities.length} entities, ${relationships.length} relationships, ${events.length} events, ${anomalies.length} anomalies, ${locations.length} locations seeded.`);
}
