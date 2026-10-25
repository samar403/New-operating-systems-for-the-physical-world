import { Hand, Play } from 'lucide-react';
import { SiteTwin } from '@/components/twin/SiteTwin';
import { AgentDetail } from '@/components/ops';
import { Card, KindGlyph, StatusDot, cx } from '@/components/ui';
import { STATUS_META } from '@/lib/format';
import { useStrata } from '@/lib/store';
import { Legend } from './CommandCenter';

export default function Twin() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const selectedAgentId = useStrata((s) => s.selectedAgentId);
  const selectAgent = useStrata((s) => s.selectAgent);
  const selectWo = useStrata((s) => s.selectWo);
  const send = useStrata((s) => s.send);
  const site = snap.sites.find((s) => s.id === siteId)!;
  const agents = snap.agents.filter((a) => a.siteId === siteId);
  const cloud = snap.agents.filter((a) => a.kind === 'ai');
  const selected = selectedAgentId ? snap.agents.find((a) => a.id === selectedAgentId) : undefined;

  return (
    <div className="mx-auto grid max-w-[1700px] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        <Card flush>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Cloud agents</span>
            {cloud.map((a) => {
              const wo = a.taskRef ? snap.workOrders.find((w) => w.id === a.taskRef!.workOrderId) : undefined;
              return (
                <button
                  key={a.id}
                  onClick={() => selectAgent(a.id)}
                  className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition', a.taskRef ? 'border-ai/50 bg-ai/10' : 'border-line text-muted', selectedAgentId === a.id && 'ring-1 ring-text/40')}
                  title={wo ? `${wo.code} · ${wo.steps[a.taskRef!.stepIndex].label}` : 'Idle'}
                >
                  <KindGlyph kind="ai" size={10} className={a.taskRef ? 'animate-spin [animation-duration:3s]' : undefined} />
                  {a.name}
                </button>
              );
            })}
          </div>
          <div className="p-3">
            <SiteTwin snap={snap} siteId={siteId} selectedAgentId={selectedAgentId} onSelectAgent={selectAgent} onSelectWo={selectWo} className="aspect-[106/70] w-full" />
          </div>
          <div className="border-t border-line px-4 py-2.5">
            <Legend />
          </div>
        </Card>

        <Card title="Geofences · tap to hold or release machines">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {site.zones.map((z) => (
              <button
                key={z.id}
                onClick={() => send({ type: z.robotsPaused ? 'resume_zone' : 'pause_zone', zoneId: z.id, reason: 'operator hold from twin' })}
                className={cx('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] transition', z.robotsPaused ? 'border-danger/50 bg-danger/10' : 'border-line hover:border-line-strong')}
              >
                {z.robotsPaused ? <Play className="size-3.5 text-ok" /> : <Hand className="size-3.5 text-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{z.name}</span>
                  <span className="block text-[11px] text-muted">
                    {z.robotsPaused ? 'Machines held — tap to release' : z.humanOnly ? 'Human-only zone' : z.hazard ? `${z.hazard} hazard` : z.kind}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <aside className="card viewfinder flex max-h-[calc(100vh-110px)] self-start min-h-[420px] flex-col overflow-hidden xl:sticky xl:top-[72px]">
        {selected ? (
          <AgentDetail snap={snap} agent={selected} onClose={() => selectAgent(null)} />
        ) : (
          <>
            <header className="border-b border-line px-4 py-3">
              <h2 className="mono text-[11px] uppercase tracking-[0.14em] text-muted">On site · {agents.length}</h2>
            </header>
            <ul className="scroll-thin flex-1 divide-y divide-line overflow-y-auto">
              {agents.map((a) => {
                const wo = a.taskRef ? snap.workOrders.find((w) => w.id === a.taskRef!.workOrderId) : undefined;
                return (
                  <li key={a.id}>
                    <button onClick={() => selectAgent(a.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-text/[0.03]">
                      <KindGlyph kind={a.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{a.name}</span>
                        <span className="block truncate text-[11.5px] text-muted">{wo ? `${wo.code} · ${wo.steps[a.taskRef!.stepIndex].label}` : a.role}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: STATUS_META[a.status].color }}>
                        <StatusDot status={a.status} />
                        {STATUS_META[a.status].label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}
