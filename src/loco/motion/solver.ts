// Exact planar kinematics of the coupled wheels, coupling rods, connecting rod and crosshead.
// Everything is solved from one input, the wheel rotation angle, so parts cannot drift apart:
// coupling rods join crankpins that share one phase (constant length by construction) and the
// crosshead is the exact slider-crank solution on the line of stroke.
//
// Frame: the engine's side plane (z forward, y up), metres. Both sides use the same frame;
// they differ only by crank phase (quartered at 90 degrees).

export type V2 = readonly [number, number];

export interface MotionGeometry {
  crankRadius: number;
  conRodLength: number;
  lead: V2; // axle centres (z, y)
  drive: V2;
  trail: V2;
  cylinderCentre: V2; // a point on the line of stroke (piston at mid-stroke sits here)
  rightLeads: boolean;
}

export interface SideState {
  phi: number; // crank angle in the side plane (rad, from +z towards +y)
  pins: { lead: V2; drive: V2; trail: V2 };
  crosshead: V2;
  piston: V2; // piston centre
  stroke01: number; // 0 = fully forward (front dead centre) … 1 = fully back
}

export interface MotionState {
  theta: number;
  left: SideState;
  right: SideState;
}

const sub = (a: V2, b: V2): [number, number] => [a[0] - b[0], a[1] - b[1]];
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const len = (a: V2) => Math.hypot(a[0], a[1]);

/** Unit vector along the line of stroke, from the driving axle towards the cylinder. */
export function strokeDir(g: MotionGeometry): [number, number] {
  const v = sub(g.cylinderCentre, g.drive), l = len(v);
  return [v[0] / l, v[1] / l];
}

function side(g: MotionGeometry, phi: number): SideState {
  const r = g.crankRadius, c = Math.cos(phi), s = Math.sin(phi);
  const pin = (a: V2): V2 => [a[0] + r * c, a[1] + r * s];
  const pins = { lead: pin(g.lead), drive: pin(g.drive), trail: pin(g.trail) };
  const w = strokeDir(g), q = sub(pins.drive, g.drive), wq = dot(w, q);
  const L = g.conRodLength;
  const sAlong = wq + Math.sqrt(wq * wq - dot(q, q) + L * L);
  const crosshead: V2 = [g.drive[0] + sAlong * w[0], g.drive[1] + sAlong * w[1]];
  const off = sAlong - L; // -r … +r about mid-stroke
  const piston: V2 = [g.cylinderCentre[0] + off * w[0], g.cylinderCentre[1] + off * w[1]];
  return { phi, pins, crosshead, piston, stroke01: (r - off) / (2 * r) };
}

/**
 * theta: wheel rotation in radians, positive for forward travel (distance = theta * wheel radius).
 * Forward rolling turns the wheel clockwise in the (z right, y up) side view, so phi decreases.
 */
export function solveMotion(g: MotionGeometry, theta: number): MotionState {
  const phiLeft = -theta;
  const phiRight = phiLeft + (g.rightLeads ? -Math.PI / 2 : Math.PI / 2);
  return { theta, left: side(g, phiLeft), right: side(g, phiRight) };
}

/** Pin-to-pin lengths, for tests and the verification harness. */
export function rodLengths(st: SideState) {
  return {
    couplingFront: len(sub(st.pins.drive, st.pins.lead)),
    couplingRear: len(sub(st.pins.trail, st.pins.drive)),
    conRod: len(sub(st.crosshead, st.pins.drive)),
  };
}
