# Architecture

```
┌──────────────────────────── web (React 19 + Vite + Tailwind v4) ───────────────────────────┐
│  Landing · Command · Twin · Work · Workforce · Shift Tape · Assets · Safety · Copilot ·   │
│  Field App · Settings · ⌘K                                                                 │
│                                                                                            │
│  lib/store.ts (zustand) ──► transport: LIVE  (SSE /api/stream + POST /api/command)         │
│                         └─► transport: EDGE  (core engine running in the browser)          │
└────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                             │ same Command / Snapshot types
┌────────────────────────── server (Hono on Node) ─────────────────────────┐
│  GET  /api/health   GET /api/state   GET /api/stream (SSE, 2 Hz)          │
│  POST /api/command  POST /api/copilot  (LLM tool use → local fallback)    │
│  serves dist/ in production                                               │
└────────────────────────────────────────────┬─────────────────────────────┘
                                             │
┌────────────────────────────── core (pure TypeScript) ────────────────────┐
│  types.ts      domain model: Site, Zone, Agent, Asset, WorkOrder, Step…   │
│  seed.ts       3 demo sites, 37 agents, 12 assets                         │
│  templates.ts  17 multi-step job templates across 3 verticals             │
│  dispatch.ts   hard constraints + policy-weighted scoring + explanations  │
│  engine.ts     tick loop: movement, battery, progress, handoffs,          │
│                sensors → work orders, proximity interlocks, commands      │
│  insights.ts   KPIs, utilisation, shift brief                             │
│  copilot.ts    deterministic natural-language intent engine               │
└──────────────────────────────────────────────────────────────────────────┘
```

## Core ideas

**One capability model.** Every agent — human, robot, drone, vehicle, AI — has
capabilities (`inspect.thermal`, `haul`, `analyze.vision`, `signoff`, …),
certifications, a cost per hour, a speed and an energy level. That is what lets
the dispatcher reason across kinds of worker.

**Work orders are relays.** A template expands into ordered steps. Each step
lists the capabilities it needs, a preferred agent kind, a duration and whether
it is *remote* (software agents and humans can do remote steps without
travelling). When a step completes, its output is recorded and the next step
becomes `awaiting`; the dispatcher picks it up on the next tick — a handoff.

**Dispatch = constraints, then scoring.**

1. *Hard constraints* (`blockersFor`): capability, site, physical presence,
   offline/busy/held, human-only and patient-care geofences, paused zones,
   NFPA-70E for electrical hazards, fall protection at height, and battery
   sufficiency (travel + work + reserve) for machines.
2. *Soft factors* (`scoreCandidate`), weighted by the active policy
   (`balanced`, `fastest`, `cheapest`, `safest`): proximity/ETA, cost, energy,
   kind preference, safety exposure, fair workload.

Every assignment stores the top candidates with their factors and blockers, so
the UI can show exactly why someone was chosen.

**Safety loop.** Each tick, any heavy machine en route within 3.5 m of a person
(not on the same job) is held for six ticks, logged as an interlock, and then
creeps past at 40% speed so it can't deadlock. Hazard reports and geofence holds
pause machines in a zone; an E-stop pauses every zone on a site. Resolving the
incident releases them.

**Predictive maintenance.** Assets drift in health with noise; telemetry is
derived from health. Below the service threshold an asset raises a sensor work
order from the matching template (AI diagnosis → inspection → repair → AI
verification). Completing it restores health and slows future drift.

**Determinism.** The PRNG state lives on the world (mulberry32), so the same
seed and the same commands always produce the same world. Tests rely on it.

## Edge-first transport

`web/src/lib/store.ts` probes `/api/health`. If the server answers it subscribes
to the SSE stream (**Live**). If not — or if the stream dies mid-shift, or the
page is opened with `?mode=edge`, or the build sets `VITE_STRATA_MODE=edge` —
it boots `createWorld()` in the browser and ticks it locally (**Edge**).
Commands and Copilot run against whichever world is active.

## Copilot

`POST /api/copilot` uses an LLM when `ANTHROPIC_API_KEY` is set
(`server/ai-copilot.ts`): the system prompt carries a cached catalog of sites, zones,
templates and assets; tools mirror the engine's commands plus a
`get_live_state` reader. Every tool call goes through `applyCommand`, so the model
can never bypass the engine's validation. On any failure — or with no key — the
deterministic `runLocalCopilot` (`core/copilot.ts`) answers instead.

## Extending

- **New vertical or job type:** add a template in `core/templates.ts`.
- **New robot:** add an agent spec in `core/seed.ts` with its capabilities.
  In production this becomes an adapter (ROS 2 / VDA 5050 / MAVLink) that
  streams position and battery and accepts step assignments.
- **New constraint:** add it to `blockersFor` — it becomes visible in the UI's
  dispatch explanation automatically.
