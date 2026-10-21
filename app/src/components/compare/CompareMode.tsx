import { useState, useCallback } from "react";
import { THEME } from "../../lib/theme";
import ZctaPicker from "./ZctaPicker";
import RadarChart from "./RadarChart";
import ComparisonBarChart from "./ComparisonBarChart";
import ComparisonTable from "./ComparisonTable";
import { cityConfig } from "../../lib/cityConfig";

const COMPARISON_COLORS = THEME.series.slice(0, 3);

const MAX_SELECTIONS = 3;

export default function CompareMode() {
  const [selectedZctas, setSelectedZctas] = useState<string[]>([]);

  const handleAdd = useCallback((zcta: string) => {
    setSelectedZctas((prev) => {
      if (prev.includes(zcta) || prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, zcta];
    });
  }, []);

  const handleRemove = useCallback((zcta: string) => {
    setSelectedZctas((prev) => prev.filter((z) => z !== zcta));
  }, []);

  const hasComparison = selectedZctas.length >= 2;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">
          Compare ZIP Codes
        </h1>
        <p className="text-muted mt-2 text-sm sm:text-base max-w-2xl">
          How do health outcomes differ across {cityConfig.region.name} neighborhoods?
          Select 2 or 3 ZIP codes below to see a side-by-side comparison of life
          expectancy, chronic disease, and socioeconomic indicators.
        </p>
      </div>

      {/* ZCTA Picker */}
      <div className="bg-surface rounded-card shadow-sm p-5 sm:p-6 mb-8 border border-line/30">
        <ZctaPicker
          selectedZctas={selectedZctas}
          onAdd={handleAdd}
          onRemove={handleRemove}
          maxSelections={MAX_SELECTIONS}
        />
      </div>

      {/* Comparison visualizations */}
      {hasComparison && (
        <div className="flex flex-col gap-8">
          {/* Radar chart */}
          <RadarChart zctas={selectedZctas} colors={COMPARISON_COLORS} />

          {/* Bar charts */}
          <ComparisonBarChart
            zctas={selectedZctas}
            colors={COMPARISON_COLORS}
          />

          {/* Table */}
          <ComparisonTable zctas={selectedZctas} colors={COMPARISON_COLORS} />
        </div>
      )}

      {/* Empty state — only when no ZIPs selected */}
      {selectedZctas.length === 0 && (
        <div className="bg-surface rounded-card shadow-sm p-6 sm:p-10 text-center border border-line/30">
          <span className="material-symbols-outlined text-5xl text-primary/30 mb-4 block">
            compare_arrows
          </span>
          <h3 className="text-lg font-semibold text-ink mb-3">
            Ready to Compare
          </h3>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-muted max-w-lg mx-auto">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>Pick a ZIP code above</span>
            </div>
            <span className="hidden sm:block material-symbols-outlined text-line text-lg">
              arrow_forward
            </span>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>Add a 2nd to compare</span>
            </div>
            <span className="hidden sm:block material-symbols-outlined text-line text-lg">
              arrow_forward
            </span>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>See the results</span>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for second ZIP */}
      {selectedZctas.length === 1 && (
        <div className="bg-primary-soft/30 rounded-card p-5 sm:p-6 text-center border border-primary/15">
          <span className="material-symbols-outlined text-3xl text-primary/60 mb-2 block">
            pending
          </span>
          <p className="text-sm text-ink font-medium">
            Add one more ZIP code to see the comparison charts and table.
          </p>
        </div>
      )}
    </div>
  );
}
