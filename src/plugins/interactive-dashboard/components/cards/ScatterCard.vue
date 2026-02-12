<template>
  <div class="scatter-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import { LinkageManager, LinkageObserver } from '../../managers/LinkageManager'
import globalStore from '@/store'
import { debugLog } from '../../utils/debug'
import { toTitleCase } from '../../utils/labelFormatter'
import { computeAxisRange } from '../../utils/axisLimits'

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
    type: 'select'  // Scatter plots only support selection linkage (visual highlighting), not filtering
    column: string
    behavior: 'toggle'
  }
  tableConfig?: TableConfig // From InteractiveDashboard - contains column formats
  listenToAttributePairSelection?: boolean  // Enable dynamic axis updates from correlation matrix
  linkageManager?: LinkageManager           // Manager instance for observing events
  baselineData?: any[]      // All data (unfiltered) for comparison mode
  showComparison?: boolean  // Whether comparison mode is active
  colorByAttribute?: string  // Dashboard-level color-by attribute
  colorByOptions?: Array<{ attribute: string; label: string; type: string }>
  xMin?: number             // Explicit x-axis minimum (from YAML)
  xMax?: number             // Explicit x-axis maximum (from YAML)
  yMin?: number             // Explicit y-axis minimum (from YAML)
  yMax?: number             // Explicit y-axis maximum (from YAML)
  xAutoTrim?: number        // X-axis percentile auto-trim (e.g. 95)
  yAutoTrim?: number        // Y-axis percentile auto-trim (e.g. 99)
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  hoveredIds: () => new Set(),
  selectedIds: () => new Set(),
  markerSize: 8,
  idColumn: '',
  listenToAttributePairSelection: false,
  baselineData: () => [],
  showComparison: false,
})

const emit = defineEmits<{
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
  isLoaded: []
}>()

const plotContainer = ref<HTMLElement>()
// Note: Selection state is managed by the parent via props.selectedIds
// We don't maintain local selection state to avoid sync issues

// Current axis columns (can be overridden by attribute pair selection)
const currentXColumn = ref(props.xColumn)
const currentYColumn = ref(props.yColumn)

// Watch for prop changes to reset defaults
watch(() => props.xColumn, (newVal) => { currentXColumn.value = newVal })
watch(() => props.yColumn, (newVal) => { currentYColumn.value = newVal })

// Type detection: YAML config overrides auto-detection
const detectColorByType = (attribute: string): 'categorical' | 'numeric' => {
  // Priority 1: Use YAML-configured type if available
  const yamlConfig = props.colorByOptions?.find(opt => opt.attribute === attribute)
  if (yamlConfig?.type === 'numeric' || yamlConfig?.type === 'categorical') {
    return yamlConfig.type
  }

  // Priority 2: Auto-detect from data
  if (!props.filteredData?.length || !attribute) return 'categorical'
  const values = props.filteredData
    .map(row => row[attribute])
    .filter(v => v !== null && v !== undefined)
  if (values.length === 0) return 'categorical'

  const allNumeric = values.every(v => typeof v === 'number' && !isNaN(v))
  if (!allNumeric) return 'categorical'

  // If numeric but few unique values (< 15), treat as categorical
  // This handles cases like mode IDs (1=car, 2=bike)
  const uniqueValues = new Set(values)
  if (uniqueValues.size < 15) return 'categorical'

  return 'numeric'
}

// Get format config for a column
function getColumnFormat(column: string): ColumnFormat | undefined {
  return props.tableConfig?.columns?.formats?.[column]
}

// Format axis label with unit suffix based on column format
// Returns "Column Name [unit]" format, e.g., "Distance [km]", "Duration [min]"
function formatAxisLabel(column: string): string {
  const format = getColumnFormat(column)

  // Get the display name (title case)
  const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  if (!format) {
    return displayName
  }

  switch (format.type) {
    case 'time':
      return `${displayName} [hh:mm]`
    case 'duration':
      if (format.unit === 'min') return `${displayName} [min]`
      if (format.unit === 's') return `${displayName} [s]`
      return displayName
    case 'distance':
      if (format.unit === 'km') return `${displayName} [km]`
      if (format.unit === 'm') return `${displayName} [m]`
      return displayName
    case 'percent':
      return `${displayName} [%]`
    case 'decimal':
      // Support custom unit field for decimal type
      if (format.unit) return `${displayName} [${format.unit}]`
      return displayName
    default:
      return displayName
  }
}

// Format a value based on column format
function formatValue(value: any, column: string): string {
  const format = getColumnFormat(column)
  if (value === null || value === undefined) {
    return ''
  }

  // Ensure value is a number for numeric operations
  const numValue = typeof value === 'number' ? value : parseFloat(value)
  if (isNaN(numValue)) {
    return String(value)
  }

  if (!format) {
    return numValue.toFixed(2)
  }

  switch (format.type) {
    case 'time': {
      if (format.convertFrom === 'seconds') {
        const hours = Math.floor(numValue / 3600)
        const minutes = Math.floor((numValue % 3600) / 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      }
      return String(numValue)
    }
    case 'duration': {
      if (format.convertFrom === 'seconds') {
        if (format.unit === 'min') {
          return `${(numValue / 60).toFixed(format.decimals ?? 1)} min`
        }
        return `${numValue.toFixed(0)} s`
      }
      return String(numValue)
    }
    case 'distance': {
      if (format.convertFrom === 'meters') {
        if (format.unit === 'km') {
          return `${(numValue / 1000).toFixed(format.decimals ?? 2)} km`
        }
        return `${numValue.toFixed(0)} m`
      }
      return String(numValue)
    }
    case 'percent': {
      return `${(numValue * 100).toFixed(format.decimals ?? 1)}%`
    }
    case 'decimal': {
      return numValue.toFixed(format.decimals ?? 2)
    }
    default:
      return String(numValue)
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
    const xVal = row[currentXColumn.value]
    const yVal = row[currentYColumn.value]
    
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
      const xFormatted = formatValue(xVal, currentXColumn.value)
      const yFormatted = formatValue(yVal, currentYColumn.value)
      let hoverText = `${currentXColumn.value}: ${xFormatted}<br>${currentYColumn.value}: ${yFormatted}`
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

const baselineScatterData = computed(() => {
  if (!props.showComparison || !props.baselineData || props.baselineData.length === 0) {
    return { x: [], y: [], ids: [], text: [] }
  }

  debugLog('[ScatterCard] Computing baseline scatter from', props.baselineData.length, 'rows')

  const x: number[] = []
  const y: number[] = []
  const ids: any[] = []
  const text: string[] = []

  props.baselineData.forEach(row => {
    const xVal = row[currentXColumn.value]
    const yVal = row[currentYColumn.value]

    if (xVal !== null && xVal !== undefined && yVal !== null && yVal !== undefined) {
      x.push(xVal)
      y.push(yVal)
      const id = props.idColumn ? row[props.idColumn] : null
      ids.push(id)

      const xFormatted = formatValue(xVal, currentXColumn.value)
      const yFormatted = formatValue(yVal, currentYColumn.value)
      text.push(`${currentXColumn.value}: ${xFormatted}<br>${currentYColumn.value}: ${yFormatted}`)
    }
  })

  return { x, y, ids, text }
})

// Debounce timer for renderChart
let renderTimeout: ReturnType<typeof setTimeout> | null = null
// Track whether chart has been initialized (to know if we can use Plotly.react)
let chartInitialized = false

// Debounced render to prevent excessive re-renders
const debouncedRenderChart = () => {
  if (renderTimeout) {
    clearTimeout(renderTimeout)
  }
  renderTimeout = setTimeout(() => {
    updateChart()
    renderTimeout = null
  }, 50)  // 50ms debounce
}

// Initial chart creation - registers event handlers
const initializeChart = () => {
  if (!plotContainer.value || scatterData.value.x.length === 0) return

  const { traces, layout, config } = buildChartData()

  Plotly.newPlot(plotContainer.value, traces, layout, config)
  chartInitialized = true

  debugLog('[ScatterCard] Chart INITIALIZED, registering event handlers for:', props.title || 'untitled')

  // Register event handlers ONCE during initialization
  registerEventHandlers()
}

// Update chart data - uses Plotly.react to preserve event handlers
const updateChart = () => {
  if (!plotContainer.value) return

  // If no data, nothing to render
  if (scatterData.value.x.length === 0) return

  const { traces, layout, config } = buildChartData()

  if (chartInitialized) {
    // Use Plotly.react to update data/layout (preserves event handlers)
    Plotly.react(plotContainer.value, traces, layout, config)
    debugLog('[ScatterCard] Chart updated for:', props.title || 'untitled')
  } else {
    // First render - initialize
    initializeChart()
  }
}

// Find all IDs at a given x,y coordinate (handles overlapping points)
const findIdsAtCoordinate = (x: number, y: number): any[] => {
  const ids: any[] = []

  // Calculate tolerance based on data range (0.1% of range, minimum 0.001)
  const xRange = Math.max(...scatterData.value.x) - Math.min(...scatterData.value.x)
  const yRange = Math.max(...scatterData.value.y) - Math.min(...scatterData.value.y)
  const xTolerance = Math.max(xRange * 0.001, 0.001)
  const yTolerance = Math.max(yRange * 0.001, 0.001)

  // Search in filtered data
  props.filteredData?.forEach((row) => {
    const rowX = row[currentXColumn.value]
    const rowY = row[currentYColumn.value]
    const id = props.idColumn ? row[props.idColumn] : null

    if (id && Math.abs(rowX - x) < xTolerance && Math.abs(rowY - y) < yTolerance) {
      ids.push(id)
    }
  })

  return ids
}

// Register click/hover event handlers (called only once during initialization)
const registerEventHandlers = () => {
  if (!plotContainer.value) return

  // Click handler for point selection - handles ALL overlapping points at same coordinates
  plotContainer.value.on('plotly_click', (data: any) => {
    debugLog('[ScatterCard] CLICK EVENT FIRED!', data.points.length, 'points')
    const point = data.points[0]

    // Skip baseline trace (trace 0 when comparison mode is on)
    if (props.showComparison && point.curveNumber === 0) {
      debugLog('[ScatterCard] Skipping - clicked on baseline trace')
      return
    }

    // Get the clicked coordinates
    const clickedX = point.x
    const clickedY = point.y
    debugLog('[ScatterCard] Clicked at coordinates:', clickedX, clickedY)

    // Find ALL points at these coordinates (handles overlapping points)
    const clickedIds = findIdsAtCoordinate(clickedX, clickedY)
    debugLog('[ScatterCard] Found IDs at coordinates:', clickedIds)

    if (clickedIds.length === 0) {
      debugLog('[ScatterCard] No IDs found for clicked point - idColumn may be missing or empty')
      return
    }

    // Toggle selection behavior: clicking adds/removes ALL overlapping points from selection set
    const newSelection = new Set(props.selectedIds || [])
    debugLog('[ScatterCard] Current selection before toggle:', Array.from(newSelection))

    // Check if ALL clicked IDs are already selected (then deselect all of them)
    const allAlreadySelected = clickedIds.every(id => newSelection.has(id))

    if (allAlreadySelected) {
      // Deselect all clicked IDs
      clickedIds.forEach(id => newSelection.delete(id))
      debugLog('[ScatterCard] Deselected', clickedIds.length, 'points')
    } else {
      // Add all clicked IDs to selection
      clickedIds.forEach(id => newSelection.add(id))
      debugLog('[ScatterCard] Selected', clickedIds.length, 'points, total now:', newSelection.size)
    }

    debugLog('[ScatterCard] Emitting select with:', Array.from(newSelection))
    emit('select', newSelection)
  })

  // Hover handler - handles ALL overlapping points at same coordinates
  plotContainer.value.on('plotly_hover', (data: any) => {
    debugLog('[ScatterCard] HOVER EVENT FIRED!')
    const point = data.points[0]

    // Skip baseline trace
    if (props.showComparison && point.curveNumber === 0) {
      return
    }

    // Get the hovered coordinates
    const hoveredX = point.x
    const hoveredY = point.y

    // Find ALL points at these coordinates
    const hoveredIds = findIdsAtCoordinate(hoveredX, hoveredY)

    if (hoveredIds.length > 0) {
      emit('hover', new Set(hoveredIds))
    }
  })

  // Unhover handler - clear hover when mouse leaves point
  plotContainer.value.on('plotly_unhover', () => {
    emit('hover', new Set())
  })
}

// Build chart data (traces, layout, config) - separated from rendering
const buildChartData = () => {
  if (!plotContainer.value || scatterData.value.x.length === 0) {
    return { traces: [], layout: {}, config: {} }
  }

  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const isScientific = styleManager.isScientificMode()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')
  const defaultColor = styleManager.getColor('chart.bar.default')
  // Interaction states - consistent with MapCard
  const highlightColor = styleManager.getColor('interaction.hover')
  const selectedColor = styleManager.getColor('interaction.selected')

  // Scientific mode font configuration
  const fontFamily = isScientific
    ? styleManager.getScientificConfig().fontFamily
    : undefined

  // Determine if color-by is active and what type
  const colorByActive = props.colorByAttribute && props.colorByAttribute !== ''
  const colorByType = colorByActive ? detectColorByType(props.colorByAttribute!) : 'categorical'

  // Build traces - one per category for proper legend, or single trace if no categories
  const traces: any[] = []
  const categories = scatterData.value.categories
  const hasCategories = props.colorColumn && categories.length > 0

  // Baseline trace (if comparison mode) - gray points behind, NEVER split by color-by category
  if (props.showComparison && baselineScatterData.value.x.length > 0) {
    traces.unshift({  // unshift to add at beginning
      x: baselineScatterData.value.x,
      y: baselineScatterData.value.y,
      mode: 'markers',
      type: 'scatter',
      name: 'Baseline (All Data)',
      text: baselineScatterData.value.text,
      hoverinfo: 'text',
      marker: {
        color: 'rgba(156, 163, 175, 0.3)', // Gray with 30% opacity
        size: props.markerSize * 0.8,      // Slightly smaller
        symbol: isScientific ? 'circle-open' : undefined,  // Hollow circle in scientific mode
        line: {
          color: 'rgba(156, 163, 175, 0.5)',
          width: isScientific ? 1 : 0.5,  // Thicker line in scientific mode
        },
      },
      showlegend: true,
    })
  }

  // Color-by rendering: categorical (multi-trace) or numeric (colorscale)
  if (colorByActive && colorByType === 'categorical') {
    // Categorical color-by: create separate traces per category value
    const colorByValues = Array.from(
      new Set(
        props.filteredData
          ?.map(row => row[props.colorByAttribute!])
          .filter(v => v !== null && v !== undefined)
      )
    ).sort()

    const colorMap = styleManager.buildCategoricalColorMap(colorByValues.map(String))

    colorByValues.forEach((categoryValue, categoryIndex) => {
      const categoryStr = String(categoryValue)
      const categoryX: number[] = []
      const categoryY: number[] = []
      const categoryText: string[] = []
      const categorySizes: number[] = []
      const categoryMarkerColors: string[] = []
      const categoryLineWidths: number[] = []
      const categoryLineColors: string[] = []
      const categoryOpacities: number[] = []
      const categoryIds: any[] = []

      props.filteredData?.forEach((row) => {
        if (String(row[props.colorByAttribute!]) === categoryStr) {
          const xVal = row[currentXColumn.value]
          const yVal = row[currentYColumn.value]
          if (xVal !== null && xVal !== undefined && yVal !== null && yVal !== undefined) {
            const id = props.idColumn ? row[props.idColumn] : null
            categoryX.push(xVal)
            categoryY.push(yVal)
            categoryIds.push(id)

            // Hover text
            const xFormatted = formatValue(xVal, currentXColumn.value)
            const yFormatted = formatValue(yVal, currentYColumn.value)
            let hoverText = `${currentXColumn.value}: ${xFormatted}<br>${currentYColumn.value}: ${yFormatted}`
            hoverText += `<br>${props.colorByAttribute}: ${categoryValue}`
            if (id) hoverText += `<br>ID: ${id}`
            categoryText.push(hoverText)

            const baseSize = props.sizeColumn && row[props.sizeColumn] !== undefined
              ? Math.max(5, Math.min(25, row[props.sizeColumn]))
              : props.markerSize
            const isHovered = id && props.hoveredIds?.has(id)
            const isSelected = id && props.selectedIds?.has(id)

            // Size: 1.5x larger for highlighted/selected points
            categorySizes.push((isSelected || isHovered) ? baseSize * 1.5 : baseSize)

            // Color based on selection state
            if (isSelected) {
              categoryMarkerColors.push(selectedColor)
              categoryLineColors.push('#ffffff')
              categoryLineWidths.push(3)
              categoryOpacities.push(1.0)
            } else if (isHovered) {
              categoryMarkerColors.push(highlightColor)
              categoryLineColors.push('#ffffff')
              categoryLineWidths.push(2.5)
              categoryOpacities.push(1.0)
            } else {
              categoryMarkerColors.push(colorMap.get(categoryStr) || defaultColor)
              categoryLineColors.push(textColor)
              categoryLineWidths.push(0.5)
              categoryOpacities.push(0.7)
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
          name: toTitleCase(categoryStr),
          text: categoryText,
          hoverinfo: 'text',
          marker: {
            color: categoryMarkerColors,
            size: categorySizes,
            symbol: isScientific ? styleManager.getScientificMarkerSymbol(categoryIndex) : undefined,
            line: {
              color: categoryLineColors,
              width: categoryLineWidths,
            },
            opacity: categoryOpacities,
          },
          legendgroup: categoryStr,
          customdata: categoryIds.map(id => ({ id })),
        })
      }
    })
  } else if (colorByActive && colorByType === 'numeric') {
    // Numeric color-by: single trace with Plotly colorscale
    const colorByValues = scatterData.value.ids.map((id, i) => {
      const rowIndex = props.filteredData?.findIndex(row =>
        (props.idColumn ? row[props.idColumn] : null) === id
      )
      if (rowIndex !== undefined && rowIndex >= 0) {
        return props.filteredData![rowIndex][props.colorByAttribute!]
      }
      return null
    })

    const markerSizes = scatterData.value.ids.map((id, i) => {
      const baseSize = scatterData.value.sizes[i]
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      return (isSelected || isHovered) ? baseSize * 1.5 : baseSize
    })

    const lineWidths = scatterData.value.ids.map((id) => {
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      if (isSelected) return 3
      if (isHovered) return 2.5
      return 0.5
    })

    const lineColors = scatterData.value.ids.map((id) => {
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      return (isSelected || isHovered) ? '#ffffff' : textColor
    })

    const opacities = scatterData.value.ids.map((id) => {
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      return (isSelected || isHovered) ? 1.0 : 0.7
    })

    // Enhanced hover text with color-by attribute
    const enhancedText = scatterData.value.text.map((txt, i) => {
      const colorVal = colorByValues[i]
      if (colorVal !== null && colorVal !== undefined) {
        return `${txt}<br>${props.colorByAttribute}: ${colorVal}`
      }
      return txt
    })

    // Find attribute label for colorbar title
    const attributeLabel = props.colorByOptions?.find(
      opt => opt.attribute === props.colorByAttribute
    )?.label || props.colorByAttribute

    traces.push({
      x: scatterData.value.x,
      y: scatterData.value.y,
      mode: 'markers',
      type: 'scatter',
      name: attributeLabel,
      showlegend: false,
      text: enhancedText,
      hoverinfo: 'text',
      marker: {
        color: colorByValues,
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
          title: { text: attributeLabel, font: { color: textColor, size: 11, family: fontFamily }, side: 'right' },
          tickfont: { color: textColor, size: 9, family: fontFamily },
        },
        size: markerSizes,
        line: {
          color: lineColors,
          width: lineWidths,
        },
        opacity: opacities,
      },
    })
  } else if (hasCategories) {
    // Create separate traces for each category (enables proper legend)
    const categoryColors = generateCategoryColors(categories)

    categories.forEach((category, categoryIndex) => {
      const categoryIndices: number[] = []
      const categoryX: number[] = []
      const categoryY: number[] = []
      const categoryText: string[] = []
      const categorySizes: number[] = []
      const categoryMarkerColors: string[] = []
      const categoryLineWidths: number[] = []
      const categoryLineColors: string[] = []
      const categoryOpacities: number[] = []
      const categoryIds: any[] = []  // Store IDs for this trace

      // Find all points belonging to this category
      props.filteredData?.forEach((row, i) => {
        if (String(row[props.colorColumn!]) === category) {
          const xVal = row[currentXColumn.value]
          const yVal = row[currentYColumn.value]
          if (xVal !== null && xVal !== undefined && yVal !== null && yVal !== undefined) {
            const id = props.idColumn ? row[props.idColumn] : null
            categoryIndices.push(i)
            categoryX.push(xVal)
            categoryY.push(yVal)
            categoryIds.push(id)  // Store ID at trace-specific index
            categoryText.push(scatterData.value.text[scatterData.value.ids.indexOf(id)] || '')

            const baseSize = scatterData.value.sizes[scatterData.value.ids.indexOf(id)] || props.markerSize
            const isHovered = id && props.hoveredIds?.has(id)
            const isSelected = id && props.selectedIds?.has(id)

            // Size: 1.5x larger for highlighted/selected points
            if (isSelected || isHovered) {
              categorySizes.push(baseSize * 1.5)
            } else {
              categorySizes.push(baseSize)
            }

            // Color based on selection state
            if (isSelected) {
              categoryMarkerColors.push(selectedColor)
              categoryLineColors.push('#ffffff')  // White border for max contrast
              categoryLineWidths.push(3)
              categoryOpacities.push(1.0)
            } else if (isHovered) {
              categoryMarkerColors.push(highlightColor)
              categoryLineColors.push('#ffffff')  // White border for visibility
              categoryLineWidths.push(2.5)
              categoryOpacities.push(1.0)
            } else {
              categoryMarkerColors.push(categoryColors[category])
              categoryLineColors.push(textColor)
              categoryLineWidths.push(0.5)
              categoryOpacities.push(0.7)
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
          name: toTitleCase(category),
          text: categoryText,
          hoverinfo: 'text',
          marker: {
            color: categoryMarkerColors,
            size: categorySizes,
            symbol: isScientific ? styleManager.getScientificMarkerSymbol(categoryIndex) : undefined,
            line: {
              color: categoryLineColors,
              width: categoryLineWidths,
            },
            opacity: categoryOpacities,
          },
          // Store original color for legend
          legendgroup: category,
          // Store IDs with this trace for correct index mapping on click/hover
          customdata: categoryIds.map(id => ({ id })),
        })
      }
    })
  } else {
    // Single trace - no categories
    const markerColors = scatterData.value.ids.map((id, i) => {
      if (id && props.selectedIds?.has(id)) return selectedColor
      if (id && props.hoveredIds?.has(id)) return highlightColor
      return scatterData.value.colors[i] || defaultColor
    })

    const markerSizes = scatterData.value.ids.map((id, i) => {
      const baseSize = scatterData.value.sizes[i]
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      // 1.5x size for highlighted/selected points
      return (isSelected || isHovered) ? baseSize * 1.5 : baseSize
    })

    const lineWidths = scatterData.value.ids.map((id) => {
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      if (isSelected) return 3
      if (isHovered) return 2.5
      return 0.5
    })

    const lineColors = scatterData.value.ids.map((id) => {
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      // White border for highlighted/selected, text color for normal
      return (isSelected || isHovered) ? '#ffffff' : textColor
    })

    const opacities = scatterData.value.ids.map((id) => {
      const isHovered = id && props.hoveredIds?.has(id)
      const isSelected = id && props.selectedIds?.has(id)
      // Full opacity for highlighted/selected, reduced for normal
      return (isSelected || isHovered) ? 1.0 : 0.7
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
        size: markerSizes,
        line: {
          color: lineColors,
          width: lineWidths,
        },
        opacity: opacities,
      },
    })
  }

  // Build axis configs with intelligent tick formatting
  // Limit number of ticks to avoid crowding, similar to histogram approach

  // Calculate axis ranges from BASELINE data (all data) to keep consistent view
  // This prevents zooming when filtering - baseline shows full range even when filtered
  const xDataForRange = baselineScatterData.value.x.length > 0 ? baselineScatterData.value.x : scatterData.value.x
  const yDataForRange = baselineScatterData.value.y.length > 0 ? baselineScatterData.value.y : scatterData.value.y
  const xMin = Math.min(...xDataForRange)
  const xMax = Math.max(...xDataForRange)
  const yMin = Math.min(...yDataForRange)
  const yMax = Math.max(...yDataForRange)
  const xPadding = (xMax - xMin) * 0.05 || 1  // 5% padding, fallback to 1 if range is 0
  const yPadding = (yMax - yMin) * 0.05 || 1

  const xAxisConfig: any = {
    title: { text: formatAxisLabel(currentXColumn.value), font: { color: textColor, size: 11, family: fontFamily } },
    tickfont: { color: textColor, size: 10, family: fontFamily },
    gridcolor: gridColor,
    linecolor: isScientific ? textColor : gridColor,  // Black axis line in scientific
    linewidth: isScientific ? 1.5 : 1,
    showline: true,
    zerolinecolor: gridColor,
    automargin: true,  // Allow Plotly to expand margins for long labels
    nticks: 10,        // Limit to ~10 ticks maximum to avoid crowding
    tickformat: '.5~g', // Smart formatting: up to 5 significant digits, scientific at/above 100,000
    range: [xMin - xPadding, xMax + xPadding],  // Fixed range from baseline prevents zooming
  }

  const yAxisConfig: any = {
    title: { text: formatAxisLabel(currentYColumn.value), font: { color: textColor, size: 11, family: fontFamily } },
    tickfont: { color: textColor, size: 10, family: fontFamily },
    gridcolor: gridColor,
    linecolor: isScientific ? textColor : gridColor,  // Black axis line in scientific
    linewidth: isScientific ? 1.5 : 1,
    showline: true,
    zerolinecolor: gridColor,
    automargin: true,  // Allow Plotly to expand margins for long labels
    nticks: 10,        // Limit to ~10 ticks maximum to avoid crowding
    tickformat: '.5~g', // Smart formatting: up to 5 significant digits, scientific at/above 100,000
    range: [yMin - yPadding, yMax + yPadding],  // Fixed range from baseline prevents zooming
  }

  // Apply configured axis range overrides (from YAML xMin/xMax/xAutoTrim/yAutoTrim)
  // These override the default baseline-derived range when specified
  const configuredXRange = computeAxisRange({
    values: xDataForRange,
    min: props.xMin,
    max: props.xMax,
    autoTrim: props.xAutoTrim,
    padding: 0.02,
  })
  if (configuredXRange) {
    xAxisConfig.range = configuredXRange
    xAxisConfig.autorange = false
  }

  const configuredYRange = computeAxisRange({
    values: yDataForRange,
    min: props.yMin,
    max: props.yMax,
    autoTrim: props.yAutoTrim,
    padding: 0.02,
  })
  if (configuredYRange) {
    yAxisConfig.range = configuredYRange
    yAxisConfig.autorange = false
  }

  const showLegend = hasCategories || props.showComparison || (colorByActive && colorByType === 'categorical')

  // Legend title: use colorBy attribute label when active, or colorColumn name
  const legendTitle = colorByActive && colorByType === 'categorical'
    ? (props.colorByOptions?.find(opt => opt.attribute === props.colorByAttribute)?.label || props.colorByAttribute)
    : hasCategories ? props.colorColumn : undefined

  const layout = {
    font: {
      family: fontFamily,
      color: textColor,
    },
    xaxis: xAxisConfig,
    yaxis: yAxisConfig,
    margin: { l: 60, r: showLegend ? 100 : (colorByActive && colorByType === 'numeric' ? 80 : 15), t: 10, b: 45 },
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    hovermode: 'closest',
    showlegend: showLegend,
    legend: showLegend ? {
      title: legendTitle ? { text: legendTitle, font: { color: textColor, size: 11, family: fontFamily } } : undefined,
      x: 1.02,
      y: 1,
      xanchor: 'left',
      yanchor: 'top',
      font: { color: textColor, size: 10, family: fontFamily },
      bgcolor: 'rgba(0,0,0,0)',
      borderwidth: 0,
    } : undefined,
  }

  const config = {
    displayModeBar: false,  // Always hide modebar
    responsive: true,
  }

  return { traces, layout, config }
}

// LinkageObserver for attribute pair selection
const linkageObserver: LinkageObserver = {
  onHoveredIdsChange: () => {},      // Not used in scatter
  onSelectedIdsChange: () => {},     // Not used in scatter
  onAttributePairSelected: (attrX: string, attrY: string) => {
    debugLog('[ScatterCard] onAttributePairSelected called:', attrX, attrY)
    if (!props.listenToAttributePairSelection) return

    // Check if attributes exist in data
    if (props.filteredData && props.filteredData.length > 0) {
      const sampleRow = props.filteredData[0]
      const hasX = attrX in sampleRow
      const hasY = attrY in sampleRow

      if (hasX && hasY) {
        debugLog('[ScatterCard] Updating axes to:', attrX, attrY)
        currentXColumn.value = attrX
        currentYColumn.value = attrY
        // Re-render will happen via watch on currentXColumn/currentYColumn
      } else {
        console.warn(`[ScatterCard] Attributes not found in data: ${attrX}, ${attrY}`)
      }
    }
  }
}

// Watch for current axis column changes
watch([currentXColumn, currentYColumn], () => {
  debugLog('[ScatterCard] Axes changed to:', currentXColumn.value, currentYColumn.value)
  debouncedRenderChart()
})

// Watch for data changes
watch(() => props.filteredData, () => {
  debugLog('[ScatterCard] filteredData changed, re-rendering')
  debouncedRenderChart()
})

// Watch for hover/selection changes from linkage
// Watch both the Set reference AND size to ensure changes are detected
// (Vue's reactivity doesn't always track Set changes properly)
watch(
  [
    () => props.hoveredIds,
    () => props.selectedIds,
    () => props.hoveredIds?.size ?? 0,
    () => props.selectedIds?.size ?? 0
  ],
  () => {
    debugLog('[ScatterCard] hoveredIds or selectedIds changed, hovered:', props.hoveredIds?.size, 'selected:', props.selectedIds?.size)
    debouncedRenderChart()
  }
)

// Re-render on color scheme changes (including scientific mode)
watch(() => globalStore.state.colorScheme, () => {
  debouncedRenderChart()
})

// Re-render when color-by attribute changes
watch(() => props.colorByAttribute, () => {
  debugLog('[ScatterCard] colorByAttribute changed to:', props.colorByAttribute)
  debouncedRenderChart()
})

// Resize observer for responsive chart sizing
let resizeObserver: ResizeObserver | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

function handleResize() {
  // Debounce resize calls to allow DOM to settle (especially after fullscreen transitions)
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  resizeTimeout = setTimeout(() => {
    if (plotContainer.value) {
      debugLog('[ScatterCard] Executing Plotly resize')
      Plotly.Plots.resize(plotContainer.value)
    }
    resizeTimeout = null
  }, 100)
}

// Mouse leave handler to clear hover when leaving the chart area
// This is a fallback in case plotly_unhover doesn't fire reliably
function handleMouseLeave() {
  emit('hover', new Set())
}

onMounted(() => {
  initializeChart()

  // Set up resize observer to handle container size changes
  if (plotContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      // Debounce resize calls
      nextTick(() => handleResize())
    })
    resizeObserver.observe(plotContainer.value)

    // Add mouseleave handler as fallback for clearing hover
    plotContainer.value.addEventListener('mouseleave', handleMouseLeave)
  }

  // Also listen for window resize events (for fullscreen)
  window.addEventListener('resize', handleResize)

  // Register observer if listening is enabled
  debugLog('[ScatterCard] onMounted - listenToAttributePairSelection:', props.listenToAttributePairSelection)
  if (props.listenToAttributePairSelection && props.linkageManager) {
    debugLog('[ScatterCard] Registering as observer for attribute pair events')
    props.linkageManager.addObserver(linkageObserver)
  }

  // Notify parent that card is loaded (hides loading spinner)
  emit('isLoaded')
})

onUnmounted(() => {
  // Reset chart state
  chartInitialized = false

  // Clean up resize observer and timeouts
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }
  if (renderTimeout) {
    clearTimeout(renderTimeout)
    renderTimeout = null
  }
  window.removeEventListener('resize', handleResize)

  // Clean up mouseleave handler
  if (plotContainer.value) {
    plotContainer.value.removeEventListener('mouseleave', handleMouseLeave)
  }

  // Unregister observer
  if (props.linkageManager) {
    props.linkageManager.removeObserver(linkageObserver)
  }
})
</script>

<style scoped>
.scatter-card {
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
