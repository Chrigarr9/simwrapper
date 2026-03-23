import Papa from '@simwrapper/papaparse'

export interface TableConfig {
  name: string
  dataset: string
  idColumn: string
  visible: boolean
  columns?: {
    hide?: string[]
    formats?: Record<string, any>
  }
}

export interface DataRow {
  [key: string]: any
}

export class DataTableManager {
  private data: DataRow[] = []
  private config: TableConfig
  private idColumn: string
  private sortedCategoricalValuesCache: Map<string, string[]> = new Map()

  constructor(config: TableConfig) {
    this.config = config
    this.idColumn = config.idColumn
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
            resolve()
          },
          error: reject,
        })
      }).catch(reject)
    })
  }

  /**
   * Get all data
   */
  getData(): DataRow[] {
    return this.data
  }

  /**
   * Set data directly (used when data is preloaded/prefiltered)
   */
  setData(data: DataRow[]): void {
    this.data = data
    // Clear cache when data changes
    this.sortedCategoricalValuesCache.clear()
  }

  /**
   * Get row by ID
   */
  getRowById(id: any): DataRow | undefined {
    return this.data.find(row => row[this.idColumn] === id)
  }

  /**
   * Get multiple rows by IDs
   */
  getRowsByIds(ids: Set<any>): DataRow[] {
    return this.data.filter(row => ids.has(row[this.idColumn]))
  }

  /**
   * Get unique column values
   */
  getColumnValues(column: string): any[] {
    return Array.from(new Set(this.data.map(row => row[column])))
  }

  /**
   * Get table configuration
   */
  getConfig(): TableConfig {
    return this.config
  }

  /**
   * Get ID column name
   */
  getIdColumn(): string {
    return this.idColumn
  }

  /**
   * Get sorted unique categorical values for a column
   * Results are cached for performance and cleared when data changes
   *
   * @param column - Column name to get unique values from
   * @returns Alphabetically sorted array of unique string values
   */
  getSortedCategoricalValues(column: string): string[] {
    // Check cache first
    if (this.sortedCategoricalValuesCache.has(column)) {
      return this.sortedCategoricalValuesCache.get(column)!
    }

    // Compute sorted unique values
    const uniqueValues = new Set<string>()
    this.data.forEach(row => {
      const value = row[column]
      if (value !== null && value !== undefined) {
        uniqueValues.add(String(value))
      }
    })

    const sortedValues = Array.from(uniqueValues).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    )

    // Cache and return
    this.sortedCategoricalValuesCache.set(column, sortedValues)
    return sortedValues
  }
}
