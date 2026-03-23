<template>
  <div class="scatter-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import { LinkageManager, LinkageObserver } from '../../managers/LinkageManager'
import globalStore from '@/store'
import { debugLog } from '../../utils/debug'
import { formatLabel } from '../../utils/labelFormatter'
import { formatChartTitle, sortLegendCategories } from '../../utils/chartFormatting'
import { buildScatterFigure, type ScatterInput } from '@/export/trace-builders/scatter'
import type { ChartStyle } from '@/export/types'

interface ColumnFormat {
  type: 'time' | 'duration' | 'distance' | 'decimal' | 'percent'
  convertFrom?: string
  unit?: string
  decimals?: number
  titleCase?: boolean
}

interface TableConfig {
  columns?: {
    formats?: Record<string, ColumnFormat>
  }
}

interface Props {
  title?: string
  xColumn: string           // Column for X axis
  yColumn: string           // Column for Y axis
  yColumnRight?: string     // Optional second Y column for right-side secondary axis
  colorColumn?: string      // Optional column for point colors (categorical)
  sizeColumn?: string       // Optional column for point sizes (numeric)
  markerSize?: number       // Default marker size (default: 8)
  filteredData?: any[]      // From LinkableCardWrapper (optional for safety)
  hoveredIds?: Set<any>     // Hovered IDs from linkage
  selectedIds?: Set<any>    // Selected IDs from linkage
  idColumn?: string         // Column to use as ID for linkage
  linkage?: {
    type: 'select'  // Scatter plots only support selection linkage (visual highlighting), not filtering
    column: string
    behavior: 'toggle'
  }
  tableConfig?: TableConfig // From InteractiveDashboard - contains column formats
  listenToAttributePairSelection?: boolean  // Enable dynamic axis updates from correlation matrix
  linkageManager?: LinkageManager           // Manager instance for observing events
  baselineData?: any[]      // All data (unfiltered) for comparison mode
  showComparison?: boolean  // Whether comparison mode is active
  colorByAttribute?: string  // Dashboard-level color-by attribute
  colorByOptions?: Array<{ attribute: string; label: string; type: string }>
  xMin?: number             // Explicit x-axis minimum (from YAML)
  xMax?: number             // Explicit x-axis maximum (from YAML)
  yMin?: number             // Explicit y-axis minimum (from YAML)
  yMax?: number             // Explicit y-axis maximum (from YAML)
  xAutoTrim?: number        // X-axis percentile auto-trim (e.g. 95)
  yAutoTrim?: number        // Y-axis percentile auto-trim (e.g. 99)
  connectLines?: boolean    // Connect same-color points with lines (sorted by x-axis)
  showTooltip?: boolean     // Show hover tooltip (default: true)
  exportMode?: boolean
  exportAxisTitleFontSize?: number
  exportAxisTickFontSize?: number
  exportLegendTitleFontSize?: number
  exportLegendFontSize?: number
  exportLineWidth?: number
  exportMarkerSizeMultiplier?: number
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  hoveredIds: () => new Set(),
  selectedIds: () => new Set(),
  markerSize: 8,
  idColumn: '',
  listenToAttributePairSelection: false,
  baselineData: () => [],
  showComparison: false,
  connectLines: false,
  showTooltip: true,
  yColumnRight: '',
  exportMode: false,
})

const emit = defineEmits<{
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
  isLoaded: []
}>()

const hoverInfo = computed(() => (props.showTooltip ? 'text' : 'none'))

const plotContainer = ref<HTMLElement>()
// Note: Selection state is managed by the parent via props.selectedIds
// We don't maintain local selection state to avoid sync issues

// Current axis columns (can be overridden by attribute pair selection)
const currentXColumn = ref(props.xColumn)
const currentYColumn = ref(props.yColumn)

// Watch for prop changes to reset defaults
watch(() => props.xColumn, (newVal) => { currentXColumn.value = newVal })
watch(() => props.yColumn, (newVal) => { currentYColumn.value = newVal })

// Type detection: YAML config overrides auto-detection
const detectColorByType = (attribute: string): 'categorical' | 'numeric' => {
  // Priority 1: Use YAML-configured type if available
  const yamlConfig = props.colorByOptions?.find(opt => opt.attribute === attribute)
  if (yamlConfig?.type === 'numeric' || yamlConfig?.type === 'categorical') {
    return yamlConfig.type
  }

  // Priority 2: Auto-detect from data
  if (!props.filteredData?.length || !attribute) return 'categorical'
  const values = props.filteredData
    .map(row => row[attribute])
    .filter(v => v !== null && v !== undefined)
  if (values.length === 0) return 'categorical'

  const allNumeric = values.every(v => typeof v === 'number' && !isNaN(v))
  if (!allNumeric) return 'categorical'

  // If numeric but few unique values (< 15), treat as categorical
  // This handles cases like mode IDs (1=car, 2=bike)
  const uniqueValues = new Set(values)
  if (uniqueValues.size < 15) return 'categorical'

  return 'numeric'
}

// Get format config for a column
function getColumnFormat(column: string): ColumnFormat | undefined {
  return props.tableConfig?.columns?.formats?.[column]
}

/**
 * Format a category value for legend entries.
 * Numeric values use the column's format config (decimals, unit); text values use title-case.
 */
function formatLegendValue(value: string, column?: string): string {
  if (!column) return formatLabel(value, props.tableConfig?.columns?.formats, column)

  // Try to treat as a number first
  const num = Number(value)
  if (!Number.isNaN(num)) {
    const format = getColumnFormat(column)
    if (format) {
      const decimals = format.decimals ?? 2
      return num.toFixed(decimals)
    }
    // No format config — show the raw numeric string
    return value
  }
  // Non-numeric: apply title-case
  return formatLabel(value, props.tableConfig?.columns?.formats, column)
}

// Convert a raw numeric value to display units (e.g. seconds -> minutes)
// Returns the converted number for use in plot axes/data points.
function convertValue(value: number, column: string): number {
  const format = getColumnFormat(column)
  if (!format) return value

  switch (format.type) {
    case 'duration':
      if (format.convertFrom === 'seconds' && format.unit === 'min') return value / 60
      break
    case 'distance':
      if (format.convertFrom === 'meters' && format.unit === 'km') return value / 1000
      break
    case 'percent':
      return value * 100
  }
  return value
}

// Format a value based on column format
function formatValue(value: any, column: string): string {
  const format = getColumnFormat(column)
  if (value === null || value === undefined) {
    return ''
  }

  // Ensure value is a number for numeric operations
  const numValue = typeof value === 'number' ? value : parseFloat(value)
  if (isNaN(numValue)) {
    return String(value)
  }

  if (!format) {
    return numValue.toFixed(2)
  }

  switch (format.type) {
    case 'time': {
      if (format.convertFrom === 'seconds') {
        const hours = Math.floor(numValue / 3600)
        const minutes = Math.floor((numValue % 3600) / 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      }
      return String(numValue)
    }
    case 'duration': {
      if (format.convertFrom === 'seconds') {
        if (format.unit === 'min') {
          return `${(numValue / 60).toFixed(format.decimals ?? 1)} min`
        }
        return `${numValue.toFixed(0)} s`
      }
      return String(numValue)
    }
    case 'distance': {
      if (format.convertFrom === 'meters') {
        if (format.unit === 'km') {
          return `${(numValue / 1000).toFixed(format.decimals ?? 2)} km`
        }
        return `${numValue.toFixed(0)} m`
      }
      return String(numValue)
    }
    case 'percent': {
      return `${(numValue * 100).toFixed(format.decimals ?? 1)}%`
    }
    case 'decimal': {
      return numValue.toFixed(format.decimals ?? 2)
    }
    default:
      return String(numValue)
  }
}

function isFiniteNumeric(value: any): boolean {
  const numeric = Number(value)
  return Number.isFinite(numeric)
}

/**
 * Build the ChartStyle for the shared trace builder.
 * In interactive (non-export) mode uses compact sizes; export mode uses larger sizes.
 */
function buildChartStyle(): ChartStyle {
  const styleManager = StyleManager.getInstance()
  const isScientific = styleManager.isScientificMode()
  const fontFamily = isScientific
    ? styleManager.getScientificConfig().fontFamily
    : 'Arial, Helvetica, sans-serif'

  if (props.exportMode) {
    return {
      axisTitleFontSize: props.exportAxisTitleFontSize ?? 14,
      axisTickFontSize: props.exportAxisTickFontSize ?? 12,
      legendTitleFontSize: props.exportLegendTitleFontSize ?? 13,
      legendFontSize: props.exportLegendFontSize ?? 12,
      lineWidth: props.exportLineWidth ?? 2.4,
      markerSizeMultiplier: props.exportMarkerSizeMultiplier ?? 1.35,
      fontFamily,
      backgroundColor: styleManager.getColor('theme.background.primary'),
      textColor: styleManager.getColor('theme.text.primary'),
      gridColor: styleManager.getColor('theme.border.default'),
      barColor: styleManager.getColor('chart.bar.default'),
      selectedColor: '#ef4444',
      isScientific,
    }
  }

  return {
    axisTitleFontSize: 11,
    axisTickFontSize: 10,
    legendTitleFontSize: 11,
    legendFontSize: 10,
    lineWidth: 1.5,
    markerSizeMultiplier: 1.0,
    fontFamily,
    backgroundColor: styleManager.getColor('theme.background.primary'),
    textColor: styleManager.getColor('theme.text.primary'),
    gridColor: styleManager.getColor('theme.border.default'),
    barColor: styleManager.getColor('chart.bar.default'),
    selectedColor: '#ef4444',
    isScientific,
  }
}

/**
 * Build the ScatterInput for the shared trace builder.
 * Pre-converts data values using column format configs (seconds->minutes, etc.)
 * so the builder receives display-ready numeric values.
 */
function buildScatterInput(): ScatterInput {
  const styleManager = StyleManager.getInstance()
  const colorByActive = props.colorByAttribute && props.colorByAttribute !== ''
  const colorByType = colorByActive ? detectColorByType(props.colorByAttribute!) : undefined

  // Pre-convert filtered data values using column format configs
  const convertedData = (props.filteredData || []).map(row => {
    const converted: Record<string, any> = { ...row }
    const xVal = row[currentXColumn.value]
    const yVal = row[currentYColumn.value]
    if (isFiniteNumeric(xVal)) {
      converted[currentXColumn.value] = convertValue(Number(xVal), currentXColumn.value)
    }
    if (isFiniteNumeric(yVal)) {
      converted[currentYColumn.value] = convertValue(Number(yVal), currentYColumn.value)
    }
    // Also convert yColumnRight if present
    if (props.yColumnRight) {
      const yRVal = row[props.yColumnRight]
      if (isFiniteNumeric(yRVal)) {
        converted[props.yColumnRight] = convertValue(Number(yRVal), props.yColumnRight)
      }
    }
    return converted
  })

  // Pre-convert baseline data too
  const convertedBaseline = (props.baselineData || []).map(row => {
    const converted: Record<string, any> = { ...row }
    const xVal = row[currentXColumn.value]
    const yVal = row[currentYColumn.value]
    if (isFiniteNumeric(xVal)) {
      converted[currentXColumn.value] = convertValue(Number(xVal), currentXColumn.value)
    }
    if (isFiniteNumeric(yVal)) {
      converted[currentYColumn.value] = convertValue(Number(yVal), currentYColumn.value)
    }
    return converted
  })

  // Build colorMap from StyleManager for consistent colors across all charts
  let colorMap: Map<string, string> | undefined
  const colorCol = colorByActive ? props.colorByAttribute! : props.colorColumn
  if (colorCol) {
    const categorySet = new Set<string>()
    for (const row of props.filteredData || []) {
      const v = row[colorCol]
      if (v !== undefined && v !== null) categorySet.add(String(v))
    }
    const sorted = sortLegendCategories(Array.from(categorySet))
    colorMap = styleManager.buildCategoricalColorMap(sorted)
  }

  return {
    filteredData: convertedData,
    baselineData: convertedBaseline.length > 0 ? convertedBaseline : undefined,
    xColumn: currentXColumn.value,
    yColumn: currentYColumn.value,
    yColumnRight: props.yColumnRight || undefined,
    idColumn: props.idColumn || undefined,
    colorColumn: props.colorColumn || undefined,
    colorBy: colorByActive ? props.colorByAttribute : undefined,
    colorByType: colorByType,
    colorMap,
    sizeColumn: props.sizeColumn || undefined,
    markerSize: props.markerSize,
    connectLines: props.connectLines,
    showComparison: props.showComparison,
    title: props.title,
    xMin: props.xMin,
    xMax: props.xMax,
    yMin: props.yMin,
    yMax: props.yMax,
    xAutoTrim: props.xAutoTrim,
    yAutoTrim: props.yAutoTrim,
  }
}

/**
 * Build a map from (traceIndex, pointIndex) to the row's ID.
 * This replicates the trace-grouping logic of buildScatterFigure so we can
 * overlay interactive hover/selection styling on top of the builder's output.
 *
 * Returns an array of arrays: traceIdMap[traceIdx][pointIdx] = id
 * The trace order matches what buildScatterFigure produces.
 */
function buildTraceIdMap(input: ScatterInput): any[][] {
  const { filteredData, baselineData, xColumn, yColumn, yColumnRight,
    colorColumn, colorBy, colorByType, connectLines, showComparison, idColumn } = input

  const traceIdMap: any[][] = []

  const categorySet = new Set<string>()
  if (colorColumn) {
    for (const row of filteredData) {
      const v = row[colorColumn]
      if (v !== undefined && v !== null) categorySet.add(String(v))
    }
  }
  const categories = sortLegendCategories(Array.from(categorySet))
  const hasCategories = !!colorColumn && colorColumn !== '' && categories.length > 0

  const colorByActive = !!colorBy && colorBy !== ''
  const effectiveColorByType = colorByType ?? 'categorical'
  const forceColorColumnGrouping = hasCategories && connectLines

  // Helper to sort IDs by x (mirrors sortByX in the builder)
  const sortIdsByX = (xArr: number[], ids: any[]): any[] => {
    const indices = xArr.map((_: any, i: number) => i)
    indices.sort((a: number, b: number) => xArr[a] - xArr[b])
    return indices.map(i => ids[i])
  }

  // 1. Baseline trace
  if (showComparison && baselineData && baselineData.length > 0) {
    const baseIds: any[] = []
    for (const row of baselineData) {
      const xv = row[xColumn]
      const yv = row[yColumn]
      if (isFiniteNumeric(xv) && isFiniteNumeric(yv)) {
        baseIds.push(idColumn ? row[idColumn] : null)
      }
    }
    if (baseIds.length > 0) traceIdMap.push(baseIds)
  }

  // 2. Categorical colorBy
  if (!forceColorColumnGrouping && colorByActive && effectiveColorByType === 'categorical') {
    const colorByCategories = sortLegendCategories(
      Array.from(new Set(
        filteredData.map(r => r[colorBy!]).filter(v => v !== null && v !== undefined).map(String)
      ))
    )
    for (const cat of colorByCategories) {
      const ids: any[] = []
      const xArr: number[] = []
      for (const row of filteredData) {
        if (String(row[colorBy!]) !== cat) continue
        const xv = row[xColumn]
        const yv = row[yColumn]
        if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
        ids.push(idColumn ? row[idColumn] : null)
        xArr.push(Number(xv))
      }
      if (ids.length > 0) {
        traceIdMap.push(connectLines ? sortIdsByX(xArr, ids) : ids)
      }
    }

  // 3. Numeric colorBy
  } else if (!forceColorColumnGrouping && colorByActive && effectiveColorByType === 'numeric') {
    const ids: any[] = []
    for (const row of filteredData) {
      const xv = row[xColumn]
      const yv = row[yColumn]
      if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
      ids.push(idColumn ? row[idColumn] : null)
    }
    if (ids.length > 0) traceIdMap.push(ids)

  // 4. colorColumn grouping
  } else if (hasCategories) {
    for (const cat of categories) {
      const ids: any[] = []
      const xArr: number[] = []
      for (const row of filteredData) {
        if (String(row[colorColumn!]) !== cat) continue
        const xv = row[xColumn]
        const yv = row[yColumn]
        if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
        ids.push(idColumn ? row[idColumn] : null)
        xArr.push(Number(xv))
      }
      if (ids.length > 0) {
        traceIdMap.push(connectLines ? sortIdsByX(xArr, ids) : ids)
      }
    }

  // 5. Single trace
  } else {
    const ids: any[] = []
    const xArr: number[] = []
    for (const row of filteredData) {
      const xv = row[xColumn]
      const yv = row[yColumn]
      if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
      ids.push(idColumn ? row[idColumn] : null)
      xArr.push(Number(xv))
    }
    if (ids.length > 0) {
      traceIdMap.push(connectLines ? sortIdsByX(xArr, ids) : ids)
    }
  }

  // Secondary Y-axis traces
  const hasSecondaryY = !!yColumnRight && yColumnRight !== ''
  if (hasSecondaryY) {
    const secondaryCategories = hasCategories ? categories : ['_all']
    for (const cat of secondaryCategories) {
      const ids: any[] = []
      const xArr: number[] = []
      for (const row of filteredData) {
        if (hasCategories && String(row[colorColumn!]) !== cat) continue
        const xv = row[xColumn]
        const yv = row[yColumnRight!]
        if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
        ids.push(idColumn ? row[idColumn] : null)
        xArr.push(Number(xv))
      }
      if (ids.length > 0) {
        traceIdMap.push(connectLines ? sortIdsByX(xArr, ids) : ids)
      }
    }
  }

  return traceIdMap
}

/**
 * Apply interactive hover/selection overrides to traces from the shared builder.
 * Replaces uniform marker styling with per-point arrays that highlight
 * hovered/selected points (red star at 2x size).
 */
function applyInteractiveOverrides(
  traces: any[],
  traceIdMap: any[][],
  hoveredIds: Set<any> | undefined,
  selectedIds: Set<any> | undefined,
  styleManager: StyleManager,
): void {
  const highlightColor = '#ef4444'
  const selectedColor = '#ef4444'
  const hoverSelectSymbol = 'star'
  const hoverSelectSizeMultiplier = 2
  const textColor = styleManager.getColor('theme.text.primary')
  const defaultOpacity = styleManager.getDefaultOpacity()

  for (let t = 0; t < traces.length; t++) {
    const trace = traces[t]
    const ids = traceIdMap[t]
    if (!ids || !trace.x) continue

    const n = trace.x.length
    // Baseline trace — skip interactive overrides (no IDs to match)
    if (trace.name === 'Baseline (All Data)') continue

    // Read the base values from the builder's output
    const baseColor = trace.marker?.color
    const baseSize = trace.marker?.size
    const baseSymbol = trace.marker?.symbol
    const baseOpacity = trace.marker?.opacity ?? defaultOpacity

    const colors: string[] = []
    const sizes: number[] = []
    const symbols: string[] = []
    const lineColors: string[] = []
    const lineWidths: number[] = []
    const opacities: number[] = []
    const customdata: any[] = []

    for (let i = 0; i < n; i++) {
      const id = ids[i]
      const isHovered = id && hoveredIds?.has(id)
      const isSelected = id && selectedIds?.has(id)

      // Resolve base values (could be scalar or array)
      const pointColor = Array.isArray(baseColor) ? baseColor[i] : baseColor
      const pointSize = Array.isArray(baseSize) ? baseSize[i] : (baseSize ?? 8)
      const pointSymbol = Array.isArray(baseSymbol) ? baseSymbol[i] : (baseSymbol ?? 'circle')

      if (isSelected) {
        colors.push(selectedColor)
        sizes.push(pointSize * hoverSelectSizeMultiplier)
        symbols.push(hoverSelectSymbol)
        lineColors.push('#ffffff')
        lineWidths.push(3)
        opacities.push(1.0)
      } else if (isHovered) {
        colors.push(highlightColor)
        sizes.push(pointSize * hoverSelectSizeMultiplier)
        symbols.push(hoverSelectSymbol)
        lineColors.push('#ffffff')
        lineWidths.push(2.5)
        opacities.push(1.0)
      } else {
        colors.push(pointColor)
        sizes.push(pointSize)
        symbols.push(pointSymbol)
        lineColors.push(textColor)
        lineWidths.push(0.5)
        opacities.push(typeof baseOpacity === 'number' ? baseOpacity : defaultOpacity)
      }
      customdata.push({ id })
    }

    // For numeric colorBy traces, keep the colorscale on the base color array
    // but override individual points that are hovered/selected
    if (trace.marker?.colorscale) {
      // Numeric colorBy: only override points that are hovered/selected
      const hasAnyHighlight = ids.some(
        (id: any) => id && (hoveredIds?.has(id) || selectedIds?.has(id))
      )
      if (hasAnyHighlight) {
        // Must remove colorscale to use per-point hex colors
        // Copy the Viridis-mapped values as fallback hex colors (approximate with the original array)
        trace.marker.color = colors
        delete trace.marker.colorscale
        delete trace.marker.showscale
        delete trace.marker.colorbar
      }
    } else {
      trace.marker.color = colors
    }

    trace.marker.size = sizes
    trace.marker.symbol = symbols
    trace.marker.line = { color: lineColors, width: lineWidths }
    trace.marker.opacity = opacities
    trace.customdata = customdata
  }
}

/**
 * Apply formatted hover text to all traces.
 * The shared builder doesn't include hover text (it's interactive-specific),
 * so we build it here using the column format configs.
 */
function applyHoverText(
  traces: any[],
  traceIdMap: any[][],
  input: ScatterInput,
): void {
  for (let t = 0; t < traces.length; t++) {
    const trace = traces[t]
    const ids = traceIdMap[t]
    if (!ids || !trace.x) continue

    const n = trace.x.length
    const text: string[] = []

    for (let i = 0; i < n; i++) {
      const xVal = trace.x[i]
      const yVal = trace.y[i]

      // Format the already-converted values for display
      // Since values are pre-converted, format them directly as decimals
      const xFormatted = formatValue(xVal, currentXColumn.value)
      const yFormatted = trace.yaxis === 'y2'
        ? formatValue(yVal, input.yColumnRight || currentYColumn.value)
        : formatValue(yVal, currentYColumn.value)

      const yCol = trace.yaxis === 'y2' ? (input.yColumnRight || currentYColumn.value) : currentYColumn.value
      let hoverText = `${currentXColumn.value}: ${xFormatted}<br>${yCol}: ${yFormatted}`

      // Add category info
      if (trace.legendgroup && trace.legendgroup !== '_right' && !trace.legendgroup.endsWith('_right')) {
        const groupCol = input.colorBy || input.colorColumn
        if (groupCol) {
          hoverText += `<br>${groupCol}: ${trace.legendgroup}`
        }
      }

      // Add ID
      const id = ids[i]
      if (id) {
        hoverText += `<br>ID: ${id}`
      }

      text.push(hoverText)
    }

    trace.text = text
    trace.hoverinfo = hoverInfo.value
  }
}

/**
 * Apply formatted axis titles and legend labels to the layout.
 * The builder uses raw column names; the interactive component formats them
 * with unit suffixes and title-case using tableConfig.
 */
function applyFormattedLabels(layout: any, traces: any[], input: ScatterInput): void {
  // Format axis titles
  if (layout.xaxis?.title) {
    layout.xaxis.title.text = formatChartTitle(
      currentXColumn.value, props.tableConfig?.columns?.formats
    )
  }
  if (layout.yaxis?.title) {
    layout.yaxis.title.text = formatChartTitle(
      currentYColumn.value, props.tableConfig?.columns?.formats
    )
  }
  if (layout.yaxis2?.title && input.yColumnRight) {
    layout.yaxis2.title.text = formatChartTitle(
      input.yColumnRight, props.tableConfig?.columns?.formats
    )
  }

  // Format legend title
  if (layout.legend?.title?.text) {
    layout.legend.title.text = formatChartTitle(
      layout.legend.title.text, props.tableConfig?.columns?.formats
    )
  }

  // Format trace legend names
  for (const trace of traces) {
    if (trace.name === 'Baseline (All Data)') continue
    if (!trace.legendgroup) continue

    // Determine which column this trace's legend group refers to
    const groupCol = input.colorBy || input.colorColumn
    if (groupCol && trace.name) {
      // Check if name looks like a secondary axis label: "cat (right)"
      const rightSuffix = trace.name.endsWith(' (right)')
      const baseName = rightSuffix ? trace.name.slice(0, -8) : trace.name
      const formatted = formatLegendValue(baseName, groupCol)
      trace.name = rightSuffix ? `${formatted} (right)` : formatted
    }
  }

  // Format numeric colorBy colorbar title
  for (const trace of traces) {
    if (trace.marker?.colorbar?.title?.text && input.colorBy) {
      const colorByLabelOverride = props.colorByOptions?.find(
        opt => opt.attribute === input.colorBy
      )?.label
      trace.marker.colorbar.title.text = formatChartTitle(
        input.colorBy,
        props.tableConfig?.columns?.formats,
        { labelOverride: colorByLabelOverride, stripEmptyUnits: true }
      )
    }
  }
}

// Debounce timer for renderChart
let renderTimeout: ReturnType<typeof setTimeout> | null = null
// Track whether chart has been initialized (to know if we can use Plotly.react)
let chartInitialized = false

// Debounced render to prevent excessive re-renders
const debouncedRenderChart = () => {
  if (renderTimeout) {
    clearTimeout(renderTimeout)
  }
  renderTimeout = setTimeout(() => {
    updateChart()
    renderTimeout = null
  }, 50)  // 50ms debounce
}

// Initial chart creation - registers event handlers
const initializeChart = () => {
  if (!plotContainer.value || !props.filteredData?.length) return

  const { traces, layout, config } = buildChartData()
  if (traces.length === 0) return

  Plotly.newPlot(plotContainer.value, traces, layout, config)
  chartInitialized = true

  debugLog('[ScatterCard] Chart INITIALIZED, registering event handlers for:', props.title || 'untitled')

  // Register event handlers ONCE during initialization
  registerEventHandlers()
}

// Update chart data - uses Plotly.react to preserve event handlers
const updateChart = () => {
  if (!plotContainer.value) return

  // If no data, nothing to render
  if (!props.filteredData?.length) return

  const { traces, layout, config } = buildChartData()
  if (traces.length === 0) return

  if (chartInitialized) {
    // Use Plotly.react to update data/layout (preserves event handlers)
    Plotly.react(plotContainer.value, traces, layout, config)
    debugLog('[ScatterCard] Chart updated for:', props.title || 'untitled')
  } else {
    // First render - initialize
    initializeChart()
  }
}

// Find all IDs at a given x,y coordinate (handles overlapping points)
const findIdsAtCoordinate = (x: number, y: number): any[] => {
  const ids: any[] = []

  // Need to compute x/y ranges from all filtered data for tolerance calculation
  const allX: number[] = []
  const allY: number[] = []
  props.filteredData?.forEach(row => {
    const xv = row[currentXColumn.value]
    const yv = row[currentYColumn.value]
    if (isFiniteNumeric(xv) && isFiniteNumeric(yv)) {
      allX.push(convertValue(Number(xv), currentXColumn.value))
      allY.push(convertValue(Number(yv), currentYColumn.value))
    }
  })

  // Calculate tolerance based on data range (0.1% of range, minimum 0.001)
  const xRange = allX.length > 0 ? Math.max(...allX) - Math.min(...allX) : 1
  const yRange = allY.length > 0 ? Math.max(...allY) - Math.min(...allY) : 1
  const xTolerance = Math.max(xRange * 0.001, 0.001)
  const yTolerance = Math.max(yRange * 0.001, 0.001)

  // Search in filtered data (convert raw values to match plotted coordinates)
  props.filteredData?.forEach((row) => {
    const rowX = convertValue(Number(row[currentXColumn.value]), currentXColumn.value)
    const rowY = convertValue(Number(row[currentYColumn.value]), currentYColumn.value)
    const id = props.idColumn ? row[props.idColumn] : null

    if (id && Math.abs(rowX - x) < xTolerance && Math.abs(rowY - y) < yTolerance) {
      ids.push(id)
    }
  })

  return ids
}

// Register click/hover event handlers (called only once during initialization)
const registerEventHandlers = () => {
  if (!plotContainer.value) return

  // Click handler for point selection - handles ALL overlapping points at same coordinates
  plotContainer.value.on('plotly_click', (data: any) => {
    debugLog('[ScatterCard] CLICK EVENT FIRED!', data.points.length, 'points')
    const point = data.points[0]

    // Skip baseline trace (trace 0 when comparison mode is on)
    if (props.showComparison && point.curveNumber === 0) {
      debugLog('[ScatterCard] Skipping - clicked on baseline trace')
      return
    }

    // Get the clicked coordinates
    const clickedX = point.x
    const clickedY = point.y
    debugLog('[ScatterCard] Clicked at coordinates:', clickedX, clickedY)

    // Find ALL points at these coordinates (handles overlapping points)
    const clickedIds = findIdsAtCoordinate(clickedX, clickedY)
    debugLog('[ScatterCard] Found IDs at coordinates:', clickedIds)

    if (clickedIds.length === 0) {
      debugLog('[ScatterCard] No IDs found for clicked point - idColumn may be missing or empty')
      return
    }

    // Toggle selection behavior: clicking adds/removes ALL overlapping points from selection set
    const newSelection = new Set(props.selectedIds || [])
    debugLog('[ScatterCard] Current selection before toggle:', Array.from(newSelection))

    // Check if ALL clicked IDs are already selected (then deselect all of them)
    const allAlreadySelected = clickedIds.every(id => newSelection.has(id))

    if (allAlreadySelected) {
      // Deselect all clicked IDs
      clickedIds.forEach(id => newSelection.delete(id))
      debugLog('[ScatterCard] Deselected', clickedIds.length, 'points')
    } else {
      // Add all clicked IDs to selection
      clickedIds.forEach(id => newSelection.add(id))
      debugLog('[ScatterCard] Selected', clickedIds.length, 'points, total now:', newSelection.size)
    }

    debugLog('[ScatterCard] Emitting select with:', Array.from(newSelection))
    emit('select', newSelection)
  })

  // Hover handler - handles ALL overlapping points at same coordinates
  plotContainer.value.on('plotly_hover', (data: any) => {
    debugLog('[ScatterCard] HOVER EVENT FIRED!')
    const point = data.points[0]

    // Skip baseline trace
    if (props.showComparison && point.curveNumber === 0) {
      return
    }

    // Get the hovered coordinates
    const hoveredX = point.x
    const hoveredY = point.y

    // Find ALL points at these coordinates
    const hoveredIds = findIdsAtCoordinate(hoveredX, hoveredY)

    if (hoveredIds.length > 0) {
      emit('hover', new Set(hoveredIds))
    }
  })

  // Unhover handler - clear hover when mouse leaves point
  plotContainer.value.on('plotly_unhover', () => {
    emit('hover', new Set())
  })
}

/**
 * Build chart data using the shared trace builder, then apply interactive overrides.
 *
 * Flow:
 *   1. Build ScatterInput + ChartStyle from component state
 *   2. Call buildScatterFigure() for base traces + layout
 *   3. Build trace->ID mapping (for hover/selection overlays)
 *   4. Apply interactive overrides (per-point hover/selection styling)
 *   5. Apply formatted hover text
 *   6. Apply formatted axis/legend labels
 */
const buildChartData = () => {
  if (!plotContainer.value || !props.filteredData?.length) {
    return { traces: [], layout: {}, config: {} }
  }

  const input = buildScatterInput()
  const style = buildChartStyle()
  const styleManager = StyleManager.getInstance()

  // 1. Get base traces and layout from shared builder
  const figure = buildScatterFigure(input, style)
  if (figure.traces.length === 0) {
    return { traces: [], layout: {}, config: {} }
  }

  // Deep-clone traces so we can mutate them for interactive overrides
  const traces = JSON.parse(JSON.stringify(figure.traces))
  const layout = JSON.parse(JSON.stringify(figure.layout))

  // 2. Build trace-to-ID mapping
  const traceIdMap = buildTraceIdMap(input)

  // 3. Apply interactive hover/selection overrides
  applyInteractiveOverrides(traces, traceIdMap, props.hoveredIds, props.selectedIds, styleManager)

  // 4. Apply formatted hover text (interactive-specific)
  applyHoverText(traces, traceIdMap, input)

  // 5. Apply formatted axis titles and legend labels
  applyFormattedLabels(layout, traces, input)

  // 6. Interactive-specific config
  const config = {
    displayModeBar: false,
    responsive: true,
  }

  return { traces, layout, config }
}

const linkageObserver: LinkageObserver = {
  onHoveredIdsChange: () => {},      // Not used in scatter
  onSelectedIdsChange: () => {},     // Not used in scatter
  onAttributePairSelected: (attrX: string, attrY: string) => {
    debugLog('[ScatterCard] onAttributePairSelected called:', attrX, attrY)
    if (!props.listenToAttributePairSelection) return

    // Check if attributes exist in data
    if (props.filteredData && props.filteredData.length > 0) {
      const sampleRow = props.filteredData[0]
      const hasX = attrX in sampleRow
      const hasY = attrY in sampleRow

      if (hasX && hasY) {
        debugLog('[ScatterCard] Updating axes to:', attrX, attrY)
        currentXColumn.value = attrX
        currentYColumn.value = attrY
        // Re-render will happen via watch on currentXColumn/currentYColumn
      } else {
        console.warn(`[ScatterCard] Attributes not found in data: ${attrX}, ${attrY}`)
      }
    }
  }
}

// Watch for current axis column changes
watch([currentXColumn, currentYColumn], () => {
  debugLog('[ScatterCard] Axes changed to:', currentXColumn.value, currentYColumn.value)
  debouncedRenderChart()
})

// Watch for data changes
watch(() => props.filteredData, () => {
  debugLog('[ScatterCard] filteredData changed, re-rendering')
  debouncedRenderChart()
})

// Watch for hover/selection changes from linkage
// Watch both the Set reference AND size to ensure changes are detected
// (Vue's reactivity doesn't always track Set changes properly)
watch(
  [
    () => props.hoveredIds,
    () => props.selectedIds,
    () => props.hoveredIds?.size ?? 0,
    () => props.selectedIds?.size ?? 0
  ],
  () => {
    debugLog('[ScatterCard] hoveredIds or selectedIds changed, hovered:', props.hoveredIds?.size, 'selected:', props.selectedIds?.size)
    debouncedRenderChart()
  }
)

// Re-render on color scheme changes (including scientific mode)
watch(() => globalStore.state.colorScheme, () => {
  debouncedRenderChart()
})

// Re-render when color-by attribute changes
watch(() => props.colorByAttribute, () => {
  debugLog('[ScatterCard] colorByAttribute changed to:', props.colorByAttribute)
  debouncedRenderChart()
})

// Resize observer for responsive chart sizing
let resizeObserver: ResizeObserver | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

function handleResize() {
  // Debounce resize calls to allow DOM to settle (especially after fullscreen transitions)
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  resizeTimeout = setTimeout(() => {
    if (plotContainer.value) {
      debugLog('[ScatterCard] Executing Plotly resize')
      Plotly.Plots.resize(plotContainer.value)
    }
    resizeTimeout = null
  }, 100)
}

// Mouse leave handler to clear hover when leaving the chart area
// This is a fallback in case plotly_unhover doesn't fire reliably
function handleMouseLeave() {
  emit('hover', new Set())
}

onMounted(() => {
  initializeChart()

  // Set up resize observer to handle container size changes
  if (plotContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      // Debounce resize calls
      nextTick(() => handleResize())
    })
    resizeObserver.observe(plotContainer.value)

    // Add mouseleave handler as fallback for clearing hover
    plotContainer.value.addEventListener('mouseleave', handleMouseLeave)
  }

  // Also listen for window resize events (for fullscreen)
  window.addEventListener('resize', handleResize)

  // Register observer if listening is enabled
  debugLog('[ScatterCard] onMounted - listenToAttributePairSelection:', props.listenToAttributePairSelection)
  if (props.listenToAttributePairSelection && props.linkageManager) {
    debugLog('[ScatterCard] Registering as observer for attribute pair events')
    props.linkageManager.addObserver(linkageObserver)
  }

  // Notify parent that card is loaded (hides loading spinner)
  emit('isLoaded')
})

onUnmounted(() => {
  // Reset chart state
  chartInitialized = false

  // Clean up resize observer and timeouts
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }
  if (renderTimeout) {
    clearTimeout(renderTimeout)
    renderTimeout = null
  }
  window.removeEventListener('resize', handleResize)

  // Clean up mouseleave handler
  if (plotContainer.value) {
    plotContainer.value.removeEventListener('mouseleave', handleMouseLeave)
  }

  // Unregister observer
  if (props.linkageManager) {
    props.linkageManager.removeObserver(linkageObserver)
  }
})
</script>

<style scoped>
.scatter-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
