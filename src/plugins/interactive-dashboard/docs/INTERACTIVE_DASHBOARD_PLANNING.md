# Interactive Dashboard Plugin - Architecture & Implementation Plan

## Executive Summary

This document outlines the plan to generalize the `commuter-requests` plugin into a modular, reusable **Interactive Dashboard** plugin for SimWrapper. The new plugin will provide a data-driven dashboard system with interconnected filtering, supporting:

- A primary data table (CSV) as the foundation
- Multiple configurable statistics/charts that visualize table columns
- An interactive map component with multiple geometry layers (GeoJSON)
- Bi-directional filtering: clicking stats/map elements filters the table and updates all other components
- Comparison mode to show filtered vs. unfiltered states
- Hover and selection interactions with synchronized highlighting

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Requirements & Goals](#requirements--goals)
3. [Architecture Design](#architecture-design)
4. [YAML Configuration Schema](#yaml-configuration-schema)
5. [Component Breakdown](#component-breakdown)
6. [Data Flow & Filtering](#data-flow--filtering)
7. [Implementation Phases](#implementation-phases)
8. [Open Questions](#open-questions)
9. [Implementation Task List](#implementation-task-list)

---

## Current State Analysis

### Commuter Requests Plugin (Current Implementation)

Based on your description, the current `commuter-requests` plugin includes:

**Components:**
- **Data Table**: Displays request records with multiple columns
- **Statistics Panels**:
  - Active time distribution (time frames when requests are active)
  - Transport mode distribution (PT, car, bike, etc.)
- **Map Visualization**:
  - Request geometries (points/lines) from GeoJSON
  - Cluster geometries from GeoJSON
  - Color-coded by attributes
  - Legend for map colors

**Interactions:**
- **Click-to-Filter**: Clicking on stats filters the table and updates all other stats
- **Comparison Mode**: Shows filtered data vs. unfiltered baseline
- **Map-Table Linkage**:
  - Request geometries linked via `request_id`
  - Cluster geometries linked via `cluster_id`
  - Hover on map highlights table rows
  - Click on map filters table
- **Table-Map Linkage**: Hover/select in table highlights map features

**Limitations (to address):**
- Tightly coupled to requests/clusters domain
- Hard-coded stat types and linkages
- Not reusable for other data types (e.g., rides, trips, activities)

---

## Requirements & Goals

### Functional Requirements

1. **Data Table Foundation**
   - Always based on a primary CSV dataset
   - Table can be visible, hidden, or minimized
   - Support for all column types (numeric, string, datetime)

2. **Modular Statistics**
   - Add multiple stat panels via YAML configuration
   - Each stat specifies which table column(s) to visualize
   - Stat types: bar chart, pie chart, histogram, time series, summary cards
   - Click on stat elements to filter data

3. **Interactive Map**
   - Support multiple geometry layers (GeoJSON files)
   - Each layer configures:
     - Geometry type (points, lines, polygons, arcs)
     - Linkage to table (via ID column mapping)
     - Styling (colors, sizes, opacity)
     - Interaction mode (hover-only vs. selectable)
   - Synchronized highlighting and filtering with table

4. **Filtering System**
   - Filters propagate to all components (table, stats, map)
   - Multiple active filters (AND logic)
   - Comparison mode: show filtered vs. unfiltered states
   - Clear filters button

5. **Linkage Configuration**
   - Flexible ID-based linkage between table and geometries
   - Support for one-to-many relationships (e.g., one cluster → many requests)
   - Configurable interaction behaviors per linkage

6. **Reusability**
   - Generic enough for different domains:
     - Requests/rides
     - Trips/activities
     - Vehicles/routes
     - Zones/agents

### Non-Functional Requirements

- **Performance**: Handle 10k+ table rows and geometries
- **Usability**: Intuitive configuration via YAML
- **Maintainability**: Clean separation of concerns
- **Compatibility**: Work within SimWrapper's existing dashboard system

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Interactive Dashboard Plugin                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Dashboard Controller (Vue Component)         │   │
│  │  - Manages state (filters, selections, hover)       │   │
│  │  - Coordinates between all child components          │   │
│  │  - Handles data loading and caching                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                  │
│      ┌────────────────────┼────────────────────┐            │
│      ▼                    ▼                    ▼            │
│  ┌────────┐         ┌──────────┐        ┌──────────┐       │
│  │ Table  │         │  Stats   │        │   Map    │       │
│  │Component│◄────────│ Panels   │───────►│Component │       │
│  └────────┘         └──────────┘        └──────────┘       │
│      │                   │                     │            │
│      └───────────────────┼─────────────────────┘            │
│                          ▼                                   │
│                  ┌───────────────┐                          │
│                  │  Filter Store │                          │
│                  │  (Reactive)   │                          │
│                  └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
interactive-dashboard/
├── InteractiveDashboard.vue       # Main plugin component
├── components/
│   ├── DashboardTable.vue         # Data table display
│   ├── DashboardMap.vue           # Map with geometry layers
│   ├── StatPanel.vue              # Generic stat visualization
│   ├── ComparisonToggle.vue       # Filtered vs. unfiltered toggle
│   └── FilterSummary.vue          # Active filters display
├── map-layers/                    # Map geometry layer handlers
│   ├── BaseGeometryLayer.ts       # Abstract base class
│   ├── PointLayer.ts              # Point geometries
│   ├── LineLayer.ts               # Line/arc geometries
│   ├── PolygonLayer.ts            # Polygon geometries
│   └── _layerCatalog.ts           # Layer registry
├── stats/                         # Stat panel types
│   ├── BaseStat.ts                # Abstract base class
│   ├── BarChartStat.vue           # Bar chart
│   ├── PieChartStat.vue           # Pie chart
│   ├── HistogramStat.vue          # Histogram
│   ├── TimeSeriesStat.vue         # Time series
│   ├── SummaryCardStat.vue        # Summary statistics
│   └── _statCatalog.ts            # Stat registry
├── FilterManager.ts               # Centralized filter logic
├── LinkageManager.ts              # Table-geometry linkage logic
└── InteractiveDashboardConfig.ts  # TypeScript types for config
```

### Key Design Patterns

1. **Registry Pattern**:
   - Stat types and geometry layer types are registered in catalogs
   - Easy to add new types without modifying core code

2. **Observer Pattern**:
   - FilterManager notifies all components of filter changes
   - Components subscribe to relevant data updates

3. **Strategy Pattern**:
   - Different linkage strategies for different ID mappings
   - Configurable interaction behaviors (hover vs. select)

4. **Composition**:
   - Dashboard is composed of independent, reusable components
   - Each component manages its own rendering and interactions

---

## YAML Configuration Schema

### Example Configuration: Commuter Requests

```yaml
title: "Commuter Requests Dashboard"
description: "Interactive analysis of commuter requests"
plugin: interactive-dashboard

# Primary data table (required)
table:
  dataset: requests.csv
  visible: true  # or false, or 'minimized'
  columns:
    - request_id
    - cluster_id
    - origin_x
    - origin_y
    - dest_x
    - dest_y
    - mode
    - active_time_start
    - active_time_end

# Statistics panels (optional, multiple)
stats:
  - type: bar
    title: "Transport Modes"
    dataset: requests.csv  # reference to table dataset
    column: mode
    groupBy: mode
    aggregation: count
    clickable: true  # enables filtering on click
    comparison: true  # show filtered vs. unfiltered

  - type: histogram
    title: "Request Active Times"
    dataset: requests.csv
    column: active_time_start
    bins: 24
    binSize: 1h  # or 'auto'
    clickable: true
    comparison: true

  - type: summary-card
    title: "Total Requests"
    dataset: requests.csv
    aggregation: count
    comparison: true

# Map visualization (optional)
map:
  center: [13.391, 52.515]
  zoom: 10

  # Multiple geometry layers
  layers:
    - name: requests
      file: requests.geojson
      type: point  # point, line, polygon, arc

      # Linkage to table
      linkage:
        tableColumn: request_id
        geoProperty: id  # property in GeoJSON properties
        onHover: highlight  # highlight, none
        onSelect: filter    # filter, highlight, none

      # Styling
      style:
        color:
          property: mode  # GeoJSON property
          scale:
            PT: "#ff0000"
            car: "#00ff00"
            bike: "#0000ff"
        radius: 5
        opacity: 0.7

    - name: clusters
      file: clusters.geojson
      type: polygon

      linkage:
        tableColumn: cluster_id
        geoProperty: cluster_id
        onHover: none       # don't highlight on hover
        onSelect: filter    # filter table on click

      style:
        fillColor:
          property: cluster_type
          scale:
            residential: "#ffcccc"
            commercial: "#ccccff"
            industrial: "#ccffcc"
        fillOpacity: 0.3
        strokeColor: "#666666"
        strokeWidth: 2

# Filter settings (optional)
filters:
  showClearButton: true
  showFilterSummary: true
  comparisonMode:
    enabled: true
    defaultState: false  # start with comparison off

# Layout (optional)
layout:
  rows:
    - height: 1  # stats row
      components:
        - type: stat
          statId: 0  # reference to stats[0]
          width: 1
        - type: stat
          statId: 1
          width: 2
    - height: 3  # map + table row
      components:
        - type: map
          width: 2
        - type: table
          width: 1
```

### Example Configuration: Rides Dashboard

```yaml
title: "Ride Analysis Dashboard"
plugin: interactive-dashboard

table:
  dataset: rides.csv
  visible: true
  columns:
    - ride_id
    - request_id
    - vehicle_id
    - pickup_time
    - dropoff_time
    - distance
    - passengers

stats:
  - type: line
    title: "Rides Over Time"
    dataset: rides.csv
    xColumn: pickup_time
    yColumn: ride_id
    aggregation: count
    timeResolution: 15min
    clickable: true

  - type: bar
    title: "Rides by Vehicle"
    dataset: rides.csv
    column: vehicle_id
    groupBy: vehicle_id
    aggregation: count
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

    - name: requests
      file: requests.geojson
      type: point
      linkage:
        tableColumn: request_id  # link via request_id
        geoProperty: request_id
        onHover: highlight
        onSelect: none  # don't filter, just highlight
      style:
        color: "#ff6633"
        radius: 4
```

---

## Component Breakdown

### 1. InteractiveDashboard.vue (Main Plugin)

**Responsibilities:**
- Load YAML configuration
- Initialize FilterManager and LinkageManager
- Load primary table dataset via DashboardDataManager
- Instantiate child components (table, stats, map)
- Coordinate global state (filters, selections, hover)
- Handle comparison mode toggle

**Key State:**
```typescript
{
  config: InteractiveDashboardConfig,
  tableData: DataTable,
  activeFilters: FilterSet,
  filteredData: DataTable,
  hoveredIds: Set<string>,
  selectedIds: Set<string>,
  comparisonMode: boolean,
}
```

**Key Methods:**
- `loadConfig()`: Parse and validate YAML
- `loadTableData()`: Load primary CSV dataset
- `applyFilters()`: Apply current filters to data
- `handleFilterChange(filter)`: Update filters and notify components
- `handleHover(ids)`: Update hover state
- `handleSelection(ids)`: Update selection and trigger filtering

### 2. DashboardTable.vue

**Responsibilities:**
- Display primary data table
- Highlight rows based on hover/selection state
- Support row selection to filter by ID
- Support sorting and column filtering (local)

**Props:**
```typescript
{
  data: DataTable,
  filteredData: DataTable,
  columns: string[],
  visible: boolean | 'minimized',
  hoveredIds: Set<string>,
  selectedIds: Set<string>,
}
```

**Events:**
- `@row-hover`: Emitted when hovering over a row
- `@row-select`: Emitted when clicking a row

### 3. DashboardMap.vue

**Responsibilities:**
- Render deck.gl map with background tiles
- Manage multiple geometry layers
- Handle hover and click interactions on geometries
- Highlight features based on table state

**Props:**
```typescript
{
  config: MapConfig,
  layers: GeometryLayerConfig[],
  tableData: DataTable,
  filteredData: DataTable,
  hoveredIds: Set<string>,
  selectedIds: Set<string>,
  linkageManager: LinkageManager,
}
```

**Events:**
- `@feature-hover`: Emitted when hovering over a feature
- `@feature-select`: Emitted when clicking a feature

**Internal Structure:**
- Uses deck.gl for rendering
- Each geometry layer is a deck.gl layer instance
- Layers are created from layer catalog based on type

### 4. StatPanel.vue (Generic Stat Component)

**Responsibilities:**
- Render a single stat visualization (delegates to specific stat type)
- Handle click interactions for filtering
- Show comparison of filtered vs. unfiltered data

**Props:**
```typescript
{
  config: StatConfig,
  data: DataTable,
  filteredData: DataTable | null,
  comparisonMode: boolean,
}
```

**Events:**
- `@filter-request`: Emitted when user clicks on a stat element

**Implementation:**
- Loads appropriate stat component from catalog
- Passes data and config to child stat component

### 5. Specific Stat Components

Each stat type (BarChartStat, PieChartStat, etc.) extends a BaseStat class:

**BaseStat Interface:**
```typescript
abstract class BaseStat {
  abstract prepareData(data: DataTable, config: StatConfig): any
  abstract render(): VNode
  abstract handleClick(element: any): FilterDefinition
}
```

**BarChartStat Example:**
- Uses Plotly bar chart
- Groups data by configured column
- Emits filter when bar is clicked
- Shows overlay of filtered data in comparison mode

### 6. Geometry Layer Classes

Each layer type extends BaseGeometryLayer:

**BaseGeometryLayer Interface:**
```typescript
abstract class BaseGeometryLayer {
  config: GeometryLayerConfig
  geojson: GeoJSON
  tableData: DataTable

  abstract createDeckLayer(): DeckGLLayer
  abstract getFeatureIds(feature): string[]
  abstract styleFeature(feature): StyleProperties
  abstract handleHover(info): void
  abstract handleClick(info): void
}
```

**PointLayer Example:**
- Creates deck.gl ScatterplotLayer
- Maps GeoJSON properties to table IDs via linkage config
- Handles hover and click based on linkage behavior
- Updates feature colors based on filter/selection state

### 7. FilterManager.ts

**Responsibilities:**
- Maintain active filter state
- Apply filters to table data
- Notify subscribers of filter changes
- Support AND logic for multiple filters

**Interface:**
```typescript
class FilterManager {
  private filters: Map<string, FilterDefinition>
  private listeners: Set<(filters: FilterSet) => void>

  addFilter(filter: FilterDefinition): void
  removeFilter(filterId: string): void
  clearFilters(): void
  applyFilters(data: DataTable): DataTable
  subscribe(listener: Function): void
  unsubscribe(listener: Function): void
}

interface FilterDefinition {
  id: string
  column: string
  operator: 'equals' | 'in' | 'range' | 'contains'
  value: any | any[]
}
```

### 8. LinkageManager.ts

**Responsibilities:**
- Map between table IDs and geometry feature IDs
- Handle one-to-many relationships
- Resolve which table rows correspond to which features

**Interface:**
```typescript
class LinkageManager {
  private linkages: Map<string, LinkageConfig>

  registerLinkage(layerName: string, config: LinkageConfig): void
  getTableIdsForFeature(layerName: string, feature: GeoJSONFeature): string[]
  getFeaturesForTableId(layerName: string, tableId: string): GeoJSONFeature[]
  getFeaturesByProperty(layerName: string, property: string, value: any): GeoJSONFeature[]
}

interface LinkageConfig {
  tableColumn: string      // Column in table
  geoProperty: string      // Property in GeoJSON
  onHover: 'highlight' | 'none'
  onSelect: 'filter' | 'highlight' | 'none'
}
```

---

## Data Flow & Filtering

### Filtering Flow

```
┌──────────────┐
│ User Action  │ (click on stat bar, click on map feature, select table row)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Component Event      │ (emits filter request)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────┐
│ InteractiveDashboard     │
│ handleFilterChange()     │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ FilterManager            │
│ addFilter() / removeFilter()│
└──────┬───────────────────┘
       │
       ├──► Apply filters to table data
       │
       ▼
┌──────────────────────────┐
│ Notify All Components    │
│ (table, stats, map)      │
└──────┬───────────────────┘
       │
       ├────────┬─────────┬────────┐
       ▼        ▼         ▼        ▼
   ┌───────┐ ┌────┐  ┌─────┐  ┌─────┐
   │ Table │ │Stat│  │Stat │  │ Map │
   └───────┘ └────┘  └─────┘  └─────┘
       │        │        │        │
       └────────┴────────┴────────┘
                 │
                 ▼
         [ UI Updates with filtered data ]
```

### Hover Interaction Flow

```
User hovers over map feature
       │
       ▼
DashboardMap emits @feature-hover with feature IDs
       │
       ▼
InteractiveDashboard updates hoveredIds state
       │
       ▼
Props update for all components
       │
       ├───► DashboardTable: highlights rows
       ├───► DashboardMap: highlights all features with same IDs
       └───► (Stats don't react to hover)
```

### Selection Interaction Flow

```
User clicks on map feature with onSelect: 'filter'
       │
       ▼
DashboardMap emits @feature-select with feature IDs
       │
       ▼
LinkageManager resolves IDs to table column values
       │
       ▼
InteractiveDashboard creates filter for those IDs
       │
       ▼
[ Regular filtering flow continues ]
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

**Goal**: Set up plugin structure and core managers

- [ ] Create plugin directory structure
- [ ] Implement InteractiveDashboard.vue skeleton
- [ ] Implement FilterManager with basic filtering logic
- [ ] Implement LinkageManager with ID mapping logic
- [ ] Define TypeScript interfaces for all configs
- [ ] Create YAML parsing and validation
- [ ] Integrate with SimWrapper plugin registry

**Deliverable**: Plugin loads, parses YAML, but no UI yet

### Phase 2: Table Component (Week 2)

**Goal**: Implement data table display with highlighting

- [ ] Implement DashboardTable.vue
- [ ] Connect table to filtered data
- [ ] Implement row highlighting based on hover/selection state
- [ ] Implement row click to filter by ID
- [ ] Style table (light/dark mode support)

**Deliverable**: Table displays, filters, and highlights work

### Phase 3: Statistics Panels (Week 3-4)

**Goal**: Implement configurable stat visualizations

- [ ] Create BaseStat interface
- [ ] Implement BarChartStat component
- [ ] Implement PieChartStat component
- [ ] Implement HistogramStat component
- [ ] Implement SummaryCardStat component
- [ ] Create stat catalog registry
- [ ] Implement StatPanel wrapper component
- [ ] Implement comparison mode (filtered vs. unfiltered overlay)
- [ ] Connect stats to FilterManager

**Deliverable**: Stats display data, update on filters, and emit filter events

### Phase 4: Map Component (Week 5-6)

**Goal**: Implement interactive map with multiple geometry layers

- [ ] Create DashboardMap.vue with deck.gl integration
- [ ] Implement BaseGeometryLayer interface
- [ ] Implement PointLayer
- [ ] Implement LineLayer
- [ ] Implement PolygonLayer
- [ ] Create geometry layer catalog
- [ ] Implement hover highlighting across layers
- [ ] Implement click-to-filter based on linkage config
- [ ] Connect map to LinkageManager

**Deliverable**: Map displays geometries, responds to filters, emits events

### Phase 5: Integration & Polish (Week 7)

**Goal**: Wire everything together and refine UX

- [ ] Implement layout system (rows/columns)
- [ ] Implement ComparisonToggle component
- [ ] Implement FilterSummary component (active filters display)
- [ ] Add clear filters button
- [ ] Implement table visibility modes (visible/hidden/minimized)
- [ ] Performance optimization (virtualization for large datasets)
- [ ] Add loading states and error handling
- [ ] Polish styling and responsiveness

**Deliverable**: Fully functional interactive dashboard

### Phase 6: Testing & Documentation (Week 8)

**Goal**: Ensure robustness and usability

- [ ] Write unit tests for managers (FilterManager, LinkageManager)
- [ ] Write integration tests for filtering flow
- [ ] Test with example configs (requests, rides)
- [ ] Write user documentation with examples
- [ ] Write developer documentation for adding new stat/layer types
- [ ] Create example YAML configs for common use cases

**Deliverable**: Tested, documented, production-ready plugin

---

## Open Questions

### 1. Cluster ID Column Ambiguity

**Question**: How should we handle cases where cluster IDs might be in different columns for different types of clusters?

**Example**:
```yaml
# In requests.csv:
# - cluster_id_residential
# - cluster_id_commercial

# In clusters.geojson:
# - properties.cluster_id
# - properties.cluster_type (residential/commercial)
```

**Possible Solutions**:

**Option A**: Multiple Geometry Files
- Split clusters into separate GeoJSON files (residential_clusters.geojson, commercial_clusters.geojson)
- Each layer references a specific column
```yaml
layers:
  - name: residential_clusters
    file: residential_clusters.geojson
    linkage:
      tableColumn: cluster_id_residential
      geoProperty: cluster_id
```

**Option B**: Conditional Linkage
- Support conditional linkage based on feature properties
```yaml
layers:
  - name: clusters
    file: clusters.geojson
    linkage:
      conditions:
        - when:
            geoProperty: cluster_type
            equals: residential
          tableColumn: cluster_id_residential
        - when:
            geoProperty: cluster_type
            equals: commercial
          tableColumn: cluster_id_commercial
```

**Option C**: Computed Linkage Column
- Allow specifying a computed column that normalizes the ID
```yaml
table:
  dataset: requests.csv
  computed_columns:
    - name: cluster_id
      expression: "coalesce(cluster_id_residential, cluster_id_commercial)"

layers:
  - name: clusters
    linkage:
      tableColumn: cluster_id  # uses computed column
```

**Recommendation**: Start with **Option A** (simplest), add **Option C** if needed later.

---

### 2. One-to-Many Relationship Handling

**Question**: How should the map behave when selecting a cluster that corresponds to multiple requests?

**Scenarios**:
- User clicks on cluster polygon
- 50 requests belong to this cluster
- What should happen?

**Options**:

**Option A**: Filter to All Requests
- Table shows all 50 requests
- All request geometries on map are highlighted
- Stats update to show statistics for these 50 requests

**Option B**: Highlight Only, Don't Filter
- Cluster is highlighted
- Related requests are highlighted on map
- Table scrolls to show related requests, but doesn't filter
- Stats remain unchanged

**Option C**: Configurable Behavior
```yaml
linkage:
  tableColumn: cluster_id
  onSelect: filter  # or 'highlight'
  multiMatch: filter-all  # or 'highlight-all' or 'ignore'
```

**Recommendation**: **Option C** (configurable) for maximum flexibility.

---

### 3. Stat Aggregation Functions

**Question**: What aggregation functions should we support for stats?

**Common Functions**:
- `count`: Count of rows
- `sum`: Sum of column values
- `average` / `mean`: Average of column values
- `min` / `max`: Min/max of column values
- `median`: Median value
- `percentile`: Specific percentile (e.g., 95th)
- `distinct`: Count of distinct values

**Recommendation**: Start with `count`, `sum`, `average`, `min`, `max`. Add others as needed.

---

### 4. Time-Based Filtering

**Question**: How should time-based filtering work for time ranges (e.g., active_time_start to active_time_end)?

**Scenario**:
- Request is active from 08:00 to 09:30
- User clicks on time bin 09:00-10:00
- Should this request be included?

**Options**:

**Option A**: Overlap Logic
- Include if time range overlaps with selected bin
```yaml
column: active_time_start
columnEnd: active_time_end  # optional
overlapMode: true
```

**Option B**: Start Time Only
- Filter based only on start time (simpler, less accurate)

**Recommendation**: Support **Option A** with `columnEnd` as optional field for time-range columns.

---

### 5. Performance: Large Datasets

**Question**: How should we handle performance with large datasets (>100k rows)?

**Considerations**:
- Table rendering with 100k rows is slow
- GeoJSON with 100k features is slow
- Filtering 100k rows on every interaction is slow

**Strategies**:

**Option A**: Virtual Scrolling
- Use vue-virtual-scroller for table
- Only render visible rows

**Option B**: Pagination
- Paginate table display
- Keep filtering on full dataset

**Option C**: Web Worker for Filtering
- Move filtering logic to Web Worker
- Avoid blocking main thread

**Option D**: Server-Side Filtering
- For very large datasets, filter on server
- Requires backend API (out of scope for now)

**Recommendation**:
- Start with **Option B** (pagination) for table
- Add **Option C** (Web Worker) if filtering becomes slow
- Document **Option D** as future enhancement

---

### 6. Geometry Styling: Color Scales

**Question**: How should we define color scales for geometries?

**Options**:

**Option A**: Discrete Color Map
```yaml
style:
  color:
    property: mode
    scale:
      PT: "#ff0000"
      car: "#00ff00"
      bike: "#0000ff"
```

**Option B**: Continuous Color Scale
```yaml
style:
  color:
    property: distance
    scale:
      type: linear  # or 'log', 'quantile'
      range: ["#00ff00", "#ff0000"]
      domain: [0, 10000]  # optional
```

**Option C**: ColorBrewer Schemes
```yaml
style:
  color:
    property: cluster_id
    scheme: Set3  # ColorBrewer scheme name
```

**Recommendation**: Support all three. Start with **Option A**, add **Option B** and **Option C** as needed.

---

### 7. Stat Click Behavior: Single vs. Multi-Select

**Question**: Should clicking on a stat allow multi-select (click multiple bars to combine filters)?

**Options**:

**Option A**: Single Select
- Clicking a bar replaces the current filter for that column
- Simple, predictable behavior

**Option B**: Multi-Select with Modifier
- Click: single select (replace)
- Ctrl+Click / Cmd+Click: add to selection (OR logic)
- Shift+Click: range select (if applicable)

**Recommendation**: Start with **Option A**, add **Option B** if users request it.

---

### 8. Map Legend

**Question**: Should the map automatically generate a legend for geometry colors?

**Options**:

**Option A**: Auto-Generate Legend
- Plugin automatically creates legend based on color scales
- Position configurable (top-right, bottom-left, etc.)

**Option B**: Manual Legend Config
```yaml
map:
  legend:
    position: bottom-right
    items:
      - color: "#ff0000"
        label: "Public Transport"
      - color: "#00ff00"
        label: "Car"
```

**Option C**: No Legend
- User responsibility to document colors elsewhere

**Recommendation**: **Option A** (auto-generate) with override capability from **Option B**.

---

### 9. Data Update Reactivity

**Question**: Should the dashboard support live data updates (e.g., simulation running in background)?

**Scope**: This is likely out of scope for initial version, but worth noting:

**Future Enhancement**:
- Allow re-loading data without full page refresh
- Subscribe to data updates from simulation
- Animate changes in real-time

**Recommendation**: Not in initial scope. Document as future feature.

---

### 10. Export Functionality

**Question**: Should users be able to export filtered data?

**Options**:

**Option A**: Export Filtered Table as CSV
```yaml
filters:
  allowExport: true  # adds "Export CSV" button
```

**Option B**: Export Map as Image
- Use deck.gl screenshot capability

**Option C**: Export Entire Dashboard State
- Export current filters, data, map view as shareable link

**Recommendation**:
- **Option A** (export CSV) is easy to add, very useful
- **Option B** (map screenshot) already available in deck.gl
- **Option C** (state export) is complex, defer to future

---

## Implementation Task List

### Setup & Infrastructure

- [ ] Create `/src/plugins/interactive-dashboard` directory structure
- [ ] Create `InteractiveDashboard.vue` skeleton
- [ ] Create TypeScript interfaces in `InteractiveDashboardConfig.ts`
- [ ] Register plugin in `/src/plugins/pluginRegistry.ts`
- [ ] Add file pattern for YAML configs: `**/viz-interactive-*.y?(a)ml`

### Core Managers

- [ ] Implement `FilterManager.ts`
  - [ ] `addFilter()` method
  - [ ] `removeFilter()` method
  - [ ] `clearFilters()` method
  - [ ] `applyFilters()` method
  - [ ] Subscribe/unsubscribe mechanism
  - [ ] Unit tests
- [ ] Implement `LinkageManager.ts`
  - [ ] `registerLinkage()` method
  - [ ] `getTableIdsForFeature()` method
  - [ ] `getFeaturesForTableId()` method
  - [ ] Support for one-to-many relationships
  - [ ] Unit tests

### YAML Configuration

- [ ] Define full YAML schema
- [ ] Implement YAML parsing in `InteractiveDashboard.vue`
- [ ] Implement configuration validation
- [ ] Add helpful error messages for invalid configs
- [ ] Create example YAML files for testing

### Table Component

- [ ] Create `DashboardTable.vue`
- [ ] Implement table rendering (use vue-good-table or similar)
- [ ] Implement row highlighting based on `hoveredIds` prop
- [ ] Implement row highlighting based on `selectedIds` prop
- [ ] Implement row click handler (emits `@row-select`)
- [ ] Implement row hover handler (emits `@row-hover`)
- [ ] Implement table visibility modes (visible, hidden, minimized)
- [ ] Add pagination support
- [ ] Style for light/dark mode
- [ ] Test with large datasets (10k+ rows)

### Statistics Framework

- [ ] Create `BaseStat.ts` interface
- [ ] Create `StatPanel.vue` wrapper component
- [ ] Create `_statCatalog.ts` registry
- [ ] Implement catalog loading mechanism

### Stat Components

- [ ] `BarChartStat.vue`
  - [ ] Data preparation (group by column)
  - [ ] Plotly bar chart rendering
  - [ ] Click handler for filtering
  - [ ] Comparison mode (overlay filtered data)
- [ ] `PieChartStat.vue`
  - [ ] Data preparation (group by column)
  - [ ] Plotly pie chart rendering
  - [ ] Click handler for filtering
  - [ ] Comparison mode
- [ ] `HistogramStat.vue`
  - [ ] Data preparation (binning numeric column)
  - [ ] Plotly histogram rendering
  - [ ] Click handler for bin selection
  - [ ] Support for time-based binning
  - [ ] Comparison mode
- [ ] `TimeSeriesStat.vue`
  - [ ] Time-based aggregation
  - [ ] Plotly line chart rendering
  - [ ] Click/brush selection for time range filtering
  - [ ] Comparison mode
- [ ] `SummaryCardStat.vue`
  - [ ] Calculate summary statistics (count, sum, avg, etc.)
  - [ ] Display in card format
  - [ ] Show comparison (filtered vs. unfiltered)

### Map Component

- [ ] Create `DashboardMap.vue`
- [ ] Integrate deck.gl
- [ ] Add background map tiles (Mapbox, OSM, etc.)
- [ ] Implement zoom controls
- [ ] Implement map camera state (center, zoom, pitch, bearing)
- [ ] Implement layer rendering loop
- [ ] Implement hover handler
- [ ] Implement click handler
- [ ] Connect to `LinkageManager` for ID resolution

### Geometry Layers

- [ ] Create `BaseGeometryLayer.ts` interface
- [ ] Create `_layerCatalog.ts` registry
- [ ] Implement `PointLayer.ts`
  - [ ] Create deck.gl ScatterplotLayer
  - [ ] Load GeoJSON file
  - [ ] Map properties to table via linkage config
  - [ ] Style features (color, radius, opacity)
  - [ ] Handle hover interaction
  - [ ] Handle click interaction
  - [ ] Highlight features based on selection state
- [ ] Implement `LineLayer.ts`
  - [ ] Create deck.gl PathLayer or ArcLayer
  - [ ] Load GeoJSON file
  - [ ] Map properties to table
  - [ ] Style features (color, width, opacity)
  - [ ] Handle interactions
- [ ] Implement `PolygonLayer.ts`
  - [ ] Create deck.gl PolygonLayer
  - [ ] Load GeoJSON file
  - [ ] Map properties to table
  - [ ] Style features (fill, stroke)
  - [ ] Handle interactions

### UI Components

- [ ] Create `FilterSummary.vue`
  - [ ] Display active filters as tags
  - [ ] Allow removing individual filters
  - [ ] Show filter count
- [ ] Create `ComparisonToggle.vue`
  - [ ] Toggle button for comparison mode
  - [ ] Update global state
- [ ] Create clear filters button

### Integration

- [ ] Wire table to FilterManager
- [ ] Wire stats to FilterManager
- [ ] Wire map to FilterManager
- [ ] Implement global hover state coordination
- [ ] Implement global selection state coordination
- [ ] Test full filtering flow (stat → filter → table/map update)
- [ ] Test full hover flow (map hover → table highlight)
- [ ] Test full selection flow (map click → filter → stats update)

### Layout System

- [ ] Implement row/column layout from YAML config
- [ ] Support flex-based sizing (width: 1, 2, 3, etc.)
- [ ] Support fixed heights for rows
- [ ] Make layout responsive
- [ ] Add fullscreen toggle for map

### Polish & Optimization

- [ ] Add loading indicators
- [ ] Add error handling and user-friendly error messages
- [ ] Optimize filtering performance (consider Web Worker)
- [ ] Optimize table rendering (virtual scrolling if needed)
- [ ] Optimize map rendering (tile-based loading if needed)
- [ ] Test with large datasets (>10k rows, >10k features)
- [ ] Add keyboard shortcuts (Escape to clear filters, etc.)
- [ ] Improve accessibility (ARIA labels, keyboard navigation)

### Documentation

- [ ] Write user guide with examples
- [ ] Document all YAML configuration options
- [ ] Create example configs for common use cases:
  - [ ] Commuter requests example
  - [ ] Rides analysis example
  - [ ] Generic trips example
- [ ] Write developer guide for extending:
  - [ ] How to add new stat types
  - [ ] How to add new geometry layer types
- [ ] Add inline code comments
- [ ] Create README.md for plugin directory

### Testing

- [ ] Unit tests for FilterManager
- [ ] Unit tests for LinkageManager
- [ ] Integration tests for filtering flow
- [ ] Integration tests for hover/selection flow
- [ ] Visual regression tests for stat components
- [ ] Test with example datasets
- [ ] Test with edge cases (empty data, single row, huge datasets)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

### Deployment

- [ ] Merge to main branch
- [ ] Update SimWrapper documentation
- [ ] Announce new plugin to users
- [ ] Gather feedback for v2 improvements

---

## Success Criteria

The plugin will be considered successful when:

1. ✅ **Reusability**: Can be configured via YAML for multiple domains (requests, rides, trips) without code changes
2. ✅ **Interactivity**: All components (table, stats, map) respond to filters and update synchronously
3. ✅ **Performance**: Handles 10k+ rows and geometries with <1s filter response time
4. ✅ **Usability**: Non-technical users can create new dashboards by editing YAML
5. ✅ **Maintainability**: Adding new stat or layer types requires <100 lines of code
6. ✅ **Documentation**: Complete examples and API docs available

---

## Appendix: Similar Tools for Reference

- **Plotly Dash**: Python-based interactive dashboards
- **Observable**: JavaScript notebooks with reactive visualizations
- **Tableau**: Commercial BI tool with interactive filtering
- **Apache Superset**: Open-source BI platform
- **Kepler.gl**: Uber's geospatial analysis tool (map-focused)
- **VizWit**: Dashboard framework (inspiration for SimWrapper's DashboardDataManager)

---

## Change Log

- **2025-11-19**: Initial draft created based on commuter-requests plugin requirements

---

## Contact

For questions or clarifications during implementation, please contact:
- [Your contact information here]
