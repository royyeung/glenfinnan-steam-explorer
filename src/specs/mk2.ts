// BR Mark 2 (original/2A) Tourist Standard Open, as the maroon West Coast Railways TSOs (e.g. 5249,
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

/** Mark 2B TSO (5453, 5487): no centre vestibule, wide doors at the very ends, one toilet at each end
 * (S11, S12). Measured from photos of 5455 and E5482 (2B, BR blue/grey), proportions only. */
export const MK2B: SpecTable = {
  endPanel: spec(0.3, 'photo:5455', 'low', 'body end to the door opening'),
  doorWidth: spec(0.86, 'photo:5455', 'low', 'wide hinged door'),
  toiletLength: spec(1.05, 'photo:5455', 'low', 'blank panel between the door and the first window'),
  bays: spec(8, 'photo:5455,E5482', 'medium', 'eight windows each side, no centre door'),
  windowWidth: spec(1.5, 'photo:5455', 'low'),
};

/** Mark 1 TSO body (99318, ex-4912, converted with a buffet/shop at one end). Same length, width and
 * layout as the Mk2 TSO (S12, S15); narrower windows with sliding top vents, roof vents in two rows, a
 * visible solebar and trussed underframe. Window sizes from the Mk1 4346 and M4910 photos. */
export const MK1: SpecTable = {
  windowWidth: spec(1.25, 'photo:4346', 'low', 'window/bay-pitch ratio 0.64'),
  ventDepth: spec(0.28, 'photo:4346', 'low', 'two sliding panes at the top of each window'),
  dropBottomH: spec(2.12, 'photo:M4910', 'estimate', 'door drop-light'),
  solebarDepth: spec(0.3, 'photo:M4910', 'estimate'),
  buffetBays: spec(2, 'search snippet (forum): "buffet/shop at one end"', 'estimate', 'counter and shop in the two bays at the B end'),
};

export type CoachType = 'tso2' | 'tso2b' | 'fo2' | 'buffet1';
export interface Vehicle { num: string; type: CoachType; letter: string; what: string }

/** The 2026 Jacobite set, from the engine backwards, after a railforums.co.uk list (via search
 * snippets, Oct 2026): support coach 35517, 35486, 94225, BSO 9539, TSOs 5487, 5453, 5419, buffet/shop
 * 99318, first class 5229 and 5239. The register (S10) confirms all of them as WCR maroon vehicles.
 * Modelled: the six passenger coaches after the BSO. Order: forum list (low); letters: estimate. */
export const FORMATION: Vehicle[] = [
  { num: '5487', type: 'tso2b', letter: 'F', what: 'Mk2B TSO' },
  { num: '5453', type: 'tso2b', letter: 'E', what: 'Mk2B TSO' },
  { num: '5419', type: 'tso2', letter: 'D', what: 'Mk2A TSO' },
  { num: '99318', type: 'buffet1', letter: 'C', what: 'Mk1 TSO with buffet/shop' },
  { num: '5229', type: 'fo2', letter: 'B', what: 'Mk2 open, first class' },
  { num: '5239', type: 'fo2', letter: 'A', what: 'Mk2 open, first class' },
];
