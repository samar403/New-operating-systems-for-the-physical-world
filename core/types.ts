/**
 * Strata core domain model.
 *
 * Everything in the physical world that Strata coordinates is expressed with
 * these types: sites and their zones, the agents that do work (humans, robots,
 * drones, vehicles and software AI agents), the assets they maintain, and the
 * multi-step work orders that hand work between them.
 */

export type AgentKind = 'human' | 'robot' | 'drone' | 'vehicle' | 'ai';
export type Vertical = 'construction' | 'maintenance' | 'fleet';

export type Capability =
  | 'inspect.visual'
  | 'inspect.thermal'
  | 'survey.scan'
  | 'layout.mark'
  | 'haul'
  | 'lift.heavy'
  | 'deliver'
  | 'concrete'
  | 'drywall'
  | 'electrical'
  | 'hvac'
  | 'weld'
  | 'repair.mechanical'
  | 'clean'
  | 'analyze.vision'
  | 'analyze.telemetry'
  | 'plan.route'
  | 'report.compliance'
  | 'signoff';

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ZoneKind = 'work' | 'restricted' | 'staging' | 'charging' | 'office' | 'road' | 'dock';
export type Hazard = 'fall' | 'electrical' | 'heavy-equipment' | 'patient-care' | null;

export interface Zone {
  id: string;
  siteId: string;
  name: string;
  rect: Rect;
  kind: ZoneKind;
  hazard: Hazard;
  /** Robots, drones and vehicles may not be dispatched here. */
  humanOnly?: boolean;
  /** Set by an operator or an interlock: autonomous machines inside must hold. */
  robotsPaused?: boolean;
}

export interface Site {
  id: string;
  name: string;
  vertical: Vertical;
  city: string;
  size: { w: number; h: number };
  zones: Zone[];
}

export type AgentStatus = 'idle' | 'enroute' | 'working' | 'charging' | 'paused' | 'offline';

export interface Agent {
  id: string;
  name: string;
  kind: AgentKind;
  role: string;
  /** Site the agent is deployed to; `*` means it serves every site (software agents). */
  siteId: string;
  pos: Vec;
  target: Vec | null;
  /** Grid units per simulated minute. */
  speed: number;
  capabilities: Capability[];
  certifications: string[];
  /** 0-100. Battery for machines, remaining shift energy for humans. */
  battery: number;
  status: AgentStatus;
  taskRef: TaskRef | null;
  costPerHour: number;
  /** Heavy machines trigger human-proximity interlocks. */
  heavy?: boolean;
  stats: { completed: number; busyMinutes: number; distance: number };
  trail: Vec[];
  /** Ticks remaining on a safety interlock hold. */
  holdTicks?: number;
  /** After a hold, the machine creeps past at reduced speed instead of re-triggering. */
  crawlTicks?: number;
}

export interface TaskRef {
  workOrderId: string;
  stepIndex: number;
}

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type WorkOrderStatus = 'queued' | 'active' | 'blocked' | 'done' | 'cancelled';
export type WorkOrderSource = 'manual' | 'copilot' | 'sensor' | 'schedule' | 'field';
export type StepStatus = 'pending' | 'awaiting' | 'enroute' | 'in_progress' | 'done' | 'skipped';

export interface ScoreFactor {
  factor: 'capability' | 'proximity' | 'availability' | 'cost' | 'battery' | 'preference' | 'safety' | 'workload';
  /** Normalised 0-1. */
  value: number;
  weight: number;
  note: string;
}

export interface Candidate {
  agentId: string;
  score: number;
  eligible: boolean;
  etaMin: number;
  factors: ScoreFactor[];
  blockers: string[];
}

export interface Assignment {
  agentId: string;
  score: number;
  at: number;
  policy: DispatchPolicy;
  candidates: Candidate[];
  manual?: boolean;
}

export interface Step {
  id: string;
  label: string;
  requires: Capability[];
  preferKinds?: AgentKind[];
  /** Simulated minutes of work at the location. */
  durationMin: number;
  /** Software step: no travel, no physical location. */
  remote?: boolean;
  progress: number;
  status: StepStatus;
  assigneeId: string | null;
  assignment?: Assignment;
  startedAt?: number;
  finishedAt?: number;
  output?: string;
}

export interface WorkOrder {
  id: string;
  code: string;
  title: string;
  siteId: string;
  zoneId: string;
  location: Vec;
  priority: Priority;
  status: WorkOrderStatus;
  source: WorkOrderSource;
  createdAt: number;
  dueAt: number;
  completedAt?: number;
  steps: Step[];
  currentStep: number;
  assetId?: string;
  templateId?: string;
}

export type AssetType = 'HVAC' | 'Generator' | 'Elevator' | 'Crane' | 'Hoist' | 'Truck' | 'Van' | 'Chiller' | 'Panel' | 'Forklift';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  siteId: string;
  pos: Vec;
  /** 0-100. */
  health: number;
  /** Health change per simulated hour (negative = degrading). */
  drift: number;
  telemetry: { temp: number; vibration: number; load: number };
  history: number[];
  openWorkOrderId: string | null;
  lastServiceAt: number;
}

export type EventLevel = 'info' | 'success' | 'warn' | 'critical';
export type EventKind =
  | 'dispatch'
  | 'handoff'
  | 'complete'
  | 'created'
  | 'safety'
  | 'sensor'
  | 'battery'
  | 'system'
  | 'copilot'
  | 'ai';

export interface WorldEvent {
  id: string;
  t: number;
  level: EventLevel;
  kind: EventKind;
  siteId: string | null;
  message: string;
  refs?: { agentId?: string; workOrderId?: string; zoneId?: string; assetId?: string };
}

export interface SafetyIncident {
  id: string;
  t: number;
  siteId: string;
  zoneId: string | null;
  kind: 'proximity' | 'hazard-report' | 'e-stop' | 'geofence';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  agents: string[];
  resolved: boolean;
}

export type DispatchPolicy = 'balanced' | 'fastest' | 'cheapest' | 'safest';

export interface Metrics {
  completed: number;
  onTime: number;
  late: number;
  interlocks: number;
  hazardsReported: number;
  autonomousMinutes: number;
  humanMinutes: number;
  aiMinutes: number;
  costSpent: number;
  /** What the same completed work would have cost if done by humans only. */
  costBaseline: number;
  assignLatencySum: number;
  assignCount: number;
  series: { t: number; completed: number; utilization: number; active: number }[];
}

export interface World {
  seed: number;
  rng: number;
  tick: number;
  /** Simulated minutes since the start of the shift (06:00). */
  clock: number;
  minutesPerTick: number;
  running: boolean;
  policy: DispatchPolicy;
  sites: Site[];
  agents: Agent[];
  assets: Asset[];
  workOrders: WorkOrder[];
  events: WorldEvent[];
  incidents: SafetyIncident[];
  metrics: Metrics;
  counters: { wo: number; ev: number; inc: number };
}

/** Wire-format snapshot: the world minus internal bookkeeping. */
export type Snapshot = Omit<World, 'rng' | 'counters'>;

export type Command =
  | {
      type: 'create_work_order';
      templateId: string;
      siteId: string;
      zoneId?: string;
      priority?: Priority;
      title?: string;
      source?: WorkOrderSource;
      assetId?: string;
    }
  | {
      type: 'create_custom_work_order';
      siteId: string;
      zoneId?: string;
      title: string;
      requires: Capability[];
      priority?: Priority;
      durationMin?: number;
      source?: WorkOrderSource;
    }
  | { type: 'cancel_work_order'; workOrderId: string }
  | { type: 'reassign_step'; workOrderId: string; agentId: string }
  | { type: 'complete_step'; workOrderId: string; agentId: string }
  | { type: 'set_policy'; policy: DispatchPolicy }
  | { type: 'pause_zone'; zoneId: string; reason?: string }
  | { type: 'resume_zone'; zoneId: string }
  | { type: 'estop_site'; siteId: string }
  | { type: 'release_site'; siteId: string }
  | { type: 'recall_agent'; agentId: string }
  | { type: 'set_agent_online'; agentId: string; online: boolean }
  | { type: 'report_hazard'; siteId: string; zoneId: string; agentId?: string; note: string }
  | { type: 'resolve_incident'; incidentId: string }
  | { type: 'set_speed'; minutesPerTick: number }
  | { type: 'set_running'; running: boolean }
  | { type: 'reset'; seed?: number };

export interface CommandResult {
  ok: boolean;
  message: string;
  workOrderId?: string;
}

export interface CopilotAction {
  command: Command;
  result: CommandResult;
}

export interface CopilotReply {
  reply: string;
  actions: CopilotAction[];
  engine: 'ai' | 'local';
}
