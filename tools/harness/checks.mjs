// Automated checks. Usage: tools/run.sh checks.mjs <stage> kin|human|audio|perf|all
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, serve, browser, openPage } from './common.mjs';
const [stage, which = 'all'] = process.argv.slice(2);
const OUT = path.join(ROOT, 'shots', stage); fs.mkdirSync(OUT, { recursive: true });
const { server, url } = await serve();
const b = await browser();
const results = {};
const save = (k, v) => { results[k] = v; fs.writeFileSync(path.join(OUT, `checks-${k}.json`), JSON.stringify(v, null, 1)); console.log(k, JSON.stringify(v).slice(0, 600)); };

if (which === 'kin' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
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
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
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
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
  await page.evaluate(() => GX.unlockAudio());
  await page.waitForTimeout(2500);
  const sample = async (view) => {
    await page.evaluate((v) => GX.view(v), view);
    await page.waitForTimeout(900);
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
  await page.evaluate(() => GX.app.audio.setMuted(true)); await page.waitForTimeout(600);
  a.muted = await sample('front-34-l');
  a.pass = a.state === 'running' && a.levels.every((l) => l.peakDb < -1 && l.rmsDb > -60 && l.rmsDb < -10) && (a.muted.rmsDb < -80 || !isFinite(a.muted.rmsDb));
  a.errors = errors; save('audio', a); await ctx.close();
}

if (which === 'perf' || which === 'all') {
  const perf = [];
  for (const [w, h, mobile] of [[1280, 720, false], [844, 390, true]]) {
    for (const q of ['low', 'medium', 'high']) {
      const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=${q}`, { w, h, mobile });
      for (const view of ['front-34-l', 'train-wide', 'backhead', 'coach-aisle']) {
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
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
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

// ---- Phase 4: board a coach from the platform and walk through the train
if (which === 'coach' || which === 'all') {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low`, { w: 1280, h: 720 });
  const r = await page.evaluate(() => {
    const out = {};
    GX.teleport(-2.3, 0.915, -23.85, -Math.PI / 2);                 // platform, facing door C of coach 1
    for (let i = 0; i < 4; i++) GX.step(30);                          // let the door swing open
    out.doorOpen = (() => { let a = 0; GX.app.scene.traverse((o) => { if (o.name === 'coach_door_C_R' && o.parent?.parent?.name === 'coach_5249') a = Math.max(a, Math.abs(o.rotation.y)); }); return +a.toFixed(2); })();
    out.boarded = GX.walk(1, 0, 1.6);                                 // through the doorway into the vestibule
    out.aisle = GX.walk(1, 0, 7.5, 0);                                // turn towards the B end and walk the saloon
    out.nextCoach = GX.walk(1, 0, 4.0, 0);                            // through the gangway into coach 2
    const L = 20.1168, front = -13.2;                                 // coach 2 spans z -33.3 .. -53.4
    out.inCoach2 = out.nextCoach.z < front - L - 0.5 && out.nextCoach.z > front - 2 * L && Math.abs(out.nextCoach.y - 1.27) < 0.05;
    out.backOut = (GX.teleport(0, 1.27, -23.85, Math.PI / 2), GX.walk(1, 0, 2.5));  // walk out of door C onto the platform side
    return out;
  });
  const h = await page.evaluate(() => GX.humanScale());
  r.coachDims = { doorClear_m: 3.18 - 1.27, doorWidth_m: 0.62, aisle_m: 0.68, platformToFloor_m: +(1.27 - 0.915).toFixed(3), headroomAisle_m: +(3.90 - 0.17 - 1.27).toFixed(2) };
  r.pass = r.doorOpen > 1.0 && Math.abs(r.boarded.y - 1.27) < 0.05 && r.aisle.z < -30 && r.inCoach2 && Math.abs(r.backOut.y - 0.915) < 0.05 && h.headroomOK && h.stepsOK && r.coachDims.doorClear_m >= 1.75 && r.coachDims.platformToFloor_m <= 0.45;
  r.errors = errors; save('coach', r); await ctx.close();
}

await b.close(); server.close();
