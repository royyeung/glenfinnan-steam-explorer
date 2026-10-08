// A small, explainable model of what the controls do: boiler pressure and water level, the fire,
// the vacuum and air brakes, and (on the rolling road) the wheels. Not a full engineering model;
// rates are tuned so a minute on the footplate shows realistic behaviour. Values feed the gauges,
// sounds and the motion.
import { CONTROLS } from '../loco/cabControls.ts';

export type ControlValues = Record<string, number>;

export class Footplate {
  readonly c: ControlValues = Object.fromEntries(CONTROLS.map((k) => [k.id, k.init]));
  pressure = 218;      // psi (working 225)
  water = 0.62;        // fraction of the gauge glass
  fire = 0.8;          // 0..1 heat output of the firebed
  vacTrain = 21;       // in Hg, train pipe
  vacRes = 21;         // in Hg, reservoir side
  mainRes = 140;       // psi, air main reservoir
  brakePipe = 72;      // psi, air brake pipe
  wheelOmega = 0;      // rad/s driving-wheel speed on the rolling road
  safetyLift = 0;      // 0..1 safety valves blowing
  steamUse = 0;        // relative, for sounds (exhaust)
  awsTimer = 0;
  t = 0;

  set(id: string, v: number) {
    const k = CONTROLS.find((x) => x.id === id);
    if (!k) return;
    this.c[id] = Math.min(k.max, Math.max(k.min, v));
  }

  /** Brakes holding the wheels (0..1). */
  get braking() {
    const vac = Math.max(0, (21 - this.vacTrain) / 21), air = Math.max(0, (72 - this.brakePipe) / 72);
    return Math.min(1, Math.max(vac, air, this.c.handbrake, this.c.brake));
  }

  step(dt: number) {
    const c = this.c; this.t += dt;
    // --- fire: blower and exhaust draw air through it; open doors cool it; dampers feed it
    const draught = Math.min(1, 0.15 + 0.7 * c.blower + 0.9 * c.regulator * Math.min(1, Math.abs(this.wheelOmega) / 4));
    const air = 0.35 + 0.4 * c.damperF + 0.25 * c.damperR;
    const target = Math.min(1, draught * air * 1.6) * (1 - 0.35 * c.fireDoors);
    this.fire += (target - this.fire) * Math.min(1, dt * 0.05) ;
    this.fire = Math.max(0.15, this.fire);
    // --- steam: production vs use
    const injL = c.injL > 0.3 && c.waterL > 0.5 && this.pressure > 60 ? 1 : 0;
    const injR = c.injR > 0.3 && c.waterR > 0.5 && this.pressure > 60 ? 1 : 0;
    const cyl = c.regulator * Math.max(0.15, Math.abs(c.reverser)) * Math.min(1, Math.abs(this.wheelOmega) / 2 + 0.3);
    this.steamUse = cyl;
    const use = 2.2 * cyl + 0.25 * c.blower + 0.3 * c.ejectorLarge + 0.05 * c.ejectorSmall + 0.08 * c.compressor + 0.25 * (injL + injR) + 0.2 * c.whistle + 0.6 * c.drainCocks * c.regulator;
    const make = 1.25 * this.fire * (this.water > 0.05 ? 1 : 0.2);
    this.pressure += (make - use) * 3.2 * dt;
    // cold feed water from the injectors knocks the pressure down a little
    this.pressure -= (injL + injR) * 0.6 * dt;
    // safety valves: lift at 225, reseat at 222
    if (this.pressure >= 225) this.safetyLift = Math.min(1, this.safetyLift + dt * 2);
    else if (this.pressure < 222) this.safetyLift = Math.max(0, this.safetyLift - dt * 1.5);
    if (this.safetyLift > 0) this.pressure -= this.safetyLift * 6 * dt;
    this.pressure = Math.max(0, Math.min(232, this.pressure));
    // --- water: evaporation vs injectors (in gauge-glass fractions per second)
    this.water += ((injL + injR) * 0.012 - (0.002 + 0.01 * cyl + 0.002 * this.safetyLift)) * dt;
    this.water = Math.max(0, Math.min(1, this.water));
    // --- vacuum brake: ejectors create vacuum, the driver's valve and leaks destroy it
    const create = (this.pressure > 50 ? 1 : 0) * (8 * c.ejectorLarge + 1.6 * c.ejectorSmall);
    const destroy = 0.6 + 30 * c.brake + 10 * c.airBrake;
    const vacTarget = Math.min(25, 25 * create / (create + destroy + 1e-6));
    this.vacTrain += (vacTarget - this.vacTrain) * Math.min(1, dt * (c.brake > 0.5 ? 2.5 : 0.7));
    this.vacRes += (Math.max(this.vacRes, this.vacTrain) - this.vacRes) * Math.min(1, dt * 0.3) - 0.01 * dt;
    this.vacRes = Math.max(this.vacTrain, Math.min(25, this.vacRes));
    // --- air brake (M8): compressor charges the main reservoir; the valve sets the brake pipe
    if (c.compressor > 0.5 && this.pressure > 60) this.mainRes = Math.min(140, this.mainRes + 6 * dt);
    const bpTarget = c.airBrake > 0.9 ? 0 : 72 * (1 - c.airBrake * 0.45);
    this.brakePipe += (Math.min(bpTarget, this.mainRes) - this.brakePipe) * Math.min(1, dt * (c.airBrake > 0.9 ? 4 : 1.2));
    this.mainRes -= Math.max(0, (bpTarget - this.brakePipe)) * 0.002;
    // --- wheels on the rolling road: steam drives them, brakes and friction slow them
    const drive = cyl > 0.02 && this.pressure > 40 ? Math.sign(c.reverser) * c.regulator * Math.min(1, Math.abs(c.reverser) * 1.6) * (this.pressure / 225) : 0;
    const accel = 1.8 * drive - this.wheelOmega * 0.05 - Math.sign(this.wheelOmega) * this.braking * 2.5;
    this.wheelOmega += accel * dt;
    if (this.braking > 0.2 && Math.abs(this.wheelOmega) < 0.05 && Math.abs(drive) < 0.05) this.wheelOmega = 0;
    this.wheelOmega = Math.max(-12, Math.min(12, this.wheelOmega));
    // momentary controls spring back
    for (const k of CONTROLS) if (k.momentary && this.held !== k.id) this.c[k.id] = Math.max(k.min, this.c[k.id] - dt * 6);
  }
  held: string | null = null;
}
