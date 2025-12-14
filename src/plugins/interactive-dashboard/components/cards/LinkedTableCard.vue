<template>
  <div class="linked-table-section" :class="{ 'is-collapsed': isCollapsed }">
    <!-- Section Header -->
    <div class="section-header" @click="toggleCollapse">
      <span class="collapse-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
      <h3 class="section-title">{{ title }}</h3>
      <span class="row-count">({{ filteredRowCount }} rows)</span>
    </div>

    <!-- Section Content -->
    <div v-if="!isCollapsed" class="section-content">
      <div class="section-grid" :class="{ 'has-map': hasMap }">
        <!-- Table Panel -->
        <div class="table-panel">
          <div class="table-controls">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search..." 
              class="search-input"
            />
          </div>
          <div class="table-wrapper">
            <table class="linked-table">
              <thead>
                <tr>
                  <th 
                    v-for="col in visibleColumns" 
                    :key="col"
                    @click="sortBy(col)"
                    :class="{ sorted: sortColumn === col }"
                  >
                    {{ formatColumnName(col) }}
                    <span v-if="sortColumn === col" class="sort-indicator">
                      {{ sortDirection === 'asc' ? '↑' : '↓' }}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(row, idx) in displayedRows" 
                  :key="`${idColumn}-${row[idColumn]}-${idx}`"
                  :class="{
                    'is-hovered': hoveredRowId === row[idColumn],
                    'is-selected': selectedRowIds.has(row[idColumn])
                  }"
                  @mouseenter="handleRowHover(row)"
                  @mouseleave="handleRowUnhover"
                  @click="handleRowClick(row)"
                >
                  <td v-for="col in visibleColumns" :key="col">
                    {{ formatCellValue(row[col], col) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Map Panel (if configured) -->
        <div v-if="hasMap" class="map-panel">
          <map-card
            :title="mapConfig?.title || 'Map'"
            :center="mapConfig?.center"
            :zoom="mapConfig?.zoom"
            :layers="mapLayers"
            :filtered-data="filteredData"
            :hovered-ids="hoveredIds"
            :selected-ids="selectedIds"
            :file-system-config="fileSystemConfig"
            :subfolder="subfolder"
            :tooltip="mapConfig?.tooltip"
            :legend="mapConfig?.legend"
            @hover="handleMapHover"
            @select="handleMapSelect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import MapCard from './MapCard.vue'
import { LinkedTableManager, DataRow } from '../managers/LinkedTableManager'
import { debugLog } from '../utils/debug'

interface ColumnFormat {
  type: 'time' | 'duration' | 'distance' | 'decimal' | 'percent'
  convertFrom?: string
  unit?: string
  decimals?: number
}

interface MapLayerConfig {
  name: string
  file: string
  type: 'polygon' | 'line' | 'arc' | 'scatterplot'
  visible?: boolean
  colorBy?: any
  linkage?: {
    tableColumn: string
    geoProperty: string
    onHover?: string
    onSelect?: string
  }
  [key: string]: any
}

interface MapConfig {
  title?: string
  center?: [number, number]
  zoom?: number
  layers?: MapLayerConfig[]
  tooltip?: { enabled: boolean; template?: string }
  legend?: { enabled: boolean; position?: string }
}

interface Props {
  title: string
  tableManager: LinkedTableManager
  idColumn: string
  columns?: {
    show?: string[]
    hide?: string[]
    formats?: Record<string, ColumnFormat>
  }
  mapConfig?: MapConfig
  fileSystemConfig?: any
  subfolder?: string
  initialCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  initialCollapsed: false,
  subfolder: ''
})

const emit = defineEmits<{
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
}>()

// State
const isCollapsed = ref(props.initialCollapsed)
const searchQuery = ref('')
const sortColumn = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')
const hoveredRowId = ref<any>(null)
const selectedRowIds = ref<Set<any>>(new Set())
const filteredData = ref<DataRow[]>([])

// Computed
const allData = computed(() => props.tableManager?.getFilteredData() || [])

const filteredRowCount = computed(() => filteredData.value.length)

const hasMap = computed(() => !!props.mapConfig?.layers?.length)

const visibleColumns = computed(() => {
  if (allData.value.length === 0) return []
  
  const allColumns = Object.keys(allData.value[0])
  
  // Apply show filter
  let columns = props.columns?.show?.length 
    ? allColumns.filter(c => props.columns!.show!.includes(c))
    : allColumns
  
  // Apply hide filter
  if (props.columns?.hide?.length) {
    columns = columns.filter(c => !props.columns!.hide!.includes(c))
  }
  
  return columns
})

const displayedRows = computed(() => {
  let rows = [...filteredData.value]
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    rows = rows.filter(row => 
      visibleColumns.value.some(col => 
        String(row[col]).toLowerCase().includes(query)
      )
    )
  }
  
  // Apply sorting
  if (sortColumn.value) {
    rows.sort((a, b) => {
      const aVal = a[sortColumn.value!]
      const bVal = b[sortColumn.value!]
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDirection.value === 'asc' ? comparison : -comparison
    })
  }
  
  return rows
})

const hoveredIds = computed(() => {
  return hoveredRowId.value ? new Set([hoveredRowId.value]) : new Set()
})

const selectedIds = computed(() => selectedRowIds.value)

const mapLayers = computed(() => {
  if (!props.mapConfig?.layers) return []
  
  // Add linkage to layers if not present
  return props.mapConfig.layers.map(layer => ({
    ...layer,
    linkage: layer.linkage || {
      tableColumn: props.idColumn,
      geoProperty: props.idColumn,
      onHover: 'highlight',
      onSelect: 'filter'
    }
  }))
})

// Methods
function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function sortBy(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

function formatColumnName(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatCellValue(value: any, column: string): string {
  if (value === null || value === undefined) return ''
  
  const format = props.columns?.formats?.[column]
  if (!format) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? String(value) : value.toFixed(2)
    }
    return String(value)
  }
  
  switch (format.type) {
    case 'time':
      if (format.convertFrom === 'seconds') {
        const hours = Math.floor(value / 3600)
        const minutes = Math.floor((value % 3600) / 60)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      }
      return String(value)
    case 'duration':
      if (format.convertFrom === 'seconds' && format.unit === 'min') {
        return `${(value / 60).toFixed(format.decimals ?? 1)} min`
      }
      return String(value)
    case 'distance':
      if (format.convertFrom === 'meters' && format.unit === 'km') {
        return `${(value / 1000).toFixed(format.decimals ?? 2)} km`
      }
      return String(value)
    case 'percent':
      return `${(value * 100).toFixed(format.decimals ?? 1)}%`
    case 'decimal':
      return value.toFixed(format.decimals ?? 2)
    default:
      return String(value)
  }
}

function handleRowHover(row: DataRow) {
  hoveredRowId.value = row[props.idColumn]
  emit('hover', new Set([row[props.idColumn]]))
}

function handleRowUnhover() {
  hoveredRowId.value = null
  emit('hover', new Set())
}

function handleRowClick(row: DataRow) {
  const id = row[props.idColumn]
  if (selectedRowIds.value.has(id)) {
    selectedRowIds.value.delete(id)
  } else {
    selectedRowIds.value.add(id)
  }
  emit('select', new Set(selectedRowIds.value))
}

function handleMapHover(ids: Set<any>) {
  if (ids.size > 0) {
    hoveredRowId.value = Array.from(ids)[0]
  } else {
    hoveredRowId.value = null
  }
}

function handleMapSelect(ids: Set<any>) {
  selectedRowIds.value = new Set(ids)
  emit('select', selectedRowIds.value)
}

// Watch for data changes from LinkedTableManager
watch(() => props.tableManager?.getFilteredData(), (newData) => {
  filteredData.value = newData || []
  // Reset selection when parent filter changes
  selectedRowIds.value.clear()
  hoveredRowId.value = null
}, { immediate: true, deep: true })

// Also listen to tableManager events
onMounted(() => {
  if (props.tableManager) {
    props.tableManager.addListener((data) => {
      filteredData.value = data
    })
  }
})
</script>

<style scoped>
.linked-table-section {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  margin-bottom: 16px;
  background: var(--bg-color, #ffffff);
}

.section-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  background: var(--header-bg, #f9fafb);
  border-radius: 8px 8px 0 0;
  user-select: none;
}

.linked-table-section.is-collapsed .section-header {
  border-radius: 8px;
}

.collapse-icon {
  margin-right: 8px;
  font-size: 12px;
  color: var(--text-muted, #6b7280);
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color, #1f2937);
}

.row-count {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-muted, #6b7280);
}

.section-content {
  padding: 16px;
}

.section-grid {
  display: grid;
  gap: 16px;
}

.section-grid.has-map {
  grid-template-columns: 1fr 1fr;
}

.table-panel {
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.table-controls {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 4px;
  font-size: 13px;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 4px;
}

.linked-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.linked-table th {
  position: sticky;
  top: 0;
  background: var(--header-bg, #f9fafb);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.linked-table th:hover {
  background: var(--hover-bg, #f3f4f6);
}

.linked-table th.sorted {
  color: var(--primary-color, #3b82f6);
}

.sort-indicator {
  margin-left: 4px;
}

.linked-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #f3f4f6);
}

.linked-table tbody tr {
  transition: background-color 0.1s;
}

.linked-table tbody tr:hover {
  background: var(--hover-bg, #f9fafb);
}

.linked-table tbody tr.is-hovered {
  background: var(--highlight-bg, #fef3c7);
}

.linked-table tbody tr.is-selected {
  background: var(--selected-bg, #dbeafe);
}

.map-panel {
  min-height: 350px;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

/* Dark mode */
:global(.dark-mode) .linked-table-section {
  --bg-color: #1e293b;
  --header-bg: #334155;
  --border-color: #475569;
  --text-color: #f1f5f9;
  --text-muted: #94a3b8;
  --hover-bg: #475569;
  --highlight-bg: #854d0e;
  --selected-bg: #1e40af;
}
</style>
