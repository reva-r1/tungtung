# Source Datasets Schema & Data Dictionary
## Experiment: Blind Intelligence Discovery v1
**Domain**: Municipal Public Infrastructure & Civil Works Authority ("Metro North Civil Works")  
**PRNG Seed**: `0xREVANA2026` (mulberry32 deterministic generation)  
**Total Records**: ~410 records across 6 heterogeneous sources

---

### 1. `01_vendor_corporate_registry.csv`
- **Description**: Official corporate registrar records for registered municipal vendors, general contractors, and suppliers.
- **Revana Parser Profile**: `CORPORATE_REGISTRY`
- **Fields**:
  - `company_name` (string): Legal registered entity name.
  - `director_name` (string): Registered executive director.
  - `beneficial_owner` (string): Registered ultimate beneficial owner (UBO) or parent entity.
  - `registration_number` (string): Corporate business registry code (e.g. `REG-1049-T`, `TAX-11894`).
  - `contact_phone` (string): Corporate head office contact number.
  - `registered_address` (string): Physical headquarters address.
  - `shareholder_notes` (string): Unstructured corporate registry filing annotations and disclosures.
  - `formation_date` (ISO date): Date of corporate incorporation.

---

### 2. `02_municipal_procurement_contracts.csv`
- **Description**: Public procurement award records, tenders, subcontracts, and statutory permits.
- **Revana Parser Profile**: `MARITIME_CUSTOMS_MANIFEST` / Manifest & Permitting
- **Fields**:
  - `contract_id` (string): Unique municipal contract or permit tracking number (e.g. `CTR-2026-881`, `GEO-PERMIT-401`).
  - `project_name` (string): Capital works project title.
  - `vessel` (string): Mapped project site asset or tunnel boring structure (e.g. `North Tunnel Berth 4`, `Pier 9 Subway Extension`).
  - `port` (string): Municipal sector or geographical zone (e.g. `Metro North Sector 4`).
  - `shipper` (string): Primary contractor, awardee, or authorized issuer.
  - `consignee` (string): Sponsoring municipal agency or supervising directorate.
  - `declared_cargo` (string): Scope of work, consignment specification, or statutory permit classification.
  - `award_amount` (number): Monetary valuation in USD.
  - `declaration_date` (ISO 8601): Contract execution timestamp.
  - `contract_status` (string): Status flag (`AWARDED`, `APPROVED`, `ISSUED`, `ACTIVE`, `COMPLETED`).
  - `reviewer_name` (string): Designee or evaluation committee member.
  - `notes` (string): Narrative procurement observations.

---

### 3. `03_escrow_financial_wire_transfers.csv`
- **Description**: Inter-bank wire transfers, progress escrow disbursements, and accounts payable settlements.
- **Revana Parser Profile**: `FINANCIAL_WIRE_TRANSFERS`
- **Fields**:
  - `wire_reference` (string): Fedwire/SWIFT transaction reference (e.g. `WIRE-TX-9014`).
  - `sender` (string): Originating account holder or issuing corporation.
  - `receiver` (string): Beneficiary entity or personal payee.
  - `amount` (number): Cleared transfer amount in USD.
  - `transfer_date` (ISO 8601): Bank execution timestamp.
  - `bank_routing` (string): Routing identifier.
  - `purpose_memo` (string): Remittance advice or ledger memo.

---

### 4. `04_site_access_fleet_telemetry.csv`
- **Description**: RFID gate sensors, weighbridge scans, and GPS vehicle transponder checkpoints.
- **Revana Parser Profile**: `LOGISTICS_FLEET_INTEL`
- **Fields**:
  - `gate_log_id` (string): RFID scanner transaction ID (e.g. `GATE-LOG-1008`).
  - `timestamp` (ISO 8601): Checkpoint crossing time.
  - `driver_name` (string): Operator / haulage driver name.
  - `plate` (string): Vehicle license plate identifier (e.g. `TRK-410`, `CRN-200`).
  - `company_name` (string): Carrier or employer company.
  - `site_location` (string): Facility or access gate point.
  - `action` (string): Operational telemetry action (`CONCRETE_POUR_DISCHARGE`, `CARGO_UNLOAD`, `CRANE_MOBILIZATION`, `DEPARTURE`, `ARRIVAL`, `GATE_ENTRY`).
  - `cargo_manifest_ref` (string): Cross-referenced cargo or work order tag.
  - `draught_weight_mt` (float): Gross weighbridge mass in metric tons.

---

### 5. `05_dispatch_call_logs.csv`
- **Description**: Telecommunications Call Detail Records (CDR) from radio dispatch and project mobile lines.
- **Revana Parser Profile**: `TELECOMMUNICATIONS_CDR`
- **Fields**:
  - `call_id` (string): Carrier switch log ID (e.g. `CDR-4412`).
  - `caller` (string): Initiating party or phone identity.
  - `callee` (string): Receiving party or dispatch endpoint.
  - `call_time` (ISO 8601): Call initiation timestamp.
  - `duration_seconds` (integer): Connected call duration.
  - `call_type` (string): Transmission profile (`VOICE_OUTBOUND`, `VOICE_COMPLETED`, `VOICE_DROPPED`).
  - `cell_tower` (string): Base station transceiver sector.

---

### 6. `06_regulatory_field_inspections.txt`
- **Description**: Unstructured field audit memoranda, safety walkthrough inspections, and municipal compliance reviews.
- **Revana Parser Profile**: `LlmExtractor` (Unstructured text)
- **Format**: Plain text memoranda with headers (`RECORD ID`, `DATE`, `INSPECTOR`, `SUBJECT`, `MEMO DETAILS`).
