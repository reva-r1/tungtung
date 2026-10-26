import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { Entity, MergeCandidate, EntityType } from '../types/index.js';

// Similarity helper functions
function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;
  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

function normalizeTokens(str: string): Set<string> {
  return new Set(
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !['pvt', 'ltd', 'private', 'limited', 'inc', 'corp', 'co', 'the'].includes(t))
  );
}

function tokenJaccard(a: string, b: string): number {
  const setA = normalizeTokens(a);
  const setB = normalizeTokens(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export class ResolutionService {
  /**
   * Compare two entities or an incoming candidate against an existing entity
   */
  static compareEntities(
    e1: { name: string; type?: string; properties?: Record<string, any>; aliases?: string[] },
    e2: { name: string; type?: string; properties?: Record<string, any>; aliases?: string[] }
  ): { confidence: number; matchReasons: string[] } {
    const matchReasons: string[] = [];
    let score = 0;

    const p1 = e1.properties || {};
    const p2 = e2.properties || {};

    // 1. Identifiers: GSTIN / CIN / Tax ID
    const gstin1 = p1.gstin || p1.taxId || p1.GSTIN;
    const gstin2 = p2.gstin || p2.taxId || p2.GSTIN;
    if (gstin1 && gstin2 && String(gstin1).trim().toLowerCase() === String(gstin2).trim().toLowerCase()) {
      matchReasons.push(`Exact Tax/GSTIN Match: ${gstin1}`);
      score += 0.90;
    }

    const cin1 = p1.cin || p1.CIN;
    const cin2 = p2.cin || p2.CIN;
    if (cin1 && cin2 && String(cin1).trim().toLowerCase() === String(cin2).trim().toLowerCase()) {
      matchReasons.push(`Exact Corporate CIN Match: ${cin1}`);
      score += 0.90;
    }

    // 2. Vehicle Plate / Registration Number
    const reg1 = (p1.registrationNumber || p1.truck_no || p1.plate || p1.vehicle || '').toString().replace(/[-\s]/g, '').toLowerCase();
    const reg2 = (p2.registrationNumber || p2.truck_no || p2.plate || p2.vehicle || '').toString().replace(/[-\s]/g, '').toLowerCase();
    if (reg1 && reg2 && reg1 === reg2 && reg1.length >= 4) {
      matchReasons.push(`Vehicle Plate Exact Match: ${p1.registrationNumber || reg1.toUpperCase()}`);
      score += 0.92;
    }

    // 3. Driver License
    const dl1 = (p1.driverLicense || p1.dlNumber || p1.license || '').toString().trim().toLowerCase();
    const dl2 = (p2.driverLicense || p2.dlNumber || p2.license || '').toString().trim().toLowerCase();
    if (dl1 && dl2 && dl1 === dl2 && dl1.length >= 5) {
      matchReasons.push(`Exact Driver License Match: ${dl1.toUpperCase()}`);
      score += 0.90;
    }

    // 4. Contact Phone
    const phone1 = (p1.contactPhone || p1.phone || '').toString().replace(/\D/g, '');
    const phone2 = (p2.contactPhone || p2.phone || '').toString().replace(/\D/g, '');
    if (phone1 && phone2 && phone1.length >= 8 && phone1 === phone2) {
      matchReasons.push(`Exact Phone Number Match: ${p1.contactPhone || phone1}`);
      score += 0.78;
    }

    // 5. Email
    const email1 = (p1.email || p1.contactEmail || '').toString().trim().toLowerCase();
    const email2 = (p2.email || p2.contactEmail || '').toString().trim().toLowerCase();
    if (email1 && email2 && email1 === email2 && email1.includes('@')) {
      matchReasons.push(`Exact Email Address Match: ${email1}`);
      score += 0.85;
    }

    // 6. Name Similarity (Normalized Tokens + Levenshtein)
    const normName1 = normalizeString(e1.name);
    const normName2 = normalizeString(e2.name);

    if (normName1 && normName2) {
      if (normName1 === normName2) {
        matchReasons.push(`Exact Normalized Name Match: "${e1.name}"`);
        score += 0.85;
      } else {
        const jaccard = tokenJaccard(e1.name, e2.name);
        if (jaccard >= 0.6) {
          matchReasons.push(`High Name Token Overlap: ${(jaccard * 100).toFixed(0)}%`);
          score += jaccard * 0.45;
        }

        const lev = levenshtein(normName1, normName2);
        const maxLen = Math.max(normName1.length, normName2.length);
        const num1 = normName1.replace(/\D/g, '');
        const num2 = normName2.replace(/\D/g, '');
        const hasConflictingDigits = Boolean(num1 && num2 && num1 !== num2);

        if (!hasConflictingDigits && maxLen >= 5) {
          const charSimilarity = 1 - (lev / maxLen);
          if (lev === 1 && maxLen >= 6) {
            matchReasons.push(`High String Proximity (Single edit variance, ${(charSimilarity * 100).toFixed(0)}% match)`);
            score += Math.max(0.78, Number((charSimilarity * 0.88).toFixed(2)));
          } else if (lev <= 2 && charSimilarity >= 0.75) {
            matchReasons.push(`Minor String Variance (Levenshtein distance: ${lev})`);
            score += Number((charSimilarity * 0.55).toFixed(2));
          } else if (lev <= 3 && maxLen >= 8) {
            matchReasons.push(`String Variance (Levenshtein distance: ${lev})`);
            score += 0.35;
          }
        }
      }
    }

    // 7. Aliases Match
    const aliases1 = e1.aliases || [];
    const aliases2 = e2.aliases || [];
    for (const a1 of aliases1) {
      if (normName2 === normalizeString(a1) || aliases2.map(normalizeString).includes(normalizeString(a1))) {
        matchReasons.push(`Known Alias Correlation: "${a1}"`);
        score += 0.45;
        break;
      }
    }
    for (const a2 of aliases2) {
      if (normName1 === normalizeString(a2)) {
        matchReasons.push(`Known Alias Correlation: "${a2}"`);
        score += 0.45;
        break;
      }
    }

    const confidence = Math.min(0.99, Number(score.toFixed(2)));
    return { confidence, matchReasons };
  }

  /**
   * Search database for existing entities that match an incoming candidate record
   */
  static findMatchForCandidate(candidate: {
    name: string;
    type: EntityType;
    properties?: Record<string, any>;
    aliases?: string[];
  }): { matchedEntity: Entity; confidence: number; matchReasons: string[]; isExactMatch: boolean } | null {
    const existingEntities = db.prepare('SELECT * FROM entities WHERE type = ?').all(candidate.type) as any[];

    let bestMatch: { matchedEntity: Entity; confidence: number; matchReasons: string[]; isExactMatch: boolean } | null = null;

    const candNameNorm = normalizeString(candidate.name);
    const candReg = (candidate.properties?.registrationNumber || candidate.properties?.truck_no || candidate.properties?.plate || candidate.name || '').toString().replace(/[^a-z0-9]/gi, '').toLowerCase();

    for (const raw of existingEntities) {
      const parsedEntity: Entity = {
        ...raw,
        properties: JSON.parse(raw.properties || '{}'),
        tags: JSON.parse(raw.tags || '[]'),
        aliases: JSON.parse(raw.aliases || '[]'),
      };

      const entNameNorm = normalizeString(parsedEntity.name);
      const entReg = (parsedEntity.properties?.registrationNumber || parsedEntity.properties?.truck_no || parsedEntity.properties?.plate || parsedEntity.name || '').toString().replace(/[^a-z0-9]/gi, '').toLowerCase();

      const exactName = candNameNorm.length >= 3 && candNameNorm === entNameNorm;
      const exactPlate = candidate.type === 'VEHICLE' && candReg.length >= 5 && candReg === entReg;
      const tokenJacc = tokenJaccard(candidate.name, parsedEntity.name);
      const isCompanyNormalizedExact = candidate.type === 'COMPANY' && parsedEntity.type === 'COMPANY' && tokenJacc === 1.0 && normalizeTokens(candidate.name).size >= 1;
      const isPersonNormalizedExact = candidate.type === 'PERSON' && parsedEntity.type === 'PERSON' && tokenJacc === 1.0 && normalizeTokens(candidate.name).size >= 2;

      // Instant 100% exact match short-circuit
      if (exactName || exactPlate || isCompanyNormalizedExact || isPersonNormalizedExact) {
        return {
          matchedEntity: parsedEntity,
          confidence: 1.0,
          matchReasons: exactName
            ? [`Exact Name Match: "${parsedEntity.name}"`]
            : isCompanyNormalizedExact
            ? [`Corporate Suffix-Normalized Match: "${parsedEntity.name}"`]
            : isPersonNormalizedExact
            ? [`Person Name Token Match: "${parsedEntity.name}"`]
            : [`Exact Vehicle Plate Match: "${parsedEntity.properties.registrationNumber || entReg}"`],
          isExactMatch: true,
        };
      }

      const { confidence, matchReasons } = this.compareEntities(candidate, parsedEntity);

      if (confidence >= 0.70 && matchReasons.length > 0) {
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = {
            matchedEntity: parsedEntity,
            confidence,
            matchReasons,
            isExactMatch: false,
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Run entity resolution scan across all entities in the database
   */
  static scanForMergeCandidates(): MergeCandidate[] {
    const allEntities = db.prepare('SELECT * FROM entities').all() as any[];
    const parsed = allEntities.map((e) => ({
      ...e,
      properties: JSON.parse(e.properties || '{}'),
      tags: JSON.parse(e.tags || '[]'),
      aliases: JSON.parse(e.aliases || '[]'),
    }));

    const existingCandidates = db.prepare('SELECT source_entity_id, target_entity_id FROM merge_candidates').all() as any[];
    const existingPairs = new Set(existingCandidates.map((c) => `${c.source_entity_id}_${c.target_entity_id}`));

    const newCandidates: MergeCandidate[] = [];

    // Group entities by type
    const byType: Record<string, typeof parsed> = {};
    for (const ent of parsed) {
      if (!byType[ent.type]) byType[ent.type] = [];
      byType[ent.type].push(ent);
    }

    for (const type of Object.keys(byType)) {
      const group = byType[type];
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const e1 = group[i];
          const e2 = group[j];

          const pairKey1 = `${e1.id}_${e2.id}`;
          const pairKey2 = `${e2.id}_${e1.id}`;
          if (existingPairs.has(pairKey1) || existingPairs.has(pairKey2)) {
            continue;
          }

          const { confidence, matchReasons } = this.compareEntities(e1, e2);

          if (confidence >= 0.75 && matchReasons.length > 0) {
            const candidate: MergeCandidate = {
              id: `MERGE-${uuidv4().substring(0, 8).toUpperCase()}`,
              sourceEntityId: e2.id,
              targetEntityId: e1.id,
              sourceName: e2.name,
              targetName: e1.name,
              type: type as EntityType,
              confidence,
              matchReasons,
              status: 'PENDING',
              sourceProps: e2.properties,
              targetProps: e1.properties,
              createdAt: new Date().toISOString(),
            };

            db.prepare(`
              INSERT INTO merge_candidates (id, source_entity_id, target_entity_id, source_name, target_name, type, confidence, match_reasons, status, source_props, target_props, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              candidate.id,
              candidate.sourceEntityId,
              candidate.targetEntityId,
              candidate.sourceName,
              candidate.targetName,
              candidate.type,
              candidate.confidence,
              JSON.stringify(candidate.matchReasons),
              candidate.status,
              JSON.stringify(candidate.sourceProps),
              JSON.stringify(candidate.targetProps),
              candidate.createdAt
            );

            newCandidates.push(candidate);
          }
        }
      }
    }

    return this.getMergeCandidates();
  }

  /**
   * Get all merge candidates
   */
  static getMergeCandidates(status?: string): MergeCandidate[] {
    let query = 'SELECT * FROM merge_candidates';
    const params: any[] = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY confidence DESC, created_at DESC';

    const records = db.prepare(query).all(...params) as any[];
    return records.map((r) => ({
      ...r,
      sourceEntityId: r.source_entity_id,
      targetEntityId: r.target_entity_id,
      sourceName: r.source_name,
      targetName: r.target_name,
      matchReasons: JSON.parse(r.match_reasons || '[]'),
      sourceProps: JSON.parse(r.source_props || '{}'),
      targetProps: JSON.parse(r.target_props || '{}'),
      createdAt: r.created_at,
    }));
  }

  /**
   * Execute or reject an entity merge
   */
  static resolveCandidate(candidateId: string, action: 'MERGE' | 'REJECT', analystNotes?: string) {
    const candidate = db.prepare('SELECT * FROM merge_candidates WHERE id = ?').get(candidateId) as any;
    if (!candidate) throw new Error(`Merge candidate ${candidateId} not found`);

    if (action === 'REJECT') {
      db.prepare("UPDATE merge_candidates SET status = 'REJECTED' WHERE id = ?").run(candidateId);
      return { success: true, action: 'REJECTED', candidateId };
    }

    // Process MERGE
    const sourceId = candidate.source_entity_id;
    const targetId = candidate.target_entity_id;

    const sourceEntity = db.prepare('SELECT * FROM entities WHERE id = ?').get(sourceId) as any;
    const targetEntity = db.prepare('SELECT * FROM entities WHERE id = ?').get(targetId) as any;

    if (!sourceEntity || !targetEntity) {
      throw new Error('One or both entities involved in the merge no longer exist');
    }

    // Merge properties and aliases
    const sourceProps = JSON.parse(sourceEntity.properties || '{}');
    const targetProps = JSON.parse(targetEntity.properties || '{}');
    const mergedProps = { ...sourceProps, ...targetProps };

    const sourceAliases = JSON.parse(sourceEntity.aliases || '[]');
    const targetAliases = JSON.parse(targetEntity.aliases || '[]');
    const mergedAliases = Array.from(new Set([...targetAliases, ...sourceAliases, sourceEntity.name]));

    const sourceTags = JSON.parse(sourceEntity.tags || '[]');
    const targetTags = JSON.parse(targetEntity.tags || '[]');
    const mergedTags = Array.from(new Set([...targetTags, ...sourceTags, 'Merged-Record']));

    // Update target entity with combined data
    db.prepare(`
      UPDATE entities 
      SET properties = ?, aliases = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(mergedProps),
      JSON.stringify(mergedAliases),
      JSON.stringify(mergedTags),
      new Date().toISOString(),
      targetId
    );

    // Re-route relationships
    db.prepare('UPDATE relationships SET source_id = ? WHERE source_id = ?').run(targetId, sourceId);
    db.prepare('UPDATE relationships SET target_id = ? WHERE target_id = ?').run(targetId, sourceId);

    // Re-route events
    const events = db.prepare('SELECT * FROM events WHERE entity_ids LIKE ?').all(`%${sourceId}%`) as any[];
    for (const ev of events) {
      const eIds = JSON.parse(ev.entity_ids || '[]');
      const updatedIds = eIds.map((id: string) => (id === sourceId ? targetId : id));
      db.prepare('UPDATE events SET entity_ids = ? WHERE id = ?').run(JSON.stringify(updatedIds), ev.id);
    }

    // Re-route anomalies
    db.prepare('UPDATE anomalies SET entity_id = ? WHERE entity_id = ?').run(targetId, sourceId);

    // Re-route entity_source_links
    db.prepare('UPDATE OR IGNORE entity_source_links SET entity_id = ? WHERE entity_id = ?').run(targetId, sourceId);
    db.prepare('DELETE FROM entity_source_links WHERE entity_id = ?').run(sourceId);

    // Delete duplicate source entity
    db.prepare('DELETE FROM entities WHERE id = ?').run(sourceId);

    // Update merge candidate status
    db.prepare("UPDATE merge_candidates SET status = 'MERGED' WHERE id = ?").run(candidateId);

    return {
      success: true,
      action: 'MERGED',
      candidateId,
      retainedEntityId: targetId,
      removedEntityId: sourceId,
      analystNotes,
    };
  }

  /**
   * Link an entity to a source record for verified data provenance
   */
  static linkEntitySource(entityId: string, sourceRecordId: string, sourceDbId: string, sourceTable: string, extractedField?: string) {
    db.prepare(`
      INSERT OR IGNORE INTO entity_source_links (entity_id, source_record_id, source_db_id, source_table, extracted_field, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entityId, sourceRecordId, sourceDbId, sourceTable, extractedField || null, new Date().toISOString());
  }

  /**
   * Retrieve all contributing source records and source databases for a canonical entity
   */
  static getEntityProvenance(entityId: string) {
    const links = db.prepare(`
      SELECT esl.*, sr.raw_data, sr.extracted_at, ds.name as source_db_name, ds.db_type
      FROM entity_source_links esl
      JOIN source_records sr ON esl.source_record_id = sr.id
      LEFT JOIN data_sources ds ON esl.source_db_id = ds.id
      WHERE esl.entity_id = ?
      ORDER BY esl.created_at ASC
    `).all(entityId) as any[];

    const sourceDbs = Array.from(new Set(links.map((l) => l.source_db_id)));

    return {
      entityId,
      contributingSources: sourceDbs,
      records: links.map((l) => ({
        sourceRecordId: l.source_record_id,
        sourceDbId: l.source_db_id,
        sourceDbName: l.source_db_name || l.source_db_id,
        sourceTable: l.source_table,
        extractedField: l.extracted_field,
        rawData: JSON.parse(l.raw_data || '{}'),
        extractedAt: l.extracted_at,
      })),
    };
  }
}

