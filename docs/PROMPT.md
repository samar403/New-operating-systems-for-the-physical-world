# The Strata brief

This is the product prompt Strata was built from. It turns the Y Combinator
Request for Startups theme — **"New operating systems for the physical world:
software that coordinates workers, robots and AI in construction, maintenance
and fleets"** — into a concrete product spec. Use it to brief a designer,
an engineer, an investor, or an AI coding agent.

---

## The prompt

> Build **Strata**, an operating system for physical work.
>
> **Who it's for.** Superintendents on construction sites, facility and plant
> managers, and fleet/yard operators. They already run mixed crews: people,
> plus a growing set of robots (quadrupeds, layout printers, material haulers,
> UV-C robots, supply tugs), drones, autonomous vehicles, and AI models that can
> read imagery and telemetry. Today each machine has its own app, AI insights
> never become dispatched jobs, and coordination happens over radio,
> whiteboards and spreadsheets.
>
> **The core idea.** Treat every worker — human, robot, drone, vehicle or AI
> agent — as one roster with one capability model. Turn every job into a
> **relay**: an ordered set of steps (capture → analyse → repair → verify), each
> requiring capabilities and, where relevant, certifications. A **dispatcher**
> hands each step to the best agent and passes the baton automatically when a
> step completes.
>
> **Non-negotiables.**
> 1. *Safe by construction.* Hard constraints are never traded off: capability,
>    certification (e.g. NFPA-70E in electrical zones, fall protection at
>    height), geofences (human-only, patient-care), battery sufficiency, and
>    human-proximity interlocks on heavy machines. Any crew member can report a
>    hazard and stop machines in that zone in one tap. Operators have a
>    site-wide E-stop.
> 2. *Explainable.* Every assignment shows a ranked list of candidates, the
>    weighted factors behind each score (proximity, cost, energy, kind
>    preference, safety exposure, fair workload), and the blockers that ruled
>    others out. Operators can override with one click.
> 3. *Edge-first.* The same engine runs on the server and on the device, so the
>    console and field app keep working when the site loses connectivity.
> 4. *Plain-language control.* A Copilot turns "send a drone to inspect the east
>    wing facade asap" or "pause robots in the crane zone" into validated
>    commands — the same commands the UI issues, with the same audit trail.
>    Use an LLM with tool use when an API key is present; fall back to a
>    deterministic local intent engine otherwise.
> 5. *Predictive.* Assets stream health telemetry; when health crosses a
>    threshold, an AI agent raises the work order itself.
>
> **Surfaces.**
> - **Landing page** that explains the idea with a *live* product running in the
>   hero, not a screenshot.
> - **Command Center:** KPIs (closed, on-time, utilisation, machine+AI share,
>   savings vs. human-only, safety), live site twin, open work, workforce mix,
>   event stream, shift brief, portfolio of sites.
> - **Site Twin:** blueprint-style live map — zones, hazards, geofences, assets,
>   work-order pins, agents with trails, headings and safety buffers; cloud
>   agents shown beside it; tap a zone to hold or release machines.
> - **Work Orders:** relay plans, step outputs, the dispatch decision with
>   factor bars and overrides, a composer from templates.
> - **Workforce:** one roster across five kinds of worker.
> - **Shift Tape:** swimlane timeline of who did what, when — including travel
>   and projected finish.
> - **Assets:** predictive maintenance with health rings, trend sparklines and
>   telemetry.
> - **Safety:** interlocks, hazard reports, geofence holds, incident log.
> - **Copilot:** chat that operates the site, with action receipts.
> - **Field App:** the crew's phone view — one job, big buttons, hand-off
>   visibility, and a hazard button wired to the machines.
>
> **Design.** Not another SaaS dashboard. A field-instrument aesthetic:
> graphite "night shift" theme and a warm paper "day shift" theme; hi-vis safety
> orange as the only action colour; a chartreuse signal for live machine state;
> one colour + glyph per worker kind used everywhere (circle = human,
> square = robot, diamond = drone, arrow = vehicle, asterisk = AI); survey-grid
> backdrops, viewfinder card corners, hazard-tape accents; monospace telemetry
> with tabular numbers. ⌘K command bar for everything. Responsive to phone
> width, keyboard navigable, reduced-motion aware.
>
> **Demo world.** Three sites — a construction tower, a hospital plant-ops
> department and a logistics depot — with 37 agents, a dozen assets, and
> realistic multi-step templates for each vertical. Deterministic and seeded
> so tests are reproducible.

---

## The pitch in one paragraph

Every construction site, hospital campus and logistics yard is becoming a
mixed fleet of people, machines and software. Robots arrive as islands, AI has
no hands, and safety is bolted on. Strata is the coordination layer between
them: one live plan that dispatches every step of every job to whoever can do it
fastest, cheapest and safest — human, robot, drone, vehicle or AI — under hard
safety constraints, with every decision explained. We start where the pain is
sharpest (sites already running drones, scanners and autonomous haulers), price
per site rather than per seat, and grow into the system of record for physical
work.

## Why this wins

| Wedge | Expansion | Moat |
| --- | --- | --- |
| Drone + AI inspection relays on sites that already own drones | Every robot, vehicle and crew on the site; then every site in the portfolio | Cross-vendor capability graph, safety-certified dispatch, and the historical record of who did what, where, and how well |
