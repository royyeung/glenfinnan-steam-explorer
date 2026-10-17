// Looking down the train from inside a coach (Glenfinnan, train on the viaduct): the coaches either
// side must be full models with interiors, never the hollow distant models; draw calls per tier.
import { serve, browser, openPage } from './common.mjs';
const out = process.argv[2] || 'p5d';
const { server, url } = await serve(); const b = await browser();
const R = { pass: true };
import fs from 'node:fs';
const dump = () => fs.writeFileSync(`/w/shots/${out}/checks-gangway.json`, JSON.stringify(R, null, 1));
for (const q of ['low', 'medium', 'high']) {
  const { page, errors } = await openPage(b, `${url}?fixed=1&hud&q=${q}`, { w: 1280, h: 720 });
  for (const [name, a] of [['saloonB', 3.0], ['saloonA', 17.0], ['gangway', 19.6]]) {
    // coach 3 (5419), a metres from its A end, looking along the aisle: B-wards (towards 99318), then A-wards
    for (const dir of [-1, 1]) {
      const r = await page.evaluate(([a, dir]) => {
        const app = GX.app, T = GX.THREE, c = app.train.coaches[2], lay = c.lay;
        const p = c.lod.localToWorld(new T.Vector3(0, 1.27, lay.z(a)));
        const f = c.lod.localToWorld(new T.Vector3(0, 0, dir)).sub(c.lod.localToWorld(new T.Vector3()));
        GX.teleport(p.x, p.y + 0.05, p.z, Math.atan2(-f.x, -f.z)); app.walker.pitch = 0; GX.step(2);
        const s = GX.stats();
        const lv = app.train.coaches.map((k) => k.lod.levels.findIndex((l) => l.object.visible) + (k.interiors.some((i) => i.visible) ? '+int' : ''));
        return { calls: s.calls, tris: s.triangles, levels: lv.join(' ') };
      }, [a, dir]);
      R[`${q}_${name}_${dir < 0 ? 'toB' : 'toA'}`] = r;
      // the neighbour must be drawn in full: always on Medium/High; on Low when you are within 4 m of
      // that end (a is metres from the A end; the coach body is 19.66 m)
      const nb = 2 + (dir < 0 ? 1 : -1), lv = r.levels.split(' '), nearThatEnd = dir > 0 ? a < 4 : a > 19.66 - 4;
      if (!lv[2].startsWith('0+int') || ((q !== 'low' || nearThatEnd) && !lv[nb].startsWith('0+int'))) R.pass = false;
      if (q === 'low' && r.calls > 150) R.pass = false;
      if (q === 'medium' && r.calls > 300) R.pass = false;
      if (q === 'high' && r.calls > 600) R.pass = false;
      dump();
      if (q === 'low' && name !== 'saloonA') { await page.evaluate(() => GX.render()); await page.screenshot({ path: `/w/shots/${out}/${q}_${name}_${dir < 0 ? 'toB' : 'toA'}.png`, timeout: 400000 }); }
    }
  }
  // walk through the gangway into 99318 and back: the closed far doors must not block the way
  R[`${q}_walkThrough`] = await page.evaluate(() => {
    const app = GX.app, T = GX.THREE, c = app.train.coaches[2], lay = c.lay;
    const p = c.lod.localToWorld(new T.Vector3(0, 1.27, lay.z(15))), f = c.lod.localToWorld(new T.Vector3(0, 0, -1)).sub(c.lod.localToWorld(new T.Vector3()));
    GX.teleport(p.x, p.y + 0.05, p.z, Math.atan2(-f.x, -f.z)); GX.walk(1, 0, 12);
    const end = app.train.coaches[3].lod.worldToLocal(app.walker.feet.clone());
    return { inCoach: app.train.coaches[3].number, z_local: +end.z.toFixed(2), y_local: +end.y.toFixed(2) };
  });
  if (!(R[`${q}_walkThrough`].z_local < 7 && Math.abs(R[`${q}_walkThrough`].y_local - 1.27) < 0.1)) R.pass = false;
  R[`${q}_errors`] = errors; if (errors.length) R.pass = false; dump();
  await page.close();
}
console.log(JSON.stringify(R, null, 1));
await b.close(); server.close();
