import { Activity, Bot, CalendarRange, ClipboardList, Gauge, Map, Settings, ShieldCheck, Smartphone, Sparkles, Wrench } from 'lucide-react';

export const NAV = [
  { to: '/app', label: 'Command', hint: 'Live overview of every site', icon: Gauge, key: 'c' },
  { to: '/app/twin', label: 'Site Twin', hint: 'Live map of people, machines and work', icon: Map, key: 't' },
  { to: '/app/work', label: 'Work Orders', hint: 'Relay plans and dispatch decisions', icon: ClipboardList, key: 'w' },
  { to: '/app/agents', label: 'Workforce', hint: 'Humans, robots, drones, vehicles, AI', icon: Bot, key: 'a' },
  { to: '/app/timeline', label: 'Shift Tape', hint: 'Who did what, when', icon: CalendarRange, key: 's' },
  { to: '/app/assets', label: 'Assets', hint: 'Predictive maintenance', icon: Wrench, key: 'm' },
  { to: '/app/safety', label: 'Safety', hint: 'Interlocks, geofences, incidents', icon: ShieldCheck, key: 'y' },
  { to: '/app/copilot', label: 'Copilot', hint: 'Operate in plain language', icon: Sparkles, key: 'k' },
  { to: '/app/field', label: 'Field App', hint: 'The crew’s phone view', icon: Smartphone, key: 'f' },
  { to: '/app/settings', label: 'Settings', hint: 'Dispatch policy & integrations', icon: Settings, key: ',' },
] as const;

export const PulseIcon = Activity;
