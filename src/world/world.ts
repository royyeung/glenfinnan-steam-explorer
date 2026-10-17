// Phase 5 world: OS-derived terrain, Loch Shiel and the River Finnan, trees, the line with its
// track, the viaduct, Glenfinnan's buildings, roads, monument and station platform. Also places
// the train on the track (every vehicle on its own supports, following the curve and the grade).
import * as THREE from 'three';
import { WorldData } from './data.ts';
import { buildTerrain, type TerrainTextures } from './terrain.ts';
import { buildWater } from './water.ts';
import { Trees, type TreeTier } from './trees.ts';
import { buildTrack } from './track.ts';
import { buildViaduct } from './viaduct.ts';
import { buildSettlement } from './settlement.ts';
import { GroundCover } from './groundcover.ts';
import type { PbrSet } from './site.ts';
import { ENGINE_ORIGIN_D } from '../specs/black5.ts';

export interface WorldTextures extends TerrainTextures { ballast: PbrSet; concrete: PbrSet; asphaltSet: PbrSet }
export interface WorldTier { nearError: number; farError: number; trees: TreeTier; groundR: number }

export const WORLD_TIERS: Record<'high' | 'medium' | 'low', WorldTier> = {
  high: { nearError: 0.25, farError: 1.5, trees: { nearR: 750, farR: 5200, nearMax: 18000, farMax: 60000, shadows: true }, groundR: 110 },
  medium: { nearError: 0.45, farError: 2.5, trees: { nearR: 450, farR: 3600, nearMax: 8000, farMax: 36000, shadows: true }, groundR: 70 },
  low: { nearError: 1.0, farError: 6.0, trees: { nearR: 220, farR: 1800, nearMax: 3000, farMax: 6000, shadows: false }, groundR: 0 },
};

/** A vehicle placed on the track: its object, its position in the straight train frame and its supports. */
export interface Placeable { obj: THREE.Object3D; z0: number; supports: [number, number] }

export class World {
  readonly group = new THREE.Group();
  data = new WorldData();
  trees!: Trees;
  ground!: GroundCover;
  colliders: THREE.Object3D[] = [];
  /** arc lengths of the two ends of the modelled track */
  trackEnds: [number, number] = [0, 0];
  private waterUpd: (t: number) => void = () => {};
  viaduct!: ReturnType<typeof buildViaduct>;
  settlement!: ReturnType<typeof buildSettlement>;
  terrain!: ReturnType<typeof buildTerrain>;

  async load(base: string, ver: (k: string) => string, tick: (name: string, bytes: number) => void) {
    await this.data.load(base, ver, tick);
  }

  build(tex: WorldTextures, tier: WorldTier) {
    this.group.name = 'world';
    const d = this.data, path = d.track;
    this.terrain = buildTerrain(d, tex, tier);
    const water = buildWater(d, tier.groundR > 0);   // boulders: Medium and High only this.waterUpd = water.update;
    this.trees = new Trees(d.trees, tier.trees);
    // track from west of the station to well east of the viaduct (the core of the map)
    const s0 = Math.max(0, path.station - 900), s1 = Math.min(path.length - 2, path.viaduct[1] + 1200);
    this.trackEnds = [s0, s1];
    const track = buildTrack(path, s0, s1, tex.ballast);
    this.viaduct = buildViaduct(d, tex.concrete);
    this.settlement = buildSettlement(d, tex.asphaltSet);
    this.ground = new GroundCover(d, tier.groundR, this.settlement.platform);
    this.group.add(this.terrain.group, water.group, this.trees.group, this.ground.group, track, this.viaduct.group, this.settlement.group);
    this.colliders = [this.terrain.near, this.viaduct.mesh, ...track.children.filter((c) => c.name === 'ballast_line'), ...this.settlement.colliders];
  }

  update(camPos: THREE.Vector3, time: number) {
    this.trees?.update(camPos);
    this.ground?.update(camPos);
    this.waterUpd(time);
  }

  /** Put every vehicle on the track with the engine's front buffer at arc length sFront, running
   *  towards decreasing s (westbound, to Mallaig, chimney first: REFERENCE §9). light: update only
   *  each vehicle's own matrix (every simulation step while running; children update at render). */
  placeTrain(sFront: number, vehicles: Placeable[], light = false) {
    const path = this.data.track, pf = new THREE.Vector3(), pr = new THREE.Vector3(), u = new THREE.Vector3(), up = new THREE.Vector3(), x = new THREE.Vector3(), m = new THREE.Matrix4();
    for (const v of vehicles) {
      const [zf, zr] = v.supports;
      path.at(sFront + ENGINE_ORIGIN_D - (v.z0 + zf), pf); path.at(sFront + ENGINE_ORIGIN_D - (v.z0 + zr), pr);
      u.subVectors(pf, pr).normalize();
      up.set(0, 1, 0).addScaledVector(u, -u.y).normalize();
      x.crossVectors(up, u).normalize();
      m.makeBasis(x, up, u);
      v.obj.quaternion.setFromRotationMatrix(m);
      v.obj.position.copy(pf).add(pr).multiplyScalar(0.5).addScaledVector(u, -(zf + zr) / 2);
      if (light) v.obj.updateWorldMatrix(false, false); else v.obj.updateMatrixWorld(true);
    }
  }

  /** Curvature (1/m) of the line at arc length s (from the tangent turning over 10 m). */
  curvature(s: number) {
    const p = this.data.track, a = p.tangent(s - 5), b = p.tangent(s + 5);
    return Math.acos(Math.min(1, a.x * b.x + a.z * b.z)) / 10;
  }

  /** Arc lengths for the two standard places. */
  get places() {
    const p = this.data.track;
    return { viaduct: p.viaduct[0] + 115, station: this.settlement.platform.s0 + 6 };
  }
}
