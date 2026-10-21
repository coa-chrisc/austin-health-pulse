import { useState, useMemo } from "react";
import { useHealthData } from "../../hooks/useHealthData";
import {
  lifeExpectancyForBirthYear,
  HISTORICAL_LE_MIN_YEAR,
  HISTORICAL_LE_MAX_YEAR,
} from "../../lib/historicalLE";
import { THEME } from "../../lib/theme";
import { cityConfig } from "../../lib/cityConfig";

export default function ParentsCompare() {
  const { healthData } = useHealthData();
  const [birthYear, setBirthYear] = useState(1960);

  const parentLE = useMemo(
    () => lifeExpectancyForBirthYear(birthYear),
    [birthYear],
  );
  const todayLE = healthData?.meta.countyAverage.lifeExpectancy ?? null;
  const gain =
    parentLE !== null && todayLE !== null ? todayLE - parentLE : null;

  return (
    <div className="bg-surface rounded-panel shadow-md border border-line/30 p-6 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-primary">
          family_restroom
        </span>
        <h3 className="text-xl font-bold text-ink">
          Compare Across Generations
        </h3>
      </div>
      <p className="text-sm text-muted mb-5">
        How much has life expectancy changed since your parents or grandparents
        were born?
      </p>

      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-1">
          <label
            htmlFor="birth-year"
            className="text-xs font-semibold text-muted uppercase tracking-wide"
          >
            Birth year
          </label>
          <span className="text-ink font-bold text-lg">
            {birthYear}
          </span>
        </div>
        <input
          id="birth-year"
          type="range"
          min={HISTORICAL_LE_MIN_YEAR}
          max={HISTORICAL_LE_MAX_YEAR}
          value={birthYear}
          onChange={(e) => setBirthYear(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>{HISTORICAL_LE_MIN_YEAR}</span>
          <span>{HISTORICAL_LE_MAX_YEAR}</span>
        </div>
      </div>

      {parentLE !== null && (
        <div className="bg-page rounded-card p-4 border border-line/40">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                Born in {birthYear}
              </p>
              <p
                className="text-3xl font-bold leading-none"
                style={{ color: THEME.colors.ink }}
              >
                {parentLE.toFixed(1)}
              </p>
              <p className="text-xs text-muted mt-1">years (U.S. average)</p>
            </div>
            {todayLE !== null && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
                  {cityConfig.region.name} today
                </p>
                <p
                  className="text-3xl font-bold leading-none"
                  style={{ color: THEME.colors.accent }}
                >
                  {todayLE.toFixed(1)}
                </p>
                <p className="text-xs text-muted mt-1">years</p>
              </div>
            )}
          </div>
          {gain !== null && (
            <p className="text-sm text-ink mt-4 leading-relaxed">
              Life expectancy in {cityConfig.region.name} today is about{" "}
              <span className="font-bold" style={{ color: THEME.colors.accent }}>
                {Math.abs(gain).toFixed(1)} years
              </span>{" "}
              {gain >= 0 ? "longer" : "shorter"} than the U.S. average for
              people born in {birthYear}.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted mt-3 leading-relaxed">
        Historical U.S. life expectancy at birth from CDC NCHS National Vital
        Statistics System. The 2020 dip reflects the COVID-19 pandemic.
      </p>
    </div>
  );
}
