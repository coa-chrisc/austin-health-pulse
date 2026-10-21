import { describe, it, expect } from "vitest";
import {
  availableLevers,
  lifeExpectancyExtremes,
  partitionLevers,
  simulateLever,
  targetAtProgress,
} from "./equityScenario";
import type { ScenarioFit, ScenarioModel } from "../types/scenario";
import type { ZctaHealthData } from "../types/health";

function fit(
  indicator: ScenarioFit["indicator"],
  overrides: Partial<ScenarioFit> = {},
): ScenarioFit {
  return {
    indicator,
    slope: -0.5,
    slopeSE: 0.1,
    slopeCI95: [-0.7, -0.3],
    intercept: 85,
    r2: 0.6,
    n: 60,
    observedMin: 5,
    observedMax: 40,
    bestZip: "11111",
    ...overrides,
  };
}

function row(overrides: Partial<ZctaHealthData> = {}): ZctaHealthData {
  return {
    lifeExpectancy: 76,
    lifeExpectancySE: 1,
    povertyRate: 25,
    uninsuredRate: 20,
    diabetes: 14,
    hypertension: 33,
    obesity: 38,
    asthma: 9,
    violentCrimeRate: null,
    ageSpecific: null,
    dataQuality: "complete",
    ...overrides,
  };
}

const model: ScenarioModel = {
  method: "bivariate-ols",
  outcome: "lifeExpectancy",
  levers: [fit("povertyRate"), fit("uninsuredRate"), fit("diabetes", { observedMin: 3 })],
  excluded: [],
};

describe("simulateLever", () => {
  const f = fit("uninsuredRate");

  it("gives a positive delta for an improvement with a negative slope", () => {
    const sim = simulateLever(f, 20, 10, 76, 86);
    expect(sim.deltaYears).toBeCloseTo(5);
    expect(sim.projectedLE).toBeCloseTo(81);
  });

  it("gives zero delta when target equals current", () => {
    const sim = simulateLever(f, 20, 20, 76, 86);
    expect(sim.deltaYears).toBeCloseTo(0);
    expect(sim.deltaLow).toBeCloseTo(0);
    expect(sim.deltaHigh).toBeCloseTo(0);
    expect(sim.projectedLE).toBe(76);
  });

  it("orders CI bounds so they bracket the point estimate", () => {
    const improve = simulateLever(f, 20, 10, 76, 86);
    expect(improve.deltaLow).toBeLessThanOrEqual(improve.deltaYears);
    expect(improve.deltaHigh).toBeGreaterThanOrEqual(improve.deltaYears);
    expect(improve.deltaLow).toBeCloseTo(3);
    expect(improve.deltaHigh).toBeCloseTo(7);
    // Worsening flips the signs; bounds must still be ordered.
    const worsen = simulateLever(f, 10, 20, 76, 86);
    expect(worsen.deltaLow).toBeLessThanOrEqual(worsen.deltaYears);
    expect(worsen.deltaHigh).toBeGreaterThanOrEqual(worsen.deltaYears);
  });

  it("never reports a negative projected gap", () => {
    const sim = simulateLever(f, 30, 5, 80, 82);
    expect(sim.projectedLE).toBeGreaterThan(82);
    expect(sim.projectedGap).toBe(0);
    expect(sim.currentGap).toBeCloseTo(2);
  });

  it("shrinks the gap by the delta when it does not overshoot", () => {
    const sim = simulateLever(f, 20, 10, 76, 86);
    expect(sim.currentGap).toBeCloseTo(10);
    expect(sim.projectedGap).toBeCloseTo(5);
  });
});

describe("targetAtProgress", () => {
  it("interpolates from the current rate to the best observed rate", () => {
    const f = fit("obesity", { observedMin: 10 });
    expect(targetAtProgress(f, 30, 0)).toBe(30);
    expect(targetAtProgress(f, 30, 0.5)).toBe(20);
    expect(targetAtProgress(f, 30, 1)).toBe(10);
  });
});

describe("availableLevers", () => {
  it("returns every lever with room to improve for a normal ZIP", () => {
    const keys = availableLevers(model, "22222", row(), {}).map((l) => l.fit.indicator);
    expect(keys).toEqual(["povertyRate", "uninsuredRate", "diabetes"]);
  });

  it("excludes levers where the ZIP value is null", () => {
    const keys = availableLevers(model, "22222", row({ povertyRate: null }), {}).map(
      (l) => l.fit.indicator,
    );
    expect(keys).toEqual(["uninsuredRate", "diabetes"]);
  });

  it("excludes a ZIP already at the best observed rate (no room to improve)", () => {
    const atMin = row({ uninsuredRate: 5, povertyRate: 4 });
    const { available, unavailable } = partitionLevers(model, "22222", atMin, {});
    expect(available.map((l) => l.fit.indicator)).toEqual(["diabetes"]);
    expect(unavailable.map((u) => u.fit.indicator)).toEqual(["povertyRate", "uninsuredRate"]);
  });

  it("gives a ZIP at observedMin on its only lever no levers at all", () => {
    const only: ScenarioModel = { ...model, levers: [fit("diabetes", { observedMin: 14 })] };
    expect(availableLevers(only, "22222", row({ diabetes: 14 }), {})).toEqual([]);
  });

  it("excludes ACS levers (not chronic-disease levers) for data-quality ZIPs", () => {
    const keys = availableLevers(model, "78712", row(), { "78712": "Campus ZIP" }).map(
      (l) => l.fit.indicator,
    );
    expect(keys).toEqual(["diabetes"]);
  });

  it("returns nothing when the ZIP has no life expectancy", () => {
    expect(availableLevers(model, "22222", row({ lifeExpectancy: null }), {})).toEqual([]);
  });
});

describe("lifeExpectancyExtremes", () => {
  it("finds the longest- and shortest-lived ZIPs, skipping null LE", () => {
    const { top, bottom } = lifeExpectancyExtremes({
      "1": row({ lifeExpectancy: 80 }),
      "2": row({ lifeExpectancy: 70 }),
      "3": row({ lifeExpectancy: null }),
      "4": row({ lifeExpectancy: 85 }),
    });
    expect(top).toEqual({ zip: "4", le: 85 });
    expect(bottom).toEqual({ zip: "2", le: 70 });
  });
});
