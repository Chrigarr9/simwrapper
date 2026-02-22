<template lang="pug">
.timeline-card(:class="{ 'scientific-mode': isScientificMode }")
  //- Back button for request detail view
  .detail-header(v-if="viewMode === 'requests'")
    button.back-btn(@click="handleBackToRides")
      i.fa.fa-arrow-left
      span Back to rides
    span.detail-title Ride {{ detailRideId }} - Requests

  .plot-container(ref="plotContainer")
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

interface ColorByOption {
  attribute: string
  label?: string
  type?: 'categorical' | 'numeric' | string
  colorScheme?: string
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
  /** Dashboard-level color-by attribute */
  colorByAttribute?: string
  /** Color-by options from YAML */
  colorByOptions?: ColorByOption[]
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

// Zoom state - X axis (time)
const viewportStart = ref(0)        // seconds
const viewportEnd = ref(86400)      // 24 hours in seconds
const minZoomRange = 3600           // 1 hour minimum
const maxZoomRange = 86400          // 24 hours maximum

// Zoom state - Y axis (tracks)
const viewportTopTrack = ref(0)     // top track index (0 at bottom in display)
const viewportBottomTrack = ref(100) // bottom track index
const minTrackRange = 5              // minimum 5 tracks visible
let maxTrackRange = 100              // updated dynamically based on totalTracks

// View mode state
const viewMode = ref<'rides' | 'requests'>('rides')
const detailRideId = ref<string | null>(null)
const shouldAutoFitRides = ref(true)

// Internal state
const selectedRides = ref<Set<any>>(new Set())

// Scientific mode computed for template binding
const isScientificMode = computed(() => StyleManager.getInstance().isScientificMode())

/**
 * Extended timeline item with constraint window and degree information
 */
interface ExtendedTimelineItem extends TimelineItem {
  degree: number
  colorValue?: unknown
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
    const numericDegree = typeof degree === 'number' ? degree : Number(degree)
    const colorAttribute = props.colorByAttribute || props.degreeColumn

    // Validate required fields
    if (id !== null && id !== undefined &&
        typeof start === 'number' && !isNaN(start) &&
        typeof end === 'number' && !isNaN(end)) {
      const item: ExtendedTimelineItem = {
        id: String(id),
        start,
        end,
        degree: Number.isNaN(numericDegree) ? 1 : numericDegree,
        colorValue: row[colorAttribute],
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
 * Stable color map for exact degree values present in rides data
 */
const degreeColorMap = computed(() => {
  const styleManager = StyleManager.getInstance()
  const uniqueDegrees = Array.from(new Set(
    timelineData.value
      .map(item => Number(item.degree))
      .filter(value => Number.isFinite(value))
  )).sort((a, b) => a - b)

  const colorMap = new Map<number, string>()
  uniqueDegrees.forEach((value, index) => {
    colorMap.set(value, styleManager.getCategoricalColor(index))
  })

  return colorMap
})

const activeColorByType = computed<'categorical' | 'numeric'>(() => {
  const attr = props.colorByAttribute
  if (!attr) return 'categorical'

  const configuredType = props.colorByOptions?.find(opt => opt.attribute === attr)?.type
  if (configuredType === 'numeric' || configuredType === 'categorical') return configuredType

  const values = timelineData.value
    .map(item => item.colorValue)
    .filter(value => value !== null && value !== undefined)

  if (values.length === 0) return 'categorical'

  const allNumeric = values.every(value => {
    const numeric = Number(value)
    return Number.isFinite(numeric)
  })

  return allNumeric ? 'numeric' : 'categorical'
})

const categoricalColorByMap = computed(() => {
  const styleManager = StyleManager.getInstance()

  if (activeColorByType.value !== 'categorical') {
    return new Map<string, string>()
  }

  const uniqueValues = Array.from(new Set(
    timelineData.value
      .map(item => item.colorValue)
      .filter(value => value !== null && value !== undefined)
        .map(String)
  )).sort((a, b) => a.localeCompare(b))

  return styleManager.buildCategoricalColorMap(uniqueValues)
})

const numericColorByRange = computed<[number, number] | null>(() => {
  if (activeColorByType.value !== 'numeric') {
    return null
  }

  const values = timelineData.value
    .map(item => Number(item.colorValue))
    .filter(value => Number.isFinite(value))

  if (values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  return [min, max]
})

function getNumericColorScaleName(): 'viridis' | 'blues' | 'reds' | 'greens' | 'plasma' {
  const configured = props.colorByOptions
    ?.find(opt => opt.attribute === props.colorByAttribute)
    ?.colorScheme
    ?.toLowerCase()

  if (configured === 'reds' || configured === 'ylorrd') return 'reds'
  if (configured === 'blues') return 'blues'
  if (configured === 'greens') return 'greens'
  if (configured === 'plasma') return 'plasma'
  return 'viridis'
}

function getTimelineItemColor(item: ExtendedTimelineItem): string {
  const styleManager = StyleManager.getInstance()

  if (!props.colorByAttribute || viewMode.value === 'requests') {
    return getDegreeColor(item.degree)
  }

  if (activeColorByType.value === 'categorical') {
    const key = String(item.colorValue ?? '')
    return categoricalColorByMap.value.get(key) || getDegreeColor(item.degree)
  }

  const numericValue = Number(item.colorValue)
  if (!Number.isFinite(numericValue)) {
    return getDegreeColor(item.degree)
  }

  const range = numericColorByRange.value
  if (!range) {
    return getDegreeColor(item.degree)
  }

  const [min, max] = range
  if (max <= min) {
    return styleManager.getSequentialColor(getNumericColorScaleName(), 0.6)
  }

  const t = (numericValue - min) / (max - min)
  return styleManager.getSequentialColor(getNumericColorScaleName(), Math.max(0, Math.min(1, t)))
}

/**
 * Get data for the currently selected ride in detail view
 */
const detailRideData = computed(() => {
  if (!detailRideId.value) return null
  return timelineData.value.find(item => item.id === detailRideId.value) || null
})

/**
 * Get requests linked to the detail ride (if request data available)
 * Looks for rows with matching ride_id and a request_id column
 */
const expandedRideRequests = computed(() => {
  if (!detailRideId.value || !props.filteredData) return []

  // Look for requests linked to this ride
  // This assumes request data has a ride_id column matching
  return props.filteredData
    .filter(row => String(row.ride_id) === detailRideId.value && row.request_id)
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
 * Transform requests into timeline items for detail view rendering
 * Each request becomes a timeline bar with earliest_departure as start, latest_arrival as end
 */
const requestTimelineData = computed((): ExtendedTimelineItem[] => {
  if (!detailRideId.value || expandedRideRequests.value.length === 0) {
    debugLog('[TimelineCard] No requests for detail view')
    return []
  }

  debugLog('[TimelineCard] Computing request timeline data from', expandedRideRequests.value.length, 'requests')

  const items: ExtendedTimelineItem[] = []

  for (const req of expandedRideRequests.value) {
    // Validate required fields
    if (req.id !== null && req.id !== undefined &&
        typeof req.earliest_departure === 'number' && !isNaN(req.earliest_departure) &&
        typeof req.latest_arrival === 'number' && !isNaN(req.latest_arrival)) {

      items.push({
        id: String(req.id),
        start: req.earliest_departure,
        end: req.latest_arrival,
        degree: 1,  // Individual requests
        earliestPickup: req.earliest_departure,
        latestDropoff: req.latest_arrival,
      })
    }
  }

  return items
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
 * Uses exact degree values mapped to a stable categorical palette
 */
function getDegreeColor(degree: number): string {
  const numericDegree = Number(degree)
  const styleManager = StyleManager.getInstance()

  if (!Number.isFinite(numericDegree)) {
    return styleManager.getCategoricalColor(0)
  }

  const mappedColor = degreeColorMap.value.get(numericDegree)
  if (mappedColor) return mappedColor

  const fallbackIndex = Math.max(0, Math.round(numericDegree) - 1)
  return styleManager.getCategoricalColor(fallbackIndex)
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
 * Handle Plotly hover event - emit hover for cross-card coordination
 * Only active in rides view
 */
function handleHover(data: any) {
  // No hover events in request detail view
  if (viewMode.value === 'requests') return

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
 * Only active in rides view
 */
function handleUnhover() {
  // No hover events in request detail view
  if (viewMode.value === 'requests') return

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
    const colors = timelineData.value.map(item => getTimelineItemColor(item))
    if (timelineData.value.length > 0 && plotContainer.value) {
      const traceIndex = getActualTravelTraceIndex()
      Plotly.restyle(plotContainer.value as any, { 'marker.color': [colors] }, [traceIndex])
    }
    return
  }

  // Highlight hovered, dim others
  const colors = timelineData.value.map(item => {
    if (props.hoveredIds!.has(item.id) || props.hoveredIds!.has(Number(item.id))) {
      return getTimelineItemColor(item)  // Full color
    }
    return applyOpacity(getTimelineItemColor(item), 0.3)  // Dimmed
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

  // Keep bars outline-free in all states
  const lineWidths = timelineData.value.map(() => 0)

  const traceIndex = getActualTravelTraceIndex()
  Plotly.restyle(plotContainer.value as any, {
    'marker.line.width': [lineWidths],
  }, [traceIndex])
}

/**
 * Handle Plotly click event
 * In rides view: single-select and switch to request detail view
 * In requests view: no action (view-only)
 */
function handleClick(data: any) {
  // No click action in request detail view
  if (viewMode.value === 'requests') return

  const point = data.points[0]

  // Skip constraint window trace - only respond to actual travel clicks
  if (!point.customdata || !Array.isArray(point.customdata) || !point.customdata[0]) return

  const rideId = String(point.customdata[0])
  debugLog('[TimelineCard] Click:', rideId)

  // Single-select: clear previous, select new
  selectedRides.value.clear()
  selectedRides.value.add(rideId)
  selectedRides.value = new Set(selectedRides.value)

  // Switch to request detail view
  detailRideId.value = rideId
  viewMode.value = 'requests'

  // Emit select event for cross-card coordination
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
 * Handle back button - return to all-rides view
 */
function handleBackToRides() {
  viewMode.value = 'rides'
  shouldAutoFitRides.value = true
  detailRideId.value = null
  selectedRides.value.clear()
  selectedRides.value = new Set()

  // Clear selection in cross-card coordination
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

  // Update visuals
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
 * Zoom in: halve the visible time and track range centered on current view
 */
function zoomIn() {
  shouldAutoFitRides.value = false
  // X-axis zoom
  const currentRange = viewportEnd.value - viewportStart.value
  const center = (viewportStart.value + viewportEnd.value) / 2
  const newRange = Math.max(currentRange * 0.5, minZoomRange)

  viewportStart.value = Math.max(0, center - newRange / 2)
  viewportEnd.value = Math.min(86400, center + newRange / 2)

  // Y-axis zoom
  const currentTrackRange = viewportBottomTrack.value - viewportTopTrack.value
  const centerTrack = (viewportTopTrack.value + viewportBottomTrack.value) / 2
  const newTrackRange = Math.max(currentTrackRange * 0.5, minTrackRange)

  viewportTopTrack.value = Math.max(0, centerTrack - newTrackRange / 2)
  viewportBottomTrack.value = Math.min(maxTrackRange, centerTrack + newTrackRange / 2)

  updateMainChartRange()
}

/**
 * Zoom out: double the visible time and track range centered on current view
 */
function zoomOut() {
  shouldAutoFitRides.value = false
  // X-axis zoom
  const currentRange = viewportEnd.value - viewportStart.value
  const center = (viewportStart.value + viewportEnd.value) / 2
  const newRange = Math.min(currentRange * 2, maxZoomRange)

  viewportStart.value = Math.max(0, center - newRange / 2)
  viewportEnd.value = Math.min(86400, center + newRange / 2)

  // Y-axis zoom
  const currentTrackRange = viewportBottomTrack.value - viewportTopTrack.value
  const centerTrack = (viewportTopTrack.value + viewportBottomTrack.value) / 2
  const newTrackRange = Math.min(currentTrackRange * 2, maxTrackRange)

  viewportTopTrack.value = Math.max(0, centerTrack - newTrackRange / 2)
  viewportBottomTrack.value = Math.min(maxTrackRange, centerTrack + newTrackRange / 2)

  updateMainChartRange()
}

/**
 * Reset zoom to full 24-hour and all-tracks view
 */
function resetZoom() {
  if (viewMode.value === 'rides') {
    shouldAutoFitRides.value = true
    renderChart()
    return
  }

  viewportStart.value = 0
  viewportEnd.value = 86400
  viewportTopTrack.value = 0
  viewportBottomTrack.value = maxTrackRange
  updateMainChartRange()
}

/**
 * Auto-fit rides viewport to visible data bounds
 * Adds small padding around min/max ride times for readability
 */
function fitViewportToRides(items: ExtendedTimelineItem[], totalTracks: number) {
  if (items.length === 0) {
    viewportStart.value = 0
    viewportEnd.value = 86400
    viewportTopTrack.value = 0
    viewportBottomTrack.value = Math.max(1, totalTracks)
    return
  }

  let minStart = Number.POSITIVE_INFINITY
  let maxEnd = Number.NEGATIVE_INFINITY

  for (const item of items) {
    if (item.start < minStart) minStart = item.start
    if (item.end > maxEnd) maxEnd = item.end
  }

  const span = Math.max(1, maxEnd - minStart)
  const padding = Math.max(60, span * 0.02)
  let start = Math.max(0, minStart - padding)
  let end = Math.min(86400, maxEnd + padding)

  if (end - start < minZoomRange) {
    const center = (start + end) / 2
    start = Math.max(0, center - minZoomRange / 2)
    end = Math.min(86400, center + minZoomRange / 2)
  }

  viewportStart.value = start
  viewportEnd.value = end
  viewportTopTrack.value = 0
  viewportBottomTrack.value = Math.max(1, totalTracks)
}

/**
 * Update main chart x-axis and y-axis range using Plotly.relayout
 */
function updateMainChartRange() {
  if (!plotContainer.value) return
  Plotly.relayout(plotContainer.value as any, {
    'xaxis.range': [viewportStart.value, viewportEnd.value],
    'yaxis.range': [viewportTopTrack.value - 0.5, viewportBottomTrack.value - 0.5]
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
  shouldAutoFitRides.value = false
  const currentRange = viewportEnd.value - viewportStart.value
  viewportStart.value = Math.max(0, clickTime - currentRange / 2)
  viewportEnd.value = Math.min(86400, viewportStart.value + currentRange)
  updateMainChartRange()
}

/**
 * Handle plotly_relayout event to sync viewport state with user pan/zoom
 */
function handlePlotlyRelayout(eventData: any) {
  // X-axis viewport sync
  if (eventData['xaxis.range[0]'] !== undefined) {
    viewportStart.value = eventData['xaxis.range[0]']
    viewportEnd.value = eventData['xaxis.range[1]']
  }
  if (eventData['xaxis.range'] !== undefined) {
    viewportStart.value = eventData['xaxis.range'][0]
    viewportEnd.value = eventData['xaxis.range'][1]
  }

  // Y-axis viewport sync (natural: range is [top - 0.5, bottom - 0.5])
  if (eventData['yaxis.range[0]'] !== undefined) {
    viewportTopTrack.value = eventData['yaxis.range[0]'] + 0.5
    viewportBottomTrack.value = eventData['yaxis.range[1]'] + 0.5
  }
  if (eventData['yaxis.range'] !== undefined) {
    viewportTopTrack.value = eventData['yaxis.range'][0] + 0.5
    viewportBottomTrack.value = eventData['yaxis.range'][1] + 0.5
  }
}

/**
 * Handle mouse wheel event for cursor-centered zoom
 * Scroll up: zoom in centered on cursor position (both X and Y axes)
 * Scroll down: zoom out centered on cursor position (both X and Y axes)
 */
function handleWheel(e: WheelEvent) {
  e.preventDefault()  // Prevent page scroll

  if (!plotContainer.value) return

  // Get mouse position relative to plot container
  const rect = plotContainer.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // Access Plotly's internal axis objects to convert pixel to data coordinates
  const plotEl = plotContainer.value as any
  const xaxis = plotEl._fullLayout?.xaxis
  const yaxis = plotEl._fullLayout?.yaxis
  if (!xaxis || !xaxis.p2d || !yaxis || !yaxis.p2d) return

  // Convert pixel positions to data coordinates
  const mouseTime = xaxis.p2d(mouseX)
  const mouseTrack = yaxis.p2d(mouseY)

  // Calculate zoom factor (scroll down = positive deltaY = zoom out)
  const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9

  // === X-AXIS ZOOM ===
  const currentRange = viewportEnd.value - viewportStart.value
  const newRange = currentRange * zoomFactor
  const clampedRange = Math.max(minZoomRange, Math.min(maxZoomRange, newRange))

  // Calculate new start/end centered on mouse position
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

  // === Y-AXIS ZOOM ===
  const currentTrackRange = viewportBottomTrack.value - viewportTopTrack.value
  const newTrackRange = currentTrackRange * zoomFactor
  const clampedTrackRange = Math.max(minTrackRange, Math.min(maxTrackRange, newTrackRange))

  // Calculate new top/bottom centered on mouse position
  const cursorTrackRatio = (mouseTrack - viewportTopTrack.value) / currentTrackRange
  let newTopTrack = mouseTrack - clampedTrackRange * cursorTrackRatio
  let newBottomTrack = newTopTrack + clampedTrackRange

  // Clamp to valid track bounds (0 to maxTrackRange)
  if (newTopTrack < 0) {
    newTopTrack = 0
    newBottomTrack = clampedTrackRange
  }
  if (newBottomTrack > maxTrackRange) {
    newBottomTrack = maxTrackRange
    newTopTrack = maxTrackRange - clampedTrackRange
  }

  // Update viewport refs
  shouldAutoFitRides.value = false
  viewportStart.value = newStart
  viewportEnd.value = newEnd
  viewportTopTrack.value = newTopTrack
  viewportBottomTrack.value = newBottomTrack

  // Apply new ranges to chart
  Plotly.relayout(plotEl, {
    'xaxis.range': [newStart, newEnd],
    'yaxis.range': [newTopTrack - 0.5, newBottomTrack - 0.5]
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
 * Branches on viewMode: 'rides' shows all rides, 'requests' shows detail ride's requests
 */
function renderChart() {
  if (!plotContainer.value) return

  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const isScientific = styleManager.isScientificMode()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')

  // Scientific mode font configuration
  const fontFamily = isScientific
    ? styleManager.getScientificConfig().fontFamily
    : undefined

  // Choose data based on view mode
  const items = viewMode.value === 'requests' ? requestTimelineData.value : timelineData.value
  const allocation = viewMode.value === 'requests'
    ? allocateTracks(requestTimelineData.value)
    : trackAllocation.value

  const totalTracks = allocation.size > 0
    ? [...allocation.values()][0]?.totalTracks ?? 0
    : 0

  // Update maxTrackRange based on current data
  maxTrackRange = totalTracks
  // Auto-fit rides view on initial load and data changes
  if (viewMode.value === 'rides' && shouldAutoFitRides.value) {
    fitViewportToRides(items, totalTracks)
    shouldAutoFitRides.value = false
  }
  // Initialize Y viewport on first render or when tracks change significantly
  else if (viewportBottomTrack.value === 100 || viewportBottomTrack.value > totalTracks) {
    viewportTopTrack.value = 0
    viewportBottomTrack.value = Math.max(1, totalTracks)
  }

  debugLog('[TimelineCard] Rendering chart, mode:', viewMode.value, 'tracks:', totalTracks, 'items:', items.length)

  // Build traces for Plotly
  const traces: any[] = []

  // Get data items with their track positions
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
      travelColors.push(getTimelineItemColor(item))
      travelIds.push(item.id)
      travelDegrees.push(item.degree)
    }
  }

  if (travelY.length > 0) {
    // Different hover template for requests vs rides
    const hoverTemplate = viewMode.value === 'requests'
      ? '<b>Request %{customdata[0]}</b><br>' +
        'Window: %{base:.0f}s - %{customdata[1]:.0f}s<br>' +
        'Duration: %{x:.0f}s<extra></extra>'
      : '<b>Ride %{customdata[0]}</b><br>' +
        'Start: %{base:.0f}s<br>' +
        'Duration: %{x:.0f}s<br>' +
        'Degree: %{customdata[1]}<extra></extra>'

    traces.push({
      x: travelWidth,
      y: travelY,
      base: travelBase,
      type: 'bar',
      orientation: 'h',
      name: viewMode.value === 'requests' ? 'Request Window' : 'Actual Travel',
      marker: {
        color: travelColors,
        line: {
          color: gridColor,
          width: 0,
        },
      },
      width: hasConstraintWindows ? 0.5 : 0.7,  // Narrower if showing constraint window
      hovertemplate: hoverTemplate,
      customdata: viewMode.value === 'requests'
        ? travelIds.map((id, i) => [id, travelBase[i] + travelWidth[i]])  // [id, end_time]
        : travelIds.map((id, i) => [id, travelDegrees[i]]),  // [id, degree]
    })
  }

  // Calculate y-axis range based on Y viewport
  const yRange = viewMode.value === 'requests'
    ? (totalTracks > 0 ? [-0.5, totalTracks - 0.5] : [-0.5, 0.5])  // Full range for request view
    : [viewportTopTrack.value - 0.5, viewportBottomTrack.value - 0.5]  // Viewport for rides view

  // Calculate x-axis range based on view mode
  let xAxisRange: [number, number]
  let tickVals: number[]
  let tickText: string[]

  if (viewMode.value === 'requests' && detailRideData.value) {
    // Request view: scale to ride's constraint window
    const rideStart = detailRideData.value.earliestPickup ?? detailRideData.value.start
    const rideEnd = detailRideData.value.latestDropoff ?? detailRideData.value.end
    xAxisRange = [rideStart, rideEnd]

    // Generate 5-6 ticks across the ride window
    const rangeDuration = rideEnd - rideStart
    const tickInterval = Math.ceil(rangeDuration / 5)
    tickVals = []
    tickText = []
    for (let t = rideStart; t <= rideEnd; t += tickInterval) {
      tickVals.push(t)
      tickText.push(formatTime(t))
    }
    // Ensure end time is included
    if (tickVals[tickVals.length - 1] < rideEnd) {
      tickVals.push(rideEnd)
      tickText.push(formatTime(rideEnd))
    }
  } else {
    // Rides view: full 24-hour range with viewport
    xAxisRange = [viewportStart.value, viewportEnd.value]
    tickVals = generateTimeTickVals()
    tickText = generateTimeTickText()
  }

  const layout = {
    font: {
      family: fontFamily,
      color: textColor,
    },
    title: {
      text: '',  // Title shown in card header
      font: { color: textColor, size: 14, family: fontFamily },
    },
    xaxis: {
      title: { text: 'Time of Day', font: { color: textColor, size: 11, family: fontFamily } },
      tickfont: { color: textColor, size: 10, family: fontFamily },
      gridcolor: gridColor,
      linecolor: isScientific ? textColor : gridColor,  // Black axis line in scientific
      linewidth: isScientific ? 1.5 : 1,
      showline: true,
      zerolinecolor: gridColor,
      range: xAxisRange,
      tickmode: 'array',
      tickvals: tickVals,
      ticktext: tickText,
    },
    yaxis: {
      title: { text: '', font: { color: textColor, size: 11, family: fontFamily } },
      tickfont: { color: textColor, size: 10, family: fontFamily },
      gridcolor: gridColor,
      linecolor: isScientific ? textColor : gridColor,  // Black axis line in scientific
      linewidth: isScientific ? 1.5 : 1,
      showline: true,
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
    displayModeBar: !isScientific ? false : false,  // Always hide modebar
    responsive: true,
  })

  // Bind hover, click, and relayout events for cross-card coordination
  const plotEl = plotContainer.value as any
  plotEl.on('plotly_hover', handleHover)
  plotEl.on('plotly_unhover', handleUnhover)
  plotEl.on('plotly_click', handleClick)
  plotEl.on('plotly_doubleclick', () => {
    resetZoom()
    return false
  })
  plotEl.on('plotly_relayout', handlePlotlyRelayout)

  // Re-render minimap only in rides view
  if (viewMode.value === 'rides') {
    renderMinimap()
  }
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
  shouldAutoFitRides.value = true
  renderChart()
})

// Watch for external hover changes from linkage
watch(
  [() => props.hoveredIds, () => props.hoveredIds?.size ?? 0],
  () => {
    debugLog('[TimelineCard] hoveredIds changed:', props.hoveredIds?.size ?? 0, 'items')
    updateHoverVisuals()
  }
)

// Watch for external selection changes from linkage
watch(
  [() => props.selectedIds, () => props.selectedIds?.size ?? 0],
  () => {
    debugLog('[TimelineCard] selectedIds changed:', props.selectedIds?.size ?? 0, 'items')
    // Sync internal state with external selection and update visuals
    if (props.selectedIds) {
      selectedRides.value = new Set([...props.selectedIds].map(id => String(id)))
      updateSelectionVisuals()
    }
  }
)

// Re-render on color scheme changes (including scientific mode)
watch(() => globalStore.state.colorScheme, () => {
  renderChart()
  renderMinimap()
})

watch(() => props.colorByAttribute, () => {
  renderChart()
})

// Re-render when comparison mode changes
watch(() => props.showComparison, (newVal) => {
  debugLog('[TimelineCard] showComparison changed to:', newVal, '- re-rendering')
  if (viewMode.value === 'rides') {
    shouldAutoFitRides.value = true
  }
  renderChart()
})

// Re-render when view mode changes
watch(viewMode, (newMode) => {
  debugLog('[TimelineCard] viewMode changed to:', newMode, '- re-rendering')
  nextTick(() => renderChart())
})

// Re-render when baseline data changes
watch(() => props.baselineData, () => {
  if (props.showComparison) {
    debugLog('[TimelineCard] baselineData changed in comparison mode - re-rendering')
    if (viewMode.value === 'rides') {
      shouldAutoFitRides.value = true
    }
    renderChart()
  }
})

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

.plot-container {
  flex: 1;
  min-height: 200px;
}

.minimap-container {
  position: relative;
  height: 50px;
  padding: 5px 8px;
}

.minimap-controls {
  position: absolute;
  top: 4px;
  right: 8px;
  z-index: 5;
  display: flex;
  gap: 4px;
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

/* Detail header for request view */
.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dashboard-border-default, #e5e7eb);
  background: var(--dashboard-background-secondary, #f9fafb);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid var(--dashboard-border-default, #e5e7eb);
  border-radius: 4px;
  background: var(--dashboard-background-primary, #fff);
  cursor: pointer;
  font-size: 12px;
  color: var(--dashboard-text-primary, #333);
  transition: background 0.2s;
}

.back-btn:hover {
  background: var(--dashboard-background-secondary, #f3f4f6);
}

.back-btn i {
  font-size: 11px;
}

.detail-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dashboard-text-primary, #111827);
}
</style>
