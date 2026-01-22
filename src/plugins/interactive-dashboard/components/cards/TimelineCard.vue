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
 * Transform filteredData into TimelineItem[] for track allocation
 * Uses configured column names to extract id, start, and end times
 */
const timelineData = computed((): TimelineItem[] => {
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[TimelineCard] No filtered data available')
    return []
  }

  debugLog('[TimelineCard] Computing timeline data from', props.filteredData.length, 'rows')

  const items: TimelineItem[] = []

  for (const row of props.filteredData) {
    const id = row[props.idColumn]
    const start = row[props.startColumn]
    const end = row[props.endColumn]

    // Validate required fields
    if (id !== null && id !== undefined &&
        typeof start === 'number' && !isNaN(start) &&
        typeof end === 'number' && !isNaN(end)) {
      items.push({
        id: String(id),
        start,
        end,
      })
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
 * Render the Plotly timeline chart
 * Uses horizontal bar traces with base property for Gantt-style visualization
 *
 * Implementation will be completed in Plan 04-02
 */
function renderChart() {
  if (!plotContainer.value) return

  // Theme-aware colors from StyleManager
  const styleManager = StyleManager.getInstance()
  const bgColor = styleManager.getColor('theme.background.primary')
  const textColor = styleManager.getColor('theme.text.primary')
  const gridColor = styleManager.getColor('theme.border.default')

  debugLog('[TimelineCard] Rendering chart, tracks:', trackAllocation.value.size > 0
    ? [...trackAllocation.value.values()][0]?.totalTracks ?? 0
    : 0)

  // Placeholder layout for scaffold
  // Full implementation in Plan 04-02
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
      tickvals: [0, 21600, 43200, 64800, 86400],
      ticktext: ['00:00', '06:00', '12:00', '18:00', '24:00'],
    },
    yaxis: {
      title: { text: 'Tracks', font: { color: textColor, size: 11 } },
      tickfont: { color: textColor, size: 10 },
      gridcolor: gridColor,
      linecolor: gridColor,
      autorange: 'reversed',  // Track 0 at top
    },
    margin: { l: 50, r: 15, t: 10, b: 35 },
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    barmode: 'overlay',  // For nested bars (constraint window + actual travel)
    showlegend: false,
  }

  // Empty trace placeholder - full implementation in Plan 04-02
  const traces: any[] = []

  Plotly.newPlot(plotContainer.value, traces, layout, {
    displayModeBar: false,
    responsive: true,
  })
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

// Watch for hover/selection changes from linkage
watch([() => props.hoveredIds, () => props.selectedIds], () => {
  debugLog('[TimelineCard] hoveredIds or selectedIds changed')
  renderChart()
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
