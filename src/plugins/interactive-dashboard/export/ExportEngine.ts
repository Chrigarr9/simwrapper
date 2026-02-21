import YAML from 'yaml'
import Papa from '@simwrapper/papaparse'

import type {
  ExportConfig,
  ExportFormat,
  FilterDef,
  ResolvedPlotExport,
} from '../types/exportConfig'
import { EXPORT_DEFAULTS } from '../types/exportConfig'
import type { ExportResult } from '../types/export'
import { FilterManager } from '../managers/FilterManager'
import { StyleManager } from '../managers/StyleManager'

/**
 * Resolve an ExportConfig into a flat list of ResolvedPlotExport items.
 * Applies the cascade: EXPORT_DEFAULTS → config.defaults → state → plot.
 */
export function resolveExportPlan(config: ExportConfig): ResolvedPlotExport[] {
  const plan: ResolvedPlotExport[] = []
  const globalDefaults = { ...EXPORT_DEFAULTS, ...config.defaults }
  const namingPattern = config.output?.naming ?? '{state}-{plot}'

  for (const [stateId, stateDef] of Object.entries(config.states)) {
    for (const plotId of stateDef.export) {
      const plotDef = config.plots[plotId]
      if (!plotDef) {
        throw new Error(
          `Export config error: plot "${plotId}" referenced in state "${stateId}" is not defined in plots section`
        )
      }

      // Cascade: defaults → state → plot
      const format: ExportFormat = plotDef.format ?? stateDef.format ?? globalDefaults.format
      const width = plotDef.width ?? stateDef.width ?? globalDefaults.width
      const height = plotDef.height ?? stateDef.height ?? globalDefaults.height
      const scale = plotDef.scale ?? stateDef.scale ?? globalDefaults.scale
      const scientific = globalDefaults.scientific // Scientific is global only
      const colorBy = plotDef.colorBy ?? stateDef.colorBy ?? globalDefaults.colorBy

      const filename = namingPattern.replace('{state}', stateId).replace('{plot}', plotId)

      plan.push({
        plotId,
        stateId,
        filename,
        format,
        width,
        height,
        scale,
        scientific,
        colorBy,
        comparison: stateDef.comparison ?? false,
        filters: stateDef.filters ?? {},
        plotDef,
      })
    }
  }

  return plan
}

// -- ExportEngine class --

export type ExportStatus =
  | 'idle'
  | 'loading'
  | 'rendering'
  | 'capturing'
  | 'packaging'
  | 'complete'
  | 'error'
  | 'cancelled'

export interface ExportProgress {
  status: ExportStatus
  currentState: string
  currentPlot: string
  completedCount: number
  totalCount: number
  completedItems: Array<{ filename: string; success: boolean; error?: string }>
  error?: string
}

export type ProgressCallback = (progress: ExportProgress) => void

/**
 * ExportEngine orchestrates the full export pipeline.
 *
 * Usage:
 *   const engine = new ExportEngine()
 *   engine.onProgress(callback)
 *   await engine.run(yamlText, renderFn, loadFile)
 */
export class ExportEngine {
  private progressCallbacks: ProgressCallback[] = []
  private cancelled = false
  private progress: ExportProgress = {
    status: 'idle',
    currentState: '',
    currentPlot: '',
    completedCount: 0,
    totalCount: 0,
    completedItems: [],
  }

  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback)
  }

  cancel(): void {
    this.cancelled = true
  }

  /**
   * Parse YAML text into ExportConfig and resolve the export plan.
   */
  parseConfig(yamlText: string): { config: ExportConfig; plan: ResolvedPlotExport[] } {
    const config = YAML.parse(yamlText) as ExportConfig
    if (!config.table?.file) throw new Error('Export config must specify table.file')
    if (!config.plots || Object.keys(config.plots).length === 0)
      throw new Error('Export config must define at least one plot')
    if (!config.states || Object.keys(config.states).length === 0)
      throw new Error('Export config must define at least one state')

    const plan = resolveExportPlan(config)
    return { config, plan }
  }

  /**
   * Load CSV data from a Blob or text string.
   */
  async loadData(source: Blob | string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(source, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results: any) => resolve(results.data),
        error: reject,
      })
    })
  }

  /**
   * Apply YAML filter definitions to a FilterManager instance.
   *
   * Translates the YAML filter syntax into FilterManager.setFilter() calls:
   * - String value → categorical filter with single value
   * - Array → categorical filter with multiple values
   * - { min, max } → range filter via matching values from data
   */
  applyFilters(
    filterManager: FilterManager,
    filters: Record<string, FilterDef>,
    data: any[]
  ): void {
    filterManager.clearAllFilters()

    for (const [column, filterDef] of Object.entries(filters)) {
      if (typeof filterDef === 'string') {
        // Single categorical value
        filterManager.setFilter(`export-${column}`, column, new Set([filterDef]), 'categorical')
      } else if (Array.isArray(filterDef)) {
        // Multiple categorical values
        filterManager.setFilter(`export-${column}`, column, new Set(filterDef), 'categorical')
      } else if (typeof filterDef === 'object' && filterDef !== null) {
        // Numeric range filter: find matching values from data
        const { min, max } = filterDef
        const matchingValues = new Set<any>()
        for (const row of data) {
          const val = row[column]
          if (val === null || val === undefined) continue
          if (min !== undefined && val < min) continue
          if (max !== undefined && val > max) continue
          matchingValues.add(val)
        }
        if (matchingValues.size > 0) {
          filterManager.setFilter(`export-${column}`, column, matchingValues, 'range')
        }
      }
    }
  }

  /**
   * Run the full export pipeline.
   *
   * @param yamlText - Raw YAML config text
   * @param renderAndCapture - Callback that renders a card and returns capture result.
   *   Provided by ExportView which handles DOM mounting.
   * @param loadFile - Callback to load a file by path (provided by the Vue component
   *   which has access to HTTPFileSystem)
   */
  async run(
    yamlText: string,
    renderAndCapture: (
      item: ResolvedPlotExport,
      filteredData: any[],
      baselineData: any[]
    ) => Promise<ExportResult>,
    loadFile: (path: string) => Promise<Blob>
  ): Promise<ExportResult[]> {
    this.cancelled = false
    const results: ExportResult[] = []

    try {
      // Parse config
      this.updateProgress({ status: 'loading', currentState: '', currentPlot: '' })
      const { config, plan } = this.parseConfig(yamlText)
      this.updateProgress({ totalCount: plan.length })

      // Load data
      const blob = await loadFile(config.table.file)
      const allData = await this.loadData(blob)

      // Set scientific mode if configured
      const scientific = config.defaults?.scientific ?? true
      if (scientific) {
        StyleManager.getInstance().setMode('scientific')
      }

      // Create a FilterManager for export and build indexes
      const filterManager = new FilterManager()
      filterManager.buildIndex(allData)

      // Group plan items by state to minimize filter changes
      const stateGroups = new Map<string, ResolvedPlotExport[]>()
      for (const item of plan) {
        const group = stateGroups.get(item.stateId) || []
        group.push(item)
        stateGroups.set(item.stateId, group)
      }

      // Process each state
      for (const [stateId, items] of stateGroups) {
        if (this.cancelled) break

        this.updateProgress({ status: 'rendering', currentState: stateId })

        // Apply filters for this state (all items in a state share the same filters)
        const stateFilters = items[0].filters
        this.applyFilters(filterManager, stateFilters, allData)

        // Get filtered data
        const idColumn = config.table.idColumn || 'id'
        const filteredData = filterManager.hasActiveFilters()
          ? filterManager.getFilteredData(allData, idColumn)
          : allData
        const baselineData = allData

        // Render and capture each plot in this state
        for (const item of items) {
          if (this.cancelled) break

          this.updateProgress({ currentPlot: item.plotId, status: 'capturing' })

          try {
            const result = await renderAndCapture(item, filteredData, baselineData)
            result.filename = item.filename
            results.push(result)
            this.progress.completedItems.push({
              filename: `${item.filename}.${item.format}`,
              success: true,
            })
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            this.progress.completedItems.push({
              filename: `${item.filename}.${item.format}`,
              success: false,
              error: errMsg,
            })
            console.error(`[ExportEngine] Failed to export ${item.filename}:`, error)
          }

          this.updateProgress({ completedCount: this.progress.completedCount + 1 })
        }
      }

      if (this.cancelled) {
        this.updateProgress({ status: 'cancelled' })
        return results
      }

      this.updateProgress({ status: 'packaging' })
      this.updateProgress({ status: 'complete' })
      return results
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      this.updateProgress({ status: 'error', error: errMsg })
      throw error
    }
  }

  private updateProgress(partial: Partial<ExportProgress>): void {
    Object.assign(this.progress, partial)
    for (const cb of this.progressCallbacks) {
      cb({ ...this.progress })
    }
  }
}
