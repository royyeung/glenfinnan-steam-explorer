// Cab exterior (the interior is Phase 3): spectacle plate, side sheets with the curved doorway
// edge and two-pane windows, roof with gutters and ventilator, steps, handrails, floor, injectors.
import * as THREE from 'three';
import { B5, zEngine } from '../../specs/black5.ts';
import { Batch, DETAIL, boxMinMax, cylBetween, cylX, extrudeSection, extrudeSide, pipe, roundedRect } from '../geom.ts';
import { arc } from './wheels.ts';
import { fireholeOutline } from './cabInterior.ts';

const v = (k: keyof typeof B5) => B5[k].v;
const z = zEngine;

export function cabShape() {
  const cw = v('cabWidth') / 2, eave = 3.45, roof = v('cabRoofH');
  const sag = roof - eave, R = (cw * cw + sag * sag) / (2 * sag), yc = roof - R;
  const roofArc = (dr: number, half = cw, n = 20) => { const a = Math.asin(Math.min(1, half / R));
    return arc(R + dr, Math.PI / 2 + a, Math.PI / 2 - a, n).map(([x, y]) => [x, y + yc] as [number, number]); };
  return { cw, eave, roof, roofArc };
}

export function cab(b: Batch) {
  const { cw, eave, roofArc } = cabShape(), cf = v('cabFrontD'), rear = v('cabRoofRearD'), rpH = v('runningPlateH');
  const open = v('cabOpeningFrontD'), sideBot = v('cabSideBottomH');

  // spectacle plate with two round-cornered front windows each side of the firebox
  const front: [number, number][] = [[-cw, rpH], [cw, rpH], ...roofArc(0).reverse()];
  // front windows: tall, outboard of the firebox (U01 photo)
  const spect = (s: number) => roundedRect(s > 0 ? 0.86 : -1.2, 2.72, s > 0 ? 1.2 : -0.86, 3.3, 0.07).map(([x, y]) => [x, y] as [number, number]).reverse();
  b.add('paint_black', extrudeSection(front, z(cf), z(cf + 0.025), [spect(1), spect(-1), fireholeOutline()]));
  for (const s of [1, -1]) {
    b.add('glass', extrudeSection(spect(s).slice().reverse(), z(cf + 0.01), z(cf + 0.015)));
    const rim = rimOf(spect(s), 0.02); b.add('steel', extrudeSection(rim.outer, z(cf - 0.005), z(cf + 0.002), [rim.inner]));
  }

  // roof: outer shell (top at the measured height), gutters, ventilator hatch, inner lining
  b.add('paint_black', extrudeSection([...roofArc(0), ...roofArc(-0.03).reverse()], z(cf - 0.06), z(rear)));
  for (const s of [1, -1]) b.add('paint_black', boxMinMax(s * (cw - 0.01), eave - 0.03, z(rear), s * (cw + 0.04), eave + 0.02, z(cf - 0.06)));
  b.add('paint_black', boxMinMax(-0.3, v('cabRoofH') - 0.02, z(cf + 1.5), 0.3, v('cabRoofH') + 0.05, z(cf + 0.85)));
  b.add('cab_inside', extrudeSection([...roofArc(-0.035, cw - 0.05), ...roofArc(-0.05, cw - 0.05).reverse()], z(cf), z(rear - 0.06)));

  // side sheets: straight front edge, window, then the doorway edge curving back under the roof
  const win = [v('cabWindowFrontD'), v('cabWindowRearD'), v('cabWindowBottomH'), v('cabWindowTopH')];
  for (const s of [1, -1]) {
    // side sheet from the spectacle plate back to the entrance; the entrance (d 11.79-12.43) has a
    // half-height gate (separate node, see cabGates) and is open above it up to the roof
    const zo = z(open), rc = 0.12;
    const outline: [number, number][] = [[z(cf), sideBot], [z(cf), eave]];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); outline.push([zo + rc - Math.sin(a) * rc, eave - rc + Math.cos(a) * rc]); }
    outline.push([zo, sideBot]);
    const hole = roundedRect(z(win[0]), win[2], z(win[1]), win[3], 0.06).map(([zz, y]) => [zz, y] as [number, number]);
    b.add('paint_black', extrudeSide(dedupe(outline), s * cw, s * (cw - 0.025), [hole]));
    // window frame with a central upright (two sliding panes) and glass
    const rim = rimOf(hole, 0.025); b.add('steel', extrudeSide(rim.outer, s * (cw + 0.004), s * (cw - 0.03), [rim.inner]));
    const midZ = (z(win[0]) + z(win[1])) / 2;
    b.add('paint_black', boxMinMax(s * (cw - 0.03), win[2], midZ - 0.02, s * (cw + 0.004), win[3], midZ + 0.02));
    b.add('glass', extrudeSide(hole, s * (cw - 0.012), s * (cw - 0.016)));
    // steps below the doorway (outer edge 1.41 m from centre), hangers, handrails
    const d0 = v('cabOpeningFrontD') + 0.04, d1 = v('cabOpeningRearD') - 0.06, so = cw + 0.1, si = cw - 0.25;
    for (const h of [v('cabStepLowerH'), v('cabStepUpperH')]) b.add('steel', boxMinMax(s * si, h - 0.03, z(d0), s * so, h, z(d1)));
    for (const dd of [d0, d1 - 0.03]) b.add('paint_black', boxMinMax(s * (so - 0.02), v('cabStepLowerH') - 0.05, z(dd), s * so, v('cabStepUpperH'), z(dd + 0.03)));
    b.add('steel', cylBetween(new THREE.Vector3(s * (cw + 0.05), 1.75, z(open + 0.04)), new THREE.Vector3(s * (cw + 0.05), 3.15, z(open + 0.04)), 0.016, 8));
    for (const yy of [1.75, 3.15]) b.add('steel', cylBetween(new THREE.Vector3(s * cw, yy, z(open + 0.04)), new THREE.Vector3(s * (cw + 0.05), yy, z(open + 0.04)), 0.01, 6));
    // injector below the cab with delivery and overflow pipes
    if (DETAIL >= 0.5) {
      const ix = s * (v('frameWidth') / 2 + 0.12), iz = z(10.6);
      b.add('steel', cylX(0.07, 0.25, ix, 1.15, iz, 12));
      b.add('steel', pipe([new THREE.Vector3(ix, 1.15, iz), new THREE.Vector3(ix, 1.5, iz + 0.3), new THREE.Vector3(s * 0.95, rpH + 0.2, z(9.6))], 0.03));
      b.add('steel', pipe([new THREE.Vector3(ix, 1.1, iz), new THREE.Vector3(ix, 0.6, iz - 0.1), new THREE.Vector3(ix, 0.3, iz - 0.15)], 0.02));
    }
  }
  b.add('smokebox', boxMinMax(-cw + 0.03, v('footplateH') - 0.04, z(cf), cw - 0.03, v('footplateH'), z(v('engineRearD')))); // footplate (detailed in Phase 3)
}

function dedupe(pts: [number, number][]) {
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-4);
}

/** A thin frame (rim) around a closed outline: outer offset w (radially from the centroid), inner = outline. */
function rimOf(outline: [number, number][], w: number) {
  const c = outline.reduce((acc, p) => [acc[0] + p[0] / outline.length, acc[1] + p[1] / outline.length], [0, 0]);
  const outer = outline.map(([x, y]) => { const dx = x - c[0], dy = y - c[1], l = Math.hypot(dx, dy) || 1; return [x + (dx / l) * w, y + (dy / l) * w] as [number, number]; });
  return { outer, inner: outline };
}

/** Half-height cab gates, one per side, hinged at the front edge of the entrance (named nodes). */
export function cabGates(mats: Record<string, THREE.Material>) {
  const { cw } = cabShape(), out: THREE.Group[] = [];
  const w = v('cabOpeningRearD') - v('cabOpeningFrontD') - 0.02, h = v('cabGateTopH') - v('footplateH') - 0.05;
  for (const [S, s] of [['L', 1], ['R', -1]] as const) {
    const b = new Batch();
    // gate modelled from its hinge (origin) backwards along -Z
    b.add('paint_black', boxMinMax(-0.012, 0, -w, 0.012, h, 0));
    b.add('steel', boxMinMax(-0.02, h - 0.03, -w, 0.02, h + 0.01, 0));
    const g = new THREE.Group(); g.name = `cab_gate_${S}`;
    for (const m of b.build(g.name, mats as never)) g.add(m);
    g.position.set(s * (cw - 0.012), v('footplateH') + 0.04, z(v('cabOpeningFrontD') + 0.01));
    out.push(g);
  }
  return out;
}
