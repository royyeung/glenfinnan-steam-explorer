// Probe: are exhaust puffs emitted, where, and are they drawn?
import { serve, browser, openPage } from './common.mjs';
const { server, url } = await serve(); const b = await browser();
const { page, errors } = await openPage(b, `${url}?fixed=1&q=low&run=1`, { w: 960, h: 540 });
const r = await page.evaluate(() => {
  GX.run({ on: true, place: 'viaduct', hold: 6 }); GX.view('front-34-l');
  for (let i = 0; i < 48; i++) GX.tick(15);
  const a = GX.app, ex = a.exhaust, chim = a.engine.localToWorld(new GX.THREE.Vector3(0, 4, 0));
  const p = ex.iPos.array, out = [];
  for (let k = 0; k < Math.min(ex.count, 6); k++) out.push([p[k*4], p[k*4+1], p[k*4+2], p[k*4+3]].map((v) => +v.toFixed(2)), [...ex.iLook.array.slice(k*4, k*4+2)].map((v) => +v.toFixed(3)));
  const u = ex.mat.uniforms;
  return { count: ex.count, visible: ex.mesh.visible, inst: ex.geo.instanceCount, engine: [chim.x, chim.y, chim.z].map((v) => +v.toFixed(1)), cam: a.persp.position.toArray().map((v) => +v.toFixed(1)), puffs: out, sun: u.uSun.value.toArray(), sky: u.uSky.value.toArray(), steam: a.footplate.steamUse, trace: a.beatTrace.length };
});
console.log(JSON.stringify(r));
await page.evaluate(() => GX.render());
await page.screenshot({ path: '/w/shots/p6/probe.png', timeout: 400000 });
console.log(JSON.stringify(errors));
await b.close(); server.close();
