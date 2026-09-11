import { db } from '../db/database.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as xlsx from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';
import { EntityType, Dataset } from '../types/index.js';
import { ResolutionService } from './resolution.service.js';
import { NormalizationService } from './normalization.service.js';

export interface IngestionPreview {
  datasetName: string;
  format: string;
  totalRows: number;
  columns: {
    name: string;
    sampleValue: any;
    dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'COORDINATE';
    inferredEntity?: EntityType;
  }[];
  missingValueCount: number;
  duplicateRowCount: number;
  sampleRows: Record<string, any>[];
  allRows?: Record<string, any>[];
}

export class IngestionService {
  /**
   * Inspect and profile raw data before ingestion
   */
  static inspectDataset(fileName: string, buffer: Buffer, format: 'CSV' | 'JSON' | 'EXCEL'): IngestionPreview {
    let rows: Record<string, any>[] = [];

    try {
      if (format === 'CSV') {
        const content = buffer.toString('utf-8');
        if (!content || content.trim() === '') {
          throw new Error('Could not import CSV.\nReason:\nThe file is empty.');
        }
        rows = csvParse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });
      } else if (format === 'JSON') {
        const parsed = JSON.parse(buffer.toString('utf-8'));
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else if (format === 'EXCEL') {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        rows = xlsx.utils.sheet_to_json(sheet);
      }
    } catch (err: any) {
      throw new Error(`Could not import CSV.\nReason:\n${err.message || 'The file could not be parsed.'}`);
    }

    if (!rows || rows.length === 0) {
      throw new Error('Could not import CSV.\nReason:\nNo valid data rows found in the file.');
    }

    const columnNames = Object.keys(rows[0] || {});
    if (columnNames.length === 0) {
      throw new Error('Could not import CSV.\nReason:\nNo header columns detected in the CSV file.');
    }

    let missingValueCount = 0;
    const seenHashes = new Set<string>();
    let duplicateRowCount = 0;

    for (const r of rows) {
      const hash = JSON.stringify(r);
      if (seenHashes.has(hash)) {
        duplicateRowCount++;
      } else {
        seenHashes.add(hash);
      }

      for (const col of columnNames) {
        if (r[col] === null || r[col] === undefined || r[col] === '') {
          missingValueCount++;
        }
      }
    }

    const columns = columnNames.map((col) => {
      const sampleVal = rows.find((r) => r[col] !== null && r[col] !== undefined && r[col] !== '')?.[col];
      let dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'COORDINATE' = 'STRING';

      const lower = col.toLowerCase().trim();

      // Check if COORDINATE
      if (
        lower === 'lat' ||
        lower === 'latitude' ||
        lower === 'lng' ||
        lower === 'lon' ||
        lower === 'longitude' ||
        lower === 'coord' ||
        lower === 'coordinates'
      ) {
        dataType = 'COORDINATE';
      } else {
        // Check values across rows
        const nonNullValues = rows
          .map((r) => r[col])
          .filter((v) => v !== null && v !== undefined && v !== '')
          .slice(0, 20);

        if (nonNullValues.length > 0) {
          const isAllBoolean = nonNullValues.every(
            (v) =>
              typeof v === 'boolean' ||
              String(v).toLowerCase() === 'true' ||
              String(v).toLowerCase() === 'false'
          );
          const isAllNumber = nonNullValues.every((v) => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== ''));
          const isAllDate = nonNullValues.every((v) => {
            const s = String(v).trim();
            return (
              (s.includes('-') || s.includes('/') || s.includes('T')) &&
              !isNaN(Date.parse(s)) &&
              s.length >= 8
            );
          });

          if (isAllBoolean) {
            dataType = 'BOOLEAN';
          } else if (isAllNumber) {
            dataType = 'NUMBER';
          } else if (isAllDate) {
            dataType = 'DATE';
          } else {
            dataType = 'STRING';
          }
        }
      }

      return {
        name: col,
        sampleValue: sampleVal !== undefined ? sampleVal : null,
        dataType,
      };
    });

    return {
      datasetName: fileName,
      format,
      totalRows: rows.length,
      columns,
      missingValueCount,
      duplicateRowCount,
      sampleRows: rows.slice(0, 10),
      allRows: rows,
    };
  }

  /**
   * Ingest inspected rows into the system graph with data provenance & entity resolution
   */
  static commitIngestion(datasetName: string, format: 'CSV' | 'JSON' | 'EXCEL' | 'REST_API', rows: Record<string, any>[]) {
    const datasetId = `DS-${uuidv4().substring(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    // 0. Mark previous datasets inactive and insert new dataset as active
    db.prepare('UPDATE datasets SET is_active = 0').run();

    const columnKeys = Object.keys(rows[0] || {});

    db.prepare(`
      INSERT INTO datasets (id, name, description, format, record_count, entity_count, relationship_count, uploaded_at, status, is_active, detected_schema)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      datasetId,
      datasetName,
      `User imported dataset containing ${rows.length} records.`,
      format,
      rows.length,
      0,
      0,
      now,
      'USER_IMPORTED',
      JSON.stringify({ columns: columnKeys })
    );

    const insertRaw = db.prepare(`
      INSERT INTO raw_records (id, dataset_id, row_index, raw_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertEntity = db.prepare(`
      INSERT OR REPLACE INTO entities (id, name, type, label, category, risk_level, risk_score, summary, properties, tags, aliases, dataset_id, source_dataset_id, source_record_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertLocation = db.prepare(`
      INSERT OR REPLACE INTO locations (id, name, address, city, state, country, latitude, longitude, type, properties)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertRel = db.prepare(`
      INSERT OR IGNORE INTO relationships (id, source_id, target_id, type, label, confidence, properties, risk_level, dataset_id, source_dataset_id, source_record_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let createdEntitiesCount = 0;
    let createdRelationshipsCount = 0;
    const newEntities: { id: string; name: string; type: EntityType; properties: Record<string, any>; rawRecordId: string }[] = [];

    // Helper: Infer entity type from columns and values
    const inferEntityType = (row: Record<string, any>): EntityType => {
      const keysLower = Object.keys(row).map((k) => k.toLowerCase());
      const allText = Object.values(row).join(' ').toLowerCase();

      if (keysLower.some((k) => k.includes('truck') || k.includes('vehicle') || k.includes('plate') || k.includes('reg_no') || k.includes('chassis'))) return 'VEHICLE';
      if (keysLower.some((k) => k.includes('company') || k.includes('org') || k.includes('vendor') || k.includes('carrier') || k.includes('shipper') || k.includes('consignee'))) return 'COMPANY';
      if (keysLower.some((k) => k.includes('driver') || k.includes('employee') || k.includes('customer') || k.includes('person') || k.includes('user') || k.includes('officer') || k.includes('first_name'))) return 'PERSON';
      if (keysLower.some((k) => k.includes('shipment') || k.includes('consignment') || k.includes('waybill') || k.includes('cargo') || k.includes('order'))) return 'SHIPMENT';
      if (keysLower.some((k) => k.includes('warehouse') || k.includes('depot') || k.includes('facility') || k.includes('hub') || k.includes('terminal') || k.includes('port'))) return 'WAREHOUSE';
      if (keysLower.some((k) => k.includes('transaction') || k.includes('payment') || k.includes('invoice') || k.includes('transfer') || k.includes('amount') || k.includes('wire'))) return 'TRANSACTION';
      if (keysLower.some((k) => k.includes('route') || k.includes('corridor') || k.includes('highway') || k.includes('lane'))) return 'ROUTE';
      if (keysLower.some((k) => k.includes('location') || k.includes('city') || k.includes('address') || k.includes('checkpoint'))) return 'LOCATION';

      return 'ENTITY';
    };

    // Helper: Find primary identifier value
    const findPrimaryId = (row: Record<string, any>, idx: number): string => {
      const idKey = Object.keys(row).find((k) => {
        const l = k.toLowerCase().trim();
        return l === 'id' || l === 'entity_id' || l.endsWith('_id') || l === 'code' || l === 'registration' || l === 'plate' || l === 'waybill';
      });
      if (idKey && row[idKey] !== undefined && row[idKey] !== null && String(row[idKey]).trim() !== '') {
        return String(row[idKey]).trim();
      }
      return `ENT-${datasetId.substring(3, 7)}-${idx + 1}`;
    };

    // Helper: Find name
    const findEntityName = (row: Record<string, any>, primaryId: string, idx: number): string => {
      const nameKey = Object.keys(row).find((k) => {
        const l = k.toLowerCase().trim();
        return l === 'name' || l.endsWith('_name') || l === 'title' || l === 'label' || l === 'company' || l === 'customer' || l === 'driver';
      });
      if (nameKey && row[nameKey] !== undefined && row[nameKey] !== null && String(row[nameKey]).trim() !== '') {
        return String(row[nameKey]).trim();
      }
      return `${datasetName.replace(/\.[^/.]+$/, '')} Item #${idx + 1} (${primaryId})`;
    };

    // Execute bulk ingestion in a transaction
    const ingestTransaction = db.transaction((records: Record<string, any>[]) => {
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rawRecordId = `REC-${datasetId}-${i + 1}`;
        insertRaw.run(rawRecordId, datasetId, i + 1, JSON.stringify(row), now);

        const primaryId = findPrimaryId(row, i);
        const name = findEntityName(row, primaryId, i);
        const type = inferEntityType(row);
        const entityId = `ENT-${primaryId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        // Check for coordinates
        const latKey = Object.keys(row).find((k) => {
          const l = k.toLowerCase();
          return l === 'lat' || l === 'latitude' || l === 'lat_deg';
        });
        const lngKey = Object.keys(row).find((k) => {
          const l = k.toLowerCase();
          return l === 'lng' || l === 'lon' || l === 'longitude' || l === 'long_deg';
        });

        if (latKey && lngKey && !isNaN(Number(row[latKey])) && !isNaN(Number(row[lngKey]))) {
          const lat = Number(row[latKey]);
          const lng = Number(row[lngKey]);
          const locId = `LOC-${entityId}`;
          insertLocation.run(
            locId,
            name,
            row.address || row.location || `${name} Location`,
            row.city || 'Regional Area',
            row.state || 'N/A',
            row.country || 'India',
            lat,
            lng,
            type === 'WAREHOUSE' ? 'WAREHOUSE' : 'TRANSIT_POINT',
            JSON.stringify(row)
          );
        }

        // Summary of properties
        const summary = `${type} record from ${datasetName}. ${Object.entries(row).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(', ')}`;

        insertEntity.run(
          entityId,
          name,
          type,
          name,
          `${datasetName} Entity`,
          'LOW',
          10,
          summary,
          JSON.stringify(row),
          JSON.stringify([datasetName, type]),
          JSON.stringify([primaryId]),
          datasetId,
          datasetId,
          rawRecordId,
          now,
          now
        );
        createdEntitiesCount++;

        newEntities.push({
          id: entityId,
          name,
          type,
          properties: row,
          rawRecordId,
        });
      }
    });

    ingestTransaction(rows);

    // Cross-Dataset Relationship Discovery
    // Fetch all existing entities across all datasets
    const allEntities = db.prepare('SELECT id, name, properties, dataset_id FROM entities').all() as any[];
    const parsedEntities = allEntities.map((e) => ({
      id: e.id,
      name: e.name,
      properties: JSON.parse(e.properties || '{}'),
      datasetId: e.dataset_id,
    }));

    // Inverted index of identifier values -> entity IDs
    const valueToEntities = new Map<string, string[]>();

    const linkKeys = new Set([
      'id', 'customer_id', 'client_id', 'company_id', 'vehicle_id', 'driver_id', 'user_id',
      'order_id', 'shipment_id', 'transaction_id', 'invoice_id', 'account_no', 'email',
      'phone', 'contact_phone', 'mobile', 'gstin', 'cin', 'pan', 'registration_number',
      'plate', 'waybill', 'reference', 'ref_id', 'location_id', 'city'
    ]);

    for (const ent of parsedEntities) {
      for (const [k, v] of Object.entries(ent.properties)) {
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          const keyLower = k.toLowerCase().trim();
          const strVal = String(v).trim().toLowerCase();

          // If this key is an identifier or foreign key, or has sufficient entropy
          if (linkKeys.has(keyLower) || keyLower.endsWith('_id') || keyLower.endsWith('_code') || keyLower.endsWith('_no')) {
            if (strVal.length >= 2) {
              const token = `${keyLower}:${strVal}`;
              if (!valueToEntities.has(token)) valueToEntities.set(token, []);
              valueToEntities.get(token)!.push(ent.id);

              // Also index pure normalized value
              if (strVal.length >= 3) {
                const valOnlyToken = `val:${strVal}`;
                if (!valueToEntities.has(valOnlyToken)) valueToEntities.set(valOnlyToken, []);
                valueToEntities.get(valOnlyToken)!.push(ent.id);
              }
            }
          }
        }
      }
    }

    // Now establish cross-dataset relationship edges
    const seenEdges = new Set<string>();

    const relTransaction = db.transaction(() => {
      for (const ent of newEntities) {
        for (const [k, v] of Object.entries(ent.properties)) {
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            const keyLower = k.toLowerCase().trim();
            const strVal = String(v).trim().toLowerCase();

            if (linkKeys.has(keyLower) || keyLower.endsWith('_id') || keyLower.endsWith('_code') || keyLower.endsWith('_no')) {
              const matchedIds = new Set<string>();

              const token1 = `${keyLower}:${strVal}`;
              if (valueToEntities.has(token1)) {
                for (const targetId of valueToEntities.get(token1)!) {
                  matchedIds.add(targetId);
                }
              }

              const token2 = `val:${strVal}`;
              if (valueToEntities.has(token2)) {
                for (const targetId of valueToEntities.get(token2)!) {
                  matchedIds.add(targetId);
                }
              }

              for (const targetId of matchedIds) {
                if (targetId !== ent.id) {
                  const edgeKey1 = `${ent.id}->${targetId}`;
                  const edgeKey2 = `${targetId}->${ent.id}`;

                  if (!seenEdges.has(edgeKey1) && !seenEdges.has(edgeKey2)) {
                    seenEdges.add(edgeKey1);
                    const relId = `REL-${uuidv4().substring(0, 8).toUpperCase()}`;
                    const label = `Cross-Dataset Link: ${k} (${v})`;

                    insertRel.run(
                      relId,
                      ent.id,
                      targetId,
                      'REFERENCES',
                      label,
                      0.95,
                      JSON.stringify({ matchKey: k, matchValue: v, sourceDataset: datasetName }),
                      'LOW',
                      datasetId,
                      datasetId,
                      ent.rawRecordId,
                      now
                    );
                    createdRelationshipsCount++;
                  }
                }
              }
            }
          }
        }
      }
    });

    relTransaction();

    // Update dataset record with accurate counts
    db.prepare('UPDATE datasets SET entity_count = ?, relationship_count = ? WHERE id = ?')
      .run(createdEntitiesCount, createdRelationshipsCount, datasetId);

    return {
      datasetId,
      datasetName,
      recordCount: rows.length,
      entitiesCreated: createdEntitiesCount,
      relationshipsCreated: createdRelationshipsCount,
      mergeCandidatesCreated: 0,
    };
  }

  /**
   * Synchronize and ingest records from an independent source SQLite database into the unified model.
   * Preserves full data provenance, normalizes schemas, and applies deterministic cross-source resolution.
   */
  static ingestFromSourceDatabase(sourceDbId: string) {
    const source = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(sourceDbId) as any;
    if (!source) {
      throw new Error(`Data source "${sourceDbId}" not found in registry.`);
    }

    if (!fs.existsSync(source.db_path)) {
      throw new Error(`Source database file "${source.db_path}" does not exist.`);
    }

    const sdb = new Database(source.db_path, { readonly: true });
    const now = new Date().toISOString();

    let totalExtractedRows = 0;
    let createdEntitiesCount = 0;
    let linkedEntitiesCount = 0;
    let createdRelationshipsCount = 0;
    let mergeCandidatesCount = 0;

    const insertSourceRecord = db.prepare(`
      INSERT OR REPLACE INTO source_records (id, source_db_id, source_table, source_record_id, raw_data, extracted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertEntity = db.prepare(`
      INSERT OR IGNORE INTO entities (id, name, type, label, category, risk_level, risk_score, summary, properties, tags, aliases, source_db_id, source_table, source_record_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateEntityData = db.prepare(`
      UPDATE entities 
      SET properties = ?, aliases = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `);

    const insertRel = db.prepare(`
      INSERT OR IGNORE INTO relationships (id, source_id, target_id, type, label, confidence, properties, risk_level, source_db_id, source_table, source_record_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMergeCandidate = db.prepare(`
      INSERT INTO merge_candidates (id, source_entity_id, target_entity_id, source_name, target_name, type, confidence, match_reasons, status, source_props, target_props, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // In-memory key-to-canonical-entity cache for this ingestion session
    const sessionKeyToEntityId = new Map<string, string>();

    // Helper to resolve or create a canonical entity
    const resolveOrCreateCanonical = (candidate: {
      candidateKey: string;
      name: string;
      type: EntityType;
      label?: string;
      category?: string;
      summary?: string;
      properties: Record<string, any>;
      sourceField?: string;
    }, rawRecordDbId: string, sourceTable: string): string => {
      const cleanName = candidate.name.trim();
      if (!cleanName) return '';

      // Check session cache
      if (sessionKeyToEntityId.has(candidate.candidateKey)) {
        const cachedId = sessionKeyToEntityId.get(candidate.candidateKey)!;
        ResolutionService.linkEntitySource(cachedId, rawRecordDbId, sourceDbId, sourceTable, candidate.sourceField);
        linkedEntitiesCount++;
        return cachedId;
      }

      // Check database for cross-source matching entity
      const match = ResolutionService.findMatchForCandidate({
        name: cleanName,
        type: candidate.type,
        properties: candidate.properties,
      });

      if (match) {
        // High confidence or exact match -> Reuse existing canonical entity
        if (match.isExactMatch || match.confidence >= 0.85) {
          const matchedId = match.matchedEntity.id;
          const existingProps = match.matchedEntity.properties || {};
          const mergedProps = { ...existingProps, ...candidate.properties };
          const existingAliases = match.matchedEntity.aliases || [];
          const mergedAliases = Array.from(new Set([...existingAliases, cleanName]));
          const existingTags = match.matchedEntity.tags || [];
          const mergedTags = Array.from(new Set([...existingTags, sourceDbId]));

          updateEntityData.run(
            JSON.stringify(mergedProps),
            JSON.stringify(mergedAliases),
            JSON.stringify(mergedTags),
            now,
            matchedId
          );

          ResolutionService.linkEntitySource(matchedId, rawRecordDbId, sourceDbId, sourceTable, candidate.sourceField);
          sessionKeyToEntityId.set(candidate.candidateKey, matchedId);
          linkedEntitiesCount++;
          return matchedId;
        }

        // Suspect / Variant Match -> Create new canonical entity AND generate merge candidate for analyst
        const newId = `ENT-${candidate.type.substring(0, 3)}-${uuidv4().substring(0, 6).toUpperCase()}`;
        insertEntity.run(
          newId,
          cleanName,
          candidate.type,
          candidate.label || cleanName,
          candidate.category || 'Canonical Entity',
          'LOW',
          10,
          candidate.summary || `${candidate.type} record extracted from ${source.name}`,
          JSON.stringify(candidate.properties),
          JSON.stringify(['Imported', sourceDbId]),
          JSON.stringify([]),
          sourceDbId,
          sourceTable,
          rawRecordDbId,
          now,
          now
        );
        createdEntitiesCount++;

        ResolutionService.linkEntitySource(newId, rawRecordDbId, sourceDbId, sourceTable, candidate.sourceField);

        const candidateId = `MERGE-${uuidv4().substring(0, 8).toUpperCase()}`;
        insertMergeCandidate.run(
          candidateId,
          newId,
          match.matchedEntity.id,
          cleanName,
          match.matchedEntity.name,
          candidate.type,
          match.confidence,
          JSON.stringify(match.matchReasons),
          'PENDING',
          JSON.stringify(candidate.properties),
          JSON.stringify(match.matchedEntity.properties),
          now
        );
        mergeCandidatesCount++;

        sessionKeyToEntityId.set(candidate.candidateKey, newId);
        return newId;
      }

      // No match -> Create new canonical entity with data provenance
      const newId = `ENT-${candidate.type.substring(0, 3)}-${uuidv4().substring(0, 6).toUpperCase()}`;
      insertEntity.run(
        newId,
        cleanName,
        candidate.type,
        candidate.label || cleanName,
        candidate.category || 'Canonical Entity',
        'LOW',
        10,
        candidate.summary || `${candidate.type} record extracted from ${source.name}`,
        JSON.stringify(candidate.properties),
        JSON.stringify(['Imported', sourceDbId]),
        JSON.stringify([]),
        sourceDbId,
        sourceTable,
        rawRecordDbId,
        now,
        now
      );
      createdEntitiesCount++;

      ResolutionService.linkEntitySource(newId, rawRecordDbId, sourceDbId, sourceTable, candidate.sourceField);
      sessionKeyToEntityId.set(candidate.candidateKey, newId);
      return newId;
    };

    try {
      const tables = sdb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];

      // Build context if needed (e.g. company_id -> company_name for company registry)
      const lookupContext: { companiesMap?: Record<string, string> } = {};
      if (sourceDbId === 'COMPANY_REGISTRY_DB') {
        const companies = sdb.prepare('SELECT company_id, company_name FROM companies').all() as any[];
        lookupContext.companiesMap = {};
        for (const c of companies) {
          lookupContext.companiesMap[c.company_id] = c.company_name;
        }
      }

      for (const tbl of tables) {
        const tableName = tbl.name;
        const rows = sdb.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, any>[];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          totalExtractedRows++;

          // Determine primary record identifier
          const recordPk = row.shipment_id || row.registration_number || row.company_id || row.director_id ||
            row.registration_id || row.address_id || row.warehouse_code || row.location_id ||
            row.checkpoint_id || row.event_id || row.transaction_id || row.account_id ||
            row.reference_id || row.payment_id || `row_${i + 1}`;

          const rawRecordDbId = `REC-${sourceDbId}-${tableName}-${recordPk}`;

          // 1. Store Raw Record for Verified Provenance
          insertSourceRecord.run(
            rawRecordDbId,
            sourceDbId,
            tableName,
            String(recordPk),
            JSON.stringify(row),
            now
          );

          // 2. Normalize schema into Canonical Candidates & Semantic Relationships
          const { entities, relationships } = NormalizationService.normalize(sourceDbId, tableName, row, lookupContext);

          const localCandidateToEntityId = new Map<string, string>();

          // 3. Resolve or Create Canonical Entities with Provenance
          for (const cand of entities) {
            const entId = resolveOrCreateCanonical(cand, rawRecordDbId, tableName);
            if (entId) {
              localCandidateToEntityId.set(cand.candidateKey, entId);
            }
          }

          // 4. Create Semantic Relationships with explicit Source Record Provenance
          for (const rel of relationships) {
            const srcEntId = localCandidateToEntityId.get(rel.sourceCandidateKey) || sessionKeyToEntityId.get(rel.sourceCandidateKey);
            const tgtEntId = localCandidateToEntityId.get(rel.targetCandidateKey) || sessionKeyToEntityId.get(rel.targetCandidateKey);

            if (srcEntId && tgtEntId && srcEntId !== tgtEntId) {
              const relId = `REL-${uuidv4().substring(0, 8).toUpperCase()}`;
              insertRel.run(
                relId,
                srcEntId,
                tgtEntId,
                rel.type,
                rel.label,
                rel.confidence,
                JSON.stringify(rel.properties || {}),
                'LOW',
                sourceDbId,
                tableName,
                rawRecordDbId,
                now
              );
              createdRelationshipsCount++;
            }
          }
        }
      }

      // Update registry sync timestamp & status
      db.prepare(`
        UPDATE data_sources 
        SET status = 'CONNECTED', last_sync = ?, table_count = ?, record_count = ?
        WHERE id = ?
      `).run(now, tables.length, totalExtractedRows, sourceDbId);

      return {
        sourceId: sourceDbId,
        sourceName: source.name,
        extractedRows: totalExtractedRows,
        entitiesCreated: createdEntitiesCount,
        entitiesLinked: linkedEntitiesCount,
        relationshipsCreated: createdRelationshipsCount,
        mergeCandidatesCreated: mergeCandidatesCount,
        syncedAt: now,
      };
    } finally {
      sdb.close();
    }
  }

  /**
   * List all datasets
   */
  static listDatasets(): Dataset[] {
    const list = db.prepare('SELECT * FROM datasets ORDER BY is_active DESC, uploaded_at DESC').all() as any[];
    return list.map((d) => ({
      ...d,
      recordCount: d.record_count,
      entityCount: d.entity_count,
      relationshipCount: d.relationship_count,
      uploadedAt: d.uploaded_at,
      isActive: Boolean(d.is_active),
      detectedSchema: JSON.parse(d.detected_schema || '{}'),
    }));
  }

  static getDataset(id: string): Dataset | null {
    const d = db.prepare('SELECT * FROM datasets WHERE id = ?').get(id) as any;
    if (!d) return null;
    return {
      ...d,
      recordCount: d.record_count,
      entityCount: d.entity_count,
      relationshipCount: d.relationship_count,
      uploadedAt: d.uploaded_at,
      isActive: Boolean(d.is_active),
      detectedSchema: JSON.parse(d.detected_schema || '{}'),
    };
  }

  static getActiveDataset(): Dataset | null {
    let d = db.prepare('SELECT * FROM datasets WHERE is_active = 1 LIMIT 1').get() as any;
    if (!d) {
      d = db.prepare('SELECT * FROM datasets ORDER BY uploaded_at DESC LIMIT 1').get() as any;
    }
    if (!d) return null;
    return {
      ...d,
      recordCount: d.record_count,
      entityCount: d.entity_count,
      relationshipCount: d.relationship_count,
      uploadedAt: d.uploaded_at,
      isActive: true,
      detectedSchema: JSON.parse(d.detected_schema || '{}'),
    };
  }

  static setActiveDataset(id: string): Dataset | null {
    db.prepare('UPDATE datasets SET is_active = 0').run();
    db.prepare('UPDATE datasets SET is_active = 1 WHERE id = ?').run(id);
    return this.getDataset(id);
  }

  static getDatasetRecords(datasetId: string, limit: number = 100, offset: number = 0, search: string = ''): { total: number; columns: string[]; records: any[] } {
    let countQuery = 'SELECT count(*) as count FROM raw_records WHERE dataset_id = ?';
    let dataQuery = 'SELECT id, dataset_id, row_index, raw_data, created_at FROM raw_records WHERE dataset_id = ?';
    const params: any[] = [datasetId];

    if (search && search.trim() !== '') {
      countQuery += ' AND raw_data LIKE ?';
      dataQuery += ' AND raw_data LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    const total = (db.prepare(countQuery).get(...params) as { count: number }).count;

    dataQuery += ' ORDER BY row_index ASC LIMIT ? OFFSET ?';
    const rows = db.prepare(dataQuery).all(...params, limit, offset) as any[];

    let columns: string[] = [];
    const records = rows.map((r) => {
      let parsed: Record<string, any> = {};
      try {
        parsed = JSON.parse(r.raw_data || '{}');
      } catch (_) {}
      if (columns.length === 0 && Object.keys(parsed).length > 0) {
        columns = Object.keys(parsed);
      }
      return {
        id: r.id,
        rowIndex: r.row_index,
        data: parsed,
        createdAt: r.created_at,
      };
    });

    return {
      total,
      columns,
      records,
    };
  }

  static deleteDataset(id: string): { success: boolean; message: string } {

    const datasetEntities = db.prepare('SELECT id FROM entities WHERE dataset_id = ? OR source_dataset_id = ?').all(id, id) as { id: string }[];
    const entityIds = datasetEntities.map((e) => e.id);

    const deleteTransaction = db.transaction(() => {
      // 1. Delete raw records
      db.prepare('DELETE FROM raw_records WHERE dataset_id = ?').run(id);

      // 2. Delete relationships referencing this dataset or these entities
      if (entityIds.length > 0) {
        const placeholders = entityIds.map(() => '?').join(',');
        db.prepare(`
          DELETE FROM relationships 
          WHERE dataset_id = ? 
             OR source_dataset_id = ? 
             OR source_id IN (${placeholders}) 
             OR target_id IN (${placeholders})
        `).run(id, id, ...entityIds, ...entityIds);

        // 3. Delete anomalies linked to these entities
        db.prepare(`DELETE FROM anomalies WHERE entity_id IN (${placeholders})`).run(...entityIds);

        // 4. Delete merge candidates referencing these entities
        db.prepare(`DELETE FROM merge_candidates WHERE source_entity_id IN (${placeholders}) OR target_entity_id IN (${placeholders})`).run(...entityIds, ...entityIds);
      } else {
        db.prepare('DELETE FROM relationships WHERE dataset_id = ? OR source_dataset_id = ?').run(id, id);
      }

      // 5. Delete entities
      db.prepare('DELETE FROM entities WHERE dataset_id = ? OR source_dataset_id = ?').run(id, id);

      // 6. Delete dataset record
      db.prepare('DELETE FROM datasets WHERE id = ?').run(id);

      // 7. Re-assign active dataset if the deleted one was active
      const remaining = db.prepare('SELECT id FROM datasets ORDER BY uploaded_at DESC LIMIT 1').get() as { id: string } | undefined;
      if (remaining) {
        db.prepare('UPDATE datasets SET is_active = 1 WHERE id = ?').run(remaining.id);
      }
    });

    deleteTransaction();
    return { success: true, message: `Dataset ${id} and all associated records/entities removed.` };
  }

  static deleteAllDatasets(): { success: boolean; message: string } {
    const deleteTransaction = db.transaction(() => {
      db.exec(`
        DELETE FROM raw_records;
        DELETE FROM relationships;
        DELETE FROM entities;
        DELETE FROM anomalies;
        DELETE FROM merge_candidates;
        DELETE FROM events;
        DELETE FROM datasets;
      `);
    });

    deleteTransaction();
    return { success: true, message: 'All datasets, entities, and relationships have been purged.' };
  }
}


