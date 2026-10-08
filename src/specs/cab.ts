// Cab interior of 45407. No drawing or photo of 45407's own cab is public (REFERENCE §4), so
// the layout follows a Black Five backhead photo (S41, class-level), the 44871 footplate photo
// (same owner, same modernisation), and the labelled control list of 45407/44871/45212 (S27).
// d = metres behind the front buffer, h = above rail, x = side (+ left = driver's side).
import { spec, type SpecTable } from './spec.ts';

const est = 'estimate';
export const CAB: SpecTable = {
  backheadD: spec(10.42, est, est, 'backhead face; firebox protrudes ~0.36 m into the cab'),
  fireholeH: spec(2.18, 'photo:44871', 'low', 'firehole centre, ~0.58 m above the floor'),
  fireholeR: spec(0.2, 'photo:44871', 'low'),
  floorWoodFromD: spec(11.0, 'photo:44871', 'low', 'chequer plate in front, wooden boards behind'),
  tenderFrontD: spec(12.51, 'photo:S33', 'medium'),
  manifoldH: spec(3.32, 'photo:S41', 'low', 'steam manifold (turret) on top of the backhead'),
  gaugeGlassX: spec(0.3, 'photo:S41', 'low', 'two water gauges either side of centre'),
  gaugeGlassH0: spec(2.72, 'photo:S41', 'low'),
  gaugeGlassH1: spec(3.05, 'photo:S41', 'low'),
  seatH: spec(2.28, est, est, 'tip-up seats on the cab sides'),
  innerLining: spec(0.03, est, est, 'cream-painted inner sheets'),
};
