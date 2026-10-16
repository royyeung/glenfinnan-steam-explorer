// URL parameters: ?q=high|medium|low  ?debug=1  ?fixed=1 (deterministic: sim advances only via GX.step)
// ?shot=<view> (harness capture mode)  ?perf=1 (overlay)  ?tune=1 (tuning panel)  ?live=1 (generate, no GLB)
// ?site=test (the Phase 1-4 straight test track, used by the regression checks)  ?place=viaduct|station  ?weather=fair|sunny|overcast|mist  ?diesel=0
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
  site: (u.get('site') === 'test' ? 'test' : 'glenfinnan') as 'test' | 'glenfinnan',
  place: (u.get('place') === 'station' ? 'station' : 'viaduct') as 'viaduct' | 'station',
  weather: u.get('weather'),
  /** the Class 47 at the rear of the train (default on; ?diesel=0 hides it) */
  diesel: u.get('diesel') !== '0',
};
