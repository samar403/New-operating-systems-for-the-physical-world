import { useMemo, useState } from 'react';
import { Card, KindGlyph, Segmented } from '@/components/ui';
import { KIND_META, t } from '@/lib/format';
import { useStrata } from '@/lib/store';

interface Block {
  woId: string;
  code: string;
  label: string;
  travelFrom?: number;
  start: number;
  end: number;
  live: boolean;
  projected: boolean;
}

export default function ShiftTape() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const selectWo = useStrata((s) => s.selectWo);
  const [windowMin, setWindowMin] = useState<'120' | '240' | '480'>('240');
  const span = Number(windowMin);
  const ahead = span * 0.18;
  const t0 = Math.max(0, snap.clock - span);
  const t1 = snap.clock + ahead;
  const x = (v: number) => ((Math.min(Math.max(v, t0), t1) - t0) / (t1 - t0)) * 100;

  const lanes = useMemo(() => {
    const agents = snap.agents.filter((a) => a.siteId === siteId || a.siteId === '*');
    const map = new Map<string, Block[]>(agents.map((a) => [a.id, []]));
    for (const wo of snap.workOrders) {
      if (wo.siteId !== siteId) continue;
      wo.steps.forEach((st) => {
        if (!st.assigneeId || !map.has(st.assigneeId) || !st.assignment) return;
        const live = st.status === 'in_progress' || st.status === 'enroute';
        const start = st.startedAt ?? snap.clock;
        const end = st.finishedAt ?? (st.status === 'in_progress' ? snap.clock + (1 - st.progress) * st.durationMin : snap.clock + st.durationMin);
        map.get(st.assigneeId)!.push({ woId: wo.id, code: wo.code, label: st.label, travelFrom: st.assignment.at < start ? st.assignment.at : undefined, start, end, live, projected: !st.finishedAt });
      });
    }
    return agents.map((a) => ({ agent: a, blocks: map.get(a.id)!.filter((b) => b.end >= t0) }));
  }, [snap, siteId, t0]);

  const ticks: number[] = [];
  const step = span <= 120 ? 15 : span <= 240 ? 30 : 60;
  for (let v = Math.ceil(t0 / step) * step; v <= t1; v += step) ticks.push(v);

  return (
    <Card
      flush
      title="Shift tape · who did what, when"
      action={
        <Segmented
          size="sm"
          value={windowMin}
          onChange={setWindowMin}
          options={[
            { value: '120', label: '2h' },
            { value: '240', label: '4h' },
            { value: '480', label: '8h' },
          ]}
        />
      }
      className="mx-auto max-w-[1600px]"
    >
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="relative ml-56 h-8 border-b border-line">
            {ticks.map((v) => (
              <span key={v} className="mono absolute top-2 -translate-x-1/2 text-[10.5px] text-faint" style={{ left: `${x(v)}%` }}>
                {t(v)}
              </span>
            ))}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 left-56">
              {ticks.map((v) => (
                <div key={v} className="absolute inset-y-0 w-px bg-line" style={{ left: `${x(v)}%` }} />
              ))}
              <div className="absolute inset-y-0 z-[2] w-px bg-accent" style={{ left: `${x(snap.clock)}%` }}>
                <span className="mono absolute -top-1 left-1 rounded bg-accent px-1 text-[9.5px] font-semibold text-accent-ink">NOW</span>
              </div>
              <div className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(-45deg,var(--grid)_0_6px,transparent_6px_12px)]" style={{ left: `${x(snap.clock)}%` }} />
            </div>
            {lanes.map(({ agent, blocks }) => (
              <div key={agent.id} className="flex h-10 items-center border-b border-line last:border-b-0">
                <div className="flex w-56 shrink-0 items-center gap-2 px-4">
                  <KindGlyph kind={agent.kind} size={11} />
                  <span className="truncate text-[12.5px]">{agent.name}</span>
                </div>
                <div className="relative h-full flex-1">
                  {blocks.map((b, i) => {
                    const left = x(b.start);
                    const width = Math.max(0.4, x(b.end) - left);
                    const color = KIND_META[agent.kind].color;
                    return (
                      <div key={`${b.woId}-${i}`}>
                        {b.travelFrom !== undefined && (
                          <div className="absolute top-1/2 h-px -translate-y-1/2" style={{ left: `${x(b.travelFrom)}%`, width: `${Math.max(0, left - x(b.travelFrom))}%`, background: color, opacity: 0.5, backgroundImage: 'none' }} />
                        )}
                        <button
                          onClick={() => selectWo(b.woId)}
                          title={`${b.code} · ${b.label} · ${t(b.start)}–${t(b.end)}`}
                          className="absolute top-2 bottom-2 overflow-hidden rounded-[5px] px-1.5 text-left transition hover:brightness-110"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: `color-mix(in oklab, ${color} ${b.projected ? 22 : 34}%, transparent)`,
                            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 55%, transparent)`,
                            borderStyle: b.projected ? 'dashed' : 'solid',
                          }}
                        >
                          <span className="mono block truncate text-[10px] leading-6 text-text">
                            {b.code} {b.label}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-line px-4 py-2.5 text-[11.5px] text-muted">
        <span>Solid = completed or in progress · faded = projected finish · thin line = travel to location</span>
      </div>
    </Card>
  );
}
