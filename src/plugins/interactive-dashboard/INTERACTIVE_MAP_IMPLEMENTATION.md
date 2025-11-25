# Interactive Map Implementation Summary

**Status**: Planning Complete  
**Created**: 2024-11-25  
**Goal**: Create generalized MapCard component for InteractiveDashboard with full commuter-requests plugin feature parity

---

## Executive Summary

This document summarizes the design decisions and requirements for implementing a new `MapCard.vue` component for the InteractiveDashboard plugin. The MapCard will provide all functionality of the commuter-requests plugin map but in a generalized, YAML-configurable way that integrates with the InteractiveDashboard coordination system.

---

## Core Requirements

### 1. Integration with Coordination System
- **FilterManager**: Apply filters from other cards (histogram, pie chart, table)
- **LinkageManager**: Coordinate hover and selection across all cards
- **DataTableManager**: Access centralized data table for filtering and linkage
- **LinkableCardWrapper**: Receive `filteredData`, `hoveredIds`, `selectedIds` as props

### 2. Deck.gl Layer Support
Five layer types with automatic features:
- **PolygonLayer**: Cluster boundaries, areas, regions
- **LineLayer**: Request O-D flows, connections + **automatic destination markers**
- **ArcLayer**: Curved cluster flows + **automatic arrow tips**
- **ScatterplotLayer**: Points, markers, custom destinations
- **Automatic Markers**: ScatterplotLayer auto-generated for LineLayer/ArcLayer endpoints
  - White outline [255,255,255,200]
  - Radius: 3px default → 8px hover → 5px filtered → 2px unfiltered

### 3. Multi-Select and Visual Feedback
- **Multi-select by default**: Click to toggle selection without modifier keys
- **Automatic visual dimming**: Unfiltered items when filters active
  - Desaturation: Average RGB with gray [180,180,180]
  - Opacity: 60 for lines, 80 for markers
  - Width: 1px for lines, 2px for markers
- **State-based highlighting**:
  - Selected: Blue [59,130,246,255]
  - Hovered: Orange [251,146,60,255]
  - Default: Attribute-based or config color

### 4. Coordinated Hover via Shared Linkage
**Simplified hover pattern**: Multiple geometry files achieve coordinated hover by linking to same table column.

**Example**: Cluster polygons + flow arcs both use:
```yaml
linkage:
  tableColumn: "cluster_id"
  geoProperty: "cluster_id"
```
When hovering a flow arc, both origin and destination cluster polygons highlight automatically.

**Eliminates need for**: Flow-specific hover tracking (`hoveredFlowClusterPair` state)

### 5. Dynamic Coloring System
- **Categorical colors**: Mode, activity type, cluster ID
  - Uses `getModeColorRGB` from `colorSchemes.ts`
  - Hash-based color generation for unique IDs
- **Numeric gradients**: Viridis algorithm (purple→blue→green→yellow)
  - Polynomial approximation for R, G, B channels
  - Auto-calculated or manual min/max scale
- **Attribute-based sizing**: Line width and point radius scale with data values
  - Auto-calculated min/max from dataset
  - Linear interpolation between scale range

### 6. Integrated Color Legend
- **Position**: Fixed bottom-right (z-index 1000, 20px from edges)
- **Display modes**:
  - Categorical: Discrete color swatches with labels
  - Numeric: Gradient bar with min/max values
- **Interactive filtering**: Click categorical swatch to filter to that value
- **Auto-generated**: From `colorBy.attribute` configuration

### 7. Global Comparison Mode
- **Scope**: Dashboard-wide feature, not map-specific
- **Toggle location**: Table configuration section (ComparisonToggle checkbox)
- **Map rendering**: Baseline geometries at 30% gray opacity behind filtered data
- **Chart integration**: Histogram/pie chart also render dual traces
- **Data flow**: DataTableManager tracks both `filteredData` and `baselineData`

---

## Technical Architecture

### Component Structure
```
MapCard.vue (NEW)
├─ MapLibre GL JS (base map with theme switching)
├─ Deck.gl MapboxOverlay (layers)
│  ├─ PolygonLayer
│  ├─ LineLayer + auto ScatterplotLayer (destinations)
│  ├─ ArcLayer + auto ScatterplotLayer (arrow tips)
│  └─ ScatterplotLayer (custom points)
├─ Layer Manager
│  ├─ GeoJSON data loader
│  ├─ Property-based filtering
│  ├─ Deep cloning (Vue reactivity fix)
│  └─ updateTriggers optimization
├─ Color Manager
│  ├─ Categorical mapping
│  ├─ Numeric scaling
│  └─ Attribute-based sizing
├─ Interaction Handler
│  ├─ Click (multi-select)
│  ├─ Hover (emit to wrapper)
│  └─ pickMultipleObjects (2px radius)
├─ Tooltip Renderer
│  └─ Template with {properties.xxx} substitution
└─ ColorLegend Component (integrated)
   ├─ Categorical swatches
   ├─ Numeric gradient
   └─ Click-to-filter
```

### Props Interface
```typescript
interface MapCardProps {
  // From LinkableCardWrapper
  filteredData: any[]
  hoveredIds: Set<any>
  selectedIds: Set<any>
  linkage?: LinkageConfig
  
  // Comparison mode
  showComparison: boolean
  baselineData?: any[]
  
  // Configuration
  config: MapConfig
  
  // Dashboard context
  fileSystemConfig: FileSystemConfig
  subfolder: string
}
```

---

## Key Implementation Patterns

### 1. Deep Cloning for Vue Reactivity
**Issue**: Vue reactivity proxies break deck.gl geometry processing  
**Solution**: Deep clone all GeoJSON data
```typescript
const clonedData = JSON.parse(JSON.stringify(rawGeoJSON))
```
**Apply to**: All geometry data before passing to deck.gl layers

### 2. UpdateTriggers Optimization
**Purpose**: Tell deck.gl exactly which dependencies trigger layer property updates  
**Benefit**: Only re-render when relevant state changes, not on every Vue update

**Example**:
```typescript
new LineLayer({
  // ... layer config
  updateTriggers: {
    getWidth: [hoveredIds, selectedIds, filteredData],
    getColor: [hoveredIds, selectedIds, filteredData, colorByAttribute],
  }
})
```

**Apply to**: Every dynamic layer property (getColor, getWidth, getRadius, etc.)

### 3. Multi-Object Detection
**Purpose**: Detect stacked/overlapping geometries for multi-cluster hover  
**Implementation**: `pickMultipleObjects` with hardcoded 2px radius
```typescript
const picked = this.deckOverlay.pickMultipleObjects({
  x: info.x,
  y: info.y,
  layerIds: ['cluster-boundaries'],
  radius: 2,  // HARDCODED
})
```

### 4. Layer Z-Ordering
**Priority**: Explicit `zIndex` from YAML > Config order  
**Fallback**: Layers render in array order from YAML
```yaml
layers:
  - name: base_polygons
    zIndex: 1
  - name: flows
    zIndex: 2
  - name: highlights
    # No zIndex - uses position (renders last)
```

---

## YAML Configuration Schema

### Map Configuration
```yaml
layout:
  row1:
    - type: map
      title: "Interactive Map"
      width: 2
      height: 12
      
      # Map viewport
      center: [13.4, 52.52]  # [lng, lat]
      zoom: 10
      mapStyle: "auto"  # "light" | "dark" | "auto"
      
      # Layer definitions
      layers:
        - name: cluster_boundaries
          file: cluster_geometries.geojson
          type: polygon
          visible: true
          zIndex: 1  # Optional explicit ordering
          
          # Styling
          fillColor: "#9b59b6"
          fillOpacity: 0.15
          lineColor: "#8e44ad"
          lineWidth: 2
          
          # Dynamic coloring (replaces static colors)
          colorBy:
            attribute: cluster_type
            type: categorical  # or "numeric"
            colors:
              origin: "#3498db"
              destination: "#e74c3c"
              spatial: "#9b59b6"
            # For numeric:
            # scale: [0, 100]  # min/max values
          
          # Property filters
          filter:
            - property: geometry_type
              value: boundary
          
          # Linkage to centralized data
          linkage:
            tableColumn: origin_cluster
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter
        
        - name: request_lines
          file: requests_geometries.geojson
          type: line
          visible: true
          # Automatic destination markers generated
          
          width: 2
          color: "#3498db"
          opacity: 0.6
          
          colorBy:
            attribute: main_mode
            type: categorical
            colors:
              car: "#e74c3c"
              pt: "#3498db"
              bike: "#2ecc71"
              walk: "#f39c12"
          
          # Width scaling by attribute
          widthBy:
            attribute: travel_time
            scale: [1, 6]  # min/max width
          
          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight
            onSelect: filter
        
        - name: cluster_flows
          file: cluster_geometries.geojson
          type: arc
          visible: true
          # Automatic arrow tips generated
          
          arcHeight: 0.2
          arcTilt: 25
          
          filter:
            property: geometry_type
            value: flow
          
          widthBy:
            attribute: num_requests
            scale: [4, 14]
          
          linkage:
            tableColumn: cluster_id  # Same as boundaries - coordinated hover!
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter
      
      # Tooltip configuration
      tooltip:
        enabled: true
        template: |
          <div>
            <b>{properties.request_id}</b><br/>
            Mode: {properties.main_mode}<br/>
            Time: {properties.travel_time} min
          </div>
      
      # Color legend
      legend:
        enabled: true
        position: "bottom-right"  # Fixed position
        clickToFilter: true  # Enable interactive filtering
```

### Centralized Data Table with Comparison
```yaml
table:
  name: "Request Data"
  dataset: "requests.csv"
  idColumn: "request_id"
  visible: true
  
  # Comparison toggle location
  showComparisonToggle: true
  
  columns:
    request_id:
      visible: true
    main_mode:
      visible: true
    travel_time:
      visible: true
      format:
        type: duration
        unit: minutes
```

---

## Reference Implementation Files

### Primary References (commuter-requests plugin)
1. **RequestsMap.vue** (`src/plugins/commuter-requests/components/RequestsMap.vue`)
   - Lines 174-195: MapLibre initialization with theme
   - Lines 197-296: Deck.gl overlay with tooltips
   - Lines 315-481: PolygonLayer with state-based styling
   - Lines 484-651: ArcLayer with flow arrows
   - Lines 733-813: LineLayer with dynamic coloring
   - Lines 815-882: ScatterplotLayer destination markers
   - Lines 876-879: UpdateTriggers optimization pattern
   - Lines 1015-1040: Auto fit bounds

2. **CommuterRequests.vue** (`src/plugins/commuter-requests/CommuterRequests.vue`)
   - Lines 384-389: Comparison mode implementation
   - Lines 672-686: Multi-cluster click handler
   - Lines 718-720: Hover coordination

3. **ColorLegend.vue** (`src/plugins/commuter-requests/components/ColorLegend.vue`)
   - Lines 1-158: Complete legend component
   - Lines 90-95: Fixed positioning CSS

4. **colorSchemes.ts** (`src/plugins/commuter-requests/utils/colorSchemes.ts`)
   - Lines 6-92: Categorical color definitions
   - getModeColorRGB, getActivityColorRGB functions

5. **filters.ts** (`src/plugins/commuter-requests/utils/filters.ts`)
   - Lines 1-115: Multi-filter architecture with AND/OR logic
   - Lines 19-38: Cluster filter with string ID handling

6. **CommuterRequestsConfig.ts** (`src/plugins/commuter-requests/CommuterRequestsConfig.ts`)
   - Lines 1-127: TypeScript interface definitions
   - Request, ClusterBoundary, ColorByConfig interfaces

### Coordination System
7. **FilterManager.ts** (`src/plugins/interactive-dashboard/managers/FilterManager.ts`)
   - Filter state management

8. **LinkageManager.ts** (`src/plugins/interactive-dashboard/managers/LinkageManager.ts`)
   - Hover/select coordination

9. **DataTableManager.ts** (`src/plugins/interactive-dashboard/managers/DataTableManager.ts`)
   - Centralized data access
   - Lines 34-48: File loading pattern

10. **LinkableCardWrapper.vue** (`src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue`)
    - Slot prop pattern for filtered data
    - Event handling for filter/hover/select

### Existing Card Patterns
11. **HistogramCard.vue** (`src/plugins/interactive-dashboard/components/cards/HistogramCard.vue`)
    - Props structure and emit patterns
    - Lines 70-95: Filter emission

12. **PieChartCard.vue** (`src/plugins/interactive-dashboard/components/cards/PieChartCard.vue`)
    - Categorical data handling

### Dashboard Integration
13. **InteractiveDashboard.vue** (`src/plugins/interactive-dashboard/InteractiveDashboard.vue`)
    - Lines 469-476: Coordination layer initialization
    - Main orchestration component

14. **_allPanels.ts** (`src/dash-panels/_allPanels.ts`)
    - Panel registry where MapCard will be registered
    - Lines 16-17: Example registrations

---

## Feature Decisions Summary

### Implemented as Core Features
✅ **Automatic destination markers** for LineLayer/ArcLayer  
✅ **Multi-select by default** (no modifier keys required)  
✅ **Automatic visual dimming** of unfiltered items  
✅ **Coordinated hover** via shared table column linkage  
✅ **Integrated ColorLegend** with click-to-filter  
✅ **Global comparison mode** across entire dashboard  
✅ **Deep cloning** for Vue reactivity compatibility  
✅ **UpdateTriggers optimization** for performance  
✅ **pickMultipleObjects** with 2px radius (hardcoded)  
✅ **Z-ordering** via optional zIndex property  

### Simplified/Removed
❌ **Flow-specific hover state** - Replaced by shared linkage pattern  
❌ **Layer positioning config** - Legend fixed at bottom-right  
❌ **Configurable detection radius** - Hardcoded at 2px  

### Future Extensions
🔮 **Additional layer types** (with placeholder documentation):
- HexagonLayer for spatial aggregation
- HeatmapLayer for density visualization
- TextLayer for labels and annotations

🔮 **Advanced tooltip features**:
- Conditional rendering
- Formatting functions
- Computed properties

🔮 **Performance optimizations**:
- Data sampling for large datasets (>10k features)
- Viewport-based filtering
- Layer caching for comparison mode

---

## Performance Considerations

### Optimization Strategies
1. **UpdateTriggers**: Minimize layer re-renders by specifying exact dependencies
2. **Deep Cloning**: Only applied once at data load, not on every update
3. **Computed Properties**: Vue automatically caches derived state
4. **Conditional Rendering**: Layers with `visible: false` not created
5. **Comparison Mode**: Consider layer caching when baseline data unchanging

### Performance Targets
- **60 FPS** for <5,000 features
- **Acceptable** (30+ FPS) for 5,000-10,000 features
- **Future**: Implement sampling/clustering for >10,000 features

---

## Extensibility

### Adding New Layer Types
The MapCard is designed for future extension. To add new deck.gl layer types:

1. **Add import** to MapCard.vue:
```typescript
// import { HexagonLayer } from '@deck.gl/aggregation-layers'
```

2. **Add factory method**:
```typescript
// const createHexagonLayer = (layerConfig: LayerConfig): HexagonLayer | null => {
//   // Implementation
// }
```

3. **Add to updateLayers switch**:
```typescript
// case 'hexagon':
//   layer = createHexagonLayer(layerConfig)
//   break
```

4. **Document in YAML schema** with example configuration

### Tooltip Template Extensions
Current implementation uses simple string substitution. Future enhancements:
- Conditional blocks: `{{#if properties.mode}}`
- Formatting helpers: `{{format properties.time "HH:mm"}}`
- Computed values: `{{multiply properties.distance 0.001}} km`

---

## Testing Strategy

### Unit Tests
- Layer data loading and filtering
- Color parsing and conversion
- Interaction handlers (click, hover)
- Tooltip template rendering
- Bounds calculation

### Integration Tests
- Map loads in dashboard
- Filtering propagates from table to map
- Hovering highlights features
- Selection works across components
- Comparison mode renders correctly

### End-to-End Tests
- Complete dashboard with real data
- Multiple maps coordinate properly
- Legend click-to-filter works
- All layer types render correctly

---

## Success Criteria

The MapCard implementation is complete when:

1. ✅ All 5 layer types render correctly
2. ✅ Automatic destination markers work for lines/arcs
3. ✅ Multi-select and dimming function as expected
4. ✅ Coordinated hover via shared linkage works
5. ✅ ColorLegend displays and filters correctly
6. ✅ Comparison mode renders baseline geometries
7. ✅ Example dashboard replicates commuter-requests functionality
8. ✅ No console errors or warnings
9. ✅ Performance meets targets (<5k features at 60fps)
10. ✅ Documentation is complete and accurate

---

## Open Questions & Decisions Made

### Q1: ID Mapping Pattern Documentation?
**Decision**: Not needed. Standard string extraction patterns work without special documentation.

### Q2: Comparison Mode Performance Optimization?
**Decision**: Implement basic rendering first. Add layer caching if performance issues arise during testing.

### Q3: ColorLegend Click Interaction?
**Decision**: **YES - Implement click-to-filter**. Clicking categorical swatch emits filter event. Essential for interactive exploration.

---

## Next Steps

1. Create MapCard.vue component file
2. Implement layer factories one at a time
3. Add ColorLegend integration
4. Enable comparison mode in InteractiveDashboard
5. Update example dashboard YAML
6. Write comprehensive documentation
7. Add unit and integration tests
8. Performance testing and optimization

---

## Document History

- **2024-11-25**: Initial planning document created
- Incorporates feedback from implementation discussion
- Ready for agent-based implementation
