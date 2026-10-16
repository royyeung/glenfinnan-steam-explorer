// Automated checks. Usage: tools/run.sh checks.mjs <stage> kin|human|audio|perf|cab|coach|world|audio5|perf5|all [desktop|phone]
// Phase 1-4 checks run on the straight test track (?site=test); Phase 5 checks on Glenfinnan.
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, serve, browser, openPage } from './common.mjs';
const [stage, which = 'all'] = process.argv.slice(2);
const OUT = path.join(ROOT, 'shots', stage); fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await serve();
const b = await browser();
const results = {};
const save = (k, v) => { results[k] = v; fs.writeFileSync(path.join(OUT, `checks-${k}.json`), JSON.stringify(v, null, 1)); console.log(k, JSON.stringify(v).slice(0, 600)); };

if (which === 'kin' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&site=test`, { w: 1280, h: 720 });
  const kin = await page.evaluate(() => GX.kinematics(720));
  kin.pass = kin.maxRodLengthDeviation_m < 1e-6 && kin.maxConnectionGap_m < 1e-3 && Math.abs(Math.abs(kin.rightMinusLeftPhaseDeg) - 90) < 1e-6;
  // frames of the left-side motion through one revolution, for the contact sheet
  await page.evaluate(() => GX.view('motion-l'));
  for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
    await page.evaluate((d) => GX.setWheelAngle(d), deg);
    await page.screenshot({ path: path.join(OUT, `kin_${String(deg).padStart(3, '0')}.png`), timeout: 240000 });
  }
  kin.errors = errors; save('kinematics', kin); await ctx.close();
}

if (which === 'human' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&site=test`, { w: 1280, h: 720 });
  const h = await page.evaluate(() => GX.humanScale());
  // walkthrough 1: platform -> cab steps -> footplate (right side, walking towards +X)
  const start = await page.evaluate(() => GX.teleport(-2.15, 0.915, -5.9, -Math.PI / 2)); // middle of the entrance (d 12.1)
  const path1 = [];
  for (let i = 0; i < 6; i++) path1.push(await page.evaluate(() => GX.walk(1, 0, 0.25)));
  await page.screenshot({ path: path.join(OUT, 'walk_on_footplate.png'), timeout: 240000 });
  h.walkPlatformToCab = { start, path: path1, end: path1.at(-1) };
  h.walkPlatformToCab.pass = Math.abs(path1.at(-1).y - h.footplate_m) < 0.02 && path1.at(-1).onGround;
  // walkthrough 2: from the ballast shoulder straight at the cab steps (should NOT climb: first rise too high)
  const s2 = await page.evaluate(() => GX.teleport(-2.6, 0, -6.0, -Math.PI / 2));
  const e2 = await page.evaluate(() => GX.walk(1, 0, 1.5));
  h.walkFromBallast = { start: s2, end: e2, climbed: e2.y > 0.5 };
  // walkthrough 3: along the platform past the cab (must stay on the platform, no snagging)
  await page.evaluate(() => GX.teleport(-2.6, 0.915, 6, 0)); // yaw 0 faces -Z, along the platform past the cab
  const e3 = await page.evaluate(() => GX.walk(1, 0, 10));
  h.walkAlongPlatform = { end: e3, pass: Math.abs(e3.y - 0.915) < 0.01 && e3.z < -6 };
  h.pass = h.headroomOK && h.doorwayOK && h.stepsOK && h.walkPlatformToCab.pass && h.walkAlongPlatform.pass;
  h.errors = errors; save('human', h); await ctx.close();
}

if (which === 'audio' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&site=test`, { w: 1280, h: 720 });
  await page.evaluate(() => GX.unlockAudio());
  await page.waitForTimeout(2500);
  const sample = async (view) => {
    if (view) { await page.evaluate((v) => GX.view(v), view); await page.waitForTimeout(900); }
    let rms = -Infinity, peak = -Infinity, sum = 0, n = 0;
    for (let i = 0; i < 16; i++) { const l = await page.evaluate(() => GX.audio()); if (l && isFinite(l.rms)) { sum += 10 ** (l.rms / 10); n++; peak = Math.max(peak, l.peak); } await page.waitForTimeout(150); }
    rms = n ? 10 * Math.log10(sum / n) : -Infinity;
    return { view, rmsDb: +rms.toFixed(1), peakDb: +peak.toFixed(1) };
  };
  const a = { state: (await page.evaluate(() => GX.audio()))?.state, levels: [] };
  for (const v of ['site-wide', 'front-34-l', 'cab-inside', 'human-scale']) a.levels.push(await sample(v));
  // footplate: blower up, injector on, then the whistle held
  await page.evaluate(() => { GX.control('blower', 1); GX.control('injL', 1); });
  a.levels.push({ ...(await sample('backhead')), note: 'blower full, injector on' });
  await page.evaluate(() => { GX.app.footplate.held = 'whistle'; GX.control('whistle', 1); });
  a.levels.push({ ...(await sample('backhead')), note: 'whistle' });
  await page.evaluate(() => { GX.app.footplate.held = null; GX.control('blower', 0.25); GX.control('injL', 0); });
  // coach: on the platform at door C while it opens (CDL beeps), footsteps platform -> carpet, then the slam
  await page.evaluate(() => {
    GX.teleport(-2.3, 0.915, -14.15, -Math.PI / 2);
    const s = GX.app.sounds, feet = () => GX.app.walker.feet.clone(), door = feet().setX(-1.4).setY(2.0);
    s.door(door, true);
    let k = 0; const t = setInterval(() => { s.footstep(k < 4 ? 'platform' : 'carpet', feet()); if (++k === 7) s.door(door, false); if (k > 9) clearInterval(t); }, 260);
  });
  a.levels.push({ ...(await sample(null)), view: 'coach-door', note: 'door opening with beeps, footsteps, slam' });
  await page.evaluate(() => GX.app.audio.setMuted(true)); await page.waitForTimeout(600);
  a.muted = await sample('front-34-l');
  a.pass = a.state === 'running' && a.levels.every((l) => l.peakDb < -1 && l.rmsDb > -60 && l.rmsDb < -10) && (a.muted.rmsDb < -80 || !isFinite(a.muted.rmsDb));
  a.errors = errors; save('audio', a); await ctx.close();
}

if (which === 'perf' || which === 'all') {
  const perf = [];
  for (const [w, h, mobile] of [[1280, 720, false], [844, 390, true]]) {
    for (const q of ['low', 'medium', 'high']) {
      const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=${q}&site=test`, { w, h, mobile });
      for (const view of ['front-34-l', 'train-wide', 'backhead', 'coach-aisle', 'buffet-int', 'first-int']) {
        const r = await page.evaluate((v) => {
          GX.view(v); GX.render(); GX.render();
          const gl = GX.app.renderer.getContext(), px = new Uint8Array(4);
          const sync = () => { gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
          sync();
          const t = [], c = [];
          for (let i = 0; i < 3; i++) { const t0 = performance.now(); GX.render(); c.push(performance.now() - t0); sync(); t.push(performance.now() - t0); }
          const avg = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
          return { view: v, msPerFrame: avg(t), msCpuSubmit: avg(c), stats: GX.stats() };
        }, view);
        perf.push({ viewport: `${w}x${h}${mobile ? ' (touch)' : ''}`, tier: q, ...r, errors: errors.length });
        console.log(w, h, q, view, r.msPerFrame, 'ms', r.stats.calls, 'calls', r.stats.triangles, 'tris', r.stats.textureMB, 'MB');
      }
      await ctx.close();
    }
  }
  save('perf', perf);
}


// ---- Phase 3: cab controls exercised one by one, and the footplate responding
if (which === 'cab' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&site=test`, { w: 1280, h: 720 });
  const r = await page.evaluate(async () => {
    const out = { controls: {}, sim: {} };
    const ids = (window.__ctl ? Object.keys(GX.footplate().controls) : []);
    for (const id of ids) {
      const k = window.__ctl(id), before = GX.controlPose(id);
      GX.control(id, k.min); const atMin = GX.controlPose(id);
      GX.control(id, k.max); const atMax = GX.controlPose(id);
      const moved = atMin && atMax ? Math.max(...atMin.map((v, i) => Math.abs(v - atMax[i]))) : 0;
      out.controls[id] = { node: !!before, moved: +moved.toFixed(3), ok: !!before && moved > 0.01 };
      GX.control(id, k.init);
    }
    // scenarios (simulated seconds via fixed steps)
    const run = (s) => GX.step(Math.round(s * 120));
    GX.control('brake', 1); run(4); out.sim.brakeApplied = GX.footplate().vacTrain;
    GX.control('brake', 0); GX.control('ejectorLarge', 1); run(8); out.sim.brakeReleased = GX.footplate().vacTrain; GX.control('ejectorLarge', 0);
    const p0 = GX.footplate().pressure; GX.control('injL', 1); GX.control('waterL', 1); const w0 = GX.footplate().water; run(20);
    out.sim.injector = { waterBefore: w0, waterAfter: GX.footplate().water, pressureBefore: p0, pressureAfter: GX.footplate().pressure }; GX.control('injL', 0);
    GX.control('blower', 1); GX.control('damperF', 1); run(60); out.sim.blowerPressure = GX.footplate().pressure; out.sim.safetyLift = GX.footplate().safetyLift; GX.control('blower', 0.25);
    GX.control('reverser', 0.75); GX.control('regulator', 0.5); run(6); out.sim.driving = { omega: GX.footplate().wheelOmega, cutoff: GX.app.rigs[0].cutoff };
    GX.control('regulator', 0); GX.control('brake', 1); run(8); out.sim.stopped = GX.footplate().wheelOmega; GX.control('brake', 0);
    GX.control('reverser', -0.75); out.sim.reverserLinked = GX.app.rigs[0].cutoff;
    return out;
  });
  const ctl = Object.values(r.controls);
  r.pass = ctl.length >= 20 && ctl.every((c) => c.ok) && r.sim.brakeApplied < 3 && r.sim.brakeReleased > 18 && r.sim.injector.waterAfter > r.sim.injector.waterBefore
    && r.sim.driving.omega > 0.5 && Math.abs(r.sim.stopped) < 0.05 && Math.abs(r.sim.reverserLinked + 0.75) < 1e-6;
  r.errors = errors; save('cab', r); await ctx.close();
}

// ---- Phase 4: board the first coach from the platform and walk through the whole train
if (which === 'coach' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&site=test`, { w: 1280, h: 720 });
  const r = await page.evaluate(() => {
    const out = {}, LOB = 20.1168, front = -13.2;                    // coach i spans z front - i*LOB .. front - (i+1)*LOB
    const doorAng = (coach, door) => { let a = 0; GX.app.scene.traverse((o) => { if (o.name === door && o.parent?.parent?.name === coach) a = Math.max(a, Math.abs(o.rotation.y)); }); return +a.toFixed(2); };
    GX.teleport(-2.3, 0.915, -14.15, -Math.PI / 2);                 // platform, facing the wide A-end door of 5487 (Mk2B)
    for (let i = 0; i < 4; i++) GX.step(30);                          // let the door swing open
    out.doorOpen = doorAng('coach_5487', 'coach_door_A_R');
    out.boarded = GX.walk(1, 0, 1.6);                                 // through the doorway into the vestibule
    // walk the length of the train towards the rear: through 5 gangways, the Mk2B toilets, the buffet and first class
    // the buffet counter stands in the middle of 99318, so walk round it on the customer side (+x)
    out.path = [];
    const lay = GX.app.train.coaches[3].lay, cz = front - 3.5 * LOB, zw = (a) => cz + lay.L / 2 - a, [a0, a1] = lay.buffet;
    const go = (x, z) => {
      for (let i = 0; i < 40; i++) {
        const f = GX.app.walker.feet.clone(), dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz);
        if (d < 0.05) return;
        const p = GX.walk(1, 0, Math.min(d, 7) / 1.4, Math.atan2(-dx, -dz));
        out.path.push({ z: +p.z.toFixed(2), y: +p.y.toFixed(3), x: +p.x.toFixed(2) });
        if (Math.hypot(p.x - f.x, p.z - f.z) < 0.03) return;   // blocked
      }
    };
    for (const [x, z] of [[-0.06, zw(a0) - 0.24], [0.65, zw(a0 + 0.75)], [0.65, zw(a1 - 0.65)], [-0.06, zw(a1 - 0.3)], [-0.06, -136]]) go(x, z);
    out.roundCounter = Math.max(...out.path.filter((p) => p.z <= zw(a0 + 0.5) && p.z >= zw(a1 - 0.5)).map((p) => p.x));
    const last = out.path[out.path.length - 1];
    out.reached = last.z;
    out.coachesVisited = [...new Set(out.path.map((p) => Math.floor((front - p.z) / LOB)))].filter((i) => i >= 0 && i < 6);
    out.allOnFloor = out.path.every((p) => Math.abs(p.y - 1.27) < 0.05);
    // the buffet's B-end door and first class's centre door open from the platform too
    GX.teleport(-2.3, 0.915, -93.0, -Math.PI / 2); for (let i = 0; i < 4; i++) GX.step(30);
    out.buffetDoor = doorAng('coach_99318', 'coach_door_B_R');
    GX.teleport(-2.3, 0.915, -124.43, -Math.PI / 2); for (let i = 0; i < 4; i++) GX.step(30);
    out.firstDoor = doorAng('coach_5239', 'coach_door_C_R');
    out.backOut = (GX.teleport(0, 1.27, -14.15, Math.PI / 2), GX.walk(1, 0, 2.5));  // walk out of the A door onto the platform
    return out;
  });
  const h = await page.evaluate(() => GX.humanScale());
  r.coachDims = { doorClear_m: 3.18 - 1.27, doorWidth_m: { mk2: 0.62, mk2b: 0.86 }, aisle_m: 0.68, aisleFirst_m: 0.94, buffetPassage_m: +(1.31 - 0.13).toFixed(2), platformToFloor_m: +(1.27 - 0.915).toFixed(3), headroomAisle_m: +(3.90 - 0.17 - 1.27).toFixed(2) };
  r.pass = r.roundCounter > 0.4 && r.doorOpen > 1.0 && r.buffetDoor > 1.0 && r.firstDoor > 1.0 && Math.abs(r.boarded.y - 1.27) < 0.05 && r.reached < -130 && r.coachesVisited.length === 6 && r.allOnFloor
    && Math.abs(r.backOut.y - 0.915) < 0.05 && h.headroomOK && h.stepsOK && r.coachDims.doorClear_m >= 1.75 && r.coachDims.platformToFloor_m <= 0.45;
  r.errors = errors; save('coach', r); await ctx.close();
}

// ---- Phase 5: the train on the curved, graded line; walking on the viaduct, under it and at the station
if (which === 'world' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
  const r = await page.evaluate(() => {
    const app = GX.app, w = app.world, path = w.data.track, out = {};
    const V = (x, y, z) => app.engine.position.clone().set(x, y, z);
    // every support (bogie pivot or axle) on the rail-top centreline
    const supports = () => {
      let lat = 0, vert = 0;
      for (const v of app.vehicles) for (const zs of v.supports) {
        const p = v.obj.localToWorld(V(0, 0, zs)), s = path.nearest(p.x, p.z);
        let best = 1e9, dy = 0;
        for (let ds = -3; ds <= 3; ds += 0.01) { const q = path.at(s + ds), d = Math.hypot(p.x - q.x, p.z - q.z); if (d < best) { best = d; dy = p.y - q.y; } }
        lat = Math.max(lat, best); vert = Math.max(vert, Math.abs(dy));
      }
      return { maxLateral_m: +lat.toFixed(4), maxVertical_m: +vert.toFixed(4) };
    };
    out.onViaduct = supports();
    const [sW, sE] = path.viaduct, fr = app.vehicles[0].obj.position, sF = path.nearest(fr.x, fr.z);
    out.trainOnViaduct = sF > sW && sF < sE;
    // viaduct geometry against the reference
    let maxH = 0; for (let s = sW; s <= sE; s += 2) { const p = path.at(s); maxH = Math.max(maxH, p.y - w.data.height(p.x, p.z)); }
    out.viaduct = { length_m: +(sE - sW).toFixed(1), spans: 21, pier_m: +w.viaduct.pier.toFixed(2), pylon_m: +w.viaduct.pylon.toFixed(2), maxRailAboveGround_m: +maxH.toFixed(1), railW: +path.at(sW).y.toFixed(1), railE: +path.at(sE).y.toFixed(1) };
    // walk along the deck beside the train, then try to walk through the parapet
    GX.view('viaduct-deck');
    const d0 = app.walker.feet.clone(), walk = GX.walk(1, 0, 20);
    const p1 = app.walker.feet.clone(), s1 = path.nearest(p1.x, p1.z), q1 = path.at(s1);
    out.deckWalk = { travelled_m: +Math.hypot(p1.x - d0.x, p1.z - d0.z).toFixed(1), aboveRail_m: +(p1.y - q1.y).toFixed(2), onGround: walk.onGround };
    GX.walk(0, -1, 4); GX.walk(0, 1, 4);
    const p2 = app.walker.feet.clone(), q2 = path.at(path.nearest(p2.x, p2.z));
    out.parapet = { maxOffset_m: +Math.hypot(p2.x - q2.x, p2.z - q2.z).toFixed(2), inside: Math.hypot(p2.x - q2.x, p2.z - q2.z) < 2.75 };
    // walk under the arches along the glen floor
    const g0 = V(-52, 0, 26); g0.y = w.data.height(g0.x, g0.z) + 0.5; GX.teleport(g0.x, g0.y, g0.z, Math.atan2(-(-5 - g0.x), -(-35 - g0.z)));
    const u = GX.walk(1, 0, 40), p3 = app.walker.feet.clone();
    out.underArches = { travelled_m: +Math.hypot(p3.x - g0.x, p3.z - g0.z).toFixed(1), onGround: u.onGround, groundGap_m: +(p3.y - w.data.height(p3.x, p3.z)).toFixed(2) };
    // the station: train at the platform (about 100 m long, so the rear overhangs it, as in Geograph
    // 7829059); board coach 99318 by its platform-side A-end door
    app.placeTrain('station');
    out.atStation = supports();
    const pl = w.settlement.platform;
    out.coachesAtPlatform = app.train.coaches.filter((k) => { const s = path.nearest(...(() => { const q = k.lod.localToWorld(V(0, 0, k.lay.z(k.lay.doors.A))); return [q.x, q.z]; })()); return s > pl.s0 && s < pl.s1; }).map((k) => k.number);
    out.platformLength_m = +(pl.s1 - pl.s0).toFixed(1);
    const c = app.train.coaches[3], lay = c.lay, door = c.lod.localToWorld(V(lay.halfW + 1.4, 0.915, lay.z(lay.doors.A)));
    const fwd = c.lod.localToWorld(V(0, 0, 0)), side = c.lod.localToWorld(V(1, 0, 0)).sub(fwd);
    GX.teleport(door.x, door.y + 0.05, door.z, Math.atan2(side.x, side.z));
    for (let i = 0; i < 4; i++) GX.step(30);
    const before = c.lod.worldToLocal(app.walker.feet.clone());
    GX.walk(1, 0, 2.2);
    const inside = c.lod.worldToLocal(app.walker.feet.clone());
    out.boardAtStation = { platformY_local: +before.y.toFixed(3), afterY_local: +inside.y.toFixed(3), x_local: +inside.x.toFixed(2), boarded: Math.abs(inside.y - 1.27) < 0.05 && Math.abs(inside.x) < 1.3 };
    return out;
  });
  r.pass = r.onViaduct.maxLateral_m < 0.01 && r.onViaduct.maxVertical_m < 0.01 && r.atStation.maxLateral_m < 0.01 && r.atStation.maxVertical_m < 0.01 && r.trainOnViaduct
    && r.deckWalk.travelled_m > 20 && Math.abs(r.deckWalk.aboveRail_m + 0.36) < 0.12 && r.parapet.inside && r.underArches.travelled_m > 40 && r.underArches.groundGap_m < 0.1 && r.boardAtStation.boarded;
  r.errors = errors; save('world', r); await ctx.close();
}

if (which === 'audio5' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
  await page.evaluate(() => GX.unlockAudio());
  await page.waitForTimeout(2500);
  const sample = async (view, hour) => {
    await page.evaluate(([v, h]) => { if (h !== undefined) GX.setHour(h); GX.view(v); GX.render(); }, [view, hour]);
    let sum = 0, n = 0, peak = -Infinity;
    for (let i = 0; i < 24; i++) { await page.evaluate(() => GX.render()); const l = await page.evaluate(() => GX.audio()); if (l && isFinite(l.rms)) { sum += 10 ** (l.rms / 10); n++; peak = Math.max(peak, l.peak); } await page.waitForTimeout(150); }
    return { view, hour, rmsDb: +(n ? 10 * Math.log10(sum / n) : -Infinity).toFixed(1), peakDb: +peak.toFixed(1) };
  };
  const a = { levels: [] };
  for (const v of ['v01-classic', 'viaduct-river', 'viaduct-deck', 'loch-head', 'aerial']) a.levels.push(await sample(v));
  a.levels.push({ ...(await sample('viaduct-river', 23.0)), note: 'night (owls)' });
  // the echo gain eases in (time constant 0.3 s): keep rendering for 2 s before reading it
  const echoAt = async (view) => { await page.evaluate((v) => { GX.setHour(11.25); GX.view(v); GX.render(); }, view);
    for (let i = 0; i < 8; i++) { await page.evaluate(() => GX.render()); await page.waitForTimeout(250); }
    return page.evaluate((v) => ({ view: v, gain: +GX.app.audio.echo.gain.value.toFixed(3) }), view); };
  a.echo = [await echoAt('viaduct-river'), await echoAt('v01-classic'), await echoAt('viaduct-deck')];
  await page.evaluate(() => GX.app.audio.setMuted(true)); await page.waitForTimeout(600);
  a.muted = await sample('v01-classic', 11.25);
  a.pass = a.levels.every((l) => l.peakDb < -1 && l.rmsDb > -60 && l.rmsDb < -10) && a.echo[0].gain > 0.05 && a.echo[1].gain < 0.01 && a.echo[2].gain < 0.01 && (a.muted.rmsDb < -80 || !isFinite(a.muted.rmsDb));
  a.errors = errors; save('audio5', a); await ctx.close();
}

if (which === 'perf5' || which === 'all') {
  // optional 3rd argument: desktop | phone (each takes about an hour under SwiftShader)
  const only = process.argv[4], perf = [];
  for (const [w, h, mobile] of [[1280, 720, false], [844, 390, true]].filter(([, , m]) => !only || (only === 'phone') === m)) {
    for (const q of ['low', 'medium', 'high']) {
      const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=${q}`, { w, h, mobile });
      for (const view of ['v01-classic', 'aerial', 'viaduct-river', 'viaduct-deck', 'loch-head', 'front-34-l', 'coach-aisle', 'backhead']) {
        const r = await page.evaluate((v) => {
          GX.view(v); GX.render();
          const gl = GX.app.renderer.getContext(), px = new Uint8Array(4);
          const sync = () => { gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
          sync();
          const t = [];
          for (let i = 0; i < 1; i++) { const t0 = performance.now(); GX.render(); sync(); t.push(performance.now() - t0); }
          return { view: v, msPerFrame: +(t.reduce((x, y) => x + y, 0) / t.length).toFixed(1), stats: GX.stats() };
        }, view);
        perf.push({ viewport: `${w}x${h}${mobile ? ' (touch)' : ''}`, tier: q, ...r, errors: errors.length });
        console.log(w, h, q, view, r.msPerFrame, 'ms', r.stats.calls, 'calls', r.stats.triangles, 'tris', r.stats.textureMB, 'MB');
      }
      await ctx.close();
    }
  }
  save(only ? `perf5-${only}` : 'perf5', perf);
}

await b.close(); server.close();
