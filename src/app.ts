// Application: renderer, scene, loading, modes (orbit / walk / free), fixed-step simulation,
// sound, quality tier and the hooks used by the verification harness.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
import { TrainRun, MASS, MPH } from './sim/run.ts';
import { BeatClock } from './sim/beats.ts';
import { Exhaust } from './render/exhaust.ts';
import { RunningSounds, RAIL_LENGTH } from './audio/running.ts';
import type { Mover } from './controls/walk.ts';

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
  /** Phase 6: the train running on the line at Glenfinnan (null on the test site) */
  run: TrainRun | null = null;
  /** the run moves the train (world mode; off in the deterministic harness unless ?run=1) */
  runOn = false;
  /** the orbit camera travels with the train */
  followTrain = true;
  readonly beatClock = new BeatClock();
  exhaust!: Exhaust;
  runSounds = new RunningSounds(this.audio);
  /** every axle: distance behind the engine's front buffer, and its vehicle (sound voice) */
  private axles: { d: number; vi: number }[] = [];
  private appliedTheta = NaN;
  private lastFrameSim = 0;
  private wheelNodes: { coach: THREE.Object3D[]; diesel: THREE.Object3D[] } | null = null;
  private distance = 0;          // metres run (coach and diesel wheel rotation)
  private followPrev: THREE.Vector3 | null = null;
  private camPrev = new THREE.Vector3(); private camVel = new THREE.Vector3();
  /** exhaust beats of the last steps (verification harness): sim time, wheel angle, valve travel check */
  beatTrace: { simT: number; theta: number; side: 'L' | 'R'; speed: number }[] = [];
  private beatsPending: { simT: number; level: number }[] = [];
  private jointsPending: { simT: number; vi: number }[] = [];
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
    // steam and smoke (one draw call): fewer puffs on phones
    this.exhaust = new Exhaust(this.tierName === 'low' ? 220 : this.tierName === 'medium' ? 450 : 800);
    this.scene.add(this.exhaust.mesh);

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
    // axles (for the rail joints): distance behind the engine's front buffer, and which vehicle
    {
      const D = (z: number) => ENGINE_ORIGIN_D - z, cw = MK2.bogieWheelbase.v / 2, dc = c47BogieCentres() / 2, dw = C47.bogieWheelbase.v / 2;
      for (const d of Object.values(engineAxlesD())) this.axles.push({ d, vi: 0 });
      for (const d of tenderAxlesD()) this.axles.push({ d, vi: 1 });
      this.train.coaches.forEach((c, i) => { const z0 = this.vehicles[2 + i].z0; for (const b of [bcz, -bcz]) for (const w of [cw, -cw]) this.axles.push({ d: D(z0 + b + w), vi: 2 + i }); });
      const dz0 = this.vehicles[2 + this.train.coaches.length].z0;
      for (const b of [dc, -dc]) for (const w of [dw, 0, -dw]) this.axles.push({ d: D(dz0 + b + w), vi: 2 + this.train.coaches.length });
    }
    // the run (Glenfinnan): across the viaduct, to the station, away west, round again
    if (this.world) {
      const w = this.world, path = w.data.track, [t0, t1] = w.trackEnds, { length, mass } = this.trainSize();
      this.run = new TrainRun({ viaduct: path.viaduct, stop: w.places.station, west: t0 + 30, east: t1 - 10 - length, height: (s) => path.at(s).y }, w.places[this.placeName], mass, length);
      if (params.mph) this.run.viaductSpeed = params.mph * MPH;
      this.run.placeAt(w.places[this.placeName], this.placeName === 'station');
      this.runOn = params.run;
      this.footplate.onTrack = this.runOn;
      this.run.onRestart = () => { this.exhaust?.clear(); };
    }
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
      // working the driving controls yourself takes over from the automatic driver
      if (['regulator', 'reverser', 'brake', 'airBrake', 'ejectorLarge'].includes(id)) this.onManualControl();
      if (id === 'reverser') this.setCutoff(val, false);
      if (id === 'fireDoors' || id === 'coalDoors' || id === 'cabLight' || id === 'drainCocks') this.sounds.clank(this.engine.localToWorld(new THREE.Vector3(0, 2.2, zEngine(10.5))), id === 'fireDoors' ? 0.8 : 1.2);
    };
    // Low tier: small moving parts do not cast shadows (saves ~40 shadow-pass draw calls on phones)
    if (this.tierName === 'low') for (const lod of [this.engine, this.tender]) lod.traverse((o) => { if ((o as THREE.Mesh).isMesh && /^(rod_|vg_|xh_|pr_|cab_gate)/.test(o.name)) o.castShadow = false; });
    // Low on the line: the shadow map is redrawn every frame while the train runs, so the engine and
    // tender cast through simple stand-in shapes (one draw call each) instead of their ~125 parts.
    // The stand-ins draw nothing in the view (no colour, no depth): two near-empty draw calls.
    if (this.tierName === 'low' && this.world) {
      for (const lod of [this.engine, this.tender]) lod.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false; });
      const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.BoxGeometry(x1 - x0, y1 - y0, Math.abs(z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      const cyl = (r: number, y: number, za: number, zb: number) => new THREE.CylinderGeometry(r, r, Math.abs(zb - za), 10).rotateX(Math.PI / 2).translate(0, y, (za + zb) / 2);
      const b = (k: keyof typeof B5) => B5[k].v, zE = zEngine, hw = b('runningPlateWidth') / 2;
      const eng = mergeGeometries([
        box(-hw, 0.25, zE(0.3), hw, b('runningPlateH'), zE(b('engineRearD') - 0.2)),                         // frames, wheels, splashers
        cyl(b('smokeboxDia') / 2, b('smokeboxTopH') - b('smokeboxDia') / 2, zE(b('smokeboxFrontD')), zE(b('cabFrontD'))), // smokebox and boiler
        box(-0.3, b('smokeboxTopH') - 0.2, zE(b('chimneyD') - 0.3), 0.3, b('height'), zE(b('chimneyD') + 0.3)),   // chimney
        box(-b('cabWidth') / 2, b('runningPlateH'), zE(b('cabFrontD')), b('cabWidth') / 2, b('cabRoofH'), zE(b('cabRoofRearD'))), // cab
      ])!;
      // the tender's box joins the engine's stand-in (one draw call; on the 236 m curve the tender's
      // true position differs by a few centimetres, nothing a phone-sized shadow shows)
      const tz = (d: number) => zE(d);
      const one = mergeGeometries([eng, box(-b('tenderWidth') / 2, 0.3, tz(b('tenderFrontD') + 0.2), b('tenderWidth') / 2, b('tenderSideTopH'), tz(b('tenderBodyRearD')))])!;
      const m = new THREE.Mesh(one, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      m.name = 'shadow_proxy'; m.castShadow = true; m.receiveShadow = false;
      this.engine.add(m);
    }

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
    const s = this.world.places[name];
    // the run carries on from here: standing at the station, rolling across the viaduct
    this.run?.placeAt(s, name === 'station' || !this.runOn);
    this.world.placeTrain(s, this.vehicles);
    this.scene.updateMatrixWorld(true);
    this.soundPointsCache = null; this.followPrev = null; this.exhaust?.clear();
    if (this.audio.running) { this.sounds.moveLoco(this.soundPoints()); this.sounds.dieselIdle(this.dieselSoundAt(), this.dieselOn); }
  }
  /** Put the vehicles where the run says the train is (after moving it by hand). */
  placeTrain0() {
    if (!this.world || !this.run) return;
    this.world.placeTrain(this.run.s, this.vehicles);
    this.scene.updateMatrixWorld(true);
    this.soundPointsCache = null; this.followPrev = null; this.exhaust?.clear();
  }
  /** Show or hide the diesel at the rear (and its sound and collision). */
  setDiesel(on: boolean) {
    this.dieselOn = on; this.diesel.visible = on;
    if (this.audio.running) this.sounds.dieselIdle(this.dieselSoundAt(), on);
    if (this.run) { const { length, mass } = this.trainSize(), [, t1] = this.world!.trackEnds; this.run.length = length; this.run.massT = mass; this.run.route.east = t1 - 10 - length; }
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
  boardingOffer(): { label: string; to: THREE.Vector3; yaw: number; locked?: boolean } | null {
    if (this.mode !== 'walk') return null;
    const f = this.walker.feet, flat = (a: THREE.Vector3) => Math.hypot(a.x - f.x, a.z - f.z);
    const yawTo = (a: THREE.Vector3, b: THREE.Vector3) => Math.atan2(-(b.x - a.x), -(b.z - a.z));
    let best: { label: string; to: THREE.Vector3; yaw: number } | null = null, bd = Infinity;
    for (const d of this.doorways()) {
      const dIn = flat(d.inside), dOut = flat(d.outside);
      if (dOut < 1.4 && f.y < d.inside.y - 0.4 && dOut < bd) { bd = dOut; best = { label: `Climb into ${d.what}`, to: d.inside, yaw: yawTo(d.outside, d.inside) }; }
      if (dIn < 0.9 && Math.abs(f.y - d.inside.y) < 0.45 && dIn < bd) { bd = dIn; best = { label: 'Step down', to: d.outside, yaw: yawTo(d.inside, d.outside) }; }
    }
    // central door locking (and common sense on the footplate): no getting on or off while moving
    if (best && Math.abs(this.speed) > 0.2) return { ...best, label: 'Doors locked while moving', locked: true };
    return best;
  }
  /** Climb aboard or step down at the nearest doorway (falls to the ground below when stepping down). */
  board() {
    const o = this.boardingOffer(); if (!o || o.locked) return false;
    this.walker.teleport(o.to.x, o.to.y, o.to.z, o.yaw); this.walker.pitch = 0;
    if (this.audio.running) this.sounds.footstep(this.surface(), this.walker.feet.clone());
    return true;
  }

  /** Walking colliders: the fixed ground, platform and viaduct in one BVH; each vehicle in its own
   *  frame, so you can walk on and through the train while it runs. */
  rebuildColliders() {
    const movers: Mover[] = [
      { obj: this.engine, roots: [this.engine.levels[0].object] }, { obj: this.tender, roots: [this.tender.levels[0].object] },
      ...this.train.coaches.map((c) => ({ obj: c.lod as THREE.Object3D, roots: [c.lod.levels[0].object] })),
      { obj: this.diesel, roots: [this.diesel.levels[0].object], enabled: () => this.dieselOn },
    ];
    this.walker.setColliders([...(this.site?.colliders ?? []), ...(this.world?.colliders ?? [])], movers);
  }
  /** Train length (front buffer to rear buffer, m) and mass (t), with or without the diesel. */
  trainSize() {
    // straight-train-frame positions (z0): the objects themselves carry world positions once placed
    const n = this.train.coaches.length, last = this.dieselOn ? this.vehicles[2 + n].z0 - C47.lengthOverBuffers.v / 2 : this.vehicles[1 + n].z0 - MK2.lengthOverBuffers.v / 2;
    const mass = MASS.engine + MASS.tender + this.train.coaches.reduce((m, c) => m + (c.vehicle.type === 'buffet1' ? MASS.mk1buffet : MASS.mk2), 0) + (this.dieselOn ? MASS.class47 : 0);
    return { length: ENGINE_ORIGIN_D - last, mass };
  }
  /** Called when you work a driving control in the cab (the HUD switches to "You drive"). */
  onManualControl: () => void = () => {};
  /** Train speed (m/s, + forward) */
  get speed() { return this.runOn && this.run ? this.run.v : 0; }
  /** Start or stop the automatic run (world mode). */
  setRun(on: boolean) {
    if (!this.run) return;
    if (on && !this.runOn) { this.runOn = true; this.footplate.onTrack = true; this.run.running = true; if (this.run.state === 'running' && this.run.v === 0) { this.run.state = 'standing'; } }
    else if (!on) this.run.running = false;
    else this.run.running = true;
  }
  weather: WeatherName = 'fair';
  setWeather(w: WeatherName) {
    const p = WEATHER[w] ?? WEATHER.fair; this.weather = w;
    Object.assign(this.atmosphere.params, p);
    this.atmosphere.invalidate();
  }

  setMotion(on: boolean) { this.motionOn = on; }

  /** After the steps: turn every wheel and the valve gear, and keep the sounds on the moving engine. */
  private applyRun() {
    if (this.theta !== this.appliedTheta) {
      this.appliedTheta = this.theta;
      for (const r of this.rigs) { if (r.cutoff !== this.footplate.c.reverser) r.cutoff = this.footplate.c.reverser; r.setWheelAngle(this.theta); }
      this.cutoff = this.footplate.c.reverser;
      const rc = MK2.wheelDia.v / 2, rd = C47.wheelDia.v / 2;
      if (!this.wheelNodes) {
        this.wheelNodes = { coach: [], diesel: [] };
        for (const c of this.train.coaches) c.lod.levels[0].object.traverse((o) => { if (/^cws_\d$/.test(o.name)) this.wheelNodes!.coach.push(o); });
        this.diesel.levels[0].object.traverse((o) => { if (/^dws_\d$/.test(o.name)) this.wheelNodes!.diesel.push(o); });
      }
      for (const w of this.wheelNodes.coach) w.rotation.x = this.distance / rc;
      for (const w of this.wheelNodes.diesel) w.rotation.x = this.distance / rd;
    }
    if (Math.abs(this.speed) > 0.01 || this.soundPointsCache === null) {
      this.soundPointsCache = null;
      if (this.audio.running) { const p = this.soundPoints(); this.sounds.moveLoco(p, this.audio.doppler(p.chimney, this.trainVelocity())); this.sounds.dieselIdle(this.dieselSoundAt(), this.dieselOn); }
    }
  }

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
    const h = 1 / SIM_HZ, rD = B5.driverDia.v / 2, run = this.runOn ? this.run : null;
    for (let i = 0; i < n; i++) {
      this.simTime += h;
      // the train first (the automatic driver sets the footplate controls), then the footplate
      let ds = 0;
      if (run) {
        const s0 = run.s;
        run.step(h, this.footplate);
        ds = s0 - run.s;
        if (Math.abs(ds) > 50) ds = 0; // jumped back to the east end
        this.footplate.wheelOmega = run.v / rD;
        this.world!.placeTrain(run.s, this.vehicles, true);
      }
      this.footplate.step(h);
      if (this.mode === 'walk') {
        const before = this.walker.feet.clone(), ride = this.walker.ride ? this.walker.ride.local.clone() : null;
        this.inputs.update(); this.walker.step(h);
        // footsteps count your own steps, not the train carrying you
        const moved = ride && this.walker.ride ? this.walker.ride.local.distanceTo(ride) : Math.hypot(this.walker.feet.x - before.x, this.walker.feet.z - before.z);
        this.stepDist += moved;
        if (this.stepDist > 0.72 && this.walker.onGround && this.audio.running) { this.stepDist = 0; this.sounds.footstep(this.surface(), this.walker.feet.clone()); }
      }
      // wheels: from the distance run on the line; on the test site from the rolling road
      const dTheta = run ? ds / rD : (this.motionOn ? this.motionSpeed / rD : this.footplate.wheelOmega) * h;
      const omega = dTheta / h;
      if (dTheta !== 0) {
        this.beatClock.setCutoff(this.footplate.c.reverser);
        const working = this.footplate.steamUse > 0.02 || (this.motionOn && !run);
        for (const b of this.beatClock.crossed(this.theta, this.theta + dTheta)) {
          const t = this.simTime - h + b.frac * h;
          if (params.debug) { this.beatTrace.push({ simT: t, theta: b.theta, side: b.beat.side, speed: omega * rD }); if (this.beatTrace.length > 400) this.beatTrace.shift(); }
          if (working) this.beatsPending.push({ simT: t, level: Math.min(0.9, 0.25 + 1.2 * this.footplate.steamUse) });
        }
        // rail joints under every axle
        if (run && ds !== 0) for (const a of this.axles) {
          if (a.vi === 2 + this.train.coaches.length && !this.dieselOn) continue;
          const s1 = run.s + a.d, s0 = s1 + ds, j0 = Math.floor(s0 / RAIL_LENGTH), j1 = Math.floor(s1 / RAIL_LENGTH);
          if (j0 !== j1) this.jointsPending.push({ simT: this.simTime - h + h * Math.abs((s0 - Math.max(j0, j1) * RAIL_LENGTH) / ds), vi: a.vi });
        }
        this.theta += dTheta; this.distance += ds;
        if (!run) this.setWheelAngle(this.theta);
      }
      if (this.audio.running) this.sounds.motion(this.theta, omega, this.soundPointsCache ??= this.soundPoints(), this.motionOn && !run ? undefined : { steam: this.footplate.steamUse, cocks: this.footplate.c.drainCocks });
    }
    this.flushEvents();
  }

  /** Schedule the beats and joints of the steps just run, at their exact times relative to now. */
  private flushEvents() {
    const ctx = this.audio.ctx, now = this.simTime;
    if (ctx && this.audio.running) {
      const at = (t: number) => ctx.currentTime + 0.06 + (t - now);
      const pts = this.soundPointsCache ??= this.soundPoints(), dop = this.audio.doppler(pts.chimney, this.trainVelocity());
      for (const b of this.beatsPending) this.sounds.beat(at(b.simT), b.level, this.footplate.wheelOmega || this.motionSpeed / (B5.driverDia.v / 2), dop);
      for (const j of this.jointsPending) this.runSounds.joint(j.vi, at(j.simT), this.speed);
    }
    // a puff from the chimney for every beat (the last few if many steps ran at once)
    for (const b of this.beatsPending.slice(-6)) this.puff(b.level);
    this.beatsPending.length = 0; this.jointsPending.length = 0;
  }

  /** World velocity of the train (m/s). */
  trainVelocity(out = new THREE.Vector3()) {
    if (!this.runOn || !this.run) return out.set(0, 0, 0);
    const e = this.engine.matrixWorld.elements;
    return out.set(e[8], e[9], e[10]).normalize().multiplyScalar(this.run.v);
  }

  /** One exhaust beat seen at the chimney top: a dense white-grey puff thrown up a few metres, then
   *  left behind by the train (it keeps the train's speed only briefly) and carried off by the wind. */
  private puff(level: number) {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.engine.quaternion), tv = this.trainVelocity();
    const smoke = 0.12 + 0.3 * Math.max(0, this.footplate.fire - 0.6);
    for (let k = 0; k < 2; k++) {
      const top = this.engine.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.3, B5.height.v + 0.1 + 0.3 * k, zEngine(B5.chimneyD.v) + (Math.random() - 0.5) * 0.3));
      const vel = tv.clone().addScaledVector(up, 1.4 + 2.8 * level + 0.8 * k).add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9));
      this.exhaust.emit({ pos: top, vel, size: 0.6 + 0.2 * k, grow: 1.7, life: 6 + 3 * level, smoke, alpha: 0.6 + 0.35 * level, rise: 0.5 });
    }
  }

  /** Steam that is not beats: the blower's haze at the chimney, the safety valves, the drain cocks and
   *  the whistle. Emitted per frame (rates per second). */
  private steamEffects(dt: number) {
    if (dt <= 0) return;
    const fp = this.footplate, c = fp.c, tv = this.trainVelocity(), q = this.engine.quaternion, rnd = () => Math.random() - 0.5;
    const W = (x: number, y: number, d: number) => this.engine.localToWorld(new THREE.Vector3(x, y, zEngine(d)));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const chance = (rate: number) => Math.random() < rate * dt;
    // working: between the beats the exhaust merges into a steady plume (more so the faster it runs)
    if (fp.steamUse >= 0.02 && chance(3 + 0.8 * Math.abs(this.speed))) this.exhaust.emit({ pos: W(rnd() * 0.3, B5.height.v + 0.15, B5.chimneyD.v), vel: tv.clone().addScaledVector(up, 2 + 3 * fp.steamUse), size: 0.7, grow: 1.5, life: 5, smoke: 0.15, alpha: 0.35, rise: 0.5 });
    // blower haze when standing or drifting (no beats)
    if (fp.steamUse < 0.02 && chance(1.5 + 4 * c.blower)) this.exhaust.emit({ pos: W(rnd() * 0.2, B5.height.v + 0.05, B5.chimneyD.v), vel: tv.clone().addScaledVector(up, 1.5 + 2.5 * c.blower), size: 0.4, grow: 0.9, life: 4, smoke: 0.4, alpha: 0.12 + 0.15 * c.blower, rise: 0.6 });
    // safety valves: a roaring white plume
    if (fp.safetyLift > 0.05 && chance(25 * fp.safetyLift)) this.exhaust.emit({ pos: W(rnd() * 0.3, B5.fireboxTopH.v + 0.15, B5.safetyValveD.v), vel: tv.clone().addScaledVector(up, 9 + 4 * Math.random()), size: 0.3, grow: 1.2, life: 2.6, smoke: 0, alpha: 0.5 * fp.safetyLift, rise: 1.2 });
    // whistle: a short jet just behind the chimney
    if (c.whistle > 0.3 && chance(18)) this.exhaust.emit({ pos: W(0, B5.fireboxTopH.v + 0.45, B5.safetyValveD.v - 0.75), vel: tv.clone().addScaledVector(up, 5), size: 0.2, grow: 0.8, life: 1.4, smoke: 0, alpha: 0.4, rise: 1 });
    // drain cocks: sideways bursts low at the cylinders, both sides
    if (c.drainCocks > 0.5 && (fp.steamUse > 0.02 || this.motionOn) && chance(16)) for (const sd of [1, -1]) {
      const side = new THREE.Vector3(sd, 0, 0).applyQuaternion(q);
      this.exhaust.emit({ pos: W(sd * 1.05, 0.55, 2.2 + rnd() * 0.6), vel: tv.clone().addScaledVector(side, 5 + 3 * Math.random()).addScaledVector(up, 0.5), size: 0.25, grow: 1.1, life: 1.8, smoke: 0, alpha: 0.45, rise: 0.5 });
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

  /** One frame: simulation (unless deterministic), cameras, effects, sound, then the render
   *  (render=false: everything but the render, for the harness's real-time sound checks). */
  frame(render = true) {
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!params.fixed) {
      this.acc += dt;
      const n = Math.min(24, Math.floor(this.acc * SIM_HZ));
      this.acc -= n / SIM_HZ;
      this.step(n);
    }
    // effects advance by the simulated time since the last frame (deterministic mode: whatever GX ran)
    const fdt = params.fixed ? this.simTime - this.lastFrameSim : dt, moving = Math.abs(this.speed) > 0.05;
    this.lastFrameSim = this.simTime;
    if (this.runOn) this.applyRun();
    // the orbit camera travels with the train (the engine's movement since the last frame)
    const eng = this.engine.getWorldPosition(new THREE.Vector3());
    if (this.followPrev && this.followTrain && this.mode !== 'walk' && this.camera === this.persp) {
      const d = eng.clone().sub(this.followPrev);
      if (d.lengthSq() > 0) { this.persp.position.add(d); this.orbit.target.add(d); if (this.focus) { for (const v of [this.focus.p0, this.focus.p1, this.focus.t0, this.focus.t1]) v.add(d); } }
    }
    this.followPrev = eng;
    if (this.mode === 'walk') this.walker.applyTo(this.persp);
    else if (this.orbit.enabled) { this.stepFocus(dt); this.orbit.update(); }
    this.updateGates(params.fixed ? 1 : dt);
    this.train?.update(this.camera, this.mode === 'walk' ? this.walker.feet : null, params.fixed ? 1 : dt, moving);
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
    const shadowFocus = this.mode === 'walk' ? this.walker.feet : this.camera === this.ortho && this.orthoView ? new THREE.Vector3(...this.orthoView.centre) : this.orbit.target;
    this.world?.update(this.camera.getWorldPosition(new THREE.Vector3()), this.simTime, shadowFocus);
    if (this.world && this.audio.running) this.sounds.landscapeUpdate(this.camera.getWorldPosition(new THREE.Vector3()), this.world);
    // steam and smoke: wind by weather, light from the sun and sky
    if (this.exhaust) {
      this.steamEffects(fdt);
      const wind = { sunny: 2, fair: 3, overcast: 4, mist: 1 }[this.weather] ?? 3;
      this.exhaust.wind.set(0.85, 0, -0.5).multiplyScalar(wind); // from the south-west (prevailing; estimate)
      const L = this.atmosphere.light, sunC = L.color.clone().multiplyScalar(L.intensity);
      const sky = (this.scene.fog as THREE.FogExp2).color.clone().multiplyScalar(1.5 * Math.PI * this.atmosphere.params.envIntensity * 0.5);
      this.exhaust.setLight(this.atmosphere.sunDir, sunC, sky);
      this.exhaust.update(fdt);
    }
    // listener speed (Doppler) and where you are (outside, in a coach, on the footplate)
    const camNow = this.camera.getWorldPosition(new THREE.Vector3());
    if (fdt > 0) { const v = camNow.clone().sub(this.camPrev).divideScalar(fdt); this.camVel.lerp(v.lengthSq() > 2500 ? this.camVel : v, 0.3); }
    this.camPrev.copy(camNow);
    if (this.audio.running) {
      const cabC = this.engine.worldToLocal(camNow.clone()), inCab = Math.abs(cabC.x) < 1.4 && cabC.z < zEngine(B5.cabFrontD.v) && cabC.z > zEngine(B5.cabFrontD.v + 3.2) && cabC.y > 1.4 && cabC.y < 4;
      const where = this.train.insideIndex >= 0 ? 'coach' : inCab ? 'cab' : 'out';
      this.audio.setEnclosure(where);
      if (this.run) {
        const tv = this.trainVelocity(), n = this.train.coaches.length;
        const veh = this.vehicles.map((v, i) => {
          const p = v.obj.getWorldPosition(new THREE.Vector3()); p.y += 0.6;
          const sAt = this.run!.s + ENGINE_ORIGIN_D - v.z0;
          return { pos: i === n + 2 && !this.dieselOn ? p.setY(p.y - 1e4) : p, curvature: this.world!.curvature(sAt) };
        });
        this.runSounds.update(veh, tv, this.speed, where);
      }
    }
    this.atmosphere.setFocus(shadowFocus);
    // moving rods cast shadows on High/Medium (not on Low): keep shadows live while the wheels turn
    this.atmosphere.dynamicShadows = moving || (this.tierName !== 'low' && (this.motionOn || this.footplate.wheelOmega !== 0));
    this.atmosphere.update(this.simTime);
    this.weathering.update();
    this.audio.updateListener(this.camera === this.ortho ? this.persp : this.camera, this.camVel);
    if (!render) return;
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
