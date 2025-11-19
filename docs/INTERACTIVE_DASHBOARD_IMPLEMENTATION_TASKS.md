# Interactive Dashboard - Implementation Tasks
## Generalization from Commuter Requests Plugin

**Last Updated**: 2025-11-19 (Updated with user feedback)
**Status**: Ready to Start
**Estimated Duration**: 6-8 weeks

See [INTERACTIVE_DASHBOARD_GENERALIZATION_PLAN.md](./INTERACTIVE_DASHBOARD_GENERALIZATION_PLAN.md) for full context and rationale.

---

## Overview

We are **generalizing** the existing `commuter-requests` plugin into a reusable `interactive-dashboard` plugin.

### User Requirements ✅

Based on user feedback, the key features are:

1. **Multi-select stats with OR logic**: Click to toggle filters on/off (already implemented in commuter-requests)
2. **Multi-geometry linkage**: Multiple map layers can share same table column, all highlight/filter together
3. **Layer visibility multi-select**: Replace cluster type selector with generic UI to show/hide layers
4. **Flexible YAML**: Table is required, stats and map are optional
5. **Testing domain**: Use clusters (not rides) for validation

### Strategy

**Parallel implementation** - Create new plugin alongside commuter-requests, test with clusters dataset.

---

## Phase 1: Setup & Core Managers (Week 1)

### Directory Setup
- [ ] Create `/src/plugins/interactive-dashboard/` directory
- [ ] Create subdirectories:
  ```
  interactive-dashboard/
  ├── components/
  │   ├── stats/
  │   ├── map-layers/
  │   └── controls/
  ├── managers/
  └── utils/
  ```

### TypeScript Types
- [ ] Create `InteractiveDashboardConfig.ts`
- [ ] Define interfaces:
  - [ ] `DashboardConfig` (top-level YAML structure)
  - [ ] `TableConfig` (table configuration)
  - [ ] `StatConfig` (base + specific stat types)
  - [ ] `MapConfig` (map and layer configuration)
  - [ ] `GeometryLayerConfig` (individual layer config)
  - [ ] `LinkageConfig` (table ↔ geometry linkage)
  - [ ] `FilterDefinition` (filter structure with OR logic support)
  - [ ] `DataRow` (generic replacement for `Request`)

**Source**: Extract and generalize from `/src/plugins/commuter-requests/CommuterRequestsConfig.ts`

### FilterManager (`managers/FilterManager.ts`)

**Purpose**: Centralized filter management with OR logic support

- [ ] Create `FilterManager` class
- [ ] Define `FilterDefinition` interface:
  ```typescript
  {
    id: string              // e.g., 'mode-filter'
    column: string          // Table column
    operator: 'equals' | 'in'  // 'in' for OR logic
    value: any | any[]      // Single value or array
  }
  ```
- [ ] Implement methods:
  - [ ] `setFilter(filter: FilterDefinition)` - Add/update filter by ID
  - [ ] `removeFilter(filterId: string)` - Remove filter
  - [ ] `clearFilters()` - Remove all filters
  - [ ] `applyFilters<T>(data: T[]): T[]` - Apply all filters (AND between IDs, OR within)
  - [ ] `subscribe(listener: Function)` - Subscribe to filter changes
  - [ ] `unsubscribe(listener: Function)` - Unsubscribe

**OR Logic Example**:
```typescript
// Click "car" → setFilter({ id: 'mode', column: 'mode', operator: 'in', value: ['car'] })
// Click "PT" → setFilter({ id: 'mode', column: 'mode', operator: 'in', value: ['car', 'PT'] })
// Click "PT" again → setFilter({ id: 'mode', column: 'mode', operator: 'in', value: ['car'] })
```

- [ ] Write unit tests:
  - [ ] Test single filter
  - [ ] Test multiple filters (AND logic)
  - [ ] Test OR logic within filter (operator: 'in')
  - [ ] Test filter replacement by ID
  - [ ] Test subscribe/notify

**Source**: Generalize from `/src/plugins/commuter-requests/utils/filters.ts`

### LinkageManager (`managers/LinkageManager.ts`)

**Purpose**: Manage table ↔ geometry linkages with multi-geometry support

- [ ] Create `LinkageManager` class
- [ ] Define `LinkageConfig` interface:
  ```typescript
  {
    layerName: string
    tableColumn: string     // Column in table
    geoProperty: string     // Property in GeoJSON
    onHover: 'highlight' | 'none'
    onSelect: 'filter' | 'highlight' | 'none'
  }
  ```
- [ ] Implement methods:
  - [ ] `registerLinkage(config: LinkageConfig)` - Register a layer linkage
  - [ ] `getLayersByColumn(column: string)` - Get all layers linked to a column
  - [ ] `getLinkedFeatures(column: string, value: any)` - Get features across ALL linked layers
    ```typescript
    // Returns: { layerName: string, features: GeoJSONFeature[] }[]
    ```
  - [ ] `getTableIdsForFeature(layerName, feature)` - Get table column/value from feature
    ```typescript
    // Returns: { column: string, value: any }
    ```

**Multi-Geometry Example**:
```typescript
// Three layers link to cluster_id column
linkageManager.registerLinkage({
  layerName: 'clusters_origin',
  tableColumn: 'cluster_id',
  geoProperty: 'cluster_id',
  onHover: 'highlight',
  onSelect: 'filter'
})

linkageManager.registerLinkage({
  layerName: 'cluster_flows',
  tableColumn: 'cluster_id',  // Same column!
  geoProperty: 'cluster_id',
  onHover: 'highlight',
  onSelect: 'filter'
})

// Hovering over cluster_id=5 highlights features in BOTH layers
```

- [ ] Write unit tests:
  - [ ] Test single linkage
  - [ ] Test multiple layers per column
  - [ ] Test `getLinkedFeatures()` returns features from all layers
  - [ ] Test `getTableIdsForFeature()`

**Source**: Extract logic from `/src/plugins/commuter-requests/components/RequestsMap.vue`

### Plugin Registration
- [ ] Add entry to `/src/plugins/pluginRegistry.ts`:
  ```typescript
  {
    kebabName: 'interactive-dashboard',
    filePatterns: ['**/viz-interactive-*.y?(a)ml'],
    component: defineAsyncComponent(() => import('./interactive-dashboard/InteractiveDashboard.vue')),
  }
  ```

**Deliverable**: Plugin structure exists, managers are tested and functional

---

## Phase 2: Generalize Table Component (Week 2)

### DashboardTable Component

- [ ] Copy `/src/plugins/commuter-requests/components/RequestTable.vue` → `components/DashboardTable.vue`

#### Prop Changes
- [ ] Rename `requests: Request[]` → `data: DataRow[]`
- [ ] Add **`idColumn: string`** prop (configurable row ID, not hard-coded to `request_id`)
- [ ] Rename `filteredRequests` → `filteredData`
- [ ] Rename `selectedRequestIds` → `selectedRowIds`
- [ ] Rename `hoveredRequestId` → `hoveredRowId`
- [ ] Update `tableConfig` to generic `TableConfig` type

#### Internal Updates
- [ ] Replace all `request_id` references with `this.idColumn`
- [ ] Update method names:
  - [ ] `onRequestClicked` → `onRowClicked`
  - [ ] `onRequestHovered` → `onRowHovered`
- [ ] Update event names:
  - [ ] `@request-clicked` → `@row-clicked`
  - [ ] `@request-hovered` → `@row-hovered`
- [ ] **Keep as-is** (already generic):
  - [ ] Column auto-generation from data
  - [ ] YAML config support (show/hide arrays, formats)
  - [ ] Sorting logic
  - [ ] CSV export
  - [ ] Scroll-to-row on hover

#### Testing
- [ ] Test with commuter-requests data:
  ```yaml
  table:
    dataset: requests.csv
    idColumn: request_id
  ```
- [ ] Test with clusters data:
  ```yaml
  table:
    dataset: clusters.csv
    idColumn: cluster_id
  ```
- [ ] Test column visibility (show/hide)
- [ ] Test column formatting
- [ ] Test CSV export
- [ ] Test with 10k+ rows (performance check)

**Source**: `/src/plugins/commuter-requests/components/RequestTable.vue` (583 lines)

**Deliverable**: Generic table component works with any CSV dataset

---

## Phase 3: Generalize Stats with Multi-Select (Week 3-4)

### Stats Infrastructure

#### Stat Catalog (`components/stats/_statCatalog.ts`)
- [ ] Create stat registry:
  ```typescript
  import BarChartStat from './BarChartStat.vue'
  import HistogramStat from './HistogramStat.vue'
  import PieChartStat from './PieChartStat.vue'
  import SummaryCardStat from './SummaryCardStat.vue'

  export default {
    bar: BarChartStat,
    histogram: HistogramStat,
    pie: PieChartStat,
    summary: SummaryCardStat,
  }
  ```

#### StatPanel Wrapper (`components/stats/StatPanel.vue`)
- [ ] Create wrapper component
- [ ] Props:
  ```typescript
  {
    config: StatConfig,           // Stat configuration from YAML
    data: DataRow[],              // Full dataset
    filteredData: DataRow[],      // Filtered dataset
    showComparison: boolean,
    isDarkMode: boolean,
    isEnlarged: boolean
  }
  ```
- [ ] Events:
  - [ ] `@filter-changed: FilterDefinition` - Stat emits filter updates
- [ ] Dynamically load stat component from catalog based on `config.type`
- [ ] Pass through all props to loaded stat component

### Individual Stat Components

#### HistogramStat.vue
- [ ] Copy `/src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue`
- [ ] Rename to `HistogramStat.vue`
- [ ] **Add configurable props**:
  - [ ] `column: string` - Which column to bin
  - [ ] `binSize: number` - Bin width
  - [ ] `title: string` - Chart title
- [ ] **Remove hard-coded logic**:
  - [ ] Remove hard-coded `treq` column → use `this.column`
  - [ ] Remove hard-coded time formatting → make generic
- [ ] **Keep multi-select logic** (already implemented correctly):
  - [ ] User clicks bin → toggle selection
  - [ ] Multiple bins selected → OR logic
  - [ ] Update selection UI (borders/opacity)
- [ ] **Emit filter** on selection change:
  ```typescript
  this.$emit('filter-changed', {
    id: `histogram-${this.column}`,
    column: this.column,
    operator: 'range',  // or 'in' for discrete bins
    value: [binStart, binEnd]  // or array of selected bin values
  })
  ```
- [ ] Test with:
  - [ ] Numeric columns (time, duration, distance)
  - [ ] Different bin sizes
  - [ ] Multi-select toggle behavior

**Source**: `/src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue`

#### PieChartStat.vue
- [ ] Copy `/src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`
- [ ] Rename to `PieChartStat.vue`
- [ ] **Add configurable props**:
  - [ ] `column: string` - Which column to group by
  - [ ] `title: string` - Chart title
- [ ] **Remove hard-coded logic**:
  - [ ] Remove hard-coded `main_mode` column → use `this.column`
  - [ ] Make color scheme generic (not just transport modes)
- [ ] **Keep multi-select logic** (already implemented correctly):
  - [ ] User clicks slice → toggle selection
  - [ ] Multiple slices selected → OR logic
  - [ ] Update selection UI (borders/opacity)
- [ ] **Emit filter** on selection change:
  ```typescript
  this.$emit('filter-changed', {
    id: `pie-${this.column}`,
    column: this.column,
    operator: 'in',  // OR logic
    value: Array.from(this.selectedValues)
  })
  ```
- [ ] Test with categorical columns (mode, vehicle, zone, cluster_type)

**Source**: `/src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`

#### BarChartStat.vue (New)
- [ ] Create new component (similar pattern to PieChartStat)
- [ ] Props:
  - [ ] `column: string` - Which column to group by
  - [ ] `aggregation: 'count' | 'sum' | 'avg'` - Aggregation type
  - [ ] `valueColumn?: string` - Column to aggregate (for sum/avg)
  - [ ] `title: string`
- [ ] Plotly bar chart rendering
- [ ] Multi-select with OR logic (same pattern as pie/histogram)
- [ ] Emit filter on selection change
- [ ] Comparison mode (baseline overlay)
- [ ] Test with various groupings

#### SummaryCardStat.vue
- [ ] Extract summary stats from main component
- [ ] Props:
  ```typescript
  {
    title: string,
    metrics: Array<{
      label: string,
      aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct',
      column?: string  // Optional, for non-count aggregations
    }>
  }
  ```
- [ ] Calculate metrics from `data` and `filteredData`
- [ ] Display in card format (reuse existing styles)
- [ ] Show comparison (filtered vs. baseline)
- [ ] **Not clickable** (no filter emitting)
- [ ] Test with different metric types

### Integration
- [ ] Update main component to load stats from YAML config
- [ ] Instantiate `StatPanel` for each stat in config array
- [ ] Connect `@filter-changed` events to `FilterManager.setFilter()`
- [ ] Test interaction flow:
  - [ ] Click stat element → filter updates → other stats re-render
  - [ ] Click same element again → filter removed → stats update
  - [ ] Select multiple elements → OR logic works
  - [ ] Clear all filters → stats show full data

**Source**:
- `/src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue`
- `/src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`
- Summary stats from `/src/plugins/commuter-requests/CommuterRequests.vue` (lines 110-138)

**Deliverable**: Stats are YAML-configurable, support multi-select with toggle

---

## Phase 4: Generalize Map with Multi-Geometry & Layer Visibility (Week 5-6)

### Map Layer Framework

#### BaseGeometryLayer (`components/map-layers/BaseGeometryLayer.ts`)
- [ ] Create abstract base class
- [ ] Define interface:
  ```typescript
  abstract class BaseGeometryLayer {
    config: GeometryLayerConfig
    geojson: GeoJSON
    tableData: DataRow[]
    linkageManager: LinkageManager

    abstract loadGeoJSON(): Promise<void>
    abstract createDeckLayer(): DeckGLLayer
    abstract getFeatureIds(feature: GeoJSONFeature): string[]
    abstract styleFeature(feature: GeoJSONFeature): StyleProperties
    abstract handleHover(info: PickingInfo): void
    abstract handleClick(info: PickingInfo): void
  }
  ```

#### PointLayer (`components/map-layers/PointLayer.ts`)
- [ ] Extend `BaseGeometryLayer`
- [ ] Implement `loadGeoJSON()` from file path
- [ ] Implement `createDeckLayer()` → returns `deck.gl` ScatterplotLayer
- [ ] Apply styling from config:
  - [ ] Color (from colorBy attribute or fixed)
  - [ ] Radius (fixed or property-based)
  - [ ] Opacity
- [ ] Implement `getFeatureIds()` using linkageManager
- [ ] Implement hover:
  - [ ] Check `onHover` config
  - [ ] Emit feature IDs if `onHover == 'highlight'`
- [ ] Implement click:
  - [ ] Check `onSelect` config
  - [ ] Emit feature IDs if `onSelect == 'filter'`
- [ ] Test with request point geometries

**Source**: Extract from `/src/plugins/commuter-requests/components/RequestsMap.vue` (ScatterplotLayer creation)

#### PolygonLayer (`components/map-layers/PolygonLayer.ts`)
- [ ] Extend `BaseGeometryLayer`
- [ ] Implement `loadGeoJSON()` from file path
- [ ] Apply **property filtering** if config.filter exists:
  ```typescript
  if (config.filter) {
    features = features.filter(f =>
      f.properties[config.filter.geoProperty] == config.filter.equals
    )
  }
  ```
- [ ] Implement `createDeckLayer()` → returns `deck.gl` PolygonLayer
- [ ] Apply styling from config:
  - [ ] Fill color
  - [ ] Fill opacity
  - [ ] Stroke color
  - [ ] Stroke width
- [ ] Implement hover and click (same pattern as PointLayer)
- [ ] Test with cluster boundary polygons
- [ ] Test filtering (e.g., show only `cluster_type == 'origin'`)

**Source**: Extract from `/src/plugins/commuter-requests/components/RequestsMap.vue` (PolygonLayer creation)

#### LineLayer (`components/map-layers/LineLayer.ts`)
- [ ] Extend `BaseGeometryLayer`
- [ ] Implement `loadGeoJSON()` from file path
- [ ] Apply property filtering if config.filter exists
- [ ] Implement `createDeckLayer()` → returns `deck.gl` PathLayer or ArcLayer
- [ ] Apply styling from config:
  - [ ] Color
  - [ ] Width (fixed or property-based)
  - [ ] Opacity
- [ ] Implement hover and click
- [ ] Test with flow arrows and O-D lines

**Source**: Extract from `/src/plugins/commuter-requests/components/RequestsMap.vue` (LineLayer/flow creation)

#### Layer Catalog (`components/map-layers/_layerCatalog.ts`)
- [ ] Create registry:
  ```typescript
  import PointLayer from './PointLayer'
  import LineLayer from './LineLayer'
  import PolygonLayer from './PolygonLayer'

  export default {
    point: PointLayer,
    line: LineLayer,
    polygon: PolygonLayer,
  }
  ```

### DashboardMap Component

- [ ] Copy `/src/plugins/commuter-requests/components/RequestsMap.vue` → `components/DashboardMap.vue`

#### Replace Hard-Coded Layers with Dynamic Loading
- [ ] **Remove** hard-coded layer creation
- [ ] **Add** dynamic layer instantiation from config:
  ```typescript
  async loadLayers() {
    for (const layerConfig of this.config.layers) {
      const LayerClass = layerCatalog[layerConfig.type]
      const layer = new LayerClass(layerConfig, this.tableData, this.linkageManager)
      await layer.loadGeoJSON()
      this.layers.push(layer)
    }
  }

  deckLayers(): DeckGLLayer[] {
    return this.layers
      .filter(layer => this.layerVisibility[layer.config.name])  // Respect visibility
      .map(layer => layer.createDeckLayer())
  }
  ```

#### Multi-Geometry Hover
- [ ] **Remove** `clusterType` prop
- [ ] Implement hover handler:
  ```typescript
  onHover(info) {
    if (!info.object) return

    // Get table column/value from clicked feature
    const { column, value } = linkageManager.getTableIdsForFeature(
      info.layer.id, info.object
    )

    // Get ALL features across ALL layers linked to this value
    const linkedFeatures = linkageManager.getLinkedFeatures(column, value)

    // Emit for highlighting in table and ALL linked map features
    this.$emit('feature-hovered', { column, value, linkedFeatures })
  }
  ```

#### Multi-Geometry Click
- [ ] Implement click handler:
  ```typescript
  onClick(info) {
    if (!info.object) return

    const { column, value } = linkageManager.getTableIdsForFeature(
      info.layer.id, info.object
    )

    // Check if this linkage should filter on click
    const linkage = linkageManager.getLinkageByLayer(info.layer.id)
    if (linkage.onSelect === 'filter') {
      this.$emit('feature-clicked', { column, value })
    }
  }
  ```

#### Keep Existing Features
- [ ] deck.gl initialization
- [ ] Background map tiles
- [ ] Zoom controls
- [ ] Tooltip rendering
- [ ] Color legend
- [ ] Dark mode support

#### Testing
- [ ] Test with single layer
- [ ] Test with multiple layers
- [ ] **Test multi-geometry linkage**:
  - [ ] Create 3 layers linked to `cluster_id` column
  - [ ] Hover over cluster → all 3 layers highlight
  - [ ] Click cluster → all 3 layers filter
  - [ ] Table also filters correctly
- [ ] Test layer visibility toggle

**Source**: `/src/plugins/commuter-requests/components/RequestsMap.vue` (943 lines)

### LayerVisibilityToggle Component

- [ ] Create `components/controls/LayerVisibilityToggle.vue`
- [ ] Props:
  ```typescript
  {
    layers: GeometryLayerConfig[],  // Array of layer configs
    visibility: { [layerName: string]: boolean }  // Current visibility state
  }
  ```
- [ ] Events:
  - [ ] `@visibility-changed: { layerName: string, visible: boolean }`
- [ ] UI:
  - [ ] Checkbox for each layer
  - [ ] Layer name as label
  - [ ] Icon/color preview (optional)
  - [ ] "Show All" / "Hide All" buttons
- [ ] Style similar to existing controls
- [ ] Test with multiple layers

**Deliverable**: Map supports configurable layers with multi-geometry linkage and layer visibility control

---

## Phase 5: Main Component Integration (Week 7)

### InteractiveDashboard Component

- [ ] Copy `/src/plugins/commuter-requests/CommuterRequests.vue` → `InteractiveDashboard.vue`

#### State Refactoring
- [ ] **Remove hard-coded filter state**:
  ```typescript
  // DELETE:
  selectedClusters: Set<string>
  selectedTimebins: Set<string>
  selectedModes: Set<string>
  clusterType: 'origin' | 'destination' | 'spatial'
  ```
- [ ] **Add manager instances**:
  ```typescript
  filterManager: FilterManager | null = null
  linkageManager: LinkageManager | null = null
  ```
- [ ] Initialize managers in `created()`:
  ```typescript
  created() {
    this.filterManager = new FilterManager()
    this.linkageManager = new LinkageManager()
    this.filterManager.subscribe(this.onFilterChanged)
  }
  ```

#### Data Loading
- [ ] Parse YAML config
- [ ] Load table dataset from `table.dataset`
- [ ] Load geometry files for each map layer
- [ ] Use existing `dataLoader` utils (already generic)
- [ ] Validate config (check required fields)

#### Stat Loading
- [ ] Parse `stats` array from YAML config (if present)
- [ ] Instantiate `StatPanel` for each stat
- [ ] Pass `data`, `filteredData`, and stat config
- [ ] Connect `@filter-changed` to `filterManager.setFilter()`
- [ ] Handle missing stats gracefully (stats are optional)

#### Map Loading
- [ ] Parse `map.layers` array from YAML config (if present)
- [ ] Pass layers to `DashboardMap`
- [ ] Connect `@feature-clicked` to filter logic:
  ```typescript
  onFeatureClicked({ column, value }) {
    this.filterManager.setFilter({
      id: `feature-${column}`,
      column,
      operator: 'equals',
      value
    })
  }
  ```
- [ ] Connect `@feature-hovered` to hover state
- [ ] Handle missing map gracefully (map is optional)

#### Computed Properties
- [ ] `filteredData`: Use `filterManager.applyFilters(this.tableData)`
- [ ] Remove hard-coded filter logic

#### Layout System
- [ ] Implement `layout` section from YAML (if present)
- [ ] Create rows with specified heights
- [ ] Create cards within rows with specified widths
- [ ] Support card types: `map`, `table`, `stats`
- [ ] Fallback to default layout if not specified

#### Control Components
- [ ] Add `LayerVisibilityToggle` (new)
- [ ] Keep `ComparisonToggle` (reuse as-is)
- [ ] Keep `FilterResetButton` (connects to `filterManager.clearFilters()`)
- [ ] Keep `ScrollToggle` (reuse as-is)
- [ ] Enhance `ColorBySelector` to use YAML-driven options

### Testing

#### Test 1: Commuter Requests Config
- [ ] Create `viz-interactive-commuter-requests.yaml` (Example 1 from plan)
- [ ] Load and verify:
  - [ ] Table displays correctly
  - [ ] All stats load and render
  - [ ] Map shows all layers
  - [ ] Layer visibility toggles work
- [ ] Test interaction loop:
  - [ ] Click histogram bin → table filters → map updates → other stats update
  - [ ] Click pie slice → all components update
  - [ ] Toggle histogram bin off → filters update
  - [ ] Click map feature → table filters → stats update
  - [ ] Hover map → table highlights
  - [ ] Comparison mode toggle works
  - [ ] Reset filters clears everything

#### Test 2: Cluster Dashboard Config
- [ ] Create `viz-interactive-clusters.yaml` (Example 2 from plan)
- [ ] Load and verify:
  - [ ] Clusters table displays
  - [ ] Cluster stats work
  - [ ] Multiple layers linked to `cluster_id` column
- [ ] **Test multi-geometry linkage**:
  - [ ] Hover origin cluster → origin layer highlights
  - [ ] Hover destination cluster → destination layer highlights
  - [ ] Hover flow arrow → flow highlights + linked clusters highlight
  - [ ] Click any → all linked features filter together
  - [ ] Table shows correct filtered rows
  - [ ] Stats update for filtered clusters

#### Test 3: Minimal Config
- [ ] Create minimal YAML (table only, no stats, no map)
- [ ] Verify table-only view works
- [ ] No errors from missing stats/map

#### Performance Testing
- [ ] Test with 10k+ rows in table
- [ ] Test with 10k+ features on map
- [ ] Verify filtering response time <1s
- [ ] Check memory usage

**Source**: `/src/plugins/commuter-requests/CommuterRequests.vue` (1100 lines)

**Deliverable**: Fully functional generic interactive dashboard

---

## Phase 6: Polish & Documentation (Week 8)

### UI Components

#### FilterSummary Component
- [ ] Create `components/FilterSummary.vue`
- [ ] Display active filters as removable tags:
  ```
  [Mode: car, PT] [✕]
  [Time: 08:00-09:00] [✕]
  [Cluster: 5] [✕]
  Clear All
  ```
- [ ] Each tag shows filter column and value(s)
- [ ] Click [✕] to remove individual filter
- [ ] "Clear All" button removes all filters
- [ ] Connect to FilterManager
- [ ] Style to match existing UI

#### Other Polishing
- [ ] Extract `EnlargeButton.vue` from card headers (DRY)
- [ ] Improve error messages for invalid configs
- [ ] Add loading spinners:
  - [ ] Table data loading
  - [ ] Geometry loading
  - [ ] Stat rendering
- [ ] Add empty states:
  - [ ] No data in table
  - [ ] No results after filtering
  - [ ] Missing files

### Utilities
- [ ] Copy `/src/plugins/commuter-requests/utils/dataLoader.ts` → `utils/dataLoader.ts`
- [ ] Extend if needed for generic use
- [ ] Copy `/src/plugins/commuter-requests/utils/colorSchemes.ts` → `utils/colorSchemes.ts`
- [ ] Extend for generic color schemes
- [ ] Create `utils/formatting.ts` for value formatting (if not already covered)

### Error Handling & Validation
- [ ] Validate YAML config on load:
  - [ ] Check table.dataset exists
  - [ ] Check table.idColumn exists
  - [ ] Check stat types are valid
  - [ ] Check layer types are valid
  - [ ] Check file paths are valid
- [ ] Helpful error messages for:
  - [ ] Missing files (table CSV, geometry GeoJSON)
  - [ ] Invalid column names
  - [ ] Type mismatches
  - [ ] Invalid stat/layer types
- [ ] Graceful degradation:
  - [ ] Skip broken stats (log error, don't crash)
  - [ ] Skip broken layers (log error, don't crash)
  - [ ] Continue loading rest of dashboard

### Performance
- [ ] Profile filtering with 50k+ rows
- [ ] If needed, implement optimizations:
  - [ ] Web Worker for filtering (move to background thread)
  - [ ] Virtual scrolling for table
  - [ ] Debounce filter updates
  - [ ] Tile-based map rendering
- [ ] Document performance limitations

### Documentation

#### User Documentation
- [ ] Create `/src/plugins/interactive-dashboard/README.md`
- [ ] Sections:
  - [ ] Overview and features
  - [ ] Quick start guide
  - [ ] YAML configuration reference:
    - [ ] Table options
    - [ ] Stat types and options (histogram, pie, bar, summary)
    - [ ] Map options
    - [ ] Layer types and options (point, line, polygon)
    - [ ] Linkage configuration
    - [ ] Display/layout settings
  - [ ] Example configurations:
    - [ ] Commuter requests (full example)
    - [ ] Cluster analysis (multi-geometry linkage)
    - [ ] Minimal table-only
    - [ ] Stats-only (no map)
  - [ ] Troubleshooting guide
  - [ ] FAQ

#### Developer Documentation
- [ ] Create `/src/plugins/interactive-dashboard/ARCHITECTURE.md`
- [ ] Sections:
  - [ ] Component architecture diagram
  - [ ] Data flow diagrams (filtering, hover, click)
  - [ ] FilterManager API reference
  - [ ] LinkageManager API reference
  - [ ] How to add new stat types
  - [ ] How to add new layer types
  - [ ] Testing guidelines

#### Code Comments
- [ ] Add JSDoc comments to all classes:
  - [ ] FilterManager
  - [ ] LinkageManager
  - [ ] BaseGeometryLayer and subclasses
- [ ] Add JSDoc to all public methods
- [ ] Add inline comments for complex logic
- [ ] Document props, events, and computed properties in Vue components

### Migration Guide
- [ ] Create `/docs/COMMUTER_REQUESTS_MIGRATION.md`
- [ ] Step-by-step migration from `commuter-requests` plugin
- [ ] YAML conversion examples
- [ ] Mapping of old features to new features:
  - [ ] Cluster type selector → layer visibility
  - [ ] Hard-coded stats → YAML-configured stats
- [ ] Known breaking changes
- [ ] Backwards compatibility notes

**Deliverable**: Production-ready, documented, tested plugin

---

## Phase 7: Testing & Validation (Final)

### Test Datasets
- [ ] Create test data for clusters:
  - [ ] `clusters.csv` (100-1000 rows)
  - [ ] `cluster_geometries.geojson` (polygons, flows)
- [ ] Create test data for commuter-requests (if not already present)

### Test Scenarios
- [ ] **Scenario 1**: Table-only dashboard
  - [ ] Load, display, sort, filter, export
- [ ] **Scenario 2**: Table + Stats
  - [ ] All stat types work
  - [ ] Multi-select with toggle
  - [ ] Comparison mode
  - [ ] Filter propagation
- [ ] **Scenario 3**: Table + Map
  - [ ] All layer types work
  - [ ] Hover highlighting
  - [ ] Click filtering
  - [ ] Layer visibility toggle
- [ ] **Scenario 4**: Full dashboard (table + stats + map)
  - [ ] Complete interaction loop
  - [ ] Multi-geometry linkage
  - [ ] All filters work together
- [ ] **Scenario 5**: Edge cases
  - [ ] Empty dataset
  - [ ] Single row
  - [ ] Missing columns
  - [ ] Large dataset (10k+ rows)
  - [ ] Invalid YAML

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Deliverable**: Validated, cross-browser compatible plugin

---

## Progress Tracking

```markdown
## Week 1: Setup & Core Managers
- [ ] Phase 1: Directory setup, TypeScript types, FilterManager, LinkageManager
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 2: Table Generalization
- [ ] Phase 2: DashboardTable component
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 3-4: Stats Framework
- [ ] Phase 3: Stats infrastructure, HistogramStat, PieChartStat, BarChartStat, SummaryCardStat
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 5-6: Map & Multi-Geometry
- [ ] Phase 4: Layer framework, PointLayer, PolygonLayer, LineLayer, DashboardMap, LayerVisibilityToggle
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 7: Main Integration
- [ ] Phase 5: InteractiveDashboard component, full testing
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 8: Polish & Docs
- [ ] Phase 6: FilterSummary, error handling, documentation
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Final: Testing & Validation
- [ ] Phase 7: Full testing, cross-browser validation
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete
```

---

## Quick Reference

### Key Files to Reference

| Purpose | Existing File | New File |
|---------|--------------|----------|
| Main component | `commuter-requests/CommuterRequests.vue` | `interactive-dashboard/InteractiveDashboard.vue` |
| Table | `commuter-requests/components/RequestTable.vue` | `interactive-dashboard/components/DashboardTable.vue` |
| Map | `commuter-requests/components/RequestsMap.vue` | `interactive-dashboard/components/DashboardMap.vue` |
| Filters | `commuter-requests/utils/filters.ts` | `interactive-dashboard/managers/FilterManager.ts` |
| Histogram stat | `commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue` | `interactive-dashboard/components/stats/HistogramStat.vue` |
| Pie chart stat | `commuter-requests/components/stats/MainModePieChartPlotly.vue` | `interactive-dashboard/components/stats/PieChartStat.vue` |

### Key Concepts

- **OR Logic**: Multiple selections within same stat = OR (already implemented in commuter-requests)
- **Multi-Geometry**: Multiple layers can link to same table column, all highlight/filter together
- **Layer Visibility**: Replace cluster type selector with generic show/hide toggles
- **YAML Flexibility**: Only table is required; stats and map are optional

### Important User Requirements

✅ **Must Have**:
- Multi-select stats with toggle (OR logic)
- Multi-geometry linkage
- Layer visibility multi-select
- Test with clusters dataset

❌ **Removed**:
- Time range filtering (not generic enough)
- Cluster type selector (replaced)

⏸️ **Deferred**:
- Performance optimizations (add only if needed)

---

## Ready to Start

All requirements are clear, plan is finalized. Begin Phase 1 when ready!

---

**Document Version**: 2.0 (Updated with user feedback)
**Last Updated**: 2025-11-19
