import { describe, test, expect, beforeEach, vi } from 'vitest'
import { FilterManager } from '../FilterManager'

describe('FilterManager', () => {
  let fm: FilterManager

  beforeEach(() => {
    fm = new FilterManager()
  })

  test('applies OR logic within filter values', () => {
    const data = [{ mode: 'car' }, { mode: 'bike' }, { mode: 'walk' }]
    fm.setFilter('mode', 'mode', new Set(['car', 'bike']), 'categorical')

    const filtered = fm.applyFilters(data)
    expect(filtered).toHaveLength(2)
  })

  test('applies AND logic between different filters', () => {
    const data = [
      { mode: 'car', age: 25 },
      { mode: 'bike', age: 25 },
      { mode: 'car', age: 30 },
    ]

    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.setFilter('age', 'age', new Set([25]), 'categorical')

    const filtered = fm.applyFilters(data)
    expect(filtered).toEqual([{ mode: 'car', age: 25 }])
  })

  test('notifies observers on filter change', () => {
    const observer = { onFilterChange: vi.fn() }
    fm.addObserver(observer)

    fm.setFilter('test', 'col', new Set([1]), 'categorical')
    expect(observer.onFilterChange).toHaveBeenCalled()
  })

  test('toggles filter values', () => {
    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.toggleFilterValue('mode', 'bike')

    let filter = fm.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(true)

    fm.toggleFilterValue('mode', 'bike')
    filter = fm.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(false)
  })

  test('removes filter when all values toggled off', () => {
    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.toggleFilterValue('mode', 'car')

    expect(fm.getFilters().size).toBe(0)
  })

  test('clears specific filter', () => {
    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.setFilter('age', 'age', new Set([25]), 'categorical')

    fm.clearFilter('mode')

    expect(fm.getFilters().size).toBe(1)
    expect(fm.getFilters().has('age')).toBe(true)
  })

  test('clears all filters', () => {
    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.setFilter('age', 'age', new Set([25]), 'categorical')

    fm.clearAllFilters()

    expect(fm.getFilters().size).toBe(0)
  })

  describe('Column Indexing', () => {
    test('buildIndex enables indexed filtering', () => {
      const data = [{ mode: 'car', age: 25 }, { mode: 'bike', age: 30 }]
      fm.buildIndex(data)
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      expect(fm.applyFilters(data)).toHaveLength(1)
      expect(fm.applyFilters(data)[0]).toEqual({ mode: 'car', age: 25 })
    })

    test('indexed filter matches non-indexed filter results', () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        mode: ['car', 'bike', 'walk'][i % 3],
        age: 20 + (i % 5),
      }))

      // Non-indexed result
      fm.setFilter('mode', 'mode', new Set(['car', 'bike']), 'categorical')
      const linearResult = fm.applyFilters(data)

      // Indexed result (same data reference)
      fm.buildIndex(data)
      const indexedResult = fm.applyFilters(data)

      expect(indexedResult).toEqual(linearResult)
    })

    test('indexed filter handles AND across columns', () => {
      const data = [
        { mode: 'car', age: 25 },
        { mode: 'bike', age: 25 },
        { mode: 'car', age: 30 },
      ]
      fm.buildIndex(data)
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      fm.setFilter('age', 'age', new Set([25]), 'categorical')
      expect(fm.applyFilters(data)).toEqual([{ mode: 'car', age: 25 }])
    })

    test('binned filters work with index (falls back to linear for bins)', () => {
      const data = [
        { distance: 5 }, { distance: 15 }, { distance: 25 },
      ]
      fm.buildIndex(data)
      fm.setFilter('dist', 'distance', new Set([10]), 'binned', 10)
      expect(fm.applyFilters(data)).toEqual([{ distance: 15 }])
    })

    test('indexed filter with no matching values returns empty', () => {
      const data = [{ mode: 'car' }, { mode: 'bike' }]
      fm.buildIndex(data)
      fm.setFilter('mode', 'mode', new Set(['train']), 'categorical')
      expect(fm.applyFilters(data)).toEqual([])
    })

    test('indexed filter on non-existent column returns empty', () => {
      const data = [{ mode: 'car' }, { mode: 'bike' }]
      fm.buildIndex(data)
      fm.setFilter('color', 'color', new Set(['red']), 'categorical')
      expect(fm.applyFilters(data)).toEqual([])
    })

    test('non-indexed data falls back to linear scan', () => {
      const indexedData = [{ mode: 'car' }]
      const differentData = [{ mode: 'car' }, { mode: 'bike' }]
      fm.buildIndex(indexedData)
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      // differentData is not the same reference as indexedData, so linear fallback
      expect(fm.applyFilters(differentData)).toHaveLength(1)
    })

    test('mixed binned and categorical filters with index', () => {
      const data = [
        { mode: 'car', distance: 5 },
        { mode: 'car', distance: 15 },
        { mode: 'bike', distance: 15 },
      ]
      fm.buildIndex(data)
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      fm.setFilter('dist', 'distance', new Set([10]), 'binned', 10)
      const result = fm.applyFilters(data)
      expect(result).toEqual([{ mode: 'car', distance: 15 }])
    })
  })

  describe('Centralized Cache', () => {
    test('getFilteredData caches results', () => {
      const data = [{ mode: 'car' }, { mode: 'bike' }]
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      const result1 = fm.getFilteredData(data, 'mode')
      const result2 = fm.getFilteredData(data, 'mode')
      expect(result1).toBe(result2) // Same reference = cached
    })

    test('cache invalidated on filter change', () => {
      const data = [{ mode: 'car' }, { mode: 'bike' }]
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      const result1 = fm.getFilteredData(data, 'mode')
      fm.setFilter('mode', 'mode', new Set(['bike']), 'categorical')
      const result2 = fm.getFilteredData(data, 'mode')
      expect(result1).not.toBe(result2) // Different reference = cache invalidated
    })

    test('getFilteredIds returns Set of IDs', () => {
      const data = [
        { id: 1, mode: 'car' },
        { id: 2, mode: 'bike' },
        { id: 3, mode: 'car' },
      ]
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      const ids = fm.getFilteredIds(data, 'id')
      expect(ids).toEqual(new Set([1, 3]))
    })

    test('getFilteredIds caches results', () => {
      const data = [
        { id: 1, mode: 'car' },
        { id: 2, mode: 'bike' },
      ]
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      const ids1 = fm.getFilteredIds(data, 'id')
      const ids2 = fm.getFilteredIds(data, 'id')
      expect(ids1).toBe(ids2) // Same reference = cached
    })

    test('cache invalidated on clearAllFilters', () => {
      const data = [{ mode: 'car' }, { mode: 'bike' }]
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      const result1 = fm.getFilteredData(data, 'mode')
      fm.clearAllFilters()
      const result2 = fm.getFilteredData(data, 'mode')
      expect(result1).not.toBe(result2)
    })

    test('cache invalidated on toggleFilterValue', () => {
      const data = [{ mode: 'car' }, { mode: 'bike' }]
      fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
      const result1 = fm.getFilteredData(data, 'mode')
      fm.toggleFilterValue('mode', 'bike')
      const result2 = fm.getFilteredData(data, 'mode')
      expect(result1).not.toBe(result2)
    })

    test('getFilteredData returns all data when no filters', () => {
      const data = [{ mode: 'car' }, { mode: 'bike' }]
      const result = fm.getFilteredData(data, 'mode')
      expect(result).toBe(data) // No filters = return original data
    })
  })
})
