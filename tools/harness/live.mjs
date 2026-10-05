// Load the deployed site in a browser (normal User-Agent) and report readiness and errors.
import { browser, openPage } from './common.mjs';
const url = process.argv[2] || 'https://royyeung.dev/glenfinnan/?debug=1&fixed=1&q=low';
const b = await browser();
const t0 = Date.now();
const { page, errors } = await openPage(b, url, { w: 1280, h: 720 });
const s = await page.evaluate(() => { GX.view('front-34-l'); return GX.stats(); });
const ui = await page.evaluate(() => ({ title: document.title, robots: document.querySelector('meta[name=robots]')?.content, note: document.querySelector('.note')?.textContent.slice(0, 80) }));
console.log(JSON.stringify({ readyAfterMs: Date.now() - t0, stats: { calls: s.calls, triangles: s.triangles, tier: s.tier }, ui, errors }, null, 1));
await b.close();
