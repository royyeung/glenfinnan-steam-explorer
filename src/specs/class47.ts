// BR Class 47 (Brush Type 4, Co-Co diesel-electric) in West Coast Railways maroon, as the diesel seen
// at the rear of the Jacobite on the viaduct on 22 Oct 2025 (S58; number not readable). Whether one
// runs at the rear in 2026 is unconfirmed: the 2024-25 diesel powered the air-conditioned Mk2s, and
// the 2026 Mk2s are not air-conditioned (S42). Local frame: origin at rail top, mid-length; +Z towards
// the No. 1 end (coupled to the train), +X left side.
import { ft, spec, type SpecTable } from './spec.ts';

const est = 'estimate';
export const C47: SpecTable = {
  lengthOverBuffers: spec(ft(63, 7), 'S63', 'high'),
  width: spec(ft(8, 10), 'S63', 'high'),
  height: spec(ft(12, 9.5), 'S63', 'high', 'rail to roof'),
  wheelDia: spec(ft(3, 9), 'S63', 'high'),
  wheelbase: spec(ft(51, 6), 'S63', 'high', 'outer axles'),
  bogieWheelbase: spec(ft(14, 6), est, est, 'Commonwealth-type Co bogie; total 51 ft 6 in less this gives the bogie centres'),
  bufferProjection: spec(0.46, est, est, 'buffer face to body end'),
  bodyBottomH: spec(1.12, 'photo:S64', 'low'),
  cantrailH: spec(3.3, 'photo:S64', 'low', 'top of the flat bodyside'),
  cabFrontH: spec(2.4, 'photo:S65', 'low', 'top of the near-vertical lower cab front'),
  windscreenTopH: spec(3.2, 'photo:S65', 'low'),
  windscreenRake: spec(0.32, 'photo:S64', 'low', 'set-back of the windscreen top'),
  cabLength: spec(1.9, 'photo:S64', 'low', 'body end to the cab back wall'),
  yellowBottomH: spec(1.75, 'photo:S65', 'low', 'small yellow warning panel under the windscreens (WCR livery)'),
};

/** Bogie centres from the published total wheelbase and the (estimated) bogie wheelbase. */
export const c47BogieCentres = () => C47.wheelbase.v - C47.bogieWheelbase.v;
