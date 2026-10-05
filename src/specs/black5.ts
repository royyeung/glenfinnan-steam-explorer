// LMS Stanier Class 5 4-6-0 No. 45407 and its tender, as running in 2025-26.
// Longitudinal positions are "d": metres behind the FRONT BUFFER FACE of the engine.
// Heights are "h": metres above RAIL TOP. Lateral offsets are from the track centreline.
import { ft, spec, type SpecTable } from './spec.ts';

const photo = 'photo:S33';
const front = 'photo:S35b';

export const B5: SpecTable = {
  // --- overall (published) ---
  lengthOverBuffers: spec(ft(63, 7.75), 'S1,S2', 'high', 'engine + tender'),
  height: spec(ft(12, 8), 'S2', 'high', 'rail to chimney top'),
  gauge: spec(1.435, 'S1', 'high'),

  // --- wheels ---
  driverDia: spec(ft(6), 'S1', 'high'),
  bogieWheelDia: spec(ft(3, 3.5), 'S1', 'high'),
  tenderWheelDia: spec(ft(4, 3), 'S26', 'medium'),
  driverSpokes: spec(20, 'estimate', 'estimate', 'count from photos in Phase 2'),
  wheelTreadOffset: spec(0.75, 'standard-practice', 'estimate', 'tread centre from track centre'),

  // --- wheel positions (d) ---
  axleBogieFront: spec(1.455, photo, 'medium', '±0.05'),
  bogieWheelbase: spec(ft(6, 3), 'estimate', 'estimate', 'fits 27ft2in total; photo suggests up to +0.25 m'),
  bogieToCoupled: spec(ft(5, 11), 'estimate', 'estimate', 'fits 27ft2in total'),
  coupledLeadToDriving: spec(ft(7, 0), 'S24', 'medium'),
  coupledDrivingToTrailing: spec(ft(8, 0), 'S24', 'medium', 'photo check: 2.447 m'),

  // --- cylinders & motion ---
  cylBore: spec(ft(0, 18.5), 'S1', 'high'),
  stroke: spec(ft(0, 28), 'S1', 'high'),
  crankRadius: spec(ft(0, 14), 'S1', 'high', 'stroke / 2'),
  cylFrontD: spec(2.07, photo, 'medium', 'clad block incl. valve chest'),
  cylRearD: spec(3.02, photo, 'medium'),
  cylCentreH: spec(1.0, 'estimate', 'estimate', 'between photo block 0.66-1.72'),
  cylCladDia: spec(0.66, 'estimate', 'estimate'),
  cylLateral: spec(0.98, 'estimate', 'estimate', 'line of stroke from track centre (= con rod plane)'),
  valveChestH: spec(1.48, 'estimate', 'estimate'),
  valveChestDia: spec(0.42, 'estimate', 'estimate'),
  conRodLength: spec(ft(10, 0), 'estimate', 'estimate', 'needs valve gear drawing D02'),
  couplingRodLateral: spec(0.88, 'estimate', 'estimate'),
  conRodLateral: spec(0.98, 'estimate', 'estimate', 'same plane as cylinder centre line'),
  rightSideLeads: spec(1, 'estimate', 'estimate', '1 = right crank leads left by 90°'),

  // --- Walschaerts valve gear (no drawing available: positions estimated from photos, lengths derived) ---
  valveGearLateral: spec(1.08, 'estimate', 'estimate', 'plane of radius rod / combination lever'),
  returnCrankThrow: spec(0.15, 'estimate', 'estimate', 'return-crank pin from the main crankpin'),
  returnCrankAngleDeg: spec(-90, 'estimate', 'estimate', 'return crank relative to main crank'),
  trunnionD: spec(5.76, 'photo:S33', 'medium', 'expansion link centre, between leading and driving axles'),
  trunnionH: spec(1.44, 'photo:S33', 'medium'),
  linkFootOffset: spec(0.4, 'estimate', 'estimate', 'trunnion to eccentric-rod pin'),
  dieRange: spec(0.24, 'estimate', 'estimate', 'die travel either side of the trunnion at full gear'),
  valveSpindleD: spec(3.45, 'photo:S33', 'low', 'combination lever position (photo, partly hidden)'),
  leverTopToValve: spec(0.1, 'estimate', 'estimate'),
  leverValveToBottom: spec(0.7, 'estimate', 'estimate'),
  crossheadArmDrop: spec(0.2, 'estimate', 'estimate'),
  liftPivotD: spec(5.75, 'estimate', 'estimate', 'reversing shaft, above the link'),
  liftPivotH: spec(1.8, 'estimate', 'estimate'),
  liftArm: spec(0.33, 'estimate', 'estimate'),
  liftSlotNominal: spec(0.35, 'estimate', 'estimate'),

  // --- buffers & beam ---
  bufferH: spec(1.04, photo, 'medium'),
  bufferCentres: spec(ft(5, 8.5), 'standard-practice', 'medium'),
  bufferHeadDia: spec(0.39, front, 'medium'),
  bufferProjection: spec(0.53, photo, 'medium', 'face to beam front'),
  beamWidth: spec(2.33, front, 'medium'),
  beamDepth: spec(0.47, front, 'medium'),
  beamTopH: spec(1.27, photo, 'medium'),

  // --- running plate & frames ---
  runningPlateH: spec(1.9, photo, 'medium'),
  runningPlateWidth: spec(2.6, front, 'medium'),
  runningPlateDropD: spec(1.47, photo, 'medium', 'front drop starts here'),
  frameWidth: spec(1.24, 'estimate', 'estimate', 'outside of plate frames'),
  frameTopH: spec(1.72, 'estimate', 'estimate'),
  frameBottomH: spec(0.62, 'estimate', 'estimate'),
  engineRearD: spec(12.4, 'estimate', 'estimate', 'drawbar'),

  // --- smokebox, chimney, boiler, firebox ---
  smokeboxDoorD: spec(1.27, photo, 'medium'),
  smokeboxFrontD: spec(1.41, photo, 'medium'),
  smokeboxRearD: spec(3.34, photo, 'medium', '±0.05'),
  smokeboxTopH: spec(3.48, photo, 'medium'),
  smokeboxDia: spec(1.71, front, 'medium'),
  doorRingDia: spec(1.52, front, 'medium'),
  chimneyD: spec(2.51, photo, 'medium'),
  chimneyLipDia: spec(0.64, photo, 'medium', 'front view 0.65'),
  barrelFrontDia: spec(1.6, 'estimate', 'estimate', 'taper boiler, flat bottom line assumed'),
  barrelRearDia: spec(1.73, 'estimate', 'estimate', 'gives top 3.55 at rear (photo 3.55)'),
  barrelRearD: spec(7.3, photo, 'medium', 'barrel/firebox seam'),
  fireboxTopH: spec(3.65, photo, 'medium'),
  fireboxWidthTop: spec(1.75, 'estimate', 'estimate', 'Belpaire top'),
  domeD: spec(6.66, photo, 'medium'),
  domeTopH: spec(3.85, photo, 'medium', 'about level with chimney'),
  domeDia: spec(0.88, photo, 'medium'),
  topFeedD: spec(5.78, photo, 'medium'),
  topFeedTopH: spec(3.75, photo, 'medium'),
  safetyValveD: spec(9.03, photo, 'medium'),

  // --- details measured on S33 (right side) ---
  steamPipeD: spec(2.52, photo, 'medium', 'outside steam pipe casing, smokebox to cylinder'),
  lubricator1D: spec(7.58, photo, 'medium', 'mechanical lubricator (right side)'),
  lubricator2D: spec(7.15, photo, 'medium', 'mechanical lubricator (right side)'),
  nameplateFrontD: spec(4.49, photo, 'medium'),
  nameplateRearD: spec(5.66, photo, 'medium'),
  boilerBandsD: spec(0, photo, 'medium', 'bands at d = 4.86, 6.16, 7.37 (and barrel ends)'),
  frontStepD: spec(0.85, photo, 'medium', 'footsteps below the front drop plate'),
  // --- cab ---
  cabFrontD: spec(10.06, photo, 'medium'),
  cabRoofRearD: spec(12.64, photo, 'medium', '±0.10'),
  cabRoofH: spec(3.71, photo, 'medium'),
  cabSideBottomH: spec(1.33, photo, 'medium', 'below the number panel (panel bottom 1.40); corrected in Phase 2'),
  cabWidth: spec(2.62, 'estimate', 'estimate', 'not measurable from photos (perspective)'),
  cabWindowFrontD: spec(10.32, photo, 'medium'),
  cabWindowRearD: spec(11.52, photo, 'medium'),
  cabWindowBottomH: spec(2.39, photo, 'medium'),
  cabWindowTopH: spec(3.06, photo, 'medium'),
  cabOpeningFrontD: spec(11.79, 'photo:S33', 'medium', 'cab entrance (crew lean out here)'),
  cabOpeningRearD: spec(12.43, 'photo:S33', 'medium', 'rear edge of the cab side'),
  cabGateTopH: spec(2.59, 'photo:S33', 'medium', 'top of the half-height cab gate (armrest)'),
  footplateH: spec(1.6, 'estimate', 'estimate', 'cab floor above rail'),
  cabStepUpperH: spec(1.15, 'estimate', 'estimate'),
  cabStepLowerH: spec(0.62, 'estimate', 'estimate'),

  // --- tender (Stanier 4,000 gal family; 45407 has a 4,710 gal tank, S2) ---
  tenderFrontD: spec(12.51, photo, 'medium'),
  tenderBodyRearD: spec(18.98, photo, 'medium'),
  tenderSideTopH: spec(3.31, photo, 'medium', 'coal space sides'),
  tenderTankTopH: spec(2.66, photo, 'medium', 'rear tank top'),
  tenderStepD: spec(17.66, photo, 'medium', 'coal space ends / tank top begins'),
  tenderTankBottomH: spec(1.19, photo, 'medium'),
  tenderWidth: spec(2.6, 'estimate', 'estimate'),
  tenderWheelbaseEach: spec(ft(7, 6), 'S25', 'medium'),
  tenderAxlesCentreD: spec(15.745, 'estimate', 'estimate', 'symmetric about tender body centre'),
};

/** Axle positions (d) derived from the wheelbase chain; cross-checked against the photo. */
export function engineAxlesD(s: SpecTable = B5) {
  const bf = s.axleBogieFront.v;
  const br = bf + s.bogieWheelbase.v;
  const lead = br + s.bogieToCoupled.v;
  const drive = lead + s.coupledLeadToDriving.v;
  const trail = drive + s.coupledDrivingToTrailing.v;
  return { bogieFront: bf, bogieRear: br, lead, drive, trail };
}

export function tenderAxlesD(s: SpecTable = B5) {
  const c = s.tenderAxlesCentreD.v, w = s.tenderWheelbaseEach.v;
  return [c - w, c, c + w];
}

// Vehicle origins (local frame: +Z forward, +X left, Y up, origin at rail top).
// The engine origin sits halfway between its front buffer face and its drawbar; the tender
// origin halfway between its front and its rear buffer face.
export const ENGINE_ORIGIN_D = B5.engineRearD.v / 2;
export const TENDER_ORIGIN_D = (B5.tenderFrontD.v + B5.lengthOverBuffers.v) / 2;
export const zEngine = (d: number) => ENGINE_ORIGIN_D - d;
export const zTender = (d: number) => TENDER_ORIGIN_D - d;
