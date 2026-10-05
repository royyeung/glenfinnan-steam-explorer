// URL parameters: ?q=high|medium|low  ?debug=1  ?fixed=1 (deterministic: sim advances only via GX.step)
// ?shot=<view> (harness capture mode)  ?perf=1 (overlay)  ?tune=1 (tuning panel)  ?live=1 (generate, no GLB)
import type { Tier } from './quality.ts';

const u = new URLSearchParams(location.search);
const flag = (k: string) => u.has(k) && u.get(k) !== '0';

export const params = {
  q: (u.get('q') as Tier | 'auto' | null) ?? null,
  debug: flag('debug') || flag('shot') || flag('fixed'),
  fixed: flag('fixed'),
  shot: u.get('shot'),
  perf: flag('perf'),
  tune: flag('tune'),
  live: flag('live'),
  view: u.get('view'),
  hour: u.has('hour') ? Number(u.get('hour')) : null,
};
