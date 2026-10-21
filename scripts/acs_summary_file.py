"""
ACS 5-Year 2022 ZCTA rates from the Census table-based summary files.

Used when CENSUS_API_KEY is unset: the Census Data API now rejects keyless
requests, but the same 5-year estimates are published as bulk files. The
subject-table percentages the API path pulls are ratios of detailed-table
counts, so they are rebuilt here:

    povertyRate   = S1701_C03_001 = B17001_002 / B17001_001 * 100
    uninsuredRate = S2701_C05_001 = sum(B27001 "No health insurance coverage"
                                        cells) / B27001_001 * 100
    population    = B01003_001

Both rates are rounded to one decimal, as published in S1701/S2701.
"""

import sys

import numpy as np
import pandas as pd
import requests

SUMMARY_FILE_URL = (
    "https://www2.census.gov/programs-surveys/acs/summary_file/2022/"
    "table-based-SF/data/5YRData/acsdt5y2022-{table}.dat"
)
ZCTA_GEO_PREFIX = "860Z200US"

# B27001 "No health insurance coverage" cells: 9 age groups x 2 sexes.
B27001_UNINSURED_LINES = (
    5, 8, 11, 14, 17, 20, 23, 26, 29,
    33, 36, 39, 42, 45, 48, 51, 54, 57,
)


def _zcta_rows(table, zctas):
    """Stream one summary-file table, keeping only rows for the given ZCTAs."""
    url = SUMMARY_FILE_URL.format(table=table)
    print(f"      Streaming {url}")
    wanted = {ZCTA_GEO_PREFIX + z for z in zctas}
    try:
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            r.encoding = "utf-8"
            lines = r.iter_lines(decode_unicode=True)
            header = next(lines).split("|")
            rows = [
                line.split("|")
                for line in lines
                if line.startswith(ZCTA_GEO_PREFIX) and line.split("|", 1)[0] in wanted
            ]
    except requests.RequestException as e:
        sys.exit(f"      ERROR: Failed to download ACS summary file {table}: {e}")
    df = pd.DataFrame(rows, columns=header)
    df["ZCTA"] = df["GEO_ID"].str[len(ZCTA_GEO_PREFIX):]
    return df.set_index("ZCTA").apply(pd.to_numeric, errors="coerce")


def acs_rates_from_summary_files(zctas):
    """Return DataFrame with ZCTA, povertyRate, uninsuredRate, population."""
    b17 = _zcta_rows("b17001", zctas)
    b27 = _zcta_rows("b27001", zctas)
    b01 = _zcta_rows("b01003", zctas)

    poverty = (b17["B17001_E002"] / b17["B17001_E001"] * 100).round(1)
    uninsured_count = sum(b27[f"B27001_E{n:03d}"] for n in B27001_UNINSURED_LINES)
    uninsured = (uninsured_count / b27["B27001_E001"] * 100).round(1)

    df = pd.DataFrame(
        {
            "povertyRate": poverty,
            "uninsuredRate": uninsured,
            "population": b01["B01003_E001"],
        }
    ).replace([np.inf, -np.inf], np.nan)
    return df.rename_axis("ZCTA").reset_index()
