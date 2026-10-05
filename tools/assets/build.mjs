// Build compressed glTF models from the parametric generators (the same TS code the app uses).
// Output: public/models/<vehicle>_lod{0,1,2}.glb (Meshopt-compressed) + manifest.json.
// Run: tools/node.sh tools/assets/build.mjs   (Node 22 runs the .ts sources via type stripping)
import fs from 'node:fs';
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { buildEngine, buildTender } from '../../src/loco/blockout.ts';
import { blockoutMaterials } from '../../src/loco/materials.ts';

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
      if (geo.getAttribute('uv')) prim.setAttribute('TEXCOORD_0', acc(new Float32Array(geo.getAttribute('uv').array), 'VEC2'));
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
const LODS = [{ ratio: 1 }, { ratio: 0.45, error: 0.003 }, { ratio: 0.12, error: 0.02 }];
const manifest = { generated: new Date().toISOString(), files: {} };

for (const [name, build] of [['engine', buildEngine], ['tender', buildTender]]) {
  for (let l = 0; l < LODS.length; l++) {
    const root = build(blockoutMaterials());
    const doc = toDocument(root);
    const steps = [dedup(), weld()];
    if (LODS[l].ratio < 1) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio: LODS[l].ratio, error: LODS[l].error, lockBorder: false }));
    steps.push(prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    await doc.transform(...steps);
    const file = `${OUT}/${name}_lod${l}.glb`;
    await io.write(file, doc);
    let tris = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    const bytes = fs.statSync(file).size;
    manifest.files[`${name}_lod${l}.glb`] = { bytes, tris: Math.round(tris) };
    console.log(`${file}: ${(bytes / 1024).toFixed(1)} kB, ${Math.round(tris)} triangles`);
  }
}
for (const f of fs.readdirSync('public/textures')) manifest.files[`../textures/${f}`] = { bytes: fs.statSync(`public/textures/${f}`).size };
fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
void THREE;
