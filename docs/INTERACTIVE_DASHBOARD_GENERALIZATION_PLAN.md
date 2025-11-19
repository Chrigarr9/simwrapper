# Interactive Dashboard - Generalization Plan
## From Commuter Requests to Generic Dashboard Panel

**Last Updated**: 2025-11-19 (Updated with SimWrapper integration architecture)
**Status**: Planning Phase - Ready to implement
**Based on**: Existing `commuter-requests` plugin implementation + SimWrapper dashboard system

---

## Executive Summary

This document outlines the plan to **generalize** the existing `commuter-requests` plugin into a reusable **Interactive Dashboard** panel type for SimWrapper. The commuter-requests plugin is a fully-functional, specialized implementation that demonstrates all the key patterns we need. Our task is to extract these patterns into a generic, YAML-configurable system that **integrates with SimWrapper's existing dashboard architecture**.

### What We Have ✅

**SimWrapper Dashboard System:**
- Row-based layout with flex weights
- Card system with configurable width/height
- Subtabs support (true, file array, or row ID array)
- DashboardDataManager for data coordination
- Panel registry (`panelLookup`) for component loading
- Existing dashboard YAML structure: `header`, `layout`, `subtabs`

**Commuter Requests Plugin:**
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

**Build on SimWrapper's existing dashboard system** by creating an **interactive-dashboard panel type** that:
- Registers in `panelLookup` like other panel types (plot, table, etc.)
- Works as a card within existing dashboard layouts
- Receives props via SimWrapper's existing dashboard YAML structure
- Integrates with DashboardDataManager for data coordination
- Supports all SimWrapper dashboard features (rows, widths, heights, subtabs)

**Interactive dashboard panel features:**
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

## Proposed Architecture

### Integration with SimWrapper Dashboard System

The interactive dashboard is implemented as a **dashboard panel type** that integrates seamlessly with SimWrapper's existing architecture:

```
SimWrapper Dashboard System
└── DashBoard.vue                         # Manages rows/cards/subtabs
    ├── Card 1: type: "plot"             # Standard plotly chart
    ├── Card 2: type: "table"            # Standard data table
    └── Card 3: type: "interactive-dashboard"   # Our new panel type
        └── InteractiveDashboard.vue     # Main component
            ├── FilterManager            # Manages filters (OR logic)
            ├── LinkageManager           # Manages multi-geometry linkage
            ├── DashboardTable.vue       # Generic data table
            ├── DashboardMap.vue         # Generic map with layers
            └── Stats Components         # Clickable stats with multi-select
```

**Data Flow:**

1. **Dashboard YAML → DashBoard.vue:**
   - Parses YAML structure
   - Creates rows and cards
   - Passes `config.props` to each panel

2. **DashBoard.vue → InteractiveDashboard.vue:**
   - Receives standard panel props: `config`, `datamanager`, `fileSystemConfig`, `subfolder`, `files`
   - `config.table`, `config.stats`, `config.map` contain panel-specific configuration

3. **InteractiveDashboard.vue:**
   - Loads data files using `datamanager` or `fileSystemConfig`
   - Initializes `FilterManager` and `LinkageManager`
   - Renders table, stats, and map based on config
   - Coordinates interactions (hover, click, filter)

4. **Internal Components:**
   - Table, stats, and map emit events (hover, click, filter-changed)
   - FilterManager applies filters to data
   - LinkageManager coordinates multi-geometry highlighting
   - All components react to filtered data

**Key Benefits of This Architecture:**

1. **Reuses SimWrapper Infrastructure:**
   - No need to reimplement layout system
   - Automatic support for rows, widths, heights, subtabs
   - Consistent with other SimWrapper panels

2. **Flexible Integration:**
   - Can be mixed with other panel types in one dashboard
   - Can span full width or share row with other cards
   - Can appear in multiple rows/subtabs

3. **Data Coordination:**
   - Uses existing `DashboardDataManager` for file loading
   - Consistent file path resolution
   - Shared caching with other panels

4. **Maintains Isolation:**
   - Each interactive dashboard instance has its own filter state
   - Multiple instances can coexist on same dashboard
   - No global state conflicts

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

### Integration with SimWrapper Dashboard System

The interactive dashboard is a **panel type** (like `plot`, `table`, `map`) that works within SimWrapper's existing dashboard YAML structure.

**SimWrapper Dashboard YAML Structure:**
```yaml
header:
  title: "Dashboard Title"
  description: "Optional description"

layout:
  row1:  # Row ID (can be any name)
    - type: panel-type      # Panel type (plot, table, map, interactive-dashboard, etc.)
      title: "Card Title"   # Card title
      width: 2              # Flex weight (default: 1)
      height: 8             # Height in 60px units (default: 5)
      props:                # Panel-specific configuration
        ...

  row2:
    - type: another-panel
      width: 1
      ...

subtabs: true  # Optional: Convert each row to a subtab
# OR
subtabs:       # Array of dashboard files
  - dashboard-tab1.yaml
  - dashboard-tab2.yaml
# OR
subtabs:       # Array of row groupings
  - title: "Overview"
    rows: [row1, row2]
  - title: "Details"
    rows: [row3]
```

**Key Integration Points:**
1. **Panel Registration**: Register `interactive-dashboard` in `/src/dash-panels/_allPanels.ts`
2. **Props**: Interactive dashboard config is passed via `props` object (like all panels)
3. **Data Manager**: Access `datamanager` prop for data coordination
4. **File System**: Access `files`, `subfolder`, `fileSystemConfig` props for data loading
5. **Layout**: Uses existing row/card system with width/height

### Example 1: Commuter Requests Dashboard (SimWrapper Integration)

```yaml
header:
  title: "Commuter Requests Dashboard"
  description: "Interactive analysis of commuter travel requests"

layout:
  overview:
    - type: interactive-dashboard
      title: "Commuter Analysis"
      width: 3
      height: 12
      props:
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
```

### Example 2: Cluster Dashboard (New Testing Domain)

```yaml
header:
  title: "Cluster Analysis Dashboard"
  description: "Testing interactive dashboard with cluster data"

layout:
  main:
    - type: interactive-dashboard
      title: "Cluster Analysis"
      width: 3
      height: 12
      props:
        # Primary data table (REQUIRED)
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

        display:
          showComparison: true

# Note: When user hovers over cluster_id=5 in ANY layer (origin, destination, od, flows)
# ALL features with cluster_id=5 across ALL layers will highlight!
```

### Example 3: Minimal Dashboard (Table Only)

```yaml
header:
  title: "Simple Data Table"

layout:
  main:
    - type: interactive-dashboard
      width: 3
      height: 8
      props:
        table:
          dataset: data.csv
          idColumn: id
        # No stats, no map - just a table!
```

### Example 4: Mixed Dashboard (Interactive + Other Panels)

This example shows how the interactive dashboard can be combined with other SimWrapper panel types in a single dashboard.

```yaml
header:
  title: "Comprehensive Analysis Dashboard"
  description: "Combining interactive dashboard with other SimWrapper panels"

layout:
  # Row 1: Interactive dashboard with table/stats/map
  interactive_analysis:
    - type: interactive-dashboard
      title: "Interactive Cluster Analysis"
      width: 2
      height: 12
      props:
        table:
          dataset: clusters.csv
          idColumn: cluster_id
        stats:
          - type: histogram
            column: num_requests
            binSize: 10
            clickable: true
        map:
          layers:
            - name: clusters
              file: cluster_geometries.geojson
              type: polygon
              visible: true
              linkage:
                tableColumn: cluster_id
                geoProperty: cluster_id

  # Row 2: Standard SimWrapper panels (non-interactive)
  additional_charts:
    - type: plotly
      title: "Time Series Analysis"
      width: 1
      height: 6
      props:
        file: timeseries.csv
        x: time
        y: value

    - type: text
      title: "Documentation"
      width: 1
      height: 6
      props:
        file: README.md

subtabs: true  # Each row becomes a subtab
```

### Example 5: Multi-Tab Dashboard with Subtabs

```yaml
header:
  title: "Multi-Tab Analysis"
  description: "Using subtabs to organize different views"

subtabs:
  - dashboard-overview.yaml
  - dashboard-clusters.yaml
  - dashboard-flows.yaml

# Each dashboard file can contain an interactive-dashboard card or any other panel types
```

**dashboard-clusters.yaml:**
```yaml
header:
  title: "Cluster Analysis"
  tab: "Clusters"  # Tab label

layout:
  main:
    - type: interactive-dashboard
      width: 3
      height: 12
      props:
        table:
          dataset: clusters.csv
          idColumn: cluster_id
        map:
          layers:
            - name: clusters
              file: cluster_geometries.geojson
              type: polygon
              visible: true
```

---

## Implementation Phases

### Phase 0: SimWrapper Integration Setup (Week 1, Part 1)

**Goal**: Register interactive dashboard as a panel type in SimWrapper's dashboard system

- [ ] Create `src/dash-panels/interactive-dashboard/` directory
- [ ] Register in `/src/dash-panels/_allPanels.ts`:
  ```typescript
  import InteractiveDashboard from './interactive-dashboard/InteractiveDashboard.vue'

  export const panelLookup: { [key: string]: any } = {
    // ... existing panels
    'interactive-dashboard': InteractiveDashboard,
  }
  ```
- [ ] Create `InteractiveDashboard.vue` main component with standard dashboard panel props:
  ```typescript
  props: {
    fileSystemConfig: { type: Object as PropType<FileSystemConfig>, required: true },
    subfolder: { type: String, required: true },
    files: { type: Array as PropType<string[]>, required: true },
    config: { type: Object, required: true },  // Contains table, stats, map config
    datamanager: { type: Object as PropType<DashboardDataManager>, required: true },
    cardId: { type: String, required: true },
    cardTitle: { type: String },
  }
  ```
- [ ] Emit standard dashboard events:
  - `@isLoaded` - when component finishes loading
  - `@dimension-resizer` - for responsive resizing
  - `@error` - for error reporting

### Phase 1: Setup & Core Managers (Week 1, Part 2)

**Goal**: Create core managers with OR logic and multi-geometry support

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
- [ ] Test integration with DashboardDataManager for file loading

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

## Summary of Key Changes

### ✅ Architecture Decision: Dashboard Panel (Not Standalone Plugin)

**Critical Change**: The interactive dashboard is implemented as a **dashboard panel type** (like `plot`, `table`, `map`) that works within SimWrapper's existing dashboard YAML structure, NOT as a standalone plugin.

**Why This Matters:**
- ✅ **Leverages existing infrastructure**: Reuses SimWrapper's row/card layout, subtabs, width/height system
- ✅ **Better integration**: Works seamlessly with other panels in mixed dashboards
- ✅ **Consistent patterns**: Follows same registration and prop-passing patterns as all other panels
- ✅ **Flexible deployment**: Can be used in subtabs, mixed with other panels, multiple instances per dashboard
- ❌ **Not standalone**: Cannot be invoked directly like other plugins (e.g., `commuter-requests`, `transit`, etc.)

**Location:**
- `src/dash-panels/interactive-dashboard/` (NOT `src/plugins/interactive-dashboard/`)
- Registered in `src/dash-panels/_allPanels.ts` panel lookup

### ✅ User Requirements Confirmed

1. **Multi-select stats**: OR logic with toggle (already implemented in commuter-requests)
2. **Multi-geometry linkage**: Multiple layers can link to same table column, all highlight/filter together
3. **Layer visibility**: Replace cluster type selector with generic multi-select UI
4. **YAML flexibility**: Only table is required; stats and map are optional
5. **Testing domain**: Use clusters (not rides) for testing
6. **Time range filtering**: Removed from generalization scope
7. **Performance**: Defer optimizations until needed
8. **SimWrapper integration**: Build on existing dashboard system (rows, cards, subtabs, DashboardDataManager)

### 🆕 New Components

- `LayerVisibilityToggle.vue`: Multi-select UI for map layers
- Enhanced `LinkageManager`: Multi-geometry linkage support
- Enhanced `FilterManager`: OR logic within filter groups
- `InteractiveDashboard.vue`: Main panel component with standard dashboard props

### ❌ Removed/Changed Components

- `ClusterTypeSelector.vue`: Replaced by layer visibility toggles
- Standalone plugin structure: Changed to dashboard panel structure
- Custom layout system: Removed, using SimWrapper's existing layout

### 📝 YAML Structure Changes

**Before (Standalone Plugin):**
```yaml
title: "Dashboard"
plugin: interactive-dashboard
table: ...
stats: ...
map: ...
```

**After (Dashboard Panel):**
```yaml
header:
  title: "Dashboard"
layout:
  row1:
    - type: interactive-dashboard
      width: 3
      height: 12
      props:
        table: ...
        stats: ...
        map: ...
```

---

## Ready to Implement

All user requirements have been incorporated. The architecture aligns with SimWrapper's existing dashboard system.

**Next Step**: Begin Phase 0 (SimWrapper Integration Setup) → Register panel type and create main component with standard props

---

**Document Version**: 3.0 (Updated with SimWrapper dashboard integration architecture)
**Major Changes in v3.0**:
- Changed from standalone plugin to dashboard panel type
- Integration with SimWrapper's existing dashboard system (rows, cards, subtabs)
- Proper panel registration in `panelLookup`
- Standard dashboard panel props and events
- Updated YAML structure to fit within SimWrapper dashboard format

**Feedback Incorporated**:
- Multi-select stats with OR logic (user requirement)
- Multi-geometry linkage (user requirement)
- Layer visibility multi-select (user requirement)
- Flexible YAML with optional components (user requirement)
- SimWrapper dashboard integration (user requirement: "building an interactive version of the SimWrapper dashboard that is already there")
