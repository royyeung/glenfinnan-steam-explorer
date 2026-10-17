// Probe: what each part of the scene costs in the main pass (Low), by hiding it
import { serve, browser, openPage } from './common.mjs';
const { server, url } = await serve(); const b = await browser();
const { page } = await openPage(b, `${url}?fixed=1&q=low&run=1`, { w: 1280, h: 720 });
const r = await page.evaluate(() => {
  const a = GX.app, out = {};
  const measure = () => { a.renderer.shadowMap.needsUpdate = false; a.atmosphere.dynamicShadows = false; a.renderer.info.reset(); a.post.render(a.scene, a.camera); const i = a.renderer.info.render; return [i.calls, i.triangles]; };
  for (const v of ['front-34-l', 'cab-inside']) {
    GX.run({ on: true, place: 'viaduct', hold: 0 }); GX.view(v); GX.tick(2); GX.render();
    const base = measure(), parts = {};
    const groups = [...a.world.group.children.map((c) => [c.name, c]), ['engine', a.engine], ['tender', a.tender], ['coaches', a.train.group], ['diesel', a.diesel], ['sky', a.atmosphere.sky], ['exhaust', a.exhaust.mesh]];
    for (const [n, g] of groups) { const was = g.visible; g.visible = false; const m = measure(); g.visible = was; parts[n] = [base[0] - m[0], base[1] - m[1]]; }
    out[v] = { base, parts };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close(); server.close();
