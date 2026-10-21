import type { HealthDataStore, CountySummary } from "../types/health";
import type { FeatureCollection } from "geojson";
import { sanitizeHealthData } from "./dataQuality";
import { dataUrls } from "./cityConfig";

let cachedHealthData: HealthDataStore | null = null;
let cachedSummary: CountySummary | null = null;
let cachedBoundaries: FeatureCollection | null = null;

export async function loadHealthData(): Promise<HealthDataStore> {
  if (cachedHealthData) return cachedHealthData;
  const res = await fetch(dataUrls.indicators);
  if (!res.ok) throw new Error(`Failed to load health data: ${res.status}`);
  cachedHealthData = sanitizeHealthData(await res.json());
  return cachedHealthData!;
}

export async function loadCountySummary(): Promise<CountySummary> {
  if (cachedSummary) return cachedSummary;
  const res = await fetch(dataUrls.summary);
  if (!res.ok) throw new Error(`Failed to load county summary: ${res.status}`);
  cachedSummary = await res.json();
  return cachedSummary!;
}

export async function loadBoundaries(): Promise<FeatureCollection> {
  if (cachedBoundaries) return cachedBoundaries;
  const res = await fetch(dataUrls.boundaries);
  if (!res.ok) throw new Error(`Failed to load boundaries: ${res.status}`);
  cachedBoundaries = await res.json();
  return cachedBoundaries!;
}

export async function loadAllData() {
  const [healthData, summary, boundaries] = await Promise.all([
    loadHealthData(),
    loadCountySummary(),
    loadBoundaries(),
  ]);
  return { healthData, summary, boundaries };
}
