import { App } from './app.ts';
import { params } from './core/params.ts';
import { installGX } from './debug/gx.ts';
import { installTuning } from './debug/tune.ts';
import { B5 } from './specs/black5.ts';
import { weakSpecs } from './specs/spec.ts';
import { CONTROLS } from './loco/cabControls.ts';
(window as unknown as { __ctl: (i: string) => unknown }).__ctl = (i: string) => CONTROLS.find((k) => k.id === i);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const app = new App($('view'));
const GX = params.debug || params.perf ? installGX(app) : null;

const bar = $('loadBar'), text = $('loadText');
app.load((f, t) => { bar.style.width = `${(f * 100).toFixed(0)}%`; text.textContent = t; })
  .then(() => {
    if (params.hour !== null) app.atmosphere.params.hour = params.hour;
    if (params.view) app.setView(params.view);
    const start = $('start'); start.style.display = 'inline-block'; start.focus();
    if (params.shot || params.fixed) begin(false);
    start.addEventListener('click', () => begin(true), { once: true });
    loop();
  })
  .catch((e) => { text.textContent = `Could not load: ${e.message ?? e}`; console.error(e); });

function begin(withSound: boolean) {
  $('loading').hidden = true;
  if (!(params.fixed || params.shot) || new URLSearchParams(location.search).has('hud')) for (const id of ['hud', 'title', 'help']) $(id).hidden = false;
  if (app.world) { $('osAttr').hidden = false; $('worldGroup').hidden = false; }
  if (params.perf) $('perf').hidden = false;
  if (withSound) app.audio.unlock().then(syncSound);
  installTuning(app, params.tune);
  wireUI();
}

function loop() {
  // deterministic/harness mode renders only when GX asks (software rendering is slow)
  if (!params.fixed) app.frame();
  if (params.perf && app.ready) perfOverlay();
  requestAnimationFrame(loop);
}

let perfLast = 0;
function perfOverlay() {
  const now = performance.now();
  if (now - perfLast < 500) return;
  perfLast = now;
  const s = app.stats();
  $('perf').textContent = `${s.gpu}\ntier ${s.tier} (${s.reason})  dpr ${s.dpr}  ${s.px[0]}×${s.px[1]}\nCPU ${s.frameMsCPU} ms  GPU ${s.frameMsGPU < 0 ? 'n/a' : s.frameMsGPU + ' ms'}\ncalls ${s.calls}  tris ${(s.triangles / 1000).toFixed(0)}k  tex ${s.textureMB} MB`;
}

function syncSound() {
  const b = $('mute');
  b.textContent = app.audio.muted || !app.audio.running ? 'Sound off' : 'Sound on';
  b.setAttribute('aria-pressed', String(app.audio.muted));
}

function wireUI() {
  const help = $('help');
  const setMode = (m: 'orbit' | 'walk') => {
    app.setMode(m);
    if (m === 'walk' && app.walker.feet.lengthSq() === 0) app.setView('cab-entry');
    $('mOrbit').setAttribute('aria-pressed', String(m === 'orbit'));
    $('mWalk').setAttribute('aria-pressed', String(m === 'walk'));
    $('modeName').textContent = m === 'walk' ? 'Walk' : 'Orbit';
    const touch = app.inputs.touch;
    $('joyL').hidden = !(m === 'walk' && touch); $('lookHint').hidden = !(m === 'walk' && touch); $('cross').hidden = m !== 'walk';
    help.innerHTML = m === 'walk'
      ? (touch ? 'Left thumb: move · right side: look · at a door, tap "Climb into" (doors lock while the train moves) · in the cab, tap a control to work it'
               : 'Click to look around · WASD / arrows move · Shift runs · E climbs aboard or steps down at a door (doors lock while the train moves) · Esc frees the mouse · in the cab, aim the dot at a control and click to work it')
      : (touch ? 'Drag to orbit · pinch to zoom · double-tap to fly there' : 'Drag to orbit · right-drag to pan · wheel zooms to the cursor · double-click flies there');
  };
  // climbing aboard: offered beside a cab entrance or coach door, and "step down" from inside one
  const boardBtn = $('boardBtn');
  const syncBoard = () => { const o = app.boardingOffer(); boardBtn.hidden = !o; if (o) { boardBtn.textContent = app.inputs.touch || o.locked ? o.label : `${o.label} (E)`; (boardBtn as HTMLButtonElement).disabled = !!o.locked; } };
  boardBtn.onclick = () => { app.board(); syncBoard(); };
  addEventListener('keydown', (e) => { if (e.code === 'KeyE' && app.mode === 'walk' && !(e.target instanceof HTMLInputElement)) { app.board(); syncBoard(); } });
  setInterval(syncBoard, 200);
  $('mOrbit').onclick = () => setMode('orbit');
  $('mWalk').onclick = () => setMode('walk');
  setMode(app.mode === 'walk' ? 'walk' : 'orbit');
  const motion = $('motion');
  motion.onclick = () => { app.setMotion(!app.motionOn); motion.setAttribute('aria-pressed', String(app.motionOn)); };
  const cut = $<HTMLInputElement>('cutoff');
  cut.oninput = () => app.setCutoff(Number(cut.value) / 100);
  setInterval(() => { if (document.activeElement !== cut) cut.value = String(Math.round(app.footplate.c.reverser * 100)); }, 300);
  const info = $('infoBtn');
  info.onclick = () => { app.hotspots.setVisible(!app.hotspots.visible); info.setAttribute('aria-pressed', String(app.hotspots.visible)); };
  const hour = $<HTMLInputElement>('hour');
  hour.value = String(app.atmosphere.params.hour);
  hour.oninput = () => { app.atmosphere.params.hour = Number(hour.value); app.atmosphere.invalidate(); };
  if (app.world) {
    const w = $<HTMLSelectElement>('weather'); w.value = app.weather;
    w.onchange = () => app.setWeather(w.value as typeof app.weather);
    const pl = $<HTMLSelectElement>('place'); pl.value = app.placeName;
    pl.onchange = () => { app.placeTrain(pl.value as 'viaduct' | 'station'); };
    const ds = $('diesel'); ds.setAttribute('aria-pressed', String(app.dieselOn));
    ds.onclick = () => { app.setDiesel(!app.dieselOn); ds.setAttribute('aria-pressed', String(app.dieselOn)); };
    // the run: start/stop, viaduct speed, who drives, follow camera; status in the title bar
    if (app.run) {
      const run = app.run;
      $('runGroup').hidden = false; $('motion').hidden = true; $('cutoffLabel').hidden = true;
      const rb = $('runBtn'), sync = () => { const on = app.runOn && run.running; rb.textContent = on ? 'Stop the train' : 'Run the train'; rb.setAttribute('aria-pressed', String(on)); };
      rb.onclick = () => { app.setRun(!(app.runOn && run.running)); sync(); };
      const mph = $<HTMLSelectElement>('mph'); mph.value = String(Math.round(run.viaductSpeed / 0.44704));
      mph.onchange = () => { run.viaductSpeed = Number(mph.value) * 0.44704; };
      const pb = $('pauseBtn');
      pb.onclick = () => { run.pauseOnViaduct = !run.pauseOnViaduct; pb.setAttribute('aria-pressed', String(run.pauseOnViaduct)); };
      const drv = $<HTMLSelectElement>('driver'); drv.value = run.auto ? 'auto' : 'you';
      drv.onchange = () => { run.auto = drv.value === 'auto'; if (!run.auto) { app.setRun(true); help.textContent = 'You are driving: in the cab, open the large ejector to release the brakes, set the reverser forward, then open the regulator. The brake valve stops you.'; } };
      app.onManualControl = () => { if (run.auto) { run.auto = false; drv.value = 'you'; app.setRun(true); } };
      const fb = $('followBtn');
      fb.onclick = () => { app.followTrain = !app.followTrain; fb.setAttribute('aria-pressed', String(app.followTrain)); };
      const st = $('runStatus');
      setInterval(() => {
        sync();
        const v = Math.abs(app.speed), mphNow = v / 0.44704;
        st.textContent = app.runOn ? ` · ${mphNow.toFixed(0)} mph (${(v * 3.6).toFixed(0)} km/h) · ${run.auto ? run.status : 'You are driving'}` : '';
      }, 250);
      sync();
    }
    const go = $<HTMLSelectElement>('goto');
    go.onchange = () => { if (go.value) { app.setView(go.value); setMode(app.mode === 'walk' ? 'walk' : 'orbit'); } go.value = ''; };
  }
  // full screen: hides the address bar and system bars (Android Chrome, desktop). iPhone Safari has no
  // full screen for pages, so the button stays hidden there (use "Add to Home Screen" instead).
  const fs = $('fsBtn'), root = document.documentElement;
  if (document.fullscreenEnabled && root.requestFullscreen) {
    fs.hidden = false;
    const sync = () => { const on = !!document.fullscreenElement; fs.textContent = on ? 'Exit full screen' : 'Full screen'; fs.setAttribute('aria-pressed', String(on)); };
    fs.onclick = async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await root.requestFullscreen({ navigationUI: 'hide' }); } catch { /* refused (e.g. not from a tap) */ }
    };
    document.addEventListener('fullscreenchange', () => { sync(); app.resize(); });
    sync();
  }
  $('mute').onclick = async () => {
    if (!app.audio.running) await app.audio.unlock(); else app.audio.setMuted(!app.audio.muted);
    syncSound();
  };
  const vol = $<HTMLInputElement>('vol');
  vol.oninput = () => app.audio.setVolume(Number(vol.value));
  const q = $<HTMLSelectElement>('quality');
  q.value = localStorage.getItem('gse.quality') ?? 'auto';
  q.onchange = () => { localStorage.setItem('gse.quality', q.value); const u = new URL(location.href); u.searchParams.delete('q'); location.href = u.toString(); };
  $('aboutBtn').onclick = () => {
    const list = $('estList');
    list.innerHTML = '';
    for (const { key, spec } of weakSpecs(B5)) { const li = document.createElement('li'); li.textContent = `${key}: ${spec.v.toFixed(3)} m (${spec.note ?? spec.src})`; list.appendChild(li); }
    $('about').hidden = false; $('aboutClose').focus();
  };
  $('aboutClose').onclick = () => { $('about').hidden = true; };
  addEventListener('keydown', (e) => { if (e.code === 'Escape') $('about').hidden = true; });
}

void GX;
