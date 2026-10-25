/**
 * Strata API server. Hosts the authoritative world, ticks it, streams
 * snapshots over Server-Sent Events and accepts commands. In production it
 * also serves the built web app.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { existsSync, readFileSync } from 'node:fs';
import { applyCommand, createWorld, runLocalCopilot, snapshot, step, type Command, type Snapshot } from '../core/index';
import { aiEnabled, runAiCopilot } from './ai-copilot';

const PORT = Number(process.env.PORT ?? 8787);
const TICK_MS = 500;

export const world = createWorld(Number(process.env.STRATA_SEED ?? 7), { warmupMinutes: 90 });
const listeners = new Set<(s: Snapshot) => void>();

let latest = snapshot(world);
setInterval(() => {
  if (world.running) step(world);
  latest = snapshot(world);
  for (const fn of listeners) fn(latest);
}, TICK_MS);

const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, name: 'strata', tick: world.tick, copilot: aiEnabled() ? 'ai' : 'local' }));

app.get('/api/state', (c) => c.json(latest));

app.get('/api/stream', (c) =>
  streamSSE(c, async (stream) => {
    let open = true;
    const send = (s: Snapshot) => {
      if (open) void stream.writeSSE({ event: 'snapshot', data: JSON.stringify(s) });
    };
    listeners.add(send);
    send(latest);
    stream.onAbort(() => {
      open = false;
      listeners.delete(send);
    });
    while (open) await stream.sleep(15000);
  }),
);

app.post('/api/command', async (c) => {
  const cmd = (await c.req.json().catch(() => null)) as Command | null;
  if (!cmd || typeof cmd.type !== 'string') return c.json({ ok: false, message: 'Invalid command' }, 400);
  try {
    const result = applyCommand(world, cmd);
    latest = snapshot(world);
    return c.json(result, result.ok ? 200 : 422);
  } catch (err) {
    return c.json({ ok: false, message: err instanceof Error ? err.message : 'Command failed' }, 400);
  }
});

app.post('/api/copilot', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: string; siteId?: string };
  const text = (body.text ?? '').slice(0, 1000);
  if (aiEnabled()) {
    try {
      const reply = await runAiCopilot(world, text, { siteId: body.siteId });
      latest = snapshot(world);
      return c.json(reply);
    } catch (err) {
      console.warn('[copilot] AI model unavailable, using local engine:', err instanceof Error ? err.message : err);
    }
  }
  const reply = runLocalCopilot(world, text, { siteId: body.siteId });
  latest = snapshot(world);
  return c.json(reply);
});

if (process.env.NODE_ENV === 'production' && existsSync('./dist/index.html')) {
  const index = readFileSync('./dist/index.html', 'utf8');
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', (c) => c.html(index));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`▲ Strata API on http://localhost:${info.port}  ·  copilot: ${aiEnabled() ? 'AI model' : 'local intent engine'}`);
});
