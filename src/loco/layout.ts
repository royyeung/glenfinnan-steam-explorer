// Converts spec values (d behind front buffer, h above rail) into the engine's local frame
// (z forward from the engine origin, y up) and builds the motion geometry.
import { B5, engineAxlesD, zEngine } from '../specs/black5.ts';
import { strokeDir, type MotionGeometry, type V2 } from './motion/solver.ts';
import type { ValveGearGeometry } from './motion/walschaerts.ts';

export function engineLayout() {
  const a = engineAxlesD();
  const rD = B5.driverDia.v / 2, rB = B5.bogieWheelDia.v / 2;
  return {
    axles: {
      bogieFront: { z: zEngine(a.bogieFront), y: rB, r: rB },
      bogieRear: { z: zEngine(a.bogieRear), y: rB, r: rB },
      lead: { z: zEngine(a.lead), y: rD, r: rD },
      drive: { z: zEngine(a.drive), y: rD, r: rD },
      trail: { z: zEngine(a.trail), y: rD, r: rD },
    },
    bogieCentreZ: zEngine((a.bogieFront + a.bogieRear) / 2),
  };
}

export function motionGeometry(): MotionGeometry {
  const L = engineLayout().axles;
  const cylZ = zEngine((B5.cylFrontD.v + B5.cylRearD.v) / 2);
  return {
    crankRadius: B5.crankRadius.v,
    conRodLength: B5.conRodLength.v,
    lead: [L.lead.z, L.lead.y],
    drive: [L.drive.z, L.drive.y],
    trail: [L.trail.z, L.trail.y],
    cylinderCentre: [cylZ, B5.cylCentreH.v],
    rightLeads: B5.rightSideLeads.v === 1,
  };
}

/**
 * Valve-gear geometry. Pin positions at mid gear are estimates (see specs); every link length is
 * derived from those positions so the gear closes exactly at mid stroke and mid gear.
 */
export function valveGearGeometry(): ValveGearGeometry {
  const m = motionGeometry(), w = strokeDir(m), down: V2 = [w[1], -w[0]];
  const v = (k: keyof typeof B5) => B5[k].v;
  const P = (d: number, h: number): V2 => [zEngine(d), h];
  const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const trunnion = P(v('trunnionD'), v('trunnionH'));
  const valvePoint = P(v('valveSpindleD'), v('valveChestH'));
  const top: V2 = [valvePoint[0], valvePoint[1] + v('leverTopToValve')];
  const bottom: V2 = [valvePoint[0], valvePoint[1] - v('leverValveToBottom')];
  const xhMid: V2 = [m.drive[0] + m.conRodLength * w[0], m.drive[1] + m.conRodLength * w[1]];
  const armMid: V2 = [xhMid[0] + down[0] * v('crossheadArmDrop'), xhMid[1] + down[1] * v('crossheadArmDrop')];
  const footMid: V2 = [trunnion[0], trunnion[1] - v('linkFootOffset')];
  const liftPivot = P(v('liftPivotD'), v('liftPivotH'));
  const rodDir: V2 = [(top[0] - trunnion[0]) / dist(top, trunnion), (top[1] - trunnion[1]) / dist(top, trunnion)];
  const slotMid: V2 = [trunnion[0] + rodDir[0] * v('liftSlotNominal'), trunnion[1] + rodDir[1] * v('liftSlotNominal')];
  // the arm points forward (+z) at mid gear; arm end straight above the slot pin
  const armEnd: V2 = [slotMid[0], liftPivot[1] - 0.02];
  const liftArmAngle0 = Math.atan2(armEnd[1] - liftPivot[1], armEnd[0] - liftPivot[0]);
  return {
    returnCrankThrow: v('returnCrankThrow'),
    returnCrankAngle: (v('returnCrankAngleDeg') * Math.PI) / 180,
    trunnion, footOffset: v('linkFootOffset'),
    eccentricRod: dist(footMid, m.drive),
    dieRange: v('dieRange'),
    radiusRod: dist(top, trunnion),
    leverTopToValve: v('leverTopToValve'), leverValveToBottom: v('leverValveToBottom'),
    unionLink: dist(bottom, armMid),
    crossheadArm: v('crossheadArmDrop'),
    valvePoint, strokeDir: w,
    liftPivot, liftArm: dist(armEnd, liftPivot), liftArmAngle0,
    liftLink: dist(armEnd, slotMid), liftSlotNominal: v('liftSlotNominal'),
  };
}
