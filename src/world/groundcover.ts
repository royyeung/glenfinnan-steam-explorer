// Low ground cover near the camera: bracken clumps on the lower slopes and heather higher up (late
// August: bracken green, heather in flower; species split by height is an estimate). Not on water,
// roads, buildings or the railway (land-cover map and the track line). Clumps sit on a jittered 2.4 m
// grid chosen by a hash of the cell, so they stay put as the camera moves; the set is refilled
// every 12 m. Medium and High only (Low has no triangle budget left).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldData } from './data.ts';

const CELL = 2.4;

function clump(seed: number, flat: number) {
  const g = new THREE.IcosahedronGeometry(1, 0), p = g.getAttribute('position');
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5);
  const off = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!off.has(k)) off.set(k, 1 + rnd() * 0.5);
    const f = off.get(k)!; p.setXYZ(i, p.getX(i) * f, Math.max(-0.15, p.getY(i)) * f * flat, p.getZ(i) * f);
  }
  // shared vertices so the clump shades as a rounded mound, not as flat shards
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g); m.computeVertexNormals();
  return m;
}

export class GroundCover {
  readonly group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private last = new THREE.Vector3(1e9, 0, 0);
  private cover: Uint8ClampedArray | null = null; private cw = 0;
  private trackMask: Uint8Array; private R: number;
  private data: WorldData;

  constructor(data: WorldData, radius: number, station: { s0: number; s1: number }) {
    this.data = data; this.R = radius; this.group.name = 'groundcover';
    // land cover (R woodland, G water, B road/built) read back on the CPU
    const img = data.coverNear.image as HTMLImageElement | ImageBitmap | undefined;
    if (img && radius > 0) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
      this.cover = g.getImageData(0, 0, c.width, c.height).data; this.cw = c.width;
    }
    // cells near the railway (wider through the station: loop and platforms)
    const n = data.near.n; this.trackMask = new Uint8Array(n * n);
    const path = data.track;
    for (let s = 0; s < path.length; s += 2) {
      const p = path.at(s), r = s > station.s0 - 60 && s < station.s1 + 60 ? 16 : 6, k = Math.ceil(r / data.near.step);
      const j0 = Math.round((p.x - data.near.x0) / data.near.step), i0 = Math.round((p.z - data.near.z0) / data.near.step);
      for (let i = i0 - k; i <= i0 + k; i++) for (let j = j0 - k; j <= j0 + k; j++) if (i >= 0 && j >= 0 && i < n && j < n) this.trackMask[i * n + j] = 1;
    }
    const mat = new THREE.MeshStandardMaterial({ name: 'groundcover', roughness: 0.95, metalness: 0 });
    const cap = Math.ceil((Math.PI * radius * radius) / (CELL * CELL));
    for (const [geo, name] of [[clump(11, 0.55), 'bracken'], [clump(23, 0.4), 'heather']] as const) {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, cap));
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * 3), 3);
      m.count = 0; m.name = `groundcover_${name}`; m.receiveShadow = true; m.frustumCulled = false;
      this.meshes.push(m); this.group.add(m);
    }
  }

  private coverAt(x: number, z: number) {
    const g = this.data.near, size = (g.n - 1) * g.step, u = (x - g.x0) / size, v = (z - g.z0) / size;
    if (!this.cover || u < 0 || v < 0 || u >= 1 || v >= 1) return null;
    const o = (Math.floor(v * this.cw) * this.cw + Math.floor(u * this.cw)) * 4;
    return [this.cover[o] / 255, this.cover[o + 1] / 255, this.cover[o + 2] / 255];
  }

  update(cam: THREE.Vector3) {
    if (this.R <= 0 || cam.distanceToSquared(this.last) < 12 * 12) return;
    this.last.copy(cam);
    const g = this.data.near, n = g.n, R = this.R, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const counts = [0, 0];
    const h = (a: number, b: number, k: number) => { const v = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
    for (let cx = Math.floor((cam.x - R) / CELL); cx <= Math.ceil((cam.x + R) / CELL); cx++) for (let cz = Math.floor((cam.z - R) / CELL); cz <= Math.ceil((cam.z + R) / CELL); cz++) {
      const x = (cx + h(cx, cz, 1)) * CELL, z = (cz + h(cx, cz, 2)) * CELL;
      if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > R * R || h(cx, cz, 3) > 0.55) continue;
      const c = this.coverAt(x, z); if (!c || c[1] > 0.2 || c[2] > 0.15) continue;
      const i = Math.round((z - g.z0) / g.step), j = Math.round((x - g.x0) / g.step);
      if (i < 0 || j < 0 || i >= n || j >= n || this.trackMask[i * n + j]) continue;
      if (c[0] > 0.5 && h(cx, cz, 4) > 0.35) continue;                                // thinner under the woods
      const y = this.data.height(x, z), heather = y > 85 + 40 * h(cx, cz, 5) ? 1 : 0, mesh = this.meshes[heather];
      if (counts[heather] >= mesh.instanceMatrix.count) continue;
      const w = heather ? 0.5 + 0.5 * h(cx, cz, 6) : 0.7 + 0.9 * h(cx, cz, 6);
      q.setFromAxisAngle(up, h(cx, cz, 7) * 6.283);
      m4.compose(new THREE.Vector3(x, y - 0.05, z), q, new THREE.Vector3(w, heather ? 0.7 * w : (0.8 + 0.6 * h(cx, cz, 8)) * w, w * (0.8 + 0.4 * h(cx, cz, 9))));
      mesh.setMatrixAt(counts[heather], m4);
      const t = h(cx, cz, 10);
      // sRGB: heather muted purple, bracken mid green with a few clumps already browning
      if (heather) col.setRGB(0.36 + 0.08 * t, 0.25 + 0.04 * t, 0.33 + 0.06 * t, THREE.SRGBColorSpace);
      else col.setRGB(0.27 + 0.16 * t * t, 0.36 + 0.06 * t, 0.13 + 0.03 * t, THREE.SRGBColorSpace);
      mesh.setColorAt(counts[heather], col);
      counts[heather]++;
    }
    this.meshes.forEach((m, k) => { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }
}
