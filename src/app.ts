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
import { World, WORLD_TIERS, type Placeable } from './world/world.ts';
import { buildEngine, buildTender } from './loco/engine.ts';
import { blockoutMaterials } from './loco/materials.ts';
import { LocoRig } from './loco/rig.ts';
import { B5, ENGINE_ORIGIN_D, TENDER_ORIGIN_D, zEngine, zTender, engineAxlesD, tenderAxlesD } from './specs/black5.ts';
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
import { Train } from './coach/train.ts';
import { buildCoach } from './coach/mk2.ts';
import { buildClass47 } from './diesel/class47.ts';
import { C47, c47BogieCentres } from './specs/class47.ts';
import { FORMATION, MK2, type CoachType } from './specs/mk2.ts';
import { paintCoachLetter, paintCoachNumber } from './render/decals.ts';

const BASE = import.meta.env.BASE_URL;
const SITE_PLATFORM_TOP = 0.915;
export type WeatherName = 'sunny' | 'fair' | 'overcast' | 'mist';
/** Weather presets (sky clouds, haze per metre for the 12 km landscape, air turbidity). */
export const WEATHER: Record<WeatherName, { cloudCoverage: number; cloudDensity: number; turbidity: number; haze: number }> = {
  sunny: { cloudCoverage: 0.22, cloudDensity: 0.45, turbidity: 3.2, haze: 0.00011 },
  fair: { cloudCoverage: 0.45, cloudDensity: 0.55, turbidity: 5, haze: 0.00022 },
  overcast: { cloudCoverage: 0.88, cloudDensity: 0.8, turbidity: 8, haze: 0.00038 },
  mist: { cloudCoverage: 1.0, cloudDensity: 0.92, turbidity: 10, haze: 0.0013 },
};
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
  private stepDist = 0;
  /** What the walker is standing on, by height and position (for footstep sounds). */
  private surface(): 'ground' | 'platform' | 'steel' | 'carpet' {
    const byHeight = (y: number) => (y > 1.5 ? 'steel' : y > 1.2 ? 'carpet' : y > 0.85 ? 'platform' : 'ground');
    if (!this.world) return byHeight(this.walker.groundHeight);
    // world mode: heights are above the OS datum, so judge them in the frame of the vehicle underfoot
    const feet = this.walker.feet;
    for (const v of this.trainFrame) {
      const l = v.obj.worldToLocal(feet.clone()), half = v.obj === this.tender ? 4.8 : 10.4;
      if (Math.abs(l.x) < 1.45 && Math.abs(l.z) < half && l.y > 0.5) return byHeight(l.y);
    }
    const path = this.world.data.track, s = path.nearest(feet.x, feet.z), pl = this.world.settlement.platform;
    if (s > pl.s0 && s < pl.s1 && feet.y > path.at(s).y + 0.7 && feet.distanceTo(path.at(s)) < 7) return 'platform';
    return 'ground';
  }
  train!: Train;
  private cabGroups: THREE.Object3D[] = [];
  cabRig!: CabRig;
  cabUI!: CabUI;
  private soundPointsCache: LocoSoundPoints | null = null;
  engine = new THREE.LOD();
  tender = new THREE.LOD();
  /** Class 47 at the rear of the train (seen on 22 Oct 2025, S58; in 2026 unconfirmed). */
  diesel = new THREE.LOD();
  dieselOn = params.diesel;
  site: ReturnType<typeof buildSite> | null = null;
  world: World | null = null;
  /** Where the train stands (world mode): arc length of the engine's front buffer. */
  placeName: 'viaduct' | 'station' = params.place;
  private vehicles: Placeable[] = [];
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
    this.atmosphere.attachRenderer(r);
    this.post = new Post(r, this.scene, this.persp, this.tier);
    this.resize();

    // asset sizes for an honest byte-based progress bar
    // the manifest is always re-checked; model and texture URLs carry a content hash, so a browser
    // can never pair new code with an old cached model
    const manifest = await (await fetch(`${BASE}models/manifest.json`, { cache: 'no-cache' })).json() as { files: Record<string, { bytes: number; hash?: string }> };
    const ver = (key: string) => (manifest.files[key]?.hash ? `?v=${manifest.files[key].hash}` : '');
    const total = Object.values(manifest.files).reduce((s, f) => s + f.bytes, 0);
    const loaded = new Map<string, number>();
    const tick = (name: string, bytes: number) => { loaded.set(name, bytes); const sum = [...loaded.values()].reduce((a, b) => a + b, 0); progress(Math.min(1, sum / total), `Loading ${name} (${(sum / 1048576).toFixed(1)} of ${(total / 1048576).toFixed(1)} MB)`); };

    const ktx2 = new KTX2Loader().setTranscoderPath(`${BASE}basis/`).detectSupport(r);
    const tex = async (name: string) => {
      const t = await ktx2.loadAsync(`${BASE}textures/${name}.ktx2${ver(`../textures/${name}.ktx2`)}`, (e) => tick(`${name}.ktx2`, e.loaded));
      t.anisotropy = Math.min(this.tier.anisotropy, r.capabilities.getMaxAnisotropy());
      tick(`${name}.ktx2`, manifest.files[`../textures/${name}.ktx2`]?.bytes ?? 0);
      return t;
    };
    const [bc, bn, br, gc, gn, gr] = await Promise.all(['ballast_color', 'ballast_normal', 'ballast_rough', 'ground_color', 'ground_normal', 'ground_rough'].map(tex));
    if (params.site === 'test') {
      this.site = buildSite({ ballast: { color: bc, normal: bn, rough: br }, ground: { color: gc, normal: gn, rough: gr } });
      this.scene.add(this.site.group);
    } else {
      // Glenfinnan from OS data (Phase 5): terrain, water, trees, track, viaduct, village
      const w = this.world = new World();
      const [rc, fc, cc, cn, cr, ac, an, ar] = await Promise.all(['rock_color', 'forest_color', 'concrete_color', 'concrete_normal', 'concrete_rough', 'asphalt_color', 'asphalt_normal', 'asphalt_rough'].map(tex));
      await w.load(BASE, ver, tick);
      w.build({ grass: { color: gc, normal: gn, rough: gr }, rock: rc, forest: fc, asphalt: ac, ballast: { color: bc, normal: bn, rough: br }, concrete: { color: cc, normal: cn, rough: cr }, asphaltSet: { color: ac, normal: an, rough: ar } }, WORLD_TIERS[this.tierName]);
      this.scene.add(w.group);
      // clearer air over a 12 km landscape than the test site's close haze
      this.atmosphere.params.haze = 0.00022;
      this.setWeather((params.weather as WeatherName) ?? 'fair');
    }

    // locomotive: compressed GLB LODs (default) or live generation (?live=1, for development)
    const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2);
    const lodDist = [0, 28, 120];
    for (const [lod, name, build] of [[this.engine, 'engine', buildEngine], [this.tender, 'tender', buildTender]] as const) {
      for (let l = 0; l < 3; l++) {
        let root: THREE.Object3D;
        if (params.live) { root = build(blockoutMaterials()); if (l > 0) continue; }
        else {
          const file = `${name}_lod${l}.glb`;
          const g = await gltf.loadAsync(`${BASE}models/${file}${ver(file)}`, (e) => tick(file, e.loaded));
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
    // the coaches: three LOD levels per coach type, loaded once and cloned for each coach of that type
    const coachLevels: Partial<Record<CoachType, THREE.Object3D[]>> = {};
    await Promise.all([...new Set(FORMATION.map((f) => f.type))].map(async (type) => {
      coachLevels[type] = await Promise.all([0, 1, 2].map(async (l) => {
        let root: THREE.Object3D;
        if (params.live) root = buildCoach(blockoutMaterials(), type);
        else {
          const file = `coach_${type}_lod${l}.glb`;
          const g = await gltf.loadAsync(`${BASE}models/${file}${ver(file)}`, (e) => tick(file, e.loaded));
          tick(file, manifest.files[file].bytes);
          root = g.scene.children[0] ?? g.scene;
        }
        // only the close-up coach casts sun shadows (not at all on Low); interiors never do
        root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = l === 0 && this.tierName !== 'low' && !/^coach_int/.test(o.name); o.receiveShadow = true; } });
        return root;
      }));
    }));
    // Low tier: coaches drop to the simplest model sooner (phones have the tightest draw-call budget)
    this.train = new Train(coachLevels, ENGINE_ORIGIN_D - B5.lengthOverBuffers.v, this.tierName === 'low' ? [0, 25, 38] : [0, 30, 110]);
    this.scene.add(this.train.group);
    // the diesel at the rear: three LOD levels, coupled behind the last coach, No. 1 end towards the train
    const dLod = this.tierName === 'low' ? [0, 25, 38] : [0, 30, 110];
    for (let l = 0; l < 3; l++) {
      let root: THREE.Object3D;
      if (params.live) { root = buildClass47(blockoutMaterials()); if (l > 0) continue; }
      else {
        const file = `diesel47_lod${l}.glb`;
        const g = await gltf.loadAsync(`${BASE}models/${file}${ver(file)}`, (e) => tick(file, e.loaded));
        tick(file, manifest.files[file].bytes);
        root = g.scene.children[0] ?? g.scene;
      }
      root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = l === 0 && this.tierName !== 'low'; o.receiveShadow = true; } });
      this.diesel.addLevel(root, dLod[l]);
    }
    this.diesel.name = 'dieselLOD';
    this.diesel.position.set(0, 0, this.train.coaches.at(-1)!.lod.position.z - MK2.lengthOverBuffers.v / 2 - C47.lengthOverBuffers.v / 2);
    this.diesel.visible = this.dieselOn;
    this.scene.add(this.diesel);
    // every vehicle's position in the straight train frame and its two supports (for track placement)
    const ax = engineAxlesD(), tx = tenderAxlesD(), bcz = MK2.bogieCentres.v / 2;
    this.vehicles = [
      { obj: this.engine, z0: 0, supports: [zEngine((ax.bogieFront + ax.bogieRear) / 2), zEngine(ax.drive)] },
      { obj: this.tender, z0: this.tender.position.z, supports: [zTender(tx[0]), zTender(tx[2])] },
      ...this.train.coaches.map((c) => ({ obj: c.lod as THREE.Object3D, z0: c.lod.position.z, supports: [bcz, -bcz] as [number, number] })),
      { obj: this.diesel, z0: this.diesel.position.z, supports: [c47BogieCentres() / 2, -c47BogieCentres() / 2] },
    ];
    this.trainFrame = this.vehicles.map((v) => ({ ...v, z1: v.z0 }));
    if (this.world) this.world.placeTrain(this.world.places[this.placeName], this.vehicles);
    this.train.onDoor = (pos, opening) => this.sounds.door(pos, opening);
    for (const c of this.train.coaches) {
      paintDecals(c.lod, this.tier.anisotropy);
      paintCoachNumber(c.lod, c.number, this.tier.anisotropy);
      paintCoachLetter(c.lod, c.vehicle.letter, this.tier.anisotropy);
      c.lod.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.name === 'lamp_shade') { m.emissive.set(0xffd9a0); m.emissiveIntensity = 3; }
        if (m?.name === 'coach_light') { m.emissive.set(0xfff6e0); m.emissiveIntensity = 6; }
        if (m?.name === 'cdl_light') { m.emissive.set(0xffa020); m.emissiveIntensity = 8; } });
    }
    // the diesel's lettering; its rear (No. 2 end) marker lights lit red as the train's tail lamps
    paintDecals(this.diesel, this.tier.anisotropy);
    this.diesel.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.name === 'spring_red') { const c = m.clone(); c.emissive.set(0xff2010); c.emissiveIntensity = 12; (o as THREE.Mesh).material = c; } });
    for (let i = 0; i < this.engine.levels.length; i++) this.rigs.push(new LocoRig(this.engine.levels[i].object, this.tender.levels[i].object));
    // livery decals, lit lamps and procedural weathering
    paintDecals(this.engine, this.tier.anisotropy); paintDecals(this.tender, this.tier.anisotropy);
    this.engine.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name === 'lamp_lens') { m.emissive.set(0xfff1d0); m.emissiveIntensity = 20; } }); // x10: exposure is 0.3
    // the cab shell (slightly larger than the walls so their inner faces are inside); open at the back
    Weathering.occlusion.set('engine', { min: new THREE.Vector3(-1.36, 1.55, zEngine(12.64)), max: new THREE.Vector3(1.36, 3.78, zEngine(10.0)), f: 0.22, rampZ: 0.9 });
    Weathering.occlusion.set('tender', { min: new THREE.Vector3(-1.3, 1.55, zTender(12.85)), max: new THREE.Vector3(1.3, 2.95, zTender(12.3)), f: 0.5, rampZ: 0.15 });
    for (const l of this.engine.levels) this.weathering.apply(l.object, this.engine, 'engine');
    for (const l of this.tender.levels) this.weathering.apply(l.object, this.tender, 'tender');
    const hw = MK2.bodyWidth.v / 2 - 0.02, hl = MK2.bodyLength.v / 2 - 0.02;
    Weathering.occlusion.set('coach', { min: new THREE.Vector3(-hw, MK2.floorH.v - 0.05, -hl), max: new THREE.Vector3(hw, MK2.height.v - 0.05, hl), f: 0.45, rampZ: 0.05 });
    for (const c of this.train.coaches) for (const l of c.lod.levels) this.weathering.apply(l.object, c.lod, 'coach');
    this.hotspots = new HotspotLayer(this.engine, this.tender, this.train.coaches);
    // cab: simulation-driven controls, gauges, fire glow and lamps
    this.cabRig = new CabRig(this.engine.levels[0].object, this.tender.levels[0].object);
    for (const root of [this.engine.levels[0].object, this.tender.levels[0].object]) {
      const g = root.getObjectByName('cab_interior');
      if (g) { this.cabGroups.push(g); g.traverse((o) => { o.castShadow = false; }); }
    }
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
    this.rebuildColliders();
    this.inputs = new WalkInputs(this.canvas, this.walker.input);
    this.inputs.clickTaken = () => !!this.cabUI?.wantsClick;
    this.inputs.lookSuspended = () => !!this.cabUI?.dragging && !!this.cabUI.selected;

    // controls
    this.orbit = new OrbitControls(this.persp, this.canvas);
    this.orbit.enableDamping = true; this.orbit.dampingFactor = 0.08;
    this.orbit.minDistance = 1.5; this.orbit.maxDistance = this.world ? 6000 : 150; this.orbit.maxPolarAngle = 1.53;
    // the wheel zooms towards whatever is under the cursor, about 15% per notch (the default 5% needed
    // 70 notches to come from the hillside to the train); double-click flies to the point clicked
    this.orbit.zoomToCursor = true; this.orbit.zoomSpeed = 3;
    this.canvas.addEventListener('dblclick', (e) => { if (this.mode !== 'walk') this.focusAt(e.clientX, e.clientY); });
    let tap = { t: 0, x: 0, y: 0 }, moved = false;  // double-tap on touch screens (no dblclick there)
    this.canvas.addEventListener('touchstart', (e) => { moved = e.touches.length > 1; }, { passive: true });
    this.canvas.addEventListener('touchmove', () => { moved = true; }, { passive: true });
    this.canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0]; if (this.mode === 'walk' || moved || !t || e.touches.length) return;
      const now = performance.now();
      if (now - tap.t < 320 && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) < 30) { this.focusAt(t.clientX, t.clientY); tap.t = 0; } else tap = { t: now, x: t.clientX, y: t.clientY };
    }, { passive: true });
    if (this.world) this.registerTrackViews();
    this.setView(this.world ? 'train-glen' : 'front-34-l');

    // sound (starts on the first user gesture)
    this.audio.onStart(() => {
      if (this.world) this.sounds.landscape(this.world.data, () => this.atmosphere.params.hour);
      else this.sounds.ambience(new THREE.Vector3(-60, -0.5, -40));
      this.sounds.locoIdle(this.soundPoints());
      this.sounds.dieselIdle(this.dieselSoundAt(), this.dieselOn);
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
    if (this.site) this.site.group.visible = v.kind !== 'ortho';
    if (this.world) this.world.group.visible = v.kind !== 'ortho';
    if (v.frame === 'world' && !this.world) throw new Error(`view ${name} needs the Glenfinnan world`);
    // train-frame views follow the train wherever it stands (world mode)
    const P = (p: [number, number, number], agl = false) => {
      if (v.frame !== 'world') return this.trainToWorld(new THREE.Vector3(...p));
      const q = new THREE.Vector3(...p); if (agl) q.y += this.world!.data.height(q.x, q.z); return q;
    };
    // elevations are measured views: always full detail (LOD switching would use the 120 m camera distance)
    for (const lod of [this.engine, this.tender]) {
      lod.autoUpdate = v.kind !== 'ortho';
      if (v.kind === 'ortho') lod.levels.forEach((l, i) => { l.object.visible = i === 0; });
    }
    if (v.kind === 'persp') {
      this.setMode('orbit'); this.setCamera(this.persp);
      this.persp.fov = v.fov; this.persp.updateProjectionMatrix();
      this.persp.position.copy(P(v.pos, v.agl)); this.orbit.target.copy(P(v.target)); this.orbit.update();
    } else if (v.kind === 'walk') {
      this.setMode('walk');
      const f = P(v.feet, v.agl);
      this.walker.teleport(f.x, f.y, f.z, v.yaw + (v.frame === 'world' ? 0 : this.trainYawAt(new THREE.Vector3(...v.feet)))); this.walker.pitch = v.pitch; this.walker.applyTo(this.persp);
    } else {
      this.setMode('orbit'); this.orbit.enabled = false;
      this.orthoView = { dir: v.dir, centre: v.centre, pxPerM: v.pxPerM };
      const [cx, cy, cz] = v.centre, D = 120;
      const pos: Record<string, [number, number, number]> = { left: [cx + D, cy, cz], right: [cx - D, cy, cz], front: [cx, cy, cz + D], top: [cx, cy + D, cz] };
      // measured elevations are taken in the engine's own frame wherever it stands
      const toW = (p: THREE.Vector3) => this.engine.localToWorld(p);
      this.ortho.position.copy(toW(new THREE.Vector3(...pos[v.dir])));
      this.ortho.up.set(v.dir === 'top' ? 1 : 0, v.dir === 'top' ? 0 : 1, 0).applyQuaternion(this.engine.getWorldQuaternion(new THREE.Quaternion())); // plan: engine left side at the top, front to the right
      this.ortho.lookAt(toW(new THREE.Vector3(cx, cy, cz)));
      this.ortho.near = 1; this.ortho.far = 400;
      this.updateOrtho();
      this.setCamera(this.ortho);
    }
  }

  private trainFrame: (Placeable & { z1: number })[] = [];
  /** The vehicle a straight-train-frame point belongs to (nearest by z). */
  private vehicleAt(p: THREE.Vector3) {
    let best = this.trainFrame[0], bd = Infinity;
    for (const v of this.trainFrame) {
      const len = v.obj === this.engine ? 12 : v.obj === this.tender ? 9 : 10.5, d = Math.abs(p.z - v.z0);
      const dd = Math.max(0, d - len);
      if (dd < bd) { bd = dd; best = v; }
    }
    return best;
  }
  /** Map a point given in the straight train frame (Phase 1-4 views and checks) to the world. */
  trainToWorld(p: THREE.Vector3) {
    if (!this.world || !this.trainFrame.length) return p.clone();
    const v = this.vehicleAt(p);
    return v.obj.localToWorld(new THREE.Vector3(p.x, p.y, p.z - v.z0));
  }
  /** Heading of the vehicle carrying a train-frame point (radians about +Y). */
  trainYawAt(p: THREE.Vector3) {
    if (!this.world || !this.trainFrame.length) return 0;
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(this.vehicleAt(p).obj.getWorldQuaternion(new THREE.Quaternion()));
    return Math.atan2(f.x, f.z);
  }
  /** Move the whole train to a named place on the line. */
  placeTrain(name: 'viaduct' | 'station') {
    if (!this.world) return;
    this.placeName = name;
    this.world.placeTrain(this.world.places[name], this.vehicles);
    this.scene.updateMatrixWorld(true);
    this.soundPointsCache = null;
    if (this.audio.running) { this.sounds.moveLoco(this.soundPoints()); this.sounds.dieselIdle(this.dieselSoundAt(), this.dieselOn); }
    this.rebuildColliders();
  }
  /** Show or hide the diesel at the rear (and its sound and collision). */
  setDiesel(on: boolean) {
    this.dieselOn = on; this.diesel.visible = on;
    if (this.audio.running) this.sounds.dieselIdle(this.dieselSoundAt(), on);
    this.rebuildColliders();
  }
  /** The diesel's engine room, mid-body, in world space. */
  dieselSoundAt() { return this.diesel.localToWorld(new THREE.Vector3(0, 2.6, -1.0)); }
  /** Views tied to the line: on the viaduct deck and on the station platform (world mode). */
  private registerTrackViews() {
    const path = this.world!.data.track, [sW] = path.viaduct, pl = this.world!.settlement.platform;
    const look = (s: number, sign: number) => { const t = path.tangent(s).multiplyScalar(sign); return Math.atan2(-t.x, -t.z); };
    const on = (s: number, u: number, dy: number): [number, number, number] => { const p = path.at(s), q = path.side(s); return [p.x + q.x * u, p.y + dy, p.z + q.z * u]; };
    VIEWS['viaduct-deck'] = { kind: 'walk', frame: 'world', feet: on(sW + 24, -2.15, -0.36), yaw: look(sW + 24, 1), pitch: -0.05 };
    VIEWS['viaduct-parapet'] = { kind: 'walk', frame: 'world', feet: on(sW + 190, -2.2, -0.36), yaw: look(sW + 190, 1) - 1.35, pitch: -0.32 };
    VIEWS['station-platform'] = { kind: 'walk', frame: 'world', feet: on(pl.s1 - 6, pl.u0 - 2.2, SITE_PLATFORM_TOP), yaw: look(pl.s1 - 6, -1) + 0.2, pitch: -0.02 };
    // the station from the end of platform 2, across the loop (as Geograph 4203905)
    const st = this.world!.settlement, s2 = pl.s1 - 4;
    VIEWS['station-p2'] = { kind: 'walk', frame: 'world', feet: on(s2, st.loop.offset(s2) + 4.3, SITE_PLATFORM_TOP), yaw: look(s2, -1) - 0.35, pitch: -0.03 };
    // from above the line east of the station, looking back along both platforms
    const sa = pl.s1 + 55, pa = on(sa, -14, 24), pt = on((pl.s0 + pl.s1) / 2, 0, 0);
    VIEWS['station-air'] = { kind: 'persp', frame: 'world', pos: pa, target: pt, fov: 50 };
  }

  private focus: { t: number; p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3 } | null = null;
  /** Fly the orbit camera towards the surface under a screen point (double-click). */
  focusAt(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.persp);
    const roots = [this.engine, this.tender, this.train.group, ...(this.dieselOn ? [this.diesel] : []), ...(this.world ? [this.world.group] : []), ...(this.site ? [this.site.group] : [])];
    const hit = ray.intersectObjects(roots, true).find((h) => h.object.visible && (h.object as THREE.Mesh).isMesh);
    if (!hit) return;
    const p0 = this.persp.position.clone(), t0 = this.orbit.target.clone(), t1 = hit.point.clone();
    const d = Math.max(6, p0.distanceTo(t1) * 0.3), p1 = t1.clone().add(p0.clone().sub(t1).setLength(d));
    this.focus = { t: 0, p0, p1, t0, t1 };
  }
  private stepFocus(dt: number) {
    const f = this.focus; if (!f) return;
    f.t = Math.min(1, f.t + dt / 0.6); const k = THREE.MathUtils.smootherstep(f.t, 0, 1);
    this.persp.position.lerpVectors(f.p0, f.p1, k); this.orbit.target.lerpVectors(f.t0, f.t1, k);
    if (f.t >= 1) this.focus = null;
  }

  /** Doorways you climb through: both cab entrances and every coach door, each side. From rail level
   *  the cab's first step is 0.62 m and Mk2 doors have no steps at all (floor 1.27 m), a climb made
   *  with the handrails, so it is an action (E, or the button) rather than a walk. */
  private doorways() {
    const out: { inside: THREE.Vector3; outside: THREE.Vector3; what: string }[] = [];
    for (const s of [1, -1]) out.push({ inside: this.trainToWorld(new THREE.Vector3(s * 0.6, B5.footplateH.v + 0.15, -5.6)), outside: this.trainToWorld(new THREE.Vector3(s * 2.15, B5.footplateH.v + 0.15, -5.9)), what: 'the cab' });
    for (const c of this.train.coaches) {
      const lay = c.lay;
      for (const k of Object.keys(lay.doors)) for (const s of [1, -1]) {
        const z = lay.z(lay.doors[k]);
        out.push({ inside: c.lod.localToWorld(new THREE.Vector3(s * (lay.halfW - 0.45), 1.3, z)), outside: c.lod.localToWorld(new THREE.Vector3(s * (lay.halfW + 0.6), 1.3, z)), what: `coach ${c.number}` });
      }
    }
    return out;
  }
  /** What the walker can do at the nearest doorway: climb in from beside it, or step down from it. */
  boardingOffer(): { label: string; to: THREE.Vector3; yaw: number } | null {
    if (this.mode !== 'walk') return null;
    const f = this.walker.feet, flat = (a: THREE.Vector3) => Math.hypot(a.x - f.x, a.z - f.z);
    const yawTo = (a: THREE.Vector3, b: THREE.Vector3) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
    let best: { label: string; to: THREE.Vector3; yaw: number } | null = null, bd = Infinity;
    for (const d of this.doorways()) {
      const dIn = flat(d.inside), dOut = flat(d.outside);
      if (dOut < 1.4 && f.y < d.inside.y - 0.4 && dOut < bd) { bd = dOut; best = { label: `Climb into ${d.what}`, to: d.inside, yaw: yawTo(d.outside, d.inside) }; }
      if (dIn < 0.9 && Math.abs(f.y - d.inside.y) < 0.45 && dIn < bd) { bd = dIn; best = { label: 'Step down', to: d.outside, yaw: yawTo(d.inside, d.outside) }; }
    }
    return best;
  }
  /** Climb aboard or step down at the nearest doorway (falls to the ground below when stepping down). */
  board() {
    const o = this.boardingOffer(); if (!o) return false;
    this.walker.teleport(o.to.x, o.to.y, o.to.z, o.yaw); this.walker.pitch = 0;
    if (this.audio.running) this.sounds.footstep(this.surface(), this.walker.feet.clone());
    return true;
  }

  rebuildColliders() {
    this.walker.setColliders([...(this.site?.colliders ?? []), ...(this.world?.colliders ?? []), this.engine.levels[0].object, this.tender.levels[0].object, ...this.train.closeLevels, ...(this.dieselOn ? [this.diesel.levels[0].object] : [])]);
  }
  weather: WeatherName = 'fair';
  setWeather(w: WeatherName) {
    const p = WEATHER[w] ?? WEATHER.fair; this.weather = w;
    Object.assign(this.atmosphere.params, p);
    this.atmosphere.invalidate();
  }

  setMotion(on: boolean) { this.motionOn = on; }

  setWheelAngle(theta: number) { this.theta = theta; for (const r of this.rigs) r.setWheelAngle(theta); }

  private gateOpen = 0;
  /** Cab gates swing open when you walk up to the cab, and close again when you leave. */
  private updateGates(dt: number) {
    const lvl = this.engine.levels[0]?.object; if (!lvl) return;
    const near = this.mode === 'walk' && this.walker.feet.distanceTo(this.engine.localToWorld(new THREE.Vector3(0, B5.footplateH.v, zEngine(12.1)))) < 2.6;
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
      if (this.mode === 'walk') {
        const before = this.walker.feet.clone();
        this.inputs.update(); this.walker.step(h);
        this.stepDist += Math.hypot(this.walker.feet.x - before.x, this.walker.feet.z - before.z);
        if (this.stepDist > 0.72 && this.walker.onGround && this.audio.running) { this.stepDist = 0; this.sounds.footstep(this.surface(), this.walker.feet.clone()); }
      }
      this.footplate.step(h);
      const fpOmega = this.footplate.wheelOmega;
      const omega = this.motionOn ? this.motionSpeed / (B5.driverDia.v / 2) : fpOmega;
      if (omega !== 0) this.setWheelAngle(this.theta + omega * h);
      if (this.audio.running) this.sounds.motion(this.theta, omega, this.soundPointsCache ??= this.soundPoints(), this.motionOn ? undefined : { steam: this.footplate.steamUse, cocks: this.footplate.c.drainCocks });
    }
  }

  setSilhouette(on: boolean) {
    this.silhouette = on;
    if (this.site) this.site.group.visible = !on;
    if (this.world) this.world.group.visible = !on;
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
    else if (this.orbit.enabled) { this.stepFocus(dt); this.orbit.update(); }
    this.updateGates(params.fixed ? 1 : dt);
    this.train?.update(this.camera, this.mode === 'walk' ? this.walker.feet : null, params.fixed ? 1 : dt);
    // the cab interior is only drawn when the camera is within 9 m of the cab
    if (this.cabGroups.length) {
      const near = this.camera.getWorldPosition(new THREE.Vector3()).distanceTo(this.engine.localToWorld(new THREE.Vector3(0, 2.6, zEngine(11.3)))) < 9;
      for (const g of this.cabGroups) g.visible = near;
    }
    this.cabRig?.apply(this.footplate, this.simTime);
    // aim with the crosshair when the mouse is captured; otherwise point with the cursor or finger
    if (this.cabUI) this.cabUI.update(this.camera, this.mode === 'walk' && document.pointerLockElement === this.canvas);
    if (this.audio.running) {
      const c = this.footplate.c, inj = (c.injL > 0.3 && c.waterL > 0.5 ? 1 : 0) + (c.injR > 0.3 && c.waterR > 0.5 ? 1 : 0);
      this.sounds.footplate({ blower: c.blower, safety: this.footplate.safetyLift, ejector: Math.min(1, c.ejectorLarge + 0.3 * c.ejectorSmall), whistle: c.whistle, injectors: inj }, this.soundPointsCache ??= this.soundPoints());
    }
    // near plane: close for walking (cab, coaches), pushed out for orbit views over the landscape
    const near = this.mode === 'walk' ? 0.06 : THREE.MathUtils.clamp(this.persp.position.distanceTo(this.orbit.target) * 0.004, 0.05, 2);
    if (Math.abs(near - this.persp.near) > 1e-3) { this.persp.near = near; this.persp.updateProjectionMatrix(); }
    this.world?.update(this.camera.getWorldPosition(new THREE.Vector3()), this.simTime);
    if (this.world && this.audio.running) this.sounds.landscapeUpdate(this.camera.getWorldPosition(new THREE.Vector3()), this.world);
    this.atmosphere.setFocus(this.mode === 'walk' ? this.walker.feet : this.camera === this.ortho && this.orthoView ? new THREE.Vector3(...this.orthoView.centre) : this.orbit.target);
    // moving rods cast shadows on High/Medium (not on Low): keep shadows live while the wheels turn
    this.atmosphere.dynamicShadows = this.tierName !== 'low' && (this.motionOn || this.footplate.wheelOmega !== 0);
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
