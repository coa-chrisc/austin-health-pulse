import { THEME, scaleColor } from "./theme";
import type { IndicatorKey } from "../types/health";
import { INDICATOR_HIGHER_IS_BETTER } from "../types/health";

const BAD_TO_GOOD = THEME.dataScale;
const GOOD_TO_BAD = [...THEME.dataScale].reverse();

export function getColorForValue(
  value: number,
  min: number,
  max: number,
  indicator: IndicatorKey,
): string {
  if (max === min) return THEME.colors.noData;
  const scale = INDICATOR_HIGHER_IS_BETTER[indicator]
    ? BAD_TO_GOOD
    : GOOD_TO_BAD;
  return scaleColor(scale, (value - min) / (max - min));
}

export function getComparisonColor(
  value: number,
  countyAvg: number,
  higherIsBetter: boolean,
): string {
  const ratio = value / countyAvg;
  if (higherIsBetter) {
    if (ratio >= 1.05) return THEME.colors.positiveFill;
    if (ratio <= 0.95) return THEME.colors.negative;
    return THEME.colors.warning;
  } else {
    if (ratio <= 0.95) return THEME.colors.positiveFill;
    if (ratio >= 1.05) return THEME.colors.negative;
    return THEME.colors.warning;
  }
}
