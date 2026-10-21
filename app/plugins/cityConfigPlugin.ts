import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:city-config";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../..");
const CONFIG_DIR = path.join(REPO_ROOT, "config");

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** `--color-aph-*` declarations; only well-formed keys and hex values are emitted. */
function brandStyle(colors: Record<string, string>): string {
  const decls = Object.entries(colors)
    .filter(([k, v]) => /^[a-zA-Z]+$/.test(k) && /^#[0-9A-Fa-f]{6}$/.test(v))
    .map(([k, v]) => `--color-aph-${kebab(k)}:${v}`);
  return `<style id="brand-colors">:root{${decls.join(";")}}</style>`;
}

/** Generated favicon: rounded square in the secondary color with a white plus. */
function faviconLink(green: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="${green}"/>` +
    `<path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="#fff"/></svg>`;
  return `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(svg)}">`;
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
      brand: { logoUrl: string | null; colors: Record<string, string> };
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
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      this.addWatchFile(configPath);
      this.addWatchFile(schemaPath);
      return load();
    },
    // Static <title>/description so crawlers and link previews match the config.
    transformIndexHtml(html) {
      const { appName, region, agency, brand } = readConfig();
      const description = `${appName} - Explore health outcomes by ZIP code across ${region.name}. A tool by ${agency.name}.`;
      const head = brandStyle(brand.colors) + faviconLink(brand.colors.green);
      return html
        .replaceAll("%APP_NAME%", escapeHtml(appName))
        .replaceAll("%APP_DESCRIPTION%", escapeHtml(description))
        .replace("</head>", `${head}\n  </head>`);
    },
    configureServer(server) {
      server.watcher.add([configPath, schemaPath]);
      server.watcher.on("change", (file) => {
        if (file !== configPath && file !== schemaPath) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
