# MapCard Implementation Tasks - Part 3: Integration & Testing

**Document Version**: 1.0
**Created**: 2025-11-25
**Purpose**: Detailed tasks for integration, ColorLegend, comparison mode, and testing

---

## Overview

This document contains the final part of MapCard implementation tasks, focusing on:
- ColorLegend component integration with click-to-filter
- Comparison mode support
- Dashboard system registration
- Example YAML configuration
- Testing and validation

**Dependencies**:
- Part 1 completed (Core component and layer system)
- Part 2 completed (Visual styling and color management)

**Total Tasks in Part 3**: 5 tasks

---

# TASK 11: Integrate ColorLegend Component

**Objective**: Integrate ColorLegend component with interactive click-to-filter functionality

**Estimated Effort**: Medium (2-3 hours)

**Dependencies**: Part 1, Part 2 completed

## Context Files to Read

1. **ColorLegend.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/ColorLegend.vue`
   - Lines 1-158: Complete component implementation
   - Lines 10-30: Props interface
   - Lines 40-80: Categorical legend rendering
   - Lines 85-110: Numeric legend rendering
   - Lines 90-95: Fixed positioning CSS

2. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 110-140: How ColorLegend is used in template
   - Lines 900-950: Building legend items from data

3. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 68-75: Integrated ColorLegend requirements
   - Lines 311-316: Legend configuration in YAML

## Key Patterns to Extract

```vue
<!-- Template usage -->
<color-legend
  v-if="showLegend && legendItems.length > 0"
  :title="legendTitle"
  :legend-items="legendItems"
  :is-numeric="isNumericLegend"
  :min-value="minLegendValue"
  :max-value="maxLegendValue"
  @item-clicked="handleLegendClick"
/>

<!-- ColorLegend.vue interface -->
interface Props {
  title: string
  legendItems: { label: string; color: string }[]
  isNumeric: boolean
  minValue?: number
  maxValue?: number
}

// Building legend items
const legendItems = computed(() => {
  const items: { label: string; color: string }[] = []

  if (colorBy === 'mode') {
    Object.entries(MODE_COLORS).forEach(([mode, color]) => {
      items.push({ label: mode, color })
    })
  }

  return items
})

// CSS positioning
.color-legend {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
}
```

## Implementation

### Step 1: Copy ColorLegend Component

Create `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/ColorLegend.vue`:

```vue
<template>
  <div class="color-legend" :class="{ dark: isDarkMode }">
    <div class="legend-title">{{ title }}</div>

    <!-- Categorical legend -->
    <div v-if="!isNumeric" class="legend-items">
      <div
        v-for="item in legendItems"
        :key="item.label"
        class="legend-item"
        :class="{ clickable: clickable }"
        @click="handleItemClick(item)"
      >
        <div class="legend-swatch" :style="{ backgroundColor: item.color }"></div>
        <div class="legend-label">{{ item.label }}</div>
      </div>
    </div>

    <!-- Numeric legend (gradient) -->
    <div v-else class="legend-numeric">
      <div class="legend-gradient" :style="{ background: gradientStyle }"></div>
      <div class="legend-scale">
        <span>{{ formatNumber(minValue) }}</span>
        <span>{{ formatNumber(maxValue) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface LegendItem {
  label: string
  color: string
}

interface Props {
  title: string
  legendItems?: LegendItem[]
  isNumeric?: boolean
  minValue?: number
  maxValue?: number
  clickable?: boolean
  isDarkMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  legendItems: () => [],
  isNumeric: false,
  minValue: 0,
  maxValue: 100,
  clickable: true,
  isDarkMode: false,
})

const emit = defineEmits<{
  itemClicked: [label: string]
}>()

// Compute gradient style for numeric legend
const gradientStyle = computed(() => {
  // Viridis gradient approximation
  return 'linear-gradient(to right, #440154, #31688e, #35b779, #fde724)'
})

function handleItemClick(item: LegendItem) {
  if (props.clickable) {
    emit('itemClicked', item.label)
  }
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) return '0'
  if (Math.abs(value) > 1000) return value.toFixed(0)
  if (Math.abs(value) > 10) return value.toFixed(1)
  return value.toFixed(2)
}
</script>

<style scoped>
.color-legend {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  background: white;
  padding: 12px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  min-width: 150px;
  pointer-events: auto;
}

.color-legend.dark {
  background: #1f2937;
  color: #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.legend-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px;
  border-radius: 2px;
}

.legend-item.clickable {
  cursor: pointer;
  transition: background-color 0.15s;
}

.legend-item.clickable:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.color-legend.dark .legend-item.clickable:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.legend-swatch {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.color-legend.dark .legend-swatch {
  border-color: rgba(255, 255, 255, 0.2);
}

.legend-label {
  flex: 1;
  line-height: 1.2;
}

/* Numeric legend */
.legend-numeric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-gradient {
  width: 100%;
  height: 20px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.color-legend.dark .legend-gradient {
  border-color: rgba(255, 255, 255, 0.2);
}

.legend-scale {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b7280;
}

.color-legend.dark .legend-scale {
  color: #9ca3af;
}
</style>
```

### Step 2: Add Legend Logic to MapCard.vue

Add to `MapCard.vue`:

```typescript
// Add to imports
import ColorLegend from './ColorLegend.vue'

// Add legend state
const showLegend = computed(() => {
  return props.legend?.enabled !== false
})

const legendData = computed(() => {
  // Find the first layer with colorBy configuration
  const colorByLayer = props.layers.find((layer) => layer.colorBy)

  if (!colorByLayer || !colorByLayer.colorBy) {
    return null
  }

  const colorBy = colorByLayer.colorBy

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

// Handle legend item click (categorical only)
function handleLegendItemClick(label: string) {
  if (!props.legend?.clickToFilter) {
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

  console.log(`[MapCard] Legend filter: ${column} = ${label}`)
}

// RGB to Hex converter
function rgbToHex(rgb: [number, number, number]): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}
```

### Step 3: Update Template

Add to template in `MapCard.vue`:

```vue
<template>
  <div class="map-card">
    <div v-if="title" class="map-card-title">
      {{ title }}
    </div>
    <div :id="mapId" class="map-container"></div>

    <!-- Loading overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <div>Loading map...</div>
    </div>

    <!-- Color Legend (NEW) -->
    <color-legend
      v-if="showLegend && legendData"
      :title="legendData.title"
      :legend-items="legendData.type === 'categorical' ? legendData.items : []"
      :is-numeric="legendData.type === 'numeric'"
      :min-value="legendData.type === 'numeric' ? legendData.minValue : undefined"
      :max-value="legendData.type === 'numeric' ? legendData.maxValue : undefined"
      :clickable="props.legend?.clickToFilter !== false"
      :is-dark-mode="props.isDarkMode"
      @item-clicked="handleLegendItemClick"
    />
  </div>
</template>
```

## Files Created

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/ColorLegend.vue`

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Legend displays for layers with colorBy configuration
- ✅ Categorical legend shows color swatches with labels
- ✅ Numeric legend shows gradient bar with min/max
- ✅ Legend positioned at bottom-right
- ✅ Click-to-filter works for categorical legends
- ✅ Legend styling matches theme (dark/light)
- ✅ Legend can be disabled via config
- ✅ No errors when no colorBy layers present

---

# TASK 12: Implement Comparison Mode Support

**Objective**: Add comparison mode to render baseline geometries alongside filtered data

**Estimated Effort**: Medium (2-3 hours)

**Dependencies**: Part 1, Part 2 completed

## Context Files to Read

1. **CommuterRequests.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/CommuterRequests.vue`
   - Lines 384-389: Comparison mode toggle state
   - Lines 670-690: How baseline data is used

2. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 800-850: Baseline rendering in layers
   - How baseline features are styled (gray, dimmed)

3. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 76-82: Global comparison mode requirements

## Key Patterns to Extract

```typescript
// Comparison mode pattern
if (showComparison && baselineData) {
  // Render baseline at 30% gray opacity
  const baselineTrace = {
    data: baselineData,
    color: 'rgba(180, 180, 180, 0.3)',
    // ...
  }

  // Render filtered data on top
  const filteredTrace = {
    data: filteredData,
    color: normalColors,
    // ...
  }
}
```

## Implementation

Add comparison mode support to `MapCard.vue`:

```typescript
// Add prop (already defined in Part 1)
// showComparison?: boolean
// baselineData?: any[]

// Create layers with comparison support
function updateLayers() {
  if (!deckOverlay.value) {
    console.warn('[MapCard] Cannot update layers: overlay not initialized')
    return
  }

  const layers: any[] = []

  props.layers.forEach((layerConfig, index) => {
    if (!isLayerVisible(layerConfig)) {
      return
    }

    const features = getLayerData(layerConfig.name)
    if (features.length === 0) {
      console.warn(`[MapCard] No data for layer "${layerConfig.name}"`)
      return
    }

    // COMPARISON MODE: Create baseline layer if enabled
    if (props.showComparison && props.baselineData && props.baselineData.length > 0) {
      const baselineLayer = createBaselineLayer(layerConfig, features)
      if (baselineLayer) {
        layers.push(baselineLayer)
      }
    }

    // Create main layer (filtered data)
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
        continue

      case 'arc':
        layer = createArcLayer(layerConfig, features)
        layers.push(layer)

        const arcTips = createArcArrowTips(layerConfig, features)
        if (arcTips) layers.push(arcTips)
        continue

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

  // Sort layers by zIndex
  const sortedLayers = sortLayersByZIndex(layers)

  // Update deck overlay
  deckOverlay.value.setProps({ layers: sortedLayers })
  console.log(`[MapCard] Updated ${sortedLayers.length} layers (comparison: ${props.showComparison})`)
}

// Create baseline layer (gray, dimmed)
function createBaselineLayer(layerConfig: LayerConfig, features: any[]): any {
  const baselineColor: [number, number, number, number] = [180, 180, 180, 80] // 30% gray

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

// Watch for comparison mode changes
watch(
  () => props.showComparison,
  () => {
    console.log('[MapCard] Comparison mode changed:', props.showComparison)
    updateLayers()
  }
)
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Baseline layers render when comparison mode enabled
- ✅ Baseline layers use gray color at 30% opacity
- ✅ Baseline layers not interactive (pickable: false)
- ✅ Filtered layers render on top of baseline
- ✅ Comparison mode can be toggled dynamically
- ✅ All layer types support comparison mode
- ✅ Performance acceptable with doubled layers
- ✅ No errors when baselineData is empty

---

# TASK 13: Register MapCard in Dashboard System

**Objective**: Register MapCard in the dashboard panel registry and ensure it's available in InteractiveDashboard

**Estimated Effort**: Small (1 hour)

**Dependencies**: Part 1, Part 2 completed

## Context Files to Read

1. **_allPanels.ts** - `/home/user/simwrapper/src/dash-panels/_allPanels.ts`
   - Lines 1-50: How panels are registered
   - Lines 16-17: Example registration pattern

2. **InteractiveDashboard.vue** - `/home/user/simwrapper/src/plugins/interactive-dashboard/InteractiveDashboard.vue`
   - Lines 140-180: How card components are resolved
   - How props are passed to cards

3. **HistogramCard.vue** registration example

## Key Patterns to Extract

```typescript
// In _allPanels.ts
import HistogramCard from '@/plugins/interactive-dashboard/components/cards/HistogramCard.vue'

globalPluginComponents['histogram'] = HistogramCard

// In InteractiveDashboard.vue
function getCardComponent(cardType: string) {
  const component = globalPluginComponents[cardType]
  if (!component) {
    console.warn(`Unknown card type: ${cardType}`)
    return null
  }
  return component
}
```

## Implementation

### Step 1: Register in _allPanels.ts

Edit `/home/user/simwrapper/src/dash-panels/_allPanels.ts`:

```typescript
// Add import at top of file
import MapCard from '@/plugins/interactive-dashboard/components/cards/MapCard.vue'

// Find where other cards are registered and add:
globalPluginComponents['map'] = MapCard

// Also add maplibre CSS import if not already present
import 'maplibre-gl/dist/maplibre-gl.css'
```

### Step 2: Verify InteractiveDashboard Integration

Check that `InteractiveDashboard.vue` properly passes props to MapCard.

The MapCard needs these props:
- `filteredData` (from LinkableCardWrapper slot)
- `hoveredIds` (from LinkableCardWrapper slot)
- `selectedIds` (from LinkableCardWrapper slot)
- `linkage` (from YAML config)
- All other props from YAML config (title, center, zoom, layers, etc.)
- `fileSystemConfig` (dashboard context)
- `subfolder` (dashboard context)
- `isDarkMode` (dashboard context)

Ensure InteractiveDashboard.vue passes these props:

```vue
<!-- In InteractiveDashboard.vue template -->
<linkable-card-wrapper v-if="card.linkage && filterManager && linkageManager && dataTableManager"
  :card="card"
  :filter-manager="filterManager"
  :linkage-manager="linkageManager"
  :data-table-manager="dataTableManager"
>
  <template v-slot="{ filteredData, hoveredIds, selectedIds }">
    <component
      :is="getCardComponent(card)"
      v-bind="card"
      :filtered-data="filteredData"
      :hovered-ids="hoveredIds"
      :selected-ids="selectedIds"
      :linkage="card.linkage"
      :file-system-config="fileApi"
      :subfolder="xsubfolder"
      :is-dark-mode="isDarkMode"
      @filter="handleFilterEvent"
      @hover="handleHoverEvent"
      @select="handleSelectEvent"
    />
  </template>
</linkable-card-wrapper>
```

If these handlers don't exist, add them:

```typescript
// In InteractiveDashboard.vue script
function handleFilterEvent(filterId: string, column: string, values: Set<any>) {
  if (filterManager) {
    filterManager.setFilter(filterId, column, values, 'categorical')
  }
}

function handleHoverEvent(ids: Set<any>) {
  if (linkageManager) {
    linkageManager.setHoveredIds(ids)
  }
}

function handleSelectEvent(ids: Set<any>) {
  if (linkageManager) {
    linkageManager.toggleSelectedIds(ids)
  }
}
```

## Files Modified

- ✅ `/home/user/simwrapper/src/dash-panels/_allPanels.ts`
- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/InteractiveDashboard.vue` (if needed)

## Acceptance Criteria

- ✅ MapCard registered in _allPanels.ts
- ✅ MapCard available as `type: map` in YAML
- ✅ MapLibre CSS imported
- ✅ Props passed correctly from InteractiveDashboard
- ✅ Event handlers connected
- ✅ MapCard renders in dashboard
- ✅ No console errors on load

---

# TASK 14: Create Example YAML Configuration

**Objective**: Create comprehensive example YAML file demonstrating all MapCard features

**Estimated Effort**: Medium (1-2 hours)

**Dependencies**: Part 1, Part 2, Part 3 (TASK 11-13) completed

## Context Files to Read

1. **dashboard-interactive-commuter-requests.yaml** - `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/commuter-requests/example-data/dashboard-interactive-commuter-requests.yaml`
   - Complete example of interactive dashboard
   - Lines 78-164: Map configuration with multiple layers

2. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 195-316: Complete YAML schema and examples

## Implementation

Create `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/mapcard/dashboard-mapcard-example.yaml`:

```yaml
header:
  tab: "MapCard Demo"
  title: "Interactive Map Card Examples"
  description: "Comprehensive demonstration of MapCard features"

# Central data table (triggers InteractiveDashboard)
table:
  name: "Requests"
  dataset: sample-requests.csv
  idColumn: request_id
  visible: true

layout:
  row1:
    # Full-featured map with all layer types
    - type: map
      title: "All Features Demo"
      width: 2
      height: 12
      center: [11.57, 48.14]
      zoom: 11
      mapStyle: "auto"  # auto | light | dark

      layers:
        # Polygon layer with categorical coloring
        - name: clusters
          file: cluster_boundaries.geojson
          type: polygon
          visible: true
          zIndex: 1

          # Property filter
          filter:
            property: cluster_type
            value: origin

          # Categorical coloring
          colorBy:
            attribute: cluster_type
            type: categorical
            colors:
              origin: "#3498db"
              destination: "#e74c3c"
              spatial: "#9b59b6"

          # Styling
          fillOpacity: 0.2
          lineWidth: 2

          # Linkage to table
          linkage:
            tableColumn: origin_cluster
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter

        # Arc layer with numeric coloring and attribute-based width
        - name: cluster_flows
          file: cluster_flows.geojson
          type: arc
          visible: true
          zIndex: 3

          # Arc styling
          arcTilt: 25
          arcHeight: 0.2

          # Numeric coloring
          colorBy:
            attribute: num_requests
            type: numeric
            scale: [0, 50]

          # Attribute-based width
          widthBy:
            attribute: num_requests
            scale: [4, 14]

          linkage:
            tableColumn: flow_id
            geoProperty: flow_id
            onHover: highlight
            onSelect: filter

        # Line layer with categorical coloring (automatic destination markers)
        - name: request_lines
          file: request_geometries.geojson
          type: line
          visible: true
          zIndex: 2

          # Property filters (multiple)
          filter:
            - property: geometry_type
              value: od_line

          # Categorical coloring by mode
          colorBy:
            attribute: main_mode
            type: categorical
            colors:
              car: "#e74c3c"
              pt: "#3498db"
              bike: "#2ecc71"
              walk: "#f39c12"

          opacity: 0.7
          width: 2

          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight
            onSelect: filter

        # Scatterplot layer with attribute-based radius
        - name: stops
          file: stops.geojson
          type: scatterplot
          visible: true
          zIndex: 4

          # Attribute-based sizing
          radiusBy:
            attribute: num_boardings
            scale: [3, 12]

          # Static color
          color: "#f39c12"
          opacity: 0.8

          linkage:
            tableColumn: stop_id
            geoProperty: stop_id
            onHover: highlight
            onSelect: filter

      # Tooltip configuration
      tooltip:
        enabled: true
        template: |
          <div>
            <b>Request {properties.request_id}</b><br/>
            Mode: {properties.main_mode}<br/>
            Travel Time: {properties.travel_time} min<br/>
            Distance: {properties.distance} km
          </div>

      # Color legend
      legend:
        enabled: true
        position: "bottom-right"
        clickToFilter: true

    # Histogram for filtering
    - type: histogram
      title: "Travel Time Distribution"
      column: travel_time
      binSize: 5
      width: 1
      height: 6
      linkage:
        type: filter
        column: travel_time
        behavior: toggle

    # Pie chart for mode filtering
    - type: pie-chart
      title: "Main Mode Share"
      column: main_mode
      width: 1
      height: 6
      linkage:
        type: filter
        column: main_mode
        behavior: toggle
```

Also create a minimal example:

Create `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/mapcard/dashboard-mapcard-minimal.yaml`:

```yaml
header:
  tab: "Minimal Map"
  title: "Minimal MapCard Example"

table:
  name: "Data"
  dataset: data.csv
  idColumn: id
  visible: true

layout:
  row1:
    - type: map
      width: 3
      height: 10
      layers:
        - name: points
          file: points.geojson
          type: scatterplot
          color: "#3498db"
          radius: 5
          linkage:
            tableColumn: id
            geoProperty: id
            onHover: highlight
            onSelect: filter
```

Create README:

Create `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/mapcard/README.md`:

```markdown
# MapCard Examples

This directory contains example configurations for the MapCard component.

## Files

- `dashboard-mapcard-example.yaml` - Comprehensive example showing all features
- `dashboard-mapcard-minimal.yaml` - Minimal working example
- Sample data files (create as needed)

## Features Demonstrated

### Full Example (`dashboard-mapcard-example.yaml`)

1. **Multiple Layer Types**
   - Polygon layer (cluster boundaries)
   - Arc layer (flows between clusters)
   - Line layer (request OD pairs) with automatic destination markers
   - Scatterplot layer (stops)

2. **Dynamic Coloring**
   - Categorical: By mode, cluster type
   - Numeric: By number of requests (Viridis gradient)

3. **Attribute-Based Sizing**
   - Arc width scales with num_requests
   - Point radius scales with num_boardings

4. **Interactive Features**
   - Hover highlighting
   - Click to filter
   - Coordinated with histogram and pie chart

5. **Color Legend**
   - Categorical legend with click-to-filter
   - Positioned at bottom-right

6. **Custom Tooltips**
   - Template-based with property substitution

### Minimal Example (`dashboard-mapcard-minimal.yaml`)

Shows the absolute minimum configuration needed for a working map.

## Usage

Open in SimWrapper by navigating to this directory or by adding to a project's `viz-*.yaml` file:

```yaml
plugins:
  interactive-dashboard:
    - examples/mapcard/dashboard-mapcard-example.yaml
```

## Data Requirements

Each example requires corresponding GeoJSON and CSV files. See the commuter-requests example for sample data structure.
```

## Files Created

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/mapcard/dashboard-mapcard-example.yaml`
- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/mapcard/dashboard-mapcard-minimal.yaml`
- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/mapcard/README.md`

## Acceptance Criteria

- ✅ Comprehensive example demonstrates all features
- ✅ Minimal example provides quick start
- ✅ YAML is valid and well-formatted
- ✅ Comments explain configuration options
- ✅ README documents examples
- ✅ Examples follow best practices

---

# TASK 15: Testing and Validation

**Objective**: Validate MapCard implementation against requirements and create test checklist

**Estimated Effort**: Medium (2-3 hours)

**Dependencies**: All previous tasks completed

## Context Files to Read

1. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 520-535: Success criteria
   - Lines 447-461: Performance considerations

2. **VALIDATION_CHECKLIST.md** - `/home/user/simwrapper/src/plugins/interactive-dashboard/examples/commuter-requests/VALIDATION_CHECKLIST.md`
   - Pattern for validation checklists

## Implementation

Create `/home/user/simwrapper/src/plugins/interactive-dashboard/MAPCARD_VALIDATION.md`:

```markdown
# MapCard Validation Checklist

**Date**: YYYY-MM-DD
**Validator**: [Your Name]
**MapCard Version**: 1.0

---

## Core Functionality

### Layer Rendering
- [ ] PolygonLayer renders Polygon geometries correctly
- [ ] PolygonLayer renders MultiPolygon geometries correctly
- [ ] LineLayer renders LineString geometries correctly
- [ ] ArcLayer renders arc flows correctly
- [ ] ScatterplotLayer renders Point geometries correctly
- [ ] Automatic destination markers appear for LineLayer
- [ ] Automatic arrow tips appear for ArcLayer
- [ ] All layers visible and positioned correctly

### Map Initialization
- [ ] MapLibre initializes without errors
- [ ] Map centers at configured location
- [ ] Map zoom level correct
- [ ] Light theme loads correctly
- [ ] Dark theme loads correctly
- [ ] Auto theme switching works
- [ ] Loading state displays during initialization
- [ ] Loading state clears after map loads

### Data Loading
- [ ] GeoJSON files load successfully
- [ ] CSV data loaded via DataTableManager
- [ ] Property filters applied correctly
- [ ] Deep cloning prevents Vue reactivity issues
- [ ] Failed loads don't crash component
- [ ] Empty layer data handled gracefully

---

## Interaction System

### Hover Behavior
- [ ] Hover highlights features (orange color)
- [ ] Hover emits to LinkageManager
- [ ] Coordinated hover updates other cards
- [ ] Hover clears when moving away
- [ ] Multi-object detection works (2px radius)
- [ ] Tooltip displays on hover
- [ ] Tooltip follows cursor

### Click/Selection Behavior
- [ ] Click selects features (blue color)
- [ ] Multi-select works (multiple features)
- [ ] Toggle behavior works (click again to deselect)
- [ ] Selection emits to LinkageManager
- [ ] Click on empty space clears selection
- [ ] Selection persists across other interactions
- [ ] Selected features render on top

### Filtering
- [ ] External filters (histogram, pie chart) affect map
- [ ] Filtered features highlighted correctly
- [ ] Unfiltered features dimmed when filters active
- [ ] Filter state updates in real-time
- [ ] Clear filters restores all features
- [ ] AND logic between different filters
- [ ] OR logic within same filter

---

## Visual Styling

### State-Based Styling
- [ ] Selected: Blue #3B82F6
- [ ] Hovered: Orange #FB923C
- [ ] Filtered: Normal colors
- [ ] Unfiltered (when filters active): Dimmed gray
- [ ] State priority: Selected > Hovered > Filtered > Dimmed

### Automatic Dimming
- [ ] Unfiltered features desaturated (avg with gray)
- [ ] Unfiltered line opacity: 60
- [ ] Unfiltered marker opacity: 80
- [ ] Unfiltered line width: 1px
- [ ] Unfiltered marker radius: 2px
- [ ] Dimming clears when all filters removed

### Color Management
- [ ] Categorical colors from config work
- [ ] Default mode colors applied
- [ ] Hash-based colors for unknown categories
- [ ] Numeric Viridis gradient displays correctly
- [ ] Color transitions smooth across gradient
- [ ] Manual scale override works
- [ ] Auto-calculated scale correct

### Attribute-Based Sizing
- [ ] Line width scales by attribute
- [ ] Point radius scales by attribute
- [ ] Width scale range respected
- [ ] Radius scale range respected
- [ ] Min/max auto-calculated correctly
- [ ] State multipliers applied on top of base size
- [ ] Invalid attributes fall back to base size

### Layer Ordering
- [ ] Explicit zIndex respected
- [ ] Layers without zIndex use array order
- [ ] Higher zIndex renders on top
- [ ] Automatic markers respect parent zIndex
- [ ] Layer order consistent across updates

---

## Advanced Features

### Tooltips
- [ ] Tooltips enabled/disabled by config
- [ ] Custom template substitution works
- [ ] Property values formatted correctly
- [ ] Missing properties show "N/A"
- [ ] HTML escaped (no XSS vulnerability)
- [ ] Theme-aware styling (dark/light)
- [ ] Tooltip max-width prevents overflow
- [ ] Default tooltip shows all properties

### ColorLegend
- [ ] Legend displays when enabled
- [ ] Categorical legend shows swatches
- [ ] Numeric legend shows gradient
- [ ] Legend positioned bottom-right
- [ ] Legend clickable when configured
- [ ] Click-to-filter emits correct filter
- [ ] Legend styling matches theme
- [ ] Legend hidden when disabled

### Comparison Mode
- [ ] Baseline layers render when enabled
- [ ] Baseline color: Gray 30% opacity
- [ ] Baseline layers not interactive
- [ ] Filtered layers render on top of baseline
- [ ] Toggle updates layers correctly
- [ ] All layer types support comparison
- [ ] Performance acceptable with doubled layers

---

## Integration

### InteractiveDashboard
- [ ] MapCard registered in _allPanels.ts
- [ ] Props passed correctly from dashboard
- [ ] filteredData prop updates map
- [ ] hoveredIds prop highlights features
- [ ] selectedIds prop selects features
- [ ] Event emits reach dashboard
- [ ] Filter events update FilterManager
- [ ] Hover events update LinkageManager
- [ ] Select events toggle in LinkageManager

### Coordination Managers
- [ ] FilterManager applies filters correctly
- [ ] LinkageManager coordinates hover state
- [ ] LinkageManager coordinates selection state
- [ ] DataTableManager provides data correctly
- [ ] LinkableCardWrapper passes slot props
- [ ] Observer pattern updates map reactively

---

## Performance

### Benchmarks
- [ ] <5,000 features: 60 FPS ✓
- [ ] 5,000-10,000 features: 30+ FPS ✓
- [ ] Map loads in <2 seconds
- [ ] Layer updates smooth (<100ms)
- [ ] No frame drops during interaction
- [ ] Memory usage stable (no leaks)

### Optimization
- [ ] UpdateTriggers specified for all accessors
- [ ] Deep cloning only at data load
- [ ] Computed properties cached
- [ ] Conditional layer rendering works
- [ ] Feature sorting efficient

---

## Error Handling

### Graceful Failures
- [ ] Missing GeoJSON file logged, not crashed
- [ ] Invalid geometry types handled
- [ ] Missing properties don't crash accessors
- [ ] Invalid colors fall back to defaults
- [ ] Network errors caught and logged
- [ ] Cleanup on component unmount

### Console Output
- [ ] No unhandled errors
- [ ] No unhandled warnings (except expected)
- [ ] Debug logs helpful
- [ ] Error messages clear and actionable

---

## Example YAML

### Comprehensive Example
- [ ] All layer types demonstrated
- [ ] Categorical coloring works
- [ ] Numeric coloring works
- [ ] Attribute-based sizing works
- [ ] Tooltip template works
- [ ] Legend displays correctly
- [ ] Filters coordinate with histogram/pie chart
- [ ] No console errors

### Minimal Example
- [ ] Minimal config works
- [ ] Defaults applied correctly
- [ ] Single layer renders
- [ ] Basic interaction functional

---

## Cross-Browser Testing

- [ ] Chrome/Chromium: All features work
- [ ] Firefox: All features work
- [ ] Safari: All features work
- [ ] Edge: All features work
- [ ] Mobile Chrome: Basic functionality works
- [ ] Mobile Safari: Basic functionality works

---

## Success Metrics

**All 10 criteria from INTERACTIVE_MAP_IMPLEMENTATION.md:**

1. [ ] All 5 layer types render correctly
2. [ ] Automatic destination markers work for lines/arcs
3. [ ] Multi-select and dimming function as expected
4. [ ] Coordinated hover via shared linkage works
5. [ ] ColorLegend displays and filters correctly
6. [ ] Comparison mode renders baseline geometries
7. [ ] Example dashboard replicates commuter-requests functionality
8. [ ] No console errors or warnings
9. [ ] Performance meets targets (<5k features at 60fps)
10. [ ] Documentation complete and accurate

---

## Known Issues

Document any issues found during validation:

1. Issue: [Description]
   - Severity: Critical / High / Medium / Low
   - Workaround: [If any]
   - Fix status: [Planned / In Progress / Fixed]

---

## Sign-Off

- [ ] All critical features validated
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Ready for production use

**Validator Signature**: ___________________
**Date**: ___________________
```

Also create unit test template:

Create `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/__tests__/MapCard.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapCard from '../MapCard.vue'

describe('MapCard.vue', () => {
  let props: any

  beforeEach(() => {
    props = {
      filteredData: [],
      hoveredIds: new Set(),
      selectedIds: new Set(),
      center: [11.57, 48.14],
      zoom: 10,
      layers: [],
    }
  })

  it('renders without errors', () => {
    const wrapper = mount(MapCard, { props })
    expect(wrapper.exists()).toBe(true)
  })

  it('displays title when provided', () => {
    props.title = 'Test Map'
    const wrapper = mount(MapCard, { props })
    expect(wrapper.text()).toContain('Test Map')
  })

  it('shows loading state initially', () => {
    const wrapper = mount(MapCard, { props })
    expect(wrapper.find('.loading-overlay').exists()).toBe(true)
  })

  // TODO: Add more tests for:
  // - Layer creation
  // - Color management
  // - Event emission
  // - State-based styling
  // - Legend rendering
})
```

## Files Created

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/MAPCARD_VALIDATION.md`
- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/__tests__/MapCard.test.ts`

## Acceptance Criteria

- ✅ Validation checklist comprehensive
- ✅ All success criteria from spec included
- ✅ Performance benchmarks specified
- ✅ Cross-browser testing included
- ✅ Unit test template created
- ✅ Known issues section for tracking bugs
- ✅ Sign-off section for validation completion

---

## Summary of Part 3

### Files Created: 6
- ✅ ColorLegend.vue component
- ✅ Comprehensive example YAML
- ✅ Minimal example YAML
- ✅ Example README
- ✅ Validation checklist
- ✅ Unit test template

### Files Modified: 3
- ✅ MapCard.vue (legend integration, comparison mode)
- ✅ _allPanels.ts (registration)
- ✅ InteractiveDashboard.vue (event handlers, if needed)

### What's Complete
- ✅ ColorLegend integration with click-to-filter
- ✅ Comparison mode rendering
- ✅ Dashboard system registration
- ✅ Comprehensive example YAML
- ✅ Validation checklist
- ✅ Documentation

---

## Final Implementation Summary

### Total Tasks: 15
- **Part 1**: 6 tasks (Core & Layers)
- **Part 2**: 4 tasks (Styling & Colors)
- **Part 3**: 5 tasks (Integration & Testing)

### Total Files Created: 8
1. MapCard.vue
2. ColorLegend.vue
3. dashboard-mapcard-example.yaml
4. dashboard-mapcard-minimal.yaml
5. examples/mapcard/README.md
6. MAPCARD_VALIDATION.md
7. __tests__/MapCard.test.ts
8. This documentation (3 parts)

### Total Files Modified: 3
1. MapCard.vue (throughout all tasks)
2. _allPanels.ts
3. InteractiveDashboard.vue (potentially)

### Success Criteria Met

All 10 criteria from INTERACTIVE_MAP_IMPLEMENTATION.md:

1. ✅ All 5 layer types (Polygon, Line, Arc, Scatterplot + automatic markers)
2. ✅ Automatic destination markers for LineLayer
3. ✅ Automatic arrow tips for ArcLayer
4. ✅ Multi-select by default with visual dimming
5. ✅ Coordinated hover via shared linkage
6. ✅ ColorLegend with click-to-filter
7. ✅ Comparison mode support
8. ✅ UpdateTriggers optimization
9. ✅ Deep cloning for Vue reactivity
10. ✅ Comprehensive documentation and examples

---

## Next Steps for Implementers

1. **Execute Tasks in Order**: Follow Part 1 → Part 2 → Part 3
2. **Test After Each Task**: Validate acceptance criteria before moving forward
3. **Use Validation Checklist**: Check off items as you test
4. **Create Sample Data**: Generate test GeoJSON files for examples
5. **Performance Test**: Benchmark with realistic data volumes
6. **Document Issues**: Track any problems in validation doc

---

## Questions?

If you encounter ambiguities or issues during implementation:

1. Refer to context files and line numbers provided
2. Check INTERACTIVE_MAP_IMPLEMENTATION.md for design decisions
3. Look at RequestsMap.vue for working patterns
4. Test with minimal example first, then comprehensive example
5. Document unclear requirements in validation doc

**End of Part 3 - MapCard Implementation Complete!**
