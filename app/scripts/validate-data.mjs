// Validates a city config and its data files before build/deploy.
//   node scripts/validate-data.mjs          -> active config (CITY_CONFIG, default city.config.json)
//   node scripts/validate-data.mjs --all    -> active config + every config/presets/*.json
// Exits 1 with a list of every failure; prints one OK line per passing config.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = path.dirname(fileURLToPath(import.meta.url));
const configDir = path.resolve(here, "../../config");

const LEVER_KEYS = ["povertyRate", "uninsuredRate", "diabetes", "hypertension", "obesity"];
const FONT_WEIGHTS = [400, 500, 600, 700];

// [foreground, background, minimum ratio]. 4.5:1 is WCAG AA for body text;
// 3:1 is the non-text minimum (warning is used for icons only).
const CONTRAST_PAIRS = [
  ["body", "page", 4.5],
  ["body", "surface", 4.5],
  ["muted", "surface", 4.5],
  ["muted", "page", 4.5],
  ["ink", "page", 4.5],
  ["ink", "primarySoft", 4.5],
  ["primary", "surface", 4.5],
  ["onBrand", "primary", 4.5],
  ["onBrand", "ink", 4.5],
  ["onBrand", "accent", 4.5],
  ["onBrand", "positiveFill", 4.5],
  ["positive", "surface", 4.5],
  ["negative", "surface", 4.5],
  ["warning", "surface", 3],
];

/** WCAG 2 relative luminance of a "#rrggbb" color. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const rel = (p) => path.relative(path.resolve(here, "../.."), p);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats.default ? addFormats.default(ajv) : addFormats(ajv);
const validateConfig = ajv.compile(readJson(path.join(configDir, "city.config.schema.json")));
const validateIndicators = ajv.compile(readJson(path.join(configDir, "indicators.schema.json")));

const schemaErrors = (validate) =>
  (validate.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message}`);

function featureZip(feature) {
  const p = feature.properties ?? {};
  return p.ZCTA5CE20 ?? p.ZCTA5CE10 ?? p.GEOID20 ?? p.GEOID10 ?? null;
}

/** Returns { errors, warnings } for one config file. */
function checkConfig(configPath) {
  const errors = [];
  const warnings = [];
  const fail = (msg) => errors.push(msg);

  let config;
  try {
    config = readJson(configPath);
  } catch (err) {
    return { errors: [`cannot read config: ${err.message}`], warnings };
  }
  if (!validateConfig(config)) {
    for (const m of schemaErrors(validateConfig)) fail(`config schema: ${m}`);
    return { errors, warnings };
  }

  const { fontPackage } = config.theme.typography;
  for (const w of FONT_WEIGHTS) {
    const css = path.resolve(here, "../node_modules", fontPackage, `latin-${w}.css`);
    if (!fs.existsSync(css)) {
      fail(`theme.typography.fontPackage: ${rel(css)} not found (run \`npm install ${fontPackage}\` in app/)`);
      break;
    }
  }
  const colors = config.theme.colors;
  for (const [fg, bg, min] of CONTRAST_PAIRS) {
    const ratio = contrastRatio(colors[fg], colors[bg]);
    if (ratio < min) {
      warnings.push(`theme contrast: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (WCAG minimum ${min}:1)`);
    }
  }

  if (config.brand.logoUrl) {
    const logo = path.resolve(configDir, config.brand.logoUrl);
    if (!fs.existsSync(logo)) fail(`brand.logoUrl: file not found: ${rel(logo)}`);
  }

  const load = (key) => {
    const file = path.resolve(configDir, config.data[key]);
    try {
      return readJson(file);
    } catch (err) {
      fail(`data.${key} (${rel(file)}): ${err.message}`);
      return null;
    }
  };
  const indicators = load("indicators");
  const boundaries = load("boundaries");
  const summary = load("summary");

  let zips = new Set();
  if (indicators) {
    if (!validateIndicators(indicators)) {
      for (const m of schemaErrors(validateIndicators)) fail(`${config.data.indicators}: ${m}`);
    }
    zips = new Set(Object.keys(indicators.zctas ?? {}));
  }

  if (boundaries && indicators) {
    const boundaryZips = new Set((boundaries.features ?? []).map(featureZip));
    for (const zip of zips) {
      if (boundaryZips.has(zip)) continue;
      // An all-null record (e.g. a PO-box ZIP Census never drew a polygon for)
      // has nothing to map, so a missing boundary is only a warning.
      if (indicators.zctas[zip].dataQuality === "missing") {
        warnings.push(`ZIP ${zip} has no boundary feature (dataQuality "missing")`);
      } else {
        fail(`ZIP ${zip} has data but no boundary feature`);
      }
    }
    for (const zip of boundaryZips) {
      if (!zips.has(zip)) warnings.push(`boundary feature ${zip} has no data`);
    }
  }

  if (indicators) {
    for (const { zip, label } of config.featuredZips) {
      if (!zips.has(zip)) fail(`featuredZips: ${zip} (${label}) not in zip-indicators.json`);
    }
    for (const zip of Object.keys(config.dataQualityNotes)) {
      if (!zips.has(zip)) fail(`dataQualityNotes: ${zip} not in zip-indicators.json`);
    }
  }

  if (summary) {
    const model = summary.scenarioModel;
    if (!model) {
      fail(`${config.data.summary}: missing scenarioModel`);
    } else {
      if (model.method !== "bivariate-ols") fail(`scenarioModel.method must be "bivariate-ols"`);
      if (model.outcome !== "lifeExpectancy") fail(`scenarioModel.outcome must be "lifeExpectancy"`);
      for (const group of ["levers", "excluded"]) {
        if (!Array.isArray(model[group])) {
          fail(`scenarioModel.${group} must be an array`);
          continue;
        }
        model[group].forEach((fit, i) => {
          const at = `scenarioModel.${group}[${i}]`;
          if (!LEVER_KEYS.includes(fit.indicator)) fail(`${at}: invalid indicator "${fit.indicator}"`);
          if (group === "excluded" && !fit.reason) fail(`${at}: missing reason`);
          if (group === "levers") {
            const [lo, hi] = fit.slopeCI95 ?? [];
            if (!(fit.slope < 0 && hi < 0)) fail(`${at}: lever slope/CI must be negative and exclude zero`);
            if (!(lo <= fit.slope && fit.slope <= hi)) fail(`${at}: slope outside slopeCI95`);
            if (!(fit.observedMin < fit.observedMax)) fail(`${at}: observedMin must be < observedMax`);
            if (indicators && !zips.has(fit.bestZip)) fail(`${at}: bestZip ${fit.bestZip} not in zip-indicators.json`);
          }
        });
      }
    }
  }

  return { errors, warnings };
}

const all = process.argv.includes("--all");
const active = path.resolve(configDir, process.env.CITY_CONFIG ?? "city.config.json");
const targets = [active];
if (all) {
  const presetDir = path.join(configDir, "presets");
  for (const f of fs.readdirSync(presetDir).sort()) {
    const p = path.join(presetDir, f);
    if (f.endsWith(".json") && !targets.includes(p)) targets.push(p);
  }
}

let failed = false;
for (const target of targets) {
  const { errors, warnings } = checkConfig(target);
  const name = rel(target);
  for (const w of warnings) console.warn(`warn  ${name}: ${w}`);
  if (errors.length > 0) {
    failed = true;
    console.error(`FAIL  ${name}`);
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    console.log(`OK    ${name}`);
  }
}
process.exit(failed ? 1 : 0);
