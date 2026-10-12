import { describe, expect, it } from 'vitest';
import { coachLayout } from '../src/coach/mk2.ts';
import { FORMATION, MK2 } from '../src/specs/mk2.ts';

const TYPES = ['tso2', 'tso2b', 'fo2', 'buffet1'] as const;

describe('coach layouts', () => {
  for (const t of TYPES) {
    const lay = coachLayout(t);
    const doorSpans = Object.values(lay.doors).map((a) => [a - lay.doorWidth / 2, a + lay.doorWidth / 2]);
    const winSpans = lay.bays.map((a) => [a - lay.winW / 2, a + lay.winW / 2]);
    it(`${t}: windows and doors lie inside the body and never overlap`, () => {
      for (const [a0, a1] of [...doorSpans, ...winSpans]) { expect(a0).toBeGreaterThan(0.05); expect(a1).toBeLessThan(lay.L - 0.05); }
      const all = [...doorSpans, ...winSpans].sort((p, q) => p[0] - q[0]);
      for (let i = 1; i < all.length; i++) expect(all[i][0]).toBeGreaterThan(all[i - 1][1] + 0.05);
    });
    it(`${t}: number and lettering sit on a plain panel (not over a door or window)`, () => {
      for (const a of [lay.numA, lay.wcA]) for (const [a0, a1] of doorSpans) expect(a < a0 - 0.25 || a > a1 + 0.25).toBe(true);
    });
  }
  it('Mk2B has no centre door and eight bays; the Mk2 and Mk1 TSO have three doors', () => {
    expect(Object.keys(coachLayout('tso2b').doors)).toEqual(['A', 'B']);
    expect(coachLayout('tso2b').bays.length).toBe(8);
    expect(Object.keys(coachLayout('tso2').doors)).toEqual(['A', 'C', 'B']);
    expect(Object.keys(coachLayout('buffet1').doors)).toEqual(['A', 'C', 'B']);
  });
  it('the buffet takes two bays at the B end; the first-class coach has no buffet', () => {
    const b = coachLayout('buffet1').buffet!;
    expect(b[1] - b[0]).toBeCloseTo(2 * MK2.bayPitch.v, 6);
    expect(coachLayout('fo2').buffet).toBeNull();
  });
  it('formation: six coaches, distinct numbers and letters, first class A and B', () => {
    expect(FORMATION.length).toBe(6);
    expect(new Set(FORMATION.map((f) => f.num)).size).toBe(6);
    expect(new Set(FORMATION.map((f) => f.letter)).size).toBe(6);
    expect(FORMATION.filter((f) => f.type === 'fo2').map((f) => f.letter).sort()).toEqual(['A', 'B']);
  });
});
