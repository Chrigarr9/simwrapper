<template>
  <div class="linkable-card-wrapper">
    <slot
      :filtered-data="filteredData"
      :baseline-data="baselineData"
      :show-comparison="showComparison"
      :hovered-ids="hoveredIds"
      :selected-ids="selectedIds"
      :handle-filter="handleFilter"
      :handle-hover="handleHover"
      :handle-select="handleSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { FilterManager, FilterObserver } from '../../managers/FilterManager'
import type { LinkageManager, LinkageObserver } from '../../managers/LinkageManager'
import type { DataTableManager } from '../../managers/DataTableManager'
import { debugLog } from '../../utils/debug'

interface Props {
  card: any
  filterManager: FilterManager
  linkageManager: LinkageManager
  dataTableManager?: DataTableManager | null  // Optional: null when no table config
  showComparison?: boolean  // Whether comparison mode is active
}

const props = withDefaults(defineProps<Props>(), {
  showComparison: false,
})

const hoveredIds = ref<Set<any>>(new Set())
const selectedIds = ref<Set<any>>(new Set())
const filteredData = ref<any[]>([])

const usesVisualSample = computed(() => !!props.card?.useVisualSample)

function toBool(value: any): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes'
  }
  return false
}

function applyVisualSampleFilter(data: any[]): any[] {
  if (!usesVisualSample.value) return data
  return data.filter((row: any) => toBool(row?.is_visual_sampled))
}

// Baseline data: all data from data table manager (unfiltered)
const baselineData = computed(() => {
  if (!props.dataTableManager) {
    return []
  }
  const allData = props.dataTableManager.getData()
  return applyVisualSampleFilter(allData)
})

const filterObserver: FilterObserver = {
  onFilterChange: (filters) => {
    debugLog('[LinkableCardWrapper] Filter changed for card:', props.card.title || props.card.type, 'filters:', filters)
    updateFilteredData()
  },
}

const linkageObserver: LinkageObserver = {
  onHoveredIdsChange: (ids: Set<any>) => {
    // Create a new Set to ensure Vue's reactivity detects the change
    hoveredIds.value = new Set(ids)
  },
  onSelectedIdsChange: (ids: Set<any>) => {
    debugLog('[LinkableCardWrapper] onSelectedIdsChange for card:', props.card.title || props.card.type, 'ids size:', ids.size)
    // Create a new Set to ensure Vue's reactivity detects the change
    selectedIds.value = new Set(ids)
  },
}

const handleFilter = (filterId: string, column: string, values: Set<any>, filterType?: string, binSize?: number) => {
  // Determine the filter type (default to 'categorical')
  const type = (filterType as 'categorical' | 'binned') || 'categorical'

  // Cards (HistogramCard, PieChartCard, etc.) manage their own selection state internally
  // and emit the complete set of what should be selected. We simply pass this through
  // to the FilterManager - no additional toggle logic needed here.
  //
  // The card's emitted values represent the TRUTH of what should be filtered.
  // If values is empty, FilterManager.setFilter will remove the filter entirely.

  debugLog('[LinkableCardWrapper] Filter event:', filterId, column, values, 'type:', type, 'binSize:', binSize)
  props.filterManager.setFilter(filterId, column, values, type, binSize)
}

const handleHover = (ids: Set<any>) => {
  debugLog('[LinkableCardWrapper] Hover event:', ids)
  props.linkageManager.setHoveredIds(ids)
}

const handleSelect = (ids: Set<any>) => {
  // Check for card-level linkage behavior first
  let behavior = props.card.linkage?.behavior

  // For map cards with layer-level linkage, check if any layer has toggle behavior
  // Default to 'toggle' for map selections as that's the expected UX
  if (!behavior && props.card.layers) {
    const hasLayerLinkage = props.card.layers.some((layer: any) => layer.linkage)
    if (hasLayerLinkage) {
      behavior = 'toggle' // Default to toggle for map layer interactions
    }
  }

  debugLog('[LinkableCardWrapper] Select event for card:', props.card.title || props.card.type, 'ids size:', ids.size, 'behavior:', behavior)

  if (behavior === 'toggle') {
    props.linkageManager.toggleSelectedIds(ids)
  } else {
    props.linkageManager.setSelectedIds(ids)
  }
}

const updateFilteredData = () => {
  // If no dataTableManager, pass empty array (no central data to filter)
  // Cards can still render their own content (loaded from their own files)
  if (!props.dataTableManager) {
    filteredData.value = []
    return
  }
  const allData = props.dataTableManager.getData()
  const idColumn = props.dataTableManager.getIdColumn()
  // Use centralized cached filtering instead of per-card applyFilters.
  // All N wrappers now share the SAME cached array reference from getFilteredData(),
  // so filter computation happens exactly once per filter change.
  const filtered = props.filterManager.getFilteredData(allData, idColumn)
  debugLog('[LinkableCardWrapper] updateFilteredData for', props.card.title || props.card.type,
    '- all:', allData.length, 'filtered:', filtered.length)
  filteredData.value = applyVisualSampleFilter(filtered)
}

// Watch showComparison prop changes (uses debugLog for controlled output)
watch(() => props.showComparison, (newVal, oldVal) => {
  debugLog('[LinkableCardWrapper] showComparison changed:', oldVal, '->', newVal, 'for card:', props.card.title || props.card.type)
}, { immediate: true })

onMounted(() => {
  props.filterManager.addObserver(filterObserver)
  props.linkageManager.addObserver(linkageObserver)
  updateFilteredData()
})

onUnmounted(() => {
  props.filterManager.removeObserver(filterObserver)
  props.linkageManager.removeObserver(linkageObserver)
})
</script>

<style scoped>
.linkable-card-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;  /* Contain the child but let it scroll internally */
}
</style>
