// Motion: coupling and connecting rods, crosshead, piston rod and the Walschaerts valve gear.
// Moving parts are named groups whose geometry runs along local +Z from a pin at the origin;
// LocoRig places and aims them every frame from the solvers. Static parts (slidebars, motion
// bracket, link girder, reversing shaft) are added to the engine's batch.
import * as THREE from 'three';
import { B5, zEngine } from '../../specs/black5.ts';
import { Batch, boxMinMax, cylBetween, cylX, roundBox } from '../geom.ts';
import { motionGeometry, valveGearGeometry } from '../layout.ts';
import { solveMotion, strokeDir } from '../motion/solver.ts';
import { arc } from './wheels.ts';
import type { MatKey } from '../materials.ts';

const v = (k: keyof typeof B5) => B5[k].v;
type Mats = Record<MatKey, THREE.Material>;

/** Lateral planes (left side positive; mirrored for the right). */
export const PLANES = {
  coupling: () => v('couplingRodLateral'),
  conRod: () => v('conRodLateral'),
  union: () => v('conRodLateral') + 0.07,
  gear: () => v('valveGearLateral'),
  eccentric: () => v('valveGearLateral') + 0.04,
  reach: () => v('valveGearLateral') + 0.1,
};

function named(name: string, b: Batch, mats: Mats) {
  const g = new THREE.Group(); g.name = name;
  for (const m of b.build(name, mats)) g.add(m);
  return g;
}

/** Fluted rod with bosses: section h x t, length L, boss radii at each end. */
function rod(L: number, h0: number, h1: number, t: number, boss0: number, boss1: number, flute = true) {
  const b = new Batch(), n = 6;
  for (let i = 0; i < n; i++) { // taper in n segments
    const z0 = (i / n) * L, z1 = ((i + 1) / n) * L, h = h0 + (h1 - h0) * ((i + 0.5) / n);
    b.add('steel', boxMinMax(-t / 2, -h / 2, z0, t / 2, h / 2, z1));
    if (flute) b.add('wheel', boxMinMax(t / 2 - 0.004, -h * 0.28, z0 + (i === 0 ? boss0 : 0), t / 2 + 0.002, h * 0.28, z1 - (i === n - 1 ? boss1 : 0)));
  }
  b.add('steel', cylX(boss0, t * 1.25, 0, 0, 0, 20), cylX(boss1, t * 1.25, 0, 0, L, 20));
  return b;
}

/** Builds every moving part of the motion for both sides. */
export function buildMotionParts(mats: Mats): THREE.Group[] {
  const out: THREE.Group[] = [];
  const geo = motionGeometry(), vg = valveGearGeometry();
  const st = solveMotion(geo, 0).left;
  const len = (a: readonly number[], c: readonly number[]) => Math.hypot(c[0] - a[0], c[1] - a[1]);
  const prLen = len(st.crosshead, st.piston);
  for (const S of ['L', 'R'] as const) {
    out.push(named(`rod_cf_${S}`, rod(len(st.pins.lead, st.pins.drive), 0.12, 0.1, 0.05, 0.1, 0.11), mats));
    out.push(named(`rod_cr_${S}`, rod(len(st.pins.drive, st.pins.trail), 0.1, 0.12, 0.05, 0.11, 0.1), mats));
    // connecting rod: small end at the crosshead, big end on the driving crankpin
    const cn = rod(v('conRodLength'), 0.11, 0.17, 0.065, 0.1, 0.14);
    cn.add('steel', boxMinMax(-0.045, -0.13, v('conRodLength') - 0.3, 0.045, 0.13, v('conRodLength') - 0.12)); // big-end strap
    out.push(named(`rod_cn_${S}`, cn, mats));
    // crosshead with the drop arm for the union link (local -Y is perpendicular below the stroke)
    const xh = new Batch();
    xh.add('steel', roundBox(-0.07, -0.12, 0.07, 0.12, -0.2, 0.2, 0.02));
    xh.add('steel', boxMinMax(-0.025, -vg.crossheadArm - 0.03, -0.04, 0.025, -0.08, 0.04));
    xh.add('steel', cylX(0.035, 0.12, 0.05, -vg.crossheadArm, 0, 12));
    out.push(named(`xh_${S}`, xh, mats));
    const pr = new Batch(); pr.add('steel', cylBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, prLen), 0.045, 14));
    out.push(named(`pr_${S}`, pr, mats));
    // --- valve gear ---
    out.push(named(`vg_er_${S}`, rod(vg.eccentricRod, 0.07, 0.09, 0.04, 0.07, 0.06), mats));
    const link = new Batch(), R = vg.radiusRod, top = vg.dieRange + 0.1, bot = -vg.dieRange - 0.1;
    // curved slotted link: two cheeks following an arc centred forward by the radius-rod length
    for (const off of [-0.055, 0.055]) {
      const pts: [number, number][] = [];
      const a0 = Math.asin(bot / R), a1 = Math.asin(top / R);
      const outer = arc(R + off + 0.025, Math.PI - a0, Math.PI - a1, 10).map(([z, y]) => [z + R, y] as [number, number]);
      const inner = arc(R + off - 0.025, Math.PI - a1, Math.PI - a0, 10).map(([z, y]) => [z + R, y] as [number, number]);
      pts.push(...outer, ...inner);
      link.add('steel', extrudeX(pts, 0.05));
    }
    link.add('steel', boxMinMax(-0.025, -vg.footOffset, -0.04, 0.025, bot, 0.04));      // tail to the foot
    link.add('steel', cylX(0.05, 0.09, 0, -vg.footOffset, 0, 14));                     // foot pin
    link.add('steel', cylX(0.065, 0.14, 0, 0, 0, 16));                                 // trunnion boss
    out.push(named(`vg_link_${S}`, link, mats));
    const rr = rod(vg.radiusRod, 0.08, 0.06, 0.04, 0.06, 0.05, false);
    rr.add('steel', roundBox(-0.04, -0.06, 0.04, 0.06, -0.08, 0.08, 0.015));               // die block
    rr.add('wheel', boxMinMax(-0.025, 0.04, vg.liftSlotNominal - 0.18, 0.025, 0.045, vg.liftSlotNominal + 0.18)); // slot cover
    out.push(named(`vg_rr_${S}`, rr, mats));
    out.push(named(`vg_cl_${S}`, rod(vg.leverTopToValve + vg.leverValveToBottom, 0.08, 0.06, 0.04, 0.05, 0.045, false), mats));
    out.push(named(`vg_ul_${S}`, rod(vg.unionLink, 0.05, 0.05, 0.035, 0.045, 0.045, false), mats));
    const vs = new Batch();
    vs.add('steel', cylBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.55), 0.03, 10));
    vs.add('steel', roundBox(-0.05, -0.07, 0.05, 0.07, -0.08, 0.1, 0.015));               // valve-spindle crosshead
    out.push(named(`vg_vs_${S}`, vs, mats));
    out.push(named(`vg_la_${S}`, rod(vg.liftArm, 0.07, 0.05, 0.04, 0.06, 0.045, false), mats));
    out.push(named(`vg_ll_${S}`, rod(vg.liftLink, 0.05, 0.05, 0.03, 0.04, 0.035, false), mats));
  }
  out.push(named('vg_reach_L', rod(REACH.rodLen, 0.05, 0.05, 0.04, 0.045, 0.045, false), mats));
  out.push(named('vg_ra_L', rod(REACH.armLen, 0.07, 0.05, 0.04, 0.055, 0.045, false), mats));
  return out;
}

/** Plate in the (z, y) plane, centred on x = 0, thickness t. */
function extrudeX(pts: [number, number][], t: number) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(t / 2, 0, 0);
  return g;
}

/** Static parts of the motion: slidebars, motion bracket, link girder, reversing shaft, valve guides. */
export function motionStatic(b: Batch) {
  const geo = motionGeometry(), vg = valveGearGeometry(), w = strokeDir(geo), z = zEngine;
  const along = (d: number, dy = 0) => { const zz = z(d), t = (zz - geo.drive[0]) / w[0]; return new THREE.Vector3(0, geo.drive[1] + t * w[1] + dy, zz); };
  const cylRear = v('cylRearD'), barEnd = cylRear + 1.25;
  for (const s of [1, -1]) {
    const xc = s * PLANES.conRod();
    for (const dy of [0.14, -0.14]) {
      const a = along(cylRear, dy), c = along(barEnd, dy); a.x = c.x = xc;
      b.add('steel', cylBetween(a, c, 0.028, 10));
      b.add('steel', boxMinMax(xc - 0.05, a.y - 0.03, a.z - 0.01, xc + 0.05, a.y + 0.03, c.z + 0.01).scale(1, 1, 1));
    }
    // motion bracket: plate from the frame to the slidebar ends and up to the running plate
    const mb = along(barEnd + 0.08), fw = v('frameWidth') / 2;
    b.add('paint_black', boxMinMax(s * fw, mb.y - 0.3, mb.z - 0.06, s * (Math.abs(xc) + 0.06), v('runningPlateH') - 0.04, mb.z + 0.06));
    // link girder carrying the expansion-link trunnion
    const tr = new THREE.Vector3(0, vg.trunnion[1], vg.trunnion[0]), xg = s * PLANES.gear();
    b.add('paint_black', boxMinMax(s * fw, tr.y + 0.1, tr.z - 0.18, s * (Math.abs(xg) - 0.08), tr.y + 0.32, tr.z + 0.18));
    b.add('paint_black', boxMinMax(xg - 0.1 * s, tr.y - 0.06, tr.z - 0.12, xg - 0.05 * s, tr.y + 0.32, tr.z + 0.12));
    b.add('steel', cylX(0.04, 0.2, xg - 0.04 * s, tr.y, tr.z, 12));
    // valve-spindle guide behind the valve chest
    const vp = new THREE.Vector3(s * PLANES.gear(), vg.valvePoint[1], vg.valvePoint[0]);
    b.add('paint_black', boxMinMax(vp.x - 0.05, vp.y - 0.06, vp.z + 0.12, vp.x + 0.05, vp.y + 0.06, z(v('cylRearD')) + 0.02));
  }
  // reversing shaft across the engine with bearings on the frames
  const lp = vg.liftPivot;
  b.add('steel', cylX(0.05, 2 * PLANES.reach(), 0, lp[1], lp[0], 14));
}

/** Points on the engine where the reach rod ends (for the rig): reversing-shaft upper arm. */
export const REACH = { armLen: 0.3, armAngle: Math.PI / 2 + 0.25, rodLen: 4.1, dir: [-0.9992, 0.04] as const };
