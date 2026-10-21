import type { HealthDataStore } from "../types/health";

/** Sorted ZIP list for the loaded region (the data file is the source of truth). */
export function listZips(store: HealthDataStore | null): string[] {
  return store ? Object.keys(store.zctas).sort() : [];
}
