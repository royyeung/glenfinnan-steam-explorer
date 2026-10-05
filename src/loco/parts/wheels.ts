// Wheels and wheelsets. Driving wheels: 20 tapered spokes (counted on S33), crescent balance
// weight opposite the crank, crank boss; the driving wheelset also carries the return crank.
import * as THREE from 'three';
import { B5 } from '../../specs/black5.ts';
import { Batch, DETAIL, cylX, extrudeSide } from '../geom.ts';

const v = (k: keyof typeof B5) => B5[k].v;

export function arc(r: number, a0: number, a1: number, n: number): [number, number][] {
  const m = Math.max(4, Math.round(n * DETAIL)), pts: [number, number][] = [];
  for (let i = 0; i <= m; i++) { const a = a0 + (a1 - a0) * (i / m); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return pts;
}
const ring = (ro: number, ri: number, x0: number, x1: number, n = 56) =>
  extrudeSide(arc(ro, 0, Math.PI * 2, n), x0, x1, [arc(ri, Math.PI * 2, 0, n)]);

export interface WheelOpts { r: number; spokes: number; crank: number | null; outward: 1 | -1; x: number; balance?: number }

/** One wheel centred at (x, 0, 0) in wheelset space, in the (z, y) plane. */
export function wheel(b: Batch, o: WheelOpts) {
  const { r, x, outward } = o, tread = 0.14, flange = 0.03;
  const rimIn = r - 0.075, hubR = Math.max(0.12, r * 0.17), face = x + outward * tread / 2;
  // tyre with flange on the inside, bright tread
  b.add('steel', ring(r, r - 0.045, x - tread / 2, x + tread / 2));
  b.add('steel', ring(r + flange, r - 0.02, x - outward * (tread / 2) - 0.014, x - outward * (tread / 2) + 0.014));
  b.add('wheel', ring(r - 0.045, rimIn, x - tread / 2 + 0.012, x + tread / 2 - 0.012));
  b.add('wheel', cylX(hubR, tread + 0.06, x + outward * 0.02, 0, 0, 24));
  b.add('steel', cylX(0.085, 0.03, face + outward * 0.04, 0, 0, 16)); // axle end
  if (DETAIL < 0.4) { b.add('wheel', cylX(rimIn, 0.04, x, 0, 0, 24)); return; }
  // tapered spokes (elliptical section approximated by a tapered box), wider at the hub
  for (let i = 0; i < o.spokes; i++) {
    const a = (i / o.spokes) * Math.PI * 2 + Math.PI / o.spokes, L = rimIn - hubR + 0.02, mid = (rimIn + hubR) / 2;
    const g = new THREE.CylinderGeometry(0.022, 0.034, L, 6);
    g.scale(1, 1, 1.5);
    g.rotateX(Math.PI / 2 - a);
    g.translate(x + outward * 0.01, Math.sin(a) * mid, Math.cos(a) * mid);
    b.add('wheel', g);
  }
  if (o.crank !== null) {
    // balance weight: crescent filling the spokes opposite the crank
    const bw = Math.PI + o.crank, span = o.balance ?? 0.75, inner = hubR + 0.08;
    const pts = [...arc(rimIn - 0.005, bw - span, bw + span, 14), ...arc(inner + 0.12, bw + span * 0.8, bw - span * 0.8, 10)];
    b.add('wheel', extrudeSide(pts, x - 0.03, x + 0.03));
    // crank boss
    const cr = v('crankRadius');
    b.add('wheel', cylX(0.15, 0.1, x + outward * 0.05, Math.sin(o.crank) * cr, Math.cos(o.crank) * cr, 20));
  }
}

/** A complete wheelset (both wheels, axle, crankpins and, on the driving axle, the return cranks). */
export function wheelset(r: number, spokes: number, crankL: number | null, crankR: number | null, pinOut: number, returnCrank?: { throw: number; angle: number; lateral: number }) {
  const b = new Batch(), xt = v('wheelTreadOffset');
  wheel(b, { r, spokes, crank: crankL, outward: 1, x: xt });
  wheel(b, { r, spokes, crank: crankR, outward: -1, x: -xt });
  b.add('steel', cylX(0.1, 2 * xt + 0.2, 0, 0, 0, 16));
  const cr = v('crankRadius');
  for (const [phi, s] of [[crankL, 1], [crankR, -1]] as const) {
    if (phi === null || pinOut <= 0) continue;
    const cy = Math.sin(phi) * cr, cz = Math.cos(phi) * cr, x0 = xt + 0.09;
    b.add('steel', cylX(0.07, pinOut - x0, s * (x0 + pinOut) / 2, cy, cz, 16));
    b.add('steel', cylX(0.09, 0.03, s * (pinOut + 0.015), cy, cz, 16)); // pin collar
    if (returnCrank) {
      // return crank: arm from the crankpin end to a pin on a circle of radius `throw` about the axle
      const pa = phi + returnCrank.angle, ry = Math.sin(pa) * returnCrank.throw, rz = Math.cos(pa) * returnCrank.throw;
      const from = new THREE.Vector3(s * (pinOut + 0.02), cy, cz), to = new THREE.Vector3(s * returnCrank.lateral, ry, rz);
      const dir = new THREE.Vector3().subVectors(to, from), L = dir.length();
      const arm = new THREE.BoxGeometry(0.05, 0.1, L);
      arm.lookAt(dir); arm.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
      b.add('steel', arm);
      b.add('steel', cylX(0.06, 0.08, s * returnCrank.lateral, ry, rz, 14));
    }
  }
  return b;
}
