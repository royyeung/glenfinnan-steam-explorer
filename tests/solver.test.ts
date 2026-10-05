import { describe, expect, it } from 'vitest';
import { motionGeometry } from '../src/loco/layout.ts';
import { rodLengths, solveMotion } from '../src/loco/motion/solver.ts';
import { B5 } from '../src/specs/black5.ts';

const g = motionGeometry();
const revolution = (steps = 720) => Array.from({ length: steps + 1 }, (_, i) => (i / steps) * Math.PI * 2);

describe('coupled wheels and rods over one full revolution', () => {
  const base = rodLengths(solveMotion(g, 0).left);
  it('coupling and connecting rods keep constant length (< 1 µm) on both sides', () => {
    for (const th of revolution()) {
      const st = solveMotion(g, th);
      for (const side of [st.left, st.right]) {
        const l = rodLengths(side);
        expect(Math.abs(l.couplingFront - base.couplingFront)).toBeLessThan(1e-6);
        expect(Math.abs(l.couplingRear - base.couplingRear)).toBeLessThan(1e-6);
        expect(Math.abs(l.conRod - B5.conRodLength.v)).toBeLessThan(1e-6);
      }
    }
  });
  it('coupling rod lengths equal the axle spacings', () => {
    expect(base.couplingFront).toBeCloseTo(B5.coupledLeadToDriving.v, 9);
    expect(base.couplingRear).toBeCloseTo(B5.coupledDrivingToTrailing.v, 9);
  });
  it('crankpins stay on their crank circles', () => {
    for (const th of revolution(97)) {
      const p = solveMotion(g, th).left.pins.drive;
      expect(Math.hypot(p[0] - g.drive[0], p[1] - g.drive[1])).toBeCloseTo(B5.crankRadius.v, 9);
    }
  });
  it('crosshead stays on the line of stroke and the piston travels exactly one stroke', () => {
    const w = [g.cylinderCentre[0] - g.drive[0], g.cylinderCentre[1] - g.drive[1]], l = Math.hypot(w[0], w[1]);
    let min = Infinity, max = -Infinity;
    for (const th of revolution()) {
      const st = solveMotion(g, th).left, x = st.crosshead;
      const cross = ((x[0] - g.drive[0]) * w[1] - (x[1] - g.drive[1]) * w[0]) / l;
      expect(Math.abs(cross)).toBeLessThan(1e-9);
      const along = ((st.piston[0] - g.drive[0]) * w[0] + (st.piston[1] - g.drive[1]) * w[1]) / l;
      min = Math.min(min, along); max = Math.max(max, along);
    }
    expect(max - min).toBeCloseTo(B5.stroke.v, 6);
  });
  it('the two sides are quartered at 90 degrees', () => {
    for (const th of revolution(31)) {
      const st = solveMotion(g, th);
      const d = ((st.right.phi - st.left.phi) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      expect(Math.min(Math.abs(d - Math.PI / 2), Math.abs(d - 1.5 * Math.PI))).toBeLessThan(1e-12);
    }
  });
  it('forward travel turns the wheel the right way (top of the wheel moves forward)', () => {
    const a = solveMotion(g, 0).left.pins.drive, b = solveMotion(g, Math.PI / 2).left.pins.drive; // pin starts at front (phi=0)
    expect(b[1]).toBeLessThan(a[1]); // a quarter turn forward takes the front pin down to the bottom
  });
  it('no rod passes through the slidebar zone: crosshead never comes closer than 0.3 m to the driving crankpin path', () => {
    for (const th of revolution(360)) {
      const st = solveMotion(g, th).left;
      expect(Math.hypot(st.crosshead[0] - g.drive[0], st.crosshead[1] - g.drive[1])).toBeGreaterThan(B5.crankRadius.v + 0.3);
    }
  });
});
