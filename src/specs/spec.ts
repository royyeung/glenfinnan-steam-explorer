// Every dimension used by the geometry is a Spec: value (metres unless noted), where it came
// from, and how sure we are. Sources refer to REFERENCE.md (S1…S41) or photo measurements
// (docs/research/photo-measurements.md). 'estimate' marks a placeholder awaiting better data.

export type Confidence = 'high' | 'medium' | 'low' | 'estimate';

export interface Spec {
  readonly v: number;
  readonly src: string;
  readonly conf: Confidence;
  readonly note?: string;
}

export const spec = (v: number, src: string, conf: Confidence, note?: string): Spec => ({ v, src, conf, note });

/** Imperial to metres: ft(6) = 1.8288, ft(3, 3.5) = 1.0033. */
export const ft = (feet: number, inches = 0): number => (feet * 12 + inches) * 0.0254;

export type SpecTable = Readonly<Record<string, Spec>>;

/** Entries that are not yet backed by a reliable source (shown in amber in the tuning panel). */
export function weakSpecs(table: SpecTable): { key: string; spec: Spec }[] {
  return Object.entries(table)
    .filter(([, s]) => s.conf === 'low' || s.conf === 'estimate')
    .map(([key, s]) => ({ key, spec: s }));
}
