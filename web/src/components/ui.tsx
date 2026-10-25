import { clsx } from 'clsx';
import type { AgentKind, AgentStatus, Priority } from '@core/index';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { KIND_META, PRIORITY_META, STATUS_META } from '@/lib/format';

export const cx = clsx;

type Variant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle';

export function Button({ variant = 'outline', size = 'md', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background,color,border,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-40 select-none whitespace-nowrap',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-9 px-3.5 text-sm',
        size === 'lg' && 'h-12 px-5 text-[15px]',
        variant === 'primary' && 'bg-accent text-accent-ink hover:brightness-110 shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_8px_24px_-12px_var(--accent)]',
        variant === 'outline' && 'border border-line-strong bg-raised/40 hover:bg-raised text-text',
        variant === 'ghost' && 'hover:bg-text/5 text-muted hover:text-text',
        variant === 'subtle' && 'bg-text/5 hover:bg-text/10 text-text',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
    />
  );
}

export function Card({ className, children, title, action, flush }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; flush?: boolean }) {
  return (
    <section className={cx('card viewfinder flex min-w-0 flex-col', className)}>
      {title !== undefined && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{title}</h2>
          {action}
        </header>
      )}
      <div className={cx('min-h-0 flex-1', !flush && 'p-4')}>{children}</div>
    </section>
  );
}

/** One glyph per agent kind, used on the map, in lists and in the relay. */
export function KindGlyph({ kind, size = 14, className }: { kind: AgentKind; size?: number; className?: string }) {
  const c = KIND_META[kind].color;
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" className={cx('shrink-0', className)} aria-label={KIND_META[kind].label} role="img">
      {kind === 'human' && <circle cx="8" cy="8" r="5.5" fill={c} />}
      {kind === 'robot' && <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" fill={c} />}
      {kind === 'drone' && <path d="M8 1.8 14.2 8 8 14.2 1.8 8z" fill={c} />}
      {kind === 'vehicle' && <path d="M2 4.5h8.5L14 8l-3.5 3.5H2z" fill={c} />}
      {kind === 'ai' && (
        <g fill="none" stroke={c} strokeWidth="1.8">
          <path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" />
        </g>
      )}
    </svg>
  );
}

export function KindTag({ kind }: { kind: AgentKind }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
      <KindGlyph kind={kind} size={10} />
      {KIND_META[kind].label}
    </span>
  );
}

export function StatusDot({ status, pulse }: { status: AgentStatus; pulse?: boolean }) {
  const color = STATUS_META[status].color;
  return (
    <span className="relative inline-flex size-2">
      {pulse && (status === 'working' || status === 'paused') && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: color }} />}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function PriorityPill({ p }: { p: Priority }) {
  return <span className={cx('mono inline-flex h-5 items-center rounded px-1.5 text-[10.5px] font-semibold ring-1 ring-inset', PRIORITY_META[p].cls)}>{p}</span>;
}

export function Meter({ value, color = 'var(--signal)', className, warnBelow }: { value: number; color?: string; className?: string; warnBelow?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const c = warnBelow !== undefined && v < warnBelow ? 'var(--danger)' : color;
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-text/8', className)} role="meter" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: c }} />
    </div>
  );
}

export function Sparkline({ data, color = 'var(--accent)', height = 36, fill = true, className }: { data: number[]; color?: string; height?: number; fill?: boolean; className?: string }) {
  if (data.length < 2) return <div style={{ height }} className={className} />;
  const w = 120;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, height - 3 - ((d - min) / span) * (height - 6)] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={cx('w-full overflow-visible', className)} style={{ height }} aria-hidden>
      {fill && <path d={`${line}L${w},${height}L0,${height}Z`} fill={color} opacity={0.12} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </svg>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', className }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-lg border border-line bg-bg-2 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-[12.5px]',
            value === o.value ? 'bg-raised text-text shadow-sm ring-1 ring-line-strong' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="mono inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-raised px-1 text-[10.5px] text-muted">{children}</kbd>;
}

export function Stat({ label, value, sub, accent, children }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string; children?: ReactNode }) {
  return (
    <div className="card viewfinder flex min-w-0 flex-col gap-1 px-4 py-3.5">
      <div className="mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="font-display text-[28px] leading-none font-semibold tracking-tight tnum" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
      {children}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <div className="mono text-[11px] uppercase tracking-[0.14em] text-faint">{title}</div>
      {children && <div className="max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Logo({ className, withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <path d="M5 22 16 27.5 27 22M5 16l11 5.5L27 16M16 4.5 5 10l11 5.5L27 10z" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      {withWord && <span className="font-display text-[17px] font-bold tracking-tight">strata</span>}
    </span>
  );
}
