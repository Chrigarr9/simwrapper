# Headless Export System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a YAML-driven batch export system that renders interactive dashboard plots as static images for dissertations and presentations, with both UI and CLI entry points.

**Architecture:** Self-contained export YAML defines data, plots, filter states, and output settings. An ExportEngine (TypeScript class) parses config, applies states via FilterManager, renders cards in a visible container, captures output via existing Plotly/deck.gl export APIs. ExportView.vue provides progress UI. A Playwright CLI script wraps the whole thing for headless automation.

**Tech Stack:** Vue 2.7 (Composition API), TypeScript, Playwright, Vite createServer API, existing FilterManager/StyleManager/DataTableManager, Plotly.toImage(), JSZip.

---

## Task 1: Export Config Types

**Files:**
- Create: `src/plugins/interactive-dashboard/types/exportConfig.ts`
- Test: `src/plugins/interactive-dashboard/managers/__tests__/exportConfig.test.ts`

**Step 1: Write the type definitions**

The export YAML has a specific structure. Define TypeScript interfaces matching it.

```typescript
// src/plugins/interactive-dashboard/types/exportConfig.ts

/**
 * Export configuration loaded from a YAML file.
 * Self-contained: defines data source, plots, states, and output settings.
 */

/** Supported export card types (maps to panelLookup keys in _allPanels.ts) */
export type ExportCardType = 'histogram' | 'pie-chart' | 'scatter-plot' | 'map' | 'correlation-matrix' | 'timeline'

/** Export image format */
export type ExportFormat = 'png' | 'svg'

/** Filter definition for a single column */
export type FilterDef =
  | string                              // Categorical: single value, e.g. "car"
  | string[]                            // Categorical: multiple values, e.g. ["car", "pt"]
  | { min?: number; max?: number }      // Numeric range

/** Global default settings (inherited by states and plots) */
export interface ExportDefaults {
  format?: ExportFormat
  width?: number
  height?: number
  scale?: number
  scientific?: boolean
  colorBy?: string
}

/** Plot definition */
export interface ExportPlotDef {
  type: ExportCardType
  title?: string
  // Histogram-specific
  column?: string
  bins?: number
  binSize?: number
  // Scatter-specific
  x?: string
  y?: string
  xColumn?: string
  yColumn?: string
  colorBy?: string
  // Map-specific
  layers?: any[]
  center?: [number, number]
  zoom?: number
  mapStyle?: string
  // Correlation-specific
  attributes?: string[]
  // Per-plot export overrides
  format?: ExportFormat
  width?: number
  height?: number
  scale?: number
  // Axis limits
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  autoTrim?: boolean
}

/** State definition: filter context + which plots to export */
export interface ExportStateDef {
  filters?: Record<string, FilterDef>
  colorBy?: string
  comparison?: boolean
  export: string[]              // References to plot IDs defined in `plots`
  // State-level export overrides
  format?: ExportFormat
  width?: number
  height?: number
  scale?: number
}

/** Output configuration */
export interface ExportOutputConfig {
  directory?: string            // Default: './export'
  naming?: string               // Default: '{state}-{plot}'
}

/** Table (data source) configuration */
export interface ExportTableConfig {
  file: string                  // CSV file path (relative to YAML location)
  idColumn?: string             // ID column name
}

/** Complete export configuration (root of the YAML) */
export interface ExportConfig {
  table: ExportTableConfig
  defaults?: ExportDefaults
  plots: Record<string, ExportPlotDef>
  states: Record<string, ExportStateDef>
  output?: ExportOutputConfig
}

/** Resolved settings for a single plot export (after cascading defaults) */
export interface ResolvedPlotExport {
  plotId: string
  stateId: string
  filename: string
  format: ExportFormat
  width: number
  height: number
  scale: number
  scientific: boolean
  colorBy: string
  comparison: boolean
  filters: Record<string, FilterDef>
  plotDef: ExportPlotDef
}

/** Default values for export settings */
export const EXPORT_DEFAULTS: Required<ExportDefaults> = {
  format: 'png',
  width: 1200,
  height: 800,
  scale: 2,
  scientific: true,
  colorBy: '',
}
```

**Step 2: Write tests for config parsing and resolution**

```typescript
// src/plugins/interactive-dashboard/managers/__tests__/exportConfig.test.ts
import { describe, it, expect } from 'vitest'
import { resolveExportPlan } from '../../export/ExportEngine'
import type { ExportConfig } from '../../types/exportConfig'

describe('Export Config Resolution', () => {
  const minimalConfig: ExportConfig = {
    table: { file: 'data.csv' },
    plots: {
      'hist-dist': { type: 'histogram', column: 'distance', bins: 20 },
    },
    states: {
      'all': { export: ['hist-dist'] },
    },
  }

  it('should apply global defaults when no overrides', () => {
    const plan = resolveExportPlan(minimalConfig)
    expect(plan).toHaveLength(1)
    expect(plan[0].width).toBe(1200)
    expect(plan[0].height).toBe(800)
    expect(plan[0].scale).toBe(2)
    expect(plan[0].format).toBe('png')
    expect(plan[0].scientific).toBe(true)
  })

  it('should cascade defaults → state → plot overrides', () => {
    const config: ExportConfig = {
      table: { file: 'data.csv' },
      defaults: { width: 1000, format: 'svg' },
      plots: {
        'hist': { type: 'histogram', column: 'distance', width: 800 },
      },
      states: {
        'filtered': {
          format: 'png',       // State overrides defaults
          export: ['hist'],
        },
      },
    }
    const plan = resolveExportPlan(config)
    expect(plan[0].width).toBe(800)     // Plot-level wins
    expect(plan[0].format).toBe('png')  // State-level wins over defaults
  })

  it('should generate correct filenames from state-plot pattern', () => {
    const plan = resolveExportPlan(minimalConfig)
    expect(plan[0].filename).toBe('all-hist-dist')
    expect(plan[0].stateId).toBe('all')
    expect(plan[0].plotId).toBe('hist-dist')
  })

  it('should resolve filters from state', () => {
    const config: ExportConfig = {
      table: { file: 'data.csv' },
      plots: { 'hist': { type: 'histogram', column: 'distance' } },
      states: {
        'long': {
          filters: { distance: { min: 5000 } },
          export: ['hist'],
        },
      },
    }
    const plan = resolveExportPlan(config)
    expect(plan[0].filters).toEqual({ distance: { min: 5000 } })
  })

  it('should throw on missing plot reference', () => {
    const config: ExportConfig = {
      table: { file: 'data.csv' },
      plots: {},
      states: {
        'all': { export: ['nonexistent'] },
      },
    }
    expect(() => resolveExportPlan(config)).toThrow(/nonexistent/)
  })
})
```

**Step 3: Run test to verify it fails**

Run: `npm run test:run -- --reporter verbose src/plugins/interactive-dashboard/managers/__tests__/exportConfig.test.ts`
Expected: FAIL with "Cannot find module '../../export/ExportEngine'"

**Step 4: Implement `resolveExportPlan` in ExportEngine**

This is the config resolution function. The rest of ExportEngine comes in Task 2.

```typescript
// src/plugins/interactive-dashboard/export/ExportEngine.ts

import type {
  ExportConfig,
  ExportDefaults,
  ExportPlotDef,
  ExportStateDef,
  ResolvedPlotExport,
  FilterDef,
  ExportFormat,
  EXPORT_DEFAULTS,
} from '../types/exportConfig'
import { EXPORT_DEFAULTS as defaults } from '../types/exportConfig'

/**
 * Resolve an ExportConfig into a flat list of ResolvedPlotExport items.
 * Applies the cascade: EXPORT_DEFAULTS → config.defaults → state → plot.
 */
export function resolveExportPlan(config: ExportConfig): ResolvedPlotExport[] {
  const plan: ResolvedPlotExport[] = []
  const globalDefaults = { ...defaults, ...config.defaults }
  const namingPattern = config.output?.naming ?? '{state}-{plot}'

  for (const [stateId, stateDef] of Object.entries(config.states)) {
    for (const plotId of stateDef.export) {
      const plotDef = config.plots[plotId]
      if (!plotDef) {
        throw new Error(`Export config error: plot "${plotId}" referenced in state "${stateId}" is not defined in plots section`)
      }

      // Cascade: defaults → state → plot
      const format: ExportFormat = plotDef.format ?? stateDef.format ?? globalDefaults.format
      const width = plotDef.width ?? stateDef.width ?? globalDefaults.width
      const height = plotDef.height ?? stateDef.height ?? globalDefaults.height
      const scale = plotDef.scale ?? stateDef.scale ?? globalDefaults.scale
      const scientific = globalDefaults.scientific   // Scientific is global only
      const colorBy = plotDef.colorBy ?? stateDef.colorBy ?? globalDefaults.colorBy

      const filename = namingPattern
        .replace('{state}', stateId)
        .replace('{plot}', plotId)

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
```

**Step 5: Run test to verify it passes**

Run: `npm run test:run -- --reporter verbose src/plugins/interactive-dashboard/managers/__tests__/exportConfig.test.ts`
Expected: All 5 tests PASS

**Step 6: Commit**

```bash
git add src/plugins/interactive-dashboard/types/exportConfig.ts src/plugins/interactive-dashboard/export/ExportEngine.ts src/plugins/interactive-dashboard/managers/__tests__/exportConfig.test.ts
git commit -m "feat(export): add export config types and resolution logic"
```

---

## Task 2: ExportEngine - Core Logic

**Files:**
- Modify: `src/plugins/interactive-dashboard/export/ExportEngine.ts`
- Test: `src/plugins/interactive-dashboard/managers/__tests__/ExportEngine.test.ts`

The ExportEngine orchestrates the full export pipeline. It provides progress callbacks so the UI can display status.

**Step 1: Write the ExportEngine class**

Add to the existing `ExportEngine.ts` file (after the `resolveExportPlan` function):

```typescript
// Add these imports at the top of ExportEngine.ts
import YAML from 'yaml'
import Papa from '@simwrapper/papaparse'
import { FilterManager } from '../managers/FilterManager'
import { DataTableManager } from '../managers/DataTableManager'
import { StyleManager } from '../managers/StyleManager'
import { exportPlotlyChart, exportAllChartsAsZip } from '../utils/exportUtils'
import type { ExportResult } from '../types/export'
import type { ExportConfig, ResolvedPlotExport, FilterDef } from '../types/exportConfig'

export type ExportStatus = 'idle' | 'loading' | 'rendering' | 'capturing' | 'packaging' | 'complete' | 'error' | 'cancelled'

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
 *   await engine.run(yamlText, renderFn)
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
    if (!config.plots || Object.keys(config.plots).length === 0) throw new Error('Export config must define at least one plot')
    if (!config.states || Object.keys(config.states).length === 0) throw new Error('Export config must define at least one state')

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
   * - { min, max } → range filter via binned type
   */
  applyFilters(filterManager: FilterManager, filters: Record<string, FilterDef>, data: any[]): void {
    filterManager.clearAllFilters()

    for (const [column, filterDef] of Object.entries(filters)) {
      if (typeof filterDef === 'string') {
        // Single categorical value
        filterManager.setFilter(
          `export-${column}`,
          column,
          new Set([filterDef]),
          'categorical'
        )
      } else if (Array.isArray(filterDef)) {
        // Multiple categorical values
        filterManager.setFilter(
          `export-${column}`,
          column,
          new Set(filterDef),
          'categorical'
        )
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
          filterManager.setFilter(
            `export-${column}`,
            column,
            matchingValues,
            'range'
          )
        }
      }
    }
  }

  /**
   * Run the full export pipeline.
   *
   * @param yamlText - Raw YAML config text
   * @param renderAndCapture - Callback that renders a card and returns capture result.
   *   This is provided by ExportView which handles the DOM mounting.
   * @param loadFile - Callback to load a file by path (provided by the Vue component
   *   which has access to HTTPFileSystem)
   */
  async run(
    yamlText: string,
    renderAndCapture: (item: ResolvedPlotExport, filteredData: any[], baselineData: any[]) => Promise<ExportResult>,
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

      // Create a FilterManager for export
      const filterManager = new FilterManager()
      // Build column indexes for efficient filtering
      filterManager.buildColumnIndexes(allData)

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

        // Apply filters for this state
        const stateFilters = items[0].filters  // All items in a state share the same filters
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
            // Override filename with our resolved name
            result.filename = item.filename
            results.push(result)
            this.progress.completedItems.push({ filename: `${item.filename}.${item.format}`, success: true })
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error)
            this.progress.completedItems.push({ filename: `${item.filename}.${item.format}`, success: false, error: errMsg })
            console.error(`[ExportEngine] Failed to export ${item.filename}:`, error)
          }

          this.updateProgress({ completedCount: this.progress.completedCount + 1 })
        }
      }

      if (this.cancelled) {
        this.updateProgress({ status: 'cancelled' })
        return results
      }

      // Package results
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
```

**Step 2: Write tests for ExportEngine filter application**

```typescript
// src/plugins/interactive-dashboard/managers/__tests__/ExportEngine.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ExportEngine } from '../../export/ExportEngine'
import { FilterManager } from '../FilterManager'

describe('ExportEngine', () => {
  let engine: ExportEngine

  beforeEach(() => {
    engine = new ExportEngine()
  })

  describe('parseConfig', () => {
    it('should parse valid YAML and resolve plan', () => {
      const yaml = `
table:
  file: data.csv
plots:
  hist:
    type: histogram
    column: distance
states:
  all:
    export: [hist]
`
      const { config, plan } = engine.parseConfig(yaml)
      expect(config.table.file).toBe('data.csv')
      expect(plan).toHaveLength(1)
      expect(plan[0].plotId).toBe('hist')
    })

    it('should throw on missing table', () => {
      const yaml = `
plots:
  hist:
    type: histogram
states:
  all:
    export: [hist]
`
      expect(() => engine.parseConfig(yaml)).toThrow(/table.file/)
    })
  })

  describe('applyFilters', () => {
    const testData = [
      { id: 1, mode: 'car', distance: 1000 },
      { id: 2, mode: 'pt', distance: 5000 },
      { id: 3, mode: 'bike', distance: 2000 },
      { id: 4, mode: 'car', distance: 8000 },
    ]

    it('should apply categorical filter (single value)', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { mode: 'car' }, testData)
      expect(fm.hasActiveFilters()).toBe(true)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(2)
      expect(filtered.every(r => r.mode === 'car')).toBe(true)
    })

    it('should apply categorical filter (array)', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { mode: ['car', 'pt'] }, testData)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(3)
    })

    it('should apply numeric range filter', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { distance: { min: 3000 } }, testData)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(2)
      expect(filtered.every(r => r.distance >= 3000)).toBe(true)
    })

    it('should apply numeric range filter with min and max', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { distance: { min: 1500, max: 6000 } }, testData)
      const filtered = fm.getFilteredData(testData, 'id')
      expect(filtered).toHaveLength(2)
    })

    it('should clear previous filters before applying new ones', () => {
      const fm = new FilterManager()
      engine.applyFilters(fm, { mode: 'car' }, testData)
      expect(fm.hasActiveFilters()).toBe(true)
      engine.applyFilters(fm, {}, testData)
      expect(fm.hasActiveFilters()).toBe(false)
    })
  })

  describe('progress tracking', () => {
    it('should call progress callbacks', () => {
      const updates: any[] = []
      engine.onProgress(p => updates.push({ ...p }))

      // parseConfig triggers no progress, but we can test the callback mechanism
      expect(updates).toHaveLength(0)
    })
  })
})
```

**Step 3: Run tests**

Run: `npm run test:run -- --reporter verbose src/plugins/interactive-dashboard/managers/__tests__/ExportEngine.test.ts`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/plugins/interactive-dashboard/export/ExportEngine.ts src/plugins/interactive-dashboard/managers/__tests__/ExportEngine.test.ts
git commit -m "feat(export): add ExportEngine with filter application and progress tracking"
```

---

## Task 3: ExportView Component

**Files:**
- Create: `src/plugins/interactive-dashboard/export/ExportView.vue`

This is the visible UI component that renders cards and shows export progress. It uses the ExportEngine and dynamically mounts card components.

**Step 1: Create ExportView.vue**

```pug
// Template (Pug)
.export-view
  .export-header
    h2 {{ progress.status === 'complete' ? 'Export Complete' : 'Exporting Dashboard' }}

  //- Render container: card renders here at export dimensions
  .render-container(v-if="progress.status === 'rendering' || progress.status === 'capturing'"
    :style="renderContainerStyle"
  )
    .render-label Rendering: {{ progress.currentPlot }}
    .render-target(ref="renderTarget")
      component(
        v-if="currentCardComponent && currentCardProps"
        :is="currentCardComponent"
        v-bind="currentCardProps"
        @isLoaded="handleCardLoaded"
      )

  //- Progress panel
  .progress-panel
    .progress-state(v-if="progress.currentState")
      span.state-label State: {{ progress.currentState }}

    .progress-items
      .progress-item(v-for="item in progress.completedItems" :key="item.filename"
        :class="{ success: item.success, failed: !item.success }"
      )
        i.fa(:class="item.success ? 'fa-check' : 'fa-times'")
        span {{ item.filename }}
        span.error-msg(v-if="item.error") {{ item.error }}

      .progress-item.current(v-if="progress.status === 'capturing'")
        i.fa.fa-spinner.fa-spin
        span {{ progress.currentPlot }} (rendering...)

    .progress-bar-container(v-if="progress.totalCount > 0")
      .progress-text Progress: {{ progress.completedCount }} / {{ progress.totalCount }}
      .progress-bar
        .progress-fill(:style="{ width: progressPercent + '%' }")

  //- Actions
  .export-actions
    button.btn-cancel(v-if="progress.status !== 'complete' && progress.status !== 'error'"
      @click="handleCancel"
    ) Cancel

    template(v-if="progress.status === 'complete'")
      button.btn-download(@click="downloadResults") Download ZIP
      button.btn-close(@click="handleClose") Close

    .error-message(v-if="progress.status === 'error'")
      p Error: {{ progress.error }}
      button.btn-close(@click="handleClose") Close
```

The `<script>` section will:
1. Accept an `exportYaml` prop (the YAML text to process) and a `fileLoader` prop (function to load files)
2. Create an ExportEngine instance
3. On mount, call `engine.run()` with a `renderAndCapture` callback
4. The `renderAndCapture` callback dynamically sets `currentCardComponent` and `currentCardProps`, waits for render, captures via export utils
5. After completion, package results via `exportAllChartsAsZip()`
6. Set `window.__exportComplete = true` for Playwright detection

Key implementation detail: the `renderAndCapture` function returns a Promise that resolves when the card signals it's loaded (via `@isLoaded` event). It then uses `Plotly.toImage()` or `canvas.toDataURL()` to capture the rendered output.

**Card type → component mapping** (from `src/dash-panels/_allPanels.ts`):
- `histogram` → `HistogramCard` at `@/plugins/interactive-dashboard/components/cards/HistogramCard.vue`
- `pie-chart` → `PieChartCard` at `@/plugins/interactive-dashboard/components/cards/PieChartCard.vue`
- `scatter-plot` → `ScatterCard` at `@/plugins/interactive-dashboard/components/cards/ScatterCard.vue`
- `map` → `MapCard` at `@/plugins/interactive-dashboard/components/cards/MapCard.vue`

**Step 2: Wire up the component logic**

The script setup uses Composition API with these refs:
- `renderTarget` - template ref for the render container
- `currentCardComponent` - dynamic component name
- `currentCardProps` - props to pass to the card
- `progress` - reactive progress state from ExportEngine
- `exportResults` - collected ExportResult[] for final ZIP

The `renderAndCapture` function:
1. Sets `currentCardComponent` to the appropriate component
2. Maps `ResolvedPlotExport.plotDef` to card props (column, bins, xColumn, yColumn, etc.)
3. Passes `filteredData` and `baselineData` as props
4. Returns a Promise that resolves after a `nextTick` + delay (for Plotly render time)
5. Finds the Plotly element via `renderTarget.querySelector('.js-plotly-plot')` or canvas for maps
6. Calls `exportPlotlyChart()` or captures canvas

**Step 3: Commit**

```bash
git add src/plugins/interactive-dashboard/export/ExportView.vue
git commit -m "feat(export): add ExportView component with progress UI and card rendering"
```

---

## Task 4: Export Route

**Files:**
- Modify: `src/router.ts` (add route before wildcard catch-all)
- Create: `src/plugins/interactive-dashboard/export/ExportPage.vue` (wrapper that loads YAML and initializes ExportView)

**Step 1: Create ExportPage.vue**

This is a thin wrapper page that:
1. Reads the `config` query parameter from the URL
2. Resolves the file path via HTTPFileSystem (same pattern as TabbedDashboardView)
3. Loads the export YAML file
4. Passes it to ExportView

```pug
.export-page
  .loading(v-if="isLoading")
    i.fa.fa-spinner.fa-spin
    span Loading export configuration...

  export-view(
    v-if="yamlText && !isLoading"
    :export-yaml="yamlText"
    :file-loader="loadFile"
    :subfolder="subfolder"
    @complete="handleComplete"
    @close="handleClose"
  )

  .error(v-if="loadError")
    h3 Failed to load export configuration
    p {{ loadError }}
```

Script: reads `this.$route.query.config` and `this.$route.query.root` / `this.$route.query.subfolder`, creates an HTTPFileSystem, loads the YAML file.

**Step 2: Add route to router.ts**

Insert before the wildcard route (line 51 in `src/router.ts`):

```typescript
{
  path: BASE_URL + 'export',
  component: () => import('@/plugins/interactive-dashboard/export/ExportPage.vue'),
  props: (route: Route) => ({
    configPath: route.query.config as string,
    root: route.query.root as string,
    subfolder: route.query.subfolder as string,
  }),
},
```

**Step 3: Commit**

```bash
git add src/plugins/interactive-dashboard/export/ExportPage.vue src/router.ts
git commit -m "feat(export): add /export route and ExportPage wrapper component"
```

---

## Task 5: ExportButton Dropdown in Dashboard Toolbar

**Files:**
- Create: `src/plugins/interactive-dashboard/export/ExportButton.vue`
- Modify: `src/plugins/interactive-dashboard/InteractiveDashboard.vue` (replace or augment ExportAllButton)

**Step 1: Create ExportButton.vue**

A dropdown button that:
- Shows "Export" with a dropdown chevron
- Lists export configs from the dashboard YAML's `export` section
- Has "Export Current View" (same as existing ExportAllButton behavior)
- Has "Upload Export Config..." option
- Selecting a config opens ExportView as a fullscreen overlay

```pug
.export-dropdown
  button.btn-export(@click="toggleDropdown" ref="dropdownButton")
    i.fa.fa-download
    span Export
    i.fa.fa-chevron-down.chevron

  .dropdown-menu(v-if="isOpen" ref="dropdownMenu")
    //- Export current view (same as old ExportAllButton)
    .dropdown-item(@click="exportCurrentView")
      i.fa.fa-camera
      span Export Current View

    .dropdown-divider(v-if="exportConfigs.length > 0")

    //- Export configs from YAML
    .dropdown-item(v-for="config in exportConfigs" :key="config.file"
      @click="runExportConfig(config)"
    )
      i.fa.fa-file-export
      span {{ config.label || config.file }}

    .dropdown-divider

    //- Upload option
    .dropdown-item(@click="uploadConfig")
      i.fa.fa-upload
      span Upload Export Config...
    input.hidden-input(ref="fileInput" type="file" accept=".yaml,.yml" @change="handleFileUpload")

  //- Fullscreen overlay for ExportView
  .export-overlay(v-if="showExportView")
    export-view(
      :export-yaml="activeYaml"
      :file-loader="fileLoader"
      :subfolder="subfolder"
      @complete="handleExportComplete"
      @close="showExportView = false"
    )
```

**Step 2: Integrate into InteractiveDashboard.vue**

In the template, replace the existing `export-all-button` usage (around line 29-34) with the new `ExportButton`:

```pug
export-button(
  :export-configs="yaml.export || []"
  :dashboard-title="title"
  :file-loader="loadFileForExport"
  :subfolder="xsubfolder"
  :file-system-config="fileSystemConfig"
)
```

Add the import and component registration:
```typescript
import ExportButton from './export/ExportButton.vue'
// In components:
components: Object.assign({ ..., ExportButton }, namedCharts),
```

Add a method to InteractiveDashboard for loading files:
```typescript
async loadFileForExport(path: string): Promise<Blob> {
  const filepath = this.xsubfolder + '/' + path
  return this.fileApi.getFileBlob(filepath)
}
```

**Step 3: Commit**

```bash
git add src/plugins/interactive-dashboard/export/ExportButton.vue src/plugins/interactive-dashboard/InteractiveDashboard.vue
git commit -m "feat(export): add ExportButton dropdown with YAML config support"
```

---

## Task 6: CLI Script (Playwright)

**Files:**
- Create: `scripts/export.ts`
- Modify: `package.json` (add `export` script, add `tsx` dependency)

**Step 1: Install tsx**

Run: `npm install --save-dev tsx`

tsx is needed to run TypeScript scripts directly from the command line.

**Step 2: Create scripts/export.ts**

```typescript
#!/usr/bin/env tsx
/**
 * Headless export script for SimWrapper dashboards.
 *
 * Usage:
 *   npm run export -- path/to/export-config.yaml
 *   npm run export -- path/to/export-config.yaml --output ./figures
 *   npm run export -- path/to/export-config.yaml --root projectSlug --subfolder path/to/data
 *
 * This script:
 * 1. Starts a Vite dev server
 * 2. Launches headless Chromium via Playwright
 * 3. Navigates to the export route with the config
 * 4. Waits for export completion
 * 5. Saves the ZIP file to the output directory
 */

import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { resolve, dirname, basename } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: npm run export -- <config.yaml> [--output <dir>] [--root <slug>] [--subfolder <path>]')
    process.exit(0)
  }

  const configPath = resolve(args[0])
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`)
    process.exit(1)
  }

  // Parse optional args
  let outputDir = resolve(dirname(configPath), 'export')
  let root = ''
  let subfolder = ''
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) { outputDir = resolve(args[++i]); continue }
    if (args[i] === '--root' && args[i + 1]) { root = args[++i]; continue }
    if (args[i] === '--subfolder' && args[i + 1]) { subfolder = args[++i]; continue }
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  console.log(`[export] Config: ${configPath}`)
  console.log(`[export] Output: ${outputDir}`)

  // Start Vite dev server
  console.log('[export] Starting dev server...')
  const server = await createServer({
    configFile: resolve(__dirname, '..', 'vite.config.mts'),
    server: { port: 0 },  // Auto-select available port
  })
  await server.listen()
  const address = server.httpServer?.address()
  const port = typeof address === 'object' && address ? address.port : 8080
  const baseUrl = `http://localhost:${port}`
  console.log(`[export] Dev server running at ${baseUrl}`)

  // Launch headless browser
  console.log('[export] Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()

  // Set up download handler
  const downloadPromise = page.waitForEvent('download', { timeout: 300000 })

  // Navigate to export route
  const configName = basename(configPath)
  const exportUrl = `${baseUrl}/export?config=${encodeURIComponent(configName)}&root=${encodeURIComponent(root)}&subfolder=${encodeURIComponent(subfolder)}`
  console.log(`[export] Navigating to ${exportUrl}`)
  await page.goto(exportUrl)

  // Wait for export to complete
  console.log('[export] Waiting for export to complete...')
  try {
    const download = await downloadPromise
    const downloadPath = resolve(outputDir, download.suggestedFilename())
    await download.saveAs(downloadPath)
    console.log(`[export] Downloaded: ${downloadPath}`)
  } catch (error) {
    // Fallback: check for window.__exportComplete
    await page.waitForFunction('window.__exportComplete === true', { timeout: 300000 })
    console.log('[export] Export complete (no download intercepted)')
  }

  // Cleanup
  await browser.close()
  await server.close()

  console.log('[export] Done!')
  process.exit(0)
}

main().catch(error => {
  console.error('[export] Fatal error:', error)
  process.exit(1)
})
```

**Step 3: Add script to package.json**

Add to the `"scripts"` section in `package.json`:

```json
"export": "tsx scripts/export.ts"
```

**Step 4: Commit**

```bash
git add scripts/export.ts package.json package-lock.json
git commit -m "feat(export): add Playwright-based CLI export script"
```

---

## Task 7: Integration Testing and Polish

**Files:**
- Create: `tests/export.spec.ts` (Playwright E2E test)
- Create: `public/data/test-export/export-test.yaml` (test export config)
- Create: `public/data/test-export/test-data.csv` (small test dataset)

**Step 1: Create test data**

A small CSV file and export YAML for testing:

```csv
id,mode,distance,duration
1,car,5000,30
2,pt,3000,45
3,bike,1000,15
4,car,8000,50
5,walk,500,10
```

```yaml
# export-test.yaml
table:
  file: test-data.csv
  idColumn: id

defaults:
  format: png
  width: 600
  height: 400
  scale: 1
  scientific: true

plots:
  test-histogram:
    type: histogram
    title: "Distance Distribution"
    column: distance
    bins: 5

states:
  all:
    export:
      - test-histogram
  filtered:
    filters:
      mode: [car, pt]
    export:
      - test-histogram
```

**Step 2: Create Playwright E2E test**

```typescript
// tests/export.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Export System', () => {
  test('export route renders and completes', async ({ page }) => {
    // Navigate to export route with test config
    await page.goto('/export?config=export-test.yaml&root=files&subfolder=test-export')

    // Wait for export to start
    await expect(page.locator('.export-view')).toBeVisible({ timeout: 10000 })

    // Wait for completion
    await expect(page.locator('text=Export Complete')).toBeVisible({ timeout: 30000 })

    // Verify download button appears
    await expect(page.locator('button:has-text("Download ZIP")')).toBeVisible()
  })
})
```

**Step 3: Manual verification**

1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:8080/export?config=export-test.yaml&root=files&subfolder=test-export`
3. Verify: ExportView shows, renders test histogram, completes, offers ZIP download
4. Test CLI: `npm run export -- public/data/test-export/export-test.yaml --root files --subfolder test-export`

**Step 4: Commit**

```bash
git add tests/export.spec.ts public/data/test-export/
git commit -m "test(export): add E2E test and test data for export system"
```

---

## Summary of Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/plugins/interactive-dashboard/types/exportConfig.ts` | TypeScript types for export YAML |
| Create | `src/plugins/interactive-dashboard/export/ExportEngine.ts` | Core export logic (parsing, filtering, orchestration) |
| Create | `src/plugins/interactive-dashboard/export/ExportView.vue` | Progress UI + card rendering |
| Create | `src/plugins/interactive-dashboard/export/ExportPage.vue` | Route wrapper (loads YAML, initializes ExportView) |
| Create | `src/plugins/interactive-dashboard/export/ExportButton.vue` | Dropdown button for dashboard toolbar |
| Create | `scripts/export.ts` | Playwright CLI wrapper |
| Modify | `src/router.ts` | Add `/export` route |
| Modify | `src/plugins/interactive-dashboard/InteractiveDashboard.vue` | Replace ExportAllButton with ExportButton |
| Modify | `package.json` | Add `export` script, `tsx` dependency |
| Create | `src/plugins/interactive-dashboard/managers/__tests__/exportConfig.test.ts` | Unit tests for config resolution |
| Create | `src/plugins/interactive-dashboard/managers/__tests__/ExportEngine.test.ts` | Unit tests for ExportEngine |
| Create | `tests/export.spec.ts` | E2E Playwright test |
| Create | `public/data/test-export/` | Test data files |

## Dependency Order

```
Task 1 (Types + Config Resolution)
  └─→ Task 2 (ExportEngine Core)
       └─→ Task 3 (ExportView Component)
            ├─→ Task 4 (Export Route)
            └─→ Task 5 (ExportButton in Dashboard)
                 └─→ Task 6 (CLI Script)
                      └─→ Task 7 (Integration Testing)
```
