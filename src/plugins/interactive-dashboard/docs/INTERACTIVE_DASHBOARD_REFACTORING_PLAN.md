# Interactive Dashboard - Refactoring Plan
## Systematic Extraction from Commuter Requests Plugin

**Document Version**: 2.0
**Created**: 2025-11-21
**Updated**: 2025-11-21 - UNIFIED FORMAT: Adopts SimWrapper's layout system with optional interactivity
**Purpose**: Guide the refactoring of `commuter-requests` into a generic `interactive-dashboard` plugin

---

## ⚡ IMPORTANT: Architecture Change

**This plan has been updated to reflect a UNIFIED FORMAT approach:**

Instead of creating a separate layout system, the interactive dashboard will:
- ✅ **Use SimWrapper's existing row/card layout structure**
- ✅ **Add optional `table` section that triggers interactive coordination**
- ✅ **Preserve backward compatibility** (dashboards without `table` work as standard)
- ✅ **Layer coordination features** (FilterManager, LinkageManager) on top of existing structure

See `docs/UNIFIED_YAML_FORMAT.md` for complete architectural details.

**Impact on this plan**:
- Sections about layout systems are now simplified (we reuse SimWrapper's)
- Focus shifts to coordination layer (FilterManager, LinkageManager)
- Component extraction focuses on making cards "linkable" rather than creating new card types

---

## Table of Contents

1. [Overview](#overview)
2. [Refactoring Strategy](#refactoring-strategy)
3. [Component Extraction Map](#component-extraction-map)
4. [Code Reuse vs Rewrite](#code-reuse-vs-rewrite)
5. [Data Flow Architecture](#data-flow-architecture)
6. [Testing Strategy](#testing-strategy)
7. [Migration Path](#migration-path)

---

## Overview

### Objective

Extract and generalize the `commuter-requests` plugin into a reusable `interactive-dashboard` plugin that:
- Maintains all current functionality patterns
- Supports ANY domain/dataset through YAML configuration
- Has zero domain-specific logic in the codebase
- **Uses SimWrapper's existing row/card layout system** (NEW)
- **Adds optional interactive coordination layer** (NEW)
- **Maintains full backward compatibility with standard SimWrapper dashboards** (NEW)

### Source Plugin Analysis

The `commuter-requests` plugin (as of 2025-11-21) contains:
- **1,100 lines** in main component (`CommuterRequests.vue`)
- **943 lines** in map component (`RequestsMap.vue`)
- **583 lines** in table component (`RequestTable.vue`)
- **~500 lines** in stats components (histogram, pie chart)
- **~300 lines** in utility functions (filters, data loading, color schemes)

**Total**: ~3,400 lines of code to analyze and refactor

### Key Recent Improvements (Master)

Recent updates to commuter-requests that MUST be preserved:
1. **Multi-cluster selection** (`onClustersClicked` method) - handles overlapping geometries
2. **Set-based hover tracking** (`hoveredClusterIds: Set<number>`) - supports stacked features
3. **Rendering order optimization** - ensures selected/hovered features appear on top
4. **Flow-cluster pair tracking** (`hoveredFlowClusterPair`) - distinguishes flow vs cluster hover
5. **Opacity-based visual hierarchy** - different opacity for different interaction states

---

## Refactoring Strategy

### Approach: Incremental Extraction with Parallel Development

**Phase 1: Core Infrastructure** (Non-disruptive)
- Create new plugin directory alongside existing commuter-requests
- Build generic managers (FilterManager, LinkageManager)
- No changes to existing plugin

**Phase 2: Component Extraction** (Copy-and-modify)
- Copy components from commuter-requests → interactive-dashboard
- Generalize while keeping originals intact
- Test generic versions independently

**Phase 3: Integration** (Assembly)
- Wire components together in new plugin structure
- Add internal layout system
- Connect managers to components

**Phase 4: Validation** (Side-by-side comparison)
- Run both plugins with same data
- Compare behavior and output
- Fix discrepancies

**Phase 5: Production** (Optional migration)
- Release generic plugin
- Optionally migrate commuter-requests to use generic plugin under the hood
- Maintain backward compatibility

### Guiding Principles

1. **Never break commuter-requests** - it's the working reference implementation
2. **Extract patterns, not just code** - understand WHY before copying
3. **Test early and often** - validate each component independently
4. **Document assumptions** - make implicit domain knowledge explicit
5. **Preserve recent improvements** - multi-cluster selection, hover tracking, etc.

---

## Component Extraction Map

### 1. Main Component

**Source**: `src/plugins/commuter-requests/CommuterRequests.vue`
**Target**: `src/plugins/interactive-dashboard/InteractiveDashboard.vue`

**Extraction Strategy**:
```
CommuterRequests.vue (1100 lines)
├── Layout rendering (50 lines)         → Extract: internal layout system
├── Data loading (100 lines)            → Extract: generic data loader
├── State management (200 lines)        → Replace: FilterManager + LinkageManager
│   ├── selectedClusters: Set          → FilterManager
│   ├── selectedTimebins: Set          → FilterManager
│   ├── selectedModes: Set             → FilterManager
│   ├── selectedRequestIds: Set        → FilterManager
│   ├── hoveredRequestId: string       → LinkageManager hover state
│   └── showComparison: boolean        → Keep as display option
├── Filter logic (150 lines)           → Replace: FilterManager.applyFilters()
├── Event handlers (200 lines)         → Generalize: generic handlers
│   ├── onClusterClicked               → onFeatureClicked
│   ├── onClustersClicked ✅ NEW      → onFeaturesClicked (batch)
│   ├── onRequestClicked               → onFeatureClicked
│   └── onRequestHovered               → onFeatureHovered
├── Computed properties (100 lines)    → Adapt: generic computed
│   ├── filteredRequests               → filteredData
│   ├── hasActiveFilters               → FilterManager.hasFilters
│   └── filteredClusterBoundaries      → LinkageManager.getLinkedFeatures
└── Template/styling (300 lines)       → Adapt: internal layout rendering
```

**Reuse Level**: ~30% direct reuse, 70% adaptation

### 2. Map Component

**Source**: `src/plugins/commuter-requests/components/RequestsMap.vue`
**Target**: `src/plugins/interactive-dashboard/components/DashboardMap.vue`

**Extraction Strategy**:
```
RequestsMap.vue (943 lines)
├── Deck.gl setup (100 lines)           → Reuse: same initialization
├── Layer creation (600 lines)          → Extract: separate layer classes
│   ├── ScatterplotLayer (requests)    → layers/PointLayer.ts
│   ├── PolygonLayer (clusters)        → layers/PolygonLayer.ts
│   ├── ArcLayer (flows)               → layers/LineLayer.ts (arc mode)
│   └── ScatterplotLayer (arrow tips)  → layers/PointLayer.ts (arrows)
├── Hover handling (100 lines) ✅ NEW  → Generalize: multi-feature hover
│   ├── hoveredClusterIds: Set         → hoveredFeatureIds: Set
│   ├── pickMultipleObjects            → Generic stacked feature detection
│   └── hoveredFlowClusterPair         → hoveredFeaturePair
├── Click handling (50 lines)          → Generalize: emit feature-clicked
├── Rendering order (40 lines) ✅ NEW  → Extract: configurable sort function
└── Update triggers (53 lines)         → Adapt: generic dependencies
```

**Reuse Level**: ~40% direct reuse, 60% adaptation

**Critical New Patterns to Preserve**:
- **Multi-feature hover** with `pickMultipleObjects` for stacked geometries
- **Rendering order** based on interaction state (normal < hovered < selected)
- **Flow-cluster pair tracking** for complex linkages

### 3. Table Component

**Source**: `src/plugins/commuter-requests/components/RequestTable.vue`
**Target**: `src/plugins/interactive-dashboard/components/DashboardTable.vue`

**Extraction Strategy**:
```
RequestTable.vue (583 lines)
├── Column generation (100 lines)       → Reuse: already generic!
├── Formatting (150 lines)              → Reuse: already generic!
├── Sorting (80 lines)                  → Reuse: already generic!
├── Export (50 lines)                   → Reuse: already generic!
├── Hover highlighting (50 lines)       → Reuse: already generic!
├── Filter highlighting (50 lines)      → Reuse: already generic!
└── YAML config (100 lines)             → Adapt: make idColumn prop
```

**Reuse Level**: ~90% direct reuse, 10% adaptation (make `idColumn` configurable)

**Why This Is Already Generic**: The table component auto-generates columns from data and uses YAML config extensively - minimal changes needed!

### 4. Stats Components

**Source**: `src/plugins/commuter-requests/components/stats/*.vue`
**Target**: `src/plugins/interactive-dashboard/components/stats/*.vue`

**Extraction Strategy**:
```
ActiveTimeHistogramPlotly.vue (~250 lines)
├── Plotly setup (100 lines)           → Adapt: make column/binSize props
├── Multi-select logic (50 lines)      → Reuse: pattern already generic!
├── Comparison mode (50 lines)         → Keep as optional feature
└── Click handling (50 lines)          → Reuse: emit 'filter-changed'

Target: HistogramStat.vue (column, binSize, binType as props)

MainModePieChartPlotly.vue (~250 lines)
├── Plotly setup (100 lines)           → Adapt: make column prop
├── Multi-select logic (50 lines)      → Reuse: pattern already generic!
├── Comparison mode (50 lines)         → Keep as optional feature
└── Click handling (50 lines)          → Reuse: emit 'filter-changed'

Target: PieChartStat.vue (column as prop)
```

**Reuse Level**: ~70% direct reuse, 30% adaptation

**Pattern to Preserve**: OR-logic multi-select with toggle behavior (already perfect!)

### 5. Utility Functions

**Source**: `src/plugins/commuter-requests/utils/*.ts`
**Target**: `src/plugins/interactive-dashboard/utils/*.ts` + Managers

**Extraction Strategy**:
```
filters.ts (111 lines)
├── filterRequests function            → Replace: FilterManager.applyFilters()
├── Individual filter functions        → Replace: FilterManager.evaluateFilter()
└── Filter combination (AND logic)     → Replace: FilterManager combines filters

Target: FilterManager class with generic filter evaluation

dataLoader.ts (121 lines)
├── CSV loading                        → Extract: DataLoader.loadCSV()
├── GeoJSON loading                    → Extract: DataLoader.loadGeoJSON()
├── Error handling                     → Extract: DataLoader.handleError()
└── Type definitions                   → Adapt: generic types

Target: DataLoader class (keep mostly as-is, remove domain types)

colorSchemes.ts (92 lines)
├── Color mappings                     → Extract: ColorMapper class
└── Mode-specific colors               → Config: YAML-driven color schemes

Target: ColorMapper class with configurable schemes
```

**Reuse Level**: ~50% direct reuse, 50% replacement with managers

---

## Code Reuse vs Rewrite

### High Reuse (>80% direct copy)

1. **RequestTable.vue** → DashboardTable.vue
   - Already ~90% generic
   - Only need to make `idColumn` configurable
   - Keep all formatting, sorting, export logic

2. **ColorLegend.vue** → Keep as-is
   - Fully generic component
   - No domain-specific logic

3. **Control Components** → Reuse
   - ComparisonToggle.vue (keep)
   - FilterResetButton.vue (keep)
   - ScrollToggle.vue (keep)
   - ColorBySelector.vue (adapt: YAML colors)

### Medium Reuse (50-80% adaptation)

1. **Stats Components**
   - Multi-select pattern is perfect
   - Just need to make columns configurable
   - Preserve OR-logic toggle behavior

2. **Map Hover/Click Handlers** ✅ NEW
   - Recent improvements are excellent patterns
   - Generalize for any feature type
   - Preserve stacked geometry handling

### Low Reuse (<50% - mostly rewrite)

1. **Main Component State**
   - Replace domain-specific Sets with FilterManager
   - Replace manual filter logic with manager methods
   - Add internal layout system

2. **Filter Logic**
   - Replace hardcoded filters with generic system
   - Implement OR/AND logic in FilterManager
   - Support dynamic filter definitions

---

## Data Flow Architecture

### Current (Commuter Requests)

```
CommuterRequests.vue (Orchestrator)
├─> Data Loading
│   ├─> requests.csv → allRequests: Request[]
│   ├─> cluster_geometries.geojson → clusterBoundaries
│   └─> requests_geometries.geojson → requestGeometries
│
├─> State (Manual Sets)
│   ├─> selectedClusters: Set<string|number>
│   ├─> selectedTimebins: Set<string>
│   ├─> selectedModes: Set<string>
│   ├─> selectedRequestIds: Set<string>
│   └─> hoveredRequestId: string | null
│
├─> Filter Logic (Manual)
│   ├─> filterRequests(allRequests, filters) → filteredRequests
│   └─> AND logic between filter types
│
└─> Components (Props + Events)
    ├─> RequestTable (filteredRequests) → @row-hovered
    ├─> RequestsMap (filteredRequests, geometries) → @cluster-clicked
    └─> Stats (filteredRequests) → @filter-changed
```

### Target (Interactive Dashboard)

```
InteractiveDashboard.vue (Orchestrator)
├─> Data Loading (DataLoader)
│   ├─> table.dataset → tableData: DataRow[]
│   ├─> map.layers[].file → layerGeometries: GeoJSON[]
│   └─> Automatic based on YAML config
│
├─> State (Managers)
│   ├─> FilterManager
│   │   ├─> filters: Map<id, FilterDefinition>
│   │   ├─> applyFilters(data) → filteredData
│   │   └─> hasFilters() → boolean
│   │
│   └─> LinkageManager
│       ├─> linkages: Map<layerName, LinkageConfig>
│       ├─> getLinkedFeatures(column, value) → features[]
│       ├─> hoveredFeatureIds: Set<any>
│       └─> hoveredFeaturePair: {source, target} | null ✅ NEW
│
├─> Internal Layout System
│   ├─> Parse layout config → rows[]
│   ├─> Render row containers with flex
│   └─> Place components based on layout
│
└─> Generic Components (Props + Events)
    ├─> DashboardTable (filteredData, idColumn) → @row-hovered
    ├─> DashboardMap (filteredData, layerConfigs, linkages) → @feature-clicked
    └─> Stats (filteredData, statConfig) → @filter-changed
```

**Key Differences**:
1. **Managers encapsulate state** - no manual Sets in main component
2. **YAML-driven everything** - no hardcoded logic
3. **Internal layout system** - configurable component arrangement
4. **Generic events** - `feature-clicked` instead of `cluster-clicked`
5. **Enhanced hover tracking** - supports multi-feature and pairs ✅ NEW

---

## Testing Strategy

### Unit Testing

**Manager Classes**:
```typescript
// FilterManager.spec.ts
describe('FilterManager', () => {
  it('should apply OR logic within filter group')
  it('should apply AND logic between filter groups')
  it('should handle empty filters')
  it('should clear all filters')
})

// LinkageManager.spec.ts
describe('LinkageManager', () => {
  it('should register multiple layers per column')
  it('should return features from all linked layers')
  it('should handle hover state for stacked features') ✅ NEW
  it('should track feature pairs for flow linkages') ✅ NEW
})
```

**Utility Classes**:
```typescript
// DataLoader.spec.ts
// ColorMapper.spec.ts
```

### Component Testing

**Isolated Component Tests**:
```vue
// DashboardTable.spec.ts
- Test with various CSV structures
- Test column auto-generation
- Test sorting, filtering, export
- Test hover/selection highlighting

// DashboardMap.spec.ts
- Test layer rendering
- Test multi-feature hover detection ✅ NEW
- Test rendering order ✅ NEW
- Test feature-clicked events
- Test linkage highlighting

// HistogramStat.spec.ts
- Test multi-select toggle
- Test OR logic
- Test with different column types
```

### Integration Testing

**Full Plugin Tests**:
```typescript
// Test 1: Commuter Requests (existing domain)
- Load commuter-requests YAML config
- Verify all features work identically to original
- Compare filtered results with original plugin

// Test 2: Clusters (new testing domain)
- Load clusters YAML config
- Test multi-geometry linkage
- Test layer visibility controls
- Verify stacked cluster handling ✅ NEW

// Test 3: Minimal (table only)
- Load minimal YAML config
- Verify graceful handling of missing components
```

### Side-by-Side Validation

**Comparison Test Suite**:
```bash
# Run both plugins with same data
npm run test:comparison

# Tests:
1. Load same CSV/GeoJSON in both plugins
2. Apply identical filters
3. Hover same features
4. Click same features
5. Compare filtered results
6. Compare visual output (screenshot diffs)
```

### Visual Regression Testing

**Automated Screenshots**:
- Capture screenshots of key interaction states
- Compare with baseline from commuter-requests
- Flag visual differences for review

---

## Migration Path

### Option 1: Parallel Deployment (Recommended)

**Timeline**: Immediate after generic plugin is stable

```
Status: Both plugins coexist
├─> commuter-requests (unchanged)
│   └─> Existing YAML: viz-commuter-requests.yaml
│
└─> interactive-dashboard (new)
    └─> New YAML: viz-interactive-*.yaml
```

**Benefits**:
- Zero disruption to existing users
- Can test generic plugin in production
- Easy rollback if issues found

### Option 2: Gradual Migration

**Timeline**: After 3-6 months of stable operation

```
Phase 1: Introduce generic plugin alongside old
Phase 2: Migrate new dashboards to generic
Phase 3: Migrate existing dashboards (optional)
Phase 4: Deprecate old plugin (optional)
```

### Option 3: Under-the-Hood Refactor

**Timeline**: Advanced optimization (6-12 months)

```
Strategy: commuter-requests becomes a thin wrapper

CommuterRequests.vue (100 lines)
├─> Import InteractiveDashboard.vue
├─> Generate YAML config from hardcoded values
└─> Pass to generic plugin

Benefits:
- Maintains backward compatibility
- Single codebase to maintain
- commuter-requests YAML still works
```

---

## Risk Mitigation

### Risk 1: Performance Degradation

**Concern**: Generic code might be slower than specialized code

**Mitigation**:
- Benchmark both plugins with same data
- Profile hot paths (filtering, rendering)
- Optimize generic managers if needed
- Use same libraries (deck.gl, Plotly)

**Acceptance Criteria**: <5% performance difference

### Risk 2: Feature Loss

**Concern**: Lose functionality during generalization

**Mitigation**:
- Comprehensive test coverage
- Side-by-side validation
- User acceptance testing
- Feature parity checklist

**Acceptance Criteria**: 100% feature parity with commuter-requests

### Risk 3: Complexity Increase

**Concern**: Generic plugin is harder to maintain

**Mitigation**:
- Excellent documentation
- Clear separation of concerns
- Manager classes encapsulate complexity
- YAML examples for common patterns

**Acceptance Criteria**: New dashboards can be created with <1 hour YAML configuration

### Risk 4: Recent Improvements Not Preserved

**Concern**: Lose new multi-cluster and hover features ✅ NEW

**Mitigation**:
- Explicitly test stacked geometry handling
- Preserve Set-based hover tracking
- Maintain rendering order logic
- Document flow-cluster pair pattern

**Acceptance Criteria**: Overlapping geometries work identically to commuter-requests

---

## Success Criteria

### Must Have (Launch Blockers)

1. ✅ **Feature parity** with commuter-requests
2. ✅ **Multi-cluster selection** for overlapping geometries
3. ✅ **Performance** within 5% of commuter-requests
4. ✅ **Two working examples**: commuter-requests domain + clusters domain
5. ✅ **Documentation**: YAML reference + examples
6. ✅ **No breaking changes** to existing plugins

### Should Have (Post-Launch)

1. ✅ **Three stat types**: histogram, pie, bar
2. ✅ **Three layer types**: point, polygon, line
3. ✅ **Layer visibility controls**
4. ✅ **Comparison mode**
5. ✅ **Export functionality**

### Nice to Have (Future Enhancements)

1. ⏳ **Subtabs** within interactive dashboard
2. ⏳ **Custom color schemes** via YAML
3. ⏳ **More stat types** (scatter, time series)
4. ⏳ **More layer types** (heatmap, contour)
5. ⏳ **Advanced filters** (ranges, regex)

---

## Next Steps

1. **Review this plan** with team
2. **Proceed to detailed task list** (IMPLEMENTATION_TASKS.md)
3. **Begin Phase 1**: Core Infrastructure (FilterManager, LinkageManager)
4. **Iterate** based on learnings

---

**Document End** - See IMPLEMENTATION_TASKS.md for detailed coding instructions
