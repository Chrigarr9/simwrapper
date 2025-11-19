# Interactive Dashboard - Generalization Plan
## From Commuter Requests to Generic Dashboard Plugin

**Last Updated**: 2025-11-19
**Status**: Planning Phase
**Based on**: Existing `commuter-requests` plugin implementation

---

## Executive Summary

This document outlines the plan to **generalize** the existing `commuter-requests` plugin into a reusable **Interactive Dashboard** plugin. The commuter-requests plugin is a fully-functional, specialized implementation that demonstrates all the key patterns we need. Our task is to extract these patterns into a generic, YAML-configurable system.

### What We Have ✅

The `src/plugins/commuter-requests/` plugin is a **complete implementation** with:
- Interactive data table with filtering and highlighting
- Multiple statistics (histogram, pie chart, summary cards)
- Deck.gl map with request geometries and cluster boundaries
- Bi-directional filtering between all components
- Comparison mode (filtered vs. baseline)
- Hover interactions and synchronized highlighting
- YAML configuration support
- Export functionality

### What We Need to Do 🎯

**Extract and generalize** this implementation into:
- Generic data table that works with any CSV
- Pluggable stat system (not hard-coded to time/mode)
- Flexible map system (configurable geometry types and linkages)
- Generic filter manager (not tied to requests/clusters/timebins)
- YAML-driven configuration (no code changes for new dashboards)

---

## Table of Contents

1. [Analysis of Existing Implementation](#analysis-of-existing-implementation)
2. [Generalization Strategy](#generalization-strategy)
3. [Proposed Architecture](#proposed-architecture)
4. [Component Mapping](#component-mapping)
5. [YAML Configuration Design](#yaml-configuration-design)
6. [Implementation Phases](#implementation-phases)
7. [Migration Path](#migration-path)
8. [Open Questions & Decisions](#open-questions--decisions)

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
│   │   ├── ActiveTimeHistogramPlotly.vue    # Time distribution
│   │   └── MainModePieChartPlotly.vue       # Mode share pie chart
│   └── controls/
│       ├── ClusterTypeSelector.vue   # Cluster type switcher
│       ├── ColorBySelector.vue       # Attribute color selector
│       ├── ComparisonToggle.vue      # Filter comparison toggle
│       ├── FilterResetButton.vue     # Clear all filters
│       └── ScrollToggle.vue          # Auto-scroll toggle
└── utils/
    ├── filters.ts                    # Filter logic (111 lines)
    ├── dataLoader.ts                 # Data loading (121 lines)
    └── colorSchemes.ts               # Color mappings (92 lines)
```

### Key Patterns Identified

#### 1. **Filter System** (`utils/filters.ts`)

```typescript
// AND logic between filter types
export function filterRequests(
  allRequests: Request[],
  selectedClusters: Set<string | number>,
  selectedTimebins: Set<string>,
  selectedModes: Set<string>,
  selectedRequestIds: Set<string>,
  clusterType: 'origin' | 'destination' | 'spatial'
): Request[]
```

**Pattern**: Each filter type has a dedicated function, combined with AND logic.

**Generalization needed**:
- Generic `FilterDefinition` interface
- Configurable filter functions (not hard-coded)
- Support for different operators (equals, in, range, contains)

#### 2. **Statistics Components**

**Common Props Pattern**:
```typescript
{
  requests: Request[],                 // Filtered data
  baselineRequests: Request[],         // Full dataset (for comparison)
  selected[Type]: Set<string>,         // Selected values (for highlighting)
  showComparison: boolean,
  isDarkMode: boolean,
  isEnlarged: boolean
}
```

**Common Events**:
```typescript
@bin-clicked="onTimebinClicked"
@mode-clicked="onModeClicked"
```

**Generalization needed**:
- Generic `StatPanel.vue` wrapper
- Registry of stat types
- YAML-configurable column mappings

#### 3. **Table Component** (`RequestTable.vue`)

**Key Features**:
- **Auto-generates columns** from data (lines 176-232)
- YAML-based column visibility (`show`, `hide` arrays)
- YAML-based formatting (`formats` object)
- Sortable columns
- Row highlighting (selected vs. unfiltered)
- CSV export
- Scroll-to-row on hover

**Generalization needed**:
- Rename from `RequestTable` → `DashboardTable`
- Make row ID column configurable (not hard-coded to `request_id`)
- Generic props (not `requests`-specific)

#### 4. **Map Component** (`RequestsMap.vue`)

**Layer Types**:
1. **Request Points** - ScatterplotLayer
2. **Request Lines** - PathLayer (O-D connections)
3. **Cluster Polygons** - PolygonLayer
4. **Cluster Flow Arrows** - LineLayer

**Interaction Patterns**:
- Hover: highlights features + emits `@request-hovered`
- Click: selects features + emits `@cluster-clicked` / `@request-clicked`

**Generalization needed**:
- Extract layer creation into separate classes
- Configurable linkage between geometries and table
- YAML-driven styling

#### 5. **Main Component Coordination** (`CommuterRequests.vue`)

**State Management**:
```typescript
{
  // Data
  allRequests: Request[],
  requestGeometries: any[],
  clusterBoundaries: ClusterData,

  // Filters (Sets for O(1) lookups)
  selectedClusters: Set<string | number>,
  selectedTimebins: Set<string>,
  selectedModes: Set<string>,
  selectedRequestIds: Set<string>,

  // UI State
  showComparison: boolean,
  hoveredRequestId: string | null,
  enlargedCard: string
}
```

**Computed Properties**:
```typescript
filteredRequests(): Request[] {
  return filterRequests(
    this.allRequests,
    this.selectedClusters,
    this.selectedTimebins,
    this.selectedModes,
    this.selectedRequestIds,
    this.clusterType
  )
}
```

**Generalization needed**:
- Generic filter state (not hard-coded filter types)
- `FilterManager` class to encapsulate logic
- Generic data properties (not `allRequests`)

---

## Generalization Strategy

### Phase 1: Parallel Implementation (Recommended)

**Create `interactive-dashboard` plugin alongside `commuter-requests`**

**Pros**:
- Preserve working commuter-requests plugin
- Develop and test new plugin independently
- Easy to compare and validate
- Low risk

**Cons**:
- Some code duplication initially
- Need to maintain both during transition

**Approach**:
1. Copy `commuter-requests/` → `interactive-dashboard/`
2. Generalize components one-by-one
3. Test with commuter-requests YAML config
4. Test with new domain (e.g., rides)
5. Once stable, deprecate commuter-requests (or keep as example)

### Phase 2: Direct Refactor (Alternative)

**Refactor `commuter-requests` in-place to be generic**

**Pros**:
- No duplication
- Single source of truth

**Cons**:
- Higher risk of breaking existing dashboards
- Harder to test both versions

**Not recommended** for this project.

---

## Proposed Architecture

### Directory Structure

```
src/plugins/interactive-dashboard/
├── InteractiveDashboard.vue          # Main orchestrator
├── InteractiveDashboardConfig.ts     # Generic TypeScript types
│
├── components/
│   ├── DashboardTable.vue            # Generalized from RequestTable.vue
│   ├── DashboardMap.vue              # Generalized from RequestsMap.vue
│   ├── FilterSummary.vue             # Active filters display
│   ├── ColorLegend.vue               # (reuse as-is)
│   │
│   ├── stats/
│   │   ├── StatPanel.vue             # Generic wrapper
│   │   ├── BarChartStat.vue          # From MainModePieChart → generalized
│   │   ├── HistogramStat.vue         # From ActiveTimeHistogram → generalized
│   │   ├── PieChartStat.vue          # New
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
│       ├── ComparisonToggle.vue      # (reuse as-is)
│       ├── FilterResetButton.vue     # (reuse as-is)
│       ├── ScrollToggle.vue          # (reuse as-is)
│       └── EnlargeButton.vue         # Extract from cards
│
├── managers/
│   ├── FilterManager.ts              # Centralized filtering
│   ├── LinkageManager.ts             # Table ↔ geometry linkage
│   └── StatManager.ts                # Stat instantiation
│
└── utils/
    ├── dataLoader.ts                 # (reuse + extend)
    ├── colorSchemes.ts               # (reuse + extend)
    └── formatting.ts                 # New: value formatting
```

### Core Classes

#### `FilterManager.ts`

```typescript
export interface FilterDefinition {
  id: string                    // Unique filter ID
  column: string                // Table column name
  operator: 'equals' | 'in' | 'range' | 'contains'
  value: any | any[]
  invert?: boolean              // NOT logic
}

export class FilterManager {
  private filters = new Map<string, FilterDefinition>()
  private listeners = new Set<Function>()

  addFilter(filter: FilterDefinition): void
  removeFilter(filterId: string): void
  clearFilters(): void
  applyFilters<T>(data: T[], idColumn: string): T[]
  subscribe(listener: Function): void
}
```

**Extracted from**: `utils/filters.ts` + main component state

#### `LinkageManager.ts`

```typescript
export interface LinkageConfig {
  layerName: string
  tableColumn: string           // Column in table (e.g., 'request_id')
  geoProperty: string           // Property in GeoJSON (e.g., 'id')
  onHover: 'highlight' | 'none'
  onSelect: 'filter' | 'highlight' | 'none'
}

export class LinkageManager {
  private linkages = new Map<string, LinkageConfig>()

  registerLinkage(config: LinkageConfig): void
  getTableIdsForFeature(layerName: string, feature: GeoJSONFeature): string[]
  getFeaturesForTableId(layerName: string, tableId: string): GeoJSONFeature[]
}
```

**Extracted from**: Logic currently embedded in `RequestsMap.vue`

---

## Component Mapping

### 1. Main Component

| Commuter Requests | Interactive Dashboard | Changes |
|-------------------|----------------------|---------|
| `CommuterRequests.vue` | `InteractiveDashboard.vue` | Rename, genericize state |
| `allRequests: Request[]` | `tableData: DataRow[]` | Generic type |
| `filteredRequests: Request[]` | `filteredData: DataRow[]` | Generic computed |
| `selectedClusters: Set` | → FilterManager | Encapsulate |
| `selectedTimebins: Set` | → FilterManager | Encapsulate |
| `selectedModes: Set` | → FilterManager | Encapsulate |
| `onClusterClicked()` | `onFeatureClicked()` | Generic handler |

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
| `@cluster-clicked` | `@feature-clicked` | Generic event |
| `@request-clicked` | `@feature-clicked` | Generic event |
| Layer creation (inline) | → Layer classes | Extract to `map-layers/` |

### 4. Stats Components

| Existing | New Generic | Config |
|----------|-------------|--------|
| `ActiveTimeHistogramPlotly.vue` | `HistogramStat.vue` | `{type: 'histogram', column: 'treq', binSize: 900}` |
| `MainModePieChartPlotly.vue` | `PieChartStat.vue` | `{type: 'pie', column: 'main_mode'}` |
| Summary stats (inline) | `SummaryCardStat.vue` | `{type: 'summary', aggregation: 'count'}` |
| *(none)* | `BarChartStat.vue` | `{type: 'bar', column: 'mode'}` |

### 5. Control Components

| Component | Status | Notes |
|-----------|--------|-------|
| `ComparisonToggle.vue` | ✅ Reuse as-is | Already generic |
| `FilterResetButton.vue` | ✅ Reuse as-is | Already generic |
| `ScrollToggle.vue` | ✅ Reuse as-is | Already generic |
| `ClusterTypeSelector.vue` | ❌ Remove | Domain-specific |
| `ColorBySelector.vue` | ✅ Enhance | Make color options YAML-driven |

---

## YAML Configuration Design

### Example 1: Commuter Requests (Existing Domain)

```yaml
title: "Commuter Requests Dashboard"
plugin: interactive-dashboard

# Primary data table
table:
  name: "Requests"
  dataset: requests.csv
  idColumn: request_id
  visible: true
  columns:
    show: []  # Empty = show all
    hide: [pax_id, origin, destination]
    formats:
      treq:
        type: time
        unit: "HH:mm"
      travel_time:
        type: duration
        unit: "min"
        convertFrom: seconds
      distance:
        type: distance
        unit: "km"
        convertFrom: meters

# Statistics panels
stats:
  - type: histogram
    title: "Active Time Distribution"
    column: treq
    binSize: 900  # 15 minutes in seconds
    clickable: true
    comparison: true

  - type: pie
    title: "Mode Share"
    column: main_mode
    clickable: true
    comparison: true

  - type: summary
    title: "Summary Statistics"
    metrics:
      - label: "Total Requests"
        aggregation: count
      - label: "Unique Modes"
        aggregation: count_distinct
        column: main_mode

# Map visualization
map:
  center: [13.391, 52.515]
  zoom: 10

  colorBy:
    default: main_mode
    options:
      - attribute: main_mode
        label: "Transport Mode"
        type: categorical
      - attribute: travel_time
        label: "Travel Time"
        type: numeric
        scale: [0, 3600]

  layers:
    # Request point geometries
    - name: requests
      file: requests_geometries.geojson
      type: point
      linkage:
        tableColumn: request_id
        geoProperty: request_id
        onHover: highlight
        onSelect: filter
      style:
        radius: 5
        opacity: 0.7
        colorBy: main_mode  # References colorBy config above

    # Cluster polygons
    - name: origin_clusters
      file: cluster_geometries.geojson
      type: polygon
      filter:
        geoProperty: cluster_type
        equals: origin
      linkage:
        tableColumn: origin_cluster
        geoProperty: cluster_id
        onHover: none
        onSelect: filter
      style:
        fillColor: "#ffcccc"
        fillOpacity: 0.3
        strokeColor: "#666666"
        strokeWidth: 2

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

### Example 2: Rides Dashboard (New Domain)

```yaml
title: "Ride Analysis Dashboard"
plugin: interactive-dashboard

table:
  name: "Rides"
  dataset: rides.csv
  idColumn: ride_id
  visible: true

stats:
  - type: bar
    title: "Rides by Vehicle"
    column: vehicle_id
    groupBy: vehicle_id
    aggregation: count
    clickable: true

  - type: histogram
    title: "Ride Duration Distribution"
    column: duration
    binSize: 300  # 5 minutes
    clickable: true

map:
  layers:
    - name: ride_routes
      file: ride_routes.geojson
      type: line
      linkage:
        tableColumn: ride_id
        geoProperty: ride_id
        onHover: highlight
        onSelect: filter
      style:
        color: "#3366ff"
        width: 2
```

---

## Implementation Phases

### Phase 1: Setup & Core Managers (Week 1)

**Goal**: Create plugin structure and core managers

- [ ] Create `src/plugins/interactive-dashboard/` directory
- [ ] Copy base files from `commuter-requests/`
- [ ] Create `InteractiveDashboardConfig.ts` with generic types
- [ ] Implement `FilterManager.ts`
  - [ ] Generic filter definitions
  - [ ] `applyFilters()` method
  - [ ] Subscribe/notify pattern
  - [ ] Unit tests
- [ ] Implement `LinkageManager.ts`
  - [ ] Linkage registration
  - [ ] ID mapping methods
  - [ ] Unit tests
- [ ] Register plugin in `pluginRegistry.ts`

**Deliverable**: Plugin loads, managers work independently

### Phase 2: Generalize Table (Week 2)

**Goal**: Extract and generalize table component

- [ ] Copy `RequestTable.vue` → `DashboardTable.vue`
- [ ] Rename props: `requests` → `data`
- [ ] Add `idColumn` prop (configurable, not hard-coded)
- [ ] Make `tableName` from config (already done)
- [ ] Test with commuter-requests data
- [ ] Test with rides data
- [ ] Update styles if needed

**Deliverable**: Generic table works with any CSV

### Phase 3: Generalize Stats Framework (Week 3-4)

**Goal**: Create pluggable stat system

- [ ] Create `components/stats/_statCatalog.ts`
- [ ] Create `components/stats/StatPanel.vue` wrapper
- [ ] Generalize `HistogramStat.vue`
  - [ ] Accept `column` prop (not hard-coded `treq`)
  - [ ] Accept `binSize` from config
  - [ ] Generic filtering (not time-specific)
- [ ] Generalize `PieChartStat.vue`
  - [ ] Accept `column` prop
  - [ ] Generic grouping
- [ ] Create `BarChartStat.vue` (similar to pie)
- [ ] Create `SummaryCardStat.vue`
  - [ ] Configurable metrics
  - [ ] Support count, sum, avg, min, max
- [ ] Connect stats to FilterManager

**Deliverable**: Stats work generically, configurable via YAML

### Phase 4: Generalize Map (Week 5-6)

**Goal**: Extract map layers into classes

- [ ] Copy `RequestsMap.vue` → `DashboardMap.vue`
- [ ] Create `map-layers/BaseGeometryLayer.ts`
- [ ] Extract point rendering → `PointLayer.ts`
  - [ ] Load GeoJSON
  - [ ] Create ScatterplotLayer
  - [ ] Apply styling from config
  - [ ] Handle linkage
- [ ] Extract polygon rendering → `PolygonLayer.ts`
- [ ] Extract line rendering → `LineLayer.ts`
- [ ] Create `map-layers/_layerCatalog.ts`
- [ ] Update `DashboardMap` to use layer catalog
- [ ] Connect map to LinkageManager

**Deliverable**: Map supports multiple configurable layers

### Phase 5: Main Component Integration (Week 7)

**Goal**: Wire everything together

- [ ] Rename `CommuterRequests.vue` → `InteractiveDashboard.vue`
- [ ] Replace hard-coded filter state with FilterManager
- [ ] Replace hard-coded data props with generic versions
- [ ] Load stats from YAML config
- [ ] Load map layers from YAML config
- [ ] Connect all components to managers
- [ ] Implement layout system from YAML
- [ ] Test with commuter-requests YAML
- [ ] Test with rides YAML

**Deliverable**: Fully functional generic dashboard

### Phase 6: Polish & Documentation (Week 8)

**Goal**: Production-ready plugin

- [ ] Add `FilterSummary.vue` component
- [ ] Improve error handling
- [ ] Add loading states
- [ ] Performance optimization
- [ ] Write user documentation
- [ ] Write developer documentation
- [ ] Create example YAMLs
- [ ] Update planning docs
- [ ] Testing and bug fixes

**Deliverable**: Documented, tested, production-ready plugin

---

## Migration Path

### For Existing Commuter Requests Dashboards

**Option A: Keep Both Plugins**

- `commuter-requests` plugin remains for backwards compatibility
- New dashboards use `interactive-dashboard` plugin
- Eventually deprecate `commuter-requests`

**Option B: Migrate to Generic Plugin**

1. Create YAML config for commuter-requests (see Example 1 above)
2. Change `viz-commuter-requests-*.yaml` → `viz-interactive-*.yaml`
3. Update YAML to use new schema
4. Test thoroughly
5. Remove old plugin

**Recommendation**: Option A for safety

---

## Open Questions & Decisions

### 1. ✅ RESOLVED: Cluster Type Selector

**Question**: The `ClusterTypeSelector` is domain-specific (origin/destination/spatial clusters). How to generalize?

**Decision**: **Remove from generic plugin**. For commuter-requests, add as custom control via:
```yaml
customControls:
  - type: cluster-type-selector
    options: [origin, destination, spatial]
```

Or simpler: Use stat filtering instead (click on cluster type in a stat).

### 2. ✅ RESOLVED: Color-By Selector

**Question**: Should color-by be a generic feature?

**Decision**: **Yes, keep and enhance**. Already YAML-driven in commuter-requests:
```yaml
map:
  colorBy:
    default: main_mode
    options:
      - attribute: main_mode
        type: categorical
      - attribute: travel_time
        type: numeric
```

This is generic enough to keep.

### 3. ❓ OPEN: Time-Based Filtering

**Question**: How to handle time range overlap (active_time_start to active_time_end)?

**Current Implementation**: Hard-coded in `applyTimebinFilter()`:
```typescript
const requestStart = request.treq
const requestEnd = request.treq + request.travel_time
```

**Options**:
- **A**: Support `columnEnd` in filter config
- **B**: Stat emits range filter automatically
- **C**: User defines custom filter function

**Recommendation**: Option A for simplicity.

### 4. ❓ OPEN: Stat Click Behavior

**Question**: Should stats support multi-select (Ctrl+Click)?

**Current Implementation**: Single-select (click replaces filter)

**Recommendation**: Start with single-select, add multi-select in v2 if requested.

### 5. ❓ OPEN: Layer Filtering

**Question**: How to handle layer filtering (e.g., show only `cluster_type: origin`)?

**Example**:
```yaml
layers:
  - name: origin_clusters
    file: cluster_geometries.geojson  # Contains all cluster types
    filter:
      geoProperty: cluster_type
      equals: origin
```

**Recommendation**: Support simple property matching in layer config.

### 6. ❓ OPEN: Performance for Large Datasets

**Question**: How to handle >100k rows?

**Current Implementation**: Filters entire dataset client-side

**Options**:
- **A**: Pagination + virtual scrolling (table only)
- **B**: Web Worker for filtering
- **C**: Server-side filtering (future)

**Recommendation**: Start with A, add B if needed.

---

## Success Criteria

The generalized plugin is successful when:

1. ✅ **Reusability**: Works for requests, rides, trips, etc. without code changes
2. ✅ **Configuration**: Non-developers can create dashboards via YAML only
3. ✅ **Compatibility**: Existing commuter-requests dashboards still work
4. ✅ **Performance**: Handles 10k+ rows with <1s filter response
5. ✅ **Maintainability**: Adding new stat/layer types requires <100 lines
6. ✅ **Documentation**: Complete examples and API docs

---

## Next Steps

1. **Review this plan** with team
2. **Make decisions** on open questions
3. **Create feature branch**: `feature/interactive-dashboard`
4. **Start Phase 1** (setup & core managers)
5. **Iterate** through remaining phases

---

## References

- **Existing Plugin**: `/src/plugins/commuter-requests/`
- **Example Docs**: `/src/plugins/commuter-requests/IMPLEMENTATION_SUMMARY.md`
- **Original Planning**: `/docs/INTERACTIVE_DASHBOARD_PLANNING.md`
- **SimWrapper Patterns**: `/src/plugins/layer-map/` (for layer architecture)
- **Dashboard System**: `/src/layout-manager/DashBoard.vue`

---

**Document Version**: 1.0
**Author**: Planning based on code analysis
**Feedback**: Please review open questions and provide input
