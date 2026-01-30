<template lang="pug">
.export-all-button
  button.btn-export-all(
    @click="handleExportAll"
    :disabled="isExporting"
    :title="isExporting ? 'Exporting...' : 'Download All Charts'"
  )
    i.fa(:class="isExporting ? 'fa-spinner fa-spin' : 'fa-download'")
    span {{ isExporting ? 'Exporting...' : 'Export All' }}
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { exportPlotlyChart, exportAllChartsAsZip, sanitizeFilename } from '../../utils/exportUtils'
import type { ExportResult } from '../../types/export'

interface Props {
  /** Dashboard title for ZIP filename */
  dashboardTitle?: string
  /** Format for exports (default: png) */
  format?: 'png' | 'svg'
  /** Export width (default: 1200) */
  width?: number
  /** Export scale (default: 2) */
  scale?: number
}

const props = withDefaults(defineProps<Props>(), {
  dashboardTitle: 'dashboard',
  format: 'png',
  width: 1200,
  scale: 2,
})

const emit = defineEmits(['exportStart', 'exportComplete', 'exportError'])

const isExporting = ref(false)

interface ExportableItem {
  element: HTMLElement | HTMLCanvasElement
  title: string
  type: 'plotly' | 'map'
}

/**
 * Find all exportable elements in the dashboard (Plotly charts and maps)
 */
function findExportableItems(): ExportableItem[] {
  const items: ExportableItem[] = []

  // Find all Plotly chart elements
  const plotElements = document.querySelectorAll('.dashboard-card .js-plotly-plot')
  plotElements.forEach((element) => {
    const card = element.closest('.dashboard-card')
    if (!card) return
    const titleElement = card.querySelector('.card-header h3')
    const title = titleElement?.textContent?.trim() || 'chart'
    items.push({
      element: element as HTMLElement,
      title,
      type: 'plotly',
    })
  })

  // Find all map canvases
  const mapContainers = document.querySelectorAll('.dashboard-card [data-exportable-map]')
  mapContainers.forEach((container) => {
    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    if (!canvas) return
    const card = container.closest('.dashboard-card')
    if (!card) return
    const titleElement = card.querySelector('.card-header h3')
    const title = titleElement?.textContent?.trim() || 'map'
    items.push({
      element: canvas,
      title,
      type: 'map',
    })
  })

  return items
}

/**
 * Export a map canvas to an ExportResult
 */
async function exportMapCanvasToResult(canvas: HTMLCanvasElement, filename: string): Promise<ExportResult> {
  const dataUrl = canvas.toDataURL('image/png')
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  return {
    data: base64Data,
    extension: 'png',
    filename,
    mimeType: 'image/png',
  }
}

/**
 * Export all charts and maps as a ZIP file
 */
async function handleExportAll() {
  if (isExporting.value) return

  isExporting.value = true
  emit('exportStart')

  try {
    const items = findExportableItems()
    console.log('[ExportAllButton] Found exportable items:', items.length)

    if (items.length === 0) {
      console.warn('[ExportAllButton] No exportable items found')
      isExporting.value = false
      return
    }

    const results: ExportResult[] = []

    // Export each item
    for (const item of items) {
      try {
        const filename = sanitizeFilename(item.title, item.type)

        if (item.type === 'plotly') {
          const result = await exportPlotlyChart(item.element as HTMLElement, {
            format: props.format,
            width: props.width,
            scale: props.scale,
            filename,
          })
          results.push(result)
        } else if (item.type === 'map') {
          // Maps always export as PNG
          const result = await exportMapCanvasToResult(item.element as HTMLCanvasElement, filename)
          results.push(result)
        }
      } catch (error) {
        console.warn(`[ExportAllButton] Failed to export "${item.title}":`, error)
      }
    }

    if (results.length > 0) {
      // Generate ZIP filename from dashboard title
      const zipFilename = sanitizeFilename(props.dashboardTitle, 'dashboard') + '-export'
      await exportAllChartsAsZip(results, zipFilename)
      emit('exportComplete', results.length)
      console.log('[ExportAllButton] ZIP export completed with', results.length, 'items')
    }
  } catch (error) {
    console.error('[ExportAllButton] Export all failed:', error)
    emit('exportError', error as Error)
  } finally {
    isExporting.value = false
  }
}
</script>

<style scoped lang="scss">
.export-all-button {
  display: inline-flex;
  align-items: center;
}

.btn-export-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--dashboard-border-default);
  border-radius: 4px;
  background-color: var(--dashboard-bg-secondary);
  color: var(--dashboard-text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background-color: var(--dashboard-bg-tertiary);
    border-color: var(--dashboard-interaction-selected);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  i {
    font-size: 0.9rem;
  }
}
</style>
