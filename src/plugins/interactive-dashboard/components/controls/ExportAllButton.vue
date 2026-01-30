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

/**
 * Find all exportable Plotly charts in the dashboard
 */
function findExportableCharts(): { element: HTMLElement; title: string; type: string }[] {
  const charts: { element: HTMLElement; title: string; type: string }[] = []

  // Find all Plotly chart elements
  const plotElements = document.querySelectorAll('.dashboard-card .js-plotly-plot')

  plotElements.forEach((element) => {
    // Find parent dashboard-card to get title
    const card = element.closest('.dashboard-card')
    if (!card) return

    // Get title from card header
    const titleElement = card.querySelector('.card-header h3')
    const title = titleElement?.textContent?.trim() || 'chart'

    // Determine chart type from parent classes or data attributes
    const cardContent = element.closest('.card-content')
    const typeClass = cardContent?.querySelector('[class*="Card"]')?.className || ''
    const type = typeClass.includes('histogram') ? 'histogram'
      : typeClass.includes('scatter') ? 'scatter'
      : typeClass.includes('pie') ? 'pie'
      : typeClass.includes('correlation') ? 'correlation'
      : typeClass.includes('timeline') ? 'timeline'
      : 'chart'

    charts.push({
      element: element as HTMLElement,
      title,
      type,
    })
  })

  return charts
}

/**
 * Export all charts as a ZIP file
 */
async function handleExportAll() {
  if (isExporting.value) return

  isExporting.value = true
  emit('exportStart')

  try {
    const charts = findExportableCharts()

    if (charts.length === 0) {
      console.warn('No exportable charts found')
      return
    }

    const results: ExportResult[] = []

    // Export each chart
    for (const chart of charts) {
      try {
        const result = await exportPlotlyChart(chart.element, {
          format: props.format,
          width: props.width,
          scale: props.scale,
          filename: sanitizeFilename(chart.title, chart.type),
        })
        results.push(result)
      } catch (error) {
        console.warn(`Failed to export chart "${chart.title}":`, error)
      }
    }

    if (results.length > 0) {
      // Generate ZIP filename from dashboard title
      const zipFilename = sanitizeFilename(props.dashboardTitle, 'dashboard') + '-export'
      await exportAllChartsAsZip(results, zipFilename)
      emit('exportComplete', results.length)
    }
  } catch (error) {
    console.error('Export all failed:', error)
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
