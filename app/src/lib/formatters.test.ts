import { describe, expect, it } from "vitest";
import { formatValue } from "./formatters";
import { sanitizeHealthData, getDataQualityNote } from "./dataQuality";
import type { HealthDataStore, ZctaHealthData } from "../types/health";

const row = (o: Partial<ZctaHealthData> = {}): ZctaHealthData => ({
  lifeExpectancy: 80,
  lifeExpectancySE: 1,
  povertyRate: 10,
  uninsuredRate: 5,
  diabetes: 9,
  hypertension: 27,
  obesity: 30,
  asthma: 9,
  violentCrimeRate: 3,
  ageSpecific: null,
  dataQuality: "complete",
  ...o,
});

describe("formatValue with missing values", () => {
  it("renders null, undefined and NaN as N/A, not 0", () => {
    for (const unit of ["%", "years", "per1k"]) {
      expect(formatValue(null, unit)).toBe("N/A");
      expect(formatValue(undefined, unit)).toBe("N/A");
      expect(formatValue(NaN, unit)).toBe("N/A");
    }
  });
  it("still formats a genuine zero", () => {
    expect(formatValue(0, "%")).toBe("0.0%");
  });
});

describe("sanitizeHealthData", () => {
  const store = (): HealthDataStore => ({
    zctas: {
      "78712": row({ uninsuredRate: 0, povertyRate: null }),
      "78701": row({ asthma: NaN, uninsuredRate: 0 }),
    },
    meta: {} as HealthDataStore["meta"],
  });

  it("nulls ACS rates for low-population ZIPs and flags them", () => {
    const out = sanitizeHealthData(store());
    expect(out.zctas["78712"].uninsuredRate).toBeNull();
    expect(getDataQualityNote("78712")).toMatch(/Campus ZIP/);
    expect(getDataQualityNote("78701")).toBeNull();
  });
  it("coerces non-finite values to null but keeps real zeros elsewhere", () => {
    const out = sanitizeHealthData(store());
    expect(out.zctas["78701"].asthma).toBeNull();
    expect(out.zctas["78701"].uninsuredRate).toBe(0);
  });
});
