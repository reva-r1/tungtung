/**
 * Revana Technologies — Universal Intelligence Engine & Adaptive Reasoning
 * Comprehensive Generalization Test Suite
 *
 * Verifies platform-level generalization across:
 * 1. Target identifier extraction & stale context shedding
 * 2. Multi-token and dataset-specific raw record retrieval
 * 3. Domain adaptation (cyber, logistics, maritime, simple catalog)
 * 4. Calibrated evidence tiering and confidence scoring (no archival staleness penalty)
 * 5. Deterministic fallback query-responsiveness (no hijacked central-hub narrative)
 */

import path from 'path';
process.env.TEST_DATABASE_FILE = path.resolve(process.cwd(), 'data/aegis_intel.db');

import { extractQueryIdentifiers, classifyDomain } from '../services/ai/router.js';
import { executeToolByName } from '../services/ai/tools/index.js';
import { runDeterministicReasoning, reasonOverEvidence } from '../services/ai/reason.js';
import { isOllamaAvailable, getOllamaConfig } from '../services/ai/providers.js';
import { verifyClaims } from '../services/ai/verify.js';
import { AiService } from '../services/ai.service.js';
import { InvestigationContext, EvidenceItem, FactClaim, InferenceClaim } from '../services/ai/types.js';
import { db } from '../db/database.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✔ [PASS] ${message}`);
    passed++;
  }
}

async function runGeneralizationSuite() {
  console.log('\n=============================================================');
  console.log('  REVANA UNIVERSAL INTELLIGENCE & ADAPTIVE REASONING SUITE');
  console.log('=============================================================\n');

  // Ensure test fixture records exist in database
  const existing = db.prepare("SELECT count(*) as c FROM raw_records WHERE raw_data LIKE '%SES_20261014_9102%'").get() as any;
  if (!existing || existing.c === 0) {
    let ds = db.prepare("SELECT id FROM datasets WHERE name = '04_network_connections.csv'").get() as any;
    let datasetId = ds?.id;
    if (!datasetId) {
      datasetId = 'DS-TEST-NET-CONN';
      db.prepare("INSERT OR IGNORE INTO datasets (id, name, format, status, record_count, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)").run(
        datasetId, '04_network_connections.csv', 'CSV', 'LOADED', 1, new Date().toISOString()
      );
    }
    db.prepare(`
      INSERT INTO raw_records (id, dataset_id, row_index, raw_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'REC-TEST-SES-9102',
      datasetId,
      1,
      JSON.stringify({
        session_id: 'SES_20261014_9102',
        network_event_id: 'NET-77402',
        source_asset_id: 'AST-GW-01',
        destination_asset_id: 'AST-WRK-088',
        source_ip: '198.51.100.44',
        destination_ip: '10.40.10.88',
        bytes_sent: 48920,
        bytes_received: 21400000,
        collection_source: 'ZEEK_CONN_LOG',
      }),
      new Date().toISOString()
    );
  }

  // --------------------------------------------------------------------------
  // Test 1: Identifier Extraction & Context Pollution Shedding
  // --------------------------------------------------------------------------
  console.log('--- Test 1: Identifier Extraction & Context Shedding ---');
  {
    const prompt1 = 'Pull all network connections and endpoint events associated with session SES_20261014_9102 to verify the egress path for NET-77402';
    const ids1 = extractQueryIdentifiers(prompt1);
    assert(ids1.includes('SES_20261014_9102'), 'Extracted session identifier SES_20261014_9102');
    assert(ids1.includes('NET-77402'), 'Extracted network identifier NET-77402');

    const prompt2 = 'Inspect invoice INV-2026-9901 and supplier SUP-771 in manifest_q3.csv';
    const ids2 = extractQueryIdentifiers(prompt2);
    assert(ids2.includes('INV-2026-9901'), 'Extracted invoice identifier INV-2026-9901');
    assert(ids2.includes('SUP-771'), 'Extracted supplier identifier SUP-771');
    assert(ids2.includes('manifest_q3.csv'), 'Extracted CSV filename manifest_q3.csv');

    const prompt3 = 'Check vessel IMO 9382104 and IP 192.168.1.105';
    const ids3 = extractQueryIdentifiers(prompt3);
    assert(ids3.includes('9382104'), 'Extracted numeric IMO identifier 9382104');
    assert(ids3.includes('192.168.1.105'), 'Extracted IP address 192.168.1.105');
  }

  // --------------------------------------------------------------------------
  // Test 2: Domain-Agnostic Routing
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Domain-Agnostic Routing ---');
  {
    const res1 = await classifyDomain('Track container shipment SHP-0092 across warehouse manifests', undefined);
    console.log('    [DEBUG] res1:', res1);
    assert(res1.domain === 'logistics', `Supply chain prompt routes to logistics domain (got: ${res1.domain}, reason: ${res1.reason})`);

    const res2 = await classifyDomain('Analyze AIS vessel movements in Malacca strait', undefined);
    assert(res2.domain === 'maritime', 'AIS navigation prompt routes to maritime domain');

    const res3 = await classifyDomain('Physical sensor alert on corridor NH-48 telemetry', undefined);
    assert(res3.domain === 'world', 'Physical sensor prompt routes to world domain');

    const res4 = await classifyDomain('What datasets are currently ingested in the system?', undefined);
    assert(res4.domain === 'logistics', 'Dataset catalog query routes to tabular/logistics domain');
  }

  // --------------------------------------------------------------------------
  // Test 3: Tabular Record Retrieval by Target Identifiers
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: Tabular Record Retrieval by Target Identifiers ---');
  {
    const mockContext: any = {
      investigationId: 'test-inv',
      prompt: 'Check session SES_20261014_9102',
      primaryDomain: 'logistics',
      unlockedDomains: new Set(['logistics']),
      evidence: [],
      proposedRelationships: [],
      dataGaps: [],
      trace: [],
      targetIdentifiers: ['SES_20261014_9102'],
    };

    const res = await executeToolByName('search_records', { query: 'SES_20261014_9102', limit: 5 }, mockContext);
    assert(res && res.results !== undefined, 'search_records executed successfully');
    assert(res.totalMatches > 0, `search_records found ${res.totalMatches} matches for SES_20261014_9102`);
    const matchRow = res.results[0];
    assert(JSON.stringify(matchRow.data).includes('SES_20261014_9102'), 'Matched row data contains requested session ID');
  }

  // --------------------------------------------------------------------------
  // Test 4: Calibrated Evidence Verification (No Archival Staleness Penalty)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Calibrated Evidence Verification ---');
  {
    // Archival static dataset evidence with older retrieval/event timestamp
    const archivalEvidence: EvidenceItem[] = [
      {
        id: 'ev_1',
        tool: 'search_records',
        args: { query: 'SES_20261014_9102' },
        result: {
          results: [
            {
              datasetFilename: '03_sessions.csv',
              rowIndex: 42,
              data: { session_id: 'SES_20261014_9102', user_id: 'USR_882', host_id: 'AST-WRK-088' },
            },
          ],
        },
        retrievedAt: new Date(Date.now() - 3600 * 24 * 30 * 1000).toISOString(), // 30 days ago
        domain: 'logistics',
      },
    ];

    const facts: FactClaim[] = [
      {
        text: 'Record in [03_sessions.csv] indicates session SES_20261014_9102 associated with host AST-WRK-088.',
        evidenceIds: ['ev_1'],
      },
    ];

    const inferences: InferenceClaim[] = [
      {
        text: 'Session SES_20261014_9102 was initiated on workstation AST-WRK-088.',
        basedOnFactIndexes: [0],
        reasoning: 'Direct tabular association in sessions log.',
      },
    ];

    const verified = verifyClaims(facts, inferences, [], [], archivalEvidence);
    assert(verified.verifiedFacts.length === 1, 'Archival fact verified with valid citation and token match');
    assert(verified.verifiedInferences.length === 1, 'Inference verified against valid fact premise');
    assert(verified.confidenceScore === 1.0, `Confidence score is 1.0 (actual: ${verified.confidenceScore}) without artificial archival staleness penalty`);
  }

  // --------------------------------------------------------------------------
  // Test 5: Deterministic Reasoning Query-Responsiveness (Anti-Hijack)
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Deterministic Reasoning Query-Responsiveness ---');
  {
    // Context with matching records for session SES_20261014_9102 AND a central hub node in pattern detection
    const contextWithTarget: any = {
      investigationId: 'test-inv-anti-hijack',
      prompt: 'Pull all network connections and endpoint events associated with session SES_20261014_9102 to verify the egress path for NET-77402',
      primaryDomain: 'logistics',
      unlockedDomains: new Set(['logistics']),
      targetIdentifiers: ['SES_20261014_9102', 'NET-77402'],
      seedEntityId: undefined, // Cleared because user asked for different targets
      evidence: [
        {
          id: 'ev_patterns',
          tool: 'detect_data_patterns',
          args: {},
          result: {
            patterns: [
              {
                patternType: 'CENTRAL_HUB_NODES',
                description: 'Central connection hubs',
                evidence: ['"AUTH-20261014-023" (AUTHENTICATION, in 02_auth.csv) has 79 direct relationships.'],
              },
            ],
          },
          retrievedAt: new Date().toISOString(),
          domain: 'logistics',
        },
        {
          id: 'ev_records',
          tool: 'search_records',
          args: { query: 'SES_20261014_9102' },
          result: {
            totalMatches: 2,
            results: [
              {
                datasetFilename: '04_network_connections.csv',
                rowIndex: 104,
                data: {
                  session_id: 'SES_20261014_9102',
                  connection_id: 'NET-77402',
                  dest_ip: '198.51.100.44',
                  bytes_out: 48920,
                },
              },
            ],
          },
          retrievedAt: new Date().toISOString(),
          domain: 'logistics',
        },
      ],
      proposedRelationships: [],
      dataGaps: [],
      trace: [],
    };

    const reasoning = runDeterministicReasoning(contextWithTarget);

    assert(
      Boolean(reasoning.narrative?.whatIFound.includes('SES_20261014_9102') || reasoning.narrative?.whatIFound.includes('NET-77402')),
      'Narrative whatIFound focuses on the target session/network record'
    );
    assert(
      !reasoning.narrative?.whatIFound.startsWith('I reviewed the records for your question. A key connection point in the data is "AUTH-20261014-023"'),
      'Narrative is NOT hijacked by AUTH-20261014-023 canned hub text'
    );
    assert(
      reasoning.inferences.length > 0 && reasoning.inferences[0].text.includes('SES_20261014_9102'),
      'Inference tier is grounded in the requested session identifier'
    );
  }

  // --------------------------------------------------------------------------
  // Test 6: End-to-End Multi-Turn Follow-Up Context Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Multi-Turn Context Isolation via AiService ---');
  {
    // Simulating a follow-up turn where stale seedEntityId is supplied by the frontend
    const followUpPrompt = 'Pull all network connections and endpoint events associated with session SES_20261014_9102 to verify the egress path for NET-77402';
    const staleSeedEntity = 'AUTH-20261014-023';

    const history = [
      { role: 'user' as const, content: 'Analyze the authentication spike for AUTH-20261014-023' },
      { role: 'assistant' as const, content: 'Identified central hub AUTH-20261014-023 with 79 recorded connections.' },
    ];

    const result = await AiService.investigate(followUpPrompt, {
      entityId: staleSeedEntity, // Stale entity passed by legacy caller
      history,
    });

    assert(result !== undefined, 'AiService.investigate returned response');
    assert(Boolean(result.facts && result.facts.length > 0), `Returned ${result.facts?.length} verified facts`);

    const narrativeStr = JSON.stringify(result.narrative || {});
    const mentionsTarget =
      Boolean(result.aiInterpretation?.includes('SES_20261014_9102')) ||
      Boolean(result.aiInterpretation?.includes('NET-77402')) ||
      Boolean(narrativeStr.includes('SES_20261014_9102')) ||
      Boolean(narrativeStr.includes('NET-77402')) ||
      Boolean(result.facts?.some((f) => f.text.includes('SES_20261014_9102') || f.text.includes('NET-77402')));

    assert(mentionsTarget, 'Investigation response correctly retrieved and reported SES_20261014_9102 / NET-77402');
  }

  // --------------------------------------------------------------------------
  // Test 7: Direct Local Ollama Reason Over Evidence
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Direct Local Ollama Reason Over Evidence ---');
  {
    const isAvail = await isOllamaAvailable();
    console.log('    Ollama service available:', isAvail);
    if (isAvail) {
      const ollamaConfig = getOllamaConfig();
      console.log('    Ollama config:', ollamaConfig);
      const mockContext: any = {
        investigationId: 'test-ollama',
        prompt: 'Who is AUTH-20261014-023?',
        primaryDomain: 'logistics',
        unlockedDomains: new Set(['logistics']),
        targetIdentifiers: ['AUTH-20261014-023'],
        evidence: [
          {
            id: 'ev_1',
            tool: 'search_records',
            args: { query: 'AUTH-20261014-023' },
            result: {
              results: [
                {
                  datasetFilename: '02_auth.csv',
                  rowIndex: 1,
                  data: { auth_id: 'AUTH-20261014-023', user: 'admin', ip: '10.0.0.1' },
                },
              ],
            },
            retrievedAt: new Date().toISOString(),
            domain: 'logistics',
          },
        ],
        proposedRelationships: [],
        dataGaps: [],
        trace: [],
      };

      const reasonRes = await reasonOverEvidence(mockContext, 'llm');
      console.log('    Ollama reason engine:', reasonRes.engine, 'Diagnostics:', reasonRes.diagnostics);
      console.log('    Ollama whatIFound:', reasonRes.output.narrative?.whatIFound);
      assert(reasonRes.output !== undefined, 'Ollama returned reasoning output');
    } else {
      console.log('    (Ollama not running, skipping live test)');
    }
  }

  console.log('\n=============================================================');
  console.log(`  ALL GENERALIZATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runGeneralizationSuite().catch((err) => {
  console.error('Test suite execution failed:', err);
  process.exit(1);
});
