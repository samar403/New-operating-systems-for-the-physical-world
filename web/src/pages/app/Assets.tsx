import { TEMPLATES, type Asset } from '@core/index';
import { Gauge, Thermometer, Waves, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Segmented, Sparkline, cx } from '@/components/ui';
import { useStrata } from '@/lib/store';

const healthColor = (h: number) => (h < 40 ? 'var(--danger)' : h < 65 ? 'var(--warn)' : 'var(--ok)');

function Ring({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-label={`Health ${Math.round(value)}`} role="img">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
      <circle cx="34" cy="34" r={r} fill="none" stroke={healthColor(value)} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 34 34)" style={{ transition: 'stroke-dasharray 600ms' }} />
      <text x="34" y="38" textAnchor="middle" className="font-display" fontSize="16" fontWeight="600" fill="var(--text)">
        {Math.round(value)}
      </text>
    </svg>
  );
}

function AssetCard({ asset }: { asset: Asset }) {
  const snap = useStrata((s) => s.snap)!;
  const send = useStrata((s) => s.send);
  const selectWo = useStrata((s) => s.selectWo);
  const template = TEMPLATES.find((t) => t.assetTypes?.includes(asset.type));
  const wo = asset.openWorkOrderId ? snap.workOrders.find((w) => w.id === asset.openWorkOrderId) : undefined;
  const hoursTo = asset.drift < 0 ? Math.max(0, (asset.health - 58) / -asset.drift) : Infinity;
  const site = snap.sites.find((s) => s.id === asset.siteId)!;
  return (
    <div className={cx('card viewfinder flex flex-col gap-3 p-4', asset.health < 40 && 'ring-1 ring-danger/40')}>
      <div className="flex items-start gap-3">
        <Ring value={asset.health} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{asset.name}</div>
          <div className="text-[12px] text-muted">
            {asset.type} · {site.name}
          </div>
          <div className="mt-1.5 text-[12px]" style={{ color: healthColor(asset.health) }}>
            {wo ? `Being serviced · ${wo.code}` : hoursTo === Infinity ? 'Stable' : hoursTo < 0.5 ? 'At service threshold' : `~${hoursTo.toFixed(1)} h to service threshold`}
          </div>
        </div>
      </div>
      <Sparkline data={asset.history} color={healthColor(asset.health)} height={34} />
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div className="rounded-md bg-text/[0.04] px-2 py-1.5">
          <Thermometer className="mb-0.5 size-3 text-muted" />
          <div className="mono tnum">{asset.telemetry.temp}°C</div>
        </div>
        <div className="rounded-md bg-text/[0.04] px-2 py-1.5">
          <Waves className="mb-0.5 size-3 text-muted" />
          <div className="mono tnum">{asset.telemetry.vibration} mm/s</div>
        </div>
        <div className="rounded-md bg-text/[0.04] px-2 py-1.5">
          <Gauge className="mb-0.5 size-3 text-muted" />
          <div className="mono tnum">{asset.telemetry.load}%</div>
        </div>
      </div>
      {wo ? (
        <Button size="sm" variant="subtle" onClick={() => selectWo(wo.id)}>
          Open {wo.code} · step {wo.currentStep + 1}/{wo.steps.length}
        </Button>
      ) : template ? (
        <Button size="sm" variant="outline" onClick={() => send({ type: 'create_work_order', templateId: template.id, siteId: asset.siteId, assetId: asset.id, priority: asset.health < 40 ? 'P1' : 'P3' })}>
          <Wrench className="size-3.5" /> Raise work order
        </Button>
      ) : null}
    </div>
  );
}

export default function Assets() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const [scope, setScope] = useState<'site' | 'all'>('all');
  const assets = snap.assets.filter((a) => scope === 'all' || a.siteId === siteId).sort((a, b) => a.health - b.health);
  const sensorRaised = snap.workOrders.filter((w) => w.source === 'sensor');

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <Card
        title="Predictive maintenance"
        action={
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'All sites' },
              { value: 'site', label: 'This site' },
            ]}
          />
        }
      >
        <p className="max-w-3xl text-[13.5px] text-muted">
          Telemetry Doctor watches every connected asset. When health crosses the service threshold it raises a work order on its own — diagnosis by AI, inspection by a robot or drone, repair by a certified technician, and verification back in software.{' '}
          <span className="text-text">{sensorRaised.length} sensor-raised work orders</span> so far this shift.
        </p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {assets.map((a) => (
          <AssetCard key={a.id} asset={a} />
        ))}
      </div>
    </div>
  );
}
