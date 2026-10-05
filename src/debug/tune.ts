// Hidden tuning panel (backtick key or ?tune=1). Edits look parameters live and exports JSON.
import GUI from 'lil-gui';
import * as THREE from 'three';
import type { App } from '../app.ts';
import { B5 } from '../specs/black5.ts';
import { weakSpecs } from '../specs/spec.ts';

export function installTuning(app: App, open: boolean) {
  let gui: GUI | null = null;
  const build = () => {
    gui = new GUI({ title: 'Tuning (export JSON)' });
    const a = app.atmosphere.params, inv = () => app.atmosphere.invalidate();
    const sky = gui.addFolder('Sun & sky');
    sky.add(a, 'hour', 3, 23, 0.05).name('UK time').onChange(inv);
    sky.add(a.date, 'm', 1, 12, 1).name('month').onChange(inv);
    sky.add(a.date, 'd', 1, 31, 1).name('day').onChange(inv);
    sky.add(a, 'turbidity', 1, 20, 0.1).onChange(inv);
    sky.add(a, 'rayleigh', 0, 4, 0.01).onChange(inv);
    sky.add(a, 'mie', 0, 0.05, 0.0005).onChange(inv);
    sky.add(a, 'cloudCoverage', 0, 1, 0.01).onChange(inv);
    sky.add(a, 'cloudDensity', 0, 1, 0.01).onChange(inv);
    sky.add(a, 'haze', 0, 0.006, 0.0001).name('haze (fog/m)').onChange(inv);
    sky.add(a, 'sunIntensity', 0, 8, 0.05).onChange(inv);
    sky.add(a, 'envIntensity', 0, 3, 0.05).onChange(inv);
    const img = gui.addFolder('Image');
    const r = app.renderer, tm = { mapping: 'AgX' };
    img.add(r, 'toneMappingExposure', 0.2, 3, 0.01).name('exposure');
    img.add(tm, 'mapping', ['AgX', 'Neutral', 'ACES']).onChange((v: string) => {
      r.toneMapping = v === 'AgX' ? THREE.AgXToneMapping : v === 'Neutral' ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    });
    if (app.post.bloom) { img.add(app.post.bloom, 'strength', 0, 1, 0.01).name('bloom'); img.add(app.post.bloom, 'threshold', 0, 4, 0.01).name('bloom threshold'); }
    const mo = gui.addFolder('Motion');
    mo.add(app, 'motionOn').name('rolling road');
    mo.add(app, 'motionSpeed', 0, 30, 0.1).name('speed m/s');
    const weak = gui.addFolder(`Estimated specs (${weakSpecs(B5).length})`);
    for (const { key, spec } of weakSpecs(B5)) weak.add({ [key]: `${spec.v.toFixed(3)} (${spec.src})` }, key).disable();
    weak.close();
    gui.add({ export: () => {
      const json = JSON.stringify({ atmosphere: a, exposure: r.toneMappingExposure, toneMapping: tm.mapping, bloom: app.post.bloom?.strength ?? null }, null, 2);
      navigator.clipboard?.writeText(json).catch(() => {});
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'glenfinnan-tuning.json' });
      link.click();
    } }, 'export').name('Export JSON (copy + download)');
  };
  const toggle = () => { if (!gui) build(); else { gui.destroy(); gui = null; } };
  addEventListener('keydown', (e) => { if (e.code === 'Backquote') toggle(); });
  if (open) build();
}
