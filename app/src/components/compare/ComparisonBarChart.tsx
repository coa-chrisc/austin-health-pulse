import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useHealthData } from "../../hooks/useHealthData";
import { THEME, FONT_FAMILY, fontSize } from "../../lib/theme";
import { isIndicatorAvailable } from "../../lib/indicators";
import type { IndicatorKey } from "../../types/health";
import { INDICATOR_LABELS, INDICATOR_UNITS } from "../../types/health";
import { formatValue } from "../../lib/formatters";

interface ComparisonBarChartProps {
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

export default function ComparisonBarChart({
  zctas,
  colors,
}: ComparisonBarChartProps) {
  const { healthData, summary } = useHealthData();

  if (!healthData || zctas.length === 0) return null;

  const countyAvg = healthData.meta.countyAverage;
  const indicators = INDICATORS.filter((key) =>
    isIndicatorAvailable(summary, key),
  );

  return (
    <div className="w-full bg-surface rounded-card shadow-sm p-6">
      <h3 className="text-lg font-semibold text-ink mb-2">
        Indicator Breakdown
      </h3>
      <p className="text-sm text-muted mb-6">
        Each chart compares your selected ZIP codes. The dashed line shows the area average.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {indicators.map((key) => {
          const unit = INDICATOR_UNITS[key];
          const label = INDICATOR_LABELS[key];
          const avg = countyAvg[key];

          const chartData = [
            (() => {
              const entry: Record<string, string | number | null> = {
                name: label,
              };
              for (const zcta of zctas) {
                entry[zcta] = healthData.zctas[zcta]?.[key] ?? null;
              }
              return entry;
            })(),
          ];

          return (
            <div key={key}>
              <h4 className="text-sm font-semibold text-ink mb-2">
                {label}{" "}
                <span className="font-normal text-muted">
                  ({unit === "per1k" ? "per 1,000" : unit})
                </span>
              </h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={THEME.colors.ink}
                    opacity={0.15}
                  />
                  <XAxis dataKey="name" tick={false} axisLine={false} />
                  <YAxis
                    tick={{
                      fontSize: fontSize("2xs"),
                      fill: THEME.colors.muted,
                      fontFamily: FONT_FAMILY,
                    }}
                    tickFormatter={(v: number) => formatValue(v, unit)}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: THEME.colors.surface,
                      border: `1px solid ${THEME.colors.line}`,
                      borderRadius: "8px",
                      fontFamily: FONT_FAMILY,
                      fontSize: fontSize("sm"),
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      value != null
                        ? formatValue(value as number, unit)
                        : "N/A",
                      String(name),
                    ]}
                  />
                  <Legend
                    wrapperStyle={{
                      fontFamily: FONT_FAMILY,
                      fontSize: fontSize("xs"),
                    }}
                  />
                  {zctas.map((zcta, index) => (
                    <Bar
                      key={zcta}
                      dataKey={zcta}
                      name={zcta}
                      fill={colors[index]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={60}
                    />
                  ))}
                  {avg !== null && (
                    <ReferenceLine
                      y={avg}
                      stroke={THEME.colors.ink}
                      strokeDasharray="6 3"
                      strokeWidth={2}
                      label={{
                        value: `Area average: ${formatValue(avg, unit)}`,
                        position: "insideTopRight",
                        style: {
                          fontSize: fontSize("3xs"),
                          fill: THEME.colors.ink,
                          fontFamily: FONT_FAMILY,
                          fontWeight: 600,
                        },
                      }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
