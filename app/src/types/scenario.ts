// `scenarioModel` block of county-summary.json, written by
// scripts/export_frontend_json.py. One bivariate OLS fit per candidate lever
// (lifeExpectancy ~ indicator across the region's ZIPs). Levers are never
// summed: the indicators are strongly collinear across ZIPs, so adding slopes
// would double-count shared variation.

export type ScenarioLeverKey =
  | "povertyRate"
  | "uninsuredRate"
  | "diabetes"
  | "hypertension"
  | "obesity";

export interface ScenarioFit {
  indicator: ScenarioLeverKey;
  /** Years of life expectancy per 1 percentage-point change in the indicator. */
  slope: number;
  slopeSE: number;
  /** 95% CI for the slope, t-distribution with n-2 df. [low, high]. */
  slopeCI95: [number, number];
  intercept: number;
  r2: number;
  /** ZIPs in the fit (non-null LE and indicator, data-quality ZIPs excluded for ACS rates). */
  n: number;
  /** Lowest (best) and highest observed indicator values among fitted ZIPs. */
  observedMin: number;
  observedMax: number;
  /** ZIP holding observedMin. */
  bestZip: string;
}

export interface ScenarioModel {
  method: "bivariate-ols";
  outcome: "lifeExpectancy";
  /** Fits whose slope is negative and whose 95% CI excludes zero. */
  levers: ScenarioFit[];
  /** Candidate fits that failed that rule, kept for transparency in the UI. */
  excluded: (ScenarioFit & { reason: string })[];
}
