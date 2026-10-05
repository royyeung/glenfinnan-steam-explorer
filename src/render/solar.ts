// Solar position (NOAA general solar position algorithm, ~0.01 deg over 1800-2100).
// Returns degrees: elevation above the horizon (with a simple refraction term) and azimuth
// clockwise from true north.

const rad = Math.PI / 180, deg = 180 / Math.PI;

export interface SunPosition { elevation: number; azimuth: number; declination: number; eqTimeMin: number }

export function solarPosition(dateUTC: Date, latDeg: number, lonDeg: number): SunPosition {
  const jd = dateUTC.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
  const y = Math.tan((eps / 2) * rad) ** 2;
  const eqTime = 4 * deg * (y * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad)
    - 0.5 * y * y * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
  const minutes = dateUTC.getUTCHours() * 60 + dateUTC.getUTCMinutes() + dateUTC.getUTCSeconds() / 60;
  const tst = (((minutes + eqTime + 4 * lonDeg) % 1440) + 1440) % 1440;
  const ha = tst / 4 - 180;
  const lat = latDeg * rad;
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha * rad);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  let elev = 90 - zen * deg;
  // atmospheric refraction (Saemundsson-style approximation), negligible above ~10 deg
  if (elev > -0.575) elev += 1.02 / Math.tan((elev + 10.3 / (elev + 5.11)) * rad) / 60;
  const az = (Math.atan2(Math.sin(ha * rad), Math.cos(ha * rad) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) * deg + 180 + 360) % 360;
  return { elevation: elev, azimuth: az, declination: decl * deg, eqTimeMin: eqTime };
}

/** World direction towards the sun. World frame: +X east, -Z grid north, +Y up. */
export function sunDirection(elevDeg: number, azDeg: number): [number, number, number] {
  const el = elevDeg * rad, az = azDeg * rad;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

/** Glenfinnan Viaduct (REFERENCE S16). */
export const GLENFINNAN = { lat: 56.876285, lon: -5.431914 };

/** UK civil time to UTC for a given date (BST from last Sunday of March to last Sunday of October, 01:00 UTC). */
export function ukLocalToUTC(year: number, month: number, day: number, hourLocal: number): Date {
  const lastSunday = (m: number) => { const d = new Date(Date.UTC(year, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
  const bstStart = Date.UTC(year, 2, lastSunday(2), 1), bstEnd = Date.UTC(year, 9, lastSunday(9), 1);
  const guess = Date.UTC(year, month - 1, day) + hourLocal * 3600000;
  const bst = guess - 3600000 >= bstStart && guess - 3600000 < bstEnd;
  return new Date(guess - (bst ? 3600000 : 0));
}
