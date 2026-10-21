import { cityConfig } from "./cityConfig";

export const MAP_CONFIG = {
  center: cityConfig.map.center,
  zoom: cityConfig.map.zoom,
  minZoom: cityConfig.map.minZoom,
  maxZoom: cityConfig.map.maxZoom,
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export const AGE_GROUP_RANGES: Array<{
  key: string;
  min: number;
  max: number;
  label: string;
}> = [
  { key: "Under 1", min: 0, max: 0, label: "Under 1" },
  { key: "1-4", min: 1, max: 4, label: "1-4 years" },
  { key: "5-14", min: 5, max: 14, label: "5-14 years" },
  { key: "15-24", min: 15, max: 24, label: "15-24 years" },
  { key: "25-34", min: 25, max: 34, label: "25-34 years" },
  { key: "35-44", min: 35, max: 44, label: "35-44 years" },
  { key: "45-54", min: 45, max: 54, label: "45-54 years" },
  { key: "55-64", min: 55, max: 64, label: "55-64 years" },
  { key: "65-74", min: 65, max: 74, label: "65-74 years" },
  { key: "75-84", min: 75, max: 84, label: "75-84 years" },
  { key: "85 and older", min: 85, max: 120, label: "85+ years" },
];

/**
 * Base URL of the city's Service Guide (companion app). The ZIP detail views
 * link to `<url>/services?zip=<zip>` and the optional lifespan calculator
 * deep-links into `<url>/intake`. `VITE_SERVICE_GUIDE_URL` (see
 * app/.env.example) overrides `serviceGuideUrl` in the city config. Dev builds
 * fall back to a local guide; production builds without either get `null` and
 * the links are hidden rather than pointing at localhost.
 */
export const SERVICE_GUIDE_URL: string | null =
  import.meta.env.VITE_SERVICE_GUIDE_URL ||
  cityConfig.serviceGuideUrl ||
  (import.meta.env.DEV ? "http://localhost:5173" : null);

/**
 * The individual lifespan calculator is opt-in. The default build uses only
 * aggregate public data; set `VITE_ENABLE_PERSONAL_CALCULATOR=true` to enable.
 */
export const ENABLE_PERSONAL_CALCULATOR: boolean =
  import.meta.env.VITE_ENABLE_PERSONAL_CALCULATOR === "true";

export const IDLE_TIMEOUT_MS = 300_000; // 5 min — conference booth kiosk mode
export const IDLE_DISABLE_MOBILE_BREAKPOINT_PX = 768; // skip kiosk overlay on phones
export const IDLE_DISABLE_QUERY_FLAG = "kiosk=off"; // ?kiosk=off disables overlay (live demo escape hatch)
