import { CanonicalMapping, PredicateRule } from '../../types/kg.types.js';
import { EntityType, RelationshipType, RiskLevel } from '../../types/index.js';

export class SchemaMapper {
  /**
   * Normalizes any extracted or raw string type into Revana's canonical EntityType and metadata.
   */
  static normalizeEntityType(rawType: string): CanonicalMapping {
    const clean = (rawType || '').toLowerCase().trim().replace(/[-_\s]+/g, '_');

    // Person & human roles
    if (['person', 'individual', 'suspect', 'captain', 'crew', 'driver', 'director', 'officer', 'agent'].includes(clean)) {
      return { canonicalType: 'PERSON', category: 'Human Individual', defaultRisk: 'LOW' };
    }

    // Maritime & vessels
    if (['vessel', 'ship', 'boat', 'tanker', 'cargo_ship', 'craft', 'barge', 'trawler', 'bulk_carrier'].includes(clean)) {
      return { canonicalType: 'VEHICLE', category: 'Maritime Vessel', defaultRisk: 'LOW' };
    }

    // Ground & air vehicles
    if (['vehicle', 'truck', 'car', 'lorry', 'van', 'aircraft', 'plane', 'helicopter'].includes(clean)) {
      return { canonicalType: 'VEHICLE', category: 'Transport Vehicle', defaultRisk: 'LOW' };
    }

    // Telecommunications / Devices
    if (['phone', 'phone_number', 'cellphone', 'mobile', 'msisdn', 'imei', 'sim'].includes(clean)) {
      return { canonicalType: 'ENTITY', category: 'Telecommunications', defaultRisk: 'LOW' };
    }

    // Financial Accounts
    if (['bank_account', 'account', 'iban', 'wallet', 'crypto_wallet', 'credit_card'].includes(clean)) {
      return { canonicalType: 'TRANSACTION', category: 'Financial Account', defaultRisk: 'LOW' };
    }

    // Organizations & Corporates
    if (['company', 'organization', 'org', 'firm', 'agency', 'corp', 'enterprise', 'consortium'].includes(clean)) {
      return { canonicalType: 'COMPANY', category: 'Corporate Entity', defaultRisk: 'LOW' };
    }

    // Warehouses & Logistics facilities
    if (['warehouse', 'depot', 'storage', 'facility', 'silo', 'godown'].includes(clean)) {
      return { canonicalType: 'WAREHOUSE', category: 'Storage Facility', defaultRisk: 'LOW' };
    }

    // Locations & Geopolitical sites
    if (['location', 'port', 'harbor', 'city', 'dock', 'terminal', 'airport', 'berth', 'anchorage', 'checkpoint'].includes(clean)) {
      return { canonicalType: 'LOCATION', category: 'Geographic Location', defaultRisk: 'LOW' };
    }

    // Cargo & Shipments
    if (['shipment', 'cargo', 'container', 'consignment', 'goods', 'package'].includes(clean)) {
      return { canonicalType: 'SHIPMENT', category: 'Freight Consignment', defaultRisk: 'LOW' };
    }

    // Events & Sightings
    if (['event', 'incident', 'sighting', 'meeting', 'handover', 'inspection'].includes(clean)) {
      return { canonicalType: 'EVENT', category: 'Operational Event', defaultRisk: 'LOW' };
    }

    return { canonicalType: 'ENTITY', category: 'General Entity', defaultRisk: 'LOW' };
  }

  /**
   * Normalizes incoming raw predicate strings to canonical RelationshipType and clean UI labels.
   */
  static normalizePredicate(rawPredicate: string): { canonicalPredicate: RelationshipType; label: string } {
    const clean = (rawPredicate || '').toUpperCase().trim().replace(/[-\s]+/g, '_');

    // Communications
    if (['CALLED', 'PHONED', 'COMMUNICATED_WITH', 'SMS_TO', 'CONTACTED', 'DIALED'].includes(clean)) {
      return { canonicalPredicate: 'ASSOCIATED_WITH', label: 'CALLED' };
    }

    // Financial Transfers
    if (['TRANSFERRED_TO', 'PAID', 'SENT_FUNDS', 'WIRED_MONEY', 'TRANSACTED_WITH', 'REMITTED_TO'].includes(clean)) {
      return { canonicalPredicate: 'TRANSACTED_WITH', label: 'TRANSFERRED_TO' };
    }

    // Ownership & Control
    if (['OWNS', 'OWNED_BY', 'PROPRIETOR_OF', 'CONTROLS'].includes(clean)) {
      return { canonicalPredicate: 'OWNS', label: 'OWNS' };
    }

    // Employment & Operations
    if (['WORKS_FOR', 'EMPLOYED_BY', 'REPRESENTS'].includes(clean)) {
      return { canonicalPredicate: 'WORKS_FOR', label: 'WORKS_FOR' };
    }
    if (['OPERATES', 'CAPTAINS', 'COMMANDS', 'CREWED_BY', 'PILOTS', 'MANAGES'].includes(clean)) {
      return { canonicalPredicate: 'OPERATES', label: 'OPERATES' };
    }

    // Spatial & Sightings
    if (['SIGHTED_AT', 'LOCATED_AT', 'DOCKED_AT', 'ANCHORED_AT', 'BERTHED_AT', 'ARRIVED_AT', 'OBSERVED_AT'].includes(clean)) {
      return { canonicalPredicate: 'LOCATED_AT', label: 'LOCATED_AT' };
    }
    if (['ORIGINATED_FROM', 'DEPARTED_FROM'].includes(clean)) {
      return { canonicalPredicate: 'ORIGINATED_FROM', label: 'ORIGINATED_FROM' };
    }
    if (['DESTINED_FOR', 'BOUND_FOR', 'HEADING_TO'].includes(clean)) {
      return { canonicalPredicate: 'DESTINED_FOR', label: 'DESTINED_FOR' };
    }

    // Containment & Cargo
    if (['CARRIES', 'CONTAINS', 'LOADED_WITH', 'HAULING'].includes(clean)) {
      return { canonicalPredicate: 'CONTAINS', label: 'CONTAINS' };
    }
    if (['SHIPPED_BY', 'TRANSPORTED_BY'].includes(clean)) {
      return { canonicalPredicate: 'SHIPPED_BY', label: 'SHIPPED_BY' };
    }
    if (['CONSIGNED_TO', 'DELIVERED_TO'].includes(clean)) {
      return { canonicalPredicate: 'CONSIGNED_TO', label: 'CONSIGNED_TO' };
    }

    // Associations & Meetings
    if (['MET_WITH', 'CONFERRED_WITH', 'ACCOMPANIED_BY', 'ASSOCIATED_WITH'].includes(clean)) {
      return { canonicalPredicate: 'ASSOCIATED_WITH', label: clean };
    }

    return { canonicalPredicate: 'ASSOCIATED_WITH', label: clean || 'ASSOCIATED_WITH' };
  }

  /**
   * Validates whether an extracted triple is semantically sound and passes text containment validation.
   */
  static validateTriple(params: {
    subjectType: string;
    predicate: string;
    objectType: string;
    objectName: string;
    sourceText?: string;
  }): { valid: boolean; reason?: string } {
    const { subjectType, predicate, objectType, objectName, sourceText } = params;

    const normSub = this.normalizeEntityType(subjectType).canonicalType;
    const normObj = this.normalizeEntityType(objectType).canonicalType;
    const cleanPred = (predicate || '').toUpperCase().trim();

    // 1. Text Grounding Containment Check (if source text available)
    if (sourceText && objectName && objectName.trim().length > 1) {
      const lowerSource = sourceText.toLowerCase();
      const lowerTarget = objectName.toLowerCase().trim();

      // Check if target or any substantive alphanumeric token exists in source text
      const targetTokens = lowerTarget.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 2);
      const isContained = lowerSource.includes(lowerTarget) || targetTokens.some(t => lowerSource.includes(t));

      if (!isContained) {
        return {
          valid: false,
          reason: `Object '${objectName}' does not appear in source text span (grounding failed).`
        };
      }
    }

    // 2. Semantic Plausibility Rules
    if (['CALLED', 'PHONED', 'SMS_TO'].includes(cleanPred)) {
      // CALLED must link Person/Company to Phone/Entity/Person
      if (!['PERSON', 'COMPANY', 'ENTITY'].includes(normSub)) {
        return { valid: false, reason: `Subject of CALLED must be a person or organization, got ${normSub}.` };
      }
    }

    if (['SIGHTED_AT', 'DOCKED_AT', 'LOCATED_AT'].includes(cleanPred)) {
      // SIGHTED_AT object must be a Location, Warehouse, or Port
      if (!['LOCATION', 'WAREHOUSE', 'ENTITY'].includes(normObj)) {
        return { valid: false, reason: `Target of ${cleanPred} must be a spatial location or facility, got ${normObj}.` };
      }
    }

    if (['TRANSFERRED_TO', 'WIRED_MONEY'].includes(cleanPred)) {
      // Money transfers should link Person/Company to Person/Company/Transaction
      if (!['PERSON', 'COMPANY', 'TRANSACTION', 'ENTITY'].includes(normSub) || !['PERSON', 'COMPANY', 'TRANSACTION', 'ENTITY'].includes(normObj)) {
        return { valid: false, reason: `Financial transfer must connect financial or legal entities.` };
      }
    }

    return { valid: true };
  }
}
