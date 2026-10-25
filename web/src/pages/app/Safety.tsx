import type { SafetyIncident } from '@core/index';
import { Check, OctagonAlert, Radar, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { SiteTwin } from '@/components/twin/SiteTwin';
import { Button, Card, Empty, Segmented, Stat, cx } from '@/components/ui';
import { ago, t } from '@/lib/format';
import { useStrata } from '@/lib/store';

const KIND_ICON: Record<SafetyIncident['kind'], typeof Radar> = {
  proximity: Radar,
  'hazard-report': TriangleAlert,
  'e-stop': OctagonAlert,
  geofence: ShieldCheck,
};

const SEV: Record<SafetyIncident['severity'], string> = {
  low: 'text-muted bg-text/5',
  medium: 'text-warn bg-warn/10',
  high: 'text-danger bg-danger/10',
};

export default function Safety() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const send = useStrata((s) => s.send);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const site = snap.sites.find((s) => s.id === siteId)!;
  const incidents = snap.incidents.filter((i) => i.siteId === siteId && (filter === 'all' || !i.resolved));
  const all = snap.incidents.filter((i) => i.siteId === siteId);
  const held = site.zones.filter((z) => z.robotsPaused);

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open incidents" value={all.filter((i) => !i.resolved).length} accent={all.some((i) => !i.resolved) ? 'var(--danger)' : 'var(--ok)'} sub="need a human decision" />
        <Stat label="Proximity interlocks" value={all.filter((i) => i.kind === 'proximity').length} sub="machines auto-held near people" />
        <Stat label="Hazards reported" value={all.filter((i) => i.kind === 'hazard-report').length} sub="from the field app or Copilot" />
        <Stat label="Zones on hold" value={held.length} sub={held.map((z) => z.name).join(', ') || 'none'} accent={held.length ? 'var(--warn)' : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_480px]">
        <Card title="Safety layer · live" flush>
          <div className="p-3">
            <SiteTwin snap={snap} siteId={siteId} className="aspect-[106/70] w-full" />
          </div>
          <div className="grid gap-3 border-t border-line p-4 text-[13px] text-muted sm:grid-cols-3">
            <div>
              <div className="font-medium text-text">3.5 m human buffer</div>
              Heavy machines pause automatically when a person enters their buffer, then creep past at 40% speed.
            </div>
            <div>
              <div className="font-medium text-text">Certified-only zones</div>
              Electrical and fall hazards require NFPA-70E or fall-protection certification before a person can be dispatched there.
            </div>
            <div>
              <div className="font-medium text-text">Geofences</div>
              Human-only and patient-care areas exclude drones and heavy machines at the dispatcher, not just on the map.
            </div>
          </div>
        </Card>

        <Card
          flush
          title="Incident log"
          action={
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'all', label: 'All' },
              ]}
            />
          }
        >
          <ul className="scroll-thin max-h-[640px] divide-y divide-line overflow-y-auto">
            {incidents.map((i) => {
              const Icon = KIND_ICON[i.kind];
              return (
                <li key={i.id} className="rise flex gap-3 px-4 py-3">
                  <span className={cx('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg', SEV[i.severity])}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] leading-snug">{i.summary}</div>
                    <div className="mono mt-1 text-[10.5px] text-faint uppercase">
                      {i.kind} · {i.severity} · {t(i.t)} · {ago(snap.clock, i.t)}
                    </div>
                  </div>
                  {i.resolved ? (
                    <span className="inline-flex h-6 items-center gap-1 text-[11px] text-ok">
                      <Check className="size-3" /> Resolved
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => send({ type: 'resolve_incident', incidentId: i.id })}>
                      Resolve
                    </Button>
                  )}
                </li>
              );
            })}
            {!incidents.length && <Empty title="All clear">No {filter === 'open' ? 'open ' : ''}incidents at {site.name}.</Empty>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
