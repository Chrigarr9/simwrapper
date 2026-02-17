<template lang="pug">
.export-page
  .loading(v-if="isLoading")
    i.fa.fa-spinner.fa-spin
    span Loading export configuration...

  export-view(
    v-if="yamlText && !isLoading"
    :export-yaml="yamlText"
    :file-loader="loadFile"
    :subfolder="subfolder"
    @complete="handleComplete"
    @close="handleClose"
  )

  .error(v-if="loadError")
    h3 Failed to load export configuration
    p {{ loadError }}
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue'

import ExportView from './ExportView.vue'
import HTTPFileSystem from '@/js/HTTPFileSystem'
import { FileSystemConfig } from '@/Globals'
import globalStore from '@/store'

export default defineComponent({
  name: 'ExportPage',

  components: { ExportView },

  props: {
    configPath: { type: String, default: '' },
    root: { type: String, default: '' },
    subfolder: { type: String, default: '' },
  },

  setup(props) {
    const isLoading = ref(true)
    const yamlText = ref('')
    const loadError = ref('')
    const fileApi = ref<HTTPFileSystem | null>(null)

    function getFileSystem(name: string): FileSystemConfig {
      const svnProject: FileSystemConfig[] = globalStore.state.svnProjects.filter(
        (a: FileSystemConfig) => a.slug === name
      )
      if (svnProject.length === 0) {
        throw new Error(`No file system found for root: ${name}`)
      }
      return svnProject[0]
    }

    async function loadFile(path: string): Promise<Blob> {
      if (!fileApi.value) throw new Error('File system not initialized')
      const filepath = props.subfolder ? `${props.subfolder}/${path}` : path
      return fileApi.value.getFileBlob(filepath)
    }

    async function loadConfig() {
      try {
        // Initialize file system
        const fsConfig = props.root ? getFileSystem(props.root) : getFileSystem('files')
        fileApi.value = new HTTPFileSystem(fsConfig)

        // Load the YAML config file
        const configFilePath = props.subfolder
          ? `${props.subfolder}/${props.configPath}`
          : props.configPath
        const blob = await fileApi.value.getFileBlob(configFilePath)
        yamlText.value = await blob.text()
      } catch (error) {
        loadError.value = error instanceof Error ? error.message : String(error)
        console.error('[ExportPage] Failed to load config:', error)
      } finally {
        isLoading.value = false
      }
    }

    function handleComplete() {
      // Export complete — nothing to do in standalone page mode
    }

    function handleClose() {
      window.history.back()
    }

    onMounted(() => {
      if (props.configPath) {
        loadConfig()
      } else {
        isLoading.value = false
        loadError.value = 'No config path specified. Use ?config=filename.yaml'
      }
    })

    return {
      isLoading,
      yamlText,
      loadError,
      loadFile,
      handleComplete,
      handleClose,
    }
  },
})
</script>

<style scoped>
.export-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  font-size: 1.1rem;
  color: #666;
}

.error {
  padding: 2rem;
  text-align: center;
  color: #c62828;
}

.error h3 {
  margin-bottom: 0.5rem;
}
</style>
