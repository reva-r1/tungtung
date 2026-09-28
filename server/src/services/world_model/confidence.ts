/**
 * Mathematical Confidence Engine for Revana World Model.
 * 
 * Replaces hardcoded static confidence literals with computed, reproducible
 * confidence values grounded in:
 * 1. Historical provider reliability
 * 2. Temporal freshness (strictly monotonically decreasing with data age)
 * 3. Spatial proximity relative to corridor/entity boundaries
 * 4. Multi-source corroboration count
 */

/**
 * Baseline reliability metrics (0.0 to 1.0) for verified telemetry providers.
 * Grounded in API schema consistency, sensor calibration standards, and uptime.
 */
export const PROVIDER_RELIABILITY: Record<string, number> = {
  // Weather & Environmental
  open_meteo_weather: 0.92,
  open_meteo_air_quality: 0.88,
  open_meteo_marine: 0.89,
  usgs_earthquakes: 0.98,
  nasa_eonet: 0.94,
  public_water_level: 0.90,

  // Aviation & Maritime
  opensky_network: 0.91,
  ais_stream: 0.94,
  ais_replay: 0.88,

  // Transit & Urban
  gtfs_transit: 0.86,
  gbfs_mobility: 0.84,
  national_grid: 0.92,
  exchange_rates: 0.96,
  data_gov_in: 0.85,
  osm_nominatim: 0.82,
  public_feed: 0.78,

  // Synthetic & Test Providers
  mock_provider: 0.80,
  test_provider: 0.80,

  // Spatial inference engines
  spatial_corridor_matcher: 0.90,
  terminal_radar_geofence: 0.95,
  hydrological_basin_registry: 0.88,
};

/**
 * Returns the baseline reliability score for a given data provider.
 * Falls back to 0.75 for unregistered or ad-hoc providers.
 */
export function getProviderReliability(providerName?: string): number {
  if (!providerName) return 0.75;
  const normalizedKey = providerName.toLowerCase().trim().replace(/[-\s]/g, '_');
  return PROVIDER_RELIABILITY[normalizedKey] ?? PROVIDER_RELIABILITY[providerName] ?? 0.75;
}

export interface ConfidenceCalculationParams {
  /** Baseline reliability of the reporting data provider (0.0 to 1.0) */
  sourceReliability: number;
  /** Age of observation in seconds at time of evaluation (must be >= 0) */
  dataAgeSeconds: number;
  /** Number of independent observation sources confirming the state (default 1) */
  corroboratingSources?: number;
  /** Actual computed distance in km from entity to reference geometry (optional) */
  distanceKm?: number;
  /** Maximum acceptable distance threshold in km (optional) */
  maxDistanceKm?: number;
}

/**
 * Computes a grounded confidence score in the range [0.05, 0.99].
 * 
 * ============================================================================
 * MATHEMATICAL FORMULA:
 * ============================================================================
 * 
 * 1. Temporal Freshness Factor:
 *    T(age) = 1 / (1 + age / 14400)
 *    - Monotonically decreases as age increases.
 *    - age = 0s  -> T = 1.000
 *    - age = 1h  -> T = 0.800
 *    - age = 4h  -> T = 0.500
 *    - age = 24h -> T = 0.143
 * 
 * 2. Spatial Proximity Factor (applied if distanceKm and maxDistanceKm are supplied):
 *    S(d, d_max) = 0.60 + 0.40 * clamp(1 - (d / d_max), 0, 1)
 *    - Point directly on polyline/center (d = 0) -> S = 1.00
 *    - Point right at threshold boundary (d = d_max) -> S = 0.60
 *    - If distance exceeds maxDistanceKm -> S = 0.60 (caller should prune if d > d_max)
 * 
 * 3. Multi-source Corroboration Bonus:
 *    C(n) = min(0.08, (n - 1) * 0.04)
 *    - 1 source  -> +0.00
 *    - 2 sources -> +0.04
 *    - 3+ sources -> +0.08
 * 
 * 4. Overall Synthesis:
 *    Confidence = clamp(sourceReliability * T(age) * S(d, d_max) + C(n), 0.05, 0.99)
 * 
 * ============================================================================
 */
export function computeConfidence(params: ConfidenceCalculationParams): number {
  const {
    sourceReliability,
    dataAgeSeconds,
    corroboratingSources = 1,
    distanceKm,
    maxDistanceKm,
  } = params;

  // 1. Validate and clamp base reliability
  const baseReliability = Math.max(0.1, Math.min(1.0, sourceReliability));

  // 2. Compute temporal decay (strictly decreasing with age)
  const age = Math.max(0, dataAgeSeconds);
  const temporalFactor = 1.0 / (1.0 + age / 14400.0);

  // 3. Compute spatial factor if distance parameters are supplied
  let spatialFactor = 1.0;
  if (distanceKm !== undefined && maxDistanceKm !== undefined && maxDistanceKm > 0) {
    const normDist = Math.max(0, Math.min(1.0, distanceKm / maxDistanceKm));
    spatialFactor = 0.60 + 0.40 * (1.0 - normDist);
  }

  // 4. Compute corroboration bonus
  const sources = Math.max(1, corroboratingSources);
  const corroborationBonus = Math.min(0.08, (sources - 1) * 0.04);

  // 5. Total combined confidence
  const rawScore = baseReliability * temporalFactor * spatialFactor + corroborationBonus;

  // Clamp within bounds [0.05, 0.99] and round to 3 decimal places
  const clamped = Math.max(0.05, Math.min(0.99, rawScore));
  return Math.round(clamped * 1000) / 1000;
}
