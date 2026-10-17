// Merge the parts of a model that never move into one mesh per material (fewer draw calls for the
// far levels of detail). Anything under a node whose name matches `keep` (rods, valve gear,
// wheelsets, controls) is left as it is, so the rigs still find and move it. Positions, normals,
// uvs and colours are read through their accessors (GLB attributes may be quantized) and baked into
// the root's frame; the weathering shader works in the vehicle frame, so the look is unchanged.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(root: THREE.Object3D, keep: RegExp) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; cast: boolean; recv: boolean }>();
  const visit = (o: THREE.Object3D) => {
    if (o !== root && keep.test(o.name)) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(m.material) && m.visible) {
      const src = m.geometry, names = ['position', 'normal', 'uv', 'color'].filter((n) => src.getAttribute(n));
      const key = `${m.material.uuid}|${names.join(',')}|${m.castShadow}|${m.receiveShadow}`;
      const g = new THREE.BufferGeometry();
      for (const n of names) {
        const a = src.getAttribute(n), size = a.itemSize, arr = new Float32Array(a.count * size);
        for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) arr[i * size + k] = a.getComponent(i, k);
        g.setAttribute(n, new THREE.BufferAttribute(arr, size));
      }
      if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const e = groups.get(key) ?? { mat: m.material, geos: [], meshes: [], cast: m.castShadow, recv: m.receiveShadow };
      e.geos.push(g.index ? g : g); e.meshes.push(m); groups.set(key, e);
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);
  let before = 0, after = 0;
  for (const e of groups.values()) {
    before += e.meshes.length;
    if (e.meshes.length < 2) { after += e.meshes.length; continue; }
    const indexed = e.geos.every((g) => g.index), merged = mergeGeometries(indexed ? e.geos : e.geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    if (!merged) { after += e.meshes.length; continue; }
    for (const m of e.meshes) m.removeFromParent();
    const mesh = new THREE.Mesh(merged, e.mat); mesh.name = `merged_${e.mat.name}`; mesh.castShadow = e.cast; mesh.receiveShadow = e.recv;
    root.add(mesh); after++;
  }
  return { before, after };
}
