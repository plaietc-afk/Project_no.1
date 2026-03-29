/** Format a dollar amount — 4 decimal places for sub-cent values, 2 otherwise */
export function fmt$(n: number): string {
  return n.toFixed(n < 0.01 ? 4 : 2);
}

/** Format a large number with K / M suffix */
export function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
