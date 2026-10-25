import { COPILOT_EXAMPLES } from '@core/index';
import { ArrowUp, Check, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Card, cx } from '@/components/ui';
import { useStrata } from '@/lib/store';

export default function Copilot() {
  const chat = useStrata((s) => s.chat);
  const ask = useStrata((s) => s.ask);
  const engine = useStrata((s) => s.copilotEngine);
  const snap = useStrata((s) => s.snap)!;
  const siteId = useStrata((s) => s.siteId);
  const selectWo = useStrata((s) => s.selectWo);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const site = snap.sites.find((s) => s.id === siteId)!;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length, chat.at(-1)?.pending]);

  const submit = (v: string) => {
    if (!v.trim()) return;
    setText('');
    void ask(v.trim());
  };

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card flush className="h-[calc(100vh-110px)] min-h-[520px]">
        <div className="flex h-full flex-col">
          <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5">
            {chat.length === 0 && (
              <div className="mx-auto max-w-lg py-10 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent/15">
                  <Sparkles className="size-5 text-accent" />
                </div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">Operate the site in plain language.</h2>
                <p className="mt-2 text-sm text-muted">Copilot turns intent into validated commands — every action goes through the same safety constraints and audit log as a click in the UI.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {COPILOT_EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => submit(ex)} className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-muted transition hover:border-accent/50 hover:text-text">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chat.map((m) => (
              <div key={m.id} className={cx('rise flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'user' ? (
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14px] text-accent-ink">{m.text}</div>
                ) : (
                  <div className="max-w-[88%] space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted">
                      <Sparkles className="size-3 text-accent" /> Copilot {m.reply && <span className="mono rounded bg-text/5 px-1">{m.reply.engine === 'claude' ? 'claude' : 'local'}</span>}
                    </div>
                    <div className="rounded-2xl rounded-tl-md border border-line bg-raised px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line">
                      {m.pending ? <span className="mono blink text-[12px] text-muted">thinking through constraints…</span> : m.text}
                    </div>
                    {m.reply?.actions.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => a.result.workOrderId && selectWo(a.result.workOrderId)}
                        className={cx('flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px]', a.result.ok ? 'border-ok/30 bg-ok/[0.06]' : 'border-danger/30 bg-danger/[0.06]')}
                      >
                        {a.result.ok ? <Check className="size-3.5 text-ok" /> : <X className="size-3.5 text-danger" />}
                        <span className="mono text-[11px] text-muted">{a.command.type}</span>
                        <span className="truncate">{a.result.message}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form
            className="border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
          >
            <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-bg-2 p-2 focus-within:border-accent/60">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit(text);
                  }
                }}
                rows={1}
                placeholder={`Tell ${site.name} what you need…`}
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] outline-none placeholder:text-faint"
                aria-label="Message Copilot"
              />
              <button type="submit" disabled={!text.trim()} className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-ink transition disabled:opacity-30" aria-label="Send">
                <ArrowUp className="size-4" />
              </button>
            </div>
          </form>
        </div>
      </Card>
      <div className="space-y-4">
        <Card title="Engine">
          <div className="text-[13px]">
            <div className="flex items-center gap-2 font-medium">
              <span className={cx('size-2 rounded-full', engine === 'claude' ? 'bg-ai' : 'bg-warn')} />
              {engine === 'claude' ? 'Claude (server)' : 'Local intent engine'}
            </div>
            <p className="mt-1.5 text-muted">
              {engine === 'claude'
                ? 'Claude reads a compact view of the world and acts through typed tools that mirror the UI commands.'
                : 'Deterministic, offline-capable parser. Set ANTHROPIC_API_KEY on the server to upgrade Copilot to Claude with tool use.'}
            </p>
          </div>
        </Card>
        <Card title="Context">
          <div className="space-y-1.5 text-[13px] text-muted">
            <div>
              Site: <span className="text-text">{site.name}</span>
            </div>
            <div>
              Policy: <span className="text-text capitalize">{snap.policy}</span>
            </div>
            <div>Commands are scoped to the site you're viewing unless you name another.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
