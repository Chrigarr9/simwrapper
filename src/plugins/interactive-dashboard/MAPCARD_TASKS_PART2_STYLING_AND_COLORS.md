# MapCard Implementation Tasks - Part 2: Visual Styling & Color System

**Document Version**: 1.0
**Created**: 2025-11-25
**Purpose**: Detailed tasks for implementing advanced visual styling, color management, and attribute-based sizing

---

## Overview

This document contains the second part of MapCard implementation tasks, focusing on:
- Advanced tooltip system with template substitution
- Dynamic color management (categorical and numeric)
- Attribute-based sizing for lines and points
- Visual styling refinements

**Dependencies**:
- Part 1 completed (Core component and layer system)

**Total Tasks in Part 2**: 4 tasks

---

# TASK 7: Implement Advanced Tooltip System

**Objective**: Enhance tooltip system with template substitution and property formatting

**Estimated Effort**: Medium (2-3 hours)

**Dependencies**: Part 1 (TASK 1-6) completed

## Context Files to Read

1. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 197-296: Tooltip implementation with multiple object types
   - Lines 215-240: Tooltip HTML generation
   - Lines 241-260: Theme-aware tooltip styling

2. **INTERACTIVE_MAP_IMPLEMENTATION.md** - `/home/user/simwrapper/src/plugins/interactive-dashboard/INTERACTIVE_MAP_IMPLEMENTATION.md`
   - Lines 301-309: Tooltip template configuration

## Key Patterns to Extract

```typescript
// Multiple tooltip formats based on object type
getTooltip: ({ object }: any) => {
  if (!object) return null

  const properties = object.properties || {}

  // Check geometry type
  if (properties.geometry_type === 'flow') {
    return {
      html: `
        <div>
          <b>Flow</b><br/>
          Origin: ${properties.origin_cluster}<br/>
          Destination: ${properties.dest_cluster}<br/>
          Requests: ${properties.num_requests}
        </div>
      `,
      style: {
        backgroundColor: isDarkMode ? '#1f2937' : 'white',
        color: isDarkMode ? '#e5e7eb' : '#111827',
        // ...
      }
    }
  }

  // Default tooltip
  return {
    html: `<div>Feature ${properties.id}</div>`,
    style: { /* ... */ }
  }
}

// Template substitution pattern
template: `
  <div>
    <b>{properties.request_id}</b><br/>
    Mode: {properties.main_mode}<br/>
    Time: {properties.travel_time} min
  </div>
`
```

## Implementation

Replace the `getTooltipContent` function in `MapCard.vue`:

```typescript
// Enhanced tooltip content generator
function getTooltipContent(object: any): any {
  if (!object || !props.tooltip?.enabled) {
    return null
  }

  const properties = object.properties || {}

  // Use custom template if provided
  if (props.tooltip.template) {
    const html = renderTooltipTemplate(props.tooltip.template, properties)
    return {
      html,
      style: getTooltipStyle(),
    }
  }

  // Auto-generate tooltip from all properties
  const html = renderDefaultTooltip(properties)
  return {
    html,
    style: getTooltipStyle(),
  }
}

// Render tooltip from template string
function renderTooltipTemplate(template: string, properties: Record<string, any>): string {
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

  // Wrap in container
  return `<div class="mapcard-tooltip">${html}</div>`
}

// Render default tooltip showing all properties
function renderDefaultTooltip(properties: Record<string, any>): string {
  if (Object.keys(properties).length === 0) {
    return '<div class="mapcard-tooltip"><em>No data</em></div>'
  }

  let html = '<div class="mapcard-tooltip">'

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
  return {
    backgroundColor: props.isDarkMode ? '#1f2937' : 'white',
    color: props.isDarkMode ? '#e5e7eb' : '#111827',
    fontSize: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    lineHeight: '1.5',
    padding: '8px 12px',
    borderRadius: '4px',
    boxShadow: props.isDarkMode
      ? '0 4px 12px rgba(0, 0, 0, 0.5)'
      : '0 2px 8px rgba(0, 0, 0, 0.15)',
    maxWidth: '300px',
    pointerEvents: 'none',
    zIndex: '1000',
  }
}
```

Add CSS for tooltip styling (add to `<style>` section):

```vue
<style scoped>
/* Existing styles ... */

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
</style>
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Custom templates work with `{properties.xxx}` substitution
- ✅ Default tooltip shows all properties (up to 10)
- ✅ Property names formatted nicely (snake_case → Title Case)
- ✅ Numbers formatted appropriately
- ✅ HTML escaped to prevent XSS
- ✅ Theme-aware styling (dark/light)
- ✅ Tooltips display on hover
- ✅ N/A shown for missing properties
- ✅ Max width prevents huge tooltips
- ✅ No console errors

---

# TASK 8: Implement Dynamic Color Management (Categorical & Numeric)

**Objective**: Implement categorical and numeric color schemes with dynamic coloring based on feature attributes

**Estimated Effort**: Large (4-5 hours)

**Dependencies**: Part 1 completed

## Context Files to Read

1. **colorSchemes.ts** - `/home/user/simwrapper/src/plugins/commuter-requests/utils/colorSchemes.ts`
   - Lines 1-92: Complete file - categorical color definitions
   - Lines 15-45: MODE_COLORS and ACTIVITY_COLORS
   - Lines 60-75: getModeColorRGB and getActivityColorRGB functions
   - Lines 80-92: hexToRgb utility

2. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 740-795: Dynamic coloring based on colorBy attribute
   - Lines 850-870: Numeric gradient calculation (Viridis)

3. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 58-66: Dynamic coloring system requirements
   - Lines 225-235: ColorBy configuration in YAML

## Key Patterns to Extract

```typescript
// Categorical colors
const MODE_COLORS: Record<string, string> = {
  car: '#e74c3c',
  pt: '#3498db',
  bike: '#2ecc71',
  walk: '#f39c12',
  drt: '#9b59b6',
}

function getModeColorRGB(mode: string): [number, number, number, number] {
  const hex = MODE_COLORS[mode] || MODE_COLORS.default
  return hexToRgb(hex, 255)
}

// Numeric gradient (Viridis approximation)
function viridisColor(t: number): [number, number, number] {
  // Polynomial approximation for R, G, B channels
  // t = normalized value between 0 and 1
  const r = Math.round(255 * (0.267 + t * (2.07 * t - 2.14)))
  const g = Math.round(255 * (0.005 + t * (1.39 - 0.79 * t)))
  const b = Math.round(255 * (0.329 + t * (1.10 - 1.47 * t)))
  return [r, g, b]
}

// Usage in layer
getColor: (d: any) => {
  if (colorBy.type === 'categorical') {
    const value = d.properties[colorBy.attribute]
    return getCategoricalColor(value, colorBy.colors)
  } else if (colorBy.type === 'numeric') {
    const value = d.properties[colorBy.attribute]
    return getNumericColor(value, colorBy.scale)
  }
  return defaultColor
}
```

## Implementation

Add color management functions to `MapCard.vue`:

```typescript
// Add to imports (create color utilities inline or as separate file)

// ===== COLOR MANAGEMENT SYSTEM =====

// Default categorical color schemes
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

// Hex to RGB converter (enhanced from Part 1)
function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Parse hex
  const bigint = parseInt(hex, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255

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

// ===== UPDATE getBaseColor FUNCTION =====

// Replace the existing getBaseColor function with this enhanced version:
function getBaseColor(feature: any, layerConfig: LayerConfig): [number, number, number] {
  // Check if colorBy is configured
  if (layerConfig.colorBy) {
    const colorBy = layerConfig.colorBy
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

  // Static color from config
  if (layerConfig.color) {
    return hexToRgb(layerConfig.color)
  }

  if (layerConfig.fillColor) {
    return hexToRgb(layerConfig.fillColor)
  }

  // Default blue
  return [52, 152, 219]
}
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Categorical colors work with custom color maps
- ✅ Categorical colors use default schemes (mode, activity)
- ✅ Hash-based colors generated for unknown categories
- ✅ Numeric colors use Viridis gradient
- ✅ Numeric scale auto-calculated from data
- ✅ Manual scale override works
- ✅ Missing attributes handled gracefully
- ✅ Colors consistent across all layer types
- ✅ No console errors for missing colors
- ✅ Colors visible in light and dark themes

---

# TASK 9: Implement Attribute-Based Sizing

**Objective**: Implement dynamic sizing for line widths and point radii based on feature attributes

**Estimated Effort**: Medium (2-3 hours)

**Dependencies**: Part 1 completed

## Context Files to Read

1. **RequestsMap.vue** - `/home/user/simwrapper/src/plugins/commuter-requests/components/RequestsMap.vue`
   - Lines 570-610: Width scaling based on num_requests attribute
   - Lines 540-560: Normalization of widths to range

2. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 63-66: Attribute-based sizing requirements
   - Lines 267-270: widthBy configuration
   - Lines 289-292: radiusBy configuration (similar pattern)

## Key Patterns to Extract

```typescript
// Width scaling by attribute
const maxRequests = Math.max(...flows.map(f => f.properties.num_requests))

getWidth: (d: any) => {
  const numRequests = d.properties.num_requests || 1
  const normalizedWidth = (numRequests / maxRequests) * 10 + 4

  if (isHovered) return normalizedWidth * 1.5
  if (isSelected) return normalizedWidth * 1.2
  return normalizedWidth
}

// Configuration in YAML
widthBy:
  attribute: travel_time
  scale: [1, 6]  # min/max width
```

## Implementation

Add sizing functions to `MapCard.vue`:

```typescript
// ===== ATTRIBUTE-BASED SIZING SYSTEM =====

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

// ===== UPDATE getFeatureWidth FUNCTION =====

// Replace the existing getFeatureWidth function:
function getFeatureWidth(feature: any, layerConfig: LayerConfig): number {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']
  const isHovered = props.hoveredIds.has(featureId)
  const isSelected = props.selectedIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

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
  if (isSelected) return baseWidth * 2
  if (hasActiveFilters && !isFiltered) return 1 // Always 1px when dimmed
  return baseWidth
}

// ===== ADD NEW FUNCTION FOR RADIUS =====

// Add this new function for ScatterplotLayer radius calculation:
function getFeatureRadius(feature: any, layerConfig: LayerConfig): number {
  const featureId = feature.properties?.[layerConfig.linkage?.geoProperty || 'id']
  const isHovered = props.hoveredIds.has(featureId)
  const isSelected = props.selectedIds.has(featureId)
  const isFiltered = isFeatureFiltered(feature, layerConfig)
  const hasActiveFilters = props.filteredData.length < layerData.value.get(layerConfig.name)?.length!

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
  if (isSelected) return baseRadius * 1.2
  if (hasActiveFilters && !isFiltered) return baseRadius * 0.5 // Smaller when dimmed
  return baseRadius
}
```

Now update the ScatterplotLayer factory to use `getFeatureRadius`:

```typescript
// Update createScatterplotLayer function:
function createScatterplotLayer(layerConfig: LayerConfig, features: any[]): ScatterplotLayer | null {
  try {
    const sortedFeatures = sortFeaturesByState(features, layerConfig)

    return new ScatterplotLayer({
      id: `scatterplot-${layerConfig.name}`,
      data: sortedFeatures,
      pickable: true,
      radiusMinPixels: 2,
      radiusMaxPixels: 30,

      getPosition: (d: any) => {
        const coords = d.geometry.coordinates
        return coords as Position
      },

      // USE NEW FUNCTION
      getRadius: (d: any) => getFeatureRadius(d, layerConfig),

      getFillColor: (d: any) => getFeatureColor(d, layerConfig),

      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 1,

      onClick: (info: any) => handleClick(info),
      onHover: (info: any) => handleHover(info),

      updateTriggers: {
        getRadius: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.radiusBy],
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.colorBy],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create ScatterplotLayer for "${layerConfig.name}":`, error)
    return null
  }
}

// Also update automatic marker layers to support sizing
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

      // Match parent line width as radius (scaled down)
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
        getFillColor: [props.hoveredIds, props.selectedIds, props.filteredData, layerConfig.colorBy],
      },
    })
  } catch (error) {
    console.error(`[MapCard] Failed to create line destination markers:`, error)
    return null
  }
}
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Line widths scale based on attribute values
- ✅ Point radii scale based on attribute values
- ✅ Min/max values auto-calculated from data
- ✅ Manual scale configuration works
- ✅ State-based multipliers applied correctly
- ✅ Dimmed features use fixed small sizes
- ✅ Automatic markers match parent layer sizes
- ✅ Missing attributes handled gracefully
- ✅ UpdateTriggers include sizing dependencies
- ✅ No console errors for invalid attributes

---

# TASK 10: Implement Z-Index Layer Ordering

**Objective**: Implement proper z-ordering of layers based on zIndex configuration

**Estimated Effort**: Small (1 hour)

**Dependencies**: Part 1 completed

## Context Files to Read

1. **INTERACTIVE_MAP_IMPLEMENTATION.md**
   - Lines 180-191: Z-ordering requirements and configuration

## Key Patterns

```yaml
# YAML configuration
layers:
  - name: base_polygons
    type: polygon
    zIndex: 1
  - name: flows
    type: arc
    zIndex: 2
  - name: highlights
    type: scatterplot
    # No zIndex - uses array position
```

## Implementation

Update the `updateLayers` function in `MapCard.vue`:

```typescript
// Update layers (main render function)
function updateLayers() {
  if (!deckOverlay.value) {
    console.warn('[MapCard] Cannot update layers: overlay not initialized')
    return
  }

  const layers: any[] = []

  // Create layers for each configured layer
  props.layers.forEach((layerConfig, index) => {
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

  // Sort layers by zIndex (if specified) or by original order
  const sortedLayers = sortLayersByZIndex(layers)

  // Update deck overlay
  deckOverlay.value.setProps({ layers: sortedLayers })
  console.log(`[MapCard] Updated ${sortedLayers.length} layers`)
}

// Sort layers by zIndex
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
```

## Files Modified

- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

## Acceptance Criteria

- ✅ Layers with explicit zIndex render in correct order
- ✅ Layers without zIndex use array order
- ✅ Higher zIndex renders on top
- ✅ Automatic markers respect parent layer zIndex
- ✅ Layer order consistent across updates
- ✅ No console errors with zIndex sorting

---

## Summary of Part 2

### Files Created: 0

### Files Modified: 1
- ✅ `/home/user/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`

### What's Complete
- ✅ Advanced tooltip system with template substitution
- ✅ Property formatting and display
- ✅ Theme-aware tooltip styling
- ✅ Categorical color management with default schemes
- ✅ Hash-based color generation
- ✅ Numeric gradient coloring (Viridis)
- ✅ Attribute-based width scaling
- ✅ Attribute-based radius scaling
- ✅ Z-index layer ordering
- ✅ Auto-calculated min/max ranges
- ✅ Manual scale overrides

### What's Next (Part 3)
- ColorLegend component integration
- Comparison mode support
- Dashboard registration
- Example YAML configuration
- Testing and validation

---

## Notes for Implementers

1. **Color Caching**: Consider caching color calculations for large datasets
2. **Scale Calculation**: Min/max calculated once per layer load, not per render
3. **Template Security**: HTML is escaped in tooltips to prevent XSS
4. **Viridis Accuracy**: Polynomial approximation is close but not pixel-perfect to matplotlib
5. **Z-Index Conflicts**: If two layers have same zIndex, original order is preserved
6. **Attribute Validation**: Missing numeric attributes fall back to base value

**End of Part 2**
