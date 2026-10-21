import { THEME, fontSize } from "../../lib/theme";
import { FACTOR_ICONS, type FactorBreakdown } from "../../lib/lifespanModel";

interface FactorWaterfallProps {
  factors: FactorBreakdown[];
  baseline: number;
  total: number;
}

/**
 * Per-factor impact visualization. Each factor renders as a horizontal bar
 * extending left (loss) or right (gain) from a center axis, with the magnitude
 * sized against the largest absolute delta in the set.
 */
export default function FactorWaterfall({
  factors,
  baseline,
  total,
}: FactorWaterfallProps) {
  const maxAbs = Math.max(1, ...factors.map((f) => Math.abs(f.delta)));
  const sorted = [...factors].sort((a, b) => b.delta - a.delta);

  return (
    <div className="bg-surface rounded-panel shadow-sm border border-line/30 p-5 md:p-6">
      <h4 className="text-base font-semibold text-ink mb-1">
        How each factor changes your estimate
      </h4>
      <p className="text-xs text-muted mb-4">
        Years gained or lost vs. an average person of your age. Bars left of
        center reduce the estimate; bars to the right add to it.
      </p>

      <div className="space-y-3">
        {sorted.map((f) => {
          const pct = (Math.abs(f.delta) / maxAbs) * 50; // 0–50% of width
          const isPositive = f.delta > 0;
          const isZero = Math.abs(f.delta) < 0.05;
          const color = isPositive
            ? THEME.colors.positiveFill
            : isZero
              ? THEME.colors.noData
              : THEME.colors.negative;
          return (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={{ fontSize: fontSize("lg") }}
                  >
                    {FACTOR_ICONS[f.key]}
                  </span>
                  {f.label}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color }}
                >
                  {isZero
                    ? "0.0 yrs"
                    : `${isPositive ? "+" : "−"}${Math.abs(f.delta).toFixed(1)} yrs`}
                </span>
              </div>
              <div className="relative h-3 bg-subtle rounded-full overflow-hidden">
                {/* Center axis */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-muted/40"
                  style={{ left: "50%" }}
                />
                {/* Bar */}
                {!isZero && (
                  <div
                    className="absolute top-0 bottom-0 transition-all duration-300"
                    style={{
                      backgroundColor: color,
                      left: isPositive ? "50%" : `${50 - pct}%`,
                      width: `${pct}%`,
                      borderRadius: isPositive
                        ? "0 9999px 9999px 0"
                        : "9999px 0 0 9999px",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-line/40 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-3xs font-semibold uppercase tracking-wider text-muted">
            Average for your age
          </p>
          <p className="text-lg font-bold text-ink tabular-nums">
            {baseline.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-3xs font-semibold uppercase tracking-wider text-muted">
            Net adjustment
          </p>
          <p
            className="text-lg font-bold tabular-nums"
            style={{
              color: total - baseline >= 0 ? THEME.colors.positiveFill : THEME.colors.negative,
            }}
          >
            {total - baseline >= 0 ? "+" : "−"}
            {Math.abs(total - baseline).toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-3xs font-semibold uppercase tracking-wider text-muted">
            Your estimate
          </p>
          <p className="text-lg font-bold text-ink tabular-nums">
            {total.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}
