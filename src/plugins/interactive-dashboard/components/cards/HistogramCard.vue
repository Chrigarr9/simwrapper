<template>
  <div class="histogram-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'
import { debugLog } from '../../utils/debug'
import { formatLabel } from '../../utils/labelFormatter'
import { formatChartTitle } from '../../utils/chartFormatting'
import { buildHistogramFigure, type HistogramInput } from '@/export/trace-builders/histogram'
import type { ChartStyle } from '@/export/types'

interface ColumnFormat {
  type: 'time' | 'duration' | 'distance' | 'decimal'
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
  column: string
  binSize?: number
  filteredData?: any[]        // From LinkableCardWrapper (optional for safety)
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }
  tableConfig?: TableConfig   // From InteractiveDashboard - contains column formats
  baselineData?: any[]        // All data (unfiltered) - from LinkableCardWrapper
  showComparison?: boolean    // Whether comparison mode is active
  colorByAttribute?: string   // Dashboard-level color-by attribute
  colorByOptions?: Array<{ attribute: string; label: string; type: string }>
  xMin?: number               // Explicit x-axis minimum (from YAML)
  xMax?: number               // Explicit x-axis maximum (from YAML)
  autoTrim?: number           // Percentile for auto-trimming x-axis (e.g. 95 keeps central 95%)
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  baselineData: () => [],
  showComparison: false
})
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>, filterType: string, binSize?: number]
  isLoaded: []
}>()

const plotContainer = ref<HTMLElement>()
const selectedBins = ref<Set<number>>(new Set())
const previousFilteredDataLength = ref(0)

// Get format config for this column
const columnFormat = computed((): ColumnFormat | undefined => {
  const format = props.tableConfig?.columns?.formats?.[props.column]
  debugLog('[HistogramCard] Column:', props.column, 'Format:', format, 'TableConfig:', props.tableConfig)
  return format
})

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

// Format a tick value based on column format
function formatTickValue(value: number): string {
  const styleManager = StyleManager.getInstance()
  const defaultDecimals = styleManager.getNumberFormat().defaultDecimals
  const format = columnFormat.value
  if (!format) {
    // Default formatting - use StyleManager
    return styleManager.formatNumber(value)
  }

  switch (format.type) {
    case 'time': {
      // Convert seconds to HH:MM format for axis labels
      if (format.convertFrom === 'seconds') {
        const hours = Math.floor(value / 3600)
        const minutes = Math.floor((value % 3600) / 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      }
      return styleManager.formatNumber(value)
    }
    case 'duration': {
      if (format.convertFrom === 'seconds') {
        if (format.unit === 'min') {
          return `${(value / 60).toFixed(defaultDecimals)} min`
        }
        return `${value.toFixed(defaultDecimals)} s`
      }
      return styleManager.formatNumber(value)
    }
    case 'distance': {
      if (format.convertFrom === 'meters') {
        if (format.unit === 'km') {
          return `${(value / 1000).toFixed(defaultDecimals)} km`
        }
        return `${value.toFixed(defaultDecimals)} m`
      }
      return styleManager.formatNumber(value)
    }
    case 'decimal': {
      const decimals = format.decimals ?? defaultDecimals
      return value.toFixed(decimals)
    }
    default:
      return styleManager.formatNumber(value)
  }
}

// Debounce timer for chart rendering (matches ScatterCard pattern)
let renderTimeout: ReturnType<typeof setTimeout> | null = null
// Track whether chart has been initialized (to know if we can use Plotly.react)
let chartInitialized = false

// Debounced render to prevent excessive re-renders during rapid filter changes
const debouncedRenderChart = () => {
  if (renderTimeout) {
    clearTimeout(renderTimeout)
  }
  renderTimeout = setTimeout(() => {
    updateChart()
    renderTimeout = null
  }, 50)  // 50ms debounce
}

// Resolve interactive ChartStyle from StyleManager
const resolveInteractiveStyle = (): ChartStyle => {
  const styleManager = StyleManager.getInstance()
  const isScientific = styleManager.isScientificMode()

  return {
    axisTitleFontSize: 11,
    axisTickFontSize: 10,
    legendTitleFontSize: 11,
    legendFontSize: 10,
    lineWidth: 1.5,
    markerSizeMultiplier: 1.0,
    fontFamily: isScientific
      ? styleManager.getScientificConfig().fontFamily
      : 'Arial, Helvetica, sans-serif',
    backgroundColor: styleManager.getColor('theme.background.primary'),
    textColor: styleManager.getColor('theme.text.primary'),
    gridColor: styleManager.getColor('theme.border.default'),
    barColor: styleManager.getColor('chart.bar.default'),
    selectedColor: styleManager.getColor('chart.bar.selected'),
    isScientific,
    margin: { l: 60, r: 15, t: 10, b: 50 },
  }
}

// Build HistogramInput from Vue props
const buildInput = (): HistogramInput => {
  const colorByActive = props.colorByAttribute && props.colorByAttribute !== ''
  const colorByType = colorByActive ? detectColorByType(props.colorByAttribute!) : undefined

  // Build color map for categorical color-by (StyleManager-aware)
  let colorMap: Map<string, string> | undefined
  if (colorByActive && colorByType === 'categorical') {
    const styleManager = StyleManager.getInstance()
    const categories = Array.from(
      new Set(
        props.filteredData
          ?.map(row => row[props.colorByAttribute!])
          .filter(v => v !== null && v !== undefined)
      )
    ).map(String)
    // Sort for consistent color assignment
    const nums = categories.map(Number)
    const sorted = nums.every(v => Number.isFinite(v))
      ? [...categories].sort((a, b) => Number(a) - Number(b))
      : [...categories].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    colorMap = styleManager.buildCategoricalColorMap(sorted)
  }

  return {
    filteredData: props.filteredData,
    baselineData: props.baselineData,
    column: props.column,
    binSize: props.binSize,
    // Use formatted title with units from chartFormatting utility
    title: formatChartTitle(props.column, props.tableConfig?.columns?.formats),
    xMin: props.xMin,
    xMax: props.xMax,
    autoTrim: props.autoTrim,
    colorBy: colorByActive ? props.colorByAttribute : undefined,
    colorByType,
    colorMap,
    showComparison: props.showComparison,
  }
}

// Build chart data (traces, layout, config) using shared trace builder
// Then apply interactive-specific overrides
const buildChartData = () => {
  const style = resolveInteractiveStyle()
  const input = buildInput()
  const figure = buildHistogramFigure(input, style)

  const styleManager = StyleManager.getInstance()
  const comparisonConfig = styleManager.getComparisonConfig()

  debugLog('[HistogramCard] buildChartData - showComparison:', props.showComparison)

  // Determine color-by state for override logic
  const colorByActive = props.colorByAttribute && props.colorByAttribute !== ''
  const colorByType = colorByActive ? detectColorByType(props.colorByAttribute!) : 'categorical'
  const bgColor = style.backgroundColor

  // --- Interactive override 1: Baseline trace uses StyleManager comparison colors ---
  if (props.showComparison && figure.traces.length > 0) {
    const baselineTrace = figure.traces.find((t: any) => t.name === 'Baseline (All Data)')
    if (baselineTrace) {
      debugLog('[HistogramCard] Applying StyleManager baseline colors')
      ;(baselineTrace as any).marker = {
        color: styleManager.getComparisonBaselineColor(),
        line: {
          color: comparisonConfig.baseline.lineColor,
          width: comparisonConfig.baseline.lineWidth,
        },
      }
    }
  }

  // --- Interactive override 2: Comparison filtered trace line uses StyleManager ---
  for (const trace of figure.traces) {
    const t = trace as any
    if (t.name === 'Baseline (All Data)') continue  // Already handled above
    if (t.marker?.line) {
      t.marker.line.color = props.showComparison ? comparisonConfig.filtered.lineColor : bgColor
      t.marker.line.width = props.showComparison ? comparisonConfig.filtered.lineWidth : 1
    }
  }

  // --- Interactive override 3: Selected bin highlighting (standard single-trace only) ---
  if (!colorByActive && selectedBins.value.size > 0) {
    const mainTrace = figure.traces.find((t: any) => t.name !== 'Baseline (All Data)') as any
    if (mainTrace?.marker && Array.isArray(mainTrace.x)) {
      mainTrace.marker.color = mainTrace.x.map((bin: number) =>
        selectedBins.value.has(bin) ? style.selectedColor : style.barColor
      )
    }
  }

  // --- Interactive override 4: Format category names with formatLabel ---
  if (colorByActive && colorByType === 'categorical') {
    for (const trace of figure.traces) {
      const t = trace as any
      if (t.name === 'Baseline (All Data)') continue
      // The builder uses raw category strings as names; apply formatLabel for display
      t.name = formatLabel(t.name, props.tableConfig?.columns?.formats, props.colorByAttribute)
    }
  }

  // --- Interactive override 5: Numeric color-by colorbar title uses formatChartTitle ---
  if (colorByActive && colorByType === 'numeric') {
    const numericTrace = figure.traces.find((t: any) => (t as any).marker?.colorbar) as any
    if (numericTrace?.marker?.colorbar?.title) {
      numericTrace.marker.colorbar.title.text = formatChartTitle(
        props.colorByAttribute!,
        props.tableConfig?.columns?.formats,
        {
          labelOverride: props.colorByOptions?.find(opt => opt.attribute === props.colorByAttribute)?.label || undefined,
          stripEmptyUnits: true,
        }
      )
    }
  }

  // --- Interactive override 6: Categorical legend title uses formatChartTitle ---
  if (colorByActive && colorByType === 'categorical') {
    const layout = figure.layout as any
    if (layout.legend?.title) {
      layout.legend.title.text = formatChartTitle(
        props.colorByAttribute!,
        props.tableConfig?.columns?.formats,
        {
          labelOverride: props.colorByOptions?.find(opt => opt.attribute === props.colorByAttribute)?.label || undefined,
          stripEmptyUnits: true,
        }
      )
    }
  }

  // --- Interactive override 7: Custom tick formatting from column format config ---
  // The builder uses String(v) for tick text; we need formatTickValue for time/duration/distance
  const xaxis = (figure.layout as any).xaxis
  if (xaxis) {
    if (xaxis.tickmode === 'array' && xaxis.tickvals) {
      // Builder already applied tick thinning; reformat tick labels
      xaxis.ticktext = xaxis.tickvals.map((v: number) => formatTickValue(v))
    } else if (columnFormat.value) {
      // No tick thinning from builder, but we have custom format config
      // Build tick arrays from the data bins for custom formatting
      const binSize = props.binSize || 1
      const bins = new Map<number, boolean>()
      for (const row of props.filteredData) {
        const val = row[props.column]
        if (val !== null && val !== undefined && typeof val === 'number' && !isNaN(val)) {
          bins.set(Math.floor(val / binSize) * binSize, true)
        }
      }
      const tickvals = Array.from(bins.keys()).sort((a, b) => a - b)
      const ticktext = tickvals.map(v => formatTickValue(v))

      // Apply tick thinning logic with formatted labels
      const numBins = tickvals.length
      const maxLabelLength = ticktext.length > 0 ? Math.max(...ticktext.map(t => t.length)) : 1
      const maxTicksToShow = maxLabelLength <= 4 ? 12 : maxLabelLength <= 6 ? 10 : 8

      if (numBins > maxTicksToShow) {
        const skipInterval = Math.max(1, Math.ceil(numBins / maxTicksToShow))
        const thinnedTickvals: number[] = []
        const thinnedTicktext: string[] = []
        tickvals.forEach((val, idx) => {
          if (idx === 0 || idx === tickvals.length - 1 || idx % skipInterval === 0) {
            thinnedTickvals.push(val)
            thinnedTicktext.push(ticktext[idx])
          }
        })
        xaxis.tickmode = 'array'
        xaxis.tickvals = thinnedTickvals
        xaxis.ticktext = thinnedTicktext
      } else {
        xaxis.tickmode = 'array'
        xaxis.tickvals = tickvals
        xaxis.ticktext = ticktext
      }

      // Re-evaluate rotation based on formatted label length
      const shouldRotate = maxLabelLength > 4 && numBins > 3
      xaxis.tickangle = shouldRotate ? -45 : 0
    }
  }

  return {
    traces: figure.traces as any[],
    layout: figure.layout,
    config: figure.config || { displayModeBar: false, responsive: true },
  }
}

// Click handler extracted as named function - registered ONCE during initialization
const handleClick = (data: any) => {
  const bin = data.points[0].x

  // Toggle bin in selection
  if (selectedBins.value.has(bin)) {
    selectedBins.value.delete(bin)
  } else {
    selectedBins.value.add(bin)
  }

  // Emit filter with all selected bins (using 'binned' filter type)
  if (props.linkage?.type === 'filter') {
    const filterId = `histogram-${props.column}`
    const binSize = props.binSize || 1
    // Set flag so the filteredData watcher knows this change is from our own filter
    justEmittedFilter.value = true
    emit('filter', filterId, props.column, new Set(selectedBins.value), 'binned', binSize)
  }

  debouncedRenderChart()
}

// Initial chart creation - registers event handlers ONCE (matches ScatterCard pattern)
const initializeChart = () => {
  if (!plotContainer.value || props.filteredData.length === 0) return

  const { traces, layout, config } = buildChartData()

  Plotly.newPlot(plotContainer.value, traces, layout, config)
  chartInitialized = true

  debugLog('[HistogramCard] Chart INITIALIZED, registering click handler for:', props.title || props.column)

  // Register click handler ONCE during initialization
  // Plotly.react() preserves event handlers, so this only needs to happen once
  ;(plotContainer.value as any).on('plotly_click', handleClick)
}

// Update chart data - uses Plotly.react to preserve event handlers
const updateChart = () => {
  if (!plotContainer.value) return

  // If no data, nothing to render
  if (props.filteredData.length === 0) return

  const { traces, layout, config } = buildChartData()

  if (chartInitialized) {
    // Use Plotly.react to update data/layout (preserves event handlers)
    Plotly.react(plotContainer.value, traces, layout, config)
    debugLog('[HistogramCard] Chart updated for:', props.title || props.column)
  } else {
    // First render - initialize
    initializeChart()
  }
}

// Track if we just emitted a filter (to distinguish our own filter changes from external)
const justEmittedFilter = ref(false)

watch(() => props.filteredData, (newData, oldData) => {
  // If filteredData has grown significantly AND we didn't just emit a filter,
  // it means an external filter was removed - clear our selection
  // This prevents clearing selection during multi-select (when our OR filter broadens results)
  if (oldData && newData.length > previousFilteredDataLength.value && selectedBins.value.size > 0) {
    if (!justEmittedFilter.value) {
      debugLog('[HistogramCard] External filters cleared, resetting selection')
      selectedBins.value.clear()
    }
  }
  previousFilteredDataLength.value = newData.length
  justEmittedFilter.value = false  // Reset flag after processing
  debouncedRenderChart()
})

// Re-render on dark mode change or color scheme changes (including scientific mode)
watch(() => globalStore.state.colorScheme, () => {
  debouncedRenderChart()
})

// Re-render when comparison mode changes
watch(() => props.showComparison, (newVal) => {
  debugLog('[HistogramCard] showComparison changed to:', newVal, '- re-rendering')
  debouncedRenderChart()
})

// Re-render when baseline data changes
watch(() => props.baselineData, () => {
  if (props.showComparison) {
    debugLog('[HistogramCard] baselineData changed in comparison mode - re-rendering')
    debouncedRenderChart()
  }
})

// Re-render when color-by attribute changes
watch(() => props.colorByAttribute, () => {
  debugLog('[HistogramCard] colorByAttribute changed to:', props.colorByAttribute)
  debouncedRenderChart()
})

// Resize observer for responsive chart sizing (matches ScatterCard pattern)
let resizeObserver: ResizeObserver | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

function handleResize() {
  // Debounce resize calls to allow DOM to settle (especially after fullscreen transitions)
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  resizeTimeout = setTimeout(() => {
    if (plotContainer.value) {
      debugLog('[HistogramCard] Executing Plotly resize')
      Plotly.Plots.resize(plotContainer.value)
    }
    resizeTimeout = null
  }, 100)
}

onMounted(() => {
  previousFilteredDataLength.value = props.filteredData.length
  initializeChart()

  // Set up resize observer to handle container size changes
  if (plotContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      // Debounce resize calls
      nextTick(() => handleResize())
    })
    resizeObserver.observe(plotContainer.value)
  }

  // Also listen for window resize events (for fullscreen)
  window.addEventListener('resize', handleResize)

  // Notify parent that card is loaded (hides loading spinner)
  emit('isLoaded')
})

onUnmounted(() => {
  // Reset chart state
  chartInitialized = false

  // Clean up resize observer and timeout
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
})
</script>

<style scoped>
.histogram-card {
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
