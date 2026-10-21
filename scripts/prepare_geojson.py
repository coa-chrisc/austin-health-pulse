"""
Prepare ZCTA GeoJSON for a City Preset
======================================
Downloads Census cartographic boundary shapefile for ZCTAs, filters to the
preset's ZCTAs (explicit `pipeline.zctas`, or derived from the county when
null), simplifies geometry for web mapping, and exports GeoJSON.

Requirements:
    pip install geopandas requests pandas

Output (path from the preset's `data.boundaries`, relative to config/):
    e.g. config/data/<presetId>/boundaries.geojson

Usage:
    python scripts/prepare_geojson.py [--preset config/presets/<id>.json]
"""

import os
import sys
import io
import zipfile
import requests
import geopandas as gpd

from pipeline_preset import load_preset, parse_preset_arg, resolve_zctas

# ── CONFIG ────────────────────────────────────────────────────────────────────

# Census cartographic boundary shapefile for ZCTAs (500k resolution)
SHAPEFILE_URL = (
    "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip"
)

# Geometry simplification tolerance (degrees; ~0.001 is good for web mapping)
SIMPLIFY_TOLERANCE = 0.001

def download_shapefile():
    """Download and extract Census ZCTA cartographic boundary shapefile."""
    print("[1/3] Downloading Census ZCTA boundary shapefile...")
    print(f"      URL: {SHAPEFILE_URL}")

    try:
        r = requests.get(SHAPEFILE_URL, timeout=300, stream=True)
        r.raise_for_status()
    except requests.RequestException as e:
        print(f"      ERROR: Failed to download shapefile: {e}")
        sys.exit(1)

    content_length = r.headers.get("Content-Length")
    if content_length:
        print(f"      Download size: {int(content_length) / 1024 / 1024:.1f} MB")

    # Read the full content for the zip
    data = r.content
    print(f"      Downloaded {len(data) / 1024 / 1024:.1f} MB")

    # Extract and read with geopandas
    print("      Extracting shapefile from zip archive...")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            # Find the .shp file inside the zip
            shp_files = [f for f in zf.namelist() if f.endswith(".shp")]
            if not shp_files:
                print("      ERROR: No .shp file found in zip archive.")
                sys.exit(1)

            # Extract all files to a temporary directory
            import tempfile

            with tempfile.TemporaryDirectory() as tmpdir:
                zf.extractall(tmpdir)
                shp_path = os.path.join(tmpdir, shp_files[0])
                print(f"      Reading shapefile: {shp_files[0]}")
                gdf = gpd.read_file(shp_path, engine="pyogrio")
    except zipfile.BadZipFile:
        print("      ERROR: Downloaded file is not a valid zip archive.")
        sys.exit(1)

    print(f"      Loaded {len(gdf)} ZCTA boundaries nationwide.")
    return gdf


def filter_to_zctas(gdf, zctas):
    """Filter the nationwide ZCTA GeoDataFrame to the preset's ZCTAs."""
    print("[2/3] Filtering to preset ZCTAs...")

    # The ZCTA column in the Census shapefile
    # Identify the ZCTA column name (varies by vintage)
    zcta_col = None
    for candidate in ["ZCTA5CE20", "ZCTA5CE10", "GEOID20", "GEOID"]:
        if candidate in gdf.columns:
            zcta_col = candidate
            break

    if zcta_col is None:
        print(
            f"      ERROR: Could not find ZCTA column. Available columns: {list(gdf.columns)}"
        )
        sys.exit(1)

    print(f"      Using column '{zcta_col}' for ZCTA matching.")

    # Ensure string type for matching
    gdf[zcta_col] = gdf[zcta_col].astype(str).str.zfill(5)

    mask = gdf[zcta_col].isin(zctas)
    filtered = gdf[mask].copy()

    matched_zctas = set(filtered[zcta_col].tolist())
    requested_zctas = set(zctas)
    missing = requested_zctas - matched_zctas

    print(
        f"      Matched {len(filtered)} of {len(zctas)} requested ZCTAs."
    )
    if missing:
        print(f"      Not found in shapefile (likely PO Box ZCTAs): {sorted(missing)}")

    # Rename the ZCTA column to a consistent name
    filtered = filtered.rename(columns={zcta_col: "ZCTA5CE20"})

    # Keep only the ZCTA identifier and geometry
    keep_cols = ["ZCTA5CE20", "geometry"]
    extra_cols = [c for c in filtered.columns if c in keep_cols]
    filtered = filtered[extra_cols]

    return filtered


def simplify_and_export(gdf, output_file):
    """Simplify geometry and export as GeoJSON."""
    print("[3/3] Simplifying geometry and exporting GeoJSON...")

    # Simplify geometry for web performance
    gdf["geometry"] = gdf["geometry"].simplify(
        tolerance=SIMPLIFY_TOLERANCE,
        preserve_topology=True,
    )

    # Ensure CRS is WGS84 (EPSG:4326) for web mapping
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f"      Reprojecting from {gdf.crs} to EPSG:4326...")
        gdf = gdf.to_crs(epsg=4326)

    # Create output directory if needed
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Export to GeoJSON
    gdf.to_file(output_file, driver="GeoJSON")

    file_size = os.path.getsize(output_file) / 1024
    print(f"      Exported to: {output_file}")
    print(f"      File size: {file_size:.1f} KB")
    print(f"      Features: {len(gdf)} ZCTAs")


def main():
    args = parse_preset_arg("Prepare ZCTA GeoJSON for a city preset").parse_args()
    preset = load_preset(args.preset)

    print("=" * 60)
    print(f"Prepare ZCTA GeoJSON for preset {preset['id']}")
    print("=" * 60)
    print()

    zctas = resolve_zctas(preset)
    gdf = download_shapefile()
    filtered = filter_to_zctas(gdf, zctas)
    simplify_and_export(filtered, preset["output_paths"]["boundaries"])

    print()
    print("Done.")


if __name__ == "__main__":
    main()
