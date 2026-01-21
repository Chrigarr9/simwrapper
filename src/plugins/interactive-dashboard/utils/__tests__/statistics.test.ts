import { describe, it, expect } from 'vitest'
import { correlationWithPValue, computeCorrelationMatrix, CorrelationResult, CorrelationMatrixResult } from '../statistics'

describe('statistics module', () => {
  describe('correlationWithPValue', () => {
    it('should return perfect positive correlation (r ≈ 1) for perfectly correlated data', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [1, 2, 3, 4, 5]

      const result = correlationWithPValue(x, y)

      // Note: r is clamped to 0.9999 to avoid division by zero in t-statistic
      expect(result.r).toBeCloseTo(1, 3)
      expect(result.p).toBeLessThan(0.05)
      expect(result.n).toBe(5)
      expect(result.significant).toBe(true)
    })

    it('should return perfect negative correlation (r ≈ -1) for inversely correlated data', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [5, 4, 3, 2, 1]

      const result = correlationWithPValue(x, y)

      // Note: r is clamped to -0.9999 to avoid division by zero in t-statistic
      expect(result.r).toBeCloseTo(-1, 3)
      expect(result.p).toBeLessThan(0.05)
      expect(result.n).toBe(5)
      expect(result.significant).toBe(true)
    })

    it('should return weak correlation (r ≈ 0) for uncorrelated data', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [3, 1, 4, 1, 5]

      const result = correlationWithPValue(x, y)

      expect(Math.abs(result.r)).toBeLessThan(0.5)
      expect(result.n).toBe(5)
    })

    it('should filter out missing values and calculate correlation on valid pairs', () => {
      const x = [1, 2, null as any, 4, 5]
      const y = [1, 2, 3, 4, undefined as any]

      const result = correlationWithPValue(x, y)

      // Should only use pairs (1,1), (2,2), (4,4) - 3 valid pairs
      expect(result.n).toBe(3)
      expect(result.r).toBeCloseTo(1, 3)
    })

    it('should filter out NaN values', () => {
      const x = [1, 2, NaN, 4, 5]
      const y = [1, 2, 3, NaN, 5]

      const result = correlationWithPValue(x, y)

      // Should only use pairs (1,1), (2,2), (5,5) - 3 valid pairs
      expect(result.n).toBe(3)
    })

    it('should return insufficient data result when n < 3', () => {
      const x = [1, 2]
      const y = [1, 2]

      const result = correlationWithPValue(x, y)

      expect(result.r).toBe(0)
      expect(result.p).toBe(1)
      expect(result.n).toBe(2)
      expect(result.significant).toBe(false)
    })

    it('should return insufficient data when all values are filtered out', () => {
      const x = [null, undefined, NaN] as any[]
      const y = [1, 2, 3]

      const result = correlationWithPValue(x, y)

      expect(result.r).toBe(0)
      expect(result.p).toBe(1)
      expect(result.n).toBe(0)
      expect(result.significant).toBe(false)
    })

    it('should detect significance for strong correlation with adequate sample size', () => {
      // Strong positive correlation with 10 samples
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const y = [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.9, 16.1, 17.8, 20.2]

      const result = correlationWithPValue(x, y)

      expect(result.r).toBeGreaterThan(0.95)
      expect(result.p).toBeLessThan(0.001)
      expect(result.significant).toBe(true)
    })

    it('should respect custom alpha level', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [1, 2, 3, 4, 5]

      const resultStrict = correlationWithPValue(x, y, 0.001)

      expect(resultStrict.r).toBeCloseTo(1, 3)
      expect(resultStrict.significant).toBe(true) // p << 0.001 for perfect correlation
    })

    it('should handle zero variance (constant values) gracefully', () => {
      const x = [5, 5, 5, 5, 5]
      const y = [1, 2, 3, 4, 5]

      const result = correlationWithPValue(x, y)

      // Zero variance should result in r=0 (handled by simple-statistics)
      expect(result.r).toBe(0)
      expect(result.significant).toBe(false)
    })

    it('should handle correlation near +1 without producing NaN or Infinity', () => {
      // Data that produces r very close to 1
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const y = x.map(v => v * 1.0 + 0.0001) // Almost perfect correlation

      const result = correlationWithPValue(x, y)

      expect(result.r).toBeCloseTo(1, 2)
      expect(result.p).not.toBe(NaN)
      expect(result.p).not.toBe(Infinity)
      expect(result.p).toBeGreaterThanOrEqual(0)
      expect(result.p).toBeLessThanOrEqual(1)
    })

    it('should handle correlation near -1 without producing NaN or Infinity', () => {
      // Data that produces r very close to -1
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const y = x.map(v => -v * 1.0 + 0.0001) // Almost perfect negative correlation

      const result = correlationWithPValue(x, y)

      expect(result.r).toBeCloseTo(-1, 2)
      expect(result.p).not.toBe(NaN)
      expect(result.p).not.toBe(Infinity)
      expect(result.p).toBeGreaterThanOrEqual(0)
      expect(result.p).toBeLessThanOrEqual(1)
    })
  })

  describe('computeCorrelationMatrix', () => {
    it('should compute 2×2 correlation matrix with correct structure', () => {
      const data = [
        { a: 1, b: 2 },
        { a: 2, b: 4 },
        { a: 3, b: 6 },
        { a: 4, b: 8 },
        { a: 5, b: 10 }
      ]
      const attributes = ['a', 'b']

      const result = computeCorrelationMatrix(data, attributes)

      // Check structure
      expect(result.matrix).toHaveLength(2)
      expect(result.matrix[0]).toHaveLength(2)
      expect(result.pValues).toHaveLength(2)
      expect(result.sampleSizes).toHaveLength(2)
      expect(result.attributes).toEqual(['a', 'b'])

      // Diagonal should be 1 (perfect self-correlation)
      expect(result.matrix[0][0]).toBe(1)
      expect(result.matrix[1][1]).toBe(1)
      expect(result.pValues[0][0]).toBe(0)
      expect(result.pValues[1][1]).toBe(0)

      // Off-diagonal: a and b are perfectly correlated
      expect(result.matrix[0][1]).toBeCloseTo(1, 3)
      expect(result.matrix[1][0]).toBeCloseTo(1, 3)

      // Matrix should be symmetric
      expect(result.matrix[0][1]).toBeCloseTo(result.matrix[1][0], 10)
      expect(result.pValues[0][1]).toBeCloseTo(result.pValues[1][0], 10)
    })

    it('should compute 3×3 correlation matrix', () => {
      const data = [
        { x: 1, y: 2, z: 10 },
        { x: 2, y: 4, z: 9 },
        { x: 3, y: 6, z: 8 },
        { x: 4, y: 8, z: 7 },
        { x: 5, y: 10, z: 6 }
      ]
      const attributes = ['x', 'y', 'z']

      const result = computeCorrelationMatrix(data, attributes)

      expect(result.matrix).toHaveLength(3)
      expect(result.matrix[0]).toHaveLength(3)

      // x and y are positively correlated
      expect(result.matrix[0][1]).toBeCloseTo(1, 3)

      // x and z are negatively correlated
      expect(result.matrix[0][2]).toBeCloseTo(-1, 3)

      // All diagonal elements should be 1
      expect(result.matrix[0][0]).toBe(1)
      expect(result.matrix[1][1]).toBe(1)
      expect(result.matrix[2][2]).toBe(1)
    })

    it('should handle missing values in matrix computation with varying sample sizes', () => {
      const data = [
        { a: 1, b: 2, c: 3 },
        { a: 2, b: null, c: 6 },
        { a: 3, b: 6, c: 9 },
        { a: 4, b: 8, c: null },
        { a: 5, b: 10, c: 15 }
      ]
      const attributes = ['a', 'b', 'c']

      const result = computeCorrelationMatrix(data, attributes)

      // Sample sizes should vary based on missing data
      // a-b: 4 valid pairs (row 1 has null in b)
      expect(result.sampleSizes[0][1]).toBe(4)

      // a-c: 4 valid pairs (row 3 has null in c)
      expect(result.sampleSizes[0][2]).toBe(4)

      // Diagonal should have full dataset size
      expect(result.sampleSizes[0][0]).toBe(5)
      expect(result.sampleSizes[1][1]).toBe(5)
      expect(result.sampleSizes[2][2]).toBe(5)
    })

    it('should handle empty attributes array', () => {
      const data = [{ a: 1 }, { a: 2 }]
      const attributes: string[] = []

      const result = computeCorrelationMatrix(data, attributes)

      expect(result.matrix).toHaveLength(0)
      expect(result.pValues).toHaveLength(0)
      expect(result.sampleSizes).toHaveLength(0)
      expect(result.attributes).toEqual([])
    })

    it('should handle single attribute (1×1 matrix)', () => {
      const data = [{ a: 1 }, { a: 2 }, { a: 3 }]
      const attributes = ['a']

      const result = computeCorrelationMatrix(data, attributes)

      expect(result.matrix).toHaveLength(1)
      expect(result.matrix[0]).toHaveLength(1)
      expect(result.matrix[0][0]).toBe(1) // Self-correlation
      expect(result.pValues[0][0]).toBe(0)
      expect(result.sampleSizes[0][0]).toBe(3)
    })

    it('should compute large matrix efficiently', () => {
      // Create data with 10 attributes
      const data = Array.from({ length: 50 }, (_, i) => {
        const row: any = {}
        for (let j = 0; j < 10; j++) {
          row[`attr${j}`] = i + j * 2 + Math.random()
        }
        return row
      })
      const attributes = Array.from({ length: 10 }, (_, i) => `attr${i}`)

      const startTime = Date.now()
      const result = computeCorrelationMatrix(data, attributes)
      const duration = Date.now() - startTime

      expect(result.matrix).toHaveLength(10)
      expect(result.matrix[0]).toHaveLength(10)
      expect(duration).toBeLessThan(1000) // Should complete in less than 1 second

      // All diagonal elements should be 1
      for (let i = 0; i < 10; i++) {
        expect(result.matrix[i][i]).toBe(1)
      }
    })
  })

  describe('CorrelationResult interface', () => {
    it('should have correct structure', () => {
      const x = [1, 2, 3, 4, 5]
      const y = [1, 2, 3, 4, 5]

      const result = correlationWithPValue(x, y)

      expect(result).toHaveProperty('r')
      expect(result).toHaveProperty('p')
      expect(result).toHaveProperty('n')
      expect(result).toHaveProperty('significant')

      expect(typeof result.r).toBe('number')
      expect(typeof result.p).toBe('number')
      expect(typeof result.n).toBe('number')
      expect(typeof result.significant).toBe('boolean')
    })
  })

  describe('CorrelationMatrixResult interface', () => {
    it('should have correct structure', () => {
      const data = [{ a: 1, b: 2 }]
      const attributes = ['a', 'b']

      const result = computeCorrelationMatrix(data, attributes)

      expect(result).toHaveProperty('matrix')
      expect(result).toHaveProperty('pValues')
      expect(result).toHaveProperty('sampleSizes')
      expect(result).toHaveProperty('attributes')

      expect(Array.isArray(result.matrix)).toBe(true)
      expect(Array.isArray(result.pValues)).toBe(true)
      expect(Array.isArray(result.sampleSizes)).toBe(true)
      expect(Array.isArray(result.attributes)).toBe(true)
    })
  })
})
