import { useHealthData } from "../../hooks/useHealthData";
import { THEME, withAlpha } from "../../lib/theme";
import { isIndicatorAvailable } from "../../lib/indicators";
import type { IndicatorKey } from "../../types/health";
import {
  INDICATOR_LABELS,
  INDICATOR_UNITS,
  INDICATOR_HIGHER_IS_BETTER,
} from "../../types/health";
import { formatValue } from "../../lib/formatters";

interface ComparisonTableProps {
  zctas: string[];
  colors: string[];
}

const INDICATORS: IndicatorKey[] = [
  "lifeExpectancy",
  "povertyRate",
  "uninsuredRate",
  "diabetes",
  "hypertension",
  "obesity",
  "asthma",
  "violentCrimeRate",
];

/**
 * Given the numeric values for the selected ZCTAs on a single indicator,
 * return the "best" and "worst" ZCTA codes based on higherIsBetter.
 */
function rankValues(
  values: (number | null)[],
  zctas: string[],
  higherIsBetter: boolean,
): { best: string | null; worst: string | null } {
  const valid = zctas
    .map((z, i) => ({ zcta: z, value: values[i] }))
    .filter((v) => v.value !== null) as { zcta: string; value: number }[];

  if (valid.length === 0) return { best: null, worst: null };

  valid.sort((a, b) =>
    higherIsBetter ? b.value - a.value : a.value - b.value,
  );

  // Only highlight best/worst if there are at least 2 valid values to compare
  if (valid.length < 2) return { best: null, worst: null };

  return { best: valid[0].zcta, worst: valid[valid.length - 1].zcta };
}

export default function ComparisonTable({
  zctas,
  colors,
}: ComparisonTableProps) {
  const { healthData, summary } = useHealthData();

  if (!healthData || zctas.length === 0) return null;

  const countyAvg = healthData.meta.countyAverage;
  const indicators = INDICATORS.filter((key) =>
    isIndicatorAvailable(summary, key),
  );

  return (
    <div className="w-full bg-surface rounded-card shadow-sm p-4 sm:p-6 overflow-x-auto">
      <h3 className="text-lg font-semibold text-ink mb-4">
        Side-by-Side Comparison
      </h3>
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="border-b-2 border-ink/20">
            <th className="text-left py-3 px-2 sm:px-4 text-ink font-semibold">
              Indicator
            </th>
            {zctas.map((zcta, index) => (
              <th
                key={zcta}
                className="text-center py-3 px-2 sm:px-4 font-semibold"
              >
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ color: colors[index] }}
                >
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: colors[index] }}
                  />
                  {zcta}
                </span>
              </th>
            ))}
            <th className="text-center py-3 px-2 sm:px-4 text-ink font-semibold whitespace-nowrap">
              Area Average
            </th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((key) => {
            const unit = INDICATOR_UNITS[key];
            const higherIsBetter = INDICATOR_HIGHER_IS_BETTER[key];
            const values = zctas.map((z) => healthData.zctas[z]?.[key] ?? null);
            const { best, worst } = rankValues(values, zctas, higherIsBetter);

            return (
              <tr
                key={key}
                className="border-b border-line/40 hover:bg-primary-soft/20 transition-colors"
              >
                <td className="py-3 px-2 sm:px-4 text-ink font-medium whitespace-nowrap">
                  {INDICATOR_LABELS[key]}
                </td>
                {zctas.map((zcta, index) => {
                  const val = values[index];
                  const isBest = zcta === best;
                  const isWorst = zcta === worst;

                  let bgColor = "transparent";
                  let textColor: string = THEME.colors.ink;

                  if (val === null) {
                    textColor = THEME.colors.muted;
                  } else if (isBest) {
                    bgColor = withAlpha(THEME.colors.positiveFill, 0x18 / 255);
                    textColor = THEME.colors.positive;
                  } else if (isWorst) {
                    bgColor = withAlpha(THEME.colors.negative, 0x18 / 255);
                    textColor = THEME.colors.negative;
                  }

                  return (
                    <td
                      key={zcta}
                      className="text-center py-3 px-2 sm:px-4 font-medium"
                      style={{ backgroundColor: bgColor, color: textColor }}
                    >
                      {val !== null ? (
                        formatValue(val, unit)
                      ) : (
                        <span className="text-muted italic">N/A</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center py-3 px-2 sm:px-4 text-muted font-medium">
                  {formatValue(countyAvg[key], unit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
