# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is a two-part project: a **Vite/React frontend** (`app/`) and a **Python data pipeline** (`scripts/`) that produces the static JSON the frontend consumes. Raw source data (`data/raw/TX_A.CSV`, `data/raw/TX_B.CSV` from CDC USALEEP) lives in `data/raw/`; see `data/README.md` for sources and pipeline order. City config, presets, and generated data live in `config/`; see `ARCHITECTURE.md`.

The frontend is deployed as a **fully static** site to GitHub Pages — there is no backend, no database, no API. All data is precomputed by the Python scripts into JSON files in `config/data/<id>/`.

## Common commands

All frontend commands run from `app/`:

```bash
cd app
npm ci                   # first-time / after dependency changes (Node 22.12+)
npm run dev              # dev server at http://localhost:5173/austin-health-pulse/
npm run build            # tsc -b && vite build → app/dist
npm run lint             # eslint
npm test                 # vitest
npm run validate:data    # schema + data checks (-- --all for every preset)
npm run preview          # serve the production build locally
```

CI runs `npm ci`, `npm run lint`, `npm test`, `npm run validate:data -- --all`, then `npm run build` on Node 22 (see `.github/workflows/deploy.yml`). The build reads `VITE_SERVICE_GUIDE_URL` (repo variable `SERVICE_GUIDE_URL`; see `app/.env.example`); when unset (and no `serviceGuideUrl` in the config), production hides the service guide links.

Build selectors: `CITY_CONFIG=presets/<name>.json` (relative to `config/`), `BASE_PATH` (default `/austin-health-pulse/`), `VITE_ENABLE_PERSONAL_CALCULATOR=true` (opt-in individual calculator, off by default; CI var `ENABLE_PERSONAL_CALCULATOR`). Container: `docker compose up --build` (see `deploy/README.md`).

Data pipeline (run from repo root, regenerates files in the preset's `config/data/<id>/`):

```bash
python scripts/export_frontend_json.py [--preset config/presets/<id>.json] [--model-only]  # zip-indicators.json + county-summary.json
python scripts/prepare_geojson.py [--preset ...]                                          # boundaries.geojson
```

The export script reads `data/raw/TX_A.CSV`/`TX_B.CSV` locally and fetches Census ZCTA-tract crosswalks + ACS + CDC PLACES + APD crime data over HTTP. The Census API now requires `CENSUS_API_KEY`; without it the export falls back to the ACS summary files (slow, ~260 MB download).

## Architecture

### Data flow

1. Python pipeline (driven by a preset's `pipeline` block) aggregates **tract-level** USALEEP life expectancy to **ZCTA** using Census 2010 ZCTA-tract relationship population weights, joins ACS poverty/uninsured + PLACES diabetes/hypertension/obesity/asthma + APD violent crime (Austin only), computes the `scenarioModel` regression block, and writes three static files into `config/data/<id>/`.
2. `app/plugins/cityConfigPlugin.ts` exposes the active config as `virtual:city-config` (`src/lib/cityConfig.ts`); data files are imported with `?url` and fingerprinted by Vite. On app load, `App.tsx` calls `loadAllData()` (`src/lib/dataLoader.ts`), which fetches the three URLs in parallel and module-caches them.
3. Loaded data is stored in `HealthDataContext` (defined in `src/hooks/useHealthData.ts`) and consumed by every mode via `useHealthData()`. Components should not re-fetch — always go through the context.

### Routing & modes

`HashRouter` (so the GitHub Pages base path `/austin-health-pulse/` works without server config). `AppShell` renders three top-level routes corresponding to the product's three modes:

- `/` → `NeighborhoodMode` — single-ZIP lookup with gauge charts
- `/explore` → `ExploreMode` (lazy) — Leaflet choropleth
- `/compare` → `CompareMode` (lazy) — multi-ZIP radar / bars / table

`AppShell` also drives the **kiosk idle showcase**: after `IDLE_TIMEOUT_MS` (5 min) of inactivity, `IdleShowcase` overlays the app. This is a real product feature for conference booths, not a debug toggle — keep `useIdleTimer` wired in.

### Key invariants

- Base path comes from `BASE_PATH` (default `/austin-health-pulse/`, `vite.config.ts`). New data files must be added through the config `data` block (imported via `virtual:city-config`), not fetched by string path.
- `HashRouter` is required by Pages deployment — do not switch to `BrowserRouter` without changing the deploy strategy.
- There is no hardcoded ZIP list in the frontend (`TRAVIS_COUNTY_ZCTAS` is gone): the ZIP set is the keys of the loaded indicators data. The pipeline's list is `pipeline.zctas` in the preset (or derived from the county FIPS when omitted).
- The `pipeline` block is stripped from the browser bundle; configs are schema-validated (`config/city.config.schema.json`) at build time and by `validate:data`.
- Indicator metadata (`IndicatorKey`, `INDICATOR_LABELS`, `INDICATOR_UNITS`, `INDICATOR_HIGHER_IS_BETTER`) lives in `src/types/health.ts`. Adding a new indicator requires updating the Python export (and `config/indicators.schema.json`), the `ZctaHealthData` / `CountySummary` types, and these three lookup maps.
- Brand colors come from the config's `brand.colors`, exposed as `APH_COLORS` (`src/lib/constants.ts`) and applied to the `--color-aph-*` CSS variables at startup (`src/lib/applyBrand.ts`). Use these (or the Tailwind `aph-*` utilities) instead of arbitrary hex values; the Austin palette is in `config/city.config.json`.
- The individual lifespan calculator is opt-in (`ENABLE_PERSONAL_CALCULATOR` in `constants.ts`). Keep it behind the flag and lazy-loaded; the default build must stay aggregate-public-data-only.
- Scenario simulator (`src/lib/equityScenario.ts`, `scenarioModel` from the pipeline): one lever at a time, never summed (indicators are collinear); a lever is offered only if slope < 0 and its 95% CI excludes zero; no extrapolation past the best observed ZIP; always labeled an association, not a forecast.

### Styling

Tailwind CSS 4 via `@tailwindcss/vite` (no `tailwind.config.js` — config is inline in CSS). Geist font + Material Symbols icons are loaded globally.

## Things to know

- `data/raw/` holds the USALEEP CSVs, committed because the pipeline needs them. Excel duplicates (`*.XLSX`) and the brand-guidelines PDF are gitignored local files.
- `.claude/` is gitignored: local editor/agent state, not project state.
