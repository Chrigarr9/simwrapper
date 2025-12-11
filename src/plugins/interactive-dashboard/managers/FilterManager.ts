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

export class FilterManager {
  private filters: Map<string, Filter> = new Map()
  private observers: Set<FilterObserver> = new Set()

  addObserver(observer: FilterObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: FilterObserver): void {
    this.observers.delete(observer)
  }

  setFilter(filterId: string, column: string, values: Set<any>, type: FilterType, binSize?: number): void {
    // If values is empty, remove the filter instead of creating an empty one
    if (values.size === 0) {
      console.log('[FilterManager] Removing filter:', filterId)
      this.filters.delete(filterId)
    } else {
      console.log('[FilterManager] Setting filter:', filterId, 'column:', column, 'type:', type, 'values:', Array.from(values), 'binSize:', binSize)
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
   * Apply filters to dataset (AND between filters, OR within values)
   */
  applyFilters<T extends Record<string, any>>(data: T[]): T[] {
    if (this.filters.size === 0) return data

    // Debug: log first row and filter info
    if (data.length > 0) {
      const firstRow = data[0]
      for (const filter of this.filters.values()) {
        console.log('[FilterManager] applyFilters - column:', filter.column,
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
    this.observers.forEach(obs => obs.onFilterChange(this.filters))
  }
}
