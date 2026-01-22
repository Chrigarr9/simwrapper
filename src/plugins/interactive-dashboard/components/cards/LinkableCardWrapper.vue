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

// Baseline data: all data from data table manager (unfiltered)
const baselineData = computed(() => {
  if (!props.dataTableManager) {
    return []
  }
  return props.dataTableManager.getData()
})

const filterObserver: FilterObserver = {
  onFilterChange: (filters) => {
    debugLog('[LinkableCardWrapper] Filter changed for card:', props.card.title || props.card.type, 'filters:', filters)
    updateFilteredData()
  },
}

const linkageObserver: LinkageObserver = {
  onHoveredIdsChange: (ids: Set<any>) => {
    hoveredIds.value = ids
  },
  onSelectedIdsChange: (ids: Set<any>) => {
    selectedIds.value = ids
  },
}

const handleFilter = (filterId: string, column: string, values: Set<any>, filterType?: string, binSize?: number) => {
  // Determine the filter type (default to 'categorical')
  const type = (filterType as 'categorical' | 'binned') || 'categorical'

  // Check if this filter should use toggle behavior (for map cards with layer linkage)
  let useToggle = props.card.linkage?.behavior === 'toggle'
  if (!useToggle && props.card.layers) {
    const hasLayerLinkage = props.card.layers.some((layer: any) => layer.linkage)
    if (hasLayerLinkage) {
      useToggle = true
    }
  }

  if (useToggle) {
    // Toggle filter values - if all values are already in the filter, remove them
    const currentFilter = props.filterManager.getFilters().get(filterId)
    if (currentFilter) {
      const allValuesSelected = Array.from(values).every(v => currentFilter.values.has(v))
      if (allValuesSelected) {
        // Remove these values from the filter
        const newValues = new Set(currentFilter.values)
        values.forEach(v => newValues.delete(v))
        debugLog('[LinkableCardWrapper] Toggle filter OFF:', filterId, column, 'remaining:', newValues)
        props.filterManager.setFilter(filterId, column, newValues, type, binSize)
        return
      }
    }
  }

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

  debugLog('[LinkableCardWrapper] Select event:', ids, 'behavior:', behavior)

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
  const filtered = props.filterManager.applyFilters(allData)
  debugLog('[LinkableCardWrapper] updateFilteredData for', props.card.title || props.card.type,
    '- all:', allData.length, 'filtered:', filtered.length)
  filteredData.value = filtered
}

// Debug: watch showComparison prop changes
watch(() => props.showComparison, (newVal, oldVal) => {
  console.log('[LinkableCardWrapper] showComparison changed:', oldVal, '->', newVal, 'for card:', props.card.title || props.card.type)
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
