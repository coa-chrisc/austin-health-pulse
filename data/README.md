# Data

## Raw inputs (`data/raw/`)

| File        | Contents                                                                 | Source                                                                                         |
| ----------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `TX_A.CSV`  | Life expectancy at birth, e(0) and its standard error, per 2010 census tract (Texas) | [CDC NCHS USALEEP](https://www.cdc.gov/nchs/nvss/usaleep/usaleep.html), 2010-2015 estimates |
| `TX_B.CSV`  | Abridged life tables (remaining years e(x) by age group) per 2010 census tract (Texas) | Same as above                                                                                  |

These are the CSV exports of the Texas files on the USALEEP download page. They are committed because the export script reads them from disk. The `.XLSX` originals are gitignored.

## Fetched at run time

`scripts/export_frontend_json.py` downloads the rest over HTTP. It caches nothing:

- Census ZCTA-to-tract relationship files (2010 for USALEEP tracts, 2020 for crime data)
- Census ZCTA-to-county relationship files (2010 and 2020), only when a preset derives its ZCTA list
- ACS 5-Year 2022: poverty (S1701), uninsured (S2701), total population (B01003). With `CENSUS_API_KEY` set these come from the Census Data API. The API rejects keyless requests, so without a key the script streams the ACS table-based summary files instead and rebuilds the same rates: poverty = B17001_002 / B17001_001, uninsured = the B27001 "no health insurance coverage" cells / B27001_001, both rounded to one decimal as S1701/S2701 publish them. For the 62 Austin ZCTAs with data, the two paths give identical values.
- CDC PLACES 2023: diabetes, hypertension, obesity, current asthma
- Violent crime, only for presets with `pipeline.crimeSource: "apd-austin"`: City of Austin Open Data Portal, APD Crime Reports (`fdj4-gpfu`), UCR Part 1 violent offenses, rolling 12 months

`scripts/prepare_geojson.py` downloads the Census 2020 cartographic boundary ZCTA shapefile (`cb_2020_us_zcta520_500k`).

## Census API key

The Census Data API requires a key. The key is free. You need it only to run the data pipeline; the app build and CI do not use it.

1. Open [https://api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html).
2. Enter your organization name and your email address, then submit the form.
3. Open the email from the Census Bureau. It contains your key.
4. Click the activation link in that email. The key does not work until you activate it.
5. In the terminal where you will run the pipeline, set the key:

   ```bash
   export CENSUS_API_KEY=<your-key>
   ```

   To keep it for future sessions, add that line to your shell profile (for example `~/.zshrc` or `~/.bashrc`).
6. Run the pipeline from the repo root as shown in [Pipeline](#pipeline). The script reads the `CENSUS_API_KEY` environment variable.

Keep the key private. Do not commit it, and do not put it in `config/` or in any `app/.env` file.

**Without a key**, the export prints a notice and downloads the ACS 2022 summary files from the Census Bureau instead (about 260 MB). This is slower, and it gives the same poverty and uninsured values.

## Pipeline

The pipeline is driven by a city preset (`config/presets/*.json`, schema `config/city.config.schema.json`). Each script reads the preset's `pipeline` block, its `dataQualityNotes`, and its `data` output paths (relative to `config/`), and writes to `config/data/<presetId>/`. Without `--preset` the scripts use `config/city.config.json`, the active preset.

Run from the repo root:

```bash
pip install requests pandas numpy openpyxl geopandas scipy
python scripts/export_frontend_json.py --preset config/presets/austin-travis-tx.json   # -> zip-indicators.json, county-summary.json
python scripts/prepare_geojson.py      --preset config/presets/austin-travis-tx.json   # -> boundaries.geojson
python scripts/export_frontend_json.py --preset config/presets/partner-city-demo.json  # Harris County, TX
python scripts/prepare_geojson.py      --preset config/presets/partner-city-demo.json
```

`python scripts/export_frontend_json.py --preset <preset> --model-only` recomputes only the `scenarioModel` block of `county-summary.json` from the existing `zip-indicators.json`. It makes no network requests.

The two scripts are independent, so you can run them in either order. Get a Census API key first ([steps below](#census-api-key)), or the export downloads about 260 MB of ACS summary files instead.

`scripts/travis_county_health_data_pull.py` is the original standalone pull that produced an ArcGIS-ready CSV. The web app does not use it.

### Preset `pipeline` block

| Field         | Meaning |
| ------------- | ------- |
| `stateFips`   | 2-digit state FIPS. Life expectancy is read from `data/raw/<ST>_A.CSV` / `<ST>_B.CSV`, the USALEEP files for that state. Only Texas (`TX_*`) is committed. For any other state the script stops and names the files to download. |
| `countyFips`  | 3-digit county FIPS. |
| `zctas`       | Explicit ZCTA list, or `null` to derive it. A derived list includes every ZCTA with at least 50% of its 2010 population in the county (`ZPOPPCT` in the Census 2010 ZCTA-county file) that still exists as a 2020 ZCTA. |
| `crimeSource` | `"apd-austin"` or `null`. With `null`, every ZIP's `violentCrimeRate` is null, `meta.countyAverage.violentCrimeRate` is null, `county-summary.json` has `indicators.violentCrimeRate: null`, and violent crime does not count toward a ZIP's `"complete"` data quality. |

`dataQualityNotes` lists low-population ZIPs whose ACS rates are unreliable. The frontend flags them, and the scenario model leaves them out of the poverty and uninsured fits.

The Austin preset keeps its original hand-curated 63-ZCTA list, labeled "Greater Austin" in the app. The list covers Travis County and neighboring areas. For Travis County, the 50% rule selects 47 ZCTAs, all of them in the curated list, and leaves out the other 16. Fifteen of those 16 have most of their population in neighboring counties. The sixteenth, 78646, is not in the 2010 relationship file. Six of the 16 have no population in Travis County.

`county-summary.json` reports each indicator's `avg` as a simple, unweighted mean of the ZIP values. It is not a population-weighted county figure.

## Scenario model (`county-summary.json` → `scenarioModel`)

For each candidate lever (poverty, uninsured, diabetes, hypertension, obesity) the export fits one bivariate ordinary least squares regression, `lifeExpectancy ~ indicator`, across the region's ZIPs. A fit uses every ZIP that has both values. ZIPs in `dataQualityNotes` are left out of the poverty and uninsured fits. Each fit reports its slope (years of life expectancy per percentage point), standard error, 95% confidence interval (t distribution, n - 2 degrees of freedom), intercept, r², n, the observed range, and the ZIP with the lowest value.

A fit is listed under `levers` only if its slope is negative and the whole 95% CI is below zero. Every other fit is listed under `excluded`, with the reason "slope is not negative" or "95% CI includes zero".

Each lever is modeled on its own, and the slopes are never added together. Across ZIPs these indicators move together: poor ZIPs also have more uninsured residents, more diabetes, and more obesity. Each bivariate slope therefore absorbs variation the indicators share, and adding two slopes would count that variation twice. The slopes describe associations between ZIPs. They are not causal effects.

## Known gaps

- ZCTA 78646 (Camp Mabry) is in the ZCTA list but has no data and no 2020 boundary polygon, so it does not appear on the map.
- Violent crime rates cover only APD's jurisdiction. ZCTAs outside it are `null`, not zero.
- Harris County (`harris-tx`) has no crime source, so violent crime is `null` for every ZIP.
- ZCTA 77010 (downtown Houston) has fewer than 1,000 residents in ACS 2022, so its poverty and uninsured rates are suppressed. It is listed in the Harris preset's `dataQualityNotes`.
