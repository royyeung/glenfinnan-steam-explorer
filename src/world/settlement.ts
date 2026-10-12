// Glenfinnan's built features from OS OpenMap Local: building footprints (heights and pitched roofs
// estimated), roads draped as ribbons, the Glenfinnan Monument (1815; an 18 m round tower with a
// statue, simplified), and the station platform beside the line (the passing loop and the second
// platform are not modelled).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { B5 } from '../specs/black5.ts';
import { SITE } from './site.ts';
import type { WorldData } from './data.ts';
import { sweep } from './track.ts';
import { ktxNormalChunk } from '../render/antiTile.ts';

const nonIdx = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); if (!n.getAttribute('uv')) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.getAttribute('position').count * 2), 2)); return n; };

export function buildSettlement(data: WorldData, asphalt: { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture }) {
  const g = new THREE.Group(); g.name = 'settlement';
  const colliders: THREE.Object3D[] = [];

  // buildings: walls (white harl or grey stone) and slate roofs
  const walls: THREE.BufferGeometry[] = [], roofs: THREE.BufferGeometry[] = [];
  const path = data.track;
  for (const b of data.json.buildings) {
    const ring = b.ring.map(([x, z]) => new THREE.Vector2(x, z));
    // the station building stands on the platform: anything right beside the line sits at platform level
    const c = ring.reduce((acc, p) => acc.add(p), new THREE.Vector2()).multiplyScalar(1 / ring.length), sc = path.nearest(c.x, c.y), q = path.at(sc);
    if (Math.hypot(q.x - c.x, q.z - c.y) < 16 && Math.abs(sc - path.station) < 150) b.base = Math.max(b.base, q.y + 0.915);
    if (ring.length < 4) continue;
    if (ring[0].equals(ring[ring.length - 1])) ring.pop();
    // walls: extrude the footprint (shape in x, -z so it extrudes up after rotation)
    const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, -p.y)));
    const wall = new THREE.ExtrudeGeometry(shape, { depth: b.eaves + 1.5, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, b.base - 1.5, 0);
    walls.push(nonIdx(wall));
    // roof: a ridge along the longer axis of the footprint's bounding box (oriented by its longest edge)
    let best = 0, dir = new THREE.Vector2(1, 0);
    for (let i = 0; i < ring.length; i++) { const e = ring[(i + 1) % ring.length].clone().sub(ring[i]); if (e.length() > best) { best = e.length(); dir = e.normalize(); } }
    const nrm = new THREE.Vector2(-dir.y, dir.x);
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of ring) { const a = p.dot(dir), c = p.dot(nrm); a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, c); b1 = Math.max(b1, c); }
    const ov = 0.3, ye = b.base + b.eaves, yr = b.base + Math.min(b.ridge, b.eaves + (b1 - b0) * 0.45);
    const P = (a: number, c: number, y: number) => { const v = dir.clone().multiplyScalar(a).add(nrm.clone().multiplyScalar(c)); return [v.x, y, v.y]; };
    const bm = (b0 + b1) / 2, A0 = a0 - ov, A1 = a1 + ov, B0 = b0 - ov, B1 = b1 + ov;
    const tri = [
      P(A0, B0, ye), P(A1, B0, ye), P(A1, bm, yr), P(A0, B0, ye), P(A1, bm, yr), P(A0, bm, yr),      // slope 1
      P(A1, B1, ye), P(A0, B1, ye), P(A0, bm, yr), P(A1, B1, ye), P(A0, bm, yr), P(A1, bm, yr),      // slope 2
      P(a0, b0, ye), P(a0, bm, yr), P(a0, b1, ye), P(a1, b1, ye), P(a1, bm, yr), P(a1, b0, ye),      // gables
    ];
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3)); rg.computeVertexNormals();
    roofs.push(nonIdx(rg));
  }
  if (walls.length) {
    const w = new THREE.Mesh(mergeGeometries(walls)!, new THREE.MeshStandardMaterial({ name: 'harl', color: 0xd9d6cc, roughness: 0.9, side: THREE.DoubleSide }));
    const r = new THREE.Mesh(mergeGeometries(roofs)!, new THREE.MeshStandardMaterial({ name: 'slate', color: 0x3c4146, roughness: 0.6, side: THREE.DoubleSide }));
    w.name = 'buildings'; r.name = 'roofs';
    for (const m of [w, r]) { m.castShadow = m.receiveShadow = true; g.add(m); }
    colliders.push(w);
  }

  // roads: ribbons 4 cm above the levelled road bed
  for (const t of [asphalt.color, asphalt.normal, asphalt.rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  const roadMat = new THREE.MeshStandardMaterial({ name: 'road', map: asphalt.color, normalMap: asphalt.normal, roughnessMap: asphalt.rough, color: 0x9a9a98, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  roadMat.onBeforeCompile = (s) => { s.fragmentShader = ktxNormalChunk(s.fragmentShader); };
  roadMat.customProgramCacheKey = () => 'road-ktxn';
  const rg: THREE.BufferGeometry[] = [];
  for (const rd of data.json.roads) {
    const p = rd.pts; if (p.length < 2) continue;
    if (!p.some(([x, , z]) => data.inNear(x, z, 10))) continue;      // the core only: the far grid is too coarse for ribbons
    const pos: number[] = [], uv: number[] = []; let along = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      const tx = b[0] - a[0], tz = b[2] - a[2], l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      if (i) along += Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]);
      for (const sgn of [-1, 1]) {
        const x = p[i][0] + nx * sgn * rd.w / 2, z = p[i][2] + nz * sgn * rd.w / 2;
        pos.push(x, data.height(x, z) + 0.04, z); uv.push(along / 8, (sgn * rd.w) / 16);
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < p.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    rg.push(nonIdx(geo));
  }
  if (rg.length) { const roads = new THREE.Mesh(mergeGeometries(rg)!, roadMat); roads.name = 'roads'; roads.receiveShadow = true; roadMat.side = THREE.DoubleSide; g.add(roads); }

  // Glenfinnan Monument: round rubble tower on a battered base, crenellated top, statue of a Highlander
  const [mx, my, mz] = data.json.landmarks.monument;
  const stone = new THREE.MeshStandardMaterial({ name: 'monument_stone', color: 0x8c877c, roughness: 0.95 });
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(4.2, 4.6, 1.2, 24).translate(0, 0.6, 0),                     // base platform
    new THREE.CylinderGeometry(2.3, 2.55, 15.5, 24).translate(0, 1.2 + 7.75, 0),             // tower
    new THREE.CylinderGeometry(2.6, 2.4, 0.6, 24).translate(0, 16.9, 0),                     // corbel
  ];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; parts.push(new THREE.BoxGeometry(0.7, 0.8, 0.45).rotateY(-a).translate(Math.cos(a) * 2.35, 17.6, Math.sin(a) * 2.35)); } // merlons
  parts.push(new THREE.CylinderGeometry(0.3, 0.38, 1.0, 10).translate(0, 17.7, 0), new THREE.CylinderGeometry(0.22, 0.28, 1.4, 10).translate(0, 18.9, 0), new THREE.SphereGeometry(0.17, 10, 8).translate(0, 19.75, 0)); // plinth and figure
  const mon = new THREE.Mesh(mergeGeometries(parts.map(nonIdx))!, stone); mon.position.set(mx, my - 0.4, mz); mon.name = 'monument'; mon.castShadow = mon.receiveShadow = true;
  g.add(mon); colliders.push(mon);

  // station platform on the south side of the line (the building OS lists as a museum stands there)
  const half = B5.gauge.v / 2, edge = half + SITE.platformOffset.v, top = SITE.platformHeight.v;
  const s0 = path.station - 95, s1 = path.station + 70;          // about 165 m (estimate); centred on the museum
  // u > 0 is left of eastward travel (north-east here); the museum lies on the right, so u < 0
  const u0 = -edge, u1 = -(edge + 4.5);
  const sect: [number, number][] = [[u0, top], [u1, top], [u1, -1.5], [u0, -1.5]];
  const plat = new THREE.Mesh(sweep(path, s0, s1, 2, sect, 2, true), new THREE.MeshStandardMaterial({ name: 'platform', color: 0x6a6660, roughness: 0.9, side: THREE.DoubleSide }));
  plat.name = 'platform_glenfinnan'; plat.castShadow = plat.receiveShadow = true; g.add(plat); colliders.push(plat);
  const cope = new THREE.Mesh(sweep(path, s0, s1, 2, [[u0, top + 0.012], [u0 - 0.6, top + 0.012]], 2), new THREE.MeshStandardMaterial({ name: 'platform_edge', color: 0xd8c24a, roughness: 0.7, side: THREE.DoubleSide }));
  cope.name = 'platform_edge'; g.add(cope);
  return { group: g, colliders, platform: { s0, s1, u0, u1, top } };
}
