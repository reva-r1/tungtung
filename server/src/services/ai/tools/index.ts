import { ToolDefinition, Domain, InvestigationContext } from '../types.js';
import { worldTools } from './worldTools.js';
import { logisticsTools } from './logisticsTools.js';
import { maritimeTools } from './maritimeTools.js';

export const metaTools: ToolDefinition[] = [
  {
    name: 'propose_relationship',
    description: 'Propose a novel or latent link between two entities that no existing rule created. This is stored strictly in memory for this investigation run and labeled PROPOSED.',
    domain: 'meta',
    parameters: {
      type: 'object',
      properties: {
        source_id: { type: 'string', description: 'Originating entity ID (e.g. SHIP_123, ROAD_CORRIDOR_NH48, or dataset entity ID)' },
        target_id: { type: 'string', description: 'Target entity ID' },
        type: { type: 'string', description: 'Relationship type e.g. SUSPECTED_SUPPLY_CONDUIT, CORRIDOR_DISRUPTION_IMPACT, CARGO_TRANSSHIPMENT_AFFINITY' },
        rationale: { type: 'string', description: 'Detailed analytical rationale explaining why this relationship is plausible' },
      },
      required: ['source_id', 'target_id', 'type', 'rationale'],
    },
    execute: (args, context) => {
      const item = {
        source_id: String(args.source_id),
        target_id: String(args.target_id),
        type: String(args.type).toUpperCase(),
        rationale: String(args.rationale),
        status: 'PROPOSED' as const,
      };
      if (context) {
        context.proposedRelationships.push(item);
        context.trace.push({
          step: 'propose_relationship',
          detail: { source: item.source_id, target: item.target_id, type: item.type },
          timestamp: new Date().toISOString(),
        });
      }
      return {
        status: 'PROPOSED',
        message: `Proposed relationship recorded: ${item.source_id} -[${item.type}]-> ${item.target_id}`,
        item,
      };
    },
  },
  {
    name: 'note_missing_data',
    description: 'Record specific data, sensor telemetry, dataset columns, or manifests that you wished were available to test your ideas.',
    domain: 'meta',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Description of the missing data or blind spot' },
      },
      required: ['description'],
    },
    execute: (args, context) => {
      const desc = String(args.description);
      if (context) {
        context.dataGaps.push(desc);
        context.trace.push({
          step: 'note_missing_data',
          detail: { description: desc },
          timestamp: new Date().toISOString(),
        });
      }
      return {
        recorded: true,
        dataGap: desc,
      };
    },
  },
  {
    name: 'request_domain_tools',
    description: 'Unlock tools from another domain mid-investigation when cross-domain correlations are discovered (e.g. weather impacting logistics, maritime congestion impacting rail/corridor).',
    domain: 'meta',
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          enum: ['world', 'logistics', 'maritime'],
          description: 'The domain of tools to unlock for subsequent iterations',
        },
        reason: {
          type: 'string',
          description: 'Analytical reasoning for why tools from this domain are needed to complete the investigation',
        },
      },
      required: ['domain', 'reason'],
    },
    execute: (args, context) => {
      const domain = args.domain as Domain;
      const reason = String(args.reason);
      if (context) {
        context.unlockedDomains.add(domain);
        context.domainUnlockLogs.push({
          domain,
          reason,
          timestamp: new Date().toISOString(),
        });
        context.trace.push({
          step: 'request_domain_tools',
          detail: { domain, reason },
          timestamp: new Date().toISOString(),
        });
      }
      return {
        unlocked: domain,
        message: `Domain '${domain}' tools successfully unlocked. You may call tools from this domain now.`,
      };
    },
  },
];

// Unified Tool Registry
export const allTools: ToolDefinition[] = [
  ...worldTools,
  ...logisticsTools,
  ...maritimeTools,
  ...metaTools,
];

// Lookup Map by Name
export const toolRegistry = new Map<string, ToolDefinition>(
  allTools.map((t) => [t.name, t])
);

/**
 * Returns available ToolDefinitions based on primary domain and unlocked domains
 */
export function getActiveTools(primaryDomain: Domain, unlockedDomains: Set<Domain>): ToolDefinition[] {
  const allowedDomains = new Set<string>(['meta']);

  if (primaryDomain === 'cross') {
    allowedDomains.add('world');
    allowedDomains.add('logistics');
    allowedDomains.add('maritime');
  } else {
    allowedDomains.add(primaryDomain);
  }

  for (const d of unlockedDomains) {
    allowedDomains.add(d);
  }

  return allTools.filter((t) => allowedDomains.has(t.domain));
}

/**
 * Convert ToolDefinitions to OpenAI / Groq tool schema format
 */
export function toOpenAiTools(tools: ToolDefinition[]): any[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Execute any tool by name with context
 */
export async function executeToolByName(
  name: string,
  args: Record<string, any>,
  context: InvestigationContext
): Promise<any> {
  const tool = toolRegistry.get(name);
  if (!tool) {
    return { error: `Tool "${name}" is not recognized.` };
  }
  return tool.execute(args, context);
}

export { worldTools, logisticsTools, maritimeTools };
