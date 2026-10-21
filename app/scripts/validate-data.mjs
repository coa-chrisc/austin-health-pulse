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
