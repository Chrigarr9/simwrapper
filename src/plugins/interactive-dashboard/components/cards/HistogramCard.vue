<template>
  <div class="histogram-card">
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
  binSize?: number
  filteredData: any[]        // From LinkableCardWrapper
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
const selectedBins = ref<Set<number>>(new Set())

const histogramData = computed(() => {
  const values = props.filteredData.map(row => row[props.column])
  const binSize = props.binSize || 1

  // Create bins
  const bins = new Map<number, number>()
  values.forEach(val => {
    if (val !== null && val !== undefined) {
      const bin = Math.floor(val / binSize) * binSize
      bins.set(bin, (bins.get(bin) || 0) + 1)
    }
  })

  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({ bin, count }))
})

const renderChart = () => {
  if (!plotContainer.value || histogramData.value.length === 0) return

  const trace = {
    x: histogramData.value.map(d => d.bin),
    y: histogramData.value.map(d => d.count),
    type: 'bar',
    marker: {
      color: histogramData.value.map(d =>
        selectedBins.value.has(d.bin) ? '#ff6b6b' : '#4dabf7'
      ),
    },
  }

  const layout = {
    title: props.title,
    xaxis: { title: props.column },
    yaxis: { title: 'Count' },
    margin: { l: 40, r: 20, t: 40, b: 40 },
    autosize: true,
  }

  Plotly.newPlot(plotContainer.value, [trace], layout, {
    displayModeBar: false,
    responsive: true,
  })

  // Click handler
  plotContainer.value.on('plotly_click', (data: any) => {
    const bin = data.points[0].x

    // Toggle bin in selection
    if (selectedBins.value.has(bin)) {
      selectedBins.value.delete(bin)
    } else {
      selectedBins.value.add(bin)
    }

    // Emit filter with all selected bins
    if (props.linkage?.type === 'filter') {
      const filterId = `histogram-${props.column}`
      emit('filter', filterId, props.column, new Set(selectedBins.value))
    }

    renderChart()
  })
}

watch(() => props.filteredData, renderChart, { deep: true })
onMounted(renderChart)
</script>

<style scoped>
.histogram-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
