import type { CountySummary, IndicatorKey } from "../types/health";

/**
 * False only when the loaded region has no source for the indicator
 * (summary entry is null, e.g. violent crime outside Austin). While the
 * summary is still loading we assume available.
 */
export function isIndicatorAvailable(
  summary: CountySummary | null,
  key: IndicatorKey,
): boolean {
  return summary?.indicators[key] !== null;
}
