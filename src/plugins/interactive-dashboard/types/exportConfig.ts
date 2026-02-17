/**
 * Export configuration loaded from a YAML file.
 * Self-contained: defines data source, plots, states, and output settings.
 */

/** Supported export card types (maps to panelLookup keys in _allPanels.ts) */
export type ExportCardType =
  | 'histogram'
  | 'pie-chart'
  | 'scatter-plot'
  | 'map'
  | 'correlation-matrix'
  | 'timeline'

/** Export image format */
export type ExportFormat = 'png' | 'svg'

/** Filter definition for a single column */
export type FilterDef =
  | string // Categorical: single value, e.g. "car"
  | string[] // Categorical: multiple values, e.g. ["car", "pt"]
  | { min?: number; max?: number } // Numeric range

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
  export: string[] // References to plot IDs defined in `plots`
  // State-level export overrides
  format?: ExportFormat
  width?: number
  height?: number
  scale?: number
}

/** Output configuration */
export interface ExportOutputConfig {
  directory?: string // Default: './export'
  naming?: string // Default: '{state}-{plot}'
}

/** Table (data source) configuration */
export interface ExportTableConfig {
  file: string // CSV file path (relative to YAML location)
  idColumn?: string // ID column name
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
