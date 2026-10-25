import type { Agent, AgentKind, Asset, AssetType, Capability, Site, Zone } from './types';

type ZoneSpec = Omit<Zone, 'siteId'>;

function site(id: string, name: string, vertical: Site['vertical'], city: string, zones: ZoneSpec[]): Site {
  return { id, name, vertical, city, size: { w: 100, h: 64 }, zones: zones.map((z) => ({ ...z, siteId: id })) };
}

export const SITES: Site[] = [
  site('hp', 'Harbor Point Tower', 'construction', 'Oakland, CA', [
    { id: 'hp-office', name: 'Site Office', kind: 'office', hazard: null, rect: { x: 38, y: 2, w: 24, h: 12 } },
    { id: 'hp-west', name: 'West Wing L2', kind: 'work', hazard: null, rect: { x: 6, y: 8, w: 28, h: 30 } },
    { id: 'hp-core', name: 'Tower Core', kind: 'work', hazard: 'fall', rect: { x: 38, y: 18, w: 24, h: 24 } },
    { id: 'hp-east', name: 'East Wing L3', kind: 'work', hazard: 'fall', rect: { x: 66, y: 8, w: 28, h: 30 } },
    { id: 'hp-elec', name: 'Electrical Room', kind: 'restricted', hazard: 'electrical', humanOnly: true, rect: { x: 6, y: 44, w: 14, h: 16 } },
    { id: 'hp-dock', name: 'Robot Dock', kind: 'charging', hazard: null, rect: { x: 23, y: 44, w: 13, h: 16 } },
    { id: 'hp-crane', name: 'Crane Swing Zone', kind: 'restricted', hazard: 'heavy-equipment', rect: { x: 39, y: 46, w: 23, h: 14 } },
    { id: 'hp-laydown', name: 'Laydown Yard', kind: 'staging', hazard: null, rect: { x: 66, y: 44, w: 28, h: 16 } },
  ]),
  site('mg', 'Mercy General — Plant Ops', 'maintenance', 'Sacramento, CA', [
    { id: 'mg-mech', name: 'Mechanical Room B1', kind: 'work', hazard: null, rect: { x: 6, y: 6, w: 28, h: 24 } },
    { id: 'mg-roof', name: 'Rooftop HVAC Deck', kind: 'work', hazard: 'fall', rect: { x: 38, y: 6, w: 30, h: 22 } },
    { id: 'mg-gen', name: 'Generator Yard', kind: 'restricted', hazard: 'electrical', rect: { x: 72, y: 6, w: 22, h: 24 } },
    { id: 'mg-warda', name: 'Ward A', kind: 'work', hazard: 'patient-care', rect: { x: 6, y: 36, w: 26, h: 22 } },
    { id: 'mg-wardb', name: 'Ward B', kind: 'work', hazard: 'patient-care', rect: { x: 36, y: 36, w: 26, h: 22 } },
    { id: 'mg-dock', name: 'Loading Dock', kind: 'dock', hazard: null, rect: { x: 66, y: 34, w: 28, h: 13 } },
    { id: 'mg-charge', name: 'Robot Closet', kind: 'charging', hazard: null, rect: { x: 66, y: 50, w: 12, h: 10 } },
    { id: 'mg-office', name: 'Facilities Office', kind: 'office', hazard: null, rect: { x: 80, y: 50, w: 14, h: 10 } },
  ]),
  site('bv', 'Bayview Logistics Depot', 'fleet', 'Hayward, CA', [
    { id: 'bv-dock1', name: 'Dock 1', kind: 'dock', hazard: null, rect: { x: 6, y: 6, w: 18, h: 14 } },
    { id: 'bv-dock2', name: 'Dock 2', kind: 'dock', hazard: null, rect: { x: 26, y: 6, w: 18, h: 14 } },
    { id: 'bv-dock3', name: 'Dock 3', kind: 'dock', hazard: null, rect: { x: 46, y: 6, w: 18, h: 14 } },
    { id: 'bv-service', name: 'Service Bay', kind: 'work', hazard: 'heavy-equipment', rect: { x: 70, y: 6, w: 24, h: 22 } },
    { id: 'bv-yard', name: 'Trailer Yard', kind: 'staging', hazard: 'heavy-equipment', rect: { x: 6, y: 26, w: 58, h: 20 } },
    { id: 'bv-charge', name: 'EV Charge Row', kind: 'charging', hazard: null, rect: { x: 70, y: 32, w: 24, h: 12 } },
    { id: 'bv-gate', name: 'Gate & Scale', kind: 'road', hazard: null, rect: { x: 6, y: 50, w: 30, h: 10 } },
    { id: 'bv-road', name: 'Perimeter Road', kind: 'road', hazard: null, rect: { x: 38, y: 50, w: 28, h: 10 } },
    { id: 'bv-office', name: 'Dispatch Office', kind: 'office', hazard: null, rect: { x: 70, y: 48, w: 24, h: 12 } },
  ]),
];

const KIND_DEFAULTS: Record<AgentKind, { speed: number; cost: number }> = {
  human: { speed: 5, cost: 85 },
  robot: { speed: 3.5, cost: 22 },
  drone: { speed: 12, cost: 14 },
  vehicle: { speed: 9, cost: 38 },
  ai: { speed: 0, cost: 4 },
};

interface AgentSpec {
  id: string;
  name: string;
  kind: AgentKind;
  role: string;
  siteId: string;
  at: [number, number];
  caps: Capability[];
  certs?: string[];
  cost?: number;
  heavy?: boolean;
  battery?: number;
}

const AGENT_SPECS: AgentSpec[] = [
  // ── Harbor Point Tower (construction)
  { id: 'h-maria', name: 'Maria Okafor', kind: 'human', role: 'Superintendent', siteId: 'hp', at: [48, 8], caps: ['signoff', 'inspect.visual', 'report.compliance'], certs: ['OSHA-30', 'Fall-Protection'], cost: 110 },
  { id: 'h-dev', name: 'Dev Patel', kind: 'human', role: 'Electrician', siteId: 'hp', at: [12, 50], caps: ['electrical', 'inspect.thermal', 'inspect.visual'], certs: ['NFPA-70E', 'OSHA-10', 'Fall-Protection'], cost: 96 },
  { id: 'h-luis', name: 'Luis Ramírez', kind: 'human', role: 'Concrete Foreman', siteId: 'hp', at: [50, 30], caps: ['concrete', 'layout.mark', 'inspect.visual'], certs: ['OSHA-30', 'Fall-Protection'], cost: 92 },
  { id: 'h-aiko', name: 'Aiko Tanaka', kind: 'human', role: 'Drywall Lead', siteId: 'hp', at: [18, 22], caps: ['drywall', 'inspect.visual'], certs: ['OSHA-10', 'Fall-Protection'], cost: 78 },
  { id: 'h-kwame', name: 'Kwame Mensah', kind: 'human', role: 'Crane Operator', siteId: 'hp', at: [50, 52], caps: ['lift.heavy', 'haul'], certs: ['NCCCO', 'OSHA-10'], cost: 104 },
  { id: 'h-sofia', name: 'Sofia Lindqvist', kind: 'human', role: 'Field Engineer', siteId: 'hp', at: [56, 8], caps: ['survey.scan', 'layout.mark', 'signoff'], certs: ['OSHA-10', 'Fall-Protection'], cost: 88 },
  { id: 'r-q2', name: 'Quad Q-2', kind: 'robot', role: 'Quadruped scanner', siteId: 'hp', at: [27, 48], caps: ['survey.scan', 'inspect.visual', 'inspect.thermal'], cost: 26 },
  { id: 'r-lm1', name: 'LayoutBot L-1', kind: 'robot', role: 'Floor layout printer', siteId: 'hp', at: [31, 48], caps: ['layout.mark'], cost: 18 },
  { id: 'r-h3', name: 'Hauler H-3', kind: 'robot', role: 'Tracked material hauler', siteId: 'hp', at: [27, 55], caps: ['haul', 'deliver'], cost: 24, heavy: true },
  { id: 'r-h4', name: 'Hauler H-4', kind: 'robot', role: 'Tracked material hauler', siteId: 'hp', at: [31, 55], caps: ['haul', 'deliver'], cost: 24, heavy: true, battery: 41 },
  { id: 'r-dw1', name: 'Drywall Arm DW-1', kind: 'robot', role: 'Board-hanging manipulator', siteId: 'hp', at: [33, 51], caps: ['drywall'], cost: 30 },
  { id: 'd-7', name: 'Drone D-7', kind: 'drone', role: 'Inspection quadcopter', siteId: 'hp', at: [25, 46], caps: ['inspect.visual', 'inspect.thermal', 'survey.scan'], cost: 14 },
  { id: 'v-t1', name: 'Telehandler T-1', kind: 'vehicle', role: 'Autonomous telehandler', siteId: 'hp', at: [78, 52], caps: ['lift.heavy', 'haul'], cost: 46, heavy: true },

  // ── Mercy General (maintenance)
  { id: 'h-grace', name: 'Grace Ndlovu', kind: 'human', role: 'HVAC Technician', siteId: 'mg', at: [86, 54], caps: ['hvac', 'repair.mechanical', 'inspect.visual'], certs: ['EPA-608', 'Fall-Protection'], cost: 90 },
  { id: 'h-tomas', name: 'Tomás Silva', kind: 'human', role: 'Electrician', siteId: 'mg', at: [20, 18], caps: ['electrical', 'inspect.thermal', 'inspect.visual'], certs: ['NFPA-70E'], cost: 94 },
  { id: 'h-priya', name: 'Priya Raman', kind: 'human', role: 'Facilities Manager', siteId: 'mg', at: [88, 56], caps: ['signoff', 'report.compliance', 'inspect.visual'], certs: ['Joint-Commission', 'Fall-Protection'], cost: 112 },
  { id: 'h-ben', name: 'Ben Carter', kind: 'human', role: 'Mechanic', siteId: 'mg', at: [14, 12], caps: ['repair.mechanical', 'weld'], certs: ['AWS-D1.1', 'NFPA-70E'], cost: 84 },
  { id: 'h-lea', name: 'Léa Moreau', kind: 'human', role: 'EVS Lead', siteId: 'mg', at: [18, 46], caps: ['clean', 'inspect.visual'], certs: ['Infection-Control'], cost: 62 },
  { id: 'r-uv1', name: 'UV Sentinel U-1', kind: 'robot', role: 'UV-C disinfection', siteId: 'mg', at: [69, 53], caps: ['clean'], cost: 16 },
  { id: 'r-tug9', name: 'Tug T-9', kind: 'robot', role: 'Autonomous supply tug', siteId: 'mg', at: [73, 53], caps: ['deliver', 'haul'], cost: 15 },
  { id: 'r-c4', name: 'Crawler C-4', kind: 'robot', role: 'Duct & pipe inspection', siteId: 'mg', at: [71, 57], caps: ['inspect.thermal', 'inspect.visual'], cost: 20 },
  { id: 'd-2', name: 'Drone D-2', kind: 'drone', role: 'Roof inspection drone', siteId: 'mg', at: [75, 57], caps: ['inspect.visual', 'inspect.thermal'], cost: 14 },

  // ── Bayview Depot (fleet)
  { id: 'h-marcus', name: 'Marcus Bell', kind: 'human', role: 'Fleet Mechanic', siteId: 'bv', at: [80, 14], caps: ['repair.mechanical', 'electrical', 'inspect.visual'], certs: ['ASE-Master', 'NFPA-70E'], cost: 88 },
  { id: 'h-yuki', name: 'Yuki Sato', kind: 'human', role: 'Yard Lead', siteId: 'bv', at: [80, 54], caps: ['signoff', 'inspect.visual', 'deliver'], certs: ['CDL-A'], cost: 82 },
  { id: 'h-omar', name: 'Omar Haddad', kind: 'human', role: 'Driver', siteId: 'bv', at: [14, 54], caps: ['deliver', 'haul'], certs: ['CDL-A'], cost: 70 },
  { id: 'h-elena', name: 'Elena Petrova', kind: 'human', role: 'Driver', siteId: 'bv', at: [24, 54], caps: ['deliver', 'haul'], certs: ['CDL-A'], cost: 70 },
  { id: 'v-y1', name: 'Yard Tractor Y-1', kind: 'vehicle', role: 'Autonomous yard tractor', siteId: 'bv', at: [74, 36], caps: ['haul'], cost: 34, heavy: true },
  { id: 'v-y2', name: 'Yard Tractor Y-2', kind: 'vehicle', role: 'Autonomous yard tractor', siteId: 'bv', at: [80, 36], caps: ['haul'], cost: 34, heavy: true, battery: 36 },
  { id: 'v-e1', name: 'eVan E-1', kind: 'vehicle', role: 'Autonomous delivery van', siteId: 'bv', at: [86, 36], caps: ['deliver'], cost: 30 },
  { id: 'v-e2', name: 'eVan E-2', kind: 'vehicle', role: 'Autonomous delivery van', siteId: 'bv', at: [90, 40], caps: ['deliver'], cost: 30 },
  { id: 'r-f3', name: 'AutoFork F-3', kind: 'robot', role: 'Autonomous forklift', siteId: 'bv', at: [30, 14], caps: ['lift.heavy', 'haul'], cost: 28, heavy: true },
  { id: 'd-9', name: 'Drone D-9', kind: 'drone', role: 'Yard survey drone', siteId: 'bv', at: [76, 40], caps: ['inspect.visual', 'survey.scan'], cost: 14 },

  // ── Software agents: serve every site, no travel
  { id: 'ai-vision', name: 'Vision Analyst α', kind: 'ai', role: 'Defect & progress detection', siteId: '*', at: [0, 0], caps: ['analyze.vision'] },
  { id: 'ai-vision2', name: 'Vision Analyst β', kind: 'ai', role: 'Defect & progress detection', siteId: '*', at: [0, 0], caps: ['analyze.vision'] },
  { id: 'ai-telemetry', name: 'Telemetry Doctor', kind: 'ai', role: 'Predictive diagnostics', siteId: '*', at: [0, 0], caps: ['analyze.telemetry'] },
  { id: 'ai-planner', name: 'Route Planner', kind: 'ai', role: 'Routing & sequencing', siteId: '*', at: [0, 0], caps: ['plan.route'] },
  { id: 'ai-scribe', name: 'Compliance Scribe', kind: 'ai', role: 'Reports, permits, audit trail', siteId: '*', at: [0, 0], caps: ['report.compliance'] },
];

export function createAgents(): Agent[] {
  return AGENT_SPECS.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    role: s.role,
    siteId: s.siteId,
    pos: { x: s.at[0], y: s.at[1] },
    target: null,
    speed: KIND_DEFAULTS[s.kind].speed,
    capabilities: s.caps,
    certifications: s.certs ?? [],
    battery: s.battery ?? (s.kind === 'ai' ? 100 : 88 + ((s.id.length * 7) % 12)),
    status: 'idle',
    taskRef: null,
    costPerHour: s.cost ?? KIND_DEFAULTS[s.kind].cost,
    heavy: s.heavy,
    stats: { completed: 0, busyMinutes: 0, distance: 0 },
    trail: [],
  }));
}

interface AssetSpec {
  id: string;
  name: string;
  type: AssetType;
  siteId: string;
  at: [number, number];
  health: number;
  drift: number;
}

const ASSET_SPECS: AssetSpec[] = [
  { id: 'a-tc1', name: 'Tower Crane TC-1', type: 'Crane', siteId: 'hp', at: [50, 53], health: 91, drift: -1.2 },
  { id: 'a-hoist2', name: 'Material Hoist H-2', type: 'Hoist', siteId: 'hp', at: [60, 24], health: 72, drift: -4.5 },
  { id: 'a-gen1', name: 'Site Generator G-1', type: 'Generator', siteId: 'hp', at: [72, 56], health: 84, drift: -1.8 },
  { id: 'a-ahu3', name: 'Air Handler AHU-3', type: 'HVAC', siteId: 'mg', at: [52, 16], health: 66, drift: -5.5 },
  { id: 'a-ch1', name: 'Chiller CH-1', type: 'Chiller', siteId: 'mg', at: [24, 22], health: 88, drift: -1.4 },
  { id: 'a-eg2', name: 'Emergency Gen EG-2', type: 'Generator', siteId: 'mg', at: [82, 18], health: 79, drift: -2.2 },
  { id: 'a-mdp1', name: 'Main Panel MDP-1', type: 'Panel', siteId: 'mg', at: [10, 26], health: 93, drift: -0.8 },
  { id: 'a-el4', name: 'Patient Elevator E-4', type: 'Elevator', siteId: 'mg', at: [58, 40], health: 82, drift: -1.6 },
  { id: 'a-t112', name: 'Tractor #112', type: 'Truck', siteId: 'bv', at: [14, 34], health: 70, drift: -4.8 },
  { id: 'a-t118', name: 'Tractor #118', type: 'Truck', siteId: 'bv', at: [26, 38], health: 90, drift: -1.5 },
  { id: 'a-v204', name: 'Box Van #204', type: 'Van', siteId: 'bv', at: [46, 32], health: 85, drift: -2.0 },
  { id: 'a-fk7', name: 'Forklift FK-7', type: 'Forklift', siteId: 'bv', at: [36, 16], health: 77, drift: -2.6 },
];

export function createAssets(): Asset[] {
  return ASSET_SPECS.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    siteId: s.siteId,
    pos: { x: s.at[0], y: s.at[1] },
    health: s.health,
    drift: s.drift,
    telemetry: { temp: 40, vibration: 1.2, load: 55 },
    history: [s.health],
    openWorkOrderId: null,
    lastServiceAt: -600,
  }));
}

export const createSites = (): Site[] => structuredClone(SITES);
