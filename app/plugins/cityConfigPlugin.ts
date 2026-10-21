import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import type { Plugin } from "vite";
import type { Theme } from "../src/types/cityConfig.ts";

const VIRTUAL_ID = "virtual:city-config";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const FONTS_ID = "virtual:theme-fonts";
const RESOLVED_FONTS_ID = "\0" + FONTS_ID;

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../..");
const APP_ROOT = path.resolve(here, "..");
const CONFIG_DIR = path.join(REPO_ROOT, "config");

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// Same patterns and ranges as config/city.config.schema.json. themeStyle()
// re-checks every value so nothing can break out of the injected <style>.
const HEX = /^#[0-9A-Fa-f]{6}$/;
const COLOR_KEY = /^[a-z][A-Za-z]*$/;
const FAMILY = /^[A-Za-z0-9 ]+$/;
const FALLBACK = /^[A-Za-z0-9 ,-]+$/;
const LENGTH = /^\d+(\.\d+)?(rem|px)$/;
const TEXT_STEPS = new Set([
  "3xs", "2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
]);
const RADIUS_KEYS = new Set(["chip", "control", "card", "panel"]);
const FONT_WEIGHTS = [400, 500, 600, 700];

const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const isStr = (v: unknown, re: RegExp): v is string =>
  typeof v === "string" && re.test(v);

/**
 * The theme as one unlayered `<style id="theme">`. Unlayered rules beat
 * Tailwind's `@layer theme`, so these values override the index.css
 * placeholders. Invalid keys or values are dropped, not escaped.
 */
export function themeStyle(theme: Theme): string {
  const decls: string[] = [];
  for (const [k, v] of Object.entries(theme.colors ?? {})) {
    if (COLOR_KEY.test(k) && isStr(v, HEX)) decls.push(`--color-${kebab(k)}:${v}`);
  }
  const list = (name: string, values: unknown) => {
    if (!Array.isArray(values)) return;
    values.forEach((v, i) => {
      if (isStr(v, HEX)) decls.push(`--color-${name}-${i + 1}:${v}`);
    });
  };
  list("scale", theme.dataScale);
  list("series", theme.series);

  const { family, fallback, baseSize, sizes } = theme.typography ?? {};
  const stack = [
    ...(isStr(family, FAMILY) ? [`"${family}"`] : []),
    ...(isStr(fallback, FALLBACK) ? [fallback] : []),
  ];
  if (stack.length) decls.push(`--font-sans:${stack.join(", ")}`);
  for (const [step, rem] of Object.entries(sizes ?? {})) {
    if (TEXT_STEPS.has(step) && inRange(rem, 0.5, 6)) decls.push(`--text-${step}:${rem}rem`);
  }
  for (const [k, v] of Object.entries(theme.radius ?? {})) {
    if (RADIUS_KEYS.has(k) && isStr(v, LENGTH)) decls.push(`--radius-${k}:${v}`);
  }

  const html = inRange(baseSize, 12, 24) ? `html{font-size:${(baseSize / 16) * 100}%}` : "";
  return `<style id="theme">:root{${decls.join(";")}}${html}</style>`;
}

/** Generated favicon: rounded square in the accent color with a plus in onBrand. */
function faviconLink({ accent, onBrand }: Theme["colors"]): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${accent}"/>` +
    `<path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="${onBrand}"/></svg>`;
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
}

/** `virtual:theme-fonts` source: the four UI weights of the configured package
 * (fontPackage is schema-checked against ^@fontsource/[a-z0-9-]+$ in readConfig). */
function themeFonts(fontPackage: string, configRel: string): string {
  return FONT_WEIGHTS.map((w) => {
    const file = path.join(APP_ROOT, "node_modules", fontPackage, `latin-${w}.css`);
    if (!fs.existsSync(file)) {
      throw new Error(
        `[city-config] ${configRel}: theme.typography.fontPackage ${fontPackage} is not installed ` +
          `(missing ${path.relative(REPO_ROOT, file)}). Run \`npm install ${fontPackage}\` in app/.`,
      );
    }
    return `import ${JSON.stringify(`${fontPackage}/latin-${w}.css`)};`;
  }).join("\n");
}

/**
 * Serves the active city config (config/<CITY_CONFIG>) as `virtual:city-config`.
 * The config is schema-validated at build time; data files are imported with
 * `?url` so Vite fingerprints them into dist/assets and serves them in dev.
 */
export default function cityConfigPlugin(): Plugin {
  const configRel = process.env.CITY_CONFIG ?? "city.config.json";
  const configPath = path.resolve(CONFIG_DIR, configRel);
  const schemaPath = path.join(CONFIG_DIR, "city.config.schema.json");

  function readConfig() {
    if (!fs.existsSync(configPath)) {
      throw new Error(`[city-config] Config not found: ${configPath}`);
    }
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
      pipeline: unknown;
      appName: string;
      region: { name: string };
      agency: { name: string };
      $schema?: string;
      brand: { logoUrl: string | null };
      theme: Theme;
      data: { indicators: string; boundaries: string; summary: string };
    };
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      schema,
    );
    if (!validate(raw)) {
      const lines = (validate.errors ?? []).map(
        (e) => `  ${e.instancePath || "(root)"} ${e.message}`,
      );
      throw new Error(
        `[city-config] ${configRel} is invalid:\n${lines.join("\n")}`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped on purpose
    const { pipeline, $schema, ...cityConfig } = raw;
    return cityConfig;
  }

  function load(): string {
    const cityConfig = readConfig();
    const dataPath = (rel: string) => path.resolve(CONFIG_DIR, rel);
    const { indicators, boundaries, summary } = cityConfig.data;
    for (const rel of [indicators, boundaries, summary]) {
      if (!fs.existsSync(dataPath(rel))) {
        throw new Error(
          `[city-config] ${configRel}: data file not found: ${dataPath(rel)}`,
        );
      }
    }
    const logoRel = cityConfig.brand.logoUrl;
    if (logoRel && !fs.existsSync(dataPath(logoRel))) {
      throw new Error(
        `[city-config] ${configRel}: brand.logoUrl file not found: ${dataPath(logoRel)}`,
      );
    }
    return [
      ...(logoRel
        ? [`import logoSrc from ${JSON.stringify(dataPath(logoRel) + "?url")};`]
        : [`const logoSrc = null;`]),
      `import indicators from ${JSON.stringify(dataPath(indicators) + "?url")};`,
      `import boundaries from ${JSON.stringify(dataPath(boundaries) + "?url")};`,
      `import summary from ${JSON.stringify(dataPath(summary) + "?url")};`,
      `export const cityConfig = ${JSON.stringify(cityConfig)};`,
      `export { logoSrc };`,
      `export const dataUrls = { indicators, boundaries, summary };`,
    ].join("\n");
  }

  return {
    name: "city-config",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      if (id === FONTS_ID) return RESOLVED_FONTS_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID && id !== RESOLVED_FONTS_ID) return null;
      this.addWatchFile(configPath);
      this.addWatchFile(schemaPath);
      return id === RESOLVED_ID
        ? load()
        : themeFonts(readConfig().theme.typography.fontPackage, configRel);
    },
    // Static <title>/description so crawlers and link previews match the config.
    transformIndexHtml(html) {
      const { appName, region, agency, theme } = readConfig();
      const description = `${appName} - Explore health outcomes by ZIP code across ${region.name}. A tool by ${agency.name}.`;
      const head = themeStyle(theme) + faviconLink(theme.colors);
      return html
        .replaceAll("%APP_NAME%", escapeHtml(appName))
        .replaceAll("%APP_DESCRIPTION%", escapeHtml(description))
        .replace("</head>", `${head}\n  </head>`);
    },
    configureServer(server) {
      server.watcher.add([configPath, schemaPath]);
      server.watcher.on("change", (file) => {
        if (file !== configPath && file !== schemaPath) return;
        for (const id of [RESOLVED_ID, RESOLVED_FONTS_ID]) {
          const mod = server.moduleGraph.getModuleById(id);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
