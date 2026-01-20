<template lang="pug">
.dashboard(:class="{wiide, 'is-panel-narrow': isPanelNarrow, 'is-fullscreen-dashboard': isFullScreenDashboard }" :id="viewId")
  .dashboard-content(:class="{wiide, 'is-fullscreen-dashboard': isFullScreenDashboard}" :style="dashWidthCalculator")

    .dashboard-header.flex-row(v-if="!fullScreenCardId && (title + description)"
      :class="{wiide, 'is-panel-narrow': isPanelNarrow}"
    )
      .dtitles.flex1
        h2 {{ title }}
        p {{ description }}
      .favstar
        p.favorite-icon(title="Favorite"
          :class="{'is-favorite': isFavorite}"
          @click="clickedFavorite"
        ): i.fa.fa-star

    .tabs.is-centered(v-if="subtabs.length")
      ul.tab-row
        li.tab-entry(v-for="subtab,index of subtabs" :key="index"
          :class="{'is-active': index===activeTab, 'is-not-active': index!==activeTab}"
          :style="{opacity: index===activeTab ? 1.0 : 0.55}"
        )
          b: a(@click="switchTab(index)") {{ subtab.title }}

    //- start row here
    .dash-row(v-for="row,i in rows" :key="i"
      :class="getRowClass(row)"
      :style="{'flex': rowFlexWeights[i] || 1}"
    )

      //- each card here
      .dash-card-frame(
        v-for="card,j in row.cards"
        :key="`${i}/${j}`"
        :style="getCardStyle(card)"
        :class="{wiide, 'is-panel-narrow': isPanelNarrow, 'is-fullscreen-card': fullScreenCardId === card.id}"
      )
          //- card header/title
          .dash-card-headers(v-if="card.title + card.description" :class="{'fullscreen': !!fullScreenCardId}")
            .header-labels(:style="{paddingLeft: card.type=='text' ? '4px' : ''}")
              h3 {{ card.title }}
              p(v-if="card.description") {{ card.description }}

            //- zoom button
            .header-buttons
              button.button.is-small.is-white(
                v-if="card.info"
                @click="handleToggleInfoClick(card)"
                :title="infoToggle[card.id] ? 'Hide Info':'Show Info'"
              )
                i.fa.fa-info-circle

              button.button.is-small.is-white(
                @click="toggleZoom(card)"
                :title="fullScreenCardId === card.id ? 'Restore':'Enlarge'"
              )
                i.fa(:class="fullScreenCardId === card.id ? 'fa-compress' : 'fa-expand'")

          //- info contents
          .info(v-show="infoToggle[card.id]")
            p
            p {{ card.info }}

          //- card contents
          .spinner-box(v-if="getCardComponent(card)"
            :id="card.id"
            :class="{'is-loaded': card.isLoaded}"
          )
            //- NEW: Wrap cards that have linkage (only if managers are initialized)
            //- Also wrap map cards that have layers with linkage
            //- Data-table cards always have linkage
            linkable-card-wrapper(v-if="(card.linkage || hasLayerLinkage(card) || card.type === 'data-table') && filterManager && linkageManager && dataTableManager"
              :card="card"
              :filter-manager="filterManager"
              :linkage-manager="linkageManager"
              :data-table-manager="dataTableManager"
            )
              template(v-slot="{ filteredData, hoveredIds, selectedIds, handleFilter, handleHover, handleSelect }")
                //- Key changes on fullscreen toggle to force remount (fixes WebGL context loss for MapCard)
                component.dash-card(v-if="card.visible"
                  :is="getCardComponent(card)"
                  :key="card.id"
                  :class="{'is-data-table': card.type === 'data-table'}"
                  :fileSystemConfig="fileSystemConfig"
                  :subfolder="row.subtabFolder || xsubfolder"
                  :files="fileList"
                  :yaml="(card.props && card.props.configFile) || ''"
                  :config="card.props"
                  :datamanager="datamanager"
                  :split="split"
                  :style="{opacity: opacity[card.id]}"
                  :cardId="card.id"
                  :cardTitle="card.title"
                  :allConfigFiles="allConfigFiles"
                  :column="card.column"
                  :bin-size="card.binSize"
                  :title="card.title"
                  :x-column="card.xColumn"
                  :y-column="card.yColumn"
                  :color-column="card.colorColumn"
                  :size-column="card.sizeColumn"
                  :marker-size="card.markerSize"
                  :id-column="yaml.table?.idColumn"
                  :filtered-data="filteredData"
                  :hovered-ids="hoveredIds"
                  :selected-ids="selectedIds"
                  :linkage="card.linkage"
                  :layers="getCardLayers(card)"
                  :center="card.center"
                  :zoom="card.zoom"
                  :map-style="card.mapStyle"
                  :legend="card.legend"
                  :tooltip="card.tooltip"
                  :geometry-type="geometryType"
                  :color-by-attribute="colorByAttribute"
                  :map-controls-config="yaml.map?.controls"
                  :geometry-type-options="geometryTypeOptions"
                  :color-by-options="colorByOptions"
                  :layer-strategy="layerStrategy"
                  :table-config="yaml.table"
                  :data-table-manager="dataTableManager"
                  :filter-manager="filterManager"
                  :linkage-manager="linkageManager"
                  @update:geometry-type="geometryType = $event"
                  @update:color-by-attribute="colorByAttribute = $event"
                  @filter="handleFilter"
                  @hover="handleHover"
                  @select="handleSelect"
                  @isLoaded="handleCardIsLoaded(card)"
                  @dimension-resizer="setDimensionResizer"
                  @titles="setCardTitles(card, $event)"
                  @error="setCardError(card, $event)"
                )

            //- Standard rendering for cards without linkage
            //- Key changes on fullscreen toggle to force remount (fixes WebGL context loss for MapCard)
            component.dash-card(v-else-if="card.visible"
              :is="getCardComponent(card)"
              :key="card.id"
              :fileSystemConfig="fileSystemConfig"
              :subfolder="row.subtabFolder || xsubfolder"
              :files="fileList"
              :yaml="(card.props && card.props.configFile) || ''"
              :config="card.props"
              :datamanager="datamanager"
              :split="split"
              :style="{opacity: opacity[card.id]}"
              :cardId="card.id"
              :cardTitle="card.title"
              :allConfigFiles="allConfigFiles"
              :column="card.column"
              :bin-size="card.binSize"
              :title="card.title"
              :x-column="card.xColumn"
              :y-column="card.yColumn"
              :color-column="card.colorColumn"
              :size-column="card.sizeColumn"
              :marker-size="card.markerSize"
              :id-column="yaml.table?.idColumn"
              :layers="getCardLayers(card)"
              :center="card.center"
              :zoom="card.zoom"
              :map-style="card.mapStyle"
              :legend="card.legend"
              :tooltip="card.tooltip"
              :geometry-type="geometryType"
              :color-by-attribute="colorByAttribute"
              :map-controls-config="yaml.map?.controls"
              :geometry-type-options="geometryTypeOptions"
              :color-by-options="colorByOptions"
              :layer-strategy="layerStrategy"
              @update:geometry-type="geometryType = $event"
              @update:color-by-attribute="colorByAttribute = $event"
              @isLoaded="handleCardIsLoaded(card)"
              @dimension-resizer="setDimensionResizer"
              @titles="setCardTitles(card, $event)"
              @error="setCardError(card, $event)"
            )
            .error-text(v-if="card.errors.length")
              span.clear-error(@click="card.errors=[]") &times;
              p(v-for="err,i in card.errors" :key="i") {{ err }}

    //- Data Table (if visible in config AND not placed in layout) - styled as a dashboard card
    //- When table.position === 'layout', the table is rendered via a data-table card in the layout
    .dash-row(v-if="yaml.table && yaml.table.visible && yaml.table.position !== 'layout' && dataTableManager" :style="tableFullScreen ? tableFullScreenStyle : {}")
      .dash-card-frame.table-card-frame(
        :class="{wiide, 'is-panel-narrow': isPanelNarrow, 'is-fullscreen': tableFullScreen}"
      )
        //- card header/title
        .dash-card-headers
          .header-labels
            h3 {{ yaml.table.name || 'Data Table' }}
            p(v-if="yaml.table.description") {{ yaml.table.description }}
          .header-buttons
            //- Auto-scroll toggle
            label.scroll-toggle(title="Auto-scroll to hovered row")
              input(type="checkbox" v-model="enableScrollOnHover")
              span.scroll-label Scroll

            //- Filter reset button
            button.button.is-small.is-white(
              v-if="filterManager && filterManager.hasActiveFilters()"
              @click="handleClearAllFilters"
              title="Clear all filters"
            )
              i.fa.fa-times-circle
              span.reset-label  Reset

            //- Fullscreen toggle
            button.button.is-small.is-white(
              @click="toggleTableFullScreen"
              :title="tableFullScreen ? 'Restore' : 'Enlarge'"
            )
              i.fa(:class="tableFullScreen ? 'fa-compress' : 'fa-expand'")

        //- table contents
        .table-wrapper(ref="tableWrapper")
          table.data-table
            thead
              tr
                th(
                  v-for="col in visibleColumns"
                  :key="col"
                  @click="sortByColumn(col)"
                  :class="{ sortable: true, sorted: sortColumn === col }"
                )
                  .header-cell
                    span {{ col }}
                    span.sort-icon(v-if="sortColumn === col") {{ sortDirection === 'asc' ? '↑' : '↓' }}
            tbody
              tr(
                v-for="(row, idx) in sortedDisplayData"
                :key="getRowId(row)"
                :data-row-id="getRowId(row)"
                :class="getRowClasses(row)"
                @mouseenter="handleTableRowHover(row)"
                @mouseleave="handleTableRowLeave"
                @click="handleTableRowClick(row)"
              )
                td(v-for="col in visibleColumns" :key="col") {{ formatCellValue(row[col], col) }}

    //- NEW: Sub-Dashboards Section (shown when parent has selection)
    .sub-dashboards-section(v-if="yaml.subDashboards?.length && parentSelectedValue && !embedded")
      sub-dashboard(
        v-for="(subConfig, idx) in yaml.subDashboards"
        :key="`sub-${idx}-${parentSelectedValue}`"
        :config="subConfig"
        :parent-filter-column="subConfig.table?.linkColumn || 'trial_id'"
        :parent-filter-value="parentSelectedValue"
        :all-data="subDashboardData[subConfig.table?.dataset] || []"
        :file-system-config="fileSystemConfig"
        :subfolder="xsubfolder"
        :root="root"
        :all-config-files="allConfigFiles"
        :datamanager="datamanager"
        :split="split"
        :initial-collapsed="false"
      )

    //- Legacy: Linked Tables Section (simpler table+map pairs)
    .linked-tables-section(v-if="linkedTableManagers.length > 0 && tableSelectedIds.size > 0 && !yaml.subDashboards?.length")
      linked-table-card(
        v-for="(manager, idx) in linkedTableManagers"
        :key="idx"
        :title="getLinkedTableConfig(idx).name || 'Linked Table'"
        :table-manager="manager"
        :id-column="manager.getIdColumn()"
        :columns="getLinkedTableConfig(idx).columns"
        :map-config="getLinkedTableConfig(idx).map"
        :file-system-config="fileSystemConfig"
        :subfolder="xsubfolder"
        :initial-collapsed="false"
      )

</template>

<script lang="ts">
import Vue, { defineComponent } from 'vue'
import type { PropType } from 'vue'

import YAML from 'yaml'

import globalStore from '@/store'
import { sleep } from '@/js/util'

import { FavoriteLocation, FileSystemConfig, Status, YamlConfigs } from '@/Globals'
import HTTPFileSystem from '@/js/HTTPFileSystem'

import TopSheet from '@/components/TopSheet/TopSheet.vue'
// import charts, { plotlyCharts } from '@/dash-panels/_allPanels'

import { panelLookup } from '@/dash-panels/_allPanels'
import DashboardDataManager from '@/js/DashboardDataManager'

// NEW: Import coordination managers and wrapper component
import { FilterManager } from './managers/FilterManager'
import { LinkageManager } from './managers/LinkageManager'
import { DataTableManager } from './managers/DataTableManager'
import { LinkedTableManager } from './managers/LinkedTableManager'
import { StyleManager, initializeTheme } from './managers/StyleManager'
import { debugLog } from './utils/debug'
import LinkableCardWrapper from './components/cards/LinkableCardWrapper.vue'
import LinkedTableCard from './components/cards/LinkedTableCard.vue'
import SubDashboard from './components/cards/SubDashboard.vue'
import DataTableCard from './components/cards/DataTableCard.vue'
// FullscreenPortal removed - using simpler CSS position:fixed approach

// append a prefix so the html template is legal
const namedCharts = {} as any
const chartTypes = Object.keys(panelLookup)
// const plotlyChartTypes = {} as any

chartTypes.forEach((key: any) => {
  namedCharts[`card-${key}`] = panelLookup[key] // key // charts[key] as any
  // //@ts-ignore
  // if (plotlyCharts[key]) plotlyChartTypes[key] = true
})

export default defineComponent({
  name: 'InteractiveDashboard',
  components: Object.assign({ TopSheet, LinkableCardWrapper, DataTableCard, LinkedTableCard, SubDashboard }, namedCharts),
  props: {
    root: { type: String, required: true },
    xsubfolder: { type: String, required: true },
    allConfigFiles: { type: Object as PropType<YamlConfigs>, required: true },
    datamanager: { type: Object as PropType<DashboardDataManager>, required: true },
    split: { type: Object, required: true }, // {y,x}
    gist: Object as any,
    config: Object as any,
    zoomed: Boolean,
    // NEW: Props for embedded sub-dashboard usage
    embedded: { type: Boolean, default: false },  // True when used as a sub-dashboard
    embeddedYaml: { type: Object, default: null },  // YAML config when embedded
    parentFilterColumn: { type: String, default: '' },  // Column to filter by (e.g., 'trial_id')
    parentFilterValue: { type: String, default: '' },   // Value to filter for
    preloadedData: { type: Object, default: null },     // Pre-loaded datasets { 'file.csv': [...] }
  },
  data: () => {
    return {
      title: '',
      description: '',
      viewId: 'dashboard-' + Math.floor(1e12 * Math.random()),
      yaml: {} as any,
      rows: [] as { id: string; cards: any[]; subtabFolder?: string }[],
      fileList: [] as string[],
      fileSystemConfig: {} as FileSystemConfig,
      fullScreenCardId: '',
      resizers: {} as { [id: string]: any },
      infoToggle: {} as { [id: string]: boolean },
      isDestroying: false,
      isFullScreenDashboard: false,
      isResizing: false,
      opacity: {} as any,
      narrowPanelObserver: null as ResizeObserver | null,
      isPanelNarrow: false,
      numberOfShownCards: 1,
      // subtab state:
      subtabs: [] as any[],
      activeTab: 0,
      dashboardTabWithDelay: -1,
      showFooter: false,
      rowFlexWeights: [] as number[],
      // NEW: Coordination layer managers
      filterManager: null as FilterManager | null,
      linkageManager: null as LinkageManager | null,
      dataTableManager: null as DataTableManager | null,
      linkedTableManagers: [] as LinkedTableManager[],
      // NEW: Sub-dashboard data (pre-loaded for SubDashboard components)
      subDashboardData: {} as Record<string, any[]>,
      // Selected value from parent table (used to filter sub-dashboards)
      parentSelectedValue: null as string | null,
      filterVersion: 0, // Increment this when filters change to trigger reactivity
      // Table interaction state
      tableHoveredIds: new Set<any>() as Set<any>,
      tableSelectedIds: new Set<any>() as Set<any>,
      // Table features
      sortColumn: '' as string,
      sortDirection: 'asc' as 'asc' | 'desc',
      enableScrollOnHover: true,
      isHoverFromTable: false,
      tableFullScreen: false,
      // Map controls
      geometryType: 'all' as string,  // 'origin', 'destination', 'all', or custom values
      colorByAttribute: '' as string,  // Will be initialized from YAML default
      // Layer coloring strategy (from YAML map.colorBy.layerStrategy)
      layerStrategy: 'auto' as 'auto' | 'explicit' | 'all',
    }
  },

  computed: {
    dashWidthCalculator(): any {
      if (this.$store.state.dashboardWidth && this.$store.state.isFullWidth) {
        return { maxWidth: this.$store.state.dashboardWidth }
      }
      return {}
    },
    wiide(): boolean {
      return this.$store.state.isFullWidth
    },
    fileApi(): HTTPFileSystem {
      return new HTTPFileSystem(this.fileSystemConfig)
    },
    isFavorite(): any {
      let key = this.root
      if (this.xsubfolder) key += `/${this.xsubfolder}`
      if (key.endsWith('/')) key = key.substring(0, key.length - 1)

      const indexOfPathInFavorites = globalStore.state.favoriteLocations.findIndex(
        f => key == f.fullPath
      )
      return indexOfPathInFavorites > -1
    },
    
    // NEW: Table data computed properties
    displayData(): any[] {
      if (!this.dataTableManager) return []
      // Access filterVersion to make this computed property reactive to filter changes
      const _version = this.filterVersion
      return this.dataTableManager.getData()
    },

    // Get filtered row IDs for highlighting
    filteredRowIds(): Set<any> {
      if (!this.filterManager || !this.displayData.length) return new Set()
      const filtered = this.filterManager.applyFilters(this.displayData)
      const idColumn = this.yaml.table?.idColumn || 'id'
      return new Set(filtered.map(row => row[idColumn]))
    },

    // Sort and arrange data: filtered rows on top, then unfiltered
    sortedDisplayData(): any[] {
      if (!this.displayData.length) return []

      const hasFilters = this.filterManager && this.filterManager.hasActiveFilters()
      const idColumn = this.yaml.table?.idColumn || 'id'

      // Separate filtered and unfiltered rows
      let filtered: any[] = []
      let unfiltered: any[] = []

      if (hasFilters) {
        for (const row of this.displayData) {
          if (this.filteredRowIds.has(row[idColumn])) {
            filtered.push(row)
          } else {
            unfiltered.push(row)
          }
        }
      } else {
        // No filters - all rows go to filtered (will be sorted together)
        filtered = [...this.displayData]
      }

      // Sort function
      const sortFn = (a: any, b: any) => {
        if (!this.sortColumn) return 0

        const aVal = a[this.sortColumn]
        const bVal = b[this.sortColumn]

        if (aVal === undefined || aVal === null) return 1
        if (bVal === undefined || bVal === null) return -1

        let comparison = 0
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal
        } else {
          comparison = String(aVal).localeCompare(String(bVal))
        }

        return this.sortDirection === 'asc' ? comparison : -comparison
      }

      // Sort each group
      filtered.sort(sortFn)
      unfiltered.sort(sortFn)

      // Filtered on top, then unfiltered
      return [...filtered, ...unfiltered]
    },

    visibleColumns(): string[] {
      if (!this.dataTableManager || this.displayData.length === 0) return []
      const allColumns = Object.keys(this.displayData[0])
      const hiddenColumns = this.yaml.table?.columns?.hide || []
      return allColumns.filter(col => !hiddenColumns.includes(col))
    },

    tableFullScreenStyle(): any {
      return {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '9999',
        margin: '0',
        padding: '1rem',
        backgroundColor: 'var(--bgBold)',
      }
    },

    // Map control options from YAML
    geometryTypeOptions(): Array<{ value: string; label: string }> {
      return this.yaml.map?.geometryTypes || [
        { value: 'all', label: 'All Geometries' },
        { value: 'origin', label: 'Origin' },
        { value: 'destination', label: 'Destination' },
      ]
    },

    colorByOptions(): Array<{ attribute: string; label: string; type: 'categorical' | 'numeric' }> {
      return this.yaml.map?.colorBy?.attributes || []
    },
  },

  watch: {
    async '$store.state.resizeEvents'() {
      await this.$nextTick()
      this.resizeAllCards()
    },
    '$store.state.locale'() {
      this.updateThemeAndLabels()
    },
    // Scroll to row when hover comes from map (not from table itself)
    tableHoveredIds(newVal: Set<any>) {
      if (newVal.size === 0) return
      if (!this.enableScrollOnHover) return
      if (this.isHoverFromTable) return

      // Get the first hovered ID
      const hoveredId = Array.from(newVal)[0]
      this.$nextTick(() => {
        const tableWrapper = this.$refs.tableWrapper as HTMLElement
        if (!tableWrapper) return

        const row = tableWrapper.querySelector(`tr[data-row-id="${hoveredId}"]`) as HTMLElement
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    },
  },

  methods: {
    // NEW: Format table cell values based on column config
    formatCellValue(value: any, column: string): string {
      if (value === null || value === undefined) return ''
      
      const format = this.yaml.table?.columns?.formats?.[column]
      if (!format) return String(value)
      
      // Handle different format types
      if (format.type === 'time') {
        // Convert seconds to time string
        const seconds = format.convertFrom === 'seconds' ? value : value
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      }
      
      if (format.type === 'duration') {
        const value_in_unit = format.convertFrom === 'seconds' ? value / 60 : value
        return `${value_in_unit.toFixed(format.decimals || 1)} ${format.unit || 'min'}`
      }
      
      if (format.type === 'distance') {
        const value_in_unit = format.convertFrom === 'meters' ? value / 1000 : value
        return `${value_in_unit.toFixed(format.decimals || 2)} ${format.unit || 'km'}`
      }
      
      if (format.type === 'decimal') {
        return Number(value).toFixed(format.decimals || 2)
      }
      
      return String(value)
    },

    // Check if a card has any layers with linkage defined
    hasLayerLinkage(card: any): boolean {
      return card.layers?.some((layer: any) => layer.linkage) || false
    },

    // Get layers for a card, filtering by geometry type if applicable
    // NOTE: colorBy is NOT applied here - MapCard handles colorBy based on computed layer roles
    // from LayerColoringManager. This ensures neutral layers skip colorBy coloring.
    getCardLayers(card: any): any[] {
      if (!card.layers) return []

      // Filter layers based on geometry type selector
      // Layers can specify which geometry types they belong to via `geometryType` property
      return card.layers.filter((layer: any) => {
        // If geometry type is 'all', include all layers
        if (this.geometryType === 'all') return true
        // If layer doesn't specify geometryType, always include it
        if (!layer.geometryType) return true
        // If layer specifies geometryType, only include if it matches current selection
        return layer.geometryType === this.geometryType
      })
      // Note: Previous implementation applied colorBy here, but that's now handled
      // in MapCard.vue's getBaseColor() using LayerColoringManager for role-aware coloring
    },

    // Table row interaction methods
    getRowId(row: any): any {
      const idColumn = this.yaml.table?.idColumn || 'id'
      return row[idColumn]
    },

    // Loose comparison helper for Set membership (handles string "45" vs number 45)
    setHasLoose(set: Set<any>, value: any): boolean {
      if (set.has(value)) return true
      for (const item of set) {
        // eslint-disable-next-line eqeqeq
        if (item == value) return true
      }
      return false
    },

    isRowHovered(row: any): boolean {
      const rowId = this.getRowId(row)
      return this.setHasLoose(this.tableHoveredIds, rowId)
    },

    isRowSelected(row: any): boolean {
      const rowId = this.getRowId(row)
      return this.setHasLoose(this.tableSelectedIds, rowId)
    },

    handleTableRowHover(row: any) {
      // Mark that hover originated from table to prevent scroll feedback loop
      this.isHoverFromTable = true
      const rowId = this.getRowId(row)
      if (this.linkageManager) {
        this.linkageManager.setHoveredIds(new Set([rowId]))
      }
      // Reset flag after a short delay
      setTimeout(() => {
        this.isHoverFromTable = false
      }, 100)
    },

    handleTableRowLeave() {
      if (this.linkageManager) {
        this.linkageManager.setHoveredIds(new Set())
      }
    },

    // Check if row is in filtered set (for highlighting)
    isRowFiltered(row: any): boolean {
      const rowId = this.getRowId(row)
      return this.setHasLoose(this.filteredRowIds, rowId)
    },

    // Get row CSS classes
    getRowClasses(row: any): Record<string, boolean> {
      const hasFilters = this.filterManager && this.filterManager.hasActiveFilters()
      return {
        'is-hovered': this.isRowHovered(row),
        'is-selected': this.isRowSelected(row),
        'is-filtered': hasFilters && this.isRowFiltered(row),
        'is-dimmed': hasFilters && !this.isRowFiltered(row),
      }
    },

    // Sort by column
    sortByColumn(column: string) {
      if (this.sortColumn === column) {
        // Toggle direction if same column clicked
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
      } else {
        // Switch to new column, default to ascending
        this.sortColumn = column
        this.sortDirection = 'asc'
      }
    },

    // Toggle table fullscreen
    toggleTableFullScreen() {
      this.tableFullScreen = !this.tableFullScreen
    },

    handleTableRowClick(row: any) {
      const rowId = this.getRowId(row)
      console.log('[InteractiveDashboard] Row clicked, rowId:', rowId, 'row:', row)
      
      if (this.linkageManager) {
        this.linkageManager.toggleSelectedIds(new Set([rowId]))
      }
      
      // NEW: Update parent selected value for sub-dashboards
      // If clicking the same row again, deselect it
      if (this.parentSelectedValue === String(rowId)) {
        this.parentSelectedValue = null
      } else {
        this.parentSelectedValue = String(rowId)
      }
      console.log('[InteractiveDashboard] Parent selection updated:', this.parentSelectedValue)
      console.log('[InteractiveDashboard] subDashboards count:', this.yaml.subDashboards?.length || 0)
      console.log('[InteractiveDashboard] subDashboardData:', Object.keys(this.subDashboardData))
      debugLog('[InteractiveDashboard] Parent selection:', this.parentSelectedValue)
      
      // Legacy: Update linked tables when parent selection changes
      this.handleParentTableSelect(this.tableSelectedIds)
    },

    // NEW: Get linked table config from YAML by index
    getLinkedTableConfig(index: number): any {
      if (!this.yaml.linkedTables || index >= this.yaml.linkedTables.length) {
        return {}
      }
      return this.yaml.linkedTables[index]
    },

    handleClearAllFilters() {
      if (this.filterManager) {
        this.filterManager.clearAllFilters()
      }
      if (this.linkageManager) {
        this.linkageManager.setSelectedIds(new Set())
      }
    },

    clickedFavorite() {
      let hint = `${this.root}/${this.xsubfolder}`
      let finalFolder = this.xsubfolder || this.root
      // remove current folder from subfolder
      const lastSlash = hint.lastIndexOf('/')
      if (lastSlash > -1) {
        finalFolder = hint.substring(lastSlash + 1)
        hint = hint.substring(0, lastSlash)
      }

      let fullPath = `${this.root}/${this.xsubfolder}`
      if (fullPath.endsWith('/')) fullPath = fullPath.substring(0, fullPath.length - 1)

      const favorite: FavoriteLocation = {
        root: this.root,
        subfolder: this.xsubfolder,
        label: finalFolder,
        fullPath,
        hint,
      }

      this.$store.commit(this.isFavorite ? 'removeFavorite' : 'addFavorite', favorite)
    },

    /**
     * This only gets triggered when a topsheet has some titles.
     * Remove the dashboard titles and use the ones from the topsheet.
     */
    setCardTitles(card: any, event: any) {
      if (!card || !event) return

      if ('string' == typeof event) {
        card.title = event
        card.description = ''
      } else {
        if (event.title) card.title = event.title
        if (event.description) card.description = event.description
      }
    },

    setCardError(card: any, event: any) {
      // blank event: clear all errors for this card
      if (!event) {
        card.errors = []
        return
      }

      if (typeof event === 'string' && event) {
        // simple string error message
        card.errors.push(event)
      } else if (event.msg && event.type === Status.ERROR) {
        // status object: ignore warnings for now
        card.errors.push(event.msg)
      }
    },

    resizeAllCards() {
      this.isResizing = true
      for (const row of this.rows) {
        for (const card of row.cards) {
          this.updateDimensions(card.id)
        }
      }
      this.isResizing = false
    },

    handleToggleInfoClick(card: any) {
      this.infoToggle[card.id] = !this.infoToggle[card.id]
    },

    async getFiles() {
      const folderContents = await this.fileApi.getDirectory(this.xsubfolder)

      // hide dot folders
      const files = folderContents.files.filter(f => !f.startsWith('.')).sort()
      return files
    },

    getCardComponent(card: any) {
      // debugLog(1, card)
      // Data table card - uses the centralized DataTableManager
      if (card.type === 'data-table') {
        return 'DataTableCard'
      }

      // TopSheet requires a config file - don't render if missing
      if (card.type === 'table' || card.type === 'topsheet') {
        const hasConfigFile = card.props && card.props.configFile
        if (!hasConfigFile) {
          console.warn(`TopSheet card "${card.title}" missing configFile, skipping render`)
          return undefined
        }
        return 'TopSheet'
      }

      // load the plugin
      if (panelLookup[card.type]) {
        return panelLookup[card.type]
      }

      // might be a chart
      if (chartTypes.indexOf(card.type) > -1) return 'card-' + card.type

      // or might be a vue component? TODO check matrix viewer
      card.title = card.type ? `Unknown panel type "${card.type}"` : `Error: panel "type" not set`
      return undefined // card.type
    },

    setDimensionResizer(options: { id: string; resizer: any }) {
      this.resizers[options.id] = options.resizer
      this.updateDimensions(options.id)
    },

    async toggleZoom(card: any) {
      if (this.fullScreenCardId) {
        this.fullScreenCardId = ''
      } else {
        this.fullScreenCardId = card.id
      }
      this.$emit('zoom', this.fullScreenCardId)
      // allow vue to resize everything
      await this.$nextTick()
      // tell plotly to resize everything
      this.updateDimensions(card.id)
    },

    updateDimensions(cardId: string) {
      const element = document.getElementById(cardId)

      if (element) {
        const dimensions = { width: element.clientWidth, height: element.clientHeight }
        if (this.resizers[cardId]) this.resizers[cardId](dimensions)
      }
      if (!this.isResizing) globalStore.commit('resize')
    },

    getCardStyle(card: any) {
      // figure out height. If card has registered a resizer with changeDimensions(),
      // then it needs a default height (300)

      // markdown does not want a default height
      const defaultHeight = card.type === 'text' ? undefined : 300

      const height = card.height ? card.height * 60 : defaultHeight
      const flex = card.width || 1

      let style: any = { flex: flex }

      if (card.backgroundColor || card.background) {
        style.backgroundColor = card.backgroundColor || card.background
      }

      if (height && !this.isFullScreenDashboard) {
        style.minHeight = `${height}px`
        style.maxHeight = `${height}px`
        style.height = `${height}px`
      }

      // if there is only a single card on this panel, shrink its margin
      if (this.rows.length == 1 && this.rows[0].cards.length == 1) {
        style.margin = '0.25rem 0.25rem'
      }

      // Fullscreen mode: use position fixed to cover entire viewport
      if (this.fullScreenCardId) {
        if (this.fullScreenCardId !== card.id) {
          style.display = 'none'
        } else {
          // Use position:fixed to cover entire viewport
          // This works now that contain:layout is removed from SubDashboard
          style = {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            zIndex: '10000',
            margin: '0',
            padding: '1rem',
            backgroundColor: 'var(--dashboard-bg-primary, var(--bgBold, #1a1a2e))',
            maxHeight: 'none',
            height: 'auto',
          }
        }
      }

      return style
    },

    getFileSystem(name: string): FileSystemConfig {
      const svnProject: FileSystemConfig[] = this.$store.state.svnProjects.filter(
        (a: FileSystemConfig) => a.slug === name
      )
      if (svnProject.length === 0) throw Error('no such project')
      return svnProject[0]
    },

    getTabTitle(index: number) {
      let title = `Tab ${index + 1}`
      let tab = this.subtabs[index]

      if (this.$store.state.locale === 'de') {
        title = tab.subtab_de || tab.subtab || tab.subtab_en
      } else {
        title = tab.subtab_en || tab.subtab || tab.subtab_de
      }
      return title
    },

    async switchTab(index: number) {
      if (index === this.activeTab) return

      // Force teardown the dashboard to ensure we start with a clean slate
      this.dashboardTabWithDelay = -1
      this.showFooter = false

      await this.$nextTick()

      this.activeTab = index
      this.rows = []
      this.rowFlexWeights = []

      // to give browser time to teardown: 0.2 seconds delay
      setTimeout(() => {
        this.dashboardTabWithDelay = index
        const { subtab, ...queryWithoutSubtab } = this.$route.query
        if (index) {
          this.$router.replace({
            query: Object.assign({}, queryWithoutSubtab, { subtab: `${index + 1}` }),
          })
        } else {
          this.$router.replace({ query: {} })
        }
        this.selectTabLayout()
      }, 200)
    },

    async setupDashboard() {
      const instanceId = Math.random().toString(36).substring(7)
      console.log(`[InteractiveDashboard:${instanceId}] setupDashboard starting, embedded: ${this.embedded}`)
      
      // Do we have config already or do we need to fetch it from the yaml file?
      if (this.embedded && this.embeddedYaml) {
        // NEW: Embedded mode - use provided YAML config directly
        this.yaml = this.embeddedYaml
        console.log(`[InteractiveDashboard:${instanceId}] Embedded mode with YAML:`, this.yaml.header?.title || 'Sub-Dashboard')
        console.log(`[InteractiveDashboard:${instanceId}] Embedded YAML full:`, JSON.stringify(this.yaml, null, 2))
      } else if (this.config) {
        this.yaml = this.config
      } else if (this.gist) {
        this.yaml = this.gist
      } else {
        const yaml = await this.fileApi.getFileText(`${this.xsubfolder}/dashboard.yaml`)
        this.yaml = YAML.parse(yaml)
      }

      // NEW: Initialize coordination layer immediately after loading YAML
      // This ensures managers are available when cards are created
      await this.initializeCoordinationLayer()

      // Initialize map control defaults from YAML
      if (this.yaml.map?.colorBy?.default) {
        this.colorByAttribute = this.yaml.map.colorBy.default
      } else if (this.yaml.map?.colorBy?.attributes?.length > 0) {
        this.colorByAttribute = this.yaml.map.colorBy.attributes[0].attribute
      }
      if (this.yaml.map?.geometryTypes?.length > 0) {
        // Default to first geometry type if 'all' is not in the options
        const hasAll = this.yaml.map.geometryTypes.some((gt: any) => gt.value === 'all')
        this.geometryType = hasAll ? 'all' : this.yaml.map.geometryTypes[0].value
      }
      // Initialize layer strategy from YAML (default: 'auto')
      if (this.yaml.map?.colorBy?.layerStrategy) {
        const strategy = this.yaml.map.colorBy.layerStrategy
        if (strategy === 'auto' || strategy === 'explicit' || strategy === 'all') {
          this.layerStrategy = strategy
        }
      }

      // set header
      this.updateThemeAndLabels()

      // if there are subtabs, prepare them
      if (this.yaml.subtabs) this.subtabs = await this.setupSubtabs()

      this.setFullScreen()

      // // Start on correct subtab
      if (this.$route.query.subtab) {
        try {
          const userSupplied = parseInt('' + this.$route.query.subtab) - 1
          this.activeTab = userSupplied || 0
        } catch (e) {
          // user spam; just use first tab
          this.activeTab = 0
        }
      } else {
        this.activeTab = 0
      }

      this.dashboardTabWithDelay = this.activeTab
      this.selectTabLayout()
    },

    async setupSubtabs() {
      // YAML definition of subtabs can be:
      // 1) false/missing: no subtabs.
      // 2) true: convert each row property of the layout to a subtab
      // 3) array of dashboard*.yaml filenames: each subtab will contain the
      //     imported dashboard contents
      // 4) array[] of row IDs that comprise each subtab, so you can combine rows as you wish
      //
      //    subtabs:
      //    - title: 'Tab1'
      //      rows: ['modeshare','statistics']
      //
      // this.subtabs will then hold an array with the title and layout object for each subtab.

      let i = 1
      const subtabs = [] as any

      // "TRUE": convert each layout row to a subtab ------------------
      if (this.yaml.subtabs === true) {
        // One subtab per layout object.
        const allRowKeys = new Set(Object.keys(this.yaml.layout))
        for (const rowKey of allRowKeys) {
          subtabs.push({ title: rowKey, layout: this.yaml.layout[rowKey] })
        }
        return subtabs
      }

      // Not an array? Fail. -----------------------------------------------------
      if (!Array.isArray(this.yaml.subtabs)) {
        console.warn('SUBTABS: Not an array', this.yaml.subtabs)
        return []
      }

      // "Array of filepaths": load each dashboard as a subtab --------------
      if (typeof this.yaml.subtabs[0] == 'string') {
        this.yaml.layout = []
        for (const filename of this.yaml.subtabs) {
          // get full path to the dashboard file
          const fullpath = `${this.xsubfolder}/${filename}`
          // also get the working directory of that dashboard file
          const subtabWorkingDirectory = fullpath.substring(0, fullpath.lastIndexOf('/'))

          try {
            const raw = await this.fileApi.getFileText(fullpath)
            const dashContent = YAML.parse(raw)
            const subtab = {
              title: dashContent.header.tab || dashContent.header.title || filename,
              description: dashContent.description,
              layout: dashContent.layout,
              subtabFolder: subtabWorkingDirectory,
            } as any
            subtabs.push(subtab)
          } catch (e) {
            console.error('' + e)
          }
        }
        return subtabs
      }

      // "Array of Objects": Each element is a layout object ------------
      const allRowKeys = new Set(Object.keys(this.yaml.layout))
      for (const tab of this.yaml.subtabs) {
        subtabs.push({
          title: this.getObjectLabel(tab, 'title'),
          layout: tab.rows.map((rowName: string) => {
            allRowKeys.delete(rowName)
            return this.yaml.layout[rowName]
          }),
        })
      }
      for (const leftoverKey of allRowKeys) {
        // if user missed any rows, add them at the end
        subtabs.push({ title: leftoverKey, layout: this.yaml.layout[leftoverKey] })
      }

      return subtabs
    },

    selectTabLayout() {
      // Choose subtab or full layout
      console.log('[InteractiveDashboard] selectTabLayout called')
      console.log('[InteractiveDashboard] subtabs:', this.subtabs.length, 'activeTab:', this.activeTab)
      console.log('[InteractiveDashboard] yaml.layout:', this.yaml.layout)

      if (this.subtabs.length && this.activeTab > -1) {
        const subtab = this.subtabs[this.activeTab]
        console.log('[InteractiveDashboard] Using subtab layout:', subtab.title)
        this.setupRows(subtab.layout, subtab.subtabFolder)
      } else if (this.yaml.layout) {
        console.log('[InteractiveDashboard] Using main layout')
        this.setupRows(this.yaml.layout)
      } else {
        console.error('[InteractiveDashboard] No layout found in YAML!')
        this.$store.commit(
          'error',
          `Dashboard YAML: could not find current subtab ${this.activeTab}`
        )
      }
    },

    setupRows(layout: any, subtabFolder?: string) {
      console.log('[InteractiveDashboard] setupRows called with layout:', layout)
      console.log('[InteractiveDashboard] layout keys:', layout ? Object.keys(layout) : 'null')
      console.log('[InteractiveDashboard] embedded mode:', this.embedded, 'title:', this.yaml?.header?.title)
      console.log('[InteractiveDashboard] current rows before setup:', this.rows.length)
      let numCard = 1

      for (const rowId of Object.keys(layout)) {
        let cards: any[] = layout[rowId]

        // row must be an array - if it isn't, assume it is an array of length one
        if (!cards.forEach) cards = [cards]

        let flexWeight = 1

        cards.forEach(card => {
          card.id = `card-id-${numCard}`
          card.isLoaded = false
          card.number = numCard

          // hoist flex weight if card has "height" and we are full-screen
          try {
            if (this.isFullScreenDashboard && card.height) {
              flexWeight = Math.max(flexWeight, card.height)
            }
          } catch (e) {
            console.error('' + e)
            this.$emit('error', 'Dashboard YAML: non-numeric height')
            flexWeight = 1
          }

          // make YAML easier to write: merge "props" property with other properties
          // so user doesn't need to specify "props: {...}"
          if (!card.props) card.props = Object.assign({}, card)
          // markdown plugin really wants to know the height
          if (card.height !== undefined) card.props.height = card.height

          // Vue 2 is weird about new properties: use Vue.set() instead
          Vue.set(this.opacity, card.id, 0.5)
          Vue.set(this.infoToggle, card.id, false)
          Vue.set(card, 'errors', [] as string[])
          Vue.set(card, 'visible', false)

          // Card header could be hidden
          if (!card.title && !card.description) card.showHeader = false
          else card.showHeader = true

          numCard++
        })

        this.rows.push({ id: rowId, cards, subtabFolder })
        this.rowFlexWeights.push(flexWeight)
      }
      this.slowRollTheCardAppearances()
    },

    async slowRollTheCardAppearances() {
      for (const row of this.rows) {
        for (const card of row.cards) {
          // cancel if user ditches the page
          if (this.isDestroying) return

          card.visible = true
          await this.$nextTick()
          await sleep(200)
        }
      }
      this.$emit('layoutComplete')
    },

    updateThemeAndLabels() {
      this.title = this.getDashboardLabel('title')
      this.description = this.getDashboardLabel('description')

      if (this.yaml.header.theme) {
        this.$store.commit('setTheme', this.yaml.header.theme)
      }
    },

    getObjectLabel(o: any, prefix: string) {
      let label = prefix

      if (this.$store.state.locale === 'de') {
        label = o[`${prefix}_de`] || o[`${prefix}`] || o[`${prefix}_en`] || ''
      } else {
        label = o[`${prefix}_en`] || o[`${prefix}`] || o[`${prefix}_de`] || ''
      }

      return label
    },

    getDashboardLabel(element: 'title' | 'description') {
      const header = this.yaml.header
      let tag = '...'

      if (this.$store.state.locale === 'de') {
        tag = header[`${element}_de`] || header[`${element}`] || header[`${element}_en`] || ''
      } else {
        tag = header[`${element}_en`] || header[`${element}`] || header[`${element}_de`] || ''
      }

      return tag
    },

    async handleCardIsLoaded(card: any) {
      card.isLoaded = true
      this.opacity[card.id] = 1.0
      this.numberOfShownCards++
    },

    setupNarrowPanelObserver() {
      const dashboard = document.getElementById(this.viewId) as HTMLElement
      this.narrowPanelObserver = new ResizeObserver(this.handleResize)
      this.narrowPanelObserver.observe(dashboard)
    },

    handleResize() {
      const dashboard = document.getElementById(this.viewId) as HTMLElement
      if (dashboard) this.isPanelNarrow = dashboard.clientWidth < 800
      this.setFullScreen()
      this.$store.commit('resize')
    },

    setFullScreen() {
      if (this.isPanelNarrow) {
        // Narrow panels are never fullscreen
        this.isFullScreenDashboard = false
      } else {
        // help user with capitalization
        this.isFullScreenDashboard =
          this.yaml.header.fullScreen ||
          this.yaml.header.fillScreen ||
          this.yaml.header.fullscreen ||
          this.yaml.header.fillscreen
      }
    },

    getRowClass(row: any) {
      const rowClass = {
        'is-panel-narrow': this.isPanelNarrow,
        'is-fullscreen-dashboard': this.isFullScreenDashboard,
      } as any
      rowClass[`row-${row.id}`] = true
      return rowClass
    },

    // NEW: Initialize coordination managers and load centralized data
    async initializeCoordinationLayer() {
      /**
       * Initialize dashboard theme (injects CSS variables into :root).
       * This must happen before dashboard content renders to ensure
       * --dashboard-* CSS variables are available to all child components.
       *
       * CSS variables injected:
       * - --dashboard-bg-primary, --dashboard-bg-secondary, --dashboard-bg-tertiary
       * - --dashboard-text-primary, --dashboard-text-secondary
       * - --dashboard-border-default, --dashboard-border-subtle
       * - --dashboard-interaction-hover, --dashboard-interaction-selected
       * - --dashboard-cluster-origin, --dashboard-cluster-destination
       * - --dashboard-chart-bar, --dashboard-chart-bar-selected, --dashboard-chart-grid
       * - --dashboard-categorical-0 through --dashboard-categorical-14
       *
       * Theme state is synced with Vuex store (globalStore.state.colorScheme).
       */
      initializeTheme()

      /**
       * Dashboard YAML color configuration:
       *
       * colors:
       *   clusters:
       *     origin: "#2563eb"       # Hex color for origin clusters
       *     destination: "#dc2626"  # Hex color for destination clusters
       *
       * If not specified, colorblind-safe defaults are used.
       */
      if (this.yaml?.colors?.clusters) {
        const { origin, destination } = this.yaml.colors.clusters
        StyleManager.getInstance().setClusterColors({ origin, destination })
        debugLog('[InteractiveDashboard] Applied YAML cluster colors:', { origin, destination })
      }

      this.filterManager = new FilterManager()
      this.linkageManager = new LinkageManager()

      // Add observer to increment filterVersion when filters change (triggers table reactivity)
      this.filterManager.addObserver({
        onFilterChange: () => {
          this.filterVersion++
          debugLog('[InteractiveDashboard] Filters changed, version:', this.filterVersion)
        }
      })

      // Add observer for linkage manager to update table hover/select state
      this.linkageManager.addObserver({
        onHoveredIdsChange: (ids: Set<any>) => {
          this.tableHoveredIds = new Set(ids)
        },
        onSelectedIdsChange: (ids: Set<any>) => {
          this.tableSelectedIds = new Set(ids)
          
          // UPDATE: Also set parentSelectedValue for sub-dashboards
          // When a single row is selected, use it as the parent filter value
          if (ids.size === 1) {
            const selectedId = Array.from(ids)[0]
            this.parentSelectedValue = String(selectedId)
            console.log('[InteractiveDashboard] parentSelectedValue updated from linkage:', this.parentSelectedValue)
          } else if (ids.size === 0) {
            this.parentSelectedValue = null
            console.log('[InteractiveDashboard] parentSelectedValue cleared (no selection)')
          }
          // If multiple rows selected, keep the first one for sub-dashboard filtering
          // (or could clear it - depending on UX preference)
        }
      })

      // Check if table config exists in YAML
      if (!this.yaml.table) {
        console.warn('[InteractiveDashboard] No table configuration found in YAML')
        return
      }

      // Initialize DataTableManager with config from YAML
      const tableConfig = {
        name: this.yaml.table.name || 'centralizedData',
        dataset: this.yaml.table.dataset || '',
        idColumn: this.yaml.table.idColumn || 'id',
        visible: this.yaml.table.visible !== false,
        columns: this.yaml.table.columns || {},
      }
      
      debugLog('[InteractiveDashboard] Initializing DataTableManager with config:', tableConfig)
      this.dataTableManager = new DataTableManager(tableConfig)

      // Load centralized data
      if (tableConfig.dataset) {
        try {
          // NEW: Check if we have preloaded data for this dataset
          if (this.preloadedData && this.preloadedData[tableConfig.dataset]) {
            let data = this.preloadedData[tableConfig.dataset]
            
            // Apply parent filter if in embedded mode
            if (this.embedded && this.parentFilterColumn && this.parentFilterValue) {
              console.log('[InteractiveDashboard] Embedded mode: filtering by', this.parentFilterColumn, '=', this.parentFilterValue)
              data = data.filter((row: any) => String(row[this.parentFilterColumn]) === String(this.parentFilterValue))
              console.log('[InteractiveDashboard] Filtered data count:', data.length)
            }
            
            this.dataTableManager.setData(data)
            debugLog('[InteractiveDashboard] Using preloaded data:', data.length, 'rows')
          } else {
            debugLog('[InteractiveDashboard] Loading dataset:', tableConfig.dataset)
            await this.dataTableManager.loadData(this.fileApi, this.xsubfolder)
            debugLog('[InteractiveDashboard] Data loaded successfully')
          }
        } catch (e) {
          console.error('[InteractiveDashboard] Failed to load centralized data:', e)
          this.$emit('error', `Failed to load data: ${e}`)
        }
      }

      // NEW: Initialize linked tables if configured
      await this.initializeLinkedTables()

      // NEW: Initialize sub-dashboards if configured
      await this.initializeSubDashboards()
    },

    // NEW: Initialize sub-dashboards - resolve file references and load their data
    async initializeSubDashboards() {
      console.log('[InteractiveDashboard] initializeSubDashboards called')
      console.log('[InteractiveDashboard] yaml.subDashboards:', this.yaml.subDashboards)
      
      if (!this.yaml.subDashboards || !Array.isArray(this.yaml.subDashboards)) {
        console.log('[InteractiveDashboard] No subDashboards configuration found')
        debugLog('[InteractiveDashboard] No subDashboards configuration found')
        return
      }
      
      console.log('[InteractiveDashboard] Found', this.yaml.subDashboards.length, 'subDashboards')

      // First pass: resolve file references
      const resolvedSubDashboards: any[] = []
      for (let i = 0; i < this.yaml.subDashboards.length; i++) {
        const subConfig = this.yaml.subDashboards[i]
        
        if (subConfig.file) {
          // Load sub-dashboard from external YAML file
          try {
            const resolvedConfig = await this.loadSubDashboardFile(subConfig.file, subConfig)
            if (resolvedConfig) {
              resolvedSubDashboards.push(resolvedConfig)
            }
          } catch (e) {
            console.error('[InteractiveDashboard] Failed to load sub-dashboard file:', subConfig.file, e)
          }
        } else {
          // Inline sub-dashboard config
          resolvedSubDashboards.push(subConfig)
        }
      }
      
      // Replace with resolved configs
      this.yaml.subDashboards = resolvedSubDashboards
      console.log('[InteractiveDashboard] Resolved', resolvedSubDashboards.length, 'subDashboards')

      // Second pass: load data for each sub-dashboard
      for (const subConfig of this.yaml.subDashboards) {
        const dataset = subConfig.table?.dataset
        console.log('[InteractiveDashboard] Processing subDashboard:', subConfig.title, 'dataset:', dataset)
        
        if (!dataset) {
          console.warn('[InteractiveDashboard] SubDashboard missing table.dataset:', subConfig.title)
          continue
        }

        // Skip if already loaded (multiple sub-dashboards might share the same dataset)
        if (this.subDashboardData[dataset]) {
          console.log('[InteractiveDashboard] Dataset already loaded:', dataset)
          debugLog('[InteractiveDashboard] Dataset already loaded:', dataset)
          continue
        }

        try {
          console.log('[InteractiveDashboard] Loading sub-dashboard dataset:', dataset)
          debugLog('[InteractiveDashboard] Loading sub-dashboard dataset:', dataset)
          const filePath = `${this.xsubfolder}/${dataset}`
          console.log('[InteractiveDashboard] Full file path:', filePath)
          const text = await this.fileApi.getFileText(filePath)
          
          // Parse CSV
          const lines = text.trim().split('\n')
          const headers = lines[0].split(',')
          const data: any[] = []
          
          for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i])
            if (values.length !== headers.length) continue
            
            const row: any = {}
            headers.forEach((header, idx) => {
              const val = values[idx]
              // Try to convert to number if possible
              const num = Number(val)
              row[header.trim()] = isNaN(num) || val === '' ? val : num
            })
            data.push(row)
          }
          
          this.subDashboardData[dataset] = data
          console.log('[InteractiveDashboard] Sub-dashboard dataset loaded:', dataset, data.length, 'rows')
          debugLog('[InteractiveDashboard] Sub-dashboard dataset loaded:', dataset, data.length, 'rows')
        } catch (e) {
          console.error('[InteractiveDashboard] Failed to load sub-dashboard dataset:', dataset, e)
          this.subDashboardData[dataset] = []
        }
      }
      
      console.log('[InteractiveDashboard] Final subDashboardData keys:', Object.keys(this.subDashboardData))
    },

    // NEW: Load sub-dashboard config from external YAML file
    async loadSubDashboardFile(filename: string, overrides: any): Promise<any> {
      console.log('[InteractiveDashboard] Loading sub-dashboard file:', filename)
      
      try {
        // Load the YAML file (relative to current dashboard folder)
        const filePath = `${this.xsubfolder}/${filename}`
        const yamlText = await this.fileApi.getFileText(filePath)
        const fileConfig = YAML.parse(yamlText)
        
        console.log('[InteractiveDashboard] Loaded sub-dashboard file:', filename, 'title:', fileConfig.header?.title || fileConfig.title)
        
        // Build the sub-dashboard config from the file
        // Use header.title or header.tab as the title, or fall back to filename
        const baseConfig = {
          title: fileConfig.header?.title || fileConfig.header?.tab || filename.replace('.yaml', ''),
          table: fileConfig.table,
          layout: fileConfig.layout,
          map: fileConfig.map,
        }
        
        // Deep merge with overrides (overrides take precedence)
        const mergedConfig = this.deepMerge(baseConfig, overrides)
        
        // Remove the 'file' property from the merged config
        delete mergedConfig.file
        
        console.log('[InteractiveDashboard] Merged sub-dashboard config:', mergedConfig.title)
        return mergedConfig
      } catch (e) {
        console.error('[InteractiveDashboard] Failed to load sub-dashboard file:', filename, e)
        return null
      }
    },

    // Helper: Deep merge two objects (target properties override source)
    deepMerge(source: any, target: any): any {
      if (!target || typeof target !== 'object') return source
      if (!source || typeof source !== 'object') return target
      
      const result = { ...source }
      
      for (const key of Object.keys(target)) {
        if (key === 'file') continue // Skip 'file' property
        
        if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          // Recursively merge objects
          result[key] = this.deepMerge(source[key] || {}, target[key])
        } else if (target[key] !== undefined) {
          // Override with target value
          result[key] = target[key]
        }
      }
      
      return result
    },

    // Helper to parse CSV line (handles quoted values with commas)
    parseCSVLine(line: string): string[] {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    },

    // NEW: Initialize secondary linked tables
    async initializeLinkedTables() {
      if (!this.yaml.linkedTables || !Array.isArray(this.yaml.linkedTables)) {
        debugLog('[InteractiveDashboard] No linkedTables configuration found')
        return
      }

      const parentIdColumn = this.yaml.table?.idColumn || 'id'

      for (const linkedConfig of this.yaml.linkedTables) {
        try {
          const config = {
            name: linkedConfig.name || linkedConfig.dataset,
            dataset: linkedConfig.dataset,
            idColumn: linkedConfig.idColumn || 'id',
            linkColumn: linkedConfig.linkColumn || parentIdColumn,
            visible: linkedConfig.visible !== false,
            columns: linkedConfig.columns || {},
          }

          debugLog('[InteractiveDashboard] Initializing LinkedTableManager:', config.name)
          const manager = new LinkedTableManager(config)
          await manager.loadData(this.fileApi, this.xsubfolder)
          
          this.linkedTableManagers.push(manager)
          debugLog('[InteractiveDashboard] Linked table loaded:', config.name, manager.getAllData().length, 'rows')
        } catch (e) {
          console.error('[InteractiveDashboard] Failed to load linked table:', linkedConfig.name, e)
        }
      }
    },

    // NEW: Handle parent table selection to filter linked tables
    handleParentTableSelect(selectedIds: Set<any>) {
      debugLog('[InteractiveDashboard] Parent selection changed:', selectedIds.size, 'ids')
      this.linkedTableManagers.forEach(manager => {
        manager.setParentSelection(selectedIds)
      })
    },

    // Handle Escape key to close fullscreen mode
    handleEscapeKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && this.fullScreenCardId) {
        this.fullScreenCardId = ''
        this.$emit('zoom', '')
      }
    },
  },
  async mounted() {
    window.addEventListener('resize', this.resizeAllCards)
    this.setupNarrowPanelObserver()

    // Add Escape key handler for fullscreen mode
    window.addEventListener('keydown', this.handleEscapeKey)

    if (this.gist) {
      this.fileSystemConfig = {
        name: 'gist',
        slug: 'gist',
        description: 'From GitHub',
        baseURL: this.gist.config.baseUrl,
      }
    } else {
      this.fileSystemConfig = this.getFileSystem(this.root)
    }

    this.fileList = await this.getFiles()

    try {
      await this.setupDashboard()

      // await this.$nextTick()
      this.resizeAllCards()
    } catch (e) {
      console.error('oh nooo' + e)
      this.$emit('error', 'Error setting up dashboard, check YAML?')
    }
  },

  beforeDestroy() {
    this.resizers = {}
    this.isDestroying = true
    this.narrowPanelObserver?.disconnect()
    window.removeEventListener('resize', this.resizeAllCards)

    // NEW: Remove Escape key handler
    window.removeEventListener('keydown', this.handleEscapeKey)

    // NEW: Clean up managers
    this.filterManager = null
    this.linkageManager = null
    this.dataTableManager = null
    this.linkedTableManagers = []
  },
})
</script>

<style scoped lang="scss">
@import '@/styles.scss';

/*
 * Interactive Dashboard theme colors via CSS variables
 * Managed by StyleManager - see managers/StyleManager.ts
 *
 * Variables used:
 * - --dashboard-bg-primary, --dashboard-bg-secondary, --dashboard-bg-tertiary
 * - --dashboard-text-primary, --dashboard-text-secondary
 * - --dashboard-border-default, --dashboard-border-subtle
 * - --dashboard-interaction-hover (#fbbf24), --dashboard-interaction-selected (#3b82f6)
 * - --dashboard-cluster-origin, --dashboard-cluster-destination
 * - --dashboard-chart-*, --dashboard-categorical-*
 *
 * Fallback pattern: var(--dashboard-X, var(--app-X, #fallback))
 * This ensures graceful degradation when StyleManager hasn't initialized.
 */

.dashboard {
  margin: 0 0;
  padding: 0 0;
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;

  .dashboard-content {
    max-width: $dashboardWidth;
    margin: 0 auto 0 auto;
    margin-top: 1.25rem;
  }

  .dashboard-content.wiide {
    max-width: unset;
  }
}

// .dashboard.wiide {
//   // padding-left: 1rem;
// }

.dashboard-header {
  margin: 0.25rem 2rem 1rem 0rem;

  h2 {
    line-height: 2.1rem;
    padding-bottom: 0.5rem;
  }

  p {
    line-height: 1.4rem;
  }
}

// Map controls (cluster type, color-by selectors)
.map-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0 0 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--dashboard-bg-secondary, var(--bgCardFrame));
  border-radius: 6px;
}

.dash-row {
  display: flex;
  flex-direction: row;
}

// FULL-SCREEN-DASHBOARD

.dashboard.is-fullscreen-dashboard {
  display: flex;
  flex-direction: column;
}

.dashboard .dashboard-content.is-fullscreen-dashboard {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.dash-row.is-fullscreen-dashboard {
  flex: 1;
}

// --end--

.dash-card-frame {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-rows: auto auto 1fr;
  margin: 0 $cardSpacing $cardSpacing 0;
  background-color: var(--dashboard-bg-secondary, var(--bgCardFrame));
  padding: 2px 3px 3px 3px;
  border-radius: 4px;
  overflow: hidden;

  // Fullscreen card mode - covers entire viewport
  &.is-fullscreen-card {
    border-radius: 0;
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
  }

  .dash-card-headers {
    display: flex;
    flex-direction: row;
    line-height: 1.2rem;
    padding: 3px 3px 2px 3px;
    p {
      margin-bottom: 0.1rem;
      color: var(--dashboard-text-secondary, var(--textFaint));
    }
  }

  .dash-card-headers.fullscreen {
    padding-top: 0;
  }

  .header-buttons {
    display: flex;
    flex-direction: row;
    margin-left: auto;

    button {
      background-color: #00000000;
      color: var(--dashboard-interaction-selected, var(--link));
      opacity: 0.5;
    }
    button:hover {
      background-color: var(--dashboard-bg-tertiary, #ffffff20);
      opacity: 1;
    }
  }

  h3 {
    grid-row: 1 / 2;
    font-size: 1.1rem;
    line-height: 1.5rem;
    margin-bottom: 0.5rem;
    color: var(--dashboard-interaction-selected, var(--link));
  }

  // if there is a description, fix the margins
  p {
    grid-row: 2 / 3;
    margin-top: -0.5rem;
    margin-bottom: 0.5rem;
  }

  .spinner-box {
    grid-row: 3 / 4;
    position: relative;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: url('../assets/simwrapper-logo/SW_logo_icon_anim.gif');
    background-size: 8rem;
    background-repeat: no-repeat;
    background-position: center center;
  }

  .spinner-box.is-loaded {
    background: none;
  }
}

// .dash-card-frame.wiide {
//   // margin-right: 2rem;
// }

.dash-card {
  transition: opacity 0.5s;
  overflow-x: hidden;
  overflow-y: hidden;
  border-radius: 2px;
  height: 100%;
  width: 100%;
}

// Allow data-table cards to contain their scrollable content
.dash-card.is-data-table {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// Observe for narrowness instead of a media-query
// since the panel might be narrow even if the window is wide.
// .dashboard.is-panel-narrow {
//   // padding: 0rem 0rem;
// }

.dashboard-header.is-panel-narrow {
  margin: 1rem 1rem 1rem 0rem;
}

.dash-row.is-panel-narrow {
  flex-direction: column;
}

.dash-card-frame.is-panel-narrow {
  margin: 0rem 0.5rem 1rem 0;
}

ul.tab-row {
  padding: 0 0;
  margin: 0 0;
  border-bottom: none;
}

li.tab-entry b a {
  color: var(--link);
  padding-bottom: 2px;
}

li.is-active b a {
  border-bottom: 2px solid var(--link);
}

li.is-not-active b a {
  color: var(--text);
}

.error-text {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--bgError);
  color: #800;
  border: 1px solid var(--bgCream4);
  border-radius: 3px;
  margin-bottom: 0px;
  padding: 0.5rem 0.5rem;
  z-index: 25000;
  font-size: 0.9rem;
  font-weight: bold;
  max-height: 50%;
  overflow-y: auto;
  p {
    line-height: 1.2rem;
    margin: 0 0;
  }
}

.clear-error {
  float: right;
  font-weight: bold;
  margin-right: 2px;
  padding: 0px 5px;
}

.clear-error:hover {
  cursor: pointer;
  color: red;
  background-color: #88888833;
}

.favorite-icon {
  margin: auto -0.5rem auto 1rem;
  opacity: 0.6;
  font-size: 1.1rem;
  color: #757bff;
  // text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
}

.is-favorite {
  opacity: 1;
  color: #4f58ff;
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
}

.favorite-icon:hover {
  cursor: pointer;
}

/*
 * Data table card styles
 * Uses CSS variables from StyleManager for theme-aware colors:
 * - --dashboard-bg-* for backgrounds
 * - --dashboard-text-* for text colors
 * - --dashboard-border-* for borders
 * - --dashboard-interaction-hover (#fbbf24) and --dashboard-interaction-selected (#3b82f6)
 *
 * Note: rgba() backgrounds use hardcoded values as CSS color-mix not widely supported.
 * The hex values match StyleManager definitions.
 */
.table-card-frame {
  flex: 1;
  min-height: 300px;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  background: var(--dashboard-bg-secondary, var(--bgCardFrame));

  &.is-fullscreen {
    max-height: none;
    height: 100%;
    background: var(--dashboard-bg-primary, var(--bgBold));
  }

  .reset-label,
  .scroll-label {
    margin-left: 0.25rem;
  }

  .scroll-toggle {
    display: flex;
    align-items: center;
    margin-right: 0.5rem;
    font-size: 0.8rem;
    color: var(--dashboard-text-primary, var(--text));
    cursor: pointer;
    opacity: 0.7;

    input {
      margin-right: 0.25rem;
    }

    &:hover {
      opacity: 1;
    }
  }
}

.table-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;

  thead {
    position: sticky;
    top: 0;
    background: var(--dashboard-bg-secondary, var(--bgCardFrame));
    z-index: 10;

    th {
      padding: 0.5rem 0.75rem;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid var(--dashboard-border-default, var(--borderColor));
      color: var(--dashboard-text-primary, var(--text));
      white-space: nowrap;
      cursor: pointer;
      user-select: none;

      &:hover {
        background: var(--dashboard-bg-tertiary, var(--bgHover));
      }

      &.sorted {
        // Use interaction.selected color for sorted column indicator
        color: var(--dashboard-interaction-selected, var(--link));
      }

      .header-cell {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .sort-icon {
        font-size: 0.75rem;
        opacity: 0.8;
      }
    }
  }

  tbody {
    tr {
      border-bottom: 1px solid var(--dashboard-border-subtle, var(--borderColor));
      cursor: pointer;
      transition: all 0.1s ease;

      &:hover {
        background: var(--dashboard-bg-tertiary, var(--bgHover));
      }

      // Filtered rows (matching current filters) - use selected color (#3b82f6)
      &.is-filtered {
        background-color: rgba(59, 130, 246, 0.1); // --dashboard-interaction-selected at 10%
        border-left: 3px solid var(--dashboard-interaction-selected, #3b82f6);
        font-weight: 500;
      }

      // Dimmed rows (not matching current filters)
      &.is-dimmed {
        opacity: 0.5;
      }

      // Hovered from map/other component - use hover color (#fbbf24)
      &.is-hovered {
        background: rgba(251, 191, 36, 0.25); // --dashboard-interaction-hover at 25%
        transform: scale(1.001);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        z-index: 1;
      }

      // Selected (clicked) rows - use selected color (#3b82f6)
      &.is-selected {
        background: rgba(59, 130, 246, 0.25); // --dashboard-interaction-selected at 25%
      }

      // Combined states
      &.is-filtered.is-hovered {
        background: rgba(59, 130, 246, 0.25);
        border-left: 3px solid var(--dashboard-interaction-selected, #2563eb);
      }

      &.is-hovered.is-selected {
        // Purple blend of hover+selected
        background: rgba(155, 89, 182, 0.35);
      }

      td {
        padding: 0.4rem 0.75rem;
        color: var(--dashboard-text-primary, var(--text));
      }
    }
  }
}

// Linked tables section styles
.linked-tables-section {
  padding: 1rem 0;
  margin-top: 1rem;
  border-top: 2px solid var(--dashboard-border-default, var(--bgBold));

  h4 {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: var(--dashboard-text-secondary, var(--textFancy));
    font-weight: 600;
  }
}
</style>
