---
phase: quick-009
plan: 01
subsystem: ui
tags: [performance, virtual-scroll, column-index, debounce, vue-watchers, plotly]

# Dependency graph
requires:
  - phase: 03.1-comparison-mode
    provides: FilterManager, LinkableCardWrapper, card watcher patterns
provides:
  - Column-indexed FilterManager with O(1) categorical lookups
  - Centralized cached filter results (getFilteredData/getFilteredIds)
  - Debounced HistogramCard with initializeChart/updateChart pattern
  - Shallow watchers on all reactive data props across all cards
  - Virtual scrolling DataTableCard with windowed row rendering
affects: [any future card implementation, future filter enhancements, future data table features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Column indexing for O(1) categorical filter lookup"
    - "Centralized filter cache shared across N card wrappers"
    - "initializeChart/updateChart pattern for Plotly (newPlot once, react for updates)"
    - "Offset-based virtual scrolling with spacer rows"
    - "Shallow watchers with [ref, size] pattern for Set reactivity"

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/managers/FilterManager.ts
    - src/plugins/interactive-dashboard/managers/__tests__/FilterManager.test.ts
    - src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
    - src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
    - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
    - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
    - src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue
    - src/plugins/interactive-dashboard/components/cards/TimelineCard.vue
    - src/plugins/interactive-dashboard/components/cards/MapCard.vue
    - src/plugins/interactive-dashboard/InteractiveDashboard.vue

key-decisions:
  - "Shallow watchers sufficient because LinkableCardWrapper creates new array/Set references on change"
  - "MapCard.layers retains deep:true because config array contents change without reference change"
  - "Column index normalizes values to lowercase strings for case-insensitive matching"
  - "Binned filters fall back to linear scan within indexed path (can't use exact-value maps for ranges)"
  - "ROW_HEIGHT=32px constant shared between JS and CSS for virtual scrolling alignment"
  - "Set watchers use [ref, size] tuple pattern to catch Vue reactivity misses on Set mutations"

patterns-established:
  - "initializeChart/updateChart: Register Plotly event handlers ONCE in initializeChart, use Plotly.react() for updates"
  - "getFilteredData/getFilteredIds: Centralized cache invalidated on filter change, shared by all consumers"
  - "buildIndex: Called once after data loading, enables O(1) categorical lookups in FilterManager"
  - "Virtual scrolling: Spacer rows with computed topPadding/bottomPadding maintain scroll position"

# Metrics
duration: 19min
completed: 2026-02-12
---

# Quick Task 009: Dashboard Performance Optimizations Summary

**Column-indexed FilterManager with centralized cache, debounced Plotly rendering, shallow watchers, and virtual scrolling for 10k+ row datasets**

## Performance

- **Duration:** 19 min
- **Started:** 2026-02-12T11:42:54Z
- **Completed:** 2026-02-12T12:02:07Z
- **Tasks:** 5/5 (Task 5 was verification-only)
- **Files modified:** 11

## Accomplishments

- FilterManager now supports column indexes for O(1) categorical filter lookup (was O(n) per row)
- Filter computation happens exactly ONCE per filter change via centralized getFilteredData/getFilteredIds cache (was N times for N cards)
- HistogramCard uses Plotly.react() with 50ms debounce (was Plotly.newPlot() with no debounce, re-registering click handlers every render)
- All 7 card files switched from deep watchers to shallow reference-only watchers on filteredData/hoveredIds/selectedIds/baselineData
- DataTableCard renders only ~80 visible rows via virtual scrolling (was all 10k+ rows as DOM nodes)
- 15 new FilterManager tests (8 indexing + 7 caching), all 22 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Debounce HistogramCard and shallow watchers on all cards** - `82d76023` (perf)
2. **Task 2: Column indexes for O(1) filter lookup in FilterManager** - `9af34981` (feat)
3. **Task 3: Centralized filtered data (eliminate N-times multiplier)** - `931e5419` (perf)
4. **Task 4: Virtual scrolling for DataTableCard** - `54e1e92b` (perf)
5. **Task 5: Final verification** - No commit (verification-only, all checks passed)

## Files Created/Modified

- `FilterManager.ts` - Added buildIndex(), applyFiltersIndexed(), getFilteredData(), getFilteredIds(), intersectSets()
- `FilterManager.test.ts` - Added 15 tests for column indexing and centralized cache
- `HistogramCard.vue` - Refactored to initializeChart/updateChart pattern with 50ms debounce
- `ScatterCard.vue` - Removed deep:true from filteredData watcher
- `PieChartCard.vue` - Removed deep:true from filteredData and baselineData watchers
- `CorrelationMatrixCard.vue` - Removed deep:true from filteredData watcher
- `TimelineCard.vue` - Removed deep:true from filteredData/hoveredIds/selectedIds/baselineData watchers
- `MapCard.vue` - Removed deep:true from filteredData/hoveredIds/selectedIds watchers (kept on layers)
- `DataTableCard.vue` - Added virtual scrolling, removed deep:true from hoveredIds watcher, use getFilteredIds
- `LinkableCardWrapper.vue` - Uses getFilteredData() instead of applyFilters()
- `InteractiveDashboard.vue` - Calls filterManager.buildIndex() after data loading

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Shallow watchers sufficient for reactive data | LinkableCardWrapper creates new array/Set references on each change |
| MapCard.layers keeps deep:true | Config array whose contents change but reference may not |
| Column index normalizes to lowercase | Case-insensitive matching consistent with existing valuesMatch behavior |
| Binned filters fall back to linear scan | Bin ranges can't be indexed with exact-value maps |
| ROW_HEIGHT=32px constant | Shared between JS computed properties and CSS for virtual scrolling alignment |
| Set watchers use [ref, size] tuple | Vue 2.7 doesn't always track Set mutations; watching size catches all changes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Second deep:true watcher in MapCard at line 2568**
- **Found during:** Task 1 (shallow watchers)
- **Issue:** MapCard had a SECOND combined watcher for [filteredData, hoveredIds, selectedIds] at line 2568 with deep:true, not listed in the plan
- **Fix:** Removed deep:true and added size watchers for Set props
- **Files modified:** MapCard.vue
- **Committed in:** 82d76023 (Task 1 commit)

**2. [Rule 1 - Bug] PieChartCard using console.log instead of debugLog**
- **Found during:** Task 1 (shallow watchers)
- **Issue:** baselineData watcher used console.log instead of debugLog (inconsistent with other cards)
- **Fix:** Changed to debugLog for consistent controlled output
- **Files modified:** PieChartCard.vue
- **Committed in:** 82d76023 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Minor fixes for completeness. No scope creep.

## Issues Encountered

None - plan executed as written with smooth implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 Tier 1 performance optimizations implemented
- Tier 2 optimizations (pre-indexed loose comparison, single-pass min/max, memoize colors) available as future quick tasks
- Tier 3 architectural optimizations (Web Worker, BitSets, deck.gl update triggers) documented in PERFORMANCE_PLAN.md
- Ready for manual testing with large datasets to measure actual performance improvement

---
*Quick Task: 009-dashboard-performance-optimizations*
*Completed: 2026-02-12*
