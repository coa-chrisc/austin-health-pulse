// Mirrors config/city.config.schema.json. The `pipeline` block is stripped
// by the Vite plugin before the config reaches the browser.

export interface BrandColors {
  blue: string;
  green: string;
  white: string;
  darkBlue: string;
  darkGreen: string;
  complaintGreen: string;
  lightBlue: string;
  lightGreen: string;
  red: string;
  orange: string;
  yellow: string;
  cyan: string;
  purple: string;
  brown: string;
  lightGray: string;
  darkGray: string;
}

export interface CityConfig {
  id: string;
  appName: string;
  agency: { name: string; shortName: string; parent: string };
  region: { name: string; cityName: string; state: string };
  brand: { logoUrl: string | null; colors: BrandColors };
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
