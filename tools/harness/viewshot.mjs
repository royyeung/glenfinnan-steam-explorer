// One named view at a quality tier (train stopped), with the ground height under the camera
import { serve, browser, openPage } from './common.mjs';
import fs from 'node:fs';
const { server, url } = await serve(); const b = await browser();
const [view, q = 'medium', out = 'shots/p6/fix'] = process.argv.slice(2);
const { page } = await openPage(b, `${url}?fixed=1&q=${q}&run=0`, { w: 1280, h: 720 });
const r = await page.evaluate((v) => { GX.view(v); const p = GX.app.persp.position; return { img: GX.capture(), cam: [p.x, p.y, p.z], ground: GX.app.world.data.height(p.x, p.z) }; }, view);
fs.writeFileSync(`${out}/${view}_${q}.png`, Buffer.from(r.img.split(',')[1], 'base64'));
console.log(JSON.stringify({ cam: r.cam, ground: r.ground }));
await b.close(); server.close();
