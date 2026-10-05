// Frames, running plate, front end, cylinders and the fittings along the running plate.
import * as THREE from 'three';
import { B5, engineAxlesD, zEngine } from '../../specs/black5.ts';
import { Batch, DETAIL, boxMinMax, cylBetween, cylX, cylZ, extrudeSide, latheY, pipe, rivets, roundBox } from '../geom.ts';
import { motionGeometry } from '../layout.ts';
import { strokeDir } from '../motion/solver.ts';
import { PLANES } from './motion.ts';

const v = (k: keyof typeof B5) => B5[k].v;
const z = zEngine;

/** Buffer: tapered stock, plunger, round head; faces +Z (front) when dir = 1, -Z when dir = -1. */
export function buffer(b: Batch, x: number, y: number, faceZ: number, dir: 1 | -1, beamZ: number) {
  const headT = 0.05, plungerL = 0.11;
  const stockEnd = faceZ - dir * (headT + plungerL);
  b.add('paint_red', cylZ(dir > 0 ? 0.17 : 0.13, dir > 0 ? 0.13 : 0.17, beamZ, stockEnd, x, y, 24));
  b.add('paint_red', cylZ(0.2, 0.2, beamZ, beamZ + dir * 0.03, x, y, 24)); // flange
  b.add('steel', cylZ(0.075, 0.075, stockEnd, faceZ - dir * headT, x, y, 16));
  const head = latheY([[0, 0], [v('bufferHeadDia') / 2, 0], [v('bufferHeadDia') / 2, headT * 0.6], [v('bufferHeadDia') / 2 - 0.03, headT], [0, headT]], 0, 0, 0, 28);
  head.rotateX(dir > 0 ? Math.PI / 2 : -Math.PI / 2); head.translate(x, y, faceZ - dir * headT);
  b.add('steel', head);
}

/** Screw coupling + vacuum and air brake hoses at a buffer beam. */
export function couplingAndHoses(b: Batch, beamZ: number, dir: 1 | -1, y: number) {
  b.add('steel', boxMinMax(-0.04, y - 0.07, beamZ, 0.04, y + 0.07, beamZ + dir * 0.3).translate(0, 0, 0));
  b.add('steel', cylX(0.03, 0.12, 0, y - 0.06, beamZ + dir * 0.29, 10));
  if (DETAIL >= 0.5) {
    // screw coupling hanging below the hook
    b.add('steel', boxMinMax(-0.03, y - 0.45, beamZ + dir * 0.27, 0.03, y - 0.08, beamZ + dir * 0.31));
    b.add('steel', cylBetween(new THREE.Vector3(-0.12, y - 0.3, beamZ + dir * 0.3), new THREE.Vector3(0.12, y - 0.3, beamZ + dir * 0.3), 0.02, 8));
    // vacuum pipe (left of hook) and air pipes (right), drooping hoses
    for (const [x, r, mat] of [[0.32, 0.035, 'rubber'], [-0.3, 0.022, 'rubber'], [-0.45, 0.022, 'rubber']] as const) {
      b.add('steel', cylBetween(new THREE.Vector3(x, y - 0.1, beamZ - dir * 0.02), new THREE.Vector3(x, y - 0.35, beamZ + dir * 0.06), 0.03, 8));
      b.add(mat, pipe([new THREE.Vector3(x, y - 0.35, beamZ + dir * 0.06), new THREE.Vector3(x, y - 0.55, beamZ + dir * 0.14), new THREE.Vector3(x * 0.8, y - 0.62, beamZ + dir * 0.28), new THREE.Vector3(x * 0.6, y - 0.5, beamZ + dir * 0.32)], r));
    }
  }
}

export function running(b: Batch) {
  const rpH = v('runningPlateH'), rpW = v('runningPlateWidth') / 2, drop = v('runningPlateDropD'), bp = v('bufferProjection');
  const fw = v('frameWidth') / 2, ft = 0.032;

  // --- plate frames (inside the wheels), with stretchers
  for (const s of [1, -1]) {
    b.add('paint_black', boxMinMax(s * (fw - ft), v('frameBottomH'), z(v('engineRearD')), s * fw, v('frameTopH'), z(0.62)));
  }
  for (const d of [1.1, 3.3, 6.3, 8.6, 11.9]) b.add('paint_black', boxMinMax(-fw, v('frameTopH') - 0.3, z(d) - 0.05, fw, v('frameTopH') - 0.05, z(d) + 0.05));

  // --- buffer beam with rivets, buffers, coupling, hoses
  const beamTop = v('beamTopH'), beamBot = beamTop - v('beamDepth'), bw = v('beamWidth') / 2;
  b.add('paint_red', boxMinMax(-bw, beamBot, z(bp + 0.1), bw, beamTop, z(bp)));
  if (DETAIL >= 0.5) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 22; i++) for (const yy of [beamTop - 0.05, beamBot + 0.05]) pts.push(new THREE.Vector3(-bw + 0.1 + i * ((2 * bw - 0.2) / 21), yy, z(bp)));
    for (const s of [1, -1]) for (let j = 0; j < 3; j++) pts.push(new THREE.Vector3(s * (fw + 0.05), beamBot + 0.1 + j * 0.12, z(bp)));
    b.add('paint_red', rivets(pts, 0.013, 'z'));
  }
  for (const s of [1, -1]) buffer(b, s * v('bufferCentres') / 2, v('bufferH'), z(0), 1, z(bp));
  couplingAndHoses(b, z(bp), 1, v('bufferH'));
  // lamp irons on the beam and two modern lamp units at the beam ends (2025 photos)
  for (const x of [-0.75, 0, 0.75]) b.add('steel', boxMinMax(x - 0.02, beamTop, z(bp) - 0.02, x + 0.02, beamTop + 0.12, z(bp) - 0.05));
  for (const s of [1, -1]) {
    const x = s * (bw - 0.18);
    b.add('paint_black', cylZ(0.085, 0.085, z(bp) - 0.02, z(bp) - 0.16, x, beamTop + 0.12, 16));
    b.add('lamp_lens', cylZ(0.07, 0.07, z(bp) - 0.015, z(bp) - 0.02, x, beamTop + 0.12, 16));
  }

  // --- running plate, valances (with lining from livery), front drop and footsteps
  const cf = v('cabFrontD');
  b.add('paint_black', boxMinMax(-rpW, rpH - 0.035, z(drop), rpW, rpH, z(cf)));
  for (const s of [1, -1]) b.add('paint_black', boxMinMax(s * (rpW - 0.02), rpH - 0.24, z(drop), s * rpW, rpH, z(cf)));
  const curve: [number, number][] = [], dEnd = bp + 0.12;
  for (let i = 0; i <= 16; i++) { const t = i / 16, k = 0.5 - 0.5 * Math.cos(Math.PI * t); curve.push([z(drop + (dEnd - drop) * t), rpH + (beamTop - rpH) * k]); }
  b.add('paint_black', extrudeSide([...curve, ...curve.slice().reverse().map(([zz, y]) => [zz, y - 0.035] as [number, number])], -rpW, rpW));
  for (const s of [1, -1]) b.add('paint_black', extrudeSide([...curve, [z(dEnd), beamTop - 0.3], [z(drop), rpH - 0.24]], s * (rpW - 0.02), s * rpW));
  const fs = v('frontStepD');
  for (const s of [1, -1]) {
    b.add('paint_black', boxMinMax(s * (rpW - 0.03), 0.32, z(fs + 0.12), s * (rpW - 0.01), beamTop - 0.25, z(fs - 0.12)));
    for (const h of [0.34, 0.72]) b.add('steel', boxMinMax(s * (rpW - 0.32), h - 0.025, z(fs + 0.14), s * (rpW - 0.01), h, z(fs - 0.14)));
  }

  // --- cylinders: squared cladding over cylinder + valve chest, covers, drain cocks
  const geo = motionGeometry(), w = strokeDir(geo), pitch = Math.atan2(w[1], w[0]);
  for (const s of [1, -1]) {
    const x = s * v('cylLateral'), cf0 = v('cylFrontD'), cr0 = v('cylRearD');
    const g = roundBox(-0.27, 0.66, 0.27, 1.72, z(cr0), z(cf0), 0.08);
    g.translate(x, 0, 0); g.rotateX(-pitch * 0.0); b.add('paint_black', g);
    b.add('paint_black', cylZ(0.3, 0.3, z(cf0) - 0.01, z(cf0) + 0.05, x, v('cylCentreH'), 28)); // front cover
    b.add('paint_black', cylZ(0.24, 0.24, z(cf0) + 0.05, z(cf0) + 0.09, x, v('valveChestH'), 24));
    b.add('steel', cylZ(0.1, 0.12, z(cr0), z(cr0) - 0.12, x, v('cylCentreH'), 16));     // gland
    for (const d of [cf0 + 0.1, cr0 - 0.1]) {
      b.add('steel', cylBetween(new THREE.Vector3(x, 0.66, z(d)), new THREE.Vector3(x + s * 0.05, 0.42, z(d) + 0.05), 0.018, 6));
    }
  }

  // --- along the running plate: lubricators (right, measured), sandbox fillers, pipes
  for (const d of [v('lubricator1D'), v('lubricator2D')]) {
    b.add('paint_black', roundBox(-rpW + 0.12, rpH, -rpW + 0.42, rpH + 0.26, z(d + 0.15), z(d - 0.15), 0.03));
    b.add('steel', cylZ(0.04, 0.04, z(d) - 0.02, z(d) + 0.02, -rpW + 0.27, rpH + 0.3, 10));
  }
  b.add('steel', pipe([new THREE.Vector3(-rpW + 0.3, rpH + 0.05, z(v('lubricator2D') - 0.15)), new THREE.Vector3(-rpW + 0.35, rpH + 0.05, z(5.6)), new THREE.Vector3(-rpW + 0.3, rpH + 0.04, z(3.4)), new THREE.Vector3(-v('cylLateral'), rpH - 0.1, z(3.0))], 0.012));
  const axles = engineAxlesD();
  // sandbox fillers on the running plate; sand pipes come down inside the rods to just in front of
  // the leading and driving wheels' treads (and behind the driving wheels for running backwards)
  const rD0 = v('driverDia') / 2, xt = v('wheelTreadOffset');
  for (const s of [1, -1]) for (const [d, ahead] of [[axles.lead, true], [axles.drive, true], [axles.drive, false]] as const) {
    const dd = ahead ? d - rD0 - 0.06 : d + rD0 + 0.06;
    if (ahead) b.add('paint_black', latheY([[0, 0], [0.07, 0], [0.07, 0.05], [0.05, 0.07], [0, 0.07]], s * 0.8, rpH, z(dd), 12));
    b.add('steel', pipe([new THREE.Vector3(s * 0.66, rpH - 0.3, z(dd)), new THREE.Vector3(s * 0.7, 0.7, z(dd)), new THREE.Vector3(s * xt, 0.12, z(dd) + (ahead ? -0.04 : 0.04))], 0.016, 6));
  }

  // --- nameplate brackets (plates themselves are decals in livery) and AWS/TPWS electrical boxes
  for (const s of [1, -1]) {
    b.add('paint_black', boxMinMax(s * 0.92, rpH, z(v('nameplateRearD') - 0.1), s * 0.94, rpH + 0.12, z(v('nameplateFrontD') + 0.1)));
    b.add('paint_black', roundBox(s > 0 ? rpW - 0.45 : -rpW + 0.05, rpH - 0.02, s > 0 ? rpW - 0.05 : -rpW + 0.45, rpH + 0.32, z(drop + 0.55), z(drop + 0.15), 0.02));
  }
  b.add('steel', boxMinMax(-0.18, 0.12, z(axles.bogieFront + 0.6), 0.18, 0.2, z(axles.bogieFront + 0.25))); // AWS receiver

  // --- coupled-wheel axleboxes, springs (under-hung), brake hangers and blocks; bogie frame
  const rD = v('driverDia') / 2;
  for (const d of [axles.lead, axles.drive, axles.trail]) for (const s of [1, -1]) {
    const x = s * (fw + 0.07);
    b.add('paint_black', boxMinMax(x - 0.08, rD - 0.18, z(d) - 0.17, x + 0.08, rD + 0.2, z(d) + 0.17));
    b.add('paint_black', boxMinMax(x - 0.06, rD - 0.42, z(d) - 0.55, x + 0.06, rD - 0.33, z(d) + 0.55));
    b.add('paint_black', boxMinMax(x - 0.05, rD - 0.33, z(d) - 0.05, x + 0.05, rD - 0.18, z(d) + 0.05));
    if (DETAIL >= 0.5) {
      const bz = z(d) + rD + 0.05, hx = s * (v('wheelTreadOffset'));
      b.add('paint_black', boxMinMax(hx - 0.04, rD - 0.25, bz - 0.04, hx + 0.04, rD + 0.55, bz + 0.04));
      b.add('steel', boxMinMax(hx - 0.07, rD - 0.25, bz - 0.06, hx + 0.07, rD + 0.12, bz + 0.02));
    }
  }
  const bf = z(axles.bogieFront), br = z(axles.bogieRear), rB = v('bogieWheelDia') / 2;
  for (const s of [1, -1]) {
    b.add('paint_black', boxMinMax(s * 0.56, rB - 0.2, br - 0.45, s * 0.6, rB + 0.28, bf + 0.45));
    for (const zz of [bf, br]) b.add('paint_black', boxMinMax(s * 0.6, rB - 0.15, zz - 0.16, s * 0.7, rB + 0.18, zz + 0.16));
  }
  b.add('paint_black', boxMinMax(-0.6, rB + 0.18, (bf + br) / 2 - 0.35, 0.6, rB + 0.35, (bf + br) / 2 + 0.35));
  void PLANES;
}
