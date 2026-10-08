// Load the LIVE site normally (no fixed mode), walk into the cab, report what is visible.
import { browser, openPage } from './common.mjs';
const b = await browser();
for (const q of [process.argv[2] ? '&q=' + process.argv[2] : '']) {
  const { ctx, page, errors } = await openPage(b, `https://royyeung.dev/glenfinnan/?debug=1${q}`, { w: 1600, h: 800 });
  await page.click('#start');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    GX.view('backhead');
    const out = { tier: GX.app.tierName, groups: [] };
    GX.app.scene.traverse((o) => { if (o.name === 'cab_interior') { let v = true, p = o; while (p) { v = v && p.visible; p = p.parent; } out.groups.push({ self: o.visible, chain: v, children: o.children.length }); } });
    const lod = GX.app.engine; out.lodLevel = lod.getCurrentLevel(); out.camDist = GX.app.camera.getWorldPosition(new GX.THREE.Vector3()).length().toFixed(2);
    return out;
  });
  await page.waitForTimeout(1500);
  const r2 = await page.evaluate(() => { const out = []; GX.app.scene.traverse((o) => { if (o.name === 'cab_interior') out.push(o.visible); }); return { after: out, lod: GX.app.engine.getCurrentLevel() }; });
  console.log(q || 'auto', JSON.stringify(r), JSON.stringify(r2), errors.slice(0, 3));
  await ctx.close();
}
await b.close();
