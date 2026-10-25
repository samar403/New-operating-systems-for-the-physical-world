/**
 * The Strata world engine. Pure, deterministic (seeded) and isomorphic: the
 * same code runs on the API server and — for offline / edge mode — in the
 * browser.
 */
import { DRAIN, isMachine, rankCandidates, siteOf } from './dispatch';
import { createAgents, createAssets, createSites } from './seed';
import { TEMPLATES, templateById, type Template } from './templates';
import type {
  Agent,
  Asset,
  Command,
  CommandResult,
  EventKind,
  EventLevel,
  Priority,
  SafetyIncident,
  Snapshot,
  Step,
  WorkOrder,
  WorldEvent,
  World,
  Zone,
} from './types';
import { center, clamp, clockLabel, dist, inRect, nextRandom, pick, pointIn, round } from './util';

const PRIORITY_RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
const HUMAN_BASELINE_RATE = 85;
const MAX_EVENTS = 250;
const PROXIMITY_RADIUS = 3.5;

export function createWorld(seed = 7, opts: { warmupMinutes?: number } = {}): World {
  const world: World = {
    seed,
    rng: seed,
    tick: 0,
    clock: 0,
    minutesPerTick: 0.25,
    running: true,
    policy: 'balanced',
    sites: createSites(),
    agents: createAgents(),
    assets: createAssets(),
    workOrders: [],
    events: [],
    incidents: [],
    metrics: {
      completed: 0,
      onTime: 0,
      late: 0,
      interlocks: 0,
      hazardsReported: 0,
      autonomousMinutes: 0,
      humanMinutes: 0,
      aiMinutes: 0,
      costSpent: 0,
      costBaseline: 0,
      assignLatencySum: 0,
      assignCount: 0,
      series: [],
    },
    counters: { wo: 1040, ev: 0, inc: 0 },
  };

  log(world, 'info', 'system', null, 'Shift started. Strata is coordinating 3 sites.');
  const opening: [string, string, string?][] = [
    ['hp', 'facade-inspection', 'hp-east'],
    ['hp', 'material-haul', 'hp-core'],
    ['hp', 'layout', 'hp-west'],
    ['hp', 'electrical-rough', 'hp-elec'],
    ['mg', 'ward-disinfect', 'mg-warda'],
    ['mg', 'supply-run', 'mg-wardb'],
    ['mg', 'roof-inspect', 'mg-roof'],
    ['bv', 'delivery-run', 'bv-dock2'],
    ['bv', 'trailer-move', 'bv-dock1'],
    ['bv', 'yard-audit', 'bv-yard'],
  ];
  for (const [siteId, templateId, zoneId] of opening) {
    createFromTemplate(world, templateById(templateId)!, siteId, { zoneId, source: 'schedule' });
  }

  const warm = opts.warmupMinutes ?? 0;
  const ticks = Math.round(warm / world.minutesPerTick);
  for (let i = 0; i < ticks; i++) step(world);
  return world;
}

// ────────────────────────────────────────────────────────────── events

export function log(
  world: World,
  level: EventLevel,
  kind: EventKind,
  siteId: string | null,
  message: string,
  refs?: WorldEvent['refs'],
): WorldEvent {
  const ev: WorldEvent = { id: `ev-${++world.counters.ev}`, t: round(world.clock, 2), level, kind, siteId, message, refs };
  world.events.unshift(ev);
  if (world.events.length > MAX_EVENTS) world.events.length = MAX_EVENTS;
  return ev;
}

const agentById = (world: World, id: string | null | undefined) => world.agents.find((a) => a.id === id);
const woById = (world: World, id: string) => world.workOrders.find((w) => w.id === id);

// ────────────────────────────────────────────────────────────── work orders

interface CreateOpts {
  zoneId?: string;
  priority?: Priority;
  title?: string;
  source?: WorkOrder['source'];
  assetId?: string;
}

function chooseZone(world: World, siteId: string, template: Template, zoneId?: string): Zone | undefined {
  const site = siteOf(world, siteId);
  if (!site) return undefined;
  if (zoneId) return site.zones.find((z) => z.id === zoneId);
  const candidates = template.zoneIds
    ? site.zones.filter((z) => template.zoneIds!.includes(z.id))
    : site.zones.filter((z) => template.zoneKinds.includes(z.kind));
  return candidates.length ? pick(world, candidates) : site.zones[0];
}

export function createFromTemplate(world: World, template: Template, siteId: string, opts: CreateOpts = {}): WorkOrder | null {
  const site = siteOf(world, siteId);
  if (!site) return null;
  let asset: Asset | undefined;
  if (template.assetTypes) {
    asset = opts.assetId
      ? world.assets.find((a) => a.id === opts.assetId)
      : world.assets.find((a) => a.siteId === siteId && template.assetTypes!.includes(a.type) && !a.openWorkOrderId);
    if (!asset) return null;
  }
  const zone = asset ? site.zones.find((z) => inRect(asset!.pos, z.rect)) ?? chooseZone(world, siteId, template, opts.zoneId) : chooseZone(world, siteId, template, opts.zoneId);
  if (!zone) return null;
  const location = asset ? { ...asset.pos } : pointIn(world, zone.rect, 3);
  const title = opts.title ?? template.title.replace('{zone}', zone.name).replace('{asset}', asset?.name ?? '');
  const steps: Step[] = template.steps.map((s, i) => ({
    id: `s${i}`,
    label: s.label,
    requires: s.requires,
    preferKinds: s.preferKinds,
    durationMin: s.durationMin,
    remote: s.remote,
    progress: 0,
    status: i === 0 ? 'awaiting' : 'pending',
    assigneeId: null,
  }));
  return pushWorkOrder(world, {
    title,
    siteId,
    zoneId: zone.id,
    location,
    priority: opts.priority ?? template.priority,
    source: opts.source ?? 'manual',
    dueAt: world.clock + template.dueMin,
    steps,
    assetId: asset?.id,
    templateId: template.id,
  });
}

function pushWorkOrder(world: World, wo: Omit<WorkOrder, 'id' | 'code' | 'status' | 'createdAt' | 'currentStep'>): WorkOrder {
  const n = ++world.counters.wo;
  const full: WorkOrder = { ...wo, id: `wo-${n}`, code: `WO-${n}`, status: 'active', createdAt: round(world.clock, 2), currentStep: 0 };
  world.workOrders.unshift(full);
  if (full.assetId) {
    const asset = world.assets.find((a) => a.id === full.assetId);
    if (asset) asset.openWorkOrderId = full.id;
  }
  const verb = { manual: 'created', copilot: 'created by Copilot', sensor: 'raised by sensors', schedule: 'scheduled', field: 'reported from the field' }[full.source];
  log(world, full.source === 'sensor' ? 'warn' : 'info', 'created', full.siteId, `${full.code} ${verb}: ${full.title}`, { workOrderId: full.id });
  pruneWorkOrders(world);
  return full;
}

function pruneWorkOrders(world: World) {
  const closed = world.workOrders.filter((w) => w.status === 'done' || w.status === 'cancelled');
  if (closed.length > 60) {
    const drop = new Set(closed.slice(60).map((w) => w.id));
    world.workOrders = world.workOrders.filter((w) => !drop.has(w.id));
  }
}

// ────────────────────────────────────────────────────────────── dispatch

function assign(world: World, wo: WorkOrder, stepIdx: number, agent: Agent, manual = false) {
  const st = wo.steps[stepIdx];
  const candidates = rankCandidates(world, wo, st).slice(0, 6);
  const chosen = candidates.find((c) => c.agentId === agent.id);
  st.assigneeId = agent.id;
  st.assignment = { agentId: agent.id, score: chosen?.score ?? 0, at: round(world.clock, 2), policy: world.policy, candidates, manual };
  agent.taskRef = { workOrderId: wo.id, stepIndex: stepIdx };
  if (st.remote || agent.kind === 'ai') {
    st.status = 'in_progress';
    st.startedAt = world.clock;
    agent.status = 'working';
    agent.target = null;
  } else {
    st.status = 'enroute';
    agent.status = 'enroute';
    agent.target = { ...wo.location };
  }
  const waited = world.clock - (stepIdx === 0 ? wo.createdAt : (wo.steps[stepIdx - 1].finishedAt ?? world.clock));
  world.metrics.assignLatencySum += Math.max(0, waited);
  world.metrics.assignCount += 1;
  const prev = stepIdx > 0 ? agentById(world, wo.steps[stepIdx - 1].assigneeId) : undefined;
  if (prev && !manual) {
    log(world, 'info', 'handoff', wo.siteId, `${wo.code} handoff ${prev.name} → ${agent.name}: ${st.label}`, { workOrderId: wo.id, agentId: agent.id });
  } else {
    log(world, 'info', 'dispatch', wo.siteId, `${manual ? 'Operator assigned' : 'Dispatched'} ${agent.name} to ${wo.code} · ${st.label} (score ${st.assignment.score})`, { workOrderId: wo.id, agentId: agent.id });
  }
}

export function dispatchPending(world: World) {
  const open = world.workOrders
    .filter((w) => w.status === 'active' || w.status === 'blocked')
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueAt - b.dueAt);
  for (const wo of open) {
    const st = wo.steps[wo.currentStep];
    if (!st || st.status !== 'awaiting') continue;
    const ranked = rankCandidates(world, wo, st);
    const best = ranked.find((c) => c.eligible);
    if (best) {
      wo.status = 'active';
      assign(world, wo, wo.currentStep, agentById(world, best.agentId)!);
    } else if (wo.status !== 'blocked' && ranked.length > 0 && ranked.every((c) => c.blockers.some((b) => !b.startsWith('Busy') && !b.startsWith('Battery')))) {
      wo.status = 'blocked';
      log(world, 'warn', 'dispatch', wo.siteId, `${wo.code} blocked — no agent satisfies constraints for "${st.label}"`, { workOrderId: wo.id });
    } else if (ranked.length === 0 && wo.status !== 'blocked') {
      wo.status = 'blocked';
      log(world, 'warn', 'dispatch', wo.siteId, `${wo.code} blocked — no agent on site can do ${st.requires.join(', ')}`, { workOrderId: wo.id });
    }
  }
}

function completeStep(world: World, wo: WorkOrder, agent: Agent) {
  const idx = wo.currentStep;
  const st = wo.steps[idx];
  const spec = templateById(wo.templateId ?? '')?.steps[idx];
  st.status = 'done';
  st.progress = 1;
  st.finishedAt = round(world.clock, 2);
  st.output = spec?.outputs ? pick(world, spec.outputs) : 'Completed';
  agent.taskRef = null;
  agent.status = 'idle';
  agent.target = null;
  agent.stats.completed += 1;
  world.metrics.costBaseline += ((st.durationMin * (st.remote ? 4 : 1.35)) / 60) * HUMAN_BASELINE_RATE;
  log(world, agent.kind === 'ai' ? 'info' : 'success', agent.kind === 'ai' ? 'ai' : 'complete', wo.siteId, `${agent.name} finished ${st.label} on ${wo.code}: ${st.output}`, {
    workOrderId: wo.id,
    agentId: agent.id,
  });

  if (idx + 1 < wo.steps.length) {
    wo.currentStep = idx + 1;
    wo.steps[idx + 1].status = 'awaiting';
  } else {
    wo.status = 'done';
    wo.completedAt = round(world.clock, 2);
    world.metrics.completed += 1;
    if (world.clock <= wo.dueAt) world.metrics.onTime += 1;
    else world.metrics.late += 1;
    if (wo.assetId) {
      const asset = world.assets.find((a) => a.id === wo.assetId);
      if (asset) {
        asset.openWorkOrderId = null;
        asset.health = 94 + nextRandom(world) * 5;
        asset.lastServiceAt = world.clock;
        asset.drift = Math.max(-6, asset.drift * 0.6);
      }
    }
    log(world, 'success', 'complete', wo.siteId, `${wo.code} closed${world.clock <= wo.dueAt ? ' on time' : ' late'} · ${wo.title}`, { workOrderId: wo.id });
  }
}

// ────────────────────────────────────────────────────────────── simulation

function moveToward(agent: Agent, minutes: number): boolean {
  if (!agent.target) return true;
  const d = dist(agent.pos, agent.target);
  const crawling = (agent.crawlTicks ?? 0) > 0;
  if (crawling) agent.crawlTicks! -= 1;
  const stepLen = agent.speed * minutes * (crawling ? 0.4 : 1);
  if (d <= stepLen) {
    agent.stats.distance += d;
    agent.pos = { ...agent.target };
    return true;
  }
  agent.pos = {
    x: round(agent.pos.x + ((agent.target.x - agent.pos.x) / d) * stepLen, 2),
    y: round(agent.pos.y + ((agent.target.y - agent.pos.y) / d) * stepLen, 2),
  };
  agent.stats.distance += stepLen;
  return false;
}

function zoneAt(world: World, siteId: string, p: { x: number; y: number }): Zone | undefined {
  return siteOf(world, siteId)?.zones.find((z) => inRect(p, z.rect));
}

function chargerFor(world: World, agent: Agent): Zone | undefined {
  return siteOf(world, agent.siteId)?.zones.find((z) => z.kind === 'charging');
}

function accrue(world: World, agent: Agent, minutes: number) {
  agent.stats.busyMinutes += minutes;
  world.metrics.costSpent += (agent.costPerHour * minutes) / 60;
  if (agent.kind === 'human') world.metrics.humanMinutes += minutes;
  else if (agent.kind === 'ai') world.metrics.aiMinutes += minutes;
  else world.metrics.autonomousMinutes += minutes;
}

function stepAgent(world: World, agent: Agent, m: number) {
  if (agent.status === 'offline') return;

  if (agent.holdTicks && agent.holdTicks > 0) {
    agent.holdTicks -= 1;
    agent.status = 'paused';
    if (agent.holdTicks === 0) {
      agent.status = agent.taskRef ? 'enroute' : 'idle';
      agent.crawlTicks = 24;
    }
    return;
  }

  if (isMachine(agent)) {
    const z = zoneAt(world, agent.siteId, agent.pos);
    if (z?.robotsPaused) {
      agent.status = 'paused';
      return;
    }
  }

  const wo = agent.taskRef ? woById(world, agent.taskRef.workOrderId) : undefined;
  const st = wo ? wo.steps[agent.taskRef!.stepIndex] : undefined;

  if (wo && st) {
    if (st.status === 'enroute') {
      agent.status = 'enroute';
      const arrived = moveToward(agent, m);
      agent.battery -= DRAIN[agent.kind].move * m;
      accrue(world, agent, m);
      if (arrived) {
        st.status = 'in_progress';
        st.startedAt = world.clock;
        agent.status = 'working';
        agent.target = null;
      }
    } else if (st.status === 'in_progress') {
      agent.status = 'working';
      const efficiency = agent.kind === 'robot' ? 1.15 : agent.kind === 'ai' ? 1.4 : 1;
      st.progress = clamp(st.progress + (m / st.durationMin) * efficiency, 0, 1);
      agent.battery -= DRAIN[agent.kind].work * m;
      accrue(world, agent, m);
      if (st.progress >= 1) completeStep(world, wo, agent);
    }
  } else if (agent.taskRef) {
    // Work order vanished (cancelled/pruned)
    agent.taskRef = null;
    agent.status = 'idle';
    agent.target = null;
  } else if (agent.status === 'charging') {
    agent.battery = Math.min(100, agent.battery + 1.6 * m);
    if (agent.battery >= 96) {
      agent.status = 'idle';
      log(world, 'info', 'battery', agent.siteId, `${agent.name} charged to ${Math.round(agent.battery)}% and is available`, { agentId: agent.id });
    }
  } else if (isMachine(agent)) {
    const charger = chargerFor(world, agent);
    const needsCharge = agent.battery < 30 || (agent.kind === 'drone' && agent.battery < 85);
    if (charger && needsCharge) {
      const inCharger = inRect(agent.pos, charger.rect);
      if (inCharger && !agent.target) {
        agent.status = 'charging';
      } else {
        if (!agent.target) {
          agent.target = pointIn(world, charger.rect, 2);
          if (agent.battery < 30) log(world, 'info', 'battery', agent.siteId, `${agent.name} at ${Math.round(agent.battery)}% — returning to ${charger.name}`, { agentId: agent.id });
        }
        agent.status = 'enroute';
        const arrived = moveToward(agent, m);
        agent.battery -= DRAIN[agent.kind].move * m * 0.6;
        if (arrived) {
          agent.target = null;
          agent.status = 'charging';
        }
      }
    } else {
      agent.status = 'idle';
      agent.target = null;
    }
  } else if (agent.kind === 'human') {
    agent.status = 'idle';
    agent.battery = Math.min(100, agent.battery + 0.01 * m);
  }

  agent.battery = clamp(agent.battery, 1, 100);
  if (agent.kind !== 'ai' && (agent.status === 'enroute' || agent.status === 'working')) {
    const last = agent.trail[agent.trail.length - 1];
    if (!last || dist(last, agent.pos) > 0.8) {
      agent.trail.push({ ...agent.pos });
      if (agent.trail.length > 28) agent.trail.shift();
    }
  } else if (agent.trail.length && world.tick % 4 === 0) {
    agent.trail.shift();
  }
}

function proximityInterlocks(world: World) {
  for (const site of world.sites) {
    const people = world.agents.filter((a) => a.kind === 'human' && a.siteId === site.id && a.status !== 'offline');
    const machines = world.agents.filter(
      (a) => a.heavy && a.siteId === site.id && a.status === 'enroute' && !(a.holdTicks && a.holdTicks > 0) && !(a.crawlTicks && a.crawlTicks > 0),
    );
    for (const mach of machines) {
      const near = people.find((p) => dist(p.pos, mach.pos) < PROXIMITY_RADIUS && p.taskRef?.workOrderId !== mach.taskRef?.workOrderId);
      if (!near) continue;
      mach.holdTicks = 6;
      mach.status = 'paused';
      const zone = zoneAt(world, site.id, mach.pos);
      const recent = world.incidents.find(
        (i) => i.kind === 'proximity' && i.agents.includes(mach.id) && i.agents.includes(near.id) && world.clock - i.t < 30,
      );
      if (!recent) {
        world.metrics.interlocks += 1;
        addIncident(world, {
          siteId: site.id,
          zoneId: zone?.id ?? null,
          kind: 'proximity',
          severity: 'medium',
          summary: `${mach.name} held: ${near.name} within ${PROXIMITY_RADIUS} m${zone ? ` in ${zone.name}` : ''}`,
          agents: [mach.id, near.id],
        });
        log(world, 'warn', 'safety', site.id, `Interlock: ${mach.name} paused — ${near.name} inside ${PROXIMITY_RADIUS} m buffer`, { agentId: mach.id, zoneId: zone?.id });
      }
    }
  }
}

function addIncident(world: World, inc: Omit<SafetyIncident, 'id' | 't' | 'resolved'>): SafetyIncident {
  const full: SafetyIncident = { ...inc, id: `inc-${++world.counters.inc}`, t: round(world.clock, 2), resolved: inc.kind === 'proximity' };
  world.incidents.unshift(full);
  if (world.incidents.length > 120) world.incidents.length = 120;
  return full;
}

function stepAssets(world: World, m: number) {
  for (const asset of world.assets) {
    const noise = (nextRandom(world) - 0.5) * 0.06;
    asset.health = clamp(asset.health + (asset.drift * m) / 60 + noise, 3, 100);
    const stress = (100 - asset.health) / 100;
    asset.telemetry = {
      temp: round(38 + stress * 46 + (nextRandom(world) - 0.5) * 2),
      vibration: round(0.9 + stress * 7.5 + (nextRandom(world) - 0.5) * 0.3, 2),
      load: round(clamp(50 + (nextRandom(world) - 0.5) * 30 + stress * 20, 5, 100)),
    };
    if (world.tick % 20 === 0) {
      asset.history.push(round(asset.health));
      if (asset.history.length > 48) asset.history.shift();
    }
    if (asset.health < 58 && !asset.openWorkOrderId) {
      const template = TEMPLATES.find((t) => t.assetTypes?.includes(asset.type));
      if (!template) continue;
      log(world, 'warn', 'sensor', asset.siteId, `${asset.name} health ${Math.round(asset.health)} — Telemetry Doctor predicts failure within ~${Math.max(2, Math.round(asset.health / Math.abs(asset.drift || 1)))} h`, { assetId: asset.id });
      createFromTemplate(world, template, asset.siteId, { assetId: asset.id, source: 'sensor', priority: asset.health < 35 ? 'P1' : 'P2' });
    }
  }
}

function maybeSpawnWork(world: World, m: number) {
  for (const site of world.sites) {
    const open = world.workOrders.filter((w) => w.siteId === site.id && (w.status === 'active' || w.status === 'blocked')).length;
    const p = open < 4 ? 0.12 * m : open < 8 ? 0.035 * m : 0;
    if (nextRandom(world) >= p) continue;
    const options = TEMPLATES.filter((t) => t.vertical === site.vertical && !t.assetTypes);
    const template = pick(world, options);
    createFromTemplate(world, template, site.id, { source: 'schedule' });
  }
}

/** Advance the world by one tick. Mutates in place. */
export function step(world: World): World {
  const m = world.minutesPerTick;
  world.tick += 1;
  world.clock = round(world.clock + m, 4);
  stepAssets(world, m);
  maybeSpawnWork(world, m);
  dispatchPending(world);
  for (const agent of world.agents) stepAgent(world, agent, m);
  proximityInterlocks(world);

  if (Math.floor(world.clock / 15) !== Math.floor((world.clock - m) / 15)) {
    const physical = world.agents.filter((a) => a.kind !== 'ai' && a.status !== 'offline');
    const busy = physical.filter((a) => a.taskRef).length;
    world.metrics.series.push({
      t: round(world.clock),
      completed: world.metrics.completed,
      utilization: physical.length ? round((busy / physical.length) * 100) : 0,
      active: world.workOrders.filter((w) => w.status === 'active' || w.status === 'blocked').length,
    });
    if (world.metrics.series.length > 96) world.metrics.series.shift();
  }
  return world;
}

// ────────────────────────────────────────────────────────────── commands

function releaseAgentFromStep(world: World, wo: WorkOrder) {
  const st = wo.steps[wo.currentStep];
  if (!st?.assigneeId) return;
  const agent = agentById(world, st.assigneeId);
  if (agent && agent.taskRef?.workOrderId === wo.id) {
    agent.taskRef = null;
    agent.status = 'idle';
    agent.target = null;
  }
}

export function applyCommand(world: World, cmd: Command): CommandResult {
  switch (cmd.type) {
    case 'create_work_order': {
      const t = templateById(cmd.templateId);
      if (!t) return { ok: false, message: `Unknown template ${cmd.templateId}` };
      const site = siteOf(world, cmd.siteId);
      if (!site) return { ok: false, message: `Unknown site ${cmd.siteId}` };
      if (t.vertical !== site.vertical) return { ok: false, message: `${t.id} is a ${t.vertical} template; ${site.name} is ${site.vertical}` };
      if (cmd.zoneId && !site.zones.some((z) => z.id === cmd.zoneId)) return { ok: false, message: `Unknown zone ${cmd.zoneId}` };
      const wo = createFromTemplate(world, t, cmd.siteId, { zoneId: cmd.zoneId, priority: cmd.priority, title: cmd.title, source: cmd.source ?? 'manual', assetId: cmd.assetId });
      if (!wo) return { ok: false, message: 'No matching asset or zone for that template' };
      dispatchPending(world);
      return { ok: true, message: `${wo.code} created: ${wo.title}`, workOrderId: wo.id };
    }
    case 'create_custom_work_order': {
      const site = siteOf(world, cmd.siteId);
      if (!site) return { ok: false, message: `Unknown site ${cmd.siteId}` };
      if (!cmd.requires.length) return { ok: false, message: 'A work order needs at least one capability' };
      const zone = (cmd.zoneId && site.zones.find((z) => z.id === cmd.zoneId)) || site.zones.find((z) => z.kind === 'work') || site.zones[0];
      const remote = cmd.requires.every((c) => c.startsWith('analyze.') || c === 'plan.route' || c === 'report.compliance');
      const wo = pushWorkOrder(world, {
        title: cmd.title,
        siteId: site.id,
        zoneId: zone.id,
        location: pointIn(world, zone.rect, 3),
        priority: cmd.priority ?? 'P3',
        source: cmd.source ?? 'manual',
        dueAt: world.clock + 180,
        steps: [{ id: 's0', label: cmd.title, requires: cmd.requires, durationMin: cmd.durationMin ?? 20, remote, progress: 0, status: 'awaiting', assigneeId: null }],
      });
      dispatchPending(world);
      return { ok: true, message: `${wo.code} created: ${wo.title}`, workOrderId: wo.id };
    }
    case 'cancel_work_order': {
      const wo = woById(world, cmd.workOrderId);
      if (!wo) return { ok: false, message: 'Work order not found' };
      if (wo.status === 'done' || wo.status === 'cancelled') return { ok: false, message: `${wo.code} is already ${wo.status}` };
      releaseAgentFromStep(world, wo);
      wo.status = 'cancelled';
      if (wo.assetId) {
        const asset = world.assets.find((a) => a.id === wo.assetId);
        if (asset) asset.openWorkOrderId = null;
      }
      log(world, 'info', 'system', wo.siteId, `${wo.code} cancelled by operator`, { workOrderId: wo.id });
      return { ok: true, message: `${wo.code} cancelled` };
    }
    case 'reassign_step': {
      const wo = woById(world, cmd.workOrderId);
      const agent = agentById(world, cmd.agentId);
      if (!wo || !agent) return { ok: false, message: 'Work order or agent not found' };
      const st = wo.steps[wo.currentStep];
      if (!st || st.status === 'done') return { ok: false, message: 'No open step to assign' };
      if (st.assigneeId === agent.id) return { ok: false, message: `${agent.name} already has this step` };
      if (!st.requires.every((c) => agent.capabilities.includes(c))) return { ok: false, message: `${agent.name} lacks ${st.requires.join(', ')}` };
      if (agent.taskRef) return { ok: false, message: `${agent.name} is busy` };
      if (agent.status === 'offline') return { ok: false, message: `${agent.name} is offline` };
      releaseAgentFromStep(world, wo);
      st.progress = st.status === 'in_progress' ? st.progress : 0;
      st.status = 'awaiting';
      wo.status = 'active';
      assign(world, wo, wo.currentStep, agent, true);
      return { ok: true, message: `${agent.name} assigned to ${wo.code} · ${st.label}` };
    }
    case 'complete_step': {
      const wo = woById(world, cmd.workOrderId);
      const agent = agentById(world, cmd.agentId);
      if (!wo || !agent) return { ok: false, message: 'Work order or agent not found' };
      const st = wo.steps[wo.currentStep];
      if (st?.assigneeId !== agent.id) return { ok: false, message: 'That step is not assigned to this agent' };
      if (st.status === 'enroute') {
        agent.pos = { ...wo.location };
        agent.target = null;
      }
      completeStep(world, wo, agent);
      return { ok: true, message: `${st.label} marked complete` };
    }
    case 'set_policy': {
      world.policy = cmd.policy;
      log(world, 'info', 'system', null, `Dispatch policy set to ${cmd.policy}`);
      return { ok: true, message: `Dispatch policy is now ${cmd.policy}` };
    }
    case 'pause_zone':
    case 'resume_zone': {
      const zone = world.sites.flatMap((s) => s.zones).find((z) => z.id === cmd.zoneId);
      if (!zone) return { ok: false, message: 'Zone not found' };
      const pause = cmd.type === 'pause_zone';
      zone.robotsPaused = pause;
      if (pause) {
        addIncident(world, { siteId: zone.siteId, zoneId: zone.id, kind: 'geofence', severity: 'low', summary: `Machines paused in ${zone.name}${cmd.reason ? `: ${cmd.reason}` : ''}`, agents: [] });
        // Release machines dispatched into the zone so the work can be re-planned.
        for (const wo of world.workOrders.filter((w) => w.zoneId === zone.id && w.status === 'active')) {
          const st = wo.steps[wo.currentStep];
          const a = agentById(world, st?.assigneeId);
          if (a && isMachine(a) && st.status === 'enroute') {
            releaseAgentFromStep(world, wo);
            st.status = 'awaiting';
            st.assigneeId = null;
          }
        }
      }
      log(world, pause ? 'warn' : 'info', 'safety', zone.siteId, `${pause ? 'Machines paused' : 'Machines released'} in ${zone.name}`, { zoneId: zone.id });
      return { ok: true, message: `${pause ? 'Paused' : 'Resumed'} machines in ${zone.name}` };
    }
    case 'estop_site':
    case 'release_site': {
      const site = siteOf(world, cmd.siteId);
      if (!site) return { ok: false, message: 'Site not found' };
      const stop = cmd.type === 'estop_site';
      for (const z of site.zones) z.robotsPaused = stop;
      if (stop) {
        addIncident(world, { siteId: site.id, zoneId: null, kind: 'e-stop', severity: 'high', summary: `Site-wide machine E-stop at ${site.name}`, agents: [] });
      }
      log(world, stop ? 'critical' : 'info', 'safety', site.id, stop ? `E-STOP: all machines halted at ${site.name}` : `E-stop released at ${site.name}`);
      return { ok: true, message: stop ? `All machines halted at ${site.name}` : `Machines released at ${site.name}` };
    }
    case 'recall_agent': {
      const agent = agentById(world, cmd.agentId);
      if (!agent) return { ok: false, message: 'Agent not found' };
      if (!isMachine(agent)) return { ok: false, message: `${agent.name} is not a machine` };
      if (agent.taskRef) {
        const wo = woById(world, agent.taskRef.workOrderId);
        if (wo) {
          const st = wo.steps[agent.taskRef.stepIndex];
          st.status = 'awaiting';
          st.assigneeId = null;
        }
        agent.taskRef = null;
      }
      const charger = chargerFor(world, agent);
      if (charger) agent.target = pointIn(world, charger.rect, 2);
      agent.battery = Math.min(agent.battery, 29);
      agent.status = 'enroute';
      log(world, 'info', 'battery', agent.siteId, `${agent.name} recalled to ${charger?.name ?? 'base'}`, { agentId: agent.id });
      return { ok: true, message: `${agent.name} recalled to charge` };
    }
    case 'set_agent_online': {
      const agent = agentById(world, cmd.agentId);
      if (!agent) return { ok: false, message: 'Agent not found' };
      if (!cmd.online) {
        if (agent.taskRef) {
          const wo = woById(world, agent.taskRef.workOrderId);
          if (wo) {
            const st = wo.steps[agent.taskRef.stepIndex];
            st.status = 'awaiting';
            st.assigneeId = null;
          }
          agent.taskRef = null;
        }
        agent.status = 'offline';
        agent.target = null;
      } else {
        agent.status = 'idle';
      }
      log(world, 'info', 'system', agent.siteId === '*' ? null : agent.siteId, `${agent.name} is ${cmd.online ? 'back online' : 'offline'}`, { agentId: agent.id });
      return { ok: true, message: `${agent.name} ${cmd.online ? 'online' : 'offline'}` };
    }
    case 'report_hazard': {
      const site = siteOf(world, cmd.siteId);
      const zone = site?.zones.find((z) => z.id === cmd.zoneId);
      if (!site || !zone) return { ok: false, message: 'Site or zone not found' };
      const reporter = agentById(world, cmd.agentId);
      zone.robotsPaused = true;
      world.metrics.hazardsReported += 1;
      addIncident(world, { siteId: site.id, zoneId: zone.id, kind: 'hazard-report', severity: 'high', summary: `${cmd.note} — ${zone.name}${reporter ? ` (reported by ${reporter.name})` : ''}`, agents: reporter ? [reporter.id] : [] });
      log(world, 'critical', 'safety', site.id, `Hazard reported in ${zone.name}: ${cmd.note}. Machines paused, supervisor paged.`, { zoneId: zone.id, agentId: reporter?.id });
      return { ok: true, message: `Hazard logged; machines paused in ${zone.name}` };
    }
    case 'resolve_incident': {
      const inc = world.incidents.find((i) => i.id === cmd.incidentId);
      if (!inc) return { ok: false, message: 'Incident not found' };
      inc.resolved = true;
      if (inc.zoneId && (inc.kind === 'hazard-report' || inc.kind === 'geofence')) {
        const zone = world.sites.flatMap((s) => s.zones).find((z) => z.id === inc.zoneId);
        if (zone) zone.robotsPaused = false;
      }
      if (inc.kind === 'e-stop') {
        const site = siteOf(world, inc.siteId);
        site?.zones.forEach((z) => (z.robotsPaused = false));
      }
      log(world, 'success', 'safety', inc.siteId, `Incident resolved: ${inc.summary}`);
      return { ok: true, message: 'Incident resolved' };
    }
    case 'set_speed': {
      world.minutesPerTick = clamp(cmd.minutesPerTick, 0.05, 4);
      return { ok: true, message: `Simulation speed ${world.minutesPerTick} min/tick` };
    }
    case 'set_running': {
      world.running = cmd.running;
      return { ok: true, message: cmd.running ? 'Resumed' : 'Paused' };
    }
    case 'reset': {
      const fresh = createWorld(cmd.seed ?? world.seed, { warmupMinutes: 90 });
      Object.assign(world, fresh);
      return { ok: true, message: 'World reset' };
    }
  }
}

export function snapshot(world: World): Snapshot {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rng: _rng, counters: _counters, ...rest } = world;
  return structuredClone(rest);
}

export { clockLabel, center };
