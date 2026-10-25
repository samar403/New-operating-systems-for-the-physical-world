/**
 * Claude-powered Copilot. Enabled when ANTHROPIC_API_KEY (or another
 * Anthropic credential) is configured on the server. Claude reads a compact
 * view of the world and operates it through the same commands the UI uses —
 * so every action stays validated by the engine and lands in the audit log.
 */
import Anthropic from '@anthropic-ai/sdk';
import {
  applyCommand,
  clockLabel,
  kpis,
  openOrders,
  shiftBrief,
  TEMPLATES,
  type Command,
  type CopilotAction,
  type CopilotReply,
  type World,
} from '../core/index';

const MODEL = process.env.STRATA_MODEL ?? 'claude-opus-5-5';

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const str = { type: 'string' } as const;
const priority = { type: 'string', enum: ['P1', 'P2', 'P3', 'P4'] } as const;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'create_work_order',
    description:
      'Create a work order from a template. The dispatcher then assigns each step to the best human, robot, drone, vehicle or AI agent automatically. Template must match the site vertical. For asset templates, pass asset_id instead of zone_id.',
    input_schema: {
      type: 'object',
      properties: { template_id: str, site_id: str, zone_id: str, asset_id: str, priority, title: { type: 'string', description: 'Optional custom title' } },
      required: ['template_id', 'site_id'],
    },
  },
  {
    name: 'create_custom_work_order',
    description: 'Create a one-step work order when no template fits. Choose 1-2 capabilities the job requires.',
    input_schema: {
      type: 'object',
      properties: {
        site_id: str,
        zone_id: str,
        title: str,
        requires: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
        priority,
        duration_min: { type: 'number' },
      },
      required: ['site_id', 'title', 'requires'],
    },
  },
  {
    name: 'pause_zone',
    description: 'Pause all robots, drones and autonomous vehicles inside a zone (people keep working). Use for safety concerns.',
    input_schema: { type: 'object', properties: { zone_id: str, reason: str }, required: ['zone_id'] },
  },
  { name: 'resume_zone', description: 'Release machines in a previously paused zone.', input_schema: { type: 'object', properties: { zone_id: str }, required: ['zone_id'] } },
  { name: 'estop_site', description: 'Emergency-stop every machine at a site. Only when the operator asks for an e-stop or there is imminent danger.', input_schema: { type: 'object', properties: { site_id: str }, required: ['site_id'] } },
  { name: 'release_site', description: 'Release a site-wide e-stop.', input_schema: { type: 'object', properties: { site_id: str }, required: ['site_id'] } },
  {
    name: 'set_policy',
    description: 'Change how the dispatcher ranks candidates for new assignments.',
    input_schema: { type: 'object', properties: { policy: { type: 'string', enum: ['balanced', 'fastest', 'cheapest', 'safest'] } }, required: ['policy'] },
  },
  { name: 'recall_agent', description: 'Send a robot, drone or vehicle back to its charger, releasing its current step.', input_schema: { type: 'object', properties: { agent_id: str }, required: ['agent_id'] } },
  {
    name: 'reassign_step',
    description: 'Assign the current step of a work order to a specific idle, qualified agent.',
    input_schema: { type: 'object', properties: { work_order_id: str, agent_id: str }, required: ['work_order_id', 'agent_id'] },
  },
  {
    name: 'report_hazard',
    description: 'Log a hazard in a zone: opens a high-severity incident and pauses machines there.',
    input_schema: { type: 'object', properties: { site_id: str, zone_id: str, note: str }, required: ['site_id', 'zone_id', 'note'] },
  },
  {
    name: 'get_live_state',
    description: 'Get the live state of a site (or all sites): agents with status/position/battery/current task, open work orders, assets, incidents.',
    input_schema: { type: 'object', properties: { site_id: str } },
  },
];

function catalog(world: World): string {
  const sites = world.sites
    .map((s) => `- ${s.id}: ${s.name} (${s.vertical}). Zones: ${s.zones.map((z) => `${z.id} "${z.name}"${z.hazard ? ` [${z.hazard}]` : ''}${z.humanOnly ? ' [human-only]' : ''}`).join(', ')}`)
    .join('\n');
  const templates = TEMPLATES.map((t) => `- ${t.id} (${t.vertical}${t.assetTypes ? `, asset: ${t.assetTypes.join('/')}` : ''}): ${t.summary}`).join('\n');
  const assets = world.assets.map((a) => `- ${a.id}: ${a.name} (${a.type}) at ${a.siteId}`).join('\n');
  return `Sites:\n${sites}\n\nTemplates:\n${templates}\n\nAssets:\n${assets}`;
}

const SYSTEM = `You are Strata Copilot, the operations copilot inside Strata — an operating system that coordinates human crews, robots, drones, autonomous vehicles and AI agents across construction sites, facility maintenance and vehicle fleets.

You act on the live world through tools. The dispatcher assigns agents automatically using hard safety constraints (capabilities, certifications, geofences, battery) and a weighted policy, so you usually create work and let it dispatch rather than picking agents yourself.

How to work:
- Resolve site, zone and asset ids from the catalog. If the operator's request is ambiguous about where, ask one short question instead of guessing.
- Safety requests (hazards, pausing machines, e-stops) take precedence; act immediately when the location is clear.
- Never e-stop a site unless the operator explicitly asks or describes imminent danger.
- After acting, reply in 1-4 short sentences: what you did, who picked it up if known, and anything the operator should watch. Use work order codes (WO-1234). No markdown headings.`;

function toCommand(name: string, input: Record<string, unknown>): Command | null {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined);
  switch (name) {
    case 'create_work_order':
      return { type: 'create_work_order', templateId: s('template_id')!, siteId: s('site_id')!, zoneId: s('zone_id'), assetId: s('asset_id'), priority: s('priority') as never, title: s('title'), source: 'copilot' };
    case 'create_custom_work_order':
      return {
        type: 'create_custom_work_order',
        siteId: s('site_id')!,
        zoneId: s('zone_id'),
        title: s('title') ?? 'Custom task',
        requires: Array.isArray(input.requires) ? (input.requires as never[]) : [],
        priority: s('priority') as never,
        durationMin: typeof input.duration_min === 'number' ? input.duration_min : undefined,
        source: 'copilot',
      };
    case 'pause_zone':
      return { type: 'pause_zone', zoneId: s('zone_id')!, reason: s('reason') };
    case 'resume_zone':
      return { type: 'resume_zone', zoneId: s('zone_id')! };
    case 'estop_site':
      return { type: 'estop_site', siteId: s('site_id')! };
    case 'release_site':
      return { type: 'release_site', siteId: s('site_id')! };
    case 'set_policy':
      return { type: 'set_policy', policy: s('policy') as never };
    case 'recall_agent':
      return { type: 'recall_agent', agentId: s('agent_id')! };
    case 'reassign_step':
      return { type: 'reassign_step', workOrderId: s('work_order_id')!, agentId: s('agent_id')! };
    case 'report_hazard':
      return { type: 'report_hazard', siteId: s('site_id')!, zoneId: s('zone_id')!, note: s('note') ?? 'Hazard reported' };
    default:
      return null;
  }
}

function liveState(world: World, siteId?: string) {
  const agents = world.agents
    .filter((a) => !siteId || a.siteId === siteId || a.siteId === '*')
    .map((a) => {
      const wo = a.taskRef ? world.workOrders.find((w) => w.id === a.taskRef!.workOrderId) : undefined;
      return { id: a.id, name: a.name, kind: a.kind, role: a.role, site: a.siteId, status: a.status, battery: Math.round(a.battery), pos: a.pos, task: wo ? `${wo.code} · ${wo.steps[a.taskRef!.stepIndex].label}` : null };
    });
  const orders = openOrders(world, siteId).map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    priority: o.priority,
    status: o.status,
    zone: o.zoneId,
    due: clockLabel(o.dueAt),
    step: `${o.currentStep + 1}/${o.steps.length} ${o.steps[o.currentStep]?.label} (${o.steps[o.currentStep]?.status})`,
    assignee: o.steps[o.currentStep]?.assigneeId,
  }));
  const assets = world.assets.filter((a) => !siteId || a.siteId === siteId).map((a) => ({ id: a.id, name: a.name, health: Math.round(a.health), openWorkOrder: a.openWorkOrderId }));
  const incidents = world.incidents.filter((i) => !i.resolved && (!siteId || i.siteId === siteId)).slice(0, 10);
  return { clock: clockLabel(world.clock), policy: world.policy, kpis: kpis(world), agents, orders, assets, incidents };
}

export async function runClaudeCopilot(world: World, input: string, ctx: { siteId?: string }): Promise<CopilotReply> {
  const actions: CopilotAction[] = [];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Operator is viewing site: ${ctx.siteId ?? 'all'}. Time ${clockLabel(world.clock)}.\nCurrent brief:\n${shiftBrief(world, ctx.siteId)}\n\nOperator: ${input}`,
    },
  ];

  for (let i = 0; i < 6; i++) {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM },
        { type: 'text', text: catalog(world), cache_control: { type: 'ephemeral' } },
      ],
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'refusal') throw new Error('Copilot request was declined');
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { reply: text || 'Done.', actions, engine: 'claude' };
    }

    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
      const args = (tu.input ?? {}) as Record<string, unknown>;
      if (tu.name === 'get_live_state') {
        return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(liveState(world, typeof args.site_id === 'string' ? args.site_id : undefined)) };
      }
      const command = toCommand(tu.name, args);
      if (!command) return { type: 'tool_result', tool_use_id: tu.id, content: `Unknown tool ${tu.name}`, is_error: true };
      const result = applyCommand(world, command);
      actions.push({ command, result });
      const wo = result.workOrderId ? world.workOrders.find((w) => w.id === result.workOrderId) : undefined;
      const assignee = wo?.steps[0].assigneeId ? world.agents.find((a) => a.id === wo.steps[0].assigneeId)?.name : null;
      return {
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify({ ...result, firstStepAssignee: assignee ?? undefined }),
        is_error: !result.ok,
      };
    });
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'I took the actions above but ran out of steps to summarise — check the event log.', actions, engine: 'claude' };
}
