import { Domain } from './types.js';
import { getCloudLlmConfig, getOllamaConfig, isOllamaAvailable, LlmConfig } from './providers.js';
import dotenv from 'dotenv';

dotenv.config();

function getLlmConfig(): LlmConfig {
  return getCloudLlmConfig();
}

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

export function extractQueryIdentifiers(prompt: string): string[] {
  const matches = new Set<string>();
  if (!prompt || typeof prompt !== 'string') return [];

  // 1. IP Addresses (IPv4)
  const ips = prompt.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
  ips.forEach((ip) => matches.add(ip));

  // 2. Structured Identifiers (e.g. SES_..., NET-..., AUTH-..., TCK-..., AST-..., USR_..., INC-..., etc.)
  const structuredIds = prompt.match(/\b[A-Za-z]{2,5}[-_][A-Za-z0-9-_]{2,}\b/g) || [];
  structuredIds.forEach((id) => matches.add(id));

  // 3. Quoted tokens (e.g. "AUTH-20261014-023", '07_incident_tickets.csv')
  const quoted = prompt.match(/['"]([^'"]{3,})['"]/g) || [];
  quoted.forEach((q) => matches.add(q.replace(/['"]/g, '').trim()));

  // 4. File names with extensions
  const files = prompt.match(/\b\w+\.(csv|json|xlsx|parquet|tsv|log)\b/gi) || [];
  files.forEach((f) => matches.add(f));

  // 5. Maritime or tracking numbers (IMO, MMSI, or 7-9 digit tracking IDs)
  const labeledNumbers = prompt.match(/\b(?:IMO|MMSI|TRACK|CONTAINER|PO|ORDER|SHIPMENT)\s*[:#]?\s*([A-Za-z0-9]{5,12})\b/gi) || [];
  labeledNumbers.forEach((ln) => {
    const rawVal = ln.replace(/^(?:IMO|MMSI|TRACK|CONTAINER|PO|ORDER|SHIPMENT)\s*[:#]?\s*/i, '').trim();
    if (rawVal) {
      matches.add(rawVal);
      matches.add(ln.trim());
    }
  });

  return Array.from(matches);
}

const TABULAR_DATASET_KEYWORDS = [
  'dataset', 'datasets', 'file', 'files', 'csv', 'upload', 'uploads', 'column', 'columns', 'schema',
  'raw record', 'records', 'table', 'tables', 'catalog', 'ingested', 'ingestion',
  'customer', 'customers', 'invoice', 'invoices', 'payment', 'payments', 'supplier', 'suppliers',
  'vendor', 'vendors', 'shipment', 'shipments', 'order', 'orders', 'transaction', 'transactions',
  'account', 'accounts', 'bank', 'transfer', 'transfers', 'amount', 'ledger', 'balance', 'patient', 'hospital',
  'auth', 'authentication', 'session', 'sessions', 'credential', 'credentials', 'token', 'tokens', 'login', 'logout',
  'network', 'connection', 'connections', 'ip', 'port', 'ports', 'egress', 'ingress', 'packet', 'packets', 'traffic',
  'endpoint', 'endpoints', 'process', 'processes', 'command', 'commands', 'hash', 'executable', 'registry',
  'ticket', 'tickets', 'incident', 'incidents', 'alert', 'alerts', 'siem', 'soc', 'audit', 'event', 'events', 'log', 'logs',
  'hub', 'hubs', 'bridge', 'bridges', 'collision', 'collisions', 'degree', 'isolated', 'graph stats',
  'entity', 'entities', 'foreign key', 'cross-dataset',
  'warehouse', 'warehouses', 'manifest', 'manifests', 'inventory', 'tracking', 'container', 'containers', 'freight', 'cargo', 'supply chain',
];

const LOGISTICS_KEYWORDS = TABULAR_DATASET_KEYWORDS;

const CROSS_INDICATORS = [
  'cross-domain', 'cross-source', 'correlate', 'correlation', 'impact of weather', 'affect shipment',
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
): Promise<{ domain: Domain; reason: string; effectiveSeedEntityId?: string; extractedIds: string[] }> {
  const q = prompt.toLowerCase();
  const extractedIds = extractQueryIdentifiers(prompt);

  // If prompt has specific new identifiers, check if seedEntityId is mentioned
  let effectiveSeedEntityId = seedEntityId;
  if (seedEntityId && !prompt.includes(seedEntityId) && extractedIds.length > 0) {
    // If the prompt asks about different IDs and doesn't mention the old seed, clear the stale seed!
    effectiveSeedEntityId = undefined;
  }

  // 1. Seed entity prefix clues
  if (effectiveSeedEntityId) {
    const s = effectiveSeedEntityId.toUpperCase();
    if (s.startsWith('SHIP_') || s.includes('MMSI') || s.includes('IMO')) {
      return { domain: 'maritime', reason: `Inferred from seed entity prefix: ${effectiveSeedEntityId}`, effectiveSeedEntityId, extractedIds };
    }
    if (
      s.startsWith('STATION_') ||
      s.startsWith('ROAD_') ||
      s.startsWith('HYDRO_') ||
      s.startsWith('SUBSTATION_') ||
      s.startsWith('TRANSIT_') ||
      s.startsWith('GRID_')
    ) {
      return { domain: 'world', reason: `Inferred from physical seed entity ID: ${effectiveSeedEntityId}`, effectiveSeedEntityId, extractedIds };
    }
  }

  // 2. Cross-domain explicit check with word boundaries
  for (const cross of CROSS_INDICATORS) {
    const rx = new RegExp(`\\b${cross.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (rx.test(prompt)) {
      return { domain: 'cross', reason: `Matched explicit cross-domain pattern: "${cross}"`, effectiveSeedEntityId, extractedIds };
    }
  }

  // 3. Keyword frequency scoring with word boundary matching
  let maritimeScore = 0;
  let worldScore = 0;
  let logisticsScore = 0;

  for (const kw of MARITIME_KEYWORDS) {
    const rx = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (rx.test(prompt)) maritimeScore += kw.length > 5 ? 2 : 1;
  }

  for (const kw of WORLD_KEYWORDS) {
    const rx = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (rx.test(prompt)) worldScore += kw.length > 5 ? 2 : 1;
  }

  for (const kw of LOGISTICS_KEYWORDS) {
    const rx = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (rx.test(prompt)) logisticsScore += kw.length > 5 ? 2 : 1;
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
        effectiveSeedEntityId,
        extractedIds,
      };
    }
  }

  if (maritimeScore > worldScore && maritimeScore > logisticsScore) {
    return { domain: 'maritime', reason: `Maritime keywords matched (score: ${maritimeScore})`, effectiveSeedEntityId, extractedIds };
  }
  if (worldScore > maritimeScore && worldScore > logisticsScore) {
    return { domain: 'world', reason: `World model keywords matched (score: ${worldScore})`, effectiveSeedEntityId, extractedIds };
  }
  if (logisticsScore > maritimeScore && logisticsScore > worldScore) {
    return { domain: 'logistics', reason: `Logistics/dataset keywords matched (score: ${logisticsScore})`, effectiveSeedEntityId, extractedIds };
  }

  // 4. LLM classification if ambiguous (Local Ollama LLaMA only)
  if (await isOllamaAvailable()) {
    const cfg = getOllamaConfig();
    try {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
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
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const answer = (data.choices?.[0]?.message?.content || '').trim().toLowerCase();
        if (['world', 'logistics', 'maritime', 'cross'].includes(answer)) {
          return { domain: answer as Domain, reason: `${cfg.provider} classification: ${answer}`, effectiveSeedEntityId, extractedIds };
        }
      }
    } catch (_) {
      // Fall through to cross
    }
  }

  // Default starting hint: cross to ensure access to all tools when ambiguous
  return { domain: 'cross', reason: 'Ambiguous query; initialized with cross-domain tools', effectiveSeedEntityId, extractedIds };
}
