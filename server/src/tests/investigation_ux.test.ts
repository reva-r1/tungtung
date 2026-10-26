import assert from 'assert';
import { runDeterministicReasoning, parseProviderError } from '../services/ai/reason.js';
import { verifyClaims } from '../services/ai/verify.js';
import { AiService } from '../services/ai.service.js';
import { InvestigationContext, EvidenceItem } from '../services/ai/types.js';

console.log('🧪 Running Human-Centered Investigation Experience & Grounding Test Suite...\n');

async function testProviderErrorClassification() {
  console.log('Test 1: Provider Error Classification & Diagnostics (Groq HTTP 429)');
  
  const sampleGroq429 = 'Groq HTTP 429: {"error":{"message":"Rate limit reached for model \'openai/gpt-oss-120b\' in organization \'org_01knpgdjyfeqv8ngx0h3rj3pp\' service tier \'on_demand\' on tokens per minute (TPM): Limit 8000, Used 5787, Requested 3242. Please try again in 7.717499999s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}';

  const parsed = parseProviderError(sampleGroq429);

  // 1. Must produce polite, human-readable user friendly explanation
  assert(
    !parsed.userFriendlyReason.includes('{"error"'),
    'User-friendly reason must NOT dump raw JSON into the UI'
  );
  assert(
    parsed.userFriendlyReason.includes('rate limit reached'),
    'Must explain that rate limit was reached'
  );
  assert(
    parsed.userFriendlyReason.includes('deterministic rule-based verification engine'),
    'Must explain that deterministic rule-based analysis completed the investigation'
  );

  // 2. Diagnostics must capture technical details safely
  assert.strictEqual(parsed.diagnostics.statusCode, 429);
  assert.strictEqual(parsed.diagnostics.errorType, 'rate_limit_exceeded');
  assert(['Google Gemini', 'Groq'].includes(parsed.diagnostics.provider));
  assert.strictEqual(parsed.diagnostics.retryAfterSec, 8);
  assert(parsed.diagnostics.rawError?.includes('openai/gpt-oss-120b'));

  // 3. Test token sanitization
  const errorWithKey = 'Error connecting with Bearer gsk_secret_1234567890abcdef at https://api.groq.com';
  const parsedKey = parseProviderError(errorWithKey);
  assert(
    !parsedKey.diagnostics.rawError?.includes('gsk_secret_1234567890abcdef'),
    'Sensitive API tokens must be redacted from diagnostics'
  );
  assert(
    parsedKey.diagnostics.rawError?.includes('Bearer [REDACTED]'),
    'Bearer token must be sanitized'
  );

  console.log('  ✅ Provider error classification and diagnostics test passed.');
}

async function testNaturalLanguageNarrativeGeneration() {
  console.log('\nTest 2: Natural Language Narrative Generation & Human-Centered Tone');

  const context: InvestigationContext = {
    prompt: 'Discover hidden structural patterns and hub entities connecting sample_logistics_intel.csv',
    primaryDomain: 'logistics',
    unlockedDomains: new Set(['logistics']),
    domainUnlockLogs: [],
    proposedRelationships: [],
    dataGaps: [],
    trace: [],
    evidence: [
      {
        id: 'ev_1',
        tool: 'detect_data_patterns',
        args: { focusTopic: 'sample_logistics_intel.csv' },
        result: {
          patterns: [
            {
              patternType: 'CENTRAL_HUB_NODES',
              description: 'Entities exhibiting high connectivity and acting as critical junctions.',
              evidence: [
                '"Alpha Cargo Logistics Pvt Ltd" (Company, in sample_logistics_intel.csv) has 14 direct relationship connections.',
                '"Coastal Shipping Line" (Company, in sample_logistics_intel.csv) has 8 direct relationship connections.',
              ],
            },
            {
              patternType: 'CROSS_DATASET_BRIDGES',
              description: 'Bridges linking records across files.',
              evidence: [
                '[sample_logistics_intel.csv] "Alpha Cargo Logistics Pvt Ltd" -> SUPPLIER_TO -> [sample_logistics_intel.csv] "Apex Global Trading"',
              ],
            },
          ],
        },
        retrievedAt: new Date().toISOString(),
      },
    ],
  };

  const output = runDeterministicReasoning(context);

  // 1. Must NOT contain robotic boilerplate
  assert(
    !output.summary.includes('verified factual observation(s)'),
    'Must NOT contain robotic string "verified factual observation(s)"'
  );
  assert(
    !output.summary.includes('Analytical synthesis yielded'),
    'Must NOT contain robotic string "Analytical synthesis yielded"'
  );
  assert(
    !output.facts.some((f) => f.text.startsWith('Topological pattern [')),
    'Facts must not be prefixed with robotic brackets like "Topological pattern [CENTRAL_HUB_NODES]"'
  );

  // 2. Narrative structure verification
  assert(output.narrative, 'Narrative object must be populated');
  assert(output.narrative.whatIFound.length > 20, 'whatIFound must contain informative text');
  assert(output.narrative.howRecordsConnect.length > 20, 'howRecordsConnect must contain informative text');
  assert(output.narrative.whatThisCouldMean.length > 20, 'whatThisCouldMean must contain informative text');
  assert(output.narrative.whatWeShouldExamineNext.length > 20, 'whatWeShouldExamineNext must contain informative text');

  // 3. Human analyst communication principles
  assert(
    output.narrative.whatIFound.includes('Alpha Cargo Logistics Pvt Ltd'),
    'Narrative must focus on the primary discovered hub entity'
  );
  assert(
    output.narrative.whatIFound.includes('14 direct relationships'),
    'Narrative must accurately state the recorded connection count'
  );
  assert(
    output.narrative.whatThisCouldMean.includes('does not establish suspicious activity'),
    'Must explicitly state that high connection count alone does NOT establish suspicious activity'
  );

  // 4. Inferences and Hypotheses
  assert(output.inferences.length > 0, 'Must produce grounded inferences');
  assert(output.inferences[0].reasoning.length > 10, 'Inference must contain explicit reasoning chain');
  assert(output.hypotheses.length > 0, 'Must produce structured hypotheses');
  assert(output.hypotheses[0].confirmWith, 'Hypothesis must state confirmation criteria');
  assert(output.hypotheses[0].refuteWith, 'Hypothesis must state refutation criteria');

  // 5. Context-aware follow-ups
  assert(output.suggestedFollowUps && output.suggestedFollowUps.length >= 2, 'Must suggest follow-up questions');
  assert(
    output.suggestedFollowUps.some((q) => q.includes('Alpha Cargo Logistics Pvt Ltd')),
    'Suggested follow-ups must be grounded in actual entities discovered'
  );

  console.log('  ✅ Natural language narrative generation test passed.');
}

async function testHonestGroundingAndDisconnectedEntities() {
  console.log('\nTest 3: Grounding Metrics & Honest Disconnection Explanations');

  // Test empty / disconnected query
  const emptyContext: InvestigationContext = {
    prompt: 'Find connection between Phantom Corp and NonExistent LLC',
    primaryDomain: 'logistics',
    unlockedDomains: new Set(['logistics']),
    domainUnlockLogs: [],
    proposedRelationships: [],
    dataGaps: ['No direct paths found in uploaded dataset.'],
    trace: [],
    evidence: [],
  };

  const emptyOutput = runDeterministicReasoning(emptyContext);

  assert(
    emptyOutput.narrative?.whatThisCouldMean.includes('does not prove that no relationship exists in the real world'),
    'Disconnected entities must clearly explain that absence from data does not prove absence in reality'
  );

  // Test claim verification
  const verification = verifyClaims(
    [
      { text: 'Alpha Cargo has 14 connections in records', evidenceIds: ['ev_1'] },
      { text: 'Another verified record', evidenceIds: ['ev_1'] },
    ],
    [
      {
        text: 'Workflows route through Alpha Cargo',
        basedOnFactIndexes: [0],
        reasoning: '14 connections demonstrate high degree',
      },
    ],
    [
      {
        text: 'May operate as a 3PL freight forwarder',
        whyPlausible: 'High connectivity to shippers',
        plausibility: 'medium',
        confirmWith: 'Bill of lading records',
        refuteWith: 'Tax returns showing retail operations',
      },
    ],
    [],
    [
      {
        id: 'ev_1',
        tool: 'detect_data_patterns',
        args: {},
        result: {
          description: 'Alpha Cargo has 14 connections in records and Another verified record',
        },
        retrievedAt: new Date().toISOString(),
      },
    ]
  );

  assert.strictEqual(verification.verifiedFacts.length, 2);
  assert.strictEqual(verification.verifiedInferences.length, 1);
  assert.strictEqual(verification.confidenceScore, 1.0);
  assert(
    verification.groundingSummary.includes('2 facts verified'),
    'Grounding summary must accurately reconcile verified count'
  );

  console.log('  ✅ Honest grounding & disconnected entities test passed.');
}

async function testEndToEndInvestigationExecution() {
  console.log('\nTest 4: End-to-End Investigation Pipeline Execution via AiService');

  const res = await AiService.investigate(
    'Discover hidden structural patterns and hub entities connecting sample_logistics_intel.csv'
  );

  console.log('Test 4 res keys:', Object.keys(res));
  console.log('res.engine:', res.engine);
  console.log('res.fallbackReason:', res.fallbackReason);
  console.log('res.facts length:', res.facts?.length);
  console.log('res.knownFacts length:', res.knownFacts?.length);
  console.log('res.trace:', res.trace?.map(t => t.step));

  console.log('res.narrative:', res.narrative);
  console.log('res.aiInterpretation:', res.aiInterpretation);

  // 1. Result verification
  assert(res.facts && res.facts.length > 0, 'Must return facts extracted from tools or observations');
  assert(res.confidenceScore > 0, 'Confidence score must be positive');

  // 2. Narrative verification
  assert(
    (res.narrative && res.narrative.whatIFound?.length > 10) || res.aiInterpretation.length > 20,
    'Investigation output must produce an informative narrative'
  );
  assert(
    !res.aiInterpretation.includes('{"error"'),
    'AI interpretation must NEVER contain raw JSON errors'
  );
  assert(
    !res.aiInterpretation.includes('Investigation identified 10 verified factual observation(s)'),
    'AI interpretation must NOT contain robotic status text'
  );
  assert(
    !res.aiInterpretation.includes('Topological pattern [CENTRAL_HUB_NODES]'),
    'AI interpretation must not output raw bracketed pattern tags'
  );

  // 3. Follow-ups
  assert(
    res.suggestedFollowUps && res.suggestedFollowUps.length > 0,
    'Must provide contextual follow-up questions'
  );

  console.log('  ✅ End-to-end investigation pipeline execution passed.');
}

async function runAll() {
  try {
    await testProviderErrorClassification();
    await testNaturalLanguageNarrativeGeneration();
    await testHonestGroundingAndDisconnectedEntities();
    await testEndToEndInvestigationExecution();
    console.log('\n🏆 ALL 4 INVESTIGATION UX & GROUNDING TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runAll();
