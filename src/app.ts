// Application: renderer, scene, loading, modes (orbit / walk / free), fixed-step simulation,
// sound, quality tier and the hooks used by the verification harness.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TIERS, detectTier, type Tier, type TierSpec, type GpuInfo } from './core/quality.ts';
import { params } from './core/params.ts';
import { Atmosphere } from './render/atmosphere.ts';
import { Post } from './render/post.ts';
import { buildSite } from './world/site.ts';
import { buildEngine, buildTender } from './loco/engine.ts';
import { blockoutMaterials } from './loco/materials.ts';
import { LocoRig } from './loco/rig.ts';
import { B5, ENGINE_ORIGIN_D, TENDER_ORIGIN_D, zEngine, zTender } from './specs/black5.ts';
import { Walker } from './controls/walk.ts';
import { WalkInputs } from './controls/input.ts';
import { AudioEngine } from './audio/engine.ts';
import { Soundscape, type LocoSoundPoints } from './audio/sounds.ts';
import { VIEWS } from './debug/views.ts';
import { paintDecals } from './render/decals.ts';
import { Weathering } from './render/weathering.ts';
import { HotspotLayer } from './ui/hotspots.ts';
import { Footplate } from './sim/footplate.ts';
import { CabRig } from './loco/cabRig.ts';
import { CabUI } from './ui/cabUI.ts';

const BASE = import.meta.env.BASE_URL;
export type Mode = 'orbit' | 'walk' | 'free';
const SIM_HZ = 120;

export class App {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly persp = new THREE.PerspectiveCamera(50, 1, 0.05, 20000);
  readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  camera: THREE.Camera = this.persp;
  tierName: Tier;
  tier: TierSpec;
  tierReason: string;
  gpu: GpuInfo;
  atmosphere!: Atmosphere;
  post!: Post;
  orbit!: OrbitControls;
  walker = new Walker();
  inputs!: WalkInputs;
  mode: Mode = 'orbit';
  audio = new AudioEngine();
  sounds = new Soundscape(this.audio);
  rigs: LocoRig[] = [];
  weathering = new Weathering();
  hotspots!: HotspotLayer;
  cutoff = 0.65;
  footplate = new Footplate();
  cabRig!: CabRig;
  cabUI!: CabUI;
  private soundPointsCache: LocoSoundPoints | null = null;
  engine = new THREE.LOD();
  tender = new THREE.LOD();
  site!: ReturnType<typeof buildSite>;
  simTime = 0;
  theta = 0;
  motionOn = false;
  motionSpeed = 10 / 3.6; // m/s on the "rolling road"
  ready = false;
  silhouette = false;
  frameMs = 0;
  gpuMs = -1;
  private acc = 0;
  private last = performance.now();
  private timer: { ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null; queries: WebGLQuery[] } = { ext: null, queries: [] };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: params.shot !== null || params.fixed });
    const det = detectTier(this.renderer);
    this.gpu = det.gpu;
    const forced = params.q ?? (localStorage.getItem('gse.quality') as Tier | 'auto' | null);
    this.tierName = forced && forced !== 'auto' && forced in TIERS ? forced : det.tier;
    this.tierReason = forced && forced !== 'auto' ? 'chosen' : det.reason;
    this.tier = TIERS[this.tierName];
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 0.3;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.info.autoReset = false;
    this.audio.hrtf = this.tier.hrtf;
    const gl = r.getContext() as WebGL2RenderingContext;
    this.timer.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  }

  async load(progress: (f: number, text: string) => void) {
    const r = this.renderer;
    this.resize();
    this.atmosphere = new Atmosphere(r, this.scene, this.persp, this.tier);
    this.post = new Post(r, this.scene, this.persp, this.tier);
    this.resize();

    // asset sizes for an honest byte-based progress bar
    const manifest = await (await fetch(`${BASE}models/manifest.json`)).json() as { files: Record<string, { bytes: number }> };
    const total = Object.values(manifest.files).reduce((s, f) => s + f.bytes, 0);
    const loaded = new Map<string, number>();
    const tick = (name: string, bytes: number) => { loaded.set(name, bytes); const sum = [...loaded.values()].reduce((a, b) => a + b, 0); progress(Math.min(1, sum / total), `Loading ${name} (${(sum / 1048576).toFixed(1)} of ${(total / 1048576).toFixed(1)} MB)`); };

    const ktx2 = new KTX2Loader().setTranscoderPath(`${BASE}basis/`).detectSupport(r);
    const tex = async (name: string) => {
      const t = await ktx2.loadAsync(`${BASE}textures/${name}.ktx2`, (e) => tick(`${name}.ktx2`, e.loaded));
      t.anisotropy = Math.min(this.tier.anisotropy, r.capabilities.getMaxAnisotropy());
      tick(`${name}.ktx2`, manifest.files[`../textures/${name}.ktx2`]?.bytes ?? 0);
      return t;
    };
    const [bc, bn, br, gc, gn, gr] = await Promise.all(['ballast_color', 'ballast_normal', 'ballast_rough', 'ground_color', 'ground_normal', 'ground_rough'].map(tex));
    this.site = buildSite({ ballast: { color: bc, normal: bn, rough: br }, ground: { color: gc, normal: gn, rough: gr } });
    this.scene.add(this.site.group);

    // locomotive: compressed GLB LODs (default) or live generation (?live=1, for development)
    const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
    const lodDist = [0, 28, 120];
    for (const [lod, name, build] of [[this.engine, 'engine', buildEngine], [this.tender, 'tender', buildTender]] as const) {
      for (let l = 0; l < 3; l++) {
        let root: THREE.Object3D;
        if (params.live) { root = build(blockoutMaterials()); if (l > 0) continue; }
        else {
          const file = `${name}_lod${l}.glb`;
          const g = await gltf.loadAsync(`${BASE}models/${file}`, (e) => tick(file, e.loaded));
          tick(file, manifest.files[file].bytes);
          root = g.scene.children[0] ?? g.scene;
        }
        root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        lod.addLevel(root, lodDist[l]);
      }
    }
    this.engine.name = 'engineLOD'; this.tender.name = 'tenderLOD';
    this.engine.position.set(0, 0, 0);
    this.tender.position.set(0, 0, -(TENDER_ORIGIN_D - ENGINE_ORIGIN_D));
    this.scene.add(this.engine, this.tender);
    for (let i = 0; i < this.engine.levels.length; i++) this.rigs.push(new LocoRig(this.engine.levels[i].object, this.tender.levels[i].object));
    // livery decals, lit lamps and procedural weathering
    paintDecals(this.engine, this.tier.anisotropy); paintDecals(this.tender, this.tier.anisotropy);
    this.engine.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name === 'lamp_lens') m.emissiveIntensity = 2.5; });
    // the cab shell (slightly larger than the walls so their inner faces are inside); open at the back
    Weathering.occlusion.set('engine', { min: new THREE.Vector3(-1.36, 1.55, zEngine(12.64)), max: new THREE.Vector3(1.36, 3.78, zEngine(10.0)), f: 0.22, rampZ: 0.9 });
    Weathering.occlusion.set('tender', { min: new THREE.Vector3(-1.3, 1.55, zTender(12.85)), max: new THREE.Vector3(1.3, 2.95, zTender(12.3)), f: 0.5, rampZ: 0.15 });
    for (const l of this.engine.levels) this.weathering.apply(l.object, this.engine, false);
    for (const l of this.tender.levels) this.weathering.apply(l.object, this.tender, true);
    this.hotspots = new HotspotLayer(this.engine, this.tender);
    // cab: simulation-driven controls, gauges, fire glow and lamps
    this.cabRig = new CabRig(this.engine.levels[0].object, this.tender.levels[0].object);
    for (const l of [this.cabRig.fireLight, this.cabRig.cabLamp]) { l.position.z = zEngine(l.userData.d); this.engine.add(l); }
    this.cabUI = new CabUI(this.canvas, [this.engine.levels[0].object, this.tender.levels[0].object], this.footplate);
    this.cabUI.onChange = (id, val) => {
      if (id === 'reverser') this.setCutoff(val, false);
      if (id === 'fireDoors' || id === 'coalDoors' || id === 'cabLight' || id === 'drainCocks') this.sounds.clank(this.engine.localToWorld(new THREE.Vector3(0, 2.2, zEngine(10.5))), id === 'fireDoors' ? 0.8 : 1.2);
    };
    // Low tier: small moving parts do not cast shadows (saves ~40 shadow-pass draw calls on phones)
    if (this.tierName === 'low') for (const lod of [this.engine, this.tender]) lod.traverse((o) => { if ((o as THREE.Mesh).isMesh && /^(rod_|vg_|xh_|pr_|cab_gate)/.test(o.name)) o.castShadow = false; });

    // walking colliders: ground, ballast, platform + the full-detail engine and tender
    this.scene.updateMatrixWorld(true);
    this.walker.setColliders([...this.site.colliders, this.engine.levels[0].object, this.tender.levels[0].object]);
    this.inputs = new WalkInputs(this.canvas, this.walker.input);
    this.inputs.clickTaken = () => !!this.cabUI?.wantsClick;
    this.inputs.lookSuspended = () => !!this.cabUI?.dragging && !!this.cabUI.selected;

    // controls
    this.orbit = new OrbitControls(this.persp, this.canvas);
    this.orbit.enableDamping = true; this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 1.5; this.orbit.maxDistance = 150; this.orbit.maxPolarAngle = 1.53;
    this.setView('front-34-l');

    // sound (starts on the first user gesture)
    this.audio.onStart(() => {
      this.sounds.ambience(new THREE.Vector3(-60, -0.5, -40));
      this.sounds.locoIdle(this.soundPoints());
    });

    addEventListener('resize', () => this.resize());
    this.ready = true;
    progress(1, 'Ready');
  }

  /** World positions of sound sources on the engine. Air pump position is an estimate (REFERENCE §2). */
  soundPoints(): LocoSoundPoints {
    const w = (x: number, y: number, d: number) => this.engine.localToWorld(new THREE.Vector3(x, y, zEngine(d)));
    return {
      chimney: w(0, B5.height.v, B5.chimneyD.v),
      safetyValves: w(0, B5.fireboxTopH.v + 0.1, B5.safetyValveD.v),
      airPump: w(-1.1, B5.runningPlateH.v + 0.3, 2.2),
      firehole: w(0, 2.0, B5.cabFrontD.v + 0.1),
      cylL: w(1.0, 0.8, 2.5), cylR: w(-1.0, 0.8, 2.5),
      injector: w(-0.75, 1.15, 10.6),
      motionL: w(1.0, 1.0, 5.5), motionR: w(-1.0, 1.0, 5.5),
    };
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, this.tier.dprCap);
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.persp.aspect = w / h; this.persp.updateProjectionMatrix();
    this.post?.composer?.setPixelRatio(dpr);
    this.post?.setSize(w, h);
    this.updateOrtho();
  }

  private orthoView: { dir: string; centre: [number, number, number]; pxPerM: number } | null = null;
  private updateOrtho() {
    if (!this.orthoView) return;
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    const hw = w / this.orthoView.pxPerM / 2, hh = h / this.orthoView.pxPerM / 2;
    Object.assign(this.ortho, { left: -hw, right: hw, top: hh, bottom: -hh });
    this.ortho.updateProjectionMatrix();
  }

  setCamera(cam: THREE.Camera) {
    this.camera = cam;
    this.post.setCamera(cam);
  }

  setMode(m: Mode) {
    this.mode = m;
    this.inputs.enabled = m === 'walk';
    this.orbit.enabled = m !== 'walk';
    if (m === 'free') { this.orbit.maxPolarAngle = Math.PI; this.orbit.minDistance = 0.05; }
    else { this.orbit.maxPolarAngle = 1.53; this.orbit.minDistance = 1.5; }
    if (m === 'walk' && this.camera !== this.persp) this.setCamera(this.persp);
    if (m !== 'walk' && document.pointerLockElement) document.exitPointerLock();
    this.persp.fov = m === 'walk' ? 72 : 50; this.persp.updateProjectionMatrix();
  }

  /** Apply a named fixed view (see debug/views.ts). */
  setView(name: string) {
    const v = VIEWS[name];
    if (!v) throw new Error(`unknown view ${name}`);
    this.orthoView = null;
    this.site.group.visible = v.kind !== 'ortho';
    // elevations are measured views: always full detail (LOD switching would use the 120 m camera distance)
    for (const lod of [this.engine, this.tender]) {
      lod.autoUpdate = v.kind !== 'ortho';
      if (v.kind === 'ortho') lod.levels.forEach((l, i) => { l.object.visible = i === 0; });
    }
    if (v.kind === 'persp') {
      this.setMode('orbit'); this.setCamera(this.persp);
      this.persp.fov = v.fov; this.persp.updateProjectionMatrix();
      this.persp.position.set(...v.pos); this.orbit.target.set(...v.target); this.orbit.update();
    } else if (v.kind === 'walk') {
      this.setMode('walk');
      this.walker.teleport(...v.feet, v.yaw); this.walker.pitch = v.pitch; this.walker.applyTo(this.persp);
    } else {
      this.setMode('orbit'); this.orbit.enabled = false;
      this.orthoView = { dir: v.dir, centre: v.centre, pxPerM: v.pxPerM };
      const [cx, cy, cz] = v.centre, D = 120;
      const pos: Record<string, [number, number, number]> = { left: [cx + D, cy, cz], right: [cx - D, cy, cz], front: [cx, cy, cz + D], top: [cx, cy + D, cz] };
      this.ortho.position.set(...pos[v.dir]);
      this.ortho.up.set(v.dir === 'top' ? 1 : 0, v.dir === 'top' ? 0 : 1, 0); // plan: engine left side at the top, front to the right
      this.ortho.lookAt(cx, cy, cz);
      this.ortho.near = 1; this.ortho.far = 400;
      this.updateOrtho();
      this.setCamera(this.ortho);
    }
  }

  setMotion(on: boolean) { this.motionOn = on; }

  setWheelAngle(theta: number) { this.theta = theta; for (const r of this.rigs) r.setWheelAngle(theta); }

  private gateOpen = 0;
  /** Cab gates swing open when you walk up to the cab, and close again when you leave. */
  private updateGates(dt: number) {
    const lvl = this.engine.levels[0]?.object; if (!lvl) return;
    const near = this.mode === 'walk' && this.walker.feet.distanceTo(new THREE.Vector3(0, B5.footplateH.v, zEngine(12.1))) < 2.6;
    this.gateOpen = THREE.MathUtils.clamp(this.gateOpen + (near ? 1 : -1) * dt * 1.5, 0, 1);
    const a = THREE.MathUtils.smoothstep(this.gateOpen, 0, 1) * 1.45;
    for (const l of this.engine.levels) for (const [n, s] of [['cab_gate_L', 1], ['cab_gate_R', -1]] as const) { const g = l.object.getObjectByName(n); if (g) g.rotation.y = s * a; }
  }

  setCutoff(c: number, fromApp = true) { this.cutoff = c; if (fromApp) this.footplate.set('reverser', c); for (const r of this.rigs) r.setCutoff(c); }

  /** Advance the simulation by n fixed steps (used directly in deterministic mode). */
  step(n = 1) {
    const h = 1 / SIM_HZ;
    for (let i = 0; i < n; i++) {
      this.simTime += h;
      if (this.mode === 'walk') { this.inputs.update(); this.walker.step(h); }
      this.footplate.step(h);
      const fpOmega = this.footplate.wheelOmega;
      const omega = this.motionOn ? this.motionSpeed / (B5.driverDia.v / 2) : fpOmega;
      if (omega !== 0) this.setWheelAngle(this.theta + omega * h);
      if (this.audio.running) this.sounds.motion(this.theta, omega, this.soundPointsCache ??= this.soundPoints(), this.motionOn ? undefined : { steam: this.footplate.steamUse, cocks: this.footplate.c.drainCocks });
    }
  }

  setSilhouette(on: boolean) {
    this.silhouette = on;
    this.site.group.visible = !on;
    this.atmosphere.sky.visible = !on;
    this.scene.overrideMaterial = on ? new THREE.MeshBasicMaterial({ color: 0x000000 }) : null;
    this.scene.background = on ? new THREE.Color(0xffffff) : null;
    (this.scene.fog as THREE.FogExp2).density = on ? 0 : this.atmosphere.params.haze;
  }

  frame() {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!params.fixed) {
      this.acc += dt;
      const n = Math.min(24, Math.floor(this.acc * SIM_HZ));
      this.acc -= n / SIM_HZ;
      this.step(n);
    }
    if (this.mode === 'walk') this.walker.applyTo(this.persp);
    else if (this.orbit.enabled) this.orbit.update();
    this.updateGates(params.fixed ? 1 : dt);
    this.cabRig?.apply(this.footplate, this.simTime);
    // aim with the crosshair when the mouse is captured; otherwise point with the cursor or finger
    if (this.cabUI) this.cabUI.update(this.camera, this.mode === 'walk' && document.pointerLockElement === this.canvas);
    if (this.audio.running) {
      const c = this.footplate.c, inj = (c.injL > 0.3 && c.waterL > 0.5 ? 1 : 0) + (c.injR > 0.3 && c.waterR > 0.5 ? 1 : 0);
      this.sounds.footplate({ blower: c.blower, safety: this.footplate.safetyLift, ejector: Math.min(1, c.ejectorLarge + 0.3 * c.ejectorSmall), whistle: c.whistle, injectors: inj }, this.soundPointsCache ??= this.soundPoints());
    }
    this.atmosphere.setFocus(this.mode === 'walk' ? this.walker.feet : this.camera === this.ortho && this.orthoView ? new THREE.Vector3(...this.orthoView.centre) : this.orbit.target);
    this.atmosphere.update(this.simTime);
    this.weathering.update();
    this.audio.updateListener(this.camera === this.ortho ? this.persp : this.camera);
    const t0 = performance.now();
    this.renderer.info.reset();
    this.gpuTimerBegin();
    if (this.silhouette) this.renderer.render(this.scene, this.camera);
    else this.post.render(this.scene, this.camera);
    this.gpuTimerEnd();
    this.frameMs = performance.now() - t0;
    this.hotspots?.update(this.camera, this.canvas.clientWidth || innerWidth, this.canvas.clientHeight || innerHeight);
  }

  private gpuTimerBegin() {
    const ext = this.timer.ext; if (!ext) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const q = gl.createQuery(); if (!q) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q); this.timer.queries.push(q);
  }
  private gpuTimerEnd() {
    const ext = this.timer.ext; if (!ext) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    while (this.timer.queries.length) {
      const q = this.timer.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) this.gpuMs = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(q); this.timer.queries.shift();
    }
  }

  /** Texture memory estimate (bytes) from all textures in the scene + render targets ignored. */
  textureBytes() {
    const seen = new Set<THREE.Texture>(); let bytes = 0;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m) return;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const) {
        const t = m[k]; if (!t || seen.has(t)) continue; seen.add(t);
        const img = t.image as { width: number; height: number } | undefined;
        if (!img) continue;
        const compressed = (t as THREE.CompressedTexture).isCompressedTexture;
        bytes += img.width * img.height * (compressed ? 1 : 4) * 1.333; // BC7/ASTC ~1 B/px, ETC/BC1 less; mip chain +33 %
      }
    });
    return bytes;
  }

  stats() {
    const i = this.renderer.info;
    return {
      tier: this.tierName, reason: this.tierReason, gpu: this.gpu.renderer,
      calls: i.render.calls, triangles: i.render.triangles, textures: i.memory.textures, geometries: i.memory.geometries,
      textureMB: +(this.textureBytes() / 1048576).toFixed(1), frameMsCPU: +this.frameMs.toFixed(2), frameMsGPU: +this.gpuMs.toFixed(2),
      dpr: this.renderer.getPixelRatio(), px: [this.renderer.domElement.width, this.renderer.domElement.height],
    };
  }
}
