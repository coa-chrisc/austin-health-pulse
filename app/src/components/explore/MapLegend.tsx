import { useMemo } from "react";
import type { IndicatorKey } from "../../types/health";
import { INDICATOR_LABELS, INDICATOR_UNITS } from "../../types/health";
import { getColorForValue } from "../../lib/colorScales";
import { formatValue } from "../../lib/formatters";

interface MapLegendProps {
  indicator: IndicatorKey;
  min: number;
  max: number;
}

const GRADIENT_STEPS = 20;

export default function MapLegend({ indicator, min, max }: MapLegendProps) {
  const unit = INDICATOR_UNITS[indicator];

  const gradientCss = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= GRADIENT_STEPS; i++) {
      const value = min + ((max - min) * i) / GRADIENT_STEPS;
      const color = getColorForValue(value, min, max, indicator);
      const pct = ((i / GRADIENT_STEPS) * 100).toFixed(1);
      stops.push(`${color} ${pct}%`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [indicator, min, max]);

  return (
    <div
      className="absolute bottom-6 left-4 right-4 sm:right-auto sm:min-w-[200px] bg-surface rounded-card shadow-lg border border-line/50 px-4 py-3"
      style={{ zIndex: 1000 }}
    >
      <p className="text-xs font-semibold text-ink mb-2">
        {INDICATOR_LABELS[indicator]}
      </p>

      {/* Gradient bar */}
      <div className="h-3 rounded-full" style={{ background: gradientCss }} />

      {/* Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-2xs text-muted">
          {formatValue(min, unit)}
        </span>
        <span className="text-2xs text-muted">
          {formatValue(max, unit)}
        </span>
      </div>

      {/* Missing data indicator */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line/50">
        <div
          className="w-4 h-3 rounded-chip bg-line opacity-30"
        />
        <span className="text-2xs text-muted">No data</span>
      </div>
    </div>
  );
}
