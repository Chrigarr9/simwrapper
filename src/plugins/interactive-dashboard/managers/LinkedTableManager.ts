import Papa from '@simwrapper/papaparse'
import { debugLog } from '../utils/debug'

export interface LinkedTableConfig {
  name: string
  dataset: string
  idColumn: string
  linkColumn: string  // Column that links to parent table's idColumn
  visible?: boolean
  columns?: {
    show?: string[]
    hide?: string[]
    formats?: Record<string, any>
  }
}

export interface DataRow {
  [key: string]: any
}

/**
 * Manages a secondary table that is filtered by selection in a parent table.
 * Used for drill-down views like: Scenarios → Vehicles or Scenarios → Clusters
 */
export class LinkedTableManager {
  private data: DataRow[] = []
  private filteredData: DataRow[] = []
  private config: LinkedTableConfig
  private idColumn: string
  private linkColumn: string
  private parentSelectedIds: Set<any> = new Set()
  
  // Event listeners for data changes
  private listeners: Array<(data: DataRow[]) => void> = []

  constructor(config: LinkedTableConfig) {
    this.config = config
    this.idColumn = config.idColumn
    this.linkColumn = config.linkColumn
  }

  /**
   * Load CSV data from file
   */
  async loadData(fileService: any, subfolder: string): Promise<void> {
    const filepath = subfolder + '/' + this.config.dataset

    return new Promise((resolve, reject) => {
      fileService.getFileBlob(filepath).then((blob: Blob) => {
        Papa.parse(blob, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results: any) => {
            this.data = results.data
            debugLog(`[LinkedTableManager] Loaded ${this.data.length} rows from ${this.config.dataset}`)
            this.applyFilter()
            resolve()
          },
          error: reject,
        })
      }).catch(reject)
    })
  }

  /**
   * Get all unfiltered data
   */
  getAllData(): DataRow[] {
    return this.data
  }

  /**
   * Get filtered data (based on parent selection)
   */
  getFilteredData(): DataRow[] {
    return this.filteredData
  }

  /**
   * Get table configuration
   */
  getConfig(): LinkedTableConfig {
    return this.config
  }

  /**
   * Get the ID column name
   */
  getIdColumn(): string {
    return this.idColumn
  }

  /**
   * Get the link column name (for filtering by parent)
   */
  getLinkColumn(): string {
    return this.linkColumn
  }

  /**
   * Update filter based on parent table selection
   */
  setParentSelection(selectedIds: Set<any>): void {
    this.parentSelectedIds = selectedIds
    this.applyFilter()
    this.notifyListeners()
  }

  /**
   * Apply filter based on parent selection
   */
  private applyFilter(): void {
    if (this.parentSelectedIds.size === 0) {
      // No parent selection = show all data
      this.filteredData = [...this.data]
    } else {
      // Filter by link column matching parent selected IDs
      this.filteredData = this.data.filter(row => 
        this.parentSelectedIds.has(row[this.linkColumn])
      )
    }
    debugLog(`[LinkedTableManager] Filtered to ${this.filteredData.length} rows (parent selection: ${this.parentSelectedIds.size} ids)`)
  }

  /**
   * Get row by ID from filtered data
   */
  getRowById(id: any): DataRow | undefined {
    return this.filteredData.find(row => row[this.idColumn] === id)
  }

  /**
   * Get multiple rows by IDs from filtered data
   */
  getRowsByIds(ids: Set<any>): DataRow[] {
    return this.filteredData.filter(row => ids.has(row[this.idColumn]))
  }

  /**
   * Get unique values for a column from filtered data
   */
  getColumnValues(column: string): any[] {
    return Array.from(new Set(this.filteredData.map(row => row[column])))
  }

  /**
   * Add listener for data changes
   */
  addListener(callback: (data: DataRow[]) => void): void {
    this.listeners.push(callback)
  }

  /**
   * Remove listener
   */
  removeListener(callback: (data: DataRow[]) => void): void {
    this.listeners = this.listeners.filter(l => l !== callback)
  }

  /**
   * Notify all listeners of data change
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.filteredData))
  }
}
