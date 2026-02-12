import { debugLog } from '../utils/debug'

export type FilterType = 'categorical' | 'range' | 'time' | 'binned'

export interface Filter {
  id: string
  column: string
  type: FilterType
  values: Set<any>              // Selected values (OR logic within set)
  behavior: 'toggle' | 'replace'
  binSize?: number              // For binned filters (histogram)
}

export interface FilterObserver {
  onFilterChange: (filters: Map<string, Filter>) => void
}

/**
 * Intersect two sets, returning a new set containing only elements in both.
 * Iterates over the smaller set for O(min(a,b)) performance.
 */
function intersectSets(a: Set<number>, b: Set<number>): Set<number> {
  const result = new Set<number>()
  const smaller = a.size <= b.size ? a : b
  const larger = a.size <= b.size ? b : a
  for (const val of smaller) {
    if (larger.has(val)) result.add(val)
  }
  return result
}

export class FilterManager {
  private filters: Map<string, Filter> = new Map()
  private observers: Set<FilterObserver> = new Set()

  // Column index for O(1) categorical filter lookup
  // Structure: column name -> normalized value -> Set of row indices
  private columnIndex: Map<string, Map<string, Set<number>>> = new Map()
  private indexedData: Record<string, any>[] = []

  // Centralized filter result cache (invalidated on filter change)
  private cachedFilteredData: any[] | null = null
  private cachedFilteredIds: Set<any> | null = null
  private cachedIdColumn: string | null = null
  private filterVersion = 0

  addObserver(observer: FilterObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: FilterObserver): void {
    this.observers.delete(observer)
  }

  setFilter(filterId: string, column: string, values: Set<any>, type: FilterType, binSize?: number): void {
    // If values is empty, remove the filter instead of creating an empty one
    if (values.size === 0) {
      debugLog('[FilterManager] Removing filter:', filterId)
      this.filters.delete(filterId)
    } else {
      debugLog('[FilterManager] Setting filter:', filterId, 'column:', column, 'type:', type, 'values:', Array.from(values), 'binSize:', binSize)
      this.filters.set(filterId, { id: filterId, column, type, values, behavior: 'toggle', binSize })
    }
    this.notifyObservers()
  }

  toggleFilterValue(filterId: string, value: any): void {
    const filter = this.filters.get(filterId)
    if (!filter) return

    if (filter.values.has(value)) {
      filter.values.delete(value)
      if (filter.values.size === 0) {
        this.filters.delete(filterId)
      }
    } else {
      filter.values.add(value)
    }

    this.notifyObservers()
  }

  clearFilter(filterId: string): void {
    this.filters.delete(filterId)
    this.notifyObservers()
  }

  clearAllFilters(): void {
    this.filters.clear()
    this.notifyObservers()
  }

  getFilters(): ReadonlyMap<string, Filter> {
    return this.filters
  }

  hasActiveFilters(): boolean {
    return this.filters.size > 0
  }

  /**
   * Build column indexes for O(1) categorical filter lookup.
   * Call this after data is loaded. The index maps each column's values
   * to the Set of row indices containing that value.
   *
   * Structure: column name -> normalized string value -> Set<row index>
   */
  buildIndex<T extends Record<string, any>>(data: T[]): void {
    this.indexedData = data
    this.columnIndex.clear()

    if (data.length === 0) return

    // Build index for all columns
    const columns = Object.keys(data[0])
    for (const col of columns) {
      const colMap = new Map<string, Set<number>>()
      for (let i = 0; i < data.length; i++) {
        const val = data[i][col]
        if (val !== null && val !== undefined) {
          const normalizedVal = String(val).toLowerCase()
          let indices = colMap.get(normalizedVal)
          if (!indices) {
            indices = new Set()
            colMap.set(normalizedVal, indices)
          }
          indices.add(i)
        }
      }
      this.columnIndex.set(col, colMap)
    }

    debugLog('[FilterManager] Built column index for', columns.length, 'columns,', data.length, 'rows')
  }

  /**
   * Apply filters to dataset (AND between filters, OR within values).
   * Uses indexed path when data matches indexed data for O(k) categorical lookups.
   * Falls back to linear scan for non-indexed data or binned filters.
   */
  applyFilters<T extends Record<string, any>>(data: T[]): T[] {
    if (this.filters.size === 0) return data

    // Use indexed path when data matches our indexed data
    if (data === this.indexedData && this.columnIndex.size > 0) {
      return this.applyFiltersIndexed(data)
    }

    // Fall back to existing linear scan
    return this.applyFiltersLinear(data)
  }

  /**
   * Get filtered data using centralized cache.
   * All cards should call this instead of applyFilters() directly
   * to avoid N-times multiplier (filter computed once, shared by all).
   */
  getFilteredData<T extends Record<string, any>>(data: T[], idColumn: string): T[] {
    if (this.cachedFilteredData === null) {
      this.cachedFilteredData = this.applyFilters(data)
      debugLog('[FilterManager] Cache miss - computed filtered data:', this.cachedFilteredData.length, 'rows')
    }
    return this.cachedFilteredData as T[]
  }

  /**
   * Get Set of filtered row IDs using centralized cache.
   * Built from getFilteredData() result - shares the same cache lifecycle.
   */
  getFilteredIds<T extends Record<string, any>>(data: T[], idColumn: string): Set<any> {
    if (this.cachedFilteredIds === null || this.cachedIdColumn !== idColumn) {
      const filtered = this.getFilteredData(data, idColumn)
      this.cachedFilteredIds = new Set(filtered.map((row: any) => row[idColumn]))
      this.cachedIdColumn = idColumn
      debugLog('[FilterManager] Cache miss - computed filtered IDs:', this.cachedFilteredIds.size)
    }
    return this.cachedFilteredIds
  }

  /**
   * Index-based filter application for O(k) categorical lookups.
   * Falls back to linear scan for binned filters within the indexed path.
   */
  private applyFiltersIndexed<T extends Record<string, any>>(data: T[]): T[] {
    let resultIndices: Set<number> | null = null

    for (const filter of this.filters.values()) {
      if (filter.type === 'binned' && filter.binSize) {
        // Binned filters can't use index - compute matching indices linearly
        const matchingIndices = new Set<number>()
        for (let i = 0; i < data.length; i++) {
          const numericValue = Number(data[i][filter.column])
          if (!isNaN(numericValue)) {
            for (const binStart of filter.values) {
              const binStartNum = Number(binStart)
              if (numericValue >= binStartNum && numericValue < binStartNum + filter.binSize) {
                matchingIndices.add(i)
                break
              }
            }
          }
        }
        resultIndices = resultIndices ? intersectSets(resultIndices, matchingIndices) : matchingIndices
      } else {
        // Categorical: use column index for O(1) per value lookup
        const colIndex = this.columnIndex.get(filter.column)
        if (!colIndex) {
          // Column not indexed, no matches possible
          return []
        }
        const matchingIndices = new Set<number>()
        for (const filterValue of filter.values) {
          const normalizedVal = String(filterValue).toLowerCase()

          // Direct lookup
          const indices = colIndex.get(normalizedVal)
          if (indices) {
            for (const idx of indices) matchingIndices.add(idx)
          }

          // Also check prefix patterns (e.g., "origin_55" matching column value "55")
          const prefixMatch = normalizedVal.match(/^([a-z]+_)(\d+)$/)
          if (prefixMatch) {
            const numericPart = prefixMatch[2]
            const numericIndices = colIndex.get(numericPart)
            if (numericIndices) {
              for (const idx of numericIndices) matchingIndices.add(idx)
            }
          }

          // Also check reverse prefix: column has "origin_55", filter has "55"
          // Iterate numeric-matching entries in the column index
          if (/^\d+$/.test(normalizedVal)) {
            for (const [indexKey, indexSet] of colIndex) {
              const cellPrefixMatch = indexKey.match(/^([a-z]+_)(\d+)$/)
              if (cellPrefixMatch && cellPrefixMatch[2] === normalizedVal) {
                for (const idx of indexSet) matchingIndices.add(idx)
              }
            }
          }
        }
        resultIndices = resultIndices ? intersectSets(resultIndices, matchingIndices) : matchingIndices
      }
    }

    if (!resultIndices || resultIndices.size === 0) return []
    return data.filter((_, i) => resultIndices!.has(i))
  }

  /**
   * Linear scan filter application (original algorithm).
   * Used as fallback when data is not indexed.
   */
  private applyFiltersLinear<T extends Record<string, any>>(data: T[]): T[] {
    // Debug: log first row and filter info
    if (data.length > 0) {
      const firstRow = data[0]
      for (const filter of this.filters.values()) {
        debugLog('[FilterManager] applyFiltersLinear - column:', filter.column,
          'filter values:', Array.from(filter.values),
          'first row value:', firstRow[filter.column],
          'first row keys:', Object.keys(firstRow).slice(0, 10))
      }
    }

    return data.filter(row => {
      // AND logic between different filters
      for (const filter of this.filters.values()) {
        const cellValue = row[filter.column]

        // OR logic within filter values
        let matches = false

        if (filter.type === 'binned' && filter.binSize) {
          // For binned filters, check if cell value falls within any selected bin
          const numericValue = Number(cellValue)
          if (!isNaN(numericValue)) {
            for (const binStart of filter.values) {
              const binStartNum = Number(binStart)
              if (numericValue >= binStartNum && numericValue < binStartNum + filter.binSize) {
                matches = true
                break
              }
            }
          }
        } else {
          // Regular categorical/exact matching
          for (const filterValue of filter.values) {
            if (this.valuesMatch(cellValue, filterValue)) {
              matches = true
              break
            }
          }
        }

        if (!matches) {
          return false
        }
      }
      return true
    })
  }

  /**
   * Compare two values with flexible matching for common data mismatches
   */
  private valuesMatch(cellValue: any, filterValue: any): boolean {
    // Exact match
    if (cellValue === filterValue) return true

    // Loose comparison for type mismatches (string "123" vs number 123)
    // eslint-disable-next-line eqeqeq
    if (cellValue == filterValue) return true

    // Handle prefix patterns like "origin_55" matching "55"
    // This is common in cluster/category IDs
    const cellStr = String(cellValue)
    const filterStr = String(filterValue)

    // Check if filter value has a prefix (e.g., "origin_55")
    const prefixMatch = filterStr.match(/^([a-zA-Z]+_)(\d+)$/)
    if (prefixMatch) {
      const numericPart = prefixMatch[2]
      // eslint-disable-next-line eqeqeq
      if (cellStr == numericPart) return true
    }

    // Check if cell value has a prefix
    const cellPrefixMatch = cellStr.match(/^([a-zA-Z]+_)(\d+)$/)
    if (cellPrefixMatch) {
      const numericPart = cellPrefixMatch[2]
      // eslint-disable-next-line eqeqeq
      if (filterStr == numericPart) return true
    }

    return false
  }

  private notifyObservers(): void {
    // Invalidate centralized cache on any filter change
    this.cachedFilteredData = null
    this.cachedFilteredIds = null
    this.cachedIdColumn = null
    this.filterVersion++

    this.observers.forEach(obs => obs.onFilterChange(this.filters))
  }
}
