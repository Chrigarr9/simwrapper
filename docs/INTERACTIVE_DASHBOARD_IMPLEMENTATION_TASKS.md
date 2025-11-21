# Interactive Dashboard - Implementation Tasks
## Detailed Task List for Coding Agents

**Document Version**: 1.1
**Created**: 2025-11-21
**Updated**: 2025-11-21 - Added SimWrapper integration and acceptance criteria
**Purpose**: Self-contained tasks with all context for autonomous implementation

---

## 🎯 Acceptance Criteria

**The interactive dashboard is considered complete when**:

1. ✅ **SimWrapper Integration**: Follows SimWrapper's dashboard discovery pattern
   - Files like `interactive-dashboard-*.yaml` are auto-discovered
   - Listed alongside regular dashboards
   - Same loading mechanism as `dashboard-*.yaml` files

2. ✅ **Feature Parity**: Re-implementation of existing commuter-requests dashboard
   - Create `interactive-dashboard-commuter-requests.yaml` config
   - Produces identical (or nearly identical) visualization to current plugin
   - All interactions work: filtering, hover, selection, comparison mode
   - Serves as validation that generic approach has full feature parity

3. ✅ **Multi-domain Support**: Works with clusters dataset
   - Demonstrates multi-geometry linkage
   - Layer visibility controls
   - Stacked geometry handling

4. ✅ **Testing**: Comprehensive test coverage
   - Unit tests for managers (>80% coverage)
   - Integration tests comparing with original
   - Side-by-side validation passes

---

## How to Use This Document

Each task is designed for execution by a coding agent with:
- **Objective**: Clear goal
- **Context Files**: Required reading  
- **Steps**: Detailed instructions
- **Output**: Files to create/modify
- **Tests**: Verification criteria
- **Dependencies**: Prerequisites

---

## Phase 0: Setup

### TASK-001: Create Plugin Directory Structure

**Priority**: High | **Effort**: Small | **Dependencies**: None

**Objective**: Set up complete directory structure

**Context**: Review `src/plugins/commuter-requests/` for reference

**Steps**:
```bash
mkdir -p src/plugins/interactive-dashboard/{components/{stats,map-layers,controls},managers,utils,types}
```

**Output**: Directory structure with placeholder files

---

### TASK-001B: Study SimWrapper Plugin Registration

**Priority**: High | **Effort**: Small | **Dependencies**: TASK-001

**Objective**: Understand how SimWrapper discovers and loads dashboard/plugin YAML files

**Context Files to Read**:
- Search for dashboard registration patterns in SimWrapper codebase
- Look for: `dashboard-*.yaml` file discovery
- Find: Plugin registry, file pattern matching, auto-loading mechanism

**Research Questions**:
1. How does SimWrapper discover `dashboard-*.yaml` files?
2. Where are plugins registered?
3. What's the plugin interface/API?
4. How to make `interactive-dashboard-*.yaml` follow same pattern?

**Steps**:
```bash
# Search for dashboard discovery
grep -r "dashboard-.*\.yaml" src/

# Find plugin registry
grep -r "pluginRegistry\|registerPlugin" src/

# Find dashboard loading
grep -r "loadDashboard\|DashBoard" src/
```

**Expected Findings**:
- Plugin registry location
- YAML file discovery mechanism
- Plugin interface/contract
- How to register interactive-dashboard plugin

**Output**:
- Document findings in code comments
- Understand registration pattern for TASK-601

**Notes**: This research task informs how we register the interactive-dashboard plugin to follow SimWrapper's conventions.

---

### TASK-002: Define TypeScript Interfaces

**Priority**: High | **Effort**: Medium | **Dependencies**: TASK-001

**Context Files**:
- `src/plugins/commuter-requests/CommuterRequestsConfig.ts`
- `docs/INTERACTIVE_DASHBOARD_REFACTORING_PLAN.md`

**Create**: `types/` with `InteractiveDashboardConfig.ts`, `Filters.ts`, `Linkages.ts`

**Key Interfaces**:
- `InteractiveDashboardConfig` - Main config
- `TableConfig`, `StatConfig`, `MapConfig`, `LayerConfig` - Component configs
- `FilterDefinition` - OR/AND logic support
- `LinkageDefinition` - Multi-geometry support
- `HoverState` - Set-based hover tracking (NEW from master)

**Output**: 3 type files, compiles without errors

---

## Phase 1: Core Managers

### TASK-101: Implement FilterManager

**Priority**: High | **Effort**: Medium | **Dependencies**: TASK-002

**Context Files**:
- `src/plugins/commuter-requests/utils/filters.ts`
- `src/plugins/commuter-requests/CommuterRequests.vue` (filter state management)

**Objective**: Generic filter manager with OR logic within groups, AND between groups

**Key Features**:
- `setFilter()` - Add/update filter
- `applyFilters()` - Filter dataset
- `handleFilterChange()` - Toggle behavior from UI
- Observer pattern for reactive updates

**Implementation**: `managers/FilterManager.ts` + tests

**Test**: 16+ unit tests covering OR/AND logic, toggle behavior

---

### TASK-102: Implement LinkageManager

**Priority**: High | **Effort**: Large | **Dependencies**: TASK-002

**Context Files**:
- `src/plugins/commuter-requests/components/RequestsMap.vue` (lines 41-45, 135-148, 322-680)
- Focus on NEW features from master:
  - `hoveredClusterIds: Set<number>` (line 44)
  - `pickMultipleObjects` for stacked geometries (line 433)
  - Rendering order sort (line 322-347)

**Objective**: Multi-geometry linkage with stacked feature support

**Key Features** (NEW from master):
- `HoverState` with `featureIds: Set` for stacked geometries
- `handleFeatureHover(features[])` - multiple features at once
- `handleFeaturesClick(ids[])` - batch selection
- `getRenderingOrderComparator()` - sort normal < hovered < selected
- `featurePair` tracking for flows

**Implementation**: `managers/LinkageManager.ts` + tests

**Test**: 12+ unit tests including multi-feature hover, batch selection

---

## Phase 2: Data Layer

### TASK-201: Implement DataLoader

**Priority**: High | **Effort**: Medium | **Dependencies**: TASK-002

**Context**: `src/plugins/commuter-requests/utils/dataLoader.ts`

**Create**: `utils/DataLoader.ts` with:
- `loadCSV(path)` - Parse CSV to DataRow[]
- `loadGeoJSON(path)` - Load GeoJSON
- `loadAll(files[])` - Parallel loading

**Output**: Generic loader + tests

---

### TASK-202: Implement ColorMapper

**Priority**: Medium | **Effort**: Small | **Dependencies**: TASK-002

**Context**: `src/plugins/commuter-requests/utils/colorSchemes.ts`

**Create**: `utils/ColorMapper.ts` with categorical and numeric color schemes

**Output**: Color mapper with default schemes

---

## Phase 3: Table Component

### TASK-301: Extract and Generalize Table

**Priority**: High | **Effort**: Small | **Dependencies**: TASK-002, TASK-101

**Context**: `src/plugins/commuter-requests/components/RequestTable.vue` (entire file - 583 lines)

**Steps**:
1. Copy `RequestTable.vue` → `DashboardTable.vue`
2. Make `idColumn` a prop (was hardcoded to 'request_id')
3. Replace `request_id` references with `this.idColumn`
4. Update component name in export

**Changes**:
```typescript
// Add prop:
props: {
  idColumn: { type: String, required: true },  // NEW
  // ... existing props
}

// Replace all: row.request_id → row[this.idColumn]
```

**Output**: Generic table (90% reuse, 10% changes)

**Note**: This is the most generic component - minimal changes needed!

---

## Phase 4: Map Component

### TASK-401: Extract Layer Base Classes

**Priority**: High | **Effort**: Large | **Dependencies**: TASK-002, TASK-102

**Context**: `src/plugins/commuter-requests/components/RequestsMap.vue` (lines 322-680)

**Create 5 files**:

1. **BaseLayer.ts** - Abstract base with:
   - `setData()`, `applyFeatureFilter()`
   - `isFeatureHovered()`, `isFeatureSelected()`
   - `sortByRenderingOrder()` - NEW from master

2. **PointLayer.ts** - ScatterplotLayer wrapper

3. **PolygonLayer.ts** - With NEW features:
   - `pickMultipleObjects` for stacked geometry detection
   - Multi-feature hover support
   - Batch selection on click

4. **LineLayer.ts** - ArcLayer wrapper with feature pair tracking

5. **LayerFactory.ts** - Creates layers by type

**Critical**: Preserve rendering order logic from master (lines 322-347 in RequestsMap.vue)

**Output**: 5 layer class files, fully typed

---

### TASK-402: Create DashboardMap Component

**Priority**: High | **Effort**: Large | **Dependencies**: TASK-401

**Context**: `src/plugins/commuter-requests/components/RequestsMap.vue` (map initialization, deck.gl setup)

**Create**: `components/DashboardMap.vue` with:
- maplibre-gl map initialization
- deck.gl overlay setup
- Layer loading via LayerFactory
- LinkageManager integration
- Update triggers for reactivity

**Template structure**:
```pug
.dashboard-map-container
  .map-canvas(ref="mapContainer")
  .map-controls
    slot(name="controls")
```

**Output**: Generic map component, renders layers from config

---

## Phase 5: Stats Components

### TASK-501: Extract Histogram Stat

**Priority**: High | **Effort**: Medium | **Dependencies**: TASK-002, TASK-101

**Context**: `src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue`

**Steps**:
1. Copy → `HistogramStat.vue`
2. Make `column` and `binSize` props from `config`
3. Keep multi-select OR logic (perfect as-is!)
4. Emit generic `filter-changed` event

**Multi-select pattern to preserve**:
```typescript
handleBinClick(value) {
  if (this.selectedBins.has(value)) {
    this.selectedBins.delete(value)  // Toggle off
  } else {
    this.selectedBins.add(value)     // Toggle on
  }
  this.$emit('filter-changed', {
    filterId: `${this.config.column}-histogram`,
    column: this.config.column,
    operator: 'in',  // OR logic
    values: Array.from(this.selectedBins)
  })
}
```

**Output**: Generic histogram (70% reuse, 30% adaptation)

---

### TASK-502: Extract Pie Chart Stat

**Priority**: High | **Effort**: Medium | **Dependencies**: TASK-002, TASK-101

**Context**: `src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`

**Steps**: Same pattern as TASK-501

**Output**: Generic pie chart

---

### TASK-503: Create Bar Chart and Summary Stats

**Priority**: Medium | **Effort**: Medium | **Dependencies**: TASK-501

**Create**:
- `BarChartStat.vue` - Similar to histogram for categorical+aggregation
- `SummaryStat.vue` - Simple metrics display (no click interaction)
- `StatFactory.ts` - Returns component name by type

**Output**: 2 new stats + factory

---

## Phase 6: Main Component

### TASK-601: Create InteractiveDashboard Main Component

**Priority**: High | **Effort**: Large | **Dependencies**: All previous tasks

**Context**: `src/plugins/commuter-requests/CommuterRequests.vue` (orchestration pattern)

**Create**: `InteractiveDashboard.vue` with:

**Data Management**:
```typescript
data() {
  return {
    filterManager: new FilterManager(),
    linkageManager: new LinkageManager(),
    dataLoader: new DataLoader(fileApi),
    allData: [],
    layerDataMap: new Map(),
  }
}
```

**Internal Layout System**:
```pug
.dashboard-layout
  .dashboard-row(
    v-for="(row, rowId) in layoutRows"
    :style="getRowStyle(row)"
  )
    .dashboard-card(
      v-for="card in row.cards"
      :style="getCardStyle(card)"
    )
      DashboardMap(v-if="card.component === 'map'")
      .stats-panel(v-if="card.component === 'stats'")
      DashboardTable(v-if="card.component === 'table'")
```

**Event Handlers**:
- `handleFilterChanged()` → FilterManager
- `handleRowHovered()` → LinkageManager  
- `handleFeatureClicked()` → LinkageManager

**Output**: Complete main component, wires everything together

---

## Phase 7: Testing & Documentation

### TASK-701: Create Integration Tests

**Priority**: High | **Effort**: Large | **Dependencies**: TASK-601

**Create**: `__tests__/integration/InteractiveDashboard.spec.ts`

**Test Scenarios**:
1. Load with commuter-requests config
2. Load with clusters config (multi-geometry)
3. Load with minimal config (table only)
4. Compare filtered results with original plugin
5. Test stacked geometry handling

**Output**: Comprehensive test suite

---

### TASK-702: Create Documentation

**Priority**: Medium | **Effort**: Medium | **Dependencies**: TASK-701

**Create**:
1. `INTERACTIVE_DASHBOARD_USER_GUIDE.md`:
   - YAML reference with all options
   - Configuration examples
   - Feature descriptions

2. `INTERACTIVE_DASHBOARD_DEVELOPER_GUIDE.md`:
   - Architecture overview
   - Adding new stat types
   - Adding new layer types
   - Manager APIs

**Output**: 2 comprehensive docs

---

### TASK-703: Re-implement Commuter Requests Dashboard

**Priority**: CRITICAL | **Effort**: Medium | **Dependencies**: TASK-601, TASK-701

**Objective**: Create YAML config that recreates the existing commuter-requests dashboard using the generic plugin

**Context Files**:
- Current implementation: `src/plugins/commuter-requests/` (all files)
- Especially: `CommuterRequests.vue` for understanding what features to replicate

**Create**: `interactive-dashboard-commuter-requests.yaml`

**YAML Structure** (based on current implementation):

```yaml
title: "Commuter Requests Dashboard"
description: "Interactive analysis of commuter travel requests"

# Table configuration
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

# Statistics (matching current implementation)
stats:
  - type: histogram
    title: "Active Time Distribution"
    column: treq
    binSize: 900  # 15 minutes
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
      - { label: "Total Requests", aggregation: count }
      - { label: "Unique Modes", aggregation: count_distinct, column: main_mode }

# Map layers (matching current RequestsMap.vue)
map:
  center: [13.391, 52.515]
  zoom: 10

  colorBy:
    default: main_mode
    options:
      - { attribute: main_mode, label: "Transport Mode", type: categorical }
      - { attribute: travel_time, label: "Travel Time", type: numeric }

  layers:
    # Request points
    - name: requests
      file: requests_geometries.geojson
      type: point
      visible: true
      linkage:
        tableColumn: request_id
        geoProperty: request_id
        onHover: highlight
        onSelect: filter
      style:
        radius: 5
        opacity: 0.7
        colorBy: main_mode

    # Cluster boundaries (all types)
    - name: clusters_origin
      file: cluster_geometries.geojson
      type: polygon
      visible: false
      filter: { geoProperty: cluster_type, equals: origin }
      linkage:
        tableColumn: origin_cluster
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#ffcccc"
        fillOpacity: 0.3
        strokeColor: "#666666"

    - name: clusters_destination
      file: cluster_geometries.geojson
      type: polygon
      visible: false
      filter: { geoProperty: cluster_type, equals: destination }
      linkage:
        tableColumn: destination_cluster
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#ccccff"
        fillOpacity: 0.3

    - name: clusters_od
      file: cluster_geometries.geojson
      type: polygon
      visible: false
      filter: { geoProperty: cluster_type, equals: od }
      linkage:
        tableColumn: od_cluster
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        fillColor: "#ccffcc"
        fillOpacity: 0.3

    # Flow arrows
    - name: request_flows
      file: cluster_geometries.geojson
      type: line
      visible: true
      filter: { geoProperty: geometry_type, equals: flow }
      linkage:
        tableColumn: od_cluster
        geoProperty: cluster_id
        onHover: highlight
        onSelect: filter
      style:
        color: "#3366ff"
        width: 2
        opacity: 0.7

# Layout (matching current component arrangement)
layout:
  row1:
    - component: map
      width: 2
      height: 12
    - component: stats
      width: 1
      height: 12
  row2:
    - component: table
      width: 3
      height: 8

# Display options
display:
  showComparison: true
```

**Validation Steps**:

1. **Side-by-side comparison**:
   ```bash
   # Open both:
   # - Original: viz-commuter-requests.yaml (current plugin)
   # - New: interactive-dashboard-commuter-requests.yaml (generic plugin)

   # Compare:
   # - Visual appearance
   # - Filter behavior
   # - Hover interactions
   # - Selection behavior
   # - Comparison mode
   # - Table sorting/export
   ```

2. **Feature checklist**:
   - [ ] Table displays all requests with correct columns
   - [ ] Histogram shows time distribution with 15-min bins
   - [ ] Pie chart shows mode share
   - [ ] Summary shows total requests and unique modes
   - [ ] Map shows request points
   - [ ] Map shows cluster boundaries (toggle-able)
   - [ ] Map shows flow arrows
   - [ ] Clicking histogram bin filters data (OR logic)
   - [ ] Clicking pie slice filters data (OR logic)
   - [ ] Clicking map feature filters data
   - [ ] Hovering map highlights related features
   - [ ] Hovering table row highlights on map
   - [ ] Multi-select works correctly
   - [ ] Stacked cluster selection works
   - [ ] Comparison mode shows baseline overlay
   - [ ] Filter reset clears all filters
   - [ ] Table export works

3. **Performance comparison**:
   - Load time: within 5% of original
   - Filter response: <100ms difference
   - Hover response: no visible lag

**Output**:
- `interactive-dashboard-commuter-requests.yaml` that produces functionally identical dashboard
- Validation report documenting feature parity
- List of any minor differences (acceptable if documented)

**Success Criteria**:
- 100% feature parity OR documented acceptable differences
- Performance within 5% of original
- User cannot tell the difference in normal usage

**Notes**: This is the PRIMARY acceptance test. If this works, the generic approach is validated!

---

## Task Execution Order

**Critical Path**:
```
TASK-001 → TASK-001B (research) → TASK-002
           ↓
         TASK-101, TASK-102 → TASK-401 → TASK-402 → TASK-601 → TASK-703 (validation)
           ↓                                          ↑
         TASK-201, TASK-301, TASK-501 ---------------┘
```

**Parallelizable Groups**:
- Group A: TASK-101, TASK-102, TASK-201, TASK-202 (after TASK-002)
- Group B: TASK-301, TASK-501, TASK-502 (after Group A)
- Group C: TASK-401 (after TASK-102)

**Final Validation**:
- TASK-703: Re-implement commuter-requests (CRITICAL acceptance test)

**Timeline Estimate**: 15-22 days for full implementation including validation

**Total Tasks**: 22 tasks (was 21, added TASK-001B and TASK-703)

---

## Special Notes for Coding Agents

### Preserve NEW Features from Master (2025-11-21)

1. **Multi-cluster selection** (`onClustersClicked` method):
   - Location: `CommuterRequests.vue` lines 644-662
   - Pattern: If ALL selected → deselect ALL, else select ALL

2. **Set-based hover tracking** (`hoveredClusterIds: Set<number>`):
   - Location: `RequestsMap.vue` line 44
   - Usage: Supports multiple overlapping features

3. **pickMultipleObjects** for stacked geometries:
   - Location: `RequestsMap.vue` lines 433-447
   - Critical for overlapping cluster handling

4. **Rendering order optimization**:
   - Location: `RequestsMap.vue` lines 322-347
   - Sort: normal (score=0) < hovered (1) < selected (2)

5. **Feature pair tracking** (`hoveredFlowClusterPair`):
   - Location: `RequestsMap.vue` line 45
   - For flow/arc linkages

### Testing Guidelines

**For each task with tests**:
```bash
# Type checking
npx tsc --noEmit

# Unit tests
npm test <ComponentName>.spec.ts

# All tests
npm test
```

**Manual testing**:
- Test with commuter-requests data first (known baseline)
- Then test with new domain (clusters)
- Compare behavior side-by-side

### Code Quality Standards

1. **TypeScript**: Strict typing, no `any` unless necessary
2. **JSDoc**: Document all public methods
3. **Tests**: >80% coverage for managers and utilities
4. **Naming**: Use generic names (feature, not cluster/request)
5. **Comments**: Explain WHY, not WHAT (code should be self-documenting)

---

**Document End** - Ready for autonomous coding agent deployment
