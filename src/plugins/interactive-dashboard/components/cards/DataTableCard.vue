<template>
  <div class="data-table-card">
    <!-- Header buttons -->
    <div class="table-controls">
      <!-- Auto-scroll toggle -->
      <label class="scroll-toggle" title="Auto-scroll to hovered row">
        <input type="checkbox" v-model="enableScrollOnHover" />
        <span class="scroll-label">Scroll</span>
      </label>

      <!-- Comparison count display -->
      <span
        v-if="showComparison && comparisonCountText"
        class="comparison-count"
        title="Filtered rows / Total rows"
      >
        {{ comparisonCountText }}
      </span>

      <!-- Comparison mode toggle -->
      <ComparisonToggle
        :model-value="showComparison"
        :disabled="!hasActiveFilters"
        @update:model-value="handleComparisonToggle"
      />

      <!-- Filter reset button -->
      <button
        v-if="hasActiveFilters"
        class="button is-small is-white"
        @click="handleClearAllFilters"
        title="Clear all filters"
      >
        <i class="fa fa-times-circle"></i>
        <span class="reset-label"> Reset</span>
      </button>
      <!-- Note: Fullscreen is handled by dashboard-level card header, not here -->
    </div>

    <!-- Table contents -->
    <div class="table-wrapper" ref="tableWrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="col in visibleColumns"
              :key="col"
              @click="sortByColumn(col)"
              :class="{ sortable: true, sorted: sortColumn === col }"
            >
              <div class="header-cell">
                <span>{{ col }}</span>
                <span class="sort-icon" v-if="sortColumn === col">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in sortedDisplayData"
            :key="getUniqueRowKey(row, rowIndex)"
            :data-row-id="getRowId(row)"
            :class="getRowClasses(row)"
            @mouseenter="handleRowHover(row)"
            @mouseleave="handleRowLeave"
            @click="handleRowClick(row)"
          >
            <td
              v-for="col in visibleColumns"
              :key="col"
            >
              {{ formatCellValue(row[col], col) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { FilterManager, FilterObserver } from '../../managers/FilterManager'
import type { LinkageManager } from '../../managers/LinkageManager'
import type { DataTableManager } from '../../managers/DataTableManager'
import { debugLog } from '../../utils/debug'
import ComparisonToggle from '../controls/ComparisonToggle.vue'

interface Props {
  // From LinkableCardWrapper
  filteredData?: any[]
  hoveredIds?: Set<any>
  selectedIds?: Set<any>

  // Table configuration
  tableConfig?: {
    name?: string
    idColumn?: string
    columns?: {
      hide?: string[]
      show?: string[]  // If set, ONLY show these columns (takes precedence over hide)
      maxColumns?: number  // Maximum columns to display (default: 50)
      formats?: Record<string, any>
    }
  }

  // Managers passed from parent
  dataTableManager?: DataTableManager | null
  filterManager?: FilterManager | null
  linkageManager?: LinkageManager | null

  // Comparison mode
  baselineData?: any[]      // All data (unfiltered) for comparison mode
  showComparison?: boolean  // Whether comparison mode is active
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  hoveredIds: () => new Set(),
  selectedIds: () => new Set(),
  baselineData: () => [],
  showComparison: false,
})

const emit = defineEmits(['filter', 'hover', 'select', 'isLoaded', 'update:show-comparison'])

// Local state
const tableWrapper = ref<HTMLElement | null>(null)
const sortColumn = ref('')
const sortDirection = ref<'asc' | 'desc'>('asc')
const enableScrollOnHover = ref(true)
const isHoverFromTable = ref(false)

// Reactive counter to trigger recomputation when filters change
const filterVersion = ref(0)

// Filter observer to track filter changes
const filterObserver: FilterObserver = {
  onFilterChange: () => {
    debugLog('[DataTableCard] Filter changed, incrementing version')
    filterVersion.value++
  },
}

// Computed: Check if filters are active (depends on filterVersion for reactivity)
const hasActiveFilters = computed(() => {
  // Access filterVersion to create reactive dependency
  const _ = filterVersion.value
  return props.filterManager?.hasActiveFilters() || false
})

// Get all data from the manager
const displayData = computed(() => {
  if (!props.dataTableManager) return []
  return props.dataTableManager.getData()
})

// Get filtered row IDs for highlighting (depends on filterVersion for reactivity)
const filteredRowIds = computed(() => {
  // Access filterVersion to create reactive dependency
  const _ = filterVersion.value
  if (!props.filterManager || displayData.value.length === 0) return new Set()
  const filtered = props.filterManager.applyFilters(displayData.value)
  const idColumn = props.tableConfig?.idColumn || 'id'
  debugLog('[DataTableCard] filteredRowIds recomputed - filtered count:', filtered.length, 'version:', filterVersion.value)
  return new Set(filtered.map((row: any) => row[idColumn]))
})

// Visible columns (respect show list, exclude hidden ones, limit by maxColumns)
const visibleColumns = computed(() => {
  if (!props.dataTableManager || displayData.value.length === 0) return []
  const allColumns = Object.keys(displayData.value[0])
  const columnsConfig = props.tableConfig?.columns

  // If 'show' is specified, only show those columns (in that order)
  if (columnsConfig?.show && columnsConfig.show.length > 0) {
    const showList = columnsConfig.show.filter(col => allColumns.includes(col))
    debugLog('[DataTableCard] Using explicit show list:', showList.length, 'columns')
    return showList
  }

  // Otherwise, filter out hidden columns
  const hiddenColumns = columnsConfig?.hide || []
  let filtered = allColumns.filter(col => !hiddenColumns.includes(col))

  // Apply maxColumns limit (default: 50 for performance)
  const maxColumns = columnsConfig?.maxColumns ?? 50
  if (filtered.length > maxColumns) {
    debugLog('[DataTableCard] Limiting columns from', filtered.length, 'to', maxColumns)
    filtered = filtered.slice(0, maxColumns)
  }

  return filtered
})

// Comparison count text
const comparisonCountText = computed(() => {
  if (!props.showComparison) return ''
  const filteredCount = props.filteredData?.length || 0
  const baselineCount = props.baselineData?.length || 0
  return `${filteredCount} / ${baselineCount}`
})

// Handle comparison toggle change
const handleComparisonToggle = (value: boolean) => {
  console.log('[DataTableCard] handleComparisonToggle - value:', value)
  emit('update:show-comparison', value)
}

// Sort and arrange data: filtered rows on top, then unfiltered
const sortedDisplayData = computed(() => {
  if (displayData.value.length === 0) return []

  const hasFilters = props.filterManager && props.filterManager.hasActiveFilters()
  const idColumn = props.tableConfig?.idColumn || 'id'

  debugLog('[DataTableCard] sortedDisplayData - hasFilters:', hasFilters,
    'filteredRowIds count:', filteredRowIds.value.size,
    'total rows:', displayData.value.length)

  // Separate filtered and unfiltered rows
  let filtered: any[] = []
  let unfiltered: any[] = []

  if (hasFilters) {
    for (const row of displayData.value) {
      if (filteredRowIds.value.has(row[idColumn])) {
        filtered.push(row)
      } else {
        unfiltered.push(row)
      }
    }
  } else {
    filtered = [...displayData.value]
  }

  // Sort function
  const sortFn = (a: any, b: any) => {
    if (!sortColumn.value) return 0

    const aVal = a[sortColumn.value]
    const bVal = b[sortColumn.value]

    if (aVal === undefined || aVal === null) return 1
    if (bVal === undefined || bVal === null) return -1

    let comparison = 0
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    } else {
      comparison = String(aVal).localeCompare(String(bVal))
    }

    return sortDirection.value === 'asc' ? comparison : -comparison
  }

  // Sort each group
  filtered.sort(sortFn)
  unfiltered.sort(sortFn)

  // Filtered on top, then unfiltered
  return [...filtered, ...unfiltered]
})

// Get row ID
function getRowId(row: any): any {
  const idColumn = props.tableConfig?.idColumn || 'id'
  return row[idColumn]
}

// Get unique row key for Vue v-for (handles duplicate IDs)
function getUniqueRowKey(row: any, index: number): string {
  const rowId = getRowId(row)
  return `${index}-${rowId}`
}

// Get row CSS classes
function getRowClasses(row: any): Record<string, boolean> {
  const rowId = getRowId(row)
  const hasFilters = !!(props.filterManager && props.filterManager.hasActiveFilters())

  return {
    'is-hovered': props.hoveredIds.has(rowId),
    'is-selected': props.selectedIds.has(rowId),
    'is-filtered': hasFilters && filteredRowIds.value.has(rowId),
    'is-dimmed': hasFilters && !filteredRowIds.value.has(rowId),
  }
}

// Format cell value
function formatCellValue(value: any, column: string): string {
  if (value === undefined || value === null) return ''

  const formats = props.tableConfig?.columns?.formats
  if (!formats || !formats[column]) {
    // Default formatting for numbers
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(2)
    }
    return String(value)
  }

  const format = formats[column]

  switch (format.type) {
    case 'time': {
      // Convert seconds to HH:MM:SS
      if (format.convertFrom === 'seconds' && typeof value === 'number') {
        const hours = Math.floor(value / 3600)
        const minutes = Math.floor((value % 3600) / 60)
        const seconds = Math.floor(value % 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      }
      return String(value)
    }
    case 'duration': {
      if (format.convertFrom === 'seconds' && typeof value === 'number') {
        const decimals = format.decimals ?? 1
        if (format.unit === 'min') {
          return (value / 60).toFixed(decimals) + ' min'
        }
        return value.toFixed(decimals) + ' s'
      }
      return String(value)
    }
    case 'distance': {
      if (format.convertFrom === 'meters' && typeof value === 'number') {
        const decimals = format.decimals ?? 2
        if (format.unit === 'km') {
          return (value / 1000).toFixed(decimals) + ' km'
        }
        return value.toFixed(decimals) + ' m'
      }
      return String(value)
    }
    case 'decimal': {
      if (typeof value === 'number') {
        const decimals = format.decimals ?? 2
        return value.toFixed(decimals)
      }
      return String(value)
    }
    default:
      return String(value)
  }
}

// Sort by column
function sortByColumn(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

// Handle row hover
function handleRowHover(row: any) {
  isHoverFromTable.value = true
  const rowId = getRowId(row)
  emit('hover', new Set([rowId]))
}

// Handle row leave
function handleRowLeave() {
  isHoverFromTable.value = false
  emit('hover', new Set())
}

// Handle row click
function handleRowClick(row: any) {
  const rowId = getRowId(row)
  emit('select', new Set([rowId]))
}

// Clear all filters
function handleClearAllFilters() {
  if (props.filterManager) {
    props.filterManager.clearAllFilters()
  }
  if (props.linkageManager) {
    props.linkageManager.setSelectedIds(new Set())
  }
}

// Debug: watch showComparison prop changes
watch(() => props.showComparison, (newVal, oldVal) => {
  console.log('[DataTableCard] showComparison prop changed:', oldVal, '->', newVal)
})

// Scroll to hovered row when hover comes from map
watch(() => props.hoveredIds, async (newVal) => {
  if (newVal.size === 0) return
  if (!enableScrollOnHover.value) return
  if (isHoverFromTable.value) return

  await nextTick()

  const firstId = Array.from(newVal)[0]
  const rowElement = tableWrapper.value?.querySelector(`tr[data-row-id="${firstId}"]`)
  if (rowElement) {
    rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}, { deep: true })

// Register filter observer on mount and emit loaded
onMounted(() => {
  if (props.filterManager) {
    debugLog('[DataTableCard] Registering filter observer')
    props.filterManager.addObserver(filterObserver)
  }
  // Emit isLoaded to hide the spinner in the dashboard card frame
  emit('isLoaded')
})

// Unregister filter observer on unmount
onUnmounted(() => {
  if (props.filterManager) {
    debugLog('[DataTableCard] Unregistering filter observer')
    props.filterManager.removeObserver(filterObserver)
  }
})
</script>

<style scoped>
/*
 * DataTableCard theme colors via CSS variables
 * Managed by StyleManager - see managers/StyleManager.ts
 *
 * Variables used:
 * - --dashboard-bg-primary, --dashboard-bg-secondary, --dashboard-bg-tertiary
 * - --dashboard-text-primary, --dashboard-text-secondary
 * - --dashboard-border-default, --dashboard-border-subtle
 * - --dashboard-interaction-hover (#fbbf24), --dashboard-interaction-selected (#3b82f6)
 *
 * Fallback pattern: var(--dashboard-X, var(--app-X, #fallback))
 */
.data-table-card {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
}

.table-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background: var(--dashboard-bg-secondary, var(--bgBold));
  border-bottom: 1px solid var(--dashboard-border-subtle, var(--borderFaint));
  z-index: 2;
  height: 28px;
}

.scroll-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--dashboard-text-primary, var(--text));
}

.scroll-toggle input {
  cursor: pointer;
}

.scroll-label,
.reset-label {
  font-size: 0.7rem;
}

.comparison-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--dashboard-interaction-selected, #3b82f6);
  padding: 0 0.5rem;
  border-left: 1px solid var(--dashboard-border-subtle, var(--borderFaint));
  margin-left: auto;  /* Push to right side */
}

.table-wrapper {
  position: absolute;
  top: 28px;  /* Height of controls */
  left: 0;
  right: 0;
  bottom: 0;
  overflow: scroll;   /* Always show scrollbars */
}

/* Custom scrollbar styling for better visibility */
.table-wrapper::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: var(--dashboard-bg-secondary, var(--bgPanel));
  border-radius: 6px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: var(--dashboard-text-secondary, var(--textFaint));
  border-radius: 6px;
  border: 2px solid var(--dashboard-bg-secondary, var(--bgPanel));
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--dashboard-text-primary, var(--text));
}

.table-wrapper::-webkit-scrollbar-corner {
  background: var(--dashboard-bg-secondary, var(--bgPanel));
}

/* Firefox scrollbar */
.table-wrapper {
  scrollbar-width: auto;
  scrollbar-color: var(--dashboard-text-secondary, var(--textFaint)) var(--dashboard-bg-secondary, var(--bgPanel));
}

.data-table {
  width: max-content;  /* Allow table to be wider than container for horizontal scroll */
  min-width: 100%;     /* But at minimum fill the container */
  border-collapse: collapse;
  font-size: 0.8rem;
}

.data-table thead {
  position: sticky;
  top: 0;
  background: var(--dashboard-bg-secondary, var(--bgBold));
  z-index: 1;
}

.data-table th {
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid var(--dashboard-border-default, var(--borderFaint));
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  color: var(--dashboard-text-primary, var(--text));
}

.data-table th:hover {
  background: var(--dashboard-bg-tertiary, var(--bgHover));
}

.data-table th.sorted {
  background: var(--dashboard-bg-tertiary, var(--bgPanel));
  color: var(--dashboard-interaction-selected, var(--link));
}

.header-cell {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.sort-icon {
  font-size: 0.7rem;
  color: var(--dashboard-interaction-selected, var(--link));
}

.data-table td {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--dashboard-border-subtle, var(--borderFaint));
  white-space: nowrap;
  color: var(--dashboard-text-primary, var(--text));
}

.data-table tbody tr {
  transition: background-color 0.15s ease;
}

.data-table tbody tr:hover {
  background: var(--dashboard-bg-tertiary, var(--bgHover));
}

/* Hovered from map/other component - use hover color (#fbbf24) */
.data-table tbody tr.is-hovered {
  background: rgba(251, 191, 36, 0.2) !important;  /* --dashboard-interaction-hover at 20% */
}

/* Selected (clicked) rows - use selected color (#3b82f6) */
.data-table tbody tr.is-selected {
  background: rgba(59, 130, 246, 0.2) !important;  /* --dashboard-interaction-selected at 20% */
}

.data-table tbody tr.is-dimmed {
  opacity: 0.4;
}

.data-table tbody tr.is-filtered {
  font-weight: 500;
}

.button.is-small.is-white {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  color: var(--dashboard-text-primary, var(--text));
}

.button.is-small.is-white:hover {
  background: var(--dashboard-bg-tertiary, var(--bgHover));
}
</style>
