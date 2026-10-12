// Terrain meshes from the two OS-derived height grids: RTIN meshes (fewer triangles where the
// ground is smooth) with a tier-dependent error, the 5 m core drawn over the 25 m surround. One
// material splats grass, moorland, rock (by slope), woodland floor, roads and wet shore from the
// land-cover maps, with the anti-tiling lookup used for the Phase 1 ground.
import * as THREE from 'three';
import { Martini } from './martini.ts';
import { KTX_NORMAL_GLSL } from '../render/antiTile.ts';
import type { Grid, WorldData } from './data.ts';

export interface TerrainTextures { grass: { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture }; rock: THREE.Texture; forest: THREE.Texture; asphalt: THREE.Texture }

const TERRAIN_GLSL = /* glsl */ `
  uniform sampler2D coverNear, coverFar, rockMap, forestMap, asphaltMap;
  uniform vec4 nearBox, farBox;   // x0, z0, size, unused
  uniform float lochLevel;
  uniform int uDebug;   // 0 normal; 1 palette only; 2 + rock; 3 + woodland; 4 flat colour, no normal map; 5 no normal map, fixed roughness
  varying vec3 vWPos; varying vec3 vWN;
  // rotated octaves: no grid-aligned blobs (which foreshorten into rows of dashes on far slopes)
  float fbm(vec2 p) {
    const mat2 R = mat2(0.8, -0.6, 0.6, 0.8);
    return 0.5 * atNoise(p) + 0.3 * atNoise(R * p * 2.07 + 5.1) + 0.2 * atNoise(R * R * p * 4.31 + 1.7);
  }
  vec3 triRock(vec3 p, vec3 n) {
    vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
    return atSample(rockMap, p.zy / 7.0).rgb * w.x + atSample(rockMap, p.xz / 7.0).rgb * w.y + atSample(rockMap, p.xy / 7.0).rgb * w.z;
  }`;

function terrainMaterial(data: WorldData, tex: TerrainTextures) {
  const t = tex.grass;
  for (const x of [t.color, t.normal, t.rough, tex.rock, tex.forest, tex.asphalt]) { x.wrapS = x.wrapT = THREE.RepeatWrapping; }
  const m = new THREE.MeshStandardMaterial({ name: 'terrain', map: t.color, normalMap: t.normal, roughnessMap: t.rough, roughness: 1, metalness: 0 });
  m.normalScale.set(0.4, 0.4);
  const nb = data.json.near, fb = data.json.far;
  const uniforms = {
    coverNear: { value: data.coverNear }, coverFar: { value: data.coverFar }, rockMap: { value: tex.rock }, forestMap: { value: tex.forest }, asphaltMap: { value: tex.asphalt },
    nearBox: { value: new THREE.Vector4(nb.x0, nb.z0, (nb.n - 1) * nb.step, 0) }, farBox: { value: new THREE.Vector4(fb.x0, fb.z0, (fb.n - 1) * fb.step, 0) },
    lochLevel: { value: data.json.lochLevel }, uDebug: { value: 0 },
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${KTX_NORMAL_GLSL}\n${ANTI}\n${TERRAIN_GLSL}`)
      .replace('#include <map_fragment>', /* glsl */ `
        vec2 wxz = vWPos.xz;
        vec2 cn = (wxz - nearBox.xy) / nearBox.z, cf = (wxz - farBox.xy) / farBox.z;
        float inN = step(0.0, cn.x) * step(cn.x, 1.0) * step(0.0, cn.y) * step(cn.y, 1.0);
        float edgeN = inN * smoothstep(0.0, 0.02, min(min(cn.x, 1.0 - cn.x), min(cn.y, 1.0 - cn.y)));
        vec4 cov = mix(texture2D(coverFar, cf), texture2D(coverNear, cn), edgeN);
        float slope = 1.0 - clamp(vWN.y, 0.0, 1.0);
        float camD = distance(vWPos, cameraPosition), fade = smoothstep(60.0, 450.0, camD);
        // fine colour variation fades out with distance: foreshortened on far slopes it reads as rows of dashes
        float n1 = fbm(wxz * 0.004), n2 = mix(fbm(wxz * 0.017 + 7.0), 0.5, smoothstep(200.0, 900.0, camD));
        // the texture gives the detail; the colour comes from a palette after the 2018-2025 photos
        vec3 tx = atSample(map, vMapUv).rgb;
        // close-up detail: the photo texture's light and dark, tussocks (3 m) and damp hollows (12 m)
        float tus = fbm(wxz * 0.33 + 11.0), damp = fbm(wxz * 0.085 + 4.0);
        float detail = mix(clamp(0.45 + 3.0 * dot(tx, vec3(0.3, 0.55, 0.15)), 0.6, 1.45) * mix(0.7, 1.25, tus) * mix(0.8, 1.1, smoothstep(0.3, 0.7, damp)), 1.0, fade);
        float n3 = mix(fbm(wxz * 0.008 + 3.0), 0.5, smoothstep(500.0, 2000.0, camD));
        vec3 lush = vec3(0.075, 0.16, 0.028), grassC = vec3(0.12, 0.19, 0.045), bracken = vec3(0.16, 0.17, 0.04);
        vec3 dry = vec3(0.2, 0.17, 0.075), heather = vec3(0.13, 0.085, 0.075);
        vec3 col = mix(lush, grassC, 0.25 + 0.5 * n2);
        col = mix(col, bracken, smoothstep(0.55, 0.85, n3) * (1.0 - smoothstep(150.0, 300.0, vWPos.y)) * 0.7);
        // moorland: tussock grass and heather take over with height (and in patches lower down)
        float moor = clamp(smoothstep(140.0, 420.0, vWPos.y + 160.0 * (n1 - 0.5)) + 0.25 * smoothstep(0.6, 0.9, n2), 0.0, 0.9);
        col = mix(col, mix(dry, heather, smoothstep(0.4, 0.75, n1)), moor);
        col = mix(col, vec3(0.2, 0.18, 0.08), smoothstep(0.55, 0.8, tus) * 0.35 * (1.0 - fade));   // dead grass in the tussocks
        if (uDebug == 0) col *= detail;
        float rockW = smoothstep(0.5, 0.68, slope + 0.22 * (n2 - 0.5) + 0.12 * smoothstep(300.0, 700.0, vWPos.y));
        if (uDebug == 0 || uDebug == 2) col = mix(col, triRock(vWPos, normalize(vWN)) * vec3(0.8, 0.82, 0.8), rockW);
        if (uDebug == 0 || uDebug == 3) col = mix(col, mix(vec3(0.06, 0.075, 0.03), atSample(forestMap, wxz / 4.0).rgb * vec3(0.3, 0.36, 0.2), 0.5 * (1.0 - fade)), cov.r * 0.75);   // woodland floor: moss, ferns, leaf litter in shade
        col = mix(col, texture2D(asphaltMap, wxz / 9.0).rgb * 0.8, smoothstep(0.35, 0.75, cov.b)); // roads and yards
        col = mix(col, col * vec3(0.42, 0.4, 0.38), smoothstep(lochLevel + 0.9, lochLevel - 0.3, vWPos.y));   // wet shore, under water
        float macroV = mix(0.85, 1.12, atNoise(wxz * 0.0021));
        diffuseColor.rgb = col * macroV;
        if (uDebug == 4) diffuseColor.rgb = vec3(0.1, 0.2, 0.05);`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = uDebug == 5 ? 0.92 : mix(max(roughness * atSample(roughnessMap, vRoughnessMapUv).g, 0.8), 0.92, smoothstep(40.0, 200.0, distance(vWPos, cameraPosition)));`)
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = ktxN(atSample(normalMap, vNormalMapUv));
        mapN.xy *= normalScale * (1.0 - smoothstep(40.0, 300.0, distance(vWPos, cameraPosition)));
        // the normal map only close up: further out its mip chain shades as rows of dashes along the slopes
        if (uDebug < 4 && distance(vWPos, cameraPosition) < 250.0) normal = normalize(tbn * mapN);`);
  };
  m.customProgramCacheKey = () => 'terrain-2';
  return m;
}

// the anti-tiling lookup (same as render/antiTile.ts)
const ANTI = /* glsl */ `
  float atHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }   // sine-free: stable at large coordinates
  float atNoise(vec2 x) {
    vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(atHash(i), atHash(i + vec2(1, 0)), f.x), mix(atHash(i + vec2(0, 1)), atHash(i + vec2(1, 1)), f.x), f.y);
  }
  vec4 atSample(sampler2D tex, vec2 uv) {
    float k = atNoise(uv * 0.21) * 8.0;
    float ia = floor(k), f = fract(k);
    vec2 offa = sin(vec2(3.0, 7.0) * ia), offb = sin(vec2(3.0, 7.0) * (ia + 1.0));
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    vec4 a = textureGrad(tex, uv + offa, dx, dy), b = textureGrad(tex, uv + offb, dx, dy);
    return mix(a, b, smoothstep(0.2, 0.8, f - 0.1 * dot(a.rgb - b.rgb, vec3(1.0))));
  }`;

/** One RTIN mesh for a grid. `skip(x, z)` drops triangles (the far grid under the core). */
function gridMesh(g: Grid, maxError: number, mat: THREE.Material, opts: { sink?: (x: number, z: number) => boolean; keep?: (x: number, z: number) => boolean; skip?: (x: number, z: number) => boolean }) {
  const mt = new Martini(g.n);
  const { vertices, triangles } = mt.mesh(mt.errors(g.h), maxError, opts.keep ? (j, i) => opts.keep!(g.x0 + j * g.step, g.z0 + i * g.step) : undefined);
  const nv = vertices.length / 2, pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const H = (i: number, j: number) => g.h[Math.min(g.n - 1, Math.max(0, i)) * g.n + Math.min(g.n - 1, Math.max(0, j))];
  for (let v = 0; v < nv; v++) {
    const j = vertices[2 * v], i = vertices[2 * v + 1], x = g.x0 + j * g.step, z = g.z0 + i * g.step;
    let y = H(i, j);
    if (opts.sink?.(x, z)) y -= 4;                          // far grid under the core: hidden below it
    pos.set([x, y, z], v * 3);
    const nx = H(i, j - 1) - H(i, j + 1), nz = H(i - 1, j) - H(i + 1, j), ny = 2 * g.step, l = Math.hypot(nx, ny, nz);
    nor.set([nx / l, ny / l, nz / l], v * 3);
    uv.set([x / 9, z / 9], v * 2);                          // grass texture repeats every 9 m
  }
  let idx = triangles;
  if (opts.skip) {
    const keep: number[] = [];
    for (let t = 0; t < triangles.length; t += 3) {
      const a = triangles[t], b = triangles[t + 1], c = triangles[t + 2];
      const cx = (pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3;
      if (!opts.skip(cx, cz)) keep.push(a, c, b);
    }
    idx = Uint32Array.from(keep);
  } else {
    idx = new Uint32Array(triangles.length);
    for (let t = 0; t < triangles.length; t += 3) { idx[t] = triangles[t]; idx[t + 1] = triangles[t + 2]; idx[t + 2] = triangles[t + 1]; } // counter-clockwise from above
  }
  // face up: check the winding of the first triangle and flip all if needed
  if (idx.length >= 3) {
    const [a, b, c] = [idx[0], idx[1], idx[2]];
    const ux = pos[b * 3] - pos[a * 3], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
    if (uz * vx - ux * vz < 0) for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export interface TerrainTier { nearError: number; farError: number }

export function buildTerrain(data: WorldData, tex: TerrainTextures, tier: TerrainTier) {
  const mat = terrainMaterial(data, tex);
  const nb = data.json.near, size = (nb.n - 1) * nb.step;
  const inCore = (x: number, z: number, m: number) => x > nb.x0 + m && z > nb.z0 + m && x < nb.x0 + size - m && z < nb.z0 + size - m;
  // the railway and road corridors keep full detail so cuttings and benches stay crisp
  const path = data.track;
  const near = gridMesh(data.near, tier.nearError, mat, {});
  near.name = 'terrain_near';
  const far = gridMesh(data.far, tier.farError, mat, { sink: (x, z) => inCore(x, z, 20), skip: (x, z) => inCore(x, z, 60) });
  far.name = 'terrain_far';
  void path;
  const g = new THREE.Group(); g.name = 'terrain'; g.add(far, near);
  return { group: g, near, far, material: mat };
}
