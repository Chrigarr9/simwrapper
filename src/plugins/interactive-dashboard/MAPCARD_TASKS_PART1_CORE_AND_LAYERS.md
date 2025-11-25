# MapCard Implementation Tasks - Part 1: Core Component & Layer System

**Document Version**: 1.0
**Created**: 2025-11-25
**Purpose**: Detailed, self-contained tasks for implementing the core MapCard component and basic layer system

---

## Overview

This document contains the first part of MapCard implementation tasks, focusing on:
- Core MapCard component structure with proper props/emits
- MapLibre GL initialization with theme switching
- GeoJSON data loading system
- Layer factory implementations (Polygon, Line, Arc, Scatterplot)
- Automatic marker generation for LineLayer and ArcLayer

**Dependencies**:
- FilterManager, LinkageManager, DataTableManager (already implemented)
- LinkableCardWrapper (already implemented)
- InteractiveDashboard coordination system (already implemented)

**Total Tasks in Part 1**: 6 tasks

---

# TASK 1: Create MapCard.vue Component Skeleton

**Objective**: Create the base MapCard.vue component with proper structure, props interface, emits, and lifecycle hooks

**Estimated Effort**: Medium (2-3 hours)

## Context Files to Read

1. **HistogramCard.vue** - `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/HistogramCard.vue`
   - Lines 1-50: Overall component structure (Composition API with `<script setup>`)
   - Lines 10-20: Props interface pattern
   - Lines 22-24: Emits definition
   - Lines 70-95: How to emit filter events

2. **PieChartCard.vue** - `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/PieChartCard.vue`
   - Similar structure for reference

3. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 1-50: Overall map component structure
   - Lines 100-130: Props pattern for maps
   - Lines 140-150: Emits pattern for maps

## Key Patterns to Extract

From HistogramCard.vue:
```typescript
// Composition API pattern
interface Props {
  title?: string
  column: string
  filteredData: any[]  // FROM LinkableCardWrapper slot
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
}>()
```

From RequestsMap.vue:
```typescript
// Map-specific patterns
const mapId = ref(`map-${Math.random().toString(36).substring(7)}`)
const map = ref<maplibregl.Map | null>(null)
const deckOverlay = ref<MapboxOverlay | null>(null)

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (map.value) {
    map.value.remove()
  }
})
```

## Implementation Steps

### Step 1: Create the component file

Create `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

### Step 2: Define the Props Interface

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PolygonLayer, LineLayer, ArcLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Position } from '@deck.gl/core'

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

interface MapConfig {
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

  // Theme
  isDarkMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  center: () => [13.4, 52.52],
  zoom: 10,
  mapStyle: 'auto',
  isDarkMode: false,
  showComparison: false,
})

// Emits
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
}>()
</script>
```

### Step 3: Define component state

```typescript
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
```

### Step 4: Create lifecycle hooks

```typescript
onMounted(async () => {
  await initMap()
  await loadLayerData()
  updateLayers()
})

onUnmounted(() => {
  cleanup()
})

// Cleanup function
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
```

### Step 5: Create placeholder methods (will be implemented in later tasks)

```typescript
// Placeholder methods - to be implemented in subsequent tasks

async function initMap() {
  // TASK 2: Initialize MapLibre
  console.log('TODO: Initialize MapLibre map')
}

async function loadLayerData() {
  // TASK 3: Load GeoJSON data for all layers
  console.log('TODO: Load layer data')
}

function updateLayers() {
  // TASKS 4-5: Create and update Deck.gl layers
  console.log('TODO: Update Deck.gl layers')
}

function handleClick(info: any) {
  // TASK 6: Handle click events
  console.log('TODO: Handle click', info)
}

function handleHover(info: any) {
  // TASK 6: Handle hover events
  console.log('TODO: Handle hover', info)
}
```

### Step 6: Create template

```vue
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
```

## Files Created

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Files Modified

None

## Acceptance Criteria

- ✅ Component file created with proper structure
- ✅ Props interface matches LinkableCardWrapper slot pattern
- ✅ Emits defined for filter, hover, select events
- ✅ Lifecycle hooks (onMounted, onUnmounted) in place
- ✅ Placeholder methods for all major functionality
- ✅ Template with map container and loading state
- ✅ Component compiles without errors
- ✅ TypeScript types are correct and complete

---

# TASK 2: Implement MapLibre Initialization with Theme Switching

**Objective**: Implement MapLibre GL map initialization with automatic theme switching based on dark mode

**Estimated Effort**: Small (1-2 hours)

**Dependencies**: TASK 1 completed

## Context Files to Read

1. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 174-195: MapLibre initialization with theme
   - Lines 155-173: Watch for theme changes
   - Lines 1015-1040: Auto fit bounds implementation

## Key Patterns to Extract

```typescript
// From RequestsMap.vue lines 174-195
initMap() {
  const mapStyle = this.isDarkMode
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

  this.map = new maplibregl.Map({
    container: this.mapId,
    style: mapStyle,
    center: [13.4, 52.52],
    zoom: 10,
  })

  this.map.on('load', () => {
    this.isLoading = false
    this.initDeckOverlay()
    this.updateLayers()
    this.fitBounds()
  })
}

// Theme switching watch
watch: {
  isDarkMode(newVal) {
    if (this.map) {
      const mapStyle = newVal
        ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
        : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
      this.map.setStyle(mapStyle)
    }
  }
}
```

## Implementation

In `MapCard.vue`, replace the `initMap()` placeholder:

```typescript
async function initMap(): Promise<void> {
  if (map.value) {
    console.warn('Map already initialized')
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

  // Auto mode: use isDarkMode prop
  return props.isDarkMode
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
}

// Watch for theme changes
watch(() => props.isDarkMode, (newVal) => {
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
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ MapLibre map initializes correctly
- ✅ Theme switching works (light/dark/auto modes)
- ✅ Map uses center and zoom from props
- ✅ Loading state clears after map loads
- ✅ Auto-fit bounds works when layer data is available
- ✅ Style changes don't break the map
- ✅ No console errors on initialization

---

# TASK 3: Implement GeoJSON Data Loading System

**Objective**: Implement system to load and process GeoJSON files for all configured layers

**Estimated Effort**: Medium (2-3 hours)

**Dependencies**: TASK 1, TASK 2 completed

## Context Files to Read

1. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 200-250: How geometries are loaded and processed
   - Lines 297-314: Deep cloning pattern for Vue reactivity

2. **DataTableManager.ts** - `/home/user/simwrapper/src/plugins/interactive-dashboard/managers/DataTableManager.ts`
   - Lines 34-48: File loading pattern using fileService

3. **CommuterRequests.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/CommuterRequests.vue`
   - Lines 140-180: Loading GeoJSON files

## Key Patterns to Extract

```typescript
// Deep cloning for Vue reactivity (CRITICAL)
const clonedData = JSON.parse(JSON.stringify(rawGeoJSON))

// File loading pattern
async loadGeoJSON(filename: string): Promise<any> {
  const response = await fileApi.fetch(subfolder + '/' + filename)
  const text = await response.text()
  return JSON.parse(text)
}

// Property-based filtering
function filterFeatures(features: any[], filters: any[]): any[] {
  return features.filter(feature => {
    return filters.every(f => {
      return feature.properties[f.property] === f.value
    })
  })
}
```

## Implementation

Add to `MapCard.vue`:

```typescript
// Add to imports
import { fileSystemConfig } from '@/Globals'

// Add computed for file API
const fileApi = computed(() => {
  return props.fileSystemConfig || fileSystemConfig
})

// Implement loadLayerData
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

        // Deep clone to avoid Vue reactivity issues with deck.gl
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
    const response = await fileApi.value.fetch(filepath)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const text = await response.text()
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
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ All layer GeoJSON files load in parallel
- ✅ Deep cloning applied to all loaded data
- ✅ Property filters applied correctly
- ✅ Failed layer loads don't crash the component
- ✅ Layer data stored in Map keyed by layer name
- ✅ Helper functions for accessing layer data
- ✅ Console logging for debugging
- ✅ No Vue reactivity warnings in console

---

# TASK 4: Implement Deck.gl Overlay and PolygonLayer Factory

**Objective**: Initialize Deck.gl overlay and implement PolygonLayer factory with state-based styling

**Estimated Effort**: Large (3-4 hours)

**Dependencies**: TASK 1, TASK 2, TASK 3 completed

## Context Files to Read

1. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 197-296: Deck.gl overlay initialization with tooltips
   - Lines 315-481: PolygonLayer implementation with complete styling
   - Lines 876-879: UpdateTriggers pattern

2. **INTERACTIVE_MAP_IMPLEMENTATION.md** - `/home/user/simwrapper/src/plugins/interactive-dashboard/INTERACTIVE_MAP_IMPLEMENTATION.md`
   - Lines 32-43: Multi-select and visual feedback requirements
   - Lines 150-167: UpdateTriggers optimization details

## Key Patterns to Extract

```typescript
// Deck.gl overlay initialization
this.deckOverlay = new MapboxOverlay({
  layers: [],
  getTooltip: ({ object }: any) => {
    if (object) {
      return {
        html: `<div>...</div>`,
        style: { /* theme-aware styling */ },
      }
    }
    return null
  },
})

this.map.addControl(this.deckOverlay as any)

// PolygonLayer pattern
new PolygonLayer({
  id: 'layer-id',
  data: features,
  pickable: true,
  stroked: true,
  filled: true,
  wireframe: true,

  getPolygon: (d: any) => {
    if (d.geometry.type === 'Polygon') {
      return d.geometry.coordinates[0]
    } else if (d.geometry.type === 'MultiPolygon') {
      return d.geometry.coordinates[0][0]
    }
  },

  getFillColor: (d: any) => {
    // State-based styling
    if (isSelected) return [59, 130, 246, 120]
    if (isHovered) return [251, 146, 60, 100]
    return [156, 163, 175, 60]
  },

  updateTriggers: {
    getFillColor: [selectedIds, hoveredIds, filteredData],
    getLineColor: [selectedIds, hoveredIds],
    getLineWidth: [selectedIds, hoveredIds],
  },
})
```

## Implementation

Add to `MapCard.vue`:

```typescript
// Initialize Deck.gl overlay (called after map loads)
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

// Tooltip content generator
function getTooltipContent(object: any): any {
  if (!object || !props.tooltip?.enabled) {
    return null
  }

  // Simple tooltip - will be enhanced in Part 2
  const properties = object.properties || {}

  let html = '<div style="padding: 8px; max-width: 300px;">'

  // Display all properties (basic version)
  Object.entries(properties).forEach(([key, value]) => {
    html += `<div><strong>${key}:</strong> ${value}</div>`
  })

  html += '</div>'

  return {
    html,
    style: {
      backgroundColor: props.isDarkMode ? '#1f2937' : 'white',
      color: props.isDarkMode ? '#e5e7eb' : '#111827',
      fontSize: '12px',
      borderRadius: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    },
  }
}

// Update layers (main render function)
function updateLayers() {
  if (!deckOverlay.value) {
    console.warn('[MapCard] Cannot update layers: overlay not initialized')
    return
  }

  const layers: any[] = []

  // Create layers for each configured layer
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

      // Other layer types will be implemented in TASK 5
      case 'line':
      case 'arc':
      case 'scatterplot':
        console.warn(`[MapCard] Layer type "${layerConfig.type}" not yet implemented`)
        break

      default:
        console.warn(`[MapCard] Unknown layer type: ${layerConfig.type}`)
    }

    if (layer) {
      layers.push(layer)
    }
  })

  // Update deck overlay
  deckOverlay.value.setProps({ layers })
  console.log(`[MapCard] Updated ${layers.length} layers`)
}

// PolygonLayer factory
function createPolygonLayer(layerConfig: LayerConfig, features: any[]): PolygonLayer | null {
  try {
    // Sort features: selected first, then hovered, then others
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
          return coords[0] // Outer ring
        } else if (d.geometry.type === 'MultiPolygon') {
          return coords[0][0] // First polygon's outer ring
        }

        console.warn('[MapCard] Unsupported polygon geometry type:', d.geometry.type)
        return []
      },

      getFillColor: (d: any) => getFeatureFillColor(d, layerConfig),
      getLineColor: (d: any) => getFeatureLineColor(d, layerConfig),
      getLineWidth: (d: any) => getFeatureLineWidth(d, layerConfig),

      // Event handlers (will be implemented in Part 2)
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

// Sort features by state (selected > hovered > normal)
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

    // Selected items render last (on top)
    if (aSelected && !bSelected) return 1
    if (!aSelected && bSelected) return -1

    // Hovered items render second
    if (aHovered && !bHovered) return 1
    if (!aHovered && bHovered) return -1

    return 0
  })
}

// Get fill color based on state and config
function getFeatureFillColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']

  // Check state
  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

  // State-based colors (priority order)
  if (isSelected) {
    return [59, 130, 246, 120] // Blue
  }

  if (isHovered) {
    return [251, 146, 60, 100] // Orange
  }

  // Dimmed if not filtered when filters are active
  if (hasActiveFilters && !isFiltered) {
    return [180, 180, 180, 80] // Dimmed gray
  }

  // Default color from config
  if (layerConfig.fillColor) {
    const rgb = hexToRgb(layerConfig.fillColor)
    const opacity = Math.round((layerConfig.fillOpacity || 0.5) * 255)
    return [rgb[0], rgb[1], rgb[2], opacity]
  }

  return [156, 163, 175, 60] // Default gray
}

// Get line color
function getFeatureLineColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']

  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)

  if (isSelected) {
    return [59, 130, 246, 255] // Blue
  }

  if (isHovered) {
    return [251, 146, 60, 255] // Orange
  }

  // Default from config
  if (layerConfig.lineColor) {
    const rgb = hexToRgb(layerConfig.lineColor)
    return [rgb[0], rgb[1], rgb[2], 255]
  }

  return [100, 100, 100, 255] // Default dark gray
}

// Get line width
function getFeatureLineWidth(feature: any, layerConfig: LayerConfig): number {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']

  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)

  if (isSelected) return 4
  if (isHovered) return 3

  return layerConfig.lineWidth || 2
}

// Check if feature is in filtered data
function isFeatureFiltered(feature: any, layerConfig: LayerConfig): boolean {
  if (!layerConfig.linkage) return true

  const featureId = feature.properties?.[layerConfig.linkage.geoProperty]
  const tableColumn = layerConfig.linkage.tableColumn

  return props.filteredData.some((row) => row[tableColumn] === featureId)
}

// Hex to RGB converter
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [128, 128, 128]
}

// Watch for data changes to trigger layer updates
watch(
  [() => props.filteredData, () => props.hoveredIds, () => props.selectedIds],
  () => {
    updateLayers()
  },
  { deep: true }
)
```

Update `onMounted`:

```typescript
onMounted(async () => {
  await initMap()
  await loadLayerData()
  initDeckOverlay()
  updateLayers()
  fitBounds()
})
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Deck.gl overlay initializes after map loads
- ✅ PolygonLayer renders correctly
- ✅ State-based colors work (selected blue, hovered orange)
- ✅ Features sort correctly (selected on top)
- ✅ UpdateTriggers cause proper re-renders
- ✅ Basic tooltips display
- ✅ Multi-polygon geometries handled correctly
- ✅ Layer updates when filteredData/hoveredIds/selectedIds change
- ✅ No console errors or warnings

---

# TASK 5: Implement LineLayer, ArcLayer, and ScatterplotLayer Factories

**Objective**: Implement remaining layer factories with automatic marker generation for LineLayer and ArcLayer

**Estimated Effort**: Large (4-5 hours)

**Dependencies**: TASK 1-4 completed

## Context Files to Read

1. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 733-813: LineLayer implementation
   - Lines 815-882: ScatterplotLayer for destination markers
   - Lines 484-651: ArcLayer implementation with flow arrows
   - Lines 876-879: UpdateTriggers for all layers

2. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 24-31: Automatic marker generation requirements
   - Lines 32-43: Visual feedback and dimming

## Key Patterns to Extract

```typescript
// LineLayer with getSourcePosition and getTargetPosition
new LineLayer({
  id: 'lines',
  data: features,
  getWidth: (d) => isHovered ? 6 : isFiltered ? 4 : 2,
  getSourcePosition: (d) => d.geometry.coordinates[0],
  getTargetPosition: (d) => d.geometry.coordinates[1],
  getColor: (d) => [...baseColor, opacity],
})

// Automatic destination markers for LineLayer
new ScatterplotLayer({
  id: 'line-destinations',
  data: features,
  getPosition: (d) => d.geometry.coordinates[1], // Destination point
  getRadius: (d) => isHovered ? 8 : 5,
  getFillColor: (d) => matchLineColor(d),
  getLineColor: [255, 255, 255, 200], // White outline
})

// ArcLayer
new ArcLayer({
  id: 'arcs',
  data: features,
  getSourcePosition: (d) => d.geometry.coordinates[0],
  getTargetPosition: (d) => d.geometry.coordinates[1],
  getWidth: (d) => normalizedWidth,
  getTilt: () => 25,
  getHeight: () => 0.2,
})

// Automatic arrow tips for ArcLayer
new ScatterplotLayer({
  id: 'arc-tips',
  data: features,
  getPosition: (d) => d.geometry.coordinates[1], // Target point
  getRadius: () => 4,
  getFillColor: (d) => matchArcColor(d),
})
```

## Implementation

Add to `MapCard.vue` in the `updateLayers()` function:

```typescript
// In updateLayers(), add to switch statement:
switch (layerConfig.type) {
  case 'polygon':
    layer = createPolygonLayer(layerConfig, features)
    break

  case 'line':
    layer = createLineLayer(layerConfig, features)
    layers.push(layer)

    // Automatic destination markers
    const lineMarkers = createLineDestinationMarkers(layerConfig, features)
    if (lineMarkers) layers.push(lineMarkers)
    continue // Skip single push at end

  case 'arc':
    layer = createArcLayer(layerConfig, features)
    layers.push(layer)

    // Automatic arrow tips
    const arcTips = createArcArrowTips(layerConfig, features)
    if (arcTips) layers.push(arcTips)
    continue // Skip single push at end

  case 'scatterplot':
    layer = createScatterplotLayer(layerConfig, features)
    break

  default:
    console.warn(`[MapCard] Unknown layer type: ${layerConfig.type}`)
}
```

Now implement the layer factories:

```typescript
// LineLayer factory
function createLineLayer(layerConfig: LayerConfig, features: any[]): LineLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new LineLayer({
      id: `line-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,

      getSourcePosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords[0] as Position
      },

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
        return coords[coords.length - 1] as Position // Destination point
      },

      getRadius: (d: any) => {
        const featureId = d.properties?.[layerConfig.linkage?.geoProperty || 'id']
        const isHovered = props.hoveredIds.has(featureId)
        const isSelected = props.selectedIds.has(featureId)
        const isFiltered = isFeatureFiltered(d, layerConfig)
        const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

        if (isHovered) return 8
        if (isSelected) return 5
        if (hasActiveFilters && !isFiltered) return 2
        return 3
      },

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),

      getLineColor: [255, 255, 255, 200], // White outline
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

// ArcLayer factory
function createArcLayer(layerConfig: LayerConfig, features: any[]): ArcLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new ArcLayer({
      id: `arc-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,
      greatCircle: false, // Simple arcs, not great circle

      getSourcePosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords[0] as Position
      },

      getTargetPosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords[1] as Position
      },

      getWidth: (d: any) => getFeatureWidth(d, layerConfig),

      getSourceColor: (d: any) => getFeatureColor(d, layerConfig),
      getTargetColor: (d: any) => getFeatureColor(d, layerConfig), // Match source

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

      getPosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords[1] as Position // Target point
      },

      getRadius: (d: any) => {
        const featureId = d.properties?.[layerConfig.linkage?.geoProperty || 'id']
        const isHovered = props.hoveredIds.has(featureId)
        const isSelected = props.selectedIds.has(featureId)
        const isFiltered = isFeatureFiltered(d, layerConfig)
        const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

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

// ScatterplotLayer factory
function createScatterplotLayer(layerConfig: LayerConfig, features: any[]): ScatterplotLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new ScatterplotLayer({
      id: `scatterplot-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 20,

      getPosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords as Position
      },

      getRadius: (d: any) => {
        const featureId = d.properties?.[layerConfig.linkage?.geoProperty || 'id']
        const isHovered = props.hoveredIds.has(featureId)
        const isSelected = props.selectedIds.has(featureId)
        const isFiltered = isFeatureFiltered(d, layerConfig)
        const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

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

// Generic feature width calculation
function getFeatureWidth(feature: any, layerConfig: LayerConfig): number {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']
  const isHovered = props.hoveredIds.has(featureId)
  const isSelected = props.selectedIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

  const baseWidth = layerConfig.width || 2

  if (isHovered) return baseWidth * 3
  if (isSelected) return baseWidth * 2
  if (hasActiveFilters && !isFiltered) return 1
  return baseWidth
}

// Generic feature color calculation
function getFeatureColor(feature: any, layerConfig: LayerConfig): [number, number, number, number] {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']
  const isSelected = props.selectedIds.has(featureId)
  const isHovered = props.hoveredIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

  // State-based colors (priority)
  if (isSelected) {
    return [59, 130, 246, 255] // Blue
  }

  if (isHovered) {
    return [251, 146, 60, 255] // Orange
  }

  // Dimmed if not filtered when filters are active
  if (hasActiveFilters && !isFiltered) {
    const baseColor = getBaseColor(feature, layerConfig)
    // Desaturate by averaging with gray
    const dimmed: [number, number, number] = [
      Math.round((baseColor[0] + 180) / 2),
      Math.round((baseColor[1] + 180) / 2),
      Math.round((baseColor[2] + 180) / 2),
    ]
    return [dimmed[0], dimmed[1], dimmed[2], 60]
  }

  // Default color
  const baseColor = getBaseColor(feature, layerConfig)
  const opacity = Math.round((layerConfig.opacity || 1.0) * 255)
  return [baseColor[0], baseColor[1], baseColor[2], opacity]
}

// Get base color from config
function getBaseColor(feature: any, layerConfig: LayerConfig): [number, number, number] {
  if (layerConfig.color) {
    return hexToRgb(layerConfig.color)
  }

  // Default blue
  return [52, 152, 219]
}
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ LineLayer renders correctly
- ✅ Automatic destination markers appear for LineLayer
- ✅ ArcLayer renders with proper tilt and height
- ✅ Automatic arrow tips appear for ArcLayer
- ✅ ScatterplotLayer renders points correctly
- ✅ All layers respond to hover/selection state
- ✅ Visual dimming works when filters are active
- ✅ Width and radius scale correctly with state
- ✅ White outlines visible on markers
- ✅ UpdateTriggers cause proper updates
- ✅ No console errors or warnings

---

# TASK 6: Implement Basic Click and Hover Handlers

**Objective**: Implement click and hover event handlers with multi-object detection for overlapping geometries

**Estimated Effort**: Medium (2-3 hours)

**Dependencies**: TASK 1-5 completed

## Context Files to Read

1. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 450-481: pickMultipleObjects for overlapping geometries
   - Lines 672-686: Multi-cluster click handler
   - Lines 718-720: Hover emit pattern

2. **HistogramCard.vue** - `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/HistogramCard.vue`
   - Lines 70-95: How to emit filter events

3. **LinkageManager.ts** - `/home/user/simwrapper/src/plugins/interactive-dashboard/managers/LinkageManager.ts`
   - Lines 40-60: toggleSelectedIds method

## Key Patterns to Extract

```typescript
// Multi-object detection for overlapping geometries
const picked = this.deckOverlay.pickMultipleObjects({
  x: info.x,
  y: info.y,
  layerIds: ['cluster-boundaries'],
  radius: 2, // HARDCODED
})

const clusterIds = picked
  .map(p => p.object?.properties?.cluster_id)
  .filter(id => id !== undefined)

// Click with toggle behavior
onClick: (info: any) => {
  if (clusterIds.length > 0) {
    this.$emit('clusters-clicked', new Set(clusterIds))
  }
}

// Hover
onHover: (info: any) => {
  const id = info.object?.properties?.request_id || null
  this.$emit('request-hovered', id)
}

// Emit filter event
emit('filter', filterId, column, new Set(selectedValues))
```

## Implementation

Replace the placeholder handlers in `MapCard.vue`:

```typescript
// Click handler
function handleClick(info: any) {
  if (!info.object) {
    // Clicked on empty space - clear selection if configured
    if (props.linkage?.onSelect === 'filter') {
      emit('select', new Set())
    }
    return
  }

  // Find which layer was clicked
  const layerId = info.layer?.id
  const layerConfig = findLayerConfigById(layerId)

  if (!layerConfig || !layerConfig.linkage) {
    return
  }

  // Use pickMultipleObjects for overlapping geometries
  const picked = pickMultipleFeatures(info, layerConfig)

  if (picked.length === 0) {
    return
  }

  // Extract IDs from picked features
  const featureIds = picked
    .map((p) => p.object?.properties?.[layerConfig.linkage!.geoProperty])
    .filter((id) => id !== undefined && id !== null)

  if (featureIds.length === 0) {
    return
  }

  // Handle selection based on linkage config
  if (layerConfig.linkage.onSelect === 'filter') {
    // Toggle selection and emit filter event
    const idSet = new Set(featureIds)
    emit('select', idSet)

    // Also emit as filter if configured
    if (props.linkage?.type === 'filter') {
      const filterId = `map-${layerConfig.name}`
      emit('filter', filterId, layerConfig.linkage.tableColumn, idSet)
    }
  }

  console.log(`[MapCard] Clicked features:`, featureIds)
}

// Hover handler
function handleHover(info: any) {
  if (!info.object) {
    // No object hovered - clear hover state
    emit('hover', new Set())
    return
  }

  // Find which layer is hovered
  const layerId = info.layer?.id
  const layerConfig = findLayerConfigById(layerId)

  if (!layerConfig || !layerConfig.linkage) {
    emit('hover', new Set())
    return
  }

  // Use pickMultipleObjects for overlapping geometries
  const picked = pickMultipleFeatures(info, layerConfig)

  // Extract IDs
  const featureIds = picked
    .map((p) => p.object?.properties?.[layerConfig.linkage!.geoProperty])
    .filter((id) => id !== undefined && id !== null)

  if (featureIds.length > 0) {
    emit('hover', new Set(featureIds))
  } else {
    emit('hover', new Set())
  }
}

// Multi-object picker for overlapping geometries
function pickMultipleFeatures(info: any, layerConfig: LayerConfig): any[] {
  if (!deckOverlay.value) {
    return info.object ? [info] : []
  }

  // Extract layer type from layer id (format: "type-layername")
  const layerId = info.layer?.id
  if (!layerId) {
    return info.object ? [info] : []
  }

  try {
    // Pick all objects within 2px radius
    const picked = (deckOverlay.value as any).pickMultipleObjects({
      x: info.x,
      y: info.y,
      radius: 2, // HARDCODED as per spec
      layerIds: [layerId],
    })

    return picked || []
  } catch (error) {
    console.warn('[MapCard] pickMultipleObjects failed:', error)
    return info.object ? [info] : []
  }
}

// Helper to find layer config by deck.gl layer ID
function findLayerConfigById(layerId: string | undefined): LayerConfig | null {
  if (!layerId) return null

  // Layer ID format: "type-layername" or "type-suffix-layername"
  // Extract layer name from ID
  for (const layerConfig of props.layers) {
    if (layerId.includes(layerConfig.name)) {
      return layerConfig
    }
  }

  return null
}
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Click on features selects them
- ✅ Click on empty space clears selection (if configured)
- ✅ Hover highlights features
- ✅ Multi-object detection works for overlapping geometries (2px radius)
- ✅ Filter events emitted correctly
- ✅ Hover events emitted correctly
- ✅ Select events emitted correctly
- ✅ Multiple overlapping features detected and handled
- ✅ Console logs helpful debugging info
- ✅ No errors when clicking/hovering

---

## Summary of Part 1

### Files Created: 1
- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

### Files Modified: 0

### What's Complete
- ✅ Core MapCard component structure
- ✅ MapLibre initialization with theme switching
- ✅ GeoJSON loading system with deep cloning
- ✅ Deck.gl overlay integration
- ✅ PolygonLayer factory with state-based styling
- ✅ LineLayer factory with automatic destination markers
- ✅ ArcLayer factory with automatic arrow tips
- ✅ ScatterplotLayer factory
- ✅ Basic click and hover handlers
- ✅ Multi-object detection for overlapping geometries
- ✅ UpdateTriggers for reactive updates
- ✅ Visual feedback for hover/selection/filtering

### What's Next (Part 2)
- Advanced tooltip system with template substitution
- Color management (categorical and numeric)
- Attribute-based sizing (widthBy, radiusBy)
- Visual styling enhancements

### What's After (Part 3)
- ColorLegend integration
- Comparison mode support
- Dashboard registration
- Example YAML and testing

---

## Notes for Implementers

1. **Deep Cloning**: Always use `JSON.parse(JSON.stringify())` on GeoJSON data before passing to deck.gl
2. **UpdateTriggers**: Include ALL reactive dependencies for each accessor function
3. **Multi-object Detection**: Always use 2px radius (hardcoded as per spec)
4. **State Priority**: Selected > Hovered > Filtered > Dimmed > Default
5. **Layer Ordering**: Automatic markers render after their parent layer
6. **Error Handling**: Log errors but don't crash - fail gracefully

**End of Part 1**
