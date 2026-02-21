<template lang="pug">
.export-view
  .export-header
    h2 {{ progress.status === 'complete' ? 'Export Complete' : 'Exporting Dashboard' }}

  //- Render container: card renders here at export dimensions
  .render-container(
    v-if="progress.status === 'rendering' || progress.status === 'capturing'"
    :style="renderContainerStyle"
  )
    .render-label Rendering: {{ progress.currentPlot }}
    .render-target(ref="renderTarget")
      component(
        v-if="currentCardComponent && currentCardProps"
        :is="currentCardComponent"
        v-bind="currentCardProps"
        @isLoaded="handleCardLoaded"
      )

  //- Progress panel
  .progress-panel
    .progress-state(v-if="progress.currentState")
      span.state-label State: {{ progress.currentState }}

    .progress-items
      .progress-item(
        v-for="item in progress.completedItems"
        :key="item.filename"
        :class="{ success: item.success, failed: !item.success }"
      )
        i.fa(:class="item.success ? 'fa-check' : 'fa-times'")
        span {{ item.filename }}
        span.error-msg(v-if="item.error") {{ item.error }}

      .progress-item.current(v-if="progress.status === 'capturing'")
        i.fa.fa-spinner.fa-spin
        span {{ progress.currentPlot }} (rendering...)

    .progress-bar-container(v-if="progress.totalCount > 0")
      .progress-text Progress: {{ progress.completedCount }} / {{ progress.totalCount }}
      .progress-bar
        .progress-fill(:style="{ width: progressPercent + '%' }")

  //- Actions
  .export-actions
    button.btn-cancel(
      v-if="progress.status !== 'complete' && progress.status !== 'error'"
      @click="handleCancel"
    ) Cancel

    template(v-if="progress.status === 'complete'")
      button.btn-download(@click="downloadResults") Download ZIP
      button.btn-close(@click="handleClose") Close

    .error-message(v-if="progress.status === 'error'")
      p Error: {{ progress.error }}
      button.btn-close(@click="handleClose") Close
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, nextTick, markRaw } from 'vue'

import { ExportEngine } from './ExportEngine'
import type { ExportProgress, ExportStatus } from './ExportEngine'
import type { ResolvedPlotExport } from '../types/exportConfig'
import type { ExportResult } from '../types/export'
import { exportPlotlyChart, exportAllChartsAsZip } from '../utils/exportUtils'
import { panelLookup } from '@/dash-panels/_allPanels'

// Card type to panelLookup key mapping
const CARD_TYPE_MAP: Record<string, string> = {
  histogram: 'histogram',
  'pie-chart': 'pie-chart',
  'scatter-plot': 'scatter-plot',
  map: 'map',
  'correlation-matrix': 'correlation-matrix',
  timeline: 'timeline',
}

export default defineComponent({
  name: 'ExportView',

  props: {
    exportYaml: { type: String, required: true },
    fileLoader: { type: Function, required: true },
    subfolder: { type: String, default: '' },
  },

  emits: ['complete', 'close'],

  setup(props, { emit }) {
    const renderTarget = ref<HTMLElement>()
    const currentCardComponent = ref<any>(null)
    const currentCardProps = ref<Record<string, any> | null>(null)
    const exportResults = ref<ExportResult[]>([])
    const cardLoadedResolve = ref<(() => void) | null>(null)

    const progress = ref<ExportProgress>({
      status: 'idle',
      currentState: '',
      currentPlot: '',
      completedCount: 0,
      totalCount: 0,
      completedItems: [],
    })

    const engine = new ExportEngine()
    engine.onProgress(p => {
      progress.value = p
    })

    const progressPercent = computed(() => {
      if (progress.value.totalCount === 0) return 0
      return Math.round((progress.value.completedCount / progress.value.totalCount) * 100)
    })

    const renderContainerStyle = computed(() => ({
      width: currentCardProps.value?.width ? `${currentCardProps.value.width}px` : '1200px',
      height: currentCardProps.value?.height ? `${currentCardProps.value.height}px` : '800px',
    }))

    function handleCardLoaded() {
      if (cardLoadedResolve.value) {
        cardLoadedResolve.value()
        cardLoadedResolve.value = null
      }
    }

    function mapPlotDefToProps(item: ResolvedPlotExport, filteredData: any[], baselineData: any[]) {
      const def = item.plotDef
      const base: Record<string, any> = {
        filteredData,
        baselineData,
        showComparison: item.comparison,
      }

      if (item.colorBy) {
        base.colorByAttribute = item.colorBy
      }

      switch (def.type) {
        case 'histogram':
          return { ...base, column: def.column, binSize: def.binSize, xMin: def.xMin, xMax: def.xMax, autoTrim: def.autoTrim, title: def.title }
        case 'pie-chart':
          return { ...base, column: def.column, title: def.title }
        case 'scatter-plot':
          return { ...base, xColumn: def.xColumn || def.x, yColumn: def.yColumn || def.y, title: def.title }
        case 'correlation-matrix':
          return { ...base, attributes: def.attributes, title: def.title }
        case 'timeline':
          return { ...base, column: def.column, title: def.title }
        case 'map':
          return { ...base, layers: def.layers, center: def.center, zoom: def.zoom, mapStyle: def.mapStyle, title: def.title }
        default:
          return base
      }
    }

    async function renderAndCapture(
      item: ResolvedPlotExport,
      filteredData: any[],
      baselineData: any[]
    ): Promise<ExportResult> {
      // Resolve the component
      const lookupKey = CARD_TYPE_MAP[item.plotDef.type]
      if (!lookupKey || !panelLookup[lookupKey]) {
        throw new Error(`Unknown card type: ${item.plotDef.type}`)
      }

      // Set up the dynamic component
      const resolvedComponent = await panelLookup[lookupKey].__asyncLoader()
      currentCardComponent.value = markRaw(resolvedComponent)
      currentCardProps.value = mapPlotDefToProps(item, filteredData, baselineData)

      // Wait for Vue to render
      await nextTick()

      // Wait for card to signal it's loaded
      await new Promise<void>((resolve) => {
        cardLoadedResolve.value = resolve
        // Timeout after 15s to prevent hanging
        setTimeout(() => {
          if (cardLoadedResolve.value) {
            cardLoadedResolve.value = null
            resolve()
          }
        }, 15000)
      })

      // Give Plotly extra time to finish rendering
      await new Promise(resolve => setTimeout(resolve, 500))

      // Capture the rendered output
      const target = renderTarget.value
      if (!target) throw new Error('Render target not found')

      // Try Plotly chart first
      const plotlyEl = target.querySelector('.js-plotly-plot') as HTMLElement
      if (plotlyEl) {
        return exportPlotlyChart(plotlyEl, {
          format: item.format,
          width: item.width,
          height: item.height,
          scale: item.scale,
          filename: item.filename,
        })
      }

      // Try canvas (for maps)
      const canvas = target.querySelector('canvas') as HTMLCanvasElement
      if (canvas) {
        const mimeType = item.format === 'svg' ? 'image/svg+xml' : 'image/png'
        const dataUrl = canvas.toDataURL(mimeType)
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
        return {
          data: base64Data,
          extension: item.format,
          filename: item.filename,
          mimeType,
        }
      }

      throw new Error(`No exportable element found for ${item.plotId}`)
    }

    async function startExport() {
      try {
        const results = await engine.run(
          props.exportYaml,
          renderAndCapture,
          props.fileLoader as (path: string) => Promise<Blob>
        )
        exportResults.value = results

        // Clear the render area
        currentCardComponent.value = null
        currentCardProps.value = null

        // Signal completion for headless detection
        ;(window as any).__exportComplete = true
        emit('complete', results)
      } catch (error) {
        console.error('[ExportView] Export failed:', error)
      }
    }

    function handleCancel() {
      engine.cancel()
    }

    async function downloadResults() {
      if (exportResults.value.length === 0) return
      await exportAllChartsAsZip(exportResults.value, 'dashboard-export')
    }

    function handleClose() {
      emit('close')
    }

    onMounted(() => {
      startExport()
    })

    return {
      renderTarget,
      currentCardComponent,
      currentCardProps,
      progress,
      progressPercent,
      renderContainerStyle,
      handleCardLoaded,
      handleCancel,
      downloadResults,
      handleClose,
    }
  },
})
</script>

<style scoped>
.export-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  background: var(--bg, #fff);
  color: var(--text, #333);
}

.export-header h2 {
  margin: 0 0 1rem 0;
  font-size: 1.25rem;
}

.render-container {
  position: relative;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.render-label {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 0.75rem;
  color: #999;
  z-index: 10;
}

.render-target {
  width: 100%;
  height: 100%;
}

.progress-panel {
  flex: 1;
  overflow-y: auto;
}

.progress-state {
  margin-bottom: 0.5rem;
}

.state-label {
  font-weight: 600;
  font-size: 0.9rem;
}

.progress-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 1rem;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  padding: 4px 8px;
  border-radius: 3px;
}

.progress-item.success {
  color: #2e7d32;
}

.progress-item.failed {
  color: #c62828;
}

.progress-item.current {
  color: #1565c0;
}

.error-msg {
  font-size: 0.75rem;
  color: #c62828;
  margin-left: 0.5rem;
}

.progress-bar-container {
  margin-top: 0.5rem;
}

.progress-text {
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #1565c0;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.export-actions {
  display: flex;
  gap: 8px;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.btn-cancel,
.btn-download,
.btn-close {
  padding: 6px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-download {
  background: #1565c0;
  color: #fff;
  border-color: #1565c0;
}

.btn-close {
  background: transparent;
}

.error-message {
  color: #c62828;
}

.error-message p {
  margin: 0 0 0.5rem 0;
}
</style>
