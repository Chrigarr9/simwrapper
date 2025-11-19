# Interactive Dashboard - Implementation Tasks
## Generalization from Commuter Requests Plugin

**Last Updated**: 2025-11-19
**Status**: Ready to Start
**Estimated Duration**: 6-8 weeks

See [INTERACTIVE_DASHBOARD_GENERALIZATION_PLAN.md](./INTERACTIVE_DASHBOARD_GENERALIZATION_PLAN.md) for full context.

---

## Overview

We are **generalizing** the existing `commuter-requests` plugin into a reusable `interactive-dashboard` plugin. The tasks below are organized by phase, with clear deliverables.

### What Exists ✅
- **Complete working plugin**: `/src/plugins/commuter-requests/`
  - Main component (1100 lines)
  - Table, map, stats, controls
  - Filter system, data loader, color schemes
  - YAML configuration support

### What We're Building 🎯
- **Generic plugin**: `/src/plugins/interactive-dashboard/`
  - Works with any CSV + GeoJSON
  - YAML-configurable stats and map layers
  - Pluggable components

### Strategy
**Parallel implementation** - Create new plugin alongside commuter-requests, then deprecate old one.

---

##Phase 1: Setup & Core Managers (Week 1)

### Directory Setup
- [ ] Create `/src/plugins/interactive-dashboard/` directory
- [ ] Create subdirectories:
  - [ ] `components/`
  - [ ] `components/stats/`
  - [ ] `components/map-layers/`
  - [ ] `components/controls/`
  - [ ] `managers/`
  - [ ] `utils/`

### TypeScript Types
- [ ] Create `InteractiveDashboardConfig.ts`
- [ ] Define `DashboardConfig` interface (top-level YAML structure)
- [ ] Define `TableConfig` interface
- [ ] Define `StatConfig` interface (base + specific types)
- [ ] Define `MapConfig` interface
- [ ] Define `GeometryLayerConfig` interface
- [ ] Define `LinkageConfig` interface
- [ ] Define `FilterDefinition` interface
- [ ] Define `DataRow` type (generic replacement for `Request`)

**Source**: Extract from `/src/plugins/commuter-requests/CommuterRequestsConfig.ts`

### Core Managers

#### FilterManager (`managers/FilterManager.ts`)
- [ ] Create `FilterManager` class
- [ ] Implement `addFilter(filter: FilterDefinition)` method
- [ ] Implement `removeFilter(filterId: string)` method
- [ ] Implement `clearFilters()` method
- [ ] Implement `applyFilters<T>(data: T[], idColumn: string): T[]` method
- [ ] Implement subscribe/unsubscribe pattern
- [ ] Write unit tests for FilterManager
- [ ] Test AND logic between different filter types
- [ ] Test with various operators (equals, in, range, contains)

**Source**: Generalize from `/src/plugins/commuter-requests/utils/filters.ts`

**Key Changes**:
- From hard-coded filter functions → generic filter definitions
- From separate Sets → unified filter registry
- Add operator support

#### LinkageManager (`managers/LinkageManager.ts`)
- [ ] Create `LinkageManager` class
- [ ] Implement `registerLinkage(config: LinkageConfig)` method
- [ ] Implement `getTableIdsForFeature(layerName, feature): string[]` method
- [ ] Implement `getFeaturesForTableId(layerName, tableId): GeoJSONFeature[]` method
- [ ] Support one-to-many relationships (e.g., cluster → multiple requests)
- [ ] Write unit tests for LinkageManager

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

**Deliverable**: Plugin structure exists, managers are tested independently

---

## Phase 2: Generalize Table Component (Week 2)

### DashboardTable Component
- [ ] Copy `/src/plugins/commuter-requests/components/RequestTable.vue` → `components/DashboardTable.vue`

#### Props Changes
- [ ] Rename `requests: Request[]` → `data: DataRow[]`
- [ ] Add `idColumn: string` prop (configurable row ID, not hard-coded to `request_id`)
- [ ] Rename `filteredRequests` → `filteredData`
- [ ] Rename `selectedRequestIds` → `selectedRowIds`
- [ ] Rename `hoveredRequestId` → `hoveredRowId`

#### Internal Updates
- [ ] Replace all references to `request_id` with `this.idColumn`
- [ ] Update method names: `onRequestClicked` → `onRowClicked`, etc.
- [ ] Keep column auto-generation logic (already generic)
- [ ] Keep YAML config support (already generic)
- [ ] Keep sorting logic
- [ ] Keep export functionality

#### Testing
- [ ] Test with commuter-requests data (`idColumn: 'request_id'`)
- [ ] Test with mock rides data (`idColumn: 'ride_id'`)
- [ ] Test column visibility (show/hide arrays)
- [ ] Test column formatting
- [ ] Test CSV export
- [ ] Test with 10k+ rows (performance)

**Source**: `/src/plugins/commuter-requests/components/RequestTable.vue` (583 lines)

**Deliverable**: Generic table works with any CSV dataset

---

## Phase 3: Generalize Stats Framework (Week 3-4)

### Stats Infrastructure

#### Stat Catalog (`components/stats/_statCatalog.ts`)
- [ ] Create stat registry similar to layer-map's layer catalog
- [ ] Export object mapping stat types to components
- [ ] Example structure:
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
- [ ] Create wrapper component that loads specific stat type from catalog
- [ ] Props:
  ```typescript
  {
    config: StatConfig,
    data: DataRow[],
    filteredData: DataRow[],
    showComparison: boolean,
    isDarkMode: boolean,
    isEnlarged: boolean
  }
  ```
- [ ] Events: `@filter-request: FilterDefinition`
- [ ] Dynamically load correct stat component based on `config.type`

### Individual Stat Components

#### HistogramStat.vue
- [ ] Copy `/src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue`
- [ ] Rename to `HistogramStat.vue`
- [ ] **Add props**:
  - [ ] `column: string` (which column to bin)
  - [ ] `binSize: number` (bin width)
  - [ ] `title: string` (from config)
- [ ] **Remove hard-coded**:
  - [ ] Remove hard-coded `treq` column
  - [ ] Remove hard-coded time formatting (make generic)
- [ ] **Keep**:
  - [ ] Plotly histogram rendering
  - [ ] Bin click handler
  - [ ] Comparison mode (baseline overlay)
- [ ] **Emit** filter on bin click:
  ```typescript
  $emit('filter-request', {
    id: 'histogram-' + column,
    column: column,
    operator: 'range',
    value: [binStart, binEnd]
  })
  ```
- [ ] Test with numeric columns (time, duration, distance)

#### PieChartStat.vue
- [ ] Copy `/src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`
- [ ] Rename to `PieChartStat.vue`
- [ ] **Add props**:
  - [ ] `column: string` (which column to group by)
  - [ ] `title: string`
- [ ] **Remove hard-coded**:
  - [ ] Remove hard-coded `main_mode` column
  - [ ] Make color scheme generic (not just transport modes)
- [ ] **Keep**:
  - [ ] Plotly donut chart
  - [ ] Slice click handler
  - [ ] Comparison mode (outer ring)
- [ ] **Emit** filter on slice click:
  ```typescript
  $emit('filter-request', {
    id: 'pie-' + column,
    column: column,
    operator: 'equals',
    value: sliceLabel
  })
  ```
- [ ] Test with categorical columns (mode, vehicle, zone)

#### BarChartStat.vue (New)
- [ ] Create new component (similar to PieChartStat)
- [ ] Props: `column`, `groupBy`, `aggregation`, `title`
- [ ] Plotly bar chart
- [ ] Click handler emits filter
- [ ] Comparison mode
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
- [ ] Display in card format (already styled in commuter-requests)
- [ ] Show comparison (filtered vs. baseline)
- [ ] Not clickable (no filter emitting)

### Integration
- [ ] Update main component to load stats from YAML config
- [ ] Instantiate `StatPanel` for each stat in config
- [ ] Connect stat `@filter-request` events to FilterManager
- [ ] Test interaction: click stat → filter updates → other stats update

**Source**:
- `/src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue`
- `/src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`
- Summary stats from `/src/plugins/commuter-requests/CommuterRequests.vue`

**Deliverable**: Stats are configurable via YAML, work with any column

---

## Phase 4: Generalize Map Component (Week 5-6)

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

    abstract createDeckLayer(): DeckGLLayer
    abstract getFeatureIds(feature: GeoJSONFeature): string[]
    abstract styleFeature(feature: GeoJSONFeature): StyleProperties
    abstract handleHover(info: PickingInfo): void
    abstract handleClick(info: PickingInfo): void
  }
  ```

#### PointLayer (`components/map-layers/PointLayer.ts`)
- [ ] Extend `BaseGeometryLayer`
- [ ] Load GeoJSON file
- [ ] Create `deck.gl` ScatterplotLayer
- [ ] Apply styling from config:
  - [ ] Color (from colorBy attribute)
  - [ ] Radius
  - [ ] Opacity
- [ ] Implement `getFeatureIds()` using linkageManager
- [ ] Implement hover: emit feature IDs
- [ ] Implement click: emit feature IDs based on `onSelect` config
- [ ] Test with request geometries

**Source**: Extract from `/src/plugins/commuter-requests/components/RequestsMap.vue` (point rendering)

#### PolygonLayer (`components/map-layers/PolygonLayer.ts`)
- [ ] Extend `BaseGeometryLayer`
- [ ] Load GeoJSON file
- [ ] Create `deck.gl` PolygonLayer
- [ ] Apply styling from config:
  - [ ] Fill color
  - [ ] Fill opacity
  - [ ] Stroke color
  - [ ] Stroke width
- [ ] Support property filtering (e.g., `cluster_type == 'origin'`)
- [ ] Implement hover and click
- [ ] Test with cluster boundaries

**Source**: Extract from `/src/plugins/commuter-requests/components/RequestsMap.vue` (polygon rendering)

#### LineLayer (`components/map-layers/LineLayer.ts`)
- [ ] Extend `BaseGeometryLayer`
- [ ] Load GeoJSON file
- [ ] Create `deck.gl` PathLayer (for paths) or ArcLayer (for arcs)
- [ ] Apply styling from config:
  - [ ] Color
  - [ ] Width
  - [ ] Opacity
- [ ] Implement hover and click
- [ ] Test with flow arrows and O-D lines

**Source**: Extract from `/src/plugins/commuter-requests/components/RequestsMap.vue` (line/flow rendering)

#### Layer Catalog (`components/map-layers/_layerCatalog.ts`)
- [ ] Create registry mapping layer types to classes
- [ ] Example:
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
- [ ] **Replace hard-coded layers** with dynamic layer loading:
  ```typescript
  layers(): BaseGeometryLayer[] {
    return this.config.layers.map(layerConfig => {
      const LayerClass = layerCatalog[layerConfig.type]
      return new LayerClass(layerConfig, this.tableData, this.linkageManager)
    })
  }

  deckLayers(): DeckGLLayer[] {
    return this.layers.map(layer => layer.createDeckLayer())
  }
  ```
- [ ] **Update event handlers**:
  - [ ] `onHover()` → query all layers for feature IDs → emit
  - [ ] `onClick()` → query clicked layer → emit based on linkage config
- [ ] **Connect to LinkageManager**:
  - [ ] Register all layer linkages on mount
  - [ ] Use linkage manager to resolve IDs
- [ ] **Keep**:
  - [ ] deck.gl initialization
  - [ ] Background map tiles
  - [ ] Zoom controls
  - [ ] Tooltip rendering
  - [ ] Color legend
- [ ] Test with multiple layers simultaneously

**Source**: `/src/plugins/commuter-requests/components/RequestsMap.vue` (943 lines)

**Deliverable**: Map supports configurable geometry layers via YAML

---

## Phase 5: Main Component Integration (Week 7)

### InteractiveDashboard Component
- [ ] Copy `/src/plugins/commuter-requests/CommuterRequests.vue` → `InteractiveDashboard.vue`

#### State Refactoring
- [ ] **Replace**:
  ```typescript
  // Before:
  allRequests: Request[]
  selectedClusters: Set<string>
  selectedTimebins: Set<string>
  selectedModes: Set<string>

  // After:
  tableData: DataRow[]
  filterManager: FilterManager
  ```
- [ ] Initialize `FilterManager` in `created()`
- [ ] Initialize `LinkageManager` in `created()`
- [ ] Subscribe to filter changes

#### Data Loading
- [ ] Load table dataset from YAML config
- [ ] Load geometry files from YAML config
- [ ] Use existing `dataLoader` utils (already generic)

#### Stat Loading
- [ ] Parse `stats` array from YAML config
- [ ] Instantiate `StatPanel` for each stat
- [ ] Pass data, filteredData, and config
- [ ] Connect `@filter-request` to `FilterManager.addFilter()`

#### Map Loading
- [ ] Parse `map.layers` array from YAML config
- [ ] Pass layers to `DashboardMap`
- [ ] Connect `@feature-clicked` to filter logic:
  - [ ] If `onSelect: 'filter'` → add filter via FilterManager
  - [ ] If `onSelect: 'highlight'` → update selection state only
- [ ] Connect `@feature-hovered` to hover state

#### Computed Properties
- [ ] `filteredData`: Use `filterManager.applyFilters()`
- [ ] Remove hard-coded filter logic

#### Layout System
- [ ] Implement `layout` section from YAML
- [ ] Create rows with specified heights
- [ ] Create cards within rows with specified widths
- [ ] Support card types: `map`, `table`, `stats`
- [ ] Add enlarge/fullscreen functionality per card

#### Control Components
- [ ] Reuse `ComparisonToggle.vue` (already generic)
- [ ] Reuse `FilterResetButton.vue` (already generic)
- [ ] Reuse `ScrollToggle.vue` (already generic)
- [ ] Enhance `ColorBySelector.vue` to use YAML-driven options

### Testing
- [ ] Create `viz-interactive-commuter-requests.yaml` (Example 1 from plan)
- [ ] Test full interaction loop:
  - [ ] Click histogram bin → table filters → map updates
  - [ ] Click map feature → table filters → stats update
  - [ ] Click pie slice → all components update
  - [ ] Hover map → table highlights
  - [ ] Comparison mode toggle works
  - [ ] Reset filters clears everything
- [ ] Create `viz-interactive-rides.yaml` (Example 2 from plan)
- [ ] Test with rides data
- [ ] Performance test with 10k+ rows

**Source**: `/src/plugins/commuter-requests/CommuterRequests.vue` (1100 lines)

**Deliverable**: Fully functional generic interactive dashboard

---

## Phase 6: Polish & Documentation (Week 8)

### UI Components
- [ ] Create `components/FilterSummary.vue`
  - [ ] Display active filters as removable tags
  - [ ] Show filter count
  - [ ] "Clear all" button
- [ ] Extract `EnlargeButton.vue` from card headers (DRY)
- [ ] Improve error messages for invalid configs
- [ ] Add loading spinners for data/geometry loading

### Utilities
- [ ] Copy and extend `/src/plugins/commuter-requests/utils/dataLoader.ts`
- [ ] Copy and extend `/src/plugins/commuter-requests/utils/colorSchemes.ts`
- [ ] Create `utils/formatting.ts` for value formatting

### Error Handling
- [ ] Validate YAML config on load
- [ ] Helpful error messages for:
  - [ ] Missing files
  - [ ] Invalid column names
  - [ ] Type mismatches
  - [ ] Invalid stat types
  - [ ] Invalid layer types
- [ ] Graceful degradation (skip broken stats/layers, don't crash)

### Performance
- [ ] Profile filtering with 50k+ rows
- [ ] Add Web Worker for filtering if needed
- [ ] Add virtual scrolling to table if needed
- [ ] Optimize map rendering (tile-based loading)

### Documentation

#### User Documentation
- [ ] Create `/src/plugins/interactive-dashboard/README.md`
- [ ] Introduction and overview
- [ ] Full YAML reference:
  - [ ] Table config options
  - [ ] Stat types and options
  - [ ] Map layer types and options
  - [ ] Linkage configuration
  - [ ] Display settings
- [ ] Example configurations:
  - [ ] Commuter requests
  - [ ] Rides analysis
  - [ ] Generic trips
  - [ ] Custom use case
- [ ] Troubleshooting guide

#### Developer Documentation
- [ ] Create `/src/plugins/interactive-dashboard/ARCHITECTURE.md`
- [ ] Component architecture diagram
- [ ] Data flow diagrams
- [ ] How to add new stat types
- [ ] How to add new layer types
- [ ] FilterManager API reference
- [ ] LinkageManager API reference

#### Code Comments
- [ ] Add JSDoc comments to all classes and methods
- [ ] Inline comments for complex logic
- [ ] Document props, events, and computed properties

### Testing
- [ ] Unit tests for FilterManager
- [ ] Unit tests for LinkageManager
- [ ] Integration tests for filtering flow
- [ ] Integration tests for hover/selection flow
- [ ] Test with edge cases:
  - [ ] Empty dataset
  - [ ] Single row
  - [ ] Missing columns
  - [ ] Large datasets (100k+ rows)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

### Migration Guide
- [ ] Create `/docs/COMMUTER_REQUESTS_MIGRATION.md`
- [ ] Step-by-step migration from old plugin
- [ ] YAML conversion examples
- [ ] Known breaking changes
- [ ] Backwards compatibility notes

**Deliverable**: Production-ready, documented, tested plugin

---

## Phase 7: Deprecation & Cleanup (Optional)

### Backwards Compatibility
- [ ] Decide: Keep `commuter-requests` plugin or deprecate?
- [ ] If keeping:
  - [ ] Add deprecation notice to `/src/plugins/commuter-requests/README.md`
  - [ ] Point users to new plugin
- [ ] If deprecating:
  - [ ] Add migration guide
  - [ ] Keep for 1-2 releases then remove

### Code Sharing
- [ ] Move shared utils to common location:
  - [ ] `dataLoader.ts`
  - [ ] `colorSchemes.ts`
  - [ ] `formatting.ts`
- [ ] Update both plugins to use shared utils

---

## Progress Tracking Template

Copy this to track your progress:

```markdown
## Week 1: Setup & Core Managers
- [ ] Phase 1.1: Directory setup
- [ ] Phase 1.2: TypeScript types
- [ ] Phase 1.3: FilterManager
- [ ] Phase 1.4: LinkageManager
- [ ] Phase 1.5: Plugin registration
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 2: Table Generalization
- [ ] Phase 2: DashboardTable component
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 3-4: Stats Framework
- [ ] Phase 3.1: Stats infrastructure
- [ ] Phase 3.2: HistogramStat
- [ ] Phase 3.3: PieChartStat
- [ ] Phase 3.4: BarChartStat
- [ ] Phase 3.5: SummaryCardStat
- [ ] Phase 3.6: Integration
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 5-6: Map Generalization
- [ ] Phase 4.1: Layer framework
- [ ] Phase 4.2: PointLayer
- [ ] Phase 4.3: PolygonLayer
- [ ] Phase 4.4: LineLayer
- [ ] Phase 4.5: DashboardMap
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 7: Main Integration
- [ ] Phase 5: InteractiveDashboard component
**Status**: ⬜ Not Started / 🔄 In Progress / ✅ Complete

## Week 8: Polish & Docs
- [ ] Phase 6: Final polish and documentation
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
| Stats (histogram) | `commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue` | `interactive-dashboard/components/stats/HistogramStat.vue` |
| Stats (pie) | `commuter-requests/components/stats/MainModePieChartPlotly.vue` | `interactive-dashboard/components/stats/PieChartStat.vue` |

### Command Reference

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Lint
npm run lint
```

---

## Questions or Blockers?

If you encounter questions or blockers during implementation:

1. **Check** [INTERACTIVE_DASHBOARD_GENERALIZATION_PLAN.md](./INTERACTIVE_DASHBOARD_GENERALIZATION_PLAN.md) for context
2. **Review** existing commuter-requests implementation
3. **Ask** team for clarification on open questions
4. **Document** decisions made during implementation

---

**Document Version**: 1.0
**Last Updated**: 2025-11-19
**Ready to Start**: Yes ✅
