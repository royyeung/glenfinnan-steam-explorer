// Phase 3: the cab interior (footplate). Static parts go into the engine/tender batches; every
// operable control is its own named node ("ctl_<id>") with its pivot at the node origin, gauge
// needles are "needle_<gauge>_<n>", water-gauge columns "wg_water_<L|R>", the cut-off indicator
// "ind_cutoff". Layout: see src/loco/cabControls.ts and src/specs/cab.ts for sources.
import * as THREE from 'three';
import { B5, zEngine, zTender } from '../../specs/black5.ts';
import { CAB } from '../../specs/cab.ts';
import { CONTROLS, GAUGES, type CabControl } from '../cabControls.ts';
import { Batch, DETAIL, boxMinMax, cylBetween, cylZ, extrudeSection, extrudeSide, latheY, pipe, roundBox, roundedRect } from '../geom.ts';
import { cabShape } from './cab.ts';
import { arc } from './wheels.ts';
import type { MatKey } from '../materials.ts';

const v = (k: keyof typeof B5) => B5[k].v;
const c = (k: keyof typeof CAB) => CAB[k].v;
type Mats = Record<MatKey, THREE.Material>;
const V = (x: number, y: number, zz: number) => new THREE.Vector3(x, y, zz);

/** The firehole opening (x, y), slightly larger than the ring; cut through every plate in its path. */
export function fireholeOutline(): [number, number][] {
  const fh = CAB.fireholeH.v, fr = CAB.fireholeR.v;
  return arc(fr * 1.1, Math.PI * 2, 0, 28).map(([x, y]) => [x * 1.12, y + fh] as [number, number]);
}

/** Firebox outer section at the backhead (x, y), from the floor up to the Belpaire top. */
function backheadSection(floor: number): [number, number][] {
  const fT = v('fireboxTopH') - 0.04, fw = v('fireboxWidthTop') / 2 - 0.03, sh = 0.26, bw = 0.62;
  return [[-bw, floor], [bw, floor], [fw, fT - sh - 0.5],
    ...arc(sh, 0, Math.PI / 2, 8).map(([a, b]) => [fw - sh + a, fT - sh + b] as [number, number]),
    ...arc(sh, Math.PI / 2, Math.PI, 8).map(([a, b]) => [-fw + sh + a, fT - sh + b] as [number, number]), [-fw, fT - sh - 0.5]];
}

/** Brass handwheel lying in the plane perpendicular to `axis`, centred at the origin. */
function handwheel(b: Batch, r: number, axis: 'y' | 'z', mat: MatKey = 'brass', spokes = 4) {
  const t = new THREE.TorusGeometry(r, r * 0.12, 8, 24);
  if (axis === 'y') t.rotateX(Math.PI / 2);
  b.add(mat, t);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2, e = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0);
    if (axis === 'y') e.set(e.x, 0, e.y);
    b.add(mat, cylBetween(new THREE.Vector3(), e, r * 0.07, 6));
  }
  b.add(mat, axis === 'y' ? cylBetween(V(0, -0.03, 0), V(0, 0.03, 0), r * 0.22, 10) : cylZ(r * 0.22, r * 0.22, -0.03, 0.03, 0, 0, 10));
}

/** Geometry of one control, in its own frame (pivot at the origin). */
function controlGeometry(ctl: CabControl, mats: Mats): { b: Batch; children: THREE.Group[] } {
  const b = new Batch(), children: THREE.Group[] = [];
  const child = (name: string, d: Batch, x = 0) => { const g = new THREE.Group(); g.name = name; g.position.x = x; for (const m of d.build(`ctl_${ctl.id}_${name}`, mats)) g.add(m); children.push(g); };
  const lever = (to: THREE.Vector3, r: number, mat: MatKey = 'steel', knob = true) => {
    b.add(mat, cylBetween(new THREE.Vector3(), to, r, 8));
    if (knob) b.add('wood', latheY([[0, 0], [r * 2.2, 0], [r * 2.4, 0.06], [r * 2, 0.11], [0, 0.12]], to.x, to.y - 0.06, to.z, 10));
    b.add(mat, new THREE.SphereGeometry(r * 1.8, 10, 8));
  };
  switch (ctl.id) {
    case 'regulator': {
      // long handle hanging from the manifold, flattened, with a wooden grip at the end
      const L = 0.62;
      b.add('steel', boxMinMax(-0.02, -L, -0.012, 0.02, 0, 0.012));
      b.add('steel', cylZ(0.05, 0.05, -0.03, 0.03, 0, 0, 14));
      b.add('wood', cylBetween(V(0, -L, 0), V(0, -L - 0.13, -0.02), 0.022, 8));
      break;
    }
    case 'reverser': {
      handwheel(b, 0.15, 'y', 'steel', 5);
      b.add('wood', cylBetween(V(0.15, 0, 0), V(0.15, 0.12, 0), 0.018, 8)); // crank handle
      break;
    }
    case 'brake': lever(V(0, 0.2, -0.03), 0.014, 'brass'); b.add('brass', roundBox(-0.05, -0.08, 0.05, 0.03, -0.05, 0.04, 0.01)); break;
    case 'airBrake': lever(V(0, 0.04, -0.17), 0.012, 'steel'); break;
    case 'whistle': lever(V(0, -0.2, 0), 0.012, 'brass'); break;
    case 'drainCocks': case 'damperF': case 'damperR': lever(V(0, 0.55, 0), 0.016, 'steel'); break;
    case 'sander': lever(V(0, 0.12, -0.02), 0.01, 'brass'); break;
    case 'deflector': b.add('steel', boxMinMax(-0.2, 0, -0.18, 0.2, 0.012, 0)); b.add('steel', cylBetween(V(-0.2, 0, 0), V(0.2, 0, 0), 0.015, 8)); break;
    case 'aws': b.add('rubber', cylZ(0.03, 0.03, -0.02, 0.0, 0, 0, 12)); b.add('paint_red', cylZ(0.02, 0.02, -0.035, -0.02, 0, 0, 12)); break;
    case 'cabLight': b.add('steel', boxMinMax(-0.006, 0, -0.03, 0.006, 0.04, -0.01)); break;
    case 'waterL': case 'waterR': lever(V(0, -0.2, 0.03), 0.014, 'steel'); break;
    case 'handbrake': handwheel(b, 0.13, 'y', 'steel', 3); b.add('wood', cylBetween(V(0.13, 0, 0), V(0.13, 0.11, 0), 0.016, 8)); break;
    case 'fireDoors': {
      // two sliding doors, each a child node that the rig moves sideways
      for (const [n, s] of [['door_L', 1], ['door_R', -1]] as const) {
        const d = new Batch();
        d.add('backhead', boxMinMax(s > 0 ? 0 : -0.25, -0.24, -0.03, s > 0 ? 0.25 : 0, 0.24, 0));
        d.add('steel', cylBetween(V(s * 0.2, -0.12, -0.05), V(s * 0.2, 0.12, -0.05), 0.012, 6)); // handle
        child(n, d);
      }
      break;
    }
    case 'coalDoors': {
      for (const [n, s] of [['door_L', 1], ['door_R', -1]] as const) {
        const d = new Batch();
        d.add('smokebox', boxMinMax(s > 0 ? -0.36 : 0, -0.28, 0, s > 0 ? 0 : 0.36, 0.28, 0.02));
        d.add('steel', boxMinMax(s > 0 ? -0.3 : 0.26, -0.02, 0.02, s > 0 ? -0.26 : 0.3, 0.02, 0.05));
        child(n, d, s * 0.36);
      }
      break;
    }
    default: {
      const r = ctl.id === 'ejectorLarge' ? 0.085 : ctl.id === 'blower' ? 0.08 : 0.065;
      handwheel(b, r, 'z');
    }
  }
  return { b, children };
}

/** Operable control nodes for one vehicle. */
export function controlNodes(mats: Mats, on: 'engine' | 'tender'): THREE.Group[] {
  const out: THREE.Group[] = [], zf = on === 'engine' ? zEngine : zTender;
  for (const ctl of CONTROLS.filter((k) => k.on === on)) {
    const { b, children } = controlGeometry(ctl, mats), g = new THREE.Group();
    g.name = `ctl_${ctl.id}`;
    if (!b.empty) for (const m of b.build(g.name, mats)) g.add(m);
    for (const ch of children) g.add(ch);
    g.position.set(ctl.x, ctl.h, zf(ctl.d));
    out.push(g);
  }
  return out;
}

/** Static cab interior on the engine. */
export function cabInterior(b: Batch) {
  if (DETAIL < 1) return; // interior only on the close-up model
  const z = zEngine, { cw, eave, roofArc } = cabShape(), floor = v('footplateH'), cf = v('cabFrontD'), bh = c('backheadD');

  // firebox inside the cab and the backhead plate
  const fh = c('fireholeH'), fr = c('fireholeR');
  // the backhead plate with the firehole cut through it
  b.add('backhead', extrudeSection(backheadSection(floor), z(cf), z(bh), [fireholeOutline()]));
  // firehole: oval opening ring, dark throat, glowing fire bed (decal_fire) behind
  const ring = new THREE.TorusGeometry(fr + 0.03, 0.035, 8, 28); ring.scale(1.12, 1, 1); ring.translate(0, fh, z(bh) - 0.005);
  b.add('steel', ring);
  { const t = cylZ(fr * 1.1, fr * 1.1, z(bh), z(cf) + 0.02, 0, fh, 24, true); t.scale(1.12, 1, 1); b.add('smokebox', t); }
  // inside the firebox: walls facing inwards (seen through the firehole) and the burning coal on the
  // grate, sloping down towards the front, as seen when you look in from the footplate
  const fbx = new THREE.BoxGeometry(1.1, 0.95, 1.9); fbx.scale(-1, 1, 1); fbx.translate(0, fh + 0.05, z(bh) + 0.95 + 0.02);
  b.add('smokebox', fbx);
  // fire bed: level with the bottom of the firehole at the back, sloping down towards the front
  const bed = new THREE.PlaneGeometry(1.0, 1.8, 6, 10); bed.rotateX(-Math.PI / 2);
  bed.translate(0, 0, z(bh) + 0.95);
  const bp = bed.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) {
    const fwd = bp.getZ(i) - z(bh); // 0 at the backhead, growing towards the front of the firebox
    bp.setY(i, fh - fr * 0.95 - fwd * 0.17 + 0.04 * Math.sin(bp.getX(i) * 17 + fwd * 11));
  }
  bed.computeVertexNormals();
  b.add('decal_fire', bed);
  // firing tray (shelf) above the firehole and the door guides
  b.add('backhead', boxMinMax(-0.42, fh + 0.27, z(bh) - 0.18, 0.42, fh + 0.3, z(bh)));
  for (const y of [fh - 0.27, fh + 0.25]) b.add('steel', boxMinMax(-0.56, y, z(bh) - 0.05, 0.56, y + 0.03, z(bh)));
  // brick-coloured door housings either side (as on 44871)
  for (const s of [1, -1]) b.add('paint_red', roundBox(s > 0 ? 0.26 : -0.56, fh - 0.22, s > 0 ? 0.56 : -0.26, fh + 0.22, z(bh) - 0.06, z(bh), 0.02));

  // steam manifold (turret) on top of the backhead, pipes down to the injectors and ejector
  const mh = c('manifoldH');
  b.add('backhead', roundBox(-0.45, mh - 0.08, 0.45, mh + 0.08, z(bh) - 0.12, z(bh), 0.04));
  b.add('backhead', cylZ(0.07, 0.07, z(bh), z(bh) - 0.16, 0, mh + 0.16, 12));
  for (const ctl of CONTROLS.filter((k) => k.on === 'engine' && k.kind === 'wheel' && k.axis === 'z')) {
    b.add('steel', cylZ(0.012, 0.012, z(bh), z(ctl.d), ctl.x, ctl.h, 8)); // spindle
    b.add('backhead', cylZ(0.035, 0.03, z(bh), z(bh) - 0.05, ctl.x, ctl.h, 10)); // valve body
  }
  // water gauges: brass top and bottom fittings, glass tube, protector, water column node is separate
  const gx = c('gaugeGlassX'), g0 = c('gaugeGlassH0'), g1 = c('gaugeGlassH1');
  for (const s of [1, -1]) {
    const x = s * gx, zz = z(bh) - 0.07;
    for (const y of [g0, g1]) { b.add('brass', roundBox(x - 0.03, y - 0.03, x + 0.03, y + 0.03, zz - 0.04, z(bh), 0.01)); b.add('brass', cylBetween(V(x, y, zz - 0.035), V(x + s * 0.06, y - 0.03, zz - 0.04), 0.008, 6)); }
    b.add('glass', cylBetween(V(x, g0 + 0.02, zz - 0.02), V(x, g1 - 0.02, zz - 0.02), 0.012, 10));
    for (const dx of [-0.022, 0.022]) b.add('brass', cylBetween(V(x + dx, g0 + 0.03, zz - 0.045), V(x + dx, g1 - 0.03, zz - 0.045), 0.004, 4));
    b.add('steel', boxMinMax(x - 0.035, g0 + 0.02, zz - 0.002, x + 0.035, g1 - 0.02, zz + 0.002)); // striped backing plate
  }
  // gauges: bodies, bezels and faces (needles are separate nodes)
  for (const ga of GAUGES) {
    const zz = z(ga.d);
    b.add('brass', cylZ(ga.r + 0.012, ga.r + 0.012, zz + 0.05, zz - 0.02, ga.x, ga.h, 28));
    const face = new THREE.CircleGeometry(ga.r, 32); face.rotateY(Math.PI); face.translate(ga.x, ga.h, zz - 0.021);
    b.add(`decal_gauge_${ga.id}` as MatKey, face);
    if (Math.abs(ga.x) < 0.9) b.add('copper', pipe([V(ga.x, ga.h - ga.r, zz + 0.03), V(ga.x, ga.h - ga.r - 0.1, zz + 0.04), V(ga.x, mh + 0.09, z(bh) - 0.01)], 0.006));
  }
  // copper pipework down the backhead (injector deliveries, ejector, gauge pipes)
  for (const [x0, x1] of [[0.4, 0.62], [-0.56, -0.75], [0.74, 0.95], [0.53, 0.5], [-0.32, -0.2]]) {
    b.add('copper', pipe([V(x0, 3.2, z(bh) - 0.03), V(x0 + (x1 - x0) * 0.4, 2.7, z(bh) - 0.035), V(x1, 2.0, z(bh) - 0.03), V(x1, floor + 0.02, z(bh) - 0.025)], 0.011));
  }
  // combination brake valve body and ejector body (driver's side)
  b.add('brass', cylZ(0.07, 0.07, z(bh), z(bh) - 0.1, 0.62, 2.56, 16));
  b.add('brass', cylZ(0.05, 0.08, z(bh) - 0.02, z(bh) - 0.12, 0.64, 2.98, 14));
  // regulator quadrant
  b.add('steel', extrudeSection(arc(0.6, -Math.PI / 2 - 0.15, -Math.PI / 2 + 1.15, 16).map(([x, y]) => [x + 0.05, y + 3.3] as [number, number]).concat(arc(0.56, -Math.PI / 2 + 1.15, -Math.PI / 2 - 0.15, 16).map(([x, y]) => [x + 0.05, y + 3.3] as [number, number])), z(bh) - 0.03, z(bh) - 0.045));

  // reverser pedestal with cut-off scale; M8 valve pedestal; AWS indicator
  const rv = CONTROLS.find((k) => k.id === 'reverser')!;
  b.add('backhead', cylBetween(V(rv.x, floor, z(rv.d)), V(rv.x, rv.h - 0.06, z(rv.d)), 0.06, 12));
  b.add('steel', cylBetween(V(rv.x, rv.h - 0.07, z(rv.d)), V(rv.x, rv.h + 0.02, z(rv.d)), 0.02, 8));
  const scale = new THREE.PlaneGeometry(0.06, 0.26); scale.rotateY(-Math.PI / 2); scale.translate(rv.x - 0.065, rv.h - 0.28, z(rv.d));
  b.add('decal_cutoff', scale);
  const m8 = CONTROLS.find((k) => k.id === 'airBrake')!;
  b.add('backhead', cylBetween(V(m8.x, floor, z(m8.d)), V(m8.x, m8.h - 0.06, z(m8.d)), 0.045, 10));
  b.add('steel', roundBox(m8.x - 0.08, m8.h - 0.08, m8.x + 0.08, m8.h, z(m8.d) - 0.08, z(m8.d) + 0.08, 0.02));
  const aw = CONTROLS.find((k) => k.id === 'aws')!;
  b.add('rubber', roundBox(aw.x - 0.07, aw.h - 0.07, aw.x + 0.04, aw.h + 0.2, z(aw.d) + 0.0, z(aw.d) + 0.05, 0.015));
  b.add('steel', cylZ(0.045, 0.045, z(aw.d) - 0.005, z(aw.d), aw.x - 0.015, aw.h + 0.11, 16)); // "sunflower" indicator
  // tip-up seats on brackets, both sides
  for (const s of [1, -1]) {
    const x = s * (cw - 0.24), d = 11.45;
    b.add('wood', roundBox(x - 0.18, c('seatH') - 0.04, x + 0.18, c('seatH'), z(d + 0.17), z(d - 0.17), 0.02));
    b.add('steel', cylBetween(V(x + s * 0.15, c('seatH') - 0.04, z(d)), V(s * (cw - 0.04), c('seatH') - 0.28, z(d)), 0.015, 6));
  }
  // floor: chequer plate in front of the firehole, wooden boards behind (44871 photo)
  b.add('chequer', boxMinMax(-cw + 0.04, floor, z(c('floorWoodFromD')), cw - 0.04, floor + 0.008, z(bh)));
  for (let i = 0; i < 9; i++) {
    const x0 = -cw + 0.04 + i * ((2 * cw - 0.08) / 9);
    b.add('wood', boxMinMax(x0 + 0.004, floor, z(v('engineRearD')), x0 + (2 * cw - 0.08) / 9 - 0.004, floor + 0.012, z(c('floorWoodFromD'))));
  }
  // cream inner lining of the cab sides and the spectacle plate (with window openings)
  const L = c('innerLining');
  const win = roundedRect(z(v('cabWindowFrontD')), v('cabWindowBottomH'), z(v('cabWindowRearD')), v('cabWindowTopH'), 0.06);
  for (const s of [1, -1]) {
    const pts: [number, number][] = [[z(cf + 0.03), floor], [z(cf + 0.03), eave - 0.05], [z(v('cabOpeningFrontD') - 0.01), eave - 0.05], [z(v('cabOpeningFrontD') - 0.01), floor]];
    b.add('cab_inside', extrudeSide(pts, s * (cw - 0.026), s * (cw - 0.026 - L * 0.2), [win.map(([a, bb]) => [a, bb] as [number, number])]));
    // varnished wooden window frame on the inside
    b.add('wood', extrudeSide(win.map(([a, bb]) => [a, bb] as [number, number]), s * (cw - 0.03), s * (cw - 0.05), [roundedRect(z(v('cabWindowFrontD') + 0.05), v('cabWindowBottomH') + 0.05, z(v('cabWindowRearD') - 0.05), v('cabWindowTopH') - 0.05, 0.03)]));
  }
  const specFront: [number, number][] = [[-cw + 0.03, floor], [cw - 0.03, floor], ...roofArc(-0.06, cw - 0.03).reverse()];
  const sp = (s: number) => roundedRect(s > 0 ? 0.86 : -1.2, 2.72, s > 0 ? 1.2 : -0.86, 3.3, 0.07).reverse();
  b.add('cab_inside', extrudeSection(specFront, z(cf + 0.026), z(cf + 0.03), [sp(1), sp(-1), fireholeOutline()]));
}

/** Static tender-front fittings seen from the footplate. */
export function tenderFront(b: Batch) {
  if (DETAIL < 1) return;
  const z = zTender, front = c('tenderFrontD'), top = v('tenderTankTopH');
  // shovelling plate tray under the coal doors, with coal on it
  b.add('steel', boxMinMax(-0.45, 1.6, z(front) + 0.2, 0.45, 1.65, z(front)));
  for (const s of [1, -1]) b.add('steel', boxMinMax(s * 0.45 - 0.01, 1.6, z(front) + 0.2, s * 0.45 + 0.01, 1.78, z(front)));
  const heap = new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); heap.scale(1.2, 0.35, 0.55); heap.translate(0, 1.64, z(front) + 0.08);
  b.add('coal', heap);
  // coal-door frame above the tray
  b.add('smokebox', boxMinMax(-0.4, 1.82, z(front) - 0.005, 0.4, 1.86, z(front) + 0.03));
  // "OPEN WATER SHUT" plates behind the water-valve levers
  for (const s of [1, -1]) {
    const p = new THREE.PlaneGeometry(0.16, 0.28); p.translate(s * 0.72, 1.95, z(front) + 0.008);
    b.add('decal_waterplate', p);
  }
  // handbrake column
  const hb = CONTROLS.find((k) => k.id === 'handbrake')!;
  b.add('smokebox', cylBetween(V(hb.x, 1.6, z(hb.d)), V(hb.x, hb.h - 0.05, z(hb.d)), 0.05, 12));
  // the fireman's shovel leaning on the tender front
  b.add('steel', boxMinMax(-0.92, 1.62, z(front) + 0.06, -0.66, 1.64, z(front) + 0.38).rotateX(0));
  b.add('wood', cylBetween(V(-0.79, 1.65, z(front) + 0.05), V(-0.79, 2.55, z(front) + 0.02), 0.018, 8));
  void top;
}

/** Gauge needles and water-gauge columns (moving, named). */
export function instrumentNodes(mats: Mats): THREE.Group[] {
  const out: THREE.Group[] = [], z = zEngine;
  for (const ga of GAUGES) for (let n = 0; n < ga.needles; n++) {
    const g = new THREE.Group(); g.name = `needle_${ga.id}_${n}`;
    const L = ga.r * 0.82;
    const geo = new THREE.BufferGeometry().setFromPoints([V(-0.006, -L * 0.15, 0), V(0.006, -L * 0.15, 0), V(0, L, 0)]);
    geo.setIndex([0, 2, 1]); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, n === 0 ? mats.paint_black : mats.paint_red); m.name = `${g.name}_mesh`;
    (m.material as THREE.Material).side = THREE.DoubleSide;
    g.add(m);
    g.position.set(ga.x, ga.h, z(ga.d) - 0.025 - n * 0.002);
    out.push(g);
  }
  for (const [S, s] of [['L', 1], ['R', -1]] as const) {
    const g = new THREE.Group(); g.name = `wg_water_${S}`;
    const h = c('gaugeGlassH1') - c('gaugeGlassH0') - 0.04;
    const col = new THREE.CylinderGeometry(0.0105, 0.0105, h, 10); col.translate(0, h / 2, 0);
    const m = new THREE.Mesh(col, mats.water); m.name = `${g.name}_mesh`; g.add(m);
    g.position.set(s * c('gaugeGlassX'), c('gaugeGlassH0') + 0.02, z(c('backheadD')) - 0.09);
    out.push(g);
  }
  const rv = CONTROLS.find((k) => k.id === 'reverser')!;
  const ind = new THREE.Group(); ind.name = 'ind_cutoff';
  const tri = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6).rotateZ(Math.PI / 2), mats.brass); tri.name = 'ind_cutoff_mesh';
  ind.add(tri); ind.position.set(rv.x - 0.085, rv.h - 0.28, z(rv.d));
  out.push(ind);
  return out;
}
