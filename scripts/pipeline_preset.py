"""
City preset loading and ZCTA-list resolution shared by the pipeline scripts.

A preset is a JSON file matching config/city.config.schema.json. The pipeline
reads its `id`, `pipeline` block ({stateFips, countyFips, zctas, crimeSource}),
`dataQualityNotes`, and `data` output paths (relative to config/).
"""

import argparse
import io
import json
import os
import sys

import pandas as pd
import requests

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(PROJECT_ROOT, "config")
DEFAULT_PRESET = os.path.join(CONFIG_DIR, "city.config.json")

# Census 2010 ZCTA-to-county relationship file. ZPOPPCT = percent of the
# ZCTA's 2010 population living in the county part.
CENSUS_ZCTA_COUNTY_2010_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/rel/zcta_county_rel_10.txt"
)
# Census 2020 ZCTA-to-county relationship file, used only to confirm a derived
# 2010 ZCTA still exists in 2020 (ACS 2022 and the boundary shapefile use 2020
# ZCTAs; a ZCTA retired in 2020 would have no data and no polygon).
CENSUS_ZCTA_COUNTY_2020_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/"
    "tab20_zcta520_county20_natl.txt"
)

# A ZCTA belongs to the county when at least this share of its population
# lives there.
ZCTA_COUNTY_POP_PCT_THRESHOLD = 50.0

SUPPORTED_CRIME_SOURCES = ("apd-austin",)


def parse_preset_arg(description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "--preset",
        default=DEFAULT_PRESET,
        help="Path to a city preset JSON (default: config/city.config.json)",
    )
    return parser


def load_preset(path):
    """Read a preset and return it with `county_geoid` and absolute output paths."""
    with open(path) as f:
        preset = json.load(f)

    pipeline = preset["pipeline"]
    crime = pipeline.get("crimeSource")
    if crime is not None and crime not in SUPPORTED_CRIME_SOURCES:
        sys.exit(
            f"ERROR: preset {preset['id']}: unknown pipeline.crimeSource {crime!r} "
            f"(supported: {', '.join(SUPPORTED_CRIME_SOURCES)} or null)."
        )

    preset["county_geoid"] = pipeline["stateFips"] + pipeline["countyFips"]
    preset["output_paths"] = {
        key: os.path.join(CONFIG_DIR, rel) for key, rel in preset["data"].items()
    }
    return preset


def _download(url, label):
    print(f"      Downloading {label}: {url}")
    try:
        r = requests.get(url, timeout=180)
        r.raise_for_status()
    except requests.RequestException as e:
        sys.exit(f"      ERROR: Failed to download {label}: {e}")
    return r.content.decode("utf-8-sig")


def derive_zctas(county_geoid):
    """
    ZCTAs with >= ZCTA_COUNTY_POP_PCT_THRESHOLD % of their 2010 population in
    the county, restricted to ZCTAs that still exist in the 2020 vintage.
    """
    rel10 = pd.read_csv(
        io.StringIO(_download(CENSUS_ZCTA_COUNTY_2010_URL, "2010 ZCTA-county file")),
        dtype=str,
    )
    rel10["ZPOPPCT"] = pd.to_numeric(rel10["ZPOPPCT"], errors="coerce").fillna(0)
    in_county = rel10[
        (rel10["GEOID"] == county_geoid)
        & (rel10["ZPOPPCT"] >= ZCTA_COUNTY_POP_PCT_THRESHOLD)
    ]
    derived = sorted(in_county["ZCTA5"].str.zfill(5).unique())

    rel20 = pd.read_csv(
        io.StringIO(_download(CENSUS_ZCTA_COUNTY_2020_URL, "2020 ZCTA-county file")),
        dtype=str,
        sep="|",
    )
    zctas_2020 = set(rel20["GEOID_ZCTA5_20"].dropna().str.zfill(5))
    retired = [z for z in derived if z not in zctas_2020]
    if retired:
        print(f"      Dropping ZCTAs absent from the 2020 vintage: {retired}")
    return [z for z in derived if z in zctas_2020]


def resolve_zctas(preset):
    """Explicit `pipeline.zctas` list, or the county-derived list when null."""
    explicit = preset["pipeline"].get("zctas")
    if explicit is not None:
        print(f"      Using {len(explicit)} ZCTAs listed in preset {preset['id']}.")
        return list(explicit)
    zctas = derive_zctas(preset["county_geoid"])
    print(
        f"      Derived {len(zctas)} ZCTAs for county {preset['county_geoid']} "
        f"(>= {ZCTA_COUNTY_POP_PCT_THRESHOLD:g}% of 2010 ZCTA population in county)."
    )
    return zctas
