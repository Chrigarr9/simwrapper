<template lang="pug">
.request-table
  .table-header
    h3 {{ tableName }} Table
    .table-info
      span(v-if="filteredRequestIds.size > 0")
        | Showing {{ filteredRequestIds.size }} filtered + {{ requests.length - filteredRequestIds.size }} unfiltered = {{ requests.length }} total {{ tableName.toLowerCase() }}
      span(v-else)
        | Showing {{ requests.length }} {{ tableName.toLowerCase() }}
      button.export-btn(@click="exportToCSV") Export CSV

  .table-container(ref="tableContainer")
    table
      thead
        tr
          th(
            v-for="column in visibleColumns"
            :key="column.key"
            @click="sortBy(column.key)"
            :class="{ sortable: true, sorted: sortColumn === column.key }"
          )
            .header-cell
              span {{ column.label }}
              span.sort-icon(v-if="sortColumn === column.key")
                | {{ sortDirection === 'asc' ? '↑' : '↓' }}

      tbody
        tr(
          v-for="request in sortedRequests"
          :key="request.request_id"
          :data-request-id="request.request_id"
          @click="onRowClick(request)"
          @mouseenter="onRowHover(request)"
          @mouseleave="onRowHover(null)"
          :class="{\
            'is-selected': filteredRequestIds.has(String(request.request_id)),\
            'is-hovered': hoveredRequestId === String(request.request_id)\
          }"
        )
          td(v-for="column in visibleColumns" :key="column.key")
            | {{ formatValue(request[column.key], column.type, column.format) }}

</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Request, TableConfig, ColumnFormat } from '../CommuterRequestsConfig'

interface TableColumn {
  key: string
  label: string
  type: 'string' | 'number' | 'decimal' | 'time' | 'duration' | 'distance' | 'boolean'
  visible: boolean
  sortable: boolean
  format?: ColumnFormat  // Optional formatting config from YAML
}

export default defineComponent({
  name: 'RequestTable',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    filteredRequests: { type: Array as PropType<Request[]>, required: true },
    selectedRequestIds: { type: Set as PropType<Set<string>>, required: true },
    hoveredRequestId: { type: String as PropType<string | null>, default: null },
    enableScrollOnHover: { type: Boolean, default: true },
    tableConfig: { type: Object as PropType<TableConfig | undefined>, default: undefined },
  },

  data() {
    return {
      sortColumn: 'request_id' as string,
      sortDirection: 'asc' as 'asc' | 'desc',
      scrollToRequestId: null as string | null,
      isHoverFromTable: false, // Track if hover originated from table to prevent scroll loop
      allColumns: [] as TableColumn[], // Auto-generated from data
    }
  },

  mounted() {
    this.generateColumns()
  },

  watch: {
    requests: {
      handler() {
        // Regenerate columns when requests change (in case schema changes)
        this.generateColumns()
      },
      immediate: false,
    },
    hoveredRequestId(newVal) {
      console.log('RequestTable.watch.hoveredRequestId:', {
        newVal,
        enableScrollOnHover: this.enableScrollOnHover,
        isHoverFromTable: this.isHoverFromTable,
        shouldScroll: newVal && this.enableScrollOnHover && !this.isHoverFromTable,
      })

      // Only scroll when:
      // 1. Auto-scroll is enabled
      // 2. Hover comes from MAP, not from table itself
      if (newVal && this.enableScrollOnHover && !this.isHoverFromTable) {
        this.$nextTick(() => {
          const row = this.$el.querySelector(`tr[data-request-id="${newVal}"]`)
          if (row) {
            console.log('Scrolling to row:', newVal)
            row.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        })
      }
    },
  },

  computed: {
    tableName(): string {
      // Use table name from config, default to "Items"
      return this.tableConfig?.name || 'Items'
    },

    visibleColumns(): TableColumn[] {
      // Return only visible columns
      return this.allColumns.filter(col => col.visible)
    },

    filteredRequestIds(): Set<string> {
      // Build Set of filtered request IDs for use in template
      return new Set(this.filteredRequests.map((r) => String(r.request_id)))
    },

    sortedRequests(): Request[] {
      // Build Set of filtered request IDs for O(1) lookup
      const filteredIds = new Set(
        this.filteredRequests.map((r) => String(r.request_id))
      )

      // Sort requests within filtered and unfiltered groups separately
      const filtered: Request[] = []
      const unfiltered: Request[] = []

      // Separate filtered and unfiltered using ALL active filters
      for (const request of this.requests) {
        if (filteredIds.has(String(request.request_id))) {
          filtered.push(request)
        } else {
          unfiltered.push(request)
        }
      }

      // Sort each group independently
      const sortFn = (a: Request, b: Request) => {
        const aVal = a[this.sortColumn]
        const bVal = b[this.sortColumn]

        if (aVal === undefined || aVal === null) return 1
        if (bVal === undefined || bVal === null) return -1

        let comparison = 0
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal
        } else {
          comparison = String(aVal).localeCompare(String(bVal))
        }

        return this.sortDirection === 'asc' ? comparison : -comparison
      }

      filtered.sort(sortFn)
      unfiltered.sort(sortFn)

      // Filtered on top, then unfiltered
      return [...filtered, ...unfiltered]
    },
  },

  methods: {
    generateColumns() {
      if (this.requests.length === 0) {
        this.allColumns = []
        return
      }

      const firstRequest = this.requests[0]
      const columns: TableColumn[] = []

      // Get column visibility config from YAML (or use defaults)
      const showColumns = this.tableConfig?.columns?.show || []
      const hideColumns = this.tableConfig?.columns?.hide || []
      const formatConfig = this.tableConfig?.columns?.formats || {}

      // Determine visibility logic:
      // - If show is empty array (or not provided): show ALL columns except those in hide
      // - If show has values: only show those columns, then apply hide filter
      const showAll = showColumns.length === 0

      // Sample size for type inference
      const sampleSize = Math.min(10, this.requests.length)
      const sampleRequests = this.requests.slice(0, sampleSize)

      // Generate columns from all keys in the data
      for (const key of Object.keys(firstRequest)) {
        // Get format config for this column (if exists)
        const format = formatConfig[key]

        // Use explicit type from config, otherwise infer from data
        const type = format?.type || this.inferColumnType(key, sampleRequests)

        // Determine visibility based on config
        let visible = showAll ? true : showColumns.includes(key)

        // Apply hide filter (always takes precedence)
        if (hideColumns.includes(key)) {
          visible = false
        }

        columns.push({
          key,
          label: this.formatColumnLabel(key),
          type,
          visible,
          sortable: true,
          format  // Include format config
        })
      }

      // Sort columns by smart priority (important ones first, then alphabetical)
      this.allColumns = columns

      // Debug logging
      console.log('RequestTable.generateColumns:', {
        totalRequests: this.requests.length,
        sampleSize,
        columnsGenerated: this.allColumns.length,
        visibleColumns: this.allColumns.filter(c => c.visible).length,
        hiddenColumns: this.allColumns.filter(c => !c.visible).map(c => c.key),
        formattedColumns: this.allColumns.filter(c => c.format).map(c => ({ key: c.key, format: c.format })),
        tableConfig: this.tableConfig,
      })
    },

    inferColumnType(key: string, sampleRequests: any[]): 'string' | 'number' | 'decimal' | 'boolean' {
      // Simplified type inference - just detect basic JavaScript types
      // Semantic types (time, duration, distance) should be configured in YAML

      const values = sampleRequests.map(r => r[key]).filter(v => v !== null && v !== undefined)

      if (values.length === 0) return 'string'

      const firstValue = values[0]

      // Boolean detection
      if (typeof firstValue === 'boolean') {
        const allBooleans = values.every(v => typeof v === 'boolean')
        if (allBooleans) return 'boolean'
      }

      // Numeric detection
      if (typeof firstValue === 'number') {
        // Check if ANY value has a fractional part
        const hasDecimal = values.some(v => typeof v === 'number' && v % 1 !== 0)

        return hasDecimal ? 'decimal' : 'number'
      }

      // Default: string
      return 'string'
    },

    formatColumnLabel(key: string): string {
      // Convert snake_case to Title Case
      return key.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    },

 

    sortBy(column: string) {
      if (this.sortColumn === column) {
        // Toggle direction
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortColumn = column
        this.sortDirection = 'asc'
      }
    },

    onRowClick(request: Request) {
      // Clicking on a request toggles its selection (adds/removes from filter)
      this.$emit('request-clicked', String(request.request_id))
    },

    onRowHover(request: Request | null) {
      // Mark that hover originated from table to prevent scroll loop
      this.isHoverFromTable = true
      
      // Emit hover event for map highlighting
      this.$emit('request-hovered', request ? String(request.request_id) : null)
      
      // Reset flag after a short delay
      setTimeout(() => {
        this.isHoverFromTable = false
      }, 100)
    },

    formatValue(value: any, type: string, format?: ColumnFormat): string {
      if (value === undefined || value === null) return '-'

      // If we have format config, use it
      if (format) {
        return this.formatWithConfig(value, format)
      }

      // Default formatting based on type
      switch (type) {
        case 'boolean':
          return value ? 'Yes' : 'No'

        case 'number':
          return typeof value === 'number' ? value.toFixed(0) : String(value)

        case 'decimal':
          return typeof value === 'number' ? value.toFixed(2) : String(value)

        default:
          return String(value)
      }
    },

    formatWithConfig(value: any, format: ColumnFormat): string {
      if (typeof value !== 'number') return String(value)

      let convertedValue = value

      // Handle unit conversion
      if (format.convertFrom && format.unit) {
        convertedValue = this.convertUnits(value, format.convertFrom, format.unit)
      }

      // Handle type-specific formatting
      switch (format.type) {
        case 'time':
          // Time format: HH:MM:SS or HH:MM
          const totalSeconds = format.convertFrom === 'seconds' ? value : convertedValue
          const hours = Math.floor(totalSeconds / 3600)
          const minutes = Math.floor((totalSeconds % 3600) / 60)
          const seconds = Math.floor(totalSeconds % 60)

          if (format.unit === 'h') {
            // Show only hours (decimal)
            const decimals = format.decimals ?? 2
            return `${(totalSeconds / 3600).toFixed(decimals)} h`
          } else if (format.unit === 'min') {
            // Show only minutes (decimal)
            const decimals = format.decimals ?? 0
            return `${(totalSeconds / 60).toFixed(decimals)} min`
          } else {
            // Default: HH:MM:SS format
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          }

        case 'duration':
          // Duration in specified unit
          const unit = format.unit || 'min'
          const decimals = format.decimals ?? 0
          return `${convertedValue.toFixed(decimals)} ${unit}`

        case 'distance':
          // Distance in specified unit
          const distUnit = format.unit || 'm'
          const distDecimals = format.decimals ?? (distUnit === 'km' ? 2 : 0)
          return `${convertedValue.toFixed(distDecimals)} ${distUnit}`

        case 'decimal':
          const decimalPlaces = format.decimals ?? 2
          return convertedValue.toFixed(decimalPlaces)

        case 'number':
          const numDecimals = format.decimals ?? 0
          return convertedValue.toFixed(numDecimals)

        default:
          return String(convertedValue)
      }
    },

    convertUnits(value: number, from: 'seconds' | 'meters', to: string): number {
      if (from === 'seconds') {
        // Time conversions
        switch (to) {
          case 'h': return value / 3600
          case 'min': return value / 60
          case 's': return value
          default: return value
        }
      } else if (from === 'meters') {
        // Distance conversions
        switch (to) {
          case 'km': return value / 1000
          case 'm': return value
          default: return value
        }
      }
      return value
    },

    exportToCSV() {
      // Create CSV content
      const headers = this.visibleColumns.map((c) => c.label).join(',')
      const rows = this.sortedRequests.map((request) =>
        this.visibleColumns.map((col) => {
          const val = this.formatValue(request[col.key], col.type, col.format)
          // Escape commas and quotes
          return `"${String(val).replace(/"/g, '""')}"`
        }).join(',')
      )

      const csv = [headers, ...rows].join('\n')

      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `requests_filtered_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    },
  },
})
</script>

<style scoped lang="scss">
.request-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bgPanel);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 2px solid var(--borderDim);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text);
  }

  .table-info {
    display: flex;
    align-items: center;
    gap: 1rem;

    span {
      font-size: 0.875rem;
      color: var(--textFaded);
    }

    .export-btn {
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--borderDim);
      border-radius: 0.375rem;
      background-color: var(--bgPanel);
      color: var(--text);
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background-color: var(--bgHover);
        border-color: var(--link);
      }
    }
  }
}

.table-container {
  flex: 1;
  overflow: auto;
  position: relative;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: var(--bgCream);

    tr {
      border-bottom: 2px solid var(--borderDim);
    }

    th {
      padding: 0.75rem 1rem;
      text-align: left;
      font-weight: 600;
      color: var(--text);
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      background-color: var(--bgCream);

      &.sortable:hover {
        background-color: var(--bgHover);
      }

      &.sorted {
        background-color: var(--bgCream2);
      }

      .header-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;

        .sort-icon {
          font-size: 0.75rem;
          color: var(--link);
        }
      }
    }
  }

  tbody {
    tr {
      border-bottom: 1px solid var(--borderDim);
      cursor: pointer;
      transition: all 0.15s;

      // Default state
      background-color: var(--bgPanel);

      // Selected (filtered) requests - highlighted with blue tint
      &.is-selected {
        background-color: rgba(59, 130, 246, 0.1);
        border-left: 3px solid #3b82f6;
        font-weight: 500;
        
        td {
          color: var(--text);
        }
      }

      // Hovered request - stronger highlight
      &.is-hovered {
        background-color: rgba(59, 130, 246, 0.2);
        transform: scale(1.001);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 1;
      }

      // Combined: selected and hovered
      &.is-selected.is-hovered {
        background-color: rgba(59, 130, 246, 0.25);
        border-left: 3px solid #2563eb;
      }

      // Hover effect for non-selected
      &:not(.is-hovered):hover {
        background-color: var(--bgHover);
      }

      td {
        padding: 0.75rem 1rem;
        color: var(--text);
        white-space: nowrap;
        transition: color 0.15s;
      }
    }
  }
}
</style>
