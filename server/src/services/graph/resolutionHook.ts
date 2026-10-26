import { db } from '../../db/database.js';
import { Entity, EntityType } from '../../types/index.js';
import { ResolutionService } from '../resolution.service.js';

export interface ResolutionHookResult {
  canonicalId: string;
  canonicalName: string;
  isExisting: boolean;
  resolvedVia: 'exact_id' | 'resolution_service_match' | 'new_entity';
  matchConfidence?: number;
  matchReasons?: string[];
}

export class EntityResolutionHook {
  /**
   * Resolves an incoming entity name, type, and properties against the database
   * before writing edges. Prevents duplicate entity node fragmentation.
   */
  static resolve(params: {
    rawId: string;
    name: string;
    type: EntityType;
    category?: string;
    sourceFile: string;
    properties?: Record<string, any>;
  }): ResolutionHookResult {
    const { rawId, name, type, properties } = params;

    // 1. Direct ID lookup
    const existingById = db.prepare('SELECT * FROM entities WHERE id = ?').get(rawId) as any;
    if (existingById) {
      return {
        canonicalId: existingById.id,
        canonicalName: existingById.name,
        isExisting: true,
        resolvedVia: 'exact_id',
      };
    }

    // 2. ResolutionService matching against existing entities of the same type
    const match = ResolutionService.findMatchForCandidate({
      name,
      type,
      properties: properties || {},
      aliases: [name],
    });

    if (match && match.confidence >= 0.75) {
      const canonical = match.matchedEntity;

      // Ensure new spelling/name is tracked in aliases on the canonical entity
      try {
        const existingAliases: string[] = Array.isArray(canonical.aliases) ? canonical.aliases : [];
        if (!existingAliases.some((a) => a.toLowerCase() === name.toLowerCase())) {
          existingAliases.push(name);
          db.prepare('UPDATE entities SET aliases = ?, updated_at = ? WHERE id = ?').run(
            JSON.stringify(existingAliases),
            new Date().toISOString(),
            canonical.id
          );
        }
      } catch (_) {}

      return {
        canonicalId: canonical.id,
        canonicalName: canonical.name,
        isExisting: true,
        resolvedVia: 'resolution_service_match',
        matchConfidence: match.confidence,
        matchReasons: match.matchReasons,
      };
    }

    // 3. Brand new entity
    return {
      canonicalId: rawId,
      canonicalName: name,
      isExisting: false,
      resolvedVia: 'new_entity',
    };
  }
}
