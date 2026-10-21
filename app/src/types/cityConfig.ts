// Mirrors config/city.config.schema.json. The `pipeline` block is stripped
// by the Vite plugin before the config reaches the browser.

/** Semantic UI colors; each becomes `--color-<kebab-key>` (e.g. `--color-on-brand`). */
export interface ThemeColors {
  primary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  ink: string;
  onBrand: string;
  page: string;
  surface: string;
  subtle: string;
  body: string;
  muted: string;
  line: string;
  noData: string;
  positive: string;
  positiveFill: string;
  negative: string;
  warning: string;
  scrim: string;
}

/** Text size steps, smallest to largest (`text-<step>` utilities). */
export type TextStep =
  | "3xs"
  | "2xs"
  | "xs"
  | "sm"
  | "base"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl"
  | "6xl"
  | "7xl";

export interface Theme {
  colors: ThemeColors;
  /** Exactly five stops, worst to best. */
  dataScale: string[];
  /** Three to eight chart/compare series colors, in order. */
  series: string[];
  typography: {
    /** `@fontsource/<name>` package installed in app/; weights 400-700 are loaded. */
    fontPackage: string;
    family: string;
    fallback: string;
    /** px on <html>; scales every rem (text and spacing). */
    baseSize: number;
    /** rem overrides per step; unset steps use the defaults in lib/theme.ts. */
    sizes?: Partial<Record<TextStep, number>>;
  };
  radius: { chip: string; control: string; card: string; panel: string };
}

export interface CityConfig {
  id: string;
  appName: string;
  agency: { name: string; shortName: string; parent: string };
  region: { name: string; cityName: string; state: string };
  brand: { logoUrl: string | null };
  theme: Theme;
  /** Show the "How This Was Built" About section (Austin-specific story). */
  showBuildStory?: boolean;
  map: {
    center: [number, number];
    zoom: number;
    minZoom: number;
    maxZoom: number;
  };
  featuredZips: { label: string; zip: string }[];
  dataQualityNotes: Record<string, string>;
  serviceGuideUrl: string | null;
  dataSources: { label: string; source: string }[];
  dataAsOf: string;
}

/** Built asset URLs for the active config's data files (already BASE_URL-relative). */
export interface CityDataUrls {
  indicators: string;
  boundaries: string;
  summary: string;
}

/** Built URL of the config-relative brand logo, or null when none is set. */
export type LogoSrc = string | null;
