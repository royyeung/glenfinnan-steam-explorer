// The train running on the line: one longitudinal model for the whole train (tractive effort from
// the regulator, cut-off and boiler pressure; rolling and air resistance; gradient from the fitted
// rail levels; the train brake), and an automatic driver that works the same footplate controls you
// see in the cab. Position is the arc length of the engine's front buffer; the train runs westbound
// (towards Mallaig, chimney first), which is decreasing arc length.
//
// The automatic run: across the viaduct at the chosen speed, on to Glenfinnan station, stop at the
// platform, then away westwards; at the west end of the modelled line it starts again east of the
// viaduct. Speeds: the viaduct speed is yours to choose (travel guides say the train slows right
// down, S32; about 10 mph from the "almost two minutes" crossing). The line speed (25 mph) is an
// estimate: no published limit was found (REFERENCE §9, Q13).
import type { Footplate } from './footplate.ts';

export const MPH = 0.44704;
const G = 9.81;
/** steepest slope the train model uses (1 in 50) */
export const MAX_GRADE = 1 / 50;

/** Masses in tonnes, in working order. Published class figures (rounded), not weighed vehicles. */
export const MASS = { engine: 72.1, tender: 53.7, mk2: 33, mk1buffet: 37, class47: 117 };

/** Davis-type resistance for the whole train (N): rolling, flange and air drag. Estimate. */
export function resistance(massT: number, v: number) {
  const a = Math.abs(v);
  return massT * (12 + 0.25 * a) + 9 * a * a + 2500; // + engine internal friction
}

/** Tractive effort (N) at the rail for the footplate settings and speed. Starting effort 113 kN
 *  (25,455 lbf at 85 % boiler pressure, the class figure); at speed limited by about 900 kW of
 *  cylinder power, less at short cut-off. Mid gear gives nothing. */
export function tractiveEffort(regulator: number, cutoff: number, pressure: number, v: number) {
  const c = Math.abs(cutoff);
  const start = 113e3 * Math.min(1, c / 0.75), power = 900e3 * Math.min(1, Math.max(0.35, c / 0.45));
  return Math.sign(cutoff) * regulator * (pressure / 225) * Math.min(start, power / Math.max(0.5, Math.abs(v)));
}

export type RunState = 'standing' | 'departing' | 'running' | 'stopping';

export interface Route {
  /** arc lengths: viaduct ends, the station stop (front buffer), the ends of the modelled track */
  viaduct: [number, number]; stop: number; west: number; east: number;
  /** arc length of the line at height y (m) for the gradient */
  height: (s: number) => number;
}

export class TrainRun {
  s: number;
  v = 0;               // m/s, + = forward (westbound)
  a = 0;
  massT: number;
  length: number;      // front buffer to rear buffer (m)
  auto = true;         // the automatic driver works the controls
  running = true;      // automatic run going (false: stand where it is)
  viaductSpeed = 10 * MPH;
  lineSpeed = 25 * MPH;
  state: RunState = 'running';
  /** what the automatic driver is doing, for the HUD */
  status = '';
  brake = 0;           // train brake application 0..1 (the automatic driver's)
  /** verification only: hold this exact speed (m/s) and skip the dynamics */
  hold: number | null = null;
  private timer = 0;
  private stall = 0;
  private stopDone = false;
  private whistledViaduct = false;
  /** jumps back to the east end (for the follow camera and sounds) */
  onRestart: () => void = () => {};

  readonly route: Route;
  constructor(route: Route, s: number, massT: number, length: number) { this.route = route; this.s = s; this.massT = massT; this.length = length; }

  /** Start at the viaduct, rolling across it; or standing at the station. */
  placeAt(s: number, standing: boolean) {
    this.s = s; this.brake = standing ? 1 : 0;
    this.v = standing ? 0 : this.viaductSpeed;
    this.state = standing ? 'standing' : 'running'; this.timer = standing ? 20 : 0;
    this.stopDone = s <= this.route.stop + 2;
    this.whistledViaduct = s < this.route.viaduct[1] + 300;
  }

  /** Speed limit at front-buffer position s (the whole train must be inside a limit's window). */
  limitAt(s: number) {
    const [vW, vE] = this.route.viaduct;
    return s <= vE + 20 && s + this.length >= vW ? this.viaductSpeed : this.lineSpeed;
  }

  /** Highest speed from which the train can still meet every limit and the stop ahead (planning
   *  deceleration 0.3 m/s^2, well inside a vacuum-braked train's 0.9). */
  target(s: number) {
    const b = 0.3, [, vE] = this.route.viaduct;
    let v = this.limitAt(s);
    if (s > vE + 20) v = Math.min(v, Math.sqrt(this.viaductSpeed ** 2 + 2 * b * (s - vE - 20)));
    if (!this.stopDone && s > this.route.stop) v = Math.min(v, Math.sqrt(2 * b * (s - this.route.stop)));
    return v;
  }

  /** Grade force (N): sum over the train of m g sin(slope), sampled at five points along it. The
   *  fitted rail levels reach 1 in 40 (the fit's own limit, from 50 m terrain); the slope used here is
   *  capped at 1 in 50 so that, as in reality, a Black 5 can lift this train. Real gradients: unverified. */
  private gradeForce() {
    let f = 0;
    for (let k = 0; k < 5; k++) {
      const s = this.s + (k + 0.5) * this.length / 5, h = this.route.height;
      const slope = Math.max(-MAX_GRADE, Math.min(MAX_GRADE, (h(s - 5) - h(s + 5)) / 10)); // uphill westbound = rising as s decreases
      f += (this.massT / 5) * 1000 * G * slope;
    }
    return f;
  }

  /** One fixed step. Reads the footplate (regulator, reverser, pressure, brakes); in automatic mode
   *  first sets those controls itself. */
  step(dt: number, fp: Footplate) {
    const c = fp.c;
    if (this.hold !== null) {
      this.v = this.hold; this.a = 0; this.s -= this.v * dt;
      c.regulator = 0.4; c.brake = 0; fp.steamDemand = 0.3; this.status = 'Test run at constant speed';
      return;
    }
    if (this.auto) this.drive(dt, fp);
    const M = this.massT * 1000 * 1.06; // + rotating masses
    const brake = this.auto ? this.brake : Math.max(fp.braking, c.handbrake * 0.15);
    const fT = tractiveEffort(c.regulator, c.reverser, fp.pressure, this.v);
    // steam: the boiler can sustain roughly 700 kW at the cylinders with the auxiliaries running (estimate)
    fp.steamDemand = Math.min(1.2, Math.abs(fT * this.v) / 1.4e6 + 0.03 * c.regulator);
    const fR = resistance(this.massT, this.v), fB = brake * 0.09 * G * this.massT * 1000, fG = this.gradeForce();
    // resistance and brakes oppose motion; at rest they hold the train unless the push exceeds them
    const push = fT - fG, hold = fR + fB;
    if (Math.abs(this.v) < 0.02 && Math.abs(push) <= hold) { this.v = 0; this.a = 0; }
    else {
      const dir = this.v !== 0 ? Math.sign(this.v) : Math.sign(push);
      this.a = (push - dir * hold) / M;
      const v0 = this.v; this.v += this.a * dt;
      if (v0 !== 0 && Math.sign(this.v) !== Math.sign(v0) && Math.abs(push) <= hold) this.v = 0; // brakes stop, never reverse
    }
    this.s -= this.v * dt;
    // the ends of the modelled track
    if (this.auto && this.running && this.s < this.route.west) {
      this.s = this.route.east; this.v = this.lineSpeed; this.stopDone = false; this.whistledViaduct = false; this.state = 'running'; this.brake = 0;
      this.onRestart();
    }
    const lo = this.route.west - 40, hi = this.route.east + 60;
    if (this.s < lo || this.s > hi) { this.s = Math.min(hi, Math.max(lo, this.s)); this.v = 0; this.status = 'End of the modelled line'; }
  }

  /** The automatic fireman: injector for the water, blower and dampers to keep the pressure near the blowing-off mark
   *  (the footplate model has no firing, so the draught stands in for it). */
  private fireman(dt: number, fp: Footplate, base: number) {
    const c = fp.c, want = Math.max(base, Math.min(0.85, (221 - fp.pressure) / 15));
    c.blower += Math.max(-0.3 * dt, Math.min(0.3 * dt, want - c.blower));
    c.damperF = fp.pressure < 215 ? 1 : 0.5;
    // water: an injector on below half a glass (not while the pressure is down, unless the glass is
    // getting low), off at three quarters
    if (fp.water < 0.3 || (fp.water < 0.5 && fp.pressure > 205)) c.injR = 1; else if (fp.water > 0.75 || (fp.pressure < 190 && fp.water > 0.35)) c.injR = 0;
  }

  /** The automatic driver. */
  private drive(dt: number, fp: Footplate) {
    const c = fp.c, ramp = (cur: number, to: number, rate: number) => cur + Math.max(-rate * dt, Math.min(rate * dt, to - cur));
    if (fp.held !== 'whistle') c.whistle = 0;
    c.drainCocks = 0;
    if (!this.running) {
      c.regulator = ramp(c.regulator, 0, 0.6); this.brake = ramp(this.brake, this.v > 0.01 ? 0.6 : 1, 0.5);
      c.brake = this.brake; this.status = this.v > 0.01 ? 'Stopping' : 'Standing';
      return;
    }
    if (this.state === 'standing') {
      c.regulator = ramp(c.regulator, 0, 0.6); this.brake = ramp(this.brake, 1, 0.6); this.fireman(dt, fp, 0.45);
      this.timer -= dt;
      const atStation = this.s <= this.route.stop + 3 && this.s > this.route.stop - 3;
      // a heavy train on the bank: wait for a full head of steam before starting
      const ready = fp.pressure >= 215;
      this.status = this.timer > 0 ? (atStation ? `At Glenfinnan station, leaving in ${Math.ceil(this.timer)} s` : `Standing, leaving in ${Math.ceil(this.timer)} s`) : 'Waiting for steam';
      if (this.timer <= 0 && ready) { this.state = 'departing'; this.timer = 7; }
      c.brake = this.brake; return;
    }
    if (this.state === 'departing') {
      // whistle, reverser into full forward gear, drain cocks open, regulator open against the brakes,
      // then release the brakes once the engine is pulling (so it never runs back on the bank)
      this.timer -= dt; this.status = 'Departing';
      if (this.timer > 5.5) c.whistle = 1;
      c.reverser = ramp(c.reverser, 0.75, 0.5); this.fireman(dt, fp, 0.15);
      if (this.timer < 5) {
        c.drainCocks = 1;
        const M = this.massT * 1000 * 1.06, need = resistance(this.massT, this.v) + this.gradeForce() + M * 0.08;
        c.regulator = ramp(c.regulator, Math.min(1, need / Math.max(1, tractiveEffort(1, c.reverser, fp.pressure, this.v))), 0.25);
        if (tractiveEffort(c.regulator, c.reverser, fp.pressure, this.v) >= this.gradeForce() + resistance(this.massT, 0) * 0.5) this.brake = ramp(this.brake, 0, 0.5);
      }
      if (this.timer <= 0 && this.brake < 0.05) this.state = 'running';
      c.brake = this.brake; return;
    }
    // running: follow the target speed with a little look-ahead
    const look = this.s - Math.max(0, this.v) * 2.5, vt = Math.min(this.target(this.s), this.target(look));
    const e = vt - this.v;
    // whistle approaching the viaduct (a courtesy blast; whistle boards here unverified)
    if (!this.whistledViaduct && this.s < this.route.viaduct[1] + 250) { this.whistledViaduct = true; this.timer = 1.6; }
    if (this.timer > 0) { this.timer -= dt; c.whistle = 1; }
    // drain cocks open for the first few seconds after starting
    if (this.v < 1.5 && c.regulator > 0.05) c.drainCocks = 1;
    const M = this.massT * 1000 * 1.06;
    // accelerate gently, and ease off when the pressure is falling (as a driver would)
    const aWant = Math.max(-0.7, Math.min(0.15 * Math.max(0.2, Math.min(1, (fp.pressure - 160) / 50)), 0.5 * e));
    const need = M * aWant + resistance(this.massT, this.v) + this.gradeForce();
    // notch up as speed rises (about 30 % at line speed), but drop the lever towards full gear when
    // the regulator alone cannot give the pull needed (a heavy train on the 1 in 50); drift at 45 %
    let cutWant = 0.45;
    if (need > 0) {
      cutWant = Math.max(0.3, Math.min(0.75, 0.75 - 0.045 * this.v));
      while (cutWant < 0.75 && tractiveEffort(0.85, cutWant, fp.pressure, this.v) < need * 1.1) cutWant += 0.05;
    }
    c.reverser = ramp(c.reverser, Math.min(0.75, cutWant), 0.25);
    if (need > 0 && e > -0.4) {
      const full = tractiveEffort(1, c.reverser, fp.pressure, this.v);
      c.regulator = ramp(c.regulator, Math.max(0, Math.min(1, need / Math.max(1, full))), 0.3);
      this.brake = ramp(this.brake, 0, 0.6);
    } else {
      c.regulator = ramp(c.regulator, 0, 0.6);
      this.brake = ramp(this.brake, Math.max(0, Math.min(1, -need / (0.09 * G * this.massT * 1000))), 0.5);
    }
    this.fireman(dt, fp, c.regulator < 0.05 ? 0.45 : 0.1);
    c.brake = this.brake;
    // stalled on the bank (or starting to run back): hold it on the brakes and wait for steam
    this.stall = this.v < 0.1 && c.regulator > 0.9 ? this.stall + dt : 0;
    if (this.v < -0.01 || this.stall > 4) { this.brake = 1; c.regulator = 0; this.v = Math.max(0, this.v); this.state = 'standing'; this.timer = 0; this.stall = 0; return; }
    // the station stop
    if (!this.stopDone && this.s - this.route.stop < 1.5 && this.v < 0.4) {
      this.v = 0; this.stopDone = true; this.state = 'standing'; this.timer = 60; this.brake = 1;
    }
    const [vW, vE] = this.route.viaduct;
    this.status = this.s <= vE && this.s + this.length >= vW ? 'Crossing the viaduct'
      : this.s > vE ? 'Approaching the viaduct'
      : !this.stopDone ? 'Running to Glenfinnan station' : 'Leaving westwards';
  }
}
