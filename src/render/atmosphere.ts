// Sky (Preetham model with procedural clouds), the sun with a camera-following shadow map,
// image-based ambient light regenerated from the same sky, and exponential haze tinted by sun height.
//
// Note: three's CSM addon (cascaded shadows) was tried first. In r186 it replaces a core lighting
// shader chunk with an outdated copy that removes environment reflections from metals (verified
// with test spheres, 2026-10-05). Until that is fixed upstream or replaced (Phase 5 needs long-range
// shadows), a single texel-snapped shadow map follows the camera's focus.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLENFINNAN, solarPosition, sunDirection, ukLocalToUTC } from './solar.ts';
import type { TierSpec } from '../core/quality.ts';

export interface AtmosphereParams {
  date: { y: number; m: number; d: number };
  hour: number; // UK civil time
  turbidity: number;
  rayleigh: number;
  mie: number;
  mieG: number;
  cloudCoverage: number;
  cloudDensity: number;
  haze: number; // fog density per metre
  sunIntensity: number;
  envIntensity: number;
}

export const DEFAULT_ATMOSPHERE: AtmosphereParams = {
  date: { y: 2026, m: 8, d: 24 }, hour: 11.25,
  turbidity: 5, rayleigh: 1.6, mie: 0.004, mieG: 0.76,
  cloudCoverage: 0.45, cloudDensity: 0.55, haze: 0.0011,
  // Units: the Preetham sky radiance sets the scale. Sun irradiance ~2.6x the sky's (hazy Highland
  // day); env at 1.0 keeps reflected sky equal to the visible sky; exposure brings it to display range.
  sunIntensity: 20, envIntensity: 1.0,
};

export class Atmosphere {
  readonly sky = new Sky();
  readonly params: AtmosphereParams = structuredClone(DEFAULT_ATMOSPHERE);
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  sun = { elevation: 0, azimuth: 0 };
  readonly light = new THREE.DirectionalLight(0xffffff, 1);
  private focus = new THREE.Vector3();
  private extent = 40;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  // the Preetham sky is black below the horizon; a lit ground disc gives reflections and ambient light from below
  private envGround = new THREE.Mesh(new THREE.CircleGeometry(8000, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x404030, fog: false }));
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envDirty = true;
  private scene: THREE.Scene;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, tier: TierSpec) {
    this.scene = scene;
    this.sky.scale.setScalar(9000); this.sky.name = 'sky';
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envSky.scale.setScalar(9000);
    this.envScene.add(this.envSky);
    this.envGround.position.y = -1.5;
    this.envScene.add(this.envGround);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.fog = new THREE.FogExp2(0xb8c4cc, this.params.haze);
    const l = this.light, sh = l.shadow;
    l.castShadow = true; l.name = 'sun';
    sh.mapSize.set(tier.shadowSize, tier.shadowSize);
    this.extent = tier.shadowExtent;
    Object.assign(sh.camera, { left: -this.extent, right: this.extent, top: this.extent, bottom: -this.extent, near: 1, far: 600 });
    sh.camera.updateProjectionMatrix();
    sh.bias = -0.0004; sh.normalBias = 0.025; sh.radius = 2;
    scene.add(l, l.target);
    void camera;
    this.update(0);
  }

  /** The shadow map is centred here (orbit target or the walker). */
  setFocus(p: THREE.Vector3) { this.focus.copy(p); }

  /** Set true each frame something that casts shadows moves (e.g. turning wheels on High/Medium). */
  dynamicShadows = false;
  private lastTarget = new THREE.Vector3(1e9, 0, 0);
  private renderer: THREE.WebGLRenderer | null = null;
  attachRenderer(r: THREE.WebGLRenderer) { this.renderer = r; r.shadowMap.autoUpdate = false; r.shadowMap.needsUpdate = true; }

  private placeLight() {
    // keep the shadow frustum on whole texels in light space so edges do not shimmer as the focus moves
    const texel = (2 * this.extent) / this.light.shadow.mapSize.x;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.sunDir);
    const local = this.focus.clone().applyQuaternion(q.clone().invert());
    local.x = Math.round(local.x / texel) * texel; local.y = Math.round(local.y / texel) * texel;
    const snapped = local.applyQuaternion(q);
    this.light.target.position.copy(snapped);
    this.light.position.copy(snapped).addScaledVector(this.sunDir, 300);
    this.light.target.updateMatrixWorld();
    // the scene is mostly still: redraw the shadow map only when the light moved or something moves
    if (this.renderer && (this.dynamicShadows || !this.lastTarget.equals(snapped))) this.renderer.shadowMap.needsUpdate = true;
    this.lastTarget.copy(snapped);
  }

  /** Recompute sun, sky, fog colour and light. Call after changing params. */
  apply() {
    const p = this.params;
    const utc = ukLocalToUTC(p.date.y, p.date.m, p.date.d, p.hour);
    const sp = solarPosition(utc, GLENFINNAN.lat, GLENFINNAN.lon);
    this.sun = { elevation: sp.elevation, azimuth: sp.azimuth };
    this.sunDir.set(...sunDirection(sp.elevation, sp.azimuth));
    for (const sky of [this.sky, this.envSky]) {
      const u = sky.material.uniforms;
      u.turbidity.value = p.turbidity; u.rayleigh.value = p.rayleigh; u.mieCoefficient.value = p.mie; u.mieDirectionalG.value = p.mieG;
      u.cloudCoverage.value = p.cloudCoverage; u.cloudDensity.value = p.cloudDensity; u.sunPosition.value.copy(this.sunDir);
    }
    this.envSky.material.uniforms.showSunDisc.value = 0;
    // light fades through the last few degrees above the horizon; warmer when low
    const el = Math.max(sp.elevation, -2);
    const f = THREE.MathUtils.smoothstep(el, -1, 12);
    const warm = 1 - THREE.MathUtils.smoothstep(el, 2, 25);
    this.light.intensity = p.sunIntensity * f * (1 - 0.55 * p.cloudCoverage * p.cloudDensity);
    this.light.color.setRGB(1, 0.94 - 0.2 * warm, 0.86 - 0.38 * warm);
    // ground bounce: albedo ~0.15 lit by sun and sky (same relative units as the lights)
    // (in env-scene units: the PMREM result is later scaled by envIntensity, the sky averages ~1.5 there)
    const sunE = p.sunIntensity * Math.max(0, Math.sin((el * Math.PI) / 180)) * f;
    const gl = Math.min(3, ((0.15 / Math.PI) * (sunE + p.envIntensity * Math.PI * 1.5)) / Math.max(0.02, p.envIntensity));
    (this.envGround.material as THREE.MeshBasicMaterial).color.setRGB(gl * 0.92, gl, gl * 0.78);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density = p.haze;
    fog.color.setRGB(0.70 + 0.14 * warm, 0.76 - 0.06 * warm, 0.82 - 0.22 * warm).multiplyScalar(0.25 + 0.75 * f);
    this.envDirty = true;
  }

  update(time: number) {
    this.sky.material.uniforms.time.value = time;
    if (this.envDirty) this.apply();
    if (this.envDirty) {
      this.envDirty = false;
      this.envSky.material.uniforms.time.value = time;
      const rt = this.pmrem.fromScene(this.envScene, 0, 1, 20000);
      this.envRT?.dispose(); this.envRT = rt;
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = this.params.envIntensity;
      if (this.renderer) this.renderer.shadowMap.needsUpdate = true;
    }
    this.placeLight();
  }

  invalidate() { this.envDirty = true; }
}
