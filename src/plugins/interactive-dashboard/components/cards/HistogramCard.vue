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
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => []
})
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>, filterType: string, binSize?: number]
  isLoaded: []
}>()

// Dark mode access from global store
const isDarkMode = computed(() => globalStore.state.isDarkMode)

const plotContainer = ref<HTMLElement>()
const selectedBins = ref<Set<number>>(new Set())
const previousFilteredDataLength = ref(0)

// Get format config for this column
const columnFormat = computed((): ColumnFormat | undefined => {
  const format = props.tableConfig?.columns?.formats?.[props.column]
  debugLog('[HistogramCard] Column:', props.column, 'Format:', format, 'TableConfig:', props.tableConfig)
  return format
})

// Format a tick value based on column format
function formatTickValue(value: number): string {
  const format = columnFormat.value
  if (!format) {
    return String(value)
  }

  switch (format.type) {
    case 'time': {
      // Convert seconds to HH:MM format for axis labels
      if (format.convertFrom === 'seconds') {
        const hours = Math.floor(value / 3600)
        const minutes = Math.floor((value % 3600) / 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      }
      return String(value)
    }
    case 'duration': {
      if (format.convertFrom === 'seconds') {
        if (format.unit === 'min') {
          return `${(value / 60).toFixed(0)} min`
        }
        return `${value.toFixed(0)} s`
      }
      return String(value)
    }
    case 'distance': {
      if (format.convertFrom === 'meters') {
        if (format.unit === 'km') {
          return `${(value / 1000).toFixed(1)} km`
        }
        return `${value.toFixed(0)} m`
      }
      return String(value)
    }
    case 'decimal': {
      const decimals = format.decimals ?? 2
      return value.toFixed(decimals)
    }
    default:
      return String(value)
  }
}

const histogramData = computed(() => {
  // Defensive check - filteredData might be undefined if not wrapped properly
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[HistogramCard] No filtered data available')
    return []
  }

  debugLog('[HistogramCard] Computing histogram from', props.filteredData.length, 'rows')

  const values = props.filteredData.map(row => row[props.column])
  const binSize = props.binSize || 1

  // Create bins
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

const renderChart = () => {
  if (!plotContainer.value || histogramData.value.length === 0) return

  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')
  const barColor = styleManager.getColor('chart.bar.default')
  // Selected color for user selection feedback
  const selectedColor = styleManager.getColor('chart.bar.selected')

  // Format tick values if column format is defined
  const tickvals = histogramData.value.map(d => d.bin)
  const ticktext = tickvals.map(v => formatTickValue(v))

  const trace = {
    x: histogramData.value.map(d => d.bin),
    y: histogramData.value.map(d => d.count),
    type: 'bar',
    marker: {
      color: histogramData.value.map(d =>
        selectedBins.value.has(d.bin) ? selectedColor : barColor
      ),
      line: {
        // Use background color for bar outline to create subtle separation
        color: bgColor,
        width: 1,
      },
    },
  }

  // Build xaxis config with optional tick formatting
  const xaxisConfig: any = {
    title: { text: '', font: { color: textColor, size: 11 } },
    tickfont: { color: textColor, size: 10 },
    gridcolor: gridColor,
    linecolor: gridColor,
    zerolinecolor: gridColor,
  }

  // Apply custom tick labels if we have a column format
  if (columnFormat.value) {
    xaxisConfig.tickmode = 'array'
    xaxisConfig.tickvals = tickvals
    xaxisConfig.ticktext = ticktext
  }

  const layout = {
    title: {
      text: '',  // Title is shown in card header
      font: { color: textColor, size: 14 },
    },
    xaxis: xaxisConfig,
    yaxis: {
      title: { text: 'Count', font: { color: textColor, size: 11 } },
      tickfont: { color: textColor, size: 10 },
      gridcolor: gridColor,
      linecolor: gridColor,
      zerolinecolor: gridColor,
    },
    margin: { l: 50, r: 15, t: 10, b: 35 },
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    bargap: 0.1,
  }

  Plotly.newPlot(plotContainer.value, [trace], layout, {
    displayModeBar: false,
    responsive: true,
  })

  // Click handler
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
      emit('filter', filterId, props.column, new Set(selectedBins.value), 'binned', binSize)
    }

    renderChart()
  })
}

watch(() => props.filteredData, (newData, oldData) => {
  // If filteredData has grown significantly (filters were removed), clear selection
  if (oldData && newData.length > previousFilteredDataLength.value && selectedBins.value.size > 0) {
    debugLog('[HistogramCard] Filters cleared, resetting selection')
    selectedBins.value.clear()
  }
  previousFilteredDataLength.value = newData.length
  renderChart()
}, { deep: true })

// Re-render on dark mode change
watch(isDarkMode, () => {
  renderChart()
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
