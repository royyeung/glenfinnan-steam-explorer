// window.GX: hooks for the headless verification harness and for debugging by hand.
// Deterministic use: load with ?fixed=1, then GX.setWheelAngle / GX.step / GX.view / GX.capture.
import * as THREE from 'three';
import type { App } from '../app.ts';
import { B5 } from '../specs/black5.ts';
import { weakSpecs } from '../specs/spec.ts';
import { AVATAR } from '../controls/walk.ts';
import { SITE } from '../world/site.ts';
import { solveMotion } from '../loco/motion/solver.ts';
import { solveValveGear } from '../loco/motion/walschaerts.ts';

export function installGX(app: App) {
  const GX = {
    get ready() { return app.ready; },
    app,
    THREE,
    view: (name: string) => { app.setView(name); app.frame(); return name; },
    step: (n = 1) => { app.step(n); app.frame(); return app.simTime; },
    /** simulation steps without a frame (fast: no rendering) */
    sim: (n = 1) => { app.step(n); return app.simTime; },
    /** steps plus a frame's updates (sound, camera, effects) but no rendering */
    tick: (n = 1) => { app.step(n); app.frame(false); return app.simTime; },
    /** valve travel (m) of both sides at wheel angle theta and a cut-off: the exhaust beats must fall where it passes zero */
    valveAt: (theta: number, cutoff: number) => { const rig = app.rigs[0], st = solveMotion(rig.geo, theta); return { L: solveValveGear(rig.vg, rig.geo.drive, st.left, cutoff).valveTravel, R: solveValveGear(rig.vg, rig.geo.drive, st.right, cutoff).valveTravel }; },
    setWheelAngle: (deg: number) => { app.setWheelAngle((deg * Math.PI) / 180); app.frame(); },
    setHour: (h: number) => { app.atmosphere.params.hour = h; app.atmosphere.invalidate(); app.frame(); return app.atmosphere.sun; },
    setMotion: (on: boolean) => app.setMotion(on),
    setCutoff: (c: number) => { app.setCutoff(c); app.frame(); return c; },
    control: (id: string, v: number) => { app.footplate.set(id, v); if (id === 'reverser') app.setCutoff(v, false); app.frame(); return app.footplate.c[id]; },
    selectControl: (id: string) => { const k = (app.cabUI as unknown as { select: (k: unknown) => void }); k.select((window as unknown as { __ctl: (i: string) => unknown }).__ctl?.(id) ?? null); app.frame(); },
    footplate: () => { const f = app.footplate; return { pressure: +f.pressure.toFixed(1), water: +f.water.toFixed(3), fire: +f.fire.toFixed(3), vacTrain: +f.vacTrain.toFixed(2), vacRes: +f.vacRes.toFixed(2), mainRes: +f.mainRes.toFixed(1), brakePipe: +f.brakePipe.toFixed(1), wheelOmega: +f.wheelOmega.toFixed(3), safetyLift: +f.safetyLift.toFixed(2), braking: +f.braking.toFixed(2), controls: { ...f.c } }; },
    /** Node transform of a cab control (for automated "does it move" checks). */
    controlPose: (id: string) => { let r = null as null | number[]; app.scene.traverse((o) => { if (o.name === `ctl_${id}`) { const q = o.rotation; r = [q.x, q.y, q.z, o.position.x, o.position.y, o.position.z]; const ch = o.children.find((c) => c.name === 'door_L'); if (ch) r.push(ch.position.x, ch.rotation.y); } }); return r; },
    info: (on: boolean) => { app.hotspots.setVisible(on); app.frame(); },
    weather: (a: number) => { app.weathering.setAmount(a); app.frame(); },
    silhouette: (on: boolean) => { app.setSilhouette(on); app.frame(); },
    freeCam: (on: boolean) => app.setMode(on ? 'free' : 'orbit'),
    render: () => app.frame(),
    capture: (w?: number, h?: number) => {
      if (w && h) { app.canvas.style.width = `${w}px`; app.canvas.style.height = `${h}px`; app.resize(); }
      app.frame();
      return app.canvas.toDataURL('image/png');
    },
    stats: () => { app.frame(); return app.stats(); },
    sun: () => app.atmosphere.sun,
    audio: () => app.audio.levels(),
    unlockAudio: () => app.audio.unlock(),
    weakSpecs: () => weakSpecs(B5).map(({ key, spec }) => ({ key, v: +spec.v.toFixed(3), src: spec.src, conf: spec.conf, note: spec.note })),

    /** Kinematics over one full wheel revolution: solver rod lengths and scene-node connection gaps. */
    kinematics: (steps = 360, cutoffs = [1, 0.65, 0.3, 0, -0.65, -1]) => {
      const rig = app.rigs[0];
      let maxLenDev = 0, maxGap = 0, worst = '', worstLen = '';
      for (const c of cutoffs) {
        app.setCutoff(c); app.setWheelAngle(0);
        const base = rig.measure();
        for (let i = 0; i <= steps; i++) {
          app.setWheelAngle((i / steps) * Math.PI * 2);
          const m = rig.measure();
          for (const k of Object.keys(m)) { const dv = Math.abs(m[k] - base[k]); if (dv > maxLenDev) { maxLenDev = dv; worstLen = `${k}@${c}`; } }
          const g = rig.connectionGaps();
          for (const [k, v] of Object.entries(g)) if (v > maxGap) { maxGap = v; worst = `${k}@${((i / steps) * 360).toFixed(0)}° cutoff ${c}`; }
        }
      }
      app.setCutoff(0.65); app.setWheelAngle(0);
      const st = rig.state;
      const phase = ((st.right.phi - st.left.phi) * 180) / Math.PI;
      return { steps, cutoffs, maxRodLengthDeviation_m: maxLenDev, worstLength: worstLen, maxConnectionGap_m: maxGap, worst, rightMinusLeftPhaseDeg: phase, rightLeads: rig.geo.rightLeads };
    },

    /** Human-scale checks for a 1.70 m person against the blockout (numbers, not pictures). */
    humanScale: () => {
      const roofUnder = B5.cabRoofH.v - 0.06, floor = B5.footplateH.v;
      // climbing sequence from a surface: every step tread above it, then the footplate
      const seq = (from: number) => { const lv = [B5.cabStepLowerH.v, B5.cabStepUpperH.v, floor].filter((h) => h > from + 0.01); return lv.map((h, i) => h - (i ? lv[i - 1] : from)); };
      const rises = seq(SITE.platformHeight.v);
      const fromBallast = seq(0);
      const doorway = B5.cabOpeningRearD.v - B5.cabOpeningFrontD.v;
      return {
        avatar: AVATAR,
        cabHeadroom_m: +(roofUnder - floor).toFixed(3), headroomOK: roofUnder - floor >= AVATAR.height + 0.05,
        cabDoorwayLength_m: +doorway.toFixed(3), doorwayOK: doorway >= 0.55,
        stepRisesFromPlatform_m: rises.map((r) => +r.toFixed(3)),
        stepRisesFromRailLevel_m: fromBallast.map((r) => +r.toFixed(3)),
        stepsOK: rises.every((r) => r <= AVATAR.stepMax + 1e-6),
        platformHeight_m: SITE.platformHeight.v, footplate_m: floor,
      };
    },

    /** Scripted walk: hold input for `seconds` of simulated time; returns the walker's end state. */
    walk: (fwd: number, strafe: number, seconds: number, yaw?: number) => {
      if (app.mode !== 'walk') app.setMode('walk');
      if (yaw !== undefined) app.walker.yaw = yaw;
      app.inputs.enabled = false; // scripted input only
      const n = Math.round(seconds * 120);
      for (let i = 0; i < n; i++) { app.walker.input.fwd = fwd; app.walker.input.strafe = strafe; app.walker.step(1 / 120); }
      app.walker.input.fwd = app.walker.input.strafe = 0;
      app.walker.applyTo(app.persp); app.frame();
      const f = app.walker.feet;
      return { x: +f.x.toFixed(3), y: +f.y.toFixed(3), z: +f.z.toFixed(3), onGround: app.walker.onGround };
    },
    /** Phase 6: the run. on: start/stop; mph: viaduct speed; hold: constant speed (m/s) for checks. */
    run: (o: { on?: boolean; mph?: number; hold?: number | null; auto?: boolean; place?: 'viaduct' | 'station'; s?: number; v?: number }) => {
      const r = app.run; if (!r) return null;
      if (o.place) app.placeTrain(o.place);
      if (o.s !== undefined) { r.placeAt(o.s, false); r.v = o.v ?? r.v; app.placeTrain0(); }
      if (o.mph !== undefined) r.viaductSpeed = o.mph * 0.44704;
      if (o.hold !== undefined) r.hold = o.hold;
      if (o.auto !== undefined) r.auto = o.auto;
      if (o.on !== undefined) app.setRun(o.on);
      return GX.runState();
    },
    runState: () => { const r = app.run!; return { s: +r.s.toFixed(3), v: +r.v.toFixed(3), state: r.state, status: r.status, viaduct: r.route.viaduct, length: +r.length.toFixed(2), mass: r.massT, theta: app.theta, simTime: app.simTime, cutoff: app.footplate.c.reverser, regulator: app.footplate.c.regulator, pressure: +app.footplate.pressure.toFixed(1), puffs: app.exhaust.count }; },
    beatTrace: () => app.beatTrace.splice(0),
    beatLog: () => app.sounds.beatLog.slice(),
    teleport: (x: number, y: number, z: number, yaw = 0) => { app.setMode('walk'); app.walker.teleport(x, y, z, yaw); app.walker.applyTo(app.persp); app.frame(); const f = app.walker.feet; return { x: f.x, y: f.y, z: f.z, onGround: app.walker.onGround }; },
  };
  (window as unknown as { GX: typeof GX }).GX = GX;
  return GX;
}
