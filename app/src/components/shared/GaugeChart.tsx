import { useEffect, useRef, useState } from "react";
import { THEME, fontSize } from "../../lib/theme";
import { getComparisonColor } from "../../lib/colorScales";
import { formatValue } from "../../lib/formatters";

const INDICATOR_DESCRIPTIONS: Record<string, string> = {
  "Poverty Rate":
    "Percentage of residents living below the federal poverty level (ACS 2022)",
  "Uninsured Rate":
    "Percentage of civilian population without health insurance (ACS 2022)",
  "Diabetes Prevalence":
    "Estimated percentage of adults aged 18+ diagnosed with diabetes (CDC PLACES 2025 release, 2023 BRFSS data)",
  "Hypertension Prevalence":
    "Estimated percentage of adults aged 18+ with high blood pressure (CDC PLACES 2025 release, 2023 BRFSS data)",
  "Obesity Prevalence":
    "Estimated percentage of adults aged 18+ with BMI \u2265 30 (CDC PLACES 2025 release, 2023 BRFSS data)",
};

interface GaugeChartProps {
  value: number | null;
  label: string;
  unit: string;
  countyAvg: number;
  min: number;
  max: number;
  higherIsBetter: boolean;
}

export default function GaugeChart({
  value,
  label,
  unit,
  countyAvg,
  min,
  max,
  higherIsBetter,
}: GaugeChartProps) {
  const [animatedFraction, setAnimatedFraction] = useState(0);
  const rafRef = useRef<number>(0);

  // Handle edge case: min equals max — treat as 50% fill
  const effectiveRange = max - min;
  const isDegenerate = effectiveRange === 0;
  const range = isDegenerate ? 1 : effectiveRange;

  const targetFraction =
    value !== null
      ? isDegenerate
        ? 0.5
        : Math.max(0, Math.min(1, (value - min) / range))
      : 0;

  // Clamp area average marker to 0-1 range so it stays on the arc
  const avgFraction = isDegenerate
    ? 0.5
    : Math.max(0, Math.min(1, (countyAvg - min) / range));

  // Animate the gauge fill on mount / value change
  // When value is null the filled arc isn't rendered, so there is nothing to
  // animate or reset.
  useEffect(() => {
    if (value === null) return;

    const start = performance.now();
    const duration = 800;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedFraction(targetFraction * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, targetFraction]);

  // SVG geometry — semicircle from 180deg to 0deg (left to right)
  const cx = 100;
  const cy = 90;
  const r = 70;
  const strokeWidth = 14;

  // Convert fraction (0-1) to angle on the semicircle (PI to 0)
  function fractionToPoint(f: number) {
    // Clamp to [0, 1] to keep marker on the arc boundary
    const clamped = Math.max(0, Math.min(1, f));
    const angle = Math.PI * (1 - clamped); // PI = left (0%), 0 = right (100%)
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    };
  }

  // Build the arc path for the filled portion
  function arcPath(fraction: number): string {
    // Clamp fraction to valid range and handle boundary
    const clamped = Math.max(0, Math.min(1, fraction));
    if (clamped <= 0) return "";
    const startAngle = Math.PI;
    const endAngle = Math.PI * (1 - clamped);
    const start = {
      x: cx + r * Math.cos(startAngle),
      y: cy - r * Math.sin(startAngle),
    };
    const end = {
      x: cx + r * Math.cos(endAngle),
      y: cy - r * Math.sin(endAngle),
    };
    // largeArc is always 0 for a semicircle gauge — the arc never exceeds 180°,
    // and setting largeArc=1 forces SVG to draw the LONG way around (through
    // the bottom of the circle), which produces a broken-looking arc.
    return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  }

  const fillColor =
    value !== null
      ? getComparisonColor(value, countyAvg, higherIsBetter)
      : THEME.colors.noData;

  const avgPoint = fractionToPoint(avgFraction);

  // Difference text
  const diffText =
    value !== null
      ? (() => {
          const diff = value - countyAvg;
          const sign = diff > 0 ? "+" : "";
          const formatted =
            unit === "years"
              ? diff.toFixed(1)
              : diff.toFixed(1) + (unit === "%" ? "pp" : "");
          return `${sign}${formatted} vs. area average`;
        })()
      : "";

  const tooltipText = INDICATOR_DESCRIPTIONS[label] ?? null;

  return (
    <div className="flex flex-col items-center p-4 bg-surface rounded-card shadow-sm border border-line/40">
      <svg viewBox="0 0 200 120" className="w-full">
        {/* Background arc */}
        <path
          d={arcPath(1)}
          fill="none"
          stroke={THEME.colors.line}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {value !== null && animatedFraction > 0 && (
          <path
            d={arcPath(animatedFraction)}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Area average marker */}
        {value !== null && (
          <g>
            <line
              x1={avgPoint.x}
              y1={avgPoint.y - 12}
              x2={avgPoint.x}
              y2={avgPoint.y + 12}
              stroke={THEME.colors.ink}
              strokeWidth={2.5}
              strokeLinecap="round"
              transform={`rotate(${-(Math.acos(Math.max(-1, Math.min(1, (avgPoint.x - cx) / r))) * 180) / Math.PI + 90}, ${avgPoint.x}, ${avgPoint.y})`}
            />
            {/* Small diamond marker */}
            <circle
              cx={avgPoint.x}
              cy={avgPoint.y}
              r={4}
              fill={THEME.colors.ink}
            />
          </g>
        )}

        {/* Center value */}
        {value !== null ? (
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            className="font-geist"
            fill={THEME.colors.ink}
            fontSize="26" // theme-exempt: SVG viewBox units, not CSS px
            fontWeight="700"
          >
            {formatValue(value, unit)}
          </text>
        ) : (
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            className="font-geist"
            fill={THEME.colors.muted}
            fontSize="12" // theme-exempt: SVG viewBox units, not CSS px
            fontWeight="500"
          >
            Data Not
          </text>
        )}

        {value === null && (
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            className="font-geist"
            fill={THEME.colors.muted}
            fontSize="12" // theme-exempt: SVG viewBox units, not CSS px
            fontWeight="500"
          >
            Available
          </text>
        )}

        {/* Min/Max labels */}
        <text
          x={cx - r - 2}
          y={cy + 16}
          textAnchor="middle"
          fill={THEME.colors.muted}
          fontSize="9" // theme-exempt: SVG viewBox units, not CSS px
        >
          {formatValue(min, unit)}
        </text>
        <text
          x={cx + r + 2}
          y={cy + 16}
          textAnchor="middle"
          fill={THEME.colors.muted}
          fontSize="9" // theme-exempt: SVG viewBox units, not CSS px
        >
          {formatValue(max, unit)}
        </text>
      </svg>

      {/* Label with info tooltip */}
      <div className="flex items-center gap-1 mt-1 justify-center">
        <p className="text-sm font-semibold text-ink text-center">
          {label}
        </p>
        {tooltipText && (
          <span className="relative group cursor-help">
            <span
              className="material-symbols-outlined text-muted/60 hover:text-primary transition"
              style={{ fontSize: fontSize("sm") }}
            >
              info
            </span>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 sm:w-52 rounded-control bg-ink text-on-brand text-xs px-3 py-2 leading-snug opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg z-20 text-center">
              {tooltipText}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink" />
            </span>
          </span>
        )}
      </div>

      {/* Difference vs area average */}
      {value !== null ? (
        <p className="text-xs mt-0.5 text-center" style={{ color: fillColor }}>
          {diffText}
        </p>
      ) : (
        <p className="text-xs mt-0.5 text-muted text-center">
          No data for this area
        </p>
      )}
    </div>
  );
}
