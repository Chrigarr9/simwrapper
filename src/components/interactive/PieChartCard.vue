<template>
  <div class="pie-chart-card">
    <h3 v-if="title">{{ title }}</h3>
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import Plotly from 'plotly.js/dist/plotly'

interface Props {
  title?: string
  column: string
  filteredData: any[]
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
}>()

const plotContainer = ref<HTMLElement>()
const selectedCategories = ref<Set<string>>(new Set())

const pieData = computed(() => {
  const counts = new Map<string, number>()
  props.filteredData.forEach(row => {
    const val = row[props.column]
    if (val !== null && val !== undefined) {
      counts.set(String(val), (counts.get(String(val)) || 0) + 1)
    }
  })

  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }))
})

const renderChart = () => {
  if (!plotContainer.value || pieData.value.length === 0) return

  const trace = {
    labels: pieData.value.map(d => d.label),
    values: pieData.value.map(d => d.value),
    type: 'pie',
    marker: {
      colors: pieData.value.map(d =>
        selectedCategories.value.has(d.label) ? '#ff6b6b' : '#4dabf7'
      ),
    },
  }

  Plotly.newPlot(
    plotContainer.value,
    [trace],
    {
      title: props.title,
      margin: { t: 40, b: 20, l: 20, r: 20 },
      autosize: true,
    },
    {
      displayModeBar: false,
      responsive: true,
    }
  )

  // Click handler
  plotContainer.value.on('plotly_click', (data: any) => {
    const category = data.points[0].label

    // Toggle category
    if (selectedCategories.value.has(category)) {
      selectedCategories.value.delete(category)
    } else {
      selectedCategories.value.add(category)
    }

    // Emit filter
    if (props.linkage?.type === 'filter') {
      const filterId = `pie-${props.column}`
      emit('filter', filterId, props.column, new Set(selectedCategories.value))
    }

    renderChart()
  })
}

watch(() => props.filteredData, renderChart, { deep: true })
onMounted(renderChart)
</script>

<style scoped>
.pie-chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plot-container {
  flex: 1;
}
</style>
