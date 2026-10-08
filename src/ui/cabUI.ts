// Operating the cab controls. Aim (crosshair in walk mode) or point at a control to see its name;
// click or tap to select it. With the mouse captured, hold the button and move up/down to work it;
// the panel also has a slider, +/- keys and a "hold" button for momentary controls (whistle).
import * as THREE from 'three';
import { CONTROLS, GAUGES, type CabControl } from '../loco/cabControls.ts';
import type { Footplate } from '../sim/footplate.ts';

export class CabUI {
  hovered: CabControl | null = null;
  selected: CabControl | null = null;
  dragging = false;
  private meshes: THREE.Mesh[] = [];
  private gaugeMeshes: { mesh: THREE.Object3D; id: string }[] = [];
  private ray = new THREE.Raycaster();
  private tip = document.getElementById('ctlTip')!;
  private panel = document.getElementById('ctlPanel')!;
  private slider = document.getElementById('ctlSlider') as HTMLInputElement;
  private valueEl = document.getElementById('ctlValue')!;
  private holdBtn = document.getElementById('ctlHold') as HTMLButtonElement;
  private mouse = new THREE.Vector2(9, 9);
  private fp: Footplate;
  private canvas: HTMLCanvasElement;
  onChange: (id: string, v: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement, roots: THREE.Object3D[], fp: Footplate) {
    this.fp = fp; this.canvas = canvas;
    for (const r of roots) r.traverse((o) => { if ((o as THREE.Mesh).isMesh && /^ctl_/.test(o.name)) this.meshes.push(o as THREE.Mesh); });
    canvas.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); });
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointerup', () => this.up());
    addEventListener('mousemove', (e) => { if (this.dragging && this.selected && document.pointerLockElement === canvas) this.nudge(-e.movementY * 0.004); });
    canvas.addEventListener('wheel', (e) => { if (this.hovered) { e.preventDefault(); this.select(this.hovered); this.nudge(-Math.sign(e.deltaY) * 0.05); } }, { passive: false });
    addEventListener('keydown', (e) => {
      if (!this.selected || e.target instanceof HTMLInputElement) return;
      if (e.key === ']' || e.key === '+' || e.key === '=') this.nudge(0.05);
      if (e.key === '[' || e.key === '-') this.nudge(-0.05);
      if (e.code === 'Escape') this.close();
    });
    this.slider.addEventListener('input', () => { if (this.selected) this.setValue(this.selected, Number(this.slider.value)); });
    const hold = (on: boolean) => { if (!this.selected) return; this.fp.held = on ? this.selected.id : null; if (on) this.setValue(this.selected, this.selected.max); };
    this.holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); hold(true); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) this.holdBtn.addEventListener(ev, () => hold(false));
    document.getElementById('ctlClose')!.onclick = () => this.close();
    void GAUGES; void this.gaugeMeshes;
  }

  /** Is the pointer over a control (so a click should operate it rather than capture the mouse)? */
  get wantsClick() { return !!this.hovered; }

  update(camera: THREE.Camera, centre: boolean) {
    this.lastCamera = camera; this.lastCentre = centre;
    if (!this.meshes.length) return;
    this.ray.setFromCamera(centre ? new THREE.Vector2(0, 0) : this.mouse, camera);
    this.ray.far = 3.2;
    const hit = this.ray.intersectObjects(this.meshes, false)[0];
    let ctl: CabControl | null = null;
    if (hit) { let o: THREE.Object3D | null = hit.object; while (o && !/^ctl_[a-zA-Z]+$/.test(o.name)) o = o.parent; if (o) ctl = CONTROLS.find((k) => `ctl_${k.id}` === o!.name) ?? null; }
    this.hovered = ctl;
    this.tip.hidden = !ctl;
    if (ctl) {
      this.tip.textContent = `${ctl.name} — ${this.describe(ctl)}`;
      if (centre) { this.tip.style.left = '50%'; this.tip.style.top = 'calc(50% + 18px)'; }
      else { this.tip.style.left = `${((this.mouse.x + 1) / 2) * 100}%`; this.tip.style.top = `calc(${((1 - this.mouse.y) / 2) * 100}% + 18px)`; }
    }
    this.canvas.style.cursor = ctl ? 'pointer' : '';
    if (this.selected) { this.valueEl.textContent = this.describe(this.selected); if (!this.dragging && document.activeElement !== this.slider) this.slider.value = String(this.fp.c[this.selected.id]); }
  }

  describe(k: CabControl) {
    const v = this.fp.c[k.id];
    if (k.id === 'reverser') return Math.abs(v) < 0.04 ? 'mid gear' : `${v > 0 ? 'forward' : 'back'} gear, ${Math.round(15 + Math.abs(v) * 60)}% cut-off`;
    if (k.labels && (v <= k.min + 0.02 || v >= k.max - 0.02)) return v <= k.min + 0.02 ? k.labels[0] : k.labels[1];
    return `${Math.round(((v - k.min) / (k.max - k.min)) * 100)}%`;
  }

  select(k: CabControl) {
    this.selected = k; this.panel.hidden = false;
    this.panel.querySelector('h3')!.textContent = k.name;
    this.panel.querySelector('.what')!.textContent = k.what;
    this.panel.querySelector('.does')!.textContent = k.does + (k.confirmed === 'S27-list' ? ' (Position on 45407 unconfirmed.)' : '');
    this.slider.min = String(k.min); this.slider.max = String(k.max); this.slider.step = String(k.step ?? 0.01);
    this.slider.value = String(this.fp.c[k.id]);
    this.slider.hidden = !!k.momentary; this.holdBtn.hidden = !k.momentary;
  }

  close() { this.selected = null; this.panel.hidden = true; this.fp.held = null; }

  private lastCamera: THREE.Camera | null = null;
  private lastCentre = false;

  private down(e: PointerEvent) {
    // taps have no hover beforehand: aim at the touch point (or the crosshair) right now
    if (this.lastCamera && !this.lastCentre) {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.update(this.lastCamera, false);
    }
    if (e.button !== 0 || !this.hovered) return;
    this.select(this.hovered);
    if (this.hovered.momentary) { this.fp.held = this.hovered.id; this.setValue(this.hovered, this.hovered.max); }
    else if (this.hovered.kind === 'toggle' || this.hovered.kind === 'doors' || this.hovered.kind === 'button') this.setValue(this.hovered, this.fp.c[this.hovered.id] > (this.hovered.min + this.hovered.max) / 2 ? this.hovered.min : this.hovered.max);
    this.dragging = true;
  }
  private up() { this.dragging = false; if (this.fp.held) this.fp.held = null; }

  nudge(dFrac: number) { const k = this.selected; if (!k) return; this.setValue(k, this.fp.c[k.id] + dFrac * (k.max - k.min)); }

  setValue(k: CabControl, v: number) { this.fp.set(k.id, v); this.onChange(k.id, this.fp.c[k.id]); }
}
