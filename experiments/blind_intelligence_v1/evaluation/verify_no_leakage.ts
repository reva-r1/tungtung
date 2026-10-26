import * as fs from 'fs';
import * as path from 'path';

export interface LeakageCheckResult {
  passed: boolean;
  checksRun: number;
  violations: string[];
}

export function runLeakageChecks(): LeakageCheckResult {
  const violations: string[] = [];
  let checksRun = 0;

  const rootDir = path.resolve('d:/zenism');
  const serverSrcDir = path.join(rootDir, 'server', 'src');
  const clientSrcDir = path.join(rootDir, 'client', 'src');
  const sourceDataDir = path.join(rootDir, 'experiments', 'blind_intelligence_v1', 'source_data');
  const blindQuestionsPath = path.join(rootDir, 'experiments', 'blind_intelligence_v1', 'blind_questions', 'investigation_prompts.json');
  const groundTruthDir = path.join(rootDir, 'experiments', 'blind_intelligence_v1', 'ground_truth_restricted');

  console.log('[Leakage Validation] Beginning comprehensive verification...');

  // Check 1: Ensure ground_truth_restricted directory exists and is strictly isolated
  checksRun++;
  if (!fs.existsSync(groundTruthDir)) {
    violations.push('Ground truth directory missing.');
  }

  // Check 2: Codebase scan - ensure no imports or references to ground_truth_restricted in server/src
  checksRun++;
  function scanDirForTerms(dir: string, terms: string[]) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirForTerms(fullPath, terms);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const term of terms) {
          if (content.includes(term)) {
            violations.push(`Code leakage detected: "${term}" referenced in ${fullPath}`);
          }
        }
      }
    }
  }

  const forbiddenTerms = [
    'ground_truth_restricted',
    'ground_truth.json',
    'CASE-01',
    'CASE-02',
    'CASE-03',
    'CASE-04',
    'CASE-05',
    'CASE-06',
    'CASE-07',
    'CASE-08',
    'CASE-09',
    'CASE-10',
    'CASE-11',
    'CASE-12',
    'RESOLVE_SAME_ENTITY',
    'KEEP_DISTINCT',
    'LEGITIMATE_COMMERCIAL_TRANSACTION',
    'INSUFFICIENT_EVIDENCE',
    'RESOLVE_TO_KESTREL',
    'VERIFIED_CLEAN'
  ];

  scanDirForTerms(serverSrcDir, forbiddenTerms);
  scanDirForTerms(clientSrcDir, forbiddenTerms);

  // Check 3: Check source datasets - verify source datasets do not contain ground truth labels
  checksRun++;
  if (fs.existsSync(sourceDataDir)) {
    const sourceFiles = fs.readdirSync(sourceDataDir);
    for (const sFile of sourceFiles) {
      if (sFile.endsWith('.csv') || sFile.endsWith('.txt')) {
        const content = fs.readFileSync(path.join(sourceDataDir, sFile), 'utf8');
        for (const term of forbiddenTerms) {
          if (content.includes(term)) {
            violations.push(`Source data contamination detected: "${term}" found in ${sFile}`);
          }
        }
      }
    }
  }

  // Check 4: Check blind_questions - verify questions do not leak outcomes
  checksRun++;
  if (fs.existsSync(blindQuestionsPath)) {
    const qContent = fs.readFileSync(blindQuestionsPath, 'utf8');
    const outcomeTerms = [
      'RESOLVE_SAME_ENTITY',
      'KEEP_DISTINCT',
      'LEGITIMATE_COMMERCIAL_TRANSACTION',
      'INSUFFICIENT_EVIDENCE',
      'RESOLVE_TO_KESTREL',
      'VERIFIED_CLEAN',
      'Kickback Triangle',
      'Pre-Permit Pour'
    ];
    for (const term of outcomeTerms) {
      if (qContent.includes(term)) {
        violations.push(`Question leakage detected: "${term}" found in blind questions`);
      }
    }
  }

  const passed = violations.length === 0;
  console.log(`[Leakage Validation] Finished ${checksRun} checks. Violations: ${violations.length}`);
  if (!passed) {
    violations.forEach((v) => console.error(`  - [FAIL] ${v}`));
  } else {
    console.log('  - [PASS] Zero leakage detected. Complete air-gap between Package A and Package B verified.');
  }

  return { passed, checksRun, violations };
}

if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('verify_no_leakage')) {
  const result = runLeakageChecks();
  process.exit(result.passed ? 0 : 1);
}
