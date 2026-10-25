import type { Agent, Candidate, Snapshot, WorkOrder, WorldEvent } from '@core/index';
import { CAPABILITY_LABELS, POLICY_LABELS } from '@core/index';
import { ArrowRight, BatteryCharging, Check, CircleSlash, MapPin, Power, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { KIND_META, LEVEL_COLOR, STATUS_META, STEP_STATUS, WO_STATUS, ago, t } from '@/lib/format';
import { useStrata } from '@/lib/store';
import { Button, Empty, KindGlyph, KindTag, Meter, PriorityPill, StatusDot, cx } from './ui';

const agentOf = (snap: Snapshot, id: string | null | undefined) => (id ? snap.agents.find((a) => a.id === id) : undefined);

export function EventFeed({ snap, siteId, limit = 40, className }: { snap: Snapshot; siteId?: string; limit?: number; className?: string }) {
  const selectWo = useStrata((s) => s.selectWo);
  const events = snap.events.filter((e) => !siteId || e.siteId === siteId || e.siteId === null).slice(0, limit);
  if (!events.length) return <Empty title="Quiet shift">No events yet.</Empty>;
  return (
    <ol className={cx('divide-y divide-line', className)} aria-live="polite">
      {events.map((e: WorldEvent) => (
        <li key={e.id} className="rise group flex gap-3 px-4 py-2.5 text-[13px]">
          <span className="mono w-11 shrink-0 pt-px text-[11px] text-faint tnum">{t(e.t)}</span>
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: LEVEL_COLOR[e.level] }} />
          <span className={cx('min-w-0 flex-1 leading-snug', e.level === 'critical' ? 'text-danger' : e.level === 'warn' ? 'text-text' : 'text-text/85')}>
            {e.message}
            {e.refs?.workOrderId && (
              <button onClick={() => selectWo(e.refs!.workOrderId!)} className="ml-1.5 text-[11px] text-muted underline-offset-2 opacity-0 transition group-hover:opacity-100 hover:text-accent hover:underline">
                open
              </button>
            )}
          </span>
          <span className="mono hidden shrink-0 text-[10px] uppercase tracking-wider text-faint sm:block">{e.kind}</span>
        </li>
      ))}
    </ol>
  );
}

/** The relay: a work order's steps as a baton passed between agent kinds. */
export function Relay({ snap, wo, size = 'md' }: { snap: Snapshot; wo: WorkOrder; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-1">
      {wo.steps.map((st, i) => {
        const a = agentOf(snap, st.assigneeId);
        const kind = a?.kind ?? st.preferKinds?.[0];
        const active = i === wo.currentStep && wo.status !== 'done';
        const done = st.status === 'done';
        return (
          <div key={st.id} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              title={`${st.label}${a ? ` · ${a.name}` : ''}`}
              className={cx(
                'relative flex shrink-0 items-center justify-center rounded-full border',
                size === 'sm' ? 'size-5' : 'size-7',
                done ? 'border-transparent bg-text/10' : active ? 'border-text/60 bg-raised' : 'border-dashed border-line-strong',
              )}
            >
              {kind ? <KindGlyph kind={kind} size={size === 'sm' ? 9 : 12} className={cx(!done && !active && 'opacity-40')} /> : <span className="size-1 rounded-full bg-faint" />}
              {active && st.status !== 'awaiting' && <span className="absolute -inset-0.5 animate-ping rounded-full border border-signal/50" />}
            </div>
            {i < wo.steps.length - 1 && (
              <div className="relative h-px min-w-2 flex-1 bg-line-strong">
                <div className="absolute inset-y-0 left-0 bg-signal transition-[width] duration-500" style={{ width: done ? '100%' : active ? `${Math.round(st.progress * 100)}%` : '0%' }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WorkOrderRow({ snap, wo, onClick, selected }: { snap: Snapshot; wo: WorkOrder; onClick?: () => void; selected?: boolean }) {
  const st = wo.steps[wo.currentStep];
  const a = agentOf(snap, st?.assigneeId);
  const late = wo.status !== 'done' && snap.clock > wo.dueAt;
  return (
    <button onClick={onClick} className={cx('group flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-text/[0.03]', selected && 'bg-accent/[0.06] shadow-[inset_2px_0_0_var(--accent)]')}>
      <div className="flex items-center gap-2">
        <PriorityPill p={wo.priority} />
        <span className="mono text-[11px] text-muted">{wo.code}</span>
        {wo.source === 'sensor' && <span className="mono rounded bg-warn/15 px-1 text-[10px] text-warn">SENSOR</span>}
        {wo.source === 'copilot' && <span className="mono rounded bg-ai/15 px-1 text-[10px] text-ai">COPILOT</span>}
        {wo.source === 'field' && <span className="mono rounded bg-human/15 px-1 text-[10px] text-human">FIELD</span>}
        <span className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: WO_STATUS[wo.status].color }}>
          <span className="size-1.5 rounded-full" style={{ background: WO_STATUS[wo.status].color }} />
          {WO_STATUS[wo.status].label}
        </span>
      </div>
      <div className="truncate text-[13.5px] font-medium">{wo.title}</div>
      <Relay snap={snap} wo={wo} size="sm" />
      <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
        <span className="truncate">
          {wo.status === 'done' ? 'Completed' : st ? `${wo.currentStep + 1}/${wo.steps.length} · ${st.label}` : ''}
          {a && wo.status !== 'done' && <span className="text-text/80"> · {a.name}</span>}
        </span>
        <span className={cx('mono shrink-0 tnum', late && 'text-danger')}>due {t(wo.dueAt)}</span>
      </div>
    </button>
  );
}

function FactorBars({ c }: { c: Candidate }) {
  return (
    <div className="grid grid-cols-[84px_1fr_34px] items-center gap-x-2 gap-y-1">
      {c.factors
        .filter((f) => f.weight > 0)
        .map((f) => (
          <div key={f.factor} className="contents">
            <span className="mono text-[10.5px] uppercase tracking-wide text-muted">{f.factor}</span>
            <div className="relative h-1.5 rounded-full bg-text/8" title={f.note}>
              <div className="absolute inset-y-0 left-0 rounded-full bg-text/60" style={{ width: `${f.value * 100}%` }} />
            </div>
            <span className="mono text-right text-[10.5px] text-faint tnum">{Math.round(f.weight * 100)}%</span>
          </div>
        ))}
    </div>
  );
}

export function DispatchExplainer({ snap, wo }: { snap: Snapshot; wo: WorkOrder }) {
  const send = useStrata((s) => s.send);
  const st = wo.steps[wo.currentStep];
  const asg = st?.assignment;
  if (!st || wo.status === 'done' || wo.status === 'cancelled') return null;
  if (!asg)
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-3 text-sm text-muted">
        Waiting for a qualified, available agent for <span className="text-text">{st.label}</span> ({st.requires.map((r) => CAPABILITY_LABELS[r]).join(' + ')}). Strata dispatches automatically the moment one frees up.
      </div>
    );
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="text-[13px] text-muted">
          Why <span className="text-text">{agentOf(snap, asg.agentId)?.name}</span>? Ranked under the <span className="text-text">{POLICY_LABELS[asg.policy].label.toLowerCase()}</span> policy{asg.manual ? ' · operator override' : ''}.
        </div>
      </div>
      <ol className="space-y-2">
        {asg.candidates.map((c, i) => {
          const a = agentOf(snap, c.agentId)!;
          const chosen = c.agentId === asg.agentId;
          const live = snap.agents.find((x) => x.id === c.agentId);
          const canAssign = !chosen && live && !live.taskRef && live.status !== 'offline';
          return (
            <li key={c.agentId} className={cx('rounded-lg border p-3', chosen ? 'border-accent/50 bg-accent/[0.05]' : 'border-line')}>
              <div className="flex items-center gap-2">
                <span className="mono w-4 text-[11px] text-faint">{i + 1}</span>
                <KindGlyph kind={a.kind} />
                <span className="text-[13px] font-medium">{a.name}</span>
                <span className="truncate text-[12px] text-muted">{a.role}</span>
                <span className={cx('mono ml-auto text-[13px] font-semibold tnum', chosen ? 'text-accent' : c.eligible ? 'text-text' : 'text-faint')}>{c.score}</span>
              </div>
              {c.blockers.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                  {c.blockers.map((b) => (
                    <span key={b} className="inline-flex items-center gap-1 rounded bg-danger/10 px-1.5 py-0.5 text-[11px] text-danger">
                      <CircleSlash className="size-3" />
                      {b}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 pl-6">
                  <FactorBars c={c} />
                </div>
              )}
              {canAssign && c.eligible !== undefined && (
                <div className="mt-2 pl-6">
                  <Button size="sm" variant="ghost" className="-ml-2 h-7" onClick={() => send({ type: 'reassign_step', workOrderId: wo.id, agentId: c.agentId })}>
                    <RotateCcw className="size-3.5" /> Assign {a.name.split(' ')[0]} instead
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function WorkOrderDetail({ snap, wo, onClose }: { snap: Snapshot; wo: WorkOrder; onClose?: () => void }) {
  const send = useStrata((s) => s.send);
  const site = snap.sites.find((s) => s.id === wo.siteId)!;
  const zone = site.zones.find((z) => z.id === wo.zoneId);
  const asset = wo.assetId ? snap.assets.find((a) => a.id === wo.assetId) : undefined;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PriorityPill p={wo.priority} />
            <span className="mono text-[11px] text-muted">{wo.code}</span>
            <span className="text-[11px]" style={{ color: WO_STATUS[wo.status].color }}>
              ● {WO_STATUS[wo.status].label}
            </span>
          </div>
          <h3 className="font-display mt-1.5 text-xl leading-tight font-semibold tracking-tight">{wo.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {site.name} · {zone?.name}
            </span>
            <span>Created {t(wo.createdAt)} via {wo.source}</span>
            <span className={cx(snap.clock > wo.dueAt && wo.status !== 'done' && 'text-danger')}>Due {t(wo.dueAt)}</span>
            {asset && <span>Asset: {asset.name} · health {Math.round(asset.health)}</span>}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        )}
      </div>
      <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4">
        <section>
          <h4 className="mono mb-2 text-[10.5px] uppercase tracking-[0.14em] text-muted">Relay plan</h4>
          <ol className="relative space-y-0">
            {wo.steps.map((st, i) => {
              const a = agentOf(snap, st.assigneeId);
              const active = i === wo.currentStep && wo.status !== 'done' && wo.status !== 'cancelled';
              return (
                <li key={st.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < wo.steps.length - 1 && <span className={cx('absolute top-7 bottom-0 left-[13px] w-px', st.status === 'done' ? 'bg-signal/60' : 'bg-line-strong')} />}
                  <div className={cx('relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border bg-surface', st.status === 'done' ? 'border-signal/60' : active ? 'border-text/60' : 'border-dashed border-line-strong')}>
                    {st.status === 'done' ? <Check className="size-3.5 text-signal" /> : a ? <KindGlyph kind={a.kind} size={12} /> : <span className="mono text-[10px] text-faint">{i + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cx('text-[13.5px] font-medium', !active && st.status !== 'done' && 'text-muted')}>{st.label}</span>
                      {st.remote && <span className="mono rounded bg-ai/15 px-1 text-[9.5px] text-ai">REMOTE</span>}
                      <span className="mono ml-auto text-[10.5px] text-faint">{st.durationMin}m</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {st.requires.map((r) => CAPABILITY_LABELS[r]).join(' + ')}
                      {a && (
                        <>
                          {' · '}
                          <span className="text-text/85">{a.name}</span>
                        </>
                      )}
                      {' · '}
                      {STEP_STATUS[st.status]}
                    </div>
                    {active && st.status === 'in_progress' && <Meter value={st.progress * 100} className="mt-2" />}
                    {st.output && <div className="mt-1.5 rounded-md bg-text/[0.04] px-2 py-1 text-[12px] text-text/85">↳ {st.output}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
        <section>
          <h4 className="mono mb-2 text-[10.5px] uppercase tracking-[0.14em] text-muted">Dispatch decision</h4>
          <DispatchExplainer snap={snap} wo={wo} />
        </section>
      </div>
      {(wo.status === 'active' || wo.status === 'blocked') && (
        <div className="flex gap-2 border-t border-line p-3">
          <Button variant="ghost" size="sm" onClick={() => send({ type: 'cancel_work_order', workOrderId: wo.id })}>
            <X className="size-3.5" /> Cancel work order
          </Button>
        </div>
      )}
    </div>
  );
}

export function AgentDetail({ snap, agent, onClose }: { snap: Snapshot; agent: Agent; onClose?: () => void }) {
  const send = useStrata((s) => s.send);
  const selectWo = useStrata((s) => s.selectWo);
  const wo = agent.taskRef ? snap.workOrders.find((w) => w.id === agent.taskRef!.workOrderId) : undefined;
  const st = wo ? wo.steps[agent.taskRef!.stepIndex] : undefined;
  const site = snap.sites.find((s) => s.id === agent.siteId);
  const zone = site?.zones.find((z) => agent.pos.x >= z.rect.x && agent.pos.x <= z.rect.x + z.rect.w && agent.pos.y >= z.rect.y && agent.pos.y <= z.rect.y + z.rect.h);
  const history = snap.workOrders.filter((w) => w.steps.some((s) => s.assigneeId === agent.id && s.status === 'done')).slice(0, 5);
  const machine = agent.kind === 'robot' || agent.kind === 'drone' || agent.kind === 'vehicle';
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <div className="flex size-10 items-center justify-center rounded-xl border border-line-strong bg-raised">
          <KindGlyph kind={agent.kind} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight font-semibold">{agent.name}</div>
          <div className="text-[12.5px] text-muted">
            {agent.role} · {site?.name ?? 'Cloud'}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[12px]">
            <StatusDot status={agent.status} pulse />
            <span style={{ color: STATUS_META[agent.status].color }}>{STATUS_META[agent.status].label}</span>
            {zone && <span className="text-muted">· {zone.name}</span>}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        )}
      </div>
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4 text-[13px]">
        {agent.kind !== 'ai' && (
          <div>
            <div className="mb-1 flex justify-between text-[12px] text-muted">
              <span>{agent.kind === 'human' ? 'Shift energy' : 'Battery'}</span>
              <span className="mono tnum">{Math.round(agent.battery)}%</span>
            </div>
            <Meter value={agent.battery} warnBelow={25} color={KIND_META[agent.kind].color} />
          </div>
        )}
        {wo && st ? (
          <button onClick={() => selectWo(wo.id)} className="w-full rounded-lg border border-line p-3 text-left hover:border-line-strong">
            <div className="mono text-[10.5px] uppercase tracking-wider text-muted">Current step · {wo.code}</div>
            <div className="mt-1 font-medium">{st.label}</div>
            <div className="text-[12px] text-muted">{wo.title}</div>
            {st.status === 'in_progress' && <Meter value={st.progress * 100} className="mt-2" />}
            {st.status === 'enroute' && <div className="mt-1 text-[12px] text-drone">En route to location</div>}
          </button>
        ) : (
          <div className="rounded-lg border border-dashed border-line p-3 text-muted">No active step — available for dispatch.</div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Steps done', agent.stats.completed],
            ['Busy min', Math.round(agent.stats.busyMinutes)],
            ['Rate', `$${agent.costPerHour}/h`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-text/[0.04] px-2 py-2">
              <div className="font-display text-lg font-semibold tnum">{v}</div>
              <div className="mono text-[10px] uppercase tracking-wider text-muted">{k}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="mono mb-1.5 text-[10.5px] uppercase tracking-wider text-muted">Capabilities</div>
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.map((c) => (
              <span key={c} className="rounded-md border border-line px-1.5 py-0.5 text-[11.5px]">
                {CAPABILITY_LABELS[c]}
              </span>
            ))}
          </div>
        </div>
        {agent.certifications.length > 0 && (
          <div>
            <div className="mono mb-1.5 text-[10.5px] uppercase tracking-wider text-muted">Certifications</div>
            <div className="flex flex-wrap gap-1">
              {agent.certifications.map((c) => (
                <span key={c} className="mono rounded-md bg-ok/10 px-1.5 py-0.5 text-[11px] text-ok">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
        {history.length > 0 && (
          <div>
            <div className="mono mb-1.5 text-[10.5px] uppercase tracking-wider text-muted">Recent work</div>
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-2 text-[12px]">
                  <span className="truncate text-text/85">{h.title}</span>
                  <span className="mono shrink-0 text-faint">{h.code}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <KindTag kind={agent.kind} />
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        {machine && (
          <Button size="sm" variant="outline" onClick={() => send({ type: 'recall_agent', agentId: agent.id })}>
            <BatteryCharging className="size-3.5" /> Recall to charge
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => send({ type: 'set_agent_online', agentId: agent.id, online: agent.status === 'offline' })}>
          <Power className="size-3.5" /> {agent.status === 'offline' ? 'Bring online' : 'Take offline'}
        </Button>
      </div>
    </div>
  );
}

export function SafetyBadge({ snap, siteId }: { snap: Snapshot; siteId?: string }) {
  const open = snap.incidents.filter((i) => !i.resolved && (!siteId || i.siteId === siteId)).length;
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]', open ? 'bg-danger/15 text-danger' : 'bg-ok/10 text-ok')}>
      <ShieldAlert className="size-3" />
      {open ? `${open} open` : 'All clear'}
    </span>
  );
}

export function ArrowLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-accent">
      {children} <ArrowRight className="size-3" />
    </button>
  );
}

export { ago };
