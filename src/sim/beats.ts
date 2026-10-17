// Exhaust beats from the valve gear. A cylinder end releases its steam to the chimney when the piston
// valve, moving away from mid travel, uncovers that end's port to exhaust. With the exhaust lap taken
// as zero (estimate: Black 5 port dimensions are not published) that is the moment the valve passes
// mid travel, so each side gives two beats per revolution and the engine four. The crank angles come
// from the solved Walschaerts gear for the current cut-off, so they shift with the reverser as on the
// real engine (shorter cut-off: earlier release).
import { motionGeometry, valveGearGeometry } from '../loco/layout.ts';
import { solveMotion } from '../loco/motion/solver.ts';
import { solveValveGear } from '../loco/motion/walschaerts.ts';

/** Exhaust lap (m): the valve travel past mid at which the port opens to exhaust. Estimate. */
export const EXHAUST_LAP = 0;
const TAU = Math.PI * 2;
const geo = motionGeometry(), vg = valveGearGeometry();

export interface Beat { theta: number; side: 'L' | 'R' }

function travel(theta: number, cutoff: number, side: 'left' | 'right') {
  return solveValveGear(vg, geo.drive, solveMotion(geo, theta)[side], cutoff).valveTravel - EXHAUST_LAP;
}

/** The four release angles (wheel angle theta, 0..2pi, sorted) for a cut-off. */
export function beatAngles(cutoff: number, samples = 360): Beat[] {
  const out: Beat[] = [];
  for (const side of ['left', 'right'] as const) {
    let a = 0, fa = travel(0, cutoff, side);
    for (let i = 1; i <= samples; i++) {
      const b = (i / samples) * TAU, fb = travel(b, cutoff, side);
      if ((fa < 0 && fb >= 0) || (fa > 0 && fb <= 0)) {
        // refine the crossing by bisection (the gear is smooth; 30 halvings is far below 0.001 deg)
        let lo = a, hi = b, flo = fa;
        for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2, fm = travel(m, cutoff, side); if ((flo < 0) === (fm < 0)) { lo = m; flo = fm; } else hi = m; }
        out.push({ theta: ((lo + hi) / 2) % TAU, side: side === 'left' ? 'L' : 'R' });
      }
      a = b; fa = fb;
    }
  }
  return out.sort((x, y) => x.theta - y.theta);
}

/** Tracks the beat angles for the current cut-off and finds the beats crossed in each step. */
export class BeatClock {
  beats: Beat[] = beatAngles(0.65);
  private cutoff = 0.65;

  setCutoff(c: number) {
    if (Math.abs(c - this.cutoff) < 0.02) return;
    this.cutoff = c; this.beats = beatAngles(c);
  }

  /** Beats passed while the wheel turned from th0 to th1 (either direction), each with the fraction
   *  of the step at which it fell (for exact timing within the step). */
  crossed(th0: number, th1: number): { beat: Beat; theta: number; frac: number }[] {
    const out: { beat: Beat; theta: number; frac: number }[] = [];
    if (th1 === th0) return out;
    const lo = Math.min(th0, th1), hi = Math.max(th0, th1);
    for (const b of this.beats) {
      // every b.theta + 2 pi k inside (lo, hi]
      for (let k = Math.ceil((lo - b.theta) / TAU); b.theta + k * TAU <= hi; k++) {
        const th = b.theta + k * TAU;
        if (th <= lo) continue;
        out.push({ beat: b, theta: th, frac: (th - th0) / (th1 - th0) });
      }
    }
    return out.sort((x, y) => x.frac - y.frac);
  }
}
