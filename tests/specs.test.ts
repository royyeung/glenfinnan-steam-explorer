import { describe, expect, it } from 'vitest';
import { B5, engineAxlesD, tenderAxlesD } from '../src/specs/black5.ts';
import { ft } from '../src/specs/spec.ts';

describe('spec tables', () => {
  it('every spec has a source and a confidence', () => {
    for (const [k, s] of Object.entries(B5)) { expect(s.src, k).toBeTruthy(); expect(['high', 'medium', 'low', 'estimate']).toContain(s.conf); }
  });
  it('engine wheelbase chain totals 27 ft 2 in and agrees with the photo (rear coupled axle at 9.79 m, ±0.10)', () => {
    const a = engineAxlesD();
    expect(a.trail - a.bogieFront).toBeCloseTo(ft(27, 2), 6);
    expect(Math.abs(a.trail - 9.79)).toBeLessThan(0.1);
    expect(Math.abs(a.drive - 7.34)).toBeLessThan(0.1);
  });
  it('photo scale cross-check: published height and overall length agree within 0.5 %', () => {
    const pxPerM = 4558 / B5.lengthOverBuffers.v, heightFromPhoto = 906 / pxPerM;
    expect(Math.abs(heightFromPhoto - B5.height.v) / B5.height.v).toBeLessThan(0.005);
  });
  it('tender axles sit inside the tender body', () => {
    for (const d of tenderAxlesD()) { expect(d).toBeGreaterThan(B5.tenderFrontD.v); expect(d).toBeLessThan(B5.tenderBodyRearD.v); }
  });
});
