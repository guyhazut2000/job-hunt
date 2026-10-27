/** Linear-interpolated percentile of a numeric sample (p in [0,1]). */
export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export const roundTo = (v: number, step: number) => Math.round(v / step) * step;
