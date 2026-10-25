import { kpis } from '@core/index';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Cpu, Eye, HardHat, Layers, Moon, Radio, Route, ShieldCheck, Sun, Truck, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { SiteTwin } from '@/components/twin/SiteTwin';
import { Button, KindGlyph, Logo, cx } from '@/components/ui';
import { KIND_META, KINDS, LEVEL_COLOR, money, t } from '@/lib/format';
import { useStrata } from '@/lib/store';

function Nav() {
  const theme = useStrata((s) => s.theme);
  const toggleTheme = useStrata((s) => s.toggleTheme);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="Strata home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-[13.5px] text-muted md:flex" aria-label="Primary">
          <a href="#how" className="hover:text-text">How it works</a>
          <a href="#verticals" className="hover:text-text">Verticals</a>
          <a href="#safety" className="hover:text-text">Safety</a>
          <a href="#pricing" className="hover:text-text">Pricing</a>
          <a href="#faq" className="hover:text-text">FAQ</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Link to="/app">
            <Button variant="primary" size="sm">
              Open console <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function LiveHero() {
  const snap = useStrata((s) => s.snap);
  const mode = useStrata((s) => s.mode);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % 3), 9000);
    return () => clearInterval(id);
  }, []);
  if (!snap) return <div className="card aspect-[106/70] w-full animate-pulse" />;
  const site = snap.sites[i];
  const events = snap.events.filter((e) => e.siteId === site.id).slice(0, 2);
  return (
    <div className="relative">
      <div className="card viewfinder overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="size-2 rounded-full bg-danger/70" />
          <span className="size-2 rounded-full bg-warn/70" />
          <span className="size-2 rounded-full bg-ok/70" />
          <div className="ml-2 flex gap-1">
            {snap.sites.map((s, idx) => (
              <button key={s.id} onClick={() => setI(idx)} className={cx('mono rounded px-2 py-0.5 text-[10.5px] uppercase tracking-wider transition', idx === i ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text')}>
                {s.vertical}
              </button>
            ))}
          </div>
          <span className="mono ml-auto flex items-center gap-1.5 text-[10.5px] text-muted">
            <span className="blink size-1.5 rounded-full bg-danger" /> LIVE {t(snap.clock)}
          </span>
        </div>
        <div className="bg-bg-2/50 p-2">
          <SiteTwin key={site.id} snap={snap} siteId={site.id} className="aspect-[106/70] w-full" />
        </div>
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-muted">
          <span>
            {site.name} · {site.city}
          </span>
          <span className="mono">{mode === 'live' ? 'streamed from server' : 'running on this device'}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-16 left-4 hidden w-80 space-y-1.5 sm:block lg:-left-12">
        {events.map((e) => (
          <div key={e.id} className="rise rounded-lg border border-line-strong bg-raised/95 px-3 py-2 text-[11.5px] leading-snug shadow-xl backdrop-blur">
            <span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: LEVEL_COLOR[e.level] }} />
            {e.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveNumbers() {
  const snap = useStrata((s) => s.snap);
  if (!snap) return null;
  const k = kpis(snap);
  const items = [
    ['Jobs closed this shift', k.completed.toString()],
    ['Done by machines + AI', `${k.autonomyShare}%`],
    ['Close calls prevented', k.interlocks.toString()],
    ['Saved vs. human-only', money(k.savings)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {items.map(([label, v]) => (
        <div key={label}>
          <dt className="mono text-[10.5px] uppercase tracking-[0.12em] text-muted">{label}</dt>
          <dd className="font-display mt-1 text-2xl font-semibold tnum">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const MARQUEE = ['Superintendents', 'Quadruped scanners', 'Inspection drones', 'Yard tractors', 'Vision models', 'Electricians', 'UV-C robots', 'Telehandlers', 'Route planners', 'HVAC techs', 'Autonomous vans', 'Compliance agents', 'Layout printers', 'Supply tugs'];

function Section({ id, eyebrow, title, children, className }: { id?: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cx('mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 md:py-28', className)}>
      <div className="mono mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-accent">
        <span className="h-px w-6 bg-accent" />
        {eyebrow}
      </div>
      <h2 className="font-display max-w-3xl text-[34px] leading-[1.05] font-semibold tracking-tight md:text-[48px]">{title}</h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

const STEPS = [
  { icon: Eye, title: 'Sense', body: 'Robots, drones, vehicles, sensors and people stream position, battery, telemetry and progress into one live model of every site.' },
  { icon: Layers, title: 'Plan', body: 'Every job becomes a relay of steps — capture, analyse, repair, verify — each tagged with the capabilities and certifications it needs.' },
  { icon: Route, title: 'Dispatch', body: 'The dispatcher hands each step to the best human, machine or AI agent under hard safety constraints — and shows its reasoning.' },
  { icon: Check, title: 'Verify', body: 'Outputs flow to the next agent automatically. AI checks the work, people sign off, and the audit trail writes itself.' },
];

const VERTICALS = [
  {
    icon: HardHat,
    name: 'Construction',
    site: 'Harbor Point Tower',
    jobs: ['Drone facade inspection → AI defect detection → superintendent sign-off', 'Quadruped reality capture vs. BIM → engineer review', 'Robotic layout printing → crew QA', 'Autonomous material haul to the workface'],
    kinds: ['human', 'robot', 'drone', 'vehicle', 'ai'] as const,
  },
  {
    icon: Wrench,
    name: 'Maintenance',
    site: 'Mercy General — Plant Ops',
    jobs: ['Telemetry anomaly → AI diagnosis → crawler thermal scan → technician repair → AI verification', 'UV-C terminal clean → EVS verification', 'Generator load-bank test → Joint Commission record'],
    kinds: ['human', 'robot', 'drone', 'ai'] as const,
  },
  {
    icon: Truck,
    name: 'Fleets',
    site: 'Bayview Logistics Depot',
    jobs: ['AI route optimisation → autonomous van or driver', 'Autonomous yard tractor trailer moves', 'Telematics-raised PM → mechanic service → yard lead release', 'Drone yard audit reconciled against the YMS'],
    kinds: ['human', 'robot', 'drone', 'vehicle', 'ai'] as const,
  },
];

const FAQ = [
  ['Is Strata a robot company?', 'No. Strata is hardware-agnostic coordination software. It treats a quadruped, a drone, an autonomous van, a vision model and an electrician as different kinds of worker with different capabilities — and plans across all of them.'],
  ['What happens when the connection drops on site?', 'Strata is edge-first. The same engine runs in the browser or on a site gateway, so dispatch, safety interlocks and the field app keep working offline and reconcile when the link returns. This demo falls back to Edge mode automatically.'],
  ['How does it decide who does what?', 'Hard constraints first — capability, certification, geofences, battery and safety interlocks are never traded away. Then a transparent, policy-weighted score (proximity, cost, energy, preference, safety exposure, fair workload). Every assignment shows its full ranking and supports one-click overrides.'],
  ['Where does AI fit in?', 'Two places. Software agents are first-class workers that do analysis, diagnosis, routing and compliance steps. And Copilot lets operators run the site in plain language, acting through the same validated commands as the UI.'],
  ['What does it integrate with?', 'The roadmap covers project management (Procore, Autodesk Build), BIM/IFC, robot protocols (ROS 2, VDA 5050, MAVLink), telematics (Samsara, Geotab), building systems (BACnet, Modbus) and CMMS (Maximo, UpKeep).'],
];

export default function Landing() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="min-h-full bg-bg">
      <Nav />

      {/* Hero */}
      <section className="bg-grid relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_30%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-24 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:pt-24">
          <div>
            <a href="#why" className="mono inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised/60 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted hover:text-text">
              <span className="blink size-1.5 rounded-full bg-accent" /> New operating systems for the physical world
            </a>
            <h1 className="font-display mt-6 text-[46px] leading-[0.98] font-bold tracking-[-0.03em] sm:text-[60px] xl:text-[68px]">
              One live plan for <span className="relative whitespace-nowrap text-accent">crews, robots</span> and AI.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
              Strata is the operating system for construction sites, facilities and fleets. It hands every job to whoever can do it fastest, cheapest and safest — a person, a robot, a drone, a vehicle or an AI agent — and passes the baton between them automatically.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app">
                <Button variant="primary" size="lg">
                  Open the live console <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/app/work">
                <Button variant="outline" size="lg">
                  See how dispatch decides
                </Button>
              </Link>
            </div>
            <div className="mt-12 border-t border-line pt-6">
              <LiveNumbers />
            </div>
          </div>
          <LiveHero />
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-b border-line bg-bg-2 py-4" aria-hidden>
        <div className="marquee flex w-max gap-10 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="font-display flex items-center gap-10 text-[22px] font-medium text-muted">
              {m}
              <KindGlyph kind={KINDS[i % 5]} size={12} />
            </span>
          ))}
        </div>
      </div>

      {/* Problem */}
      <Section id="why" eyebrow="The problem" title={<>The physical world still runs on radios, whiteboards and spreadsheets.</>}>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Radio, h: 'Robots arrive as islands', p: 'Every drone, quadruped and autonomous vehicle ships with its own app. Nobody plans across them, so expensive machines sit idle while crews wait.' },
            { icon: Cpu, h: 'AI has no hands', p: 'Models can spot a crack or predict a failing bearing — but nothing turns that insight into a dispatched, verified job on the ground.' },
            { icon: ShieldCheck, h: 'Safety is bolted on', p: 'Mixed human–machine sites need interlocks, geofences and certification checks in the plan itself, not in a binder.' },
          ].map((c) => (
            <div key={c.h} className="card viewfinder p-6">
              <c.icon className="size-5 text-accent" />
              <h3 className="mt-4 text-lg font-semibold">{c.h}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{c.p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <div className="border-y border-line bg-bg-2/60">
        <Section id="how" eyebrow="How it works" title="Sense. Plan. Dispatch. Verify.">
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="bg-surface p-6">
                <div className="mono text-[11px] text-faint">0{i + 1}</div>
                <s.icon className="mt-4 size-5 text-accent" />
                <h3 className="font-display mt-3 text-2xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="card viewfinder mt-6 p-6">
            <div className="mono mb-5 text-[11px] uppercase tracking-[0.14em] text-muted">One job, many hands — a facade inspection relay</div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              {[
                { k: 'drone' as const, a: 'Drone D-7', s: 'Aerial capture', m: '16 min' },
                { k: 'ai' as const, a: 'Vision Analyst', s: 'Defect detection', m: '5 min' },
                { k: 'human' as const, a: 'Maria Okafor', s: 'Superintendent sign-off', m: '8 min' },
                { k: 'ai' as const, a: 'Compliance Scribe', s: 'Report filed', m: 'instant' },
              ].map((r, i, arr) => (
                <div key={r.s} className="flex flex-1 items-center gap-4">
                  <div className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-bg-2 p-3">
                    <span className="flex size-10 items-center justify-center rounded-full border border-line-strong">
                      <KindGlyph kind={r.k} size={16} />
                    </span>
                    <div>
                      <div className="text-[13.5px] font-medium">{r.s}</div>
                      <div className="text-[12px] text-muted">
                        {r.a} · {r.m}
                      </div>
                    </div>
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="hidden size-4 shrink-0 text-faint md:block" />}
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Verticals */}
      <Section id="verticals" eyebrow="Built for three worlds" title="Construction, maintenance and fleets — one kernel.">
        <div className="grid gap-4 lg:grid-cols-3">
          {VERTICALS.map((v) => (
            <div key={v.name} className="card viewfinder flex flex-col p-6">
              <div className="flex items-center justify-between">
                <v.icon className="size-5 text-accent" />
                <div className="flex gap-1.5">
                  {v.kinds.map((k) => (
                    <KindGlyph key={k} kind={k} size={12} />
                  ))}
                </div>
              </div>
              <h3 className="font-display mt-4 text-2xl font-semibold">{v.name}</h3>
              <div className="text-[12.5px] text-muted">Demo site: {v.site}</div>
              <ul className="mt-5 space-y-2.5 text-[14px]">
                {v.jobs.map((j) => (
                  <li key={j} className="flex gap-2 text-text/85">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                    {j}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted">
          {KINDS.map((k) => (
            <span key={k} className="inline-flex items-center gap-2">
              <KindGlyph kind={k} size={12} /> {KIND_META[k].plural}
            </span>
          ))}
          <span>— one capability model, one roster.</span>
        </div>
      </Section>

      {/* Safety */}
      <div className="relative border-y border-line bg-bg-2/60">
        <div className="hazard-tape absolute inset-x-0 top-0 h-1.5 opacity-80" />
        <Section id="safety" eyebrow="Safe by construction" title="Safety isn't a dashboard. It's a constraint the planner can't break.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ['Proximity interlocks', 'Heavy machines hold automatically when a person enters their 3.5 m buffer, then creep past at reduced speed.'],
              ['Certified dispatch', 'Electrical and fall-hazard zones require NFPA-70E or fall-protection certification before a person is ever assigned.'],
              ['Hard geofences', 'Human-only and patient-care areas exclude drones and heavy machines at the dispatcher, not just on the map.'],
              ['Hazard → halt in one tap', 'Any crew member can report a hazard from the field app; machines in that zone stop and an incident opens instantly.'],
            ].map(([h, p]) => (
              <div key={h} className="card viewfinder p-5">
                <ShieldCheck className="size-5 text-ok" />
                <h3 className="mt-3 font-semibold">{h}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{p}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Why now */}
      <Section eyebrow="Why now" title="Every site is becoming a mixed fleet. It needs an operating system.">
        <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
          {[
            ['Machines got cheap and capable', 'Quadrupeds, inspection drones, layout printers and autonomous yard tractors are moving from pilots to everyday tools.'],
            ['AI can perceive and plan', 'Vision and language models can read imagery, telemetry and documents well enough to take real steps in a workflow — if something coordinates them.'],
            ['Skilled labour is scarce', 'Construction, facilities and fleet operators struggle to hire. The leverage is in giving every skilled person a crew of machines and software.'],
            ['No one owns the layer between', 'Robot vendors sell robots; CMMS and PM tools track tickets. The coordination layer that actually assigns, sequences and verifies work is open.'],
          ].map(([h, p], i) => (
            <div key={h} className="flex gap-4 border-t border-line pt-5">
              <span className="mono text-[12px] text-accent">0{i + 1}</span>
              <div>
                <h3 className="text-lg font-semibold">{h}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{p}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing */}
      <div className="border-y border-line bg-bg-2/60">
        <Section id="pricing" eyebrow="Pricing" title="Priced per site, not per seat.">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { name: 'Pilot', price: '$0', unit: '30 days · 1 site', feats: ['Up to 25 agents', 'Edge mode + field app', 'Local Copilot', 'Guided onboarding'], cta: 'Start a pilot' },
              { name: 'Site', price: '$1,500', unit: 'per site / month + $40 per machine', feats: ['Unlimited crew', 'Claude-powered Copilot', 'Predictive maintenance', 'Safety layer & audit log', 'API & webhooks'], cta: 'Talk to us', featured: true },
              { name: 'Network', price: 'Custom', unit: 'portfolios & enterprises', feats: ['Cross-site dispatch', 'SSO / SCIM', 'On-prem edge gateways', 'Custom robot adapters', 'Dedicated success team'], cta: 'Contact sales' },
            ].map((p) => (
              <div key={p.name} className={cx('card viewfinder flex flex-col p-6', p.featured && 'ring-1 ring-accent/60')}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.featured && <span className="mono rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">MOST POPULAR</span>}
                </div>
                <div className="font-display mt-4 text-4xl font-semibold">{p.price}</div>
                <div className="text-[13px] text-muted">{p.unit}</div>
                <ul className="mt-6 flex-1 space-y-2 text-[14px]">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="size-3.5 text-ok" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/app" className="mt-6">
                  <Button variant={p.featured ? 'primary' : 'outline'} className="w-full">
                    {p.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* FAQ */}
      <Section id="faq" eyebrow="FAQ" title="Questions operators ask first.">
        <div className="max-w-3xl divide-y divide-line border-y border-line">
          {FAQ.map(([q, a], i) => (
            <div key={q}>
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={open === i}>
                <span className="text-[16px] font-medium">{q}</span>
                <ChevronDown className={cx('size-4 shrink-0 text-muted transition-transform', open === i && 'rotate-180')} />
              </button>
              {open === i && <p className="rise pb-5 text-[15px] leading-relaxed text-muted">{a}</p>}
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="hazard-tape absolute inset-x-0 top-0 h-2" />
        <div className="bg-grid">
          <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-24 sm:px-6 md:flex-row md:items-end md:justify-between">
            <h2 className="font-display max-w-2xl text-[40px] leading-[1.02] font-bold tracking-tight md:text-[56px]">Put every worker on the same plan.</h2>
            <Link to="/app">
              <Button variant="primary" size="lg">
                Open the live console <ArrowUpRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-[13px] text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Logo withWord={false} />
            <span>Strata — an operating system for the physical world. Open-source demo.</span>
          </div>
          <div className="flex gap-5">
            <Link to="/app" className="hover:text-text">Console</Link>
            <Link to="/app/field" className="hover:text-text">Field app</Link>
            <a href="https://github.com/samar403/New-operating-systems-for-the-physical-world" className="hover:text-text">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
