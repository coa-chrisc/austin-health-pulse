import type { HealthDataStore, IndicatorKey } from "../types/health";

/**
 * ZCTAs whose residential population is too small (or institutional) for
 * reliable survey estimates. Keyed by ZCTA, value is the note shown in the UI.
 */
export const LOW_POPULATION_ZCTAS: Record<string, string> = {
  "78712":
    "Campus ZIP — small residential population; estimates unreliable.",
};

/** ACS-derived rates that are meaningless for low-population ZCTAs. */
const ACS_RATE_KEYS: IndicatorKey[] = ["povertyRate", "uninsuredRate"];

export function getDataQualityNote(zcta: string | null): string | null {
  return zcta ? (LOW_POPULATION_ZCTAS[zcta] ?? null) : null;
}

/**
 * Normalize loaded data so "no usable value" is always `null`:
 * non-finite numbers (NaN, undefined) become null, and ACS rates for
 * low-population ZCTAs (e.g. 78712 publishes 0.0% uninsured) are dropped
 * rather than shown as a real zero.
 */
export function sanitizeHealthData(store: HealthDataStore): HealthDataStore {
  for (const [zcta, data] of Object.entries(store.zctas)) {
    const row = data as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(row)) {
      if (
        (typeof value === "number" && !Number.isFinite(value)) ||
        value === undefined
      ) {
        row[field] = null;
      }
    }
    if (zcta in LOW_POPULATION_ZCTAS) {
      for (const key of ACS_RATE_KEYS) data[key] = null;
    }
  }
  return store;
}
