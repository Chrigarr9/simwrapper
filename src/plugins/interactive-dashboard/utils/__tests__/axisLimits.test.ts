import { describe, it, expect } from 'vitest'
import { computePercentileBounds, computeAxisRange, AxisRangeConfig } from '../axisLimits'

describe('axisLimits module', () => {
  describe('computePercentileBounds', () => {
    it('should compute 95th percentile bounds for a simple dataset', () => {
      // 100 values from 1 to 100
      const values = Array.from({ length: 100 }, (_, i) => i + 1)

      const result = computePercentileBounds(values, 95)

      // 2.5th percentile should be near the low end, 97.5th near high end
      // For uniform 1-100: 2.5th percentile ~ 3.475, 97.5th ~ 97.525
      expect(result.lower).toBeGreaterThanOrEqual(1)
      expect(result.lower).toBeLessThan(10)
      expect(result.upper).toBeGreaterThan(90)
      expect(result.upper).toBeLessThanOrEqual(100)
    })

    it('should compute 99th percentile bounds (tighter trimming)', () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)

      const result = computePercentileBounds(values, 99)

      // 0.5th percentile ~ 1.5, 99.5th ~ 99.5
      expect(result.lower).toBeGreaterThanOrEqual(1)
      expect(result.lower).toBeLessThan(5)
      expect(result.upper).toBeGreaterThan(95)
      expect(result.upper).toBeLessThanOrEqual(100)
    })

    it('should return -Infinity/Infinity for empty array', () => {
      const result = computePercentileBounds([], 95)

      expect(result.lower).toBe(-Infinity)
      expect(result.upper).toBe(Infinity)
    })

    it('should return -Infinity/Infinity for single value', () => {
      const result = computePercentileBounds([42], 95)

      expect(result.lower).toBe(-Infinity)
      expect(result.upper).toBe(Infinity)
    })

    it('should handle all same values', () => {
      const values = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]

      const result = computePercentileBounds(values, 95)

      expect(result.lower).toBe(5)
      expect(result.upper).toBe(5)
    })

    it('should filter out null, undefined and NaN values', () => {
      const values = [1, null as any, 2, undefined as any, 3, NaN, 4, 5]

      const result = computePercentileBounds(values, 95)

      // Should work with [1, 2, 3, 4, 5] - 5 valid values
      expect(result.lower).toBeGreaterThanOrEqual(1)
      expect(result.upper).toBeLessThanOrEqual(5)
    })

    it('should handle dataset with outliers', () => {
      // Most values 0-100, with extreme outlier at 10000
      const values = Array.from({ length: 99 }, (_, i) => i + 1)
      values.push(10000) // extreme outlier

      const result = computePercentileBounds(values, 95)

      // The 97.5th percentile should still be around 97-98, not near 10000
      expect(result.upper).toBeLessThan(200)
    })

    it('should return full range for percentile=100', () => {
      const values = [1, 2, 3, 4, 5, 100]

      const result = computePercentileBounds(values, 100)

      // 0th percentile = min, 100th percentile = max
      expect(result.lower).toBe(1)
      expect(result.upper).toBe(100)
    })
  })

  describe('computeAxisRange', () => {
    const sampleValues = Array.from({ length: 100 }, (_, i) => i + 1) // 1 to 100

    it('should return undefined when nothing is specified (Plotly auto-range)', () => {
      const result = computeAxisRange({
        values: sampleValues,
      })

      expect(result).toBeUndefined()
    })

    it('should use explicit min and max directly with padding', () => {
      const result = computeAxisRange({
        values: sampleValues,
        min: 0,
        max: 50000,
        padding: 0.02,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      // Padding: 0.02 * (50000 - 0) = 1000
      expect(lower).toBeCloseTo(0 - 1000, 0)
      expect(upper).toBeCloseTo(50000 + 1000, 0)
    })

    it('should use autoTrim only when no explicit min/max', () => {
      const result = computeAxisRange({
        values: sampleValues,
        autoTrim: 95,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      // Should trim to central 95% of 1-100
      expect(lower).toBeGreaterThanOrEqual(1)
      expect(lower).toBeLessThan(10)
      expect(upper).toBeGreaterThan(90)
      expect(upper).toBeLessThanOrEqual(100)
    })

    it('should mix explicit min with autoTrim for max', () => {
      const result = computeAxisRange({
        values: sampleValues,
        min: 0,
        autoTrim: 95,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      // min is explicit 0, max from 97.5th percentile
      expect(lower).toBe(0)
      expect(upper).toBeGreaterThan(90)
      expect(upper).toBeLessThanOrEqual(100)
    })

    it('should mix explicit max with autoTrim for min', () => {
      const result = computeAxisRange({
        values: sampleValues,
        max: 200,
        autoTrim: 95,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      // min from 2.5th percentile, max is explicit 200
      expect(lower).toBeGreaterThanOrEqual(1)
      expect(lower).toBeLessThan(10)
      expect(upper).toBe(200)
    })

    it('should override autoTrim bounds with explicit min/max when both specified', () => {
      const result = computeAxisRange({
        values: sampleValues,
        min: 10,
        max: 90,
        autoTrim: 95,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      // Explicit min/max should override autoTrim
      expect(lower).toBe(10)
      expect(upper).toBe(90)
    })

    it('should apply default 2% padding', () => {
      const result = computeAxisRange({
        values: [0, 100],
        min: 0,
        max: 100,
        // padding defaults to 0.02
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      // 2% of 100 range = 2
      expect(lower).toBeCloseTo(-2, 1)
      expect(upper).toBeCloseTo(102, 1)
    })

    it('should handle zero padding', () => {
      const result = computeAxisRange({
        values: [0, 100],
        min: 0,
        max: 100,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      expect(lower).toBe(0)
      expect(upper).toBe(100)
    })

    it('should return undefined for empty values with no explicit bounds', () => {
      const result = computeAxisRange({
        values: [],
        autoTrim: 95,
      })

      // Empty values + autoTrim with no valid percentile -> falls back to data min/max -> no data -> undefined
      expect(result).toBeUndefined()
    })

    it('should work with only min specified (max from data)', () => {
      const result = computeAxisRange({
        values: [10, 20, 30, 40, 50],
        min: 0,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      expect(lower).toBe(0)
      expect(upper).toBe(50)
    })

    it('should work with only max specified (min from data)', () => {
      const result = computeAxisRange({
        values: [10, 20, 30, 40, 50],
        max: 100,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      expect(lower).toBe(10)
      expect(upper).toBe(100)
    })

    it('should handle negative values correctly', () => {
      const values = [-50, -30, -10, 10, 30, 50]

      const result = computeAxisRange({
        values,
        min: -100,
        max: 100,
        padding: 0,
      })

      expect(result).toBeDefined()
      const [lower, upper] = result!
      expect(lower).toBe(-100)
      expect(upper).toBe(100)
    })
  })
})
