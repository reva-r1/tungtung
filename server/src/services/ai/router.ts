import { Domain } from './types.js';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.XAI_API_KEY || '';
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || process.env.XAI_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

const MARITIME_KEYWORDS = [
  'vessel', 'ship', 'maritime', 'ais', 'mmsi', 'imo', 'port', 'chokepoint',
  'malacca', 'strait', 'jnpt', 'mundra', 'colombo', 'cargo ship', 'tanker',
  'container ship', 'nautical', 'knots', 'oceanic', 'anchor', 'moored',
  'navigation', 'ocean', 'harbor', 'voyage', 'sea route',
];

const WORLD_KEYWORDS = [
  'weather', 'rain', 'rainstorm', 'precipitation', 'temp', 'temperature',
  'aqi', 'air quality', 'pm2.5', 'pm10', 'pollution', 'seismic', 'earthquake',
  'tsunami', 'river', 'reservoir', 'dam', 'flood', 'water stage', 'water level',
  'cwc', 'electrical', 'grid', 'power', 'substation', 'megawatt', 'mw', 'kptcl',
  'transit', 'bus', 'metro', 'bmrcl', 'bmtc', 'traffic', 'road', 'corridor',
  'nh48', 'deluge', 'simulation', 'twin', 'sensor', 'telemetry', 'weir',
];

const LOGISTICS_KEYWORDS = [
  'dataset', 'file', 'csv', 'upload', 'column', 'schema', 'raw record',
  'customer', 'invoice', 'payment', 'supplier', 'vendor', 'shipment', 'order',
  'hub', 'bridge', 'collision', 'degree', 'isolated', 'graph stats', 'transaction',
  'entity', 'records', 'entities', 'foreign key', 'cross-dataset', 'bridge',
];

const CROSS_INDICATORS = [
  'cross', 'correlate', 'correlation', 'impact of weather', 'affect shipment',
  'delay cargo', 'weather disruption', 'storm impact', 'multi-domain', 'cascade',
  'ripple effect', 'how does weather', 'how does rain', 'port and grid',
];

/**
 * Classifies a user question into a PRIMARY domain: 'world' | 'logistics' | 'maritime' | 'cross'
 * Rule-based / keyword first, LLM fallback only if ambiguous.
 */
export async function classifyDomain(
  prompt: string,
  seedEntityId?: string
): Promise<{ domain: Domain; reason: string }> {
  const q = prompt.toLowerCase();

  // 1. Seed entity prefix clues
  if (seedEntityId) {
    const s = seedEntityId.toUpperCase();
    if (s.startsWith('SHIP_') || s.includes('MMSI') || s.includes('IMO')) {
      return { domain: 'maritime', reason: `Inferred from seed entity prefix: ${seedEntityId}` };
    }
    if (
      s.startsWith('STATION_') ||
      s.startsWith('ROAD_') ||
      s.startsWith('HYDRO_') ||
      s.startsWith('SUBSTATION_') ||
      s.startsWith('TRANSIT_') ||
      s.startsWith('GRID_')
    ) {
      return { domain: 'world', reason: `Inferred from physical seed entity ID: ${seedEntityId}` };
    }
  }

  // 2. Cross-domain explicit check
  for (const cross of CROSS_INDICATORS) {
    if (q.includes(cross)) {
      return { domain: 'cross', reason: `Matched explicit cross-domain pattern: "${cross}"` };
    }
  }

  // 3. Keyword frequency scoring
  let maritimeScore = 0;
  let worldScore = 0;
  let logisticsScore = 0;

  for (const kw of MARITIME_KEYWORDS) {
    if (q.includes(kw)) maritimeScore += kw.length > 5 ? 2 : 1;
  }

  for (const kw of WORLD_KEYWORDS) {
    if (q.includes(kw)) worldScore += kw.length > 5 ? 2 : 1;
  }

  for (const kw of LOGISTICS_KEYWORDS) {
    if (q.includes(kw)) logisticsScore += kw.length > 5 ? 2 : 1;
  }

  // Multi-domain intersection check
  const activeDomains = [
    { domain: 'maritime' as Domain, score: maritimeScore },
    { domain: 'world' as Domain, score: worldScore },
    { domain: 'logistics' as Domain, score: logisticsScore },
  ].filter((d) => d.score > 0);

  if (activeDomains.length >= 2) {
    // If two domains both have high scores, route to 'cross'
    const sorted = [...activeDomains].sort((a, b) => b.score - a.score);
    if (sorted[0].score > 0 && sorted[1].score > 0 && sorted[1].score >= sorted[0].score * 0.5) {
      return {
        domain: 'cross',
        reason: `Multi-domain intersection detected (${sorted[0].domain}: ${sorted[0].score}, ${sorted[1].domain}: ${sorted[1].score})`,
      };
    }
  }

  if (maritimeScore > worldScore && maritimeScore > logisticsScore) {
    return { domain: 'maritime', reason: `Maritime keywords matched (score: ${maritimeScore})` };
  }
  if (worldScore > maritimeScore && worldScore > logisticsScore) {
    return { domain: 'world', reason: `World model keywords matched (score: ${worldScore})` };
  }
  if (logisticsScore > maritimeScore && logisticsScore > worldScore) {
    return { domain: 'logistics', reason: `Logistics/dataset keywords matched (score: ${logisticsScore})` };
  }

  // 4. LLM classification if ambiguous and key is present
  if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '' && !GROQ_API_KEY.includes('your_')) {
    try {
      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content:
                'You classify queries into exactly one domain: "world", "logistics", "maritime", or "cross". Respond with ONLY the single word in lowercase.',
            },
            {
              role: 'user',
              content: `Classify this investigation query: "${prompt}"`,
            },
          ],
          temperature: 0.0,
          max_tokens: 10,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const answer = (data.choices?.[0]?.message?.content || '').trim().toLowerCase();
        if (['world', 'logistics', 'maritime', 'cross'].includes(answer)) {
          return { domain: answer as Domain, reason: `LLM classification: ${answer}` };
        }
      }
    } catch (_) {
      // Fallback if LLM call fails
    }
  }

  // Default starting hint: cross to ensure access to all tools when ambiguous
  return { domain: 'cross', reason: 'Ambiguous query; initialized with cross-domain tools' };
}
