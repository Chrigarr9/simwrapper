<template>
  <div class="scatter-card">
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
  type: 'time' | 'duration' | 'distance' | 'decimal' | 'percent'
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
  xColumn: string           // Column for X axis
  yColumn: string           // Column for Y axis
  colorColumn?: string      // Optional column for point colors (categorical)
  sizeColumn?: string       // Optional column for point sizes (numeric)
  markerSize?: number       // Default marker size (default: 8)
  filteredData?: any[]      // From LinkableCardWrapper (optional for safety)
  hoveredIds?: Set<any>     // Hovered IDs from linkage
  selectedIds?: Set<any>    // Selected IDs from linkage
  idColumn?: string         // Column to use as ID for linkage
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }
  tableConfig?: TableConfig // From InteractiveDashboard - contains column formats
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  hoveredIds: () => new Set(),
  selectedIds: () => new Set(),
  markerSize: 8,
  idColumn: ''
})

const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>, filterType: string]
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
}>()

// Dark mode access from global store
const isDarkMode = computed(() => globalStore.state.isDarkMode)

const plotContainer = ref<HTMLElement>()
const selectedPoints = ref<Set<any>>(new Set())

// Get format config for a column
function getColumnFormat(column: string): ColumnFormat | undefined {
  return props.tableConfig?.columns?.formats?.[column]
}

// Format a value based on column format
function formatValue(value: number, column: string): string {
  const format = getColumnFormat(column)
  if (!format || value === null || value === undefined) {
    return typeof value === 'number' ? value.toFixed(2) : String(value)
  }

  switch (format.type) {
    case 'time': {
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
          return `${(value / 60).toFixed(format.decimals ?? 1)} min`
        }
        return `${value.toFixed(0)} s`
      }
      return String(value)
    }
    case 'distance': {
      if (format.convertFrom === 'meters') {
        if (format.unit === 'km') {
          return `${(value / 1000).toFixed(format.decimals ?? 2)} km`
        }
        return `${value.toFixed(0)} m`
      }
      return String(value)
    }
    case 'percent': {
      return `${(value * 100).toFixed(format.decimals ?? 1)}%`
    }
    case 'decimal': {
      return value.toFixed(format.decimals ?? 2)
    }
    default:
      return String(value)
  }
}

// Generate distinct colors for categories
// D3 categorical palette - domain-specific colors, not theme-dependent
function generateCategoryColors(categories: string[]): Record<string, string> {
  const colorPalette = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5'
  ]
  const colors: Record<string, string> = {}
  categories.forEach((cat, i) => {
    colors[cat] = colorPalette[i % colorPalette.length]
  })
  return colors
}

const scatterData = computed(() => {
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[ScatterCard] No filtered data available')
    return { x: [], y: [], ids: [], colors: [], sizes: [], text: [], categories: [] as string[] }
  }

  debugLog('[ScatterCard] Computing scatter from', props.filteredData.length, 'rows')

  const x: number[] = []
  const y: number[] = []
  const ids: any[] = []
  const colors: string[] = []
  const sizes: number[] = []
  const text: string[] = []
  const categorySet = new Set<string>()

  // Get unique categories for color mapping
  if (props.colorColumn) {
    props.filteredData.forEach(row => {
      if (row[props.colorColumn!] !== undefined) {
        categorySet.add(String(row[props.colorColumn!]))
      }
    })
  }
  const categories = Array.from(categorySet).sort()
  const categoryColors = generateCategoryColors(categories)

  props.filteredData.forEach(row => {
    const xVal = row[props.xColumn]
    const yVal = row[props.yColumn]
    
    if (xVal !== null && xVal !== undefined && yVal !== null && yVal !== undefined) {
      x.push(xVal)
      y.push(yVal)
      
      // ID for linkage
      const id = props.idColumn ? row[props.idColumn] : null
      ids.push(id)

      // Color by category
      if (props.colorColumn && row[props.colorColumn] !== undefined) {
        colors.push(categoryColors[String(row[props.colorColumn])])
      } else {
        // Use theme-aware default color from StyleManager
        colors.push(StyleManager.getInstance().getColor('chart.bar.default'))
      }

      // Size by value
      if (props.sizeColumn && row[props.sizeColumn] !== undefined) {
        // Normalize size between 5 and 25
        sizes.push(Math.max(5, Math.min(25, row[props.sizeColumn])))
      } else {
        sizes.push(props.markerSize)
      }

      // Hover text
      const xFormatted = formatValue(xVal, props.xColumn)
      const yFormatted = formatValue(yVal, props.yColumn)
      let hoverText = `${props.xColumn}: ${xFormatted}<br>${props.yColumn}: ${yFormatted}`
      if (props.colorColumn && row[props.colorColumn]) {
        hoverText += `<br>${props.colorColumn}: ${row[props.colorColumn]}`
      }
      if (id) {
        hoverText += `<br>ID: ${id}`
      }
      text.push(hoverText)
    }
  })

  return { x, y, ids, colors, sizes, text, categories }
})

const renderChart = () => {
  if (!plotContainer.value || scatterData.value.x.length === 0) return

  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')
  const defaultColor = styleManager.getColor('chart.bar.default')
  // Interaction states - consistent with MapCard
  const highlightColor = styleManager.getColor('interaction.hover')
  const selectedColor = styleManager.getColor('interaction.selected')

  // Build traces - one per category for proper legend, or single trace if no categories
  const traces: any[] = []
  const categories = scatterData.value.categories
  const hasCategories = props.colorColumn && categories.length > 0

  if (hasCategories) {
    // Create separate traces for each category (enables proper legend)
    const categoryColors = generateCategoryColors(categories)
    
    categories.forEach((category) => {
      const categoryIndices: number[] = []
      const categoryX: number[] = []
      const categoryY: number[] = []
      const categoryText: string[] = []
      const categorySizes: number[] = []
      const categoryMarkerColors: string[] = []
      const categoryLineWidths: number[] = []

      // Find all points belonging to this category
      props.filteredData?.forEach((row, i) => {
        if (String(row[props.colorColumn!]) === category) {
          const xVal = row[props.xColumn]
          const yVal = row[props.yColumn]
          if (xVal !== null && xVal !== undefined && yVal !== null && yVal !== undefined) {
            const id = props.idColumn ? row[props.idColumn] : null
            categoryIndices.push(i)
            categoryX.push(xVal)
            categoryY.push(yVal)
            categoryText.push(scatterData.value.text[scatterData.value.ids.indexOf(id)] || '')
            categorySizes.push(scatterData.value.sizes[scatterData.value.ids.indexOf(id)] || props.markerSize)
            
            // Color based on selection state
            if (id && selectedPoints.value.has(id)) {
              categoryMarkerColors.push(selectedColor)
            } else if (id && props.selectedIds?.has(id)) {
              categoryMarkerColors.push(selectedColor)
            } else if (id && props.hoveredIds?.has(id)) {
              categoryMarkerColors.push(highlightColor)
            } else {
              categoryMarkerColors.push(categoryColors[category])
            }
            
            // Line width for highlighting
            if (id && (props.hoveredIds?.has(id) || props.selectedIds?.has(id) || selectedPoints.value.has(id))) {
              categoryLineWidths.push(2)
            } else {
              categoryLineWidths.push(0.5)
            }
          }
        }
      })

      if (categoryX.length > 0) {
        traces.push({
          x: categoryX,
          y: categoryY,
          mode: 'markers',
          type: 'scatter',
          name: category,
          text: categoryText,
          hoverinfo: 'text',
          marker: {
            color: categoryMarkerColors,
            size: categorySizes,
            line: {
              color: textColor, // Use text color for marker outline contrast
              width: categoryLineWidths,
            },
            opacity: 0.8,
          },
          // Store original color for legend
          legendgroup: category,
        })
      }
    })
  } else {
    // Single trace - no categories
    const markerColors = scatterData.value.ids.map((id, i) => {
      if (id && selectedPoints.value.has(id)) return selectedColor
      if (id && props.selectedIds?.has(id)) return selectedColor
      if (id && props.hoveredIds?.has(id)) return highlightColor
      return scatterData.value.colors[i] || defaultColor
    })

    const lineWidths = scatterData.value.ids.map((id) => {
      if (id && (props.hoveredIds?.has(id) || props.selectedIds?.has(id) || selectedPoints.value.has(id))) {
        return 2
      }
      return 0.5
    })

    traces.push({
      x: scatterData.value.x,
      y: scatterData.value.y,
      mode: 'markers',
      type: 'scatter',
      text: scatterData.value.text,
      hoverinfo: 'text',
      marker: {
        color: markerColors,
        size: scatterData.value.sizes,
        line: {
          color: textColor, // Use text color for marker outline contrast
          width: lineWidths,
        },
        opacity: 0.8,
      },
    })
  }

  const layout = {
    xaxis: {
      title: { text: props.xColumn, font: { color: textColor, size: 11 } },
      tickfont: { color: textColor, size: 10 },
      gridcolor: gridColor,
      linecolor: gridColor,
      zerolinecolor: gridColor,
    },
    yaxis: {
      title: { text: props.yColumn, font: { color: textColor, size: 11 } },
      tickfont: { color: textColor, size: 10 },
      gridcolor: gridColor,
      linecolor: gridColor,
      zerolinecolor: gridColor,
    },
    margin: { l: 60, r: hasCategories ? 100 : 15, t: 10, b: 45 },
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    hovermode: 'closest',
    showlegend: hasCategories,
    legend: hasCategories ? {
      x: 1.02,
      y: 1,
      xanchor: 'left',
      yanchor: 'top',
      font: { color: textColor, size: 10 },
      bgcolor: 'rgba(0,0,0,0)',
      borderwidth: 0,
    } : undefined,
  }

  Plotly.newPlot(plotContainer.value, traces, layout, {
    displayModeBar: false,
    responsive: true,
  })

  // Click handler for point selection
  plotContainer.value.on('plotly_click', (data: any) => {
    const pointIndex = data.points[0].pointIndex
    const id = scatterData.value.ids[pointIndex]
    
    if (!id) return

    // Toggle point in selection
    if (selectedPoints.value.has(id)) {
      selectedPoints.value.delete(id)
    } else {
      selectedPoints.value.add(id)
    }

    // Emit selection event
    emit('select', new Set(selectedPoints.value))

    // Emit filter if linkage configured
    if (props.linkage?.type === 'filter' && props.linkage.column) {
      const filterId = `scatter-${props.xColumn}-${props.yColumn}`
      emit('filter', filterId, props.linkage.column, new Set(selectedPoints.value), 'categorical')
    }

    renderChart()
  })

  // Hover handler
  plotContainer.value.on('plotly_hover', (data: any) => {
    const pointIndex = data.points[0].pointIndex
    const id = scatterData.value.ids[pointIndex]
    if (id) {
      emit('hover', new Set([id]))
    }
  })

  // Unhover handler
  plotContainer.value.on('plotly_unhover', () => {
    emit('hover', new Set())
  })
}

// Watch for data changes
watch(() => props.filteredData, () => {
  debugLog('[ScatterCard] filteredData changed, re-rendering')
  renderChart()
}, { deep: true })

// Watch for hover/selection changes from linkage
watch([() => props.hoveredIds, () => props.selectedIds], () => {
  debugLog('[ScatterCard] hoveredIds or selectedIds changed')
  renderChart()
}, { deep: true })

// Re-render on dark mode change
watch(isDarkMode, () => {
  renderChart()
})

// Resize observer for responsive chart sizing
let resizeObserver: ResizeObserver | null = null

function handleResize() {
  if (plotContainer.value) {
    Plotly.Plots.resize(plotContainer.value)
  }
}

onMounted(() => {
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
})

onUnmounted(() => {
  // Clean up resize observer
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.scatter-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
