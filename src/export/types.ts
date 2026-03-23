import type { Data as PlotlyData, Layout as PlotlyLayout, Config as PlotlyConfig } from 'plotly.js'

/** Output of any trace builder — ready for Plotly.react() or jsdom Plotly.toImage() */
export interface PlotlyFigure {
  traces: PlotlyData[]
  layout: Partial<PlotlyLayout>
  config?: Partial<PlotlyConfig>
}

/** Visual style resolved from the override cascade */
export interface ChartStyle {
  axisTitleFontSize: number
  axisTickFontSize: number
  legendTitleFontSize: number
  legendFontSize: number
  lineWidth: number
  markerSizeMultiplier: number
  fontFamily: string
  backgroundColor: string
  textColor: string
  gridColor: string
  barColor: string
  selectedColor: string
  margin?: { l: number; r: number; t: number; b: number }
  isScientific: boolean
}

/** MapLibre style layer definition for export */
export interface MapExportLayer {
  id: string
  type: 'fill' | 'line' | 'circle'
  source: string
  paint: Record<string, any>
  layout?: Record<string, any>
  filter?: any[]
}

/** Map rendering config resolved from dashboard YAML */
export interface MapRenderConfig {
  center: [number, number]
  zoom: number
  width: number
  height: number
  scale: number
  styleUrl: string
  layers: MapExportLayer[]
  sources: Record<string, { type: 'geojson'; data: any }>
  legend?: LegendData
}

export interface LegendData {
  type: 'numeric' | 'categorical'
  title: string
  minValue?: number
  maxValue?: number
  minColor?: string
  maxColor?: string
  items?: Array<{ label: string; color: string }>
}

/** Resolved export item — one plot in one state */
export interface ExportItem {
  plotId: string
  stateId: string
  filename: string
  format: 'png' | 'svg'
  width: number
  height: number
  scale: number
  style: ChartStyle
  plotDef: Record<string, any>
  filters: Record<string, any>
  comparison: boolean
}

/** Export result — rendered image data */
export interface ExportResult {
  filename: string
  format: 'png' | 'svg'
  data: Buffer
}

/** Dashboard YAML structure (relevant parts) */
export interface DashboardConfig {
  table: { file: string; idColumn?: string; columns?: any }
  layout: Record<string, any[]>
  export?: ExportSection
}

export interface ExportSection {
  defaults?: Partial<ExportDefaults>
  plots?: Record<string, Partial<ExportDefaults> & Record<string, any>>
  states: Record<string, ExportStateConfig>
  output?: { naming?: string; directory?: string }
}

export interface ExportStateConfig {
  export: string[]
  filters?: Record<string, any>
  comparison?: boolean
  plots?: Record<string, Partial<ExportDefaults> & Record<string, any>>
}

export interface ExportDefaults {
  format: 'png' | 'svg'
  width: number
  height: number
  scale: number
  axisTitleFontSize: number
  axisTickFontSize: number
  legendTitleFontSize: number
  legendFontSize: number
  lineWidth: number
  markerSizeMultiplier: number
}

/** Linked export YAML — references a dashboard file */
export interface LinkedExportConfig {
  dashboard: string
  defaults?: Partial<ExportDefaults>
  plots?: Record<string, Partial<ExportDefaults> & Record<string, any>>
  states: Record<string, ExportStateConfig>
  output?: { naming?: string; directory?: string }
}
