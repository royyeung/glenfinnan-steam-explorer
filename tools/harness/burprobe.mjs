// Probe: does the terrain cover the line anywhere along the modelled track? (rail top vs ground above it)
import { serve, browser, openPage } from './common.mjs';
const { server, url } = await serve(); const b = await browser();
const { page } = await openPage(b, `${url}?fixed=1&q=${process.argv[2] || 'medium'}&run=0`, { w: 640, h: 360 });
const r = await page.evaluate(() => {
  const T = GX.THREE, a = GX.app, w = a.world, path = w.data.track, [t0, t1] = w.trackEnds, rc = new T.Raycaster();
  const terr = [w.terrain.near, w.terrain.far], nb = w.data.json.near;
  const out = { trackEnds: [t0, t1], len: path.length, viaduct: path.viaduct, station: path.station, route: a.run && a.run.route, nearBox: [nb.x0, nb.z0, (nb.n - 1) * nb.step], bad: [] };
  for (let s = t0; s <= t1; s += 5) {
    const p = path.at(s); rc.set(new T.Vector3(p.x, p.y + 200, p.z), new T.Vector3(0, -1, 0));
    const h = rc.intersectObjects(terr, false)[0];
    const top = h ? h.point.y : null, inNear = p.x > nb.x0 && p.z > nb.z0 && p.x < nb.x0 + (nb.n - 1) * nb.step && p.z < nb.z0 + (nb.n - 1) * nb.step;
    if (top !== null && top > p.y + 0.3) out.bad.push([Math.round(s), +(top - p.y).toFixed(1), h.object.name, inNear]);
  }
  // trees standing in the train's way (within 3 m of the line)
  const T7 = w.data.trees.data; out.treesOnLine = 0;
  for (let i = 0; i < w.data.trees.count; i++) { const x = T7[i * 7], z = T7[i * 7 + 2], s = path.nearest(x, z); if (s > t0 && s < t1) { const q = path.at(s); if (Math.hypot(q.x - x, q.z - z) < 3) out.treesOnLine++; } }
  return out;
});
console.log(JSON.stringify(r));
await b.close(); server.close();
