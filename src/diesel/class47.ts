// BR Class 47 in West Coast Railways maroon (spec: src/specs/class47.ts), exterior only, for the rear
// of the train. Body: one loft whose cross-section (flat sides, rounded roof) is cut down towards each
// end by the cab profile: near-vertical lower front, raked windscreens, roof dome. Maroon with a black
// roof, a thin gold line under the roof, a small yellow warning panel, "WEST COAST RAILWAYS" lettering
// (photos S64, S65); the running number is not modelled (S58's is unreadable).
// Node names used by the app:
//   dws_<0..5>   wheelsets (for rotation in Phase 6)
import * as THREE from 'three';
import { C47, c47BogieCentres } from '../specs/class47.ts';
import { Batch, DETAIL, boxMinMax, cylX, cylZ } from '../loco/geom.ts';
import type { MatKey } from '../loco/materials.ts';

type Mats = Record<MatKey, THREE.Material>;
const v = (k: keyof typeof C47) => C47[k].v;

/** Body cross-section at full height (closed ring, counter-clockwise seen from +Z): flat sides up to
 *  the cantrail, then a rounded roof (superellipse, flatter on top than a circle). */
function section(n: number): [number, number][] {
  const w = v('width') / 2, bot = v('bodyBottomH'), cant = v('cantrailH'), top = v('height');
  const roof: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const x = w * (1 - i / n); roof.push([x, cant + (top - cant) * Math.pow(1 - Math.pow(x / w, 2.6), 1 / 2.6)]); }
  return [[-w + 0.04, bot], [w - 0.04, bot], [w, bot + 0.12], ...roof, ...roof.slice(0, -1).reverse().map(([x, y]) => [-x, y] as [number, number]), [-w, bot + 0.12]];
}

/** Top of the cab profile at distance d from the body end (the body is cut down to it). */
function cabTop(d: number) {
  const f = v('cabFrontH'), wt = v('windscreenTopH'), rake = v('windscreenRake'), lip = 0.06, dome = 0.85, top = v('height') + 0.05;
  if (d <= lip) return f;
  if (d <= lip + rake) return f + ((d - lip) / rake) * (wt - f);
  const t = Math.min(1, (d - lip - rake) / dome);
  return wt + (top - wt) * Math.sqrt(1 - (1 - t) * (1 - t));
}
/** Slight plan taper of the cab corners near the end. */
const taper = (d: number) => 1 - 0.045 * Math.max(0, 1 - d / 0.5) ** 2;

/** Stations along the body: dense through each cab profile, none in the straight middle. */
function stations(L2: number) {
  const ds = [0, 0.03, 0.06, 0.14, 0.22, 0.3, 0.38, ...[...Array(Math.max(4, Math.round(10 * DETAIL)))].map((_, i, a) => 0.38 + (0.85 * (i + 1)) / a.length)];
  return [...ds.map((d) => L2 - d), ...ds.slice().reverse().map((d) => -L2 + d)];
}

/** Loft a polyline (x, y) along z, each point clamped under the cab profile and pushed out by lift.
 *  Faces are turned to point away from the body axis (x = 0, y = 1.8). */
function loft(pts: [number, number][], zs: number[], L2: number, closed: boolean, lift = 0, minTop = -Infinity) {
  const m = pts.length, pos: number[] = [], idx: number[] = [];
  for (const z of zs) { const d = L2 - Math.abs(z), h = cabTop(d), k = taper(d); for (const [x, y] of pts) pos.push(x * k * (1 + lift), Math.min(y, h) + lift, z); }
  const segs = closed ? m : m - 1;
  for (let i = 0; i < zs.length - 1; i++) {
    if (cabTop(L2 - Math.abs(zs[i])) < minTop || cabTop(L2 - Math.abs(zs[i + 1])) < minTop) continue;
    for (let j = 0; j < segs; j++) { const a = i * m + j, b = i * m + ((j + 1) % m); idx.push(a, a + m, b, b, a + m, b + m); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // test one face in the middle of the body and flip all if it points inwards
  const P = g.getAttribute('position'), N = g.getAttribute('normal'), t = Math.floor(zs.length / 2) * m + Math.floor(m / 2);
  if ((P.getX(t) * N.getX(t) + (P.getY(t) - 1.8) * N.getY(t)) < 0) { const ia = g.index!.array as Uint32Array; for (let q = 0; q < ia.length; q += 3) { const c = ia[q + 1]; ia[q + 1] = ia[q + 2]; ia[q + 2] = c; } g.computeVertexNormals(); }
  return g;
}

/** Flat polygon (x, y) at z, facing +Z (s = 1) or -Z (s = -1). */
function cap(pts: [number, number][], z: number, s: number) {
  const v2: THREE.Vector2[] = [];
  for (const [x, y] of pts) { const q = new THREE.Vector2(x, y); if (!v2.length || v2[v2.length - 1].distanceTo(q) > 1e-4) v2.push(q); }
  if (v2[0].distanceTo(v2[v2.length - 1]) < 1e-4) v2.pop();
  const ccw = THREE.ShapeUtils.isClockWise(v2) ? -1 : 1, pos: number[] = [];
  for (const t of THREE.ShapeUtils.triangulateShape(v2, [])) { const o = ccw * s > 0 ? t : [t[0], t[2], t[1]]; for (const i of o) pos.push(v2[i].x, v2[i].y, z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

function bodyLoft(L2: number) {
  const ring = section(Math.max(8, Math.round(18 * DETAIL))), zs = stations(L2);
  const body = loft(ring, zs, L2, true);
  const end = ring.map(([x, y]) => [x * taper(0), Math.min(y, cabTop(0))] as [number, number]);
  return { body, caps: [cap(end, L2, 1), cap(end, -L2, -1)] };
}

/** A flat quad on the raked windscreen at one end (s = +1 No. 1 end, -1 No. 2 end), pushed out by off. */
function onScreen(L2: number, s: number, x0: number, x1: number, y0: number, y1: number, off: number) {
  const f = v('cabFrontH'), wt = v('windscreenTopH'), rake = v('windscreenRake'), lip = 0.06;
  const zAt = (y: number) => s * (L2 - lip - ((y - f) / (wt - f)) * rake);
  const n = new THREE.Vector3(0, rake, s * (wt - f)).normalize().multiplyScalar(off);
  const P = (x: number, y: number) => [x * taper(lip + ((y - f) / (wt - f)) * rake) + n.x, y + n.y, zAt(y) + n.z];
  const q = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y0), P(x1, y1), P(x0, y1)];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(q.flat(), 3)); g.computeVertexNormals();
  if (g.getAttribute('normal').getZ(0) * s < 0) { g.setAttribute('position', new THREE.Float32BufferAttribute([q[0], q[2], q[1], q[3], q[5], q[4]].flat(), 3)); g.computeVertexNormals(); }
  return g;
}

/** Plane on a body side (s = +1 left, -1 right), centred at z, y. */
function sidePlane(s: number, w: number, z: number, y: number, len: number, h: number) {
  const g = new THREE.PlaneGeometry(len, h); g.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(s * w, y, z); return g;
}
/** Plane on an end (s = +1 No. 1 end, -1 No. 2 end), facing out. */
function endPlane(s: number, z: number, x: number, y: number, w: number, h: number) {
  const g = new THREE.PlaneGeometry(w, h); if (s < 0) g.rotateY(Math.PI); g.translate(x, y, s * z); return g;
}

/** Far levels of detail use few materials (each is a draw call): small parts take the underframe or body colour. */
function lodMats(m: Mats, detail: number): Mats {
  if (detail >= 1) return m;
  const map: Partial<Record<MatKey, MatKey>> = { steel: 'underframe', rubber: 'underframe', wheel: 'underframe', lining_gold: 'coach_maroon', lamp_lens: 'axle_yellow', spring_red: 'underframe' };
  if (detail < 0.4) Object.assign(map, { glass: 'underframe', decal_wcr47: 'coach_maroon' });
  const out = { ...m };
  for (const [k, to] of Object.entries(map)) out[k as MatKey] = m[to as MatKey];
  return out;
}

export function buildClass47(matsIn: Mats): THREE.Group {
  const mats = lodMats(matsIn, DETAIL);
  const G = new THREE.Group(); G.name = 'diesel47';
  const b = new Batch();
  const W = v('width') / 2, L2 = v('lengthOverBuffers') / 2 - v('bufferProjection'), bot = v('bodyBottomH'), cant = v('cantrailH');
  const f = v('cabFrontH'), wt = v('windscreenTopH'), near = DETAIL >= 1, mid = DETAIL >= 0.5;

  // ---- body: maroon sides; the roof (above the gold line) black
  const { body, caps } = bodyLoft(L2);
  b.add('coach_maroon', body, ...caps);
  // black roof: everything above the gold line, over the cab domes down to the windscreen tops
  const roofPts = section(Math.max(8, Math.round(18 * DETAIL))).filter(([, y]) => y >= cant - 0.001).sort((p, q) => q[0] - p[0]);
  b.add('roof_black', loft(roofPts, stations(L2), L2, false, 0.003, wt));
  // fan grille (No. 2 end) and roof panels
  b.add('underframe', boxMinMax(-0.75, v('height') - 0.005, -L2 + 2.4, 0.75, v('height') + 0.02, -L2 + 4.3));
  if (mid) for (let k = 0; k < 6; k++) b.add('steel', boxMinMax(-0.72, v('height') + 0.02, -L2 + 2.5 + k * 0.32, 0.72, v('height') + 0.03, -L2 + 2.52 + k * 0.32));

  for (const s of [1, -1] as const) {
    // gold line under the roof, full length between the cab corners
    b.add('lining_gold', boxMinMax(s * W, cant - 0.04, -L2 + 0.4, s * (W + 0.004), cant - 0.025, L2 - 0.4));
    // high-level louvres along both sides (engine room)
    if (mid) for (let z = -L2 + 2.4; z < L2 - 6.5; z += 0.26) b.add('underframe', boxMinMax(s * W, cant - 0.3, z, s * (W + 0.006), cant - 0.1, z + 0.16));
    // cab side windows, cab doors (outline and drop light), engine-room windows
    for (const e of [1, -1] as const) {
      const z0 = e * (L2 - 0.5), z1 = e * (L2 - 1.25), zd0 = e * (L2 - 1.32), zd1 = e * (L2 - 1.98);
      b.add('underframe', boxMinMax(s * W, 2.48, Math.min(z0, z1), s * (W + 0.006), 3.08, Math.max(z0, z1)));
      b.add('glass', boxMinMax(s * (W + 0.006), 2.5, Math.min(z0, z1) + 0.02, s * (W + 0.01), 3.06, Math.max(z0, z1) - 0.02));
      if (mid) for (const [ya, yb, za, zb] of [[bot + 0.15, 3.12, zd0, zd0], [bot + 0.15, 3.12, zd1, zd1], [3.12, 3.12, zd0, zd1]] as const) {
        b.add('underframe', boxMinMax(s * W, Math.min(ya, yb) - 0.01, Math.min(za, zb) - 0.012, s * (W + 0.004), Math.max(ya, yb) + 0.01, Math.max(za, zb) + 0.012));
      }
      b.add('underframe', boxMinMax(s * W, 2.55, Math.min(zd0, zd1) + 0.1, s * (W + 0.006), 3.0, Math.max(zd0, zd1) - 0.1));
      if (mid) b.add('steel', boxMinMax(s * (W + 0.01), 1.5, e * (L2 - 1.24) - 0.012, s * (W + 0.04), 2.6, e * (L2 - 1.24) + 0.012)); // grab rail
    }
    for (const zc of [-1.6, 2.2]) b.add('underframe', boxMinMax(s * W, 2.6, zc - 0.28, s * (W + 0.006), 3.0, zc + 0.28));
    // lettering, centred on the side
    b.add('decal_wcr47', sidePlane(s, W + 0.008, 0.6, 2.3, 1.9, 0.48));
    // solebar and skirt
    b.add('underframe', boxMinMax(s * (W - 0.06), bot - 0.16, -L2 + 0.1, s * (W - 0.02), bot, L2 - 0.1));
  }

  // ---- cab fronts: windscreens, yellow panel, lamps, buffer beam, buffers, coupling
  for (const s of [1, -1] as const) {
    for (const [x0, x1] of [[-W + 0.16, -0.06], [0.06, W - 0.16]]) {
      b.add('underframe', onScreen(L2, s, x0 - 0.04, x1 + 0.04, f + 0.05, wt - 0.05, 0.004));
      b.add('glass', onScreen(L2, s, x0, x1, f + 0.09, wt - 0.09, 0.012));
    }
    b.add('axle_yellow', endPlane(s, L2 + 0.004, 0, (v('yellowBottomH') + f - 0.02) / 2, 2 * W * taper(0) - 0.2, f - 0.02 - v('yellowBottomH')));
    // marker lights in the yellow panel, headlight below it
    for (const x of [-0.84, 0.84]) b.add(s > 0 ? 'lamp_lens' : 'spring_red', cylZ(0.065, 0.065, s * (L2 + 0.004), s * (L2 + 0.03), x, 1.98, 16));
    for (const x of [-0.42, 0.42]) b.add('lamp_lens', cylZ(0.06, 0.06, s * (L2 + 0.004), s * (L2 + 0.03), x, 2.05, 16));
    b.add('lamp_lens', cylZ(0.075, 0.075, s * (L2 + 0.004), s * (L2 + 0.04), 0.2, 1.52, 16));
    // buffer beam (black), buffers, hook and pipes
    b.add('underframe', boxMinMax(-W + 0.05, 0.82, s * L2, W - 0.05, bot, s * (L2 + 0.08)));
    for (const x of [-0.87, 0.87]) {
      b.add('underframe', cylZ(0.11, 0.11, s * (L2 + 0.08), s * (L2 + 0.3), x, 1.06, 16));
      b.add('steel', cylZ(0.075, 0.075, s * (L2 + 0.3), s * (L2 + 0.41), x, 1.06, 12));
      b.add('steel', cylZ(0.21, 0.21, s * (L2 + 0.41), s * (L2 + v('bufferProjection')), x, 1.06, 24));
    }
    b.add('steel', boxMinMax(-0.06, 0.95, s * (L2 + 0.08), 0.06, 1.12, s * (L2 + 0.38)));
    if (mid) for (const x of [-0.35, 0.35]) b.add('rubber', cylZ(0.035, 0.035, s * (L2 + 0.08), s * (L2 + 0.32), x, 0.92, 8));
  }

  // ---- underframe: fuel and water tanks between the bogies, battery boxes
  const bc = c47BogieCentres() / 2, bw = v('bogieWheelbase') / 2, r = v('wheelDia') / 2;
  b.add('underframe', boxMinMax(-1.0, 0.5, -bc + bw + 0.7, 1.0, bot - 0.16, bc - bw - 0.7));
  for (const s of [1, -1]) b.add('steel', boxMinMax(s * 1.0, 0.62, -1.2, s * 1.02, 0.66, 1.2));

  // ---- bogies (Co-Co): side frames, axleboxes, springs; wheelsets as their own nodes
  let k = 0;
  for (const zc of [bc, -bc]) {
    for (const s of [1, -1]) {
      b.add('underframe', boxMinMax(s * 0.98, r - 0.12, zc - bw - 0.45, s * 1.12, r + 0.32, zc + bw + 0.45));
      b.add('underframe', boxMinMax(s * 0.98, r + 0.32, zc - bw - 0.2, s * 1.12, r + 0.44, zc + bw + 0.2));
      for (const dz of [-bw, 0, bw]) {
        b.add('underframe', boxMinMax(s * 0.93, r - 0.16, zc + dz - 0.17, s * 1.16, r + 0.16, zc + dz + 0.17));
        if (mid) b.add('steel', cylZ(0.008, 0.008, zc + dz - 0.18, zc + dz + 0.18, s * 1.165, r + 0.05, 6));
      }
    }
    b.add('underframe', boxMinMax(-0.98, r + 0.2, zc - 0.3, 0.98, r + 0.4, zc + 0.3));   // bolster
    for (const dz of [-bw, 0, bw]) {
      const wb = near ? new Batch() : b, oy = near ? 0 : r, oz = near ? 0 : zc + dz;
      for (const s of [1, -1]) wb.add('wheel', cylX(r, 0.14, s * 0.7175, oy, oz, Math.max(12, Math.round(28 * DETAIL))), cylX(r + 0.03, 0.025, s * 0.66, oy, oz, Math.max(12, Math.round(28 * DETAIL))));
      wb.add('wheel', cylX(0.08, 1.6, 0, oy, oz, 10));
      if (near) { const g = new THREE.Group(); g.name = `dws_${k}`; for (const m of wb.build(g.name, mats)) g.add(m); g.position.set(0, r, zc + dz); G.add(g); }
      k++;
    }
  }
  for (const m of b.build('diesel47_static', mats)) G.add(m);
  return G;
}
