<h1 align="center">Austin Health Pulse</h1>

<p align="center">
  <strong>Life Expectancy & Health Indicator Explorer for Travis County</strong>
</p>

<p align="center">
  <a href="https://coa-chrisc.github.io/austin-health-pulse/">
    <img src="https://img.shields.io/badge/Live_Demo-GitHub_Pages-44499C?style=for-the-badge&logo=github" alt="Live Demo" />
  </a>
</p>

<p align="center">
  <sub>The live demo goes up once GitHub Pages is enabled on this repository.</sub>
</p>

<p align="center">
  An interactive public health data visualization tool that lets Austin residents and policymakers explore health outcomes across <strong>63 ZIP codes</strong> in Travis County, Texas.
</p>

---

## Built rapidly with AI assistance

This entire prototype — Python data pipeline, three interactive modes, choropleth map, comparison views, gauge charts, calculators, kiosk showcase, and deploy pipeline — was built by **Austin Public Health IT staff in approximately 12 hours of internal development time** (three four-hour sessions) using Claude as an AI pair programmer.

|                      | APH IT (this build) | Typical agency engagement        |
| -------------------- | ------------------- | -------------------------------- |
| **Time**             | ~12 hours           | 6-8 weeks                        |
| **Hours**            | 3 × 4-hr sessions   | 250-400 hours                    |
| **Approximate cost** | ~$1.5K loaded staff | $50K-$100K (blended $175-250/hr) |

This project demonstrates how AI-assisted development can compress data-product timelines from months to days, enabling public-sector teams to prototype quickly, validate ideas with the community, and inform decisions about full production builds. See the in-app **About → How This Was Built** panel for the per-session breakdown.

---

## Features

### Check Your Neighborhood

Enter a ZIP code (or use geolocation) to instantly see your neighborhood's **life expectancy at birth** alongside five key health indicators — poverty rate, uninsured rate, diabetes, hypertension, and obesity prevalence — displayed as animated gauge charts compared to county averages. Optionally enter your age for **age-specific remaining life expectancy** estimates.

### Disparity views

A **disparity hero card** surfaces the gap between Travis County's longest- and shortest-living ZIP codes, with the user's ZIP positioned in context. A **sorted bar strip** ranks all 60+ Travis County ZCTAs by life expectancy, color-graded from red to green, with the user's ZIP highlighted and a percentile-based rank summary ("ranks #N of 63 — near the top of the county").

### Personal-factors calculators

Two literature-based calculators show how individual factors shift life expectancy independent of geography:

- **Personalized lifespan estimator**: age and sex on the U.S. 2022 life table, adjusted for six modifiable factors (smoking, physical activity, diet, BMI, sleep, chronic stress) using effect sizes from Doll & Peto (BMJ 2004), Lee et al. (Lancet 2012), Fadnes et al. (PLoS Med 2022), the Prospective Studies Collaboration (Lancet 2009), Cappuccio et al. (Sleep 2010), and Russ et al. (BMJ 2012). It ranks the factors with the most years to gain and, when configured, links to the companion [Austin Service Guide](#service-guide-handoff) with only those factor categories.
- **Compare across generations**: birth-year slider (1900-2022) over NCHS historical U.S. life expectancy data, compared to today's Travis County average.

### Explore the Map

A full interactive **choropleth map** powered by Leaflet lets you visually explore how health indicators vary across Travis County. Switch between indicators, hover for quick stats, or click any ZIP code for a detailed breakdown.

### Compare ZIP Codes

Select 2–3 ZIP codes to see them side-by-side with a **radar chart**, grouped bar charts, and a color-coded comparison table — making health disparities immediately visible.

### 60-second guided tour

A floating tour button opens a 4-step guided walkthrough of the app's core features. Persists "seen" state via localStorage; first-time visitors get a soft attention ring.

### Kiosk showcase mode

After 5 minutes of inactivity (auto-disabled on screens narrower than 768px, and by adding `?kiosk=off` before the `#`, e.g. `/austin-health-pulse/?kiosk=off#/`), an animated showcase overlay rotates through four slides: title, key statistics, an auto-rotating "Did you know?" insight panel that surfaces interesting cross-indicator facts (e.g. diabetes ratios between ZIP extremes), and a closing "explore your neighborhood" call to action. Designed for conference booths and public health events.

### About panel — methodology + build story

A modal (centered on desktop, full-screen sheet on mobile) covers data sources, methodology, limitations, a per-session **build timeline**, and an **agency-cost comparison** that contextualizes the development effort.

---

## Data Sources

| Indicator                | Source                                                            | Vintage   |
| ------------------------ | ----------------------------------------------------------------- | --------- |
| Life Expectancy at Birth | [CDC USALEEP](https://www.cdc.gov/nchs/nvss/usaleep/usaleep.html) | 2010–2015 |
| Poverty Rate             | ACS 5-Year Estimates                                              | 2022      |
| Uninsured Rate           | ACS 5-Year Estimates                                              | 2022      |
| Diabetes Prevalence      | [CDC PLACES](https://www.cdc.gov/places/)                         | 2023      |
| Hypertension Prevalence  | CDC PLACES                                                        | 2023      |
| Obesity Prevalence       | CDC PLACES                                                        | 2023      |
| Current Asthma           | CDC PLACES                                                        | 2023      |
| Violent Crime Rate       | [City of Austin Open Data](https://data.austintexas.gov/) (APD Crime Reports, UCR Part 1 violent, per 1,000 residents) | Rolling 12 months at export time |

Tract-level life expectancy data is aggregated to ZIP code (ZCTA) level using **population-weighted averages** via the Census 2010 ZCTA-to-tract relationship file. Violent crime covers APD's jurisdiction only; ZIPs outside it show no data. See [`data/README.md`](data/README.md) for details.

---

## Tech Stack

| Layer      | Technology                  |
| ---------- | --------------------------- |
| Framework  | React 19 + TypeScript 5.9   |
| Build      | Vite 8                      |
| Styling    | Tailwind CSS 4.2            |
| Routing    | React Router 7 (HashRouter) |
| Maps       | Leaflet + React Leaflet     |
| Charts     | Recharts                    |
| Tests      | Vitest                      |
| Font       | Geist (Google Fonts)        |
| Icons      | Material Symbols            |
| Deployment | GitHub Pages via Actions    |

---

## Getting Started

### Prerequisites

- Node.js 22.12+
- npm 10+

### Install & Run

```bash
cd app
npm ci
npm run dev
```

The app will be available at `http://localhost:5173/austin-health-pulse/`.

### Checks

```bash
npm run lint
npm test         # Vitest unit tests for the lifespan model
npm run build    # type-check + production build into app/dist
```

### Build for Production

```bash
cd app
npm run build
npm run preview  # serves app/dist at http://localhost:4173/austin-health-pulse/
```

### Service guide handoff

The lifespan estimator can link to the companion Austin Service Guide (`<url>/intake?event=healthspan&focus=<categories>`). Set the guide's base URL at build time with `VITE_SERVICE_GUIDE_URL` (see [`app/.env.example`](app/.env.example)).

- `npm run dev` falls back to `http://localhost:5173` when it is unset.
- A production build without it hides the handoff link instead of pointing at localhost.

### Deploying to GitHub Pages

`.github/workflows/deploy.yml` lints, tests, builds, and deploys on every push to `main`. To turn it on:

1. In **Settings > Pages**, set **Source** to **GitHub Actions**.
2. Optionally, add a repository variable `SERVICE_GUIDE_URL` (**Settings > Secrets and variables > Actions > Variables**) pointing at the hosted Service Guide. The workflow passes it through as `VITE_SERVICE_GUIDE_URL`.

The site is served from `/austin-health-pulse/` (the `base` in `app/vite.config.ts`). If you fork under a different repository name, change `base` to match, or the data files will 404. Routing uses `HashRouter`, so deep links such as `#/compare` survive a refresh without a 404 fallback page.

---

## Data Pipeline

The app ships with precomputed data in `app/public/data/`, so you only need the pipeline to refresh it. Run from the repo root:

```bash
pip install requests pandas numpy openpyxl geopandas
python scripts/export_frontend_json.py   # zcta_health_data.json + county_summary.json
python scripts/prepare_geojson.py        # zcta_boundaries.geojson
```

| Script                             | Purpose                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `export_frontend_json.py`          | Reads USALEEP CSVs from `data/raw/`, pulls ACS, CDC PLACES, and APD crime data, aggregates to ZCTA, writes JSON |
| `prepare_geojson.py`               | Downloads Census ZCTA boundary shapefiles, filters to Travis County, simplifies geometry                        |
| `travis_county_health_data_pull.py` | Original standalone ArcGIS CSV pull; not used by the app                                                        |

Sources, pipeline order, and known data gaps are documented in [`data/README.md`](data/README.md). Set `CENSUS_API_KEY` if the Census API rate-limits you.

---

## Project Structure

```
├── app/
│   ├── public/data/          # Static health data JSON + GeoJSON boundaries
│   ├── src/
│   │   ├── components/
│   │   │   ├── neighborhood/  # ZIP lookup, disparity strip, generations compare
│   │   │   ├── lifespan/      # Personalized lifespan estimator + service handoff
│   │   │   ├── explore/       # Choropleth map & detail cards
│   │   │   ├── compare/       # Multi-ZIP comparison (radar, bars, table)
│   │   │   ├── layout/        # App shell, header, navigation
│   │   │   ├── shared/        # Gauge charts, about drawer, tour
│   │   │   └── showcase/      # Kiosk idle screen
│   │   ├── hooks/             # Data context, idle timer, animated numbers
│   │   ├── lib/               # Constants, color scales, data loader, lifespan model
│   │   └── types/             # TypeScript type definitions
│   ├── .env.example           # Build-time settings (service guide URL)
│   └── vite.config.ts
├── data/raw/                  # USALEEP source CSVs (see data/README.md)
├── scripts/                   # Python data pipeline
├── .github/workflows/         # CI + GitHub Pages deployment
├── CONTRIBUTING.md
├── LICENSE                    # Apache 2.0
└── README.md
```

---

## Methodology Notes

- Life expectancy estimates are **statistical estimates**, not individual predictions
- Within-ZIP variation can be significant — these are area-level averages
- CDC PLACES indicators use model-based small area estimation from BRFSS survey data
- USALEEP data reflects 2010–2015 mortality patterns; current conditions may differ

---

## Contributing & License

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  Built for <strong>Austin Public Health</strong> — City of Austin, Texas<br/>
  <sub>Promoting health equity through data transparency</sub>
</p>
