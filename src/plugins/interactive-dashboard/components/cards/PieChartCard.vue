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
  colorByAttribute?: string  // Dashboard-level color-by attribute
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

// Detect if colorByAttribute is numeric or categorical
const detectColorByType = (attribute: string): 'numeric' | 'categorical' | null => {
  if (!props.filteredData || props.filteredData.length === 0) return null

  const values = props.filteredData
    .map(row => row[attribute])
    .filter(v => v !== null && v !== undefined)

  if (values.length === 0) return null

  const allNumeric = values.every(v => typeof v === 'number' && !isNaN(v))
  const uniqueCount = new Set(values.map(String)).size

  // Numeric if all numbers and at least 15 unique values
  return (allNumeric && uniqueCount >= 15) ? 'numeric' : 'categorical'
}

// Determine which column to use for pie slices
const effectiveColumn = computed(() => {
  if (!props.colorByAttribute) {
    // No color-by active, use configured column
    return props.column
  }

  const colorByType = detectColorByType(props.colorByAttribute)

  if (colorByType === 'numeric') {
    // Numeric color-by doesn't make sense for pie charts
    debugLog('[PieChartCard] Ignoring numeric color-by attribute — pie charts only support categorical color-by')
    return props.column
  }

  if (colorByType === 'categorical') {
    // Categorical color-by: replace pie grouping with color-by attribute
    debugLog('[PieChartCard] Using colorByAttribute for pie grouping:', props.colorByAttribute)
    return props.colorByAttribute
  }

  // Fallback to configured column
  return props.column
})

const pieData = computed(() => {
  // Defensive check - filteredData might be undefined if not wrapped properly
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[PieChartCard] No filtered data available')
    return []
  }

  const column = effectiveColumn.value
  debugLog('[PieChartCard] Computing pie chart from', props.filteredData.length, 'rows using column:', column)

  const counts = new Map<string, number>()
  props.filteredData.forEach(row => {
    const val = row[column]
    if (val !== null && val !== undefined) {
      counts.set(String(val), (counts.get(String(val)) || 0) + 1)
    }
  })

  // Sort by count descending for display
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

  // Build color map using ALL categories (from baseline if available, else filtered)
  // This ensures consistent colors in comparison mode when filtered has fewer categories
  // IMPORTANT: When color-by is active (categorical), use StyleManager to ensure
  // colors match scatter/histogram/map for the same categories
  const styleManager = StyleManager.getInstance()
  const dataSourceForColors = (props.showComparison && props.baselineData?.length > 0)
    ? props.baselineData
    : props.filteredData

  // Collect all unique categories from the data source
  const allCategories = new Set<string>()
  dataSourceForColors.forEach(row => {
    const val = row[column]
    if (val !== null && val !== undefined) {
      allCategories.add(String(val))
    }
  })

  // Sort alphabetically for consistent color assignment
  const alphabeticallySorted = Array.from(allCategories).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  )
  // Use StyleManager.buildCategoricalColorMap for consistent cross-card colors
  colorMap.value = styleManager.buildCategoricalColorMap(alphabeticallySorted)

  return sorted.map(([label, value]) => ({ label, value }))
})

const baselinePieData = computed(() => {
  // Only compute if comparison mode is active and we have baseline data
  if (!props.showComparison || !props.baselineData || props.baselineData.length === 0) {
    debugLog('[PieChartCard] No baseline data for comparison')
    return []
  }

  const column = effectiveColumn.value
  debugLog('[PieChartCard] Computing baseline pie from', props.baselineData.length, 'rows using column:', column)

  const counts = new Map<string, number>()
  props.baselineData.forEach(row => {
    const val = row[column]
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

  // Determine text position per slice based on size and mode
  // Comparison mode: NO outside labels (constrained domain causes overlap issues)
  // Scientific mode (no comparison): outside labels for pattern readability
  const textPositions = pieData.value.map(d => {
    const pct = (d.value / total) * 100
    if (props.showComparison) {
      // Comparison mode: inside only for large slices, rely on legend for others
      if (pct >= 20) return 'inside'
      return 'none'  // Legend shows categories
    }
    if (isScientific) {
      // Scientific mode (no comparison): outside for readability over patterns
      if (pct >= 5) return 'outside'
      return 'none'
    }
    // Standard mode
    if (pct >= 10) return 'inside'
    if (pct >= 3) return 'outside'
    return 'none'
  })

  // Only show label+percent for slices that have visible text
  const textTemplate = pieData.value.map(d => {
    const pct = (d.value / total) * 100
    if (props.showComparison) {
      // Comparison mode: shorter labels for inside positioning
      if (pct >= 20) return '%{percent}'  // Just percent, legend shows category
      return ''
    }
    if (pct >= 10) return '%{label}<br>%{percent}'  // Inside: label on top, percent below
    if (pct >= 3) return '%{label} %{percent}'  // Outside: inline
    return ''  // Hidden
  })

  // Main pie chart (inner ring when comparison active)
  // Scientific mode uses thicker slice outlines for publication clarity

  // Build consistent pattern index based on alphabetically sorted categories (from colorMap)
  // This ensures same category always gets same pattern regardless of filter state
  const sortedCategories = Array.from(colorMap.value.keys())
  const getCategoryPatternIndex = (label: string) => {
    const idx = sortedCategories.indexOf(label)
    return idx >= 0 ? idx : 0
  }

  // Generate distinct patterns per slice in scientific mode
  const slicePatterns = isScientific
    ? pieData.value.map(d => styleManager.getScientificPiePattern(getCategoryPatternIndex(d.label)))
    : undefined

  const mainTrace: any = {
    labels: pieData.value.map(d => toTitleCase(d.label)),
    values: pieData.value.map(d => d.value),
    type: 'pie',
    name: props.showComparison ? 'Filtered (inner)' : undefined,
    // In comparison mode, hide legend from inner trace (baseline shows all categories)
    showlegend: !props.showComparison,
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
  // Uses same patterns as filtered (matched by category), only opacity differs
  if (props.showComparison && baselinePieData.value.length > 0) {
    // Use same color map but with transparency (50% opacity)
    const baselineColors = baselinePieData.value.map(d => {
      const baseColor = colorMap.value.get(d.label) || styleManager.getCategoricalColor(0)
      return baseColor + '80' // Add 50% alpha (hex 80 = 128/255)
    })

    // In scientific mode, use consistent pattern index from colorMap (same as filtered)
    const baselinePatterns = isScientific
      ? baselinePieData.value.map(d => styleManager.getScientificPiePattern(getCategoryPatternIndex(d.label)))
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
      showlegend: true,  // Show ALL categories in legend (baseline has all)
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
      margin: { t: 10, b: 15, l: 15, r: 100 },  // Right margin for legend
      autosize: true,
      paper_bgcolor: bgColor,
      plot_bgcolor: bgColor,
      uniformtext: { minsize: 9, mode: 'hide' },  // Hide labels that don't fit
      showlegend: true,
      legend: {
        font: { color: textColor, size: 10, family: fontFamily },
        bgcolor: 'transparent',
        orientation: 'v',  // Vertical legend on the right
        x: 1.02,
        xanchor: 'left',
        y: 0.5,
        yanchor: 'middle',
      },
      annotations: [
        // Center annotation showing count
        {
          text: props.showComparison
            ? `<b>${props.filteredData?.length || 0}</b><br><span style="font-size:10px">of ${props.baselineData?.length || 0}</span>`
            : `<b>${pieData.value.reduce((sum, d) => sum + d.value, 0)}</b>`,
          x: 0.5,
          y: 0.5,
          xref: 'paper',
          yref: 'paper',
          showarrow: false,
          font: { size: 16, color: textColor, family: fontFamily },
        },
        // Ring legend annotation (comparison mode only)
        ...(props.showComparison ? [{
          text: `<span style="font-size:9px"><b>Inner:</b> Filtered<br><b>Outer:</b> Baseline</span>`,
          x: 1.02,
          y: 0.05,
          xref: 'paper',
          yref: 'paper',
          xanchor: 'left',
          showarrow: false,
          font: { size: 9, color: textColor, family: fontFamily },
        }] : []),
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
      const filterId = `pie-${effectiveColumn.value}`
      // Set flag so the filteredData watcher knows this change is from our own filter
      justEmittedFilter.value = true
      emit('filter', filterId, effectiveColumn.value, new Set(selectedCategories.value))
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

// Re-render when color-by attribute changes
watch(() => props.colorByAttribute, () => {
  debugLog('[PieChartCard] colorByAttribute changed, re-rendering')
  // Clear selection when grouping changes
  selectedCategories.value.clear()
  renderChart()
})

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
