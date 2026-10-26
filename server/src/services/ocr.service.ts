import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { IngestionPreview } from './ingestion.service.js';
import { db } from '../db/database.js';

export interface OcrBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrBlock {
  block_id: string;
  page_number: number;
  reading_order: number;
  block_type: string;
  text: string;
  bounding_box: OcrBoundingBox;
  confidence: number;
  font_size?: number;
  font_family?: string;
  heading_level?: number | null;
  extra_metadata?: Record<string, any>;
}

export interface OcrPage {
  page_number: number;
  provenance: string;
  confidence: number;
  confidence_metadata?: any;
  blocks_count: number;
  blocks: OcrBlock[];
  text: string;
}

export interface OcrResult {
  document_name: string;
  total_pages: number;
  document_confidence: number;
  engine_used: string;
  pages: OcrPage[];
  full_text: string;
  status: 'SUCCESS' | 'FAIL';
  file_path?: string;
  error?: string;
}

export class OcrService {
  /**
   * Root path to Python OCR module
   */
  private static getRootPath(): string {
    // server/ is located inside root, so root is two levels up from server/src or one level up from server/
    return path.resolve(process.cwd(), '..');
  }

  /**
   * Run OCR pipeline on an in-memory document buffer (PDF or Image)
   */
  static async processDocument(
    buffer: Buffer,
    fileName: string,
    options?: { strategy?: 'AUTO' | 'FORCE' | 'SKIP' }
  ): Promise<OcrResult> {
    const ext = path.extname(fileName) || '.pdf';
    const tempFileName = `ocr_${uuidv4()}${ext}`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    try {
      // Write buffer to temp file
      await fs.promises.writeFile(tempFilePath, buffer);

      const strategy = options?.strategy || 'AUTO';
      const rootPath = this.getRootPath();

      return await new Promise<OcrResult>((resolve, reject) => {
        execFile(
          'python',
          ['-m', 'ocr.cli', tempFilePath, '--strategy', strategy],
          {
            cwd: rootPath,
            maxBuffer: 20 * 1024 * 1024, // 20 MB buffer
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
          },
          (error, stdout, stderr) => {
            if (error) {
              // Attempt to parse stdout if error was formatted as JSON
              try {
                const parsed = JSON.parse(stdout);
                if (parsed.error) {
                  return reject(new Error(`OCR Failure: ${parsed.error}`));
                }
              } catch (_) {}
              return reject(new Error(`OCR Execution Failed: ${error.message}\n${stderr || stdout}`));
            }

            try {
              // Extract the valid JSON block from stdout (in case of warning lines)
              const firstBrace = stdout.indexOf('{');
              const lastBrace = stdout.lastIndexOf('}');
              if (firstBrace === -1 || lastBrace === -1) {
                return reject(new Error(`Invalid OCR JSON response: ${stdout}`));
              }

              const jsonStr = stdout.slice(firstBrace, lastBrace + 1);
              const result: OcrResult = JSON.parse(jsonStr);

              if (result.status === 'FAIL' || result.error) {
                return reject(new Error(result.error || 'OCR pipeline reported failure'));
              }

              resolve(result);
            } catch (parseErr: any) {
              reject(new Error(`Failed to parse OCR output: ${parseErr.message}\nOutput was: ${stdout}`));
            }
          }
        );
      });
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFilePath)) {
        try {
          await fs.promises.unlink(tempFilePath);
        } catch (_) {}
      }
    }
  }

  /**
   * Convert structured OCR result into Revana IngestionPreview for UI
   */
  static convertOcrToIngestionPreview(ocrResult: OcrResult, fileName: string): IngestionPreview {
    const rows: Record<string, any>[] = [];

    ocrResult.pages.forEach((page) => {
      page.blocks.forEach((block) => {
        if (!block.text || !block.text.trim()) return;
        rows.push({
          page_number: block.page_number,
          reading_order: block.reading_order,
          block_type: block.block_type,
          text: block.text.trim(),
          confidence: Math.round(block.confidence * 100) / 100,
          font_size: block.font_size || 12,
          bbox: `[${Math.round(block.bounding_box.x0)}, ${Math.round(block.bounding_box.y0)}, ${Math.round(block.bounding_box.x1)}, ${Math.round(block.bounding_box.y1)}]`,
        });
      });
    });

    const columns: IngestionPreview['columns'] = [
      { name: 'page_number', sampleValue: 1, dataType: 'NUMBER' },
      { name: 'reading_order', sampleValue: 1, dataType: 'NUMBER' },
      { name: 'block_type', sampleValue: 'PARAGRAPH', dataType: 'STRING' },
      { name: 'text', sampleValue: rows[0]?.text || '', dataType: 'STRING' },
      { name: 'confidence', sampleValue: 0.95, dataType: 'NUMBER' },
      { name: 'font_size', sampleValue: 12, dataType: 'NUMBER' },
      { name: 'bbox', sampleValue: '[54, 50, 329, 80]', dataType: 'STRING' },
    ];

    return {
      datasetName: fileName,
      format: 'OCR_DOCUMENT',
      totalRows: rows.length,
      columns,
      missingValueCount: 0,
      duplicateRowCount: 0,
      sampleRows: rows.slice(0, 15),
      allRows: rows,
    };
  }

  /**
   * Commit OCR Document into SQLite Evidence and Datasets
   */
  static commitOcrDocument(
    ocrResult: OcrResult,
    datasetName: string,
    rows: Record<string, any>[]
  ): { datasetId: string; totalRecords: number; totalEvidence: number } {
    const datasetId = `DS-OCR-${uuidv4().substring(0, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    // 1. Insert into datasets table
    const insertDs = db.prepare(`
      INSERT INTO datasets (id, name, format, row_count, source_file, ingested_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertDs.run(datasetId, datasetName, 'OCR_DOCUMENT', rows.length, datasetName, timestamp);

    // 2. Insert rows into dataset_records
    const insertRec = db.prepare(`
      INSERT INTO dataset_records (id, dataset_id, raw_data, normalized_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    let evidenceCount = 0;

    const insertTx = db.transaction(() => {
      rows.forEach((row, idx) => {
        const recId = `REC-${datasetId}-${idx + 1}`;
        const rawStr = JSON.stringify(row);
        insertRec.run(recId, datasetId, rawStr, rawStr, timestamp);
        evidenceCount++;
      });
    });

    insertTx();

    return {
      datasetId,
      totalRecords: rows.length,
      totalEvidence: evidenceCount,
    };
  }
}
