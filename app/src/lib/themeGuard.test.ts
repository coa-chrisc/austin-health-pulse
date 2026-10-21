// Fails on hard-coded colors, fonts, sizes and radii outside the theme.
// Use THEME / fontSize() / the semantic Tailwind utilities instead. A line
// containing `theme-exempt: <reason>` is skipped, as are comment-only lines
// (they render nothing).
import { describe, expect, it } from "vitest";

const sources: Record<string, string> = {
  ...import.meta.glob<string>("../components/**/*.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob<string>(["./**/*.ts", "!./**/*.test.ts", "!./theme.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  }),
};

const PALETTE =
  "white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PREFIX =
  "bg|text|border|ring|fill|stroke|from|via|to|outline|divide|accent|caret|decoration|placeholder";

const RULES: [name: string, pattern: RegExp][] = [
  ["hex literal", /["'`][^"'`\n]*#[0-9a-fA-F]{3,8}\b/],
  ["rgb/hsl/oklch", /\b(?:rgba?|hsla?|oklch)\(/],
  ["Tailwind palette color", new RegExp(`(?<![\\w-])(?:${PREFIX})-(?:${PALETTE})(?![\\w])`)],
  ["aph- token", /(?<![A-Za-z0-9])aph-/],
  ["APH_COLORS", /\bAPH_COLORS\b/],
  ["arbitrary text size", /\btext-\[/],
  ["Tailwind radius", /(?<![\w-])rounded(?:-[tblr]{1,2})?-(?:sm|md|lg|xl|2xl|3xl)(?![\w-])/],
  ["bare rounded", /(?<![\w-])rounded(?:-[tblr]{1,2})?(?![\w-])/],
  ["numeric fontSize", /\bfontSize\s*[:=]\s*[{"'`]?\s*\d/],
  ["literal fontFamily", /\bfontFamily\s*[:=]\s*\{?\s*["'`]/],
];

const EXEMPT = /theme-exempt:\s*\S/;
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

function violations(): string[] {
  const found: string[] = [];
  for (const [file, text] of Object.entries(sources).sort()) {
    const name = file.replace(/^\.\.\//, "src/").replace(/^\.\//, "src/lib/");
    text.split("\n").forEach((line, i) => {
      if (EXEMPT.test(line) || COMMENT_LINE.test(line)) return;
      for (const [rule, pattern] of RULES) {
        if (pattern.test(line)) found.push(`${name}:${i + 1} ${rule}: ${line.trim()}`);
      }
    });
  }
  return found;
}

describe("theme guard", () => {
  it("scans components and lib", () => {
    expect(Object.keys(sources).some((f) => f.includes("/components/"))).toBe(true);
    expect(Object.keys(sources)).toContain("./colorScales.ts");
    expect(Object.keys(sources)).not.toContain("./theme.ts");
  });

  it("flags each rule and honours the exemption marker", () => {
    const hit = (line: string) => RULES.filter(([, re]) => re.test(line)).map(([n]) => n);
    expect(hit('color: "#44499C",')).toEqual(["hex literal"]);
    expect(hit('className="bg-white/80 text-gray-500"')).toEqual(["Tailwind palette color"]);
    expect(hit('className="text-aph-blue"')).toEqual(["aph- token"]);
    expect(hit('className="rounded-lg"')).toEqual(["Tailwind radius"]);
    expect(hit('className="rounded-t-2xl"')).toEqual(["Tailwind radius"]);
    expect(hit('className="px-2 rounded"')).toEqual(["bare rounded"]);
    expect(hit('className="text-[10px]"')).toEqual(["arbitrary text size"]);
    expect(hit("fontSize: 11,")).toEqual(["numeric fontSize"]);
    expect(hit('fontSize="26"')).toEqual(["numeric fontSize"]);
    expect(hit('fontFamily: "Geist, sans-serif",')).toEqual(["literal fontFamily"]);
    expect(hit("background: rgba(0, 0, 0, 0.5)")).toEqual(["rgb/hsl/oklch"]);
    // Theme-driven code passes.
    expect(hit('className="bg-surface text-on-brand/80 rounded-card rounded-full text-2xs"')).toEqual([]);
    expect(hit('className="bg-accent-soft border-line paragraph-x"')).toEqual([]);
    expect(hit("fontSize: fontSize(\"xs\"), fontFamily: FONT_FAMILY,")).toEqual([]);
    expect(hit('navigate("#/explore")')).toEqual([]);
    expect(EXEMPT.test('fontSize="26" {/* theme-exempt: viewBox units */}')).toBe(true);
    expect(EXEMPT.test("theme-exempt:")).toBe(false);
  });

  it("finds no hard-coded colors, fonts, text sizes or radii", () => {
    expect(violations()).toEqual([]);
  });
});
