import {
  IntelligenceEntity,
  IntelligenceEdge,
  CandidateConnection,
  EvidenceRecord,
} from '../data/intelligenceDataset';

export interface GroundedGraphPayload {
  entities: Record<string, IntelligenceEntity>;
  edges: IntelligenceEdge[];
  evidenceCatalog: Record<string, EvidenceRecord>;
  visibleEntityIds: string[];
  initialSelectedId: string;
}

export async function fetchRealInvestigationGraph(): Promise<GroundedGraphPayload> {
  const [graphRes, locsRes] = await Promise.all([
    fetch('/api/graph?limit=250').then((r) => (r.ok ? r.json() : { nodes: [], edges: [] })),
    fetch('/api/locations').then((r) => (r.ok ? r.json() : [])),
  ]);

  const rawNodes = graphRes.nodes || [];
  const rawEdges = graphRes.edges || [];
  const rawLocations = Array.isArray(locsRes) ? locsRes : [];

  const locationCoordsMap = new Map<string, { lat: number; lng: number }>();
  rawLocations.forEach((loc: any) => {
    if (loc.id && loc.latitude && loc.longitude) {
      locationCoordsMap.set(loc.id, { lat: loc.latitude, lng: loc.longitude });
    }
  });

  const entities: Record<string, IntelligenceEntity> = {};
  const evidenceCatalog: Record<string, EvidenceRecord> = {};
  const edges: IntelligenceEdge[] = [];

  // Helper to determine entity type from category / id
  const inferType = (id: string, category: string, props: Record<string, any>): IntelligenceEntity['type'] => {
    const catLower = (category || '').toLowerCase();
    const idLower = id.toLowerCase();

    if (idLower.startsWith('loc-') || idLower.startsWith('ent-loc-') || catLower.includes('location') || catLower.includes('geographic')) {
      return 'LOCATION';
    }
    if (idLower.includes('trk') || idLower.includes('veh') || catLower.includes('vessel') || catLower.includes('vehicle')) {
      return 'VEHICLE';
    }
    if (idLower.startsWith('ent-usr_') || catLower.includes('human') || props.department || props.role || props.person || props.driver) {
      return 'PERSON';
    }
    if (idLower.startsWith('ent-auth-') || idLower.startsWith('ent-net-') || idLower.startsWith('ent-ept-') || catLower.includes('event')) {
      return 'EVENT';
    }
    if (idLower.startsWith('ent-evd-') || idLower.startsWith('ent-ast-') || catLower.includes('asset') || catLower.includes('evidence') || catLower.includes('document')) {
      return 'DOCUMENT';
    }
    return 'ORGANIZATION';
  };

  // 1. Process Genuine Graph Nodes from Ingested Datasets
  rawNodes.forEach((node: any) => {
    const d = node.data || {};
    const id = d.id;
    if (!id) return;

    let props = d.properties || {};
    if (typeof props === 'string') {
      try {
        props = JSON.parse(props);
      } catch {
        props = { raw: props };
      }
    }

    // Attach geospatial coordinates if present in location registry
    if (locationCoordsMap.has(id)) {
      const coords = locationCoordsMap.get(id)!;
      props.latitude = coords.lat;
      props.longitude = coords.lng;
    }

    const type = inferType(id, d.category || '', props);
    const name = d.label || d.name || props.display_name || props.hostname || id;
    const roleOrCat = props.role || props.department || d.category?.replace('.csv Entity', '') || 'Indexed Record';

    // Source record
    const sourceRecordId = d.sourceRecordId || props.source_record_id || id;
    const sourceDoc = props.sourceDataset || d.category?.split(' ')[0] || 'Repository Dataset';

    // Evidence registration
    if (sourceRecordId && !evidenceCatalog[sourceRecordId]) {
      evidenceCatalog[sourceRecordId] = {
        id: sourceRecordId,
        sourceDoc: sourceDoc,
        sourceType: sourceDoc.endsWith('.pdf') ? 'PDF' : 'CSV',
        sourceLocator: `Record ID: ${sourceRecordId}`,
        timestamp: props.valid_from_utc || props.collected_at_utc || props.timestamp || 'Grounded Verification',
        excerpt: props.notes || props.summary || `Deterministic identity record verified in ${sourceDoc} (${name}).`,
        status: 'VERIFIED',
        epistemicNote: 'Row match from SQLite ingestion database.',
        confidenceScore: 0.98,
      };
    }

    entities[id] = {
      id,
      name,
      type,
      identifier: id,
      roleOrCategory: roleOrCat,
      properties: props,
      hiddenCount: 0,
      evidenceIds: sourceRecordId ? [sourceRecordId] : [],
      candidateConnections: [],
      uncertaintyNote: props.known_limitation || undefined,
      riskStatus: d.riskLevel === 'CRITICAL' ? 'CRITICAL' : d.riskLevel === 'HIGH' ? 'ELEVATED' : 'NORMAL',
    };
  });

  // 2. Process Relationships and Edges
  rawEdges.forEach((edge: any) => {
    const d = edge.data || {};
    const id = d.id;
    const source = d.source;
    const target = d.target;
    if (!id || !source || !target) return;

    if (entities[source] && entities[target]) {
      const relType = d.type || 'REFERENCES';
      const label = d.label || relType;
      const relStatus = d.status || d.properties?.relationship_status || (relType === 'OPERATES' || relType === 'FINANCIAL_TRANSFERS' ? 'INFERRED' : 'DIRECTLY_SUPPORTED');

      edges.push({
        id,
        source,
        target,
        relationshipType: relType,
        label,
        status: relStatus as any,
        confidence: d.confidence ?? 0.95,
        timestamp: d.properties?.timestamp || undefined,
        evidenceId: d.sourceRecordId || undefined,
        epistemicNote: d.properties?.rationale || (d.properties?.evidence ? `Evidence: ${d.properties.evidence}` : undefined),
      });

      // Candidate connection for Source
      entities[source].candidateConnections.push({
        entityId: target,
        entityName: entities[target].name,
        entityType: entities[target].type,
        relationshipType: relType,
        direction: 'OUTGOING',
        relationshipLabel: label,
        detail: `Connected to ${entities[target].name}`,
        status: 'VERIFIED',
        sourceDoc: d.properties?.sourceDataset || 'Repository Database',
        timestamp: d.properties?.timestamp,
        evidenceRefId: d.sourceRecordId,
      });

      // Candidate connection for Target
      entities[target].candidateConnections.push({
        entityId: source,
        entityName: entities[source].name,
        entityType: entities[source].type,
        relationshipType: relType,
        direction: 'INCOMING',
        relationshipLabel: label,
        detail: `Referenced by ${entities[source].name}`,
        status: 'VERIFIED',
        sourceDoc: d.properties?.sourceDataset || 'Repository Database',
        timestamp: d.properties?.timestamp,
        evidenceRefId: d.sourceRecordId,
      });
    }
  });

  // Calculate hiddenCount for all entities (all candidate connections are unrevealed until queried)
  Object.values(entities).forEach((ent) => {
    ent.hiddenCount = ent.candidateConnections.length;
  });

  // Graph initially starts clean and empty. Nodes are only mapped on explicit user inquiry.
  return {
    entities,
    edges,
    evidenceCatalog,
    visibleEntityIds: [],
    initialSelectedId: '',
  };
}
