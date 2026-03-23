<template lang="pug">
//- StatCard - displays constant/summary key-value pairs in a compact grid
.stat-card(v-if="items.length")
  .stat-grid
    .stat-item(v-for="item in items" :key="item.column")
      .stat-label {{ item.label }}
      .stat-value
        span.value {{ item.formattedValue }}
        span.unit(v-if="item.unit && item.unit !== '-'") &nbsp;{{ item.unit }}
</template>

<script setup lang="ts">
/**
 * StatCard - Compact key-value display for constant scenario parameters.
 *
 * Shows column values from the first row of the central data table
 * in a responsive grid layout. Designed for parameters that are
 * constant across all rows (e.g., pricing_mode, cost_per_km).
 *
 * YAML usage:
 * ```yaml
 * - type: stat-card
 *   title: "Scenario Parameters"
 *   columns:
 *     - cost_per_km
 *     - vehicle_cost
 *     - pricing_mode
 *   width: 1
 *   height: 3
 * ```
 */
import { computed, onMounted } from 'vue'
import { toTitleCase } from '../../utils/labelFormatter'

const props = defineProps({
  config: { type: Object, default: () => ({}) },
  filteredData: { type: Array, default: () => [] },
  baselineData: { type: Array, default: () => [] },
  tableConfig: { type: Object, default: null },
  // Standard card props (ignored but accepted to avoid warnings)
  hoveredIds: { default: null },
  selectedIds: { default: null },
  showComparison: { type: Boolean, default: false },
  linkage: { type: Object, default: null },
  cardId: { type: String, default: '' },
  cardTitle: { type: String, default: '' },
})

const emit = defineEmits(['isLoaded'])

/**
 * Get the first row of data (baseline preferred, filtered as fallback).
 * For constant columns, any row will have the same value.
 */
const firstRow = computed(() => {
  if (props.baselineData && props.baselineData.length > 0) return props.baselineData[0]
  if (props.filteredData && props.filteredData.length > 0) return props.filteredData[0]
  return null
})

/**
 * Column format definitions from table config.
 */
const formats = computed(() => {
  return props.tableConfig?.columns?.formats || {}
})

/**
 * Format a value according to its column format definition.
 */
function formatValue(value: any, column: string): string {
  if (value === null || value === undefined || value === '') return '-'

  const fmt = formats.value[column]
  if (!fmt) return String(value)

  if (fmt.type === 'integer') {
    return Math.round(Number(value)).toLocaleString()
  }
  if (fmt.type === 'decimal') {
    return Number(value).toFixed(fmt.decimals ?? 2)
  }
  if (fmt.type === 'percent') {
    return (Number(value) * 100).toFixed(fmt.decimals ?? 1) + '%'
  }
  if (fmt.type === 'duration') {
    const valueInUnit = fmt.convertFrom === 'seconds' ? value / 60 : value
    return Number(valueInUnit).toFixed(fmt.decimals ?? 1)
  }
  if (fmt.type === 'distance') {
    const valueInUnit = fmt.convertFrom === 'meters' ? value / 1000 : value
    return Number(valueInUnit).toFixed(fmt.decimals ?? 2)
  }
  if (fmt.type === 'text' || fmt.type === 'string') {
    return String(value)
  }

  return String(value)
}

/**
 * Get display unit for a column.
 */
function getUnit(column: string): string {
  const fmt = formats.value[column]
  if (!fmt || !fmt.unit) return ''
  if (fmt.unit === '-') return ''
  return fmt.unit
}

/**
 * Build display items from config columns + data.
 */
const items = computed(() => {
  const columns: string[] = props.config?.columns || []
  const row = firstRow.value
  if (!row || columns.length === 0) return []

  return columns.map(col => ({
    column: col,
    label: toTitleCase(col),
    formattedValue: formatValue(row[col], col),
    unit: getUnit(col),
  }))
})

onMounted(() => {
  // Signal loaded immediately - stat card has no async data loading
  emit('isLoaded')
})
</script>

<style scoped lang="scss">
.stat-card {
  width: 100%;
  height: 100%;
  padding: 0.5rem 0.75rem;
  overflow-y: auto;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem 1rem;
}

.stat-item {
  padding: 0.4rem 0.5rem;
  background: var(--dashboard-bg-tertiary, var(--bgPanel2));
  border-radius: 4px;
  border-left: 3px solid var(--dashboard-interaction-selected, #3b82f6);
}

.stat-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--dashboard-text-secondary, var(--textFaint));
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--dashboard-text-primary, var(--text));
  line-height: 1.3;

  .unit {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--dashboard-text-secondary, var(--textFaint));
  }
}
</style>
