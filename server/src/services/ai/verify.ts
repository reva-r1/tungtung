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

    if (!fact.evidenceIds || fact.evidenceIds.length === 0) {
      isValid = false;
      failReason = 'No evidence IDs cited';
    } else {
      // Check that all cited evidence IDs exist
      const missingIds = fact.evidenceIds.filter((id) => !evidenceMap.has(id));
      if (missingIds.length > 0) {
        isValid = false;
        failReason = `Cited evidence ID(s) not found: ${missingIds.join(', ')}`;
      } else {
        // Collect timestamps of cited evidence
        for (const id of fact.evidenceIds) {
          const ev = evidenceMap.get(id);
          if (ev?.retrievedAt) {
            const t = new Date(ev.retrievedAt).getTime();
            if (!isNaN(t)) citedTimestamps.push(t);
          }
        }

        // Data containment check: extract numbers or capitalized entity tokens
        const numbers = (fact.text.match(/\b\d+(\.\d+)?\b/g) || []).filter(
          (n) => n.length >= 2 || Number(n) > 5
        );
        const entityTokens = (fact.text.match(/\b[A-Z][a-zA-Z0-9_-]{2,}\b/g) || []).filter(
          (w) => !['The', 'This', 'That', 'With', 'From', 'Into', 'Over', 'When', 'What', 'Where', 'Fact'].includes(w)
        );

        const checkTokens = [...numbers, ...entityTokens];

        if (checkTokens.length > 0) {
          // Check if at least one token actually appears in cited evidence
          let foundTokenMatch = false;
          for (const evId of fact.evidenceIds) {
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

  // 3. Compute confidence score & staleness
  let stalenessFactor = 1.0;
  let stalenessSeconds = 0;

  if (citedTimestamps.length > 0) {
    const oldestTimestamp = Math.min(...citedTimestamps);
    const ageSeconds = Math.max(0, (Date.now() - oldestTimestamp) / 1000);
    stalenessSeconds = Math.round(ageSeconds);

    // If evidence is older than 2 hours, gently scale down by 2% per hour up to 30% max penalty
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
