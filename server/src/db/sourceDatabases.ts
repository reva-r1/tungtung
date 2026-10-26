import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
export const SOURCES_DIR = path.join(DATA_DIR, 'sources');

export interface SourceDbConfig {
  id: string;
  name: string;
  dbType: 'sqlite';
  filePath: string;
}

export const REGISTERED_SOURCE_CONFIGS: SourceDbConfig[] = [
  {
    id: 'LOGISTICS_DB',
    name: 'Logistics Operations Database',
    dbType: 'sqlite',
    filePath: path.join(SOURCES_DIR, 'logistics.db'),
  },
  {
    id: 'COMPANY_REGISTRY_DB',
    name: 'Corporate Registrar & Filings',
    dbType: 'sqlite',
    filePath: path.join(SOURCES_DIR, 'company_registry.db'),
  },
  {
    id: 'FACILITIES_DB',
    name: 'Facilities & Checkpoint Telemetry',
    dbType: 'sqlite',
    filePath: path.join(SOURCES_DIR, 'facilities.db'),
  },
  {
    id: 'TRANSACTIONS_DB',
    name: 'Banking & Financial Transactions Ledger',
    dbType: 'sqlite',
    filePath: path.join(SOURCES_DIR, 'transactions.db'),
  },
];

/**
 * Initialize and populate the 4 independent source SQLite databases
 */
export function initSourceDatabases(forceRecreate: boolean = false): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Security Violation] initSourceDatabases is strictly prohibited in production environments.');
  }

  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
  }

  // 1. SOURCE DATABASE 1: LOGISTICS_DB
  initLogisticsDb(path.join(SOURCES_DIR, 'logistics.db'), forceRecreate);

  // 2. SOURCE DATABASE 2: COMPANY_REGISTRY_DB
  initCompanyRegistryDb(path.join(SOURCES_DIR, 'company_registry.db'), forceRecreate);

  // 3. SOURCE DATABASE 3: FACILITIES_DB
  initFacilitiesDb(path.join(SOURCES_DIR, 'facilities.db'), forceRecreate);

  // 4. SOURCE DATABASE 4: TRANSACTIONS_DB
  initTransactionsDb(path.join(SOURCES_DIR, 'transactions.db'), forceRecreate);

  console.log('✔ All 4 independent source databases initialized in:', SOURCES_DIR);
}

function initLogisticsDb(filePath: string, force: boolean) {
  if (fs.existsSync(filePath) && !force) return;
  if (fs.existsSync(filePath) && force) fs.unlinkSync(filePath);

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE shipments (
      shipment_id TEXT PRIMARY KEY,
      vehicle_number TEXT NOT NULL,
      company_name TEXT NOT NULL,
      origin_city TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      cargo_description TEXT,
      declared_value REAL,
      status TEXT,
      created_date TEXT NOT NULL
    );

    CREATE TABLE vehicles (
      registration_number TEXT PRIMARY KEY,
      make TEXT,
      model TEXT,
      assigned_driver TEXT,
      owner_entity TEXT,
      status TEXT
    );

    CREATE TABLE drivers (
      driver_name TEXT PRIMARY KEY,
      license_number TEXT,
      phone_number TEXT,
      assigned_vehicle TEXT
    );

    CREATE TABLE routes (
      route_code TEXT PRIMARY KEY,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      primary_carrier TEXT,
      distance_km REAL
    );
  `);

  const insertShipment = db.prepare(`
    INSERT INTO shipments (shipment_id, vehicle_number, company_name, origin_city, destination_city, cargo_description, declared_value, status, created_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertShipment.run('S1001', 'KA01AB1234', 'ABC Logistics', 'Bangalore', 'Chennai', 'Lithium Battery Modules', 4500000, 'IN_TRANSIT', '2026-08-28T09:00:00Z');
  insertShipment.run('S1002', 'KA04CD5678', 'Vanguard Express', 'Hosur', 'Peenya', 'Electronic Sub-assemblies', 2800000, 'DELIVERED', '2026-08-27T14:30:00Z');
  insertShipment.run('S1003', 'TN09XY9988', 'Deccan Freight Lines', 'Whitefield', 'Krishnagiri', 'Precision Machine Parts', 6200000, 'IN_TRANSIT', '2026-08-29T10:00:00Z');

  const insertVehicle = db.prepare(`
    INSERT INTO vehicles (registration_number, make, model, assigned_driver, owner_entity, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertVehicle.run('KA01AB1234', 'Tata', 'Signa 4825.TK', 'Ravi Kumar', 'ABC Logistics', 'ACTIVE');
  insertVehicle.run('KA04CD5678', 'Ashok Leyland', 'Ecomet 1215', 'Suresh Patel', 'Vanguard Express', 'ACTIVE');
  insertVehicle.run('TN09XY9988', 'BharatBenz', '3528C', 'Manoj Verma', 'Deccan Freight Lines', 'ACTIVE');

  const insertDriver = db.prepare(`
    INSERT INTO drivers (driver_name, license_number, phone_number, assigned_vehicle)
    VALUES (?, ?, ?, ?)
  `);

  insertDriver.run('Ravi Kumar', 'DL-0420110098234', '+91-98450-12345', 'KA01AB1234');
  insertDriver.run('Suresh Patel', 'DL-0520140056123', '+91-98450-23456', 'KA04CD5678');
  insertDriver.run('Manoj Verma', 'DL-0720180012999', '+91-98450-34567', 'TN09XY9988');

  const insertRoute = db.prepare(`
    INSERT INTO routes (route_code, origin, destination, primary_carrier, distance_km)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRoute.run('RT-BLR-CHN-01', 'Bangalore', 'Chennai', 'ABC Logistics', 350);
  insertRoute.run('RT-HSR-PEE-02', 'Hosur', 'Peenya', 'Vanguard Express', 65);

  db.close();
}

function initCompanyRegistryDb(filePath: string, force: boolean) {
  if (fs.existsSync(filePath) && !force) return;
  if (fs.existsSync(filePath) && force) fs.unlinkSync(filePath);

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE companies (
      company_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      cin TEXT,
      gstin TEXT,
      registered_address TEXT,
      incorporation_date TEXT,
      status TEXT
    );

    CREATE TABLE directors (
      director_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      din TEXT,
      company_id TEXT NOT NULL,
      appointed_date TEXT,
      designation TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(company_id)
    );

    CREATE TABLE registrations (
      registration_id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      registration_type TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      issuing_authority TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(company_id)
    );

    CREATE TABLE addresses (
      address_id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      address_type TEXT NOT NULL,
      street TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(company_id)
    );
  `);

  const insertCompany = db.prepare(`
    INSERT INTO companies (company_id, company_name, cin, gstin, registered_address, incorporation_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertCompany.run('CR-101', 'ABC Logistics Pvt Ltd', 'U60231KA2018PTC112345', '29AAACA1234X123', '42/1 Outer Ring Road, Bellandur, Bangalore', '2018-04-12', 'ACTIVE');
  insertCompany.run('CR-102', 'Vanguard Express Logistics India Limited', 'U63090KA2016PLC098765', '29AABCV5678Y123', '108 Industrial Layout, Peenya 3rd Phase, Bangalore', '2016-09-20', 'ACTIVE');
  insertCompany.run('CR-103', 'Deccan Freight Lines Private Limited', 'U60200TN2019PTC045678', '33AAACD9988Z123', '15 SIPCOT Phase 1, Hosur, Tamil Nadu', '2019-11-05', 'ACTIVE');

  const insertDirector = db.prepare(`
    INSERT INTO directors (director_id, full_name, din, company_id, appointed_date, designation)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertDirector.run('DIR-01', 'Ravi Kumar', '08123456', 'CR-101', '2018-04-12', 'Managing Director');
  insertDirector.run('DIR-02', 'Ananya Sen', '08123457', 'CR-101', '2019-01-15', 'Director');
  insertDirector.run('DIR-03', 'Vikramaditya Rao', '07654321', 'CR-102', '2016-09-20', 'Executive Director');

  const insertReg = db.prepare(`
    INSERT INTO registrations (registration_id, company_id, registration_type, registration_number, issuing_authority)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertReg.run('REG-01', 'CR-101', 'GSTIN', '29AAACA1234X123', 'Commercial Taxes Dept Karnataka');
  insertReg.run('REG-02', 'CR-101', 'MSME', 'UDYAM-KR-03-0012345', 'Ministry of MSME');
  insertReg.run('REG-03', 'CR-102', 'GSTIN', '29AABCV5678Y123', 'Commercial Taxes Dept Karnataka');

  const insertAddr = db.prepare(`
    INSERT INTO addresses (address_id, company_id, address_type, street, city, state, pincode)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertAddr.run('ADDR-01', 'CR-101', 'REGISTERED', '42/1 Outer Ring Road, Bellandur', 'Bangalore', 'Karnataka', '560103');
  insertAddr.run('ADDR-02', 'CR-102', 'REGISTERED', '108 Industrial Layout, Peenya 3rd Phase', 'Bangalore', 'Karnataka', '560058');

  db.close();
}

function initFacilitiesDb(filePath: string, force: boolean) {
  if (fs.existsSync(filePath) && !force) return;
  if (fs.existsSync(filePath) && force) fs.unlinkSync(filePath);

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE warehouses (
      warehouse_code TEXT PRIMARY KEY,
      facility_name TEXT NOT NULL,
      facility_type TEXT,
      address TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      capacity_sqft REAL
    );

    CREATE TABLE locations (
      location_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_type TEXT
    );

    CREATE TABLE checkpoints (
      checkpoint_id TEXT PRIMARY KEY,
      checkpoint_name TEXT NOT NULL,
      highway TEXT,
      location_id TEXT
    );

    CREATE TABLE location_events (
      event_id TEXT PRIMARY KEY,
      vehicle_registration TEXT NOT NULL,
      warehouse_code TEXT,
      checkpoint_id TEXT,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      details TEXT
    );
  `);

  const insertWarehouse = db.prepare(`
    INSERT INTO warehouses (warehouse_code, facility_name, facility_type, address, city, state, capacity_sqft)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertWarehouse.run('W45', 'Whitefield Logistics Hub W45', 'BONDED_WAREHOUSE', 'Plot 42 EPIP Zone, Whitefield', 'Bangalore', 'Karnataka', 150000);
  insertWarehouse.run('W22', 'Peenya Central Depot W22', 'REGIONAL_DISTRIBUTION', '4th Phase Peenya Industrial Area', 'Bangalore', 'Karnataka', 85000);
  insertWarehouse.run('W88', 'Hosur Border Freight Terminal W88', 'TRANSIT_YARD', 'NH44 Interstate Border Post', 'Hosur', 'Tamil Nadu', 120000);

  const insertLocation = db.prepare(`
    INSERT INTO locations (location_id, name, latitude, longitude, location_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertLocation.run('LOC-W45', 'Whitefield Hub Gate', 12.9698, 77.7500, 'WAREHOUSE');
  insertLocation.run('LOC-W22', 'Peenya Depot Gate', 13.0285, 77.5197, 'WAREHOUSE');
  insertLocation.run('LOC-W88', 'Hosur Interstate Gate', 12.7409, 77.8253, 'CHECKPOINT');

  const insertCheckpoint = db.prepare(`
    INSERT INTO checkpoints (checkpoint_id, checkpoint_name, highway, location_id)
    VALUES (?, ?, ?, ?)
  `);

  insertCheckpoint.run('CHK-01', 'Hosur Interstate Border Checkpoint', 'NH44', 'LOC-W88');
  insertCheckpoint.run('CHK-02', 'Electronic City Toll Plaza', 'Hosur Elevated Tollway', 'LOC-W45');

  const insertEvent = db.prepare(`
    INSERT INTO location_events (event_id, vehicle_registration, warehouse_code, checkpoint_id, event_type, timestamp, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertEvent.run('LE-1001', 'KA01AB1234', 'W45', null, 'GATE_ENTRY', '2026-08-29T08:30:00Z', 'Dock 4 loading scheduled for battery modules');
  insertEvent.run('LE-1002', 'KA01AB1234', 'W45', null, 'DEPARTURE', '2026-08-29T11:15:00Z', 'Departed with container seal #SL-88912');
  insertEvent.run('LE-1003', 'KA04CD5678', 'W22', null, 'GATE_ENTRY', '2026-08-29T09:00:00Z', 'Unloading component crates at bay 2');
  insertEvent.run('LE-1004', 'TN09XY9988', 'W88', 'CHK-01', 'CHECKPOINT_PASS', '2026-08-29T14:45:00Z', 'Automated weighbridge cleared 32.4T');

  db.close();
}

function initTransactionsDb(filePath: string, force: boolean) {
  if (fs.existsSync(filePath) && !force) return;
  if (fs.existsSync(filePath) && force) fs.unlinkSync(filePath);

  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE transactions (
      transaction_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      account_number TEXT,
      amount_inr REAL NOT NULL,
      transaction_type TEXT NOT NULL,
      counterparty_name TEXT,
      counterparty_account TEXT,
      timestamp TEXT NOT NULL,
      reference_note TEXT
    );

    CREATE TABLE accounts (
      account_id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      branch TEXT,
      holder_company TEXT NOT NULL,
      account_status TEXT
    );

    CREATE TABLE company_references (
      reference_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      tax_reference TEXT,
      credit_rating TEXT,
      risk_tier TEXT
    );

    CREATE TABLE payment_records (
      payment_id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      invoice_number TEXT,
      payment_mode TEXT,
      settlement_status TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
    );
  `);

  const insertTx = db.prepare(`
    INSERT INTO transactions (transaction_id, company_name, account_number, amount_inr, transaction_type, counterparty_name, counterparty_account, timestamp, reference_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTx.run('T991', 'ABC Logistics Pvt Ltd', 'HDFC00012345678', 1450000, 'WIRE_TRANSFER', 'Apex Semiconductor India', 'ICIC00098765432', '2026-08-28T16:20:00Z', 'Advance freight payment for consignment S1001');
  insertTx.run('T992', 'Vanguard Express Logistics India Limited', 'SBIN00045678901', 820000, 'NEFT', 'TechFreight Logistics', 'AXIS00054321098', '2026-08-28T11:45:00Z', 'Fleet maintenance settlement invoice 4402');
  insertTx.run('T993', 'Deccan Freight Lines Private Limited', 'KKBK00034567890', 2300000, 'RTGS', 'Southern Mineral Transporters', 'HDFC00076543210', '2026-08-29T10:10:00Z', 'Haulage payment phase 2 agreement');

  const insertAccount = db.prepare(`
    INSERT INTO accounts (account_id, account_number, bank_name, branch, holder_company, account_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAccount.run('ACC-01', 'HDFC00012345678', 'HDFC Bank', 'Koramangala Bangalore', 'ABC Logistics Pvt Ltd', 'ACTIVE');
  insertAccount.run('ACC-02', 'SBIN00045678901', 'State Bank of India', 'Peenya Bangalore', 'Vanguard Express Logistics India Limited', 'ACTIVE');
  insertAccount.run('ACC-03', 'KKBK00034567890', 'Kotak Mahindra Bank', 'Hosur Industrial Area', 'Deccan Freight Lines Private Limited', 'ACTIVE');

  const insertRef = db.prepare(`
    INSERT INTO company_references (reference_id, company_name, tax_reference, credit_rating, risk_tier)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertRef.run('REF-01', 'ABC Logistics Pvt Ltd', '29AAACA1234X123', 'AA-', 'LOW');
  insertRef.run('REF-02', 'Vanguard Express Logistics India Limited', '29AABCV5678Y123', 'A+', 'LOW');

  const insertPayment = db.prepare(`
    INSERT INTO payment_records (payment_id, transaction_id, invoice_number, payment_mode, settlement_status)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertPayment.run('PAY-01', 'T991', 'INV-2026-8801', 'ONLINE_RTGS', 'COMPLETED');
  insertPayment.run('PAY-02', 'T992', 'INV-2026-4402', 'ONLINE_NEFT', 'COMPLETED');

  db.close();
}
