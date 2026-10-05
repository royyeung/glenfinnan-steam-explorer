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
  const start = await page.evaluate(() => GX.teleport(-2.15, 0.915, -6.0, -Math.PI / 2));
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
      for (const view of ['front-34-l', 'site-wide']) {
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

await b.close(); server.close();
