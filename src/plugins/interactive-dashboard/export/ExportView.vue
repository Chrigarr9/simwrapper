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
import type { ExportProgress } from './ExportEngine'
import type { ResolvedPlotExport, ExportColorByOption } from '../types/exportConfig'
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
    configPath: { type: String, default: '' },
    fileSystemConfig: { type: Object, default: null },
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

    function composeMapCanvases(canvases: HTMLCanvasElement[]): HTMLCanvasElement {
      const baseCanvas = canvases.reduce((best, current) => {
        const bestArea = best.width * best.height
        const currentArea = current.width * current.height
        return currentArea > bestArea ? current : best
      }, canvases[0])

      const composite = document.createElement('canvas')
      composite.width = Math.max(1, baseCanvas.width)
      composite.height = Math.max(1, baseCanvas.height)
      const context = composite.getContext('2d')
      if (!context) {
        throw new Error('Composite canvas context unavailable for map export')
      }

      for (const mapCanvas of canvases) {
        if (!mapCanvas.width || !mapCanvas.height) continue
        context.drawImage(mapCanvas, 0, 0, composite.width, composite.height)
      }

      return composite
    }

    function getAlphaBounds(canvas: HTMLCanvasElement): {
      minX: number
      minY: number
      maxX: number
      maxY: number
    } | null {
      const context = canvas.getContext('2d')
      if (!context) return null

      const { width, height } = canvas
      if (!width || !height) return null

      const imageData = context.getImageData(0, 0, width, height)
      const data = imageData.data

      let minX = width
      let minY = height
      let maxX = -1
      let maxY = -1

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const alpha = data[(y * width + x) * 4 + 3]
          if (alpha > 0) {
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }
      }

      if (maxX < minX || maxY < minY) return null
      return { minX, minY, maxX, maxY }
    }

    function cropCanvas(
      source: HTMLCanvasElement,
      bounds: { minX: number; minY: number; maxX: number; maxY: number },
      padding: number
    ): HTMLCanvasElement {
      const minX = Math.max(0, Math.floor(bounds.minX - padding))
      const minY = Math.max(0, Math.floor(bounds.minY - padding))
      const maxX = Math.min(source.width - 1, Math.ceil(bounds.maxX + padding))
      const maxY = Math.min(source.height - 1, Math.ceil(bounds.maxY + padding))

      const width = Math.max(1, maxX - minX + 1)
      const height = Math.max(1, maxY - minY + 1)

      const cropped = document.createElement('canvas')
      cropped.width = width
      cropped.height = height
      const context = cropped.getContext('2d')
      if (!context) {
        throw new Error('Cropped canvas context unavailable for map export')
      }

      context.drawImage(source, minX, minY, width, height, 0, 0, width, height)
      return cropped
    }

    function scaleCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
      const target = document.createElement('canvas')
      target.width = Math.max(1, Math.round(width))
      target.height = Math.max(1, Math.round(height))
      const context = target.getContext('2d')
      if (!context) {
        throw new Error('Scaled canvas context unavailable for map export')
      }
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(source, 0, 0, target.width, target.height)
      return target
    }

    function drawLegendOverlay(
      ctx: CanvasRenderingContext2D,
      legendData: any,
      canvasWidth: number,
      canvasHeight: number,
      dpr: number
    ) {
      const margin = 16 * dpr
      const padding = 10 * dpr
      const titleFontSize = 13 * dpr
      const labelFontSize = 11 * dpr
      const titleFont = `bold ${titleFontSize}px sans-serif`
      const labelFont = `${labelFontSize}px sans-serif`

      if (legendData.type === 'numeric') {
        // Vertical gradient bar with tick labels
        const barWidth = 18 * dpr
        const barHeight = 140 * dpr
        const tickCount = 5
        const title = legendData.title || ''

        // Measure text widths for box sizing
        ctx.font = labelFont
        const maxLabel = String(legendData.maxValue?.toFixed?.(2) ?? legendData.maxValue)
        const labelWidth = ctx.measureText(maxLabel).width + 8 * dpr

        const boxWidth = barWidth + labelWidth + padding * 3
        const boxHeight = barHeight + (title ? titleFontSize + padding : 0) + padding * 2

        const boxX = canvasWidth - boxWidth - margin
        const boxY = canvasHeight - boxHeight - margin

        // Semi-transparent background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
        ctx.lineWidth = dpr
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4 * dpr)
        ctx.fill()
        ctx.stroke()

        let yOffset = boxY + padding

        // Title
        if (title) {
          ctx.fillStyle = '#333'
          ctx.font = titleFont
          ctx.textAlign = 'left'
          ctx.fillText(title, boxX + padding, yOffset + titleFontSize * 0.85)
          yOffset += titleFontSize + padding * 0.5
        }

        // Gradient bar
        const barX = boxX + padding
        const barY = yOffset
        const minColor = legendData.minColor || '#ffffcc'
        const maxColor = legendData.maxColor || '#bd0026'
        const gradient = ctx.createLinearGradient(barX, barY + barHeight, barX, barY)
        gradient.addColorStop(0, minColor)
        gradient.addColorStop(1, maxColor)
        ctx.fillStyle = gradient
        ctx.fillRect(barX, barY, barWidth, barHeight)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
        ctx.lineWidth = dpr * 0.5
        ctx.strokeRect(barX, barY, barWidth, barHeight)

        // Tick labels
        ctx.fillStyle = '#333'
        ctx.font = labelFont
        ctx.textAlign = 'left'
        const minVal = legendData.minValue ?? 0
        const maxVal = legendData.maxValue ?? 1
        for (let i = 0; i < tickCount; i++) {
          const frac = i / (tickCount - 1)
          const val = maxVal - frac * (maxVal - minVal)
          const tickY = barY + frac * barHeight
          ctx.fillText(
            val.toFixed(2),
            barX + barWidth + 6 * dpr,
            tickY + labelFontSize * 0.35
          )
        }
      } else if (legendData.type === 'categorical' && legendData.items?.length) {
        // Colored swatches with labels
        const swatchSize = 14 * dpr
        const rowHeight = swatchSize + 6 * dpr
        const items = legendData.items
        const title = legendData.title || ''

        ctx.font = labelFont
        const maxLabelWidth = Math.max(...items.map((it: any) => ctx.measureText(it.label).width))

        const boxWidth = swatchSize + maxLabelWidth + padding * 3 + 8 * dpr
        const boxHeight =
          items.length * rowHeight +
          (title ? titleFontSize + padding : 0) +
          padding * 2

        const boxX = canvasWidth - boxWidth - margin
        const boxY = canvasHeight - boxHeight - margin

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
        ctx.lineWidth = dpr
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4 * dpr)
        ctx.fill()
        ctx.stroke()

        let yOffset = boxY + padding

        if (title) {
          ctx.fillStyle = '#333'
          ctx.font = titleFont
          ctx.textAlign = 'left'
          ctx.fillText(title, boxX + padding, yOffset + titleFontSize * 0.85)
          yOffset += titleFontSize + padding * 0.5
        }

        for (const item of items) {
          ctx.fillStyle = item.color
          ctx.fillRect(boxX + padding, yOffset, swatchSize, swatchSize)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
          ctx.lineWidth = dpr * 0.5
          ctx.strokeRect(boxX + padding, yOffset, swatchSize, swatchSize)

          ctx.fillStyle = '#333'
          ctx.font = labelFont
          ctx.textAlign = 'left'
          ctx.fillText(
            item.label,
            boxX + padding + swatchSize + 6 * dpr,
            yOffset + swatchSize * 0.75
          )
          yOffset += rowHeight
        }
      }
    }

    function handleCardLoaded() {
      if (cardLoadedResolve.value) {
        cardLoadedResolve.value()
        cardLoadedResolve.value = null
      }
    }

    function mapPlotDefToProps(
      item: ResolvedPlotExport,
      filteredData: any[],
      baselineData: any[],
      tableConfig?: Record<string, any>,
      colorByOptions?: ExportColorByOption[]
    ) {
      const def = item.plotDef
      const base: Record<string, any> = {
        filteredData,
        baselineData,
        showComparison: item.comparison,
        tableConfig,
        colorByOptions,
        exportMode: true,
        exportAxisTitleFontSize: item.axisTitleFontSize,
        exportAxisTickFontSize: item.axisTickFontSize,
        exportLegendTitleFontSize: item.legendTitleFontSize,
        exportLegendFontSize: item.legendFontSize,
        exportLineWidth: item.lineWidth,
        exportMarkerSizeMultiplier: item.markerSizeMultiplier,
      }

      if (item.colorBy) {
        base.colorByAttribute = item.colorBy
      }

      switch (def.type) {
        case 'histogram':
          return {
            ...base,
            column: def.column,
            binSize: def.binSize,
            xMin: def.xMin,
            xMax: def.xMax,
            autoTrim: def.autoTrim,
            title: def.title,
            idColumn: def.idColumn,
          }
        case 'pie-chart':
          return { ...base, column: def.column, title: def.title, idColumn: def.idColumn }
        case 'scatter-plot':
          return {
            ...base,
            xColumn: def.xColumn || def.x,
            yColumn: def.yColumn || def.y,
            yColumnRight: def.yColumnRight,
            colorColumn: def.colorColumn,
            sizeColumn: def.sizeColumn,
            markerSize: def.markerSize,
            connectLines: def.connectLines,
            showTooltip: def.showTooltip,
            idColumn: def.idColumn,
            xMin: def.xMin,
            xMax: def.xMax,
            yMin: def.yMin,
            yMax: def.yMax,
            xAutoTrim: def.xAutoTrim,
            yAutoTrim: def.yAutoTrim,
            title: def.title,
          }
        case 'correlation-matrix':
          return {
            ...base,
            attributes: def.attributes,
            leftAttributes: def.leftAttributes,
            bottomAttributes: def.bottomAttributes,
            matrixPart: def.matrixPart,
            title: def.title,
          }
        case 'timeline':
          return { ...base, column: def.column, title: def.title }
        case 'map':
          return {
            ...base,
            layers: def.layers,
            center: def.center,
            zoom: def.zoom,
            mapStyle: def.mapStyle,
            title: def.title,
            fileSystemConfig: props.fileSystemConfig,
            subfolder: props.subfolder,
          }
        default:
          return base
      }
    }

    async function renderAndCapture(
      item: ResolvedPlotExport,
      filteredData: any[],
      baselineData: any[],
      tableConfig?: Record<string, any>,
      colorByOptions?: ExportColorByOption[]
    ): Promise<ExportResult> {
      const stageKey = `${item.stateId}:${item.plotId}`
      const setStage = (stage: string) => {
        const current = ((globalThis as any).__exportCaptureStages || {}) as Record<string, string>
        current[stageKey] = stage
        ;(globalThis as any).__exportCaptureStages = current
      }

      setStage('resolve-component')

      // Resolve the component
      const lookupKey = CARD_TYPE_MAP[item.plotDef.type]
      if (!lookupKey || !panelLookup[lookupKey]) {
        throw new Error(`Unknown card type: ${item.plotDef.type}`)
      }

      // Set up the dynamic component
      const panelComponent = panelLookup[lookupKey] as any
      const resolvedComponent = panelComponent?.__asyncLoader
        ? await panelComponent.__asyncLoader()
        : panelComponent
      currentCardComponent.value = markRaw(resolvedComponent)
      currentCardProps.value = mapPlotDefToProps(
        item,
        filteredData,
        baselineData,
        tableConfig,
        colorByOptions
      )

      // Wait for Vue to render
      setStage('vue-next-tick')
      await nextTick()

      // Map cards need explicit load completion before canvas capture
      if (item.plotDef.type === 'map') {
        setStage('wait-map-loaded-event')
        await new Promise<void>(resolve => {
          let done = false
          cardLoadedResolve.value = () => {
            if (done) return
            done = true
            resolve()
          }
          setTimeout(() => {
            if (done) return
            done = true
            cardLoadedResolve.value = null
            resolve()
          }, 30000)
        })
      }

      // Wait until a renderable chart/map element appears
      setStage('wait-renderable-element')
      const waitStart = Date.now()
      let exportableEl = renderTarget.value?.querySelector('.js-plotly-plot, canvas') as
        | HTMLElement
        | null
      while (!exportableEl && Date.now() - waitStart < 30000) {
        await new Promise(resolve => setTimeout(resolve, 400))
        exportableEl = renderTarget.value?.querySelector('.js-plotly-plot, canvas') as
          | HTMLElement
          | null
      }

      // Small settle delay after element appears
      setStage('post-render-settle')
      await new Promise(resolve => setTimeout(resolve, 300))

      // Capture the rendered output
      setStage('capture-element')
      const target = renderTarget.value
      if (!target) throw new Error('Render target not found')

      // Try Plotly chart first
      const plotlyEl = target.querySelector('.js-plotly-plot') as HTMLElement
      if (plotlyEl) {
        setStage('capture-plotly')
        return exportPlotlyChart(plotlyEl, {
          format: item.format,
          width: item.width,
          height: item.height,
          scale: item.scale,
          filename: item.filename,
        })
      }

      // Try canvas (for maps)
      const canvasSelector = item.plotDef.type === 'map' ? '[data-exportable-map="true"] canvas, canvas' : 'canvas'
      const canvas = target.querySelector(canvasSelector) as HTMLCanvasElement
      if (canvas) {
        setStage('capture-canvas')
        const mimeType = item.format === 'svg' ? 'image/svg+xml' : 'image/png'

        // Map cards may render base map and overlays on separate canvases
        // (e.g. MapLibre + deck.gl). Composite all map canvases to preserve features.
        let exportCanvas: HTMLCanvasElement
        if (item.plotDef.type === 'map') {
          const mapContainer = target.querySelector('[data-exportable-map="true"]') as HTMLElement | null
          const mapCanvases = Array.from(mapContainer?.querySelectorAll('canvas') ?? []) as HTMLCanvasElement[]

          if (mapCanvases.length > 1) {
            setStage('capture-map-composite')
            const baseCanvas = mapCanvases.reduce((best, current) => {
              const bestArea = best.width * best.height
              const currentArea = current.width * current.height
              return currentArea > bestArea ? current : best
            }, mapCanvases[0])
            let composed = composeMapCanvases(mapCanvases)

            const shouldCrop = item.plotDef.cropToVisibleFeatures === true
            if (shouldCrop) {
              const padding = Number.isFinite(item.plotDef.cropPadding)
                ? Math.max(0, Number(item.plotDef.cropPadding))
                : 24

              const overlayCanvases = mapCanvases.filter(c => c !== baseCanvas)
              const combinedOverlay =
                overlayCanvases.length > 0 ? composeMapCanvases(overlayCanvases) : null
              const featureBounds = combinedOverlay ? getAlphaBounds(combinedOverlay) : null

              if (featureBounds) {
                setStage('capture-map-crop')
                composed = cropCanvas(composed, featureBounds, padding)
              }
            }

            const targetWidth = item.width * item.scale
            const targetHeight = item.height * item.scale
            exportCanvas = scaleCanvas(composed, targetWidth, targetHeight)
          } else {
            const targetWidth = item.width * item.scale
            const targetHeight = item.height * item.scale
            exportCanvas = scaleCanvas(canvas, targetWidth, targetHeight)
          }
        } else {
          exportCanvas = canvas
        }

        // Draw legend overlay onto the export canvas if legend data is available
        if (item.plotDef.type === 'map') {
          const mapContainer = target.querySelector('[data-exportable-map="true"]') as HTMLElement | null
          const legendJson = mapContainer?.getAttribute('data-legend-json')
          if (legendJson) {
            try {
              const legendInfo = JSON.parse(legendJson)
              const legendCtx = exportCanvas.getContext('2d')
              if (legendCtx) {
                drawLegendOverlay(legendCtx, legendInfo, exportCanvas.width, exportCanvas.height, item.scale)
              }
            } catch (e) {
              console.warn('[ExportView] Failed to draw legend overlay:', e)
            }
          }
        }

        const dataUrl = exportCanvas.toDataURL(mimeType)

        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
        return {
          data: base64Data,
          extension: item.format,
          filename: item.filename,
          mimeType,
        }
      }

      setStage('capture-no-element')
      throw new Error(`No exportable element found for ${item.plotId}`)
    }

    async function startExport() {
      try {
        const results = await engine.run(
          props.exportYaml,
          renderAndCapture,
          props.fileLoader as (path: string) => Promise<Blob>,
          props.configPath
        )
        exportResults.value = results

        // Clear the render area
        currentCardComponent.value = null
        currentCardProps.value = null

        // Signal completion for headless detection
        ;(globalThis as any).__exportResults = results
        ;(globalThis as any).__exportSummary = {
          status: progress.value.status,
          completedCount: progress.value.completedCount,
          totalCount: progress.value.totalCount,
          completedItems: progress.value.completedItems,
        }
        ;(globalThis as any).__exportComplete = true
        emit('complete', results)
      } catch (error) {
        console.error('[ExportView] Export failed:', error)
        ;(globalThis as any).__exportSummary = {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          completedCount: progress.value.completedCount,
          totalCount: progress.value.totalCount,
          completedItems: progress.value.completedItems,
        }
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
