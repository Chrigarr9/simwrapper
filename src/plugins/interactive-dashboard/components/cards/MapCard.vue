<template>
  <div class="map-card">
    <!-- Map Controls (geometry type and color-by selectors) -->
    <div v-if="hasMapControls" class="map-controls">
      <div v-if="mapControlsConfig?.geometryType" class="control-item">
        <label class="control-label">Geometry</label>
        <select class="control-select" :value="geometryType" @change="onGeometryTypeChange">
          <option v-for="opt in geometryTypeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div v-if="mapControlsConfig?.colorBy && colorByOptions.length > 0" class="control-item">
        <label class="control-label">Color by</label>
        <select class="control-select" :value="colorByAttribute" @change="onColorByChange">
          <option v-for="opt in colorByOptions" :key="opt.attribute" :value="opt.attribute">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <div :id="mapId" class="map-container"></div>
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <div>Loading map...</div>
    </div>

    <!-- Color Legend -->
    <color-legend
      v-if="showLegend && legendData"
      :title="legendData.title"
      :legend-items="legendData.type === 'categorical' ? legendData.items : []"
      :is-numeric="legendData.type === 'numeric'"
      :min-value="legendData.type === 'numeric' ? legendData.minValue : undefined"
      :max-value="legendData.type === 'numeric' ? legendData.maxValue : undefined"
      :clickable="props.legend?.clickToFilter !== false"
      :is-dark-mode="isDarkMode"
      @item-clicked="handleLegendItemClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PolygonLayer, LineLayer, ArcLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Position } from '@deck.gl/core'
import { FileSystemConfig } from '@/Globals'
import HTTPFileSystem from '@/js/HTTPFileSystem'
import globalStore from '@/store'
import ColorLegend from './ColorLegend.vue'
import { debugLog } from '../../utils/debug'
import { getInteractionColorRGBA } from '../../utils/colorSchemes'
import { StyleManager } from '../../managers/StyleManager'
import { computeAllLayerRoles } from '../../managers/LayerColoringManager'
import type { LayerColoringRole, LayerStrategy, ColorByRole } from '../../types/layerColoring'

// Debug flag for one-time logging
declare global {
  interface Window {
    _colorByDebugLogged?: boolean
  }
}

// Types
interface LayerConfig {
  name: string
  file: string
  type: 'polygon' | 'fill' | 'line' | 'arc' | 'scatterplot'
  visible?: boolean
  zIndex?: number

  // Geometry type filter - layer only visible when this matches the selected geometryType
  // Used by the geometry type selector (origin/destination/od/all)
  geometryType?: string

  // Polygon styling
  fillColor?: string
  fillOpacity?: number
  lineColor?: string
  lineWidth?: number

  // Line/Arc styling
  color?: string
  width?: number
  opacity?: number

  // Arc-specific
  arcHeight?: number
  arcTilt?: number

  // Scatterplot styling
  radius?: number

  // Dynamic coloring - can be a simple attribute name or full config object
  colorBy?: string | {
    attribute: string
    type: 'categorical' | 'numeric'
    colors?: Record<string, string>
    scale?: [number, number]
  }

  // Attribute-based sizing
  widthBy?: {
    attribute: string
    scale: [number, number]
  }
  radiusBy?: {
    attribute: string
    scale: [number, number]
  }

  // Property filters
  filter?: Array<{
    property: string
    value: any
  }> | {
    property: string
    value: any
  }

  // Linkage configuration
  linkage?: {
    tableColumn: string
    geoProperty: string
    onHover?: 'highlight' | 'none'
    onSelect?: 'filter' | 'highlight' | 'none'
    hideOthersOnSelect?: boolean  // When true, hide non-filtered features completely instead of dimming
  }

  // Explicit layer coloring role override (from YAML layer config)
  // When set, overrides auto-detection in LayerColoringManager
  // 'primary': Layer receives full colorBy data coloring
  // 'secondary': Layer receives subdued coloring (future use)
  // 'neutral': Layer receives theme-neutral styling (skips colorBy)
  // 'auto': Defer to automatic role detection based on layer relationships
  colorByRole?: ColorByRole
}

interface Props {
  // From LinkableCardWrapper slot (optional - only provided when using linkage)
  filteredData?: any[]
  hoveredIds?: Set<any>
  selectedIds?: Set<any>

  // From YAML config
  title?: string
  center?: [number, number]
  zoom?: number
  mapStyle?: 'light' | 'dark' | 'auto'
  layers?: LayerConfig[]
  tooltip?: {
    enabled: boolean
    template?: string
  }
  legend?: {
    enabled: boolean
    position?: string
    clickToFilter?: boolean
  }

  // Linkage config (from YAML)
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }

  // Dashboard context
  fileSystemConfig?: any
  subfolder?: string

  // Comparison mode (future)
  showComparison?: boolean
  baselineData?: any[]

  // Map control selections (from dashboard)
  geometryType?: string
  colorByAttribute?: string

  // Layer coloring strategy (from YAML map.colorBy.layerStrategy)
  layerStrategy?: LayerStrategy

  // Map controls configuration (from YAML)
  mapControlsConfig?: {
    geometryType?: boolean
    colorBy?: boolean
  }
  geometryTypeOptions?: Array<{ value: string; label: string }>
  colorByOptions?: Array<{ attribute: string; label: string; type: string }>
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [13.4, 52.52],
  zoom: 10,
  mapStyle: 'auto',
  showComparison: false,
  layers: () => [],
  filteredData: () => [],
  hoveredIds: () => new Set(),
  selectedIds: () => new Set(),
  geometryType: 'all',
  colorByAttribute: '',
  layerStrategy: 'auto',
  geometryTypeOptions: () => [],
  colorByOptions: () => [],
})

// Emits
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
  'update:geometry-type': [value: string]
  'update:color-by-attribute': [value: string]
  isLoaded: []
}>()

// Component state
const mapId = ref(`map-${Math.random().toString(36).substring(7)}`)
const map = ref<maplibregl.Map | null>(null)
const deckOverlay = ref<MapboxOverlay | null>(null)
const isLoading = ref(true)

// Layer data storage
const layerData = ref<Map<string, any[]>>(new Map())

// Selection state (local to map)
const hoveredFeatureIds = ref<Set<any>>(new Set())
const selectedFeatureIds = ref<Set<any>>(new Set())

// Computed layer roles for adaptive coloring (from LayerColoringManager)
const layerRoles = ref<Map<string, LayerColoringRole>>(new Map())

// Dark mode access from global store (Critical Fix #2)
const isDarkMode = computed(() => globalStore.state.isDarkMode)

// Map controls computed
const hasMapControls = computed(() => {
  return !!props.mapControlsConfig?.geometryType || !!props.mapControlsConfig?.colorBy
})

// Event handlers for map controls
function onGeometryTypeChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  debugLog('[MapCard] Geometry type changed to:', value)
  emit('update:geometry-type', value)
}

function onColorByChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  debugLog('[MapCard] Color by changed to:', value)
  emit('update:color-by-attribute', value)
}

// File API access
const fileApi = computed(() => {
  if (props.fileSystemConfig) {
    return new HTTPFileSystem(props.fileSystemConfig)
  }
  // Fallback: create a basic HTTPFileSystem with minimal config
  const defaultConfig: FileSystemConfig = {
    name: 'default',
    slug: 'default',
    description: 'Default file system',
    baseURL: window.location.origin,
  }
  return new HTTPFileSystem(defaultConfig)
})

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================

onMounted(async () => {
  await initMap()
  await loadLayerData()
  initDeckOverlay()
  updateLayers()
  fitBounds()
})

onUnmounted(() => {
  cleanup()
})

// Watch for linkage prop changes and update layers
watch(() => props.filteredData, () => {
  debugLog('[MapCard] filteredData changed, updating layers')
  updateLayers()
}, { deep: true })

watch(() => props.hoveredIds, () => {
  debugLog('[MapCard] hoveredIds changed:', props.hoveredIds)
  updateLayers()
}, { deep: true })

watch(() => props.selectedIds, () => {
  debugLog('[MapCard] selectedIds changed:', props.selectedIds)
  updateLayers()
}, { deep: true })

// Watch for layers prop changes (triggered by geometry type changes in parent)
watch(() => props.layers, () => {
  debugLog('[MapCard] layers prop changed, reloading layer data')
  loadLayerData().then(() => updateLayers())
}, { deep: true })

// Watch for colorByAttribute changes to update layer colors
watch(() => props.colorByAttribute, (newVal, oldVal) => {
  debugLog('[MapCard] colorByAttribute changed:', oldVal, '->', newVal)
  updateLayers()
})

// Watch for layerStrategy changes to recompute roles and update layers
watch(() => props.layerStrategy, (newVal, oldVal) => {
  debugLog('[MapCard] layerStrategy changed:', oldVal, '->', newVal)
  updateLayers()
})

// ============================================================================
// TASK 2: MapLibre Initialization with Theme Switching
// ============================================================================

async function initMap(): Promise<void> {
  if (map.value) {
    console.warn('[MapCard] Map already initialized')
    return
  }

  // Determine map style based on prop
  const mapStyle = getMapStyle()

  try {
    // Create MapLibre map
    map.value = new maplibregl.Map({
      container: mapId.value,
      style: mapStyle,
      center: props.center || [13.4, 52.52],
      zoom: props.zoom || 10,
    })

    // Wait for map to load
    await new Promise<void>((resolve) => {
      map.value!.on('load', () => {
        isLoading.value = false
        emit('isLoaded')  // Notify parent that card is loaded (hides loading spinner)
        resolve()
      })
    })

    debugLog('[MapCard] MapLibre initialized')
  } catch (error) {
    console.error('[MapCard] Failed to initialize map:', error)
    isLoading.value = false
    emit('isLoaded')  // Still emit on error to hide spinner
    throw error
  }
}

function getMapStyle(): string {
  // Handle explicit mapStyle prop
  if (props.mapStyle === 'light') {
    return 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
  } else if (props.mapStyle === 'dark') {
    return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
  }

  // Auto mode: use isDarkMode from global store
  return isDarkMode.value
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
}

// Watch for theme changes
watch(isDarkMode, (newVal) => {
  if (map.value && props.mapStyle === 'auto') {
    const mapStyle = newVal
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
    map.value.setStyle(mapStyle)

    // Re-add deck overlay after style change
    map.value.once('style.load', () => {
      if (deckOverlay.value && map.value) {
        map.value.addControl(deckOverlay.value as any)
      }
    })
  }
})

// Auto-fit bounds helper
function fitBounds() {
  if (!map.value) return

  const allCoordinates: [number, number][] = []

  // Collect all coordinates from all layer data
  layerData.value.forEach((features) => {
    features.forEach((feature) => {
      if (feature.geometry) {
        const coords = extractCoordinates(feature.geometry)
        allCoordinates.push(...coords)
      }
    })
  })

  if (allCoordinates.length === 0) return

  // Create bounds
  const bounds = new maplibregl.LngLatBounds()
  allCoordinates.forEach((coord) => {
    bounds.extend(coord)
  })

  if (!bounds.isEmpty()) {
    map.value.fitBounds(bounds, {
      padding: 50,
      maxZoom: 15,
    })
  }
}

// Helper to extract coordinates from any geometry type
function extractCoordinates(geometry: any): [number, number][] {
  const coords: [number, number][] = []

  function processCoord(coord: any) {
    if (Array.isArray(coord) && coord.length >= 2 && typeof coord[0] === 'number') {
      coords.push([coord[0], coord[1]])
    } else if (Array.isArray(coord)) {
      coord.forEach(processCoord)
    }
  }

  if (geometry.coordinates) {
    processCoord(geometry.coordinates)
  }

  return coords
}

// ============================================================================
// TASK 3: GeoJSON Data Loading System
// ============================================================================

async function loadLayerData(): Promise<void> {
  if (!props.layers || props.layers.length === 0) {
    debugLog('[MapCard] No layers to load')
    return
  }

  const subfolder = props.subfolder || ''

  try {
    // Load all layer files in parallel
    const loadPromises = props.layers.map(async (layerConfig) => {
      try {
        const geojson = await loadGeoJSON(layerConfig.file, subfolder)

        // Deep clone to avoid Vue reactivity issues with deck.gl (CRITICAL)
        const clonedFeatures = JSON.parse(JSON.stringify(geojson.features || []))

        // Apply property filters if configured
        const filteredFeatures = applyPropertyFilters(clonedFeatures, layerConfig.filter)

        // Store in layer data map
        layerData.value.set(layerConfig.name, filteredFeatures)

        debugLog(`[MapCard] Loaded layer "${layerConfig.name}": ${filteredFeatures.length} features`)
      } catch (error) {
        console.error(`[MapCard] Failed to load layer "${layerConfig.name}":`, error)
        // Store empty array on failure so layer system doesn't crash
        layerData.value.set(layerConfig.name, [])
      }
    })

    await Promise.all(loadPromises)

    debugLog('[MapCard] All layers loaded')
  } catch (error) {
    console.error('[MapCard] Error loading layer data:', error)
  }
}

async function loadGeoJSON(filename: string, subfolder: string): Promise<any> {
  const filepath = subfolder ? `${subfolder}/${filename}` : filename

  try {
    // Critical Fix #1: Use getFileText method instead of fetch
    const text = await fileApi.value.getFileText(filepath)
    const geojson = JSON.parse(text)

    // Validate GeoJSON structure
    if (!geojson.type || geojson.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON: must be a FeatureCollection')
    }

    return geojson
  } catch (error) {
    console.error(`[MapCard] Failed to load GeoJSON from "${filepath}":`, error)
    throw error
  }
}

function applyPropertyFilters(features: any[], filterConfig: any): any[] {
  if (!filterConfig) {
    return features
  }

  // Normalize filter config to array
  const filters = Array.isArray(filterConfig) ? filterConfig : [filterConfig]

  // Apply all filters (AND logic)
  return features.filter((feature) => {
    return filters.every((filter) => {
      const propertyValue = feature.properties?.[filter.property]
      return propertyValue === filter.value
    })
  })
}

// Helper to get layer data
function getLayerData(layerName: string): any[] {
  return layerData.value.get(layerName) || []
}

// Helper to check if layer is visible
function isLayerVisible(layerConfig: LayerConfig): boolean {
  // Check basic visibility flag
  if (layerConfig.visible === false) {
    return false
  }

  // Check geometry type filter (from geometry type selector)
  // If layer has a geometryType and it doesn't match the selected type, hide it
  if (layerConfig.geometryType && props.geometryType) {
    // 'all' shows all layers regardless of their geometryType
    if (props.geometryType === 'all') {
      return true
    }
    // Otherwise, layer's geometryType must match the selected type
    return layerConfig.geometryType === props.geometryType
  }

  return true
}

// ============================================================================
// TASK 4: Deck.gl Overlay Initialization
// ============================================================================

function initDeckOverlay() {
  if (!map.value) {
    console.error('[MapCard] Cannot init deck overlay: map not initialized')
    return
  }

  if (deckOverlay.value) {
    console.warn('[MapCard] Deck overlay already initialized')
    return
  }

  deckOverlay.value = new MapboxOverlay({
    layers: [],
    getTooltip: ({ object }: any) => getTooltipContent(object),
  })

  map.value.addControl(deckOverlay.value as any)
  debugLog('[MapCard] Deck.gl overlay initialized')
}

// ============================================================================
// TASK 7: Advanced Tooltip System with Template Substitution
// ============================================================================

// Enhanced tooltip content generator
function getTooltipContent(object: any): any {
  if (!object || !props.tooltip?.enabled) {
    return null
  }

  const properties = object.properties || {}

  // Look up colorBy attribute value from central table if applicable
  let colorByValue: { label: string; value: any } | null = null
  if (props.colorByAttribute && props.filteredData?.length > 0) {
    // Find the matching layer config to get linkage info
    const layerConfig = props.layers.find(l => l.linkage)
    if (layerConfig?.linkage) {
      const featureId = getFeatureId(object, layerConfig)
      const tableColumn = layerConfig.linkage.tableColumn

      // Find matching row in central table
      const matchingRow = props.filteredData.find((row: any) => {
        const rowId = row[tableColumn]
        return rowId == featureId || String(rowId) === String(featureId)
      })

      if (matchingRow && matchingRow[props.colorByAttribute] !== undefined) {
        // Get the label from colorByOptions
        const attrConfig = props.colorByOptions.find(opt => opt.attribute === props.colorByAttribute)
        const label = attrConfig?.label || props.colorByAttribute
        colorByValue = {
          label,
          value: matchingRow[props.colorByAttribute]
        }
      }
    }
  }

  // Use custom template if provided
  if (props.tooltip.template) {
    const html = renderTooltipTemplate(props.tooltip.template, properties, colorByValue)
    return {
      html,
      style: getTooltipStyle(),
    }
  }

  // Auto-generate tooltip from all properties
  const html = renderDefaultTooltip(properties, colorByValue)
  return {
    html,
    style: getTooltipStyle(),
  }
}

// Render tooltip from template string
function renderTooltipTemplate(
  template: string,
  properties: Record<string, any>,
  colorByValue: { label: string; value: any } | null = null
): string {
  let html = template

  // Replace {properties.xxx} placeholders
  const regex = /\{properties\.([a-zA-Z0-9_]+)\}/g
  html = html.replace(regex, (match, propertyName) => {
    const value = properties[propertyName]
    if (value === undefined || value === null) {
      return '<em>N/A</em>'
    }
    return formatTooltipValue(value)
  })

  // Add colorBy value if available (as highlighted header)
  let colorByHtml = ''
  if (colorByValue) {
    const formattedValue = formatTooltipValue(colorByValue.value)
    colorByHtml = `
      <div class="tooltip-row tooltip-highlight">
        <span class="tooltip-key">${colorByValue.label}:</span>
        <span class="tooltip-value">${formattedValue}</span>
      </div>
      <hr class="tooltip-divider" />
    `
  }

  // Wrap in container with colorBy at top
  return `<div class="mapcard-tooltip">${colorByHtml}${html}</div>`
}

// Render default tooltip showing all properties
function renderDefaultTooltip(
  properties: Record<string, any>,
  colorByValue: { label: string; value: any } | null = null
): string {
  if (Object.keys(properties).length === 0 && !colorByValue) {
    return '<div class="mapcard-tooltip"><em>No data</em></div>'
  }

  let html = '<div class="mapcard-tooltip">'

  // Add colorBy value first (highlighted)
  if (colorByValue) {
    const formattedValue = formatTooltipValue(colorByValue.value)
    html += `
      <div class="tooltip-row tooltip-highlight">
        <span class="tooltip-key">${colorByValue.label}:</span>
        <span class="tooltip-value">${formattedValue}</span>
      </div>
    `
    if (Object.keys(properties).length > 0) {
      html += '<hr class="tooltip-divider" />'
    }
  }

  // Limit to first 10 properties to avoid huge tooltips
  const entries = Object.entries(properties).slice(0, 10)

  entries.forEach(([key, value]) => {
    // Skip internal properties
    if (key.startsWith('_')) return

    const formattedKey = formatPropertyName(key)
    const formattedValue = formatTooltipValue(value)

    html += `
      <div class="tooltip-row">
        <span class="tooltip-key">${formattedKey}:</span>
        <span class="tooltip-value">${formattedValue}</span>
      </div>
    `
  })

  if (Object.keys(properties).length > 10) {
    html += '<div class="tooltip-row"><em>... and more</em></div>'
  }

  html += '</div>'

  return html
}

// Format property name for display (e.g., "main_mode" -> "Main Mode")
function formatPropertyName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Format property value for display
function formatTooltipValue(value: any): string {
  if (value === null || value === undefined) {
    return '<em>N/A</em>'
  }

  // Number formatting
  if (typeof value === 'number') {
    // Check if it's likely a large coordinate or timestamp
    if (Math.abs(value) > 10000) {
      return value.toFixed(0)
    }
    // Regular numbers - 2 decimal places
    return value.toFixed(2)
  }

  // Boolean
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  // String (escape HTML)
  return String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Get tooltip style based on theme
function getTooltipStyle(): Record<string, string> {
  const styleManager = StyleManager.getInstance()
  return {
    backgroundColor: styleManager.getColor('theme.background.secondary'),
    color: styleManager.getColor('theme.text.primary'),
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    lineHeight: '1.5',
    padding: '8px 12px',
    borderRadius: '4px',
    boxShadow: isDarkMode.value
      ? '0 4px 12px rgba(0, 0, 0, 0.5)'
      : '0 2px 8px rgba(0, 0, 0, 0.15)',
    maxWidth: '300px',
    pointerEvents: 'none',
    zIndex: '1000',
  }
}

// ============================================================================
// TASKS 4-5: Layer Factories and Update System
// ============================================================================

// TASK 10: Sort layers by zIndex
function sortLayersByZIndex(layers: any[]): any[] {
  // Create layer info with zIndex
  const layersWithInfo = layers.map((layer, index) => {
    // Extract layer name from deck.gl layer id
    const layerId = layer.id || ''
    const layerConfig = findLayerConfigById(layerId)

    return {
      layer,
      zIndex: layerConfig?.zIndex,
      originalIndex: index,
    }
  })

  // Sort: explicit zIndex first (ascending), then by original order
  layersWithInfo.sort((a, b) => {
    // Both have explicit zIndex
    if (a.zIndex !== undefined && b.zIndex !== undefined) {
      return a.zIndex - b.zIndex
    }

    // Only a has zIndex (a comes first)
    if (a.zIndex !== undefined) {
      return -1
    }

    // Only b has zIndex (b comes first)
    if (b.zIndex !== undefined) {
      return 1
    }

    // Neither has zIndex - preserve original order
    return a.originalIndex - b.originalIndex
  })

  return layersWithInfo.map((info) => info.layer)
}

function updateLayers() {
  if (!deckOverlay.value) {
    console.warn('[MapCard] Cannot update layers: overlay not initialized')
    return
  }

  if (!props.layers || props.layers.length === 0) {
    deckOverlay.value.setProps({ layers: [] })
    return
  }

  // Filter to visible layers only BEFORE computing roles
  // This is critical: role computation must only consider currently visible layers
  // Otherwise, hidden arcs would cause all visible polygons to become neutral
  const visibleLayers = props.layers.filter(layer => isLayerVisible(layer))

  // DEBUG: Log visibility filtering
  console.log('[MapCard] geometryType selected:', props.geometryType)
  console.log('[MapCard] All layers:', props.layers.map(l => ({ name: l.name, geometryType: l.geometryType, type: l.type })))
  console.log('[MapCard] Visible layers:', visibleLayers.map(l => ({ name: l.name, geometryType: l.geometryType, type: l.type })))
  console.log('[MapCard] layerStrategy:', props.layerStrategy)
  console.log('[MapCard] colorByAttribute:', props.colorByAttribute)

  // Compute layer roles using LayerColoringManager
  // This determines which layers get colorBy coloring vs neutral styling
  layerRoles.value = computeAllLayerRoles(visibleLayers, props.layerStrategy)
  debugLog('[MapCard] Computed layer roles for', visibleLayers.length, 'visible layers:', [...layerRoles.value.entries()])

  const layers: any[] = []

  props.layers.forEach((layerConfig) => {
    if (!isLayerVisible(layerConfig)) {
      return
    }

    const features = getLayerData(layerConfig.name)
    if (features.length === 0) {
      console.warn(`[MapCard] No data for layer "${layerConfig.name}"`)
      return
    }

    debugLog(`[MapCard] Creating layer "${layerConfig.name}" (type: ${layerConfig.type}, linkage: ${!!layerConfig.linkage}, features: ${features.length})`)

    // TASK 12: Create baseline layer if comparison mode enabled
    if (props.showComparison && props.baselineData && props.baselineData.length > 0) {
      const baselineLayer = createBaselineLayer(layerConfig, features)
      if (baselineLayer) {
        layers.push(baselineLayer)
      }
    }

    let layer: any = null

    switch (layerConfig.type) {
      case 'polygon':
      case 'fill':  // Alias for polygon
        layer = createPolygonLayer(layerConfig, features)
        break

      case 'line':
        layer = createLineLayer(layerConfig, features)
        layers.push(layer)
        const lineMarkers = createLineDestinationMarkers(layerConfig, features)
        if (lineMarkers) layers.push(lineMarkers)
        return

      case 'arc':
        layer = createArcLayer(layerConfig, features)
        layers.push(layer)
        const arcTips = createArcArrowTips(layerConfig, features)
        if (arcTips) layers.push(arcTips)
        return

      case 'scatterplot':
      case 'circle':  // Alias for scatterplot
      case 'point':   // Alias for scatterplot
        layer = createScatterplotLayer(layerConfig, features)
        break

      default:
        console.warn(`[MapCard] Unknown layer type: ${layerConfig.type}`)
    }

    if (layer) {
      layers.push(layer)
    }
  })

  // Sort layers by zIndex (if specified) or by original order
  const sortedLayers = sortLayersByZIndex(layers)

  // Update deck overlay
  deckOverlay.value.setProps({ layers: sortedLayers })
  debugLog(`[MapCard] Updated ${sortedLayers.length} layers (comparison: ${props.showComparison})`)
  debugLog(`[MapCard] Layer details:`, sortedLayers.map(l => ({ id: l.id, pickable: l.props?.pickable })))
}

// TASK 12: Create baseline layer (gray, dimmed) for comparison mode
// Comparison baseline - intentionally neutral gray regardless of theme
function createBaselineLayer(layerConfig: LayerConfig, features: any[]): any {
  const baselineColor: [number, number, number, number] = [180, 180, 180, 80] // Neutral gray for comparison

  switch (layerConfig.type) {
    case 'polygon':
      return new PolygonLayer({
        id: `baseline-polygon-${layerConfig.name}`,
        data: features,
        pickable: false, // Baseline not interactive
        stroked: true,
        filled: true,
        wireframe: true,
        lineWidthMinPixels: 1,

        getPolygon: (d: any) => {
          const coords = d.geometry.coordinates
          if (d.geometry.type === 'Polygon') {
            return coords[0]
          } else if (d.geometry.type === 'MultiPolygon') {
            return coords[0][0]
          }
          return []
        },

        getFillColor: baselineColor,
        getLineColor: [160, 160, 160, 100],
        getLineWidth: 1,
      })

    case 'line':
      return new LineLayer({
        id: `baseline-line-${layerConfig.name}`,
        data: features,
        pickable: false,

        getSourcePosition: (d: any) => d.geometry.coordinates[0] as Position,
        getTargetPosition: (d: any) => {
          const coords = d.geometry.coordinates
          return coords[coords.length - 1] as Position
        },

        getWidth: 1,
        getColor: baselineColor,
      })

    case 'arc':
      return new ArcLayer({
        id: `baseline-arc-${layerConfig.name}`,
        data: features,
        pickable: false,
        greatCircle: false,

        getSourcePosition: (d: any) => d.geometry.coordinates[0] as Position,
        getTargetPosition: (d: any) => d.geometry.coordinates[1] as Position,

        getWidth: 2,
        getSourceColor: baselineColor,
        getTargetColor: baselineColor,

        getTilt: () => layerConfig.arcTilt || 25,
        getHeight: () => layerConfig.arcHeight || 0.2,
      })

    case 'scatterplot':
      return new ScatterplotLayer({
        id: `baseline-scatterplot-${layerConfig.name}`,
        data: features,
        pickable: false,
        radiusMinPixels: 2,
        radiusMaxPixels: 10,

        getPosition: (d: any) => d.geometry.coordinates as Position,
        getRadius: layerConfig.radius || 4,
        getFillColor: baselineColor,
        getLineColor: [160, 160, 160, 100],
        lineWidthMinPixels: 1,
      })

    default:
      return null
  }
}

// Polygon Layer Factory
function createPolygonLayer(layerConfig: LayerConfig, features: any[]): PolygonLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new PolygonLayer({
      id: `polygon-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,
      stroked: true,
      filled: true,
      wireframe: true,
      lineWidthMinPixels: 1,

      getPolygon: (d: any) => {
        const coords = d.geometry.coordinates
        if (d.geometry.type === 'Polygon') {
          return coords[0]
        } else if (d.geometry.type === 'MultiPolygon') {
          return coords[0][0]
        }
        return []
      },

      getFillColor: (d: any) => getFeatureFillColor(d, layerConfig),
      getLineColor: (d: any) => getFeatureLineColor(d, layerConfig),
      getLineWidth: (d: any) => getFeatureLineWidth(d, layerConfig),

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData, props.colorByAttribute, layerRoles.value],
        getLineColor: [props.hoveredIds, props.selectedIds, props.filteredData, props.colorByAttribute, layerRoles.value],
        getLineWidth: [props.hoveredIds, props.selectedIds],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create PolygonLayer for "${layerConfig.name}":`, error)
    return null
  }
}

// LineLayer Factory
function createLineLayer(layerConfig: LayerConfig, features: any[]): LineLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new LineLayer({
      id: `line-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,

      getSourcePosition: (d: any) => d.geometry.coordinates[0] as Position,
      getTargetPosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords[coords.length - 1] as Position
      },

      getWidth: (d: any) => getFeatureWidth(d, layerConfig),
      getColor: (d: any) => getFeatureColor(d, layerConfig),

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getWidth: [props.hoveredIds, props.selectedIds, props.filteredData],
        getColor: [props.hoveredIds, props.selectedIds, props.filteredData, props.colorByAttribute, layerRoles.value],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create LineLayer for "${layerConfig.name}":`, error)
    return null
  }
}

// Automatic destination markers for LineLayer
function createLineDestinationMarkers(layerConfig: LayerConfig, features: any[]): ScatterplotLayer | null {
  try {
    return new ScatterplotLayer({
      id: `line-destinations-${layerConfig.name}`,
      data: features,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 8,

      getPosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords[coords.length - 1] as Position
      },

      // Match parent line width as radius (scaled down to 80%)
      getRadius: (d: any) => {
        const width = getFeatureWidth(d, layerConfig)
        return Math.max(2, width * 0.8) // 80% of line width
      },

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getRadius: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.widthBy],
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.colorBy, props.colorByAttribute, layerRoles.value],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create line destination markers:`, error)
    return null
  }
}

// ArcLayer Factory
function createArcLayer(layerConfig: LayerConfig, features: any[]): ArcLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new ArcLayer({
      id: `arc-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,
      greatCircle: false,

      getSourcePosition: (d: any) => d.geometry.coordinates[0] as Position,
      getTargetPosition: (d: any) => d.geometry.coordinates[1] as Position,

      getWidth: (d: any) => getFeatureWidth(d, layerConfig),
      getSourceColor: (d: any) => getFeatureColor(d, layerConfig),
      getTargetColor: (d: any) => getFeatureColor(d, layerConfig),

      getTilt: () => layerConfig.arcTilt || 25,
      getHeight: () => layerConfig.arcHeight || 0.2,

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getWidth: [props.hoveredIds, props.selectedIds, props.filteredData],
        getSourceColor: [props.hoveredIds, props.selectedIds, props.filteredData, props.colorByAttribute, layerRoles.value],
        getTargetColor: [props.hoveredIds, props.selectedIds, props.filteredData, props.colorByAttribute, layerRoles.value],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create ArcLayer for "${layerConfig.name}":`, error)
    return null
  }
}

// Automatic arrow tips for ArcLayer
function createArcArrowTips(layerConfig: LayerConfig, features: any[]): ScatterplotLayer | null {
  try {
    return new ScatterplotLayer({
      id: `arc-tips-${layerConfig.name}`,
      data: features,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 6,

      getPosition: (d: any) => d.geometry.coordinates[1] as Position,

      // Match parent arc width as radius
      getRadius: (d: any) => {
        const width = getFeatureWidth(d, layerConfig)
        return Math.max(2, width) // Match arc width
      },

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getRadius: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.widthBy],
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.colorBy, props.colorByAttribute, layerRoles.value],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create arc arrow tips:`, error)
    return null
  }
}

// ScatterplotLayer Factory
function createScatterplotLayer(layerConfig: LayerConfig, features: any[]): ScatterplotLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new ScatterplotLayer({
      id: `scatterplot-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 20,

      getPosition: (d: any) => d.geometry.coordinates as Position,

      // Use new getFeatureRadius function with attribute-based sizing support
      getRadius: (d: any) => getFeatureRadius(d, layerConfig),

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getRadius: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.radiusBy],
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.colorBy, props.colorByAttribute, layerRoles.value],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create ScatterplotLayer for "${layerConfig.name}":`, error)
    return null
  }
}

// ============================================================================
// STYLING HELPER FUNCTIONS
// ============================================================================

function sortFeaturesByState(features: any[], layerConfig: LayerConfig): any[] {
  if (!layerConfig.linkage) {
    return features
  }

  return [...features].sort((a, b) => {
    const aId = getFeatureId(a, layerConfig)
    const bId = getFeatureId(b, layerConfig)

    // Use loose comparison for type mismatches (string "45" vs number 45)
    const aSelected = setHasLoose(props.selectedIds, aId)
    const bSelected = setHasLoose(props.selectedIds, bId)
    const aHovered = setHasLoose(props.hoveredIds, aId)
    const bHovered = setHasLoose(props.hoveredIds, bId)

    // Priority: hovered on top, then selected, then normal
    // Higher return value = rendered later = on top
    if (aHovered && !bHovered) return 1
    if (!aHovered && bHovered) return -1
    if (aSelected && !bSelected) return 1
    if (!aSelected && bSelected) return -1

    return 0
  })
}

function getFeatureFillColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = getFeatureId(feature, layerConfig) ?? feature.properties?.id

  // Use loose comparison for type mismatches (string "45" vs number 45)
  const isSelected = setHasLoose(props.selectedIds, featureId)
  const isHovered = setHasLoose(props.hoveredIds, featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)
  const hasActiveSelection = props.selectedIds && props.selectedIds.size > 0

  if (isSelected) {
    // Selected items: blue fill with higher alpha for visibility
    return getInteractionColorRGBA('selected', 180)
  }

  if (isHovered) {
    return getInteractionColorRGBA('hover', 100)
  }

  // Only dim non-filtered items when there are actual chart filters active,
  // NOT when there's just a selection. Selection should only highlight,
  // not dim other features.
  if (hasActiveFilters && !isFiltered && !hasActiveSelection) {
    // If hideOthersOnSelect is true, make fully transparent (hidden)
    if (layerConfig.linkage?.hideOthersOnSelect) {
      return [0, 0, 0, 0]
    }
    // Dimmed color - use base color but with reduced opacity
    const baseColor = getBaseColor(feature, layerConfig)
    const dimmed: [number, number, number] = [
      Math.round((baseColor[0] + 180) / 2),
      Math.round((baseColor[1] + 180) / 2),
      Math.round((baseColor[2] + 180) / 2),
    ]
    return [dimmed[0], dimmed[1], dimmed[2], 60]
  }

  // Use getBaseColor for colorBy support (dashboard-level or per-layer)
  const baseColor = getBaseColor(feature, layerConfig)
  // Default to 0.7 opacity for better visibility (was 0.5)
  const opacity = Math.round((layerConfig.fillOpacity ?? 0.7) * 255)
  return [baseColor[0], baseColor[1], baseColor[2], opacity]
}

function getFeatureLineColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = getFeatureId(feature, layerConfig) ?? feature.properties?.id

  const isSelected = setHasLoose(props.selectedIds, featureId)
  const isHovered = setHasLoose(props.hoveredIds, featureId)

  if (isSelected) {
    // Selected items: thicker blue outline for clear indication
    return getInteractionColorRGBA('selected', 255)
  }

  if (isHovered) {
    return getInteractionColorRGBA('hover', 255)
  }

  if (layerConfig.lineColor) {
    const rgb = hexToRgb(layerConfig.lineColor)
    return [rgb[0], rgb[1], rgb[2], 255]
  }

  return [100, 100, 100, 255]
}

// ============================================================================
// TASK 9: Attribute-Based Sizing System
// ============================================================================

// Calculate scaled width based on attribute value
function getAttributeBasedWidth(
  feature: any,
  layerConfig: LayerConfig,
  baseWidth: number
): number {
  if (!layerConfig.widthBy) {
    return baseWidth
  }

  const widthBy = layerConfig.widthBy
  const attributeValue = feature.properties?.[widthBy.attribute]

  if (attributeValue === undefined || attributeValue === null || typeof attributeValue !== 'number') {
    console.warn(`[MapCard] Invalid width attribute "${widthBy.attribute}"`, feature.properties)
    return baseWidth
  }

  // Get min/max from data
  const features = getLayerData(layerConfig.name)
  const [minValue, maxValue] = calculateNumericRange(features, widthBy.attribute)

  // Normalize to 0-1
  const normalized = (attributeValue - minValue) / (maxValue - minValue)
  const clamped = Math.max(0, Math.min(1, normalized))

  // Scale to configured range
  const [minWidth, maxWidth] = widthBy.scale
  const scaledWidth = minWidth + clamped * (maxWidth - minWidth)

  return scaledWidth
}

// Calculate scaled radius based on attribute value
function getAttributeBasedRadius(
  feature: any,
  layerConfig: LayerConfig,
  baseRadius: number
): number {
  if (!layerConfig.radiusBy) {
    return baseRadius
  }

  const radiusBy = layerConfig.radiusBy
  const attributeValue = feature.properties?.[radiusBy.attribute]

  if (attributeValue === undefined || attributeValue === null || typeof attributeValue !== 'number') {
    console.warn(`[MapCard] Invalid radius attribute "${radiusBy.attribute}"`, feature.properties)
    return baseRadius
  }

  // Get min/max from data
  const features = getLayerData(layerConfig.name)
  const [minValue, maxValue] = calculateNumericRange(features, radiusBy.attribute)

  // Normalize to 0-1
  const normalized = (attributeValue - minValue) / (maxValue - minValue)
  const clamped = Math.max(0, Math.min(1, normalized))

  // Scale to configured range
  const [minRadius, maxRadius] = radiusBy.scale
  const scaledRadius = minRadius + clamped * (maxRadius - minRadius)

  return scaledRadius
}

function getFeatureLineWidth(feature: any, layerConfig: LayerConfig): number {
  const featureId = getFeatureId(feature, layerConfig) ?? feature.properties?.id

  const isSelected = setHasLoose(props.selectedIds, featureId)
  const isHovered = setHasLoose(props.hoveredIds, featureId)

  // Selected items get thicker outline to stand out clearly
  if (isSelected) return 6
  if (isHovered) return 4

  return layerConfig.lineWidth || 2
}

// Get feature width with attribute-based sizing support
function getFeatureWidth(feature: any, layerConfig: LayerConfig): number {
  const featureId = getFeatureId(feature, layerConfig) ?? feature.properties?.id
  const isHovered = setHasLoose(props.hoveredIds, featureId)
  const isSelected = setHasLoose(props.selectedIds, featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)
  const hasActiveSelection = props.selectedIds && props.selectedIds.size > 0

  // Base width (static or attribute-based)
  let baseWidth: number
  if (layerConfig.widthBy) {
    // Attribute-based sizing
    const staticBase = layerConfig.width || 2
    baseWidth = getAttributeBasedWidth(feature, layerConfig, staticBase)
  } else {
    // Static sizing
    baseWidth = layerConfig.width || 2
  }

  // State-based scaling
  if (isHovered) return baseWidth * 3
  if (isSelected) return baseWidth * 2.5
  // Only dim when chart filters are active, not when there's just a selection
  if (hasActiveFilters && !isFiltered && !hasActiveSelection) {
    // If hideOthersOnSelect is true, make invisible (0 width)
    if (layerConfig.linkage?.hideOthersOnSelect) return 0
    return 1 // Always 1px when dimmed
  }
  return baseWidth
}

// Get feature radius with attribute-based sizing support
function getFeatureRadius(feature: any, layerConfig: LayerConfig): number {
  const featureId = getFeatureId(feature, layerConfig) ?? feature.properties?.id
  const isHovered = setHasLoose(props.hoveredIds, featureId)
  const isSelected = setHasLoose(props.selectedIds, featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)
  const hasActiveSelection = props.selectedIds && props.selectedIds.size > 0

  // Base radius (static or attribute-based)
  let baseRadius: number
  if (layerConfig.radiusBy) {
    // Attribute-based sizing
    const staticBase = layerConfig.radius || 5
    baseRadius = getAttributeBasedRadius(feature, layerConfig, staticBase)
  } else {
    // Static sizing
    baseRadius = layerConfig.radius || 5
  }

  // State-based scaling
  if (isHovered) return baseRadius * 1.5
  if (isSelected) return baseRadius * 1.3
  // Only dim when chart filters are active, not when there's just a selection
  if (hasActiveFilters && !isFiltered && !hasActiveSelection) {
    // If hideOthersOnSelect is true, make invisible (0 radius)
    if (layerConfig.linkage?.hideOthersOnSelect) return 0
    return baseRadius * 0.5 // Smaller when dimmed
  }
  return baseRadius
}

function getFeatureColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = getFeatureId(feature, layerConfig) ?? feature.properties?.id
  const isSelected = setHasLoose(props.selectedIds, featureId)
  const isHovered = setHasLoose(props.hoveredIds, featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)
  const hasActiveSelection = props.selectedIds && props.selectedIds.size > 0

  if (isSelected) {
    return getInteractionColorRGBA('selected', 255)
  }

  if (isHovered) {
    return getInteractionColorRGBA('hover', 255)
  }

  // Only dim when chart filters are active, not when there's just a selection
  if (hasActiveFilters && !isFiltered && !hasActiveSelection) {
    // If hideOthersOnSelect is true, make fully transparent (hidden)
    if (layerConfig.linkage?.hideOthersOnSelect) {
      return [0, 0, 0, 0]
    }
    const baseColor = getBaseColor(feature, layerConfig)
    const dimmed: [number, number, number] = [
      Math.round((baseColor[0] + 180) / 2),
      Math.round((baseColor[1] + 180) / 2),
      Math.round((baseColor[2] + 180) / 2),
    ]
    return [dimmed[0], dimmed[1], dimmed[2], 60]
  }

  const baseColor = getBaseColor(feature, layerConfig)
  const opacity = Math.round((layerConfig.opacity || 1.0) * 255)
  return [baseColor[0], baseColor[1], baseColor[2], opacity]
}

// ============================================================================
// TASK 8: Dynamic Color Management System
// ============================================================================

// Domain-specific categorical color schemes - not theme-dependent
// These colors represent semantic meaning (e.g., transport mode types)
// and should remain constant regardless of light/dark mode
const DEFAULT_CATEGORICAL_COLORS: Record<string, Record<string, string>> = {
  mode: {
    car: '#e74c3c',
    pt: '#3498db',
    bike: '#2ecc71',
    walk: '#f39c12',
    drt: '#9b59b6',
    ride: '#1abc9c',
    default: '#95a5a6',
  },
  activity: {
    home: '#4477ff',
    work: '#ff4477',
    education: '#44ff77',
    shopping: '#ff7744',
    leisure: '#aa44ff',
    other: '#777777',
  },
}

// Get categorical color for a value
function getCategoricalColor(
  value: any,
  colorMap?: Record<string, string>,
  attribute?: string
): [number, number, number] {
  // Use custom color map if provided
  if (colorMap && colorMap[value]) {
    return hexToRgb(colorMap[value])
  }

  // Try default schemes based on attribute name
  if (attribute) {
    const schemeName = attribute.toLowerCase().includes('mode') ? 'mode' :
                      attribute.toLowerCase().includes('activity') ? 'activity' : null

    if (schemeName && DEFAULT_CATEGORICAL_COLORS[schemeName]) {
      const scheme = DEFAULT_CATEGORICAL_COLORS[schemeName]
      if (scheme[value]) {
        return hexToRgb(scheme[value])
      }
      if (scheme.default) {
        return hexToRgb(scheme.default)
      }
    }
  }

  // Fallback: generate color from hash
  return generateColorFromHash(String(value))
}

// Generate color from string hash (for dynamic categories)
function generateColorFromHash(value: string): [number, number, number] {
  // Simple hash function
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32-bit integer
  }

  // Generate RGB from hash
  const r = (hash & 0xff0000) >> 16
  const g = (hash & 0x00ff00) >> 8
  const b = hash & 0x0000ff

  // Ensure colors are not too dark
  return [
    Math.max(r, 80),
    Math.max(g, 80),
    Math.max(b, 80),
  ]
}

// Get numeric color using Viridis gradient
function getNumericColor(
  value: number,
  scale?: [number, number],
  minValue?: number,
  maxValue?: number
): [number, number, number] {
  // Determine scale
  let min = scale ? scale[0] : minValue || 0
  let max = scale ? scale[1] : maxValue || 100

  // Normalize value to 0-1
  let t = (value - min) / (max - min)
  t = Math.max(0, Math.min(1, t)) // Clamp to [0, 1]

  // Viridis color approximation
  return viridisColorRGB(t)
}

// Viridis gradient (polynomial approximation)
function viridisColorRGB(t: number): [number, number, number] {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t))

  // Polynomial approximation for Viridis
  // Purple → Blue → Green → Yellow
  const r = Math.max(0, Math.min(255, Math.round(255 * (0.267004 + t * (2.077963 * t - 2.141950)))))
  const g = Math.max(0, Math.min(255, Math.round(255 * (0.004874 + t * (1.385520 - 0.790116 * t)))))
  const b = Math.max(0, Math.min(255, Math.round(255 * (0.329415 + t * (1.100124 - 1.470975 * t)))))

  return [r, g, b]
}

// Calculate min/max for numeric attribute from data
function calculateNumericRange(features: any[], attribute: string): [number, number] {
  let min = Infinity
  let max = -Infinity

  features.forEach((feature) => {
    const value = feature.properties?.[attribute]
    if (typeof value === 'number') {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
  })

  // Fallback if no valid values
  if (!isFinite(min) || !isFinite(max)) {
    return [0, 100]
  }

  return [min, max]
}

// Enhanced getBaseColor with dynamic coloring support and role-aware logic
function getBaseColor(feature: any, layerConfig: LayerConfig): [number, number, number] {
  // Priority 0: Check layer role - neutral layers skip colorBy entirely
  // This enables adaptive coloring where only primary layers show data colors
  const role = layerRoles.value.get(layerConfig.name)
  if (role?.role === 'neutral') {
    // Return neutral theme color - subtle boundary without data coloring
    const styleManager = StyleManager.getInstance()
    return hexToRgb(styleManager.getColor('theme.border.default'))
  }

  // Priority 1: Use dashboard-level colorByAttribute if set (from "Color by" selector)
  // This allows the global selector to override per-layer static colors
  // Only applies to primary/secondary layers (neutral already handled above)
  if (props.colorByAttribute) {
    // Try to get attribute value from feature properties first
    let attributeValue = feature.properties?.[props.colorByAttribute]

    // If not found in feature, look up from central data table via linkage
    // This handles the case where GeoJSON has limited properties and full data is in CSV
    if (attributeValue === undefined && layerConfig.linkage && props.filteredData) {
      const featureId = getFeatureId(feature, layerConfig)
      const tableColumn = layerConfig.linkage.tableColumn

      // DEBUG: Log the first few lookups
      if (!window._colorByDebugLogged) {
        console.log('[MapCard] colorBy data join lookup:')
        console.log('  raw cluster_id:', feature.properties?.[layerConfig.linkage.geoProperty])
        console.log('  cluster_type:', feature.properties?.cluster_type)
        console.log('  constructed featureId:', featureId)
        console.log('  tableColumn:', tableColumn)
        console.log('  colorByAttribute:', props.colorByAttribute)
        console.log('  filteredData rows:', props.filteredData?.length)
        console.log('  First row sample:', props.filteredData?.[0])
        window._colorByDebugLogged = true
      }

      // Find matching row in central table
      const matchingRow = props.filteredData.find((row: any) => {
        const rowId = row[tableColumn]
        // Loose comparison for type mismatches (string "45" vs number 45)
        return rowId == featureId || String(rowId) === String(featureId)
      })

      if (matchingRow) {
        attributeValue = matchingRow[props.colorByAttribute]
      }
    }

    // If we found an attribute value, apply coloring
    if (attributeValue !== undefined) {
      // Look up the attribute config from colorByOptions to determine type
      const attrConfig = props.colorByOptions.find(opt => opt.attribute === props.colorByAttribute)
      const attrType = attrConfig?.type || 'categorical'

      if (attrType === 'numeric') {
        // Numeric coloring - calculate range from central table data
        const allValues = props.filteredData
          .map((row: any) => row[props.colorByAttribute])
          .filter((v: any) => typeof v === 'number')
        const min = Math.min(...allValues)
        const max = Math.max(...allValues)
        const scale: [number, number] = [min, max]
        return getNumericColor(attributeValue, scale)
      } else {
        // Categorical coloring
        return getCategoricalColor(attributeValue, undefined, props.colorByAttribute)
      }
    }
  }

  // Priority 2: Use per-layer colorBy if configured
  if (layerConfig.colorBy) {
    // Normalize colorBy to object form (support both string and object syntax)
    const colorBy = typeof layerConfig.colorBy === 'string'
      ? { attribute: layerConfig.colorBy, type: 'categorical' as const }
      : layerConfig.colorBy
    const attributeValue = feature.properties?.[colorBy.attribute]

    if (attributeValue === undefined || attributeValue === null) {
      console.warn(`[MapCard] Missing attribute "${colorBy.attribute}" for feature`, feature.properties)
      return [128, 128, 128] // Gray fallback
    }

    if (colorBy.type === 'categorical') {
      // Categorical coloring
      return getCategoricalColor(attributeValue, colorBy.colors, colorBy.attribute)

    } else if (colorBy.type === 'numeric') {
      // Numeric coloring
      const features = getLayerData(layerConfig.name)

      // Calculate or use provided scale
      const scale = colorBy.scale || calculateNumericRange(features, colorBy.attribute)

      return getNumericColor(attributeValue, scale)
    }
  }

  // Priority 3: Static color from config
  if (layerConfig.color) {
    return hexToRgb(layerConfig.color)
  }

  if (layerConfig.fillColor) {
    return hexToRgb(layerConfig.fillColor)
  }

  // Default blue
  return [52, 152, 219]
}

// Helper function for loose Set membership check (handles string "45" vs number 45)
function setHasLoose(set: Set<any>, value: any): boolean {
  if (set.has(value)) return true
  // Try loose comparison for type mismatches
  for (const item of set) {
    // eslint-disable-next-line eqeqeq
    if (item == value) return true
  }
  return false
}

/**
 * Get the feature ID to use for data joins with the central table.
 *
 * Handles ID mismatch between GeoJSON and CSV:
 * - GeoJSON OD flows have: cluster_type='od', cluster_id='0'
 * - CSV has: unique_id='od_0'
 *
 * This function constructs the compound ID when needed by combining
 * cluster_type and cluster_id.
 *
 * @param feature - GeoJSON feature
 * @param layerConfig - Layer configuration with linkage info
 * @returns The feature ID suitable for joining with the table
 */
function getFeatureId(feature: any, layerConfig: LayerConfig): any {
  if (!layerConfig.linkage) return undefined

  let featureId = feature.properties?.[layerConfig.linkage.geoProperty]

  // Handle ID mismatch: GeoJSON may have simple cluster_id (e.g., '0')
  // while CSV has compound unique_id (e.g., 'od_0')
  // If the featureId is numeric or doesn't contain the cluster_type prefix,
  // construct the compound ID from cluster_type + '_' + cluster_id
  const clusterType = feature.properties?.cluster_type
  if (clusterType && featureId !== undefined) {
    const featureIdStr = String(featureId)
    // Check if featureId already has the prefix (e.g., 'origin_1' already contains 'origin')
    if (!featureIdStr.startsWith(clusterType + '_') && !featureIdStr.includes('_')) {
      // Construct compound ID: 'od' + '_' + '0' = 'od_0'
      featureId = `${clusterType}_${featureIdStr}`
    }
  }

  return featureId
}

function isFeatureFiltered(feature: any, layerConfig: LayerConfig): boolean {
  if (!layerConfig.linkage) return true

  const featureId = getFeatureId(feature, layerConfig)
  const tableColumn = layerConfig.linkage.tableColumn

  // Use loose comparison to handle type mismatches (string "45" vs number 45)
  // eslint-disable-next-line eqeqeq
  return props.filteredData.some((row) => row[tableColumn] == featureId)
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128]
}

// ============================================================================
// TASK 6: Interaction Handlers
// ============================================================================

function handleClick(info: any) {
  debugLog('[MapCard] handleClick called', info.object ? 'with object' : 'without object')

  if (!info.object) {
    if (props.linkage?.onSelect === 'filter') {
      emit('select', new Set())
    }
    return
  }

  const layerId = info.layer?.id
  const layerConfig = findLayerConfigById(layerId)

  debugLog('[MapCard] layerConfig:', layerConfig?.name, 'has linkage:', !!layerConfig?.linkage)

  if (!layerConfig || !layerConfig.linkage) {
    return
  }

  const picked = pickMultipleFeatures(info, layerConfig)

  if (picked.length === 0) {
    return
  }

  // Use getFeatureId to construct compound IDs for proper table matching
  const featureIds = picked
    .map((p) => getFeatureId(p.object, layerConfig))
    .filter((id) => id !== undefined && id !== null)

  // Debug: log what we're getting from the GeoJSON
  if (picked.length > 0) {
    const firstFeature = picked[0].object
    debugLog('[MapCard] Click - geoProperty:', layerConfig.linkage!.geoProperty,
      'raw cluster_id:', firstFeature?.properties?.[layerConfig.linkage!.geoProperty],
      'constructed IDs:', featureIds,
      'first feature properties:', firstFeature?.properties)
  }

  if (featureIds.length === 0) {
    return
  }

  if (layerConfig.linkage.onSelect === 'filter') {
    const idSet = new Set(featureIds)
    emit('select', idSet)

    // Emit filter based on LAYER linkage (not card linkage)
    const filterId = `map-${layerConfig.name}`
    emit('filter', filterId, layerConfig.linkage.tableColumn, idSet)
    debugLog(`[MapCard] Emitting filter:`, filterId, layerConfig.linkage.tableColumn, idSet)
  } else if (layerConfig.linkage.onSelect === 'highlight') {
    // Just emit select for highlighting without filtering
    const idSet = new Set(featureIds)
    emit('select', idSet)
  }

  debugLog(`[MapCard] Clicked features:`, featureIds)
}

function handleHover(info: any) {
  if (!info.object) {
    emit('hover', new Set())
    return
  }

  const layerId = info.layer?.id
  const layerConfig = findLayerConfigById(layerId)

  debugLog('[MapCard] handleHover:', layerConfig?.name, 'has linkage:', !!layerConfig?.linkage)

  if (!layerConfig || !layerConfig.linkage) {
    emit('hover', new Set())
    return
  }

  const picked = pickMultipleFeatures(info, layerConfig)

  // Use getFeatureId to construct compound IDs for proper matching
  const featureIds = picked
    .map((p) => getFeatureId(p.object, layerConfig))
    .filter((id) => id !== undefined && id !== null)

  if (featureIds.length > 0) {
    emit('hover', new Set(featureIds))
  } else {
    emit('hover', new Set())
  }
}

function pickMultipleFeatures(info: any, layerConfig: LayerConfig): any[] {
  if (!deckOverlay.value) {
    return info.object ? [info] : []
  }

  const layerId = info.layer?.id
  if (!layerId) {
    return info.object ? [info] : []
  }

  try {
    const picked = (deckOverlay.value as any).pickMultipleObjects({
      x: info.x,
      y: info.y,
      radius: 2,
      layerIds: [layerId],
    })

    return picked || []
  } catch (error) {
    console.warn('[MapCard] pickMultipleObjects failed:', error)
    return info.object ? [info] : []
  }
}

function findLayerConfigById(layerId: string | undefined): LayerConfig | null {
  if (!layerId || !props.layers) return null

  for (const layerConfig of props.layers) {
    if (layerId.includes(layerConfig.name)) {
      return layerConfig
    }
  }

  return null
}

// ============================================================================
// TASK 11: ColorLegend Integration
// ============================================================================

// Check if legend should be shown
const showLegend = computed(() => {
  return props.legend?.enabled !== false
})

// Build legend data from layers
const legendData = computed(() => {
  // Check if layers exist
  if (!props.layers || props.layers.length === 0) {
    return null
  }

  // Priority 1: Use dashboard-level colorByAttribute (from "Color by" selector)
  // This is the primary way colors are applied via map.colorBy.attributes
  if (props.colorByAttribute && props.colorByOptions?.length > 0) {
    const attrConfig = props.colorByOptions.find(opt => opt.attribute === props.colorByAttribute)
    if (attrConfig) {
      // Use central table data (props.filteredData) for attribute values
      // This handles the case where attributes are in CSV, not GeoJSON
      if (props.filteredData && props.filteredData.length > 0) {
        if (attrConfig.type === 'numeric') {
          const allValues = props.filteredData
            .map((row: any) => row[props.colorByAttribute])
            .filter((v: any) => typeof v === 'number')
          const min = allValues.length > 0 ? Math.min(...allValues) : 0
          const max = allValues.length > 0 ? Math.max(...allValues) : 1
          return {
            type: 'numeric' as const,
            title: attrConfig.label || formatPropertyName(props.colorByAttribute),
            minValue: min,
            maxValue: max,
          }
        } else {
          // Categorical - get unique values from central table
          return {
            type: 'categorical' as const,
            title: attrConfig.label || formatPropertyName(props.colorByAttribute),
            items: buildCategoricalLegendItemsFromTable(props.colorByAttribute),
          }
        }
      }

      // Fallback: try to get from GeoJSON features (original behavior)
      const primaryLayer = props.layers.find(layer => {
        const role = layerRoles.value.get(layer.name)
        return role?.role === 'primary' || !role  // Include layers without roles (defaults to primary)
      }) || props.layers[0]

      if (attrConfig.type === 'numeric') {
        const features = getLayerData(primaryLayer.name)
        const [min, max] = calculateNumericRange(features, props.colorByAttribute)
        return {
          type: 'numeric' as const,
          title: attrConfig.label || formatPropertyName(props.colorByAttribute),
          minValue: min,
          maxValue: max,
        }
      } else {
        // Categorical
        return {
          type: 'categorical' as const,
          title: attrConfig.label || formatPropertyName(props.colorByAttribute),
          items: buildCategoricalLegendItemsFromAttribute(primaryLayer, props.colorByAttribute),
        }
      }
    }
  }

  // Priority 2: Find the first layer with per-layer colorBy configuration
  const colorByLayer = props.layers.find((layer) => layer.colorBy)

  if (!colorByLayer || !colorByLayer.colorBy) {
    return null
  }

  // Normalize colorBy to object form (support both string and object syntax)
  const colorBy = typeof colorByLayer.colorBy === 'string'
    ? { attribute: colorByLayer.colorBy, type: 'categorical' as const }
    : colorByLayer.colorBy

  if (colorBy.type === 'categorical') {
    return {
      type: 'categorical' as const,
      title: formatPropertyName(colorBy.attribute),
      items: buildCategoricalLegendItems(colorByLayer, colorBy),
    }
  } else if (colorBy.type === 'numeric') {
    const features = getLayerData(colorByLayer.name)
    const [min, max] = colorBy.scale || calculateNumericRange(features, colorBy.attribute)

    return {
      type: 'numeric' as const,
      title: formatPropertyName(colorBy.attribute),
      minValue: min,
      maxValue: max,
    }
  }

  return null
})

// Build categorical legend items
function buildCategoricalLegendItems(
  layerConfig: LayerConfig,
  colorBy: any
): { label: string; color: string }[] {
  const items: { label: string; color: string }[] = []

  // If custom colors provided, use those
  if (colorBy.colors) {
    Object.entries(colorBy.colors).forEach(([value, color]) => {
      items.push({
        label: String(value),
        color: String(color),
      })
    })
    return items
  }

  // Otherwise, get unique values from data and generate colors
  const features = getLayerData(layerConfig.name)
  const uniqueValues = new Set<any>()

  features.forEach((feature) => {
    const value = feature.properties?.[colorBy.attribute]
    if (value !== undefined && value !== null) {
      uniqueValues.add(value)
    }
  })

  uniqueValues.forEach((value) => {
    const rgb = getCategoricalColor(value, colorBy.colors, colorBy.attribute)
    const hexColor = rgbToHex(rgb)

    items.push({
      label: String(value),
      color: hexColor,
    })
  })

  return items
}

// Build categorical legend items from dashboard-level colorByAttribute
function buildCategoricalLegendItemsFromAttribute(
  layerConfig: LayerConfig,
  attribute: string
): { label: string; color: string }[] {
  const items: { label: string; color: string }[] = []
  const features = getLayerData(layerConfig.name)

  // Collect unique values from features
  const uniqueValues = new Set<any>()
  features.forEach((feature) => {
    const value = feature.properties?.[attribute]
    if (value !== undefined && value !== null) {
      uniqueValues.add(value)
    }
  })

  uniqueValues.forEach((value) => {
    const rgb = getCategoricalColor(value, undefined, attribute)
    const hexColor = rgbToHex(rgb)

    items.push({
      label: String(value),
      color: hexColor,
    })
  })

  return items
}

// Build categorical legend items from central table data (props.filteredData)
function buildCategoricalLegendItemsFromTable(
  attribute: string
): { label: string; color: string }[] {
  const items: { label: string; color: string }[] = []

  if (!props.filteredData || props.filteredData.length === 0) {
    return items
  }

  // Collect unique values from table rows
  const uniqueValues = new Set<any>()
  props.filteredData.forEach((row: any) => {
    const value = row[attribute]
    if (value !== undefined && value !== null) {
      uniqueValues.add(value)
    }
  })

  uniqueValues.forEach((value) => {
    const rgb = getCategoricalColor(value, undefined, attribute)
    const hexColor = rgbToHex(rgb)

    items.push({
      label: String(value),
      color: hexColor,
    })
  })

  return items
}

// Handle legend item click (categorical only)
function handleLegendItemClick(label: string) {
  if (!props.legend?.clickToFilter || !props.layers) {
    return
  }

  // Find the layer with colorBy configuration
  const colorByLayer = props.layers.find((layer) => layer.colorBy)

  if (!colorByLayer || !colorByLayer.linkage) {
    console.warn('[MapCard] Legend click-to-filter requires linkage configuration')
    return
  }

  // Emit filter for this category
  const filterId = `map-legend-${colorByLayer.name}`
  const column = colorByLayer.linkage.tableColumn
  const values = new Set([label])

  emit('filter', filterId, column, values)

  debugLog(`[MapCard] Legend filter: ${column} = ${label}`)
}

// RGB to Hex converter
function rgbToHex(rgb: [number, number, number]): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

// Watch for data changes to trigger layer updates
watch(
  [() => props.filteredData, () => props.hoveredIds, () => props.selectedIds],
  () => {
    updateLayers()
  },
  { deep: true }
)

// Watch for comparison mode changes
watch(
  () => props.showComparison,
  () => {
    debugLog('[MapCard] Comparison mode changed:', props.showComparison)
    updateLayers()
  }
)

// ============================================================================
// CLEANUP
// ============================================================================

function cleanup() {
  if (deckOverlay.value) {
    deckOverlay.value.finalize()
    deckOverlay.value = null
  }
  if (map.value) {
    map.value.remove()
    map.value = null
  }
}
</script>

<style scoped>
.map-card {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.map-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  background: var(--dashboard-bg-secondary, var(--bgPanel, #f8f9fa));
  border-bottom: 1px solid var(--dashboard-border-default, var(--borderColor, #e5e7eb));
}

.control-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.control-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--dashboard-text-primary, var(--text, #374151));
  opacity: 0.8;
}

.control-select {
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  border: 1px solid var(--dashboard-border-default, var(--borderColor, #d1d5db));
  border-radius: 4px;
  background: var(--dashboard-bg-primary, var(--bgCream, white));
  color: var(--dashboard-text-primary, var(--text, #374151));
  cursor: pointer;
  min-width: 100px;
}

.control-select:hover {
  border-color: var(--dashboard-interaction-selected, var(--link, #3b82f6));
}

.control-select:focus {
  outline: none;
  border-color: var(--dashboard-interaction-selected, var(--link, #3b82f6));
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.map-container {
  flex: 1;
  min-height: 0;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--dashboard-bg-primary, rgba(255, 255, 255, 0.9));
  color: var(--dashboard-text-primary, #374151);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 1000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--dashboard-border-default, #e5e7eb);
  border-top-color: var(--dashboard-interaction-selected, #3b82f6);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Tooltip styles (injected via getTooltip) */
:global(.mapcard-tooltip) {
  font-size: 12px;
  line-height: 1.5;
}

:global(.tooltip-row) {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

:global(.tooltip-key) {
  font-weight: 600;
  min-width: 80px;
}

:global(.tooltip-value) {
  flex: 1;
}

:global(.tooltip-highlight) {
  background-color: color-mix(in srgb, var(--dashboard-interaction-selected) 15%, transparent);
  padding: 0.25rem 0.5rem;
  margin: -0.25rem -0.5rem 0.25rem -0.5rem;
  border-radius: 4px;
}

:global(.tooltip-highlight .tooltip-value) {
  font-weight: 700;
  color: var(--dashboard-interaction-selected);
}

:global(.tooltip-divider) {
  border: none;
  border-top: 1px solid var(--dashboard-border-default);
  margin: 0.5rem 0;
}
</style>
