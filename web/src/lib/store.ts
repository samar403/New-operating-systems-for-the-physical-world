/**
 * Client state + transport.
 *
 * Strata is edge-first: the UI connects to the API server when one is
 * reachable ("Live"), and otherwise boots the very same engine in the browser
 * ("Edge") — exactly how a site tablet keeps working when the LTE drops.
 */
import { create } from 'zustand';
import {
  applyCommand,
  createWorld,
  runLocalCopilot,
  snapshot,
  step,
  type Command,
  type CommandResult,
  type CopilotReply,
  type Snapshot,
  type World,
} from '@core/index';

export type Mode = 'connecting' | 'live' | 'edge';

export interface ChatEntry {
  id: string;
  role: 'user' | 'copilot';
  text: string;
  reply?: CopilotReply;
  pending?: boolean;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err' | 'info';
}

interface State {
  snap: Snapshot | null;
  mode: Mode;
  copilotEngine: 'ai' | 'local';
  siteId: string;
  selectedAgentId: string | null;
  selectedWoId: string | null;
  paletteOpen: boolean;
  chat: ChatEntry[];
  toasts: Toast[];
  theme: 'dark' | 'light';
  setSite: (id: string) => void;
  selectAgent: (id: string | null) => void;
  selectWo: (id: string | null) => void;
  setPalette: (open: boolean) => void;
  send: (cmd: Command, opts?: { quiet?: boolean }) => Promise<CommandResult>;
  ask: (text: string) => Promise<CopilotReply>;
  toast: (text: string, tone?: Toast['tone']) => void;
  toggleTheme: () => void;
}

let edgeWorld: World | null = null;
let edgeTimer: ReturnType<typeof setInterval> | null = null;
let source: EventSource | null = null;
let started = false;
let toastSeq = 0;

const initialTheme = (): 'dark' | 'light' => {
  try {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const useStrata = create<State>((set, get) => ({
  snap: null,
  mode: 'connecting',
  copilotEngine: 'local',
  siteId: 'hp',
  selectedAgentId: null,
  selectedWoId: null,
  paletteOpen: false,
  chat: [],
  toasts: [],
  theme: initialTheme(),
  setSite: (siteId) => set({ siteId, selectedAgentId: null }),
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),
  selectWo: (selectedWoId) => set({ selectedWoId }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  toast: (text, tone = 'info') => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3800);
  },
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('strata-theme', theme);
    } catch {
      /* storage unavailable */
    }
    set({ theme });
  },
  send: async (cmd, opts) => {
    let result: CommandResult;
    if (get().mode === 'live') {
      try {
        const res = await fetch('/api/command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cmd) });
        result = (await res.json()) as CommandResult;
      } catch {
        result = { ok: false, message: 'Server unreachable' };
      }
    } else if (edgeWorld) {
      result = applyCommand(edgeWorld, cmd);
      set({ snap: snapshot(edgeWorld) });
    } else {
      result = { ok: false, message: 'Not connected yet' };
    }
    if (!opts?.quiet) get().toast(result.message, result.ok ? 'ok' : 'err');
    return result;
  },
  ask: async (text) => {
    const uid = `u${Date.now()}`;
    const cid = `c${Date.now()}`;
    set((s) => ({ chat: [...s.chat, { id: uid, role: 'user', text }, { id: cid, role: 'copilot', text: '', pending: true }] }));
    let reply: CopilotReply;
    if (get().mode === 'live') {
      try {
        const res = await fetch('/api/copilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, siteId: get().siteId }) });
        reply = (await res.json()) as CopilotReply;
      } catch {
        reply = { reply: 'The server is unreachable — try again in a moment.', actions: [], engine: 'local' };
      }
    } else if (edgeWorld) {
      reply = runLocalCopilot(edgeWorld, text, { siteId: get().siteId });
      set({ snap: snapshot(edgeWorld) });
    } else {
      reply = { reply: 'Still connecting…', actions: [], engine: 'local' };
    }
    set((s) => ({ chat: s.chat.map((c) => (c.id === cid ? { ...c, text: reply.reply, reply, pending: false } : c)) }));
    return reply;
  },
}));

function startEdge() {
  if (edgeWorld) return;
  source?.close();
  edgeWorld = createWorld(7, { warmupMinutes: 90 });
  useStrata.setState({ mode: 'edge', copilotEngine: 'local', snap: snapshot(edgeWorld) });
  edgeTimer = setInterval(() => {
    if (!edgeWorld) return;
    if (edgeWorld.running) step(edgeWorld);
    useStrata.setState({ snap: snapshot(edgeWorld) });
  }, 500);
}

async function startLive(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const health = (await res.json()) as { ok: boolean; copilot: 'ai' | 'local' };
    if (!health.ok) return false;
    useStrata.setState({ copilotEngine: health.copilot });
  } catch {
    return false;
  }
  return new Promise((resolve) => {
    let resolved = false;
    let failures = 0;
    source = new EventSource('/api/stream');
    source.addEventListener('snapshot', (e) => {
      failures = 0;
      useStrata.setState({ snap: JSON.parse((e as MessageEvent).data) as Snapshot, mode: 'live' });
      if (!resolved) {
        resolved = true;
        resolve(true);
      }
    });
    source.onerror = () => {
      failures += 1;
      if (!resolved) {
        resolved = true;
        source?.close();
        resolve(false);
      } else if (failures > 4) {
        // Lost the server mid-shift: keep working at the edge.
        source?.close();
        startEdge();
        useStrata.getState().toast('Connection lost — continuing in Edge mode', 'info');
      }
    };
  });
}

export async function startStrata() {
  if (started) return;
  started = true;
  const forceEdge = new URLSearchParams(location.search).get('mode') === 'edge' || import.meta.env.VITE_STRATA_MODE === 'edge';
  if (forceEdge || !(await startLive())) startEdge();
}

export function stopEdge() {
  if (edgeTimer) clearInterval(edgeTimer);
}
