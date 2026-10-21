"""
Scenario model for county-summary.json (`scenarioModel`, see
app/src/types/scenario.ts).

One bivariate OLS fit per candidate lever: lifeExpectancy ~ indicator across
the region's ZIPs. Fits are reported one lever at a time and never summed:
the indicators are strongly collinear across ZIPs, so adding slopes would
double-count shared variation.
"""

import numpy as np
from scipy import stats

SCENARIO_LEVERS = (
    "povertyRate",
    "uninsuredRate",
    "diabetes",
    "hypertension",
    "obesity",
)

# ACS rates are unstable for low-population ZIPs; those listed in the preset's
# dataQualityNotes are left out of these fits.
ACS_LEVERS = ("povertyRate", "uninsuredRate")


# Below this many usable ZIPs a cross-ZIP slope is not worth showing (and with
# n < 3 or constant x the t-interval is undefined).
MIN_FIT_ZIPS = 10


def fit_lever(zctas, indicator, excluded_zips):
    """
    Bivariate OLS of lifeExpectancy on `indicator` over usable ZIPs, or None
    when there are too few ZIPs or the indicator does not vary.
    """
    points = sorted(
        (z, rec[indicator], rec["lifeExpectancy"])
        for z, rec in zctas.items()
        if rec[indicator] is not None
        and rec["lifeExpectancy"] is not None
        and not (indicator in ACS_LEVERS and z in excluded_zips)
    )
    zips = [p[0] for p in points]
    x = np.array([p[1] for p in points], dtype=float)
    y = np.array([p[2] for p in points], dtype=float)
    n = len(points)
    if n < MIN_FIT_ZIPS or np.ptp(x) == 0:
        return None

    res = stats.linregress(x, y)
    t_crit = stats.t.ppf(0.975, n - 2)
    best = int(np.argmin(x))  # first ZIP (sorted) holding the minimum

    return {
        "indicator": indicator,
        "slope": round(float(res.slope), 4),
        "slopeSE": round(float(res.stderr), 4),
        "slopeCI95": [
            round(float(res.slope - t_crit * res.stderr), 4),
            round(float(res.slope + t_crit * res.stderr), 4),
        ],
        "intercept": round(float(res.intercept), 3),
        "r2": round(float(res.rvalue**2), 3),
        "n": n,
        "observedMin": round(float(x.min()), 2),
        "observedMax": round(float(x.max()), 2),
        "bestZip": zips[best],
    }


def build_scenario_model(zctas, data_quality_notes):
    """
    A fit is a lever iff its slope is negative and the upper end of its 95% CI
    is below zero; otherwise it is kept under `excluded` with the reason.
    The rule is applied to the reported (rounded) values, so the file is
    self-consistent.
    """
    excluded_zips = set(data_quality_notes or {})
    levers, excluded = [], []
    for indicator in SCENARIO_LEVERS:
        fit = fit_lever(zctas, indicator, excluded_zips)
        if fit is None:
            print(f"  scenarioModel: skipping {indicator} (too few ZIPs or no variation)")
            continue
        if fit["slope"] >= 0:
            excluded.append({**fit, "reason": "slope is not negative"})
        elif fit["slopeCI95"][1] >= 0:
            excluded.append({**fit, "reason": "95% CI includes zero"})
        else:
            levers.append(fit)
    return {
        "method": "bivariate-ols",
        "outcome": "lifeExpectancy",
        "levers": levers,
        "excluded": excluded,
    }
