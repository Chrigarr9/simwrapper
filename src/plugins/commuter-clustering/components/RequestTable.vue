<template lang="pug">
.request-table

  //- Table controls
  .table-controls
    .control-left
      span {{ requests.length }} requests
    .control-right
      input.search-input(
        type="text"
        v-model="searchText"
        placeholder="Search..."
      )

  //- Table container
  .table-container
    table
      thead
        tr
          th(
            v-for="col in visibleColumns"
            :key="col.key"
            @click="handleSort(col.key)"
            :class="{ sortable: col.sortable }"
          )
            span {{ col.label }}
            span.sort-indicator(v-if="sortColumn === col.key") {{ sortDirection === 'asc' ? '▲' : '▼' }}
      tbody
        tr(
          v-for="request in paginatedRequests"
          :key="request.request_id || request.pax_id"
          :class="{ selected: String(selectedId) === String(request.request_id || request.pax_id) }"
          @click="handleRowClick(request.request_id || request.pax_id)"
        )
          td(v-for="col in visibleColumns" :key="`${request.request_id || request.pax_id}-${col.key}`") {{ formatValue(request[col.key]) }}

  //- Pagination
  .pagination(v-if="totalPages > 1")
    button(@click="prevPage" :disabled="currentPage === 1") Prev
    span Page {{ currentPage }} / {{ totalPages }}
    button(@click="nextPage" :disabled="currentPage === totalPages") Next

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import type { Request } from '../CommuterClusteringConfig'

interface TableColumn {
  key: string
  label: string
  sortable: boolean
}

export default defineComponent({
  name: 'RequestTable',
  props: {
    requests: { type: Array as PropType<Request[]>, required: true },
    selectedId: { type: [String, Number] as PropType<string | number | null>, default: null },
  },
  emits: ['row-selected'],
  data() {
    return {
      searchText: '',
      sortColumn: 'request_id' as string,
      sortDirection: 'asc' as 'asc' | 'desc',
      currentPage: 1,
      pageSize: 100,
    }
  },
  computed: {
    // Dynamically build columns from actual data
    visibleColumns(): TableColumn[] {
      if (this.requests.length === 0) return []

      const firstRequest = this.requests[0]
      const allKeys = Object.keys(firstRequest)

      // Define priority columns (show first)
      const priorityKeys = [
        'request_id', 'pax_id', 'origin', 'destination',
        'treq_time', 'mode', 'main_mode',
        'travel_time', 'distance',
        'origin_cluster', 'destination_cluster', 'spatial_cluster',
        'max_detour', 'max_cost', 'max_walking_distance',
        'start_activity_type', 'end_activity_type',
      ]

      // Columns to exclude from display (internal/redundant)
      const excludeKeys = [
        'origin_lon', 'origin_lat', 'dest_lon', 'dest_lat',
        'start_x', 'start_y', 'end_x', 'end_y',
        'geometry', 'treq', // Show treq_time instead
      ]

      // Build priority columns
      const priorityCols: TableColumn[] = priorityKeys
        .filter(key => key in firstRequest && !excludeKeys.includes(key))
        .map(key => ({
          key,
          label: this.formatColumnLabel(key),
          sortable: true,
        }))

      // Build remaining columns
      const remainingCols: TableColumn[] = allKeys
        .filter(key => !priorityKeys.includes(key) && !excludeKeys.includes(key))
        .map(key => ({
          key,
          label: this.formatColumnLabel(key),
          sortable: true,
        }))

      return [...priorityCols, ...remainingCols]
    },

    filteredRequests(): Request[] {
      if (!this.searchText) {
        return this.requests
      }

      const search = this.searchText.toLowerCase()
      return this.requests.filter(r => {
        return (
          r.pax_id?.toLowerCase().includes(search) ||
          r.origin?.toLowerCase().includes(search) ||
          r.destination?.toLowerCase().includes(search) ||
          r.mode?.toLowerCase().includes(search)
        )
      })
    },
    sortedRequests(): Request[] {
      const sorted = [...this.filteredRequests]
      sorted.sort((a, b) => {
        const aVal = a[this.sortColumn as keyof Request]
        const bVal = b[this.sortColumn as keyof Request]

        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1

        const compare = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return this.sortDirection === 'asc' ? compare : -compare
      })
      return sorted
    },
    paginatedRequests(): Request[] {
      const start = (this.currentPage - 1) * this.pageSize
      const end = start + this.pageSize
      return this.sortedRequests.slice(start, end)
    },
    totalPages(): number {
      return Math.ceil(this.sortedRequests.length / this.pageSize)
    },
  },
  methods: {
    formatColumnLabel(key: string): string {
      // Convert snake_case to Title Case
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    },

    handleSort(column: string) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortColumn = column
        this.sortDirection = 'asc'
      }
    },

    handleRowClick(requestId: string) {
      this.$emit('row-selected', requestId)
    },

    formatValue(value: any): string {
      if (value == null || value === '') return '-'
      if (typeof value === 'boolean') return value ? 'Yes' : 'No'
      if (typeof value === 'number') {
        // Format with appropriate precision
        if (Number.isInteger(value)) return value.toString()
        return value.toFixed(2)
      }
      return String(value)
    },

    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++
      }
    },

    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--
      }
    },
  },
})
</script>

<style scoped lang="scss">
.request-table {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bgCream);
  min-height: 0; // Important for flex containers
}

.table-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--borderColor);
  background-color: var(--bgCream);
  flex-shrink: 0; // Don't shrink controls

  .control-left {
    font-size: 0.9rem;
    color: var(--textFaded);
    font-weight: 600;
  }

  .search-input {
    padding: 0.5rem;
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    font-size: 0.9rem;
    width: 250px;
    background-color: var(--bgPanel);
    color: var(--text);

    &:focus {
      outline: none;
      border-color: var(--link);
    }
  }
}

.table-container {
  flex: 1;
  overflow: auto; // Both horizontal and vertical scrolling
  min-height: 0; // Important for flex children
  position: relative;

  table {
    width: max-content; // Allow table to expand beyond container for horizontal scroll
    min-width: 100%; // But at least fill container width
    border-collapse: collapse;
    font-size: 0.85rem;

    thead {
      position: sticky;
      top: 0;
      background-color: var(--bgPanel);
      z-index: 10;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

      th {
        padding: 0.75rem;
        text-align: left;
        font-weight: 600;
        border-bottom: 2px solid var(--borderColor);
        white-space: nowrap;
        background-color: var(--bgPanel);
        min-width: 100px; // Minimum column width

        &.sortable {
          cursor: pointer;
          user-select: none;

          &:hover {
            background-color: var(--bgHover);
          }
        }

        .sort-indicator {
          margin-left: 0.25rem;
          font-size: 0.7rem;
          color: var(--link);
        }
      }
    }

    tbody {
      tr {
        cursor: pointer;
        transition: background-color 0.1s;

        &:hover {
          background-color: var(--bgHover);
        }

        &.selected {
          background-color: var(--linkHover);
          color: white;

          td {
            color: white;
          }
        }

        td {
          padding: 0.75rem;
          border-bottom: 1px solid var(--borderColor);
          white-space: nowrap;
          max-width: 300px; // Max width to prevent very wide cells
          overflow: hidden;
          text-overflow: ellipsis;

          &:hover {
            overflow: visible;
            white-space: normal;
            word-break: break-word;
          }
        }
      }
    }
  }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border-top: 1px solid var(--borderColor);
  background-color: var(--bgCream);
  flex-shrink: 0; // Don't shrink pagination

  button {
    padding: 0.5rem 1rem;
    background-color: var(--bgPanel);
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text);
    transition: all 0.15s;

    &:hover:not(:disabled) {
      background-color: var(--bgHover);
      border-color: var(--link);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  span {
    font-size: 0.9rem;
    color: var(--text);
    font-weight: 600;
  }
}
</style>
