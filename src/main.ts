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
      ? (touch ? 'Left thumb: move · right side: look · in the cab, tap a control (wheel, lever, gauge) to work it'
               : 'Click to look around · WASD / arrows move · Shift runs · Esc frees the mouse · in the cab, aim the dot at a control and click to work it')
      : (touch ? 'Drag to orbit · pinch to zoom' : 'Drag to orbit · right-drag to pan · wheel to zoom · ` opens tuning');
  };
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
