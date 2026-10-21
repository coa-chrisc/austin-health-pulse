import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TEXT_REM,
  FONT_FAMILY,
  THEME,
  fontSize,
  mixHex,
  scaleColor,
  withAlpha,
} from "./theme";

describe("mixHex", () => {
  it("returns the ends at t = 0 and t = 1", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("mixes each channel linearly and rounds", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#F83125", "#FF8F00", 0.25)).toBe("#fa491c");
  });

  it("clamps t", () => {
    expect(mixHex("#102030", "#405060", -1)).toBe("#102030");
    expect(mixHex("#102030", "#405060", 2)).toBe("#405060");
  });
});

describe("scaleColor", () => {
  const stops = ["#000000", "#ff0000", "#ffffff"];

  it("returns the first and last stop at the ends", () => {
    expect(scaleColor(stops, 0)).toBe("#000000");
    expect(scaleColor(stops, 1)).toBe("#ffffff");
  });

  it("hits interior stops and mixes within a segment", () => {
    expect(scaleColor(stops, 0.5)).toBe("#ff0000");
    expect(scaleColor(stops, 0.25)).toBe("#800000");
    expect(scaleColor(stops, 0.75)).toBe("#ff8080");
  });

  it("clamps t outside 0..1", () => {
    expect(scaleColor(stops, -0.5)).toBe("#000000");
    expect(scaleColor(stops, 1.5)).toBe("#ffffff");
  });

  it("works with two stops", () => {
    expect(scaleColor(["#000000", "#ffffff"], 0.5)).toBe("#808080");
  });
});

describe("withAlpha", () => {
  it("appends a two-digit alpha channel", () => {
    expect(withAlpha("#44499c", 0x18 / 255)).toBe("#44499c18");
    expect(withAlpha("#44499c", 0)).toBe("#44499c00");
    expect(withAlpha("#44499c", 1)).toBe("#44499cff");
    expect(withAlpha("#44499c", 0.5)).toBe("#44499c80");
  });
});

describe("fontSize", () => {
  it("uses the default rem when the config does not override a step", () => {
    expect(fontSize("xs")).toBe(`${THEME.typography.sizes?.xs ?? 0.75}rem`);
    expect(DEFAULT_TEXT_REM["3xs"]).toBe(0.625);
    expect(DEFAULT_TEXT_REM["2xs"]).toBe(0.6875);
  });

  it("prefers the config override", async () => {
    vi.resetModules();
    vi.doMock("./cityConfig", async (importOriginal) => {
      const real = await importOriginal<typeof import("./cityConfig")>();
      const theme = real.cityConfig.theme;
      return {
        ...real,
        cityConfig: {
          ...real.cityConfig,
          theme: { ...theme, typography: { ...theme.typography, sizes: { sm: 0.95 } } },
        },
      };
    });
    const mocked = await import("./theme");
    expect(mocked.fontSize("sm")).toBe("0.95rem");
    expect(mocked.fontSize("base")).toBe("1rem");
    vi.doUnmock("./cityConfig");
  });
});

describe("FONT_FAMILY", () => {
  it("matches the --font-sans stack the plugin emits", () => {
    expect(FONT_FAMILY).toBe(
      `"${THEME.typography.family}", ${THEME.typography.fallback}`,
    );
  });
});
