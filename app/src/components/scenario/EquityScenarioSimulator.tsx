import { useId, useMemo, useState } from "react";
import { useHealthData } from "../../hooks/useHealthData";
import { APH_COLORS } from "../../lib/constants";
import { cityConfig } from "../../lib/cityConfig";
import { listZips } from "../../lib/zips";
import {
  LEVER_COPY,
  lifeExpectancyExtremes,
  partitionLevers,
  simulateLever,
  targetAtProgress,
} from "../../lib/equityScenario";
import type { ScenarioLeverKey } from "../../types/scenario";
import Slider from "../shared/Slider";

interface EquityScenarioSimulatorProps {
  /** ZIP submitted in the neighborhood lookup, if any; used as the default selection. */
  initialZip: string | null;
}

const DEFAULT_PROGRESS_PCT = 50;

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const signed = (v: number, digits = 1) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;

export default function EquityScenarioSimulator({
  initialZip,
}: EquityScenarioSimulatorProps) {
  const { healthData, summary } = useHealthData();
  const zipId = useId();

  const [zipOverride, setZipOverride] = useState<string | null>(null);
  const [prevInitialZip, setPrevInitialZip] = useState(initialZip);
  const [leverChoice, setLeverChoice] = useState<ScenarioLeverKey | null>(null);
  const [progressPct, setProgressPct] = useState(DEFAULT_PROGRESS_PCT);

  // A newly submitted lookup ZIP wins over an earlier manual selection.
  if (prevInitialZip !== initialZip) {
    setPrevInitialZip(initialZip);
    setZipOverride(null);
  }

  const extremes = useMemo(
    () => (healthData ? lifeExpectancyExtremes(healthData.zctas) : null),
    [healthData],
  );
  const zipOptions = useMemo(
    () =>
      listZips(healthData).filter(
        (z) => healthData?.zctas[z].lifeExpectancy != null,
      ),
    [healthData],
  );

  // Until the pipeline output includes a scenario model there is nothing to simulate.
  const model = summary?.scenarioModel;
  if (!healthData || !summary || !extremes || !model) return null;

  const gap = extremes.top.le - extremes.bottom.le;
  const leverNames = joinList(model.levers.map((l) => LEVER_COPY[l.indicator].name));

  const header = (
    <div className="text-center mb-6">
      <h3 className="text-2xl font-bold text-aph-dark-blue mb-2">
        Neighborhood Equity Scenario Simulator
      </h3>
      <p className="text-sm text-aph-dark-gray max-w-2xl mx-auto">
        {model.levers.length > 0
          ? `Explore how lower ${leverNames} in a ZIP are associated with differences in life expectancy across ${cityConfig.region.name}. See how much of the ${gap.toFixed(1)}-year gap between ${cityConfig.region.name}'s longest- and shortest-lived ZIPs that difference represents.`
          : `Compare ZIP codes across ${cityConfig.region.name} using public, aggregate indicators.`}
      </p>
    </div>
  );

  if (model.levers.length === 0) {
    return (
      <section className="mt-12">
        {header}
        <div className="max-w-2xl mx-auto rounded-xl bg-white shadow-sm p-5 border border-aph-light-gray/30 text-sm text-aph-dark-gray leading-relaxed">
          No indicator showed a statistically reliable relationship with life
          expectancy across {cityConfig.region.name} ZIP codes in the current
          data, so there is no scenario to explore. Indicators are only offered
          when their fitted relationship is in the expected direction and its
          95% confidence interval excludes zero.
        </div>
      </section>
    );
  }

  const defaultZip =
    initialZip && zipOptions.includes(initialZip)
      ? initialZip
      : extremes.bottom.zip;
  const zip =
    zipOverride && zipOptions.includes(zipOverride) ? zipOverride : defaultZip;
  const row = healthData.zctas[zip];
  const currentLE = row.lifeExpectancy!;

  const { available, unavailable } = partitionLevers(
    model,
    zip,
    row,
    cityConfig.dataQualityNotes,
  );
  const selected =
    available.find((l) => l.fit.indicator === leverChoice) ?? available[0];

  const notIncluded = [
    ...model.excluded.map((e) => ({
      key: e.indicator,
      reason: e.reason,
    })),
    ...unavailable.map((u) => ({
      key: u.fit.indicator,
      reason: `${u.reason} (${zip})`,
    })),
  ];

  let results = null;
  if (selected) {
    const { fit, current } = selected;
    const target = targetAtProgress(fit, current, progressPct / 100);
    const sim = simulateLever(fit, current, target, currentLE, extremes.top.le);
    const copy = LEVER_COPY[fit.indicator];
    const gapShare = (sim.projectedGap / Math.max(sim.currentGap, 0.001)) * 100;

    results = (
      <>
        <div className="rounded-2xl p-6 text-center border border-aph-blue/20 shadow-sm bg-aph-light-blue/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-aph-dark-blue/75">
            Associated difference in life expectancy
          </p>
          <p
            className="text-5xl font-bold leading-none mt-2 tabular-nums"
            style={{ color: APH_COLORS.darkGreen }}
          >
            {signed(sim.deltaYears)} years
          </p>
          <p className="text-sm text-aph-dark-blue/75 mt-2">
            (95% CI {signed(sim.deltaLow)} to {signed(sim.deltaHigh)})
          </p>
          <div className="grid grid-cols-2 gap-3 mt-5 text-left">
            <div className="bg-white rounded-lg p-3 border border-aph-light-gray/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-aph-dark-gray">
                Life expectancy today
              </p>
              <p className="text-2xl font-bold tabular-nums text-aph-dark-blue">
                {currentLE.toFixed(1)}
              </p>
              <p className="text-xs text-aph-dark-gray mt-0.5">years, ZIP {zip}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-aph-light-gray/50">
              <p className="text-xs font-semibold uppercase tracking-wider text-aph-dark-gray">
                At the lower {copy.name}
              </p>
              <p className="text-2xl font-bold tabular-nums text-aph-dark-blue">
                {sim.projectedLE.toFixed(1)}
              </p>
              <p className="text-xs text-aph-dark-gray mt-0.5">
                years, fitted value
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-aph-light-gray/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-aph-dark-gray mb-3">
            Gap to the longest-lived ZIP ({extremes.top.zip},{" "}
            {extremes.top.le.toFixed(1)} years)
          </p>
          <div className="space-y-2 text-sm text-aph-dark-blue">
            <div>
              <div className="flex justify-between mb-1">
                <span>Today</span>
                <span className="font-semibold tabular-nums">
                  {sim.currentGap.toFixed(1)} years
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-aph-light-gray/40 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: "100%", backgroundColor: APH_COLORS.red }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>At the lower {copy.name}</span>
                <span className="font-semibold tabular-nums">
                  {sim.projectedGap.toFixed(1)} years
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-aph-light-gray/40 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, gapShare)}%`,
                    backgroundColor: APH_COLORS.green,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-aph-dark-gray leading-relaxed">
          One-variable fit across {fit.n} {cityConfig.region.name} ZIPs: life
          expectancy vs. {copy.name}, {signed(fit.slope, 2)} years per
          percentage point, R&sup2; = {fit.r2.toFixed(2)}, n = {fit.n}. This is
          an association across {cityConfig.region.name} ZIPs in public data,
          not a forecast of what an intervention would do. Levers aren&rsquo;t
          combined because these rates move together across ZIPs. It is not
          adjusted for age: ZIPs with younger residents, such as campus areas,
          tend to have both lower chronic-disease rates and different life
          expectancy, which can inflate or mask the association.
        </p>
      </>
    );
  }

  return (
    <section className="mt-12">
      {header}
      <div className="bg-white rounded-2xl shadow-sm border border-aph-light-gray/30 p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="mb-5">
              <label
                htmlFor={zipId}
                className="block text-xs font-semibold text-aph-dark-gray uppercase tracking-wide mb-2"
              >
                ZIP code
              </label>
              <select
                id={zipId}
                value={zip}
                onChange={(e) => setZipOverride(e.target.value)}
                className="w-full px-3 py-2 text-sm font-semibold text-aph-dark-blue bg-aph-light-blue/40 border border-aph-blue/30 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-aph-blue/40"
              >
                {zipOptions.map((z) => (
                  <option key={z} value={z}>
                    {z} &mdash; {healthData.zctas[z].lifeExpectancy!.toFixed(1)} years
                  </option>
                ))}
              </select>
            </div>

            {selected ? (
              <>
                <div className="mb-5">
                  <p className="text-xs font-semibold text-aph-dark-gray uppercase tracking-wide mb-2">
                    Population-level lever
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="Population-level lever"
                    className="flex flex-wrap gap-2"
                  >
                    {available.map(({ fit }) => {
                      const active = fit.indicator === selected.fit.indicator;
                      return (
                        <button
                          key={fit.indicator}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setLeverChoice(fit.indicator)}
                          className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition ${
                            active
                              ? "bg-aph-blue text-white border-aph-blue shadow-sm"
                              : "border-aph-blue text-aph-blue hover:bg-aph-blue hover:text-white"
                          }`}
                        >
                          {LEVER_COPY[fit.indicator].tab}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Slider
                  label={LEVER_COPY[selected.fit.indicator].measure}
                  value={progressPct}
                  min={0}
                  max={100}
                  step={1}
                  display={`${selected.current.toFixed(1)}% → ${targetAtProgress(
                    selected.fit,
                    selected.current,
                    progressPct / 100,
                  ).toFixed(1)}%`}
                  onChange={setProgressPct}
                />
                <div className="flex justify-between text-[11px] text-aph-dark-gray mt-1">
                  <span>Current rate in {zip}</span>
                  <span>
                    Lowest observed: {selected.fit.observedMin.toFixed(1)}% (
                    {selected.fit.bestZip})
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-aph-dark-gray leading-relaxed">
                No lever applies to {zip}: it has no life expectancy estimate,
                or each indicator is already at the lowest observed rate or
                unavailable for this ZIP.
              </p>
            )}
          </div>

          <div className="space-y-5">{results}</div>
        </div>

        {notIncluded.length > 0 && (
          <p className="mt-5 pt-4 border-t border-aph-light-gray/40 text-xs text-aph-dark-gray leading-relaxed">
            <span className="font-semibold">Not included:</span>{" "}
            {notIncluded
              .map(
                (n) =>
                  `${LEVER_COPY[n.key].name} (${n.reason})`,
              )
              .join("; ")}
            .
          </p>
        )}
      </div>
    </section>
  );
}
