import { POLICY_LABELS, POLICY_WEIGHTS, type DispatchPolicy } from '@core/index';
import { RotateCcw } from 'lucide-react';
import { Button, Card, cx } from '@/components/ui';
import { useStrata } from '@/lib/store';

const INTEGRATIONS = [
  { name: 'Procore / Autodesk Build', kind: 'Project management', status: 'Planned' },
  { name: 'BIM (IFC) models', kind: 'Digital twin geometry', status: 'Planned' },
  { name: 'ROS 2 / VDA 5050', kind: 'Robot fleet protocol', status: 'Adapter spec' },
  { name: 'MAVLink', kind: 'Drone control', status: 'Adapter spec' },
  { name: 'Samsara / Geotab', kind: 'Vehicle telematics', status: 'Planned' },
  { name: 'BACnet / Modbus', kind: 'Building & asset telemetry', status: 'Planned' },
  { name: 'Maximo / UpKeep', kind: 'CMMS work orders', status: 'Planned' },
  { name: 'LLM Copilot', kind: 'Natural-language operations (optional)', status: 'Built in' },
];

const FACTOR_LABEL: Record<string, string> = {
  proximity: 'Proximity / ETA',
  cost: 'Cost',
  battery: 'Battery & energy',
  preference: 'Kind preference',
  safety: 'Safety exposure',
  workload: 'Fair workload',
};

export default function Settings() {
  const snap = useStrata((s) => s.snap)!;
  const send = useStrata((s) => s.send);
  const mode = useStrata((s) => s.mode);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <Card title="Dispatch policy">
        <p className="mb-4 max-w-2xl text-[13.5px] text-muted">Hard constraints (capability, certification, geofence, battery, interlocks) are never traded off. The policy only weighs the soft factors among agents that are already safe and qualified.</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(POLICY_LABELS) as DispatchPolicy[]).map((p) => (
            <button key={p} onClick={() => send({ type: 'set_policy', policy: p })} className={cx('rounded-xl border p-4 text-left transition', snap.policy === p ? 'border-accent/60 bg-accent/[0.06]' : 'border-line hover:border-line-strong')}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{POLICY_LABELS[p].label}</span>
                {snap.policy === p && <span className="mono rounded bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">ACTIVE</span>}
              </div>
              <div className="mt-1 text-[12.5px] text-muted">{POLICY_LABELS[p].blurb}</div>
              <div className="mt-3 space-y-1.5">
                {Object.entries(POLICY_WEIGHTS[p]).map(([f, w]) => (
                  <div key={f} className="grid grid-cols-[100px_1fr] items-center gap-2">
                    <span className="text-[11px] text-muted">{FACTOR_LABEL[f]}</span>
                    <div className="h-1.5 rounded-full bg-text/8">
                      <div className="h-full rounded-full bg-text/60" style={{ width: `${w * 200}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Integrations">
          <ul className="divide-y divide-line">
            {INTEGRATIONS.map((i) => (
              <li key={i.name} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-[12px] text-muted">{i.kind}</div>
                </div>
                <span className={cx('mono rounded px-1.5 py-0.5 text-[10.5px]', i.status === 'Built in' ? 'bg-ok/10 text-ok' : 'bg-text/5 text-muted')}>{i.status}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Environment">
          <dl className="space-y-2.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">Connection</dt>
              <dd>{mode === 'live' ? 'Live (API server)' : 'Edge (in-browser engine)'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">World seed</dt>
              <dd className="mono">{snap.seed}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Tick</dt>
              <dd className="mono">{snap.tick.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Sim minutes / tick</dt>
              <dd className="mono">{snap.minutesPerTick}</dd>
            </div>
          </dl>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => send({ type: 'reset' })}>
            <RotateCcw className="size-3.5" /> Reset world
          </Button>
        </Card>
      </div>
    </div>
  );
}
