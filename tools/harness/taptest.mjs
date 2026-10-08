// Phone test: stand at the driver's position, tap where the regulator is drawn, expect its panel.
import fs from 'node:fs';
import { serve, browser, openPage } from './common.mjs';
const { server, url } = await serve(); const b = await browser();
const { page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 844, h: 390, mobile: true });
const pt = await page.evaluate(() => {
  GX.view('cab-driver'); GX.app.inputs.enabled = true;
  const T = GX.THREE, n = GX.app.scene.getObjectByName('ctl_regulator');
  const p = new T.Box3().setFromObject(n).getCenter(new T.Vector3()).project(GX.app.camera);
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
});
await page.touchscreen.tap(pt.x, pt.y);
await page.evaluate(() => GX.render());
const r = await page.evaluate(() => ({ panelVisible: !document.getElementById('ctlPanel').hidden, title: document.querySelector('#ctlPanel h3').textContent }));
await page.screenshot({ path: '/w/shots/p3/tap_regulator_mobile.png' });
console.log(JSON.stringify({ tapAt: pt, ...r, errors }));
await b.close(); server.close();
