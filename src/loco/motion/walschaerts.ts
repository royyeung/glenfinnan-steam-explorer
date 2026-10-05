// Walschaerts valve gear, solved exactly for one side from the crank angle and the reverser.
// Chain: return crank (on the main crankpin) -> eccentric rod -> foot of the expansion link
// (rocking about a fixed trunnion) -> die block (position along the link set by the reverser)
// -> radius rod -> top of the combination lever; lever bottom <- union link <- crosshead arm;
// the valve spindle is pinned to the lever and slides on the valve line. The lifting link hangs
// from the reversing-shaft arm and slides in a slot in the radius rod (as on real engines).
// Frame: engine side plane (z forward, y up), metres. All link lengths are constants.

import type { SideState, V2 } from './solver.ts';

export interface ValveGearGeometry {
  returnCrankThrow: number;   // eccentricity: radius of the return-crank pin's circle about the axle
  returnCrankAngle: number;   // angular position of that pin relative to the main crank (rad)
  trunnion: V2;
  footOffset: number;         // trunnion to eccentric-rod pin, along the link (downwards)
  eccentricRod: number;
  dieRange: number;           // die-block travel either side of the trunnion at full gear
  radiusRod: number;
  leverTopToValve: number;
  leverValveToBottom: number;
  unionLink: number;
  crossheadArm: number;       // drop of the union-link pin below the crosshead pin
  valvePoint: V2;             // a point on the valve-spindle line (spindle at mid travel)
  strokeDir: V2;              // unit vector of the line of stroke (valve line is parallel)
  liftPivot: V2;              // reversing shaft
  liftArm: number;
  liftArmAngle0: number;      // arm angle at mid gear (rad)
  liftLink: number;
  liftSlotNominal: number;    // nominal distance of the lifting-link pin from the die along the radius rod
}

export interface ValveGearState {
  cutoff: number;             // -1 full back gear ... 0 mid gear ... +1 full forward gear
  returnPin: V2;
  linkAngle: number;          // expansion link rotation about the trunnion (0 = vertical)
  foot: V2;
  die: V2;
  dieSlip: number;            // die-block movement in the link through the stroke (real gears slip too)
  leverTop: V2;
  valvePin: V2;
  leverBottom: V2;
  armPin: V2;                 // union-link pin on the crosshead arm
  valveTravel: number;        // valve position along its line relative to mid (m)
  liftArmEnd: V2;
  liftSlotPin: V2;
  liftSlotOffset: number;     // where the lifting-link pin sits along the radius rod (from the die)
}

const sub = (a: V2, b: V2): [number, number] => [a[0] - b[0], a[1] - b[1]];
const add = (a: V2, b: V2): [number, number] => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V2, k: number): [number, number] => [a[0] * k, a[1] * k];
const len = (a: V2) => Math.hypot(a[0], a[1]);

/** Link direction (unit, "up" along the link) for a rotation alpha about the trunnion. */
const linkDir = (alpha: number): [number, number] => [-Math.sin(alpha), Math.cos(alpha)];

/** Intersections of circle (c0, r0) and circle (c1, r1). */
function circles(c0: V2, r0: number, c1: V2, r1: number): [V2, V2] | null {
  const d = sub(c1, c0), D = len(d);
  if (D > r0 + r1 || D < Math.abs(r0 - r1) || D === 0) return null;
  const a = (r0 * r0 - r1 * r1 + D * D) / (2 * D), h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const m = add(c0, mul(d, a / D)), p: V2 = [-d[1] / D, d[0] / D];
  return [add(m, mul(p, h)), sub(m, mul(p, h))];
}

export function solveValveGear(g: ValveGearGeometry, drive: V2, side: SideState, cutoff: number): ValveGearState {
  const c = Math.max(-1, Math.min(1, cutoff));
  // 1. return crank: fixed to the main crankpin, its pin circles the axle at the eccentricity
  const phiR = side.phi + g.returnCrankAngle;
  const returnPin = add(drive, [g.returnCrankThrow * Math.cos(phiR), g.returnCrankThrow * Math.sin(phiR)]);
  // 2. expansion link: foot lies on a circle about the trunnion and at eccentric-rod length from the pin
  const sols = circles(g.trunnion, g.footOffset, returnPin, g.eccentricRod);
  if (!sols) throw new Error('valve gear: eccentric rod cannot reach the link foot');
  const foot = sols[0][1] < sols[1][1] ? sols[0] : sols[1]; // the foot hangs below the trunnion
  const fd = sub(g.trunnion, foot);
  const linkAngle = Math.atan2(-fd[0], fd[1]); // direction trunnion->up = (foot->trunnion)
  const u = linkDir(linkAngle);
  // 3. reverser: sets the reversing-shaft arm once per cut-off. The lifting link hangs vertically from
  //    the arm end and holds the radius rod at a fixed "hanging point"; its pin slides in the rod's slot.
  const die0: V2 = [g.trunnion[0], g.trunnion[1] + c * g.dieRange];
  const top0: V2 = [g.valvePoint[0], g.valvePoint[1] + g.leverTopToValve];
  const r0 = sub(top0, die0), slot0 = add(die0, mul(r0, g.liftSlotNominal / len(r0)));
  const ga = Math.asin(Math.max(-1, Math.min(1, (slot0[1] + g.liftLink - g.liftPivot[1]) / g.liftArm)));
  const liftArmEnd = add(g.liftPivot, [g.liftArm * Math.cos(ga), g.liftArm * Math.sin(ga)]);
  const hang: V2 = [liftArmEnd[0], liftArmEnd[1] - g.liftLink];
  // 4. crosshead arm pin (below the crosshead, perpendicular to the stroke)
  const w = g.strokeDir, down: V2 = [w[1], -w[0]];
  const armPin = add(side.crosshead, mul(down, g.crossheadArm));
  // 5. unknowns: die position along the link (eps, includes die slip), valve position s, lever angle beta.
  //    Equations: radius rod length; die, hanging point and lever top collinear (rod is straight); union link.
  const a = g.leverTopToValve, b = g.leverValveToBottom;
  const pts = (eps: number, s: number, beta: number) => {
    const die = add(g.trunnion, mul(u, eps));
    const v = add(g.valvePoint, mul(w, s));
    const ld: V2 = [Math.sin(beta), -Math.cos(beta)]; // lever direction top -> bottom
    return { die, v, top: sub(v, mul(ld, a)), bot: add(v, mul(ld, b)) };
  };
  const F = (x: number[]): number[] => {
    const p = pts(x[0], x[1], x[2]), rt = sub(p.top, p.die), rh = sub(hang, p.die);
    return [len(rt) - g.radiusRod, (rt[0] * rh[1] - rt[1] * rh[0]) / len(rt), len(sub(p.bot, armPin)) - g.unionLink];
  };
  const x = [c * g.dieRange, 0, 0];
  for (let it = 0; it < 60; it++) {
    const f = F(x), e = 1e-7, J: number[][] = [[], [], []];
    for (let j = 0; j < 3; j++) { const xp = x.slice(); xp[j] += e; const fp = F(xp); for (let i = 0; i < 3; i++) J[i][j] = (fp[i] - f[i]) / e; }
    const dx = solve3(J, f);
    if (!dx) break;
    for (let j = 0; j < 3; j++) x[j] -= dx[j];
    if (Math.abs(dx[0]) + Math.abs(dx[1]) + Math.abs(dx[2]) < 1e-13) break;
  }
  const p = pts(x[0], x[1], x[2]);
  const die = p.die, liftSlotPin = hang, liftSlotOffset = len(sub(hang, die));
  return { cutoff: c, returnPin, linkAngle, foot, die, dieSlip: x[0] - c * g.dieRange, leverTop: p.top, valvePin: p.v, leverBottom: p.bot, armPin, valveTravel: x[1], liftArmEnd, liftSlotPin, liftSlotOffset };
}

/** Pin-to-pin lengths (must be constant) and closure errors, for tests and the harness. */
export function valveGearLengths(g: ValveGearGeometry, drive: V2, side: SideState, st: ValveGearState) {
  return {
    returnCrank: len(sub(st.returnPin, side.pins.drive)), // crankpin to return pin (constant)
    eccentricity: len(sub(st.returnPin, drive)),
    eccentricRod: len(sub(st.foot, st.returnPin)),
    linkFoot: len(sub(st.foot, g.trunnion)),
    radiusRod: len(sub(st.leverTop, st.die)),
    leverTop: len(sub(st.valvePin, st.leverTop)),
    leverBottom: len(sub(st.leverBottom, st.valvePin)),
    unionLink: len(sub(st.leverBottom, st.armPin)),
    crossheadArm: len(sub(st.armPin, side.crosshead)),
    liftArm: len(sub(st.liftArmEnd, g.liftPivot)),
    liftLink: len(sub(st.liftSlotPin, st.liftArmEnd)),
    // valve pin must stay on the valve line; lever must stay straight
    valveOffLine: Math.abs((st.valvePin[0] - g.valvePoint[0]) * g.strokeDir[1] - (st.valvePin[1] - g.valvePoint[1]) * g.strokeDir[0]),
    leverBend: Math.abs((st.leverTop[0] - st.valvePin[0]) * (st.leverBottom[1] - st.valvePin[1]) - (st.leverTop[1] - st.valvePin[1]) * (st.leverBottom[0] - st.valvePin[0])),
    _drive: len(sub(side.pins.drive, drive)),
  };
}

/** 3x3 linear solve (Cramer), returns null if singular. */
function solve3(A: number[][], b: number[]): number[] | null {
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-18) return null;
  return [0, 1, 2].map((k) => det(A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))) / D);
}
