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
import { toTitleCase } from '../../utils/labelFormatter'
import { computeAxisRange } from '../../utils/axisLimits'

interface ColumnFormat {
  type: 'time' | 'duration' | 'distance' | 'decimal'
  convertFrom?: string
  unit?: string
  decimals?: number
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

// Format axis label with unit suffix based on column format
// Returns "Column Name [unit]" format, e.g., "Distance [km]", "Duration [min]"
function formatAxisLabel(column: string): string {
  const format = columnFormat.value
  if (!format) {
    // Title case the column name
    return column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  // Get the display name (title case)
  const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  switch (format.type) {
    case 'time':
      return `${displayName} [hh:mm]`
    case 'duration':
      if (format.unit === 'min') return `${displayName} [min]`
      if (format.unit === 's') return `${displayName} [s]`
      return displayName
    case 'distance':
      if (format.unit === 'km') return `${displayName} [km]`
      if (format.unit === 'm') return `${displayName} [m]`
      return displayName
    case 'percent':
      return `${displayName} [%]`
    case 'decimal':
      // Support custom unit field for decimal type
      if (format.unit) return `${displayName} [${format.unit}]`
      return displayName
    default:
      return displayName
  }
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

const baselineHistogramData = computed(() => {
  // Compute baseline histogram from all data (baselineData or filteredData as fallback)
  const dataSource = props.baselineData?.length > 0 ? props.baselineData : props.filteredData
  if (!dataSource || dataSource.length === 0) {
    debugLog('[HistogramCard] No baseline data available')
    return []
  }

  debugLog('[HistogramCard] Computing baseline histogram from', dataSource.length, 'rows')

  const values = dataSource.map(row => row[props.column])
  const binSize = props.binSize || 1

  // Create bins from baseline data - this defines the canonical bin boundaries
  const bins = new Map<number, number>()
  values.forEach(val => {
    if (val !== null && val !== undefined) {
      const bin = Math.floor(val / binSize) * binSize
      bins.set(bin, (bins.get(bin) || 0) + 1)
    }
  })

  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({ bin, count }))
})

const histogramData = computed(() => {
  // Defensive check - filteredData might be undefined if not wrapped properly
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[HistogramCard] No filtered data available')
    return []
  }

  debugLog('[HistogramCard] Computing histogram from', props.filteredData.length, 'rows')

  const binSize = props.binSize || 1

  // In comparison mode, use baseline bins to ensure alignment
  // This guarantees filtered bars overlay exactly on baseline bars
  if (props.showComparison && baselineHistogramData.value.length > 0) {
    // Start with all baseline bins set to 0
    const bins = new Map<number, number>()
    baselineHistogramData.value.forEach(d => bins.set(d.bin, 0))

    // Count filtered values into the baseline bin structure
    props.filteredData.forEach(row => {
      const val = row[props.column]
      if (val !== null && val !== undefined) {
        const bin = Math.floor(val / binSize) * binSize
        if (bins.has(bin)) {
          bins.set(bin, bins.get(bin)! + 1)
        }
        // Note: filtered values outside baseline range are ignored for alignment
      }
    })

    return Array.from(bins.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([bin, count]) => ({ bin, count }))
  }

  // Non-comparison mode: compute bins directly from filtered data
  const values = props.filteredData.map(row => row[props.column])
  const bins = new Map<number, number>()
  values.forEach(val => {
    if (val !== null && val !== undefined) {
      const bin = Math.floor(val / binSize) * binSize
      bins.set(bin, (bins.get(bin) || 0) + 1)
    }
  })

  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({ bin, count }))
})

// Density data: convert counts to percentages for comparison mode
// Enables meaningful shape comparison between filtered and baseline distributions
const histogramDataDensity = computed(() => {
  if (!props.showComparison) return histogramData.value
  const total = histogramData.value.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) return histogramData.value
  return histogramData.value.map(d => ({
    bin: d.bin,
    count: (d.count / total) * 100
  }))
})

// Baseline density: convert counts to percentages for comparison mode
const baselineHistogramDataDensity = computed(() => {
  if (!props.showComparison) return baselineHistogramData.value
  const total = baselineHistogramData.value.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) return baselineHistogramData.value
  return baselineHistogramData.value.map(d => ({
    bin: d.bin,
    count: (d.count / total) * 100
  }))
})

// Compute x-axis range from explicit min/max or autoTrim config
// Uses baseline data (if available) so the range stays stable when filtering
const xAxisRange = computed(() => {
  const dataSource = props.baselineData?.length > 0 ? props.baselineData : props.filteredData
  if (!dataSource || dataSource.length === 0) return undefined

  const values = dataSource
    .map(row => row[props.column])
    .filter((v: any) => v !== null && v !== undefined && typeof v === 'number' && !isNaN(v))

  return computeAxisRange({
    values,
    min: props.xMin,
    max: props.xMax,
    autoTrim: props.autoTrim,
    padding: 0.02,
  })
})

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

// Build chart data (traces, layout, config) - extracted for reuse by initializeChart/updateChart
const buildChartData = () => {
  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const isScientific = styleManager.isScientificMode()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')
  const barColor = styleManager.getColor('chart.bar.default')
  // Selected color for user selection feedback
  const selectedColor = styleManager.getColor('chart.bar.selected')

  // Scientific mode font configuration
  const fontFamily = isScientific
    ? styleManager.getScientificConfig().fontFamily
    : undefined

  // Format tick values if column format is defined
  const tickvals = histogramData.value.map(d => d.bin)
  const ticktext = tickvals.map(v => formatTickValue(v))

  // Build traces array for dual-trace rendering
  // In comparison mode, use density (percentage) data for meaningful shape comparison
  const traces: any[] = []
  const usePercentage = props.showComparison
  const displayData = usePercentage ? histogramDataDensity.value : histogramData.value
  const baselineDisplayData = usePercentage ? baselineHistogramDataDensity.value : baselineHistogramData.value

  // Determine if color-by is active and what type
  const colorByActive = props.colorByAttribute && props.colorByAttribute !== ''
  const colorByType = colorByActive ? detectColorByType(props.colorByAttribute!) : 'categorical'

  // Bar width based on bin size - use natural width without forcing minimum
  // This avoids overlap when data has outliers stretching the x-axis
  const binSize = props.binSize || 1
  const barWidth = binSize * 0.85  // 85% of bin size for slight gap between bars

  // Baseline trace (if comparison mode) - styled from StyleManager
  // NO patterns - just opacity difference distinguishes baseline from filtered
  const comparisonConfig = styleManager.getComparisonConfig()
  debugLog('[HistogramCard] buildChartData - showComparison:', props.showComparison, 'baselineHistogramData length:', baselineHistogramData.value.length)
  if (props.showComparison && baselineDisplayData.length > 0) {
    debugLog('[HistogramCard] Adding baseline trace (density mode)')
    traces.push({
      x: baselineDisplayData.map(d => d.bin),
      y: baselineDisplayData.map(d => d.count),
      type: 'bar',
      name: 'Baseline (All Data)',
      width: barWidth,  // Match filtered trace width
      marker: {
        color: styleManager.getComparisonBaselineColor(),  // From StyleManager
        line: {
          color: comparisonConfig.baseline.lineColor,
          width: comparisonConfig.baseline.lineWidth,
        },
      },
      hovertemplate: usePercentage
        ? '<b>%{x}</b><br>Baseline: %{y:.1f}%<extra></extra>'
        : '<b>%{x}</b><br>Baseline: %{y}<extra></extra>',
    })
  }

  // Color-by rendering for filtered data
  if (colorByActive && colorByType === 'categorical') {
    // Categorical color-by: stacked bar traces per category
    const colorByValues = Array.from(
      new Set(
        props.filteredData
          ?.map(row => row[props.colorByAttribute!])
          .filter(v => v !== null && v !== undefined)
      )
    ).sort()

    const colorMap = styleManager.buildCategoricalColorMap(colorByValues.map(String))

    // For each category, compute histogram bins
    colorByValues.forEach((categoryValue) => {
      const categoryStr = String(categoryValue)
      const categoryRows = props.filteredData?.filter(
        row => String(row[props.colorByAttribute!]) === categoryStr
      ) || []

      // Count category rows into bins (using same bin boundaries as displayData)
      const categoryBins = new Map<number, number>()
      displayData.forEach(d => categoryBins.set(d.bin, 0))  // Initialize all bins to 0

      categoryRows.forEach(row => {
        const val = row[props.column]
        if (val !== null && val !== undefined) {
          const bin = Math.floor(val / binSize) * binSize
          if (categoryBins.has(bin)) {
            categoryBins.set(bin, categoryBins.get(bin)! + 1)
          }
        }
      })

      const categoryBinArray = Array.from(categoryBins.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([bin, count]) => ({ bin, count }))

      // Convert to percentage if comparison mode
      let categoryDisplayData = categoryBinArray
      if (usePercentage) {
        const total = categoryRows.length
        if (total > 0) {
          categoryDisplayData = categoryBinArray.map(d => ({
            bin: d.bin,
            count: (d.count / total) * 100
          }))
        }
      }

      traces.push({
        x: categoryDisplayData.map(d => d.bin),
        y: categoryDisplayData.map(d => d.count),
        type: 'bar',
        name: toTitleCase(categoryStr),
        width: barWidth,
        marker: {
          color: colorMap.get(categoryStr) || barColor,
          line: {
            color: props.showComparison ? comparisonConfig.filtered.lineColor : bgColor,
            width: props.showComparison ? comparisonConfig.filtered.lineWidth : 1,
          },
        },
        hovertemplate: usePercentage
          ? `<b>%{x}</b><br>${categoryStr}: %{y:.1f}%<extra></extra>`
          : `<b>%{x}</b><br>${categoryStr}: %{y}<extra></extra>`,
      })
    })
  } else if (colorByActive && colorByType === 'numeric') {
    // Numeric color-by: color each bar by average value of color-by attribute within that bin
    const binAverages = displayData.map(d => {
      const binRows = props.filteredData?.filter(row => {
        const val = row[props.column]
        if (val === null || val === undefined) return false
        const bin = Math.floor(val / binSize) * binSize
        return bin === d.bin
      }) || []

      if (binRows.length === 0) return null

      const colorValues = binRows
        .map(row => row[props.colorByAttribute!])
        .filter(v => v !== null && v !== undefined && typeof v === 'number')

      if (colorValues.length === 0) return null

      const sum = colorValues.reduce((acc, v) => acc + v, 0)
      return sum / colorValues.length
    })

    traces.push({
      x: displayData.map(d => d.bin),
      y: displayData.map(d => d.count),
      type: 'bar',
      name: props.showComparison ? 'Filtered' : 'Count',
      width: barWidth,
      marker: {
        color: binAverages,
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
          title: { text: props.colorByOptions?.find(opt => opt.attribute === props.colorByAttribute)?.label || props.colorByAttribute, font: { color: textColor, size: 11, family: fontFamily }, side: 'right' },
          tickfont: { color: textColor, size: 9, family: fontFamily },
        },
        line: {
          color: props.showComparison ? comparisonConfig.filtered.lineColor : bgColor,
          width: props.showComparison ? comparisonConfig.filtered.lineWidth : 1,
        },
      },
      hovertemplate: usePercentage
        ? '<b>%{x}</b><br>Filtered: %{y:.1f}%<extra></extra>'
        : '<b>%{x}</b><br>Filtered: %{y}<extra></extra>',
    })
  } else {
    // No color-by: standard single-trace histogram
    traces.push({
      x: displayData.map(d => d.bin),
      y: displayData.map(d => d.count),
      type: 'bar',
      name: props.showComparison ? 'Filtered' : 'Count',
      width: barWidth,  // Explicit bar width for consistent sizing
      marker: {
        color: displayData.map(d =>
          selectedBins.value.has(d.bin) ? selectedColor : barColor
        ),
        // Solid color - no patterns. In comparison mode, add outline from StyleManager
        line: {
          color: props.showComparison ? comparisonConfig.filtered.lineColor : bgColor,
          width: props.showComparison ? comparisonConfig.filtered.lineWidth : 1,
        },
      },
      hovertemplate: usePercentage
        ? '<b>%{x}</b><br>Filtered: %{y:.1f}%<extra></extra>'
        : '<b>%{x}</b><br>Filtered: %{y}<extra></extra>',
    })
  }

  // Build xaxis config with intelligent tick thinning
  // When there are many bins, we need to auto-skip tick labels to prevent overlap
  const numBins = histogramData.value.length

  // Calculate actual max label length from generated tick text
  // This determines both rotation and tick density
  const maxLabelLength = Math.max(...ticktext.map(t => t.length))

  // Adaptive maxTicksToShow based on actual label width
  // Longer labels need more space, so show fewer of them
  // Short labels (1-4 chars): 12 ticks, Medium (5-6): 10, Long (7+): 8
  const maxTicksToShow = maxLabelLength <= 4 ? 12 : (maxLabelLength <= 6 ? 10 : 8)

  // Rotate labels only when they're actually long (>4 chars) AND we have multiple bins
  // Short labels like "1", "2", "100" stay horizontal for cleaner appearance
  const shouldRotate = maxLabelLength > 4 && numBins > 3

  const xaxisConfig: any = {
    title: { text: formatAxisLabel(props.column), font: { color: textColor, size: 11, family: fontFamily } },
    tickfont: { color: textColor, size: 10, family: fontFamily },
    gridcolor: gridColor,
    linecolor: isScientific ? textColor : gridColor,  // Black axis line in scientific
    linewidth: isScientific ? 1.5 : 1,
    showline: true,
    zerolinecolor: gridColor,
    automargin: true,  // Let Plotly expand margins for long labels
    tickangle: shouldRotate ? -45 : 0,
  }

  // Apply configured axis range (from xMin/xMax or autoTrim YAML config)
  const axisRange = xAxisRange.value
  if (axisRange) {
    xaxisConfig.range = axisRange
    xaxisConfig.autorange = false
  }

  // Apply intelligent tick thinning when we have many bins
  if (numBins > maxTicksToShow) {
    // Calculate tick skip interval: show at most maxTicksToShow labels
    const skipInterval = Math.max(1, Math.ceil(numBins / maxTicksToShow))

    // Filter tick values and text to show only every nth tick
    const thinnedTickvals: number[] = []
    const thinnedTicktext: string[] = []

    tickvals.forEach((val, idx) => {
      // Always show first and last tick, plus evenly spaced ticks in between
      if (idx === 0 || idx === tickvals.length - 1 || idx % skipInterval === 0) {
        thinnedTickvals.push(val)
        thinnedTicktext.push(ticktext[idx])
      }
    })

    xaxisConfig.tickmode = 'array'
    xaxisConfig.tickvals = thinnedTickvals
    xaxisConfig.ticktext = thinnedTicktext
  }

  const layout = {
    title: {
      text: '',  // Title is shown in card header
      font: { color: textColor, size: 14, family: fontFamily },
    },
    font: {
      family: fontFamily,
      color: textColor,
    },
    xaxis: xaxisConfig,
    yaxis: {
      title: { text: usePercentage ? 'Percentage [%]' : 'Count', font: { color: textColor, size: 11, family: fontFamily } },
      tickfont: { color: textColor, size: 10, family: fontFamily },
      gridcolor: gridColor,
      linecolor: isScientific ? textColor : gridColor,  // Black axis line in scientific
      linewidth: isScientific ? 1.5 : 1,
      showline: true,
      zerolinecolor: gridColor,
      automargin: true,  // Let Plotly expand margins for large count values
    },
    margin: { l: 60, r: 15, t: 10, b: 50 },
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    bargap: 0.1,
    barmode: 'overlay',  // Always overlay mode - baseline behind filtered
    showlegend: props.showComparison,  // Show legend only in comparison mode
    legend: {
      x: 1,
      xanchor: 'right',
      y: 1,
      font: { color: textColor, size: 10 },
    },
  }

  // Override layout for color-by modes
  if (colorByActive && colorByType === 'categorical') {
    const legendTitle = props.colorByOptions?.find(opt => opt.attribute === props.colorByAttribute)?.label || props.colorByAttribute
    layout.barmode = 'stack'  // Stack bars when categorical color-by is active
    layout.showlegend = true
    layout.legend = {
      title: { text: legendTitle, font: { color: textColor, size: 11, family: fontFamily } },
      x: 1.02,
      xanchor: 'left',
      y: 1,
      yanchor: 'top',
      font: { color: textColor, size: 10, family: fontFamily },
      bgcolor: 'rgba(0,0,0,0)',
      borderwidth: 0,
    }
    layout.margin.r = 100  // More space for legend
  } else if (colorByActive && colorByType === 'numeric') {
    layout.margin.r = 80  // Space for colorbar
  }

  const config = {
    displayModeBar: false,  // Always hide modebar
    responsive: true,
  }

  return { traces, layout, config }
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
  if (!plotContainer.value || histogramData.value.length === 0) return

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
  if (histogramData.value.length === 0) return

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
