// Orthographic black-on-white silhouettes at known pixels-per-metre for photo overlays.
// Usage: tools/run.sh silhouette.mjs <stage>
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, serve, browser, openPage } from './common.mjs';
const [stage] = process.argv.slice(2);
const OUT = path.join(ROOT, 'shots', stage); fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await serve(); const b = await browser();
const views = [['right-elev', 1760, 480], ['left-elev', 1760, 480], ['front-end', 800, 800]];
const { page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1760, h: 480 });
for (const [v, w, h] of views) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate((view) => { GX.app.resize(); GX.view(view); GX.silhouette(true); }, v);
  await page.screenshot({ path: path.join(OUT, `sil_${v}.png`) });
  await page.evaluate(() => GX.silhouette(false));
  console.log(v, 'ok');
}
console.log('errors', errors);
await b.close(); server.close();
