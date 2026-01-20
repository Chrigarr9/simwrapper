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
  filter: [filterId: string, column: string, values: Set<any>]
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

  const trace = {
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
    hole: 0.3,  // Make it a donut chart for better aesthetics
  }

  Plotly.newPlot(
    plotContainer.value,
    [trace],
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
    },
    {
      displayModeBar: false,
      responsive: true,
    }
  )

  // Click handler
  plotContainer.value.on('plotly_click', (data: any) => {
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
})
</script>

<style scoped>
.pie-chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plot-container {
  flex: 1;
}
</style>
