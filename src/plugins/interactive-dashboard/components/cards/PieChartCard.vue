<template>
  <div class="pie-chart-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'
import { debugLog } from '../../utils/debug'
import { toTitleCase } from '../../utils/labelFormatter'

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


// Color map for consistent category colors
const colorMap = ref<Map<string, string>>(new Map())

const plotContainer = ref<HTMLElement>()
const selectedCategories = ref<Set<string>>(new Set())
const previousFilteredDataLength = ref(0)
// Track if we just emitted a filter (to distinguish our own filter changes from external)
const justEmittedFilter = ref(false)

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

  // Sort by count descending for display
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

  // Build color map using ALPHABETICALLY sorted values for consistent colors
  // This ensures same category always gets same color regardless of count order
  const styleManager = StyleManager.getInstance()
  const alphabeticallySorted = Array.from(counts.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
  colorMap.value = styleManager.buildCategoricalColorMap(alphabeticallySorted)

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
  const isScientific = styleManager.isScientificMode()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const lineColor = styleManager.getColor('theme.border.default')

  // Scientific mode font configuration
  const fontFamily = isScientific
    ? styleManager.getScientificConfig().fontFamily
    : undefined

  // Get colors - use color map for each category, darken if selected
  const colors = pieData.value.map(d => {
    // Use colorMap (always populated by pieData computed), fallback to categorical palette
    const baseColor = colorMap.value.get(d.label) || styleManager.getCategoricalColor(0)
    if (selectedCategories.value.size > 0 && !selectedCategories.value.has(d.label)) {
      // Dim unselected slices
      return baseColor + '66' // Add alpha for dimming
    }
    return baseColor
  })

  const traces: any[] = []

  // Calculate total for percentage threshold
  const total = pieData.value.reduce((sum, d) => sum + d.value, 0)

  // Determine text position per slice based on size
  // Scientific mode: ALL labels outside when patterns are active (cleaner for publication)
  const textPositions = pieData.value.map(d => {
    const pct = (d.value / total) * 100
    if (isScientific) {
      // Scientific mode: always outside for readability over patterns
      if (pct >= 2) return 'outside'
      return 'none'  // Hide tiny slice labels
    }
    // Standard mode
    if (pct >= 10) return 'inside'
    if (pct >= 3) return 'outside'
    return 'none'  // Hide labels for tiny slices - hover still shows details
  })

  // Only show label+percent for slices that have visible text
  const textTemplate = pieData.value.map(d => {
    const pct = (d.value / total) * 100
    if (pct >= 10) return '%{label}<br>%{percent}'  // Inside: label on top, percent below
    if (pct >= 3) return '%{label} %{percent}'  // Outside: inline
    return ''  // Hidden
  })

  // Main pie chart (inner ring when comparison active)
  // Scientific mode uses thicker slice outlines for publication clarity
  // Generate distinct patterns per slice in scientific mode
  const slicePatterns = isScientific
    ? pieData.value.map((_, i) => styleManager.getScientificPiePattern(i))
    : undefined

  const mainTrace: any = {
    labels: pieData.value.map(d => toTitleCase(d.label)),
    values: pieData.value.map(d => d.value),
    type: 'pie',
    name: props.showComparison ? 'Filtered (inner)' : undefined,
    marker: {
      colors,
      pattern: isScientific ? {
        shape: slicePatterns,
        bgcolor: colors,
        fgcolor: pieData.value.map(() => textColor),  // Pattern lines in text color
        size: 10,
        solidity: 0.4
      } : undefined,
      line: {
        // Selected slices get white border for contrast, others use theme border
        color: pieData.value.map(d =>
          selectedCategories.value.has(d.label) ? '#ffffff' : lineColor
        ),
        width: pieData.value.map(d =>
          selectedCategories.value.has(d.label) ? 3 : (isScientific ? 2 : 1)
        ),
      },
    },
    textposition: textPositions,
    texttemplate: textTemplate,
    textfont: {
      color: isScientific ? '#000000' : textColor,  // Pure black for scientific
      size: 11,
      family: fontFamily
    },
    outsidetextfont: { color: textColor, size: 10, family: fontFamily },
    insidetextorientation: 'horizontal',  // Keep inside text readable
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
      const baseColor = colorMap.value.get(d.label) || styleManager.getCategoricalColor(0)
      return baseColor + '80' // Add 50% alpha (hex 80 = 128/255)
    })

    // In scientific mode, match patterns to filtered slices by category label
    // This creates visual unity between inner (filtered) and outer (baseline) slices
    const baselinePatterns = isScientific
      ? baselinePieData.value.map(d => {
          // Find the index of this category in pieData to get matching pattern
          const filteredIndex = pieData.value.findIndex(fd => fd.label === d.label)
          return filteredIndex >= 0
            ? styleManager.getScientificPiePattern(filteredIndex)
            : styleManager.getScientificPiePattern(0)
        })
      : undefined

    traces.push({
      labels: baselinePieData.value.map(d => toTitleCase(d.label)),
      values: baselinePieData.value.map(d => d.value),
      type: 'pie',
      name: 'Baseline (outer)',
      marker: {
        colors: baselineColors,
        pattern: isScientific ? {
          shape: baselinePatterns,
          bgcolor: baselineColors,
          fgcolor: baselinePieData.value.map(() => textColor),
          size: 10,
          solidity: 0.4
        } : undefined,
        line: {
          color: lineColor,
          width: isScientific ? 2 : 1,
        },
      },
      textinfo: 'none', // No text on baseline ring
      hovertemplate: '<b>Baseline: %{label}</b><br>%{value} (%{percent})<extra></extra>',
      hole: 0.7, // Large hole for outer ring
      domain: { x: [0, 1], y: [0, 1] }, // Full area
      showlegend: false,  // Don't duplicate category labels - we'll add annotation instead
    })
  }

  Plotly.newPlot(
    plotContainer.value,
    traces,
    {
      font: {
        family: fontFamily,
        color: textColor,
      },
      title: {
        text: '',  // Title is shown in card header
        font: { color: textColor, family: fontFamily },
      },
      margin: { t: 10, b: 40, l: 15, r: 15 },  // Extra margin for outside labels
      autosize: true,
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      uniformtext: { minsize: 9, mode: 'hide' },  // Hide labels that don't fit
      showlegend: true,
      legend: {
        font: { color: textColor, size: 11, family: fontFamily },
        bgcolor: 'transparent',
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: -0.1,
      },
      annotations: [
        // Center annotation showing count (and ring legend in comparison mode)
        {
          text: props.showComparison
            ? `<b>${props.filteredData?.length || 0}</b><br><span style="font-size:9px">of ${props.baselineData?.length || 0}</span><br><span style="font-size:8px">inner: filtered</span>`
            : `<b>${pieData.value.reduce((sum, d) => sum + d.value, 0)}</b>`,
          x: 0.5,
          y: 0.5,
          xref: 'paper',
          yref: 'paper',
          showarrow: false,
          font: { size: 14, color: textColor, family: fontFamily },
        },
      ],
    },
    {
      displayModeBar: !isScientific ? false : false,  // Always hide modebar
      responsive: true,
    }
  )

  // Click handler - only respond to main pie trace (trace index 0)
  plotContainer.value.on('plotly_click', (data: any) => {
    // Ignore clicks on baseline trace (trace index 1)
    if (data.points[0].curveNumber !== 0) return

    // Use point index to get raw value (since display labels are title-cased)
    const pointIndex = data.points[0].pointNumber
    const category = pieData.value[pointIndex]?.label

    if (!category) return

    // Toggle category
    if (selectedCategories.value.has(category)) {
      selectedCategories.value.delete(category)
    } else {
      selectedCategories.value.add(category)
    }

    // Emit filter
    if (props.linkage?.type === 'filter') {
      const filterId = `pie-${props.column}`
      // Set flag so the filteredData watcher knows this change is from our own filter
      justEmittedFilter.value = true
      emit('filter', filterId, props.column, new Set(selectedCategories.value))
    }

    renderChart()
  })
}

watch(() => props.filteredData, (newData, oldData) => {
  // If filteredData has grown significantly AND we didn't just emit a filter,
  // it means an external filter was removed - clear our selection
  // This prevents clearing selection during multi-select (when our OR filter broadens results)
  if (oldData && newData.length > previousFilteredDataLength.value && selectedCategories.value.size > 0) {
    if (!justEmittedFilter.value) {
      debugLog('[PieChartCard] External filters cleared, resetting selection')
      selectedCategories.value.clear()
    }
  }
  previousFilteredDataLength.value = newData.length
  justEmittedFilter.value = false  // Reset flag after processing
  renderChart()
}, { deep: true })

// Re-render on color scheme changes (including scientific mode)
watch(() => globalStore.state.colorScheme, () => {
  renderChart()
})

// Re-render when comparison mode changes
watch(() => props.showComparison, (newVal) => {
  console.log('[PieChartCard] showComparison changed to:', newVal, '- re-rendering')
  renderChart()
})

// Re-render when baseline data changes
watch(() => props.baselineData, () => {
  if (props.showComparison) {
    console.log('[PieChartCard] baselineData changed in comparison mode - re-rendering')
    renderChart()
  }
}, { deep: true })

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
