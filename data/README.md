# Data

## Raw inputs (`data/raw/`)

| File        | Contents                                                                 | Source                                                                                         |
| ----------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `TX_A.CSV`  | Life expectancy at birth, e(0) and its standard error, per 2010 census tract (Texas) | [CDC NCHS USALEEP](https://www.cdc.gov/nchs/nvss/usaleep/usaleep.html), 2010-2015 estimates |
| `TX_B.CSV`  | Abridged life tables (remaining years e(x) by age group) per 2010 census tract (Texas) | Same as above                                                                                  |

These are the CSV exports of the Texas files on the USALEEP download page. They are committed because the export script reads them from disk. The `.XLSX` originals are gitignored.

## Fetched at run time

`scripts/export_frontend_json.py` downloads the rest over HTTP. Nothing is cached:

- Census ZCTA-to-tract relationship files (2010 for USALEEP tracts, 2020 for crime data)
- ACS 5-Year 2022: poverty (S1701), uninsured (S2701), total population (B01003)
- CDC PLACES 2023: diabetes, hypertension, obesity, current asthma
- City of Austin Open Data Portal, APD Crime Reports (`fdj4-gpfu`): UCR Part 1 violent offenses, rolling 12 months

`scripts/prepare_geojson.py` downloads the Census 2020 cartographic boundary ZCTA shapefile (`cb_2020_us_zcta520_500k`).

## Pipeline

Run from the repo root. Both scripts write into `app/public/data/`, which the frontend serves as static files.

```bash
pip install requests pandas numpy openpyxl geopandas
python scripts/export_frontend_json.py   # -> zcta_health_data.json, county_summary.json
python scripts/prepare_geojson.py        # -> zcta_boundaries.geojson
```

The two scripts are independent, so you can run them in either order. If the Census API rate-limits you, set `CENSUS_API_KEY` ([free signup](https://api.census.gov/data/key_signup.html)).

`scripts/travis_county_health_data_pull.py` is the original standalone pull that produced an ArcGIS-ready CSV. The web app does not use it.

## Known gaps

- ZCTA 78646 (Camp Mabry) is in the ZCTA list but has no data and no 2020 boundary polygon, so it does not appear on the map.
- Violent crime rates cover only APD's jurisdiction. ZCTAs outside it are `null`, not zero.
