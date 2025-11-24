<template>
  <div class="linkable-card-wrapper">
    <slot
      :filtered-data="filteredData"
      :hovered-ids="hoveredIds"
      :selected-ids="selectedIds"
      @filter="handleFilter"
      @hover="handleHover"
      @select="handleSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { FilterManager, FilterObserver } from '../../managers/FilterManager'
import type { LinkageManager, LinkageObserver } from '../../managers/LinkageManager'
import type { DataTableManager } from '../../managers/DataTableManager'

interface Props {
  card: any
  filterManager: FilterManager
  linkageManager: LinkageManager
  dataTableManager: DataTableManager
}

const props = defineProps<Props>()

const hoveredIds = ref<Set<any>>(new Set())
const selectedIds = ref<Set<any>>(new Set())
const filteredData = ref<any[]>([])

const filterObserver: FilterObserver = {
  onFilterChange: () => {
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

const handleFilter = (filterId: string, column: string, values: Set<any>) => {
  props.filterManager.setFilter(filterId, column, values, 'categorical')
}

const handleHover = (ids: Set<any>) => {
  props.linkageManager.setHoveredIds(ids)
}

const handleSelect = (ids: Set<any>) => {
  if (props.card.linkage?.behavior === 'toggle') {
    props.linkageManager.toggleSelectedIds(ids)
  } else {
    props.linkageManager.setSelectedIds(ids)
  }
}

const updateFilteredData = () => {
  const allData = props.dataTableManager.getData()
  filteredData.value = props.filterManager.applyFilters(allData)
}

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
}
</style>
