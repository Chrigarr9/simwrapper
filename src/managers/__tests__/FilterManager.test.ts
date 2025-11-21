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
})
