import { Command, Menu, Moon, Pause, Play, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { CommandPalette } from '@/components/CommandPalette';
import { AgentDetail, WorkOrderDetail } from '@/components/ops';
import { Button, Kbd, Logo, Segmented, cx } from '@/components/ui';
import { t } from '@/lib/format';
import { useStrata } from '@/lib/store';
import { NAV } from './nav';

function ModePill() {
  const mode = useStrata((s) => s.mode);
  const engine = useStrata((s) => s.copilotEngine);
  const label = mode === 'live' ? 'Live · server' : mode === 'edge' ? 'Edge · on-device' : 'Connecting';
  return (
    <div className="rounded-lg border border-line bg-bg-2 p-2.5 text-[11.5px]">
      <div className="flex items-center gap-2">
        <span className={cx('size-1.5 rounded-full', mode === 'live' ? 'bg-ok' : mode === 'edge' ? 'bg-warn' : 'blink bg-muted')} />
        <span className="font-medium">{label}</span>
      </div>
      <div className="mt-1 text-muted">
        {mode === 'edge' ? 'Running the engine locally — works offline on site.' : 'Streaming the authoritative world.'} Copilot: {engine === 'claude' ? 'Claude' : 'local intent engine'}.
      </div>
    </div>
  );
}

function SiteSwitcher({ onPick }: { onPick?: () => void }) {
  const snap = useStrata((s) => s.snap);
  const siteId = useStrata((s) => s.siteId);
  const setSite = useStrata((s) => s.setSite);
  if (!snap) return null;
  return (
    <div className="space-y-1">
      <div className="mono px-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-faint">Sites</div>
      {snap.sites.map((s) => {
        const open = snap.workOrders.filter((w) => w.siteId === s.id && (w.status === 'active' || w.status === 'blocked')).length;
        const alert = snap.incidents.some((i) => i.siteId === s.id && !i.resolved);
        return (
          <button
            key={s.id}
            onClick={() => {
              setSite(s.id);
              onPick?.();
            }}
            className={cx('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors', siteId === s.id ? 'bg-text/[0.07]' : 'hover:bg-text/[0.04]')}
          >
            <span className={cx('mono flex size-6 items-center justify-center rounded-md text-[10px] font-semibold uppercase', siteId === s.id ? 'bg-accent text-accent-ink' : 'bg-text/[0.07] text-muted')}>{s.id}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{s.name}</span>
              <span className="block text-[11px] text-muted capitalize">
                {s.vertical} · {open} open
              </span>
            </span>
            {alert && <span className="size-1.5 rounded-full bg-danger" />}
          </button>
        );
      })}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 p-3">
      <NavLink to="/" className="px-2 pt-1" onClick={onNavigate}>
        <Logo />
      </NavLink>
      <SiteSwitcher onPick={onNavigate} />
      <nav className="space-y-0.5" aria-label="Main">
        <div className="mono px-2 pb-1 text-[10px] uppercase tracking-[0.16em] text-faint">Operate</div>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/app'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx('group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] transition-colors', isActive ? 'bg-text/[0.07] text-text' : 'text-muted hover:bg-text/[0.04] hover:text-text')
            }
          >
            {({ isActive }) => (
              <>
                <n.icon className={cx('size-4', isActive && 'text-accent')} />
                <span className="flex-1">{n.label}</span>
                <span className="mono hidden text-[10px] text-faint group-hover:inline">g {n.key}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto">
        <ModePill />
      </div>
    </div>
  );
}

const SPEEDS = [
  { value: '0.25', label: '1×' },
  { value: '1', label: '4×' },
  { value: '4', label: '16×' },
];

function Topbar({ onMenu }: { onMenu: () => void }) {
  const snap = useStrata((s) => s.snap);
  const siteId = useStrata((s) => s.siteId);
  const send = useStrata((s) => s.send);
  const setPalette = useStrata((s) => s.setPalette);
  const theme = useStrata((s) => s.theme);
  const toggleTheme = useStrata((s) => s.toggleTheme);
  const loc = useLocation();
  const page = [...NAV].reverse().find((n) => loc.pathname.startsWith(n.to));
  const site = snap?.sites.find((s) => s.id === siteId);
  const stopped = site?.zones.every((z) => z.robotsPaused);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      {stopped && <div className="hazard-tape-danger h-1" />}
      <div className="flex h-14 items-center gap-3 px-4">
        <span className="lg:hidden">
          <Button variant="ghost" size="sm" onClick={onMenu} aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
        </span>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{page?.label ?? 'Strata'}</div>
          <div className="truncate text-[11.5px] text-muted">{site ? `${site.name} · ${site.city}` : 'Connecting…'}</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {snap && (
            <div className="hidden items-center gap-2 rounded-lg border border-line bg-bg-2 py-1 pr-1 pl-2.5 md:flex">
              <span className="mono text-[15px] font-medium tnum" aria-label="Simulated site time">
                {t(snap.clock)}
              </span>
              <button className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-text/10 hover:text-text" onClick={() => send({ type: 'set_running', running: !snap.running }, { quiet: true })} aria-label={snap.running ? 'Pause simulation' : 'Resume simulation'}>
                {snap.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
              <Segmented size="sm" value={String(snap.minutesPerTick)} options={SPEEDS} onChange={(v) => send({ type: 'set_speed', minutesPerTick: Number(v) }, { quiet: true })} />
            </div>
          )}
          <span className="hidden sm:block">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setPalette(true)}>
              <Command className="size-3.5" />
              <span className="text-muted">Ask or jump</span>
              <Kbd>⌘K</Kbd>
            </Button>
          </span>
          <span className="sm:hidden">
            <Button variant="ghost" size="sm" onClick={() => setPalette(true)} aria-label="Ask Copilot or jump">
              <Command className="size-4" />
            </Button>
          </span>
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {site && (
            <button
              onClick={() => send({ type: stopped ? 'release_site' : 'estop_site', siteId: site.id })}
              className={cx(
                'relative h-9 shrink-0 overflow-hidden rounded-lg px-3 text-[12px] whitespace-nowrap font-bold tracking-wider text-white transition active:translate-y-px',
                stopped ? 'bg-ok/90' : 'bg-danger hover:brightness-110',
              )}
              aria-label={stopped ? 'Release machine E-stop' : 'Emergency stop all machines at this site'}
            >
              <span className="relative z-[1]">{stopped ? 'RELEASE' : 'E-STOP'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Toasts() {
  const toasts = useStrata((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2" aria-live="polite">
      {toasts.map((tt) => (
        <div key={tt.id} className={cx('rise pointer-events-auto max-w-sm rounded-lg border px-3.5 py-2.5 text-[13px] shadow-xl backdrop-blur', tt.tone === 'err' ? 'border-danger/40 bg-danger/15' : 'border-line-strong bg-raised/95')}>
          <span className={cx('mr-2', tt.tone === 'ok' ? 'text-ok' : tt.tone === 'err' ? 'text-danger' : 'text-muted')}>{tt.tone === 'ok' ? '✓' : tt.tone === 'err' ? '!' : '•'}</span>
          {tt.text}
        </div>
      ))}
    </div>
  );
}

/** Slide-over for agent / work-order detail on pages that don't show it inline. */
function DetailDrawer() {
  const snap = useStrata((s) => s.snap);
  const loc = useLocation();
  const agentId = useStrata((s) => s.selectedAgentId);
  const woId = useStrata((s) => s.selectedWoId);
  const selectAgent = useStrata((s) => s.selectAgent);
  const selectWo = useStrata((s) => s.selectWo);
  if (!snap) return null;
  const inlineWo = loc.pathname.startsWith('/app/work');
  const inlineAgent = loc.pathname.startsWith('/app/twin') || loc.pathname.startsWith('/app/agents');
  const wo = !inlineWo && woId ? snap.workOrders.find((w) => w.id === woId) : undefined;
  const agent = !wo && !inlineAgent && agentId ? snap.agents.find((a) => a.id === agentId) : undefined;
  if (!wo && !agent) return null;
  const close = () => (wo ? selectWo(null) : selectAgent(null));
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={close}>
      <aside className="rise h-full w-full max-w-md border-l border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {wo ? <WorkOrderDetail snap={snap} wo={wo} onClose={close} /> : agent ? <AgentDetail snap={snap} agent={agent} onClose={close} /> : null}
      </aside>
    </div>
  );
}

function useGoKeys() {
  const navigate = useNavigate();
  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (armed) {
        const hit = NAV.find((n) => n.key === e.key);
        armed = false;
        if (hit) navigate(hit.to);
        return;
      }
      if (e.key === 'g') {
        armed = true;
        clearTimeout(timer);
        timer = setTimeout(() => (armed = false), 900);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

export function AppShell() {
  const [menu, setMenu] = useState(false);
  const snap = useStrata((s) => s.snap);
  useGoKeys();
  return (
    <div className="flex min-h-full bg-bg">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-bg-2/60 lg:block">
        <Sidebar />
      </aside>
      {menu && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMenu(false)}>
          <aside className="rise h-full w-72 border-r border-line bg-surface" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="sm" onClick={() => setMenu(false)} aria-label="Close menu">
                <X className="size-4" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMenu(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMenu(true)} />
        <main className="min-w-0 flex-1 p-4 md:p-5">
          {snap ? (
            <Outlet />
          ) : (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="mono blink text-[12px] uppercase tracking-[0.2em] text-muted">Linking to site mesh…</div>
            </div>
          )}
        </main>
      </div>
      <CommandPalette />
      <DetailDrawer />
      <Toasts />
    </div>
  );
}
