<template>
  <div class="color-legend" :class="{ dark: isDarkMode }">
    <div class="legend-title">{{ title }}</div>

    <!-- Categorical legend -->
    <div v-if="!isNumeric" class="legend-items">
      <div
        v-for="item in legendItems"
        :key="item.label"
        class="legend-item"
        :class="{ clickable: clickable }"
        @click="handleItemClick(item)"
      >
        <div class="legend-swatch" :style="{ backgroundColor: item.color }"></div>
        <div class="legend-label">{{ item.label }}</div>
      </div>
    </div>

    <!-- Numeric legend (gradient) -->
    <div v-else class="legend-numeric">
      <div class="legend-gradient" :style="{ background: gradientStyle }"></div>
      <div class="legend-scale">
        <span>{{ formatNumber(minValue) }}</span>
        <span>{{ formatNumber(maxValue) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface LegendItem {
  label: string
  color: string
}

interface Props {
  title: string
  legendItems?: LegendItem[]
  isNumeric?: boolean
  minValue?: number
  maxValue?: number
  clickable?: boolean
  isDarkMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  legendItems: () => [],
  isNumeric: false,
  minValue: 0,
  maxValue: 100,
  clickable: true,
  isDarkMode: false,
})

const emit = defineEmits<{
  itemClicked: [label: string]
}>()

// Compute gradient style for numeric legend
const gradientStyle = computed(() => {
  // Viridis gradient approximation
  return 'linear-gradient(to right, #440154, #31688e, #35b779, #fde724)'
})

function handleItemClick(item: LegendItem) {
  if (props.clickable) {
    emit('itemClicked', item.label)
  }
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) return '0'
  if (Math.abs(value) > 1000) return value.toFixed(0)
  if (Math.abs(value) > 10) return value.toFixed(1)
  return value.toFixed(2)
}
</script>

<style scoped>
.color-legend {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  background: white;
  padding: 12px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  min-width: 150px;
  pointer-events: auto;
}

.color-legend.dark {
  background: #1f2937;
  color: #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.legend-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px;
  border-radius: 2px;
}

.legend-item.clickable {
  cursor: pointer;
  transition: background-color 0.15s;
}

.legend-item.clickable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.color-legend.dark .legend-item.clickable:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.legend-swatch {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.color-legend.dark .legend-swatch {
  border-color: rgba(255, 255, 255, 0.2);
}

.legend-label {
  flex: 1;
  line-height: 1.2;
}

/* Numeric legend */
.legend-numeric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-gradient {
  width: 100%;
  height: 20px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.color-legend.dark .legend-gradient {
  border-color: rgba(255, 255, 255, 0.2);
}

.legend-scale {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b7280;
}

.color-legend.dark .legend-scale {
  color: #9ca3af;
}
</style>
