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
import { computeCorrelationMatrix } from '../../utils/statistics'
import type { CorrelationMatrixResult } from '../../utils/statistics'

interface Props {
  title?: string
  attributes: string[]       // Columns to include in matrix (from YAML)
  filteredData?: any[]       // From LinkableCardWrapper
  showValues?: 'always' | 'never' | 'auto'  // Cell value display mode (default: 'auto')
  pValueThreshold?: number   // Significance threshold (default: 0.05)
  linkage?: {
    type: 'attributePair'
    targetCard?: string      // ID of ScatterCard to update (optional)
  }
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  showValues: 'auto',
  pValueThreshold: 0.05
})

const emit = defineEmits<{
  'attribute-pair-selected': [attrX: string, attrY: string]
  isLoaded: []
}>()

// Dark mode access from global store
const isDarkMode = computed(() => globalStore.state.isDarkMode)

// Reactive state
const plotContainer = ref<HTMLElement>()
const isCalculating = ref<boolean>(false)
const correlationData = ref<CorrelationMatrixResult | null>(null)
const hoveredCell = ref<{ row: number; col: number } | null>(null)
const selectedCell = ref<{ row: number; col: number } | null>(null)

// Computed properties
const sampleSize = computed(() => {
  if (!correlationData.value) return 0
  // Find minimum sample size from matrix (excludes diagonal)
  let minN = Infinity
  const n = correlationData.value.sampleSizes.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        minN = Math.min(minN, correlationData.value.sampleSizes[i][j])
      }
    }
  }
  return minN === Infinity ? 0 : minN
})

const shouldShowValues = computed(() => {
  if (props.showValues === 'always') return true
  if (props.showValues === 'never') return false
  // Auto mode: hide if more than 20 attributes
  return props.attributes.length <= 20
})

// Calculate correlations from filtered data
function calculateCorrelations() {
  isCalculating.value = true

  // Guard: No attributes or no data
  if (!props.attributes || props.attributes.length === 0 || !props.filteredData || props.filteredData.length === 0) {
    correlationData.value = null
    isCalculating.value = false
    return
  }

  // Compute correlation matrix
  try {
    correlationData.value = computeCorrelationMatrix(props.filteredData, props.attributes)
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
  const n = correlationData.value.matrix.length
  const customData: any[][][] = []

  for (let i = 0; i < n; i++) {
    customData[i] = []
    for (let j = 0; j < n; j++) {
      customData[i][j] = [
        correlationData.value.matrix[i][j],     // r value
        correlationData.value.pValues[i][j],    // p-value
        correlationData.value.sampleSizes[i][j] // sample size
      ]
    }
  }

  return customData
}

// Render Plotly heatmap
function renderChart() {
  if (!plotContainer.value || !correlationData.value) return

  // Theme colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')

  const matrix = correlationData.value.matrix
  const pValues = correlationData.value.pValues
  const n = matrix.length

  // Build annotations if showing values
  const annotations: any[] = []
  if (shouldShowValues.value) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const r = matrix[i][j]
        const p = pValues[i][j]
        const isSignificant = p < props.pValueThreshold

        // Format: correlation value with asterisk if significant
        let text = r.toFixed(2)
        if (isSignificant && i !== j) {
          text += '*'
        }

        // Text color: white on dark cells, black on light cells
        const textColorAnnotation = Math.abs(r) > 0.5 ? '#ffffff' : '#000000'

        annotations.push({
          x: props.attributes[j],
          y: props.attributes[i],
          text: text,
          showarrow: false,
          font: {
            color: textColorAnnotation,
            size: 10
          }
        })
      }
    }
  }

  // Plotly heatmap trace
  const trace = {
    z: matrix,
    x: props.attributes,
    y: props.attributes,
    type: 'heatmap',
    colorscale: [
      [0.0, '#3b4cc0'],  // Blue for -1 (negative)
      [0.5, '#f7f7f7'],  // White for 0
      [1.0, '#b40426']   // Red for +1 (positive)
    ],
    zmid: 0,
    zmin: -1,
    zmax: 1,
    hovertemplate: buildHoverTemplate(),
    customdata: buildCustomData(),
    showscale: true,
    colorbar: {
      title: { text: 'r', font: { color: textColor } },
      tickfont: { color: textColor },
    }
  }

  // Layout
  const layout = {
    xaxis: {
      tickfont: { color: textColor, size: 10 },
      tickangle: -45,
      side: 'bottom'
    },
    yaxis: {
      tickfont: { color: textColor, size: 10 },
      autorange: 'reversed'  // Top-to-bottom matches matrix convention
    },
    margin: { l: 100, r: 50, t: 20, b: 100 },
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    annotations: annotations,
  }

  Plotly.newPlot(plotContainer.value, [trace], layout, {
    displayModeBar: false,
    responsive: true,
  })

  // Click handler for cell selection
  plotContainer.value.on('plotly_click', (data: any) => {
    const point = data.points[0]
    const attrX = point.x
    const attrY = point.y
    const rowIdx = point.pointIndex[0]
    const colIdx = point.pointIndex[1]

    console.log('[CorrelationMatrixCard] Cell clicked:', attrX, 'vs', attrY)

    // Update selection state
    selectedCell.value = { row: rowIdx, col: colIdx }
    updateHighlights()

    emit('attribute-pair-selected', attrX, attrY)
  })

  // Define updateHighlights function before using it in event handlers
  function updateHighlights() {
    if (!plotContainer.value) return

    const shapes: any[] = []
    const attrs = props.attributes
    const n = attrs.length

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

      console.log('[CorrelationMatrix] Hover highlight at row:', row, 'col:', col, 'n:', n)

      // Row highlight (horizontal band across all columns)
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'y',
        x0: -0.5,
        x1: n - 0.5,
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
        y1: n - 0.5,
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
watch(() => props.filteredData, debouncedCalculate, { deep: true })
watch(isDarkMode, renderChart)

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
