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
    return [
      `import indicators from ${JSON.stringify(dataPath(indicators) + "?url")};`,
      `import boundaries from ${JSON.stringify(dataPath(boundaries) + "?url")};`,
      `import summary from ${JSON.stringify(dataPath(summary) + "?url")};`,
      `export const cityConfig = ${JSON.stringify(cityConfig)};`,
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
      const { appName, region, agency } = readConfig();
      const description = `${appName} - Explore health outcomes by ZIP code across ${region.name}. A tool by ${agency.name}.`;
      return html
        .replaceAll("%APP_NAME%", escapeHtml(appName))
        .replaceAll("%APP_DESCRIPTION%", escapeHtml(description));
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
