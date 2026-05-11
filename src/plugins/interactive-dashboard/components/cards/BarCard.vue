<template>
  <div class="bar-card">
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Plotly from 'plotly.js/dist/plotly'
import { StyleManager } from '../../managers/StyleManager'
import { buildBarFigure } from '@/export/trace-builders/bar'
import type { BarInput, ChartStyle, ReferenceLine } from '@/export/types'

interface Props {
  title?: string
  xColumn: string
  yColumns: string[]
  colorByColumn?: string
  barmode?: 'group' | 'stack' | 'relative'
  yAxisTitle?: string
  xAxisTitle?: string
  annotations?: any[] // TODO: use PlotlyAnnotation type when available in types.ts
  referenceLines?: ReferenceLine[]
  filteredData?: any[]
  baselineData?: any[]
  showComparison?: boolean
  linkage?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  barmode: 'group',
  filteredData: () => [],
  baselineData: () => [],
  showComparison: false,
})

const plotContainer = ref<HTMLElement>()
let chartInitialized = false

// Debounce timer — collapses N prop changes in one tick into one Plotly.react call
// Mirrors HistogramCard's debouncedRenderChart pattern
let renderTimeout: ReturnType<typeof setTimeout> | null = null

const scheduleUpdate = () => {
  if (renderTimeout) clearTimeout(renderTimeout)
  renderTimeout = setTimeout(() => {
    updateChart()
    renderTimeout = null
  }, 50)
}

// Resolve interactive ChartStyle from StyleManager
// Verbatim copy of HistogramCard lines 163-185
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
    margin: { l: 60, r: 15, t: 10, b: 50 },
  }
}

const buildInput = (): BarInput => ({
  type: 'bar',
  title: props.title,
  xColumn: props.xColumn,
  yColumns: props.yColumns,
  colorByColumn: props.colorByColumn,
  barmode: props.barmode,
  yAxisTitle: props.yAxisTitle,
  xAxisTitle: props.xAxisTitle,
  annotations: props.annotations,
  referenceLines: props.referenceLines,
  filteredData: props.filteredData ?? [],
  baselineData: props.baselineData,
  showComparison: props.showComparison,
})

const initializeChart = () => {
  if (!plotContainer.value || (props.filteredData ?? []).length === 0) return

  const figure = buildBarFigure(buildInput(), resolveInteractiveStyle())
  const config = figure.config ?? { displayModeBar: false, responsive: true }

  Plotly.newPlot(plotContainer.value, figure.traces as any[], figure.layout, config)
  chartInitialized = true
}

const updateChart = () => {
  if (!plotContainer.value) return
  if ((props.filteredData ?? []).length === 0) return

  const figure = buildBarFigure(buildInput(), resolveInteractiveStyle())
  const config = figure.config ?? { displayModeBar: false, responsive: true }

  if (chartInitialized) {
    Plotly.react(plotContainer.value, figure.traces as any[], figure.layout, config)
  } else {
    initializeChart()
  }
}

watch(() => props.filteredData, () => { scheduleUpdate() })
watch(() => props.yColumns, () => { scheduleUpdate() }, { deep: true })
watch(() => props.barmode, () => { scheduleUpdate() })
watch(() => props.colorByColumn, () => { scheduleUpdate() })
watch(() => props.xColumn, () => { scheduleUpdate() })
watch(() => props.annotations, () => { scheduleUpdate() }, { deep: true })
watch(() => props.referenceLines, () => { scheduleUpdate() }, { deep: true })
watch(() => props.yAxisTitle, () => { scheduleUpdate() })
watch(() => props.xAxisTitle, () => { scheduleUpdate() })
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
.bar-card {
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
