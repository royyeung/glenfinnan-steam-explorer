// Post-processing chain per tier. High: MSAA x4 + GTAO + bloom; Medium: bloom + SMAA;
// Low: no composer (the renderer tone-maps directly). Tone mapping happens in OutputPass.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { TierSpec } from '../core/quality.ts';

export class Post {
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  private renderPass: RenderPass | null = null;
  private gtao: GTAOPass | null = null;
  private renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, tier: TierSpec) {
    this.renderer = renderer;
    if (!tier.post) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tier.msaa });
    const c = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    c.addPass(this.renderPass);
    if (tier.ao) { this.gtao = new GTAOPass(scene, camera, size.x, size.y); this.gtao.blendIntensity = 0.75; c.addPass(this.gtao); }
    if (tier.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.15, 0.25, 6.0); c.addPass(this.bloom); }
    c.addPass(new OutputPass());
    if (tier.smaa) c.addPass(new SMAAPass());
    this.composer = c;
  }

  setCamera(camera: THREE.Camera) {
    if (this.renderPass) this.renderPass.camera = camera;
    if (this.gtao) this.gtao.camera = camera;
  }

  setSize(w: number, h: number) { this.composer?.setSize(w, h); }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.composer) this.composer.render();
    else this.renderer.render(scene, camera);
  }

  dispose() { this.composer?.dispose(); }
}
