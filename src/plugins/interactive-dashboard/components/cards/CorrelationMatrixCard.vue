<template lang="pug">
.correlation-matrix-card
  .header-info(v-if="sampleSize > 0")
    span.sample-size n = {{ sampleSize }}
  .loading-overlay(v-if="isCalculating")
    span Calculating...
  .plot-container(ref="plotContainer")
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import globalStore from '@/store'
import { computeCorrelationMatrix, CorrelationMatrixResult } from '../../utils/statistics'

interface Props {
  title?: string
  attributes: string[]       // Columns to include in matrix (from YAML)
  filteredData?: any[]       // From LinkableCardWrapper
  showValues?: 'always' | 'never' | 'auto'  // Cell value display mode (default: 'auto')
  pValueThreshold?: number   // Significance threshold (default: 0.05)
  linkage?: {
    type: 'attributePair'
    targetCard?: string      // ID of ScatterCard to update (optional)
  }
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  showValues: 'auto',
  pValueThreshold: 0.05
})

const emit = defineEmits<{
  attributePairSelected: [attrX: string, attrY: string]
  isLoaded: []
}>()

// Dark mode access from global store
const isDarkMode = computed(() => globalStore.state.isDarkMode)

// Reactive state
const plotContainer = ref<HTMLElement>()
const isCalculating = ref<boolean>(false)
const correlationData = ref<CorrelationMatrixResult | null>(null)
const hoveredCell = ref<{ row: number; col: number } | null>(null)

// Computed properties
const sampleSize = computed(() => {
  if (!correlationData.value) return 0
  // Find minimum sample size from matrix (excludes diagonal)
  let minN = Infinity
  const n = correlationData.value.sampleSizes.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        minN = Math.min(minN, correlationData.value.sampleSizes[i][j])
      }
    }
  }
  return minN === Infinity ? 0 : minN
})

const shouldShowValues = computed(() => {
  if (props.showValues === 'always') return true
  if (props.showValues === 'never') return false
  // Auto mode: hide if more than 20 attributes
  return props.attributes.length <= 20
})

// Placeholder functions (implemented in next task)
function calculateCorrelations() {
  // To be implemented in Task 2
  console.log('[CorrelationMatrixCard] calculateCorrelations placeholder')
}

function renderChart() {
  // To be implemented in Task 2
  console.log('[CorrelationMatrixCard] renderChart placeholder')
}

// Lifecycle hooks (basic setup)
onMounted(() => {
  console.log('[CorrelationMatrixCard] Mounted with', props.attributes.length, 'attributes')
  emit('isLoaded')
})

onUnmounted(() => {
  console.log('[CorrelationMatrixCard] Unmounted')
})
</script>

<style scoped>
.correlation-matrix-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
  position: relative;
}

.header-info {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--dashboard-text-secondary, var(--text));
  text-align: right;
}

.sample-size {
  font-family: monospace;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--dashboard-bg-primary, var(--bgPanel));
  padding: 8px 16px;
  border-radius: 4px;
  z-index: 10;
  font-size: 12px;
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
