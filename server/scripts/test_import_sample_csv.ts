import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IngestionService } from '../src/services/ingestion.service.js';
import { ResolutionService } from '../src/services/resolution.service.js';
import { GraphService } from '../src/services/graph.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, '../../sample_logistics_intel.csv');
const csvBuffer = fs.readFileSync(csvPath);

console.log('--- 1. Inspecting Dataset ---');
const preview = IngestionService.inspectDataset('sample_logistics_intel.csv', csvBuffer, 'CSV');
console.log('Preview:', {
  datasetName: preview.datasetName,
  totalRows: preview.totalRows,
  columnsCount: preview.columns.length,
});

console.log('\n--- 2. Committing Ingestion ---');
const commitResult = IngestionService.commitIngestion(
  preview.datasetName,
  preview.format as any,
  preview.allRows || preview.sampleRows
);
console.log('Commit Result:', commitResult);

console.log('\n--- 3. Running Entity Resolution Scan ---');
const mergeCandidates = ResolutionService.scanForMergeCandidates();
console.log('Merge Candidates Found:', mergeCandidates.length);
for (const c of mergeCandidates) {
  console.log(`- [${c.type}] "${c.sourceName}" <--> "${c.targetName}" | Confidence: ${(c.confidence * 100).toFixed(0)}%`);
  console.log(`  Match Reasons:`, c.matchReasons);
}

console.log('\n--- 4. Checking Graph ---');
const graph = GraphService.getGraph();
console.log('Graph Stats:', {
  nodesCount: graph.nodes.length,
  edgesCount: graph.edges.length,
});
