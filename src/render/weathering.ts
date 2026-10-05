// Procedural weathering for the locomotive materials. No textures, so no repeating patterns:
// 3D noise evaluated in the vehicle's own frame (it travels with the train) drives grime, soot,
// streaks, rust, oil and coal dust, plus a fine bump. Strength per material kind; "amount" scales
// the whole effect (0 = ex-works, 1 = typical working condition mid-season).
import * as THREE from 'three';

type Kind = 'paint' | 'smokebox' | 'wheel' | 'steel' | 'red' | 'tender' | 'brass';

const KIND_BY_NAME: Record<string, Kind> = {
  paint_black: 'paint', smokebox: 'smokebox', wheel: 'wheel', steel: 'steel', paint_red: 'red', brass: 'brass',
  lining: 'paint', lining_red: 'paint', blue_plate: 'paint', decal_cabnum: 'paint', decal_emblem: 'paint', decal_emblem_l: 'paint',
};
const KIND_ID: Record<Kind, number> = { paint: 0, smokebox: 1, wheel: 2, steel: 3, red: 4, tender: 5, brass: 6 };

const NOISE = /* glsl */ `
  float wHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float wNoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float wFbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * wNoise(p); p = p * 2.03 + 3.1; a *= 0.5; } return s; }
`;

export class Weathering {
  readonly amount = { value: 1.0 };
  private entries: { mat: THREE.Material; vehicle: THREE.Object3D; inv: { value: THREE.Matrix4 } }[] = [];

  /** Patch every recognised material under `root`; `vehicle` is the frame noise is evaluated in. */
  apply(root: THREE.Object3D, vehicle: THREE.Object3D, isTender: boolean) {
    const seen = new Set<THREE.Material>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (seen.has(m) || !m.isMeshStandardMaterial) return;
      let kind = KIND_BY_NAME[m.name];
      if (!kind) return;
      if (isTender && kind === 'paint') kind = 'tender';
      seen.add(m);
      const inv = { value: new THREE.Matrix4() };
      this.entries.push({ mat: m, vehicle, inv });
      const kid = KIND_ID[kind], amount = this.amount;
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uVehInv = inv; shader.uniforms.uWeather = amount;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform mat4 uVehInv;\nvarying vec3 vVehPos;\nvarying vec3 vVehN;')
          .replace('#include <project_vertex>', `#include <project_vertex>
            { vec4 wpW = modelMatrix * vec4(transformed, 1.0); vVehPos = (uVehInv * wpW).xyz;
              vVehN = normalize(mat3(uVehInv) * (mat3(modelMatrix) * objectNormal)); }`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\nuniform float uWeather;\nvarying vec3 vVehPos;\nvarying vec3 vVehN;\n${NOISE}`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            float wBump = 0.0;
            {
              vec3 p = vVehPos; float y = p.y, W = uWeather;
              float big = wFbm(p * 0.9), mid = wFbm(p * 3.7 + 11.0), fine = wNoise(p * 40.0);
              float up = clamp(vVehN.y, 0.0, 1.0);
              vec3 grimeCol = vec3(0.075, 0.066, 0.055), sootCol = vec3(0.012), rustCol = vec3(0.16, 0.07, 0.035), dustCol = vec3(0.11, 0.1, 0.09);
              float grime = W * smoothstep(1.6, 0.3, y) * smoothstep(0.35, 0.75, big);
              float soot = W * smoothstep(3.1, 3.75, y) * (0.4 + 0.6 * mid);
              float streak = W * smoothstep(0.62, 0.8, wFbm(vec3(p.x * 9.0, p.y * 0.55, p.z * 9.0))) * smoothstep(3.6, 2.0, y) * (1.0 - up);
              #if ${kid} == 0 || ${kid} == 5
                diffuseColor.rgb = mix(diffuseColor.rgb, grimeCol, grime * 0.75);
                diffuseColor.rgb = mix(diffuseColor.rgb, dustCol, streak * 0.35);
                diffuseColor.rgb = mix(diffuseColor.rgb, sootCol, soot * 0.8);
                roughnessFactor = clamp(roughnessFactor + grime * 0.35 + soot * 0.45 + up * W * 0.12 * mid, 0.0, 1.0);
                #if ${kid} == 5
                  float coal = W * smoothstep(2.4, 3.1, y) * (0.5 + 0.5 * mid);
                  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018), coal * 0.7); roughnessFactor = mix(roughnessFactor, 0.85, coal);
                #endif
                wBump = (fine * 0.3 + grime) * 0.6;
              #elif ${kid} == 1
                float heat = W * smoothstep(0.45, 0.7, mid);
                float rust = W * smoothstep(0.66, 0.8, wFbm(p * 5.0 + 7.0)) * smoothstep(2.9, 2.0, y);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.033, 0.031), heat * 0.6);
                diffuseColor.rgb = mix(diffuseColor.rgb, rustCol, rust * 0.45);
                roughnessFactor = clamp(roughnessFactor + 0.08 * heat, 0.0, 1.0);
                wBump = fine * 0.5 + rust;
              #elif ${kid} == 2
                float oil = W * smoothstep(0.5, 0.75, mid);
                float brake = W * smoothstep(0.75, 0.2, y) * smoothstep(0.3, 0.7, big);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.08, 0.05), brake * 0.6);
                roughnessFactor = clamp(roughnessFactor - oil * 0.35 + brake * 0.25, 0.05, 1.0);
                wBump = fine * 0.4 + brake * 0.6;
              #elif ${kid} == 3
                float film = W * smoothstep(0.4, 0.8, mid);
                diffuseColor.rgb *= mix(1.0, 0.72, film);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.2, 0.12), W * 0.18 * smoothstep(0.6, 0.85, big));
                roughnessFactor = clamp(roughnessFactor + (big - 0.5) * 0.3 * W, 0.12, 0.8);
              #elif ${kid} == 4
                diffuseColor.rgb = mix(diffuseColor.rgb, grimeCol, W * 0.45 * smoothstep(0.4, 0.8, big));
                float chip = W * smoothstep(0.82, 0.9, wNoise(p * 30.0));
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05), chip);
                roughnessFactor = clamp(roughnessFactor + 0.2 * W * big, 0.0, 1.0);
                wBump = chip;
              #elif ${kid} == 6
                diffuseColor.rgb *= mix(1.0, 0.6, W * smoothstep(0.35, 0.8, mid));
                roughnessFactor = clamp(roughnessFactor + 0.25 * W * mid, 0.0, 1.0);
              #endif
            }`)
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            {
              float h = wBump * 0.0025 * uWeather;
              vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
              vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
              float det = dot(sx, r1);
              vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
              normal = normalize(abs(det) * normal - grad);
            }`);
      };
      m.customProgramCacheKey = () => `weather-${kid}`;
      m.needsUpdate = true;
    });
  }

  /** Call every frame before rendering (vehicles may move). */
  update() {
    for (const e of this.entries) { e.vehicle.updateWorldMatrix(true, false); e.inv.value.copy(e.vehicle.matrixWorld).invert(); }
  }

  setAmount(a: number) { this.amount.value = a; }
}
