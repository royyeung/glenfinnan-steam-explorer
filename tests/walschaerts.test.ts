import { describe, expect, it } from 'vitest';
import { motionGeometry, valveGearGeometry } from '../src/loco/layout.ts';
import { solveMotion } from '../src/loco/motion/solver.ts';
import { solveValveGear, valveGearLengths } from '../src/loco/motion/walschaerts.ts';

const m = motionGeometry(), g = valveGearGeometry();
const rcLen = Math.sqrt(m.crankRadius ** 2 + g.returnCrankThrow ** 2 - 2 * m.crankRadius * g.returnCrankThrow * Math.cos(g.returnCrankAngle));
const rev = (n = 720) => Array.from({ length: n + 1 }, (_, i) => (i / n) * Math.PI * 2);
const run = (cutoff: number, side: 'left' | 'right' = 'left') => rev().map((th) => {
  const sd = solveMotion(m, th)[side];
  const st = solveValveGear(g, m.drive, sd, cutoff);
  return { th, sd, st, l: valveGearLengths(g, m.drive, sd, st) };
});

describe('Walschaerts valve gear over a full revolution', () => {
  for (const cutoff of [1, 0.75, 0.5, 0.25, 0, -0.5, -1]) {
    it(`every link keeps its length at cut-off ${cutoff} (both sides)`, () => {
      for (const side of ['left', 'right'] as const) {
        for (const { l } of run(cutoff, side)) {
          expect(Math.abs(l.eccentricity - g.returnCrankThrow)).toBeLessThan(1e-9);
          expect(Math.abs(l.returnCrank - rcLen)).toBeLessThan(1e-9);
          expect(Math.abs(l.eccentricRod - g.eccentricRod)).toBeLessThan(1e-9);
          expect(Math.abs(l.linkFoot - g.footOffset)).toBeLessThan(1e-9);
          expect(Math.abs(l.radiusRod - g.radiusRod)).toBeLessThan(1e-9);
          expect(Math.abs(l.unionLink - g.unionLink)).toBeLessThan(1e-9);
          expect(Math.abs(l.leverTop - g.leverTopToValve)).toBeLessThan(1e-9);
          expect(Math.abs(l.leverBottom - g.leverValveToBottom)).toBeLessThan(1e-9);
          expect(Math.abs(l.crossheadArm - g.crossheadArm)).toBeLessThan(1e-9);
          expect(Math.abs(l.liftArm - g.liftArm)).toBeLessThan(1e-9);
          expect(Math.abs(l.liftLink - g.liftLink)).toBeLessThan(1e-6);
          expect(l.valveOffLine).toBeLessThan(1e-9);
          expect(l.leverBend).toBeLessThan(1e-9);
        }
      }
    });
  }
  it('the lifting-link pin stays inside a realistic slot and die slip stays small', () => {
    for (const c of [1, 0, -1]) for (const { st } of run(c)) {
      expect(Math.abs(st.liftSlotOffset - g.liftSlotNominal)).toBeLessThan(0.18); // slot length is an estimate
      expect(Math.abs(st.dieSlip)).toBeLessThan(0.04);
    }
  });
  it('valve travel shrinks towards mid gear; mid gear still moves the valve by lap + lead', () => {
    const travel = (c: number) => { const s = run(c).map((r) => r.st.valveTravel); return Math.max(...s) - Math.min(...s); };
    const full = travel(1), half = travel(0.5), mid = travel(0);
    expect(full).toBeGreaterThan(half); expect(half).toBeGreaterThan(mid); expect(mid).toBeGreaterThan(0.03);
    expect(full).toBeGreaterThan(0.12); expect(full).toBeLessThan(0.22); // plausible 5-8.5 in travel
    expect(Math.abs(travel(-1) - full) / full).toBeLessThan(0.15);    // fore and back gear roughly symmetric
  });
  it('reversing swaps the valve phase (forward vs backward gear)', () => {
    const atQuarter = (c: number) => run(c).find((r) => Math.abs(r.th - Math.PI / 2) < 1e-9)!.st.valveTravel - run(0).find((r) => Math.abs(r.th - Math.PI / 2) < 1e-9)!.st.valveTravel;
    expect(Math.sign(atQuarter(1))).toBe(-Math.sign(atQuarter(-1)));
  });
});
