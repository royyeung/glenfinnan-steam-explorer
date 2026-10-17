// Shots: the running train seen from above where the ground used to cover the line (Phase 6 fix)
import { serve, browser, openPage } from './common.mjs';
import fs from 'node:fs';
const { server, url } = await serve(); const b = await browser();
const q = process.argv[2] || 'medium', out = process.argv[3] || 'shots/p6/fix';
const { page } = await openPage(b, `${url}?fixed=1&q=${q}&run=1`, { w: 1280, h: 720 });
// front of the train at s; camera above and to the side of the middle of the train
for (const [name, s, side, up, back] of [['knoll', 5080, 45, 70, 60], ['west_end', 3570, 40, 60, 60], ['plot3700', 3660, 40, 60, 50]]) {
  const img = await page.evaluate(([s, side, up, back]) => {
    GX.run({ on: true, auto: true, s, v: 4.47 }); for (let i = 0; i < 4; i++) GX.tick(60);
    const a = GX.app, T = GX.THREE, path = a.world.data.track, r = a.run, mid = path.at(r.s + 60), t = path.tangent(r.s + 60), n = new T.Vector3(t.z, 0, -t.x);
    a.setMode('orbit'); a.setCamera(a.persp); a.persp.fov = 50; a.persp.updateProjectionMatrix();
    a.persp.position.copy(mid).addScaledVector(n, side).addScaledVector(t, back); a.persp.position.y += up;
    a.orbit.target.copy(mid); a.orbit.update(); a.followTrain = false;
    return GX.capture();
  }, [s, side, up, back]);
  fs.writeFileSync(`${out}/${name}_${q}.png`, Buffer.from(img.split(',')[1], 'base64'));
}
await b.close(); server.close();
