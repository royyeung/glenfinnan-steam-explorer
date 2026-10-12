// The running line along the OS centreline: ballast bed (shoulders on the formation, boxed in
// between the parapets on the viaduct), concrete sleepers (instanced) and flat-bottom rails
// swept along the curve. Rail top = the path's rail level; gauge from the engine spec.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { B5 } from '../specs/black5.ts';
import { SITE } from './site.ts';
import type { TrackPath } from './data.ts';
import { antiTile } from '../render/antiTile.ts';
import type { PbrSet } from './site.ts';

/** Sweep a 2D section (u lateral, v up; relative to rail-top centre) along the path from s0 to s1. */
export function sweep(path: TrackPath, s0: number, s1: number, step: number, section: [number, number][], uvScale = 1.2, closed = false) {
  const n = Math.max(1, Math.ceil((s1 - s0) / step)), m = section.length;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const P = new THREE.Vector3(), S = new THREE.Vector3();
  // lateral length along the section for the v texture coordinate
  const acc = [0]; for (let k = 1; k < m; k++) acc.push(acc[k - 1] + Math.hypot(section[k][0] - section[k - 1][0], section[k][1] - section[k - 1][1]));
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n; path.at(s, P); path.side(s, S);
    for (let k = 0; k < m; k++) { const [u, v] = section[k]; pos.push(P.x + S.x * u, P.y + v, P.z + S.z * u); uv.push(s / uvScale, acc[k] / uvScale); }
  }
  const segs = closed ? m : m - 1;
  for (let i = 0; i < n; i++) for (let k = 0; k < segs; k++) {
    const k1 = (k + 1) % m, a = i * m + k, b = a + m, c = i * m + k1, d = c + m;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildTrack(path: TrackPath, s0: number, s1: number, ballastTex: PbrSet) {
  const g = new THREE.Group(); g.name = 'track';
  const half = B5.gauge.v / 2, rh = SITE.railHeight.v;
  const [vW, vE] = path.viaduct;
  // ballast: shoulders on the formation; boxed between the parapets on the viaduct (edges hidden by them)
  const top = -rh - 0.2;
  const open: [number, number][] = [[3.4, -0.8], [1.95, top], [-1.95, top], [-3.4, -0.8]];
  const boxed: [number, number][] = [[2.74, -0.4], [2.6, top], [-2.6, top], [-2.74, -0.4]];
  for (const t of [ballastTex.color, ballastTex.normal, ballastTex.rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  const bm = new THREE.MeshStandardMaterial({ name: 'ballast_line', map: ballastTex.color, normalMap: ballastTex.normal, roughnessMap: ballastTex.rough, color: 0xb5aea4, roughness: 1, side: THREE.DoubleSide });
  antiTile(bm, 0.12);
  const geos = [sweep(path, s0, vW, 2, open), sweep(path, vW, vE, 2, boxed), sweep(path, vE, s1, 2, open)];
  for (const geo of geos) { const m = new THREE.Mesh(geo, bm); m.name = 'ballast_line'; m.receiveShadow = true; g.add(m); }

  // rails and sleepers in 150 m pieces, each a level-of-detail set (so pieces out of view are culled
  // and distant ones are cheap): close, the rail profile with its running band and the sleepers;
  // beyond 175 m a plain three-sided rail; beyond 1.2 km nothing (under a pixel wide)
  const prof: [number, number][] = [[-0.07, -rh], [0.07, -rh], [0.07, -rh + 0.012], [0.009, -rh + 0.03], [0.009, -0.045], [0.035, -0.035], [0.035, -0.004], [0.03, 0], [-0.03, 0], [-0.035, -0.004], [-0.035, -0.035], [-0.009, -0.045], [-0.009, -rh + 0.03], [-0.07, -rh + 0.012]];
  const plain: [number, number][] = [[0.07, -rh], [0.035, 0], [-0.035, 0], [-0.07, -rh]];
  const railMat = new THREE.MeshStandardMaterial({ name: 'rail', color: 0x6f5a4c, roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide });
  const bandMat = new THREE.MeshStandardMaterial({ name: 'rail_band', color: 0xc9c7c2, roughness: 0.22, metalness: 1, side: THREE.DoubleSide });
  const sleeperGeo = new THREE.BoxGeometry(2.5, 0.2, 0.26), sleeperMat = new THREE.MeshStandardMaterial({ name: 'sleeper', color: 0x5f5c57, roughness: 0.92 });
  const both = (a: number, b: number, step: number, sect: [number, number][], closed: boolean) =>
    mergeGeometries([1, -1].map((sgn) => sweep(path, a, b, step, sect.map(([u, v]) => [u + sgn * (half + 0.035), v] as [number, number]), 1, closed)))!;
  const P = new THREE.Vector3(), T = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
  const L = 150, pieces = Math.ceil((s1 - s0) / L);
  for (let c = 0; c < pieces; c++) {
    const a = s0 + c * L, b = Math.min(s1, a + L), mid = path.at((a + b) / 2);
    const close = new THREE.Group(), far = new THREE.Group();
    const rail = new THREE.Mesh(both(a, b, 1.5, prof, true), railMat); rail.name = 'rail'; rail.castShadow = rail.receiveShadow = true;
    const band = new THREE.Mesh(both(a, b, 1.5, [[0.0225, 0.0015], [-0.0225, 0.0015]], false), bandMat); band.name = 'rail_band';
    // sleepers every 0.65 m along the whole line, square to the track
    const i0 = Math.ceil((a - s0 - 0.3) / SITE.sleeperSpacing.v), i1 = Math.ceil((b - s0 - 0.3) / SITE.sleeperSpacing.v);
    const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, Math.max(1, i1 - i0)); sleepers.count = i1 - i0;
    for (let i = i0; i < i1; i++) {
      const s = s0 + 0.3 + i * SITE.sleeperSpacing.v; path.at(s, P); path.tangent(s, T);
      q.setFromUnitVectors(Z, T);
      m4.compose(new THREE.Vector3(P.x - mid.x, P.y - rh - 0.1 - 0.012 - mid.y, P.z - mid.z), q, new THREE.Vector3(1, 1, 1));
      sleepers.setMatrixAt(i - i0, m4);
    }
    sleepers.computeBoundingSphere(); sleepers.name = 'sleepers'; sleepers.receiveShadow = true;
    const farRail = new THREE.Mesh(both(a, b, 6, plain, false), railMat); farRail.name = 'rail_far';
    for (const m of [rail, band, farRail]) m.geometry.translate(-mid.x, -mid.y, -mid.z);
    close.add(rail, band, sleepers); far.add(farRail);
    const lod = new THREE.LOD(); lod.name = 'track_piece'; lod.position.copy(mid);
    lod.addLevel(close, 0); lod.addLevel(far, 175); lod.addLevel(new THREE.Group(), 1200);
    g.add(lod);
  }
  return g;
}
