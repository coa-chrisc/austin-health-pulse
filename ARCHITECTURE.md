# Architecture

Austin Health Pulse is a fully static site. A Python pipeline produces data files ahead of time; a Vite/React app displays them. There is no backend.

```
 preset (config/presets/*.json)             config/city.config.json
   | "pipeline" block (FIPS, ZCTAs, crime)    (active config, CITY_CONFIG)
   v
 scripts/export_frontend_json.py  -- USALEEP CSV (data/raw) + Census + ACS + CDC PLACES (+ APD crime)
 scripts/prepare_geojson.py       -- Census ZCTA boundaries
   v
 config/data/<id>/{zip-indicators.json, county-summary.json (incl. scenarioModel), boundaries.geojson}
   v   (npm run validate:data)
 app/plugins/cityConfigPlugin.ts  -> virtual:city-config  { cityConfig, dataUrls }
   v   (Vite fingerprints data files into dist/assets)
 loadAllData() -> HealthDataContext -> Neighborhood / Explore / Compare / Showcase
```

## Pipeline

[`scripts/`](scripts/) reads a preset's `pipeline` block (state and county FIPS, optional ZCTA list, crime source) and writes to the preset's `data` paths under `config/data/<id>/`. If no ZCTA list is given it is derived: ZCTAs with at least 50% of their 2010 population in the county. The pipeline aggregates USALEEP tract life expectancy to ZCTA with Census 2010 ZCTA-tract population weights. Area averages in `county-summary.json` are simple unweighted means of the ZIP values. The pipeline supports Texas only today (the CSVs in `data/raw` are Texas statewide); for other states it stops with a message naming the file to download. Crime is Austin-APD-only. Sources, order, and the Census API key: [`data/README.md`](data/README.md).

## Config selection

`config/city.config.json` is the active config. `CITY_CONFIG` (path relative to `config/`) selects another, such as `presets/partner-city-demo.json`. The Vite plugin validates it against [`city.config.schema.json`](config/city.config.schema.json), strips the `pipeline` block and `$schema` (they never reach the browser bundle), and exposes the rest as `virtual:city-config`. Its `data` block entries are imported with `?url`, so the data files become fingerprinted assets in `dist/assets`. The plugin also fills the page title and description from the config. `BASE_PATH` sets the Vite `base` (default `/austin-health-pulse/`; the Docker build uses `/`). The plugin also writes `brand.colors` into the page `<head>` as `--color-aph-*` CSS variables (so the default palette never flashes), adds a favicon generated from the `green` color, and bundles the optional `brand.logoUrl` file (exported as `logoSrc`). Rebranding steps: [`docs/CUSTOMIZING.md`](docs/CUSTOMIZING.md).

## Frontend

- `App.tsx` calls `loadAllData()` (`src/lib/dataLoader.ts`), which fetches the three data URLs in parallel and caches them. The result goes into `HealthDataContext`; components read it with `useHealthData()` and do not fetch themselves.
- The ZIP list is the set of keys in the loaded indicators file; there is no hardcoded ZIP list in the frontend.
- `HashRouter` (required so the static host needs no rewrite rules). Routes: `/` Neighborhood, `/explore` (lazy, Leaflet choropleth), `/compare` (lazy).
- Kiosk mode: after `IDLE_TIMEOUT_MS` (5 min) `IdleShowcase` overlays the app (disabled under 768px wide and with `?kiosk=off`). When it starts, `AppShell` remounts all views and returns home, which clears the previous visitor's inputs. This is a product feature for booths; keep `useIdleTimer` wired in.
- Optional features: the individual lifespan estimator and the Service Guide link (`serviceGuideUrl` or `VITE_SERVICE_GUIDE_URL`). The estimator is controlled by `VITE_ENABLE_PERSONAL_CALCULATOR`. The code default is off, and its lazy chunk is never loaded when off. Docker builds default to off. The GitHub Pages workflow defaults it to on for the live demo (repository variable `ENABLE_PERSONAL_CALCULATOR=false` turns it off). It runs in the browser and sends and stores nothing.
- Fonts (Geist, Material Symbols) are bundled through `@fontsource` packages. The only third-party host the browser contacts is `tile.openstreetmap.org`, for map tiles.

## Scenario model

The Neighborhood Equity Scenario Simulator ([`EquityScenarioSimulator.tsx`](app/src/components/scenario/EquityScenarioSimulator.tsx), logic in [`equityScenario.ts`](app/src/lib/equityScenario.ts)) uses `scenarioModel` in `county-summary.json`, computed by [`scenario_model.py`](scripts/scenario_model.py) (`export_frontend_json.py --model-only` recomputes it offline).

Method:

- For each indicator, a bivariate OLS regression of ZIP life expectancy on that indicator across the region's ZIPs.
- A lever is offered only if the slope is negative and its 95% confidence interval excludes zero. In Austin this gives uninsured (-0.19 yr per point, R² .29, n 61), diabetes (-0.39, R² .14), and obesity (-0.36, R² .40); poverty and hypertension are excluded. All five qualify for Harris County.
- One lever at a time. Levers are not summed, because the indicators are strongly collinear across ZIPs (Austin: uninsured-obesity r = 0.79, diabetes-obesity r = 0.83).
- The slider runs from the ZIP's current rate to the best observed ZIP rate; there is no extrapolation beyond observed data.
- Output: years of life expectancy with 95% CI, R², and n, labeled as an association, not a forecast.

Limitations: the model is ecological (ZIP-level) and cross-sectional, and is not adjusted for age structure or other confounders. For example, the "best" diabetes and hypertension ZIP in Austin is 78705, a student-heavy area (West Campus). The simulator tells users on screen that its fits are not age-adjusted. The model does not show that changing a rate would change life expectancy. Method review with epidemiologists is proposed Phase 2 work ([README](README.md#phase-2-roadmap-proposed-grant-funded)).

## Validation

`npm run validate:data` (from `app/`; `-- --all` also checks every preset) schema-validates configs and `zip-indicators.json`, checks that every data ZIP has a boundary polygon (a warning only for all-null records, such as Austin 78646, which has no Census polygon), that featured and data-quality ZIPs exist, and that `scenarioModel` is present. It runs in CI before the build and in the Docker build. The script lives in `app/scripts` because it uses the app's node dependencies.

## Known data caveat

The curated Austin 63-ZIP list covers Travis County and neighboring areas. Sixteen ZCTAs have under 50% of their population in Travis County, and 6 of those have none. The app used to label the region "Travis County". It now says "Greater Austin" (`region.name` in the config). Area "averages" are simple unweighted means of the ZIP values, not population-weighted county figures. The 11.6-year life expectancy gap runs from 78732 (86.85 years) to 78721 (75.26 years), both majority-Travis ZIP codes.

## Deploy targets

- GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), served at `/austin-health-pulse/`.
- Container: [`Dockerfile`](Dockerfile) (build with Node, serve with nginx-unprivileged on 8080) and [`docker-compose.yml`](docker-compose.yml).
- Blueprints for AWS, Azure, and GCP: [`deploy/README.md`](deploy/README.md). Not deployed to any cloud.

Security notes: [SECURITY.md](SECURITY.md).
