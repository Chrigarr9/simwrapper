<template>
  <div class="map-card">
    <div v-if="title" class="map-card-title">
      {{ title }}
    </div>
    <div :id="mapId" class="map-container"></div>
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <div>Loading map...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PolygonLayer, LineLayer, ArcLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Position } from '@deck.gl/core'
import { fileSystemConfig } from '@/Globals'
import globalStore from '@/store'

// Types
interface LayerConfig {
  name: string
  file: string
  type: 'polygon' | 'line' | 'arc' | 'scatterplot'
  visible?: boolean
  zIndex?: number

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

  // Dynamic coloring
  colorBy?: {
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
  }
}

interface Props {
  // From LinkableCardWrapper slot
  filteredData: any[]
  hoveredIds: Set<any>
  selectedIds: Set<any>

  // From YAML config
  title?: string
  center?: [number, number]
  zoom?: number
  mapStyle?: 'light' | 'dark' | 'auto'
  layers: LayerConfig[]
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
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [13.4, 52.52],
  zoom: 10,
  mapStyle: 'auto',
  showComparison: false,
})

// Emits
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
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

// Dark mode access from global store (Critical Fix #2)
const isDarkMode = computed(() => globalStore.state.isDarkMode)

// File API access
const fileApi = computed(() => {
  return props.fileSystemConfig || fileSystemConfig
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
        resolve()
      })
    })

    console.log('[MapCard] MapLibre initialized')
  } catch (error) {
    console.error('[MapCard] Failed to initialize map:', error)
    isLoading.value = false
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
    console.log('[MapCard] No layers to load')
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

        console.log(`[MapCard] Loaded layer "${layerConfig.name}": ${filteredFeatures.length} features`)
      } catch (error) {
        console.error(`[MapCard] Failed to load layer "${layerConfig.name}":`, error)
        // Store empty array on failure so layer system doesn't crash
        layerData.value.set(layerConfig.name, [])
      }
    })

    await Promise.all(loadPromises)

    console.log('[MapCard] All layers loaded')
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
  return layerConfig.visible !== false
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
  console.log('[MapCard] Deck.gl overlay initialized')
}

function getTooltipContent(object: any): any {
  if (!object || !props.tooltip?.enabled) {
    return null
  }

  const properties = object.properties || {}
  let html = '<div style="padding: 8px; max-width: 300px;">'

  Object.entries(properties).slice(0, 10).forEach(([key, value]) => {
    if (key.startsWith('_')) return
    html += `<div><strong>${key}:</strong> ${value}</div>`
  })

  html += '</div>'

  return {
    html,
    style: {
      backgroundColor: isDarkMode.value ? '#1f2937' : 'white',
      color: isDarkMode.value ? '#e5e7eb' : '#111827',
      fontSize: '12px',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      maxWidth: '300px',
      pointerEvents: 'none',
    },
  }
}

// ============================================================================
// TASKS 4-5: Layer Factories and Update System
// ============================================================================

function updateLayers() {
  if (!deckOverlay.value) {
    console.warn('[MapCard] Cannot update layers: overlay not initialized')
    return
  }

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

    let layer: any = null

    switch (layerConfig.type) {
      case 'polygon':
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
        layer = createScatterplotLayer(layerConfig, features)
        break

      default:
        console.warn(`[MapCard] Unknown layer type: ${layerConfig.type}`)
    }

    if (layer) {
      layers.push(layer)
    }
  })

  deckOverlay.value.setProps({ layers })
  console.log(`[MapCard] Updated ${layers.length} layers`)
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
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData],
        getLineColor: [props.hoveredIds, props.selectedIds, props.filteredData],
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
        getColor: [props.hoveredIds, props.selectedIds, props.filteredData],
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

      getRadius: (d: any) => {
        const featureId = d.properties?.[layerConfig.linkage?.geoProperty || 'id']
        const isHovered = props.hoveredIds.has(featureId)
        const isSelected = props.selectedIds.has(featureId)
        const isFiltered = isFeatureFiltered(d, layerConfig)
        const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)

        if (isHovered) return 8
        if (isSelected) return 5
        if (hasActiveFilters && !isFiltered) return 2
        return 3
      },

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getRadius: [props.hoveredIds, props.selectedIds, props.filteredData],
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData],
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
        getSourceColor: [props.hoveredIds, props.selectedIds, props.filteredData],
        getTargetColor: [props.hoveredIds, props.selectedIds, props.filteredData],
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

      getRadius: (d: any) => {
        const featureId = d.properties?.[layerConfig.linkage?.geoProperty || 'id']
        const isHovered = props.hoveredIds.has(featureId)
        const isSelected = props.selectedIds.has(featureId)
        const isFiltered = isFeatureFiltered(d, layerConfig)
        const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)

        if (isHovered) return 6
        if (isSelected) return 5
        if (hasActiveFilters && !isFiltered) return 2
        return 4
      },

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getRadius: [props.hoveredIds, props.selectedIds, props.filteredData],
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData],
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

      getRadius: (d: any) => {
        const featureId = d.properties?.[layerConfig.linkage?.geoProperty || 'id']
        const isHovered = props.hoveredIds.has(featureId)
        const isSelected = props.selectedIds.has(featureId)
        const isFiltered = isFeatureFiltered(d, layerConfig)
        const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)

        const baseRadius = layerConfig.radius || 5

        if (isHovered) return baseRadius * 1.5
        if (isSelected) return baseRadius * 1.2
        if (hasActiveFilters && !isFiltered) return baseRadius * 0.5
        return baseRadius
      },

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getRadius: [props.hoveredIds, props.selectedIds, props.filteredData],
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData],
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
    const aId = a.properties?.[layerConfig.linkage!.geoProperty]
    const bId = b.properties?.[layerConfig.linkage!.geoProperty]

    const aSelected = props.selectedIds.has(aId)
    const bSelected = props.selectedIds.has(bId)
    const aHovered = props.hoveredIds.has(aId)
    const bHovered = props.hoveredIds.has(bId)

    if (aSelected && !bSelected) return 1
    if (!aSelected && bSelected) return -1
    if (aHovered && !bHovered) return 1
    if (!aHovered && bHovered) return -1

    return 0
  })
}

function getFeatureFillColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']

  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)

  if (isSelected) {
    return [59, 130, 246, 120]
  }

  if (isHovered) {
    return [251, 146, 60, 100]
  }

  if (hasActiveFilters && !isFiltered) {
    return [180, 180, 180, 80]
  }

  if (layerConfig.fillColor) {
    const rgb = hexToRgb(layerConfig.fillColor)
    const opacity = Math.round((layerConfig.fillOpacity || 0.5) * 255)
    return [rgb[0], rgb[1], rgb[2], opacity]
  }

  return [156, 163, 175, 60]
}

function getFeatureLineColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']

  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)

  if (isSelected) {
    return [59, 130, 246, 255]
  }

  if (isHovered) {
    return [251, 146, 60, 255]
  }

  if (layerConfig.lineColor) {
    const rgb = hexToRgb(layerConfig.lineColor)
    return [rgb[0], rgb[1], rgb[2], 255]
  }

  return [100, 100, 100, 255]
}

function getFeatureLineWidth(feature: any, layerConfig: LayerConfig): number {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']

  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)

  if (isSelected) return 4
  if (isHovered) return 3

  return layerConfig.lineWidth || 2
}

function getFeatureWidth(feature: any, layerConfig: LayerConfig): number {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']
  const isHovered = props.hoveredIds.has(featureId)
  const isSelected = props.selectedIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)

  const baseWidth = layerConfig.width || 2

  if (isHovered) return baseWidth * 3
  if (isSelected) return baseWidth * 2
  if (hasActiveFilters && !isFiltered) return 1
  return baseWidth
}

function getFeatureColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']
  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < (layerData.value.get(layerConfig.name)?.length || 0)

  if (isSelected) {
    return [59, 130, 246, 255]
  }

  if (isHovered) {
    return [251, 146, 60, 255]
  }

  if (hasActiveFilters && !isFiltered) {
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

function getBaseColor(feature: any, layerConfig: LayerConfig): [number, number, number] {
  if (layerConfig.color) {
    return hexToRgb(layerConfig.color)
  }

  return [52, 152, 219]
}

function isFeatureFiltered(feature: any, layerConfig: LayerConfig): boolean {
  if (!layerConfig.linkage) return true

  const featureId = feature.properties?.[layerConfig.linkage.geoProperty]
  const tableColumn = layerConfig.linkage.tableColumn

  return props.filteredData.some((row) => row[tableColumn] === featureId)
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
  if (!info.object) {
    if (props.linkage?.onSelect === 'filter') {
      emit('select', new Set())
    }
    return
  }

  const layerId = info.layer?.id
  const layerConfig = findLayerConfigById(layerId)

  if (!layerConfig || !layerConfig.linkage) {
    return
  }

  const picked = pickMultipleFeatures(info, layerConfig)

  if (picked.length === 0) {
    return
  }

  const featureIds = picked
    .map((p) => p.object?.properties?.[layerConfig.linkage!.geoProperty])
    .filter((id) => id !== undefined && id !== null)

  if (featureIds.length === 0) {
    return
  }

  if (layerConfig.linkage.onSelect === 'filter') {
    const idSet = new Set(featureIds)
    emit('select', idSet)

    if (props.linkage?.type === 'filter') {
      const filterId = `map-${layerConfig.name}`
      emit('filter', filterId, layerConfig.linkage.tableColumn, idSet)
    }
  }

  console.log(`[MapCard] Clicked features:`, featureIds)
}

function handleHover(info: any) {
  if (!info.object) {
    emit('hover', new Set())
    return
  }

  const layerId = info.layer?.id
  const layerConfig = findLayerConfigById(layerId)

  if (!layerConfig || !layerConfig.linkage) {
    emit('hover', new Set())
    return
  }

  const picked = pickMultipleFeatures(info, layerConfig)

  const featureIds = picked
    .map((p) => p.object?.properties?.[layerConfig.linkage!.geoProperty])
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
  if (!layerId) return null

  for (const layerConfig of props.layers) {
    if (layerId.includes(layerConfig.name)) {
      return layerConfig
    }
  }

  return null
}

// Watch for data changes to trigger layer updates
watch(
  [() => props.filteredData, () => props.hoveredIds, () => props.selectedIds],
  () => {
    updateLayers()
  },
  { deep: true }
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

.map-card-title {
  padding: 0.5rem 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
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
  background: rgba(255, 255, 255, 0.9);
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
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
