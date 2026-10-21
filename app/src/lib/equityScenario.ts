import type {
  ScenarioFit,
  ScenarioLeverKey,
  ScenarioModel,
} from "../types/scenario";
import type { ZctaHealthData } from "../types/health";

/** ACS-derived levers are unreliable for data-quality ZIPs (e.g. campus ZIPs). */
const ACS_LEVERS: ScenarioLeverKey[] = ["povertyRate", "uninsuredRate"];

/** Population-level phrasing for each lever (no individual framing). */
export const LEVER_COPY: Record<
  ScenarioLeverKey,
  { name: string; tab: string; measure: string }
> = {
  povertyRate: {
    name: "poverty rate",
    tab: "Poverty",
    measure: "Share of residents below the poverty line",
  },
  uninsuredRate: {
    name: "uninsured rate",
    tab: "Uninsured",
    measure: "Share of residents uninsured",
  },
  diabetes: {
    name: "diabetes prevalence",
    tab: "Diabetes",
    measure: "Diabetes prevalence among adults",
  },
  hypertension: {
    name: "hypertension prevalence",
    tab: "Hypertension",
    measure: "Hypertension prevalence among adults",
  },
  obesity: {
    name: "obesity prevalence",
    tab: "Obesity",
    measure: "Obesity prevalence among adults",
  },
};

export interface LeverOption {
  fit: ScenarioFit;
  /** The ZIP's current value of the lever indicator. */
  current: number;
}

export interface UnavailableLever {
  fit: ScenarioFit;
  reason: string;
}

/**
 * Split the model's levers into those usable for one ZIP and those not.
 * Usable = ZIP has a life expectancy and a non-null current value that sits
 * above the best observed ZIP (room to improve); ACS levers are dropped for
 * ZIPs flagged in `dataQualityNotes`.
 */
export function partitionLevers(
  model: ScenarioModel,
  zip: string,
  row: ZctaHealthData,
  dataQualityNotes: Record<string, string>,
): { available: LeverOption[]; unavailable: UnavailableLever[] } {
  const available: LeverOption[] = [];
  const unavailable: UnavailableLever[] = [];
  for (const fit of model.levers) {
    const current = row[fit.indicator];
    if (row.lifeExpectancy === null) {
      unavailable.push({ fit, reason: "no life expectancy estimate for this ZIP" });
    } else if (ACS_LEVERS.includes(fit.indicator) && zip in dataQualityNotes) {
      unavailable.push({ fit, reason: "survey estimate unreliable for this ZIP" });
    } else if (current === null) {
      unavailable.push({ fit, reason: "no value published for this ZIP" });
    } else if (current <= fit.observedMin) {
      unavailable.push({ fit, reason: "already at the best observed rate" });
    } else {
      available.push({ fit, current });
    }
  }
  return { available, unavailable };
}

export function availableLevers(
  model: ScenarioModel,
  zip: string,
  row: ZctaHealthData,
  dataQualityNotes: Record<string, string>,
): LeverOption[] {
  return partitionLevers(model, zip, row, dataQualityNotes).available;
}

export interface LeverSimulation {
  /** Years of life expectancy associated with moving current -> target. */
  deltaYears: number;
  /** 95% CI bounds on deltaYears, ordered low <= high. */
  deltaLow: number;
  deltaHigh: number;
  projectedLE: number;
  currentGap: number;
  /** Remaining gap to the top ZIP after the change; never negative. */
  projectedGap: number;
}

export function simulateLever(
  fit: ScenarioFit,
  currentRate: number,
  targetRate: number,
  currentLE: number,
  topLE: number,
): LeverSimulation {
  const dx = targetRate - currentRate;
  const deltaYears = fit.slope * dx;
  const [a, b] = fit.slopeCI95.map((slope) => slope * dx);
  const projectedLE = currentLE + deltaYears;
  return {
    deltaYears,
    deltaLow: Math.min(a, b),
    deltaHigh: Math.max(a, b),
    projectedLE,
    currentGap: topLE - currentLE,
    projectedGap: Math.max(0, topLE - projectedLE),
  };
}

/** Target rate a given fraction (0..1) of the way from the current rate to the best observed rate. */
export function targetAtProgress(
  fit: ScenarioFit,
  currentRate: number,
  progress: number,
): number {
  return currentRate + progress * (fit.observedMin - currentRate);
}

/** Longest- and shortest-lived ZIPs among those with a life expectancy. */
export function lifeExpectancyExtremes(
  zctas: Record<string, ZctaHealthData>,
): { top: { zip: string; le: number }; bottom: { zip: string; le: number } } {
  let top: { zip: string; le: number } | null = null;
  let bottom: { zip: string; le: number } | null = null;
  for (const [zip, row] of Object.entries(zctas)) {
    const le = row.lifeExpectancy;
    if (le === null) continue;
    if (!top || le > top.le) top = { zip, le };
    if (!bottom || le < bottom.le) bottom = { zip, le };
  }
  return { top: top!, bottom: bottom! };
}
