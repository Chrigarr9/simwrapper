import { describe, it, expect } from 'vitest'
import { resolveExportItemData } from '../dataResolver'

const rows = [
  { id: '1', mode: 'car', price: 0.2, fleet: 100, group: 'A', cluster_id: '55', is_visual_sampled: true },
  { id: '2', mode: 'car', price: 0.4, fleet: 100, group: 'B', cluster_id: 'origin_55', is_visual_sampled: false },
  { id: '3', mode: 'pt', price: 0.2, fleet: 300, group: 'A', cluster_id: '77', is_visual_sampled: true },
  { id: '4', mode: 'car', price: 0.2, fleet: 500, group: 'A', cluster_id: 'origin_77', is_visual_sampled: true },
]

describe('resolveExportItemData', () => {
  it('applies state filters before card fixedFilter', () => {
    const result = resolveExportItemData({
      allData: rows,
      idColumn: 'id',
      stateFilters: { mode: 'car' },
      cardFixedFilter: { price: 0.2 },
    })
    expect(result.filteredData.map(r => r.id)).toEqual(['1', '4'])
    expect(result.baselineData).toBe(rows)
  })

  it('supports array filters and range filters', () => {
    const result = resolveExportItemData({
      allData: rows,
      idColumn: 'id',
      stateFilters: { group: ['A', 'B'], fleet: { min: 100, max: 300 } },
      cardFixedFilter: { price: 0.2 },
    })
    expect(result.filteredData.map(r => r.id)).toEqual(['1', '3'])
  })

  it('compares fixedFilter values as strings to match interactive cards', () => {
    const result = resolveExportItemData({
      allData: rows,
      idColumn: 'id',
      stateFilters: {},
      cardFixedFilter: { price: '0.2' },
    })
    expect(result.filteredData.map(r => r.id)).toEqual(['1', '3', '4'])
  })

  it('matches interactive prefix-compatible filters', () => {
    const result = resolveExportItemData({
      allData: rows,
      idColumn: 'id',
      stateFilters: { cluster_id: 'origin_55' },
    })
    expect(result.filteredData.map(r => r.id)).toEqual(['1', '2'])
  })

  it('applies useVisualSample to filtered and baseline data', () => {
    const result = resolveExportItemData({
      allData: rows,
      idColumn: 'id',
      stateFilters: { mode: 'car' },
      useVisualSample: true,
    })
    expect(result.filteredData.map(r => r.id)).toEqual(['1', '4'])
    expect(result.baselineData.map(r => r.id)).toEqual(['1', '3', '4'])
  })

  it('returns an empty filteredData array when filters match no rows', () => {
    const result = resolveExportItemData({
      allData: rows,
      idColumn: 'id',
      stateFilters: { mode: 'missing' },
    })
    expect(result.filteredData).toEqual([])
  })
})
