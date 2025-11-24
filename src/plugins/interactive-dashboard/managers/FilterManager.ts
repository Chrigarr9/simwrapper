export type FilterType = 'categorical' | 'range' | 'time' | 'binned'

export interface Filter {
  id: string
  column: string
  type: FilterType
  values: Set<any>              // Selected values (OR logic within set)
  behavior: 'toggle' | 'replace'
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

  setFilter(filterId: string, column: string, values: Set<any>, type: FilterType): void {
    this.filters.set(filterId, { id: filterId, column, type, values, behavior: 'toggle' })
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

  /**
   * Apply filters to dataset (AND between filters, OR within values)
   */
  applyFilters<T extends Record<string, any>>(data: T[]): T[] {
    if (this.filters.size === 0) return data

    return data.filter(row => {
      // AND logic between different filters
      for (const filter of this.filters.values()) {
        const cellValue = row[filter.column]

        // OR logic within filter values
        if (!filter.values.has(cellValue)) {
          return false
        }
      }
      return true
    })
  }

  private notifyObservers(): void {
    this.observers.forEach(obs => obs.onFilterChange(this.filters))
  }
}
