import type { Rect, Vec } from './types';

/** mulberry32 — tiny, fast, serialisable PRNG. State lives on the world. */
export function nextRandom(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pick<T>(state: { rng: number }, items: readonly T[]): T {
  return items[Math.floor(nextRandom(state) * items.length)];
}

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;

export const center = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const inRect = (p: Vec, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** Random point inside a rect, kept away from the edges. */
export function pointIn(state: { rng: number }, r: Rect, pad = 2): Vec {
  return {
    x: round(r.x + pad + nextRandom(state) * Math.max(0, r.w - pad * 2)),
    y: round(r.y + pad + nextRandom(state) * Math.max(0, r.h - pad * 2)),
  };
}

/** Format simulated minutes since 06:00 as a wall-clock time. */
export function clockLabel(minutes: number): string {
  const total = Math.floor(minutes) + 6 * 60;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
