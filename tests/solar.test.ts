import { describe, expect, it } from 'vitest';
import { GLENFINNAN, solarPosition, ukLocalToUTC } from '../src/render/solar.ts';

describe('solar position (NOAA)', () => {
  it('London, 2026-06-21 12:00 UTC: about 61.9 deg high, close to due south', () => {
    const p = solarPosition(new Date(Date.UTC(2026, 5, 21, 12, 0)), 51.5074, -0.1278);
    expect(p.elevation).toBeGreaterThan(61.5); expect(p.elevation).toBeLessThan(62.2);
    expect(p.azimuth).toBeGreaterThan(176); expect(p.azimuth).toBeLessThan(181);
  });
  it('Glenfinnan: highest sun at the June solstice is 56.6 deg (90 - 56.876 + 23.44)', () => {
    let best = -90;
    for (let m = 0; m < 24 * 60; m += 2) best = Math.max(best, solarPosition(new Date(Date.UTC(2026, 5, 21, 0, m)), GLENFINNAN.lat, GLENFINNAN.lon).elevation);
    expect(best).toBeGreaterThan(56.4); expect(best).toBeLessThan(56.8);
  });
  it('Glenfinnan: winter solstice noon sun about 9.7 deg (plus refraction)', () => {
    let best = -90;
    for (let m = 0; m < 24 * 60; m += 2) best = Math.max(best, solarPosition(new Date(Date.UTC(2026, 11, 21, 0, m)), GLENFINNAN.lat, GLENFINNAN.lon).elevation);
    expect(best).toBeGreaterThan(9.5); expect(best).toBeLessThan(10.1);
  });
  it('UK local time handles BST', () => {
    expect(ukLocalToUTC(2026, 8, 24, 11).toISOString()).toBe('2026-08-24T10:00:00.000Z');
    expect(ukLocalToUTC(2026, 12, 1, 11).toISOString()).toBe('2026-12-01T11:00:00.000Z');
  });
});
