import { db } from '../../db/database.js';
import { MaritimePatternDetector } from './patternDetector.service.js';
import { AiService } from '../ai.service.js';
import { MaritimePattern } from '../../types/index.js';

export class MaritimeReasoningService {
  /**
   * Evaluates a detected maritime pattern through the Revana intelligence reasoning engine
   */
  static async investigatePattern(patternId: string): Promise<{ pattern: MaritimePattern; analysis: any }> {
    const pattern = MaritimePatternDetector.getPatternById(patternId);
    if (!pattern) {
      throw new Error(`Pattern "${patternId}" not found.`);
    }

    // Query sample vessels in this corridor for grounded context
    const sampleVessels = db.prepare(`
      SELECT name, vessel_type, speed, course, destination
      FROM moving_entities
      WHERE destination IS NOT NULL
      LIMIT 10
    `).all() as any[];

    const vesselSummary = sampleVessels.map((v) => `${v.name} (${v.vessel_type}, Speed: ${v.speed} kts, Dest: ${v.destination})`).join('\n• ');

    const prompt = `
REVANA MARITIME INTELLIGENCE INVESTIGATION
Pattern ID: ${pattern.pattern_id}
Region: ${pattern.region}
Observation: ${pattern.observation}
Traffic Metrics: Observed ${pattern.entities_observed} vessels vs Baseline ${pattern.baseline} (${pattern.deviation_percent > 0 ? '+' : ''}${pattern.deviation_percent}% deviation)
Sample Vessel Telemetry:
• ${vesselSummary}

CRITICAL ANALYTICAL DIRECTIVES:
1. Strictly distinguish VERIFIED OBSERVATIONS from ANALYTICAL HYPOTHESES.
2. Evaluate why this vessel concentration occurred:
   - Is it seasonal shipping volume?
   - Is it commercial export surge?
   - Is it port scheduling congestion?
   - Is it weather/routing diversion?
3. NEVER force an explanation when evidence is insufficient.
4. If available public records and manifests do not prove an exclusive cause, EXPLICITLY conclude that the cause remains UNRESOLVED / UNKNOWN.
5. Provide concrete follow-up investigative steps for the analyst.
`;

    // Invoke Revana AI Engine (Groq / Grounded Deterministic)
    const aiResult = await AiService.investigate(prompt);

    // Update pattern with AI reasoning notes
    const reasoningText = `Revana Pattern Assessment:\n${aiResult.aiInterpretation}\n\nUncertainty Assessment: ${aiResult.uncertainty}`;
    db.prepare('UPDATE maritime_patterns SET ai_reasoning = ?, updated_at = ? WHERE pattern_id = ?').run(
      reasoningText,
      new Date().toISOString(),
      patternId
    );

    const updatedPattern = MaritimePatternDetector.getPatternById(patternId)!;

    return {
      pattern: updatedPattern,
      analysis: aiResult,
    };
  }
}
