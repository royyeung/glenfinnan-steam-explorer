import { browser, openPage } from './common.mjs';
const q = process.argv[2] || '';
const b = await browser();
const { page, errors } = await openPage(b, `https://royyeung.dev/glenfinnan/?debug=1${q ? '&q=' + q : ''}`, { w: 1280, h: 640 });
await page.click('#start');
await page.click('#mWalk');
await page.waitForTimeout(1000);
const r = await page.evaluate(() => {
  const w = GX.walk(1, 0, 2.0, -Math.PI / 2);           // from the platform into the cab
  GX.app.walker.yaw = Math.PI; GX.app.walker.pitch = 0.05; // face the backhead
  GX.info(true);
  return { feet: w, tier: GX.app.tierName };
});
await page.waitForTimeout(3000);
const s = await page.evaluate(() => { const v = []; GX.app.scene.traverse((o) => { if (o.name === 'cab_interior') v.push(o.visible); }); return { vis: v, calls: GX.app.renderer.info.render.calls, cam: GX.app.camera.getWorldPosition(new GX.THREE.Vector3()).toArray().map((x) => +x.toFixed(2)) }; });
await page.screenshot({ path: `/w/shots/p3/live_walkin_${q || 'auto'}.png`, timeout: 300000 });
console.log(JSON.stringify({ ...r, ...s, errors: errors.slice(0, 5) }));
await b.close();
