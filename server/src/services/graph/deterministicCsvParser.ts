import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import { ProvenancedTriple } from '../../types/kg.types.js';
import { SchemaMapper } from './schemaMapper.js';

export interface CsvParseResult {
  triples: ProvenancedTriple[];
  stats: {
    totalRows: number;
    triplesGenerated: number;
    detectedProfile: string;
    detectedColumns: string[];
  };
}

export class DeterministicCsvParser {
  /**
   * Generates a stable entity ID from type and key value.
   */
  static makeEntityId(type: string, value: string): string {
    const clean = (value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_');
    const prefix = type.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${prefix}_${clean}`.substring(0, 64);
  }

  /**
   * Safely formats any incoming date or timestamp string into valid ISO 8601 without throwing RangeError.
   */
  static safeIsoDate(val: any, fallback: string): string {
    if (!val) return fallback;
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString();
      const fixed = String(val).replace(/T(\d):/, 'T0$1:');
      const d2 = new Date(fixed);
      if (!isNaN(d2.getTime())) return d2.toISOString();
      return fallback;
    } catch (_) {
      return fallback;
    }
  }

  /**
   * Helper to find a column matching any of the candidate names.
   */
  private static findColumn(columns: string[], candidates: string[]): string | undefined {
    const lowerCandidates = candidates.map((c) => c.toLowerCase().replace(/[-_\s]/g, ''));
    return columns.find((col) => {
      const normalizedCol = col.toLowerCase().replace(/[-_\s]/g, '');
      return lowerCandidates.includes(normalizedCol);
    });
  }

  /**
   * Parse a raw CSV string and extract grounded, provenanced triples deterministically.
   */
  static parse(csvContent: string, fileName: string): CsvParseResult {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
    }) as Record<string, string>[];

    if (!records || records.length === 0) {
      return {
        triples: [],
        stats: {
          totalRows: 0,
          triplesGenerated: 0,
          detectedProfile: 'EMPTY',
          detectedColumns: [],
        },
      };
    }

    const columns = Object.keys(records[0]);
    const triples: ProvenancedTriple[] = [];
    const now = new Date().toISOString();

    // Detect column roles
    const colCaller = this.findColumn(columns, ['caller', 'caller_id', 'caller_number', 'from_number', 'source_phone', 'caller_name']);
    const colCallee = this.findColumn(columns, ['callee', 'callee_id', 'callee_number', 'to_number', 'target_phone', 'callee_name']);

    const colSender = this.findColumn(columns, ['sender', 'from_account', 'remitter', 'originator', 'debtor', 'payer', 'source_company']);
    const colReceiver = this.findColumn(columns, ['receiver', 'to_account', 'beneficiary', 'creditor', 'payee', 'recipient', 'target_company']);
    const colAmount = this.findColumn(columns, ['amount', 'transfer_amount', 'wire_amount', 'sum', 'value']);

    const colVessel = this.findColumn(columns, ['vessel_name', 'vessel', 'ship_name', 'ship', 'craft']);
    const colImo = this.findColumn(columns, ['imo', 'imo_number']);
    const colMmsi = this.findColumn(columns, ['mmsi', 'mmsi_number']);
    const colCaptain = this.findColumn(columns, ['captain', 'master', 'operator', 'skipper']);
    const colPort = this.findColumn(columns, ['port', 'arrival_port', 'departure_port', 'port_name', 'destination', 'origin_port', 'harbor']);
    const colCargo = this.findColumn(columns, ['declared_cargo', 'cargo', 'commodity', 'goods', 'consignment_description']);
    const colShipper = this.findColumn(columns, ['shipper', 'consignor', 'supplier']);
    const colConsignee = this.findColumn(columns, ['consignee', 'importer', 'receiver_company']);

    const colEventType = this.findColumn(columns, ['event_type', 'ais_event', 'incident_type']);
    const colDraught = this.findColumn(columns, ['observed_draught_meters', 'reported_draught_meters', 'draught', 'draft']);
    const colDisplacement = this.findColumn(columns, ['displacement_delta_mt', 'displacement']);
    const colLat = this.findColumn(columns, ['latitude', 'lat']);
    const colLon = this.findColumn(columns, ['longitude', 'lon', 'lng']);

    const colCompany = this.findColumn(columns, ['company_name', 'company', 'organization', 'corporate_name']);
    const colDirector = this.findColumn(columns, ['director_name', 'director', 'managing_director']);
    const colBeneficialOwner = this.findColumn(columns, ['beneficial_owner', 'ultimate_beneficial_owner', 'ubo', 'owner', 'proprietor', 'shareholder']);

    const colDriver = this.findColumn(columns, ['driver_name', 'driver', 'pilot']);
    const colPlate = this.findColumn(columns, ['plate', 'registration_number', 'truck_no', 'vehicle_no']);
    const colPhone = this.findColumn(columns, ['phone', 'contact_phone', 'mobile']);
    const colSite = this.findColumn(columns, ['site_location', 'site', 'location', 'facility', 'gate', 'checkpoint']);
    const colAction = this.findColumn(columns, ['action', 'event', 'status', 'telemetry_action']);
    const colCargoRef = this.findColumn(columns, ['cargo_manifest_ref', 'manifest_ref', 'manifest', 'cargo_ref']);

    const colTimestamp = this.findColumn(columns, ['timestamp', 'datetime', 'date_time', 'call_time', 'transfer_date', 'date', 'observed_at', 'arrival_timestamp', 'declaration_date']);

    // Detect explicit triple columns
    const colSubject = this.findColumn(columns, ['subject', 'source_entity', 'from_entity', 'source']);
    const colPredicate = this.findColumn(columns, ['predicate', 'relationship', 'rel_type', 'relation', 'type']);
    const colObject = this.findColumn(columns, ['object', 'target_entity', 'to_entity', 'target']);

    let detectedProfile = 'GENERIC';

    // 1. Explicit Triple Format
    if (colSubject && colPredicate && colObject) {
      detectedProfile = 'EXPLICIT_TRIPLES';
      records.forEach((row, idx) => {
        const sub = row[colSubject];
        const pred = row[colPredicate];
        const obj = row[colObject];
        if (!sub || !obj || !pred) return;

        const subId = this.makeEntityId('entity', sub);
        const objId = this.makeEntityId('entity', obj);
        const time = this.safeIsoDate(colTimestamp ? row[colTimestamp] : undefined, now);

        triples.push({
          id: '',
          subjectEntityId: subId,
          subjectName: sub,
          subjectType: 'ENTITY',
          predicate: pred,
          objectEntityId: objId,
          objectName: obj,
          objectType: 'ENTITY',
          sourceFile: fileName,
          sourceRow: idx + 1,
          sourceSpan: `Explicit relation from row ${idx + 1}: ${sub} ${pred} ${obj}`,
          extractorModel: 'deterministic_csv_parser',
          extractorVersion: '1.0.0',
          confidence: 1.0,
          status: 'unreviewed',
          observedAt: time,
          properties: row,
          createdAt: now,
        });
      });
    }
    // 2. Call Detail Records Profile
    else if (colCaller && colCallee) {
      detectedProfile = 'TELECOMMUNICATIONS_CDR';
      records.forEach((row, idx) => {
        const caller = row[colCaller];
        const callee = row[colCallee];
        if (!caller || !callee) return;

        const callerId = this.makeEntityId('phone', caller);
        const calleeId = this.makeEntityId('phone', callee);
        const time = this.safeIsoDate(colTimestamp ? row[colTimestamp] : undefined, now);

        triples.push({
          id: '',
          subjectEntityId: callerId,
          subjectName: caller,
          subjectType: 'Phone',
          predicate: 'CALLED',
          objectEntityId: calleeId,
          objectName: callee,
          objectType: 'Phone',
          sourceFile: fileName,
          sourceRow: idx + 1,
          sourceSpan: `Call log record row ${idx + 1}: ${caller} contacted ${callee} at ${time}`,
          extractorModel: 'deterministic_csv_parser',
          extractorVersion: '1.0.0',
          confidence: 1.0,
          status: 'unreviewed',
          observedAt: time,
          properties: row,
          createdAt: now,
        });
      });
    }
    // 3. Financial Wire Transfers Profile
    else if (colSender && colReceiver) {
      detectedProfile = 'FINANCIAL_WIRE_TRANSFERS';
      records.forEach((row, idx) => {
        const sender = row[colSender];
        const receiver = row[colReceiver];
        if (!sender || !receiver) return;

        const senderId = this.makeEntityId('account', sender);
        const receiverId = this.makeEntityId('account', receiver);
        const time = this.safeIsoDate(colTimestamp ? row[colTimestamp] : undefined, now);
        const amountStr = colAmount && row[colAmount] ? ` Amount: ${row[colAmount]}` : '';

        triples.push({
          id: '',
          subjectEntityId: senderId,
          subjectName: sender,
          subjectType: 'Company',
          predicate: 'TRANSFERRED_TO',
          objectEntityId: receiverId,
          objectName: receiver,
          objectType: 'Company',
          sourceFile: fileName,
          sourceRow: idx + 1,
          sourceSpan: `Wire transfer record row ${idx + 1}: ${sender} remitted funds to ${receiver}.${amountStr}`,
          extractorModel: 'deterministic_csv_parser',
          extractorVersion: '1.0.0',
          confidence: 1.0,
          status: 'unreviewed',
          observedAt: time,
          properties: row,
          createdAt: now,
        });
      });
    }
    // 4. Maritime Telemetry & Sensor Events (AIS Blackout, Draught Changes, Vessel Sighting Coordinates)
    else if (colVessel && (colEventType || colDraught || (colLat && colLon && !colPort && !colCargo))) {
      detectedProfile = 'MARITIME_TELEMETRY_EVENTS';
      records.forEach((row, idx) => {
        const vessel = row[colVessel];
        if (!vessel) return;

        const vesselId = colImo && row[colImo]
          ? `vessel_imo_${row[colImo].replace(/\D/g, '')}`
          : this.makeEntityId('vessel', vessel);

        const time = this.safeIsoDate(colTimestamp ? row[colTimestamp] : undefined, now);

        // A. Transponder Event (blackout / reactivation)
        if (colEventType && row[colEventType]) {
          const evType = row[colEventType];
          const evId = this.makeEntityId('event', `${vessel}_${evType}_${idx + 1}`);
          const gapInfo = row['gap_duration_hours'] ? ` (gap: ${row['gap_duration_hours']}h)` : '';
          const latVal = colLat && row[colLat] ? row[colLat] : '?';
          const lonVal = colLon && row[colLon] ? row[colLon] : '?';

          triples.push({
            id: '',
            subjectEntityId: vesselId,
            subjectName: vessel,
            subjectType: 'Vessel',
            predicate: 'INVOLVED_IN',
            objectEntityId: evId,
            objectName: `${evType}${gapInfo}`,
            objectType: 'Observation',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `AIS event row ${idx + 1}: Vessel ${vessel} recorded ${evType} at (${latVal}, ${lonVal})${gapInfo}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: {
              ...row,
              event_type: evType,
              gap_duration_hours: row['gap_duration_hours'] ? Number(row['gap_duration_hours']) : undefined,
              latitude: colLat && row[colLat] ? Number(row[colLat]) : undefined,
              longitude: colLon && row[colLon] ? Number(row[colLon]) : undefined,
            },
            createdAt: now,
          });
        }

        // B. Draught Change & Displacement Observation
        if (colDraught && (row['observed_draught_meters'] || row['reported_draught_meters'] || row[colDraught])) {
          const obsDraught = row['observed_draught_meters'] || row[colDraught];
          const repDraught = row['reported_draught_meters'] || obsDraught;
          const dispDelta = row['displacement_delta_mt'] || '0';
          const obsId = this.makeEntityId('observation', `${vessel}_draught_${idx + 1}`);

          triples.push({
            id: '',
            subjectEntityId: vesselId,
            subjectName: vessel,
            subjectType: 'Vessel',
            predicate: 'RECORDED_AT',
            objectEntityId: obsId,
            objectName: `Draught ${obsDraught}m (+${dispDelta} MT)`,
            objectType: 'Observation',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Draught inspection row ${idx + 1}: Vessel ${vessel} observed draught ${obsDraught}m vs reported ${repDraught}m (delta ${dispDelta} MT)`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: {
              ...row,
              reported_draught_meters: Number(repDraught),
              observed_draught_meters: Number(obsDraught),
              displacement_delta_mt: Number(dispDelta),
            },
            createdAt: now,
          });
        }

        // C. Position Sighting (ais_vessel_positions.csv)
        if (colLat && colLon && row[colLat] && row[colLon] && !colEventType && !colDraught) {
          const lat = row[colLat];
          const lon = row[colLon];
          const locId = this.makeEntityId('location', `coord_${lat}_${lon}`);
          const speed = row['speed_knots'] ? `${row['speed_knots']} kts` : 'stationary';

          triples.push({
            id: '',
            subjectEntityId: vesselId,
            subjectName: vessel,
            subjectType: 'Vessel',
            predicate: 'LOCATED_AT',
            objectEntityId: locId,
            objectName: `Coords (${lat}, ${lon})`,
            objectType: 'Location',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `AIS sighting row ${idx + 1}: Vessel ${vessel} observed at (${lat}, ${lon}) speed ${speed}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: {
              ...row,
              latitude: Number(lat),
              longitude: Number(lon),
              speed_knots: row['speed_knots'] ? Number(row['speed_knots']) : undefined,
            },
            createdAt: now,
          });
        }
      });
    }
    // 5. Shipping / Customs Manifest Profile
    else if (colVessel && (colPort || colCaptain || colCargo || colImo || colShipper || colConsignee)) {
      detectedProfile = 'MARITIME_CUSTOMS_MANIFEST';
      records.forEach((row, idx) => {
        const vessel = row[colVessel];
        if (!vessel) return;

        const vesselId = colImo && row[colImo]
          ? `vessel_imo_${row[colImo].replace(/\D/g, '')}`
          : this.makeEntityId('vessel', vessel);

        const time = this.safeIsoDate(colTimestamp ? row[colTimestamp] : undefined, now);

        // Captain/Master operates Vessel
        if (colCaptain && row[colCaptain]) {
          const captainName = row[colCaptain];
          const captainId = this.makeEntityId('person', captainName);
          triples.push({
            id: '',
            subjectEntityId: captainId,
            subjectName: captainName,
            subjectType: 'Person',
            predicate: 'OPERATES',
            objectEntityId: vesselId,
            objectName: vessel,
            objectType: 'Vessel',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Manifest row ${idx + 1}: Captain ${captainName} operates vessel ${vessel}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: { imo: colImo ? row[colImo] : undefined, mmsi: colMmsi ? row[colMmsi] : undefined },
            createdAt: now,
          });
        }

        // Vessel destined for / located at Port
        if (colPort && row[colPort]) {
          const portName = row[colPort];
          const portId = this.makeEntityId('location', portName);
          triples.push({
            id: '',
            subjectEntityId: vesselId,
            subjectName: vessel,
            subjectType: 'Vessel',
            predicate: 'DESTINED_FOR',
            objectEntityId: portId,
            objectName: portName,
            objectType: 'Location',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Clearance row ${idx + 1}: Vessel ${vessel} route to ${portName}${row['declared_delay_hours'] ? ` (delay: ${row['declared_delay_hours']}h)` : ''}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // Vessel carrying Cargo
        if (colCargo && row[colCargo]) {
          const cargoName = row[colCargo];
          const cargoId = this.makeEntityId('shipment', `${vessel}_${cargoName}`);
          triples.push({
            id: '',
            subjectEntityId: vesselId,
            subjectName: vessel,
            subjectType: 'Vessel',
            predicate: 'CONTAINS',
            objectEntityId: cargoId,
            objectName: cargoName,
            objectType: 'Shipment',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Customs declaration row ${idx + 1}: Vessel ${vessel} declared carrying ${cargoName}${row['cargo_weight_mt'] ? ` (${row['cargo_weight_mt']} MT)` : ''}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // Shipper consigning cargo
        if (colShipper && row[colShipper]) {
          const shipperName = row[colShipper];
          const shipperId = this.makeEntityId('company', shipperName);
          triples.push({
            id: '',
            subjectEntityId: shipperId,
            subjectName: shipperName,
            subjectType: 'Company',
            predicate: 'SHIPPED_BY',
            objectEntityId: vesselId,
            objectName: vessel,
            objectType: 'Vessel',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Customs declaration row ${idx + 1}: Shipper ${shipperName} chartered vessel ${vessel}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // Consignee receiving cargo
        if (colConsignee && row[colConsignee]) {
          const consigneeName = row[colConsignee];
          const consigneeId = this.makeEntityId('company', consigneeName);
          triples.push({
            id: '',
            subjectEntityId: vesselId,
            subjectName: vessel,
            subjectType: 'Vessel',
            predicate: 'CONSIGNED_TO',
            objectEntityId: consigneeId,
            objectName: consigneeName,
            objectType: 'Company',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Customs declaration row ${idx + 1}: Vessel ${vessel} consignee is ${consigneeName}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }
      });
    }
    // 6. Corporate Registry Profile
    else if (colCompany && (colDirector || colBeneficialOwner)) {
      detectedProfile = 'CORPORATE_REGISTRY';
      records.forEach((row, idx) => {
        const company = row[colCompany];
        if (!company) return;

        const compId = this.makeEntityId('company', company);
        const time = this.safeIsoDate(colTimestamp ? row[colTimestamp] : undefined, now);

        // Director
        if (colDirector && row[colDirector]) {
          const director = row[colDirector];
          const dirId = this.makeEntityId('person', director);
          triples.push({
            id: '',
            subjectEntityId: dirId,
            subjectName: director,
            subjectType: 'Person',
            predicate: 'OWNS',
            objectEntityId: compId,
            objectName: company,
            objectType: 'Company',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Corporate register row ${idx + 1}: ${director} registered as director of ${company}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // Beneficial Owner (if distinct from director)
        if (colBeneficialOwner && row[colBeneficialOwner] && (!colDirector || row[colBeneficialOwner] !== row[colDirector])) {
          const bo = row[colBeneficialOwner];
          const boId = this.makeEntityId('person', bo);
          triples.push({
            id: '',
            subjectEntityId: boId,
            subjectName: bo,
            subjectType: 'Person',
            predicate: 'OWNS',
            objectEntityId: compId,
            objectName: company,
            objectType: 'Company',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Corporate register row ${idx + 1}: ${bo} registered as ultimate beneficial owner of ${company}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // Generic extraction of vessel operations from shareholder/entity notes
        // e.g. "registered operator of [vessel type] <Vessel Name>"
        const notes = row['shareholder_notes'] || row['notes'] || row['description'] || '';
        if (notes) {
          const match = notes.match(/(?:operator|operates|charterer|owner|manager)\s+of\s+(?:(?:feeder|crude|container|bulk|cargo)?\s*(?:tanker|vessel|ship|carrier)\s+)?([A-Z0-9\s\-]{3,30})/i);
          if (match && match[1]) {
            const rawVesselName = match[1].trim();
            const blacklist = ['THE', 'A', 'AN', 'ALL', 'ANY', 'AND', 'OR', 'NOT', 'ITS'];
            if (!blacklist.includes(rawVesselName.toUpperCase()) && rawVesselName.length >= 3) {
              const vesselId = this.makeEntityId('vessel', rawVesselName);
              triples.push({
                id: '',
                subjectEntityId: compId,
                subjectName: company,
                subjectType: 'Company',
                predicate: 'OPERATES',
                objectEntityId: vesselId,
                objectName: rawVesselName,
                objectType: 'Vessel',
                sourceFile: fileName,
                sourceRow: idx + 1,
                sourceSpan: `Corporate notes row ${idx + 1}: ${company} noted as operator/owner of vessel ${rawVesselName}`,
                extractorModel: 'deterministic_csv_parser',
                extractorVersion: '1.0.0',
                confidence: 0.85,
                status: 'unreviewed',
                observedAt: time,
                properties: { notes },
                createdAt: now,
              });
            }
          }
        }
      });
    }
    // 6. Logistics / Fleet Intel (handles sample_logistics_intel.csv)
    else if (colDriver || colPlate || colCompany || colPhone) {
      detectedProfile = 'LOGISTICS_FLEET_INTEL';
      records.forEach((row, idx) => {
        const rowName = row['name'] || row['id'] || `Row_${idx + 1}`;
        const rowType = row['type'] || 'ENTITY';
        const time = this.safeIsoDate(colTimestamp ? row[colTimestamp] : undefined, now);

        // If driver and company present
        if (colDriver && row[colDriver] && colCompany && row[colCompany]) {
          const driver = row[colDriver];
          const comp = row[colCompany];
          const driverId = this.makeEntityId('person', driver);
          const compId = this.makeEntityId('company', comp);

          triples.push({
            id: '',
            subjectEntityId: driverId,
            subjectName: driver,
            subjectType: 'Person',
            predicate: 'WORKS_FOR',
            objectEntityId: compId,
            objectName: comp,
            objectType: 'Company',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Logistics row ${idx + 1}: Driver ${driver} employed by ${comp}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // If plate and company present
        if (colPlate && row[colPlate] && colCompany && row[colCompany]) {
          const plate = row[colPlate];
          const comp = row[colCompany];
          const vehicleId = this.makeEntityId('vehicle', plate);
          const compId = this.makeEntityId('company', comp);

          triples.push({
            id: '',
            subjectEntityId: vehicleId,
            subjectName: plate,
            subjectType: 'Vehicle',
            predicate: 'OPERATES',
            objectEntityId: compId,
            objectName: comp,
            objectType: 'Company',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Logistics row ${idx + 1}: Vehicle ${plate} assigned to fleet of ${comp}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // If phone present with person
        if (colPhone && row[colPhone] && colDriver && row[colDriver]) {
          const phone = row[colPhone];
          const driver = row[colDriver];
          const driverId = this.makeEntityId('person', driver);
          const phoneId = this.makeEntityId('phone', phone);

          triples.push({
            id: '',
            subjectEntityId: driverId,
            subjectName: driver,
            subjectType: 'Person',
            predicate: 'ASSOCIATED_WITH',
            objectEntityId: phoneId,
            objectName: phone,
            objectType: 'Phone',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Logistics contact row ${idx + 1}: Contact phone for ${driver} is ${phone}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }

        // If site location present with vehicle or driver (Telemetry / Checkpoint)
        if (colSite && row[colSite] && (colPlate || colDriver)) {
          const site = row[colSite];
          const siteId = this.makeEntityId('location', site);
          const subjName = (colPlate && row[colPlate]) || (colDriver && row[colDriver]);
          const subjId = colPlate && row[colPlate] ? this.makeEntityId('vehicle', row[colPlate]) : this.makeEntityId('person', row[colDriver]);
          const subType = colPlate && row[colPlate] ? 'Vehicle' : 'Person';
          const act = colAction && row[colAction] ? row[colAction] : 'CHECKPOINT';
          const cargoRef = colCargoRef && row[colCargoRef] ? ` [Cargo: ${row[colCargoRef]}]` : '';

          triples.push({
            id: '',
            subjectEntityId: subjId,
            subjectName: subjName,
            subjectType: subType,
            predicate: 'SIGHTED_AT',
            objectEntityId: siteId,
            objectName: site,
            objectType: 'Location',
            sourceFile: fileName,
            sourceRow: idx + 1,
            sourceSpan: `Telemetry log row ${idx + 1}: ${subjName} recorded at ${site} [${act}]${cargoRef}`,
            extractorModel: 'deterministic_csv_parser',
            extractorVersion: '1.0.0',
            confidence: 1.0,
            status: 'unreviewed',
            observedAt: time,
            properties: row,
            createdAt: now,
          });
        }
      });
    }

    return {
      triples,
      stats: {
        totalRows: records.length,
        triplesGenerated: triples.length,
        detectedProfile,
        detectedColumns: columns,
      },
    };
  }
}
