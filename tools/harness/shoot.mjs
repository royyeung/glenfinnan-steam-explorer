// Fixed-view screenshots in one page (views switch without reloading).
// Usage: tools/run.sh shoot.mjs <stage> [--q=low|medium|high] [--views=a,b] [--mobile] [--hour=11.25] [--suffix=x]
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, serve, browser, openPage } from './common.mjs';
const args = process.argv.slice(2), stage = args.shift();
const opt = Object.fromEntries(args.map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const OUT = path.join(ROOT, 'shots', stage); fs.mkdirSync(OUT, { recursive: true });
const views = (opt.views || 'front-34-l,rear-34-r,motion-l,site-wide,human-scale,cab-entry,cab-inside,left-elev,right-elev,front-end,plan').split(',');
const sizes = { 'left-elev': [1760, 480], 'right-elev': [1760, 480], 'front-end': [800, 800], 'plan': [1320, 300] };
const def = opt.mobile ? [844, 390] : [1280, 720];
const suffix = (opt.q ? '_' + opt.q : '') + (opt.mobile ? '_mobile' : '') + (opt.suffix ? '_' + opt.suffix : '');
const { server, url } = await serve();
const b = await browser();
const { page, errors } = await openPage(b, `${url}?fixed=1&q=${opt.q || 'high'}&hour=${opt.hour || 11.25}`, { w: def[0], h: def[1], mobile: !!opt.mobile });
const log = {};
for (const v of views) {
  const [w, h] = opt.mobile ? def : (sizes[v] || def);
  await page.setViewportSize({ width: w, height: h });
  const t0 = Date.now(), before = errors.length;
  const st = await page.evaluate((view) => { GX.app.resize(); GX.view(view); GX.render(); return { view, stats: GX.stats(), sun: GX.sun() }; }, v);
  await page.screenshot({ path: path.join(OUT, v + suffix + '.png'), timeout: 240000 });
  log[v] = { ...st, ms: Date.now() - t0, errors: errors.slice(before) };
  console.log(v + suffix, log[v].errors.length ? log[v].errors.join(' | ') : 'ok', `${Date.now() - t0} ms`);
}
fs.writeFileSync(path.join(OUT, `shots${suffix}.json`), JSON.stringify({ errorsAtLoad: errors, views: log }, null, 1));
await b.close(); server.close();
