<template lang="pug">
.commuter-requests-plugin
  .status-message(v-if="loadingText") {{ loadingText }}

  .dashboard-container(v-else)
    //- Top panel: Map + Stats
    .top-panel
      //- Map Card
      .dash-card-frame.map-card(:style="getCardStyle('map')")
        .dash-card-headers
          .header-labels
            h3 Requests Map
          .header-buttons
            button.button.is-small.is-white(
              @click="toggleEnlarge('map')"
              :title="enlargedCard === 'map' ? 'Restore' : 'Enlarge'"
            )
              i.fa.fa-expand

        .dash-card
          .map-content
            //- Map controls (cluster type and color-by)
            .map-controls
              cluster-type-selector(
                v-model="clusterType"
                @update:modelValue="onClusterTypeChange"
              )
              color-by-selector(
                v-model="colorByAttribute"
                :options="colorByOptions"
                @update:modelValue="onColorByChange"
              )

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
              :color-by-attribute="colorByAttribute"
              :color-by-config="pluginConfig.colorBy"
              :show-comparison="showComparison"
              :has-active-filters="hasActiveFilters"
              :is-dark-mode="isDarkMode"
              @cluster-clicked="onClusterClicked"
              @clusters-clicked="onClustersClicked"
              @request-clicked="onRequestClicked"
              @request-hovered="onRequestHovered"
            )
            color-legend(
              v-if="colorLegendItems.length > 0 || isNumericColorBy"
              :title="colorLegendTitle"
              :legend-items="colorLegendItems"
              :is-numeric="isNumericColorBy"
              :min-value="numericColorRange.min"
              :max-value="numericColorRange.max"
            )

      //- Stats Cards Container
      .stats-cards-container
        //- Active Time Distribution Card
        .dash-card-frame.stat-card(:style="getCardStyle('time-dist')")
          .dash-card-headers
            .header-labels
              h3 Active Time Distribution
            .header-buttons
              button.button.is-small.is-white(
                @click="toggleEnlarge('time-dist')"
                :title="enlargedCard === 'time-dist' ? 'Restore' : 'Enlarge'"
              )
                i.fa.fa-expand

          .dash-card
            active-time-histogram-plotly(
              :requests="filteredRequests"
              :baseline-requests="effectiveShowComparison ? allRequests : []"
              :selected-bins="selectedTimebins"
              :show-comparison="effectiveShowComparison"
              :is-dark-mode="isDarkMode"
              :is-enlarged="enlargedCard === 'time-dist'"
              @bin-clicked="onTimebinClicked"
            )

        //- Mode Share Card
        .dash-card-frame.stat-card(:style="getCardStyle('mode-share')")
          .dash-card-headers
            .header-labels
              h3 Mode Share
            .header-buttons
              button.button.is-small.is-white(
                @click="toggleEnlarge('mode-share')"
                :title="enlargedCard === 'mode-share' ? 'Restore' : 'Enlarge'"
              )
                i.fa.fa-expand

          .dash-card
            main-mode-pie-chart-plotly(
              :requests="filteredRequests"
              :baseline-requests="effectiveShowComparison ? allRequests : []"
              :selected-modes="selectedModes"
              :show-comparison="effectiveShowComparison"
              :is-dark-mode="isDarkMode"
              :is-enlarged="enlargedCard === 'mode-share'"
              @mode-clicked="onModeClicked"
            )

        //- Summary Statistics Card
        .dash-card-frame.stat-card(:style="getCardStyle('summary')")
          .dash-card-headers
            .header-labels
              h3 Summary Statistics
            .header-buttons
              button.button.is-small.is-white(
                @click="toggleEnlarge('summary')"
                :title="enlargedCard === 'summary' ? 'Restore' : 'Enlarge'"
              )
                i.fa.fa-expand

          .dash-card
            .summary-stats
              .stat-row
                .stat-label Total Requests
                .stat-value {{ filteredRequests.length }}

              .stat-row(v-if="effectiveShowComparison && allRequests.length > 0")
                .stat-label Filtered / Baseline
                .stat-value {{ filteredRequests.length }} / {{ allRequests.length }}

              .stat-row
                .stat-label Unique Modes
                .stat-value {{ uniqueModes }}

              .stat-row
                .stat-label Active Clusters
                .stat-value {{ activeClusters }}

    //- Table Card
    .dash-card-frame.table-card(:style="getCardStyle('table')")
      .dash-card-headers
        .header-labels
          h3 {{ capitalizedTableName }} Table
          p.stats-summary {{ filteredRequests.length }} / {{ allRequests.length }} {{ tableItemsLabel }}
        .header-buttons
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
          button.button.is-small.is-white(
            @click="toggleEnlarge('table')"
            :title="enlargedCard === 'table' ? 'Restore' : 'Enlarge'"
          )
            i.fa.fa-expand

      .dash-card
        request-table(
          :requests="allRequests"
          :filtered-requests="filteredRequests"
          :selected-request-ids="selectedRequestIds"
          :hovered-request-id="hoveredRequestId"
          :enable-scroll-on-hover="enableScrollOnHover"
          :table-config="pluginConfig.table"
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
  ClusterBoundary,
  PluginConfig,
  ColorByAttribute,
} from './CommuterRequestsConfig'

import { loadRequestData, loadClusterData } from './utils/dataLoader'
import { filterRequests } from './utils/filters'

import { FileSystemConfig, ColorScheme } from '@/Globals'
import HTTPFileSystem from '@/js/HTTPFileSystem'
import globalStore from '@/store'

import RequestsMap from './components/RequestsMap.vue'
import ClusterTypeSelector from './components/controls/ClusterTypeSelector.vue'
import ColorBySelector from './components/controls/ColorBySelector.vue'
import FilterResetButton from './components/controls/FilterResetButton.vue'
import ComparisonToggle from './components/controls/ComparisonToggle.vue'
import ScrollToggle from './components/controls/ScrollToggle.vue'
import ColorLegend from './components/ColorLegend.vue'
import ActiveTimeHistogramPlotly from './components/stats/ActiveTimeHistogramPlotly.vue'
import MainModePieChartPlotly from './components/stats/MainModePieChartPlotly.vue'
import RequestTable from './components/RequestTable.vue'

export default defineComponent({
  name: 'CommuterRequests',
  components: {
    RequestsMap,
    ClusterTypeSelector,
    ColorBySelector,
    FilterResetButton,
    ComparisonToggle,
    ScrollToggle,
    ColorLegend,
    ActiveTimeHistogramPlotly,
    MainModePieChartPlotly,
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
      colorByAttribute: 'main_mode' as string,
      isDarkMode: false,
      selectedRequestIds: new Set<string>(), // Track clicked requests for filtering
      hoveredRequestId: null as string | null, // Track hovered request
      enableScrollOnHover: true, // Default to auto-scroll enabled
      enlargedCard: '' as 'map' | 'time-dist' | 'mode-share' | 'summary' | 'table' | '', // Track which card is enlarged
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
      // Default colorBy config
      const defaultColorByConfig = {
        default: 'main_mode',
        attributes: [
          { attribute: 'main_mode', label: 'Transport Mode', type: 'categorical' as const },
          { attribute: 'max_detour', label: 'Max Detour Factor', type: 'numeric' as const },
          { attribute: 'max_cost', label: 'Max Cost', type: 'numeric' as const },
          { attribute: 'travel_time', label: 'Travel Time', type: 'numeric' as const },
          { attribute: 'distance', label: 'Distance', type: 'numeric' as const },
        ],
      }

      // Default config
      const defaultConfig: PluginConfig = {
        files: {
          requestsTable: 'requests.csv',
          requestsGeometry: 'requests_geometries.geojson',
          clusterGeometries: 'cluster_geometries.geojson',
        },
        display: {
          colorBy: 'main_mode',
          defaultClusterType: 'origin',
          showComparison: false,
        },
        colorBy: defaultColorByConfig,
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
            colorBy: parsed.colorBy || defaultConfig.colorBy,
            stats: parsed.stats || defaultConfig.stats,
          }
        } catch (error) {
          console.error('Error parsing YAML config:', error)
          return defaultConfig
        }
      }

      return defaultConfig
    },

    colorByOptions(): ColorByAttribute[] {
      // Return color-by options from config
      return this.pluginConfig.colorBy?.attributes || []
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

    colorLegendTitle(): string {
      const titles: { [key: string]: string } = {
        main_mode: 'Transport Mode',
        max_detour: 'Max Detour',
        max_price: 'Max Price',
        max_cost: 'Max Cost',
        travel_time: 'Travel Time',
        distance: 'Distance',
        start_activity_type: 'Origin Activity',
        end_activity_type: 'Destination Activity',
        origin_cluster: 'Origin Cluster',
        destination_cluster: 'Destination Cluster',
        od_cluster: 'OD Cluster',
        temporal_cluster: 'Temporal Cluster',
        cluster: 'Final Cluster',
      }
      return titles[this.colorByAttribute] || 'Color Scale'
    },

    colorLegendItems(): Array<{ label: string; color: string }> {
      // For categorical attributes (mode, activity types, clusters)
      const categoricalAttributes = [
        'main_mode',
        'start_activity_type',
        'end_activity_type',
        'origin_cluster',
        'destination_cluster',
        'od_cluster',
        'temporal_cluster',
        'cluster',
      ]

      console.log('CommuterRequests.colorLegendItems:', {
        colorByAttribute: this.colorByAttribute,
        isCategorical: categoricalAttributes.includes(this.colorByAttribute),
        filteredRequestsCount: this.filteredRequests.length,
      })

      if (categoricalAttributes.includes(this.colorByAttribute)) {
        const uniqueValues = new Set<string>()
        this.filteredRequests.forEach(r => {
          const value = r[this.colorByAttribute]
          if (value !== undefined && value !== null) {
            uniqueValues.add(String(value))
          }
        })

        console.log('CommuterRequests.colorLegendItems - categorical:', {
          attribute: this.colorByAttribute,
          uniqueValuesCount: uniqueValues.size,
          uniqueValues: Array.from(uniqueValues),
          sampleRequestValue: this.filteredRequests[0]?.[this.colorByAttribute],
        })

        const items = Array.from(uniqueValues)
          .sort((a, b) => {
            // Try to sort numerically if possible, otherwise alphabetically
            const numA = Number(a)
            const numB = Number(b)
            if (!isNaN(numA) && !isNaN(numB)) {
              return numA - numB
            }
            return a.localeCompare(b)
          })
          .map(value => ({
            label: value,
            color: this.getColorForValue(this.colorByAttribute, value),
          }))

        console.log('CommuterRequests.colorLegendItems - result:', {
          itemsCount: items.length,
          items: items.slice(0, 5),
        })

        return items
      }

      console.log('CommuterRequests.colorLegendItems - numeric attribute, returning empty')
      // For numeric attributes - return empty for now (could add gradient scale later)
      return []
    },

    tableItemsLabel(): string {
      // Get table name from config and convert to lowercase plural
      const tableName = this.pluginConfig.table?.name || 'items'
      return tableName.toLowerCase()
    },

    capitalizedTableName(): string {
      // Capitalize first letter of table name
      const tableName = this.pluginConfig.table?.name || 'Items'
      return tableName.charAt(0).toUpperCase() + tableName.slice(1).toLowerCase()
    },

    isNumericColorBy(): boolean {
      // Check if current colorByAttribute is numeric
      const categoricalAttributes = [
        'main_mode',
        'start_activity_type',
        'end_activity_type',
        'origin_cluster',
        'destination_cluster',
        'od_cluster',
        'temporal_cluster',
        'cluster',
      ]
      return !categoricalAttributes.includes(this.colorByAttribute)
    },

    numericColorRange(): { min: number; max: number } {
      // Calculate min/max for numeric attributes from filtered requests
      if (!this.isNumericColorBy || this.filteredRequests.length === 0) {
        return { min: 0, max: 100 }
      }

      const values = this.filteredRequests
        .map(r => r[this.colorByAttribute])
        .filter(v => typeof v === 'number' && !isNaN(v))

      if (values.length === 0) {
        return { min: 0, max: 100 }
      }

      const min = Math.min(...values)
      const max = Math.max(...values)

      return { min, max }
    },

    uniqueModes(): number {
      const modes = new Set<string>()
      for (const request of this.filteredRequests) {
        const mode = request.main_mode || request.mode
        if (mode) modes.add(mode)
      }
      return modes.size
    },

    activeClusters(): number {
      const clusterColumn =
        this.clusterType === 'origin'
          ? 'origin_cluster'
          : this.clusterType === 'destination'
          ? 'destination_cluster'
          : 'od_cluster'

      const clusters = new Set<number>()
      for (const request of this.filteredRequests) {
        const clusterId = request[clusterColumn]
        if (clusterId !== undefined && clusterId !== -1) {
          clusters.add(clusterId)
        }
      }
      return clusters.size
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

    clusterType(newVal, oldVal) {
      console.log('CommuterRequests: clusterType changed:', { from: oldVal, to: newVal })
      console.log('Current cluster boundaries:', this.currentClusterBoundaries.length)
      // Force update of the map by triggering reactivity
      this.$nextTick(() => {
        console.log('Next tick - cluster boundaries updated')
      })
    },

    colorByAttribute(newVal, oldVal) {
      console.log('CommuterRequests: colorByAttribute changed:', { from: oldVal, to: newVal })
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
        const displayColorBy = this.pluginConfig.display.colorBy || 'mode'
        this.colorBy = (displayColorBy === 'mode' || displayColorBy === 'activity' || displayColorBy === 'detour')
          ? displayColorBy
          : 'mode'
        this.colorByAttribute = this.pluginConfig.colorBy?.default || 'main_mode'
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

    onClustersClicked(clusterIds: (string | number)[]) {
      // Toggle selection for all clusters in the array
      // If any are already selected, deselect all. Otherwise, select all.
      const allSelected = clusterIds.every(id => this.selectedClusters.has(id))

      if (allSelected) {
        // Deselect all
        clusterIds.forEach(id => this.selectedClusters.delete(id))
      } else {
        // Select all
        clusterIds.forEach(id => this.selectedClusters.add(id))
      }

      // Trigger reactivity
      this.selectedClusters = new Set(this.selectedClusters)

      console.log('Multiple clusters clicked:', clusterIds, 'Selected:', Array.from(this.selectedClusters))
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

    onClusterTypeChange(newValue: 'origin' | 'destination' | 'spatial') {
      console.log('CommuterRequests.onClusterTypeChange received:', newValue)
      this.clusterType = newValue
      console.log('Updated clusterType value:', this.clusterType)
    },

    onColorByChange(newValue: string) {
      console.log('CommuterRequests.onColorByChange received:', newValue)
      this.colorByAttribute = newValue
      console.log('Updated colorByAttribute value:', this.colorByAttribute)
    },

    getColorForValue(attribute: string, value: any): string {
      if (attribute === 'main_mode') {
        const modeColors: { [key: string]: string } = {
          car: '#e74c3c',
          pt: '#3498db',
          bike: '#2ecc71',
          walk: '#f39c12',
          drt: '#9b59b6',
          ride: '#1abc9c',
        }
        return modeColors[value] || '#95a5a6'
      }

      if (attribute === 'start_activity_type' || attribute === 'end_activity_type') {
        const activityColors: { [key: string]: string } = {
          home: '#4477ff',
          work: '#ff4477',
          education: '#44ff77',
          shopping: '#ff7744',
          leisure: '#aa44ff',
          other: '#777777',
        }
        return activityColors[value] || '#999999'
      }

      // Cluster coloring
      if (['origin_cluster', 'destination_cluster', 'od_cluster', 'temporal_cluster', 'cluster'].includes(attribute)) {
        return this.getClusterColorHex(value)
      }

      return '#999999'
    },

    getClusterColorHex(clusterId: any): string {
      // Simple hash-based color generation for clusters
      if (clusterId === undefined || clusterId === null) {
        return '#808080'
      }

      const hash = String(clusterId).split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc)
      }, 0)

      const hue = Math.abs(hash % 360)
      const [r, g, b] = this.hslToRgbHelper(hue / 360, 0.7, 0.5)

      // Convert RGB to hex
      const toHex = (n: number) => {
        const hex = Math.round(n).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      }

      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    },

    hslToRgbHelper(h: number, s: number, l: number): [number, number, number] {
      let r, g, b

      if (s === 0) {
        r = g = b = l
      } else {
        const hue2rgb = (p: number, q: number, t: number) => {
          if (t < 0) t += 1
          if (t > 1) t -= 1
          if (t < 1/6) return p + (q - p) * 6 * t
          if (t < 1/2) return q
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
          return p
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1/3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1/3)
      }

      return [r * 255, g * 255, b * 255]
    },

    toggleEnlarge(cardId: 'map' | 'time-dist' | 'mode-share' | 'summary' | 'table') {
      // Toggle fullscreen for the specified card
      if (this.enlargedCard === cardId) {
        this.enlargedCard = ''
      } else {
        this.enlargedCard = cardId
      }
    },

    getCardStyle(cardId: 'map' | 'time-dist' | 'mode-share' | 'summary' | 'table'): any {
      // Similar to SimWrapper's dashboard card styling
      let style: any = {}

      if (this.enlargedCard) {
        if (this.enlargedCard !== cardId) {
          // Hide other cards when one is enlarged
          style.display = 'none'
        } else {
          // Make enlarged card fullscreen
          style = {
            position: 'fixed',
            inset: '0 0 0 0',
            margin: '0',
            zIndex: 1000,
            width: '100%',
            height: '100%',
          }
        }
      }

      return style
    },
  },
})
</script>

<style scoped lang="scss">
@import '@/styles.scss';

$cardSpacing: 0.5rem;

.commuter-requests-plugin {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--bgBold);
  overflow: hidden;
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
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem 0.5rem;
  gap: $cardSpacing;
}

// ===== DASHBOARD CARD STYLING (SimWrapper style) =====

.dash-card-frame {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-rows: auto auto 1fr;
  background-color: var(--bgCardFrame);
  padding: 2px 3px 3px 3px;
  border-radius: 4px;
  overflow: hidden;

  .dash-card-headers {
    display: flex;
    flex-direction: row;
    line-height: 1.2rem;
    padding: 3px 3px 2px 3px;

    .header-labels {
      flex: 1;

      h3 {
        font-size: 1.1rem;
        line-height: 1.5rem;
        margin-bottom: 0.5rem;
        color: var(--link);
      }

      p {
        margin-top: -0.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        color: var(--textFaded);
      }
    }

    .header-buttons {
      display: flex;
      flex-direction: row;
      margin-left: auto;
      gap: 0.25rem;
      align-items: flex-start;

      button {
        background-color: #00000000;
        color: var(--link);
        opacity: 0.5;
        border: none;
        cursor: pointer;

        &:hover {
          background-color: #ffffff20;
          opacity: 1;
        }
      }
    }
  }

  .dash-card {
    grid-row: 3 / 4;
    overflow: hidden;
    border-radius: 2px;
    display: flex;
    flex-direction: column;
  }
}

// ===== TOP PANEL (Map + Stats) =====

.top-panel {
  display: flex;
  flex-direction: row;
  height: 60vh;
  min-height: 400px;
  max-height: 60vh; // Prevent overflow beyond allocated height
  gap: $cardSpacing;

  .map-card {
    flex: 1 1 70%;
    min-width: 0;
  }

  .stats-cards-container {
    flex: 1 1 30%;
    min-width: 0;
    max-height: 100%; // Constrain to parent height
    overflow-y: auto; // Allow scrolling if content overflows
  }

  // Mobile responsive layout
  @media (max-width: 800px) {
    flex-direction: column;
    height: auto;

    .map-card,
    .stats-card {
      flex: none;
      height: 50vh;
      min-height: 300px;
    }
  }
}

// ===== TABLE CARD =====

.table-card {
  flex: 1;
  min-height: 400px;

  .dash-card {
    overflow-y: auto;
  }

  @media (max-width: 800px) {
    min-height: 300px;
  }
}

// ===== MAP CONTROLS =====

.map-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background-color: var(--bgPanel);
  border-bottom: 2px solid var(--borderDim);
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  z-index: 100;
  flex-wrap: wrap;

  @media (max-width: 800px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    padding: 0.75rem;
  }
}

// ===== STATS CARDS CONTAINER (continued) =====

.stats-cards-container {
  // Layout already defined in .top-panel scope above
  display: flex;
  flex-direction: column;
  gap: $cardSpacing;

  .stat-card {
    flex: 1;
    min-height: 200px; // Reduced to fit better in constrained space

    .dash-card {
      overflow-y: auto;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  }

  @media (max-width: 800px) {
    flex: none;
    max-height: none; // Remove height constraint on mobile
    overflow-y: visible;

    .stat-card {
      flex: none;
      height: auto;
      min-height: 350px;
    }
  }
}

// ===== MAP CONTENT =====

.map-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

// ===== SUMMARY STATISTICS =====

.summary-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background-color: var(--bgPanel2);
    border-radius: 4px;

    .stat-label {
      font-size: 0.9rem;
      color: var(--textFaded);
      font-weight: 500;
    }

    .stat-value {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--link);
    }
  }
}

// ===== STATS SUMMARY (in table header) =====

.stats-summary {
  margin-top: -0.25rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--textFaded);
}
</style>
