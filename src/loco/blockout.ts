// Phase 1: proportion-accurate blockout of 45407 and its tender, built only from src/specs.
// Static parts are merged per material; moving parts (wheelsets, rods, crossheads) stay separate
// named nodes so the same scene graph works whether generated live or loaded from GLB.
import * as THREE from 'three';
import { B5, tenderAxlesD, zEngine, zTender } from '../specs/black5.ts';
import { Batch, boxMinMax, cylBetween, cylX, cylZ, extrudeSection, extrudeSide, latheY, loftZ } from './geom.ts';
import { engineLayout, motionGeometry } from './layout.ts';
import { solveMotion, strokeDir } from './motion/solver.ts';
import type { MatKey } from './materials.ts';

const v = (k: keyof typeof B5) => B5[k].v;
type Mats = Record<MatKey, THREE.Material>;

// ---------------------------------------------------------------- wheels

function arcPoints(r: number, a0: number, a1: number, n: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return pts;
}

/** One wheel centred at (x, 0, 0) in wheelset space, lying in the (z, y) plane. */
function wheel(b: Batch, r: number, x: number, spokes: number, crankPhi: number | null, outward: number) {
  const tyreW = 0.14, rimR = r - 0.07, hubR = Math.max(0.13, r * 0.17);
  b.add('wheel', cylX(r, tyreW, x, 0, 0, 48));                                         // tyre + rim (solid disc edge)
  b.add('wheel', cylX(hubR, tyreW + 0.08, x + outward * 0.02, 0, 0, 20));            // hub
  b.add('steel', cylX(r, 0.012, x + outward * (tyreW / 2 + 0.004), 0, 0, 48));        // bright tyre face ring (read as tyre edge)
  b.add('wheel', cylX(rimR, 0.016, x + outward * (tyreW / 2 + 0.010), 0, 0, 48));     // rim face hides the ring centre
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2, L = rimR - hubR, mid = (rimR + hubR) / 2;
    const g = new THREE.BoxGeometry(0.05, L, 0.05);
    g.rotateX(Math.PI / 2 - a);
    g.translate(x + outward * 0.03, Math.sin(a) * mid, Math.cos(a) * mid);
    b.add('wheel', g);
  }
  if (crankPhi !== null) {
    // balance weight opposite the crank, crank boss and pin
    const bw = Math.PI + crankPhi, inner = rimR * 0.45;
    const outerArc = arcPoints(rimR - 0.01, bw - 0.6, bw + 0.6, 10), innerArc = arcPoints(inner, bw + 0.6, bw - 0.6, 10);
    const pts = [...outerArc, ...innerArc].map(([z, y]) => [z, y] as [number, number]);
    b.add('wheel', extrudeSide(pts, x + outward * 0.02, x + outward * 0.07));
    const cr = v('crankRadius'), cz = Math.cos(crankPhi) * cr, cy = Math.sin(crankPhi) * cr;
    b.add('wheel', cylX(0.16, 0.10, x + outward * 0.06, cy, cz, 20));
  }
}

function wheelset(name: string, r: number, spokes: number, crankLeft: number | null, crankRight: number | null, pinOut = 0) {
  const b = new Batch(), xt = v('wheelTreadOffset');
  wheel(b, r, xt, spokes, crankLeft, 1);
  wheel(b, r, -xt, spokes, crankRight, -1);
  b.add('steel', cylX(0.1, 2 * xt + 0.2, 0, 0, 0, 16));
  // crankpins reach out to the rod planes
  for (const [phi, s] of [[crankLeft, 1], [crankRight, -1]] as const) {
    if (phi === null || pinOut <= 0) continue;
    const cr = v('crankRadius'), x0 = xt + 0.1, x1 = pinOut;
    b.add('steel', cylX(0.065, x1 - x0, s * (x0 + x1) / 2, Math.sin(phi) * cr, Math.cos(phi) * cr, 16));
  }
  return b;
}

// ---------------------------------------------------------------- rods

/** A rod modelled from its origin along +Z to `length`, with bosses at both ends. */
function rodGeom(length: number, depth: number, thick: number, bossR: number) {
  const b = new Batch();
  b.add('steel', boxMinMax(-thick / 2, -depth / 2, 0, thick / 2, depth / 2, length));
  b.add('steel', cylX(bossR, thick * 1.3, 0, 0, 0, 20), cylX(bossR, thick * 1.3, 0, 0, length, 20));
  return b;
}

function namedMesh(name: string, b: Batch, mats: Mats) {
  const g = new THREE.Group(); g.name = name;
  for (const m of b.build(name, mats)) g.add(m);
  return g;
}

// ---------------------------------------------------------------- engine

export function buildEngine(mats: Mats): THREE.Group {
  const E = new THREE.Group(); E.name = 'engine';
  const b = new Batch(), z = zEngine, lay = engineLayout(), geo = motionGeometry();

  // frames
  const fw = v('frameWidth') / 2;
  for (const s of [1, -1]) b.add('paint_black', boxMinMax(s * (fw - 0.03), v('frameBottomH'), z(v('engineRearD')), s * fw, v('frameTopH'), z(0.62)));

  // buffer beam and buffers
  const bp = v('bufferProjection'), bh = v('bufferH');
  b.add('paint_red', boxMinMax(-v('beamWidth') / 2, v('beamTopH') - v('beamDepth'), z(bp + 0.1), v('beamWidth') / 2, v('beamTopH'), z(bp)));
  for (const s of [1, -1]) {
    const x = s * v('bufferCentres') / 2;
    b.add('paint_red', cylZ(0.15, 0.13, z(bp), z(0.16), x, bh));
    b.add('steel', cylZ(0.07, 0.07, z(0.16), z(0.05), x, bh, 16));
    b.add('steel', cylZ(v('bufferHeadDia') / 2, v('bufferHeadDia') / 2, z(0.05), z(0), x, bh, 32));
  }
  b.add('steel', boxMinMax(-0.04, bh - 0.06, z(bp), 0.04, bh + 0.06, z(bp - 0.18))); // coupling hook

  // running plate, valances and the curved front drop
  const rpH = v('runningPlateH'), rpW = v('runningPlateWidth') / 2, drop = v('runningPlateDropD');
  b.add('paint_black', boxMinMax(-rpW, rpH - 0.035, z(drop), rpW, rpH, z(v('cabFrontD'))));
  for (const s of [1, -1]) b.add('paint_black', boxMinMax(s * (rpW - 0.02), rpH - 0.24, z(drop), s * rpW, rpH, z(v('cabFrontD'))));
  const curve: [number, number][] = [];
  const dEnd = bp + 0.12, hEnd = v('beamTopH');
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, k = 0.5 - 0.5 * Math.cos(Math.PI * t);
    curve.push([z(drop + (dEnd - drop) * t), rpH + (hEnd - rpH) * k]);
  }
  const plate = [...curve, ...curve.slice().reverse().map(([zz, y]) => [zz, y - 0.035] as [number, number])];
  b.add('paint_black', extrudeSide(plate, -rpW, rpW));
  for (const s of [1, -1]) b.add('paint_black', extrudeSide([...curve, [z(dEnd), hEnd - 0.35], [z(drop), rpH - 0.24]], s * (rpW - 0.02), s * rpW));

  // cylinders, valve chests, slidebars
  const w = strokeDir(geo), cylL = v('cylLateral');
  const at = (d: number, dh = 0) => { // point on the line of stroke at distance d behind the front buffer
    const zz = z(d), t = (zz - geo.drive[0]) / w[0];
    return new THREE.Vector3(0, geo.drive[1] + t * w[1] + dh, zz);
  };
  for (const s of [1, -1]) {
    const a = at(v('cylFrontD')), c = at(v('cylRearD')); a.x = c.x = s * cylL;
    b.add('paint_black', cylBetween(a, c, v('cylCladDia') / 2, 28));
    const va = a.clone().setY(v('valveChestH')), vc = c.clone().setY(v('valveChestH'));
    b.add('paint_black', cylBetween(va, vc, v('valveChestDia') / 2, 24));
    b.add('paint_black', boxMinMax(s * (cylL - 0.18), a.y, a.z - 0.05, s * (cylL + 0.18), v('valveChestH'), c.z + 0.05));
    for (const dy of [0.13, -0.13]) {
      const s0 = at(v('cylRearD'), dy), s1 = at(v('cylRearD') + 1.3, dy); s0.x = s1.x = s * cylL;
      b.add('steel', cylBetween(s0, s1, 0.025, 10));
    }
    // motion bracket
    b.add('paint_black', boxMinMax(s * (fw - 0.03), at(v('cylRearD') + 1.35).y - 0.25, z(v('cylRearD') + 1.32), s * (cylL - 0.08), rpH - 0.04, z(v('cylRearD') + 1.42)));
  }

  // smokebox, door, saddle, chimney
  const sbR = v('smokeboxDia') / 2, sbY = v('smokeboxTopH') - sbR;
  b.add('smokebox', cylZ(sbR, sbR, z(v('smokeboxFrontD')), z(v('smokeboxRearD')), 0, sbY, 48));
  b.add('smokebox', cylZ(v('doorRingDia') / 2, v('doorRingDia') / 2, z(v('smokeboxFrontD')), z(v('smokeboxFrontD') - 0.05), 0, sbY, 48));
  b.add('smokebox', cylZ(v('doorRingDia') / 2 - 0.04, v('doorRingDia') / 2 - 0.14, z(v('smokeboxFrontD') - 0.05), z(v('smokeboxDoorD')), 0, sbY, 48));
  b.add('steel', boxMinMax(-0.32, sbY - 0.02, z(v('smokeboxDoorD') - 0.01), 0.32, sbY + 0.03, z(v('smokeboxDoorD') - 0.05)));
  b.add('blue_plate', boxMinMax(-0.3, sbY + 0.33, z(v('smokeboxDoorD') + 0.02), 0.3, sbY + 0.47, z(v('smokeboxDoorD') - 0.015)));
  b.add('smokebox', boxMinMax(-0.6, rpH - 0.3, z(v('smokeboxFrontD') + 0.2), 0.6, sbY, z(v('smokeboxRearD') - 0.2)));
  const chBase = v('smokeboxTopH') - 0.08, chTop = v('height') - chBase, lip = v('chimneyLipDia') / 2;
  b.add('smokebox', latheY([[0, 0], [0.5, 0], [0.42, 0.06], [0.31, 0.13], [0.27, chTop * 0.55], [0.28, chTop - 0.07], [lip, chTop - 0.04], [lip, chTop], [0.24, chTop], [0.22, chTop - 0.2], [0, chTop - 0.2]], 0, chBase, z(v('chimneyD'))));

  // taper boiler (flat bottom line), Belpaire firebox, dome, top feed, safety valves, whistle
  const rF = v('barrelFrontDia') / 2, rR = v('barrelRearDia') / 2, yb = sbY - rF;
  const rings = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6, d = v('smokeboxRearD') + (v('barrelRearD') - v('smokeboxRearD')) * t, r = rF + (rR - rF) * t;
    return { z: z(d), y: yb + r, r };
  });
  b.add('paint_black', loftZ(rings, 0, 48));
  const barrelTopAt = (d: number) => { const t = (d - v('smokeboxRearD')) / (v('barrelRearD') - v('smokeboxRearD')); return yb + 2 * (rF + (rR - rF) * t); };
  const fT = v('fireboxTopH'), fw2 = v('fireboxWidthTop') / 2, sh = 0.24;
  const sect: [number, number][] = [[-0.8, rpH], [0.8, rpH], [fw2, fT - sh],
    ...arcPoints(sh, 0, Math.PI / 2, 6).map(([c, s2]) => [fw2 - sh + c, fT - sh + s2] as [number, number]),
    ...arcPoints(sh, Math.PI / 2, Math.PI, 6).map(([c, s2]) => [-fw2 + sh + c, fT - sh + s2] as [number, number]),
    [-fw2, fT - sh]];
  b.add('paint_black', extrudeSection(sect, z(v('cabFrontD')), z(v('barrelRearD'))));
  const domeBase = barrelTopAt(v('domeD')) - 0.12, domeH = v('domeTopH') - domeBase, dr = v('domeDia') / 2;
  b.add('paint_black', latheY([[0, 0], [dr + 0.04, 0], [dr, 0.08], [dr - 0.03, domeH * 0.55], [dr * 0.78, domeH * 0.86], [dr * 0.45, domeH * 0.98], [0, domeH]], 0, domeBase, z(v('domeD'))));
  const tfBase = barrelTopAt(v('topFeedD')) - 0.1;
  b.add('paint_black', boxMinMax(-0.2, tfBase, z(v('topFeedD') - 0.15), 0.2, v('topFeedTopH') - 0.08, z(v('topFeedD') + 0.15)));
  b.add('paint_black', cylZ(0.12, 0.12, z(v('topFeedD') - 0.15), z(v('topFeedD') + 0.15), 0, v('topFeedTopH') - 0.12, 20));
  for (const dd of [-0.09, 0.09]) b.add('brass', latheY([[0, 0], [0.08, 0], [0.07, 0.1], [0.05, 0.13], [0, 0.14]], 0, fT - 0.02, z(v('safetyValveD') + dd), 16));
  b.add('brass', latheY([[0, 0], [0.03, 0], [0.03, 0.12], [0.05, 0.14], [0.05, 0.26], [0, 0.27]], 0.25, fT - 0.02, z(v('cabFrontD') - 0.35), 12));

  // handrails along the boiler (both sides)
  for (const s of [1, -1]) b.add('steel', cylBetween(new THREE.Vector3(s * (sbR + 0.06), sbY + 0.25, z(v('smokeboxFrontD') + 0.1)), new THREE.Vector3(s * (rR + 0.08), yb + rR + 0.35, z(v('barrelRearD'))), 0.016, 8));

  // nameplates (both sides) above the running plate
  for (const s of [1, -1]) b.add('brass', boxMinMax(s * 0.93, rpH + 0.1, z(5.85), s * 0.95, rpH + 0.36, z(4.75)));

  // cab: front plate with spectacles, sides with windows, roof, floor, steps, handrails
  const cw = v('cabWidth') / 2, eave = 3.45, roof = v('cabRoofH'), cf = v('cabFrontD');
  const roofArc = (r: number) => { const sag = roof - eave, R = (cw * cw + sag * sag) / (2 * sag), yc = roof - R, a = Math.asin(cw / R);
    return arcPoints(R + r, Math.PI / 2 + a, Math.PI / 2 - a, 18).map(([x, y]) => [x, y + yc] as [number, number]); };
  const front: [number, number][] = [[-cw, rpH], [cw, rpH], ...roofArc(0).reverse()];
  const spect = (s: number) => arcPoints(0.17, 0, Math.PI * 2, 16).map(([x, y]) => [x + s * 0.62, y + 3.12] as [number, number]).reverse();
  b.add('paint_black', extrudeSection(front, z(cf), z(cf + 0.025), [spect(1), spect(-1)]));
  const roofBand = [...roofArc(0), ...roofArc(0.03).reverse()];
  b.add('paint_black', extrudeSection(roofBand, z(cf - 0.05), z(v('cabRoofRearD'))));
  b.add('cab_inside', extrudeSection(roofArc(-0.005).concat(roofArc(-0.02).reverse()), z(cf), z(v('cabRoofRearD') - 0.02)));
  const win: [number, number][] = [[z(v('cabWindowFrontD')), v('cabWindowBottomH')], [z(v('cabWindowRearD')), v('cabWindowBottomH')], [z(v('cabWindowRearD')), v('cabWindowTopH')], [z(v('cabWindowFrontD')), v('cabWindowTopH')]];
  const side: [number, number][] = [[z(cf), v('cabSideBottomH')], [z(cf), eave], [z(v('cabOpeningFrontD')), eave], [z(v('cabOpeningFrontD')), v('cabSideBottomH')]];
  for (const s of [1, -1]) {
    b.add('paint_black', extrudeSide(side, s * cw, s * (cw - 0.025), [win]));
    b.add('glass', extrudeSide(win, s * (cw - 0.01), s * (cw - 0.015)));
    // steps below the doorway, hangers and handrails
    const d0 = 11.85, d1 = 12.2;
    for (const h of [v('cabStepLowerH'), v('cabStepUpperH')]) b.add('steel', boxMinMax(s * (cw - 0.3), h - 0.03, z(d0), s * (cw - 0.02), h, z(d1)));
    b.add('paint_black', boxMinMax(s * (cw - 0.04), v('cabStepLowerH') - 0.05, z(d0), s * (cw - 0.02), v('footplateH'), z(d0 + 0.03)));
    b.add('paint_black', boxMinMax(s * (cw - 0.04), v('cabStepLowerH') - 0.05, z(d1 - 0.03), s * (cw - 0.02), v('footplateH'), z(d1)));
    b.add('steel', cylBetween(new THREE.Vector3(s * (cw + 0.04), 1.75, z(v('cabOpeningFrontD') + 0.03)), new THREE.Vector3(s * (cw + 0.04), 3.15, z(v('cabOpeningFrontD') + 0.03)), 0.016, 8));
  }
  b.add('cab_inside', boxMinMax(-cw + 0.03, v('footplateH') - 0.04, z(cf), cw - 0.03, v('footplateH'), z(v('engineRearD'))));

  for (const m of b.build('engine_static', mats)) E.add(m);

  // wheelsets
  const crankL = 0, crankR = geo.rightLeads ? -Math.PI / 2 : Math.PI / 2;
  const pinOut = v('conRodLateral') + 0.06;
  const ws: [string, { z: number; y: number; r: number }, number, boolean][] = [
    ['ws_bogieFront', lay.axles.bogieFront, 10, false], ['ws_bogieRear', lay.axles.bogieRear, 10, false],
    ['ws_lead', lay.axles.lead, v('driverSpokes'), true], ['ws_drive', lay.axles.drive, v('driverSpokes'), true], ['ws_trail', lay.axles.trail, v('driverSpokes'), true],
  ];
  for (const [name, a, spokes, coupled] of ws) {
    const set = namedMesh(name, wheelset(name, a.r, spokes, coupled ? crankL : null, coupled ? crankR : null, name === 'ws_drive' ? pinOut : v('couplingRodLateral') + 0.04), mats);
    set.position.set(0, a.y, a.z);
    E.add(set);
  }
  // bogie frame (static, between wheels)
  const bogie = new Batch();
  bogie.add('paint_black', boxMinMax(-0.62, 0.35, lay.axles.bogieRear.z - 0.5, 0.62, 0.75, lay.axles.bogieFront.z + 0.5));
  for (const m of bogie.build('bogie_frame', mats)) E.add(m);

  // rods: geometry along +Z from the origin; the rig places and aims them every frame
  const st = solveMotion(geo, 0).left;
  const len = (a: readonly [number, number], c: readonly [number, number]) => Math.hypot(c[0] - a[0], c[1] - a[1]);
  for (const S of ['L', 'R'] as const) {
    E.add(namedMesh(`rod_cf_${S}`, rodGeom(len(st.pins.lead, st.pins.drive), 0.11, 0.05, 0.1), mats));
    E.add(namedMesh(`rod_cr_${S}`, rodGeom(len(st.pins.drive, st.pins.trail), 0.11, 0.05, 0.1), mats));
    E.add(namedMesh(`rod_cn_${S}`, rodGeom(v('conRodLength'), 0.16, 0.06, 0.12), mats));
    const xh = new Batch(); xh.add('steel', boxMinMax(-0.07, -0.11, -0.16, 0.07, 0.11, 0.16));
    E.add(namedMesh(`xh_${S}`, xh, mats));
    const pr = new Batch(); pr.add('steel', cylZ(0.045, 0.045, 0, len(st.crosshead, st.piston), 0, 0, 12));
    E.add(namedMesh(`pr_${S}`, pr, mats));
  }
  return E;
}

// ---------------------------------------------------------------- tender

export function buildTender(mats: Mats): THREE.Group {
  const T = new THREE.Group(); T.name = 'tender';
  const b = new Batch(), z = zTender;
  const tw = v('tenderWidth') / 2, front = v('tenderFrontD'), rear = v('tenderBodyRearD'), bot = v('tenderTankBottomH');
  const top = v('tenderTankTopH'), side = v('tenderSideTopH'), step = v('tenderStepD');

  b.add('paint_black', boxMinMax(-1.05, 0.62, z(front + 0.1), 1.05, bot, z(rear)));                // underframe
  b.add('paint_black', boxMinMax(-tw, bot, z(front), tw, top, z(rear)));                            // water tank
  // coal space side walls with the curved front tops and the step down at the rear
  const prof: [number, number][] = [[z(front), top], [z(front), 2.95]];
  for (let i = 1; i <= 8; i++) { const t = i / 8; prof.push([z(front + 0.35 * t), 2.95 + (side - 2.95) * Math.sin((t * Math.PI) / 2)]); }
  prof.push([z(step - 0.25), side]);
  for (let i = 1; i <= 8; i++) { const t = i / 8; prof.push([z(step - 0.25 + 0.3 * t), side - (side - top) * (0.5 - 0.5 * Math.cos(Math.PI * t))]); }
  prof.push([z(step + 0.05), top]);
  for (const s of [1, -1]) b.add('paint_black', extrudeSide(prof, s * tw, s * (tw - 0.03)));
  b.add('paint_black', boxMinMax(-tw, top, z(front), tw, 3.0, z(front + 0.04)));                  // front bulkhead
  b.add('coal', extrudeSide([[z(front + 0.1), top], [z(front + 0.1), side - 0.08], [z(front + 1.2), side + 0.12], [z(step - 1.2), side + 0.1], [z(step - 0.3), side - 0.15], [z(step - 0.3), top]], tw - 0.04, -tw + 0.04));
  b.add('paint_black', latheY([[0, 0], [0.26, 0], [0.26, 0.1], [0.22, 0.14], [0, 0.15]], 0.45, top, z(18.5), 20)); // water filler
  // rear beam and buffers
  const bh = v('bufferH'), lob = v('lengthOverBuffers');
  b.add('paint_red', boxMinMax(-v('beamWidth') / 2, v('beamTopH') - v('beamDepth'), z(rear), v('beamWidth') / 2, v('beamTopH'), z(rear + 0.1)));
  for (const s of [1, -1]) {
    const x = s * v('bufferCentres') / 2;
    b.add('paint_red', cylZ(0.15, 0.13, z(rear + 0.1), z(lob - 0.16), x, bh));
    b.add('steel', cylZ(0.07, 0.07, z(lob - 0.16), z(lob - 0.05), x, bh, 16));
    b.add('steel', cylZ(v('bufferHeadDia') / 2, v('bufferHeadDia') / 2, z(lob - 0.05), z(lob), x, bh, 32));
  }
  // axleboxes and springs on the outside frames
  for (const d of tenderAxlesD()) for (const s of [1, -1]) {
    b.add('paint_black', boxMinMax(s * 1.0, 0.45, z(d) - 0.18, s * 1.18, 0.85, z(d) + 0.18));
    b.add('steel', boxMinMax(s * 1.02, 0.86, z(d) - 0.5, s * 1.16, 0.98, z(d) + 0.5));
  }
  // front steps and handrails
  for (const s of [1, -1]) {
    b.add('steel', boxMinMax(s * (tw - 0.3), 0.55, z(front + 0.05), s * (tw - 0.02), 0.58, z(front + 0.35)));
    b.add('steel', cylBetween(new THREE.Vector3(s * (tw + 0.04), 1.4, z(front + 0.08)), new THREE.Vector3(s * (tw + 0.04), 2.9, z(front + 0.08)), 0.016, 8));
  }
  for (const m of b.build('tender_static', mats)) T.add(m);

  const r = v('tenderWheelDia') / 2;
  tenderAxlesD().forEach((d, i) => {
    const set = namedMesh(`ws_t${i}`, wheelset(`ws_t${i}`, r, 12, null, null), mats);
    set.position.set(0, r, z(d));
    T.add(set);
  });
  return T;
}
