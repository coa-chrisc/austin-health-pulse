import { useMemo } from "react";
import { useHealthData } from "../../hooks/useHealthData";
import { THEME, scaleColor } from "../../lib/theme";
import { cityConfig } from "../../lib/cityConfig";

interface DisparityStripProps {
  highlightZip: string;
}

interface ZipBar {
  zip: string;
  le: number;
  pct: number; // 0..1 — position relative to min/max
}

export default function DisparityStrip({ highlightZip }: DisparityStripProps) {
  const { healthData } = useHealthData();

  const { bars, minLE, maxLE, highlightIndex } = useMemo(() => {
    if (!healthData)
      return {
        bars: [] as ZipBar[],
        minLE: 0,
        maxLE: 0,
        highlightIndex: -1,
      };

    const entries: { zip: string; le: number }[] = [];
    for (const [zip, data] of Object.entries(healthData.zctas)) {
      if (data.lifeExpectancy != null) {
        entries.push({ zip, le: data.lifeExpectancy });
      }
    }
    entries.sort((a, b) => a.le - b.le);

    if (entries.length === 0)
      return {
        bars: [] as ZipBar[],
        minLE: 0,
        maxLE: 0,
        highlightIndex: -1,
      };

    const min = entries[0].le;
    const max = entries[entries.length - 1].le;
    const range = max - min || 1;

    const bars: ZipBar[] = entries.map((e) => ({
      zip: e.zip,
      le: e.le,
      pct: (e.le - min) / range,
    }));

    const idx = bars.findIndex((b) => b.zip === highlightZip);

    return { bars, minLE: min, maxLE: max, highlightIndex: idx };
  }, [healthData, highlightZip]);

  if (bars.length === 0) return null;

  // Red → orange → yellow → green gradient
  const colorFor = (pct: number) =>
    scaleColor(THEME.dataScale.slice(0, 4), pct);

  return (
    <section className="mb-6 rounded-card bg-surface shadow-sm p-5 border border-line/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary text-lg">
          equalizer
        </span>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Where {highlightZip} ranks among {cityConfig.region.name} ZIPs
        </h4>
      </div>

      {/* Bar strip */}
      <div className="relative pt-7">
        <div
          className="flex items-end gap-0 sm:gap-[2px] h-24 sm:h-28"
          role="img"
          aria-label={`Bar chart of ${bars.length} ZIP codes, sorted from shortest to longest life expectancy. ${highlightZip} is number ${
            highlightIndex >= 0 ? highlightIndex + 1 : "unknown"
          } of ${bars.length}.`}
        >
          {bars.map((b, i) => {
            const isHighlight = b.zip === highlightZip;
            // Bar height: 30% min, 100% max
            const heightPct = 30 + b.pct * 70;
            return (
              <div
                key={b.zip}
                className="flex-1 relative transition-all"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isHighlight
                    ? THEME.colors.ink
                    : colorFor(b.pct),
                  outline: isHighlight
                    ? `2px solid ${THEME.colors.ink}`
                    : undefined,
                  outlineOffset: isHighlight ? "1px" : undefined,
                  zIndex: isHighlight ? 2 : 1,
                  opacity: isHighlight ? 1 : 0.9,
                }}
                title={`${b.zip}: ${b.le.toFixed(1)} years`}
              >
                {isHighlight && (
                  <div
                    className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-chip text-3xs font-bold text-on-brand whitespace-nowrap shadow z-10"
                    style={{ backgroundColor: THEME.colors.ink }}
                  >
                    {b.zip}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45"
                      style={{ backgroundColor: THEME.colors.ink }}
                    />
                  </div>
                )}
                {/* Use index for unused-warning-free key handling */}
                <span className="sr-only">{i}</span>
              </div>
            );
          })}
        </div>

        {/* Axis labels */}
        <div className="flex justify-between mt-2 text-2xs text-muted">
          <span>
            <span className="font-semibold text-negative">
              {minLE.toFixed(1)} years
            </span>{" "}
            shortest
          </span>
          <span className="hidden sm:inline">
            {bars.length} {cityConfig.region.name} ZIPs
          </span>
          <span className="text-right">
            longest{" "}
            <span className="font-semibold text-positive-fill">
              {maxLE.toFixed(1)} years
            </span>
          </span>
        </div>
      </div>

      {/* Rank summary */}
      {highlightIndex >= 0 && (
        <p className="text-sm text-ink mt-3 leading-relaxed">
          ZIP <span className="font-semibold">{highlightZip}</span> is number{" "}
          <span className="font-bold text-primary">{highlightIndex + 1}</span>{" "}
          of {bars.length} when ranked from shortest to longest life
          expectancy, {percentileLabel(highlightIndex, bars.length)}.
        </p>
      )}
    </section>
  );
}

function percentileLabel(index: number, total: number): string {
  // index 0 = lowest LE, index total-1 = highest
  const pct = index / (total - 1);
  if (pct >= 0.9) return "near the top of the area";
  if (pct >= 0.7) return "above the middle of the area";
  if (pct >= 0.4) return "around the middle of the area";
  if (pct >= 0.15) return "below the middle of the area";
  return "near the bottom of the area";
}
