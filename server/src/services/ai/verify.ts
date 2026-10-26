import {
  EvidenceItem,
  FactClaim,
  InferenceClaim,
  HypothesisClaim,
  BackgroundClaim,
  VerificationResult,
} from './types.js';

/**
 * Verification Stage: Strictly checks the FACT and INFERENCE tiers
 * - Facts failing citation or data containment are demoted to hypotheses with an unverified note
 * - Inferences dependent on demoted facts are also demoted to hypotheses
 * - Computes mathematical confidence score = (verifiedFacts / totalFacts) * stalenessFactor
 */
export function verifyClaims(
  rawFacts: FactClaim[],
  rawInferences: InferenceClaim[],
  rawHypotheses: HypothesisClaim[],
  background: BackgroundClaim[],
  evidenceItems: EvidenceItem[]
): VerificationResult {
  const evidenceMap = new Map<string, EvidenceItem>(
    evidenceItems.map((e) => [e.id, e])
  );

  const verifiedFacts: FactClaim[] = [];
  const demotedFacts: HypothesisClaim[] = [];
  const survivingFactOldIndices = new Set<number>();

  const citedTimestamps: number[] = [];

  // 1. Verify FACT tier
  rawFacts.forEach((fact, idx) => {
    let isValid = true;
    let failReason = '';

    // Resolve and normalize cited evidence IDs
    let effectiveIds = (fact.evidenceIds || []).map(String).map((id) => id.trim());
    // Normalize numeric IDs (e.g. "1" -> "ev_1")
    effectiveIds = effectiveIds.map((id) => (evidenceMap.has(id) ? id : evidenceMap.has(`ev_${id}`) ? `ev_${id}` : id));
    // Retain only IDs that exist in the evidence map
    let validIds = effectiveIds.filter((id) => evidenceMap.has(id));

    // Token extraction for grounding check
    const numbers = (fact.text.match(/\b\d+(\.\d+)?\b/g) || []).filter(
      (n) => n.length >= 2 || Number(n) > 5
    );
    const entityTokens = (fact.text.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || []).filter(
      (w) => !['The', 'This', 'That', 'With', 'From', 'Into', 'Over', 'When', 'What', 'Where', 'Fact'].includes(w)
    );
    const checkTokens = [...numbers, ...entityTokens];

    // If model omitted or hallucinated IDs, check if any existing evidence item contains the fact's key tokens
    if (validIds.length === 0 && checkTokens.length > 0 && evidenceItems.length > 0) {
      for (const ev of evidenceItems) {
        const evStr = JSON.stringify(ev.result ?? '').toLowerCase();
        if (checkTokens.some((tok) => evStr.includes(tok.toLowerCase()))) {
          validIds.push(ev.id);
          break;
        }
      }
    }

    if (validIds.length === 0) {
      isValid = false;
      failReason = fact.evidenceIds && fact.evidenceIds.length > 0
        ? `Cited evidence ID(s) [${fact.evidenceIds.join(', ')}] not found in retrieved items`
        : 'No evidence IDs cited';
    } else {
      // Update fact with valid resolved evidence IDs
      fact.evidenceIds = validIds;

      // Collect timestamps of cited evidence
      for (const id of validIds) {
        const ev = evidenceMap.get(id);
        if (ev?.retrievedAt) {
          const t = new Date(ev.retrievedAt).getTime();
          if (!isNaN(t)) citedTimestamps.push(t);
        }
      }

      // Grounding containment check: verify at least one key token appears in the cited evidence
      if (checkTokens.length > 0) {
        let foundTokenMatch = false;
        for (const evId of validIds) {
          const ev = evidenceMap.get(evId);
          const evString = JSON.stringify(ev?.result ?? '').toLowerCase();

          for (const token of checkTokens) {
            if (evString.includes(token.toLowerCase())) {
              foundTokenMatch = true;
              break;
            }
          }
          if (foundTokenMatch) break;
        }

        if (!foundTokenMatch) {
          isValid = false;
          failReason = `None of the key tokens [${checkTokens.slice(0, 4).join(', ')}] appeared in cited evidence`;
        }
      }
    }

    if (isValid) {
      verifiedFacts.push({ ...fact, verified: true });
      survivingFactOldIndices.add(idx);
    } else {
      demotedFacts.push({
        text: fact.text,
        whyPlausible: `Demoted from FACT tier: ${failReason}`,
        plausibility: 'low',
        confirmWith: 'Verify against direct sensor reading or uploaded dataset row.',
        refuteWith: 'Absence in verified database records.',
        unverifiedNote: `unverified against data: ${failReason}`,
      });
    }
  });

  // 2. Verify INFERENCE tier
  const verifiedInferences: InferenceClaim[] = [];
  const demotedInferences: HypothesisClaim[] = [];

  for (const inf of rawInferences) {
    const basisIndices = Array.isArray(inf.basedOnFactIndexes) ? inf.basedOnFactIndexes : [];
    const allPremisesSurvived =
      basisIndices.length > 0 &&
      basisIndices.every((baseIdx) => survivingFactOldIndices.has(baseIdx));

    if (allPremisesSurvived && inf.reasoning && inf.reasoning.trim().length > 0) {
      // Map to new 0-based indexes in verifiedFacts
      const newIndices = basisIndices
        .map((oldIdx) => {
          let countBefore = 0;
          for (let i = 0; i < oldIdx; i++) {
            if (survivingFactOldIndices.has(i)) countBefore++;
          }
          return countBefore;
        })
        .filter((n) => n < verifiedFacts.length);

      verifiedInferences.push({
        ...inf,
        basedOnFactIndexes: newIndices,
      });
    } else {
      const reason =
        basisIndices.length === 0
          ? 'Missing prerequisite fact indexes'
          : !inf.reasoning || inf.reasoning.trim().length === 0
          ? 'Missing required one-line reasoning chain'
          : 'One or more premise facts failed verification and were demoted';

      demotedInferences.push({
        text: inf.text,
        whyPlausible: `Demoted from INFERENCE tier (${reason}). Original chain: ${inf.reasoning || 'None'}`,
        plausibility: 'low',
        confirmWith: 'Re-verify prerequisite factual foundations.',
        refuteWith: 'Factual premise invalidation.',
        unverifiedNote: `Demoted from inference: ${reason}`,
      });
    }
  }

  // Combine all hypotheses
  const allHypotheses: HypothesisClaim[] = [
    ...rawHypotheses,
    ...demotedFacts,
    ...demotedInferences,
  ];

  // 3. Compute confidence score & calibrated staleness
  let stalenessFactor = 1.0;
  let stalenessSeconds = 0;

  // Distinguish live sensor feeds from static tabular/forensic records
  const LIVE_SENSOR_TOOLS = new Set([
    'get_live_world_summary',
    'get_live_events',
    'get_entity_telemetry',
    'get_active_vessels',
  ]);

  const hasLiveSensorEvidence = Array.from(evidenceMap.values()).some(
    (ev) => LIVE_SENSOR_TOOLS.has(ev.tool)
  );

  if (hasLiveSensorEvidence && citedTimestamps.length > 0) {
    const oldestTimestamp = Math.min(...citedTimestamps);
    const ageSeconds = Math.max(0, (Date.now() - oldestTimestamp) / 1000);
    stalenessSeconds = Math.round(ageSeconds);

    // If live telemetry is older than 2 hours, scale down by 2% per hour up to 30% max penalty
    const ageHours = ageSeconds / 3600;
    if (ageHours > 2) {
      stalenessFactor = Math.max(0.7, 1.0 - (ageHours - 2) * 0.02);
    }
  }

  const totalFacts = rawFacts.length;
  let rawConfidence = 0.0;

  if (totalFacts > 0) {
    rawConfidence = (verifiedFacts.length / totalFacts) * stalenessFactor;
  } else if (verifiedInferences.length > 0) {
    rawConfidence = 0.6 * stalenessFactor;
  } else {
    rawConfidence = 0.0;
  }

  const confidenceScore = Number(Math.min(1.0, Math.max(0.0, rawConfidence)).toFixed(2));

  // 4. Grounding summary
  const groundingSummary = `${verifiedFacts.length} facts verified, ${verifiedInferences.length} inferences, ${allHypotheses.length} hypotheses, ${background.length} background`;

  return {
    verifiedFacts,
    demotedFacts,
    verifiedInferences,
    demotedInferences,
    allHypotheses,
    confidenceScore,
    groundingSummary,
    stalenessSeconds,
  };
}
