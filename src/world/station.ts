// Glenfinnan station (Geograph photos 2011-2024, S68; OS OpenMap "Multi Track" for the loop, S56):
// two platforms either side of a passing loop. Platform 1 (south, beside the line the train stands on)
// carries the James Miller "chalet" building (cream, green trim, hipped slate roof with a canopy over
// the platform, chimney) and, at its east end, the two-storey signal box with outside stairs; platform 2
// (north, beside the loop) has a small timber shelter. Tarmac platforms with a yellow line, lamp posts,
// barrow crossings at both ends. Positions come from Geograph camera and subject grid references
// (10 m precision); sizes are estimated from the photos. The loop track leaves and rejoins the line
// with an S-curve (switches and crossings are not modelled).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { B5 } from '../specs/black5.ts';
import { SITE } from './site.ts';
import type { TrackPath, WorldData } from './data.ts';
import { sweep } from './track.ts';

/** World-frame points from Geograph grid references (x = E - 191000, z = 781300 - N). */
export const STATION_GEO = {
  loopW: [-1211, 254] as [number, number], loopE: [-1003, 364] as [number, number],     // OS "Multi Track" ends
  platW: [-1176, 297] as [number, number], platE: [-1094, 347] as [number, number],     // platform ends (photos 4203915, 4203898)
  building: [-1130, 330] as [number, number],                                         // NM 8987 8097
  signalBox: [-1102, 342] as [number, number],                                        // NM 8990 8096
  museumCoaches: [-1129, 343] as [number, number],                                    // OS footprint of the two museum carriages
};
export const LOOP_SPACING = 3.4;   // track centres (six-foot of about 2 m; estimate)

const nonIdx = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; if (!n.getAttribute('normal')) n.computeVertexNormals(); for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k); return n; };

/** Lateral offset of the loop track from the line at arc length s (0 outside the loop). */
export function loopOffset(s: number, sL0: number, sL1: number, ramp = 45) {
  const t = Math.min(THREE.MathUtils.smoothstep(s, sL0, sL0 + ramp), 1 - THREE.MathUtils.smoothstep(s, sL1 - ramp, sL1));
  return LOOP_SPACING * Math.max(0, t);
}

/** Sweep a section along the path with a varying lateral offset. */
function sweepOffset(path: TrackPath, s0: number, s1: number, step: number, section: [number, number][], off: (s: number) => number, closed = false) {
  const n = Math.max(1, Math.ceil((s1 - s0) / step)), m = section.length, pos: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), S = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n, o = off(s); path.at(s, P); path.side(s, S);
    for (const [u, v] of section) pos.push(P.x + S.x * (u + o), P.y + v, P.z + S.z * (u + o));
  }
  const segs = closed ? m : m - 1;
  for (let i = 0; i < n; i++) for (let k = 0; k < segs; k++) { const k1 = (k + 1) % m, a = i * m + k, b = a + m, c = i * m + k1, d = c + m; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Place a local geometry (z = lateral u, y up, x along the track; right-handed, so x points west)
 *  at arc length s, offset u, height y. */
function placeAt(path: TrackPath, g: THREE.BufferGeometry, s: number, u: number, y: number) {
  const P = path.at(s), S = path.side(s), up = new THREE.Vector3(0, 1, 0), z = new THREE.Vector3(S.x, 0, S.z).normalize();
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, z), up, z);
  m.setPosition(P.x + S.x * u, y, P.z + S.z * u);
  return g.applyMatrix4(m);
}
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** Hipped roof over the rectangle x0..x1, z0..z1 (eaves at ye), ridge along x at yr; the z1 side may
 *  overhang further (a canopy) with its eaves lower. */
function hippedRoof(x0: number, x1: number, z0: number, z1: number, ye: number, yr: number, zc = (z0 + z1) / 2, ye1 = ye) {
  const hx = Math.min((x1 - x0) / 2 - 0.2, (z1 - z0) / 2), r0 = x0 + hx, r1 = x1 - hx;
  const A = [x0, ye, z0], B = [x1, ye, z0], C = [x1, ye1, z1], D = [x0, ye1, z1], R0 = [r0, yr, zc], R1 = [r1, yr, zc];
  const tri = [A, R0, B, B, R0, R1, C, R1, D, D, R1, R0, A, D, R0, B, R1, C].flat();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); g.computeVertexNormals();
  // faces must point up
  const p = g.getAttribute('position').array as Float32Array, n = g.getAttribute('normal');
  for (let t = 0; t < p.length / 9; t++) if (n.getY(t * 3) < 0) for (let c = 0; c < 3; c++) { const q = p[t * 9 + 3 + c]; p[t * 9 + 3 + c] = p[t * 9 + 6 + c]; p[t * 9 + 6 + c] = q; }
  g.computeVertexNormals();
  return g;
}

function signCanvas(lines: [string, number][], w: number, h: number, bg: string, fg: string) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let y = h / (lines.length + 1);
  for (const [t, px] of lines) { g.font = `600 ${px}px "Gill Sans", Calibri, "Segoe UI", sans-serif`; g.fillText(t, w / 2, y); y += h / (lines.length + 1); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}

export function buildStation(data: WorldData) {
  const path = data.track, G = new THREE.Group(); G.name = 'station';
  const colliders: THREE.Object3D[] = [];
  const near = (p: [number, number]) => path.nearest(p[0], p[1]);
  const sL0 = near(STATION_GEO.loopW), sL1 = near(STATION_GEO.loopE), sP0 = near(STATION_GEO.platW), sP1 = near(STATION_GEO.platE);
  const off = (s: number) => loopOffset(s, sL0, sL1);
  const half = B5.gauge.v / 2, edge = half + SITE.platformOffset.v, top = SITE.platformHeight.v, rh = SITE.railHeight.v;

  const mat = {
    cream: new THREE.MeshStandardMaterial({ name: 'stn_cream', color: 0xe6dcb4, roughness: 0.85 }),
    green: new THREE.MeshStandardMaterial({ name: 'stn_green', color: 0x2f5a3c, roughness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ name: 'stn_white', color: 0xf0efe8, roughness: 0.6 }),
    slate: new THREE.MeshStandardMaterial({ name: 'stn_slate', color: 0x50565c, roughness: 0.55, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ name: 'stn_glass', color: 0x1d2328, roughness: 0.08, metalness: 0.3 }),
    tarmac: new THREE.MeshStandardMaterial({ name: 'stn_tarmac', color: 0x5d5c5a, roughness: 0.95, side: THREE.DoubleSide }),
    concrete: new THREE.MeshStandardMaterial({ name: 'stn_concrete', color: 0xa9a59c, roughness: 0.9, side: THREE.DoubleSide }),
    yellow: new THREE.MeshStandardMaterial({ name: 'stn_yellow', color: 0xd8c24a, roughness: 0.7, side: THREE.DoubleSide }),
    timber: new THREE.MeshStandardMaterial({ name: 'stn_timber', color: 0x6a5a48, roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ name: 'stn_steel', color: 0x3a3d40, roughness: 0.5, metalness: 0.6 }),
    rail: new THREE.MeshStandardMaterial({ name: 'rail', color: 0x6f5a4c, roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide }),
    sleeper: new THREE.MeshStandardMaterial({ name: 'sleeper', color: 0x5f5c57, roughness: 0.92 }),
    ballast: new THREE.MeshStandardMaterial({ name: 'stn_ballast', color: 0x8c857b, roughness: 1, side: THREE.DoubleSide }),
  };
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const add = (m: THREE.Material, ...gs: THREE.BufferGeometry[]) => { const l = parts.get(m) ?? []; l.push(...gs); parts.set(m, l); };

  // ---- loop track: ballast, two rails, sleepers
  const bl: [number, number][] = [[1.95, -rh - 0.2], [-1.95, -rh - 0.2]];
  add(mat.ballast, sweepOffset(path, sL0, sL1, 3, [[3.0, -0.8], ...bl, [-1.2, -0.6]], off));
  for (const sg of [1, -1]) {
    const x = sg * (half + 0.035);
    add(mat.rail, sweepOffset(path, sL0, sL1, 2, [[x - 0.07, -rh], [x + 0.07, -rh], [x + 0.035, -0.012], [x + 0.03, 0], [x - 0.03, 0], [x - 0.035, -0.012]], off, true));
  }
  const nS = Math.floor((sL1 - sL0) / SITE.sleeperSpacing.v), sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.2, 0.26), mat.sleeper, nS);
  const P = new THREE.Vector3(), S = new THREE.Vector3(), T = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  for (let i = 0; i < nS; i++) {
    const s = sL0 + 0.3 + i * SITE.sleeperSpacing.v, o = off(s); path.at(s, P); path.side(s, S); path.tangent(s, T);
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), T);
    m4.compose(new THREE.Vector3(P.x + S.x * o, P.y - rh - 0.112, P.z + S.z * o), q, new THREE.Vector3(1, 1, 1)); sleepers.setMatrixAt(i, m4);
  }
  sleepers.computeBoundingSphere(); sleepers.name = 'loop_sleepers'; sleepers.receiveShadow = true; G.add(sleepers);

  // ---- platforms: platform 1 south of the line, platform 2 north of the loop (only where the loop is
  // fully apart); concrete faces, tarmac tops, the yellow line
  const p1: [number, number] = [-edge, -(edge + 4.8)], p2off = (s: number) => off(s) + edge;
  const sect = (u0: number, u1: number): [number, number][] => [[u0, top], [u1, top], [u1, -1.5], [u0, -1.5]];
  const p2s0 = Math.max(sP0, sL0 + 45), p2s1 = Math.min(sP1, sL1 - 45);
  add(mat.concrete, sweep(path, sP0, sP1, 2, sect(p1[0], p1[1]), 2, true), sweepOffset(path, p2s0, p2s1, 2, sect(0, 3.6), p2off, true));
  add(mat.tarmac, sweep(path, sP0, sP1, 2, [[p1[0] - 0.6, top + 0.01], [p1[1], top + 0.01]], 2), sweepOffset(path, p2s0, p2s1, 2, [[3.6, top + 0.01], [0.6, top + 0.01]], p2off));
  add(mat.concrete, sweep(path, sP0, sP1, 2, [[p1[0], top + 0.012], [p1[0] - 0.6, top + 0.012]], 2), sweepOffset(path, p2s0, p2s1, 2, [[0.6, top + 0.012], [0, top + 0.012]], p2off));
  add(mat.yellow, sweep(path, sP0, sP1, 2, [[p1[0] - 0.62, top + 0.015], [p1[0] - 0.72, top + 0.015]], 2), sweepOffset(path, p2s0, p2s1, 2, [[0.72, top + 0.015], [0.62, top + 0.015]], p2off));

  // ---- barrow crossings at both platform ends: timber boards across both tracks
  for (const s of [sP0 - 2, sP1 + 2]) {
    const o = off(s), y = path.at(s).y - 0.03;
    for (const [u0, u1] of [[-2.0, -half + 0.08], [-half + 0.08, half - 0.08], [half + 0.08, o - half - 0.08], [o - half + 0.08, o + half - 0.08], [o + half + 0.08, o + 2.0]]) if (u1 > u0) add(mat.timber, placeAt(path, box(-0.8, -0.1, u0, 0.8, 0, u1), s, 0, y));
  }

  // ---- the station building on platform 1 (James Miller chalet style)
  const sB = near(STATION_GEO.building), yB = path.at(sB).y + top, uBack = p1[1];
  const L = 15, D = 5.6, H = 3.2;               // estimated from photos 3237623, 4203905
  const bld: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [], win: THREE.BufferGeometry[] = [], wht: THREE.BufferGeometry[] = [];
  bld.push(box(-L / 2, -1.6, -D, L / 2, H, 0));                             // walls (z: 0 = front, towards the platform)
  trim.push(box(-L / 2 - 0.02, -0.02, -D - 0.02, L / 2 + 0.02, 0.45, 0.02)); // green base
  for (let k = 0; k < 6; k++) {
    const x = -L / 2 + 1.4 + k * ((L - 2.8) / 5);
    if (k === 2) { trim.push(box(x - 0.55, 0, 0.0, x + 0.55, 2.3, 0.04)); continue; }      // double door
    win.push(box(x - 0.5, 0.95, 0.0, x + 0.5, 2.35, 0.03)); wht.push(box(x - 0.56, 0.9, -0.01, x + 0.56, 2.41, 0.02), box(x - 0.03, 0.95, 0.03, x + 0.03, 2.35, 0.05), box(x - 0.5, 1.62, 0.03, x + 0.5, 1.67, 0.05));
  }
  for (const sx of [-1, 1]) win.push(box(sx > 0 ? L / 2 : -L / 2 - 0.03, 0.95, -D / 2 - 0.5, sx > 0 ? L / 2 + 0.03 : -L / 2, 2.35, -D / 2 + 0.5));   // end windows
  const roof = hippedRoof(-L / 2 - 0.5, L / 2 + 0.5, -D - 0.5, 2.6, H, H + 2.2, -D / 2 + 0.4, H - 0.35);   // canopy 2.6 m over the platform
  const chimney = [box(L / 2 - 2.2, H + 1.2, -D / 2 - 0.5, L / 2 - 1.4, H + 3.0, -D / 2 + 0.3), box(L / 2 - 2.0, H + 3.0, -D / 2 - 0.25, L / 2 - 1.85, H + 3.35, -D / 2 - 0.1), box(L / 2 - 1.75, H + 3.0, -D / 2 - 0.25, L / 2 - 1.6, H + 3.35, -D / 2 - 0.1)];
  for (let k = 0; k < 5; k++) { const x = -L / 2 + 0.8 + k * ((L - 1.6) / 4); trim.push(box(x - 0.06, H - 1.0, 0, x + 0.06, H - 0.32, 1.9)); }   // canopy brackets
  const place = (g: THREE.BufferGeometry) => placeAt(path, g.clone(), sB, uBack, yB);
  add(mat.cream, ...bld.map(place), ...chimney.map(place)); add(mat.green, ...trim.map(place)); add(mat.glass, ...win.map(place)); add(mat.white, ...wht.map(place)); add(mat.slate, place(roof));

  // ---- signal box at the east end of platform 1: lower storey, glazed upper storey, stairs, nameboard
  const sSB = near(STATION_GEO.signalBox), ySB = path.at(sSB).y, uSB = p1[1] - 0.5;
  const sb: THREE.BufferGeometry[] = [box(-2.2, -1.0, -3.6, 2.2, 2.4, 0)], sbg: THREE.BufferGeometry[] = [box(-2.25, -1.0, -3.65, 2.25, 0.5, 0.05), box(-2.3, 2.4, -3.7, 2.3, 2.55, 0.1)];
  const sbw: THREE.BufferGeometry[] = [box(-2.2, 2.55, -3.6, 2.2, 4.5, 0)], sbglass: THREE.BufferGeometry[] = [box(-2.0, 2.9, 0.0, 2.0, 4.25, 0.04), box(-2.24, 2.9, -3.3, -2.2, 4.25, -0.3), box(2.2, 2.9, -3.3, 2.24, 4.25, -0.3)];
  for (let k = 0; k < 7; k++) sbg.push(box(-2.0 + k * (4 / 6) - 0.04, 2.9, 0.04, -2.0 + k * (4 / 6) + 0.04, 4.25, 0.07));
  const sbroof = hippedRoof(-2.7, 2.7, -4.1, 0.5, 4.5, 5.7);
  const stairs: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 12; k++) stairs.push(box(2.3 + k * 0.24, -0.9 + k * 0.22, -1.3, 2.54 + k * 0.24, -0.86 + k * 0.22, -0.3));
  stairs.push(box(2.3, 2.3, -1.5, 3.2, 2.4, -0.2));
  const sbPlace = (g: THREE.BufferGeometry) => placeAt(path, g.clone(), sSB, uSB, ySB + top);
  add(mat.cream, ...sb.map(sbPlace), ...sbw.map(sbPlace)); add(mat.green, ...sbg.map(sbPlace), ...stairs.map(sbPlace)); add(mat.glass, ...sbglass.map(sbPlace)); add(mat.slate, sbPlace(sbroof));
  const nb = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.42), new THREE.MeshStandardMaterial({ name: 'stn_nameboard', map: signCanvas([['GLENFINNAN', 120]], 1024, 150, '#e9e3cc', '#1d1d1d'), roughness: 0.6 }));
  nb.geometry.translate(0, 2.68, 0.12); placeAt(path, nb.geometry, sSB, uSB, ySB + top); nb.name = 'signalbox_nameboard'; G.add(nb);

  // ---- shelter on platform 2
  const sSh = (p2s0 + p2s1) / 2, ySh = path.at(sSh).y + top;
  const sh: THREE.BufferGeometry[] = [box(-2.4, 0, 2.2, 2.4, 2.5, 2.4), box(-2.4, 0, 0.6, -2.2, 2.5, 2.4), box(2.2, 0, 0.6, 2.4, 2.5, 2.4)];
  const shg = [box(-2.45, 0, 0.55, 2.45, 0.35, 2.45)], shr = hippedRoof(-2.8, 2.8, 0.2, 2.8, 2.5, 3.3);
  const shPlace = (g: THREE.BufferGeometry) => placeAt(path, g.clone(), sSh, off(sSh) + edge + 0.4, ySh);
  add(mat.cream, ...sh.map(shPlace)); add(mat.green, ...shg.map(shPlace)); add(mat.slate, shPlace(shr));

  // ---- lamp posts on both platforms, station name signs
  for (let s = sP0 + 8; s < sP1 - 4; s += 22) {
    for (const [u, y0] of [[p1[0] - 3.2, top], [off(s) + edge + 2.6, top]] as const) {
      if (u > 0 && (s < p2s0 || s > p2s1)) continue;
      const yb = path.at(s).y + y0;
      add(mat.steel, placeAt(path, new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8).translate(0, 2.1, 0), s, u, yb), placeAt(path, box(-0.05, 4.1, -0.05, 0.05, 4.15, 0.6), s, u, yb), placeAt(path, box(-0.18, 3.85, 0.45, 0.18, 4.12, 0.85), s, u, yb));
    }
  }
  const signTex = signCanvas([['Glenfinnan', 120], ['Gleann Fhionnainn', 70]], 1024, 300, '#1f3557', '#ffffff');
  const boards: THREE.BufferGeometry[] = [];
  for (const [s, u] of [[sP0 + 20, p1[0] - 3.8], [sP1 - 20, p1[0] - 3.8], [(p2s0 + p2s1) / 2 + 12, 0]] as const) {
    const uu = u === 0 ? off(s) + edge + 3.0 : u, yb = path.at(s).y + top;
    boards.push(placeAt(path, new THREE.PlaneGeometry(2.2, 0.64).translate(0, 2.3, 0), s, uu, yb));
    for (const dx of [-0.95, 0.95]) add(mat.steel, placeAt(path, box(dx - 0.04, 0, -0.04, dx + 0.04, 2.6, 0.04), s, uu, yb));
  }
  const signs = new THREE.Mesh(mergeGeometries(boards)!, new THREE.MeshStandardMaterial({ name: 'stn_sign', map: signTex, roughness: 0.5, side: THREE.DoubleSide }));
  signs.name = 'station_signs'; G.add(signs);
  // white fence along the back of platform 1, away from the building
  for (const [a, b] of [[sP0, sB - L / 2 - 1], [sB + L / 2 + 1, sSB - 3]] as const) if (b > a) {
    add(mat.white, sweep(path, a, b, 2, [[p1[1] + 0.05, top + 1.0], [p1[1] + 0.05, top + 0.95]], 2), sweep(path, a, b, 2, [[p1[1] + 0.05, top + 0.55], [p1[1] + 0.05, top + 0.5]], 2));
    for (let s = a; s < b; s += 2.5) add(mat.white, placeAt(path, box(-0.04, 0, -0.04, 0.04, 1.05, 0.04), s, p1[1] + 0.05, path.at(s).y + top));
  }

  // everything opaque in one vertex-coloured mesh (one draw call; colours from the materials above)
  const all: THREE.BufferGeometry[] = [];
  for (const [m, gs] of parts) {
    const c = (m as THREE.MeshStandardMaterial).color;
    for (const g0 of gs) { const g = nonIdx(g0), n = g.getAttribute('position').count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); all.push(g); }
  }
  const mesh = new THREE.Mesh(mergeGeometries(all)!, new THREE.MeshStandardMaterial({ name: 'station', vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));
  mesh.name = 'station_structures'; mesh.castShadow = mesh.receiveShadow = true; G.add(mesh); colliders.push(mesh);
  return {
    group: G, colliders,
    platform: { s0: sP0, s1: sP1, u0: p1[0], u1: p1[1], top },
    loop: { s0: sL0, s1: sL1, offset: off },
    /** OS footprints replaced by the models above (station building, signal box) */
    replaced: [STATION_GEO.building, STATION_GEO.signalBox],
  };
}
