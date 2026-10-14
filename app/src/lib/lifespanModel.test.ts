import { describe, expect, it } from "vitest";
import {
  bmiFromHeightWeight,
  computeLifespan,
  defaultInputs,
  topImprovements,
  type LifespanInputs,
} from "./lifespanModel";

const inputs = (overrides: Partial<LifespanInputs>): LifespanInputs => ({
  ...defaultInputs(),
  ...overrides,
});

const smokingDelta = (i: LifespanInputs) =>
  computeLifespan(i).factors.find((f) => f.key === "smoking")!.delta;

describe("smoking delta", () => {
  it("caps a former smoker's quit age at their current age", () => {
    // A 30-year-old can't have quit at 70; treat it as quitting at 30.
    const future = inputs({ age: 30, smokingStatus: "former", ageAtQuit: 70 });
    const now = inputs({ age: 30, smokingStatus: "former", ageAtQuit: 30 });
    expect(smokingDelta(future)).toBe(smokingDelta(now));
    expect(smokingDelta(future)).toBe(0);
  });

  it("uses the stated quit age when it is in the past", () => {
    expect(
      smokingDelta(inputs({ age: 70, smokingStatus: "former", ageAtQuit: 55 })),
    ).toBe(-7);
  });
});

describe("topImprovements", () => {
  const smokingGain = (age: number) =>
    topImprovements(inputs({ age, smokingStatus: "current" }), 6).find(
      (o) => o.factor === "smoking",
    )?.potentialGain;

  it("credits a 60-year-old smoker only with quitting now (~3 yrs, Doll & Peto)", () => {
    expect(smokingGain(60)).toBe(3);
  });

  it("credits a 35-year-old smoker with most of the 10-year loss", () => {
    expect(smokingGain(35)).toBe(9);
  });
});

describe("computeLifespan", () => {
  it("returns finite values and never projects below current age", () => {
    for (const age of [18, 50, 85, 100]) {
      const worst = computeLifespan(
        inputs({
          age,
          smokingStatus: "current",
          secondhand: true,
          exerciseMinutesPerWeek: 0,
          dietScore: 1,
          bmi: 50,
          sleepHours: 3,
          stressScore: 5,
        }),
      );
      expect(Number.isFinite(worst.totalLifespan)).toBe(true);
      expect(worst.totalLifespan).toBeGreaterThanOrEqual(age);
      expect(worst.remainingYears).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("bmiFromHeightWeight", () => {
  it("computes imperial BMI", () => {
    expect(bmiFromHeightWeight(68, 160)).toBeCloseTo(24.3, 1);
  });

  it("returns 0 for non-positive inputs instead of Infinity/NaN", () => {
    expect(bmiFromHeightWeight(0, 160)).toBe(0);
    expect(bmiFromHeightWeight(68, 0)).toBe(0);
  });
});
