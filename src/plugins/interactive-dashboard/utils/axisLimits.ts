/**
 * Axis range utilities for histogram and scatter card axis limiting/trimming.
 *
 * Provides percentile-based axis range computation to handle outliers
 * in transportation simulation data. Users can configure:
 * - Explicit min/max bounds via YAML (xMin, xMax, yMin, yMax)
 * - Auto-trimming via percentile (autoTrim, xAutoTrim, yAutoTrim)
 * - Or both: explicit bounds override autoTrim where specified
 */

import { quantileSorted } from 'simple-statistics'

/**
 * Configuration for computing an axis range.
 */
export interface AxisRangeConfig {
  values: number[]     // Data values for the axis
  min?: number         // Explicit minimum (from YAML xMin/yMin)
  max?: number         // Explicit maximum (from YAML xMax/yMax)
  autoTrim?: number    // Percentile for auto-trimming (e.g. 95 means keep central 95%)
  padding?: number     // Fractional padding added to each side (default 0.02 = 2%)
}

/**
 * Compute lower and upper percentile bounds for an array of numeric values.
 *
 * For percentile=95 the lower bound is at the 2.5th percentile and the
 * upper bound is at the 97.5th percentile, keeping the central 95% of data.
 *
 * @param values  - Array of numeric values (may contain null/undefined/NaN)
 * @param percentile - Central percentile to keep (e.g. 95)
 * @returns Object with lower and upper bounds. Returns {-Infinity, Infinity} if fewer than 2 valid values.
 */
export function computePercentileBounds(
  values: number[],
  percentile: number
): { lower: number; upper: number } {
  // Filter out null, undefined, NaN and non-finite values
  const clean = values.filter(
    v => v !== null && v !== undefined && typeof v === 'number' && isFinite(v) && !isNaN(v)
  )

  if (clean.length < 2) {
    return { lower: -Infinity, upper: Infinity }
  }

  // Sort ascending for quantileSorted
  const sorted = [...clean].sort((a, b) => a - b)

  // Compute tail fraction: for percentile=95, tail = (100-95)/2 = 2.5 -> 0.025
  const tail = (100 - percentile) / 200 // divide by 200 = divide by 2 then by 100

  const lower = quantileSorted(sorted, tail)
  const upper = quantileSorted(sorted, 1 - tail)

  return { lower, upper }
}

/**
 * Compute the axis range to use for a Plotly axis.
 *
 * Resolution priority:
 *   1. Explicit min AND max -> use both directly (+ padding)
 *   2. Explicit min only -> use min + percentile/data upper bound
 *   3. Explicit max only -> use percentile/data lower bound + max
 *   4. autoTrim only -> compute percentile bounds (+ padding)
 *   5. Nothing specified -> return undefined (Plotly auto-range)
 *
 * @returns [lower, upper] range suitable for Plotly axis `range`, or undefined for auto-range.
 */
export function computeAxisRange(config: AxisRangeConfig): [number, number] | undefined {
  const { values, min, max, autoTrim, padding = 0.02 } = config

  const hasMin = min !== undefined && min !== null
  const hasMax = max !== undefined && max !== null
  const hasAutoTrim = autoTrim !== undefined && autoTrim !== null && autoTrim > 0 && autoTrim <= 100

  // Case 5: Nothing specified -> Plotly auto-range
  if (!hasMin && !hasMax && !hasAutoTrim) {
    return undefined
  }

  // Compute percentile bounds if autoTrim is specified (used as fallback for unspecified bounds)
  let autoLower: number | undefined
  let autoUpper: number | undefined
  if (hasAutoTrim) {
    const bounds = computePercentileBounds(values, autoTrim!)
    if (isFinite(bounds.lower) && isFinite(bounds.upper)) {
      autoLower = bounds.lower
      autoUpper = bounds.upper
    }
  }

  // Resolve lower bound
  let lower: number
  if (hasMin) {
    lower = min!
  } else if (autoLower !== undefined) {
    lower = autoLower
  } else {
    // Fallback to data minimum
    const clean = values.filter(v => typeof v === 'number' && isFinite(v) && !isNaN(v))
    if (clean.length === 0) return undefined
    lower = Math.min(...clean)
  }

  // Resolve upper bound
  let upper: number
  if (hasMax) {
    upper = max!
  } else if (autoUpper !== undefined) {
    upper = autoUpper
  } else {
    // Fallback to data maximum
    const clean = values.filter(v => typeof v === 'number' && isFinite(v) && !isNaN(v))
    if (clean.length === 0) return undefined
    upper = Math.max(...clean)
  }

  // Apply padding
  const range = upper - lower
  const pad = range * padding
  return [lower - pad, upper + pad]
}
