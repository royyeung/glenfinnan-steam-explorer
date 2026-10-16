// Loch Shiel and the River Finnan from OS OpenMap Local water polygons: flat loch surface at its
// OS level, the river surface following the shaped channel. Dark peaty water that reflects the sky
// (environment map) with drifting ripple normals. Boulders in and beside the river near the viaduct,
// as in the April 2026 Geograph photos (8317834-8317847): sizes and density are estimates.
import * as THREE from 'three';
import type { WorldData } from './data.ts';

function rippleTexture() {
  // tileable value-noise height field -> normal map (canvas, no external asset)
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!, img = g.createImageData(N, N), h = new Float32Array(N * N);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const [cells, amp] of [[8, 1], [16, 0.5], [32, 0.25], [64, 0.12]] as const) {
    const v = Array.from({ length: cells * cells }, rnd);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = (x / N) * cells, fy = (y / N) * cells, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, w = fy - j;
      const s = (a: number, b: number) => v[((b + cells) % cells) * cells + ((a + cells) % cells)];
      const su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w);
      h[y * N + x] += amp * ((s(i, j) * (1 - su) + s(i + 1, j) * su) * (1 - sw) + (s(i, j + 1) * (1 - su) + s(i + 1, j + 1) * su) * sw);
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)], dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
    const nx = -dx * 2.2, ny = -dy * 2.2, nz = 1, l = Math.hypot(nx, ny, nz), o = (y * N + x) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function buildWater(data: WorldData, rocks = true) {
  const normal = rippleTexture();
  const mat = new THREE.MeshStandardMaterial({ name: 'water', color: 0x1c1a14, roughness: 0.2, metalness: 0.0, normalMap: normal });   // peat-stained
  mat.normalScale.set(0.35, 0.35);
  const shader = { time: { value: 0 } };
  mat.onBeforeCompile = (s) => {
    s.uniforms.uTime = shader.time;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPosW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWPosW;')
      .replace('#include <normal_fragment_maps>', `
        vec2 wuv = vWPosW.xz;
        vec3 n1 = texture2D(normalMap, wuv / 23.0 + vec2(uTime * 0.011, uTime * 0.004)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(normalMap, wuv / 7.0 - vec2(uTime * 0.017, -uTime * 0.013)).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(vec3((n1.xy + n2.xy * 0.6) * normalScale, 1.0));
        normal = normalize(tbn * mapN);`);
  };
  mat.customProgramCacheKey = () => 'water-1';

  // group the rings: each outer ring takes the hole rings that follow it (OpenMap part order)
  const g = new THREE.Group(); g.name = 'water';
  const parts: THREE.BufferGeometry[] = [];
  const polys = data.json.water;
  for (let i = 0; i < polys.length; i++) {
    const p = polys[i]; if (p.hole) continue;
    const holes: typeof polys = [];
    for (let k = i + 1; k < polys.length && polys[k].hole; k++) holes.push(polys[k]);
    const contour = p.ring.map(([x, z]) => new THREE.Vector2(x, z));
    const hs = holes.map((h) => h.ring.map(([x, z]) => new THREE.Vector2(x, z)));
    const tris = THREE.ShapeUtils.triangulateShape(contour, hs);
    const all = [p, ...holes].flatMap((r) => r.ring.map(([x, z], j) => [x, r.y[j] ?? data.json.lochLevel, z]));
    const pos = new Float32Array(all.flat());
    const idx: number[] = [];
    for (const [a, b, c] of tris) idx.push(a, c, b);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    // flat normals (up), uv in metres for the tangent frame
    const nor = new Float32Array(pos.length); for (let k = 1; k < nor.length; k += 3) nor[k] = 1;
    const uv = new Float32Array((pos.length / 3) * 2); for (let k = 0; k < pos.length / 3; k++) { uv[k * 2] = pos[k * 3]; uv[k * 2 + 1] = pos[k * 3 + 2]; }
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    // make every triangle face up
    const ia = geo.index!.array as Uint32Array | Uint16Array;
    for (let t = 0; t < ia.length; t += 3) {
      const [a, b, c] = [ia[t], ia[t + 1], ia[t + 2]];
      const ux = pos[b * 3] - pos[a * 3], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      if (uz * vx - ux * vz < 0) { ia[t + 1] = c; ia[t + 2] = b; }
    }
    parts.push(geo.toNonIndexed());
  }
  const merged = parts.length ? mergeAll(parts) : new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(merged, mat); mesh.name = 'water_surface'; mesh.receiveShadow = true;
  g.add(mesh);
  if (rocks) g.add(riverRocks(data));
  return { group: g, update: (t: number) => { shader.time.value = t; } };
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  const n = parts.reduce((s, p) => s + p.getAttribute('position').count, 0);
  const out = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
    const a = new Float32Array(n * size); let o = 0;
    for (const p of parts) { const src = p.getAttribute(name).array as Float32Array; a.set(src, o); o += src.length; }
    out.setAttribute(name, new THREE.BufferAttribute(a, size));
  }
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

/** Boulders scattered over the river bed (half submerged) and its banks within 450 m of the viaduct. */
function riverRocks(data: WorldData) {
  const rivers = data.json.water.filter((w) => w.kind === 'river' && !w.hole);
  const inside = (ring: [number, number][], x: number, z: number) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spots: [number, number, number, number][] = [];                         // x, y, z, size
  for (const r of rivers) {
    const xs = r.ring.map((p) => p[0]), zs = r.ring.map((p) => p[1]);
    const x0 = Math.max(Math.min(...xs), -470), x1 = Math.min(Math.max(...xs), 430), z0 = Math.max(Math.min(...zs), -450), z1 = Math.min(Math.max(...zs), 450);
    const level = (px: number, pz: number) => { let best = 0, bd = Infinity; r.ring.forEach(([qx, qz], k) => { const d = (qx - px) ** 2 + (qz - pz) ** 2; if (d < bd) { bd = d; best = k; } }); return r.y[best] ?? data.json.lochLevel; };
    // on the bed: half submerged (the bed lies below the surface)
    for (let x = x0; x < x1; x += 2.4) for (let z = z0; z < z1; z += 2.4) {
      const px = x + (rnd() - 0.5) * 2.4, pz = z + (rnd() - 0.5) * 2.4;
      if (rnd() > 0.6 || Math.hypot(px, pz) > 450 || !inside(r.ring, px, pz)) continue;
      const size = 0.3 + rnd() ** 2 * 1.5; spots.push([px, level(px, pz) - 0.3 * size, pz, size]);
    }
    // on the banks: along the edge, stepped out to dry ground
    for (let i = 0; i < r.ring.length - 1; i++) {
      const [ax, az] = r.ring[i], [bx, bz] = r.ring[i + 1], len = Math.hypot(bx - ax, bz - az);
      if (Math.hypot(ax, az) > 450) continue;
      for (let t = 0; t < len; t += 2.2) {
        if (rnd() > 0.35) continue;
        const f = t / len, nx = -(bz - az) / len, nz = (bx - ax) / len, o = (0.6 + rnd() * 2.5) * (rnd() < 0.5 ? 1 : -1);
        const px = ax + (bx - ax) * f + nx * o, pz = az + (bz - az) * f + nz * o;
        if (inside(r.ring, px, pz)) continue;
        const size = 0.25 + rnd() ** 2.2 * 1.2; spots.push([px, data.height(px, pz) - 0.25 * size, pz, size]);
      }
    }
  }
  const geo = new THREE.IcosahedronGeometry(1, 0), p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const k = 1 + 0.18 * Math.sin(i * 12.9898) ; p.setXYZ(i, p.getX(i) * k, p.getY(i) * 0.62 * k, p.getZ(i) * k * 1.15); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ name: 'river_rock', color: 0x5d5952, roughness: 0.7 });
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, spots.length)); m.count = spots.length; m.name = 'river_rocks';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, spots.length) * 3), 3);
  spots.forEach(([x, y, z, sz], i) => {
    q.setFromEuler(e.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.5));
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sz, sz, sz)); m.setMatrixAt(i, m4);
    const v = 0.7 + rnd() * 0.4; m.setColorAt(i, col.setRGB(v, v * 0.98, v * (0.9 + rnd() * 0.12)));
  });
  m.computeBoundingSphere(); m.castShadow = true; m.receiveShadow = true;
  return m;
}
