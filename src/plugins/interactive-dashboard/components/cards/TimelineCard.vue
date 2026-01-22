<template lang="pug">
.timeline-card
  .timeline-controls
    button.zoom-btn(@click="zoomIn" title="Zoom in")
      i.fa.fa-plus
    button.zoom-btn(@click="zoomOut" title="Zoom out")
      i.fa.fa-minus
    button.zoom-btn(@click="resetZoom" title="Reset zoom")
      i.fa.fa-compress

  .plot-container(ref="plotContainer")

  //- Expanded detail panel for selected ride
  transition(name="slide-down")
    .expanded-detail(v-if="expandedRideId && expandedRideData")
      .detail-header
        h4 Ride {{ expandedRideId }}
        button.close-btn(@click="expandedRideId = null")
          i.fa.fa-times

      .detail-content
        .ride-summary
          .metric
            span.label Degree:
            span.value {{ expandedRideData.degree }}
          .metric
            span.label Duration:
            span.value {{ formatDuration(expandedRideData.end - expandedRideData.start) }}
          .metric(v-if="expandedRideData.earliestPickup !== undefined")
            span.label Time Window:
            span.value {{ formatTime(expandedRideData.earliestPickup) }} - {{ formatTime(expandedRideData.latestDropoff) }}

        //- Mini-Gantt for requests (if request data available)
        .requests-gantt(v-if="expandedRideRequests.length")
          h5 Requests ({{ expandedRideRequests.length }})
          .request-bar(v-for="req in expandedRideRequests" :key="req.id")
            .request-label {{ req.id }}
            .request-timeline
              .constraint-bar(:style="getRequestConstraintStyle(req)")
              .actual-bar(:style="getRequestActualStyle(req)")
            .request-metrics
              span.metric Delay: {{ formatDuration(req.delay) }}
              span.metric(v-if="req.wait_time !== undefined") Wait: {{ formatDuration(req.wait_time) }}

  .minimap-container
    .minimap(ref="minimapContainer" @click="handleMinimapClick")
    .viewport-indicator(:style="viewportIndicatorStyle")
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'
import { allocateTracks } from '../../utils/trackAllocator'
import type { TimelineItem } from '../../utils/trackAllocator'
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
const minimapContainer = ref<HTMLElement>()

// Zoom state
const viewportStart = ref(0)        // seconds
const viewportEnd = ref(86400)      // 24 hours in seconds
const minZoomRange = 3600           // 1 hour minimum
const maxZoomRange = 86400          // 24 hours maximum

// Internal state
const selectedRides = ref<Set<any>>(new Set())
const expandedRideId = ref<string | null>(null)

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
 * Get data for the currently expanded ride
 */
const expandedRideData = computed(() => {
  if (!expandedRideId.value) return null
  return timelineData.value.find(item => item.id === expandedRideId.value) || null
})

/**
 * Get requests linked to the expanded ride (if request data available)
 * Looks for rows with matching ride_id and a request_id column
 */
const expandedRideRequests = computed(() => {
  if (!expandedRideId.value || !props.filteredData) return []

  // Look for requests linked to this ride
  // This assumes request data has a ride_id column matching
  return props.filteredData
    .filter(row => String(row.ride_id) === expandedRideId.value && row.request_id)
    .map(row => ({
      id: row.request_id,
      treq: row.treq,
      earliest_departure: row.earliest_departure,
      latest_arrival: row.latest_arrival,
      delay: row.delay || 0,
      wait_time: row.wait_time,
    }))
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
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '-'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Get CSS style for request constraint bar in mini-Gantt
 * Uses the expanded ride's constraint window as the reference range
 */
function getRequestConstraintStyle(req: any) {
  if (!expandedRideData.value ||
      req.earliest_departure === undefined ||
      req.latest_arrival === undefined) {
    return { display: 'none' }
  }

  // Use the expanded ride's constraint window as reference for scaling
  const rideStart = expandedRideData.value.earliestPickup ?? expandedRideData.value.start
  const rideEnd = expandedRideData.value.latestDropoff ?? expandedRideData.value.end
  const totalRange = rideEnd - rideStart

  if (totalRange <= 0) return { display: 'none' }

  const start = ((req.earliest_departure - rideStart) / totalRange) * 100
  const width = ((req.latest_arrival - req.earliest_departure) / totalRange) * 100

  return {
    left: `${Math.max(0, start)}%`,
    width: `${Math.min(100 - Math.max(0, start), width)}%`,
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
  }
}

/**
 * Get CSS style for request actual pickup marker in mini-Gantt
 */
function getRequestActualStyle(req: any) {
  if (!expandedRideData.value || req.treq === undefined) {
    return { display: 'none' }
  }

  // Use the expanded ride's constraint window as reference for scaling
  const rideStart = expandedRideData.value.earliestPickup ?? expandedRideData.value.start
  const rideEnd = expandedRideData.value.latestDropoff ?? expandedRideData.value.end
  const totalRange = rideEnd - rideStart

  if (totalRange <= 0) return { display: 'none' }

  const start = ((req.treq - rideStart) / totalRange) * 100

  return {
    left: `${Math.max(0, start)}%`,
    width: '3%',  // Fixed small width for pickup marker
    backgroundColor: getDegreeColor(1),
  }
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
 * Update bar visuals for selection state
 * Adds border/outline to selected bars
 */
function updateSelectionVisuals() {
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
 * Handle Plotly click event - toggle selection and expand detail view
 */
function handleClick(data: any) {
  const point = data.points[0]

  // Skip constraint window trace - only respond to actual travel clicks
  if (!point.customdata || !Array.isArray(point.customdata) || !point.customdata[0]) return

  const rideId = String(point.customdata[0])
  debugLog('[TimelineCard] Click:', rideId)

  // Toggle expanded detail view (only one ride expanded at a time)
  if (expandedRideId.value === rideId) {
    expandedRideId.value = null
  } else {
    expandedRideId.value = rideId
  }

  // Toggle selection (matching HistogramCard behavior)
  if (selectedRides.value.has(rideId)) {
    selectedRides.value.delete(rideId)
  } else {
    selectedRides.value.add(rideId)
  }

  // Create a new Set to trigger reactivity
  selectedRides.value = new Set(selectedRides.value)

  // Emit select event for visual highlighting
  emit('select', new Set(selectedRides.value))

  // Emit filter event for cross-card filtering
  if (props.linkage?.type === 'filter') {
    const filterColumn = props.linkage.column || props.idColumn || 'ride_id'
    emit('filter',
      `timeline-${props.title || 'rides'}`,
      filterColumn,
      new Set(selectedRides.value),
      'categorical'
    )
  }

  // Update visual selection state
  updateSelectionVisuals()
}

/**
 * Handle keyboard events - Escape to clear selection
 */
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && selectedRides.value.size > 0) {
    debugLog('[TimelineCard] Escape pressed, clearing selection')
    selectedRides.value.clear()
    selectedRides.value = new Set()  // Trigger reactivity

    // Emit clear events
    emit('select', new Set())
    if (props.linkage?.type === 'filter') {
      const filterColumn = props.linkage.column || props.idColumn || 'ride_id'
      emit('filter',
        `timeline-${props.title || 'rides'}`,
        filterColumn,
        new Set(),
        'categorical'
      )
    }

    updateSelectionVisuals()
  }
}

/**
 * Zoom in: halve the visible time range centered on current view
 */
function zoomIn() {
  const currentRange = viewportEnd.value - viewportStart.value
  const center = (viewportStart.value + viewportEnd.value) / 2
  const newRange = Math.max(currentRange * 0.5, minZoomRange)

  viewportStart.value = Math.max(0, center - newRange / 2)
  viewportEnd.value = Math.min(86400, center + newRange / 2)
  updateMainChartRange()
}

/**
 * Zoom out: double the visible time range centered on current view
 */
function zoomOut() {
  const currentRange = viewportEnd.value - viewportStart.value
  const center = (viewportStart.value + viewportEnd.value) / 2
  const newRange = Math.min(currentRange * 2, maxZoomRange)

  viewportStart.value = Math.max(0, center - newRange / 2)
  viewportEnd.value = Math.min(86400, center + newRange / 2)
  updateMainChartRange()
}

/**
 * Reset zoom to full 24-hour view
 */
function resetZoom() {
  viewportStart.value = 0
  viewportEnd.value = 86400
  updateMainChartRange()
}

/**
 * Update main chart x-axis range using Plotly.relayout
 */
function updateMainChartRange() {
  if (!plotContainer.value) return
  Plotly.relayout(plotContainer.value as any, {
    'xaxis.range': [viewportStart.value, viewportEnd.value]
  })
}

/**
 * Computed style for viewport indicator on minimap
 * Reflects current zoom state as CSS positioning
 */
const viewportIndicatorStyle = computed(() => {
  const totalWidth = 100  // percentage
  const left = (viewportStart.value / 86400) * totalWidth
  const width = ((viewportEnd.value - viewportStart.value) / 86400) * totalWidth

  return {
    left: `${left}%`,
    width: `${width}%`,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    border: '1px solid rgba(59, 130, 246, 0.8)',
  }
})

/**
 * Handle click on minimap to navigate main chart
 * Centers viewport on clicked time position
 */
function handleMinimapClick(e: MouseEvent) {
  const rect = minimapContainer.value?.getBoundingClientRect()
  if (!rect) return

  const clickX = e.clientX - rect.left
  const clickPercent = clickX / rect.width
  const clickTime = clickPercent * 86400

  // Center viewport on clicked time
  const currentRange = viewportEnd.value - viewportStart.value
  viewportStart.value = Math.max(0, clickTime - currentRange / 2)
  viewportEnd.value = Math.min(86400, viewportStart.value + currentRange)
  updateMainChartRange()
}

/**
 * Handle plotly_relayout event to sync viewport state with user pan/zoom
 */
function handlePlotlyRelayout(eventData: any) {
  if (eventData['xaxis.range[0]'] !== undefined) {
    viewportStart.value = eventData['xaxis.range[0]']
    viewportEnd.value = eventData['xaxis.range[1]']
  }
  // Also handle range array format
  if (eventData['xaxis.range'] !== undefined) {
    viewportStart.value = eventData['xaxis.range'][0]
    viewportEnd.value = eventData['xaxis.range'][1]
  }
}

/**
 * Handle mouse wheel event for cursor-centered zoom
 * Scroll up: zoom in centered on cursor position
 * Scroll down: zoom out centered on cursor position
 */
function handleWheel(e: WheelEvent) {
  e.preventDefault()  // Prevent page scroll

  if (!plotContainer.value) return

  // Get mouse position relative to plot container
  const rect = plotContainer.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left

  // Access Plotly's internal xaxis object to convert pixel to data coordinates
  const plotEl = plotContainer.value as any
  const xaxis = plotEl._fullLayout?.xaxis
  if (!xaxis || !xaxis.p2d) return

  // Convert pixel position to time coordinate
  const mouseTime = xaxis.p2d(mouseX)

  // Calculate zoom factor (scroll down = positive deltaY = zoom out)
  const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9

  // Compute new viewport range centered on cursor position
  const currentRange = viewportEnd.value - viewportStart.value
  const newRange = currentRange * zoomFactor

  // Clamp to valid bounds (1 hour min, 24 hours max)
  const clampedRange = Math.max(minZoomRange, Math.min(maxZoomRange, newRange))

  // Calculate new start/end centered on mouse position
  // Preserve the cursor's position in the viewport
  const cursorRatio = (mouseTime - viewportStart.value) / currentRange
  let newStart = mouseTime - clampedRange * cursorRatio
  let newEnd = newStart + clampedRange

  // Clamp to valid time bounds (0-86400 seconds)
  if (newStart < 0) {
    newStart = 0
    newEnd = clampedRange
  }
  if (newEnd > 86400) {
    newEnd = 86400
    newStart = 86400 - clampedRange
  }

  // Update viewport refs
  viewportStart.value = newStart
  viewportEnd.value = newEnd

  // Apply new range to chart
  Plotly.relayout(plotEl, {
    'xaxis.range': [newStart, newEnd]
  })
}

/**
 * Get theme colors for minimap rendering
 */
function getThemeColors() {
  const styleManager = StyleManager.getInstance()
  return {
    bgColor: styleManager.getColor('theme.background.primary'),
    textColor: styleManager.getColor('theme.text.primary'),
    gridColor: styleManager.getColor('theme.border.default'),
  }
}

/**
 * Render the minimap - a simplified overview of the entire timeline
 * Uses staticPlot mode for performance
 */
function renderMinimap() {
  if (!minimapContainer.value || !timelineData.value.length) return

  const { bgColor, textColor } = getThemeColors()
  const allocation = trackAllocation.value

  // Build simplified traces for minimap (no constraint windows, just actuals)
  const items = timelineData.value
  const minimapY: number[] = []
  const minimapBase: number[] = []
  const minimapWidth: number[] = []

  for (const item of items) {
    const trackInfo = allocation.get(item.id)
    if (trackInfo) {
      minimapY.push(trackInfo.trackIndex)
      minimapBase.push(item.start)
      minimapWidth.push(item.end - item.start)
    }
  }

  if (minimapY.length === 0) return

  const totalTracks = allocation.size > 0
    ? [...allocation.values()][0]?.totalTracks ?? 0
    : 0

  const trace: Partial<Plotly.PlotData> = {
    type: 'bar',
    orientation: 'h',
    y: minimapY,
    x: minimapWidth,
    base: minimapBase,
    marker: {
      color: 'rgba(59, 130, 246, 0.5)',  // Blue with transparency
      line: { width: 0 } as any,
    },
    width: 0.8,
    hoverinfo: 'skip',
  }

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    margin: { l: 0, r: 0, t: 0, b: 20 },
    xaxis: {
      range: [0, 86400],
      tickmode: 'array',
      tickvals: [0, 21600, 43200, 64800, 86400],
      ticktext: ['00', '06', '12', '18', '24'],
      tickfont: { size: 9, color: textColor },
      showgrid: false,
    } as any,
    yaxis: {
      visible: false,
      autorange: 'reversed',
      range: [-0.5, totalTracks - 0.5],
    } as any,
    height: 40,
  }

  Plotly.newPlot(minimapContainer.value, [trace as any], layout, { staticPlot: true, responsive: true })
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
      range: [viewportStart.value, viewportEnd.value],  // Current viewport range
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

  // Bind hover, click, and relayout events for cross-card coordination
  const plotEl = plotContainer.value as any
  plotEl.on('plotly_hover', handleHover)
  plotEl.on('plotly_unhover', handleUnhover)
  plotEl.on('plotly_click', handleClick)
  plotEl.on('plotly_relayout', handlePlotlyRelayout)

  // Re-render minimap whenever main chart changes
  renderMinimap()
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
    if (minimapContainer.value) {
      Plotly.Plots.resize(minimapContainer.value)
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
  renderMinimap()
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

  // Keyboard listener for Escape to clear selection
  window.addEventListener('keydown', handleKeydown)

  // Bind wheel listener for cursor-centered zoom
  if (plotContainer.value) {
    plotContainer.value.addEventListener('wheel', handleWheel, { passive: false })
  }

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
  window.removeEventListener('keydown', handleKeydown)

  // Remove wheel listener
  if (plotContainer.value) {
    plotContainer.value.removeEventListener('wheel', handleWheel)
  }
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

.timeline-controls {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
}

.zoom-btn {
  padding: 4px 8px;
  border: 1px solid var(--dashboard-border-default, #e5e7eb);
  border-radius: 4px;
  background: var(--dashboard-background-primary, #fff);
  cursor: pointer;
  font-size: 12px;
  color: var(--dashboard-text-primary, #333);
}

.zoom-btn:hover {
  background: var(--dashboard-background-secondary, #f3f4f6);
}

.plot-container {
  flex: 1;
  min-height: 200px;
}

.minimap-container {
  position: relative;
  height: 50px;
  padding: 5px 8px;
}

.minimap {
  height: 40px;
}

.viewport-indicator {
  position: absolute;
  top: 5px;
  height: 40px;
  cursor: grab;
  pointer-events: none;
  border-radius: 2px;
}

.viewport-indicator:active {
  cursor: grabbing;
}

/* Expanded detail panel */
.expanded-detail {
  border-top: 1px solid var(--dashboard-border-default, #e5e7eb);
  padding: 12px;
  background: var(--dashboard-background-secondary, #f9fafb);
  max-height: 200px;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--dashboard-text-primary, #111827);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--dashboard-text-secondary, #6b7280);
}

.close-btn:hover {
  color: var(--dashboard-text-primary, #111827);
}

.ride-summary {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ride-summary .metric {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ride-summary .label {
  color: var(--dashboard-text-secondary, #6b7280);
  font-size: 12px;
}

.ride-summary .value {
  font-weight: 500;
  font-size: 12px;
  color: var(--dashboard-text-primary, #111827);
}

.requests-gantt h5 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--dashboard-text-primary, #111827);
}

.request-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.request-label {
  width: 60px;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dashboard-text-secondary, #6b7280);
}

.request-timeline {
  position: relative;
  flex: 1;
  height: 16px;
  background: var(--dashboard-background-primary, #fff);
  border-radius: 2px;
  border: 1px solid var(--dashboard-border-default, #e5e7eb);
}

.request-timeline .constraint-bar,
.request-timeline .actual-bar {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 2px;
}

.request-metrics {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: var(--dashboard-text-secondary, #6b7280);
  min-width: 120px;
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
