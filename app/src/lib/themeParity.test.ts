// Keeps the three copies of the theme contract in step: the config schema,
// the index.css @theme placeholders and the TS defaults in lib/theme.ts.
import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_REM, TEXT_STEPS } from "./theme";

// CSS `?raw` imports are empty under vitest (CSS is not processed), and the
// app tsconfig has no Node types, so read the files through an untyped fs.
const { readFileSync } = (await import("node:fs" as string)) as {
  readFileSync(path: URL, encoding: "utf8"): string;
};
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const indexCss = read("../index.css");
const schemaRaw = read("../../../config/city.config.schema.json");
const tailwindTheme = read("../../node_modules/tailwindcss/theme.css");

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const themeBlock = indexCss.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const schemaTheme = JSON.parse(schemaRaw).properties.theme.properties;

/** `--name: value;` declarations in a CSS block. */
const declared = (css: string) =>
  new Map(
    [...css.matchAll(/(--[\w*-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );

const themeVars = declared(themeBlock);
const tailwindVars = declared(tailwindTheme);

describe("theme parity", () => {
  it("index.css resets Tailwind's default palette", () => {
    expect(themeVars.get("--color-*")).toBe("initial");
  });

  it("declares a placeholder for every schema color", () => {
    const keys = Object.keys(schemaTheme.colors.properties);
    expect(keys).toHaveLength(18);
    for (const key of keys) {
      expect(themeVars.get(`--color-${kebab(key)}`), key).toBe("#ff00ff");
    }
  });

  it("declares placeholders for every data-scale and series slot", () => {
    for (let i = 1; i <= schemaTheme.dataScale.maxItems; i++) {
      expect(themeVars.get(`--color-scale-${i}`)).toBe("#ff00ff");
    }
    for (let i = 1; i <= schemaTheme.series.maxItems; i++) {
      expect(themeVars.get(`--color-series-${i}`)).toBe("#ff00ff");
    }
  });

  it("declares every schema radius key", () => {
    for (const key of Object.keys(schemaTheme.radius.properties)) {
      expect(themeVars.has(`--radius-${key}`), key).toBe(true);
    }
  });

  it("declares a --font-sans placeholder", () => {
    expect(themeVars.has("--font-sans")).toBe(true);
  });

  it("TEXT_STEPS matches the schema's size keys", () => {
    expect([...TEXT_STEPS]).toEqual(
      Object.keys(schemaTheme.typography.properties.sizes.properties),
    );
  });

  it("2xs/3xs defaults equal index.css", () => {
    for (const step of ["3xs", "2xs"] as const) {
      expect(themeVars.get(`--text-${step}`)).toBe(`${DEFAULT_TEXT_REM[step]}rem`);
      expect(themeVars.has(`--text-${step}--line-height`)).toBe(true);
    }
  });

  it("xs..7xl defaults equal Tailwind's theme.css", () => {
    for (const step of TEXT_STEPS.filter((s) => s !== "3xs" && s !== "2xs")) {
      expect(tailwindVars.get(`--text-${step}`), step).toBe(
        `${DEFAULT_TEXT_REM[step]}rem`,
      );
    }
  });
});
