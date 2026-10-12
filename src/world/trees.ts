// Trees from the build's instance list (woodland polygons from OS OpenMap Local, plus scattered
// trees and scrub in the glen bottom; species mix and sizes are estimates). Two kinds, broadleaf
// (birch, oak, alder, rhododendron scrub) and conifer, drawn as instanced meshes in three rings
// around the camera: lumpy crowns close by, simple crowns further out, minimal shapes far away.
// Crowns shade as rounded masses (normals from the crown centre) with leaf-scale noise.
// Instances are re-chosen when the camera moves 30 m.
import * as THREE from 'three';
import type { TreeSet } from './data.ts';

export interface TreeTier { nearR: number; farR: number; nearMax: number; farMax: number; shadows: boolean }

type Lump = [number, number, number, number, number];          // centre x, y, z, radius, height
function crownGeo(lumps: Lump[], detail: number, seed: number, top: THREE.Color, bottom: THREE.Color) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
  for (const [x, y, z, r, h] of lumps) {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.getAttribute('position');
    const off = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
      if (!off.has(k)) off.set(k, 1 + rnd() * 0.35);
      const f = off.get(k)!, vx = p.getX(i) * f, vy = p.getY(i) * f, vz = p.getZ(i) * f;
      pos.push(x + vx * r, y + vy * h, z + vz * r);
      const n = new THREE.Vector3(vx, vy * 0.8 + 0.25, vz).normalize(); nor.push(n.x, n.y, n.z);
      const c = bottom.clone().lerp(top, THREE.MathUtils.clamp(0.5 + vy * 0.55, 0, 1)); col.push(c.r, c.g, c.b);
    }
  }
  return { pos, nor, col };
}
function trunkGeo(r0: number, r1: number, h: number, colr: THREE.Color) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 4, 1, true).translate(0, h / 2, 0).toNonIndexed(), p = g.getAttribute('position'), n = g.getAttribute('normal');
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(colr.r, colr.g, colr.b); }
  return { pos, nor, col };
}
function build(parts: { pos: number[]; nor: number[]; col: number[] }[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(parts.flatMap((p) => p.pos), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(parts.flatMap((p) => p.nor), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(parts.flatMap((p) => p.col), 3));
  return g;
}

/** Unit-height shapes for one ring (0 near, 1 mid, 2 far). */
function shapes(ring: number) {
  const bark = new THREE.Color(0x5b5249), leaf = new THREE.Color(0x4f7a2f), leafDark = new THREE.Color(0x1f3a14), needle = new THREE.Color(0x2b4a2c), needleDark = new THREE.Color(0x101f12);
  if (ring === 0) {
    const broad = build([trunkGeo(0.03, 0.02, 0.52, bark), crownGeo([[0, 0.64, 0, 0.28, 0.3], [0.14, 0.58, 0.06, 0.19, 0.2], [-0.12, 0.55, -0.08, 0.2, 0.21], [0.02, 0.5, 0.15, 0.17, 0.18]], 0, 7, leaf, leafDark)]);
    const tiers: Lump[] = [[0, 0.3, 0, 0.21, 0.2], [0, 0.5, 0, 0.16, 0.17], [0, 0.68, 0, 0.11, 0.14], [0, 0.84, 0, 0.06, 0.11]];
    const con = build([trunkGeo(0.025, 0.015, 0.3, bark), crownGeo(tiers, 0, 11, needle, needleDark)]);
    return { broad, con };
  }
  if (ring === 1) {
    return { broad: build([crownGeo([[0, 0.6, 0, 0.3, 0.36]], 0, 13, leaf, leafDark)]), con: build([crownGeo([[0, 0.45, 0, 0.18, 0.47]], 0, 17, needle, needleDark)]) };
  }
  // far: a three-sided double pyramid (6 triangles), enough for a crown a few pixels across
  const oct = (r: number, h: number, y: number, top: THREE.Color, bot: THREE.Color) => {
    const pos: number[] = [], nor: number[] = [], col: number[] = [];
    const ring = [0, 1, 2].map((k) => [Math.cos((k * 2 * Math.PI) / 3), 0, Math.sin((k * 2 * Math.PI) / 3)]);
    for (const tip of [[0, 1, 0], [0, -1, 0]]) for (let k = 0; k < 3; k++) {
      const a = ring[k], b = ring[(k + 1) % 3], tri = tip[1] > 0 ? [tip, b, a] : [tip, a, b];
      for (const v of tri) { pos.push(v[0] * r, y + v[1] * h, v[2] * r); const n = new THREE.Vector3(v[0], v[1] * 0.8 + 0.25, v[2]).normalize(); nor.push(n.x, n.y, n.z); const c = bot.clone().lerp(top, 0.5 + v[1] * 0.5); col.push(c.r, c.g, c.b); }
    }
    return { pos, nor, col };
  };
  return { broad: build([oct(0.3, 0.4, 0.58, leaf, leafDark)]), con: build([oct(0.17, 0.46, 0.5, needle, needleDark)]) };
}

export class Trees {
  readonly group = new THREE.Group();
  private meshes: { mesh: THREE.InstancedMesh; kind: number; ring: number }[] = [];
  private last = new THREE.Vector3(1e9, 0, 0);
  private data: TreeSet; private tier: TreeTier;
  /** Cleared ground (x, z, radius): the managed viewpoint west of the viaduct. */
  clearings: [number, number, number][] = [[-226, 74, 22]];

  constructor(data: TreeSet, tier: TreeTier) {
    this.data = data; this.tier = tier;
    this.group.name = 'trees';
    const mat = new THREE.MeshStandardMaterial({ name: 'trees', vertexColors: true, roughness: 0.92, metalness: 0 });
    // leaf-scale light and dark clumps, so crowns do not read as smooth balls
    mat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vTP;
        float th(vec3 p) { vec3 p3 = fract(p * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
        float tn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(th(i), th(i + vec3(1,0,0)), f.x), mix(th(i + vec3(0,1,0)), th(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(th(i + vec3(0,0,1)), th(i + vec3(1,0,1)), f.x), mix(th(i + vec3(0,1,1)), th(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        { float leaves = tn(vTP * 1.7) * 0.6 + tn(vTP * 4.3) * 0.4;
          diffuseColor.rgb *= mix(0.62, 1.25, leaves); }`);
    };
    mat.customProgramCacheKey = () => 'trees-2';
    const rings = [0, 1, 2].map(shapes);
    const caps = [tier.nearMax, tier.nearMax, tier.farMax];
    rings.forEach((sh, ring) => {
      for (const [geo, kind] of [[sh.broad, 0], [sh.con, 1]] as const) {
        const max = caps[ring], m = new THREE.InstancedMesh(geo, mat, max);
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        m.count = 0; m.name = `trees_${kind ? 'conifer' : 'broadleaf'}_${['near', 'mid', 'far'][ring]}`;
        m.castShadow = ring === 0 && tier.shadows; m.receiveShadow = ring < 2;
        this.group.add(m); this.meshes.push({ mesh: m, kind, ring });
      }
    });
  }

  /** Refill the instance lists around the camera. */
  update(cam: THREE.Vector3, force = false) {
    if (!force && cam.distanceToSquared(this.last) < 30 * 30) return;
    this.last.copy(cam);
    const d = this.data.data, n = this.data.count, r0 = (this.tier.nearR * 0.4) ** 2, r1 = this.tier.nearR ** 2, fr2 = this.tier.farR ** 2;
    const counts = this.meshes.map(() => 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const o = i * 7, x = d[o], y = d[o + 1], z = d[o + 2], dd = (x - cam.x) ** 2 + (z - cam.z) ** 2;
      if (dd > fr2 || this.clearings.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r)) continue;
      const kind = d[o + 4], ring = dd < r0 ? 0 : dd < r1 ? 1 : 2, k = ring * 2 + kind, e = this.meshes[k];
      if (counts[k] >= e.mesh.instanceMatrix.count) continue;
      const h = d[o + 3], wobble = 0.85 + 0.3 * ((i * 0.618) % 1);
      q.setFromAxisAngle(up, d[o + 6]);
      m4.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(h * wobble, h, h * wobble));
      e.mesh.setMatrixAt(counts[k], m4);
      // per-tree tint: birch-light to oak-dark greens, a few yellower or bluer
      const v = 0.78 + 0.44 * ((i * 0.377) % 1), warm = (i * 0.131) % 1;
      col.setRGB(v * (0.92 + 0.18 * warm), v, v * (0.85 + 0.2 * ((i * 0.71) % 1)));
      e.mesh.setColorAt(counts[k], col);
      counts[k]++;
    }
    this.meshes.forEach((e, k) => {
      e.mesh.count = counts[k]; e.mesh.instanceMatrix.needsUpdate = true; if (e.mesh.instanceColor) e.mesh.instanceColor.needsUpdate = true;
      e.mesh.computeBoundingSphere();
    });
  }
  get counts() { return this.meshes.map((e) => ({ name: e.mesh.name, n: e.mesh.count })); }
}
