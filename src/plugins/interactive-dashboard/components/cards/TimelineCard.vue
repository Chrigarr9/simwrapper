<template lang="pug">
.timeline-card
  .plot-container(ref="plotContainer")
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'
import { allocateTracks, TimelineItem } from '../../utils/trackAllocator'
import { debugLog } from '../../utils/debug'

/**
 * Column format configuration from table config
 */
interface ColumnFormat {
  type: 'time' | 'duration' | 'distance' | 'decimal' | 'percent'
  convertFrom?: string
  unit?: string
  decimals?: number
}

/**
 * Table configuration with column formats
 */
interface TableConfig {
  columns?: {
    formats?: Record<string, ColumnFormat>
  }
}

/**
 * Linkage configuration for cross-card interactions
 */
interface LinkageConfig {
  type: 'filter' | 'highlight'
  column: string
  behavior: 'toggle' | 'replace'
  onHover?: 'highlight' | 'filter'
  onSelect?: 'filter' | 'highlight'
}

/**
 * TimelineCard Props Interface
 *
 * Renders a Gantt-style timeline visualization with horizontal bars
 * representing ride time windows. Supports filtering, hover highlighting,
 * and comparison mode.
 */
interface Props {
  /** Card title displayed in header */
  title?: string
  /** Filtered data from LinkableCardWrapper */
  filteredData?: any[]
  /** Baseline data for comparison mode (all unfiltered data) */
  baselineData?: any[]
  /** Whether comparison mode is active */
  showComparison?: boolean
  /** Set of hovered IDs from cross-card linkage */
  hoveredIds?: Set<any>
  /** Set of selected IDs from cross-card linkage */
  selectedIds?: Set<any>
  /** Column name for ride ID (used for linkage) */
  idColumn?: string
  /** Column name for start time (seconds from midnight) */
  startColumn?: string
  /** Column name for end time (seconds from midnight) */
  endColumn?: string
  /** Column name for ride degree (pooling effectiveness) */
  degreeColumn?: string
  /** Linkage configuration for cross-card coordination */
  linkage?: LinkageConfig
  /** Table config for column formatting */
  tableConfig?: TableConfig
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  baselineData: () => [],
  showComparison: false,
  hoveredIds: () => new Set(),
  selectedIds: () => new Set(),
  idColumn: 'ride_id',
  startColumn: 'start_time',
  endColumn: 'end_time',
  degreeColumn: 'degree',
})

/**
 * Events emitted by TimelineCard
 */
const emit = defineEmits<{
  /** Filter event for cross-card linkage */
  filter: [filterId: string, column: string, values: Set<any>, filterType: string]
  /** Hover event with set of hovered IDs */
  hover: [ids: Set<any>]
  /** Selection event with set of selected IDs */
  select: [ids: Set<any>]
  /** Loaded event when card finishes rendering */
  isLoaded: []
}>()

// Template refs
const plotContainer = ref<HTMLElement>()

// Internal state
const selectedRides = ref<Set<any>>(new Set())

// Dark mode from global store
const isDarkMode = computed(() => globalStore.state.isDarkMode)

/**
 * Extended timeline item with constraint window and degree information
 */
interface ExtendedTimelineItem extends TimelineItem {
  degree: number
  earliestPickup?: number
  latestDropoff?: number
}

/**
 * Transform filteredData into ExtendedTimelineItem[] for track allocation
 * Uses configured column names to extract id, start, end times, degree, and constraint windows
 */
const timelineData = computed((): ExtendedTimelineItem[] => {
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[TimelineCard] No filtered data available')
    return []
  }

  debugLog('[TimelineCard] Computing timeline data from', props.filteredData.length, 'rows')

  const items: ExtendedTimelineItem[] = []

  for (const row of props.filteredData) {
    const id = row[props.idColumn]
    const start = row[props.startColumn]
    const end = row[props.endColumn]
    const degree = row[props.degreeColumn]

    // Validate required fields
    if (id !== null && id !== undefined &&
        typeof start === 'number' && !isNaN(start) &&
        typeof end === 'number' && !isNaN(end)) {
      const item: ExtendedTimelineItem = {
        id: String(id),
        start,
        end,
        degree: typeof degree === 'number' && !isNaN(degree) ? degree : 1,
      }

      // Include constraint window fields if available
      const earliestPickup = row['earliest_pickup']
      const latestDropoff = row['latest_dropoff']
      if (typeof earliestPickup === 'number' && !isNaN(earliestPickup)) {
        item.earliestPickup = earliestPickup
      }
      if (typeof latestDropoff === 'number' && !isNaN(latestDropoff)) {
        item.latestDropoff = latestDropoff
      }

      items.push(item)
    }
  }

  return items
})

/**
 * Track allocation map from item ID to { trackIndex, totalTracks }
 * Uses greedy interval partitioning algorithm for optimal swim lane assignment
 */
const trackAllocation = computed(() => {
  if (timelineData.value.length === 0) {
    return new Map()
  }

  debugLog('[TimelineCard] Allocating', timelineData.value.length, 'items to tracks')
  return allocateTracks(timelineData.value)
})

/**
 * Format time in seconds to HH:MM string
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Generate tick values for 24-hour time axis (every 2 hours)
 */
function generateTimeTickVals(): number[] {
  const ticks: number[] = []
  for (let hour = 0; hour <= 24; hour += 2) {
    ticks.push(hour * 3600)
  }
  return ticks
}

/**
 * Generate tick labels for 24-hour time axis
 */
function generateTimeTickText(): string[] {
  return generateTimeTickVals().map(seconds => formatTime(seconds))
}

/**
 * Get color for degree (pooling effectiveness)
 * degree 1: single passenger - color index 0
 * degree 2: 2 passengers - color index 1
 * degree 3+: 3+ passengers - color index 2
 */
function getDegreeColor(degree: number): string {
  const styleManager = StyleManager.getInstance()
  if (degree <= 1) {
    return styleManager.getCategoricalColor(0)
  } else if (degree === 2) {
    return styleManager.getCategoricalColor(1)
  } else {
    return styleManager.getCategoricalColor(2)
  }
}

/**
 * Apply opacity to a hex color, returning rgba string
 */
function applyOpacity(hexColor: string, opacity: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Handle Plotly hover event - emit hover for cross-card coordination
 */
function handleHover(data: any) {
  const point = data.points[0]

  // Skip constraint window trace (curveNumber 0) - only actual travel has meaningful customdata
  if (!point.customdata || !Array.isArray(point.customdata) || !point.customdata[0]) return

  const rideId = point.customdata[0]
  debugLog('[TimelineCard] Hover:', rideId)

  // Emit hover event with Set containing single ID
  emit('hover', new Set([String(rideId)]))
}

/**
 * Handle Plotly unhover event - clear hover state
 */
function handleUnhover() {
  emit('hover', new Set())
}

/**
 * Get the trace index for the actual travel bars (accounting for optional constraint trace)
 */
function getActualTravelTraceIndex(): number {
  return timelineData.value.some(item =>
    item.earliestPickup !== undefined && item.latestDropoff !== undefined
  ) ? 1 : 0
}

/**
 * Update bar colors for hover visualization
 * Highlights hovered bars and dims others
 */
function updateHoverVisuals() {
  if (!plotContainer.value || !props.hoveredIds || props.hoveredIds.size === 0) {
    // Reset to normal colors
    const colors = timelineData.value.map(item => getDegreeColor(item.degree))
    if (timelineData.value.length > 0 && plotContainer.value) {
      const traceIndex = getActualTravelTraceIndex()
      Plotly.restyle(plotContainer.value as any, { 'marker.color': [colors] }, [traceIndex])
    }
    return
  }

  // Highlight hovered, dim others
  const colors = timelineData.value.map(item => {
    if (props.hoveredIds!.has(item.id) || props.hoveredIds!.has(Number(item.id))) {
      return getDegreeColor(item.degree)  // Full color
    }
    return applyOpacity(getDegreeColor(item.degree), 0.3)  // Dimmed
  })

  if (timelineData.value.length > 0 && plotContainer.value) {
    const traceIndex = getActualTravelTraceIndex()
    Plotly.restyle(plotContainer.value as any, { 'marker.color': [colors] }, [traceIndex])
  }
}

/**
 * Update bar visuals for selection state (stub - implemented in Task 2)
 * Adds border/outline to selected bars
 */
function updateSelectionVisuals() {
  // Stub - will be fully implemented in Task 2
  if (!plotContainer.value || timelineData.value.length === 0) return

  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const selectedColor = styleManager.getColor('interaction.selected')

  // Add selection outline to selected bars
  const lineWidths = timelineData.value.map(item =>
    selectedRides.value.has(item.id) ? 2 : 0.5
  )
  const lineColors = timelineData.value.map(item =>
    selectedRides.value.has(item.id) ? selectedColor : bgColor
  )

  const traceIndex = getActualTravelTraceIndex()
  Plotly.restyle(plotContainer.value as any, {
    'marker.line.width': [lineWidths],
    'marker.line.color': [lineColors],
  }, [traceIndex])
}

/**
 * Render the Plotly timeline chart
 * Uses horizontal bar traces with base property for Gantt-style visualization
 * Two overlaid traces: constraint window (gray, outer) and actual travel (colored, inner)
 */
function renderChart() {
  if (!plotContainer.value) return

  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')

  const allocation = trackAllocation.value
  const totalTracks = allocation.size > 0
    ? [...allocation.values()][0]?.totalTracks ?? 0
    : 0

  debugLog('[TimelineCard] Rendering chart, tracks:', totalTracks, 'items:', timelineData.value.length)

  // Build traces for Plotly
  const traces: any[] = []

  // Get data items with their track positions
  const items = timelineData.value
  const hasConstraintWindows = items.some(item => item.earliestPickup !== undefined && item.latestDropoff !== undefined)

  // Constraint window trace (if data has constraint windows)
  // Render first so it appears behind the actual travel bars
  if (hasConstraintWindows) {
    const constraintY: number[] = []
    const constraintBase: number[] = []
    const constraintWidth: number[] = []
    const constraintIds: string[] = []

    for (const item of items) {
      if (item.earliestPickup !== undefined && item.latestDropoff !== undefined) {
        const trackInfo = allocation.get(item.id)
        if (trackInfo) {
          constraintY.push(trackInfo.trackIndex)
          constraintBase.push(item.earliestPickup)
          constraintWidth.push(item.latestDropoff - item.earliestPickup)
          constraintIds.push(item.id)
        }
      }
    }

    if (constraintY.length > 0) {
      traces.push({
        x: constraintWidth,
        y: constraintY,
        base: constraintBase,
        type: 'bar',
        orientation: 'h',
        name: 'Constraint Window',
        marker: {
          color: 'rgba(156, 163, 175, 0.4)', // Gray with transparency
          line: {
            color: bgColor,
            width: 0,
          },
        },
        width: 0.8,  // Bar height (for horizontal bars, width controls height)
        hovertemplate: '<b>Constraint</b><br>%{base:.0f}s - %{x:.0f}s<extra></extra>',
        customdata: constraintIds,
      })
    }
  }

  // Actual travel trace (always present)
  const travelY: number[] = []
  const travelBase: number[] = []
  const travelWidth: number[] = []
  const travelColors: string[] = []
  const travelIds: string[] = []
  const travelDegrees: number[] = []

  for (const item of items) {
    const trackInfo = allocation.get(item.id)
    if (trackInfo) {
      travelY.push(trackInfo.trackIndex)
      travelBase.push(item.start)
      travelWidth.push(item.end - item.start)
      travelColors.push(getDegreeColor(item.degree))
      travelIds.push(item.id)
      travelDegrees.push(item.degree)
    }
  }

  if (travelY.length > 0) {
    traces.push({
      x: travelWidth,
      y: travelY,
      base: travelBase,
      type: 'bar',
      orientation: 'h',
      name: 'Actual Travel',
      marker: {
        color: travelColors,
        line: {
          color: bgColor,
          width: 0.5,
        },
      },
      width: hasConstraintWindows ? 0.5 : 0.7,  // Narrower if showing constraint window
      hovertemplate: '<b>Ride %{customdata[0]}</b><br>' +
        'Start: %{base:.0f}s<br>' +
        'Duration: %{x:.0f}s<br>' +
        'Degree: %{customdata[1]}<extra></extra>',
      customdata: travelIds.map((id, i) => [id, travelDegrees[i]]),
    })
  }

  // Calculate y-axis range based on total tracks
  const yRange = totalTracks > 0 ? [-0.5, totalTracks - 0.5] : [-0.5, 0.5]

  const layout = {
    title: {
      text: '',  // Title shown in card header
      font: { color: textColor, size: 14 },
    },
    xaxis: {
      title: { text: 'Time of Day', font: { color: textColor, size: 11 } },
      tickfont: { color: textColor, size: 10 },
      gridcolor: gridColor,
      linecolor: gridColor,
      zerolinecolor: gridColor,
      range: [0, 86400],  // Full 24-hour range in seconds
      tickmode: 'array',
      tickvals: generateTimeTickVals(),
      ticktext: generateTimeTickText(),
    },
    yaxis: {
      title: { text: '', font: { color: textColor, size: 11 } },
      tickfont: { color: textColor, size: 10 },
      gridcolor: gridColor,
      linecolor: gridColor,
      showticklabels: false,  // No labels for swim lanes
      range: yRange,
    },
    margin: { l: 15, r: 15, t: 10, b: 35 },
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    barmode: 'overlay',  // For nested bars (constraint window + actual travel)
    showlegend: false,
    bargap: 0.1,
  }

  Plotly.newPlot(plotContainer.value, traces, layout, {
    displayModeBar: false,
    responsive: true,
  })

  // Bind hover events for cross-card coordination
  const plotEl = plotContainer.value as any
  plotEl.on('plotly_hover', handleHover)
  plotEl.on('plotly_unhover', handleUnhover)
}

/**
 * Handle window/container resize
 * Debounced to avoid excessive Plotly resize calls
 */
let resizeObserver: ResizeObserver | null = null
let resizeTimeout: ReturnType<typeof setTimeout> | null = null

function handleResize() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  resizeTimeout = setTimeout(() => {
    if (plotContainer.value) {
      debugLog('[TimelineCard] Executing Plotly resize')
      Plotly.Plots.resize(plotContainer.value)
    }
    resizeTimeout = null
  }, 100)
}

// Watch for data changes
watch(() => props.filteredData, () => {
  debugLog('[TimelineCard] filteredData changed, re-rendering')
  renderChart()
}, { deep: true })

// Watch for external hover changes from linkage
watch(() => props.hoveredIds, (newIds) => {
  debugLog('[TimelineCard] hoveredIds changed:', newIds?.size ?? 0, 'items')
  updateHoverVisuals()
}, { deep: true })

// Watch for external selection changes from linkage
watch(() => props.selectedIds, (newIds) => {
  debugLog('[TimelineCard] selectedIds changed:', newIds?.size ?? 0, 'items')
  // Sync internal state with external selection and update visuals
  if (newIds) {
    selectedRides.value = new Set([...newIds].map(id => String(id)))
    updateSelectionVisuals()
  }
}, { deep: true })

// Re-render on dark mode change
watch(isDarkMode, () => {
  renderChart()
})

// Re-render when comparison mode changes
watch(() => props.showComparison, (newVal) => {
  debugLog('[TimelineCard] showComparison changed to:', newVal, '- re-rendering')
  renderChart()
})

// Re-render when baseline data changes
watch(() => props.baselineData, () => {
  if (props.showComparison) {
    debugLog('[TimelineCard] baselineData changed in comparison mode - re-rendering')
    renderChart()
  }
}, { deep: true })

onMounted(() => {
  renderChart()

  // Set up resize observer
  if (plotContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      nextTick(() => handleResize())
    })
    resizeObserver.observe(plotContainer.value)
  }

  // Window resize for fullscreen
  window.addEventListener('resize', handleResize)

  // Notify parent that card is loaded
  emit('isLoaded')
})

onUnmounted(() => {
  // Clean up resize observer and timeout
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
    resizeTimeout = null
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.timeline-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
}

.plot-container {
  flex: 1;
  min-height: 200px;
}
</style>
