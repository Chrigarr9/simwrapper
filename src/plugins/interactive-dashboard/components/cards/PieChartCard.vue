<template>
  <div class="pie-chart-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { getCategoryColor, buildColorMap } from '../../utils/colorSchemes'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'
import { debugLog } from '../../utils/debug'

interface Props {
  title?: string
  column: string
  filteredData?: any[]  // From LinkableCardWrapper (optional for safety)
  baselineData?: any[]  // All data (unfiltered) - from LinkableCardWrapper
  showComparison?: boolean  // Whether comparison mode is active
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  baselineData: () => [],
  showComparison: false
})
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
  isLoaded: []
}>()

// Dark mode access from global store
const isDarkMode = computed(() => globalStore.state.isDarkMode)

// Color map for consistent category colors
const colorMap = ref<Map<string, string>>(new Map())

const plotContainer = ref<HTMLElement>()
const selectedCategories = ref<Set<string>>(new Set())
const previousFilteredDataLength = ref(0)

const pieData = computed(() => {
  // Defensive check - filteredData might be undefined if not wrapped properly
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[PieChartCard] No filtered data available')
    return []
  }

  debugLog('[PieChartCard] Computing pie chart from', props.filteredData.length, 'rows')

  const counts = new Map<string, number>()
  props.filteredData.forEach(row => {
    const val = row[props.column]
    if (val !== null && val !== undefined) {
      counts.set(String(val), (counts.get(String(val)) || 0) + 1)
    }
  })

  // Sort by count descending
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

  // Build color map for all unique values
  const values = sorted.map(([label]) => label)
  colorMap.value = buildColorMap(values)

  return sorted.map(([label, value]) => ({ label, value }))
})

const baselinePieData = computed(() => {
  // Only compute if comparison mode is active and we have baseline data
  if (!props.showComparison || !props.baselineData || props.baselineData.length === 0) {
    debugLog('[PieChartCard] No baseline data for comparison')
    return []
  }

  debugLog('[PieChartCard] Computing baseline pie from', props.baselineData.length, 'rows')

  const counts = new Map<string, number>()
  props.baselineData.forEach(row => {
    const val = row[props.column]
    if (val !== null && val !== undefined) {
      counts.set(String(val), (counts.get(String(val)) || 0) + 1)
    }
  })

  // Sort by count descending (same as pieData)
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

  return sorted.map(([label, value]) => ({ label, value }))
})

const renderChart = () => {
  if (!plotContainer.value || pieData.value.length === 0) return

  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const lineColor = styleManager.getColor('theme.border.default')

  // Get colors - use color map for each category, darken if selected
  const colors = pieData.value.map(d => {
    const baseColor = colorMap.value.get(d.label) || getCategoryColor(d.label)
    if (selectedCategories.value.size > 0 && !selectedCategories.value.has(d.label)) {
      // Dim unselected slices
      return baseColor + '66' // Add alpha for dimming
    }
    return baseColor
  })

  const traces: any[] = []

  // Main pie chart (inner ring when comparison active)
  const mainTrace = {
    labels: pieData.value.map(d => d.label),
    values: pieData.value.map(d => d.value),
    type: 'pie',
    marker: {
      colors,
      line: {
        // Selected slices get white border for contrast, others use theme border
        color: pieData.value.map(d =>
          selectedCategories.value.has(d.label) ? '#ffffff' : lineColor
        ),
        width: pieData.value.map(d =>
          selectedCategories.value.has(d.label) ? 3 : 1
        ),
      },
    },
    textinfo: 'percent+label',
    textfont: { color: textColor, size: 11 },
    outsidetextfont: { color: textColor, size: 11 },
    hovertemplate: '%{label}: %{value} (%{percent})<extra></extra>',
    hole: props.showComparison ? 0.4 : 0.3,  // Smaller hole for inner ring
    // Constrain to inner area when comparison active
    domain: props.showComparison ? { x: [0.15, 0.85], y: [0.15, 0.85] } : undefined,
  }
  traces.push(mainTrace)

  // Baseline ring (if comparison mode) - outer ring with transparency
  if (props.showComparison && baselinePieData.value.length > 0) {
    // Use same color map but with transparency
    const baselineColors = baselinePieData.value.map(d => {
      const baseColor = colorMap.value.get(d.label) || getCategoryColor(d.label)
      return baseColor + '80' // Add 50% alpha (hex 80 = 128/255)
    })

    traces.push({
      labels: baselinePieData.value.map(d => d.label),
      values: baselinePieData.value.map(d => d.value),
      type: 'pie',
      marker: {
        colors: baselineColors,
      },
      textinfo: 'none', // No text on baseline ring
      hovertemplate: '<b>Baseline: %{label}</b><br>%{value} (%{percent})<extra></extra>',
      hole: 0.7, // Large hole for outer ring
      domain: { x: [0, 1], y: [0, 1] }, // Full area
    })
  }

  Plotly.newPlot(
    plotContainer.value,
    traces,
    {
      title: {
        text: '',  // Title is shown in card header
        font: { color: textColor },
      },
      margin: { t: 10, b: 10, l: 10, r: 10 },
      autosize: true,
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      showlegend: true,
      legend: {
        font: { color: textColor, size: 11 },
        bgcolor: 'transparent',
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.1,
      },
      annotations: [
        {
          text: props.showComparison
            ? `<b>${props.filteredData?.length || 0}</b><br><span style="font-size:9px">of ${props.baselineData?.length || 0}</span>`
            : `<b>${pieData.value.reduce((sum, d) => sum + d.value, 0)}</b>`,
          x: 0.5,
          y: 0.5,
          xref: 'paper',
          yref: 'paper',
          showarrow: false,
          font: { size: 14, color: textColor },
        },
      ],
    },
    {
      displayModeBar: false,
      responsive: true,
    }
  )

  // Click handler - only respond to main pie trace (trace index 0)
  plotContainer.value.on('plotly_click', (data: any) => {
    // Ignore clicks on baseline trace (trace index 1)
    if (data.points[0].curveNumber !== 0) return

    const category = data.points[0].label

    // Toggle category
    if (selectedCategories.value.has(category)) {
      selectedCategories.value.delete(category)
    } else {
      selectedCategories.value.add(category)
    }

    // Emit filter
    if (props.linkage?.type === 'filter') {
      const filterId = `pie-${props.column}`
      emit('filter', filterId, props.column, new Set(selectedCategories.value))
    }

    renderChart()
  })
}

watch(() => props.filteredData, (newData, oldData) => {
  // If filteredData has grown significantly (filters were removed), clear selection
  if (oldData && newData.length > previousFilteredDataLength.value && selectedCategories.value.size > 0) {
    debugLog('[PieChartCard] Filters cleared, resetting selection')
    selectedCategories.value.clear()
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

  // Notify parent that card is loaded (hides loading spinner)
  emit('isLoaded')
})
</script>

<style scoped>
.pie-chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
}

.plot-container {
  flex: 1;
}
</style>
