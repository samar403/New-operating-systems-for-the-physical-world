import { CAPABILITY_LABELS, type AgentKind } from '@core/index';
import { useState } from 'react';
import { AgentDetail } from '@/components/ops';
import { Card, KindGlyph, Meter, Segmented, StatusDot, cx } from '@/components/ui';
import { KIND_META, KINDS, STATUS_META } from '@/lib/format';
import { useStrata } from '@/lib/store';

export default function Workforce() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const selectedAgentId = useStrata((s) => s.selectedAgentId);
  const selectAgent = useStrata((s) => s.selectAgent);
  const [kind, setKind] = useState<AgentKind | 'all'>('all');
  const [scope, setScope] = useState<'site' | 'all'>('site');

  const agents = snap.agents
    .filter((a) => scope === 'all' || a.siteId === siteId || a.siteId === '*')
    .filter((a) => kind === 'all' || a.kind === kind);
  const selected = selectedAgentId ? snap.agents.find((a) => a.id === selectedAgentId) : undefined;

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {KINDS.map((k) => {
            const all = snap.agents.filter((a) => a.kind === k && (scope === 'all' || a.siteId === siteId || a.siteId === '*'));
            const busy = all.filter((a) => a.taskRef).length;
            return (
              <button key={k} onClick={() => setKind(kind === k ? 'all' : k)} className={cx('card viewfinder px-4 py-3 text-left transition', kind === k && 'ring-1 ring-accent/60')}>
                <div className="flex items-center gap-2">
                  <KindGlyph kind={k} size={13} />
                  <span className="text-[13px]">{KIND_META[k].plural}</span>
                </div>
                <div className="font-display mt-1 text-2xl font-semibold tnum">
                  {busy}
                  <span className="text-base text-muted">/{all.length}</span>
                </div>
                <div className="text-[11px] text-muted">on a step now</div>
              </button>
            );
          })}
        </div>

        <Card
          flush
          title={`Roster · ${agents.length}`}
          action={
            <Segmented
              size="sm"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'site', label: 'This site' },
                { value: 'all', label: 'All sites' },
              ]}
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="mono border-b border-line text-left text-[10.5px] uppercase tracking-[0.12em] text-muted">
                  <th className="px-4 py-2 font-medium">Agent</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Current step</th>
                  <th className="w-28 px-2 py-2 font-medium">Energy</th>
                  <th className="px-2 py-2 font-medium">Capabilities</th>
                  <th className="px-4 py-2 text-right font-medium">Done</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {agents.map((a) => {
                  const wo = a.taskRef ? snap.workOrders.find((w) => w.id === a.taskRef!.workOrderId) : undefined;
                  return (
                    <tr key={a.id} onClick={() => selectAgent(a.id)} className={cx('cursor-pointer hover:bg-text/[0.03]', selectedAgentId === a.id && 'bg-accent/[0.05]')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <KindGlyph kind={a.kind} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{a.name}</div>
                            <div className="truncate text-[11.5px] text-muted">
                              {a.role}
                              {scope === 'all' && ` · ${a.siteId === '*' ? 'cloud' : a.siteId.toUpperCase()}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: STATUS_META[a.status].color }}>
                          <StatusDot status={a.status} />
                          {STATUS_META[a.status].label}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-2 py-2.5 text-[12px] text-muted">
                        <span className="block truncate">{wo ? `${wo.code} · ${wo.steps[a.taskRef!.stepIndex].label}` : '—'}</span>
                      </td>
                      <td className="px-2 py-2.5">
                        {a.kind === 'ai' ? <span className="text-[12px] text-faint">n/a</span> : <Meter value={a.battery} warnBelow={25} color={KIND_META[a.kind].color} />}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {a.capabilities.slice(0, 3).map((c) => (
                            <span key={c} className="rounded border border-line px-1.5 text-[11px] text-muted">
                              {CAPABILITY_LABELS[c]}
                            </span>
                          ))}
                          {a.capabilities.length > 3 && <span className="text-[11px] text-faint">+{a.capabilities.length - 3}</span>}
                        </div>
                      </td>
                      <td className="mono px-4 py-2.5 text-right tnum">{a.stats.completed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <aside className="card viewfinder max-h-[calc(100vh-110px)] min-h-[420px] self-start overflow-hidden xl:sticky xl:top-[72px]">
        {selected ? (
          <AgentDetail snap={snap} agent={selected} onClose={() => selectAgent(null)} />
        ) : (
          <div className="flex h-full flex-col justify-center gap-3 p-8 text-center">
            <div className="font-display text-xl font-semibold">One roster. Five kinds of worker.</div>
            <p className="text-sm text-muted">People, robots, drones, vehicles and software agents share one capability model — so the dispatcher can hand any step to whoever is best placed to do it safely.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
