import type { AgentKind, AgentStatus, EventLevel, Priority, StepStatus, WorkOrderStatus } from '@core/index';
import { clockLabel } from '@core/index';

export const KIND_META: Record<AgentKind, { label: string; plural: string; color: string; text: string; bg: string }> = {
  human: { label: 'Human', plural: 'Crew', color: 'var(--k-human)', text: 'text-human', bg: 'bg-human' },
  robot: { label: 'Robot', plural: 'Robots', color: 'var(--k-robot)', text: 'text-robot', bg: 'bg-robot' },
  drone: { label: 'Drone', plural: 'Drones', color: 'var(--k-drone)', text: 'text-drone', bg: 'bg-drone' },
  vehicle: { label: 'Vehicle', plural: 'Vehicles', color: 'var(--k-vehicle)', text: 'text-vehicle', bg: 'bg-vehicle' },
  ai: { label: 'AI agent', plural: 'AI agents', color: 'var(--k-ai)', text: 'text-ai', bg: 'bg-ai' },
};

export const KINDS: AgentKind[] = ['human', 'robot', 'drone', 'vehicle', 'ai'];

export const STATUS_META: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: 'Idle', color: 'var(--muted)' },
  enroute: { label: 'En route', color: 'var(--k-drone)' },
  working: { label: 'Working', color: 'var(--signal)' },
  charging: { label: 'Charging', color: 'var(--warn)' },
  paused: { label: 'Held', color: 'var(--danger)' },
  offline: { label: 'Offline', color: 'var(--faint)' },
};

export const PRIORITY_META: Record<Priority, { label: string; cls: string }> = {
  P1: { label: 'P1', cls: 'bg-danger/15 text-danger ring-danger/30' },
  P2: { label: 'P2', cls: 'bg-accent/15 text-accent ring-accent/30' },
  P3: { label: 'P3', cls: 'bg-text/5 text-text ring-line-strong' },
  P4: { label: 'P4', cls: 'bg-text/5 text-muted ring-line' },
};

export const WO_STATUS: Record<WorkOrderStatus, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'var(--muted)' },
  active: { label: 'Active', color: 'var(--signal)' },
  blocked: { label: 'Blocked', color: 'var(--danger)' },
  done: { label: 'Done', color: 'var(--ok)' },
  cancelled: { label: 'Cancelled', color: 'var(--faint)' },
};

export const STEP_STATUS: Record<StepStatus, string> = {
  pending: 'Pending',
  awaiting: 'Awaiting agent',
  enroute: 'En route',
  in_progress: 'In progress',
  done: 'Done',
  skipped: 'Skipped',
};

export const LEVEL_COLOR: Record<EventLevel, string> = {
  info: 'var(--muted)',
  success: 'var(--ok)',
  warn: 'var(--warn)',
  critical: 'var(--danger)',
};

export const t = clockLabel;

export function ago(now: number, then: number) {
  const d = Math.max(0, Math.round(now - then));
  if (d < 1) return 'now';
  if (d < 60) return `${d}m ago`;
  return `${Math.floor(d / 60)}h ${d % 60}m ago`;
}

export const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
