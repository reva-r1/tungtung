import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database.js';
import { DataSource, SourceInspection, SourceTableSchema, SourceRecord } from '../types/index.js';
import { REGISTERED_SOURCE_CONFIGS, initSourceDatabases, SOURCES_DIR } from '../db/sourceDatabases.js';
import { IngestionService } from './ingestion.service.js';

export class SourceService {
  /**
   * Ensure default source databases and registry entries are present
   */
  static bootstrapSources(): void {
    // Disabled: The system now relies purely on user-uploaded datasets.
  }

  /**
   * List all registered data sources
   */
  static listSources(): DataSource[] {
    this.bootstrapSources();
    const rows = db.prepare('SELECT * FROM data_sources ORDER BY id ASC').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      dbType: r.db_type,
      dbPath: r.db_path,
      status: r.status,
      lastSync: r.last_sync,
      tableCount: r.table_count,
      recordCount: r.record_count,
      createdAt: r.created_at,
    }));
  }

  /**
   * Get single data source details
   */
  static getSource(sourceId: string): DataSource | null {
    const r = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(sourceId) as any;
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      dbType: r.db_type,
      dbPath: r.db_path,
      status: r.status,
      lastSync: r.last_sync,
      tableCount: r.table_count,
      recordCount: r.record_count,
      createdAt: r.created_at,
    };
  }

  /**
   * Connect to and inspect source database schema, tables, columns, and sample rows
   */
  static inspectSource(sourceId: string): SourceInspection {
    const source = this.getSource(sourceId);
    if (!source) {
      throw new Error(`Data source "${sourceId}" not found in registry.`);
    }

    if (!fs.existsSync(source.dbPath)) {
      db.prepare("UPDATE data_sources SET status = 'DISCONNECTED' WHERE id = ?").run(sourceId);
      throw new Error(`Database file at "${source.dbPath}" does not exist.`);
    }

    const sdb = new Database(source.dbPath, { readonly: true });
    let totalRecords = 0;
    const tableSchemas: SourceTableSchema[] = [];

    try {
      const tables = sdb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];

      for (const tbl of tables) {
        const tableName = tbl.name;
        const colInfo = sdb.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
        const count = (sdb.prepare(`SELECT count(*) as c FROM "${tableName}"`).get() as any)?.c || 0;
        totalRecords += count;

        const sampleRows = sdb.prepare(`SELECT * FROM "${tableName}" LIMIT 5`).all() as Record<string, any>[];

        tableSchemas.push({
          tableName,
          rowCount: count,
          columns: colInfo.map((c) => ({
            name: c.name,
            type: c.type || 'TEXT',
            isPrimaryKey: Boolean(c.pk),
            sampleValue: sampleRows[0]?.[c.name],
          })),
          sampleRows,
        });
      }

      // Update registry metadata
      db.prepare(`
        UPDATE data_sources 
        SET status = 'CONNECTED', table_count = ?, record_count = ?
        WHERE id = ?
      `).run(tableSchemas.length, totalRecords, sourceId);

      return {
        sourceId: source.id,
        sourceName: source.name,
        dbType: source.dbType,
        status: 'CONNECTED',
        tables: tableSchemas,
        totalRecords,
      };
    } finally {
      sdb.close();
    }
  }

  /**
   * Sync a source database into the unified model with full provenance & resolution
   */
  static async syncSource(sourceId: string) {
    return IngestionService.ingestFromSourceDatabase(sourceId);
  }

  /**
   * Sync all registered source databases
   */
  static async syncAllSources() {
    const sources = this.listSources();
    const results = [];
    for (const src of sources) {
      const res = await this.syncSource(src.id);
      results.push(res);
    }
    return results;
  }

  /**
   * Get raw records extracted from a source database
   */
  static getSourceRecords(sourceId: string, limit: number = 50, offset: number = 0): { total: number; records: SourceRecord[] } {
    const total = (db.prepare('SELECT count(*) as c FROM source_records WHERE source_db_id = ?').get(sourceId) as any)?.c || 0;
    const rows = db.prepare(`
      SELECT * FROM source_records 
      WHERE source_db_id = ? 
      ORDER BY extracted_at DESC, id ASC 
      LIMIT ? OFFSET ?
    `).all(sourceId, limit, offset) as any[];

    return {
      total,
      records: rows.map((r) => ({
        id: r.id,
        sourceDbId: r.source_db_id,
        sourceTable: r.source_table,
        sourceRecordId: r.source_record_id,
        rawData: JSON.parse(r.raw_data || '{}'),
        extractedAt: r.extracted_at,
      })),
    };
  }
}
