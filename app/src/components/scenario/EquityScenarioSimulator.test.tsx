import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import EquityScenarioSimulator from "./EquityScenarioSimulator";
import { HealthDataContext } from "../../hooks/useHealthData";
import type {
  CountySummary,
  HealthDataStore,
  ZctaHealthData,
} from "../../types/health";
import type { ScenarioFit, ScenarioModel } from "../../types/scenario";

function row(le: number, uninsured: number | null, diabetes: number | null): ZctaHealthData {
  return {
    lifeExpectancy: le,
    lifeExpectancySE: 1,
    povertyRate: 10,
    uninsuredRate: uninsured,
    diabetes,
    hypertension: 25,
    obesity: 30,
    asthma: 9,
    violentCrimeRate: null,
    ageSpecific: null,
    dataQuality: "complete",
  };
}

const store: HealthDataStore = {
  zctas: {
    "10001": row(76, 22, 14),
    "10002": row(82, 6, 7),
    "10003": row(79, 12, 10),
  },
  meta: {
    generated: "2026-01-01",
    sources: {},
    countyAverage: {
      lifeExpectancy: 79,
      povertyRate: 10,
      uninsuredRate: 13,
      diabetes: 10,
      hypertension: 25,
      obesity: 30,
      asthma: 9,
      violentCrimeRate: null,
    },
  },
};

const uninsuredFit: ScenarioFit = {
  indicator: "uninsuredRate",
  slope: -0.4,
  slopeSE: 0.1,
  slopeCI95: [-0.6, -0.2],
  intercept: 84,
  r2: 0.71,
  n: 3,
  observedMin: 6,
  observedMax: 22,
  bestZip: "10002",
};

function summaryWith(levers: ScenarioFit[]): CountySummary {
  const ind = {
    min: 0,
    max: 1,
    avg: 0,
    median: 0,
    p25: 0,
    p75: 0,
    unit: "%",
    higherIsBetter: false,
  };
  const scenarioModel: ScenarioModel = {
    method: "bivariate-ols",
    outcome: "lifeExpectancy",
    levers,
    excluded: [{ ...uninsuredFit, indicator: "obesity", reason: "CI includes zero" }],
  };
  return {
    indicators: {
      lifeExpectancy: { ...ind, min: 76, max: 82, unit: "years", higherIsBetter: true },
      povertyRate: ind,
      uninsuredRate: ind,
      diabetes: ind,
      hypertension: ind,
      obesity: ind,
      asthma: ind,
      violentCrimeRate: null,
    },
    totalZctas: 3,
    zctasWithCompleteData: 3,
    scenarioModel,
  };
}

function render(levers: ScenarioFit[], initialZip: string | null = null) {
  return renderToString(
    <HealthDataContext.Provider
      value={{
        healthData: store,
        summary: summaryWith(levers),
        boundaries: null,
        loading: false,
        error: null,
      }}
    >
      <EquityScenarioSimulator initialZip={initialZip} />
    </HealthDataContext.Provider>,
  );
}

/** Visible text only: drops tags and React's hydration comments. */
const text = (html: string) =>
  html.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const BANNED = /\b(you|your|personal|prognosis|risk|predict\w*)\b/i;

describe("EquityScenarioSimulator", () => {
  it("renders results and methodology for the lowest-LE ZIP by default", () => {
    const html = text(render([uninsuredFit]));
    expect(html).toContain("Neighborhood Equity Scenario Simulator");
    expect(html).toContain("ZIP 10001");
    // 50% of the way from 22 to 6 = 14 => -0.4 * -8 = +3.2 years
    expect(html).toContain("+3.2");
    expect(html).toContain("95% CI");
    expect(html).toContain("not a forecast");
    expect(html).toContain("Not included");
  });

  it("defaults to the submitted ZIP when given", () => {
    expect(text(render([uninsuredFit], "10003"))).toContain("ZIP 10003");
  });

  it("explains instead of showing sliders when there are no levers", () => {
    const raw = render([]);
    const html = text(raw);
    expect(html).toContain("Neighborhood Equity Scenario Simulator");
    expect(raw).not.toContain('type="range"');
    expect(html).toContain("no scenario to explore");
  });

  it("avoids individual-framing vocabulary", () => {
    expect(text(render([uninsuredFit]))).not.toMatch(BANNED);
    expect(text(render([]))).not.toMatch(BANNED);
  });
});
