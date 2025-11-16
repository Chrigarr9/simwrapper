<template lang="pug">
.commuter-clustering(:id="containerId")

  //- Loading state
  .status-blob(v-if="loadingText")
    p {{ loadingText }}

  //- Main content (after loading)
  template(v-else)

    //- Top section: Map (75%) + Panels (25%)
    .top-section

      //- Map container
      .map-container
        requests-map(
          :requests="filteredRequests"
          :clusters="selectedClusterBoundaries"
          :time-range="timeRange"
          :color-by="colorBy"
          :show-boundaries="showBoundaries"
          :show-centroids="showCentroids"
          :show-flows="showFlows"
          :map-settings="vizConfig ? vizConfig.mapSettings : {}"
          :mode-colors="vizConfig ? vizConfig.modeColors : {}"
          :activity-colors="vizConfig ? vizConfig.activityColors : {}"
          :selected-request-id="selectedRequestId"
          @request-selected="onRequestSelected"
          @cluster-selected="onClusterSelected"
          @time-changed="onTimeChanged"
          @color-changed="onColorChanged"
        )

      //- Side panels
      .panels-container

        //- Cluster selector panel
        cluster-panel(
          :cluster-type="clusterType"
          :clusters="availableClusters"
          :selected-cluster="selectedCluster"
          :request-counts="clusterRequestCounts"
          @type-changed="onClusterTypeChanged"
          @cluster-selected="onClusterSelected"
        )

        //- Statistics panel
        stats-panel(
          :requests="filteredRequests"
          :baseline="allRequests"
          :show-comparison="selectedCluster !== null"
          :mode-colors="vizConfig ? vizConfig.modeColors : {}"
          :activity-colors="vizConfig ? vizConfig.activityColors : {}"
        )

    //- Bottom section: Request table
    .table-section
      request-table(
        :requests="filteredRequests"
        :selected-id="selectedRequestId"
        @row-selected="onRequestSelected"
      )

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import YAML from 'yaml'

import RequestsMap from './components/RequestsMap.vue'
import ClusterPanel from './components/ClusterPanel.vue'
import StatsPanel from './components/StatsPanel.vue'
import RequestTable from './components/RequestTable.vue'

import {
  loadRequestData,
  loadClusterData,
  loadClusterStatistics,
} from './utils/dataLoader'
import { filterByTimeRange, createTimeBins } from './utils/timeFilter'
import { filterByCluster, getClusterIds, getClusterRequestCounts } from './utils/clusterFilter'

import type {
  CommuterClusteringConfig,
  Request,
  ClusterData,
  ClusterStatistics,
  ClusterType,
  ColorByMode,
} from './CommuterClusteringConfig'

import HTTPFileSystem from '@/js/HTTPFileSystem'
import globalStore from '@/store'

export default defineComponent({
  name: 'CommuterClustering',
  components: {
    RequestsMap,
    ClusterPanel,
    StatsPanel,
    RequestTable,
  },
  props: {
    root: { type: String, required: true },
    subfolder: { type: String, required: true },
    yamlConfig: { type: String, required: false, default: '' },
    config: { type: Object as PropType<CommuterClusteringConfig>, required: false },
    thumbnail: { type: Boolean, default: false },
  },
  data() {
    return {
      // Loading state
      loadingText: 'Loading configuration...' as string,

      // Parsed configuration
      vizConfig: null as CommuterClusteringConfig | null,

      // Data
      allRequests: [] as Request[],
      clusters: {
        origin: [],
        destination: [],
        spatial: [],
      } as ClusterData,
      clusterStats: [] as ClusterStatistics[],

      // Filters
      clusterType: 'spatial' as ClusterType | null,
      selectedCluster: null as number | string | null,
      timeRange: [0, 86400] as [number, number],  // Full day in seconds
      selectedRequestId: null as string | number | null,

      // Display settings
      colorBy: 'mode' as ColorByMode,
      showBoundaries: true,
      showCentroids: false,
      showFlows: false,

      // Container ID
      containerId: `commuter-clustering-${Math.random().toString(36).substr(2, 9)}`,
    }
  },
  computed: {
    /**
     * Get file system configuration from store
     */
    fileSystem(): any {
      const svnProject = this.$store.state.svnProjects.filter(
        (a: any) => a.slug === this.root
      )
      if (svnProject.length === 0) {
        console.log('no such project')
        throw Error('Project not found')
      }
      return svnProject[0]
    },

    /**
     * Create file API instance
     */
    fileApi(): any {
      return new HTTPFileSystem(this.fileSystem, globalStore)
    },

    /**
     * Filtered requests based on time range and cluster selection
     */
    filteredRequests(): Request[] {
      let filtered = this.allRequests

      // Filter by time range
      filtered = filterByTimeRange(filtered, this.timeRange)

      // Filter by selected cluster (only if cluster type is set)
      if (this.selectedCluster !== null && this.clusterType !== null) {
        filtered = filterByCluster(filtered, this.selectedCluster, this.clusterType)
      }

      return filtered
    },

    /**
     * Cluster boundaries for selected cluster type
     */
    selectedClusterBoundaries(): any[] {
      if (this.clusterType === null) return []
      return this.clusters[this.clusterType] || []
    },

    /**
     * Available cluster IDs for current cluster type
     */
    availableClusters(): Array<number | string> {
      if (this.clusterType === null) return []
      return getClusterIds(this.allRequests, this.clusterType)
    },

    /**
     * Request counts per cluster
     */
    clusterRequestCounts(): Map<number | string, number> {
      if (this.clusterType === null) return new Map()
      return getClusterRequestCounts(this.allRequests, this.clusterType)
    },
  },
  async mounted() {
    await this.getVizConfig()
    if (this.vizConfig) {
      await this.loadData()
    }
  },
  methods: {
    /**
     * Get visualization configuration (either from prop or by parsing YAML)
     */
    async getVizConfig() {
      try {
        if (this.config) {
          // Config provided as prop (embedded in dashboard)
          this.vizConfig = this.config
        } else {
          // Parse YAML file
          this.loadingText = 'Loading configuration...'
          const filename = this.yamlConfig.indexOf('/') > -1
            ? this.yamlConfig
            : this.subfolder + '/' + this.yamlConfig

          const text = await this.fileApi.getFileText(filename)
          this.vizConfig = YAML.parse(text) as CommuterClusteringConfig
        }
      } catch (error) {
        console.error('Error loading config:', error)
        this.loadingText = `Error loading configuration: ${error}`
        this.$emit('error', '' + error)
      }
    },

    /**
     * Load all data files
     */
    async loadData() {
      if (!this.vizConfig) {
        this.loadingText = 'Error: No configuration loaded'
        return
      }

      try {
        this.loadingText = 'Loading request data...'

        // Load request data
        this.allRequests = await loadRequestData(
          this.fileApi,
          this.subfolder,
          this.vizConfig.files.requestsTable
        )

        this.loadingText = 'Loading cluster data...'

        // Load cluster boundaries
        this.clusters = await loadClusterData(
          this.fileApi,
          this.subfolder,
          this.vizConfig.files
        )

        this.loadingText = 'Loading cluster statistics...'

        // Load cluster statistics
        this.clusterStats = await loadClusterStatistics(
          this.fileApi,
          this.subfolder,
          this.vizConfig.files.clusterStats
        )

        // Initialize display settings from config
        this.colorBy = this.vizConfig.defaultColorBy || 'mode'
        this.clusterType = this.vizConfig.defaultClusterType || 'spatial'

        if (this.vizConfig.layers) {
          this.showBoundaries = this.vizConfig.layers.showBoundaries ?? true
          this.showCentroids = this.vizConfig.layers.showCentroids ?? false
          this.showFlows = this.vizConfig.layers.showFlows ?? false
        }

        // Set initial time range (full day)
        if (this.allRequests.length > 0) {
          const times = this.allRequests.map((r: any) => r.treq).filter((t: any) => t != null)
          if (times.length > 0) {
            this.timeRange = [Math.min(...times), Math.max(...times)]
          }
        }

        this.loadingText = ''
      } catch (error) {
        console.error('Error loading data:', error)
        this.loadingText = `Error loading data: ${error}`
      }
    },

    /**
     * Handle cluster type change (origin/destination/spatial/null)
     */
    onClusterTypeChanged(type: ClusterType | null) {
      this.clusterType = type
      this.selectedCluster = null  // Reset selection when changing type
    },

    /**
     * Handle cluster selection
     */
    onClusterSelected(clusterId: number | null) {
      this.selectedCluster = clusterId
    },

    /**
     * Handle request selection (from map or table)
     */
    onRequestSelected(requestId: string) {
      this.selectedRequestId = requestId
    },

    /**
     * Handle time range change
     */
    onTimeChanged(range: [number, number]) {
      this.timeRange = range
    },

    /**
     * Handle color-by mode change
     */
    onColorChanged(colorBy: ColorByMode) {
      this.colorBy = colorBy
    },
  },
})
</script>

<style scoped lang="scss">
.commuter-clustering {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background-color: var(--bgBold);
  overflow: hidden;
}

.status-blob {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100%;
  background-color: var(--bgBold);

  p {
    font-size: 1.5rem;
    color: var(--text);
  }
}

.top-section {
  display: flex;
  height: 75%;
  gap: 0.5rem;
  padding: 0.5rem;
}

.map-container {
  flex: 3;
  position: relative;
  background-color: var(--bgCream);
  border-radius: 4px;
  overflow: hidden;
}

.panels-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  min-width: 250px;
  max-width: 400px;
}

.table-section {
  height: 25%;
  border-top: 2px solid var(--borderColor);
  overflow: hidden;
  background-color: var(--bgCream);
}

// Responsive adjustments
@media (max-width: 1200px) {
  .top-section {
    flex-direction: column;
    height: 60%;
  }

  .panels-container {
    max-width: none;
    flex-direction: row;
    overflow-x: auto;
  }

  .table-section {
    height: 40%;
  }
}
</style>
