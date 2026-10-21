// Theme tokens from the active city config, for code that cannot use the
// Tailwind utilities (Recharts props, Leaflet styles, inline SVG). The same
// values reach CSS as --color-* / --font-sans / --text-* / --radius-* vars.
import { cityConfig } from "./cityConfig";
import type { TextStep, Theme } from "../types/cityConfig";

export type { TextStep };

export const THEME: Readonly<Theme> = cityConfig.theme;

/** Same stack as the `--font-sans` CSS variable. */
export const FONT_FAMILY = `"${THEME.typography.family}", ${THEME.typography.fallback}`;

export const TEXT_STEPS: readonly TextStep[] = [
  "3xs", "2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
];

/** rem defaults: 3xs/2xs from index.css, the rest Tailwind 4's own scale. */
export const DEFAULT_TEXT_REM: Readonly<Record<TextStep, number>> = {
  "3xs": 0.625,
  "2xs": 0.6875,
  xs: 0.75,
  sm: 0.875,
  base: 1,
  lg: 1.125,
  xl: 1.25,
  "2xl": 1.5,
  "3xl": 1.875,
  "4xl": 2.25,
  "5xl": 3,
  "6xl": 3.75,
  "7xl": 4.5,
};

/** CSS font size for a text step, e.g. "0.75rem" (config override, else default). */
export function fontSize(step: TextStep): string {
  return `${THEME.typography.sizes?.[step] ?? DEFAULT_TEXT_REM[step]}rem`;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const channels = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (n: number) => n.toString(16).padStart(2, "0");

/** Linear RGB mix of two "#rrggbb" colors; t = 0 gives a, t = 1 gives b. */
export function mixHex(a: string, b: string, t: number): string {
  const f = clamp01(t);
  const ca = channels(a);
  const cb = channels(b);
  return `#${ca.map((c, i) => toHex(Math.round(c + (cb[i] - c) * f))).join("")}`;
}

/** Color at t (clamped to 0..1) along evenly spaced stops, mixing linearly between neighbours. */
export function scaleColor(stops: readonly string[], t: number): string {
  const segment = clamp01(t) * (stops.length - 1);
  const index = Math.min(Math.floor(segment), stops.length - 2);
  return mixHex(stops[index], stops[index + 1], segment - index);
}

/** "#rrggbb" plus an alpha channel: withAlpha("#44499c", 0.5) -> "#44499c80". */
export function withAlpha(hex: string, alpha: number): string {
  return `${hex}${toHex(Math.round(clamp01(alpha) * 255))}`;
}
