# Interactive Dashboard - Implementation Tasks
## Detailed Task List for Coding Agents

**Document Version**: 1.0  
**Created**: 2025-11-21  
**Purpose**: Self-contained tasks with all context for autonomous implementation

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

## Task Execution Order

**Critical Path**:
```
TASK-001 → TASK-002 → TASK-101, TASK-102 → TASK-401 → TASK-402 → TASK-601
           ↓
         TASK-201, TASK-301, TASK-501 → TASK-601
```

**Parallelizable Groups**:
- Group A: TASK-101, TASK-102, TASK-201, TASK-202 (after TASK-002)
- Group B: TASK-301, TASK-501, TASK-502 (after Group A)
- Group C: TASK-401 (after TASK-102)

**Timeline Estimate**: 14-20 days for full implementation

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
