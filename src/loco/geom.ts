// Small geometry helpers for building vehicles in their local frame (+Z forward, +X left, Y up).
// Every helper returns a non-indexed BufferGeometry with position, normal and uv, already placed,
// so static parts can be merged per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Level-of-detail factor for parametric generation: 1 = full, 0.5 = medium, 0.25 = far. */
export let DETAIL = 1;
export function setDetail(d: number) { DETAIL = d; }
const segs = (n: number) => Math.max(6, Math.round(n * DETAIL));

const norm = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
  const n = g.index ? g.toNonIndexed() : g;
  if (!n.getAttribute('normal')) n.computeVertexNormals();
  if (!n.getAttribute('uv')) {
    const count = n.getAttribute('position').count;
    n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  return n;
};

/** Axis-aligned box from min/max corners. */
export function boxMinMax(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return norm(g);
}

/** Cylinder along X (an axle or a wheel), centred at (x, y, z). */
export function cylX(r: number, length: number, x: number, y: number, z: number, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, length, segs(seg));
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return norm(g);
}

/** Cylinder along Z (smokebox, buffers, cylinders), from z0 to z1. */
export function cylZ(r0: number, r1: number, z0: number, z1: number, x: number, y: number, seg = 32, open = false) {
  const [rLow, rHigh] = z0 < z1 ? [r0, r1] : [r1, r0];
  const g = new THREE.CylinderGeometry(rHigh, rLow, Math.abs(z1 - z0), segs(seg), 1, open);
  g.rotateX(Math.PI / 2); // +Y becomes +Z: radiusTop sits at the higher z
  g.translate(x, y, (z0 + z1) / 2);
  return norm(g);
}

/** Cylinder between two points (any direction). */
export function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 16) {
  const dir = new THREE.Vector3().subVectors(b, a), l = dir.length();
  const g = new THREE.CylinderGeometry(r, r, l, segs(seg));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return norm(g);
}

/** Vertical solid of revolution (chimney, dome) from a profile [radius, height] list. */
export function latheY(profile: [number, number][], x: number, y: number, z: number, seg = 32) {
  const g = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), segs(seg));
  g.translate(x, y, z);
  return norm(g);
}

/**
 * Side profile in the (z, y) plane extruded across X from x0 to x1.
 * Points are [z, y]; holes are optional lists of [z, y].
 */
export function extrudeSide(points: [number, number][], x0: number, x1: number, holes: [number, number][][] = [], curveSegments = 12) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.abs(x1 - x0), bevelEnabled: false, curveSegments: segs(curveSegments) });
  // shape x -> engine z, shape y -> y, extrude (+z) -> engine -x
  g.rotateY(-Math.PI / 2);
  g.translate(Math.max(x0, x1), 0, 0);
  return norm(g);
}

/** Cross-section in the (x, y) plane extruded along Z from z0 to z1. */
export function extrudeSection(points: [number, number][], z0: number, z1: number, holes: [number, number][][] = [], curveSegments = 12) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.abs(z1 - z0), bevelEnabled: false, curveSegments: segs(curveSegments) });
  g.translate(0, 0, Math.min(z0, z1));
  return norm(g);
}

/** Lofted tube along Z through rings (z, centre y, radius); open ends. Used for the taper boiler. */
export function loftZ(rings: { z: number; y: number; r: number }[], x = 0, segIn = 40) {
  const seg = segs(segIn);
  const pos: number[] = [], uv: number[] = [];
  const ring = (i: number, k: number) => {
    const a = (k / seg) * Math.PI * 2, R = rings[i];
    return [x + Math.cos(a) * R.r, R.y + Math.sin(a) * R.r, R.z];
  };
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const p00 = ring(i, k), p01 = ring(i, k + 1), p10 = ring(i + 1, k), p11 = ring(i + 1, k + 1);
      pos.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      const u0 = k / seg, u1 = (k + 1) / seg, v0 = i / (rings.length - 1), v1 = (i + 1) / (rings.length - 1);
      uv.push(u0, v0, u0, v1, u1, v1, u0, v0, u1, v1, u1, v0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // the winding above faces inward for rings ordered by increasing z; flip if needed
  const n = g.getAttribute('normal'), p = g.getAttribute('position');
  const cx = x, cy = rings[0].y;
  if ((p.getX(0) - cx) * n.getX(0) + (p.getY(0) - cy) * n.getY(0) < 0) {
    for (let i = 0; i < p.count; i += 3) {
      for (const attr of [p, g.getAttribute('uv')]) {
        const s = attr.itemSize, a = attr.array as Float32Array;
        for (let c = 0; c < s; c++) { const t = a[(i + 1) * s + c]; a[(i + 1) * s + c] = a[(i + 2) * s + c]; a[(i + 2) * s + c] = t; }
      }
    }
    g.computeVertexNormals();
  }
  return g;
}

/** Collects geometries per material key and merges them into one mesh per material. */
export class Batch {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  add(mat: string, ...gs: THREE.BufferGeometry[]) {
    const list = this.parts.get(mat) ?? [];
    list.push(...gs.map(norm));
    this.parts.set(mat, list);
  }
  build(prefix: string, materials: Record<string, THREE.Material>): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) throw new Error(`merge failed for ${prefix}/${mat}`);
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, materials[mat]);
      m.name = `${prefix}_${mat}`;
      m.castShadow = true; m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }
}

/** Pipe through points (Catmull-Rom), e.g. feed pipes, hoses, handrails. */
export function pipe(points: THREE.Vector3[], r: number, radial = 8, tension = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', tension);
  const g = new THREE.TubeGeometry(curve, Math.max(4, Math.round(points.length * 8 * DETAIL)), r, segs(radial), false);
  return norm(g);
}

/** Ring around the Z axis (boiler band / lining band) at z, centre (x, y). */
export function bandZ(R: number, width: number, thick: number, z: number, x: number, y: number, seg = 48) {
  const outer = new THREE.CylinderGeometry(R + thick, R + thick, width, segs(seg), 1, true);
  outer.rotateX(Math.PI / 2); outer.translate(x, y, z);
  return norm(outer);
}

/** Rounded rectangle outline points [u, v] (counter-clockwise). */
export function roundedRect(u0: number, v0: number, u1: number, v1: number, r: number, n = 6): [number, number][] {
  const pts: [number, number][] = [];
  const corner = (cu: number, cv: number, a0: number) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } };
  corner(u1 - r, v0 + r, -Math.PI / 2); corner(u1 - r, v1 - r, 0); corner(u0 + r, v1 - r, Math.PI / 2); corner(u0 + r, v0 + r, Math.PI);
  return pts;
}

/**
 * A lining stripe following a closed outline drawn in the side (z, y) plane at lateral x, as a
 * thin raised band: outline offset outward by w/2 and inward by w/2.
 */
export function liningSide(outline: [number, number][], w: number, x0: number, x1: number) {
  const off = (pts: [number, number][], d: number) => pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [p[0] + (ty / l) * d, p[1] - (tx / l) * d] as [number, number];
  });
  return extrudeSide(off(outline, w / 2), x0, x1, [off(outline, -w / 2).reverse()]);
}

/** Small hemispherical rivet heads on a plane facing +Z (front) or +X (side). */
export function rivets(points: THREE.Vector3[], r: number, facing: 'x' | '-x' | 'z' | '-z') {
  const gs: THREE.BufferGeometry[] = [];
  for (const p of points) {
    const g = new THREE.SphereGeometry(r, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
    if (facing === 'z') g.rotateX(Math.PI / 2); else if (facing === '-z') g.rotateX(-Math.PI / 2);
    else if (facing === 'x') g.rotateZ(-Math.PI / 2); else g.rotateZ(Math.PI / 2);
    g.translate(p.x, p.y, p.z); gs.push(norm(g));
  }
  return gs.length ? mergeGeometries(gs, false)! : new THREE.BufferGeometry();
}

/** Box rotated about X (pitch) — for parts aligned with the line of stroke. */
export function boxAlong(len: number, h: number, w: number, at: THREE.Vector3, pitch: number) {
  const g = new THREE.BoxGeometry(w, h, len);
  g.rotateX(-pitch); g.translate(at.x, at.y, at.z);
  return norm(g);
}

/** Rounded box: extruded rounded rectangle section (x,y) along z. */
export function roundBox(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, r: number) {
  return extrudeSection(roundedRect(x0, y0, x1, y1, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2), 4), z0, z1);
}
