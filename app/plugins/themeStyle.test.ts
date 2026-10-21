import { describe, expect, it } from "vitest";
import { themeStyle } from "./cityConfigPlugin.ts";
import type { Theme } from "../src/types/cityConfig.ts";

const fixture: Theme = {
  colors: {
    primary: "#44499C",
    primarySoft: "#dcf2fd",
    accent: "#009F4D",
    accentSoft: "#dff0e3",
    ink: "#22254E",
    onBrand: "#ffffff",
    page: "#f7f6f5",
    surface: "#ffffff",
    subtle: "#f3f4f6",
    body: "#1a1a1a",
    muted: "#636262",
    line: "#C6C5C4",
    noData: "#C6C5C4",
    positive: "#005027",
    positiveFill: "#009F4D",
    negative: "#F83125",
    warning: "#FF8F00",
    scrim: "#000000",
  },
  dataScale: ["#F83125", "#FF8F00", "#FFC600", "#009F4D", "#005027"],
  series: ["#44499C", "#009F4D", "#FF8F00"],
  typography: {
    fontPackage: "@fontsource/geist",
    family: "Geist",
    fallback: "Helvetica, Aptos, sans-serif",
    baseSize: 16,
    sizes: { xs: 0.8 },
  },
  radius: { chip: "0.25rem", control: "0.5rem", card: "0.75rem", panel: "1rem" },
};

/** Fixture with some fields replaced by arbitrary (untyped) values. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the point is to feed values the types forbid
type Loose = Record<string, any>;
const withBad = (patch: (t: Loose) => void): Theme => {
  const t = structuredClone(fixture) as unknown as Loose;
  patch(t);
  return t as unknown as Theme;
};

describe("themeStyle", () => {
  it("emits one unlayered <style id=theme> with every token", () => {
    expect(themeStyle(fixture)).toBe(
      '<style id="theme">:root{' +
        "--color-primary:#44499C;--color-primary-soft:#dcf2fd;--color-accent:#009F4D;" +
        "--color-accent-soft:#dff0e3;--color-ink:#22254E;--color-on-brand:#ffffff;" +
        "--color-page:#f7f6f5;--color-surface:#ffffff;--color-subtle:#f3f4f6;" +
        "--color-body:#1a1a1a;--color-muted:#636262;--color-line:#C6C5C4;" +
        "--color-no-data:#C6C5C4;--color-positive:#005027;--color-positive-fill:#009F4D;" +
        "--color-negative:#F83125;--color-warning:#FF8F00;--color-scrim:#000000;" +
        "--color-scale-1:#F83125;--color-scale-2:#FF8F00;--color-scale-3:#FFC600;" +
        "--color-scale-4:#009F4D;--color-scale-5:#005027;" +
        "--color-series-1:#44499C;--color-series-2:#009F4D;--color-series-3:#FF8F00;" +
        '--font-sans:"Geist", Helvetica, Aptos, sans-serif;' +
        "--text-xs:0.8rem;" +
        "--radius-chip:0.25rem;--radius-control:0.5rem;--radius-card:0.75rem;--radius-panel:1rem" +
        "}html{font-size:100%}</style>",
    );
  });

  it("does not use @layer", () => {
    expect(themeStyle(fixture)).not.toContain("@layer");
  });

  it("emits only overridden text steps", () => {
    const css = themeStyle(withBad((t) => (t.typography.sizes = {})));
    expect(css).not.toContain("--text-");
  });

  it("drops invalid keys and values", () => {
    const css = themeStyle(
      withBad((t) => {
        t.colors.primary = "red";
        t.colors["bad-key"] = "#123456";
        t.colors.Upper = "#123456";
        t.dataScale[1] = "#12345";
        t.series[2] = 7;
        t.typography.sizes = { xs: 0.1, sm: "1", huge: 2, lg: 1.2 };
        t.typography.baseSize = 40;
        t.radius.chip = "4";
        t.radius.round = "1rem";
      }),
    );
    expect(css).not.toContain("--color-primary:");
    expect(css).not.toContain("123456");
    expect(css).not.toContain("--color-scale-2");
    expect(css).toContain("--color-scale-3:#FFC600");
    expect(css).not.toContain("--color-series-3");
    expect(css).not.toMatch(/--text-(xs|sm|huge)/);
    expect(css).toContain("--text-lg:1.2rem");
    expect(css).not.toContain("--radius-chip");
    expect(css).not.toContain("--radius-round");
    expect(css).not.toContain("html{");
  });

  it("cannot be broken out of with <, ;, } or quotes", () => {
    const payloads = [
      "#000000;}</style><script>alert(1)</script>",
      '"; } body { display:none',
      "Geist</style>",
      "Geist'",
      "1rem;}html{display:none",
      "Helvetica; color: red",
      "Helvetica}",
    ];
    for (const p of payloads) {
      const css = themeStyle(
        withBad((t) => {
          t.colors.primary = p;
          t.colors[p] = "#000000";
          t.dataScale[0] = p;
          t.series[0] = p;
          t.typography.family = p;
          t.typography.fallback = p;
          t.typography.baseSize = p;
          t.typography.sizes = { [p]: 1, xs: p };
          t.radius.chip = p;
          t.radius[p] = "1rem";
        }),
      );
      const inner = css.slice('<style id="theme">'.length, -"</style>".length);
      expect(inner).not.toContain("<");
      expect(inner.match(/[{}]/g)).toEqual(["{", "}"]); // only :root{...}; baseSize was invalid
      expect(inner).not.toContain("'");
      expect(inner).not.toContain(p);
      // The only double quotes are the ones themeStyle puts around the family.
      expect(inner.match(/"/g) ?? []).toHaveLength(0);
    }
  });

  it("omits --font-sans entirely when family and fallback are both invalid", () => {
    const css = themeStyle(
      withBad((t) => {
        t.typography.family = "a;b";
        t.typography.fallback = "c}";
      }),
    );
    expect(css).not.toContain("--font-sans");
  });
});

describe("themeStyle and the schema", () => {
  it("emits every text step the schema allows", async () => {
    const fs = await import("node:fs");
    const schemaPath = new URL("../../config/city.config.schema.json", import.meta.url);
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const steps = Object.keys(
      schema.properties.theme.properties.typography.properties.sizes.properties,
    );
    const sizes = Object.fromEntries(steps.map((s) => [s, 1]));
    const css = themeStyle(withBad((t) => (t.typography.sizes = sizes)));
    for (const step of steps) expect(css).toContain(`--text-${step}:1rem`);
  });
});
