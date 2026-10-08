// Phase 1 test site: straight track on a ballast bed, a platform at standard height, open ground
// and a 1.70 m figure for scale. Phase 5 replaces this with the viaduct and terrain.
import * as THREE from 'three';
import { B5 } from '../specs/black5.ts';
import { spec } from '../specs/spec.ts';
import { antiTile } from '../render/antiTile.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Long track parts are built from short sections: one 360 m triangle reaching behind the camera
 *  loses depth precision when clipped (seen as rails showing through the cab). */
const SEG = 12;
function sections(make: (z0: number, len: number) => THREE.BufferGeometry, z0: number, len: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (let a = 0; a < len - 1e-6; a += SEG) { const g = make(z0 + a, Math.min(SEG, len - a)); parts.push(g.index ? g.toNonIndexed() : g); }
  return mergeGeometries(parts, false)!;
}

export const SITE = {
  railHeight: spec(0.159, 'standard-practice', 'medium', 'BS113A flat-bottom rail, 158.75 mm'),
  sleeperSpacing: spec(0.65, 'standard-practice', 'estimate'),
  platformHeight: spec(0.915, 'standard-practice', 'medium', 'UK nominal platform height above rail'),
  platformOffset: spec(0.73, 'standard-practice', 'medium', 'edge from the running edge of the near rail'),
  groundY: spec(-0.6, 'estimate', 'estimate', 'formation on a low embankment'),
};

export interface PbrSet { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture }

function pbr(name: string, set: PbrSet, repeat: number, tint: number, macro: number) {
  for (const t of [set.color, set.normal, set.rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  const m = new THREE.MeshStandardMaterial({ name, map: set.color, normalMap: set.normal, roughnessMap: set.rough, color: tint, roughness: 1, metalness: 0 });
  antiTile(m, macro);
  return m;
}

export function buildSite(tex: { ballast: PbrSet; ground: PbrSet }) {
  const g = new THREE.Group(); g.name = 'site';
  const colliders: THREE.Mesh[] = [];
  const half = B5.gauge.v / 2, rh = SITE.railHeight.v, gy = SITE.groundY.v;
  const len = 360, z0 = -180;

  // ground: 3 km square, texture repeats every 4 m, two-scale blend hides the repeat
  const groundGeo = new THREE.PlaneGeometry(3000, 3000, 1, 1).rotateX(-Math.PI / 2).translate(0, gy, 0);
  const uvs = groundGeo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 500, uvs.getY(i) * 500); // one tile = 6 m
  const ground = new THREE.Mesh(groundGeo, pbr('ground', tex.ground, 1, 0xd8dccf, 0.22));
  ground.name = 'ground'; ground.receiveShadow = true; g.add(ground); colliders.push(ground);

  // ballast bed (trapezoid section along Z), UVs in metres / 1.2
  const top = -rh - 0.2, sTop = 1.9, sBot = 3.1;
  const sect = new THREE.Shape([new THREE.Vector2(-sBot, gy), new THREE.Vector2(sBot, gy), new THREE.Vector2(sTop, top), new THREE.Vector2(-sTop, top)]);
  const bed = sections((za, l) => new THREE.ExtrudeGeometry(sect, { depth: l, bevelEnabled: false, UVGenerator: {
    generateTopUV: (_g, v, a, b, c) => [a, b, c].map((i) => new THREE.Vector2(v[i * 3] / 1.2, v[i * 3 + 1] / 1.2)),
    generateSideWallUV: (_g, v, a, b, c, d) => [a, b, c, d].map((i) => new THREE.Vector2((v[i * 3] + v[i * 3 + 1]) / 1.2, (v[i * 3 + 2] + za) / 1.2)),
  } }).translate(0, 0, za), z0, len);
  const ballast = new THREE.Mesh(bed, pbr('ballast', tex.ballast, 1, 0xb5aea4, 0.12));
  ballast.name = 'ballast'; ballast.receiveShadow = true; g.add(ballast); colliders.push(ballast);

  // sleepers (instanced), concrete-coloured blockout
  const n = Math.floor(len / SITE.sleeperSpacing.v);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 0.2, 0.26), new THREE.MeshStandardMaterial({ name: 'sleeper', color: 0x5f5c57, roughness: 0.92 }), n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) sleepers.setMatrixAt(i, m4.makeTranslation(0, -rh - 0.1 - 0.012, z0 + 0.3 + i * SITE.sleeperSpacing.v));
  sleepers.name = 'sleepers'; sleepers.receiveShadow = true; sleepers.castShadow = true; g.add(sleepers);

  // rails: simplified flat-bottom profile extruded along Z, rail top at y = 0
  const p = (x: number, y: number) => new THREE.Vector2(x, y);
  const prof = new THREE.Shape([p(-0.07, -rh), p(0.07, -rh), p(0.07, -rh + 0.012), p(0.009, -rh + 0.03), p(0.009, -0.045), p(0.035, -0.035), p(0.035, -0.004), p(0.03, 0), p(-0.03, 0), p(-0.035, -0.004), p(-0.035, -0.035), p(-0.009, -0.045), p(-0.009, -rh + 0.03), p(-0.07, -rh + 0.012)]);
  const railGeo = sections((za, l) => new THREE.ExtrudeGeometry(prof, { depth: l, bevelEnabled: false }).translate(0, 0, za), z0, len);
  const railMat = new THREE.MeshStandardMaterial({ name: 'rail', color: 0x6f5a4c, roughness: 0.55, metalness: 0.6 });
  for (const s of [1, -1]) { const r = new THREE.Mesh(railGeo, railMat); r.position.x = s * (half + 0.035); r.castShadow = r.receiveShadow = true; r.name = 'rail'; g.add(r); }
  // polished running band on the rail head
  const bandGeo = sections((za, l) => new THREE.PlaneGeometry(0.045, l).rotateX(-Math.PI / 2).translate(0, 0.0015, za + l / 2), z0, len);
  const bandMat = new THREE.MeshStandardMaterial({ name: 'rail_band', color: 0xc9c7c2, roughness: 0.22, metalness: 1 });
  for (const s of [1, -1]) { const b = new THREE.Mesh(bandGeo, bandMat); b.position.x = s * (half + 0.035); g.add(b); }

  // platform on the right (-X) side: edge 730 mm from the running edge, top 915 mm above rail
  const pEdge = -(half + SITE.platformOffset.v), pTop = SITE.platformHeight.v, pz0 = -26, pz1 = 8;
  const plat = new THREE.Mesh(new THREE.BoxGeometry(4, pTop - gy, pz1 - pz0), new THREE.MeshStandardMaterial({ name: 'platform', color: 0x6a6660, roughness: 0.9 }));
  plat.position.set(pEdge - 2, (pTop + gy) / 2, (pz0 + pz1) / 2); plat.name = 'platform'; plat.castShadow = plat.receiveShadow = true;
  g.add(plat); colliders.push(plat);
  const coping = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, pz1 - pz0), new THREE.MeshStandardMaterial({ name: 'platform_edge', color: 0xd8c24a, roughness: 0.7 }));
  coping.position.set(pEdge - 0.3, pTop + 0.01, (pz0 + pz1) / 2); g.add(coping);
  // ramp at the far end so the walker can reach track level
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 6), plat.material);
  ramp.position.set(pEdge - 2, (pTop + gy) / 2 - 0.1, pz1 + 2.8); ramp.rotation.x = -Math.atan2(pTop - gy, 6); g.add(ramp); colliders.push(ramp);

  // 1.70 m figure for scale (stands on the platform beside the cab)
  const figMat = new THREE.MeshStandardMaterial({ name: 'figure', color: 0x2f4f6f, roughness: 0.8 });
  const fig = new THREE.Group(); fig.name = 'figure_170';
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 1.7 - 0.38 - 0.24, 6, 12), figMat); body.position.y = (1.7 - 0.24) / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), figMat); head.position.y = 1.7 - 0.12;
  fig.add(body, head); fig.traverse((o) => { o.castShadow = true; });
  fig.position.set(pEdge - 0.9, pTop, -2.2); g.add(fig);

  return { group: g, colliders, platform: { edgeX: pEdge, top: pTop, z0: pz0, z1: pz1 }, figure: fig };
}
