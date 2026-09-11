import { EntityType, RelationshipType } from '../types/index.js';

export interface NormalizedEntityCandidate {
  candidateKey: string; // e.g. "COMPANY::ABC Logistics"
  name: string;
  type: EntityType;
  label?: string;
  category?: string;
  summary?: string;
  properties: Record<string, any>;
  sourceField?: string;
}

export interface NormalizedRelationshipCandidate {
  sourceCandidateKey: string;
  targetCandidateKey: string;
  type: RelationshipType;
  label: string;
  confidence: number;
  properties?: Record<string, any>;
}

export interface NormalizedRecordResult {
  entities: NormalizedEntityCandidate[];
  relationships: NormalizedRelationshipCandidate[];
}

export class NormalizationService {
  /**
   * Normalize a source database table row into canonical entity candidates and semantic relationships.
   * STRICT RULE: Never create relationships from simple co-occurrence. Every relationship must reflect a semantic link.
   */
  static normalize(
    sourceDbId: string,
    tableName: string,
    row: Record<string, any>,
    lookupContext?: { companiesMap?: Record<string, string> }
  ): NormalizedRecordResult {
    const entities: NormalizedEntityCandidate[] = [];
    const relationships: NormalizedRelationshipCandidate[] = [];

    switch (sourceDbId) {
      case 'LOGISTICS_DB':
        this.normalizeLogistics(tableName, row, entities, relationships);
        break;

      case 'COMPANY_REGISTRY_DB':
        this.normalizeCompanyRegistry(tableName, row, entities, relationships, lookupContext);
        break;

      case 'FACILITIES_DB':
        this.normalizeFacilities(tableName, row, entities, relationships);
        break;

      case 'TRANSACTIONS_DB':
        this.normalizeTransactions(tableName, row, entities, relationships);
        break;

      default:
        // Generic fallback for custom sources
        this.normalizeGeneric(tableName, row, entities, relationships);
        break;
    }

    return { entities, relationships };
  }

  private static normalizeLogistics(
    tableName: string,
    r: Record<string, any>,
    entities: NormalizedEntityCandidate[],
    relationships: NormalizedRelationshipCandidate[]
  ) {
    if (tableName === 'shipments') {
      const shpKey = `SHIPMENT::${r.shipment_id}`;
      const vehKey = `VEHICLE::${r.vehicle_number}`;
      const compKey = `COMPANY::${r.company_name}`;

      entities.push({
        candidateKey: shpKey,
        name: r.shipment_id,
        type: 'SHIPMENT',
        label: `Shipment ${r.shipment_id}`,
        category: 'Cargo Consignment',
        summary: `Shipment ${r.shipment_id} (${r.cargo_description || 'General'}) from ${r.origin_city} to ${r.destination_city}`,
        properties: {
          shipmentId: r.shipment_id,
          originCity: r.origin_city,
          destinationCity: r.destination_city,
          commodity: r.cargo_description,
          declaredValueINR: r.declared_value,
          status: r.status,
          createdDate: r.created_date,
        },
        sourceField: 'shipment_id',
      });

      if (r.vehicle_number) {
        entities.push({
          candidateKey: vehKey,
          name: r.vehicle_number,
          type: 'VEHICLE',
          label: `Vehicle ${r.vehicle_number}`,
          category: 'Commercial Vehicle',
          properties: { registrationNumber: r.vehicle_number },
          sourceField: 'vehicle_number',
        });

        // Semantic link: Vehicle transports shipment
        relationships.push({
          sourceCandidateKey: vehKey,
          targetCandidateKey: shpKey,
          type: 'CONTAINS',
          label: 'Transports Consignment',
          confidence: 1.0,
          properties: { status: r.status },
        });
      }

      if (r.company_name) {
        entities.push({
          candidateKey: compKey,
          name: r.company_name,
          type: 'COMPANY',
          label: r.company_name,
          category: 'Logistics Partner',
          properties: { name: r.company_name },
          sourceField: 'company_name',
        });

        // Semantic link: Company shipped consignment
        relationships.push({
          sourceCandidateKey: compKey,
          targetCandidateKey: shpKey,
          type: 'SHIPPED_BY',
          label: 'Carrier / Shipper',
          confidence: 1.0,
        });

        if (r.vehicle_number) {
          // Semantic link: Carrier operates vehicle for this shipment
          relationships.push({
            sourceCandidateKey: compKey,
            targetCandidateKey: vehKey,
            type: 'OPERATES',
            label: 'Assigned Fleet Vehicle',
            confidence: 0.95,
          });
        }
      }
    } else if (tableName === 'vehicles') {
      const vehKey = `VEHICLE::${r.registration_number}`;
      entities.push({
        candidateKey: vehKey,
        name: r.registration_number,
        type: 'VEHICLE',
        label: `Vehicle ${r.registration_number}`,
        category: 'Commercial Fleet',
        summary: `${r.make || ''} ${r.model || ''} [${r.registration_number}] - Status: ${r.status || 'ACTIVE'}`,
        properties: {
          registrationNumber: r.registration_number,
          make: r.make,
          model: r.model,
          status: r.status,
        },
        sourceField: 'registration_number',
      });

      if (r.owner_entity) {
        const compKey = `COMPANY::${r.owner_entity}`;
        entities.push({
          candidateKey: compKey,
          name: r.owner_entity,
          type: 'COMPANY',
          label: r.owner_entity,
          category: 'Fleet Operator',
          properties: { name: r.owner_entity },
          sourceField: 'owner_entity',
        });

        // Semantic: Owner owns vehicle
        relationships.push({
          sourceCandidateKey: compKey,
          targetCandidateKey: vehKey,
          type: 'OWNS',
          label: 'Fleet Ownership',
          confidence: 1.0,
        });
      }

      if (r.assigned_driver) {
        const drvKey = `PERSON::${r.assigned_driver}`;
        entities.push({
          candidateKey: drvKey,
          name: r.assigned_driver,
          type: 'PERSON',
          label: `Driver ${r.assigned_driver}`,
          category: 'Commercial Driver',
          properties: { name: r.assigned_driver },
          sourceField: 'assigned_driver',
        });

        // Semantic: Driver operates vehicle
        relationships.push({
          sourceCandidateKey: drvKey,
          targetCandidateKey: vehKey,
          type: 'OPERATES',
          label: 'Designated Driver',
          confidence: 1.0,
        });
      }
    } else if (tableName === 'drivers') {
      const drvKey = `PERSON::${r.driver_name}`;
      entities.push({
        candidateKey: drvKey,
        name: r.driver_name,
        type: 'PERSON',
        label: `Driver ${r.driver_name}`,
        category: 'Commercial Driver',
        summary: `Driver ${r.driver_name} (DL: ${r.license_number || 'N/A'})`,
        properties: {
          name: r.driver_name,
          driverLicense: r.license_number,
          contactPhone: r.phone_number,
        },
        sourceField: 'driver_name',
      });

      if (r.assigned_vehicle) {
        const vehKey = `VEHICLE::${r.assigned_vehicle}`;
        entities.push({
          candidateKey: vehKey,
          name: r.assigned_vehicle,
          type: 'VEHICLE',
          label: `Vehicle ${r.assigned_vehicle}`,
          category: 'Commercial Fleet',
          properties: { registrationNumber: r.assigned_vehicle },
          sourceField: 'assigned_vehicle',
        });

        relationships.push({
          sourceCandidateKey: drvKey,
          targetCandidateKey: vehKey,
          type: 'OPERATES',
          label: 'Primary Driver Assignment',
          confidence: 1.0,
        });
      }
    } else if (tableName === 'routes') {
      const rtKey = `ROUTE::${r.route_code}`;
      entities.push({
        candidateKey: rtKey,
        name: r.route_code,
        type: 'ROUTE',
        label: `Route ${r.route_code}`,
        category: 'Transit Corridor',
        summary: `Transit route from ${r.origin} to ${r.destination} (${r.distance_km || 0} km)`,
        properties: {
          routeCode: r.route_code,
          origin: r.origin,
          destination: r.destination,
          distanceKm: r.distance_km,
        },
        sourceField: 'route_code',
      });

      if (r.primary_carrier) {
        const compKey = `COMPANY::${r.primary_carrier}`;
        entities.push({
          candidateKey: compKey,
          name: r.primary_carrier,
          type: 'COMPANY',
          label: r.primary_carrier,
          category: 'Logistics Partner',
          properties: { name: r.primary_carrier },
          sourceField: 'primary_carrier',
        });

        relationships.push({
          sourceCandidateKey: compKey,
          targetCandidateKey: rtKey,
          type: 'TRAVELS_ALONG',
          label: 'Operates Transit Route',
          confidence: 1.0,
        });
      }
    }
  }

  private static normalizeCompanyRegistry(
    tableName: string,
    r: Record<string, any>,
    entities: NormalizedEntityCandidate[],
    relationships: NormalizedRelationshipCandidate[],
    lookupContext?: { companiesMap?: Record<string, string> }
  ) {
    if (tableName === 'companies') {
      const compKey = `COMPANY::${r.company_name}`;
      entities.push({
        candidateKey: compKey,
        name: r.company_name,
        type: 'COMPANY',
        label: r.company_name,
        category: 'Registered Corporation',
        summary: `${r.company_name} (CIN: ${r.cin || 'N/A'}, GSTIN: ${r.gstin || 'N/A'}) - Incorporated ${r.incorporation_date || 'N/A'}`,
        properties: {
          name: r.company_name,
          cin: r.cin,
          gstin: r.gstin,
          registeredAddress: r.registered_address,
          incorporationDate: r.incorporation_date,
          status: r.status,
        },
        sourceField: 'company_name',
      });
    } else if (tableName === 'directors') {
      const dirKey = `PERSON::${r.full_name}`;
      entities.push({
        candidateKey: dirKey,
        name: r.full_name,
        type: 'PERSON',
        label: r.full_name,
        category: 'Corporate Director',
        summary: `${r.full_name} (${r.designation || 'Director'}, DIN: ${r.din || 'N/A'})`,
        properties: {
          name: r.full_name,
          din: r.din,
          designation: r.designation,
          appointedDate: r.appointed_date,
        },
        sourceField: 'full_name',
      });

      const companyName = lookupContext?.companiesMap?.[r.company_id];
      if (companyName) {
        const compKey = `COMPANY::${companyName}`;
        entities.push({
          candidateKey: compKey,
          name: companyName,
          type: 'COMPANY',
          properties: { name: companyName },
        });

        // Semantic link: Director works for / directs company
        relationships.push({
          sourceCandidateKey: dirKey,
          targetCandidateKey: compKey,
          type: 'WORKS_FOR',
          label: r.designation || 'Corporate Director',
          confidence: 1.0,
          properties: { din: r.din, designation: r.designation },
        });
      }
    }
  }

  private static normalizeFacilities(
    tableName: string,
    r: Record<string, any>,
    entities: NormalizedEntityCandidate[],
    relationships: NormalizedRelationshipCandidate[]
  ) {
    if (tableName === 'warehouses') {
      const whKey = `WAREHOUSE::${r.warehouse_code}`;
      entities.push({
        candidateKey: whKey,
        name: r.warehouse_code,
        type: 'WAREHOUSE',
        label: r.facility_name || r.warehouse_code,
        category: 'Logistics Facility',
        summary: `${r.facility_name} (${r.facility_type || 'Warehouse'}) located at ${r.address || ''}, ${r.city}`,
        properties: {
          warehouseCode: r.warehouse_code,
          facilityName: r.facility_name,
          facilityType: r.facility_type,
          address: r.address,
          city: r.city,
          state: r.state,
          capacitySqft: r.capacity_sqft,
        },
        sourceField: 'warehouse_code',
      });
    } else if (tableName === 'location_events') {
      const vehKey = `VEHICLE::${r.vehicle_registration}`;
      entities.push({
        candidateKey: vehKey,
        name: r.vehicle_registration,
        type: 'VEHICLE',
        label: `Vehicle ${r.vehicle_registration}`,
        category: 'Commercial Fleet',
        properties: { registrationNumber: r.vehicle_registration },
        sourceField: 'vehicle_registration',
      });

      if (r.warehouse_code) {
        const whKey = `WAREHOUSE::${r.warehouse_code}`;
        entities.push({
          candidateKey: whKey,
          name: r.warehouse_code,
          type: 'WAREHOUSE',
          properties: { warehouseCode: r.warehouse_code },
          sourceField: 'warehouse_code',
        });

        // Semantic link: Vehicle recorded at warehouse facility
        relationships.push({
          sourceCandidateKey: vehKey,
          targetCandidateKey: whKey,
          type: 'ASSOCIATED_WITH',
          label: r.event_type === 'GATE_ENTRY' ? 'Entered Facility' : 'Staged / Departed Facility',
          confidence: 1.0,
          properties: {
            eventType: r.event_type,
            timestamp: r.timestamp,
            details: r.details,
          },
        });
      }
    }
  }

  private static normalizeTransactions(
    tableName: string,
    r: Record<string, any>,
    entities: NormalizedEntityCandidate[],
    relationships: NormalizedRelationshipCandidate[]
  ) {
    if (tableName === 'transactions') {
      const txKey = `TRANSACTION::${r.transaction_id}`;
      const compKey = `COMPANY::${r.company_name}`;

      entities.push({
        candidateKey: txKey,
        name: r.transaction_id,
        type: 'TRANSACTION',
        label: `Transaction ${r.transaction_id}`,
        category: 'Financial Wire',
        summary: `${r.transaction_type} of ₹${Number(r.amount_inr || 0).toLocaleString('en-IN')} by ${r.company_name} to ${r.counterparty_name || 'Counterparty'}`,
        properties: {
          transactionId: r.transaction_id,
          amountINR: r.amount_inr,
          transactionType: r.transaction_type,
          counterpartyName: r.counterparty_name,
          accountNumber: r.account_number,
          timestamp: r.timestamp,
          referenceNote: r.reference_note,
        },
        sourceField: 'transaction_id',
      });

      if (r.company_name) {
        entities.push({
          candidateKey: compKey,
          name: r.company_name,
          type: 'COMPANY',
          label: r.company_name,
          category: 'Transacting Entity',
          properties: { name: r.company_name },
          sourceField: 'company_name',
        });

        // Semantic link: Company involved in transaction
        relationships.push({
          sourceCandidateKey: compKey,
          targetCandidateKey: txKey,
          type: 'INVOLVED_IN',
          label: 'Transaction Originator',
          confidence: 1.0,
          properties: { amountINR: r.amount_inr, timestamp: r.timestamp },
        });
      }
    }
  }

  private static normalizeGeneric(
    tableName: string,
    r: Record<string, any>,
    entities: NormalizedEntityCandidate[],
    relationships: NormalizedRelationshipCandidate[]
  ) {
    // Basic fallback for generic tables
    const nameVal = r.name || r.title || r.id || r.code;
    if (nameVal) {
      entities.push({
        candidateKey: `GENERIC::${nameVal}`,
        name: String(nameVal),
        type: 'EVENT',
        properties: { ...r },
      });
    }
  }
}
