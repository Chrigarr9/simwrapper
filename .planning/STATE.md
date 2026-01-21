# Project State: SimWrapper Interactive Dashboard Enhancements

**Initialized:** 2026-01-20
**Last Updated:** 2026-01-21 (Phase 3 Complete - Correlation Analysis)

---

## Project Reference

**Core Value:** One styling configuration controls all visualizations

**Current Focus:** Phase 3 COMPLETE - Correlation Analysis (all 4 plans done)

**Key Files:**
- PROJECT.md - Project definition and constraints
- REQUIREMENTS.md - v1 and v2 requirements with traceability
- ROADMAP.md - Phase structure and success criteria
- research/SUMMARY.md - Technical research synthesis

---

## Current Position

**Phase:** 3.1 of 9 (Comparison Mode)
**Plan:** 3/4 complete
**Status:** In progress
**Last activity:** 2026-01-21 - Completed 03.1-03-PLAN.md (PieChartCard comparison mode)

**Progress:**
```
Phase 1:   Theming Foundation       [####] 100% (4/4 plans) COMPLETE
Phase 1.1: Adaptive Layer Coloring  [###] 100% (3/3 plans) COMPLETE
Phase 2:   Sub-Dashboard Fix        [#--] 50% (partial - issues discovered)
Phase 2.1: DashboardCard Component  [####] 100% (4/4 plans) COMPLETE
Phase 3:   Correlation Analysis     [####] 100% (4/4 plans) COMPLETE
Phase 3.1: Comparison Mode          [### ] 75% (3/4 plans) IN PROGRESS
Phase 4:   Dual Maps                [    ] 0%
Phase 5:   Timeline                 [    ] 0%
Phase 6:   Graph Visualization      [    ] 0%
```

**Overall:** Phase 3.1 in progress. Comparison mode foundation, HistogramCard, and PieChartCard complete. PieChartCard shows concentric donut with semi-transparent baseline outer ring. Next: ScatterCard overlay and DataTableCard count display (Plan 03.1-04).

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 19 |
| Quick tasks completed | 2 |
| Plans requiring revision | 0 |
| Requirements completed | 16/25 (THEME-01-03, ALYR-01-04, SUBD-01, CARD-01-05, CORR-01-02, COMP-01) |
| Research phases triggered | 1 (Phase 3 research) |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| 6 phases derived from requirements | Natural grouping by feature area with dependency ordering | 2026-01-20 |
| Theming foundation first | All other features depend on consistent color handling | 2026-01-20 |
| Sub-dashboard as Phase 2 | Quick win that enables testing other features in sub-dashboards | 2026-01-20 |
| Graph visualization last | Requires new dependency (vue-cytoscape), highest complexity | 2026-01-20 |
| Singleton pattern for StyleManager | Ensures single source of truth for theme state | 2026-01-20 |
| CSS variables with --dashboard- prefix | Namespaces variables to avoid conflicts with app-level styles | 2026-01-20 |
| Interaction colors constant across modes | Per CONTEXT.md - hover/selected remain same in light/dark | 2026-01-20 |
| CSS variables with fallback chains | var(--dashboard-X, var(--app-X, #fallback)) for graceful degradation | 2026-01-20 |
| Keep domain-specific colors static | Transport mode colors are semantic, not theme-dependent | 2026-01-20 |
| White border for selected pie slices | Provides contrast against category colors regardless of theme | 2026-01-20 |
| ScatterCard uses interaction.hover/selected | Consistent highlighting/selection behavior with MapCard | 2026-01-20 |
| D3 categorical palette as domain-specific | Category colors not theme-dependent, documented in code | 2026-01-20 |
| Hardcoded rgba() for row state backgrounds | CSS color-mix not widely supported; hex values match StyleManager | 2026-01-20 |
| Case-insensitive geoProperty matching | Normalizes to lowercase for robust layer grouping | 2026-01-20 |
| Standalone group naming with __standalone_ prefix | Ensures unique grouping for layers without linkage | 2026-01-20 |
| Functional + OOP API for LayerColoringManager | Functional primary, class wrapper for stateful caching | 2026-01-20 |
| Remove colorBy from getCardLayers() | MapCard now handles colorBy based on computed roles | 2026-01-20 |
| Neutral layers use theme.border.default | StyleManager provides theme-aware neutral color | 2026-01-20 |
| getFeatureId() helper for compound IDs | Constructs 'type_id' format (e.g., 'od_0') for data join between GeoJSON and CSV | 2026-01-20 |
| fillOpacity: 0 for outline-only polygons | deck.gl LineLayer expects LineString, not Polygon; use fill with zero opacity for outlines | 2026-01-20 |
| StyleManager CSS vars in tooltip styling | Use var(--dashboard-interaction-selected) instead of hardcoded colors | 2026-01-20 |
| Portal wraps entire card frame | Header with enlarge/restore button must remain accessible in fullscreen | 2026-01-20 |
| Portal always rendered, conditionally active | Avoids duplicating template code; active only when embedded && fullScreenCardId matches | 2026-01-20 |
| z-index 10000 for fullscreen portal | Higher than DataTableCard's 9999 for proper stacking | 2026-01-20 |
| Dual Escape key handling | Both portal and dashboard handle Escape for redundancy | 2026-01-20 |
| Info toggle managed locally by DashboardCard | Encapsulates UI-only state, simplifies InteractiveDashboard | 2026-01-21 |
| Fullscreen toggle emitted to parent | DashboardCard emits event, parent maintains single source of truth | 2026-01-21 |
| anotherCardFullscreen prop vs fullscreenCardId | Boolean simpler than string comparison, already implemented in 02.1-01 | 2026-01-21 |
| DashboardCard handles card styling | getCardStyle() moved from InteractiveDashboard to DashboardCard.cardStyle computed | 2026-01-21 |
| Single-element DashboardCard | Simplified from placeholder/frame wrapper to single .dashboard-card element | 2026-01-21 |
| CSS-only fullscreen | .is-fullscreen class sets position:fixed to overlay viewport, no DOM restructuring | 2026-01-21 |
| Single card rendering path | All cards use LinkableCardWrapper - handles no-linkage gracefully by passing unfiltered data | 2026-01-21 |
| Dashboard unification goal | InteractiveDashboard should be superset of standard Dashboard - work with or without table config | 2026-01-21 |
| Optional dataTableManager prop | LinkableCardWrapper accepts null dataTableManager; returns empty filteredData | 2026-01-21 |
| simple-statistics for correlation | Lightweight (~3KB), zero dependencies, numerically stable sampleCorrelation() API | 2026-01-21 |
| Clamp |r| to 0.9999 before p-value | Prevents division by zero in t-statistic when r near ±1; statistically acceptable | 2026-01-21 |
| Two-tailed p-value for correlation | Standard practice for H0: ρ=0 vs H1: ρ≠0; p = 2 * (1 - CDF(\|t\|, df)) | 2026-01-21 |
| Custom t-distribution CDF approximation | Avoids mathjs import; normal approximation for df≥30, simplified beta for df<30 | 2026-01-21 |
| Blue-white-red diverging colorscale for correlation | Standard for correlation heatmaps; blue=negative, red=positive, white=zero; colorblind-safe | 2026-01-21 |
| Significance threshold configurable via prop | pValueThreshold prop (default 0.05) allows YAML override; asterisk marks significant correlations | 2026-01-21 |
| Auto mode for correlation cell text | Show values if ≤20 attributes (readable), hide if >20 (avoids clutter); manual override available | 2026-01-21 |
| Text color adaptation in correlation heatmap | White text on dark cells (|r| > 0.5), black on light cells for readability | 2026-01-21 |
| Debounced correlation calculation | 200ms debounce for filteredData changes avoids excessive recalculation during rapid filtering | 2026-01-21 |
| Optional onAttributePairSelected in LinkageObserver | Not all observers need attribute pair events - only ScatterCard when enabled | 2026-01-21 |
| Dynamic axis state in ScatterCard | currentXColumn/currentYColumn refs allow prop overrides without mutation | 2026-01-21 |
| ComparisonToggle disabled state enforcement | effectiveShowComparison = showComparison AND hasActiveFilters prevents confusing UI where baseline equals filtered data | 2026-01-21 |
| baselineData as computed property | Single source for unfiltered data; computed ensures reactivity when dataTableManager data changes | 2026-01-21 |
| Slot prop auto-propagation | LinkableCardWrapper exposes new props via slot; child cards receive them automatically without InteractiveDashboard template changes | 2026-01-21 |
| Concentric pie domain constraints | Inner trace [0.15, 0.85] constrained, outer [0, 1] full - creates visual separation for comparison | 2026-01-21 |
| Trace-specific click handling in pie | curveNumber check prevents baseline trace interaction; only inner filtered pie responds to clicks | 2026-01-21 |

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1: Adaptive Layer Coloring (URGENT) - 2026-01-20
  - Reason: Cluster visualization issues - colorBy not affecting clusters/arcs, need intelligent layer coloring based on visibility

- Phase 2.1 inserted after Phase 2: DashboardCard Component Architecture (URGENT) - 2026-01-21
  - Reason: Phase 2 execution revealed fundamental architectural issues:
    - Duplicate fullscreen buttons (DataTableCard had its own)
    - Scatter plots scaling incorrectly after fullscreen toggle
    - Buttons disappearing in certain state transitions
    - Card frame/header/buttons logic scattered across InteractiveDashboard.vue and individual cards
  - Solution: Create unified DashboardCard wrapper component using composition pattern
  - This enables: consistent behavior, single source of truth, future card reordering feature

- Phase 3.1 inserted after Phase 3: Comparison Mode (URGENT) - 2026-01-21
  - Reason: Filtering currently reduces charts to single data points (e.g., one histogram bar); need to show filtered subset against baseline for context
  - Reference: Pattern already implemented in commuter-requests plugin (ComparisonToggle, overlay bars, concentric pies)
  - Requirements: COMP-01 to COMP-06 (6 new requirements)

### TODOs

- [x] Plan Phase 1: Theming Foundation
- [x] Execute Plan 01-01: Create StyleManager core
- [x] Execute Plan 01-02: Migrate MapCard/ColorLegend/InteractiveDashboard
- [x] Execute Plan 01-03: Migrate chart cards (Pie, Histogram, Scatter)
- [x] Execute Plan 01-04: Verification and cleanup
- [x] Plan Phase 1.1: Adaptive Layer Coloring
- [x] Execute Plan 01.1-01: Create LayerColoringManager
- [x] Execute Plan 01.1-02: Integrate into MapCard
- [x] Execute Plan 01.1-03: Verification and edge case handling
- [x] Plan Phase 2: Sub-Dashboard Fix
- [x] Execute Plan 02-01: FullscreenPortal implementation (partial - issues found)
- [x] Plan Phase 2.1: DashboardCard Component Architecture
- [x] Execute Plan 02.1-01: Create DashboardCard component (COMPLETE)
- [x] Execute Plan 02.1-02: Add fullscreen/resize management (COMPLETE)
- [x] Execute Plan 02.1-03: Integrate DashboardCard into InteractiveDashboard (COMPLETE)
- [x] Execute Plan 02.1-04: Verify behavior (COMPLETE)
- [x] Plan Phase 3: Correlation Analysis
- [x] Research Phase 3 before planning (Web Worker architecture)
- [x] Execute Plan 03-01: Statistics utility module (COMPLETE)
- [x] Execute Plan 03-02: CorrelationMatrixCard component (COMPLETE)
- [x] Execute Plan 03-03: Attribute pair event system (COMPLETE)
- [x] Execute Plan 03-04: Integration and verification (COMPLETE)
- [ ] Research Phase 4 before planning (deck.gl multi-view tradeoffs)
- [ ] Research Phase 6 before planning (vue-cytoscape integration)

### Blockers

None currently.

### Architectural Vision

**Goal:** InteractiveDashboard replaces standard Dashboard as a superset.

Current state (after Quick Task 002):
- Standard Dashboard (`DashBoard.vue`) renders cards inline without DashboardCard component
- InteractiveDashboard NOW works with or without `yaml.table` config (Quick Task 002)
- Two separate dashboard components with duplicated logic

Target state:
- Single InteractiveDashboard component handles all dashboards
- Works with or without `table` config (no linkage = standard dashboard behavior) [DONE]
- Managers initialize unconditionally, handle empty state gracefully [DONE]
- Eventually deprecate/remove DashBoard.vue [TODO: routing change needed]

Requirements: UNIF-01 to UNIF-04 (v2)

### Lessons Learned

1. **CSS variable fallback chains work well**: The pattern `var(--dashboard-X, var(--app-X, #fallback))` provides graceful degradation.
2. **rgba() limitations**: CSS custom properties can't be used directly in rgba() without color-mix(), so we use hardcoded values matching StyleManager definitions.
3. **Vuex watch for theme changes**: StyleManager subscribes to `globalStore.state.colorScheme` for automatic theme updates.
4. **Case-insensitive matching for configs**: GeoJSON properties may have inconsistent casing; normalize for comparison.
5. **Role-aware coloring pattern**: Check role at start of getBaseColor(), neutral layers exit early with theme border color.
6. **Compound ID construction for data joins**: GeoJSON features may need ID prefixing (e.g., cluster_type + '_' + cluster_id) to match CSV unique_id column.
7. **deck.gl LineLayer vs PolygonLayer**: LineLayer uses getSourcePosition/getTargetPosition expecting LineString; for polygon outlines, use PolygonLayer with fillOpacity: 0.
8. **getFeatureFillColor must call getBaseColor**: Without this delegation, fill layers don't receive colorBy coloring.
9. **isLayerVisible must filter by geometryType**: Geometry type selector only works if visibility function considers layerConfig.geometryType.
10. **Portal pattern for CSS containment escape**: Use DOM teleportation to document.body to bypass parent `contain: layout` that blocks position:fixed.
11. **display:contents for layout-neutral wrappers**: Components that wrap content without affecting layout should use `display: contents`.
12. **Local state for UI-only concerns**: Info toggle in DashboardCard is UI-only, no need to emit to parent; reduces coupling.
13. **Window resize for Plotly charts**: When exiting fullscreen, dispatch `window.dispatchEvent(new Event('resize'))` so Plotly charts (ScatterCard, HistogramCard) resize correctly.
14. **ResizeObserver with nextTick debounce**: Wrap emitResize in nextTick to avoid excessive resize events during rapid container changes.
15. **Composition pattern for card wrapper**: DashboardCard receives content via slot, avoiding inheritance; cards don't need to extend a base class.
16. **LinkableCardWrapper handles no-linkage**: Wrapper passes through all data when no filters active; non-interactive cards simply ignore the props they don't use.
17. **Optional props with null handling**: When a manager prop is optional (dataTableManager), the wrapper returns sensible defaults (empty array) rather than crashing. This enables graceful degradation.
18. **Clamping prevents numerical instability in correlation**: When r is near ±1, clamping to 0.9999 prevents division by zero in t-statistic without affecting statistical interpretation.
19. **Two-tailed tests are standard for correlation**: Always use 2 × (1 - CDF) for p-value calculation in Pearson correlation, not one-tailed.
20. **Missing data filtration essential**: Filtering null/undefined/NaN before correlation calculation prevents cascading NaN results and provides transparency via sample size reporting.
21. **Optional interface methods for extensibility**: Adding optional methods to existing interfaces (onAttributePairSelected?) maintains backwards compatibility while enabling new features.

---

## Quick Tasks Completed

| ID | Name | Date | Impact |
|----|------|------|--------|
| 001 | Remove legacy components and consolidate rendering | 2026-01-21 | ~987 lines removed |
| 002 | Dashboard unification - InteractiveDashboard without table config | 2026-01-21 | Standard mode enabled |

---

## Session Continuity

### For Next Session

**Where we left off:** Phase 3.1 Plan 03 complete - PieChartCard comparison mode.

**Next action:** Check if Plan 03.1-04 (ScatterCard + DataTableCard) is already complete (git log shows commits), if not, execute it.

**Phase progress:** Phase 3.1 in progress (2/4 plans complete).

**Plan 03-01 Completed (2026-01-21):**

Statistics utility module with correlation calculation:
- Installed simple-statistics v7.8.8 for Pearson correlation
- Created correlationWithPValue() with two-tailed p-values
- Created computeCorrelationMatrix() for full n×n matrices
- Handles missing data (null/undefined/NaN) gracefully
- Clamps |r| to 0.9999 for numerical stability
- 20 comprehensive unit tests (all passing)
- Files: statistics.ts (246 lines), statistics.test.ts (324 lines)

**Plan 03-02 Completed (2026-01-21):**

CorrelationMatrixCard component with Plotly heatmap:
- Interactive correlation matrix heatmap with diverging blue-white-red colorscale
- Hover tooltips show r value, p-value, and sample size
- Significant correlations (p < 0.05) marked with asterisk when cell text visible
- Auto mode hides cell text if >20 attributes (configurable via showValues prop)
- White text on dark cells (|r| > 0.5), black on light cells for readability
- Debounced calculation (200ms) for filteredData changes
- Cell click emits attributePairSelected event for scatter plot coordination
- Resize handling with ResizeObserver and window resize listener
- File: CorrelationMatrixCard.vue (329 lines)

**Quick Task 002 Completed (2026-01-21):**

Dashboard unification - standard mode enabled:
- InteractiveDashboard renders cards without `yaml.table` config
- FilterManager/LinkageManager always initialized
- DataTableManager only created when table config exists
- LinkableCardWrapper handles null dataTableManager gracefully
- Cards receive empty filteredData in standard mode

**Quick Task 001 Completed (2026-01-21):**

Legacy component removal and template consolidation:
- Deleted FullscreenPortal.vue (superseded by CSS-only fullscreen)
- Deleted LinkedTableCard.vue and LinkedTableManager.ts (unused feature)
- Consolidated dual card rendering paths into single unified path
- All cards now use LinkableCardWrapper (handles no-linkage gracefully)
- ~987 lines of dead code removed

**Phase 2.1 Completed (2026-01-21):**

DashboardCard component architecture:
- Single `.dashboard-card` element with CSS-only fullscreen (position:fixed)
- Handles frame, header, buttons, resize events
- Content components render only their visualization
- Works identically in main dashboard and sub-dashboards
- Verified on ScatterCard, HistogramCard, MapCard, DataTableCard

### Recovery Commands

If context is lost:
```
Read .planning/STATE.md for current position
Read .planning/ROADMAP.md for phase structure
Read .planning/REQUIREMENTS.md for requirement details
Read .planning/phases/02.1-dashboard-card-component/02.1-04-SUMMARY.md for verification summary
Read .planning/phases/03-correlation-analysis/03-01-SUMMARY.md for statistics module details
Read .planning/phases/03-correlation-analysis/03-02-SUMMARY.md for CorrelationMatrixCard component details
```

---

*State updated: 2026-01-21 (Plan 03-02 complete - CorrelationMatrixCard component)*

**Plan 03-03 Completed (2026-01-21):**

Attribute pair event system for correlation matrix → scatter integration:
- Extended LinkageManager with optional onAttributePairSelected handler
- Added setSelectedAttributePair(), getSelectedAttributePair(), clearAttributePairSelection() methods
- ScatterCard accepts listenToAttributePairSelection and linkageManager props
- Dynamic axis state (currentXColumn/currentYColumn) allows runtime overrides
- Validates attribute names before updating axes
- Observer pattern maintains backwards compatibility
*State updated: 2026-01-21 (Plan 03-03 complete - attribute pair event system)*

**Plan 03-04 Completed (2026-01-21):**

Integration and verification of correlation analysis feature:
- Registered correlation-matrix card type in `_allPanels.ts`
- Wired event handler in InteractiveDashboard for attribute pair selection
- Added comprehensive documentation to README.md
- Fixed Vue 2 event naming (camelCase → kebab-case)
- Fixed Plotly shape layering (below → above for visibility)
- Verified: heatmap rendering, tooltips, cell click → scatter linkage, hover row/column highlighting

*State updated: 2026-01-21 (Phase 3 complete - Correlation Analysis)*

**Plan 03.1-01 Completed (2026-01-21):**

Comparison mode foundation:
- Created ComparisonToggle component (Vue 3 Composition API, disabled state when no filters)
- Updated LinkableCardWrapper to pass baselineData (computed from unfiltered dataTableManager)
- Added showComparison state to InteractiveDashboard with effectiveShowComparison computed
- ComparisonToggle rendered in table controls (only when yaml.table exists)
- Inline table comparison count display (X / Y format)
- All props flow automatically to child cards via slot mechanism
- Files: ComparisonToggle.vue (created), LinkableCardWrapper.vue, InteractiveDashboard.vue

*State updated: 2026-01-21 (Plan 03.1-01 complete - Comparison mode foundation)*

**Plan 03.1-03 Completed (2026-01-21):**

PieChartCard comparison mode with concentric donut visualization:
- Added baselineData and showComparison props to PieChartCard
- Implemented baselinePieData computed property for baseline aggregation
- Concentric donut rendering: inner ring (filtered, hole 0.4) + outer ring (baseline, hole 0.7)
- Baseline ring has 50% transparency (hex suffix '80')
- Inner domain [0.15, 0.85], outer domain [0, 1] for visual separation
- Center annotation shows "X of Y" count in comparison mode
- Click handler checks curveNumber !== 0 to ignore baseline trace clicks
- File: PieChartCard.vue (81 lines changed)

*State updated: 2026-01-21 (Plan 03.1-03 complete - PieChartCard comparison mode)*

**Plan 03.1-02 Completed (2026-01-21):**

HistogramCard comparison mode with overlay bars:
- Added baselineData and showComparison props to HistogramCard interface
- Implemented baselineHistogramData computed property (same binning logic as histogramData)
- Updated renderChart() for dual-trace rendering (baseline + filtered)
- Baseline bars in gray (rgba 156, 163, 175, 0.3) behind filtered bars
- barmode: 'overlay' for layered rendering, legend visible only when comparison active
- Click handler updated to ignore baseline trace clicks (curveNumber check)
- When comparison mode active, users see filtered histogram overlaid on baseline
- File: HistogramCard.vue (modified)
- Commit: c64c0b3a

*State updated: 2026-01-21 (Plan 03.1-02 complete - HistogramCard comparison mode)*
