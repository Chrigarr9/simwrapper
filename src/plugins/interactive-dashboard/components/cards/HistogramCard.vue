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

const renderChart = () => {
  if (!plotContainer.value || histogramData.value.length === 0) return

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

  // Bar width based on bin size - use natural width without forcing minimum
  // This avoids overlap when data has outliers stretching the x-axis
  const binSize = props.binSize || 1
  const barWidth = binSize * 0.85  // 85% of bin size for slight gap between bars

  // Baseline trace (if comparison mode) - shown in background with low opacity
  debugLog('[HistogramCard] renderChart - showComparison:', props.showComparison, 'baselineHistogramData length:', baselineHistogramData.value.length)
  if (props.showComparison && baselineDisplayData.length > 0) {
    debugLog('[HistogramCard] Adding baseline trace (density mode)')
    traces.push({
      x: baselineDisplayData.map(d => d.bin),
      y: baselineDisplayData.map(d => d.count),
      type: 'bar',
      name: 'Baseline (All Data)',
      width: barWidth,  // Match filtered trace width
      marker: {
        color: 'rgba(156, 163, 175, 0.3)', // Gray with low opacity
        pattern: isScientific ? {
          shape: '.',  // Dots for baseline (filtered uses '/')
          bgcolor: 'rgba(156, 163, 175, 0.3)',
          fgcolor: 'rgba(100, 100, 100, 0.5)',
          size: 6,
          solidity: 0.3
        } : undefined,
      },
      hovertemplate: usePercentage
        ? '<b>%{x}</b><br>Baseline: %{y:.1f}%<extra></extra>'
        : '<b>%{x}</b><br>Baseline: %{y}<extra></extra>',
    })
  }

  // Filtered trace - on top with full colors
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
      // Add pattern in scientific mode when comparison is active
      pattern: (isScientific && props.showComparison) ? {
        shape: '/',  // Diagonal lines for filtered trace
        bgcolor: 'transparent',
        fgcolor: barColor,
        size: 8,
        solidity: 0.5
      } : undefined,
      line: {
        // Use background color for bar outline to create subtle separation
        color: bgColor,
        width: 1,
      },
    },
    hovertemplate: usePercentage
      ? '<b>%{x}</b><br>Filtered: %{y:.1f}%<extra></extra>'
      : '<b>%{x}</b><br>Filtered: %{y}<extra></extra>',
  })

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

  Plotly.newPlot(plotContainer.value, traces, layout, {
    displayModeBar: !isScientific ? false : false,  // Always hide modebar (scientific mode too)
    responsive: true,
  })

  // Click handler - respond to both baseline and filtered trace clicks
  // This enables OR filter functionality: clicking additional bars extends the filter
  plotContainer.value.on('plotly_click', (data: any) => {
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

    renderChart()
  })
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
  renderChart()
}, { deep: true })

// Re-render on dark mode change or color scheme changes (including scientific mode)
watch(() => globalStore.state.colorScheme, () => {
  renderChart()
})

// Re-render when comparison mode changes
watch(() => props.showComparison, (newVal) => {
  console.log('[HistogramCard] showComparison changed to:', newVal, '- re-rendering')
  renderChart()
})

// Re-render when baseline data changes
watch(() => props.baselineData, () => {
  if (props.showComparison) {
    console.log('[HistogramCard] baselineData changed in comparison mode - re-rendering')
    renderChart()
  }
}, { deep: true })

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
  renderChart()

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
  // Clean up resize observer and timeout
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
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
