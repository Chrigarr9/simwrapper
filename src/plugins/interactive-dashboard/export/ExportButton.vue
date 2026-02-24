<template lang="pug">
.export-dropdown
  button.btn-export(@click="toggleDropdown" ref="dropdownButton")
    i.fa.fa-download
    span Export
    i.fa.fa-chevron-down.chevron

  .dropdown-menu(v-if="isOpen" ref="dropdownMenu")
    //- Export current view (same as old ExportAllButton)
    .dropdown-item(@click="exportCurrentView")
      i.fa.fa-camera
      span Export Current View

    .dropdown-divider(v-if="exportConfigs.length > 0")

    //- Export configs from YAML
    .dropdown-item(
      v-for="config in exportConfigs"
      :key="config.file"
      @click="runExportConfig(config)"
    )
      i.fa.fa-file-export
      span {{ config.label || config.file }}

    .dropdown-divider

    //- Upload option
    .dropdown-item(@click="uploadConfig")
      i.fa.fa-upload
      span Upload Export Config...
    input.hidden-input(
      ref="fileInput"
      type="file"
      accept=".yaml,.yml"
      @change="handleFileUpload"
    )

  //- Fullscreen overlay for ExportView
  .export-overlay(v-if="showExportView")
    .export-overlay-backdrop(@click="showExportView = false")
    .export-overlay-content
      export-view(
        :export-yaml="activeYaml"
        :file-loader="fileLoader"
        :subfolder="subfolder"
        :config-path="activeConfigPath"
        @complete="handleExportComplete"
        @close="showExportView = false"
      )
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import type { PropType } from 'vue'

import ExportView from './ExportView.vue'
import { exportPlotlyChart, exportAllChartsAsZip, sanitizeFilename } from '../utils/exportUtils'
import type { ExportResult } from '../types/export'

interface ExportConfigEntry {
  file: string
  label?: string
}

export default defineComponent({
  name: 'ExportButton',

  components: { ExportView },

  props: {
    exportConfigs: {
      type: Array as PropType<ExportConfigEntry[]>,
      default: () => [],
    },
    dashboardTitle: { type: String, default: 'dashboard' },
    fileLoader: { type: Function, required: true },
    subfolder: { type: String, default: '' },
  },

  setup(props) {
    const isOpen = ref(false)
    const showExportView = ref(false)
    const activeYaml = ref('')
    const activeConfigPath = ref('')
    const dropdownButton = ref<HTMLElement>()
    const dropdownMenu = ref<HTMLElement>()
    const fileInput = ref<HTMLInputElement>()

    function toggleDropdown() {
      isOpen.value = !isOpen.value
    }

    function closeDropdown() {
      isOpen.value = false
    }

    function handleClickOutside(event: MouseEvent) {
      if (!isOpen.value) return
      const target = event.target as Node
      if (
        dropdownButton.value?.contains(target) ||
        dropdownMenu.value?.contains(target)
      ) {
        return
      }
      closeDropdown()
    }

    async function exportCurrentView() {
      closeDropdown()

      const items: Array<{ element: HTMLElement | HTMLCanvasElement; title: string; type: 'plotly' | 'map' }> = []

      // Find Plotly charts
      document.querySelectorAll('.dashboard-card .js-plotly-plot').forEach(el => {
        const card = el.closest('.dashboard-card')
        if (!card) return
        const title = card.querySelector('.card-header h3')?.textContent?.trim() || 'chart'
        items.push({ element: el as HTMLElement, title, type: 'plotly' })
      })

      // Find map canvases
      document.querySelectorAll('.dashboard-card [data-exportable-map]').forEach(container => {
        const canvas = container.querySelector('canvas') as HTMLCanvasElement
        if (!canvas) return
        const card = container.closest('.dashboard-card')
        if (!card) return
        const title = card.querySelector('.card-header h3')?.textContent?.trim() || 'map'
        items.push({ element: canvas, title, type: 'map' })
      })

      if (items.length === 0) return

      const results: ExportResult[] = []
      for (const item of items) {
        try {
          const filename = sanitizeFilename(item.title, item.type)
          if (item.type === 'plotly') {
            results.push(await exportPlotlyChart(item.element as HTMLElement, {
              format: 'png',
              width: 1200,
              scale: 2,
              filename,
            }))
          } else {
            const dataUrl = (item.element as HTMLCanvasElement).toDataURL('image/png')
            results.push({
              data: dataUrl.replace(/^data:image\/\w+;base64,/, ''),
              extension: 'png',
              filename,
              mimeType: 'image/png',
            })
          }
        } catch (error) {
          console.warn(`[ExportButton] Failed to export "${item.title}":`, error)
        }
      }

      if (results.length > 0) {
        const zipFilename = sanitizeFilename(props.dashboardTitle, 'dashboard') + '-export'
        await exportAllChartsAsZip(results, zipFilename)
      }
    }

    async function runExportConfig(config: ExportConfigEntry) {
      closeDropdown()
      try {
        const blob = await (props.fileLoader as (path: string) => Promise<Blob>)(config.file)
        activeYaml.value = await blob.text()
        activeConfigPath.value = config.file
        showExportView.value = true
      } catch (error) {
        console.error('[ExportButton] Failed to load export config:', error)
      }
    }

    function uploadConfig() {
      closeDropdown()
      fileInput.value?.click()
    }

    async function handleFileUpload(event: Event) {
      const input = event.target as HTMLInputElement
      const file = input.files?.[0]
      if (!file) return

      activeYaml.value = await file.text()
      activeConfigPath.value = file.name
      showExportView.value = true

      // Reset file input so the same file can be re-selected
      input.value = ''
    }

    function handleExportComplete() {
      // Export completed in overlay mode
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      isOpen,
      showExportView,
      activeYaml,
      activeConfigPath,
      dropdownButton,
      dropdownMenu,
      fileInput,
      toggleDropdown,
      exportCurrentView,
      runExportConfig,
      uploadConfig,
      handleFileUpload,
      handleExportComplete,
    }
  },
})
</script>

<style scoped lang="scss">
.export-dropdown {
  position: relative;
  display: inline-flex;
}

.btn-export {
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

  &:hover {
    background-color: var(--dashboard-bg-tertiary);
    border-color: var(--dashboard-interaction-selected);
  }

  .chevron {
    font-size: 0.7rem;
    margin-left: 2px;
  }
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 200px;
  background: var(--dashboard-bg-primary, #fff);
  border: 1px solid var(--dashboard-border-default, #ddd);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--dashboard-text-primary, #333);
  transition: background-color 0.1s;

  &:hover {
    background-color: var(--dashboard-bg-tertiary, #f5f5f5);
  }

  i {
    width: 16px;
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.7;
  }
}

.dropdown-divider {
  height: 1px;
  background: var(--dashboard-border-default, #eee);
  margin: 4px 0;
}

.hidden-input {
  display: none;
}

.export-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.export-overlay-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.export-overlay-content {
  position: relative;
  width: 90vw;
  height: 90vh;
  max-width: 1400px;
  background: var(--dashboard-bg-primary, #fff);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: auto;
  z-index: 1;
}
</style>
