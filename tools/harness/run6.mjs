// Phase 6 checks: the train running at Glenfinnan.
// Usage: tools/run.sh run6.mjs <stage> beats|cross|ride|audio|shots|smoke|all [low|medium|high]
//   beats  exhaust beats in phase with the wheels at any speed and cut-off (valve at release), 4 per
//          revolution, and the sounds scheduled at exactly the beat times
//   cross  crossing time of the viaduct matches the chosen speed (automatic driver)
//   ride   standing and walking in a moving coach and cab: carried with the train
//   audio  levels while running (lineside, deck, cab, coach, station): no clipping, sound present, muted silent
//   shots  screenshots while running, with draw calls and triangles
import { serve, browser, openPage } from './common.mjs';
import fs from 'node:fs';
const out = process.argv[2] || 'p6', which = process.argv[3] || 'all', tier = process.argv[4] || 'low';
fs.mkdirSync(`/w/shots/${out}`, { recursive: true });
const save = (n, o) => { fs.writeFileSync(`/w/shots/${out}/checks-${n}.json`, JSON.stringify(o, null, 1)); console.log(n, JSON.stringify(o).slice(0, 600)); };
const { server, url } = await serve(); const b = await browser();
const want = (k) => which === k || which === 'all';

if (want('smoke')) {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&run=1&hud`, { w: 1280, h: 720 });
  const r = await page.evaluate(() => { GX.view('train-glen'); const a = GX.runState(); GX.sim(120 * 8); const c = GX.runState(); GX.render(); return { a, c }; });
  await page.screenshot({ path: `/w/shots/${out}/smoke.png`, timeout: 400000 });
  save('smoke', { ...r, errors }); await ctx.close();
}

if (want('beats')) {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&run=1`, { w: 640, h: 360 });
  await page.evaluate(() => GX.unlockAudio()); await page.waitForTimeout(1500);
  const rows = [];
  for (const [v, cut] of [[0.5, 0.75], [2.2, 0.75], [4.47, 0.6], [11.2, 0.35], [20, 0.3], [31.3, 0.25], [11.2, -0.6]]) {
    const r = await page.evaluate(([v, cut]) => {
      GX.run({ on: true, place: 'viaduct', hold: Math.abs(v) * Math.sign(cut) });
      GX.app.footplate.c.reverser = cut; GX.sim(240); GX.beatTrace(); const log0 = GX.beatLog().length;
      const th0 = GX.app.theta, t0 = GX.app.simTime, batches = [];
      let worstValve = 0, worstTheta = 0, worstAudio = 0, n = 0;
      for (let k = 0; k < 60; k++) {
        const before = GX.app.sounds.beatCount; GX.sim(6);
        const tr = GX.beatTrace(), added = GX.app.sounds.beatCount - before, log = added ? GX.app.sounds.beatLog.slice(-added) : [];
        for (const e of tr) {
          n++;
          const valve = GX.valveAt(e.theta, cut)[e.side];
          worstValve = Math.max(worstValve, Math.abs(valve));
          const thAt = th0 + (Math.abs(v) * Math.sign(cut) / (1.8288 / 2)) * (e.simT - t0);
          worstTheta = Math.max(worstTheta, Math.abs(thAt - e.theta));
        }
        // the sounds: same spacing as the beats (audio time - beat time constant within a batch)
        if (log.length === tr.length && tr.length > 1) { const off = log.map((a, i) => a - tr[i].simT); worstAudio = Math.max(worstAudio, Math.max(...off) - Math.min(...off)); }
        if (log.length !== tr.length) batches.push({ k, beats: tr.length, sounds: log.length });
      }
      const revs = Math.abs(GX.app.theta - th0) / (2 * Math.PI);
      return { v_ms: v, mph: +(v / 0.44704).toFixed(1), cutoff: cut, beats: n, revolutions: +revs.toFixed(3), beatsPerRev: +(n / revs).toFixed(2), worstValveAtBeat_mm: +(worstValve * 1000).toFixed(4), worstAngleDeg: +(worstTheta * 180 / Math.PI).toFixed(4), worstSoundTiming_ms: +(worstAudio * 1000).toFixed(3), mismatchedBatches: batches.length };
    }, [v, cut]);
    r.pass = r.worstValveAtBeat_mm < 0.05 && r.worstAngleDeg < 0.05 && r.worstSoundTiming_ms < 1 && r.mismatchedBatches === 0 && Math.abs(r.beatsPerRev - 4) < 4 / Math.max(1, r.revolutions) + 0.05;
    rows.push(r);
  }
  save('beats', { rows, pass: rows.every((r) => r.pass), errors }); await ctx.close();
}

if (want('cross')) {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&run=1`, { w: 640, h: 360 });
  const rows = [];
  for (const mph of [5, 10, 15, 20]) {
    const r = await page.evaluate((mph) => {
      const st = GX.runState(), [vW, vE] = st.viaduct, L = st.length;
      GX.run({ on: true, hold: null, auto: true, mph, s: vE + 500, v: 25 * 0.44704 });
      let tIn = null, tOut = null, vMin = 99, vMax = 0;
      for (let k = 0; k < 4000 && tOut === null; k++) {
        GX.sim(12); const s = GX.runState();
        if (tIn === null && s.s <= vE) tIn = s.simTime;
        if (tIn !== null) { vMin = Math.min(vMin, s.v); vMax = Math.max(vMax, s.v); }
        if (tIn !== null && s.s + L <= vW) tOut = s.simTime;
      }
      const expect = (vE - vW + L) / (mph * 0.44704);
      return { mph, viaduct_m: +(vE - vW).toFixed(1), train_m: +L.toFixed(1), crossing_s: +(tOut - tIn).toFixed(1), expected_s: +expect.toFixed(1), ratio: +((tOut - tIn) / expect).toFixed(4), vMin_mph: +(vMin / 0.44704).toFixed(2), vMax_mph: +(vMax / 0.44704).toFixed(2) };
    }, mph);
    r.pass = Math.abs(r.ratio - 1) < 0.03;
    rows.push(r);
  }
  // the whole automatic run: viaduct, station stop, away west, round again
  const loop = await page.evaluate(() => {
    GX.run({ on: true, auto: true, mph: 10, place: 'viaduct' }); GX.app.run.placeAt(GX.app.world.places.viaduct, false);
    let stoppedAt = null, restarted = false, maxA = 0; const s0 = GX.app.run.s, stop = GX.app.run.route.stop; let prev = s0, standingSince = null, dwell = null;
    for (let k = 0; k < 1500; k++) {
      GX.sim(60); const r = GX.app.run; maxA = Math.max(maxA, Math.abs(r.a));
      if (stoppedAt === null && r.state === 'standing') { stoppedAt = r.s; standingSince = GX.app.simTime; }
      if (standingSince !== null && dwell === null && r.state !== 'standing') dwell = GX.app.simTime - standingSince;
      if (r.s > prev + 100) { restarted = true; break; }
      prev = r.s;
    }
    return { stopError_m: stoppedAt === null ? null : +(stoppedAt - stop).toFixed(2), dwell_s: dwell === null ? null : +dwell.toFixed(1), restartedEast: restarted, maxAccel_ms2: +maxA.toFixed(3), simTime: +GX.app.simTime.toFixed(0) };
  });
  loop.pass = loop.stopError_m !== null && Math.abs(loop.stopError_m) < 2 && loop.restartedEast && loop.maxAccel_ms2 < 0.95;
  save('cross', { rows, loop, pass: rows.every((r) => r.pass) && loop.pass, errors }); await ctx.close();
}

if (want('ride')) {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&run=1`, { w: 640, h: 360 });
  const r = await page.evaluate(() => {
    const app = GX.app, T = GX.THREE, res = {};
    GX.run({ on: true, place: 'viaduct', hold: 6 });
    // standing in coach 5419's aisle while the train runs 8 s (48 m)
    const c = app.train.coaches[2], lay = c.lay, p = c.lod.localToWorld(new T.Vector3(0, 1.27, lay.z(8)));
    GX.teleport(p.x, p.y + 0.05, p.z, 0); GX.sim(10);
    const l0 = c.lod.worldToLocal(app.walker.feet.clone()), w0 = app.walker.feet.clone();
    GX.sim(960);
    const l1 = c.lod.worldToLocal(app.walker.feet.clone());
    res.coachStand = { worldMoved_m: +app.walker.feet.distanceTo(w0).toFixed(2), driftInCoach_m: +l1.distanceTo(l0).toFixed(4), yLocal: +l1.y.toFixed(3) };
    // walking along the aisle while it runs
    const f = c.lod.localToWorld(new T.Vector3(0, 0, -1)).sub(c.lod.localToWorld(new T.Vector3()));
    app.walker.yaw = Math.atan2(-f.x, -f.z); app.inputs.enabled = true; app.inputs.keys.add('KeyW');  // W held for 3 s
    GX.sim(360);
    app.inputs.keys.delete('KeyW');
    const l2 = c.lod.worldToLocal(app.walker.feet.clone());
    res.coachWalk = { walkedAlong_m: +Math.abs(l2.z - l1.z).toFixed(2), yLocal: +l2.y.toFixed(3), xLocal: +l2.x.toFixed(3) };
    // on the footplate
    GX.run({ hold: 0 }); GX.sim(5);
    GX.view('cab-entry'); app.board(); GX.sim(30);
    const e0 = app.engine.worldToLocal(app.walker.feet.clone()); GX.run({ hold: 8 }); GX.sim(600);
    const e1 = app.engine.worldToLocal(app.walker.feet.clone());
    res.cab = { onFootplate: e0.y > 1.5, drift_m: +e1.distanceTo(e0).toFixed(4) };
    // doors are locked while moving: no "step down" offered
    const off = app.boardingOffer(); res.doorsLockedWhileMoving = (off === null || off.locked === true) && app.board() === false; res.offerWhileMoving = off?.label ?? null;
    return res;
  });
  r.pass = r.coachStand.worldMoved_m > 40 && r.coachStand.driftInCoach_m < 0.02 && Math.abs(r.coachStand.yLocal - 1.27) < 0.02 && r.coachWalk.walkedAlong_m > 3.5 && Math.abs(r.coachWalk.yLocal - 1.27) < 0.02 && r.cab.onFootplate && r.cab.drift_m < 0.02 && r.doorsLockedWhileMoving;
  save('ride', { ...r, errors }); await ctx.close();
}

if (want('audio')) {
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=low&run=1`, { w: 640, h: 360 });
  await page.evaluate(() => GX.unlockAudio()); await page.waitForTimeout(2000);
  // run the simulation in real time (no rendering) while sampling the output
  const sample = async (label, setup) => {
    await page.evaluate(setup);
    let last = Date.now(), sum = 0, n = 0, peak = -Infinity;
    for (let i = 0; i < 70; i++) {
      await page.waitForTimeout(60);
      const now = Date.now(), steps = Math.max(1, Math.min(14, Math.round((now - last) * 0.12))); last = now;
      const l = await page.evaluate((k) => { GX.tick(k); return GX.audio(); }, steps);
      if (i > 15 && l && isFinite(l.rms)) { sum += 10 ** (l.rms / 10); n++; peak = Math.max(peak, l.peak); }
    }
    const st = await page.evaluate(() => ({ status: GX.app.run.status, v: +GX.app.speed.toFixed(2), where: GX.app.audio.enclosure }));
    return { label, ...st, rmsDb: +(n ? 10 * Math.log10(sum / n) : -Infinity).toFixed(1), peakDb: +peak.toFixed(1) };
  };
  const a = { levels: [] };
  a.levels.push(await sample('under the arches, train crossing at 10 mph', () => { GX.app.followTrain = false; GX.run({ on: true, place: 'viaduct', hold: 4.47 }); GX.view('viaduct-river'); }));
  a.levels.push(await sample('on the viaduct deck as the train passes', () => { GX.run({ s: GX.runState().viaduct[0] + 260, v: 4.47, hold: 4.47 }); GX.view('viaduct-deck'); }));
  a.levels.push(await sample('in the cab at 25 mph', () => { GX.run({ place: 'viaduct', hold: 0 }); GX.view('cab-inside'); GX.run({ hold: 11.2 }); }));
  a.levels.push(await sample('in coach 5419 at 25 mph', () => { GX.run({ place: 'viaduct', hold: 0 }); GX.view('coach-aisle'); GX.run({ hold: 11.2 }); }));
  a.levels.push(await sample('accelerating hard from the station (automatic)', () => { GX.run({ place: 'station', hold: null, auto: true }); GX.app.run.timer = 0.5; GX.view('station-platform'); }));
  a.levels.push(await sample('on the footplate, whistle', () => { GX.run({ place: 'viaduct', hold: 0 }); GX.view('cab-inside'); GX.run({ hold: 4.47 }); GX.app.footplate.held = 'whistle'; GX.app.footplate.c.whistle = 1; }));
  await page.evaluate(() => { GX.app.footplate.held = null; GX.app.audio.setMuted(true); });
  a.muted = await sample('muted, in the cab', () => {});
  a.pass = a.levels.every((l) => l.peakDb < -1 && l.rmsDb > -60 && l.rmsDb < -8) && (a.muted.rmsDb < -80 || !isFinite(a.muted.rmsDb));
  save('audio', { ...a, errors }); await ctx.close();
}

if (want('shots')) {
  const q = tier;
  const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=${q}&run=1&hour=11.25`, { w: 1280, h: 720 });
  const stats = [];
  const shot = async (name, setup) => {
    const s = await page.evaluate(setup);
    await page.evaluate(() => GX.render());
    const st = await page.evaluate(() => { const s = GX.stats(); return { calls: s.calls, tris: s.triangles, puffs: GX.app.exhaust.count, v_mph: +(GX.app.speed / 0.44704).toFixed(1), status: GX.app.run.status }; });
    stats.push({ name, ...st, ...(s || {}) });
    await page.screenshot({ path: `/w/shots/${out}/${name}_${q}.png`, timeout: 600000 });
  };
  // the opening: rolling across the viaduct at 10 mph, the plume trailing
  await shot('run_open', () => { GX.run({ on: true, auto: true, mph: 10, place: 'viaduct' }); GX.view('train-glen'); for (let i = 0; i < 16; i++) GX.tick(60); });
  await shot('run_classic', () => { GX.app.followTrain = false; GX.run({ place: 'viaduct' }); GX.run({ s: GX.runState().viaduct[1] - 60, v: 4.47 }); GX.view('v01-classic'); for (let i = 0; i < 20; i++) GX.tick(60); });
  await shot('run_arches', () => { GX.view('viaduct-river'); for (let i = 0; i < 6; i++) GX.tick(60); });
  await shot('run_close', () => { GX.app.followTrain = true; GX.run({ hold: 11.2, place: 'viaduct' }); GX.view('front-34-l'); for (let i = 0; i < 12; i++) GX.tick(30); });
  await shot('run_cab', () => { GX.run({ hold: 0 }); GX.view('cab-inside'); GX.run({ hold: 8 }); for (let i = 0; i < 10; i++) GX.tick(60); });
  await shot('run_coach', () => { GX.run({ hold: 0 }); GX.view('coach-aisle'); GX.run({ hold: 8 }); for (let i = 0; i < 10; i++) GX.tick(60); });
  await shot('run_station', () => { GX.app.followTrain = false; GX.run({ hold: null, auto: true, s: GX.app.run.route.stop + 140, v: 6 }); GX.view('station-air'); for (let i = 0; i < 40; i++) GX.tick(60); });
  save(`shots_${q}`, { stats, errors }); await ctx.close();
}

if (want('perf')) {
  // worst views while running, each tier, desktop and phone sizes: calls and triangles include the
  // shadow pass (redrawn every frame while the train moves) and the steam
  const rows = [], budget = { low: [150, 400e3], medium: [300, 1.2e6], high: [600, 3e6] };
  for (const q of ['low', 'medium', 'high']) for (const [w, h] of [[1280, 720], [844, 390]]) {
    const { ctx, page, errors } = await openPage(b, `${url}?fixed=1&q=${q}&run=1&hour=11.25`, { w, h });
    for (const [name, setup] of [
      ['train', () => { GX.app.followTrain = true; GX.run({ on: true, auto: true, mph: 10, place: 'viaduct' }); GX.view('train-glen'); }],
      ['classic', () => { GX.app.followTrain = false; GX.run({ s: GX.runState().viaduct[1] - 60, v: 4.47 }); GX.view('v01-classic'); }],
      ['cab', () => { GX.run({ hold: 0, place: 'viaduct' }); GX.view('cab-inside'); GX.run({ hold: 8 }); }],
      ['coach', () => { GX.run({ hold: 0 }); GX.view('coach-aisle'); GX.run({ hold: 8 }); }],
      ['station', () => { GX.run({ hold: null, auto: true, s: GX.app.run.route.stop + 140, v: 6 }); GX.view('station-air'); }],
    ]) {
      await page.evaluate(setup);
      const st = await page.evaluate(() => { for (let i = 0; i < 12; i++) GX.tick(30); const s = GX.stats(); const s2 = GX.stats(); return { calls: Math.max(s.calls, s2.calls), tris: Math.max(s.triangles, s2.triangles), puffs: GX.app.exhaust.count }; });
      const [bc, bt] = budget[q];
      rows.push({ tier: q, size: `${w}x${h}`, view: name, ...st, pass: st.calls <= bc && st.tris <= bt });
      console.log(JSON.stringify(rows.at(-1)));
    }
    rows.push({ tier: q, size: `${w}x${h}`, errors });
    await ctx.close();
  }
  save('perf', { rows, pass: rows.every((r) => r.pass !== false && !(r.errors && r.errors.length)) });
}

await b.close(); server.close();
