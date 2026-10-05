// BR lined black (cream outer line, red inner line) and decal panels. Decal panels carry plain
// materials (decal_*); the app paints canvas textures onto them by material name at load time.
// Positions measured on S33 (right side, 22 Oct 2025); the left side mirrors them.
import * as THREE from 'three';
import { B5, zEngine, zTender } from '../../specs/black5.ts';
import { Batch, DETAIL, bandZ, boxMinMax, liningSide, roundedRect } from '../geom.ts';
import { bandPositions, boilerShape } from './boiler.ts';
import { cabShape } from './cab.ts';

const v = (k: keyof typeof B5) => B5[k].v;

/** A decal panel facing outwards on side s (+1 left/+X, -1 right/-X); text reads front-to-back. */
function sideDecal(w: number, h: number, x: number, y: number, zz: number, s: number) {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
  g.translate(x, y, zz);
  return g;
}

function linedPanel(b: Batch, zf: number, zr: number, y0: number, y1: number, r: number, x: number, s: number) {
  const outer = roundedRect(zr, y0, zf, y1, r, 6);
  const inner = roundedRect(zr + 0.045, y0 + 0.045, zf - 0.045, y1 - 0.045, Math.max(0.02, r - 0.045), 6);
  b.add('lining', liningSide(outer, 0.014, x, x + s * 0.004));
  b.add('lining_red', liningSide(inner, 0.008, x, x + s * 0.004));
}

export function engineLivery(b: Batch) {
  const z = zEngine, { cw } = cabShape(), rpW = v('runningPlateWidth') / 2, rpH = v('runningPlateH');
  for (const s of [1, -1]) {
    // cab side panel around the number (measured d 10.25-11.56, h 1.70-2.23)
    linedPanel(b, z(10.25), z(11.56), 1.7, 2.23, 0.06, s * (cw + 0.001), s);
    b.add('decal_cabnum', sideDecal(1.05, 0.42, s * (cw + 0.006), 1.97, z(10.9), s));
    // valance: red line along the running-plate edge
    if (DETAIL >= 0.5) b.add('lining_red', boxMinMax(s * (rpW + 0.001), rpH - 0.13, z(v('cabFrontD')), s * (rpW + 0.004), rpH - 0.12, z(v('runningPlateDropD'))));
    // cylinder ends lined red
    for (const d of [v('cylFrontD') + 0.04, v('cylRearD') - 0.04]) b.add('lining_red', boxMinMax(s * (v('cylLateral') + 0.271), 0.7, z(d) - 0.004, s * (v('cylLateral') + 0.274), 1.68, z(d) + 0.004));
    // nameplate (arched plate, painted) with the regimental crest above
    const nf = v('nameplateFrontD'), nr = v('nameplateRearD');
    b.add('decal_nameplate', sideDecal(nr - nf, 0.3, s * 0.945, rpH + 0.22, z((nf + nr) / 2), s));
    b.add('decal_crest', sideDecal(0.2, 0.24, s * 0.945, rpH + 0.5, z((nf + nr) / 2), s));
  }
  // boiler bands: red lines either side of each band
  const B = boilerShape();
  if (DETAIL >= 0.5) for (const d of bandPositions()) for (const dd of [-0.05, 0.05]) b.add('lining_red', bandZ(B.radiusAt(d) + 0.002, 0.008, 0.002, z(d + dd), 0, B.centreAt(d)));
  // headboard on the top lamp iron (blue arched board, 2025 photos)
  // headboard hangs on the top lamp iron, overlapping the top of the smokebox door (2025 photos)
  const hb = new THREE.PlaneGeometry(0.95, 0.32); hb.translate(0, v('smokeboxTopH') - 0.2, z(v('smokeboxDoorD') - 0.12));
  b.add('decal_headboard', hb);
}

export function tenderLivery(b: Batch) {
  const z = zTender, tw = v('tenderWidth') / 2;
  for (const s of [1, -1]) {
    linedPanel(b, z(12.62), z(18.85), 1.28, 2.5, 0.12, s * (tw + 0.001), s);
    b.add(s > 0 ? 'decal_emblem_l' : 'decal_emblem', sideDecal(0.66, 0.6, s * (tw + 0.006), 2.13, z(15.66), s));
  }
}
