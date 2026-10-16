// User flows at Glenfinnan (train on the viaduct): the opening view, wheel zoom onto the engine,
// Walk -> climb into the cab -> step down, climb into a coach and walk along it, drop-down colours.
import { serve, browser, openPage } from './common.mjs';
const out = process.argv[2] || 'p5c';
const { server, url } = await serve(); const b = await browser();
const { page, errors } = await openPage(b, `${url}?fixed=1&hud&q=low`, { w: 1280, h: 720 });
const R = {};
const st = () => page.evaluate(() => { const a = GX.app, f = a.walker.feet, o = a.boardingOffer(); return { mode: a.mode, feet: [f.x, f.y, f.z].map((v) => +v.toFixed(2)), button: document.getElementById('boardBtn').hidden ? null : document.getElementById('boardBtn').textContent, offer: o?.label ?? null }; });
const shot = async (n) => { await page.evaluate(() => GX.render()); await page.screenshot({ path: `/w/shots/${out}/${n}.png`, timeout: 400000 }); };
// opening view and zoom
R.opening = await page.evaluate(() => { const a = GX.app, e = a.engine.getWorldPosition(new GX.THREE.Vector3()); return { camToEngine_m: +a.persp.position.distanceTo(e).toFixed(1), targetToEngine_m: +a.orbit.target.distanceTo(e).toFixed(1) }; });
await shot('open');
const engPx = await page.evaluate(() => { const a = GX.app, p = a.engine.localToWorld(new GX.THREE.Vector3(0, 2.5, 0)).project(a.persp); return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight }; });
await page.mouse.move(engPx.x, engPx.y);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -100); await page.evaluate(() => GX.render()); }
R.zoom8notches = await page.evaluate(() => { const a = GX.app, e = a.engine.localToWorld(new GX.THREE.Vector3(0, 2.5, 0)); return { camToEngine_m: +a.persp.position.distanceTo(e).toFixed(1) }; });
await shot('zoomed');
// walk
await page.click('#mWalk'); await page.evaluate(() => GX.step(30));
R.walk0 = await st(); await shot('walk_start');
await page.keyboard.press('KeyE'); await page.evaluate(() => GX.step(60));
R.inCab = await st(); await shot('walk_incab');
await page.keyboard.press('KeyE'); await page.evaluate(() => GX.step(240));
R.steppedDown = await st();
// a coach door on the viaduct: stand beside coach 3's A door, climb in, walk along the aisle
R.coach = await page.evaluate(() => {
  const a = GX.app, T = GX.THREE, c = a.train.coaches[2], lay = c.lay;
  const p = c.lod.localToWorld(new T.Vector3(lay.halfW + 0.6, 0, lay.z(lay.doors.A))), side = c.lod.localToWorld(new T.Vector3(-1, 0, 0)).sub(c.lod.localToWorld(new T.Vector3()));
  GX.teleport(p.x, p.y + 0.5, p.z, Math.atan2(-side.x, -side.z)); GX.step(240);
  const before = c.lod.worldToLocal(a.walker.feet.clone()), offer = a.boardingOffer()?.label;
  a.board(); GX.step(30);
  const inside = c.lod.worldToLocal(a.walker.feet.clone());
  // step in off the threshold, then turn towards the middle of the coach and walk down it
  GX.walk(1, 0, 0.5);
  const mid = Math.sign(-lay.z(lay.doors.A)) || -1, fwd = c.lod.localToWorld(new T.Vector3(0, 0, mid)).sub(c.lod.localToWorld(new T.Vector3()));
  GX.walk(0, 0, 0.01, Math.atan2(-fwd.x, -fwd.z)); GX.walk(1, 0, 4);
  const along = c.lod.worldToLocal(a.walker.feet.clone());
  return { number: c.number, offer, beforeY_local: +before.y.toFixed(2), insideY_local: +inside.y.toFixed(2), x_local: +inside.x.toFixed(2), walkedAlong_m: +Math.abs(along.z - inside.z).toFixed(1), stillInsideY: +along.y.toFixed(2) };
});
await shot('walk_coach');
R.selectOption = await page.evaluate(() => { const o = document.querySelector('#weather option'), cs = getComputedStyle(o); return { bg: cs.backgroundColor, color: cs.color }; });
R.pass = R.opening.camToEngine_m < 60 && R.zoom8notches.camToEngine_m < R.opening.camToEngine_m * 0.4 && !!R.walk0.button && R.inCab.feet[1] > R.walk0.feet[1] + 1 && R.inCab.offer === 'Step down' && R.steppedDown.feet[1] < R.inCab.feet[1] - 1 && Math.abs(R.coach.insideY_local - 1.27) < 0.05 && R.coach.walkedAlong_m > 3;
R.errors = errors;
console.log(JSON.stringify(R, null, 1));
await b.close(); server.close();
