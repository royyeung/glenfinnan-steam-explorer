// Glenfinnan Viaduct (REFERENCE §7), generated along the OS railway centreline between its abutments:
// 21 semicircular arches of 50 ft (15.24 m); the pier width follows from the measured length
// (≈2.8 m); 18 ft (5.49 m) between parapets. Mass concrete with lift (pour) lines, white lime
// streaks and moss, from the photos (S54, Commons 2018/2025/2026; see REFERENCE §7).
// Estimated (no drawing): overall width, parapet height and thickness, arch ring and fill depth,
// pier batter, impost band, pilasters, coping. "Thicker pylons" (S17) are not visible in the photos
// and are not modelled.
import * as THREE from 'three';
import type { TrackPath, WorldData } from './data.ts';
import { ktxNormalChunk } from '../render/antiTile.ts';

export const VIADUCT = {
  spans: 21, span: 15.24,
  betweenParapets: 5.49,          // S16
  overall: 6.5,                   // outside of the spandrel walls (estimate)
  parapetAboveRail: 1.05, parapetThick: 0.5, coping: 0.08,
  crownToRail: 1.75,              // arch ring + fill + ballast above the arch crown (estimate)
  batter: 0.022,                  // pier faces widen 22 mm per metre below the springing (photos)
  impost: { h: 0.38, proj: 0.1 }, ring: { w: 0.7, proj: 0.05 }, pilaster: { w: 1.5, proj: 0.12, cap: 0.28 },
};

type V3 = THREE.Vector3;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Indexed grid surface: f(i, j) gives the point and uv; `flip` reverses the winding. */
function surface(ni: number, nj: number, f: (i: number, j: number) => { p: V3; uv: [number, number] }, flip = false) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= ni; i++) for (let j = 0; j <= nj; j++) { const r = f(i, j); pos.push(r.p.x, r.p.y, r.p.z); uv.push(...r.uv); }
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const a = i * (nj + 1) + j, b = a + nj + 1;
    if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g.toNonIndexed();
}

export function buildViaduct(data: WorldData, tex: { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture }) {
  const path: TrackPath = data.track, [sW, sE] = path.viaduct, L = sE - sW, C = VIADUCT;
  const pier = (L - C.spans * C.span) / (C.spans - 1);
  const W = C.overall / 2, Wi = C.betweenParapets / 2;
  // frame at arc length a along the viaduct (a = 0 at the west abutment)
  const P = V(), S = V();
  const at = (a: number, u: number, y: number) => { path.at(sW + a, P); path.side(sW + a, S); return V(P.x + S.x * u, y, P.z + S.z * u); };
  const rail = (a: number) => path.at(sW + a, P).y;
  const ground = (a: number, u: number) => { const p = at(a, u, 0); return data.height(p.x, p.z); };
  const spanAt = (k: number) => k * (C.span + pier);                  // west edge of span k
  const springY = (k: number) => rail(spanAt(k) + C.span / 2) - C.crownToRail - C.span / 2;
  const R = C.span / 2;
  const intrados = (a: number) => {
    const k = Math.min(C.spans - 1, Math.max(0, Math.floor(a / (C.span + pier))));
    const a0 = spanAt(k), x = a - a0;
    if (x < 0 || x > C.span) return null;
    return springY(k) + Math.sqrt(Math.max(0, R * R - (x - R) ** 2));
  };
  const topY = (a: number) => rail(a) + C.parapetAboveRail;
  const parts: THREE.BufferGeometry[] = [];
  const UV = (a: number, y: number): [number, number] => [a / 5.0, y / 5.0];

  // columns along the viaduct: fine around the arches, pier edges exact
  const cols: number[] = [0];
  for (let k = 0; k < C.spans; k++) {
    const a0 = spanAt(k);
    for (let t = 1; t <= 24; t++) cols.push(a0 + C.span * (1 - Math.cos((t / 24) * Math.PI)) / 2);
    if (k < C.spans - 1) { cols.push(a0 + C.span + pier / 2, a0 + C.span + pier); }
  }
  const nc = cols.length - 1;

  for (const f of [1, -1]) {
    // outer face above the springing / arches: spandrel wall and parapet
    parts.push(surface(nc, 1, (i, j) => {
      const a = cols[i], y0 = intrados(a) ?? springY(Math.min(C.spans - 1, Math.round(a / (C.span + pier)))), y = j ? topY(a) : y0;
      return { p: at(a, f * W, y), uv: UV(a, y) };
    }, f < 0));
    // parapet: inner face, coping top and lip
    parts.push(surface(nc, 1, (i, j) => { const a = cols[i], y = j ? topY(a) : rail(a) - 0.4; return { p: at(a, f * Wi, y), uv: UV(a, y) }; }, f > 0));
    parts.push(surface(nc, 1, (i, j) => { const a = cols[i], u = j ? f * (W + C.coping) : f * (Wi - C.coping); return { p: at(a, u, topY(a) + 0.02), uv: [a / 3.2, u / 3.2] }; }, f < 0));
    parts.push(surface(nc, 1, (i, j) => { const a = cols[i], y = topY(a) + (j ? 0.02 : -0.14); return { p: at(a, f * (W + C.coping), y), uv: UV(a, y) }; }, f < 0));
  }
  // deck under the ballast
  parts.push(surface(nc, 1, (i, j) => { const a = cols[i], u = j ? -Wi : Wi; return { p: at(a, u, rail(a) - 0.4), uv: [a / 3.2, u / 3.2] }; }, true));

  // arch soffits and the projecting arch rings
  for (let k = 0; k < C.spans; k++) {
    const a0 = spanAt(k), ys = springY(k), n = 24;
    parts.push(surface(n, 2, (i, j) => {
      const th = (i / n) * Math.PI, a = a0 + R - R * Math.cos(th), y = ys + R * Math.sin(th), u = W - j * W;
      return { p: at(a, u, y), uv: [th * R / 3.2, u / 3.2] };
    }, false));
    for (const f of [1, -1]) {
      const u0 = f * W, u1 = f * (W + C.ring.proj);
      // ring face
      parts.push(surface(n, 1, (i, j) => {
        const th = (i / n) * Math.PI, r = R + (j ? C.ring.w : 0), a = a0 + R - r * Math.cos(th), y = ys + r * Math.sin(th);
        return { p: at(a, u1, y), uv: UV(a, y) };
      }, f < 0));
      // its outer and inner edges
      for (const r of [R + C.ring.w, R]) parts.push(surface(n, 1, (i, j) => {
        const th = (i / n) * Math.PI, a = a0 + R - r * Math.cos(th), y = ys + r * Math.sin(th);
        return { p: at(a, j ? u1 : u0, y), uv: UV(a, y) };
      }, (r === R) !== (f < 0)));
    }
  }

  // piers: battered faces from the ground to the springing, impost band, pilaster above
  const box = (a0: number, a1: number, u0: number, u1: number, y0: number, y1: number) => {
    const out: THREE.BufferGeometry[] = [];
    const q = (pts: V3[], uvs: [number, number][]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
      g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); out.push(g.toNonIndexed());
    };
    const c = (a: number, u: number, y: number) => at(a, u, y);
    q([c(a0, u1, y0), c(a1, u1, y0), c(a1, u1, y1), c(a0, u1, y1)], [[a0 / 3.2, y0 / 3.2], [a1 / 3.2, y0 / 3.2], [a1 / 3.2, y1 / 3.2], [a0 / 3.2, y1 / 3.2]]);   // +u face
    q([c(a1, u0, y0), c(a0, u0, y0), c(a0, u0, y1), c(a1, u0, y1)], [[a1 / 3.2, y0 / 3.2], [a0 / 3.2, y0 / 3.2], [a0 / 3.2, y1 / 3.2], [a1 / 3.2, y1 / 3.2]]);   // -u face
    q([c(a0, u0, y0), c(a0, u1, y0), c(a0, u1, y1), c(a0, u0, y1)], [[u0 / 3.2, y0 / 3.2], [u1 / 3.2, y0 / 3.2], [u1 / 3.2, y1 / 3.2], [u0 / 3.2, y1 / 3.2]]);   // -a face
    q([c(a1, u1, y0), c(a1, u0, y0), c(a1, u0, y1), c(a1, u1, y1)], [[u1 / 3.2, y0 / 3.2], [u0 / 3.2, y0 / 3.2], [u0 / 3.2, y1 / 3.2], [u1 / 3.2, y1 / 3.2]]);   // +a face
    q([c(a0, u0, y1), c(a0, u1, y1), c(a1, u1, y1), c(a1, u0, y1)], [[a0 / 3.2, u0 / 3.2], [a0 / 3.2, u1 / 3.2], [a1 / 3.2, u1 / 3.2], [a1 / 3.2, u0 / 3.2]]);   // top
    return out;
  };
  const pierEdges: [number, number][] = [];
  for (let k = 0; k < C.spans - 1; k++) pierEdges.push([spanAt(k) + C.span, spanAt(k) + C.span + pier]);
  // the abutments: solid ends from the ground to the deck
  pierEdges.push([-2.5, 0]); pierEdges.push([L, L + 2.5]);
  pierEdges.forEach(([a0, a1], idx) => {
    const abut = idx >= C.spans - 1;
    const ys = abut ? topY((a0 + a1) / 2) : Math.max(springY(Math.min(C.spans - 1, idx)), springY(Math.min(C.spans - 1, idx + 1)));
    const gmin = Math.min(ground(a0, -W), ground(a0, W), ground(a1, -W), ground(a1, W)) - 1.5;
    if (ys <= gmin) return;
    const n = Math.max(2, Math.ceil((ys - gmin) / 3));
    const bat = (y: number) => abut ? 0 : C.batter * (ys - y);
    // four battered faces as strips (top at the springing, bottom below ground)
    for (const f of [1, -1]) {
      parts.push(surface(2, n, (i, j) => {
        const y = ys - ((ys - gmin) * j) / n, b = bat(y), a = a0 - b + ((a1 - a0 + 2 * b) * i) / 2;
        return { p: at(a, f * (W + b), y), uv: UV(a, y) };
      }, f > 0));
      const ae = f > 0 ? a1 : a0;
      parts.push(surface(2, n, (i, j) => {
        const y = ys - ((ys - gmin) * j) / n, b = bat(y), u = -(W + b) + (2 * (W + b) * i) / 2;
        return { p: at(ae + f * b, u, y), uv: [u / 3.2, y / 3.2] };
      }, f < 0));
    }
    if (abut) return;
    // impost band at the springing and a pilaster above the pier on each face
    parts.push(...box(a0 - 0.2, a1 + 0.2, -W - C.impost.proj, W + C.impost.proj, ys - C.impost.h, ys));
    const am = (a0 + a1) / 2, hw = C.pilaster.w / 2;
    for (const f of [1, -1]) {
      const u0 = f > 0 ? W - 0.05 : -W - C.pilaster.proj, u1 = f > 0 ? W + C.pilaster.proj : -W + 0.05;
      parts.push(...box(am - hw, am + hw, u0, u1, ys, topY(am) + C.pilaster.cap));
    }
  });

  const merged = mergeList(parts);
  for (const t of [tex.color, tex.normal, tex.rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  const mat = new THREE.MeshStandardMaterial({ name: 'viaduct_concrete', map: tex.color, normalMap: tex.normal, roughnessMap: tex.rough, color: 0xa3a49f, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  mat.normalScale.set(0.6, 0.6);
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vVP; varying vec3 vVN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvVP = (modelMatrix * vec4(transformed, 1.0)).xyz; vVN = normalize(mat3(modelMatrix) * objectNormal);');
    s.fragmentShader = ktxNormalChunk(s.fragmentShader).replace('#include <common>', `#include <common>
      varying vec3 vVP; varying vec3 vVN;
      float vh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vn(vec2 x) { vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(mix(vh(i), vh(i + vec2(1, 0)), f.x), mix(vh(i + vec2(0, 1)), vh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 texelColor = texture2D(map, vMapUv);
        diffuseColor.rgb *= mix(vec3(0.6), texelColor.rgb, 0.3);   // the texture's formwork grain only, not its panel joints
      #endif
      {
        vec2 q = vec2(vVP.x + vVP.z, vVP.y);
        vec3 nn = gl_FrontFacing ? vVN : -vVN;      // double-sided: the visible side's normal
        float vertical = 1.0 - abs(nn.y);
        // lift lines between concrete pours (about every 0.6 m) and board marks
        float lift = smoothstep(0.035, 0.0, abs(fract(vVP.y / 0.61) - 0.5) - 0.465) * vertical;
        // white lime streaks running down from the lift joints, and dark rain tracks
        float streak = smoothstep(0.66, 0.92, vn(vec2(q.x * 5.0, q.y * 0.08))) * smoothstep(0.5, 0.85, vn(vec2(q.x * 0.6, q.y * 0.35 + 3.0))) * vertical;
        float rain = smoothstep(0.55, 0.9, vn(vec2(q.x * 1.7 + 11.0, q.y * 0.05))) * vertical;
        // moss and green staining on tops and near the ground
        float up = smoothstep(0.6, 0.95, nn.y);
        float moss = clamp(up * 0.85 + smoothstep(0.55, 0.85, vn(q * 0.35)) * 0.25, 0.0, 1.0);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.7), lift);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.78, 0.75), streak * 0.7);
        diffuseColor.rgb *= mix(1.0, 0.68, rain * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.62, 0.4), moss * 0.65);
        diffuseColor.rgb *= mix(0.88, 1.06, vn(q * 0.05));
      }`);
  };
  mat.customProgramCacheKey = () => 'viaduct-2';
  const mesh = new THREE.Mesh(merged, mat); mesh.name = 'viaduct'; mesh.castShadow = true; mesh.receiveShadow = true;
  const g = new THREE.Group(); g.name = 'viaduct_group'; g.add(mesh);
  return { group: g, mesh, pier, springY, spanAt };
}

function mergeList(parts: THREE.BufferGeometry[]) {
  const n = parts.reduce((s, p) => s + p.getAttribute('position').count, 0);
  const out = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const) {
    const arr = new Float32Array(n * size); let o = 0;
    for (const p of parts) { const a = p.getAttribute(name); for (let i = 0; i < a.count * size; i++) arr[o + i] = (a.array as Float32Array)[i]; o += a.count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingBox(); out.computeBoundingSphere();
  return out;
}
