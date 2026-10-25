import { TEMPLATES, type Priority } from '@core/index';
import { Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { WorkOrderDetail, WorkOrderRow } from '@/components/ops';
import { Button, Card, Empty, KindGlyph, Segmented, cx } from '@/components/ui';
import { useStrata } from '@/lib/store';

type Filter = 'open' | 'blocked' | 'done' | 'all';

function Composer({ onDone }: { onDone: () => void }) {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const send = useStrata((s) => s.send);
  const selectWo = useStrata((s) => s.selectWo);
  const site = snap.sites.find((s) => s.id === siteId)!;
  const templates = TEMPLATES.filter((t) => t.vertical === site.vertical);
  const [templateId, setTemplateId] = useState(templates[0].id);
  const template = templates.find((t) => t.id === templateId)!;
  const [zoneId, setZoneId] = useState('');
  const [priority, setPriority] = useState<Priority>(template.priority);

  const create = async () => {
    const r = await send({ type: 'create_work_order', templateId, siteId, zoneId: template.assetTypes ? undefined : zoneId || undefined, priority });
    if (r.ok && r.workOrderId) {
      selectWo(r.workOrderId);
      onDone();
    }
  };

  return (
    <div className="rise space-y-3 border-b border-line bg-bg-2/60 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium">New work order · {site.name}</div>
        <Button variant="ghost" size="sm" onClick={onDone} aria-label="Close composer">
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-1.5">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTemplateId(t.id);
              setPriority(t.priority);
            }}
            className={cx('rounded-lg border px-3 py-2 text-left transition', t.id === templateId ? 'border-accent/60 bg-accent/[0.06]' : 'border-line hover:border-line-strong')}
          >
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {t.title.replace(' — {zone}', '').replace('{zone}', '…').replace('{asset} — ', '').replace(' — {asset}', '')}
              <span className="ml-auto flex gap-0.5">
                {t.steps.map((s, i) => (
                  <KindGlyph key={i} kind={s.remote ? 'ai' : (s.preferKinds?.[0] ?? 'human')} size={10} />
                ))}
              </span>
            </div>
            <div className="text-[11.5px] text-muted">{t.summary}</div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!template.assetTypes ? (
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="h-8 rounded-lg border border-line-strong bg-raised px-2 text-[13px]" aria-label="Zone">
            <option value="">Auto-pick zone</option>
            {site.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[12px] text-muted">Targets the first {template.assetTypes.join('/')} asset without an open order</span>
        )}
        <Segmented size="sm" value={priority} onChange={setPriority} options={(['P1', 'P2', 'P3', 'P4'] as Priority[]).map((p) => ({ value: p, label: p }))} />
        <Button variant="primary" size="sm" className="ml-auto" onClick={create}>
          Create & dispatch
        </Button>
      </div>
    </div>
  );
}

export default function WorkOrders() {
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const selectedWoId = useStrata((s) => s.selectedWoId);
  const selectWo = useStrata((s) => s.selectWo);
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return snap.workOrders
      .filter((w) => w.siteId === siteId)
      .filter((w) => (filter === 'open' ? w.status === 'active' || w.status === 'blocked' : filter === 'all' ? true : filter === 'blocked' ? w.status === 'blocked' : w.status === 'done'))
      .filter((w) => !needle || w.title.toLowerCase().includes(needle) || w.code.toLowerCase().includes(needle));
  }, [snap.workOrders, siteId, filter, q]);

  const selected = selectedWoId ? snap.workOrders.find((w) => w.id === selectedWoId && w.siteId === siteId) : undefined;
  const firstId = list[0]?.id;
  useEffect(() => {
    // Open the most urgent job by default so the dispatch reasoning is one glance away.
    if (!selected && firstId && window.matchMedia('(min-width: 1024px)').matches) selectWo(firstId);
  }, [selected, firstId, selectWo]);
  const counts = {
    open: snap.workOrders.filter((w) => w.siteId === siteId && (w.status === 'active' || w.status === 'blocked')).length,
    blocked: snap.workOrders.filter((w) => w.siteId === siteId && w.status === 'blocked').length,
    done: snap.workOrders.filter((w) => w.siteId === siteId && w.status === 'done').length,
  };

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <Card flush className="max-h-[calc(100vh-110px)] min-h-[480px] overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="space-y-2.5 border-b border-line p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search work orders" className="h-8 w-full rounded-lg border border-line bg-bg-2 pr-2 pl-8 text-[13px] outline-none focus:border-line-strong" aria-label="Search work orders" />
              </div>
              <Button variant="primary" size="sm" onClick={() => setComposing((c) => !c)}>
                <Plus className="size-3.5" /> New
              </Button>
            </div>
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'open', label: `Open ${counts.open}` },
                { value: 'blocked', label: `Blocked ${counts.blocked}` },
                { value: 'done', label: `Done ${counts.done}` },
                { value: 'all', label: 'All' },
              ]}
            />
          </div>
          {composing && <Composer onDone={() => setComposing(false)} />}
          <div className="scroll-thin flex-1 divide-y divide-line overflow-y-auto">
            {list.map((wo) => (
              <WorkOrderRow key={wo.id} snap={snap} wo={wo} selected={wo.id === selectedWoId} onClick={() => selectWo(wo.id)} />
            ))}
            {!list.length && <Empty title="No work orders">Nothing matches this filter.</Empty>}
          </div>
        </div>
      </Card>
      <div className="card viewfinder max-h-[calc(100vh-110px)] min-h-[480px] overflow-hidden">
        {selected ? (
          <WorkOrderDetail snap={snap} wo={selected} onClose={() => selectWo(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex gap-1.5">
              {(['drone', 'ai', 'human'] as const).map((k, i) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="flex size-9 items-center justify-center rounded-full border border-line-strong">
                    <KindGlyph kind={k} size={14} />
                  </span>
                  {i < 2 && <span className="h-px w-6 bg-line-strong" />}
                </span>
              ))}
            </div>
            <div className="font-display text-xl font-semibold">Every job is a relay.</div>
            <p className="max-w-sm text-sm text-muted">Select a work order to see its plan, who holds the baton, and exactly why the dispatcher chose them — with one-click overrides.</p>
          </div>
        )}
      </div>
    </div>
  );
}
