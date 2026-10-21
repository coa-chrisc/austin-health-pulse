import {
  useState,
  useMemo,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useNavigate } from "react-router-dom";
import type { Feature, Geometry, Position } from "geojson";
import { useHealthData } from "../../hooks/useHealthData";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import { ENABLE_PERSONAL_CALCULATOR } from "../../lib/constants";
import { THEME, fontSize } from "../../lib/theme";
import { cityConfig } from "../../lib/cityConfig";
import { listZips } from "../../lib/zips";
import { getAgeGroup, getAgeGroupLabel } from "../../lib/ageGroupMapper";
import { getComparisonColor } from "../../lib/colorScales";
import { formatDifference } from "../../lib/formatters";
import { getDataQualityNote } from "../../lib/dataQuality";
import {
  INDICATOR_LABELS,
  INDICATOR_UNITS,
  INDICATOR_HIGHER_IS_BETTER,
} from "../../types/health";
import type {
  AgeGroupKey,
  IndicatorKey,
  ZctaHealthData,
  CountyAverage,
} from "../../types/health";
import GaugeChart from "../shared/GaugeChart";
import EquityScenarioSimulator from "../scenario/EquityScenarioSimulator";
import ServiceGuideZipLink from "../shared/ServiceGuideZipLink";
import ParentsCompare from "./ParentsCompare";
import DisparityStrip from "./DisparityStrip";

// Opt-in (VITE_ENABLE_PERSONAL_CALCULATOR): kept out of the main chunk.
const PersonalFactorsSection = lazy(
  () => import("../lifespan/PersonalFactorsSection"),
);

const GAUGE_INDICATORS: Exclude<IndicatorKey, "violentCrimeRate">[] = [
  "povertyRate",
  "uninsuredRate",
  "diabetes",
  "hypertension",
  "obesity",
];

/** Build a plain-English narrative from the ZCTA data and area average. */
function generateNarrative(
  zcta: string,
  data: ZctaHealthData,
  countyAvg: CountyAverage,
): string | null {
  const parts: string[] = [];

  // Life expectancy sentence
  if (data.lifeExpectancy != null) {
    const diff = data.lifeExpectancy - countyAvg.lifeExpectancy;
    const absDiff = Math.abs(diff);
    if (absDiff < 0.3) {
      parts.push(
        `Life expectancy at birth in ${zcta} is ${data.lifeExpectancy.toFixed(1)} years, about the same as the ${cityConfig.region.name} average.`,
      );
    } else if (diff > 0) {
      parts.push(
        `Life expectancy at birth in ${zcta} is ${data.lifeExpectancy.toFixed(1)} years, about ${absDiff.toFixed(1)} years longer than the ${cityConfig.region.name} average.`,
      );
    } else {
      parts.push(
        `Life expectancy at birth in ${zcta} is ${data.lifeExpectancy.toFixed(1)} years, about ${absDiff.toFixed(1)} years shorter than the ${cityConfig.region.name} average.`,
      );
    }
  }

  // Gather notable social determinants
  const highlights: string[] = [];

  if (data.povertyRate != null) {
    const pDiff = data.povertyRate - countyAvg.povertyRate;
    if (Math.abs(pDiff) >= 1.0) {
      highlights.push(
        `${pDiff < 0 ? "lower" : "higher"} poverty rates (${data.povertyRate.toFixed(1)}%)`,
      );
    }
  }

  if (data.uninsuredRate != null) {
    const uDiff = data.uninsuredRate - countyAvg.uninsuredRate;
    if (Math.abs(uDiff) >= 1.0) {
      highlights.push(
        `${uDiff < 0 ? "lower" : "higher"} uninsured rates (${data.uninsuredRate.toFixed(1)}%)`,
      );
    }
  }

  if (highlights.length > 0) {
    parts.push(
      `This area has ${highlights.join(" and ")} compared with the ${cityConfig.region.name} average.`,
    );
  }

  // Chronic disease note
  const diseaseNotes: string[] = [];
  if (data.diabetes != null) {
    const dDiff = data.diabetes - countyAvg.diabetes;
    if (Math.abs(dDiff) >= 1.5) {
      diseaseNotes.push(`diabetes (${data.diabetes.toFixed(1)}%)`);
    }
  }
  if (data.obesity != null) {
    const oDiff = data.obesity - countyAvg.obesity;
    if (Math.abs(oDiff) >= 2.0) {
      diseaseNotes.push(`obesity (${data.obesity.toFixed(1)}%)`);
    }
  }

  if (diseaseNotes.length > 0) {
    // Determine direction from the first item
    const firstVal = diseaseNotes[0].includes("diabetes")
      ? data.diabetes!
      : data.obesity!;
    const firstAvg = diseaseNotes[0].includes("diabetes")
      ? countyAvg.diabetes
      : countyAvg.obesity;
    const direction = firstVal > firstAvg ? "above" : "below";
    parts.push(
      `Rates of ${diseaseNotes.join(" and ")} are ${direction} average.`,
    );
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}

/** Ray-casting point-in-polygon test. */
function pointInPolygon(lat: number, lng: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1],
      yi = ring[i][0]; // GeoJSON is [lng, lat]
    const xj = ring[j][1],
      yj = ring[j][0];
    if (
      xi > lat !== xj > lat &&
      lng < ((yj - yi) * (lat - xi)) / (xj - xi) + yi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Find which ZCTA boundary polygon contains a lat/lng point. */
function findZctaForPoint(
  lat: number,
  lng: number,
  features: Feature<Geometry>[],
): string | null {
  for (const feature of features) {
    const p = feature.properties;
    const zcta =
      p?.ZCTA5CE20 ??
      p?.ZCTA5CE10 ??
      p?.GEOID20 ??
      p?.GEOID10 ??
      p?.ZCTA ??
      p?.zcta ??
      null;
    if (!zcta) continue;

    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      if (pointInPolygon(lat, lng, geom.coordinates[0])) return zcta;
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        if (pointInPolygon(lat, lng, poly[0])) return zcta;
      }
    }
  }
  return null;
}

interface NeighborhoodModeProps {
  onAboutClick?: () => void;
}

export default function NeighborhoodMode({
  onAboutClick,
}: NeighborhoodModeProps = {}) {
  const { healthData, summary, boundaries } = useHealthData();
  const navigate = useNavigate();

  const [zipInput, setZipInput] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [submittedZip, setSubmittedZip] = useState<string | null>(null);
  const [submittedAge, setSubmittedAge] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">(
    "idle",
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const geoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zipIsValid = /^\d{5}$/.test(zipInput);
  const ageIsValid =
    ageInput === "" ||
    (Number.isInteger(Number(ageInput)) &&
      Number(ageInput) >= 0 &&
      Number(ageInput) <= 100);

  // Find nearby ZCTAs when zip not found
  const nearbySuggestions = useMemo(() => {
    if (!notFound || !zipInput) return [];
    const prefix = zipInput.slice(0, 3);
    return listZips(healthData)
      .filter((z) => z.startsWith(prefix))
      .slice(0, 5);
  }, [notFound, zipInput, healthData]);

  const handleExplore = useCallback(
    function handleExplore(overrideZip?: string) {
      const zip = overrideZip ?? zipInput;
      const zipValid = /^\d{5}$/.test(zip);
      if (!zipValid || !ageIsValid || !healthData) return;

      const zctaData = healthData.zctas[zip];
      if (!zctaData) {
        setNotFound(true);
        setShowResults(false);
        setSubmittedZip(null);
        setSubmittedAge(null);
        return;
      }

      setNotFound(false);
      setSubmittedZip(zip);
      setSubmittedAge(ageInput !== "" ? Number(ageInput) : null);

      // Trigger slide-in by toggling off then on
      setShowResults(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowResults(true);
        });
      });
    },
    [zipInput, ageInput, ageIsValid, healthData],
  );

  function handleSuggestionClick(zip: string) {
    setZipInput(zip);
    setNotFound(false);
  }

  function handleFeaturedClick(zip: string) {
    setZipInput(zip);
    setNotFound(false);
    // Use a timeout so the state updates propagate before explore
    setTimeout(() => {
      handleExplore(zip);
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      handleExplore();
    }
  }

  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus("error");
      setGeoError("Geolocation not supported");
      return;
    }

    setGeoStatus("locating");
    setGeoError(null);
    if (geoTimeoutRef.current) clearTimeout(geoTimeoutRef.current);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const features = boundaries?.features as
          | Feature<Geometry>[]
          | undefined;

        if (!features || features.length === 0) {
          setGeoStatus("error");
          setGeoError("Boundary data not loaded");
          geoTimeoutRef.current = setTimeout(() => setGeoStatus("idle"), 3000);
          return;
        }

        const foundZip = findZctaForPoint(latitude, longitude, features);
        if (foundZip) {
          setZipInput(foundZip);
          setNotFound(false);
          setGeoStatus("idle");
          setTimeout(() => handleExplore(foundZip), 0);
        } else {
          setGeoStatus("error");
          setGeoError(`Not in ${cityConfig.region.name}`);
          geoTimeoutRef.current = setTimeout(() => setGeoStatus("idle"), 3000);
        }
      },
      (err) => {
        setGeoStatus("error");
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError("Location permission denied");
            break;
          case err.TIMEOUT:
            setGeoError("Location request timed out");
            break;
          default:
            setGeoError("Could not get location");
        }
        geoTimeoutRef.current = setTimeout(() => setGeoStatus("idle"), 3000);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, [boundaries, handleExplore]);

  const zctaData =
    submittedZip && healthData ? healthData.zctas[submittedZip] : null;
  const countyAvg = healthData?.meta.countyAverage ?? null;

  // Age-specific data
  const ageGroup: AgeGroupKey | null =
    submittedAge !== null ? getAgeGroup(submittedAge) : null;
  const ageGroupLabel =
    submittedAge !== null ? getAgeGroupLabel(submittedAge) : null;
  // Suppressed tracts come through as { ex: null, se: null } (e.g. 78712),
  // so treat a null ex the same as a missing table.
  const ageEntry =
    ageGroup && zctaData?.ageSpecific ? zctaData.ageSpecific[ageGroup] : null;
  const ageSpecific =
    ageEntry && ageEntry.ex != null
      ? { ex: ageEntry.ex, se: ageEntry.se }
      : null;

  // Life expectancy color
  const leColor =
    zctaData?.lifeExpectancy != null && countyAvg
      ? getComparisonColor(
          zctaData.lifeExpectancy,
          countyAvg.lifeExpectancy,
          true,
        )
      : THEME.colors.muted;

  // Check if ALL indicator data is null (truly empty record)
  const hasAnyGaugeData =
    zctaData != null && GAUGE_INDICATORS.some((key) => zctaData[key] != null);
  const hasLifeExpectancy = zctaData?.lifeExpectancy != null;
  const allDataMissing = !hasLifeExpectancy && !hasAnyGaugeData;

  // Narrative
  const narrative =
    zctaData && countyAvg && submittedZip
      ? generateNarrative(submittedZip, zctaData, countyAvg)
      : null;

  // Area range — longest- and shortest-LE ZIPs in the region
  const countyRange = useMemo(() => {
    if (!healthData) return null;
    let longest: { zip: string; le: number } | null = null;
    let shortest: { zip: string; le: number } | null = null;
    for (const [zip, data] of Object.entries(healthData.zctas)) {
      if (data.lifeExpectancy == null) continue;
      if (!longest || data.lifeExpectancy > longest.le) {
        longest = { zip, le: data.lifeExpectancy };
      }
      if (!shortest || data.lifeExpectancy < shortest.le) {
        shortest = { zip, le: data.lifeExpectancy };
      }
    }
    return longest && shortest ? { longest, shortest } : null;
  }, [healthData]);

  // Animated life expectancy — only animate when results are visible
  const animatedLE = useAnimatedNumber(
    showResults && zctaData?.lifeExpectancy != null
      ? zctaData.lifeExpectancy
      : null,
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-ink mb-3">
          Check Your Neighborhood
        </h2>
        <p className="text-muted text-lg max-w-2xl mx-auto">
          Enter a ZIP code to see health data for your neighborhood in{" "}
          {cityConfig.region.name}. See how life expectancy and other health
          indicators compare with the area average.
        </p>
        <button
          onClick={onAboutClick}
          className="group mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-soft/60 hover:bg-primary-soft text-ink text-xs font-semibold border border-primary/20 hover:border-primary/40 transition cursor-pointer"
        >
          <span
            className="material-symbols-outlined text-accent"
            style={{ fontSize: fontSize("sm") }}
          >
            auto_awesome
          </span>
          <span>Built by {cityConfig.agency.shortName} for the community</span>
          <span className="text-primary/40">·</span>
          <span className="text-primary group-hover:underline">See how</span>
          <span
            className="material-symbols-outlined text-primary transition-transform group-hover:translate-x-0.5"
            style={{ fontSize: fontSize("sm") }}
          >
            arrow_forward
          </span>
        </button>
      </section>

      {/* Input Section */}
      <section className="flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-center gap-3 mb-4">
        <button
          onClick={handleGeolocate}
          disabled={geoStatus === "locating"}
          className="p-3 rounded-control border border-line bg-surface text-primary hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5"
          aria-label="Use my location"
          title="Use my location"
        >
          <span
            className={`material-symbols-outlined text-xl ${geoStatus === "locating" ? "animate-spin" : ""}`}
          >
            my_location
          </span>
          {geoStatus === "locating" && (
            <span className="text-sm font-medium text-muted whitespace-nowrap">
              Locating...
            </span>
          )}
          {geoStatus === "error" && geoError && (
            <span className="text-sm font-medium text-negative whitespace-nowrap">
              {geoError}
            </span>
          )}
        </button>

        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xl">
            location_on
          </span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            placeholder="ZIP code"
            value={zipInput}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 5);
              setZipInput(val);
              setNotFound(false);
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-4 py-3 w-full sm:w-44 rounded-control border border-line bg-surface text-ink font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-primary transition"
            aria-label="ZIP code"
          />
        </div>

        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xl">
            person
          </span>
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Age (optional)"
            value={ageInput}
            onChange={(e) => setAgeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-4 py-3 w-full sm:w-48 rounded-control border border-line bg-surface text-ink font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-primary transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Age (optional)"
          />
        </div>

        <button
          onClick={() => handleExplore()}
          disabled={!zipIsValid || !ageIsValid}
          className="px-8 py-3 bg-accent text-on-brand font-semibold text-lg rounded-control hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">search</span>
          Explore
        </button>
      </section>

      {/* Featured zip quick-select pills */}
      <section className="flex flex-col items-center mb-10">
        <p className="text-xs text-muted mb-2">Try a neighborhood:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {cityConfig.featuredZips.map(({ label, zip }) => (
            <button
              key={zip}
              onClick={() => handleFeaturedClick(zip)}
              className="px-3 py-1.5 rounded-full text-sm border border-primary/30 text-primary hover:bg-primary hover:text-on-brand transition cursor-pointer"
            >
              {label} {zip}
            </button>
          ))}
        </div>
      </section>

      {/* Not found message */}
      {notFound && (
        <div className="text-center mb-8 p-6 bg-surface rounded-card shadow-sm border border-line/40 max-w-lg mx-auto">
          <span className="material-symbols-outlined text-warning text-4xl mb-2 block">
            wrong_location
          </span>
          <p className="text-ink font-semibold text-lg mb-1">
            ZIP code {zipInput} not found
          </p>
          <p className="text-muted text-sm mb-3">
            We only have data for {cityConfig.region.name} ZIP codes. Try one of
            these nearby ZIP codes:
          </p>
          {nearbySuggestions.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {nearbySuggestions.map((z) => (
                <button
                  key={z}
                  onClick={() => handleSuggestionClick(z)}
                  className="px-4 py-1.5 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-on-brand transition"
                >
                  {z}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {listZips(healthData).slice(0, 5).map((z) => (
                <button
                  key={z}
                  onClick={() => handleSuggestionClick(z)}
                  className="px-4 py-1.5 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-on-brand transition"
                >
                  {z}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      {zctaData && countyAvg && (
        <div
          className={`transition-all duration-500 ease-out ${
            showResults
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          {/* ALL data missing — single empty state */}
          {allDataMissing ? (
            <section className="bg-surface rounded-panel shadow-md border border-line/30 p-6 md:p-8 mb-6 text-center">
              <span className="material-symbols-outlined text-muted text-5xl mb-3 block">
                info
              </span>
              <p className="text-lg text-ink font-semibold mb-1">
                No data available
              </p>
              <p className="text-sm text-muted max-w-md mx-auto">
                We don&rsquo;t have health data for ZIP code {submittedZip}. The
                area may have too few residents for reliable estimates, or it
                may extend beyond the area this tool covers.
              </p>
            </section>
          ) : (
            <>
              {/* Life expectancy hero card */}
              <section className="bg-surface rounded-panel shadow-md border border-line/30 p-6 md:p-8 mb-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Big number */}
                  <div className="text-center md:text-left flex-shrink-0">
                    <p className="text-sm font-semibold text-muted uppercase tracking-wide mb-1">
                      Life Expectancy at Birth
                    </p>
                    {hasLifeExpectancy ? (
                      <>
                        <p
                          className="text-6xl md:text-7xl font-bold leading-none"
                          style={{ color: leColor }}
                        >
                          {(animatedLE ?? zctaData.lifeExpectancy!).toFixed(1)}
                        </p>
                        <p className="text-lg text-muted mt-1">years</p>
                      </>
                    ) : (
                      /* Partial data: life expectancy missing but other data exists */
                      <div className="flex items-start gap-2.5 mt-2 p-3 rounded-control bg-primary-soft/40 border border-primary/15 max-w-sm">
                        <span
                          className="material-symbols-outlined text-primary mt-0.5 flex-shrink-0"
                          style={{ fontSize: fontSize("xl") }}
                        >
                          info
                        </span>
                        <p className="text-sm text-ink leading-snug">
                          We don&rsquo;t have life expectancy data for this ZIP
                          code. The area may have too few residents for
                          reliable estimates.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Comparison details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">
                        pin_drop
                      </span>
                      <span className="text-ink font-semibold text-lg">
                        ZIP Code {submittedZip}
                      </span>
                    </div>

                    {hasLifeExpectancy && (
                      <>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: leColor }}
                            />
                            <span className="text-sm text-muted">
                              {formatDifference(
                                zctaData.lifeExpectancy!,
                                countyAvg.lifeExpectancy,
                                "years",
                                true,
                              )}
                            </span>
                          </div>
                          <span className="text-sm text-muted">
                            Area average:{" "}
                            <span className="font-semibold text-ink">
                              {countyAvg.lifeExpectancy.toFixed(1)} years
                            </span>
                          </span>
                        </div>

                        {zctaData.lifeExpectancySE != null && (
                          <p className="text-xs text-muted">
                            Standard error: {"\u00B1"}
                            {zctaData.lifeExpectancySE.toFixed(1)} years
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Age-specific result */}
                {submittedAge !== null && ageSpecific && (
                  <div className="mt-6 pt-6 border-t border-line/50">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-accent text-2xl mt-0.5">
                        cake
                      </span>
                      <div>
                        <p className="text-sm text-muted mb-1">
                          Age group: {ageGroupLabel} ({ageGroup})
                        </p>
                        <p className="text-ink text-lg">
                          People who are{" "}
                          <span className="font-bold">{submittedAge}</span> in
                          this ZIP code have on average about{" "}
                          <span
                            className="font-bold text-2xl"
                            style={{ color: THEME.colors.primary }}
                          >
                            {ageSpecific.ex.toFixed(1)}
                          </span>{" "}
                          years of life left
                        </p>
                        <p className="text-muted mt-1">
                          On average, that means reaching about age{" "}
                          <span className="font-semibold text-ink">
                            {(submittedAge + ageSpecific.ex).toFixed(0)}
                          </span>
                        </p>
                        {ageSpecific.se != null && ageSpecific.se > 0 && (
                          <p className="text-xs text-muted mt-1">
                            Standard error: {"\u00B1"}
                            {ageSpecific.se.toFixed(1)} years
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Age entered but no age-specific data available */}
                {submittedAge !== null && !ageSpecific && (
                    <div className="mt-6 pt-6 border-t border-line/50">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-muted text-2xl">
                          info
                        </span>
                        <p className="text-muted">
                          We don&rsquo;t have life expectancy data for that age in
                          this ZIP code.
                        </p>
                      </div>
                    </div>
                  )}
              </section>

              {/* Disparity hero — the gap number, big */}
              {hasLifeExpectancy &&
                countyRange &&
                submittedZip &&
                zctaData.lifeExpectancy != null && (
                  <section
                    className="mb-6 rounded-panel shadow-md p-6 md:p-8 text-ink border border-primary/20 relative overflow-hidden brand-soft-gradient"
                  >
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                      <span
                        className="material-symbols-outlined text-lg"
                        style={{ color: THEME.colors.positive }}
                      >
                        social_distance
                      </span>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink/75">
                        The {cityConfig.region.name} gap
                      </h4>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-end gap-6">
                      <div className="md:flex-shrink-0 text-center md:text-left">
                        <p
                          className="text-6xl md:text-7xl font-bold leading-none tracking-tight tabular-nums"
                          style={{ color: THEME.colors.positive }}
                        >
                          {(
                            countyRange.longest.le - countyRange.shortest.le
                          ).toFixed(1)}
                        </p>
                        <p className="text-ink/80 text-sm mt-1">
                          years between {cityConfig.region.name}&rsquo;s longest- and
                          shortest-lived ZIPs
                        </p>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-3 md:gap-4">
                        <div className="bg-surface rounded-control p-3 border border-line/50">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                            Longest
                          </p>
                          <p className="font-bold text-ink text-base">
                            {countyRange.longest.zip}
                          </p>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: THEME.colors.positive }}
                          >
                            {countyRange.longest.le.toFixed(1)} years
                          </p>
                        </div>
                        <div className="bg-surface rounded-control p-3 border border-line/50">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                            Shortest
                          </p>
                          <p className="font-bold text-ink text-base">
                            {countyRange.shortest.zip}
                          </p>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: THEME.colors.negative }}
                          >
                            {countyRange.shortest.le.toFixed(1)} years
                          </p>
                        </div>
                        <div
                          className="rounded-control p-3 border"
                          style={{
                            backgroundColor:
                              "color-mix(in srgb, var(--color-positive) 8%, transparent)",
                            borderColor:
                              "color-mix(in srgb, var(--color-positive) 35%, transparent)",
                          }}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                            Your ZIP
                          </p>
                          <p className="font-bold text-ink text-base">
                            {submittedZip}
                          </p>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: THEME.colors.positive }}
                          >
                            {submittedZip === countyRange.longest.zip
                              ? "Top of the area"
                              : submittedZip === countyRange.shortest.zip
                                ? "Bottom of the area"
                                : `${(countyRange.longest.le - zctaData.lifeExpectancy).toFixed(1)} years behind the top`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-ink/70 mt-4 leading-relaxed max-w-3xl">
                      Income, access to care, environment, and other social factors
                      all shape this gap.
                    </p>
                  </section>
                )}

              {/* Sorted-bar disparity strip */}
              {hasLifeExpectancy && submittedZip && (
                <DisparityStrip highlightZip={submittedZip} />
              )}

              {/* Narrative summary */}
              {narrative && (
                <section
                  className="mb-6 rounded-card bg-surface shadow-sm p-5 border border-line/30"
                  style={{ borderLeft: `4px solid ${THEME.colors.primary}` }}
                >
                  <p className="text-sm italic text-ink/85 leading-relaxed">
                    {narrative.split(/(\d+(?:\.\d+)?%?)/g).map((part, i) =>
                      /^\d/.test(part) ? (
                        <strong
                          key={i}
                          className="font-bold not-italic text-ink"
                        >
                          {part}
                        </strong>
                      ) : (
                        part
                      ),
                    )}
                  </p>
                </section>
              )}

              {/* Health indicator gauges */}
              {hasAnyGaugeData && (
                <section>
                  <h3 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                      monitoring
                    </span>
                    Health Indicators
                  </h3>
                  {getDataQualityNote(submittedZip) && (
                    <p className="text-sm text-muted mb-4">
                      {getDataQualityNote(submittedZip)}
                    </p>
                  )}
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    {GAUGE_INDICATORS.map((key) => {
                      const indicatorSummary = summary?.indicators[key];
                      return (
                        <GaugeChart
                          key={key}
                          value={zctaData[key]}
                          label={INDICATOR_LABELS[key]}
                          unit={INDICATOR_UNITS[key]}
                          countyAvg={countyAvg[key]}
                          min={indicatorSummary?.min ?? 0}
                          max={indicatorSummary?.max ?? 100}
                          higherIsBetter={INDICATOR_HIGHER_IS_BETTER[key]}
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {/* View on Map link */}
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => navigate(`/explore?zcta=${submittedZip}`)}
                  className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline"
                >
                  <span className="material-symbols-outlined text-base">
                    map
                  </span>
                  View on Map
                </button>
              </div>
              {submittedZip && (
                <div className="mt-3 flex justify-center">
                  <ServiceGuideZipLink zip={submittedZip} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Scenario simulator — aggregate data only, independent of ZIP submission */}
      <EquityScenarioSimulator initialZip={submittedZip} />
      {ENABLE_PERSONAL_CALCULATOR && (
        <Suspense fallback={null}>
          <PersonalFactorsSection />
        </Suspense>
      )}
      <section className="mt-12">
        <div className="mt-6">
          <ParentsCompare />
        </div>
      </section>
    </div>
  );
}
