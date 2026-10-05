// Breaks visible texture repetition on large surfaces: each lookup is offset by a smoothly varying
// per-region random shift (after I. Quilez, "texture repetition", technique 3) and the colour gets a
// gentle low-frequency variation. (userData.baseHook keeps the hook available for chaining.)
import type * as THREE from 'three';

const GLSL = /* glsl */ `
  float atHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
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

export function antiTile(mat: THREE.MeshStandardMaterial, macro = 0.25) {
  mat.userData.baseHook = mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 texel = atSample(map, vMapUv);
          float macroV = mix(1.0 - ${macro.toFixed(3)}, 1.0 + ${macro.toFixed(3)}, atNoise(vMapUv * 0.05));
          diffuseColor *= vec4(texel.rgb * macroV, texel.a);
        #endif`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
          roughnessFactor *= atSample(roughnessMap, vRoughnessMapUv).g;
        #endif
        roughnessFactor = max(roughnessFactor, 0.72); // natural ground is never glossy`)
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec3 mapN = atSample(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          normal = normalize(tbn * mapN);
        #else
          #include <normal_fragment_maps>
        #endif`);
  };
  mat.customProgramCacheKey = () => `antitile2-${macro}`;
}
