/**
 * Field App — what a crew member sees on their phone. One job at a time, big
 * targets for gloved hands, a hazard button that actually stops machines.
 */
import { CAPABILITY_LABELS } from '@core/index';
import { CheckCircle2, MapPin, Navigation, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Card, KindGlyph, Meter, cx } from '@/components/ui';
import { t } from '@/lib/format';
import { useStrata } from '@/lib/store';
import { SiteTwin } from '@/components/twin/SiteTwin';

export default function Field() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const send = useStrata((s) => s.send);
  const crew = snap.agents.filter((a) => a.kind === 'human' && a.siteId === siteId);
  const [whoId, setWhoId] = useState((crew.find((c) => c.taskRef) ?? crew[0])?.id);
  const [hazard, setHazard] = useState(false);
  const [note, setNote] = useState('');
  const me = snap.agents.find((a) => a.id === whoId && a.siteId === siteId) ?? crew[0];
  const site = snap.sites.find((s) => s.id === siteId)!;
  if (!me) return null;
  const wo = me.taskRef ? snap.workOrders.find((w) => w.id === me.taskRef!.workOrderId) : undefined;
  const st = wo ? wo.steps[me.taskRef!.stepIndex] : undefined;
  const zone = site.zones.find((z) => me.pos.x >= z.rect.x && me.pos.x <= z.rect.x + z.rect.w && me.pos.y >= z.rect.y && me.pos.y <= z.rect.y + z.rect.h);
  const next = wo?.steps[me.taskRef!.stepIndex + 1];
  const nextAgent = next?.assigneeId ? snap.agents.find((a) => a.id === next.assigneeId) : undefined;

  return (
    <div className="mx-auto grid max-w-[1200px] items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* Phone */}
      <div className="mx-auto w-full max-w-[380px] rounded-[44px] border border-line-strong bg-black p-2.5 shadow-2xl">
        <div className="relative overflow-hidden rounded-[36px] bg-bg">
          <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[12px] font-medium">
            <span className="mono">{t(snap.clock)}</span>
            <span className="h-5 w-20 rounded-full bg-black" />
            <span className="mono text-muted">5G</span>
          </div>
          <div className="space-y-3 px-4 pt-2 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-muted">Signed in as</div>
                <div className="font-display text-lg font-semibold">{me.name}</div>
              </div>
              <div className="text-right text-[11px] text-muted">
                {site.name}
                <div className="flex items-center justify-end gap-1">
                  <MapPin className="size-3" />
                  {zone?.name ?? 'In transit'}
                </div>
              </div>
            </div>

            {wo && st ? (
              <div className="viewfinder rounded-2xl border border-line-strong bg-surface p-4">
                <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-accent">{st.status === 'enroute' ? 'Head to' : 'Now'} · {wo.code}</div>
                <div className="font-display mt-1 text-[22px] leading-tight font-semibold">{st.label}</div>
                <div className="mt-1 text-[13px] text-muted">{wo.title}</div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {st.requires.map((r) => (
                    <span key={r} className="rounded-md border border-line px-1.5 py-0.5 text-[11px]">
                      {CAPABILITY_LABELS[r]}
                    </span>
                  ))}
                </div>
                {st.status === 'in_progress' && <Meter value={st.progress * 100} className="mt-3 h-2" />}
                {st.status === 'enroute' && (
                  <div className="mt-3 flex items-center gap-2 text-[13px] text-drone">
                    <Navigation className="size-4" /> Route on site map · {Math.round(Math.hypot(me.pos.x - wo.location.x, me.pos.y - wo.location.y) * 2)} m
                  </div>
                )}
                {next && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-text/[0.04] px-2.5 py-2 text-[12px] text-muted">
                    <span>Hands off to</span>
                    {nextAgent ? (
                      <>
                        <KindGlyph kind={nextAgent.kind} size={10} />
                        <span className="text-text">{nextAgent.name}</span>
                      </>
                    ) : (
                      <span className="text-text">{next.preferKinds?.[0] ?? 'next agent'}</span>
                    )}
                    <span>· {next.label}</span>
                  </div>
                )}
                <button
                  onClick={() => send({ type: 'complete_step', workOrderId: wo.id, agentId: me.id })}
                  className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ok text-[16px] font-semibold text-black transition active:scale-[0.99]"
                >
                  <CheckCircle2 className="size-5" /> Mark step done
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-line-strong p-5 text-center">
                <div className="font-display text-lg font-semibold">You're free.</div>
                <div className="mt-1 text-[13px] text-muted">Strata will buzz you the moment a job that needs your skills comes up nearby.</div>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-line">
              <SiteTwin snap={snap} siteId={siteId} selectedAgentId={me.id} compact className="aspect-[106/70] w-full" />
            </div>

            {hazard ? (
              <div className="rise space-y-2 rounded-2xl border border-danger/50 bg-danger/10 p-3">
                <div className="text-[13px] font-medium text-danger">Report hazard in {zone?.name ?? 'this area'}</div>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong? (e.g. exposed wiring)" className="h-11 w-full rounded-lg border border-line-strong bg-bg px-3 text-[14px] outline-none" aria-label="Hazard description" />
                <div className="flex gap-2">
                  <button onClick={() => setHazard(false)} className="h-11 flex-1 rounded-lg border border-line-strong text-[14px]">
                    Cancel
                  </button>
                  <button
                    disabled={!zone}
                    onClick={async () => {
                      if (!zone) return;
                      await send({ type: 'report_hazard', siteId, zoneId: zone.id, agentId: me.id, note: note.trim() || 'Hazard reported from field' });
                      setHazard(false);
                      setNote('');
                    }}
                    className="h-11 flex-[2] rounded-lg bg-danger text-[14px] font-semibold text-white disabled:opacity-40"
                  >
                    Stop machines & report
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setHazard(true)} className="relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-danger/50 text-[14px] font-semibold text-danger">
                <span className="hazard-tape-danger absolute inset-y-0 left-0 w-3 opacity-70" />
                <TriangleAlert className="size-4" /> Report a hazard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Explainer + persona picker */}
      <div className="space-y-4">
        <Card title="Preview as">
          <div className="grid gap-2 sm:grid-cols-2">
            {crew.map((c) => (
              <button key={c.id} onClick={() => setWhoId(c.id)} className={cx('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition', c.id === me.id ? 'border-accent/60 bg-accent/[0.06]' : 'border-line hover:border-line-strong')}>
                <KindGlyph kind="human" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{c.name}</span>
                  <span className="block truncate text-[11.5px] text-muted">{c.taskRef ? 'On a job' : 'Available'} · {c.role}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Why a field app matters">
          <ul className="space-y-2.5 text-[13.5px] text-muted">
            <li>
              <span className="text-text">One job at a time.</span> Crews see the step they own, where it is, and who takes the baton next — not a dashboard.
            </li>
            <li>
              <span className="text-text">The hazard button is wired to the machines.</span> Reporting pauses every robot, drone and vehicle in that zone instantly and opens an incident.
            </li>
            <li>
              <span className="text-text">Done means done.</span> Marking a step complete hands off to the next agent — robot, AI or person — with no radio call.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
