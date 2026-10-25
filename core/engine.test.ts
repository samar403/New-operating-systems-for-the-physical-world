import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, rankCandidates, runLocalCopilot, scoreCandidate, snapshot, step, kpis } from './index';
import type { World } from './types';

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(w);
};

describe('world engine', () => {
  it('is deterministic for a given seed', () => {
    const a = createWorld(42);
    const b = createWorld(42);
    run(a, 400);
    run(b, 400);
    expect(snapshot(a)).toEqual(snapshot(b));
  });

  it('completes multi-step work orders with handoffs across agent kinds', () => {
    const w = createWorld(7);
    run(w, 1200);
    const done = w.workOrders.filter((o) => o.status === 'done' && o.steps.length > 1);
    expect(done.length).toBeGreaterThan(3);
    const kinds = new Set(done.flatMap((o) => o.steps.map((s) => w.agents.find((a) => a.id === s.assigneeId)?.kind)));
    expect(kinds.has('ai')).toBe(true);
    expect(kinds.has('human')).toBe(true);
    expect(w.events.some((e) => e.kind === 'handoff')).toBe(true);
  });

  it('snapshot strips internal state', () => {
    const s = snapshot(createWorld(1));
    expect('rng' in s).toBe(false);
    expect('counters' in s).toBe(false);
  });

  it('raises sensor work orders when asset health degrades', () => {
    const w = createWorld(3);
    const ahu = w.assets.find((a) => a.id === 'a-ahu3')!;
    ahu.health = 57;
    run(w, 2);
    expect(ahu.openWorkOrderId).not.toBeNull();
    const wo = w.workOrders.find((o) => o.id === ahu.openWorkOrderId)!;
    expect(wo.source).toBe('sensor');
    expect(wo.steps[0].requires).toContain('analyze.telemetry');
  });
});

describe('dispatcher', () => {
  it('never assigns an agent that lacks the required capability', () => {
    const w = createWorld(11);
    run(w, 600);
    for (const wo of w.workOrders) {
      for (const st of wo.steps) {
        if (!st.assigneeId) continue;
        const agent = w.agents.find((a) => a.id === st.assigneeId)!;
        for (const cap of st.requires) expect(agent.capabilities).toContain(cap);
      }
    }
  });

  it('keeps machines out of human-only zones', () => {
    const w = createWorld(5);
    const res = applyCommand(w, { type: 'create_custom_work_order', siteId: 'hp', zoneId: 'hp-elec', title: 'Haul cable reels', requires: ['haul'] });
    expect(res.ok).toBe(true);
    const wo = w.workOrders.find((o) => o.id === res.workOrderId)!;
    const ranked = rankCandidates(w, wo, wo.steps[0]);
    for (const c of ranked) {
      const agent = w.agents.find((a) => a.id === c.agentId)!;
      if (agent.kind !== 'human') expect(c.eligible).toBe(false);
    }
  });

  it('requires NFPA-70E for humans in electrical-hazard zones', () => {
    const w = createWorld(5);
    applyCommand(w, { type: 'create_work_order', templateId: 'gen-service', siteId: 'mg' });
    const wo = w.workOrders.find((o) => o.templateId === 'gen-service')!;
    const grace = w.agents.find((a) => a.id === 'h-grace')!;
    const c = scoreCandidate(w, grace, wo, wo.steps[0]);
    expect(c.blockers.join(' ')).toMatch(/NFPA-70E/);
  });

  it('re-ranks candidates when the policy changes', () => {
    const w = createWorld(9);
    applyCommand(w, { type: 'create_custom_work_order', siteId: 'hp', zoneId: 'hp-core', title: 'Visual check', requires: ['inspect.visual'] });
    const wo = w.workOrders[0];
    const cheap = rankCandidates(w, wo, wo.steps[0], 'cheapest');
    const safe = rankCandidates(w, wo, wo.steps[0], 'safest');
    const costOf = (id: string) => w.agents.find((a) => a.id === id)!.costPerHour;
    expect(costOf(cheap[0].agentId)).toBeLessThanOrEqual(costOf(safe[0].agentId));
  });
});

describe('safety', () => {
  it('pausing a zone blocks machines from being dispatched there', () => {
    const w = createWorld(13);
    applyCommand(w, { type: 'pause_zone', zoneId: 'hp-east' });
    const res = applyCommand(w, { type: 'create_work_order', templateId: 'facade-inspection', siteId: 'hp', zoneId: 'hp-east' });
    const wo = w.workOrders.find((o) => o.id === res.workOrderId)!;
    const assignee = w.agents.find((a) => a.id === wo.steps[0].assigneeId);
    if (assignee) expect(assignee.kind).toBe('human');
  });

  it('a field hazard report pauses the zone and opens an incident', () => {
    const w = createWorld(13);
    const res = applyCommand(w, { type: 'report_hazard', siteId: 'mg', zoneId: 'mg-wardb', note: 'Wet floor' });
    expect(res.ok).toBe(true);
    expect(w.sites[1].zones.find((z) => z.id === 'mg-wardb')!.robotsPaused).toBe(true);
    const inc = w.incidents[0];
    expect(inc.kind).toBe('hazard-report');
    applyCommand(w, { type: 'resolve_incident', incidentId: inc.id });
    expect(w.sites[1].zones.find((z) => z.id === 'mg-wardb')!.robotsPaused).toBe(false);
  });

  it('e-stop halts every machine on the site', () => {
    const w = createWorld(21);
    run(w, 40);
    applyCommand(w, { type: 'estop_site', siteId: 'hp' });
    run(w, 3);
    const machines = w.agents.filter((a) => a.siteId === 'hp' && a.kind !== 'human');
    expect(machines.every((a) => a.status === 'paused')).toBe(true);
    const before = machines.map((a) => ({ ...a.pos }));
    run(w, 10);
    expect(machines.map((a) => a.pos)).toEqual(before);
  });
});

describe('local copilot', () => {
  it('creates work from natural language', () => {
    const w = createWorld(2);
    const r = runLocalCopilot(w, 'Send a drone to inspect the east wing facade asap');
    expect(r.actions[0].result.ok).toBe(true);
    const wo = w.workOrders.find((o) => o.id === r.actions[0].result.workOrderId)!;
    expect(wo.priority).toBe('P1');
    expect(wo.zoneId).toBe('hp-east');
  });

  it('pauses zones, changes policy and answers questions', () => {
    const w = createWorld(2);
    expect(runLocalCopilot(w, 'pause robots in the crane zone').actions[0].command).toMatchObject({ type: 'pause_zone', zoneId: 'hp-crane' });
    runLocalCopilot(w, 'optimise for lowest cost');
    expect(w.policy).toBe('cheapest');
    expect(runLocalCopilot(w, 'where is Maria?').reply).toMatch(/Maria Okafor/);
    expect(runLocalCopilot(w, 'shift brief').reply).toMatch(/Shift brief/);
  });

  it('resolves zones at other sites than the one in view', () => {
    const w = createWorld(2);
    const r = runLocalCopilot(w, 'Spill reported in Ward B', { siteId: 'hp' });
    expect(r.actions[0]?.command).toMatchObject({ type: 'report_hazard', siteId: 'mg', zoneId: 'mg-wardb' });
  });

  it('targets assets by name and refuses duplicates', () => {
    const w = createWorld(2);
    const first = runLocalCopilot(w, 'fix the brakes on tractor 112');
    expect(first.actions[0].result.ok).toBe(true);
    const second = runLocalCopilot(w, 'service tractor 112');
    expect(second.actions).toHaveLength(0);
    expect(second.reply).toMatch(/already has/);
  });
});

describe('kpis', () => {
  it('reports savings and autonomy share after a shift', () => {
    const w = createWorld(7);
    run(w, 1600);
    const k = kpis(w);
    expect(k.completed).toBeGreaterThan(10);
    expect(k.autonomyShare).toBeGreaterThan(20);
    expect(k.savings).toBeGreaterThan(0);
  });
});
