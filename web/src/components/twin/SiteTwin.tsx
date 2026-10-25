/**
 * The Site Twin — a live, blueprint-style map of one site. Zones, hazards,
 * geofences, assets, open work orders and every physical agent with its trail,
 * heading and safety buffer. AI agents live in the cloud and are shown beside it.
 */
import type { Agent, Snapshot, Zone } from '@core/index';
import { useMemo, useState } from 'react';
import { KIND_META, STATUS_META } from '@/lib/format';
import { cx } from '@/components/ui';

interface Props {
  snap: Snapshot;
  siteId: string;
  selectedAgentId?: string | null;
  highlightWoId?: string | null;
  onSelectAgent?: (id: string | null) => void;
  onSelectWo?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

const ZONE_FILL: Record<Zone['kind'], string> = {
  work: 'var(--zone-work)',
  restricted: 'var(--zone-restricted)',
  staging: 'var(--zone-staging)',
  charging: 'var(--zone-charging)',
  office: 'var(--zone-office)',
  road: 'var(--zone-work)',
  dock: 'var(--zone-staging)',
};

const HAZARD_LABEL: Record<string, string> = {
  fall: 'FALL',
  electrical: 'ELEC',
  'heavy-equipment': 'HEAVY EQ',
  'patient-care': 'PATIENT',
};

function AgentMark({ a, selected, compact, hovered }: { a: Agent; selected: boolean; compact?: boolean; hovered?: boolean }) {
  const c = KIND_META[a.kind].color;
  const s = compact ? 1.5 : 1.25;
  const held = a.status === 'paused';
  const heading = a.target ? Math.atan2(a.target.y - a.pos.y, a.target.x - a.pos.x) : 0;
  return (
    <g style={{ transform: `translate(${a.pos.x}px, ${a.pos.y}px)`, transition: 'transform 520ms linear' }}>
      {a.heavy && (a.status === 'enroute' || a.status === 'working' || held) && (
        <circle r={3.5} fill={held ? 'var(--danger)' : c} fillOpacity={held ? 0.12 : 0.05} stroke={held ? 'var(--danger)' : c} strokeOpacity={0.5} strokeWidth={0.15} strokeDasharray="0.6 0.5" />
      )}
      {selected && <circle r={3} fill="none" stroke="var(--text)" strokeWidth={0.22} className="pulse-ring" />}
      {(a.status === 'working' || held) && <circle r={1.6 * s} fill={held ? 'var(--danger)' : c} opacity={0.35} className="pulse-ring" />}
      {a.target && (a.status === 'enroute') && (
        <path d={`M0,0 L${(Math.cos(heading) * 2.4).toFixed(2)},${(Math.sin(heading) * 2.4).toFixed(2)}`} stroke={c} strokeWidth={0.3} strokeLinecap="round" />
      )}
      {a.kind === 'human' && <circle r={0.95 * s} fill={c} stroke="var(--bg)" strokeWidth={0.3} />}
      {a.kind === 'robot' && <rect x={-0.95 * s} y={-0.95 * s} width={1.9 * s} height={1.9 * s} rx={0.45} fill={c} stroke="var(--bg)" strokeWidth={0.3} />}
      {a.kind === 'drone' && <path d={`M0,${-1.2 * s} L${1.2 * s},0 L0,${1.2 * s} L${-1.2 * s},0Z`} fill={c} stroke="var(--bg)" strokeWidth={0.3} />}
      {a.kind === 'vehicle' && (
        <g transform={`rotate(${(heading * 180) / Math.PI})`}>
          <path d={`M${-1.3 * s},${-0.85 * s} H${0.6 * s} L${1.4 * s},0 L${0.6 * s},${0.85 * s} H${-1.3 * s}Z`} fill={c} stroke="var(--bg)" strokeWidth={0.3} />
        </g>
      )}
      {a.status === 'charging' && <path d="M0.15,-0.7 L-0.35,0.1 H0.1 L-0.15,0.75 L0.4,-0.1 H-0.05Z" fill="var(--bg)" />}
      {!compact && (a.kind === 'human' || selected || hovered) && (
        <text x={1.9} y={0.6} fontSize={1.45} className="mono" fill="var(--text)" opacity={selected ? 1 : 0.62} style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 0.5 }}>
          {a.name.split(' ')[0]}
        </text>
      )}
    </g>
  );
}

export function SiteTwin({ snap, siteId, selectedAgentId, highlightWoId, onSelectAgent, onSelectWo, compact, className }: Props) {
  const site = snap.sites.find((s) => s.id === siteId) ?? snap.sites[0];
  const [hover, setHover] = useState<string | null>(null);
  const agents = useMemo(() => snap.agents.filter((a) => a.siteId === site.id && a.status !== 'offline'), [snap.agents, site.id]);
  const orders = snap.workOrders.filter((w) => w.siteId === site.id && (w.status === 'active' || w.status === 'blocked'));
  const assets = snap.assets.filter((a) => a.siteId === site.id);
  const hovered = agents.find((a) => a.id === hover);
  const W = site.size.w;
  const H = site.size.h;

  return (
    <div className={cx('relative select-none', className)}>
      <svg viewBox={`-3 -3 ${W + 6} ${H + 6}`} className="block h-full w-full" role="img" aria-label={`Live map of ${site.name}`} onClick={() => onSelectAgent?.(null)}>
        <defs>
          <pattern id={`minor-${site.id}`} width={2} height={2} patternUnits="userSpaceOnUse">
            <path d="M2 0H0V2" fill="none" stroke="var(--grid)" strokeWidth={0.08} />
          </pattern>
          <pattern id={`major-${site.id}`} width={10} height={10} patternUnits="userSpaceOnUse">
            <rect width={10} height={10} fill={`url(#minor-${site.id})`} />
            <path d="M10 0H0V10" fill="none" stroke="var(--line)" strokeWidth={0.12} />
          </pattern>
          <pattern id="hatch-restricted" width={1.6} height={1.6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line y2={1.6} stroke="var(--danger)" strokeOpacity={0.22} strokeWidth={0.35} />
          </pattern>
          <pattern id="hatch-paused" width={2.2} height={2.2} patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
            <rect width={1.1} height={2.2} fill="var(--danger)" fillOpacity={0.28} />
          </pattern>
        </defs>

        <rect x={0} y={0} width={W} height={H} fill={`url(#major-${site.id})`} />
        <rect x={0} y={0} width={W} height={H} fill="none" stroke="var(--line-strong)" strokeWidth={0.18} />

        {/* Ruler ticks */}
        {!compact &&
          Array.from({ length: W / 10 + 1 }, (_, i) => (
            <text key={`rx${i}`} x={i * 10} y={-0.9} fontSize={1.2} textAnchor="middle" className="mono" fill="var(--faint)">
              {i * 10}
            </text>
          ))}
        {!compact &&
          Array.from({ length: Math.floor(H / 10) + 1 }, (_, i) => (
            <text key={`ry${i}`} x={-0.9} y={i * 10 + 0.4} fontSize={1.2} textAnchor="end" className="mono" fill="var(--faint)">
              {i * 10}
            </text>
          ))}

        {/* Zones */}
        {site.zones.map((z) => (
          <g key={z.id}>
            <rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h} rx={0.8} fill={ZONE_FILL[z.kind]} stroke={z.robotsPaused ? 'var(--danger)' : 'var(--line-strong)'} strokeWidth={z.robotsPaused ? 0.3 : 0.14} strokeDasharray={z.kind === 'restricted' ? '0.8 0.5' : undefined} />
            {z.kind === 'restricted' && <rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h} rx={0.8} fill="url(#hatch-restricted)" />}
            {z.robotsPaused && <rect x={z.rect.x} y={z.rect.y} width={z.rect.w} height={z.rect.h} rx={0.8} fill="url(#hatch-paused)" />}
            <text x={z.rect.x + 1} y={z.rect.y + 2.2} fontSize={compact ? 1.7 : 1.55} className="mono" fill="var(--muted)" style={{ textTransform: 'uppercase', letterSpacing: 0.12 }}>
              {compact && z.name.length * 1.1 > z.rect.w - 2 ? `${z.name.slice(0, Math.max(3, Math.floor((z.rect.w - 2) / 1.1) - 1))}…` : z.name}
            </text>
            {z.hazard && !compact && (
              <g transform={`translate(${z.rect.x + z.rect.w - 0.8}, ${z.rect.y + z.rect.h - 2.8})`}>
                <rect x={-HAZARD_LABEL[z.hazard].length * 0.95 - 1} y={0} width={HAZARD_LABEL[z.hazard].length * 0.95 + 1} height={2} rx={0.4} fill="var(--warn)" fillOpacity={0.16} />
                <text x={-0.5} y={1.45} fontSize={1.2} textAnchor="end" className="mono" fill="var(--warn)">
                  {HAZARD_LABEL[z.hazard]}
                </text>
              </g>
            )}
            {z.humanOnly && !compact && (
              <text x={z.rect.x + 1} y={z.rect.y + z.rect.h - 1.2} fontSize={1.15} className="mono" fill="var(--k-human)">
                HUMAN-ONLY
              </text>
            )}
            {z.robotsPaused && (
              <text x={z.rect.x + z.rect.w / 2} y={z.rect.y + z.rect.h / 2} fontSize={compact ? 2.4 : 1.9} textAnchor="middle" className="mono blink" fill="var(--danger)" fontWeight={600}>
                MACHINES HOLD
              </text>
            )}
          </g>
        ))}

        {/* Assets */}
        {assets.map((a) => {
          const color = a.health < 40 ? 'var(--danger)' : a.health < 65 ? 'var(--warn)' : 'var(--ok)';
          return (
            <g key={a.id} transform={`translate(${a.pos.x}, ${a.pos.y})`}>
              <title>{`${a.name} · health ${Math.round(a.health)}`}</title>
              <rect x={-1.1} y={-1.1} width={2.2} height={2.2} fill="var(--bg)" stroke={color} strokeWidth={0.25} transform="rotate(45)" />
              <circle r={0.45} fill={color} />
            </g>
          );
        })}

        {/* Paths to targets */}
        {agents.map((a) =>
          a.target ? (
            <line key={`t-${a.id}`} x1={a.pos.x} y1={a.pos.y} x2={a.target.x} y2={a.target.y} stroke={KIND_META[a.kind].color} strokeOpacity={0.45} strokeWidth={0.16} strokeDasharray="0.5 0.6" />
          ) : null,
        )}
        {/* Trails */}
        {agents.map((a) =>
          a.trail.length > 1 ? (
            <polyline key={`tr-${a.id}`} points={[...a.trail, a.pos].map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={KIND_META[a.kind].color} strokeOpacity={0.22} strokeWidth={0.35} strokeLinecap="round" strokeLinejoin="round" />
          ) : null,
        )}

        {/* Work order pins */}
        {orders.map((o) => {
          const hot = o.priority === 'P1' || o.status === 'blocked';
          const color = o.status === 'blocked' ? 'var(--danger)' : o.priority === 'P1' ? 'var(--danger)' : o.priority === 'P2' ? 'var(--accent)' : 'var(--text)';
          const hl = highlightWoId === o.id;
          return (
            <g
              key={o.id}
              transform={`translate(${o.location.x}, ${o.location.y})`}
              onClick={(e) => {
                e.stopPropagation();
                onSelectWo?.(o.id);
              }}
              className={onSelectWo ? 'cursor-pointer' : undefined}
            >
              <title>{`${o.code} · ${o.title}`}</title>
              {(hot || hl) && <circle r={1.4} fill={color} opacity={0.5} className="pulse-ring" />}
              <circle r={hl ? 1.6 : 1.1} fill="none" stroke={color} strokeWidth={0.22} />
              <path d="M-2,0H-0.5M0.5,0H2M0,-2V-0.5M0,0.5V2" stroke={color} strokeWidth={0.18} />
              {!compact && (
                <text x={1.6} y={-1.2} fontSize={1.15} className="mono" fill={color} opacity={0.85}>
                  {o.code}
                </text>
              )}
            </g>
          );
        })}

        {/* Agents */}
        {agents.map((a) => (
          <g
            key={a.id}
            onMouseEnter={() => setHover(a.id)}
            onMouseLeave={() => setHover((h) => (h === a.id ? null : h))}
            onClick={(e) => {
              e.stopPropagation();
              onSelectAgent?.(a.id);
            }}
            className={onSelectAgent ? 'cursor-pointer' : undefined}
          >
            <AgentMark a={a} selected={selectedAgentId === a.id} compact={compact} hovered={hover === a.id} />
          </g>
        ))}
      </svg>

      {hovered && !compact && (
        <div
          className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 rounded-lg border border-line-strong bg-raised/95 p-2.5 text-xs shadow-xl backdrop-blur"
          style={{ left: `${((hovered.pos.x + 3) / (W + 6)) * 100}%`, top: `calc(${((hovered.pos.y + 3) / (H + 6)) * 100}% + 14px)` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{hovered.name}</span>
            <span className="mono text-[10px]" style={{ color: STATUS_META[hovered.status].color }}>
              {STATUS_META[hovered.status].label.toUpperCase()}
            </span>
          </div>
          <div className="text-muted">{hovered.role}</div>
          <div className="mono mt-1.5 flex justify-between text-[10.5px] text-muted">
            <span>
              {hovered.kind === 'human' ? 'energy' : 'batt'} {Math.round(hovered.battery)}%
            </span>
            <span>
              x{Math.round(hovered.pos.x)} y{Math.round(hovered.pos.y)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
