/**
 * ⌘K — one bar for everything. Type to jump anywhere, or just say what you
 * need ("pause robots in the crane zone") and Copilot does it.
 */
import { COPILOT_EXAMPLES } from '@core/index';
import { ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useStrata } from '@/lib/store';
import { KindGlyph, Kbd, cx } from './ui';
import { NAV } from '@/layouts/nav';

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  run: () => void;
}

export function CommandPalette() {
  const open = useStrata((s) => s.paletteOpen);
  const setOpen = useStrata((s) => s.setPalette);
  const snap = useStrata((s) => s.snap);
  const ask = useStrata((s) => s.ask);
  const selectAgent = useStrata((s) => s.selectAgent);
  const setSite = useStrata((s) => s.setSite);
  const selectWo = useStrata((s) => s.selectWo);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useStrata.getState().paletteOpen);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQ('');
      setAnswer(null);
      setIdx(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const close = () => setOpen(false);
    const nav: Item[] = NAV.map((n) => ({ id: `nav-${n.to}`, label: `Go to ${n.label}`, hint: n.hint, icon: <n.icon className="size-4 text-muted" />, run: () => (navigate(n.to), close()) }));
    const agents: Item[] = (snap?.agents ?? []).map((a) => ({
      id: `agent-${a.id}`,
      label: a.name,
      hint: a.role,
      icon: <KindGlyph kind={a.kind} />,
      run: () => {
        if (a.siteId !== '*') setSite(a.siteId);
        selectAgent(a.id);
        navigate('/app/twin');
        close();
      },
    }));
    const orders: Item[] = (snap?.workOrders ?? [])
      .filter((w) => w.status === 'active' || w.status === 'blocked')
      .map((w) => ({
        id: `wo-${w.id}`,
        label: `${w.code} · ${w.title}`,
        hint: w.status,
        icon: <span className="mono text-[10px] text-accent">WO</span>,
        run: () => {
          setSite(w.siteId);
          selectWo(w.id);
          navigate('/app/work');
          close();
        },
      }));
    const all = [...nav, ...agents, ...orders];
    const needle = q.trim().toLowerCase();
    if (!needle) return nav;
    return all.filter((i) => i.label.toLowerCase().includes(needle) || i.hint?.toLowerCase().includes(needle)).slice(0, 8);
  }, [q, snap, navigate, setOpen, selectAgent, setSite, selectWo]);

  const runCopilot = async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    const r = await ask(text);
    setBusy(false);
    setAnswer(r.reply);
  };

  if (!open) return null;
  const total = items.length + 1;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Command bar" className="card viewfinder w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Sparkles className="size-4 text-accent" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
              setAnswer(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => (i + 1) % total);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => (i - 1 + total) % total);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (idx === 0) void runCopilot(q);
                else items[idx - 1]?.run();
              }
            }}
            placeholder="Ask Copilot or jump to anything…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            aria-label="Command"
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
          <li>
            <button
              onMouseEnter={() => setIdx(0)}
              onClick={() => void runCopilot(q)}
              className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm', idx === 0 && 'bg-text/[0.06]')}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-accent/15">
                <Sparkles className="size-3.5 text-accent" />
              </span>
              <span className="flex-1 truncate">{q ? <>Ask Copilot: <span className="text-text">“{q}”</span></> : <span className="text-muted">Type an instruction for Copilot…</span>}</span>
              {busy ? <span className="mono blink text-[11px] text-muted">working</span> : <CornerDownLeft className="size-3.5 text-faint" />}
            </button>
          </li>
          {answer && <li className="rise mx-2 my-1 whitespace-pre-line rounded-lg border border-line bg-bg-2 p-3 text-[13px] leading-relaxed">{answer}</li>}
          {!q && !answer && (
            <li className="px-3 pt-2 pb-1">
              <div className="mono mb-1.5 text-[10px] uppercase tracking-[0.14em] text-faint">Try</div>
              <div className="flex flex-wrap gap-1.5">
                {COPILOT_EXAMPLES.slice(0, 5).map((ex) => (
                  <button key={ex} onClick={() => (setQ(ex), void runCopilot(ex))} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted hover:border-accent/50 hover:text-text">
                    {ex}
                  </button>
                ))}
              </div>
            </li>
          )}
          {items.map((it, i) => (
            <li key={it.id}>
              <button onMouseEnter={() => setIdx(i + 1)} onClick={it.run} className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm', idx === i + 1 && 'bg-text/[0.06]')}>
                <span className="flex size-6 items-center justify-center">{it.icon}</span>
                <span className="flex-1 truncate">{it.label}</span>
                {it.hint && <span className="truncate text-[12px] text-faint">{it.hint}</span>}
                <ArrowRight className="size-3.5 text-faint" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
