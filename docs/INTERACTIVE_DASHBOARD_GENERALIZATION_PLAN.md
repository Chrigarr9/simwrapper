# Interactive Dashboard - Generalization Plan
## From Commuter Requests to Generic Dashboard Plugin

**Last Updated**: 2025-11-19 (Updated with user feedback)
**Status**: Planning Phase - Ready to implement
**Based on**: Existing `commuter-requests` plugin implementation

---

## Executive Summary

This document outlines the plan to **generalize** the existing `commuter-requests` plugin into a reusable **Interactive Dashboard** plugin. The commuter-requests plugin is a fully-functional, specialized implementation that demonstrates all the key patterns we need. Our task is to extract these patterns into a generic, YAML-configurable system.

### What We Have ✅

The `src/plugins/commuter-requests/` plugin is a **complete implementation** with:
- Interactive data table with filtering and highlighting
- Multiple statistics (histogram, pie chart, summary cards) with **OR-logic multi-select**
- Deck.gl map with request geometries and cluster boundaries
- Bi-directional filtering between all components
- **Multi-geometry linkage** (multiple layers linked by same ID)
- Comparison mode (filtered vs. baseline)
- Hover interactions and synchronized highlighting
- YAML configuration support
- Export functionality

### What We Need to Do 🎯

**Extract and generalize** this implementation into:
- Generic data table that works with any CSV (REQUIRED component)
- Pluggable stat system (OPTIONAL, not hard-coded to time/mode)
- Flexible map system (OPTIONAL, configurable geometry types and linkages)
- Generic filter manager with **OR logic within filter groups**
- **Layer visibility multi-select** (replace cluster type selector)
- YAML-driven configuration (no code changes for new dashboards)

---

## Table of Contents

1. [Analysis of Existing Implementation](#analysis-of-existing-implementation)
2. [User Requirements & Clarifications](#user-requirements--clarifications)
3. [Generalization Strategy](#generalization-strategy)
4. [Proposed Architecture](#proposed-architecture)
5. [Component Mapping](#component-mapping)
6. [YAML Configuration Design](#yaml-configuration-design)
7. [Implementation Phases](#implementation-phases)
8. [Migration Path](#migration-path)

---

## Analysis of Existing Implementation

### File Structure

```
src/plugins/commuter-requests/
├── CommuterRequests.vue              # Main component (1100 lines)
├── CommuterRequestsConfig.ts         # TypeScript types
├── components/
│   ├── RequestTable.vue              # Data table (583 lines)
│   ├── RequestsMap.vue               # Deck.gl map (943 lines)
│   ├── ColorLegend.vue               # Map legend
│   ├── stats/
│   │   ├── ActiveTimeHistogramPlotly.vue    # Time distribution with OR-logic multi-select
│   │   └── MainModePieChartPlotly.vue       # Mode share with OR-logic multi-select
│   └── controls/
│       ├── ClusterTypeSelector.vue   # → REPLACE with layer multi-select
│       ├── ColorBySelector.vue       # Attribute color selector (keep)
│       ├── ComparisonToggle.vue      # Filter comparison toggle (keep)
│       ├── FilterResetButton.vue     # Clear all filters (keep)
│       └── ScrollToggle.vue          # Auto-scroll toggle (keep)
└── utils/
    ├── filters.ts                    # Filter logic (111 lines)
    ├── dataLoader.ts                 # Data loading (121 lines)
    └── colorSchemes.ts               # Color mappings (92 lines)
```

### Key Patterns Identified

#### 1. **Multi-Select Stats with OR Logic** ✅ Already Implemented

**Current Implementation** (from `MainModePieChartPlotly.vue` and `ActiveTimeHistogramPlotly.vue`):
- User clicks on stat element (pie slice, histogram bin) → **adds** filter
- User clicks same element again → **removes** filter (toggle behavior)
- Multiple selections within same stat → **OR logic**
- Example: Click "car" → show car requests
- Click "PT" → show car **OR** PT requests
- Click "PT" again → back to just car requests

**Pattern to extract**:
```typescript
// In stat component
handleClick(value: string) {
  if (this.selectedValues.has(value)) {
    this.selectedValues.delete(value)  // Toggle off
  } else {
    this.selectedValues.add(value)     // Toggle on
  }
  this.$emit('filter-changed', {
    column: this.column,
    operator: 'in',  // OR logic
    values: Array.from(this.selectedValues)
  })
}
```

#### 2. **Multi-Geometry Linkage** 🆕 User Requirement

**Scenario**: Multiple geometry layers linked by same ID

**Example** (Cluster Dashboard):
- **Layer 1**: Origin clusters (polygons) → linked to `origin_cluster` column
- **Layer 2**: Destination clusters (polygons) → linked to `destination_cluster` column
- **Layer 3**: OD clusters (polygons) → linked to `od_cluster` column
- **Layer 4**: Request flow arcs (lines) → linked to `od_cluster` column

**Behavior**:
- **Hover** over origin cluster ID=5 → highlights:
  - Origin cluster polygon (layer 1)
  - All requests in table with `origin_cluster==5`
  - All flow arcs with `od_cluster==5` (if they reference origin cluster 5)
- **Click** on any geometry → filters ALL linked geometries and table rows

**Implementation Pattern**:
```typescript
// LinkageManager tracks multiple layers per table column
registerLinkage({
  layerName: 'clusters_origin',
  tableColumn: 'origin_cluster',
  geoProperty: 'cluster_id',
  onHover: 'highlight',
  onSelect: 'filter'
})

registerLinkage({
  layerName: 'request_flows',
  tableColumn: 'od_cluster',
  geoProperty: 'cluster_id',
  onHover: 'highlight',
  onSelect: 'filter'
})

// When hovering over cluster_id=5
getLinkedFeatures(column: 'origin_cluster', value: 5) {
  // Returns features from ALL layers linked to this column/value
}
```

#### 3. **Layer Visibility Multi-Select** 🆕 Replaces Cluster Type Selector

**Current**: `ClusterTypeSelector.vue` switches between origin/destination/od clusters (domain-specific)

**New**: Generic layer visibility toggles
```yaml
map:
  layers:
    - name: clusters_origin
      file: cluster_geometries.geojson
      filter: { geoProperty: cluster_type, equals: origin }
      visible: true  # Initially visible

    - name: clusters_destination
      file: cluster_geometries.geojson
      filter: { geoProperty: cluster_type, equals: destination }
      visible: false  # Initially hidden

    - name: request_flows
      file: cluster_geometries.geojson
      filter: { geoProperty: geometry_type, equals: flow }
      visible: true
```

**UI Component**: `LayerVisibilityToggle.vue`
- Checkboxes for each layer
- User can show/hide layers independently
- Persists layer visibility state

---

## User Requirements & Clarifications

### ✅ Confirmed Decisions

#### 1. Testing Domain
**Use clusters (not rides) for testing**

**Test Dataset**:
- **Table**: `clusters.csv` with columns:
  - `cluster_id` (primary key)
  - `cluster_type` (origin/destination/od)
  - `num_requests`
  - `mean_travel_time`
  - `mean_distance`
  - Additional cluster attributes

- **Geometries**: `cluster_geometries.geojson`
  - Cluster polygons (boundaries)
  - Cluster centroids (points)
  - Flow arrows (lines) between OD clusters

**Stats to Test**:
- Histogram: Cluster size distribution
- Pie chart: Cluster type distribution
- Bar chart: Requests per cluster
- Summary: Total clusters, avg size, etc.

**Linkages**:
- Origin cluster polygons → `origin_cluster` column
- Destination cluster polygons → `destination_cluster` column
- OD cluster polygons → `od_cluster` column
- Flow arcs → `od_cluster` column

#### 2. YAML Structure: Flexible
**Only required component: Primary data table**

```yaml
# Minimal valid config
title: "My Dashboard"
plugin: interactive-dashboard

table:
  dataset: data.csv
  idColumn: id

# Stats are OPTIONAL (can have 0, 1, or many)
stats: []

# Map is OPTIONAL (can be omitted entirely)
# map: ...
```

#### 3. Multi-Select Stats: OR Logic with Toggle
**Already implemented correctly in commuter-requests**

- Click element → add filter
- Click again → remove filter
- Multiple selections → OR logic
- Reference existing implementation for extraction

#### 4. Layer Filtering & Multi-Select
**Confirmed approach**:
- Single GeoJSON file with all cluster types
- YAML `filter` to show specific features
- Multi-select UI to show/hide layers dynamically

#### 5. Time Range Filtering: Removed
**Not needed for generic plugin**

- Use single time column (e.g., `treq`)
- No `columnEnd` support
- If users need time ranges, they can add separate columns in CSV export

#### 6. Performance: Defer
**Address when actual performance issues arise**

- Start with client-side filtering
- Add optimizations (pagination, Web Worker) only if needed

---

## Generalization Strategy

### Phase 1: Parallel Implementation (Confirmed Approach)

**Create `interactive-dashboard` plugin alongside `commuter-requests`**

**Pros**:
- Preserve working commuter-requests plugin
- Develop and test new plugin independently
- Easy to compare and validate
- Low risk

**Approach**:
1. Copy `commuter-requests/` → `interactive-dashboard/`
2. Generalize components one-by-one
3. Test with **clusters** dataset (not rides)
4. Test with commuter-requests config
5. Once stable, optionally deprecate commuter-requests

---

## Proposed Architecture

### Directory Structure

```
src/plugins/interactive-dashboard/
├── InteractiveDashboard.vue          # Main orchestrator
├── InteractiveDashboardConfig.ts     # Generic TypeScript types
│
├── components/
│   ├── DashboardTable.vue            # Generalized from RequestTable.vue (REQUIRED)
│   ├── DashboardMap.vue              # Generalized from RequestsMap.vue (OPTIONAL)
│   ├── FilterSummary.vue             # Active filters display
│   ├── ColorLegend.vue               # (reuse as-is)
│   │
│   ├── stats/
│   │   ├── StatPanel.vue             # Generic wrapper
│   │   ├── BarChartStat.vue          # From MainModePieChart → generalized
│   │   ├── HistogramStat.vue         # From ActiveTimeHistogram → generalized
│   │   ├── PieChartStat.vue          # New (or rename from MainModePieChart)
│   │   ├── SummaryCardStat.vue       # From summary stats → generalized
│   │   └── _statCatalog.ts           # Registry
│   │
│   ├── map-layers/
│   │   ├── BaseGeometryLayer.ts      # Abstract base
│   │   ├── PointLayer.ts             # Point geometries
│   │   ├── LineLayer.ts              # Line/arc geometries
│   │   ├── PolygonLayer.ts           # Polygon geometries
│   │   └── _layerCatalog.ts          # Registry
│   │
│   └── controls/
│       ├── LayerVisibilityToggle.vue # NEW: Multi-select for map layers
│       ├── ComparisonToggle.vue      # (reuse as-is)
│       ├── FilterResetButton.vue     # (reuse as-is)
│       ├── ScrollToggle.vue          # (reuse as-is)
│       ├── ColorBySelector.vue       # (enhance: YAML-driven options)
│       └── EnlargeButton.vue         # Extract from cards
│
├── managers/
│   ├── FilterManager.ts              # Centralized filtering with OR logic support
│   ├── LinkageManager.ts             # Table ↔ geometry linkage (multi-geometry support)
│   └── StatManager.ts                # Stat instantiation
│
└── utils/
    ├── dataLoader.ts                 # (reuse + extend)
    ├── colorSchemes.ts               # (reuse + extend)
    └── formatting.ts                 # New: value formatting
```

### Core Classes

#### `FilterManager.ts` (Enhanced with OR Logic)

```typescript
export interface FilterDefinition {
  id: string                    // Unique filter ID (e.g., 'mode-filter')
  column: string                // Table column name
  operator: 'equals' | 'in'     // 'in' for OR logic multi-select
  value: any | any[]            // Single value or array for OR
  invert?: boolean              // NOT logic (optional)
}

export class FilterManager {
  private filters = new Map<string, FilterDefinition>()
  private listeners = new Set<Function>()

  // Update or add filter (replaces filter with same ID)
  setFilter(filter: FilterDefinition): void

  // Remove filter by ID
  removeFilter(filterId: string): void

  // Clear all filters
  clearFilters(): void

  // Apply all filters to data (AND logic between different filter IDs)
  applyFilters<T>(data: T[]): T[]

  // Subscribe to filter changes
  subscribe(listener: Function): void
}

// Example usage for multi-select:
// Click "car" mode → setFilter({ id: 'mode', column: 'mode', operator: 'in', value: ['car'] })
// Click "PT" mode → setFilter({ id: 'mode', column: 'mode', operator: 'in', value: ['car', 'PT'] })
// Click "PT" again → setFilter({ id: 'mode', column: 'mode', operator: 'in', value: ['car'] })
```

#### `LinkageManager.ts` (Multi-Geometry Support)

```typescript
export interface LinkageConfig {
  layerName: string
  tableColumn: string           // Column in table (e.g., 'origin_cluster')
  geoProperty: string           // Property in GeoJSON (e.g., 'cluster_id')
  onHover: 'highlight' | 'none'
  onSelect: 'filter' | 'highlight' | 'none'
}

export class LinkageManager {
  private linkages: LinkageConfig[] = []

  // Register linkage (can have multiple layers per column)
  registerLinkage(config: LinkageConfig): void

  // Get all layers linked to a specific table column
  getLayersByColumn(column: string): LinkageConfig[]

  // Get all features across all layers linked to a table value
  getLinkedFeatures(column: string, value: any): {
    layerName: string
    features: GeoJSONFeature[]
  }[]

  // Get table IDs for a clicked feature
  getTableIdsForFeature(layerName: string, feature: GeoJSONFeature): {
    column: string
    value: any
  }
}

// Example: Three layers linked to same cluster ID
linkageManager.registerLinkage({
  layerName: 'clusters_origin',
  tableColumn: 'origin_cluster',
  geoProperty: 'cluster_id',
  onHover: 'highlight',
  onSelect: 'filter'
})

linkageManager.registerLinkage({
  layerName: 'clusters_destination',
  tableColumn: 'destination_cluster',
  geoProperty: 'cluster_id',
  onHover: 'highlight',
  onSelect: 'filter'
})

linkageManager.registerLinkage({
  layerName: 'request_flows',
  tableColumn: 'od_cluster',
  geoProperty: 'cluster_id',
  onHover: 'highlight',
  onSelect: 'filter'
})

// Hovering over cluster_id=5 in any layer highlights all linked features
```

---

## Component Mapping

### 1. Main Component

| Commuter Requests | Interactive Dashboard | Changes |
|-------------------|----------------------|---------|
| `CommuterRequests.vue` | `InteractiveDashboard.vue` | Rename, genericize state |
| `allRequests: Request[]` | `tableData: DataRow[]` | Generic type |
| `filteredRequests: Request[]` | `filteredData: DataRow[]` | Generic computed |
| `selectedClusters: Set` | → FilterManager | Encapsulate, OR logic support |
| `selectedTimebins: Set` | → FilterManager | Encapsulate, OR logic support |
| `selectedModes: Set` | → FilterManager | Encapsulate, OR logic support |
| `clusterType: string` | **REMOVE** | Replaced by layer visibility |
| `onClusterClicked()` | `onFeatureClicked()` | Generic handler, multi-geometry |

### 2. Table Component

| RequestTable.vue | DashboardTable.vue | Changes |
|------------------|-------------------|---------|
| `requests: Request[]` | `data: DataRow[]` | Generic type |
| `request_id` (hard-coded) | `idColumn` (prop) | Configurable |
| Column generation | ✅ Keep as-is | Already generic |
| YAML config support | ✅ Keep as-is | Already generic |

### 3. Map Component

| RequestsMap.vue | DashboardMap.vue | Changes |
|-----------------|------------------|---------|
| Hard-coded layers | `layers: GeometryLayer[]` | Dynamic from config |
| `clusterType` prop | **REMOVE** | Use layer visibility instead |
| `@cluster-clicked` | `@feature-clicked` | Generic event, multi-geometry support |
| `@request-clicked` | `@feature-clicked` | Generic event |
| Layer creation (inline) | → Layer classes | Extract to `map-layers/` |

### 4. Stats Components

| Existing | New Generic | Config | Multi-Select |
|----------|-------------|--------|--------------|
| `ActiveTimeHistogramPlotly.vue` | `HistogramStat.vue` | `{type: 'histogram', column: 'treq', binSize: 900}` | ✅ OR logic (keep) |
| `MainModePieChartPlotly.vue` | `PieChartStat.vue` | `{type: 'pie', column: 'main_mode'}` | ✅ OR logic (keep) |
| Summary stats (inline) | `SummaryCardStat.vue` | `{type: 'summary', aggregation: 'count'}` | ❌ Not clickable |
| *(none)* | `BarChartStat.vue` | `{type: 'bar', column: 'mode'}` | ✅ OR logic (new) |

### 5. Control Components

| Component | Status | Notes |
|-----------|--------|-------|
| `ComparisonToggle.vue` | ✅ Reuse as-is | Already generic |
| `FilterResetButton.vue` | ✅ Reuse as-is | Already generic |
| `ScrollToggle.vue` | ✅ Reuse as-is | Already generic |
| `ClusterTypeSelector.vue` | ❌ **REMOVE** | Replaced by LayerVisibilityToggle |
| `ColorBySelector.vue` | ✅ Enhance | Make color options YAML-driven |
| *(new)* | `LayerVisibilityToggle.vue` | **CREATE**: Multi-select for map layers |

---

## YAML Configuration Design

### Example 1: Commuter Requests (Existing Domain)

```yaml
title: "Commuter Requests Dashboard"
plugin: interactive-dashboard

# Primary data table (REQUIRED)
table:
  name: "Requests"
  dataset: requests.csv
  idColumn: request_id
  visible: true
  columns:
    hide: [pax_id, origin, destination]
    formats:
      treq: { type: time, unit: "HH:mm" }
      travel_time: { type: duration, unit: "min", convertFrom: seconds }
      distance: { type: distance, unit: "km", convertFrom: meters }

# Statistics panels (OPTIONAL - can be empty or omitted)
stats:
  - type: histogram
    title: "Active Time Distribution"
    column: treq
    binSize: 900  # 15 minutes in seconds
    clickable: true  # Enables multi-select with OR logic
    comparison: true

  - type: pie
    title: "Mode Share"
    column: main_mode
    clickable: true  # Enables multi-select with OR logic
    comparison: true

  - type: summary
    title: "Summary Statistics"
    metrics:
      - { label: "Total Requests", aggregation: count }
      - { label: "Unique Modes", aggregation: count_distinct, column: main_mode }

# Map visualization (OPTIONAL - can be omitted)
map:
  center: [13.391, 52.515]
  zoom: 10

  colorBy:
    default: main_mode
    options:
      - { attribute: main_mode, label: "Transport Mode", type: categorical }
      - { attribute: travel_time, label: "Travel Time", type: numeric }

  layers:
    # Request point geometries
    - name: requests
      file: requests_geometries.geojson
      type: point
      visible: true  # Initially visible
      linkage:
        tableColumn: request_id
        geoProperty: request_id
        onHover: highlight
        onSelect: filter
      style:
        radius: 5
        opacity: 0.7
        colorBy: main_mode

    # Origin cluster polygons
    - name: clusters_origin
      file: cluster_geometries.geojson
      type: polygon
      visible: false  # Initially hidden (user can toggle on)
      filter:
        geoProperty: cluster_type
        equals: origin
      linkage:
        tableColumn: origin_cluster
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#ffcccc"
        fillOpacity: 0.3
        strokeColor: "#666666"

    # Destination cluster polygons
    - name: clusters_destination
      file: cluster_geometries.geojson
      type: polygon
      visible: false
      filter:
        geoProperty: cluster_type
        equals: destination
      linkage:
        tableColumn: destination_cluster
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#ccccff"
        fillOpacity: 0.3

    # OD cluster polygons
    - name: clusters_od
      file: cluster_geometries.geojson
      type: polygon
      visible: false
      filter:
        geoProperty: cluster_type
        equals: od
      linkage:
        tableColumn: od_cluster
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#ccffcc"
        fillOpacity: 0.3

    # Flow arrows between OD clusters
    - name: request_flows
      file: cluster_geometries.geojson
      type: line
      visible: true
      filter:
        geoProperty: geometry_type
        equals: flow
      linkage:
        tableColumn: od_cluster  # Links to same column as OD clusters!
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        color: "#3366ff"
        width: 2
        opacity: 0.7

# Display settings
display:
  showComparison: true
  layout:
    - row: 1
      height: 3
      cards:
        - type: map
          width: 2
        - type: stats
          width: 1
          statIds: [0, 1, 2]  # Indices into stats array
    - row: 2
      height: 2
      cards:
        - type: table
          width: 3
```

### Example 2: Cluster Dashboard (New Testing Domain)

```yaml
title: "Cluster Analysis Dashboard"
plugin: interactive-dashboard

# Primary data table
table:
  name: "Clusters"
  dataset: clusters.csv
  idColumn: cluster_id
  visible: true
  columns:
    formats:
      mean_travel_time: { type: duration, unit: "min", convertFrom: seconds }
      mean_distance: { type: distance, unit: "km", convertFrom: meters }

# Statistics (all optional)
stats:
  - type: histogram
    title: "Cluster Size Distribution"
    column: num_requests
    binSize: 10
    clickable: true

  - type: pie
    title: "Cluster Type Distribution"
    column: cluster_type
    clickable: true

  - type: bar
    title: "Requests per Cluster"
    column: cluster_id
    aggregation: sum
    valueColumn: num_requests
    clickable: true

  - type: summary
    title: "Summary"
    metrics:
      - { label: "Total Clusters", aggregation: count }
      - { label: "Avg Cluster Size", aggregation: avg, column: num_requests }

# Map (optional)
map:
  center: [13.391, 52.515]
  zoom: 10

  layers:
    # Origin clusters
    - name: clusters_origin
      file: cluster_geometries.geojson
      type: polygon
      visible: true
      filter: { geoProperty: cluster_type, equals: origin }
      linkage:
        tableColumn: cluster_id
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#ff9999"
        fillOpacity: 0.4

    # Destination clusters
    - name: clusters_destination
      file: cluster_geometries.geojson
      type: polygon
      visible: true
      filter: { geoProperty: cluster_type, equals: destination }
      linkage:
        tableColumn: cluster_id
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#9999ff"
        fillOpacity: 0.4

    # OD clusters
    - name: clusters_od
      file: cluster_geometries.geojson
      type: polygon
      visible: false  # Hidden by default
      filter: { geoProperty: cluster_type, equals: od }
      linkage:
        tableColumn: cluster_id
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#99ff99"
        fillOpacity: 0.4

    # Flow arrows (linked to OD clusters by same cluster_id)
    - name: cluster_flows
      file: cluster_geometries.geojson
      type: line
      visible: true
      filter: { geoProperty: geometry_type, equals: flow }
      linkage:
        tableColumn: cluster_id  # Same column! Multi-geometry linkage
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        color: "#3366ff"
        width:
          property: num_requests
          scale: [2, 10]  # Width based on request count

# Note: When user hovers over cluster_id=5 in ANY layer (origin, destination, od, flows)
# ALL features with cluster_id=5 across ALL layers will highlight!
```

### Example 3: Minimal Dashboard (Table Only)

```yaml
title: "Simple Data Table"
plugin: interactive-dashboard

table:
  dataset: data.csv
  idColumn: id

# No stats, no map - just a table!
```

---

## Implementation Phases

### Phase 1: Setup & Core Managers (Week 1)

**Goal**: Create plugin structure and core managers with OR logic and multi-geometry support

- [ ] Create `src/plugins/interactive-dashboard/` directory
- [ ] Create `InteractiveDashboardConfig.ts` with generic types
- [ ] Implement `FilterManager.ts`
  - [ ] Support OR logic within filter groups (operator: 'in')
  - [ ] `setFilter()` method (update/replace by ID)
  - [ ] `applyFilters()` method
  - [ ] Subscribe/notify pattern
  - [ ] Unit tests
- [ ] Implement `LinkageManager.ts`
  - [ ] Support multiple layers per table column
  - [ ] `getLinkedFeatures()` for multi-geometry highlighting
  - [ ] Unit tests
- [ ] Register plugin in `pluginRegistry.ts`

**Deliverable**: Plugin loads, managers handle OR logic and multi-geometry

### Phase 2: Generalize Table (Week 2)

**Goal**: Extract and generalize table component

- [ ] Copy `RequestTable.vue` → `DashboardTable.vue`
- [ ] Make `idColumn` configurable prop
- [ ] Test with commuter-requests data
- [ ] Test with clusters data
- [ ] Keep all existing features (sorting, export, formatting)

**Deliverable**: Generic table works with any CSV

### Phase 3: Generalize Stats with Multi-Select (Week 3-4)

**Goal**: Extract stats with OR-logic multi-select

- [ ] Create stat catalog and wrapper
- [ ] Extract `HistogramStat.vue`
  - [ ] **Keep OR-logic multi-select** (toggle on/off)
  - [ ] Make column configurable
  - [ ] Reference existing implementation
- [ ] Extract `PieChartStat.vue`
  - [ ] **Keep OR-logic multi-select** (toggle on/off)
  - [ ] Make column configurable
- [ ] Create `BarChartStat.vue` with multi-select
- [ ] Create `SummaryCardStat.vue` (no click)
- [ ] Connect to FilterManager with OR logic

**Deliverable**: Stats support multi-select with toggle behavior

### Phase 4: Generalize Map with Layer Multi-Select (Week 5-6)

**Goal**: Extract map with multi-geometry linkage and layer visibility

- [ ] Create layer framework and catalog
- [ ] Extract `PointLayer.ts`
- [ ] Extract `PolygonLayer.ts`
- [ ] Extract `LineLayer.ts`
- [ ] Create `DashboardMap.vue`
  - [ ] Dynamic layer loading from config
  - [ ] Multi-geometry hover (highlights all linked features)
  - [ ] Multi-geometry click (filters all linked features)
  - [ ] Connect to LinkageManager
- [ ] Create `LayerVisibilityToggle.vue`
  - [ ] Checkboxes for each layer
  - [ ] Show/hide layers independently
- [ ] Test with multiple layers linked to same column

**Deliverable**: Map supports configurable layers with multi-geometry linkage

### Phase 5: Main Component Integration (Week 7)

**Goal**: Wire everything together

- [ ] Rename `CommuterRequests.vue` → `InteractiveDashboard.vue`
- [ ] Replace filter state with FilterManager
- [ ] **Remove `clusterType` logic** (replaced by layer visibility)
- [ ] Load stats from YAML config
- [ ] Load map layers from YAML config
- [ ] Test with commuter-requests YAML
- [ ] Test with clusters YAML (multi-geometry linkage)
- [ ] Test with minimal YAML (table only)

**Deliverable**: Fully functional generic dashboard

### Phase 6: Polish & Documentation (Week 8)

**Goal**: Production-ready plugin

- [ ] Add `FilterSummary.vue` component
- [ ] Error handling and validation
- [ ] Performance testing
- [ ] User documentation with YAML reference
- [ ] Developer documentation
- [ ] Migration guide from commuter-requests

**Deliverable**: Documented, tested, production-ready plugin

---

## Migration Path

### For Existing Commuter Requests Dashboards

**Recommended: Keep both plugins**

- `commuter-requests` plugin remains for backwards compatibility
- New dashboards use `interactive-dashboard` plugin
- Eventually deprecate `commuter-requests`

**Migration steps** (when ready):
1. Create `viz-interactive-*.yaml` based on Example 1 above
2. Replace cluster type selector logic with layer visibility in YAML
3. Test thoroughly
4. Deprecate old YAML

---

## Summary of Key Changes from Original Plan

### ✅ Confirmed & Clarified

1. **Multi-select stats**: OR logic with toggle (already implemented in commuter-requests)
2. **Multi-geometry linkage**: Multiple layers can link to same table column, all highlight/filter together
3. **Layer visibility**: Replace cluster type selector with generic multi-select UI
4. **YAML flexibility**: Only table is required; stats and map are optional
5. **Testing domain**: Use clusters (not rides) for testing
6. **Time range filtering**: Removed from generalization scope
7. **Performance**: Defer optimizations until needed

### 🆕 New Components

- `LayerVisibilityToggle.vue`: Multi-select UI for map layers
- Enhanced `LinkageManager`: Multi-geometry linkage support
- Enhanced `FilterManager`: OR logic within filter groups

### ❌ Removed Components

- `ClusterTypeSelector.vue`: Replaced by layer visibility toggles

---

## Ready to Implement

All user requirements have been incorporated. The plan is ready for Phase 1 implementation.

**Next Step**: Begin Phase 1 (Setup & Core Managers)

---

**Document Version**: 2.0 (Updated with user feedback)
**Feedback Incorporated**: Multi-select stats, multi-geometry linkage, layer visibility, flexible YAML
