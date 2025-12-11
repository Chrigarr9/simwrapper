<template>
  <div class="histogram-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import globalStore from '@/store'

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
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => []
})
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>, filterType: string, binSize?: number]
}>()

// Dark mode access from global store
const isDarkMode = computed(() => globalStore.state.isDarkMode)

const plotContainer = ref<HTMLElement>()
const selectedBins = ref<Set<number>>(new Set())
const previousFilteredDataLength = ref(0)

const histogramData = computed(() => {
  // Defensive check - filteredData might be undefined if not wrapped properly
  if (!props.filteredData || props.filteredData.length === 0) {
    console.log('[HistogramCard] No filtered data available')
    return []
  }

  console.log('[HistogramCard] Computing histogram from', props.filteredData.length, 'rows')

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

  // Theme-aware colors
  const bgColor = isDarkMode.value ? '#1e293b' : '#ffffff'
  const textColor = isDarkMode.value ? '#e2e8f0' : '#374151'
  const gridColor = isDarkMode.value ? '#334155' : '#e5e7eb'
  const barColor = isDarkMode.value ? '#60a5fa' : '#3b82f6'
  const selectedColor = isDarkMode.value ? '#f87171' : '#ef4444'

  const trace = {
    x: histogramData.value.map(d => d.bin),
    y: histogramData.value.map(d => d.count),
    type: 'bar',
    marker: {
      color: histogramData.value.map(d =>
        selectedBins.value.has(d.bin) ? selectedColor : barColor
      ),
      line: {
        color: isDarkMode.value ? '#1e293b' : '#ffffff',
        width: 1,
      },
    },
  }

  const layout = {
    title: {
      text: '',  // Title is shown in card header
      font: { color: textColor, size: 14 },
    },
    xaxis: {
      title: { text: '', font: { color: textColor, size: 11 } },
      tickfont: { color: textColor, size: 10 },
      gridcolor: gridColor,
      linecolor: gridColor,
      zerolinecolor: gridColor,
    },
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
    console.log('[HistogramCard] Filters cleared, resetting selection')
    selectedBins.value.clear()
  }
  previousFilteredDataLength.value = newData.length
  renderChart()
}, { deep: true })

// Re-render on dark mode change
watch(isDarkMode, () => {
  renderChart()
})

onMounted(() => {
  previousFilteredDataLength.value = props.filteredData.length
  renderChart()
})
</script>

<style scoped>
.histogram-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
