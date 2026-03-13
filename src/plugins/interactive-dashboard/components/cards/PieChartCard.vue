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
import { formatLabel } from '../../utils/labelFormatter'
import { formatChartTitle, sortLegendCategories } from '../../utils/chartFormatting'
import { buildPieFigure } from '@/export/trace-builders/pie'
import type { PieInput } from '@/export/trace-builders/pie'
import type { ChartStyle } from '@/export/types'

interface TableConfig {
  columns?: {
    formats?: Record<string, { titleCase?: boolean }>
  }
}

interface Props {
  title?: string
  column: string
  filteredData?: any[]  // From LinkableCardWrapper (optional for safety)
  baselineData?: any[]  // All data (unfiltered) - from LinkableCardWrapper
  showComparison?: boolean  // Whether comparison mode is active
  colorByAttribute?: string  // Dashboard-level color-by attribute
  colorByOptions?: Array<{ attribute: string; label: string; type: string }>
  tableConfig?: TableConfig  // From InteractiveDashboard - contains column formats
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

// Type detection: YAML config overrides auto-detection
const detectColorByType = (attribute: string): 'numeric' | 'categorical' | null => {
  // Priority 1: Use YAML-configured type if available
  const yamlConfig = props.colorByOptions?.find(opt => opt.attribute === attribute)
  if (yamlConfig?.type === 'numeric' || yamlConfig?.type === 'categorical') {
    return yamlConfig.type
  }

  // Priority 2: Auto-detect from data
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

  // Sort categories consistently for legend: numeric asc or alphabetical
  const sortedCategoryLabels = sortLegendCategories(Array.from(counts.keys()))
  const sorted = sortedCategoryLabels.map((label) => [label, counts.get(label) || 0] as [string, number])

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

  // Sort consistently for color assignment: numeric asc or alphabetical
  const alphabeticallySorted = sortLegendCategories(Array.from(allCategories))
  // Use StyleManager.buildCategoricalColorMap for consistent cross-card colors
  colorMap.value = styleManager.buildCategoricalColorMap(alphabeticallySorted)

  return sorted.map(([label, value]) => ({ label, value }))
})

/** Interactive style for the shared trace builder (non-scientific, theme-adaptive) */
const buildInteractiveStyle = (): ChartStyle => {
  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const lineColor = styleManager.getColor('theme.border.default')
  return {
    axisTitleFontSize: 11,
    axisTickFontSize: 10,
    legendTitleFontSize: 11,
    legendFontSize: 10,
    lineWidth: 1.5,
    markerSizeMultiplier: 1.0,
    fontFamily: 'Arial, Helvetica, sans-serif',
    backgroundColor: bgColor,
    textColor,
    gridColor: lineColor,
    barColor: '#4e79a7',
    selectedColor: '#666',
    isScientific: false,
  }
}

const renderChart = () => {
  if (!plotContainer.value || pieData.value.length === 0) return

  const styleManager = StyleManager.getInstance()
  const style = buildInteractiveStyle()

  // Build color map with selection dimming applied
  // The shared builder doesn't know about interactive selections,
  // so we pre-process the color map to dim unselected slices
  const selectionAwareColorMap = new Map<string, string>(colorMap.value)
  if (selectedCategories.value.size > 0) {
    const dimAlpha = Math.round(styleManager.getDimmedOpacity() * 255).toString(16).padStart(2, '0')
    for (const [label, color] of selectionAwareColorMap) {
      if (!selectedCategories.value.has(label)) {
        selectionAwareColorMap.set(label, color + dimAlpha)
      }
    }
  }

  // Build PieInput from Vue component state
  const input: PieInput = {
    filteredData: props.filteredData,
    baselineData: props.baselineData,
    column: effectiveColumn.value,
    title: undefined,  // Title is shown in card header
    colorMap: selectionAwareColorMap,
    showComparison: props.showComparison,
  }

  const figure = buildPieFigure(input, style)

  // --- Post-process traces for interactive-specific features ---

  // 1. Apply formatLabel to display labels (shared builder uses raw labels)
  const formats = props.tableConfig?.columns?.formats
  const col = effectiveColumn.value
  for (const trace of figure.traces) {
    const t = trace as any
    if (t.labels && Array.isArray(t.labels)) {
      t.labels = t.labels.map((l: string) => formatLabel(l, formats, col))
    }
  }

  // 2. Apply selection-aware line styling to main trace (trace 0)
  // Selected slices get white border for visual contrast
  if (selectedCategories.value.size > 0 && figure.traces.length > 0) {
    const mainTrace = figure.traces[0] as any
    // Recover raw labels from pieData to check selection state
    const rawLabels = pieData.value.map(d => d.label)
    mainTrace.marker.line = {
      color: rawLabels.map(label =>
        selectedCategories.value.has(label) ? '#ffffff' : style.gridColor
      ),
      width: rawLabels.map(label =>
        selectedCategories.value.has(label) ? 3 : 1
      ),
    }
  }

  // 3. Apply formatChartTitle to legend title
  const legendTitle = formatChartTitle(
    effectiveColumn.value,
    props.tableConfig?.columns?.formats,
    {
      labelOverride: props.colorByOptions?.find(opt => opt.attribute === effectiveColumn.value)?.label || undefined,
      stripEmptyUnits: true,
    }
  )
  if (figure.layout && (figure.layout as any).legend?.title) {
    ;(figure.layout as any).legend.title.text = legendTitle
  }

  Plotly.newPlot(
    plotContainer.value,
    figure.traces,
    figure.layout,
    figure.config || { displayModeBar: false, responsive: true },
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
})

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
    debugLog('[PieChartCard] baselineData changed in comparison mode - re-rendering')
    renderChart()
  }
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
