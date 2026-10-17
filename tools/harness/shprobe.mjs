// Probe: draw calls and triangles with and without the shadow redraw, and who casts shadows (Low)
import { serve, browser, openPage } from './common.mjs';
const { server, url } = await serve(); const b = await browser();
const q = process.argv[2] || 'low';
const { page } = await openPage(b, `${url}?fixed=1&q=${q}&run=1`, { w: 1280, h: 720 });
const r = await page.evaluate(() => {
  const a = GX.app, out = {};
  for (const v of ['train-glen', 'front-34-l', 'cab-inside']) {
    GX.run({ on: true, place: 'viaduct', hold: 8 }); GX.view(v); for (let i = 0; i < 6; i++) GX.tick(30);
    const on = GX.stats();
    a.run.hold = 0; GX.tick(1); a.renderer.shadowMap.needsUpdate = false; a.atmosphere.dynamicShadows = false;
    // render without a shadow update: freeze the shadow map for one frame
    const au = a.renderer.shadowMap.autoUpdate; const st = (() => { a.renderer.info.reset(); a.post.render(a.scene, a.camera); const i = a.renderer.info.render; return { calls: i.calls, tris: i.triangles }; })();
    out[v] = { withShadowRedraw: { calls: on.calls, tris: on.triangles }, without: st };
  }
  const casters = {}; a.scene.traverse((o) => { if (o.isMesh && o.castShadow && o.visible) { let p = o, root = '?'; while (p) { if (/LOD|^coach_|^world|^site|^train/.test(p.name)) { root = p.name; break; } p = p.parent; } casters[root] = (casters[root] || 0) + 1; } });
  out.casters = casters;
  // world casters inside the shadow frustum: name and triangles
  const L = a.atmosphere.light, cam = L.shadow.camera; cam.updateMatrixWorld(); const fr = new GX.THREE.Frustum().setFromProjectionMatrix(new GX.THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const wc = [];
  a.world.group.traverse((o) => { if (o.isMesh && o.castShadow && o.visible) { if (!o.frustumCulled || fr.intersectsObject(o)) { const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); wc.push([o.name || o.parent?.name, Math.round(t)]); } } });
  out.worldCasters = wc;
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close(); server.close();
