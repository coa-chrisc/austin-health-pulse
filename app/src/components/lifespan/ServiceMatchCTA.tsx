import { SERVICE_GUIDE_URL } from "../../lib/constants";
import { THEME, fontSize } from "../../lib/theme";
import { cityConfig } from "../../lib/cityConfig";
import {
  FACTOR_ICONS,
  type ImprovementOpportunity,
} from "../../lib/lifespanModel";

interface ServiceMatchCTAProps {
  opportunities: ImprovementOpportunity[];
}

/**
 * Maps a model factor to the Service Guide category slug. Used to build the
 * `focus=` deep-link query so the resident services intake can pre-load
 * relevant services.
 */
const FACTOR_TO_CATEGORY: Record<string, string> = {
  smoking: "smoking_cessation",
  exercise: "physical_activity",
  diet: "nutrition",
  bmi: "nutrition",
  sleep: "mental_health",
  stress: "mental_health",
};

function buildIntakeUrl(
  baseUrl: string,
  opportunities: ImprovementOpportunity[],
): string {
  const focus = Array.from(
    new Set(
      opportunities
        .map((o) => FACTOR_TO_CATEGORY[o.factor])
        .filter((s): s is string => typeof s === "string"),
    ),
  ).join(",");
  const params = new URLSearchParams({ event: "healthspan" });
  if (focus) params.set("focus", focus);
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/intake?${params.toString()}`;
}

export default function ServiceMatchCTA({
  opportunities,
}: ServiceMatchCTAProps) {
  if (opportunities.length === 0) {
    return (
      <div
        className="rounded-panel shadow-sm p-6 text-on-brand"
        style={{
          background: `linear-gradient(135deg, ${THEME.colors.positive} 0%, ${THEME.colors.accent} 100%)`,
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="material-symbols-outlined text-on-brand"
            style={{ fontSize: fontSize("3xl") }}
          >
            check_circle
          </span>
          <div>
            <p className="font-semibold text-lg">
              Your answers show no factors with room to improve.
            </p>
            <p className="text-on-brand/85 text-sm mt-1">
              Keep doing what you're doing.
              {SERVICE_GUIDE_URL &&
                ` If anything changes, the ${cityConfig.region.cityName} Service Guide can help match you to local resources.`}
            </p>
          </div>
        </div>
        {SERVICE_GUIDE_URL && (
          <a
            href={buildIntakeUrl(SERVICE_GUIDE_URL, [])}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-control bg-surface text-positive font-semibold text-sm hover:bg-surface/90 transition"
          >
            Browse {cityConfig.region.cityName} services
            <span className="material-symbols-outlined text-base">
              open_in_new
            </span>
          </a>
        )}
      </div>
    );
  }

  const url = SERVICE_GUIDE_URL
    ? buildIntakeUrl(SERVICE_GUIDE_URL, opportunities)
    : null;
  const totalGain = opportunities.reduce((s, o) => s + o.potentialGain, 0);

  return (
    <div
      className="rounded-panel shadow-md p-6 md:p-7 text-ink border border-primary/20 brand-soft-gradient"
    >
      <div className="flex items-start gap-3 mb-1">
        <span
          className="material-symbols-outlined"
          style={{ color: THEME.colors.positive, fontSize: fontSize("3xl") }}
        >
          trending_up
        </span>
        <div>
          <h4 className="font-bold text-lg leading-tight">
            Up to{" "}
            <span style={{ color: THEME.colors.positive }}>
              +{totalGain.toFixed(1)} years
            </span>{" "}
            of estimated gain
          </h4>
          <p className="text-sm text-ink/80 mt-1">
            Based on your answers, these factors offer the largest estimated
            gains.
            {url &&
              ` ${cityConfig.agency.name} partners with services that can help.`}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {opportunities.map((o) => (
          <li
            key={o.factor}
            className="bg-surface rounded-control px-3 py-2 flex items-center justify-between gap-3 border border-line/50"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: fontSize("lg"), color: THEME.colors.primary }}
              >
                {FACTOR_ICONS[o.factor]}
              </span>
              {o.label}
            </span>
            <span
              className="text-sm font-bold tabular-nums whitespace-nowrap"
              style={{ color: THEME.colors.positive }}
            >
              +{o.potentialGain.toFixed(1)} years
            </span>
          </li>
        ))}
      </ul>

      {url && (
        <>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-control bg-accent text-on-brand font-semibold text-sm hover:brightness-110 active:scale-[0.97] transition"
          >
            <span className="material-symbols-outlined text-base">
              handshake
            </span>
            Find {cityConfig.region.cityName} services that can help
            <span className="material-symbols-outlined text-base">
              arrow_forward
            </span>
          </a>
          <p className="text-xs text-muted mt-3">
            Opens the {cityConfig.region.cityName} Service Guide. Your answers stay in your browser. The link
            includes only general service topics.
          </p>
        </>
      )}
    </div>
  );
}
