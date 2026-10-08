// Build compressed glTF models from the parametric generators (the same TS code the app uses).
// Output: public/models/<vehicle>_lod{0,1,2}.glb (Meshopt-compressed) + manifest.json.
// Run: tools/node.sh tools/assets/build.mjs   (Node 22 runs the .ts sources via type stripping)
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { Document, NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { buildEngine, buildTender } from '../../src/loco/engine.ts';
import { blockoutMaterials } from '../../src/loco/materials.ts';
import { setDetail } from '../../src/loco/geom.ts';
import { buildCoach } from '../../src/coach/mk2.ts';

const OUT = 'public/models';
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;

/** three.js scene graph -> glTF-Transform Document (geometry, PBR factors, names, TRS). */
function toDocument(root) {
  const doc = new Document(); const buffer = doc.createBuffer();
  const scene = doc.createScene(root.name);
  const mats = new Map();
  const material = (m) => {
    if (mats.has(m)) return mats.get(m);
    const g = doc.createMaterial(m.name)
      .setBaseColorFactor([m.color.r, m.color.g, m.color.b, m.opacity ?? 1])
      .setRoughnessFactor(m.roughness ?? 1).setMetallicFactor(m.metalness ?? 0);
    if (m.transparent) g.setAlphaMode('BLEND');
    mats.set(m, g); return g;
  };
  const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buffer);
  const visit = (o) => {
    const n = doc.createNode(o.name || undefined)
      .setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
    if (o.isMesh) {
      const geo = o.geometry, prim = doc.createPrimitive().setMaterial(material(o.material));
      prim.setAttribute('POSITION', acc(new Float32Array(geo.getAttribute('position').array), 'VEC3'));
      if (geo.getAttribute('normal')) prim.setAttribute('NORMAL', acc(new Float32Array(geo.getAttribute('normal').array), 'VEC3'));
      // only decal panels need UVs (everything else is shaded procedurally): keeps files small
      if (geo.getAttribute('uv') && /^decal_/.test(o.material.name)) prim.setAttribute('TEXCOORD_0', acc(new Float32Array(geo.getAttribute('uv').array), 'VEC2'));
      if (geo.index) prim.setIndices(acc(new Uint32Array(geo.index.array), 'SCALAR'));
      n.setMesh(doc.createMesh(o.name).addPrimitive(prim));
    }
    for (const c of o.children) n.addChild(visit(c));
    return n;
  };
  scene.addChild(visit(root));
  return doc;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const LODS = [{ detail: 1, ratio: 1 }, { detail: 0.5, ratio: 0.8, error: 0.002 }, { detail: 0.25, ratio: 0.6, error: 0.01 }];
const manifest = { generated: new Date().toISOString(), files: {} };

for (const [name, build] of [['engine', buildEngine], ['tender', buildTender], ['coach', buildCoach]]) {
  for (let l = 0; l < LODS.length; l++) {
    setDetail(LODS[l].detail);
    const root = build(blockoutMaterials());
    const doc = toDocument(root);
    // keep every material distinct: decals with identical factors get different textures at runtime
    const steps = [dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), weld()];
    if (LODS[l].ratio < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: LODS[l].ratio, error: LODS[l].error, lockBorder: false }));
    // keepAttributes: decal panels get their textures at runtime, so their UVs must survive pruning
    steps.push(prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await doc.transform(...steps);
    const file = `${OUT}/${name}_lod${l}.glb`;
    await io.write(file, doc);
    let tris = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    const bytes = fs.statSync(file).size;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
    manifest.files[`${name}_lod${l}.glb`] = { bytes, tris: Math.round(tris), hash };
    console.log(`${file}: ${(bytes / 1024).toFixed(1)} kB, ${Math.round(tris)} triangles`);
  }
}
for (const f of fs.readdirSync('public/textures')) { const p = `public/textures/${f}`; manifest.files[`../textures/${f}`] = { bytes: fs.statSync(p).size, hash: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 12) }; }
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
void THREE;
