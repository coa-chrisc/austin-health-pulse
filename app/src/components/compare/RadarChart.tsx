import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useHealthData } from "../../hooks/useHealthData";
import { THEME, FONT_FAMILY, fontSize } from "../../lib/theme";
import type { IndicatorKey } from "../../types/health";
import { INDICATOR_HIGHER_IS_BETTER } from "../../types/health";

interface RadarChartProps {
  zctas: string[];
  colors: string[];
}

const RADAR_INDICATORS: { key: IndicatorKey; shortLabel: string }[] = [
  { key: "lifeExpectancy", shortLabel: "Life Exp." },
  { key: "povertyRate", shortLabel: "Poverty" },
  { key: "uninsuredRate", shortLabel: "Uninsured" },
  { key: "diabetes", shortLabel: "Diabetes" },
  { key: "hypertension", shortLabel: "Hypertension" },
  { key: "obesity", shortLabel: "Obesity" },
  { key: "asthma", shortLabel: "Asthma" },
  { key: "violentCrimeRate", shortLabel: "Violent Crime" },
];

function normalize(
  value: number | null,
  min: number,
  max: number,
  higherIsBetter: boolean,
): number | null {
  if (value === null || max === min) return null;
  const raw = (value - min) / (max - min);
  const clamped = Math.max(0, Math.min(1, raw));
  // Invert for "higher is worse" so that higher on radar = healthier
  const normalized = higherIsBetter ? clamped : 1 - clamped;
  return Math.round(normalized * 100);
}

export default function RadarChart({ zctas, colors }: RadarChartProps) {
  const { healthData, summary } = useHealthData();

  if (!healthData || !summary || zctas.length === 0) return null;

  // Build data points for each indicator
  const data = RADAR_INDICATORS.flatMap(({ key, shortLabel }) => {
    const ind = summary.indicators[key];
    if (ind === null) return []; // region has no source for this indicator
    const entry: Record<string, string | number | null> = {
      indicator: shortLabel,
      fullMark: 100,
    };

    for (const zcta of zctas) {
      const zctaData = healthData.zctas[zcta];
      const rawValue = zctaData?.[key] ?? null;
      entry[zcta] = normalize(
        rawValue,
        ind.min,
        ind.max,
        INDICATOR_HIGHER_IS_BETTER[key],
      );
    }

    return [entry];
  });

  return (
    <div className="w-full bg-surface rounded-card shadow-sm p-6">
      <h3 className="text-lg font-semibold text-ink mb-4">
        Health Profile Comparison
      </h3>
      <p className="text-sm text-muted mb-4">
        Each indicator is scaled from 0 to 100 across all ZIP codes. A higher score always means a better outcome, and a larger shape means better outcomes overall.
      </p>
      <div className="w-full" style={{ height: "min(380px, 60vw)" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke={THEME.colors.line} />
            <PolarAngleAxis
              dataKey="indicator"
              tick={{
                fontSize: fontSize("2xs"),
                fill: THEME.colors.ink,
                fontFamily: FONT_FAMILY,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: fontSize("3xs"), fill: THEME.colors.muted }}
              tickCount={5}
            />
            {zctas.map((zcta, index) => (
              <Radar
                key={zcta}
                name={zcta}
                dataKey={zcta}
                stroke={colors[index]}
                fill={colors[index]}
                fillOpacity={0.15}
                strokeWidth={2}
                connectNulls
              />
            ))}
            <Tooltip
              contentStyle={{
                backgroundColor: THEME.colors.surface,
                border: `1px solid ${THEME.colors.line}`,
                borderRadius: "8px",
                fontFamily: FONT_FAMILY,
                fontSize: fontSize("sm"),
              }}
              formatter={(value: unknown) =>
                value != null ? `${value}/100` : "N/A"
              }
            />
            <Legend
              wrapperStyle={{
                fontFamily: FONT_FAMILY,
                fontSize: fontSize("sm"),
                color: THEME.colors.ink,
              }}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
