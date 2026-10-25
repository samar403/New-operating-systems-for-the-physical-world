/**
 * The dispatcher: decides which agent — human, robot, drone, vehicle or AI —
 * should take the next step of a work order, and explains why.
 *
 * Hard constraints (capability, certification, geofence, battery, safety
 * interlocks) decide eligibility. Soft factors are weighted by the active
 * dispatch policy and produce a 0-100 score. Every factor is kept so the UI can
 * show a transparent "why this agent" breakdown.
 */
import type { Agent, Candidate, DispatchPolicy, ScoreFactor, Site, Step, WorkOrder, World, Zone } from './types';
import { dist, round } from './util';

type SoftFactor = Exclude<ScoreFactor['factor'], 'capability' | 'availability'>;

export const POLICY_WEIGHTS: Record<DispatchPolicy, Record<SoftFactor, number>> = {
  balanced: { proximity: 0.28, cost: 0.2, battery: 0.1, preference: 0.17, safety: 0.15, workload: 0.1 },
  fastest: { proximity: 0.5, cost: 0.05, battery: 0.1, preference: 0.15, safety: 0.08, workload: 0.12 },
  cheapest: { proximity: 0.15, cost: 0.5, battery: 0.08, preference: 0.12, safety: 0.07, workload: 0.08 },
  safest: { proximity: 0.12, cost: 0.05, battery: 0.15, preference: 0.13, safety: 0.45, workload: 0.1 },
};

export const POLICY_LABELS: Record<DispatchPolicy, { label: string; blurb: string }> = {
  balanced: { label: 'Balanced', blurb: 'Blend of speed, cost, safety and fairness.' },
  fastest: { label: 'Fastest', blurb: 'Minimise time-to-start; travel dominates.' },
  cheapest: { label: 'Lowest cost', blurb: 'Prefer the cheapest qualified agent.' },
  safest: { label: 'Safest', blurb: 'Minimise exposure; keep heavy machines away from people.' },
};

/** Battery drained per simulated minute, by activity. */
export const DRAIN: Record<Agent['kind'], { move: number; work: number }> = {
  human: { move: 0.04, work: 0.05 },
  robot: { move: 0.28, work: 0.2 },
  drone: { move: 0.9, work: 0.7 },
  vehicle: { move: 0.18, work: 0.1 },
  ai: { move: 0, work: 0 },
};

const RESERVE = 12;

export const isMachine = (a: Agent) => a.kind === 'robot' || a.kind === 'drone' || a.kind === 'vehicle';

export function zoneFor(world: World, wo: WorkOrder): Zone | undefined {
  return siteOf(world, wo.siteId)?.zones.find((z) => z.id === wo.zoneId);
}

export const siteOf = (world: World, siteId: string): Site | undefined => world.sites.find((s) => s.id === siteId);

/** Hard eligibility rules. Returns human-readable blockers; empty = eligible. */
export function blockersFor(_world: World, agent: Agent, wo: WorkOrder, step: Step, zone: Zone | undefined): string[] {
  const b: string[] = [];
  const missing = step.requires.filter((c) => !agent.capabilities.includes(c));
  if (missing.length) b.push(`Lacks ${missing.join(', ')}`);
  if (agent.siteId !== '*' && agent.siteId !== wo.siteId) b.push('Deployed to another site');
  if (agent.kind === 'ai' && !step.remote) b.push('Software agent — step needs a physical presence');
  if (agent.status === 'offline') b.push('Offline');
  if (agent.taskRef) b.push('Busy on another step');
  if (agent.holdTicks && agent.holdTicks > 0) b.push('Held by safety interlock');

  if (!step.remote && zone) {
    if (zone.humanOnly && agent.kind !== 'human') b.push(`${zone.name} is human-only`);
    if (zone.robotsPaused && isMachine(agent)) b.push(`${zone.name} is paused for machines`);
    if (zone.hazard === 'patient-care' && (agent.kind === 'drone' || agent.heavy)) b.push('Not permitted in patient-care areas');
    if (agent.kind === 'human') {
      if (zone.hazard === 'electrical' && !agent.certifications.includes('NFPA-70E')) b.push('Needs NFPA-70E for electrical hazard');
      if (zone.hazard === 'fall' && !agent.certifications.includes('Fall-Protection')) b.push('Needs Fall-Protection certification');
    }
  }

  if (isMachine(agent) && !step.remote) {
    const travel = dist(agent.pos, wo.location) / Math.max(agent.speed, 0.1);
    const need = travel * DRAIN[agent.kind].move + step.durationMin * DRAIN[agent.kind].work + RESERVE;
    if (agent.battery < need) b.push(`Battery ${Math.round(agent.battery)}% < ${Math.round(need)}% needed`);
  }
  return b;
}

export function etaMinutes(agent: Agent, wo: WorkOrder, step: Step): number {
  if (step.remote || agent.kind === 'ai') return 0;
  return dist(agent.pos, wo.location) / Math.max(agent.speed, 0.1);
}

function safetyValue(world: World, agent: Agent, zone: Zone | undefined): { value: number; note: string } {
  if (agent.kind === 'ai') return { value: 1, note: 'No physical exposure' };
  let value = 1;
  const notes: string[] = [];
  if (agent.heavy) {
    value -= 0.4;
    notes.push('heavy machine');
    if (zone) {
      const people = world.agents.filter(
        (a) => a.kind === 'human' && a.siteId === zone.siteId && a.pos.x >= zone.rect.x && a.pos.x <= zone.rect.x + zone.rect.w && a.pos.y >= zone.rect.y && a.pos.y <= zone.rect.y + zone.rect.h,
      ).length;
      if (people) {
        value -= Math.min(0.3, people * 0.1);
        notes.push(`${people} people in zone`);
      }
    }
  } else if (agent.kind === 'human' && zone?.hazard && zone.hazard !== 'patient-care') {
    value -= 0.3;
    notes.push(`person exposed to ${zone.hazard} hazard`);
  } else if (isMachine(agent) && zone?.hazard) {
    value -= 0.1;
    notes.push('machine in hazard zone');
  }
  return { value: Math.max(0, value), note: notes.length ? notes.join(', ') : 'Low exposure' };
}

export function scoreCandidate(world: World, agent: Agent, wo: WorkOrder, step: Step, policy: DispatchPolicy = world.policy): Candidate {
  const zone = zoneFor(world, wo);
  const blockers = blockersFor(world, agent, wo, step, zone);
  const eta = etaMinutes(agent, wo, step);
  const w = POLICY_WEIGHTS[policy];

  const pref = step.preferKinds?.length ? (step.preferKinds.includes(agent.kind) ? 1 : 0.3) : 0.6;
  const safety = safetyValue(world, agent, zone);
  const factors: ScoreFactor[] = [
    { factor: 'capability', value: blockers.some((x) => x.startsWith('Lacks')) ? 0 : 1, weight: 0, note: step.requires.join(' + ') },
    { factor: 'proximity', value: step.remote ? 1 : 1 - Math.min(eta / 25, 1), weight: w.proximity, note: step.remote ? 'Remote step' : `ETA ${round(eta)} min` },
    { factor: 'cost', value: 1 - Math.min(agent.costPerHour / 120, 1), weight: w.cost, note: `$${agent.costPerHour}/h` },
    { factor: 'battery', value: agent.battery / 100, weight: w.battery, note: agent.kind === 'human' ? `Shift energy ${Math.round(agent.battery)}%` : `${Math.round(agent.battery)}% charge` },
    { factor: 'preference', value: pref, weight: w.preference, note: step.preferKinds?.length ? `Prefers ${step.preferKinds.join('/')}` : 'No preference' },
    { factor: 'safety', value: safety.value, weight: w.safety, note: safety.note },
    { factor: 'workload', value: 1 - Math.min(agent.stats.busyMinutes / 420, 1), weight: w.workload, note: `${Math.round(agent.stats.busyMinutes)} min worked today` },
  ];
  const totalW = factors.reduce((s, f) => s + f.weight, 0);
  const score = (100 * factors.reduce((s, f) => s + f.value * f.weight, 0)) / totalW;

  return { agentId: agent.id, score: round(score), eligible: blockers.length === 0, etaMin: round(eta), factors, blockers };
}

/**
 * Rank every agent that could plausibly do this step. Agents lacking the
 * required capability are dropped entirely; others are returned with their
 * blockers so operators can see who *almost* qualified.
 */
export function rankCandidates(world: World, wo: WorkOrder, step: Step, policy: DispatchPolicy = world.policy): Candidate[] {
  return world.agents
    .filter((a) => step.requires.every((c) => a.capabilities.includes(c)))
    .filter((a) => a.siteId === '*' || a.siteId === wo.siteId)
    .map((a) => scoreCandidate(world, a, wo, step, policy))
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score);
}
