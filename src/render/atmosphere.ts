// Sky (Preetham model with procedural clouds), sun light with cascaded shadows, image-based
// ambient light regenerated from the same sky, and exponential haze tinted by sun height.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSM } from 'three/addons/csm/CSM.js';
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
  turbidity: 6, rayleigh: 1.6, mie: 0.006, mieG: 0.8,
  cloudCoverage: 0.45, cloudDensity: 0.55, haze: 0.0011,
  sunIntensity: 3.2, envIntensity: 1.0,
};

export class Atmosphere {
  readonly sky = new Sky();
  readonly params: AtmosphereParams = structuredClone(DEFAULT_ATMOSPHERE);
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  sun = { elevation: 0, azimuth: 0 };
  csm!: CSM;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envDirty = true;
  private materials = new Set<THREE.Material>();
  private scene: THREE.Scene;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, tier: TierSpec) {
    this.scene = scene;
    this.sky.scale.setScalar(9000); this.sky.name = 'sky';
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envSky.scale.setScalar(9000);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.fog = new THREE.FogExp2(0xb8c4cc, this.params.haze);
    this.makeCSM(camera, tier);
    this.update(0);
  }

  makeCSM(camera: THREE.Camera, tier: TierSpec) {
    if (this.csm) { this.csm.remove(); this.csm.dispose(); }
    this.csm = new CSM({
      camera: camera as THREE.PerspectiveCamera, parent: this.scene, cascades: tier.cascades, maxFar: tier.shadowFar,
      mode: 'practical', shadowMapSize: tier.shadowSize, shadowBias: -0.0002, lightDirection: this.sunDir.clone().negate(),
      lightIntensity: this.params.sunIntensity, lightMargin: 60,
    });
    for (const l of this.csm.lights) { l.shadow.normalBias = 0.03; l.shadow.radius = 2; }
    for (const m of this.materials) this.csm.setupMaterial(m);
  }

  /** Every lit material in the scene must be registered so it receives cascaded shadows. */
  register(root: THREE.Object3D) {
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (this.materials.has(m) || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
        this.materials.add(m); this.csm.setupMaterial(m);
      }
    });
  }

  setCamera(camera: THREE.Camera) { this.csm.camera = camera as THREE.PerspectiveCamera; this.csm.updateFrustums(); }

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
    this.csm.lightDirection.copy(this.sunDir).negate();
    for (const l of this.csm.lights) {
      l.intensity = p.sunIntensity * f * (1 - 0.55 * p.cloudCoverage * p.cloudDensity);
      l.color.setRGB(1, 0.94 - 0.2 * warm, 0.86 - 0.38 * warm);
    }
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
    }
    this.csm.update();
  }

  invalidate() { this.envDirty = true; }
}
