<template lang="pug">
.request-table
  .table-header
    h3 Requests Table
    .table-info
      span Showing {{ requests.length }} requests
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
          @click="onRowClick(request)"
          :class="{ selected: selectedRequestId === request.request_id }"
        )
          td(v-for="column in visibleColumns" :key="column.key")
            | {{ formatValue(request[column.key], column.type) }}

</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import type { Request } from '../CommuterRequestsConfig'

interface TableColumn {
  key: string
  label: string
  type: 'string' | 'number' | 'time' | 'duration'
}

export default defineComponent({
  name: 'RequestTable',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
  },

  data() {
    return {
      sortColumn: 'request_id' as string,
      sortDirection: 'asc' as 'asc' | 'desc',
      selectedRequestId: null as string | null,

      // Define visible columns (subset of all 84 attributes)
      visibleColumns: [
        { key: 'request_id', label: 'Request ID', type: 'string' },
        { key: 'pax_id', label: 'Passenger ID', type: 'string' },
        { key: 'origin', label: 'Origin', type: 'string' },
        { key: 'destination', label: 'Destination', type: 'string' },
        { key: 'treq', label: 'Request Time', type: 'time' },
        { key: 'travel_time', label: 'Travel Time', type: 'duration' },
        { key: 'mode', label: 'Mode', type: 'string' },
        { key: 'main_mode', label: 'Main Mode', type: 'string' },
        { key: 'origin_cluster', label: 'Origin Cluster', type: 'number' },
        { key: 'destination_cluster', label: 'Dest Cluster', type: 'number' },
        { key: 'spatial_cluster', label: 'Spatial Cluster', type: 'number' },
      ] as TableColumn[],
    }
  },

  computed: {
    sortedRequests(): Request[] {
      const sorted = [...this.requests].sort((a, b) => {
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
      })

      return sorted
    },
  },

  methods: {
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
      this.selectedRequestId = request.request_id
      this.$emit('request-selected', request.request_id)
    },

    formatValue(value: any, type: string): string {
      if (value === undefined || value === null) return '-'

      switch (type) {
        case 'time':
          // Convert seconds to HH:MM:SS
          const hours = Math.floor(value / 3600)
          const minutes = Math.floor((value % 3600) / 60)
          const seconds = Math.floor(value % 60)
          return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

        case 'duration':
          // Convert seconds to minutes
          const mins = Math.floor(value / 60)
          return `${mins} min`

        case 'number':
          return typeof value === 'number' ? value.toFixed(0) : String(value)

        default:
          return String(value)
      }
    },

    exportToCSV() {
      // Create CSV content
      const headers = this.visibleColumns.map((c) => c.label).join(',')
      const rows = this.sortedRequests.map((request) =>
        this.visibleColumns.map((col) => {
          const val = this.formatValue(request[col.key], col.type)
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
      transition: background-color 0.1s;

      &:hover {
        background-color: var(--bgHover);
      }

      &.selected {
        background-color: var(--bgCream2);
      }

      td {
        padding: 0.75rem 1rem;
        color: var(--text);
        white-space: nowrap;
      }
    }
  }
}
</style>
