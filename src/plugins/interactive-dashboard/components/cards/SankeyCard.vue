<template>
  <div class="sankey-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import { buildSankeyFigure } from '@/export/trace-builders/sankey'
import type { SankeyInput, ChartStyle } from '@/export/types'

interface Props {
  title?: string
  sourceColumn: string
  targetColumn: string
  valueColumn: string
  nodeColorMap?: Record<string, string>
  filteredData?: any[]
  baselineData?: any[]
  showComparison?: boolean
  linkage?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => [],
  baselineData: () => [],
  showComparison: false,
})

const plotContainer = ref<HTMLElement>()
let chartInitialized = false

// Debounce timer — collapses N prop changes in one tick into one Plotly.react call
// Mirrors BarCard's scheduleUpdate pattern
let renderTimeout: ReturnType<typeof setTimeout> | null = null

const scheduleUpdate = () => {
  if (renderTimeout) clearTimeout(renderTimeout)
  renderTimeout = setTimeout(() => {
    updateChart()
    renderTimeout = null
  }, 50)
}

// Resolve interactive ChartStyle from StyleManager
// Verbatim copy of BarCard.vue's version (which is in turn a copy of HistogramCard's)
const resolveInteractiveStyle = (): ChartStyle => {
  const styleManager = StyleManager.getInstance()
  const isScientific = styleManager.isScientificMode()

  return {
    axisTitleFontSize: 11,
    axisTickFontSize: 10,
    legendTitleFontSize: 11,
    legendFontSize: 10,
    lineWidth: 1.5,
    markerSizeMultiplier: 1.0,
    fontFamily: isScientific
      ? styleManager.getScientificConfig().fontFamily
      : 'Arial, Helvetica, sans-serif',
    backgroundColor: styleManager.getColor('theme.background.primary'),
    textColor: styleManager.getColor('theme.text.primary'),
    gridColor: styleManager.getColor('theme.border.default'),
    barColor: styleManager.getColor('chart.bar.default'),
    selectedColor: styleManager.getColor('chart.bar.selected'),
    isScientific,
    margin: { l: 30, r: 30, t: 20, b: 20 },
  }
}

const buildInput = (): SankeyInput => ({
  type: 'sankey',
  title: props.title,
  sourceColumn: props.sourceColumn,
  targetColumn: props.targetColumn,
  valueColumn: props.valueColumn,
  nodeColorMap: props.nodeColorMap,
  filteredData: props.filteredData ?? [],
})

const initializeChart = () => {
  if (!plotContainer.value || (props.filteredData ?? []).length === 0) return

  const figure = buildSankeyFigure(buildInput(), resolveInteractiveStyle())
  const config = figure.config ?? { displayModeBar: false, responsive: true }

  Plotly.newPlot(plotContainer.value, figure.traces as any[], figure.layout, config)
  chartInitialized = true
}

const updateChart = () => {
  if (!plotContainer.value) return
  if ((props.filteredData ?? []).length === 0) return

  const figure = buildSankeyFigure(buildInput(), resolveInteractiveStyle())
  const config = figure.config ?? { displayModeBar: false, responsive: true }

  if (chartInitialized) {
    Plotly.react(plotContainer.value, figure.traces as any[], figure.layout, config)
  } else {
    initializeChart()
  }
}

watch(() => props.filteredData, () => { scheduleUpdate() })
watch(() => props.sourceColumn, () => { scheduleUpdate() })
watch(() => props.targetColumn, () => { scheduleUpdate() })
watch(() => props.valueColumn, () => { scheduleUpdate() })
watch(() => props.nodeColorMap, () => { scheduleUpdate() }, { deep: true })
watch(() => props.title, () => { scheduleUpdate() })

onMounted(() => {
  initializeChart()
})

onUnmounted(() => {
  if (renderTimeout) {
    clearTimeout(renderTimeout)
    renderTimeout = null
  }
  chartInitialized = false
  if (plotContainer.value) {
    Plotly.purge(plotContainer.value)
  }
})
</script>

<style scoped>
.sankey-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
