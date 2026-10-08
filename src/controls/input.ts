// Walk-mode input: keyboard + mouse (pointer lock, or drag when lock is unavailable) on desktop,
// a left-thumb joystick and right-side drag-to-look on touch screens.
import type { WalkInput } from './walk.ts';

export class WalkInputs {
  enabled = false;
  private keys = new Set<string>();
  private joy = { id: -1, x: 0, y: 0, cx: 0, cy: 0 };
  private look = { id: -1, x: 0, y: 0 };
  private drag = { on: false, x: 0, y: 0 };
  private target: WalkInput;
  readonly touch = matchMedia('(pointer: coarse)').matches;
  /** Return true to keep a click for the cab controls instead of capturing the mouse. */
  clickTaken: () => boolean = () => false;
  /** True while a cab control is being dragged: mouse movement then works the control, not the view. */
  lookSuspended: () => boolean = () => false;

  constructor(canvas: HTMLCanvasElement, target: WalkInput) {
    this.target = target;
    addEventListener('keydown', (e) => { if (this.enabled && !(e.target instanceof HTMLInputElement)) this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (this.enabled && !this.touch && document.pointerLockElement !== canvas && !this.clickTaken()) canvas.requestPointerLock?.()?.catch?.(() => {});
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled || this.touch) return;
      if (this.lookSuspended()) return;
      if (document.pointerLockElement === canvas) { this.target.lookX += e.movementX * 0.0022; this.target.lookY += e.movementY * 0.0022; }
      else if (this.drag.on) { this.target.lookX += (e.clientX - this.drag.x) * 0.004; this.target.lookY += (e.clientY - this.drag.y) * 0.004; this.drag.x = e.clientX; this.drag.y = e.clientY; }
    });
    canvas.addEventListener('mousedown', (e) => { this.drag = { on: true, x: e.clientX, y: e.clientY }; });
    addEventListener('mouseup', () => { this.drag.on = false; });
    const joyEl = document.getElementById('joyL')!, knob = joyEl.querySelector('i') as HTMLElement;
    canvas.addEventListener('touchstart', (e) => this.onTouch(e, 'start', joyEl), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouch(e, 'move', joyEl), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouch(e, 'end', joyEl), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.onTouch(e, 'end', joyEl), { passive: false });
    joyEl.addEventListener('touchstart', (e) => this.onTouch(e, 'start', joyEl), { passive: false });
    joyEl.addEventListener('touchmove', (e) => this.onTouch(e, 'move', joyEl), { passive: false });
    joyEl.addEventListener('touchend', (e) => this.onTouch(e, 'end', joyEl), { passive: false });
    this.knob = knob;
  }
  private knob: HTMLElement;

  private onTouch(e: TouchEvent, phase: 'start' | 'move' | 'end', joyEl: HTMLElement) {
    if (!this.enabled) return;
    e.preventDefault();
    const r = joyEl.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      if (phase === 'start') {
        if (this.clickTaken()) continue;
        if (t.clientX < innerWidth * 0.45 && this.joy.id < 0) this.joy = { id: t.identifier, x: 0, y: 0, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
        else if (this.look.id < 0) this.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      } else if (phase === 'move') {
        if (t.identifier === this.joy.id) {
          const dx = t.clientX - this.joy.cx, dy = t.clientY - this.joy.cy, m = Math.hypot(dx, dy), k = m > 50 ? 50 / m : 1;
          this.joy.x = (dx * k) / 50; this.joy.y = (dy * k) / 50;
          this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        } else if (t.identifier === this.look.id) {
          this.target.lookX += (t.clientX - this.look.x) * 0.006; this.target.lookY += (t.clientY - this.look.y) * 0.006;
          this.look.x = t.clientX; this.look.y = t.clientY;
        }
      } else {
        if (t.identifier === this.joy.id) { this.joy = { id: -1, x: 0, y: 0, cx: 0, cy: 0 }; this.knob.style.transform = ''; }
        if (t.identifier === this.look.id) this.look.id = -1;
      }
    }
  }

  /** Write the current movement intent into the walker's input. */
  update() {
    const k = this.keys, t = this.target;
    if (!this.enabled) { t.fwd = t.strafe = 0; return; }
    t.fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.joy.y;
    t.strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + this.joy.x;
    t.run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.95;
  }
}
