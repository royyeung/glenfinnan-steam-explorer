import { describe, expect, it } from 'vitest';
import { BeatClock, beatAngles } from '../src/sim/beats.ts';
import { MPH, TrainRun, type Route } from '../src/sim/run.ts';
import { Footplate } from '../src/sim/footplate.ts';

const deg = (r: number) => (r * 180) / Math.PI;

describe('exhaust beats from the valve gear', () => {
  for (const c of [0.75, 0.5, 0.3, -0.65]) {
    it(`four beats per revolution, alternating sides, at cut-off ${c}`, () => {
      const b = beatAngles(c);
      expect(b.length).toBe(4);
      expect(new Set(b.map((x) => x.side)).size).toBe(2);
      // two beats per side, half a turn apart (each end of the cylinder)
      for (const side of ['L', 'R'] as const) {
        const s = b.filter((x) => x.side === side).map((x) => x.theta);
        expect(Math.abs(deg(s[1] - s[0]) - 180)).toBeLessThan(35); // back gear is less symmetric (con-rod angularity)
      }
    });
  }
  it('finds every beat crossed in a step, forwards and backwards', () => {
    const k = new BeatClock(); k.setCutoff(0.5);
    const fwd = k.crossed(0.1, 0.1 + Math.PI * 4);
    expect(fwd.length).toBe(8);
    for (const x of fwd) expect(x.frac).toBeGreaterThan(0), expect(x.frac).toBeLessThanOrEqual(1);
    expect(k.crossed(10, 10 - Math.PI * 2).length).toBe(4);
  });
});

// a level route like Glenfinnan's: viaduct 376 m, station stop 1 km beyond
const route: Route = { viaduct: [1000, 1376], stop: 0, west: -800, east: 2600, height: () => 50 };
const run = (r: TrainRun, fp: Footplate, seconds: number, each?: (t: number) => void) => {
  fp.onTrack = true;
  for (let i = 0; i < seconds * 120; i++) { r.step(1 / 120, fp); fp.wheelOmega = r.v / 0.9144; fp.step(1 / 120); each?.(i / 120); }
};

describe('the automatic run', () => {
  for (const mph of [5, 10, 20]) {
    it(`crosses the viaduct at ${mph} mph and stops at the station`, () => {
      const fp = new Footplate(), r = new TrainRun(route, route.east - 200, 440, 160);
      r.viaductSpeed = mph * MPH; r.v = r.lineSpeed;
      let vMaxOnViaduct = 0, vMinOnViaduct = Infinity, aMax = 0, stoppedAt: number | null = null;
      run(r, fp, 900, () => {
        const on = r.s <= 1376 && r.s + r.length >= 1000;
        if (on) { vMaxOnViaduct = Math.max(vMaxOnViaduct, r.v); vMinOnViaduct = Math.min(vMinOnViaduct, r.v); }
        aMax = Math.max(aMax, Math.abs(r.a));
        if (stoppedAt === null && r.state === 'standing') stoppedAt = r.s;
      });
      expect(vMaxOnViaduct).toBeLessThan(mph * MPH * 1.06);
      expect(vMinOnViaduct).toBeGreaterThan(mph * MPH * 0.85);
      expect(stoppedAt).not.toBeNull();
      expect(Math.abs(stoppedAt! - route.stop)).toBeLessThan(2);
      expect(aMax).toBeLessThan(0.95);
    });
  }
  it('lifts the train up the fitted 1 in 40 (taken as 1 in 50) at the viaduct speed and still stops', () => {
    const fp = new Footplate(), r = new TrainRun({ ...route, height: (s) => (s > 1376 ? 0 : (1376 - s) / 40) }, route.east - 200, 445, 160);
    r.viaductSpeed = 10 * MPH; r.v = r.lineSpeed;
    let vMin = Infinity, stopped: number | null = null;
    run(r, fp, 900, () => { if (r.s <= 1376 && r.s + r.length >= 1000) vMin = Math.min(vMin, r.v); if (stopped === null && r.state === 'standing') stopped = r.s; });
    expect(vMin).toBeGreaterThan(10 * MPH * 0.85);
    expect(stopped).not.toBeNull();
    expect(Math.abs(stopped! - route.stop)).toBeLessThan(2);
  });
  it('pauses with the train centred on the viaduct when asked, then carries on', () => {
    const fp = new Footplate(), r = new TrainRun(route, route.east - 200, 440, 160);
    r.pauseOnViaduct = true; r.v = r.lineSpeed;
    let paused: number | null = null, stoppedAtStation = false;
    run(r, fp, 900, () => { if (paused === null && r.state === 'standing') paused = r.s; if (paused !== null && r.state === 'standing' && Math.abs(r.s - route.stop) < 2) stoppedAtStation = true; });
    expect(Math.abs(paused! - r.pausePoint)).toBeLessThan(2);
    expect(stoppedAtStation).toBe(true);
  });
  it('restarts east of the viaduct after leaving westwards', () => {
    const fp = new Footplate(), r = new TrainRun(route, route.stop + 50, 440, 160);
    let restarts = 0; r.onRestart = () => restarts++;
    r.placeAt(route.stop, true);
    run(r, fp, 400);
    expect(restarts).toBe(1);
  });
  it('holds still with the brakes on and does not run backwards', () => {
    const fp = new Footplate(), r = new TrainRun({ ...route, height: (s) => s * 0.02 }, 500, 440, 160);
    r.running = false; r.v = 0; r.brake = 1;
    run(r, fp, 30);
    expect(r.v).toBe(0);
    expect(r.s).toBe(500);
  });
});
