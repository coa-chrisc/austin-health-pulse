import { useEffect, useState } from "react";
import { cityConfig } from "../../lib/cityConfig";
import { ENABLE_PERSONAL_CALCULATOR } from "../../lib/constants";

interface TourStep {
  icon: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    icon: "location_on",
    title: "Start with your ZIP code",
    body: `Enter a ${cityConfig.region.name} ZIP code, or tap the location pin to use your current location. Not sure where to start? Pick one of the example neighborhoods.`,
  },
  {
    icon: "monitoring",
    title: "See how your ZIP compares",
    body: "You will see life expectancy, poverty, uninsured rates, and chronic disease rates next to the area average. Green means better than average. Red means worse.",
  },
  {
    icon: "social_distance",
    title: "Look at the gap",
    body: `Life expectancy can differ by years between ${cityConfig.region.name}'s longest- and shortest-lived ZIPs. The bar chart below shows where your ZIP ranks among all ZIPs in the area.`,
  },
  ENABLE_PERSONAL_CALCULATOR
    ? {
        icon: "calculate",
        title: "Try the lifespan estimator",
        body: "Scroll down to see how habits like smoking, exercise, diet, and sleep are linked to life expectancy. These are group-level estimates from published research, not predictions for one person.",
      }
    : {
        icon: "tune",
        title: "Explore an equity scenario",
        body: "Scroll down to the scenario simulator. It shows how lower poverty, more insurance coverage, or lower chronic disease rates in a ZIP are linked to differences in life expectancy across the area.",
      },
];

interface TourOverlayProps {
  onClose: () => void;
}

export default function TourOverlay({ onClose }: TourOverlayProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && step < STEPS.length - 1)
        setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, onClose]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 2100 }}
      role="dialog"
      aria-modal="true"
      aria-label="60-second tour"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-7">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center hover:bg-aph-light-gray/30 transition"
          aria-label="Close tour"
        >
          <span className="material-symbols-outlined text-aph-dark-gray text-xl">
            close
          </span>
        </button>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] font-bold uppercase tracking-widest text-aph-blue">
            60-second tour
          </span>
          <span className="text-[11px] text-aph-dark-gray">·</span>
          <span className="text-[11px] font-semibold text-aph-dark-gray">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>

        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-aph-blue/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-aph-blue text-2xl">
              {current.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-aph-dark-blue leading-tight mb-2">
              {current.title}
            </h3>
            <p className="text-sm text-aph-dark-gray leading-relaxed">
              {current.body}
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === step
                  ? "bg-aph-blue w-6"
                  : "bg-aph-light-gray w-2 hover:bg-aph-blue/40"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-sm font-semibold text-aph-dark-gray disabled:opacity-30 hover:text-aph-dark-blue transition disabled:cursor-not-allowed"
          >
            Back
          </button>
          {isLast ? (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-aph-green text-white text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition"
            >
              Start exploring
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="px-5 py-2 rounded-lg bg-aph-blue text-white text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition flex items-center gap-1"
            >
              Next
              <span className="material-symbols-outlined text-base">
                arrow_forward
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
