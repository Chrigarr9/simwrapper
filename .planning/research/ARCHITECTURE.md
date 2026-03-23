# Architecture Patterns: Interactive Dashboard Enhancements

**Domain:** Transportation simulation visualization - Interactive Dashboard plugin
**Researched:** 2026-01-20
**Confidence:** HIGH (based on thorough codebase analysis)

## Executive Summary

The existing Interactive Dashboard architecture provides a well-structured foundation with clear separation between data management, component rendering, and cross-card coordination. The three-layer architecture (managers, wrapper, cards) establishes patterns that new features should follow. This document details how five proposed features should integrate with minimal architectural friction.

---

## Current Architecture Overview

### Three-Layer Architecture

```
+------------------------------------------------------------------+
|                    InteractiveDashboard.vue                       |
|  (Orchestrator - initializes managers, renders layout, handles    |
|   global state like geometryType, colorByAttribute)               |
+------------------------------------------------------------------+
                                |
          +---------------------+----------------------+
          |                     |                      |
          v                     v                      v
  +---------------+    +----------------+    +------------------+
  | FilterManager |    | LinkageManager |    | DataTableManager |
  | (filter state)|    | (hover/select) |    | (central data)   |
  +---------------+    +----------------+    +------------------+
          |                     |                      |
          +---------------------+----------------------+
                                |
                                v
                  +---------------------------+
                  |  LinkableCardWrapper.vue   |
                  | (subscribes to managers,   |
                  |  provides slot props)      |
                  +---------------------------+
                                |
                                v
          +---------------------+---------------------+
          |                     |                     |
          v                     v                     v
   +-----------+         +-----------+         +-----------+
   | MapCard   |         |HistogramCd|         | PieChart  |
   +-----------+         +-----------+         +-----------+
```

### Key Data Flow

1. **InteractiveDashboard** loads YAML config and data via DataTableManager
2. **FilterManager** and **LinkageManager** are instantiated and passed to cards
3. **LinkableCardWrapper** subscribes to managers as observer
4. Cards receive `filteredData`, `hoveredIds`, `selectedIds` as slot props
5. Cards emit `filter`, `hover`, `select` events back through wrapper
6. Wrapper updates managers, which notify all observers
7. All cards re-render with coordinated state

### Component Boundaries (Current)

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| InteractiveDashboard.vue | Orchestration, YAML parsing, manager lifecycle | All managers, Vuex store |
| DataTableManager | Load CSV, provide data access | HTTPFileSystem |
| FilterManager | Filter state, apply filters (AND/OR logic) | None |
| LinkageManager | Hover/select state propagation | None |
| LinkableCardWrapper | Observer pattern bridge | FilterManager, LinkageManager, DataTableManager |
| MapCard | deck.gl rendering, GeoJSON loading | HTTPFileSystem, maplibre-gl |
| HistogramCard, PieChartCard, ScatterCard | Plotly rendering | Plotly.js |
| colorSchemes.ts | Color utilities | None |

---

## Feature 1: Global Styling Configuration

### Question
Where should global styling config live, how should components access it?

### Recommended Architecture

**Pattern: New StyleManager + YAML Config Section**

```
+------------------------------------------------------------------+
|                    InteractiveDashboard.vue                       |
|  yaml.styling -> new StyleManager(yaml.styling)                   |
+------------------------------------------------------------------+
                                |
                                v
                     +-------------------+
                     |   StyleManager    |
                     | - colors (mode,   |
                     |   activity, etc.) |
                     | - defaults        |
                     | - getCategoryColor|
                     | - getNumericColor |
                     +-------------------+
                                |
              passed as prop to all cards
                                |
          +---------------------+---------------------+
          v                     v                     v
   +-----------+         +-----------+         +-----------+
   | MapCard   |         |HistogramCd|         | PieChart  |
   | (uses     |         | (uses     |         | (uses     |
   |  manager) |         |  manager) |         |  manager) |
   +-----------+         +-----------+         +-----------+
```

### Component Definition

**New File:** `src/plugins/interactive-dashboard/managers/StyleManager.ts`

```typescript
interface StyleConfig {
  colors?: {
    mode?: Record<string, string>
    activity?: Record<string, string>
    categorical?: string[]
    numeric?: {
      colorScale?: string  // 'viridis' | 'plasma' | 'blues' | 'reds'
    }
  }
  defaults?: {
    barColor?: string
    lineWidth?: number
    opacity?: number
  }
}

export class StyleManager {
  constructor(config: StyleConfig)

  // Primary API (replaces direct colorSchemes.ts usage)
  getCategoryColor(value: string, category?: string): string
  getNumericColor(value: number, min: number, max: number): [number, number, number]
  getCategoricalPalette(): string[]

  // Merges YAML config with defaults from colorSchemes.ts
  // Components call these instead of importing colorSchemes.ts directly
}
```

### Integration Points

| Location | Change |
|----------|--------|
| InteractiveDashboard.vue | Create StyleManager from `yaml.styling`, pass as prop |
| LinkableCardWrapper.vue | Add `styleManager` prop, pass to slot |
| All card components | Accept optional `styleManager` prop, use instead of importing colorSchemes |
| colorSchemes.ts | Keep as fallback defaults, StyleManager uses internally |

### YAML Config Example

```yaml
header:
  title: My Dashboard

styling:
  colors:
    mode:
      car: '#e74c3c'
      pt: '#2196F3'
      bike: '#4CAF50'
      walk: '#FF9800'
    categorical:
      - '#1f77b4'
      - '#ff7f0e'
      - '#2ca02c'
    numeric:
      colorScale: viridis
  defaults:
    barColor: '#3498db'
    opacity: 0.8

table:
  dataset: trips.csv
  idColumn: trip_id
```

### Build Order

1. Create StyleManager.ts
2. Update InteractiveDashboard to instantiate StyleManager
3. Update LinkableCardWrapper to pass styleManager
4. Update each card component to use styleManager (backwards compatible - fallback to colorSchemes if not provided)

### Data Flow

```
YAML config
    |
    v
InteractiveDashboard (parses yaml.styling)
    |
    v
new StyleManager(yaml.styling)
    |
    v
passed as prop to cards
    |
    v
Cards call styleManager.getCategoryColor() instead of getCategoryColor()
```

---

## Feature 2: Correlation Matrix Card

### Question
How to integrate with existing card system and LinkageManager?

### Recommended Architecture

**Pattern: New Card Type Following Existing Patterns**

The CorrelationMatrixCard should follow the exact same pattern as ScatterCard:
- Accept `filteredData` from LinkableCardWrapper
- Emit `filter`, `hover`, `select` events
- Register in `_allPanels.ts`

```
+---------------------------+
|  LinkableCardWrapper.vue   |
+---------------------------+
            |
            v
+---------------------------+
| CorrelationMatrixCard.vue  |
| - Receives filteredData    |
| - Computes correlations    |
| - Renders heatmap          |
| - Cell click -> filter     |
| - Cell hover -> highlight  |
+---------------------------+
```

### Component Definition

**New File:** `src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue`

```typescript
interface Props {
  // Standard linkable card props
  filteredData?: any[]
  hoveredIds?: Set<any>
  selectedIds?: Set<any>

  // Card-specific props
  columns: string[]  // Which numeric columns to include
  title?: string
  colorScale?: 'diverging' | 'sequential'  // Red-white-blue vs single gradient

  // Linkage config
  linkage?: LinkageConfig

  // Optional style manager
  styleManager?: StyleManager
}

// Emits
emit('filter', filterId, column, values)  // Click cell -> filter rows where X and Y are in certain range
emit('hover', ids)  // Hover cell -> no linkage (correlation is aggregate)
```

### Integration Points

| Location | Change |
|----------|--------|
| `_allPanels.ts` | Add `'correlation-matrix': CorrelationMatrixCard` |
| InteractiveDashboard.vue | No changes needed (uses panelLookup) |
| InteractiveDashboardConfig.ts | Add CorrelationMatrixCardConfig interface |

### Interaction Model

Unlike other cards, correlation matrix shows aggregate statistics, so linkage works differently:

| Interaction | Behavior |
|-------------|----------|
| Hover cell | Show tooltip with correlation value, sample size |
| Click cell | Filter data to rows where both columns have non-null values (optional) |
| Scatter drill-down | Click cell -> open scatter plot modal for that pair |

### Build Order

1. Create CorrelationMatrixCard.vue
2. Register in _allPanels.ts
3. Add type definition in InteractiveDashboardConfig.ts
4. Test with YAML config

### YAML Config Example

```yaml
layout:
  row1:
    - type: correlation-matrix
      title: Variable Correlations
      columns:
        - distance
        - duration
        - speed
        - fare
      colorScale: diverging
      linkage:
        type: filter
        behavior: toggle
```

---

## Feature 3: Dual-Map Synchronization

### Question
Extend existing MapCard or create new component?

### Recommended Architecture

**Pattern: Extend MapCard with Sync Mode + Coordinator**

Do NOT create a new DualMapCard component. Instead:
1. Create a `MapSyncManager` that coordinates multiple MapCard instances
2. MapCard gets optional `syncGroup` prop
3. Cards in the same syncGroup coordinate camera/hover/selection

```
+------------------------------------------------------------------+
|                    InteractiveDashboard.vue                       |
|  Creates MapSyncManager when yaml.map?.sync?.enabled === true     |
+------------------------------------------------------------------+
                                |
                                v
                     +-------------------+
                     |  MapSyncManager   |
                     | - camera state    |
                     | - sync groups     |
                     | - broadcast()     |
                     +-------------------+
                          |         |
              +-----------+         +-----------+
              v                                 v
     +---------------+                 +---------------+
     | MapCard       |                 | MapCard       |
     | syncGroup: A  |                 | syncGroup: A  |
     | (baseline)    |                 | (scenario)    |
     +---------------+                 +---------------+
```

### Component Definition

**New File:** `src/plugins/interactive-dashboard/managers/MapSyncManager.ts`

```typescript
interface SyncConfig {
  enabled: boolean
  groups: Record<string, string[]>  // group name -> array of card IDs
  syncCamera?: boolean
  syncHover?: boolean
  syncSelection?: boolean
}

export class MapSyncManager {
  private groups: Map<string, Set<string>> = new Map()
  private cameraState: Map<string, ViewState> = new Map()
  private observers: Map<string, MapSyncObserver> = new Map()

  addMap(cardId: string, group: string, observer: MapSyncObserver): void
  removeMap(cardId: string): void

  // Called by MapCard when camera moves
  broadcastCameraMove(sourceId: string, viewState: ViewState): void

  // Called by MapCard on hover
  broadcastHover(sourceId: string, featureIds: Set<any>): void
}

interface MapSyncObserver {
  onCameraSync(viewState: ViewState): void
  onHoverSync(featureIds: Set<any>): void
}
```

### MapCard Changes

```typescript
// Additional props
interface Props {
  // ... existing props ...
  syncGroup?: string
  mapSyncManager?: MapSyncManager
}

// In mounted()
if (props.syncGroup && props.mapSyncManager) {
  props.mapSyncManager.addMap(cardId, props.syncGroup, {
    onCameraSync: (viewState) => map.value.jumpTo(viewState),
    onHoverSync: (ids) => hoveredFeatureIds.value = ids
  })
}

// In map 'move' event
if (props.mapSyncManager) {
  props.mapSyncManager.broadcastCameraMove(cardId, getCurrentViewState())
}
```

### Integration Points

| Location | Change |
|----------|--------|
| InteractiveDashboard.vue | Create MapSyncManager if yaml.map?.sync |
| MapCard.vue | Add syncGroup, mapSyncManager props |
| InteractiveDashboardConfig.ts | Add MapSyncConfig interface |

### YAML Config Example

```yaml
map:
  sync:
    enabled: true
    syncCamera: true
    syncHover: true
    groups:
      comparison: ['map-baseline', 'map-scenario']

layout:
  row1:
    - type: map
      id: map-baseline
      title: Baseline
      syncGroup: comparison
      layers:
        - name: zones
          file: zones_baseline.geojson
    - type: map
      id: map-scenario
      title: Scenario
      syncGroup: comparison
      layers:
        - name: zones
          file: zones_scenario.geojson
```

### Build Order

1. Create MapSyncManager.ts
2. Update MapCard.vue with sync props and observer registration
3. Update InteractiveDashboard.vue to create manager
4. Add sync config types

### Data Flow

```
MapCard A (user drags)
    |
    v
mapSyncManager.broadcastCameraMove(A, viewState)
    |
    +-> observers['B'].onCameraSync(viewState)
    |         |
    |         v
    |   MapCard B map.jumpTo(viewState)
    |
    +-> observers['C'].onCameraSync(viewState)
              |
              v
        MapCard C map.jumpTo(viewState)
```

---

## Feature 4: Timeline Visualization

### Question
New card type, what data flow?

### Recommended Architecture

**Pattern: New TimelineCard with Temporal Filter Integration**

```
+---------------------------+
|  LinkableCardWrapper.vue   |
+---------------------------+
            |
            v
+---------------------------+
|     TimelineCard.vue       |
| - Aggregates by time       |
| - Brush selection          |
| - Emits time range filter  |
+---------------------------+
            |
            v (emit)
+---------------------------+
|      FilterManager         |
| - 'range' filter type      |
| - min/max time values      |
+---------------------------+
```

### Component Definition

**New File:** `src/plugins/interactive-dashboard/components/cards/TimelineCard.vue`

```typescript
interface Props {
  // Standard linkable card props
  filteredData?: any[]
  hoveredIds?: Set<any>
  selectedIds?: Set<any>

  // Card-specific props
  timeColumn: string
  aggregation: 'count' | 'sum' | 'avg'
  valueColumn?: string  // Required for sum/avg
  binSize?: 'hour' | 'day' | 'week' | 'month' | 'auto'

  // Time display
  timeFormat?: ColumnFormat  // From tableConfig

  // Linkage
  linkage?: LinkageConfig

  // Style
  styleManager?: StyleManager
  tableConfig?: TableConfig
}

// Emits
emit('filter', filterId, column, values, 'range', { min, max })
emit('hover', ids)  // Hover over time bin -> highlight rows in that bin
```

### FilterManager Enhancement

The current FilterManager supports `categorical`, `range`, `time`, `binned` types. Timeline should use `range` type for brush selections:

```typescript
// Already exists in FilterManager
interface Filter {
  type: FilterType  // 'range' is already supported
  values: Set<any>  // For range: Set with single object { min, max }
}
```

### Integration Points

| Location | Change |
|----------|--------|
| `_allPanels.ts` | Add `'timeline': TimelineCard` |
| FilterManager.ts | May need range filter apply logic enhancement |
| InteractiveDashboardConfig.ts | Add TimelineCardConfig interface |

### Interaction Model

| Interaction | Behavior |
|-------------|----------|
| Hover time bin | Highlight all rows with timestamps in that bin |
| Click time bin | Filter to rows in that bin |
| Brush selection | Filter to rows in time range |
| Animation | Play button cycles through time, updating filter |

### Build Order

1. Create TimelineCard.vue with basic line chart
2. Add brush selection (d3-brush or Plotly rangeslider)
3. Integrate time range filtering
4. Add animation controls (optional)

### YAML Config Example

```yaml
layout:
  row1:
    - type: timeline
      title: Trips Over Time
      timeColumn: departure_time
      aggregation: count
      binSize: hour
      linkage:
        type: filter
        column: departure_time
        behavior: replace
```

### Data Flow

```
User drags brush on timeline
    |
    v
TimelineCard computes time range (e.g., 08:00-10:00)
    |
    v
emit('filter', 'timeline-departure_time', 'departure_time',
     new Set([{min: 28800, max: 36000}]), 'range')
    |
    v
LinkableCardWrapper -> FilterManager.setFilter()
    |
    v
FilterManager notifies all observers
    |
    v
All cards receive new filteredData (rows where 28800 <= departure_time < 36000)
```

---

## Feature 5: Graph Visualization

### Question
Rendering approach, interaction model?

### Recommended Architecture

**Pattern: New GraphCard Using vis-network or d3-force**

Graph visualization is fundamentally different from other charts - it shows relationships, not data attributes. Two rendering options:

| Option | Pros | Cons |
|--------|------|------|
| vis-network | Full-featured, built-in interaction | 350KB bundle |
| d3-force | Lightweight, more control | More code to write |
| deck.gl GraphLayer | Consistent with MapCard | Less mature |

**Recommendation: vis-network** for rich interaction, OR **d3-force** if bundle size is critical.

```
+---------------------------+
|  LinkableCardWrapper.vue   |
+---------------------------+
            |
            v
+---------------------------+
|      GraphCard.vue         |
| - vis-network/d3-force     |
| - Nodes from data rows     |
| - Edges from edge file     |
| - Node click -> filter     |
+---------------------------+
            |
    +-------+-------+
    |               |
    v               v
nodes.csv       edges.csv
(from table)    (separate file)
```

### Component Definition

**New File:** `src/plugins/interactive-dashboard/components/cards/GraphCard.vue`

```typescript
interface Props {
  // Standard linkable card props
  filteredData?: any[]
  hoveredIds?: Set<any>
  selectedIds?: Set<any>

  // Graph data sources
  nodeIdColumn: string        // Column in central table to use as node ID
  nodeLabelColumn?: string    // Column to display as node label

  // Edge configuration
  edges?: {
    file: string              // Path to edges CSV
    sourceColumn: string      // Column in edges file for source node
    targetColumn: string      // Column in edges file for target node
    weightColumn?: string     // Optional edge weight
  }

  // Visual encoding
  nodeColorBy?: string        // Column to color nodes by (categorical)
  nodeSizeBy?: string         // Column to size nodes by (numeric)
  edgeColorBy?: string        // Column to color edges by

  // Layout
  layout?: 'force' | 'hierarchical' | 'circular'

  // Linkage
  linkage?: LinkageConfig

  // Style
  styleManager?: StyleManager
}

// Emits
emit('filter', filterId, column, values)  // Node click -> filter
emit('hover', ids)                         // Node hover -> highlight
emit('select', ids)                        // Node selection
```

### Interaction Model

| Interaction | Behavior |
|-------------|----------|
| Hover node | Highlight connected nodes and edges |
| Click node | Filter to that row in central table |
| Multi-select | Filter to selected nodes |
| Hover from other card | Highlight node matching hovered ID |
| Filter from other card | Dim/hide non-matching nodes |

### Integration Points

| Location | Change |
|----------|--------|
| `_allPanels.ts` | Add `'graph': GraphCard` |
| package.json | Add vis-network or use d3 (already present) |
| InteractiveDashboardConfig.ts | Add GraphCardConfig interface |

### Build Order

1. Create GraphCard.vue with static rendering
2. Add node/edge loading from files
3. Integrate hover/select with LinkageManager
4. Add filter response (dim non-matching nodes)
5. Add visual encoding (color, size)

### YAML Config Example

```yaml
layout:
  row1:
    - type: graph
      title: OD Flow Network
      nodeIdColumn: zone_id
      nodeLabelColumn: zone_name
      edges:
        file: flows.csv
        sourceColumn: origin
        targetColumn: destination
        weightColumn: trip_count
      nodeColorBy: zone_type
      nodeSizeBy: total_trips
      layout: force
      linkage:
        type: filter
        column: zone_id
        behavior: toggle
```

### Data Flow

```
GraphCard mounted
    |
    v
Load edges file (flows.csv) via HTTPFileSystem
    |
    v
Build graph from:
  - Nodes: filteredData rows (from DataTableManager via wrapper)
  - Edges: loaded edge file
    |
    v
Render with vis-network/d3-force
    |
    v
Node click -> emit('select', new Set([nodeId]))
    |
    v
LinkageManager propagates to all cards
    |
    v
MapCard highlights corresponding zone
PieChart highlights corresponding slice
etc.
```

---

## Build Order Summary

Based on dependencies and architectural complexity:

### Phase 1: Foundation (No External Dependencies)
1. **StyleManager** - Required by all other features for consistent styling
2. **CorrelationMatrixCard** - Standalone, follows existing patterns exactly

### Phase 2: Time/Animation
3. **TimelineCard** - Requires minor FilterManager enhancement for range type

### Phase 3: Spatial Coordination
4. **MapSyncManager + MapCard updates** - Modifies existing component

### Phase 4: Complex Visualization
5. **GraphCard** - May need new dependency, most complex interaction model

### Dependency Graph

```
StyleManager (none)
     |
     +--> CorrelationMatrixCard (depends on StyleManager for optional styling)
     |
     +--> TimelineCard (depends on StyleManager, FilterManager range enhancement)
     |
     +--> GraphCard (depends on StyleManager)

MapSyncManager (none)
     |
     +--> MapCard updates (depends on MapSyncManager)
```

---

## Integration Points Summary

| Feature | New Files | Modified Files | New Deps |
|---------|-----------|----------------|----------|
| StyleManager | `managers/StyleManager.ts` | InteractiveDashboard, LinkableCardWrapper, all cards | None |
| CorrelationMatrixCard | `cards/CorrelationMatrixCard.vue` | `_allPanels.ts`, `InteractiveDashboardConfig.ts` | None (use Plotly heatmap) |
| MapSyncManager | `managers/MapSyncManager.ts` | InteractiveDashboard, MapCard | None |
| TimelineCard | `cards/TimelineCard.vue` | `_allPanels.ts`, `InteractiveDashboardConfig.ts` | None (use Plotly) |
| GraphCard | `cards/GraphCard.vue` | `_allPanels.ts`, `InteractiveDashboardConfig.ts` | vis-network OR d3 |

---

## Anti-Patterns to Avoid

### 1. Direct Store Mutations from Cards

**Bad:** Card directly mutates Vuex store
```typescript
// BAD
globalStore.commit('setFilter', filter)
```

**Good:** Card emits events, wrapper handles coordination
```typescript
// GOOD
emit('filter', filterId, column, values)
```

### 2. Bypassing LinkableCardWrapper

**Bad:** Card subscribes directly to FilterManager
```typescript
// BAD - in card component
filterManager.addObserver(this.onFilter)
```

**Good:** Card receives filtered data as prop
```typescript
// GOOD
props.filteredData  // Provided by LinkableCardWrapper slot
```

### 3. Tight Coupling Between Cards

**Bad:** MapCard imports and directly calls PieChart methods
```typescript
// BAD
import PieChartCard from './PieChartCard.vue'
pieChart.highlightSlice(value)
```

**Good:** Communication via managers
```typescript
// GOOD
linkageManager.setHoveredIds(ids)  // All cards observe this
```

### 4. Duplicating Color Logic

**Bad:** Each card has its own color calculation
```typescript
// BAD - in each card
function getModeColor(mode) { ... }
```

**Good:** Centralized in StyleManager
```typescript
// GOOD
styleManager.getCategoryColor(mode, 'mode')
```

---

## Sources

- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/InteractiveDashboard.vue` (lines 1-2013)
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/managers/LinkageManager.ts`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/managers/FilterManager.ts`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/managers/DataTableManager.ts`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/MapCard.vue`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/HistogramCard.vue`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/PieChartCard.vue`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/ScatterCard.vue`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/utils/colorSchemes.ts`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/src/dash-panels/_allPanels.ts`
- `/mnt/Shared/Code/projects/Dissertation/simwrapper/CLAUDE.md`
