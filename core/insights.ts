/** Derived, read-only views over a world snapshot — shared by UI, server and Copilot. */
import type { Agent, AgentKind, Snapshot, WorkOrder } from './types';
import { clockLabel, round } from './util';

type View = Pick<Snapshot, 'agents' | 'workOrders' | 'metrics' | 'incidents' | 'sites' | 'assets' | 'clock' | 'policy'>;

export const openOrders = (w: Pick<Snapshot, 'workOrders'>, siteId?: string) =>
  w.workOrders.filter((o) => (o.status === 'active' || o.status === 'blocked') && (!siteId || o.siteId === siteId));

export function utilizationByKind(w: Pick<Snapshot, 'agents'>, siteId?: string): Record<AgentKind, { busy: number; total: number }> {
  const out = { human: { busy: 0, total: 0 }, robot: { busy: 0, total: 0 }, drone: { busy: 0, total: 0 }, vehicle: { busy: 0, total: 0 }, ai: { busy: 0, total: 0 } };
  for (const a of w.agents) {
    if (siteId && a.siteId !== siteId && a.siteId !== '*') continue;
    if (a.status === 'offline') continue;
    out[a.kind].total += 1;
    if (a.taskRef) out[a.kind].busy += 1;
  }
  return out;
}

export function kpis(w: View) {
  const m = w.metrics;
  const total = m.onTime + m.late;
  const workMin = m.humanMinutes + m.autonomousMinutes + m.aiMinutes;
  return {
    completed: m.completed,
    onTimeRate: total ? round((m.onTime / total) * 100) : 100,
    open: openOrders(w).length,
    blocked: w.workOrders.filter((o) => o.status === 'blocked').length,
    autonomyShare: workMin ? round(((m.autonomousMinutes + m.aiMinutes) / workMin) * 100) : 0,
    savings: Math.max(0, round(m.costBaseline - m.costSpent * 0.62, 0)),
    interlocks: m.interlocks,
    meanAssign: m.assignCount ? round(m.assignLatencySum / m.assignCount, 1) : 0,
    openIncidents: w.incidents.filter((i) => !i.resolved).length,
  };
}

export function stepAssignee(w: Pick<Snapshot, 'agents'>, wo: WorkOrder): Agent | undefined {
  const st = wo.steps[wo.currentStep];
  return st?.assigneeId ? w.agents.find((a) => a.id === st.assigneeId) : undefined;
}

/** Plain-language shift brief. Used by Copilot and the summary panel. */
export function shiftBrief(w: View, siteId?: string): string {
  const k = kpis(w);
  const sites = siteId ? w.sites.filter((s) => s.id === siteId) : w.sites;
  const lines: string[] = [];
  lines.push(`Shift brief at ${clockLabel(w.clock)} · policy: ${w.policy}.`);
  lines.push(
    `${k.completed} work orders closed (${k.onTimeRate}% on time), ${k.open} open${k.blocked ? `, ${k.blocked} blocked` : ''}. Machines and AI did ${k.autonomyShare}% of work-minutes; est. $${k.savings.toLocaleString()} saved vs. a human-only crew.`,
  );
  for (const s of sites) {
    const open = openOrders(w, s.id);
    const u = utilizationByKind(w, s.id);
    const busy = u.human.busy + u.robot.busy + u.drone.busy + u.vehicle.busy;
    const total = u.human.total + u.robot.total + u.drone.total + u.vehicle.total;
    const hot = open.filter((o) => o.priority === 'P1' || o.status === 'blocked');
    lines.push(`• ${s.name}: ${open.length} open, ${busy}/${total} field agents busy${hot.length ? `; attention: ${hot.map((o) => o.code).join(', ')}` : ''}.`);
  }
  const weak = w.assets.filter((a) => (!siteId || a.siteId === siteId) && a.health < 65).sort((a, b) => a.health - b.health);
  if (weak.length) lines.push(`Assets to watch: ${weak.slice(0, 3).map((a) => `${a.name} (${Math.round(a.health)})`).join(', ')}.`);
  if (k.openIncidents) lines.push(`${k.openIncidents} open safety incident${k.openIncidents > 1 ? 's' : ''} need review.`);
  else lines.push(`No open safety incidents; ${k.interlocks} automatic interlocks prevented close calls.`);
  return lines.join('\n');
}
