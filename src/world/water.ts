// Loch Shiel and the River Finnan from OS OpenMap Local water polygons: flat loch surface at its
// OS level, the river surface following the shaped channel. Dark peaty water that reflects the sky
// (environment map) with drifting ripple normals.
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

export function buildWater(data: WorldData) {
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
