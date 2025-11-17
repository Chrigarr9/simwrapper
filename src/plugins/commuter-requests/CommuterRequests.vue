<template lang="pug">
.commuter-requests-plugin
  .status-message(v-if="loadingText") {{ loadingText }}

  .dashboard-container(v-else)
    //- Controls bar
    .controls-bar
      cluster-type-selector(v-model="clusterType")
      filter-reset-button(
        :has-active-filters="hasActiveFilters"
        @reset="resetFilters"
      )
      comparison-toggle(
        v-model="showComparison"
        @update:modelValue="onComparisonToggle"
      )
      scroll-toggle(
        v-model="enableScrollOnHover"
        @update:modelValue="onScrollToggle"
      )

      .stats-summary
        span {{ filteredRequests.length }} / {{ allRequests.length }} requests

    //- Top panel: Map + Stats (75vh)
    .top-panel
      .map-section
        requests-map(
          :requests="allRequests"
          :filtered-requests="filteredRequests"
          :geometries="requestGeometries"
          :cluster-boundaries="currentClusterBoundaries"
          :selected-clusters="selectedClusters"
          :selected-request-ids="selectedRequestIds"
          :hovered-request-id="hoveredRequestId"
          :cluster-type="clusterType"
          :color-by="colorBy"
          :show-comparison="showComparison"
          :has-active-filters="hasActiveFilters"
          :is-dark-mode="isDarkMode"
          @cluster-clicked="onClusterClicked"
          @request-clicked="onRequestClicked"
          @request-hovered="onRequestHovered"
        )

      .stats-section
        stats-panel(
          :requests="filteredRequests"
          :baseline-requests="effectiveShowComparison ? allRequests : []"
          :selected-timebins="selectedTimebins"
          :selected-modes="selectedModes"
          :show-comparison="effectiveShowComparison"
          :cluster-type="clusterType"
          :is-dark-mode="isDarkMode"
          @timebin-clicked="onTimebinClicked"
          @mode-clicked="onModeClicked"
        )

    //- Bottom panel: Table (100vh)
    .table-panel
      request-table(
        :requests="allRequests"
        :filtered-requests="filteredRequests"
        :selected-request-ids="selectedRequestIds"
        :hovered-request-id="hoveredRequestId"
        :enable-scroll-on-hover="enableScrollOnHover"
        @request-clicked="onRequestClicked"
        @request-hovered="onRequestHovered"
      )

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import YAML from 'yaml'

import type {
  Request,
  ClusterData,
  PluginConfig,
} from './CommuterRequestsConfig'

import { loadRequestData, loadClusterData } from './utils/dataLoader'
import { filterRequests } from './utils/filters'

import { FileSystemConfig, ColorScheme } from '@/Globals'
import HTTPFileSystem from '@/js/HTTPFileSystem'
import globalStore from '@/store'

import RequestsMap from './components/RequestsMap.vue'
import ClusterTypeSelector from './components/controls/ClusterTypeSelector.vue'
import FilterResetButton from './components/controls/FilterResetButton.vue'
import ComparisonToggle from './components/controls/ComparisonToggle.vue'
import ScrollToggle from './components/controls/ScrollToggle.vue'
import StatsPanel from './components/stats/StatsPanel.vue'
import RequestTable from './components/RequestTable.vue'

export default defineComponent({
  name: 'CommuterRequests',
  components: {
    RequestsMap,
    ClusterTypeSelector,
    FilterResetButton,
    ComparisonToggle,
    ScrollToggle,
    StatsPanel,
    RequestTable,
  },

  props: {
    root: { type: String, required: true },
    subfolder: { type: String, required: true },
    yamlConfig: String,
    config: Object,
    thumbnail: Boolean,
  },

  data() {
    return {
      loadingText: 'Loading commuter request data...',
      allRequests: [] as Request[],
      requestGeometries: [] as any[],
      clusterBoundaries: {
        origin: [],
        destination: [],
        spatial: [],
      } as ClusterData,

      selectedClusters: new Set<string | number>(),
      selectedTimebins: new Set<string>(),
      selectedModes: new Set<string>(),
      clusterType: 'origin' as 'origin' | 'destination' | 'spatial',

      showComparison: true, // Default to comparison mode
      colorBy: 'mode' as 'mode' | 'activity' | 'detour',
      isDarkMode: false,
      selectedRequestIds: new Set<string>(), // Track clicked requests for filtering
      hoveredRequestId: null as string | null, // Track hovered request
      enableScrollOnHover: true, // Default to auto-scroll enabled
    }
  },

  computed: {
    fileSystem(): FileSystemConfig {
      const svnProject: FileSystemConfig[] = (this.$store.state as any).svnProjects.filter(
        (a: FileSystemConfig) => a.slug === this.root
      )
      if (svnProject.length === 0) {
        console.error('No such project:', this.root)
        throw new Error(`Project not found: ${this.root}`)
      }
      return svnProject[0]
    },

    fileApi() {
      return new HTTPFileSystem(this.fileSystem, globalStore)
    },

    pluginConfig(): PluginConfig {
      // Default config
      const defaultConfig: PluginConfig = {
        files: {
          requestsTable: 'requests_od_flows.csv',
          requestsGeometry: 'requests_od_lines.geojson',
          clusterBoundariesOrigin: 'cluster_boundaries_origin.geojson',
          clusterBoundariesDest: 'cluster_boundaries_destination.geojson',
          clusterBoundariesOD: 'cluster_boundaries_od.geojson',
        },
        display: {
          colorBy: 'mode',
          defaultClusterType: 'origin',
          showComparison: false,
        },
        stats: [
          { type: 'active-time-histogram', binSize: 15 },
          { type: 'main-mode-pie' },
        ],
      }

      // Parse YAML config and merge with defaults
      if (this.yamlConfig) {
        try {
          const parsed = YAML.parse(this.yamlConfig)
          console.log('Parsed YAML config:', parsed)

          // Merge parsed config with defaults
          return {
            files: { ...defaultConfig.files, ...(parsed.files || {}) },
            display: { ...defaultConfig.display, ...(parsed.display || {}) },
            stats: parsed.stats || defaultConfig.stats,
          }
        } catch (error) {
          console.error('Error parsing YAML config:', error)
          return defaultConfig
        }
      }

      return defaultConfig
    },

    filteredRequests(): Request[] {
      return filterRequests(
        this.allRequests,
        this.selectedClusters,
        this.selectedTimebins,
        this.selectedModes,
        this.selectedRequestIds,
        this.clusterType
      )
    },

    currentClusterBoundaries(): ClusterBoundary[] {
      // Return cluster boundaries for current cluster type
      if (this.clusterType === 'origin') {
        return this.clusterBoundaries.origin
      } else if (this.clusterType === 'destination') {
        return this.clusterBoundaries.destination
      } else {
        return this.clusterBoundaries.spatial
      }
    },

    currentGeometries(): any[] {
      // Filter geometries based on filtered requests
      if (this.filteredRequests.length === this.allRequests.length) {
        return this.requestGeometries
      }

      // Convert to strings to handle type mismatch between CSV (numbers) and GeoJSON (strings)
      const filteredRequestIds = new Set(this.filteredRequests.map((r) => String(r.request_id)))
      const filtered = this.requestGeometries.filter((geom) =>
        filteredRequestIds.has(String(geom.properties.request_id))
      )

      console.log('Filtering geometries:', {
        totalGeometries: this.requestGeometries.length,
        filteredRequests: this.filteredRequests.length,
        filteredRequestIds: Array.from(filteredRequestIds).slice(0, 5),
        sampleGeomId: this.requestGeometries[0]?.properties?.request_id,
        filteredGeometries: filtered.length,
      })

      return filtered
    },

    hasActiveFilters(): boolean {
      return (
        this.selectedClusters.size > 0 ||
        this.selectedTimebins.size > 0 ||
        this.selectedModes.size > 0 ||
        this.selectedRequestIds.size > 0
      )
    },

    // Comparison mode: Show baseline when filters are active AND comparison toggle is ON
    effectiveShowComparison(): boolean {
      return this.showComparison && this.hasActiveFilters
    },
  },

  async mounted() {
    this.isDarkMode = this.$store.state.colorScheme === ColorScheme.DarkMode
    await this.loadData()
  },

  watch: {
    async '$store.state.colorScheme'() {
      this.isDarkMode = this.$store.state.colorScheme === ColorScheme.DarkMode
    },

    showComparison(newVal, oldVal) {
      console.log('Comparison mode changed:', { from: oldVal, to: newVal })
      console.log('Baseline requests:', newVal ? this.allRequests.length : 0)
      console.log('Filtered requests:', this.filteredRequests.length)
    },

    enableScrollOnHover(newVal) {
      console.log('CommuterRequests: enableScrollOnHover changed to:', newVal)
    },
  },

  methods: {
    async loadData() {
      try {
        this.loadingText = 'Loading request data...'

        // Load requests and geometries
        const { requests, geometries } = await loadRequestData(
          this.fileApi,
          this.pluginConfig,
          this.subfolder
        )
        this.allRequests = requests
        this.requestGeometries = geometries

        this.loadingText = 'Loading cluster data...'

        // Load cluster boundaries
        const clusters = await loadClusterData(this.fileApi, this.pluginConfig, this.subfolder)
        this.clusterBoundaries = clusters

        // Apply display settings
        this.clusterType = this.pluginConfig.display.defaultClusterType
        this.colorBy = this.pluginConfig.display.colorBy
        this.showComparison = this.pluginConfig.display.showComparison

        this.loadingText = ''

        console.log('Commuter Requests plugin loaded:', {
          requests: this.allRequests.length,
          geometries: this.requestGeometries.length,
          clusters: {
            origin: this.clusterBoundaries.origin.length,
            destination: this.clusterBoundaries.destination.length,
            spatial: this.clusterBoundaries.spatial.length,
          },
        })
      } catch (error: any) {
        console.error('Error loading commuter requests data:', error)
        this.loadingText = `Error: ${error.message}`
      }
    },

    onClusterClicked(clusterId: string | number) {
      // Toggle cluster selection (click again to deselect)
      if (this.selectedClusters.has(clusterId)) {
        this.selectedClusters.delete(clusterId)
      } else {
        this.selectedClusters.add(clusterId)
      }

      // Trigger reactivity (Sets don't trigger Vue reactivity automatically)
      this.selectedClusters = new Set(this.selectedClusters)

      console.log('Cluster clicked:', clusterId, 'Selected:', Array.from(this.selectedClusters))
    },

    onRequestClicked(requestId: string) {
      console.log('Request clicked:', requestId)
      
      // Toggle request selection (click again to deselect)
      if (this.selectedRequestIds.has(requestId)) {
        this.selectedRequestIds.delete(requestId)
      } else {
        this.selectedRequestIds.add(requestId)
      }

      // Trigger reactivity
      this.selectedRequestIds = new Set(this.selectedRequestIds)
      
      console.log('Selected requests:', Array.from(this.selectedRequestIds))
    },

    onRequestHovered(requestId: string | null) {
      this.hoveredRequestId = requestId
    },

    onRequestSelected(requestId: string) {
      console.log('Request selected from table:', requestId)
      // Future: Highlight on map, zoom to location, etc.
    },

    onTimebinClicked(binLabel: string) {
      // Toggle timebin selection (click again to deselect)
      if (this.selectedTimebins.has(binLabel)) {
        this.selectedTimebins.delete(binLabel)
      } else {
        this.selectedTimebins.add(binLabel)
      }

      // Trigger reactivity
      this.selectedTimebins = new Set(this.selectedTimebins)

      console.log('Timebin clicked:', binLabel, 'Selected:', Array.from(this.selectedTimebins))
    },

    onModeClicked(mode: string) {
      // Toggle mode selection (click again to deselect)
      if (this.selectedModes.has(mode)) {
        this.selectedModes.delete(mode)
      } else {
        this.selectedModes.add(mode)
      }

      // Trigger reactivity
      this.selectedModes = new Set(this.selectedModes)

      console.log('Mode clicked:', mode, 'Selected:', Array.from(this.selectedModes))
    },

    resetFilters() {
      this.selectedClusters = new Set()
      this.selectedTimebins = new Set()
      this.selectedModes = new Set()
      this.selectedRequestIds = new Set()
      this.hoveredRequestId = null
      console.log('Filters reset')
    },

    onComparisonToggle(newValue: boolean) {
      console.log('CommuterRequests.onComparisonToggle received:', newValue)
      console.log('Current showComparison value:', this.showComparison)
      this.showComparison = newValue
      console.log('Updated showComparison value:', this.showComparison)
    },

    onScrollToggle(newValue: boolean) {
      console.log('CommuterRequests.onScrollToggle received:', newValue)
      this.enableScrollOnHover = newValue
      console.log('Updated enableScrollOnHover value:', this.enableScrollOnHover)
    },
  },
})
</script>

<style scoped lang="scss">
.commuter-requests-plugin {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--bgBold);
  overflow: hidden; // Parent doesn't scroll
}

.status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 1.2rem;
  color: var(--text);
}

.dashboard-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; // Important for flex scrolling
  overflow-y: auto; // This container scrolls
  overflow-x: hidden;
}

.controls-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background-color: var(--bgPanel);
  border-bottom: 2px solid var(--borderDim);
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  z-index: 10;

  .stats-summary {
    margin-left: auto;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    background-color: var(--bgCream);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
  }
}

.top-panel {
  display: flex;
  height: 60vh;
  min-height: 400px;
  flex-shrink: 0;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: var(--bgBold);

  .map-section {
    flex: 0 0 70%;
    position: relative;
    background-color: var(--bgPanel);
    border: 1px solid var(--borderDim);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .stats-section {
    flex: 0 0 30%;
    display: flex;
    flex-direction: column;
    background-color: var(--bgBold);
    overflow-y: auto;
    overflow-x: hidden;
  }
}

.table-panel {
  flex: 1;
  min-height: 400px;
  margin: 0.5rem;
  background-color: var(--bgPanel);
  border: 1px solid var(--borderDim);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
