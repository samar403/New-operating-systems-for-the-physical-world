import type { AgentKind, AssetType, Capability, Priority, Vertical, ZoneKind } from './types';

export interface StepSpec {
  label: string;
  requires: Capability[];
  durationMin: number;
  preferKinds?: AgentKind[];
  remote?: boolean;
  /** Possible outputs reported when the step completes. */
  outputs?: string[];
}

export interface Template {
  id: string;
  vertical: Vertical;
  /** `{zone}` and `{asset}` are interpolated. */
  title: string;
  summary: string;
  priority: Priority;
  /** Zones this job naturally happens in, used when the caller gives none. */
  zoneKinds: ZoneKind[];
  /** Specific zones this job belongs in (overrides zoneKinds when the caller gives none). */
  zoneIds?: string[];
  /** Templates bound to a physical asset (raised by sensors). */
  assetTypes?: AssetType[];
  dueMin: number;
  steps: StepSpec[];
}

export const TEMPLATES: Template[] = [
  // ── Construction
  {
    id: 'facade-inspection',
    vertical: 'construction',
    title: 'Facade inspection — {zone}',
    summary: 'Drone capture, AI defect detection, superintendent sign-off.',
    priority: 'P2',
    zoneKinds: ['work'],
    zoneIds: ['hp-east', 'hp-west', 'hp-core'],
    dueMin: 120,
    steps: [
      { label: 'Aerial image capture', requires: ['inspect.visual'], durationMin: 16, preferKinds: ['drone'], outputs: ['412 frames captured, 0.6 cm/px GSD', '388 frames captured, full facade coverage'] },
      { label: 'Defect detection', requires: ['analyze.vision'], durationMin: 5, remote: true, outputs: ['2 hairline cracks flagged (low severity)', 'No defects above threshold', '1 sealant gap at panel E-14 (medium)'] },
      { label: 'Superintendent sign-off', requires: ['signoff'], durationMin: 8, preferKinds: ['human'], outputs: ['Approved with 1 punch item', 'Approved'] },
    ],
  },
  {
    id: 'progress-scan',
    vertical: 'construction',
    title: 'Reality capture vs. BIM — {zone}',
    summary: 'Quadruped laser scan compared against the model; engineer reviews deviations.',
    priority: 'P3',
    zoneKinds: ['work'],
    dueMin: 180,
    steps: [
      { label: 'Laser scan walk', requires: ['survey.scan'], durationMin: 28, preferKinds: ['robot'], outputs: ['1.8B points, registered to control', '2.1B points, 3 mm registration error'] },
      { label: 'BIM deviation analysis', requires: ['analyze.vision'], durationMin: 7, remote: true, outputs: ['94% of elements within tolerance; 3 MEP clashes', 'Slab edge 18 mm out on grid C/4', 'Progress 61% vs 58% planned'] },
      { label: 'Field engineer review', requires: ['signoff'], durationMin: 10, preferKinds: ['human'], outputs: ['RFI-219 raised for grid C/4', 'Deviations accepted'] },
    ],
  },
  {
    id: 'layout',
    vertical: 'construction',
    title: 'Layout marking — {zone}',
    summary: 'Robotic floor layout from the model, then human QA.',
    priority: 'P3',
    zoneKinds: ['work'],
    dueMin: 200,
    steps: [
      { label: 'Print layout to slab', requires: ['layout.mark'], durationMin: 34, preferKinds: ['robot'], outputs: ['1,240 lf of wall layout printed', '86 sleeves and 412 lf of track printed'] },
      { label: 'Layout QA', requires: ['inspect.visual'], durationMin: 9, preferKinds: ['human'], outputs: ['QA passed', 'Two door openings shifted 50 mm per ASI-12'] },
    ],
  },
  {
    id: 'material-haul',
    vertical: 'construction',
    title: 'Material haul to {zone}',
    summary: 'Move staged material from the laydown yard to the workface.',
    priority: 'P3',
    zoneKinds: ['work'],
    dueMin: 90,
    steps: [{ label: 'Haul from laydown', requires: ['haul'], durationMin: 18, preferKinds: ['robot', 'vehicle'], outputs: ['2 pallets of studs delivered', '48 sheets gypsum delivered', 'Rebar bundle staged'] }],
  },
  {
    id: 'drywall',
    vertical: 'construction',
    title: 'Drywall hang — {zone}',
    summary: 'Board hanging with a robotic arm or crew, then QA.',
    priority: 'P3',
    zoneKinds: ['work'],
    dueMin: 240,
    steps: [
      { label: 'Hang board', requires: ['drywall'], durationMin: 42, outputs: ['36 boards hung', '28 boards hung, 2 cutouts for MEP'] },
      { label: 'QA walk', requires: ['inspect.visual'], durationMin: 8, preferKinds: ['human'], outputs: ['Ready for tape', 'Screw pattern rework on 2 boards'] },
    ],
  },
  {
    id: 'electrical-rough',
    vertical: 'construction',
    title: 'Electrical rough-in inspection — {zone}',
    summary: 'Thermal scan, AI review, licensed electrician correction, compliance packet.',
    priority: 'P2',
    zoneKinds: ['restricted', 'work'],
    zoneIds: ['hp-elec', 'hp-core', 'hp-east'],
    dueMin: 160,
    steps: [
      { label: 'Thermal scan of panels', requires: ['inspect.thermal'], durationMin: 14, preferKinds: ['robot', 'drone'], outputs: ['Hot spot 61°C on breaker 14', 'All terminations within 8°C of ambient'] },
      { label: 'Thermal image review', requires: ['analyze.vision'], durationMin: 4, remote: true, outputs: ['Loose lug suspected on breaker 14', 'No anomalies'] },
      { label: 'Correct & torque terminations', requires: ['electrical'], durationMin: 32, preferKinds: ['human'], outputs: ['Lugs re-torqued to spec', 'Breaker 14 replaced'] },
      { label: 'Compliance packet', requires: ['report.compliance'], durationMin: 5, remote: true, outputs: ['Inspection packet filed with AHJ', 'NFPA 70B record updated'] },
    ],
  },
  {
    id: 'pour-prep',
    vertical: 'construction',
    title: 'Slab pour prep — {zone}',
    summary: 'Scan embeds, pour, superintendent sign-off.',
    priority: 'P2',
    zoneKinds: ['work'],
    dueMin: 240,
    steps: [
      { label: 'Embed & rebar scan', requires: ['survey.scan'], durationMin: 14, preferKinds: ['robot', 'drone'], outputs: ['All embeds located', 'Cover short at 2 chairs — fixed'] },
      { label: 'Place & finish concrete', requires: ['concrete'], durationMin: 48, preferKinds: ['human'], outputs: ['42 yd³ placed', '38 yd³ placed, cylinders taken'] },
      { label: 'Pour sign-off', requires: ['signoff'], durationMin: 6, preferKinds: ['human'], outputs: ['Signed off'] },
    ],
  },

  // ── Maintenance
  {
    id: 'hvac-anomaly',
    vertical: 'maintenance',
    title: '{asset} — vibration anomaly',
    summary: 'Predictive diagnosis, thermal inspection, technician repair, AI verification.',
    priority: 'P2',
    zoneKinds: ['work'],
    assetTypes: ['HVAC', 'Chiller', 'Elevator'],
    dueMin: 150,
    steps: [
      { label: 'Telemetry diagnosis', requires: ['analyze.telemetry'], durationMin: 4, remote: true, outputs: ['Bearing wear signature on fan motor (87% conf.)', 'Belt slip pattern detected', 'Imbalance at 1× RPM'] },
      { label: 'Thermal & visual inspection', requires: ['inspect.thermal'], durationMin: 12, preferKinds: ['robot', 'drone'], outputs: ['Motor housing at 74°C', 'Belt glazing visible'] },
      { label: 'Repair', requires: ['hvac'], durationMin: 38, preferKinds: ['human'], outputs: ['Bearing replaced', 'Belt replaced and tensioned', 'Fan rebalanced'] },
      { label: 'Post-repair verification', requires: ['analyze.telemetry'], durationMin: 3, remote: true, outputs: ['Vibration back to 1.1 mm/s', 'Signature nominal'] },
    ],
  },
  {
    id: 'gen-service',
    vertical: 'maintenance',
    title: '{asset} — load-bank test & service',
    summary: 'Mechanical service, electrical transfer test, Joint Commission record.',
    priority: 'P3',
    zoneKinds: ['restricted'],
    assetTypes: ['Generator'],
    dueMin: 300,
    steps: [
      { label: 'Mechanical service', requires: ['repair.mechanical'], durationMin: 40, preferKinds: ['human'], outputs: ['Oil, filters, coolant serviced', 'Fuel polish completed'] },
      { label: 'ATS transfer test', requires: ['electrical'], durationMin: 18, preferKinds: ['human'], outputs: ['Transfer in 7.2 s (pass)', 'Transfer in 9.1 s (pass)'] },
      { label: 'Compliance record', requires: ['report.compliance'], durationMin: 4, remote: true, outputs: ['EC.02.05.07 record filed'] },
    ],
  },
  {
    id: 'panel-thermal',
    vertical: 'maintenance',
    title: 'Thermal scan — {asset}',
    summary: 'Crawler thermal scan, AI review, electrician correction.',
    priority: 'P2',
    zoneKinds: ['work'],
    assetTypes: ['Panel'],
    dueMin: 180,
    steps: [
      { label: 'Thermal capture', requires: ['inspect.thermal'], durationMin: 12, preferKinds: ['robot'], outputs: ['Phase B 14°C over A/C'] },
      { label: 'Thermal image review', requires: ['analyze.vision'], durationMin: 4, remote: true, outputs: ['Loose connection on phase B'] },
      { label: 'Electrical correction', requires: ['electrical'], durationMin: 28, preferKinds: ['human'], outputs: ['Connection cleaned and torqued'] },
      { label: 'Compliance record', requires: ['report.compliance'], durationMin: 4, remote: true, outputs: ['NFPA 70B record updated'] },
    ],
  },
  {
    id: 'ward-disinfect',
    vertical: 'maintenance',
    title: 'Terminal clean — {zone}',
    summary: 'UV-C disinfection with EVS verification.',
    priority: 'P2',
    zoneKinds: ['work'],
    zoneIds: ['mg-warda', 'mg-wardb'],
    dueMin: 90,
    steps: [
      { label: 'UV-C disinfection cycle', requires: ['clean'], durationMin: 22, preferKinds: ['robot'], outputs: ['3 rooms, 99.9% log reduction', '4 rooms disinfected'] },
      { label: 'EVS verification', requires: ['inspect.visual'], durationMin: 7, preferKinds: ['human'], outputs: ['ATP swabs pass', 'Room released to nursing'] },
    ],
  },
  {
    id: 'supply-run',
    vertical: 'maintenance',
    title: 'Supply run to {zone}',
    summary: 'Autonomous tug from the dock to the floor.',
    priority: 'P3',
    zoneKinds: ['work'],
    zoneIds: ['mg-warda', 'mg-wardb', 'mg-mech'],
    dueMin: 60,
    steps: [{ label: 'Deliver supplies', requires: ['deliver'], durationMin: 14, preferKinds: ['robot'], outputs: ['Linen cart delivered', 'Pharmacy tote delivered', 'Sterile supplies delivered'] }],
  },
  {
    id: 'roof-inspect',
    vertical: 'maintenance',
    title: 'Roof membrane inspection — {zone}',
    summary: 'Drone survey, AI moisture detection, manager sign-off.',
    priority: 'P3',
    zoneKinds: ['work'],
    zoneIds: ['mg-roof'],
    dueMin: 240,
    steps: [
      { label: 'Drone thermal survey', requires: ['inspect.thermal'], durationMin: 14, preferKinds: ['drone'], outputs: ['Full deck covered at 40 m AGL'] },
      { label: 'Moisture detection', requires: ['analyze.vision'], durationMin: 5, remote: true, outputs: ['Wet insulation suspected near curb 3', 'Membrane dry'] },
      { label: 'Manager sign-off', requires: ['signoff'], durationMin: 6, preferKinds: ['human'], outputs: ['Roofer scheduled', 'Approved'] },
    ],
  },

  // ── Fleet
  {
    id: 'delivery-run',
    vertical: 'fleet',
    title: 'Outbound delivery — {zone}',
    summary: 'AI routing, then autonomous van or driver.',
    priority: 'P2',
    zoneKinds: ['dock'],
    dueMin: 90,
    steps: [
      { label: 'Route optimisation', requires: ['plan.route'], durationMin: 3, remote: true, outputs: ['14 stops, 62 mi, 3 time windows', '9 stops, 41 mi, EV range OK'] },
      { label: 'Load & depart', requires: ['deliver'], durationMin: 26, preferKinds: ['vehicle'], outputs: ['Departed on time', 'Loaded 22 pallets, departed'] },
    ],
  },
  {
    id: 'trailer-move',
    vertical: 'fleet',
    title: 'Trailer move to {zone}',
    summary: 'Autonomous yard tractor shuttles a trailer.',
    priority: 'P3',
    zoneKinds: ['dock'],
    dueMin: 60,
    steps: [{ label: 'Hook, move, drop', requires: ['haul'], durationMin: 12, preferKinds: ['vehicle'], outputs: ['Trailer 5312 at door', 'Trailer 4471 spotted'] }],
  },
  {
    id: 'pm-service',
    vertical: 'fleet',
    title: '{asset} — preventive maintenance',
    summary: 'Telematics diagnosis, mechanic service, yard lead release.',
    priority: 'P2',
    zoneKinds: ['work'],
    assetTypes: ['Truck', 'Van', 'Forklift'],
    dueMin: 240,
    steps: [
      { label: 'Telematics diagnosis', requires: ['analyze.telemetry'], durationMin: 4, remote: true, outputs: ['DPF soot load 78% — regen required', 'Brake wear 2 mm left on axle 2', 'Coolant temp trending high'] },
      { label: 'Service', requires: ['repair.mechanical'], durationMin: 46, preferKinds: ['human'], outputs: ['Brakes relined', 'DPF regenerated', 'Thermostat replaced'] },
      { label: 'Release to service', requires: ['signoff'], durationMin: 5, preferKinds: ['human'], outputs: ['DVIR clear, released'] },
    ],
  },
  {
    id: 'yard-audit',
    vertical: 'fleet',
    title: 'Yard audit — {zone}',
    summary: 'Drone yard check, AI reconciliation against the YMS.',
    priority: 'P4',
    zoneKinds: ['staging'],
    dueMin: 240,
    steps: [
      { label: 'Aerial yard survey', requires: ['survey.scan'], durationMin: 12, preferKinds: ['drone'], outputs: ['61 trailers imaged'] },
      { label: 'YMS reconciliation', requires: ['analyze.vision'], durationMin: 4, remote: true, outputs: ['2 trailers mis-slotted', 'Yard matches YMS'] },
      { label: 'Audit record', requires: ['report.compliance'], durationMin: 3, remote: true, outputs: ['Audit filed'] },
    ],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

export const CAPABILITY_LABELS: Record<Capability, string> = {
  'inspect.visual': 'Visual inspection',
  'inspect.thermal': 'Thermal inspection',
  'survey.scan': 'Laser / photo survey',
  'layout.mark': 'Layout marking',
  haul: 'Material haul',
  'lift.heavy': 'Heavy lift',
  deliver: 'Delivery',
  concrete: 'Concrete',
  drywall: 'Drywall',
  electrical: 'Electrical',
  hvac: 'HVAC',
  weld: 'Welding',
  'repair.mechanical': 'Mechanical repair',
  clean: 'Disinfection / clean',
  'analyze.vision': 'Vision analysis',
  'analyze.telemetry': 'Telemetry diagnosis',
  'plan.route': 'Route planning',
  'report.compliance': 'Compliance reporting',
  signoff: 'Sign-off authority',
};
