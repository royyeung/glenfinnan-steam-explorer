// Smokebox, chimney, taper boiler, Belpaire firebox and boiler-top fittings.
import * as THREE from 'three';
import { B5, zEngine } from '../../specs/black5.ts';
import { Batch, DETAIL, bandZ, boxMinMax, cylBetween, cylZ, extrudeSection, latheY, loftZ, pipe, rivets } from '../geom.ts';
import { arc } from './wheels.ts';

const v = (k: keyof typeof B5) => B5[k].v;
const z = zEngine;

/** Boiler geometry helpers shared with other modules (cab, pipework, livery). */
export function boilerShape() {
  const sbR = v('smokeboxDia') / 2, sbY = v('smokeboxTopH') - sbR;
  const rF = v('barrelFrontDia') / 2, rR = v('barrelRearDia') / 2, yb = sbY - rF;
  const t = (d: number) => (d - v('smokeboxRearD')) / (v('barrelRearD') - v('smokeboxRearD'));
  const radiusAt = (d: number) => rF + (rR - rF) * Math.min(1, Math.max(0, t(d)));
  return { sbR, sbY, yb, radiusAt, centreAt: (d: number) => yb + radiusAt(d), topAt: (d: number) => yb + 2 * radiusAt(d) };
}

export function boiler(b: Batch) {
  const B = boilerShape(), { sbR, sbY } = B, rpH = v('runningPlateH');
  const sF = v('smokeboxFrontD'), sR = v('smokeboxRearD'), door = v('smokeboxDoorD');

  // --- smokebox: shell, front ring with rivets, dished door, hinges, dart, plates, saddle
  b.add('smokebox', cylZ(sbR, sbR, z(sF), z(sR), 0, sbY, 56));
  b.add('smokebox', bandZ(sbR, 0.06, 0.012, z(sR) + 0.03, 0, sbY));
  const ringR = v('doorRingDia') / 2;
  b.add('smokebox', cylZ(sbR - 0.02, ringR + 0.04, z(sF), z(sF) + 0.05, 0, sbY, 56));
  if (DETAIL >= 0.5) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * (ringR + 0.075), sbY + Math.sin(a) * (ringR + 0.075), z(sF) + 0.05)); }
    b.add('smokebox', rivets(pts, 0.012, 'z'));
  }
  // dished door: lathe about +Z (built along Y, then turned)
  const doorG = latheY([[0, 0.11], [ringR * 0.55, 0.09], [ringR * 0.88, 0.05], [ringR, 0.0], [ringR - 0.01, -0.02], [0, -0.02]], 0, 0, 0, 48);
  doorG.rotateX(Math.PI / 2); doorG.translate(0, sbY, z(sF) + 0.04);
  b.add('smokebox', doorG);
  for (const dy of [0.42, -0.42]) { // hinge straps across the door
    b.add('steel', boxMinMax(-ringR * 0.92, sbY + dy - 0.025, z(door) - 0.012, ringR * 0.25, sbY + dy + 0.025, z(door) + 0.02));
    b.add('steel', cylZ(0.035, 0.035, z(sF) + 0.02, z(sF) + 0.1, -ringR - 0.02, sbY + dy, 12));
  }
  // dart: central boss with handle and locking handle
  b.add('steel', cylZ(0.05, 0.04, z(door) + 0.03, z(door) - 0.06, 0, sbY, 16));
  b.add('steel', boxMinMax(-0.22, sbY - 0.015, z(door) - 0.07, 0.22, sbY + 0.015, z(door) - 0.04));
  b.add('steel', boxMinMax(-0.012, sbY - 0.22, z(door) - 0.1, 0.012, sbY + 0.01, z(door) - 0.07));
  // numberplate (decal painted by the app) and shed plate
  b.add('decal_numberplate', boxMinMax(-0.27, sbY + 0.3, z(door) - 0.02, 0.27, sbY + 0.43, z(door) - 0.035));
  b.add('decal_shedplate', ellipseZ(0.085, 0.055, z(door) + 0.0, 0, sbY - 0.55));
  // lamp iron on top of the smokebox and a handrail across the front
  b.add('steel', boxMinMax(-0.02, v('smokeboxTopH') - 0.02, z(sF) - 0.03, 0.02, v('smokeboxTopH') + 0.1, z(sF) - 0.05));
  b.add('steel', pipe([new THREE.Vector3(-0.55, sbY + 0.62, z(sF) + 0.06), new THREE.Vector3(0, sbY + 0.7, z(sF) + 0.06), new THREE.Vector3(0.55, sbY + 0.62, z(sF) + 0.06)], 0.014));
  // saddle
  b.add('smokebox', boxMinMax(-0.62, rpH - 0.3, z(sF + 0.25), 0.62, sbY - 0.2, z(sR - 0.25)));

  // --- outside steam pipes: from the smokebox side down to the valve chests (both sides)
  const spD = v('steamPipeD');
  for (const s of [1, -1]) {
    const x = s * (sbR - 0.05), top = sbY + 0.15;
    const g = extrudeSection(roundTop(0.16, top - rpH), z(spD + 0.09), z(spD - 0.09));
    g.translate(x, rpH, 0);
    b.add('smokebox', g);
  }

  // --- chimney (lipped, with a skirt blending into the smokebox curvature)
  const chBase = v('smokeboxTopH') - 0.1, chTop = v('height') - chBase, lip = v('chimneyLipDia') / 2;
  b.add('smokebox', latheY([[0, 0], [0.52, 0], [0.47, 0.05], [0.36, 0.1], [0.3, 0.16], [0.27, 0.22], [0.27, chTop - 0.12], [0.29, chTop - 0.08], [lip - 0.02, chTop - 0.06], [lip, chTop - 0.035], [lip, chTop - 0.005], [0.255, chTop], [0.24, chTop - 0.25], [0, chTop - 0.25]], 0, chBase, z(v('chimneyD')), 40));

  // --- taper boiler with lined bands (lining strips added by livery)
  const rings = Array.from({ length: 9 }, (_, i) => {
    const d = sR + (v('barrelRearD') - sR) * (i / 8);
    return { z: z(d), y: B.centreAt(d), r: B.radiusAt(d) };
  });
  b.add('paint_black', loftZ(rings, 0, 56));
  for (const d of bandPositions()) b.add('paint_black', bandZ(B.radiusAt(d), 0.075, 0.006, z(d), 0, B.centreAt(d)));

  // --- Belpaire firebox: flat top, rounded shoulders, front throat-plate step
  const fT = v('fireboxTopH'), fw = v('fireboxWidthTop') / 2, sh = 0.26;
  const sect: [number, number][] = [[-0.82, rpH], [0.82, rpH], [fw, fT - sh],
    ...arc(sh, 0, Math.PI / 2, 8).map(([c, s2]) => [fw - sh + c, fT - sh + s2] as [number, number]),
    ...arc(sh, Math.PI / 2, Math.PI, 8).map(([c, s2]) => [-fw + sh + c, fT - sh + s2] as [number, number]), [-fw, fT - sh]];
  b.add('paint_black', extrudeSection(sect, z(v('cabFrontD')), z(v('barrelRearD'))));
  if (DETAIL >= 0.5) {
    const plugs: THREE.Vector3[] = [];
    for (const s of [1, -1]) for (let i = 0; i < 4; i++) plugs.push(new THREE.Vector3(s * (fw + 0.004), fT - 0.42, z(v('barrelRearD') + 0.45 + i * 0.6)));
    b.add('steel', rivets(plugs, 0.03, 'x'));
  }

  // --- dome, top feed with clack pipes, safety valves, whistle
  const domeBase = B.topAt(v('domeD')) - 0.14, domeH = v('domeTopH') - domeBase, dr = v('domeDia') / 2;
  b.add('paint_black', latheY([[0, 0], [dr + 0.05, 0], [dr + 0.01, 0.07], [dr - 0.02, domeH * 0.55], [dr * 0.8, domeH * 0.86], [dr * 0.45, domeH * 0.985], [0, domeH]], 0, domeBase, z(v('domeD')), 40));
  const tf = v('topFeedD'), tfBase = B.topAt(tf) - 0.1, tfTop = v('topFeedTopH');
  b.add('paint_black', extrudeSection(roundTop(0.2, tfTop - tfBase), z(tf + 0.16), z(tf - 0.16)).translate(0, tfBase, 0));
  for (const s of [1, -1]) {
    const p0 = new THREE.Vector3(s * 0.2, tfTop - 0.12, z(tf));
    const p1 = new THREE.Vector3(s * (B.radiusAt(tf) * 0.82), B.centreAt(tf) + B.radiusAt(tf) * 0.6, z(tf + 0.15));
    const p2 = new THREE.Vector3(s * (B.radiusAt(tf + 1.5) + 0.03), B.centreAt(tf + 1.5) + 0.1, z(tf + 1.5));
    const p3 = new THREE.Vector3(s * (B.radiusAt(v('barrelRearD')) + 0.04), rpH + 0.25, z(v('barrelRearD') + 0.5));
    b.add('paint_black', pipe([p0, p1, p2, p3], 0.03)); // feed pipes are painted on 45407
  }
  for (const dd of [-0.1, 0.1]) b.add('brass', latheY([[0, 0], [0.085, 0], [0.08, 0.06], [0.07, 0.08], [0.06, 0.13], [0.03, 0.15], [0, 0.155]], 0, fT - 0.02, z(v('safetyValveD') + dd), 20));
  b.add('steel', boxMinMax(-0.13, fT - 0.02, z(v('safetyValveD') + 0.24), 0.13, fT + 0.025, z(v('safetyValveD') - 0.24))); // valve seating
  const wd = v('cabFrontD') - 0.3;
  b.add('brass', latheY([[0, 0], [0.035, 0], [0.035, 0.12], [0.05, 0.14], [0.05, 0.32], [0.04, 0.34], [0, 0.35]], 0.18, fT - 0.02, z(wd), 16));

  // --- handrails on stanchions along both sides of the boiler
  if (DETAIL >= 0.5) for (const s of [1, -1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = sF + 0.15 + (v('barrelRearD') - sF - 0.15) * (i / 6), r = d < sR ? sbR : B.radiusAt(d), cy = d < sR ? sbY : B.centreAt(d);
      const hy = cy + r * 0.62, hx = s * (r * 0.79 + 0.07);
      pts.push(new THREE.Vector3(hx, hy, z(d)));
      b.add('steel', cylBetween(new THREE.Vector3(s * r * 0.77, hy, z(d)), new THREE.Vector3(hx, hy, z(d)), 0.01, 6));
    }
    b.add('steel', pipe(pts, 0.014, 8, 0.1));
  }
}

/** Boiler band positions (d), measured on S33 plus the barrel ends. */
export function bandPositions() { return [v('smokeboxRearD') + 0.05, 4.86, 6.16, v('barrelRearD') - 0.06]; }

/** Rectangle with a semicircular top: width w, height h, base at y = 0, centred on x = 0. */
function roundTop(w: number, h: number): [number, number][] {
  const r = w / 2;
  return [[-r, 0], [r, 0], ...arc(r, 0, Math.PI, 10).map(([x, y]) => [x, h - r + y] as [number, number])];
}

/** Flat ellipse plate facing +Z at z, centre (x, y). */
function ellipseZ(rx: number, ry: number, zz: number, x: number, y: number) {
  const g = new THREE.CircleGeometry(1, 24); g.scale(rx, ry, 1); g.translate(x, y, zz + 0.03);
  return g;
}
