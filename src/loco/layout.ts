// Converts spec values (d behind front buffer, h above rail) into the engine's local frame
// (z forward from the engine origin, y up) and builds the motion geometry.
import { B5, engineAxlesD, zEngine } from '../specs/black5.ts';
import type { MotionGeometry } from './motion/solver.ts';

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
