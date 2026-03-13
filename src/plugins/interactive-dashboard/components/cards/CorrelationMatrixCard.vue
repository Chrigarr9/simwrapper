<template lang="pug">
.correlation-matrix-card
  .header-info(v-if="sampleSize > 0")
    span.sample-size n = {{ sampleSize }}
  .loading-overlay(v-if="isCalculating")
    span Calculating...
  .plot-container(ref="plotContainer")
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'
import { computeCorrelationGrid } from '../../utils/statistics'
import type { CorrelationMatrixResult } from '../../utils/statistics'
import { buildCorrelationFigure, type CorrelationInput } from '@/export/trace-builders/correlation'
import type { ChartStyle } from '@/export/types'

interface Props {
  title?: string
  attributes?: string[]       // Legacy: columns for both axes
  leftAttributes?: string[]   // Optional row-axis columns (left side)
  bottomAttributes?: string[] // Optional column-axis columns (bottom side)
  matrixPart?: 'full' | 'lower' // Optional display mask: full matrix or lower/bottom triangle
  filteredData?: any[]       // From LinkableCardWrapper
  showValues?: 'always' | 'never' | 'auto'  // Cell value display mode (default: 'auto')
  pValueThreshold?: number   // Significance threshold (default: 0.05)
  linkage?: {
    type: 'attributePair'
    targetCard?: string      // ID of ScatterCard to update (optional)
  }
}

const props = withDefaults(defineProps<Props>(), {
  attributes: () => [],
  leftAttributes: () => [],
  bottomAttributes: () => [],
  matrixPart: 'full',
  filteredData: () => [],
  showValues: 'auto',
  pValueThreshold: 0.05
})

const emit = defineEmits<{
  'attribute-pair-selected': [attrX: string, attrY: string]
  isLoaded: []
}>()


// Reactive state
const plotContainer = ref<HTMLElement>()
const isCalculating = ref<boolean>(false)
const correlationData = ref<CorrelationMatrixResult | null>(null)
const hoveredCell = ref<{ row: number; col: number } | null>(null)
const selectedCell = ref<{ row: number; col: number } | null>(null)

const resolvedLeftAttributes = computed(() => {
  if (props.leftAttributes && props.leftAttributes.length > 0) {
    return props.leftAttributes
  }
  return props.attributes || []
})

const resolvedBottomAttributes = computed(() => {
  if (props.bottomAttributes && props.bottomAttributes.length > 0) {
    return props.bottomAttributes
  }
  return props.attributes || []
})

const isLowerOnly = computed(() => props.matrixPart === 'lower')

function isCellVisible(rowIdx: number, colIdx: number): boolean {
  if (!isLowerOnly.value) return true
  return rowIdx >= colIdx
}

// Computed properties
const sampleSize = computed(() => {
  if (!correlationData.value) return 0

  // Find minimum sample size over visible cells
  let minN = Infinity
  const rowCount = correlationData.value.sampleSizes.length
  const colCount = rowCount > 0 ? correlationData.value.sampleSizes[0].length : 0

  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      if (isCellVisible(i, j)) {
        minN = Math.min(minN, correlationData.value.sampleSizes[i][j])
      }
    }
  }
  return minN === Infinity ? 0 : minN
})

// Calculate correlations from filtered data
function calculateCorrelations() {
  isCalculating.value = true

  // Guard: No attributes or no data
  if (
    resolvedLeftAttributes.value.length === 0 ||
    resolvedBottomAttributes.value.length === 0 ||
    !props.filteredData ||
    props.filteredData.length === 0
  ) {
    correlationData.value = null
    isCalculating.value = false
    return
  }

  // Compute correlation matrix
  try {
    correlationData.value = computeCorrelationGrid(
      props.filteredData,
      resolvedLeftAttributes.value,
      resolvedBottomAttributes.value
    )
    renderChart()
  } catch (error) {
    console.error('[CorrelationMatrixCard] Error computing correlation matrix:', error)
    correlationData.value = null
  } finally {
    isCalculating.value = false
  }
}

// Debounced version for filtered data changes
let debounceTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedCalculate() {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    calculateCorrelations()
    debounceTimeout = null
  }, 200)
}

// Build hover template for Plotly
function buildHoverTemplate(): string {
  return '<b>%{x} vs %{y}</b><br>' +
         'r = %{customdata[0]:.3f}<br>' +
         'p = %{customdata[1]:.4f}<br>' +
         'n = %{customdata[2]}<extra></extra>'
}

// Build custom data for hover (p-values and sample sizes)
function buildCustomData(): any[][][] {
  if (!correlationData.value) return []
  const rowCount = correlationData.value.matrix.length
  const colCount = rowCount > 0 ? correlationData.value.matrix[0].length : 0
  const customData: any[][][] = []

  for (let i = 0; i < rowCount; i++) {
    customData[i] = []
    for (let j = 0; j < colCount; j++) {
      customData[i][j] = [
        correlationData.value.matrix[i][j],     // r value
        correlationData.value.pValues[i][j],    // p-value
        correlationData.value.sampleSizes[i][j] // sample size
      ]
    }
  }

  return customData
}

function getDashboardThemeColors(): { bgColor: string; textColor: string } {
  const styleManager = StyleManager.getInstance()
  const fallbackBg = styleManager.getColor('theme.background.primary')
  const fallbackText = styleManager.getColor('theme.text.primary')

  if (globalThis.window === undefined) {
    return { bgColor: fallbackBg, textColor: fallbackText }
  }

  const rootStyles = globalThis.window.getComputedStyle(document.documentElement)
  const cssBg = rootStyles.getPropertyValue('--dashboard-bg-primary').trim()
  const cssText = rootStyles.getPropertyValue('--dashboard-text-primary').trim()

  return {
    bgColor: cssBg || fallbackBg,
    textColor: cssText || fallbackText,
  }
}

// Build interactive ChartStyle from dashboard theme
function getInteractiveStyle(): ChartStyle {
  const styleManager = StyleManager.getInstance()
  const isScientific = styleManager.isScientificMode()
  const { bgColor, textColor } = getDashboardThemeColors()

  const fontFamily = isScientific
    ? styleManager.getScientificConfig().fontFamily
    : 'Arial, Helvetica, sans-serif'

  return {
    axisTitleFontSize: 11,
    axisTickFontSize: 10,
    legendTitleFontSize: 11,
    legendFontSize: 10,
    lineWidth: 1.5,
    markerSizeMultiplier: 1.0,
    fontFamily,
    backgroundColor: bgColor,
    textColor,
    gridColor: '#e0e0e0',
    barColor: '#4e79a7',
    selectedColor: '#666',
    isScientific,
  }
}

// Render Plotly heatmap using shared trace builder
function renderChart() {
  if (!plotContainer.value || !correlationData.value) return

  const style = getInteractiveStyle()

  // Build figure via shared trace builder
  const input: CorrelationInput = {
    filteredData: props.filteredData,
    attributes: props.attributes,
    leftAttributes: resolvedLeftAttributes.value,
    bottomAttributes: resolvedBottomAttributes.value,
    matrixPart: props.matrixPart,
    showValues: props.showValues,
    pValueThreshold: props.pValueThreshold,
  }

  const figure = buildCorrelationFigure(input, style)

  // Augment the trace with interactive hover data (p-values, sample sizes)
  // The shared builder doesn't include these since they are interactive-only
  if (figure.traces.length > 0) {
    const trace = figure.traces[0] as any
    trace.hovertemplate = buildHoverTemplate()
    trace.customdata = buildCustomData()
  }

  // Retrieve original attribute names for click handler
  const matrix = correlationData.value.matrix
  const rowAttributes = correlationData.value.rowAttributes || resolvedLeftAttributes.value
  const columnAttributes = correlationData.value.columnAttributes || resolvedBottomAttributes.value

  Plotly.newPlot(plotContainer.value, figure.traces, figure.layout, {
    ...figure.config,
    responsive: true,
  } as any)

  // Click handler for cell selection
  plotContainer.value.on('plotly_click', (data: any) => {
    const point = data.points[0]
    const rowIdx = point.pointIndex[0]
    const colIdx = point.pointIndex[1]

    // Use indices to get ORIGINAL column names (not title-cased display labels)
    // This is critical for data lookups in ScatterCard
    if (!isCellVisible(rowIdx, colIdx) || !Number.isFinite(matrix[rowIdx][colIdx])) {
      return
    }

    const originalAttrX = columnAttributes[colIdx]
    const originalAttrY = rowAttributes[rowIdx]

    console.log('[CorrelationMatrixCard] Cell clicked:', originalAttrX, 'vs', originalAttrY, '(display:', point.x, 'vs', point.y, ')')

    // Update selection state
    selectedCell.value = { row: rowIdx, col: colIdx }
    updateHighlights()

    // Emit original column names for data binding
    emit('attribute-pair-selected', originalAttrX, originalAttrY)
  })

  // Define updateHighlights function before using it in event handlers
  function updateHighlights() {
    if (!plotContainer.value) return

    const shapes: any[] = []
    const rowCount = rowAttributes.length
    const colCount = columnAttributes.length

    // For categorical heatmaps, use category indices (0, 1, 2...) as coordinates
    // Plotly maps categories to indices internally

    // Selection highlight (cyan/teal outline around selected cell)
    if (selectedCell.value) {
      const { row, col } = selectedCell.value
      console.log('[CorrelationMatrix] Selection highlight at row:', row, 'col:', col)
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: col - 0.5,
        x1: col + 0.5,
        y0: row - 0.5,
        y1: row + 0.5,
        fillcolor: 'rgba(0, 200, 200, 0.4)',
        line: { color: 'rgb(0, 180, 180)', width: 3 },
        layer: 'above'
      })
    }

    // Hover highlights (row and column bands)
    if (hoveredCell.value) {
      const { row, col } = hoveredCell.value
      const hoverColor = 'rgba(255, 200, 0, 0.3)'  // Semi-transparent orange/yellow

      console.log('[CorrelationMatrix] Hover highlight at row:', row, 'col:', col)

      // Row highlight (horizontal band across all columns)
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: -0.5,
        x1: colCount - 0.5,
        y0: row - 0.5,
        y1: row + 0.5,
        fillcolor: hoverColor,
        line: { color: 'rgba(255, 180, 0, 0.6)', width: 1 },
        layer: 'above'
      })

      // Column highlight (vertical band across all rows)
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: col - 0.5,
        x1: col + 0.5,
        y0: -0.5,
        y1: rowCount - 0.5,
        fillcolor: hoverColor,
        line: { color: 'rgba(255, 180, 0, 0.6)', width: 1 },
        layer: 'above'
      })
    }

    console.log('[CorrelationMatrix] Applying', shapes.length, 'shapes')
    Plotly.relayout(plotContainer.value, { shapes })
  }

  // Hover handler - highlight row and column
  plotContainer.value.on('plotly_hover', (data: any) => {
    const point = data.points[0]
    hoveredCell.value = { row: point.pointIndex[0], col: point.pointIndex[1] }
    updateHighlights()
  })

  // Unhover handler - remove hover highlights (keep selection)
  plotContainer.value.on('plotly_unhover', () => {
    hoveredCell.value = null
    updateHighlights()
  })
}

// Resize handling for responsive chart sizing
let resizeObserver: ResizeObserver | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null
let themeObserver: MutationObserver | null = null
let themeRenderTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleThemeRender() {
  if (themeRenderTimeout) clearTimeout(themeRenderTimeout)
  themeRenderTimeout = setTimeout(() => {
    if (correlationData.value) {
      renderChart()
    }
    themeRenderTimeout = null
  }, 0)
}

function handleResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    if (plotContainer.value) {
      Plotly.Plots.resize(plotContainer.value)
    }
    resizeTimeout = null
  }, 100)
}

// Watch handlers
watch(() => props.filteredData, debouncedCalculate)
watch(() => props.attributes, debouncedCalculate, { deep: true })
watch(() => props.leftAttributes, debouncedCalculate, { deep: true })
watch(() => props.bottomAttributes, debouncedCalculate, { deep: true })
watch(() => props.matrixPart, renderChart)
// Re-render on color scheme changes (including scientific mode)
watch(() => globalStore.state.colorScheme, renderChart)

// Lifecycle hooks
onMounted(() => {
  calculateCorrelations()

  // Set up resize observer to handle container size changes
  if (plotContainer.value) {
    resizeObserver = new ResizeObserver(() => nextTick(() => handleResize()))
    resizeObserver.observe(plotContainer.value)
  }

  // Also listen for window resize events (for fullscreen)
  window.addEventListener('resize', handleResize)

  // Re-render when dashboard theme CSS variables/classes are updated
  if (typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => scheduleThemeRender())
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    themeObserver.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  emit('isLoaded')
})

onUnmounted(() => {
  // Clean up debounce timeout
  if (debounceTimeout) clearTimeout(debounceTimeout)

  // Clean up resize observer and timeout
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeTimeout) clearTimeout(resizeTimeout)

  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
  if (themeRenderTimeout) clearTimeout(themeRenderTimeout)

  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.correlation-matrix-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
  position: relative;
}

.header-info {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--dashboard-text-secondary, var(--text));
  text-align: right;
}

.sample-size {
  font-family: monospace;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--dashboard-bg-primary, var(--bgPanel));
  padding: 8px 16px;
  border-radius: 4px;
  z-index: 10;
  font-size: 12px;
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
