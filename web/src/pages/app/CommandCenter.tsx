import { kpis, openOrders, shiftBrief, utilizationByKind } from '@core/index';
import { useNavigate } from 'react-router';
import { SiteTwin } from '@/components/twin/SiteTwin';
import { ArrowLink, EventFeed, WorkOrderRow } from '@/components/ops';
import { Card, KindGlyph, Sparkline, Stat, cx } from '@/components/ui';
import { KIND_META, KINDS, money } from '@/lib/format';
import { useStrata } from '@/lib/store';

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
      {KINDS.filter((k) => k !== 'ai').map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <KindGlyph kind={k} size={11} />
          {KIND_META[k].plural}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="-2 -2 4 4" aria-hidden>
          <circle r="1.1" fill="none" stroke="var(--accent)" strokeWidth="0.3" />
        </svg>
        Work order
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="-2 -2 4 4" aria-hidden>
          <rect x="-1" y="-1" width="2" height="2" fill="none" stroke="var(--ok)" strokeWidth="0.35" transform="rotate(45)" />
        </svg>
        Asset
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="hazard-tape-danger h-2.5 w-4 rounded-sm" />
        Machines held
      </span>
    </div>
  );
}

export default function CommandCenter() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const setSite = useStrata((s) => s.setSite);
  const selectAgent = useStrata((s) => s.selectAgent);
  const selectWo = useStrata((s) => s.selectWo);
  const navigate = useNavigate();
  const k = kpis(snap);
  const series = snap.metrics.series;
  const orders = openOrders(snap, siteId).sort((a, b) => a.priority.localeCompare(b.priority) || a.dueAt - b.dueAt);
  const util = utilizationByKind(snap);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Closed today" value={k.completed} sub={`${k.open} open · ${k.blocked} blocked`}>
          <Sparkline data={series.map((s) => s.completed)} className="mt-1" height={26} />
        </Stat>
        <Stat label="On-time" value={`${k.onTimeRate}%`} sub="of closed work orders" accent={k.onTimeRate < 85 ? 'var(--warn)' : undefined} />
        <Stat label="Field utilisation" value={`${series.at(-1)?.utilization ?? 0}%`} sub="physical agents on a step">
          <Sparkline data={series.map((s) => s.utilization)} color="var(--k-drone)" className="mt-1" height={26} />
        </Stat>
        <Stat label="Machine + AI share" value={`${k.autonomyShare}%`} sub="of all work-minutes" accent="var(--signal)" />
        <Stat label="Est. savings" value={money(k.savings)} sub="vs. a human-only crew" />
        <Stat label="Safety" value={k.openIncidents ? `${k.openIncidents} open` : 'Clear'} sub={`${k.interlocks} interlocks fired`} accent={k.openIncidents ? 'var(--danger)' : 'var(--ok)'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card title="Site twin · live" action={<ArrowLink onClick={() => navigate('/app/twin')}>Full twin</ArrowLink>} flush>
          <div className="p-3">
            <SiteTwin snap={snap} siteId={siteId} onSelectAgent={selectAgent} onSelectWo={selectWo} className="aspect-[106/70] w-full" />
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <Legend />
          </div>
        </Card>

        <Card title={`Open work · ${orders.length}`} action={<ArrowLink onClick={() => navigate('/app/work')}>All work</ArrowLink>} flush>
          <div className="scroll-thin max-h-[560px] divide-y divide-line overflow-y-auto">
            {orders.slice(0, 8).map((wo) => (
              <WorkOrderRow key={wo.id} snap={snap} wo={wo} onClick={() => selectWo(wo.id)} />
            ))}
            {!orders.length && <div className="p-6 text-center text-sm text-muted">Nothing open. The dispatcher is idle.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Workforce mix · all sites">
          <div className="space-y-3">
            {KINDS.map((kind) => {
              const u = util[kind];
              const pct = u.total ? (u.busy / u.total) * 100 : 0;
              return (
                <div key={kind}>
                  <div className="mb-1 flex items-center gap-2 text-[13px]">
                    <KindGlyph kind={kind} size={12} />
                    <span>{KIND_META[kind].plural}</span>
                    <span className="mono ml-auto text-[12px] text-muted tnum">
                      {u.busy}/{u.total} busy
                    </span>
                  </div>
                  <div className="flex h-2 gap-px overflow-hidden rounded-full bg-text/[0.06]">
                    {Array.from({ length: u.total }, (_, i) => (
                      <div key={i} className="h-full flex-1 transition-colors" style={{ background: i < u.busy ? KIND_META[kind].color : 'transparent', opacity: i < u.busy ? 0.9 : 1 }} />
                    ))}
                  </div>
                  <div className="sr-only">{Math.round(pct)}% busy</div>
                </div>
              );
            })}
            <div className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
              {[
                ['Human', snap.metrics.humanMinutes, 'var(--k-human)'],
                ['Machine', snap.metrics.autonomousMinutes, 'var(--k-robot)'],
                ['AI', snap.metrics.aiMinutes, 'var(--k-ai)'],
              ].map(([label, v, c]) => (
                <div key={label as string}>
                  <div className="font-display text-lg font-semibold tnum" style={{ color: c as string }}>
                    {Math.round((v as number) / 60)}h
                  </div>
                  <div className="mono text-[10px] uppercase tracking-wider text-muted">{label} hours</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Live event stream" flush>
          <div className="scroll-thin max-h-[340px] overflow-y-auto">
            <EventFeed snap={snap} limit={30} />
          </div>
        </Card>

        <Card title="Shift brief" action={<ArrowLink onClick={() => navigate('/app/copilot')}>Ask Copilot</ArrowLink>}>
          <div className="space-y-2 text-[13px] leading-relaxed whitespace-pre-line text-text/90">{shiftBrief(snap)}</div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {snap.sites.map((s) => {
          const open = openOrders(snap, s.id).length;
          const people = snap.agents.filter((a) => a.siteId === s.id);
          return (
            <button
              key={s.id}
              onClick={() => {
                setSite(s.id);
                selectAgent(null);
              }}
              className={cx('card viewfinder overflow-hidden text-left transition hover:border-line-strong', siteId === s.id && 'ring-1 ring-accent/50')}
            >
              <SiteTwin snap={snap} siteId={s.id} compact className="pointer-events-none aspect-[106/70] w-full opacity-90" />
              <div className="flex items-center justify-between border-t border-line px-4 py-3">
                <div>
                  <div className="text-[13.5px] font-medium">{s.name}</div>
                  <div className="text-[11.5px] text-muted capitalize">
                    {s.vertical} · {s.city}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono text-[13px] tnum">{open} open</div>
                  <div className="text-[11px] text-muted">{people.length} agents</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
