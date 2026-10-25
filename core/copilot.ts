/**
 * Local Copilot — a deterministic natural-language intent engine.
 *
 * It turns operator phrasing ("send a drone to inspect the east wing asap",
 * "pause robots in the crane zone") into world commands. It runs everywhere,
 * needs no network, and is the fallback when the Claude-powered copilot is not
 * configured on the server.
 */
import { applyCommand } from './engine';
import { shiftBrief, utilizationByKind } from './insights';
import { TEMPLATES } from './templates';
import type { Capability, Command, CopilotAction, CopilotReply, DispatchPolicy, Priority, Site, World, Zone } from './types';
import { clockLabel, normalize } from './util';

const SITE_WORDS: Record<string, string[]> = {
  hp: ['harbor', 'tower', 'construction', 'jobsite', 'job site', 'oakland'],
  mg: ['mercy', 'hospital', 'plant ops', 'sacramento'],
  bv: ['bayview', 'depot', 'fleet', 'logistics', 'hayward'],
};

const ZONE_ALIASES: Record<string, string[]> = {
  'hp-east': ['east wing', 'east', 'l3', 'level 3'],
  'hp-west': ['west wing', 'west', 'l2', 'level 2'],
  'hp-core': ['core', 'tower core'],
  'hp-crane': ['crane', 'crane zone', 'swing zone'],
  'hp-laydown': ['laydown', 'laydown yard'],
  'hp-elec': ['electrical room', 'elec room'],
  'hp-dock': ['robot dock'],
  'hp-office': ['site office'],
  'mg-roof': ['roof', 'rooftop', 'hvac deck'],
  'mg-mech': ['mechanical room', 'mech room', 'b1', 'basement'],
  'mg-gen': ['generator yard', 'gen yard'],
  'mg-warda': ['ward a'],
  'mg-wardb': ['ward b'],
  'mg-dock': ['loading dock'],
  'bv-dock1': ['dock 1', 'door 1'],
  'bv-dock2': ['dock 2', 'door 2'],
  'bv-dock3': ['dock 3', 'door 3'],
  'bv-service': ['service bay', 'shop'],
  'bv-yard': ['trailer yard'],
  'bv-gate': ['gate', 'scale'],
};

const TEMPLATE_KEYWORDS: [RegExp, Record<string, string>][] = [
  [/facade|envelope|curtain ?wall/, { construction: 'facade-inspection' }],
  [/scan|bim|reality|progress|as.?built/, { construction: 'progress-scan', fleet: 'yard-audit' }],
  [/layout|mark(ing)?\b/, { construction: 'layout' }],
  [/drywall|board|gypsum/, { construction: 'drywall' }],
  [/pour|slab|concrete/, { construction: 'pour-prep' }],
  [/electrical|panel|breaker|thermal/, { construction: 'electrical-rough', maintenance: 'panel-thermal' }],
  [/hvac|ahu|air handler|vibration|chiller|elevator/, { maintenance: 'hvac-anomaly' }],
  [/generator|ats|load.?bank/, { maintenance: 'gen-service' }],
  [/clean|disinfect|uv|terminal/, { maintenance: 'ward-disinfect' }],
  [/membrane|roof (inspection|survey|check)|inspect (the )?roof|leak/, { maintenance: 'roof-inspect' }],
  [/trailer|spot|shunt/, { fleet: 'trailer-move' }],
  [/\bpm\b|preventive|service|brake|repair|maintenance|tractor|truck|van/, { fleet: 'pm-service' }],
  [/audit|yard check|count/, { fleet: 'yard-audit' }],
  [/deliver|delivery|route|outbound|shipment/, { fleet: 'delivery-run', maintenance: 'supply-run', construction: 'material-haul' }],
  [/supply|supplies|linen|pharmacy/, { maintenance: 'supply-run' }],
  [/haul|move|material|bring|stage/, { construction: 'material-haul', fleet: 'trailer-move', maintenance: 'supply-run' }],
  [/inspect|check|look at|survey|drone/, { construction: 'facade-inspection', maintenance: 'roof-inspect', fleet: 'yard-audit' }],
];

const CAPABILITY_WORDS: [RegExp, Capability][] = [
  [/thermal|hot ?spot|infrared/, 'inspect.thermal'],
  [/inspect|check|look/, 'inspect.visual'],
  [/scan|survey/, 'survey.scan'],
  [/haul|move|carry/, 'haul'],
  [/deliver/, 'deliver'],
  [/lift|hoist|rig/, 'lift.heavy'],
  [/weld/, 'weld'],
  [/electric|wiring|breaker|panel/, 'electrical'],
  [/hvac|duct|air/, 'hvac'],
  [/repair|fix|replace|mechanic/, 'repair.mechanical'],
  [/clean|disinfect/, 'clean'],
  [/concrete|pour/, 'concrete'],
  [/drywall/, 'drywall'],
  [/report|permit|compliance/, 'report.compliance'],
];

export interface CopilotContext {
  siteId?: string;
}

function findSite(world: World, text: string, ctx: CopilotContext): Site | undefined {
  for (const [id, words] of Object.entries(SITE_WORDS)) if (words.some((w) => text.includes(w))) return world.sites.find((s) => s.id === id);
  return world.sites.find((s) => s.id === ctx.siteId);
}

function findZone(world: World, text: string, site?: Site): Zone | undefined {
  const zones = (site ? [site] : world.sites).flatMap((s) => s.zones);
  // Longest alias first so "east wing" beats "east".
  const hits: [Zone, number][] = [];
  for (const z of zones) {
    const aliases = [normalize(z.name), ...(ZONE_ALIASES[z.id] ?? [])];
    for (const a of aliases) if (new RegExp(`\\b${a.replace(/[-]/g, '\\-')}\\b`).test(text)) hits.push([z, a.length]);
  }
  hits.sort((a, b) => b[1] - a[1]);
  return hits[0]?.[0];
}

function findAgent(world: World, text: string) {
  let best: { a: World['agents'][number]; len: number } | undefined;
  for (const a of world.agents) {
    const full = normalize(a.name);
    const parts = [full, full.split(' ')[0], a.id.replace(/^[a-z]+-/, '')].filter((p) => p.length >= 2);
    for (const p of parts) if (new RegExp(`\\b${p.replace(/[-]/g, '\\-')}\\b`).test(text) && (!best || p.length > best.len)) best = { a, len: p.length };
  }
  return best?.a;
}

function findAsset(world: World, text: string) {
  return world.assets.find((a) => {
    const n = normalize(a.name);
    const tag = n.match(/[a-z]*\s?-?\d+$/)?.[0]?.replace(/\s/g, '');
    return text.includes(n) || (!!tag && tag.length >= 3 && text.replace(/\s/g, '').includes(tag));
  });
}

function priorityFrom(text: string): Priority | undefined {
  if (/\b(urgent|asap|immediately|now|critical|emergency|p1)\b/.test(text)) return 'P1';
  if (/\b(high|soon|p2|today)\b/.test(text)) return 'P2';
  if (/\b(low|whenever|p4|eventually)\b/.test(text)) return 'P4';
  return undefined;
}

function run(world: World, actions: CopilotAction[], command: Command) {
  const result = applyCommand(world, command);
  actions.push({ command, result });
  return result;
}

export const COPILOT_EXAMPLES = [
  'Send a drone to inspect the east wing facade asap',
  'Pause robots in the crane zone',
  'Who is idle at the depot?',
  'Where is Maria?',
  'Optimise for safety',
  'Spill reported in Ward B',
  'Give me the shift brief',
  'Disinfect Ward A',
];

export function runLocalCopilot(world: World, input: string, ctx: CopilotContext = {}): CopilotReply {
  const text = normalize(input);
  const actions: CopilotAction[] = [];
  const site = findSite(world, text, ctx);
  // Prefer zones at the site in view, but let operators name any zone anywhere.
  const zone = findZone(world, text, site) ?? findZone(world, text);
  const reply = (r: string): CopilotReply => ({ reply: r, actions, engine: 'local' });

  if (!text) return reply('Ask me to dispatch work, pause machines, find someone, or brief you on the shift.');

  if (/^(help|\?)$|what can you do|commands/.test(text)) {
    return reply(`I coordinate people, robots and AI across your sites. Try:\n${COPILOT_EXAMPLES.map((e) => `• ${e}`).join('\n')}`);
  }

  // Safety first: E-stop, hazards, pauses.
  if (/\b(e ?stop|emergency stop|stop everything|halt everything|stop all)\b/.test(text)) {
    const s = site ?? world.sites[0];
    const r = run(world, actions, { type: 'estop_site', siteId: s.id });
    return reply(`${r.message}. Humans keep working; every robot, drone and vehicle at ${s.name} holds position until you release them.`);
  }

  if (/\b(spill|hazard|unsafe|injur|fire|smoke|gas|leak|trip|exposed wire|collapse)\b/.test(text) && !/\binspect\b/.test(text)) {
    if (!zone) return reply('Where is the hazard? Name the zone (e.g. "spill in Ward B") so I can fence it off.');
    const note = input.trim().replace(/\s+/g, ' ').slice(0, 120);
    const r = run(world, actions, { type: 'report_hazard', siteId: zone.siteId, zoneId: zone.id, note });
    return reply(`${r.message}. I've opened a high-severity incident and paged the site supervisor.`);
  }

  if (/\b(pause|halt|freeze|hold|stop|clear)\b/.test(text) && /\b(robot|robots|machine|machines|drone|drones|vehicle|vehicles|autonomous|bots|everything|zone|equipment)\b/.test(text)) {
    if (!zone) return reply('Which zone should I pause? For example: "pause robots in the crane zone".');
    const r = run(world, actions, { type: 'pause_zone', zoneId: zone.id, reason: 'operator request via Copilot' });
    return reply(`${r.message}. Machines en route have been re-planned; people inside are unaffected.`);
  }

  if (/\b(resume|release|unpause|restart|continue|all clear)\b/.test(text)) {
    if (zone) {
      const r = run(world, actions, { type: 'resume_zone', zoneId: zone.id });
      return reply(r.message + '.');
    }
    if (site) {
      const r = run(world, actions, { type: 'release_site', siteId: site.id });
      return reply(r.message + '.');
    }
    return reply('Which zone or site should I release?');
  }

  const policyMatch = /\b(policy|optimi[sz]e|prioriti[sz]e|favor|favour|mode)\b/.test(text);
  if (policyMatch) {
    const p: DispatchPolicy | undefined = /fast|speed|quick/.test(text)
      ? 'fastest'
      : /cheap|cost|budget|money/.test(text)
        ? 'cheapest'
        : /safe/.test(text)
          ? 'safest'
          : /balanc|default|normal/.test(text)
            ? 'balanced'
            : undefined;
    if (p) {
      const r = run(world, actions, { type: 'set_policy', policy: p });
      return reply(`${r.message}. New assignments will be ranked accordingly; in-flight work is not disturbed.`);
    }
  }

  if (/\bwhere('?s| is| are)\b|\blocate\b|\bfind\b/.test(text)) {
    const agent = findAgent(world, text);
    if (agent) {
      if (agent.kind === 'ai') return reply(`${agent.name} is a software agent — it runs in the cloud and is currently ${agent.taskRef ? 'working' : 'idle'}.`);
      const s = world.sites.find((x) => x.id === agent.siteId)!;
      const z = s.zones.find((zz) => agent.pos.x >= zz.rect.x && agent.pos.x <= zz.rect.x + zz.rect.w && agent.pos.y >= zz.rect.y && agent.pos.y <= zz.rect.y + zz.rect.h);
      const task = agent.taskRef ? world.workOrders.find((w) => w.id === agent.taskRef!.workOrderId) : undefined;
      return reply(
        `${agent.name} (${agent.role}) is ${z ? `in ${z.name}` : 'between zones'} at ${s.name}, ${agent.status}${task ? ` on ${task.code} · ${task.steps[agent.taskRef!.stepIndex].label}` : ''}. ${agent.kind === 'human' ? 'Shift energy' : 'Battery'} ${Math.round(agent.battery)}%.`,
      );
    }
  }

  if (/\b(idle|available|free|unassigned|spare)\b/.test(text)) {
    const pool = world.agents.filter((a) => !a.taskRef && a.status !== 'offline' && (!site || a.siteId === site.id || a.siteId === '*'));
    if (!pool.length) return reply(`Everyone ${site ? `at ${site.name} ` : ''}is busy right now.`);
    const fmt = pool.slice(0, 12).map((a) => `• ${a.name} — ${a.role}${a.status === 'charging' ? ' (charging)' : ''}`);
    return reply(`${pool.length} agent${pool.length > 1 ? 's' : ''} available${site ? ` at ${site.name}` : ''}:\n${fmt.join('\n')}`);
  }

  if (/\b(recall|send .* (to )?charge|charge|dock)\b/.test(text)) {
    const agent = findAgent(world, text);
    if (agent) {
      const r = run(world, actions, { type: 'recall_agent', agentId: agent.id });
      return reply(r.message + '.');
    }
  }

  if (/\b(status|summary|brief|briefing|how are we|how is|report|shift|overview|update)\b/.test(text) && !/\bcreate|schedule|dispatch\b/.test(text)) {
    const u = utilizationByKind(world, site?.id);
    const extra = `\nAgents busy — humans ${u.human.busy}/${u.human.total}, robots ${u.robot.busy}/${u.robot.total}, drones ${u.drone.busy}/${u.drone.total}, vehicles ${u.vehicle.busy}/${u.vehicle.total}, AI ${u.ai.busy}/${u.ai.total}.`;
    return reply(shiftBrief(world, site?.id) + extra);
  }

  // Work creation
  const wantsWork = /\b(send|dispatch|create|schedule|need|inspect|scan|haul|move|deliver|fix|repair|replace|weld|clean|disinfect|check|survey|layout|pour|service|audit|bring|stage|hang|diagnose)\b/.test(text);
  const asset = findAsset(world, text);
  if (wantsWork && asset) {
    const template = TEMPLATES.find((t) => t.assetTypes?.includes(asset.type));
    if (template && !asset.openWorkOrderId) {
      const r = run(world, actions, { type: 'create_work_order', templateId: template.id, siteId: asset.siteId, assetId: asset.id, priority: priorityFrom(text), source: 'copilot' });
      if (r.ok) {
        const wo = world.workOrders.find((w) => w.id === r.workOrderId)!;
        return reply(`${r.message} (${wo.priority}). Asset health is ${Math.round(asset.health)}.\nPlan: ${wo.steps.map((st, i) => `${i + 1}. ${st.label}`).join('  →  ')}`);
      }
    } else if (asset.openWorkOrderId) {
      const open = world.workOrders.find((w) => w.id === asset.openWorkOrderId);
      return reply(`${asset.name} already has ${open?.code ?? 'an open work order'} in progress — no duplicate created.`);
    }
  }
  if (wantsWork) {
    const s = zone ? world.sites.find((x) => x.id === zone.siteId)! : site;
    if (!s) return reply('Which site is this for — Harbor Point Tower, Mercy General, or Bayview Depot?');
    const priority = priorityFrom(text);
    for (const [re, map] of TEMPLATE_KEYWORDS) {
      if (!re.test(text)) continue;
      const templateId = map[s.vertical];
      if (!templateId) continue;
      const template = TEMPLATES.find((t) => t.id === templateId)!;
      const r = run(world, actions, { type: 'create_work_order', templateId, siteId: s.id, zoneId: template.assetTypes ? undefined : zone?.id, priority, source: 'copilot' });
      if (!r.ok) return reply(`I couldn't create that: ${r.message}.`);
      const wo = world.workOrders.find((w) => w.id === r.workOrderId)!;
      const who = wo.steps[0].assigneeId ? world.agents.find((a) => a.id === wo.steps[0].assigneeId) : undefined;
      const plan = wo.steps.map((st, i) => `${i + 1}. ${st.label}`).join('  →  ');
      const askedKind = (['drone', 'robot', 'vehicle'] as const).find((k) => new RegExp(`\\b${k}s?\\b`).test(text));
      const note =
        askedKind && who && who.kind !== askedKind
          ? `\nNo ${askedKind} was free and qualified, so the dispatcher chose ${who.name} instead — reassign from the work order if you'd rather wait.`
          : '';
      return reply(
        `${r.message} (${wo.priority}, due ${clockLabel(wo.dueAt)}).\nPlan: ${plan}\n${who ? `${who.name} is already on step 1 (score ${wo.steps[0].assignment?.score}).` : 'Waiting for a qualified agent — I\'ll dispatch the moment one frees up.'}${note}`,
      );
    }
    const caps = CAPABILITY_WORDS.filter(([re]) => re.test(text)).map(([, c]) => c);
    if (caps.length) {
      const title = input.trim().replace(/^(please\s+)?(can you\s+)?/i, '').slice(0, 80);
      const r = run(world, actions, { type: 'create_custom_work_order', siteId: s.id, zoneId: zone?.id, title: title[0].toUpperCase() + title.slice(1), requires: [...new Set(caps)].slice(0, 2), priority, source: 'copilot' });
      return reply(`${r.message}. Requires ${[...new Set(caps)].slice(0, 2).join(' + ')}.`);
    }
  }

  return reply("I didn't catch an action there. I can dispatch work (\"inspect the roof\"), pause or resume machines in a zone, report hazards, change the dispatch policy, find people and robots, or brief you on the shift.");
}
