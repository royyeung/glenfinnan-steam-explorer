// BR Mark 2 (original) Tourist Standard Open, as the maroon West Coast Railways TSOs (e.g. 5249,
// photo S39) that run in the 2026 Jacobite set (S7: Mk2s with opening windows). Coach local frame:
// origin at rail top, mid-length; +Z towards the "A" end (towards the locomotive), +X left side.
// "a" = metres from the A-end body face along the coach.
import { ft, spec, type SpecTable } from './spec.ts';

const est = 'estimate';
export const MK2: SpecTable = {
  bodyLength: spec(ft(64, 6), 'S11,S14', 'high'),
  lengthOverBuffers: spec(ft(66, 0), 'S14', 'low'),
  bodyWidth: spec(ft(9, 3), 'S14', 'low', 'at the waist; tumblehome below'),
  height: spec(ft(12, 9.5), 'search snippet', 'low', 'rail to roof'),
  bogieCentres: spec(ft(46, 6), 'S15 (Mk1)', 'estimate', 'Mk1 figure; Mk2 assumed equal'),
  bogieWheelbase: spec(ft(8, 6), est, est, 'B4 bogie'),
  wheelDia: spec(ft(3, 0), est, est),
  floorH: spec(1.27, est, est, 'floor above rail'),
  bodyBottomH: spec(1.02, est, est, 'bottom of the body side'),
  waistH: spec(1.98, 'photo:S39', 'low', 'lining line under the windows'),
  windowBottomH: spec(2.05, 'photo:S39', 'low'),
  windowTopH: spec(2.86, 'photo:S39', 'low'),
  ventDepth: spec(0.22, 'photo:S39', 'low', 'top-hung opening vent at the top of each window'),
  cantrailH: spec(3.24, 'photo:S39', 'low'),
  doorWidth: spec(0.62, 'photo:S39', 'low', 'hinged slam door'),
  doorTopH: spec(3.18, est, est),
  // layout along the coach (a, from the A end): toilets, vestibule, saloon (4 bays), centre vestibule,
  // saloon (4 bays), vestibule at the B end. Bay pitch from the Mk1 TSO (S12), assumed for the Mk2.
  toiletLength: spec(1.12, 'photo:S39', 'low'),
  vestibuleLength: spec(0.92, 'photo:S39', 'low'),
  bayPitch: spec(ft(6, 6), 'S12 (Mk1)', 'medium'),
  baysPerSaloon: spec(4, 'photo:S39', 'medium', 'four windows each side per saloon'),
  windowWidth: spec(1.58, 'photo:S39', 'low'),
  seatWidth: spec(0.48, est, est),
  aisleWidth: spec(0.68, est, est),
  bufferH: spec(1.04, 'standard', 'medium'),
  bufferCentres: spec(ft(5, 8.5), 'standard', 'medium'),
  wallThickness: spec(0.06, est, est),
};

/** Running numbers for the formation: maroon WCR Mk2 TSOs on the 2026 register (S10). Order is an estimate. */
export const FORMATION = ['5249', '5229', '5222', '5216', '5200', '5171'];
