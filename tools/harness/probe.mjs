// Ad-hoc probe: run JS snippets in the page and screenshot after each. Usage: tools/run.sh probe.mjs <stage> <q> name='js' ...
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, serve, browser, openPage } from './common.mjs';
const [stage, q, ...rest] = process.argv.slice(2);
const OUT = path.join(ROOT, 'shots', stage); fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await serve(); const b = await browser();
const { page, errors } = await openPage(b, `${url}?fixed=1&q=${q}`, { w: 960, h: 540 });
for (const s of rest) {
  const i = s.indexOf('='), name = s.slice(0, i), js = s.slice(i + 1);
  const r = await page.evaluate(js).catch((e) => 'ERR ' + e.message);
  await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 240000 });
  console.log(name, JSON.stringify(r)?.slice(0, 300));
}
console.log('errors', errors);
await b.close(); server.close();
