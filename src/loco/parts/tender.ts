// Stanier-type tender as carried by 45407 (4,710 gal tank, S2): body with the coal-space sides
// curving down at the front and stepping down at the rear, coal heap, water filler, outside frames
// with axleboxes and leaf springs, brakes, rear buffer beam, coupling, hoses, ladder and lamps.
import * as THREE from 'three';
import { B5, tenderAxlesD, zTender } from '../../specs/black5.ts';
import { Batch, DETAIL, boxMinMax, cylBetween, extrudeSection, extrudeSide, latheY, pipe, roundBox } from '../geom.ts';
import { buffer, couplingAndHoses } from './running.ts';
import { wheelset } from './wheels.ts';
import type { MatKey } from '../materials.ts';

const v = (k: keyof typeof B5) => B5[k].v;
const z = zTender;
type Mats = Record<MatKey, THREE.Material>;

export function tenderSideProfile() {
  const front = v('tenderFrontD'), side = v('tenderSideTopH'), top = v('tenderTankTopH'), step = v('tenderStepD');
  const prof: [number, number][] = [[z(front), top], [z(front), 2.95]];
  for (let i = 1; i <= 10; i++) { const t = i / 10; prof.push([z(front + 0.38 * t), 2.95 + (side - 2.95) * Math.sin((t * Math.PI) / 2)]); }
  prof.push([z(step - 0.3), side]);
  for (let i = 1; i <= 10; i++) { const t = i / 10; prof.push([z(step - 0.3 + 0.36 * t), side - (side - top) * (0.5 - 0.5 * Math.cos(Math.PI * t))]); }
  prof.push([z(step + 0.06), top]);
  return prof;
}

export function tenderBody(b: Batch) {
  const tw = v('tenderWidth') / 2, front = v('tenderFrontD'), rear = v('tenderBodyRearD'), bot = v('tenderTankBottomH');
  const top = v('tenderTankTopH'), side = v('tenderSideTopH'), step = v('tenderStepD');
  // tank: rounded upper edges along the length
  b.add('paint_black', roundBox(-tw, bot, tw, top, z(rear), z(front), 0.06));
  b.add('paint_black', boxMinMax(-tw - 0.015, bot - 0.06, z(rear), tw + 0.015, bot, z(front))); // bottom angle
  // coal-space side sheets with the flared curve at the front and the step at the rear
  const prof = tenderSideProfile();
  for (const s of [1, -1]) b.add('paint_black', extrudeSide(prof, s * tw, s * (tw - 0.03)));
  // front bulkhead with coal doors and the shovelling plate, rear coal plate
  // front bulkhead and coal doors: grimy, coal-dusted (matt)
  b.add('smokebox', boxMinMax(-tw, top, z(front + 0.02), tw, 2.95, z(front + 0.06)));
  b.add('smokebox', boxMinMax(-0.4, top - 0.65, z(front - 0.01), 0.4, top + 0.25, z(front + 0.02)));
  b.add('paint_black', boxMinMax(-tw + 0.03, top, z(step - 0.32), tw - 0.03, side - 0.1, z(step - 0.28)));
  // coal heap: bumpy surface between the sides (procedural lumps)
  const coal = new THREE.PlaneGeometry(2 * tw - 0.1, step - 0.4 - (front + 0.12), Math.round(18 * DETAIL) + 2, Math.round(40 * DETAIL) + 2);
  coal.rotateX(-Math.PI / 2);
  const p = coal.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), zz = p.getZ(i), edge = 1 - Math.pow(Math.abs(x) / tw, 4);
    const lump = 0.05 * Math.sin(x * 23.1 + zz * 7.3) * Math.cos(zz * 19.7 - x * 5.1) + 0.03 * Math.sin(x * 51 + zz * 43);
    p.setY(i, side - 0.12 + 0.2 * edge + lump);
  }
  coal.computeVertexNormals();
  coal.translate(0, 0, (z(front + 0.12) + z(step - 0.4)) / 2);
  b.add('coal', coal);
  // rear tank top: water filler with hinged lid, vents, handrails; ladder and lamp irons on the back
  b.add('paint_black', latheY([[0, 0], [0.28, 0], [0.28, 0.12], [0.24, 0.16], [0, 0.17]], 0.45, top, z(18.45), 24));
  b.add('steel', cylBetween(new THREE.Vector3(0.2, top + 0.17, z(18.45)), new THREE.Vector3(0.7, top + 0.17, z(18.45)), 0.015, 6));
  for (const x of [-0.6, 0.0]) b.add('paint_black', latheY([[0, 0], [0.05, 0], [0.05, 0.14], [0.07, 0.16], [0, 0.17]], x, top, z(18.0), 12)); // tank vents
  if (DETAIL >= 0.5) {
    for (const s of [1, -1]) {
      b.add('steel', cylBetween(new THREE.Vector3(s * 0.25, bot, z(rear) - 0.12), new THREE.Vector3(s * 0.25, top + 0.05, z(rear) - 0.12), 0.015, 6));
      b.add('steel', cylBetween(new THREE.Vector3(s * (tw + 0.04), 1.3, z(front) - 0.08), new THREE.Vector3(s * (tw + 0.04), 2.95, z(front) - 0.08), 0.016, 8));
    }
    for (let i = 0; i < 6; i++) b.add('steel', cylBetween(new THREE.Vector3(-0.25, bot + 0.2 + i * 0.25, z(rear) - 0.12), new THREE.Vector3(0.25, bot + 0.2 + i * 0.25, z(rear) - 0.12), 0.012, 6));
    for (const x of [-0.75, 0, 0.75]) b.add('steel', boxMinMax(x - 0.02, top - 0.05, z(rear) - 0.02, x + 0.02, top + 0.08, z(rear) - 0.05));
  }
  // underframe: outside frames, axleboxes, leaf springs, brake hangers and blocks, steps, tool boxes
  const fr = 1.06, r = v('tenderWheelDia') / 2;
  for (const s of [1, -1]) {
    b.add('paint_black', boxMinMax(s * (fr - 0.03), 0.55, z(rear), s * fr, bot - 0.05, z(front + 0.05)));
    for (const d of tenderAxlesD()) {
      b.add('paint_black', boxMinMax(s * (fr - 0.02), r - 0.2, z(d) - 0.17, s * (fr + 0.14), r + 0.2, z(d) + 0.17));
      b.add('steel', boxMinMax(s * (fr - 0.01), r + 0.21, z(d) - 0.55, s * (fr + 0.12), r + 0.29, z(d) + 0.55));
      for (const k of [0.1, 0.2]) b.add('steel', boxMinMax(s * (fr + 0.0), r + 0.21 - k * 0.3, z(d) - 0.55 + k * 1.6, s * (fr + 0.11), r + 0.24 - k * 0.3, z(d) + 0.55 - k * 1.6));
      if (DETAIL >= 0.5) {
        const bz = z(d) - r - 0.06, hx = s * v('wheelTreadOffset');
        b.add('paint_black', boxMinMax(hx - 0.04, r - 0.2, bz - 0.04, hx + 0.04, bot - 0.06, bz + 0.04));
        b.add('steel', boxMinMax(hx - 0.07, r - 0.22, bz - 0.02, hx + 0.07, r + 0.1, bz + 0.06));
      }
    }
    b.add('steel', boxMinMax(s * (tw - 0.3), 0.55, z(front + 0.06), s * (tw - 0.02), 0.58, z(front + 0.36)));
    b.add('steel', boxMinMax(s * (tw - 0.3), 1.0, z(front + 0.06), s * (tw - 0.02), 1.03, z(front + 0.36)));
  }
  b.add('paint_black', roundBox(-0.9, bot - 0.4, -0.3, bot - 0.06, z(17.6), z(16.6), 0.03)); // vacuum reservoir box
  // rear buffer beam, buffers, coupling, hoses
  const lob = v('lengthOverBuffers'), bh = v('bufferH');
  b.add('paint_red', boxMinMax(-v('beamWidth') / 2, v('beamTopH') - v('beamDepth'), z(rear), v('beamWidth') / 2, v('beamTopH'), z(rear + 0.1)));
  for (const s of [1, -1]) buffer(b, s * v('bufferCentres') / 2, bh, z(lob), -1, z(rear + 0.1));
  couplingAndHoses(b, z(rear + 0.1), -1, bh);
  // tank vent pipes and the water-gauge/scoop gear at the front (simplified)
  if (DETAIL >= 0.5) b.add('steel', pipe([new THREE.Vector3(0.7, top, z(front + 0.3)), new THREE.Vector3(0.7, top + 0.25, z(front + 0.3)), new THREE.Vector3(0.75, top + 0.3, z(front + 0.35))], 0.025));
  void extrudeSection;
}

export function tenderWheelsets(T: THREE.Group, mats: Mats) {
  const r = v('tenderWheelDia') / 2;
  tenderAxlesD().forEach((d, i) => {
    const b = wheelset(r, 12, null, null, 0), g = new THREE.Group(); g.name = `ws_t${i}`;
    for (const m of b.build(`ws_t${i}`, mats)) g.add(m);
    g.position.set(0, r, z(d)); T.add(g);
  });
}
