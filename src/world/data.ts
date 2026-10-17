// Landscape data built by tools/terrain/build.py from OS OpenData (OGL v3.0): two height grids
// (12.8 km at 25 m, a 2.56 km core at 5 m with the hand-shaped railway, river, loch bed, roads and
// plots), land cover, tree instances and vectors (track, water, roads, buildings, landmarks).
// Scene frame: x = E - E0 (east), z = N0 - N (south), y = metres above OS datum.
import * as THREE from 'three';

export interface Grid { n: number; step: number; x0: number; z0: number; h: Float32Array }
export interface WaterPoly { kind: 'loch' | 'river'; hole: boolean; ring: [number, number][]; y: number[] }
export interface WorldJSON {
  source: string;
  frame: { E0: number; N0: number };
  far: Omit<Grid, 'h'>; near: Omit<Grid, 'h'>;
  lochLevel: number;
  track: { step: number; x: number[]; z: number[]; rail: number[]; viaduct: [number, number]; station: number };
  water: WaterPoly[];
  roads: { w: number; pts: [number, number, number][] }[];
  buildings: { ring: [number, number][]; base: number; eaves: number; ridge: number }[];
  landmarks: { monument: [number, number, number]; named: Record<string, [number, number]> };
  estimates: string[];
}
export interface TreeSet { count: number; data: Float32Array }  // x, y, z, scale, kind (0 broadleaf, 1 conifer), near (0/1), rot

export class WorldData {
  far!: Grid; near!: Grid; json!: WorldJSON; trees!: TreeSet;
  coverNear!: THREE.Texture; coverFar!: THREE.Texture;
  track!: TrackPath;

  async load(base: string, ver: (k: string) => string, tick: (name: string, bytes: number) => void) {
    const get = async (f: string) => { const r = await fetch(`${base}terrain/${f}${ver(`../terrain/${f}`)}`); if (!r.ok) throw new Error(`${f}: ${r.status}`); const b = await r.arrayBuffer(); tick(f, b.byteLength); return b; };
    const [json, far, near, trees] = await Promise.all([get('world.json'), get('far.bin'), get('near.bin'), get('trees.bin')]);
    this.json = JSON.parse(new TextDecoder().decode(json));
    const dec = (b: ArrayBuffer) => { const u = new Uint16Array(b), h = new Float32Array(u.length); for (let i = 0; i < u.length; i++) h[i] = u[i] / 50 - 20; return h; };
    this.far = { ...this.json.far, h: dec(far) }; this.near = { ...this.json.near, h: dec(near) };
    this.trees = decodeTrees(trees);
    const tl = new THREE.TextureLoader();
    const tex = async (f: string) => { const t = await tl.loadAsync(`${base}terrain/${f}${ver(`../terrain/${f}`)}`); tick(f, 1); t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
    [this.coverNear, this.coverFar] = await Promise.all([tex('cover_near.png'), tex('cover_far.png')]);
    this.track = new TrackPath(this.json.track);
    this.carveFormation();
  }

  /** Keep the railway clear of the ground. build.py cuts the formation into the 5 m grid, but the steps
   *  after it (the knoll at the viewpoint, road benches, the blend into the 25 m grid at the edge) raise
   *  the ground over the line again in places, up to 4 m. Lower the near grid to the formation (0.75 m
   *  below rail top, 3.4 m either side, then 1:1.5 slopes, as in build.py); only ever cut, never fill.
   *  Trees then sit on the lowered ground. */
  private carveFormation() {
    const g = this.near, p = this.track, R = 45, step = 2, size = (g.n - 1) * g.step, pt = new THREE.Vector3();
    for (let s = 0; s <= p.length; s += step) {
      p.at(s, pt);
      if (pt.x < g.x0 - R || pt.z < g.z0 - R || pt.x > g.x0 + size + R || pt.z > g.z0 + size + R) continue;
      const form = pt.y - 0.75;
      const j0 = Math.max(0, Math.floor((pt.x - R - g.x0) / g.step)), j1 = Math.min(g.n - 1, Math.ceil((pt.x + R - g.x0) / g.step));
      const i0 = Math.max(0, Math.floor((pt.z - R - g.z0) / g.step)), i1 = Math.min(g.n - 1, Math.ceil((pt.z + R - g.z0) / g.step));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const d = Math.hypot(g.x0 + j * g.step - pt.x, g.z0 + i * g.step - pt.z);
        if (d > R) continue;
        const k = i * g.n + j, lim = form + Math.max(0, (d - 3.4) / 1.5);
        if (g.h[k] > lim) g.h[k] = lim;
      }
    }
    const t = this.trees.data;
    for (let i = 0; i < this.trees.count; i++) {
      const x = t[i * 7], z = t[i * 7 + 2], h = sampleGrid(g, x, z, 1);
      if (h !== null && t[i * 7 + 1] > h) t[i * 7 + 1] = h;
    }
  }

  /** Ground height at (x, z): the shaped 5 m grid inside the core, the 25 m grid elsewhere. */
  height(x: number, z: number) {
    return sampleGrid(this.near, x, z, 1) ?? sampleGrid(this.far, x, z, 0) ?? 0;
  }
  inNear(x: number, z: number, margin = 0) {
    const g = this.near, size = (g.n - 1) * g.step;
    return x >= g.x0 + margin && z >= g.z0 + margin && x <= g.x0 + size - margin && z <= g.z0 + size - margin;
  }
}

function decodeTrees(b: ArrayBuffer): TreeSet {
  const v = new DataView(b), n = b.byteLength / 10, out = new Float32Array(n * 7);
  for (let i = 0; i < n; i++) {
    const o = i * 10, k = v.getUint8(o + 7);
    out.set([v.getUint16(o, true) / 5 - 6400, v.getUint16(o + 4, true) / 50 - 20, v.getUint16(o + 2, true) / 5 - 6400, v.getUint8(o + 6) / 10, k & 1, k >> 1, v.getUint8(o + 8) / 40], i * 7);
  }
  return { count: n, data: out };
}

/** Bilinear sample; null outside the grid (beyond `margin` cells from the edge). */
export function sampleGrid(g: Grid, x: number, z: number, margin = 0): number | null {
  const fx = (x - g.x0) / g.step, fz = (z - g.z0) / g.step;
  if (fx < margin || fz < margin || fx > g.n - 1 - margin || fz > g.n - 1 - margin) return null;
  const i = Math.min(g.n - 2, Math.floor(fz)), j = Math.min(g.n - 2, Math.floor(fx)), u = fx - j, w = fz - i, n = g.n, h = g.h;
  return (h[i * n + j] * (1 - u) + h[i * n + j + 1] * u) * (1 - w) + (h[(i + 1) * n + j] * (1 - u) + h[(i + 1) * n + j + 1] * u) * w;
}

/** The railway centreline (rail-top level), arc-length parametrised; s runs west to east. */
export class TrackPath {
  readonly length: number; readonly viaduct: [number, number]; readonly station: number;
  private x: number[]; private z: number[]; private y: number[]; private step: number;
  constructor(t: WorldJSON['track']) {
    this.x = t.x; this.z = t.z; this.y = t.rail; this.step = t.step;
    this.length = (t.x.length - 1) * t.step; this.viaduct = t.viaduct; this.station = t.station;
  }
  /** Point on the rail-top centreline at arc length s (clamped to the data). */
  at(s: number, out = new THREE.Vector3()) {
    const f = THREE.MathUtils.clamp(s / this.step, 0, this.x.length - 1.0001), i = Math.floor(f), u = f - i;
    return out.set(this.x[i] + (this.x[i + 1] - this.x[i]) * u, this.y[i] + (this.y[i + 1] - this.y[i]) * u, this.z[i] + (this.z[i + 1] - this.z[i]) * u);
  }
  /** Unit tangent towards increasing s (eastward). */
  tangent(s: number, out = new THREE.Vector3()) {
    const a = this.at(s - 1), b = this.at(s + 1);
    return out.subVectors(b, a).normalize();
  }
  /** Horizontal left normal for travel towards increasing s. */
  side(s: number, out = new THREE.Vector3()) {
    const t = this.tangent(s); return out.set(t.z, 0, -t.x).normalize();
  }
  /** Nearest arc length to (x, z), searching every sample (coarse) then refining. */
  nearest(x: number, z: number) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.x.length; i += 4) { const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    for (let i = Math.max(0, best - 4); i < Math.min(this.x.length, best + 5); i++) { const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best * this.step;
  }
}
