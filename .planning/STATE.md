# Project State: SimWrapper Interactive Dashboard Enhancements

**Initialized:** 2026-01-20
**Last Updated:** 2026-01-30 (Quick task 007 - Scientific mode polish)

---

## Project Reference

**Core Value:** One styling configuration controls all visualizations

**Current Focus:** Phase 5 - Graph Visualization (upcoming)

**Key Files:**
- PROJECT.md - Project definition and constraints
- REQUIREMENTS.md - v1 and v2 requirements with traceability
- ROADMAP.md - Phase structure and success criteria
- research/SUMMARY.md - Technical research synthesis

---

## Current Position

**Phase:** 4.3 of 10 (Scatter Plot Color-By Selector and Cross-Card Sync) - COMPLETE
**Plan:** 3/3 complete
**Status:** Complete - All card types synchronized with dashboard-level color-by selector
**Last activity:** 2026-02-16 - Completed plan 04.3-03 (PieChartCard color-by, MapCard migration, dashboard legend)

**Progress:**
```
Phase 1:   Theming Foundation       [####] 100% (4/4 plans) COMPLETE
Phase 1.1: Adaptive Layer Coloring  [###] 100% (3/3 plans) COMPLETE
Phase 2:   Sub-Dashboard Fix        [#--] 50% (partial - issues discovered)
Phase 2.1: DashboardCard Component  [####] 100% (4/4 plans) COMPLETE
Phase 3:   Correlation Analysis     [####] 100% (4/4 plans) COMPLETE
Phase 3.1: Comparison Mode          [####] 100% (4/4 plans) COMPLETE
Phase 4:   Timeline                 [####] 100% (4/4 plans) COMPLETE
Phase 4.1: Timeline Refinement      [##] 100% (2/2 plans) COMPLETE
Phase 4.2: Scientific Mode          [#######] 100% (7/7 plans) COMPLETE
Phase 4.3: Scatter Color-By Sync    [###] 100% (3/3 plans) COMPLETE
Phase 5:   Graph Visualization      [    ] 0% <- NEXT
```

**Phase 4.3 Progress:**
- Plan 01 COMPLETE: ColorBySelector component and dashboard-level colorBy state
  - Reusable color-by dropdown extracted from MapCard
  - Dashboard header placement with shared state management
  - Top-level YAML colorBy section with backward compatibility
  - First attribute selected by default
- Plan 02 COMPLETE: ScatterCard and HistogramCard color-by attribute support
  - ScatterCard categorical color-by with multi-trace rendering
  - ScatterCard numeric color-by with Viridis colorscale
  - HistogramCard categorical color-by with stacked bars
  - HistogramCard numeric color-by with average-colored bars
  - Auto-detection of attribute type from data values
- Plan 03 COMPLETE: PieChartCard color-by, MapCard migration, dashboard legend
  - PieChartCard uses colorByAttribute for categorical grouping
  - MapCard per-card dropdown removed (reads from shared state)
  - Dashboard-level ColorLegend with click-to-filter
  - Consistent cross-card colors via StyleManager

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 37 |
| Quick tasks completed | 5 |
| Plans requiring revision | 0 |
| Requirements completed | 28/30 (THEME-01-03, ALYR-01-04, SUBD-01, CARD-01-05, CORR-01-02, COMP-01-06, TIME-01-03, TIME-05-06, SCI-01-05) |
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
| Track end time <= item start allows track reuse | Touching items (one ends when another starts) share tracks for optimal Gantt visualization | 2026-01-22 |
| Zero-duration items don't block subsequent items | An instant event at t=1000 doesn't prevent interval [1000, 2000] from using same track | 2026-01-22 |
| Array-based track search for <10K items | Linear scan sufficient for typical ride counts; simpler than min-heap implementation | 2026-01-22 |
| Constraint trace renders first for z-ordering | Plotly renders traces in order; constraint window (gray) behind actual travel (colored) | 2026-01-22 |
| Degree colors use categorical palette indices 0-2 | Degree 1=index 0, degree 2=index 1, degree 3+=index 2; consistent with other charts | 2026-01-22 |
| Bar widths 0.8/0.5 for nested visual | Constraint window wider (0.8), actual travel narrower (0.5) creates visual nesting effect | 2026-01-22 |
| Time axis ticks every 2 hours | 13 ticks (00:00-24:00) provides readability without clutter | 2026-01-22 |
| Hover dims non-hovered bars to 30% | applyOpacity() helper converts hex to rgba with specified opacity | 2026-01-22 |
| Selection uses 2px border highlight | StyleManager.interaction.selected color for selection feedback | 2026-01-22 |
| Toggle selection for timeline | Click to add, click again to remove - matches HistogramCard pattern | 2026-01-22 |
| import type for TypelineItem | Required by isolatedModules - separates type-only imports from value imports | 2026-01-22 |
| Viewport state in refs synced via plotly_relayout | Bidirectional sync - programmatic zoom updates refs then calls relayout, user pan/zoom triggers plotly_relayout which updates refs | 2026-01-22 |
| Minimap uses staticPlot:true | No user interaction needed on minimap, staticPlot improves performance | 2026-01-22 |
| Single expanded ride at a time | Clicking different ride replaces current expansion - simpler than multi-expand | 2026-01-22 |
| Request mini-Gantt scales to ride constraint window | Provides contextual positioning - request times relative to expanded ride's time window | 2026-01-22 |
| Use Plotly xaxis.p2d() for cursor-centered zoom | Plotly's pixel-to-data method converts mouse position to time coordinate, enabling cursor position to stay fixed during zoom | 2026-01-22 |
| Prevent page scroll with passive:false wheel listener | Setting { passive: false } allows preventDefault() to stop page scroll during timeline zoom | 2026-01-22 |
| Floating overlay for zoom controls in minimap | Consolidates all zoom controls (buttons + viewport indicator) in one visual area; z-index 5 keeps accessible | 2026-01-22 |
| Single-select switches to request detail view | Simpler UX than multi-select - clicking a ride both selects it and shows its requests | 2026-01-22 |
| Request detail view is view-only | No hover/click events emit in request view to prevent confusing cross-card interactions | 2026-01-22 |
| Dynamic x-axis for request view | Request time windows scaled to ride constraint window instead of 24-hour range | 2026-01-22 |
| Back button clears all selection state | Returning to rides view resets to unfiltered state for clean slate | 2026-01-22 |
| Default 1200px width with 2x scale for ~300 DPI publication quality | Standard publication resolution for charts | 2026-01-30 |
| Map export waits for tile loading via idle event | Ensures complete map capture without missing tiles | 2026-01-30 |
| Memory cleanup with URL.revokeObjectURL after blob downloads | Prevents memory leaks from repeated downloads | 2026-01-30 |
| ScientificMode uses pure white background (#ffffff) | Maximum print contrast for publication-ready output | 2026-01-30 |
| Scientific text is pure black (#000000) | Publication readability with maximum contrast | 2026-01-30 |
| Three-way theme cycling: Dark -> Light -> Scientific -> Dark | Consistent UX for toggling between modes | 2026-01-30 |
| Added 'scientific' to BG_COLOR_DASHBOARD/BG_COLOR_PLOTLY_FACETS | Prevents TypeScript errors when indexing by ColorScheme | 2026-01-30 |
| ColorScheme watcher pattern for chart re-rendering | All Plotly cards watch globalStore.state.colorScheme for theme changes | 2026-01-30 |
| Scientific axis styling: black 1.5px lines with showline:true | Crisp print output with consistent axis visibility | 2026-01-30 |
| TimelineCard hides zoom controls in scientific mode | Interactive UI chrome not suitable for publication | 2026-01-30 |
| PieChartCard uses 2px slice outlines in scientific mode | Thicker outlines for print clarity | 2026-01-30 |
| Export dropdown closes on mouse leave | Better UX than requiring explicit close click | 2026-01-30 |
| Map export PNG-only (SVG unavailable for WebGL canvas) | Canvas toDataURL cannot produce SVG from WebGL content | 2026-01-30 |
| Export button visible for 6 chart types | histogram, scatter, pie, correlation-matrix, timeline, map have exportable content | 2026-01-30 |
| Array-style defineEmits for Vue 2.7 | Typed emit syntax causes "not callable" errors in some Vue 2.7 configs; array syntax works | 2026-01-30 |
| Export All button in header between title and favorite | Natural placement for dashboard-level action without cluttering individual cards | 2026-01-30 |
| Hide MapLibre controls in scientific mode | Zoom buttons, compass, attribution not suitable for publication figures | 2026-01-30 |
| data-exportable-map attribute for map export detection | DashboardCard detects maps via attribute, not fragile DOM queries | 2026-01-30 |
| ColorBySelector placed before theme toggle | Visual hierarchy - data control before UI control | 2026-02-16 |
| None option first in color-by dropdown | Research recommendation for better UX - explicit "no coloring" state | 2026-02-16 |
| First attribute selected by default | Users see immediate visualization, not blank "None" state | 2026-02-16 |
| Top-level yaml.colorBy over yaml.map.colorBy | Promotes color-by from map-specific to dashboard-wide feature | 2026-02-16 |
| Fallback chain for backward compatibility | yaml.colorBy → yaml.map.colorBy ensures existing configs work | 2026-02-16 |
| Type detection auto-detects categorical vs numeric | Attribute type determined from actual data values, not YAML config - handles mode IDs correctly | 2026-02-16 |
| Numeric attributes with <15 unique values treated as categorical | Prevents mode IDs (1=car, 2=bike, 3=walk) from being colored as continuous scale | 2026-02-16 |
| ScatterCard categorical color-by uses multi-trace rendering | Separate traces per category with StyleManager colors, proper legend support | 2026-02-16 |
| ScatterCard numeric color-by uses Plotly Viridis colorscale | Continuous colorscale with colorbar showing attribute label and values | 2026-02-16 |
| HistogramCard categorical color-by uses stacked bars | Shows category distribution within each bin, barmode: 'stack' | 2026-02-16 |
| HistogramCard numeric color-by uses average-colored bars | Each bar colored by average value of color-by attribute within that bin | 2026-02-16 |
| Comparison mode baseline stays gray (not split by category) | Baseline trace is single gray trace regardless of color-by for visual clarity | 2026-02-16 |
| Click-to-filter in histogram filters by bin, not color-by category | Color-by is purely visual - histogram interaction still filters by column bins | 2026-02-16 |
| PieChartCard ignores numeric color-by | Pie charts inherently categorical - numeric color-by doesn't make sense for grouping slices | 2026-02-16 |
| PieChartCard uses effectiveColumn pattern | Dynamic column switching between configured column and colorByAttribute based on type | 2026-02-16 |
| MapCard dropdown removed | Per-card controls migrated to dashboard header for cross-card consistency | 2026-02-16 |
| Dashboard-level ColorLegend with sticky positioning | Legend visible at all times, positioned right-aligned to match MapCard pattern | 2026-02-16 |
| Legend click-to-filter uses toggle behavior | Clicking category adds/removes from filter for intuitive multi-select | 2026-02-16 |
| Legend filter cleared on colorByAttribute change | Prevents stale filters when switching color-by attribute | 2026-02-16 |

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1: Adaptive Layer Coloring (URGENT) - 2026-01-20
  - Reason: Cluster visualization issues - colorBy not affecting clusters/arcs, need intelligent layer coloring based on visibility

- Phase 4.1 inserted after Phase 4: Timeline Refinement (URGENT) - 2026-01-22
  - Reason: Phase 4 delivered too many features creating UX complexity
  - Simplify: Remove inline detail view, multi-select; add mouse wheel zoom, degree filter, modal detail view
  - Keep: Swim lane visualization, minimap, zoom buttons, hover highlighting

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

- Phase 4.2 inserted after Phase 4.1: Scientific Mode (URGENT) - 2026-01-30
  - Reason: Need paper-ready visualizations for dissertation - current web-optimized styling not suitable for academic publications
  - Scope: Separate plugin alongside interactive-dashboard (affects all visualizations, not just interactive)
  - Features: Scientific styling profile (white bg, black axes, publication fonts), per-plot and bulk export
  - Branch: feature/scientific-mode (based on feature/dashboard-unification)
  - Requirements: SCI-01 to SCI-05 (5 new requirements)

- Phase 4.3 inserted after Phase 4: Scatter Plot Color-By Selector and Cross-Card Sync (URGENT) - 2026-02-16
  - Reason: Scatter plots lack the color-by dropdown that MapCard already has; need per-scatter color-by selector with optional cross-card synchronization
  - Approach: Per-scatter dropdown (consistent with MapCard pattern) + linkage sync so changing color-by on one scatter updates all linked scatters
  - Features: Color-by attribute selector per ScatterCard, configurable via YAML, cross-card sync via LinkageManager

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
- [x] Research Phase 4 before planning (Timeline data volume assessment)
- [x] Execute Plan 04-01: Timeline foundation (COMPLETE)
- [x] Execute Plan 04-02: Horizontal bar rendering (COMPLETE)
- [x] Execute Plan 04-03: Integration and verification (COMPLETE)
- [x] Execute Plan 04-04: Zoom and detail view (COMPLETE)
- [ ] Plan Phase 4.1: Timeline Refinement
- [ ] Research Phase 5 before planning (vue-cytoscape integration)

### Blockers

None currently.

### Pending Todos

| Date | Title | Area |
|------|-------|------|
| 2026-01-22 | Fix card viewport scaling issues | ui |
| 2026-01-28 | Add scientific styling profile for paper-ready visualizations | ui |
| 2026-01-28 | Create custom SimWrapper branding/styling for dissertation use case | ui |

See `.planning/todos/pending/` for details.

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
22. **import type for type-only imports**: When a type is used only in type positions (extends, type annotations), use `import type` to satisfy isolatedModules and enable tree-shaking.
23. **Plotly event binding via plotEl.on()**: After Plotly.newPlot(), cast element to `any` and use `.on('plotly_*', handler)` for event binding.

---

## Quick Tasks Completed

| ID | Name | Date | Impact |
|----|------|------|--------|
| 001 | Remove legacy components and consolidate rendering | 2026-01-21 | ~987 lines removed |
| 002 | Dashboard unification - InteractiveDashboard without table config | 2026-01-21 | Standard mode enabled |
| 003 | Dashboard visualization polish - axis labels, multi-select, density mode | 2026-01-28 | Scientific publication readiness |
| 006 | Scientific mode markers and patterns for print accessibility | 2026-01-30 | Grayscale-ready charts |
| 007 | Scientific mode polish - comparison styling and labels | 2026-01-30 | Publication-ready comparison mode |

---

## Session Continuity

### For Next Session

**Where we left off:** Phase 4.3 COMPLETE (Cross-card color synchronization)

**Next action:** Proceed to Phase 5 (Graph Visualization) OR merge feature branch
- Phase 4.3 complete: All card types synchronized with dashboard-level color-by selector
- ColorBySelector, ScatterCard, HistogramCard, PieChartCard, MapCard migration, dashboard legend all complete
- Feature branch `feature/scientific-mode` ready for merge to master
- Alternative: Continue with Phase 5 planning and execution

**Phase progress:** Phase 4.3 complete (3/3 plans complete)

**Branch:** `feature/scientific-mode` (ready for merge or continue with Phase 5)

**Plan 04.2-03 Completed (2026-01-30):**

Plotly charts scientific styling:
- All 5 Plotly-based cards support scientific mode (HistogramCard, ScatterCard, PieChartCard, CorrelationMatrixCard, TimelineCard)
- Scientific mode applies Arial font family to all text elements
- Black axis lines with 1.5px width in scientific mode
- Cards watch globalStore.state.colorScheme for theme-reactive re-rendering
- TimelineCard hides zoom controls and viewport indicator in scientific mode
- PieChartCard uses thicker slice outlines (2px) in scientific mode

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

**Plan 03.1-04 Completed (2026-01-21):**

ScatterCard and DataTableCard comparison mode:
- Added baselineData and showComparison props to ScatterCard
- Implemented baselineScatterData computed property for baseline point computation
- Baseline trace rendered first (unshift) with gray color (rgba 156, 163, 175, 0.3)
- Baseline points slightly smaller (markerSize * 0.8) and behind filtered points
- Legend shows when comparison active (showlegend: hasCategories || props.showComparison)
- Click handler ignores baseline trace via curveNumber check (curveNumber === 0)
- Added baselineData and showComparison props to DataTableCard
- Implemented comparisonCountText computed property ("X / Y" format)
- Comparison count displayed in table-controls with blue selected color styling
- Files: ScatterCard.vue (67 lines changed), DataTableCard.vue (32 lines changed)
- Commits: d280b4dd (scatter), 75d8b109 (table)

*State updated: 2026-01-21 (Phase 3.1 complete - Comparison Mode)*

**Phase 3.1 Debugging Session (2026-01-22):**

Fixed event propagation issues preventing comparison mode from working:
- ComparisonToggle emit changed from camelCase to kebab-case ('update:model-value')
- DataTableCard emit changed from camelCase to kebab-case ('update:show-comparison')
- InteractiveDashboard handleShowComparisonUpdate method created (avoids slot variable shadowing)
- Added missing watchers for showComparison and baselineData in HistogramCard and PieChartCard
- Root cause: Vue 2.7 doesn't auto-convert event names between camelCase and kebab-case

Files modified:
- ComparisonToggle.vue: emit('update:model-value')
- DataTableCard.vue: emit('update:show-comparison'), added watcher for showComparison
- InteractiveDashboard.vue: handleShowComparisonUpdate method, removed dashboard-toolbar CSS
- HistogramCard.vue: added watchers for showComparison and baselineData
- PieChartCard.vue: added watchers for showComparison and baselineData
- LinkableCardWrapper.vue: added debug watcher (can be removed later)

Lessons learned:
- Vue 2.7 with Composition API requires exact event name matching (no auto camelCase↔kebab conversion)
- Scoped slot variables shadow component data properties - use methods to update this.property
- Charts need explicit watchers to re-render when comparison props change

*State updated: 2026-01-22 (Phase 3.1 debugging complete - comparison mode now fully functional)*

**Plan 04-01 Completed (2026-01-22):**

Timeline foundation - track allocator and TimelineCard scaffold:
- Created trackAllocator.ts with greedy interval partitioning algorithm O(n log n)
- Exports TimelineItem and TrackAllocation interfaces
- 14 comprehensive unit tests covering edge cases
- Created TimelineCard.vue scaffold (317 lines) following HistogramCard/ScatterCard patterns
- Props interface: filteredData, baselineData, showComparison, hoveredIds, selectedIds, idColumn, startColumn, endColumn, degreeColumn, linkage, tableConfig
- Computed properties: timelineData (transforms rows to TimelineItem[]), trackAllocation (calls allocateTracks)
- Watchers for data changes, comparison mode, dark mode
- Resize handling with debounced ResizeObserver
- Commits: 5357449b (trackAllocator), 5aa8a552 (TimelineCard)

*State updated: 2026-01-22 (Plan 04-01 complete - Timeline foundation)*

**Plan 04-02 Completed (2026-01-22):**

Horizontal bar rendering with Plotly:
- Implemented nested Plotly horizontal bar traces with barmode: 'overlay'
- Constraint window trace (gray rgba 156,163,175,0.4, width 0.8) renders behind actual travel
- Actual travel trace (degree-colored, width 0.5) renders on top
- getDegreeColor() maps degree to StyleManager.getCategoricalColor(0/1/2)
- formatTime(), generateTimeTickVals(), generateTimeTickText() for 24-hour axis
- Time axis shows HH:MM labels every 2 hours (00:00, 02:00, ..., 24:00)
- Y-axis shows swim lanes without labels, range based on totalTracks
- Hover templates show ride ID, start time, duration, degree
- Theme-aware colors (bgColor, textColor, gridColor from StyleManager)
- File: TimelineCard.vue (479 lines total, +183 lines from scaffold)
- Commit: 3f88ddd3

*State updated: 2026-01-22 (Plan 04-02 complete - Horizontal bar rendering)*

**Plan 04-03 Completed (2026-01-22):**

Integration and verification - hover/click interactions and card registration:
- Added plotly_hover/plotly_unhover event binding for cross-card hover coordination
- Emit hover events that highlight corresponding rows in DataTableCard
- Visual feedback: dims non-hovered bars to 30% opacity via applyOpacity()
- Added plotly_click event binding with toggle selection behavior
- Emit select and filter events for cross-card filtering
- Selection visuals: 2px border with StyleManager.interaction.selected color
- Escape key clears entire selection
- Watch hoveredIds and selectedIds props for external state changes
- Registered 'timeline' in _allPanels.ts panelLookup
- Fixed import type for TimelineItem (isolatedModules compatibility)
- File: TimelineCard.vue (662 lines total)
- Commits: 27bab2c5 (hover), 05b69a3b (click), abf03830 (registration)

*State updated: 2026-01-22 (Phase 4 COMPLETE - Timeline Card)*

**Plan 04-04 Completed (2026-01-22):**

Zoom controls, minimap navigation, and expandable ride detail view:
- Zoom controls (+/-/reset) with Plotly.relayout for x-axis range updates
- Viewport state (viewportStart/viewportEnd refs) synced via plotly_relayout events
- Minimap with staticPlot mode showing simplified overview of entire timeline
- Viewport indicator CSS overlay tracking current zoom position
- Minimap click to center viewport on clicked time
- Expandable ride detail panel with slide-down transition animation
- Ride summary showing degree, duration, and time window
- Per-request mini-Gantt with constraint bars and actual pickup markers
- formatDuration helper for human-readable time formatting
- File: TimelineCard.vue (1171 lines total)
- Commits: a9765a6b (zoom/minimap), 0b456c86 (expandable detail)

*State updated: 2026-01-22 (Plan 04-04 complete - Zoom and Detail View)*

**Plan 04.1-01 Completed (2026-01-22):**

Mouse wheel zoom and zoom control relocation:
- Implemented cursor-centered zoom that preserves mouse position during scroll operations
- Scroll wheel up zooms in, scroll wheel down zooms out, both centered on cursor
- Relocated zoom buttons (+/-/reset) from top controls to minimap floating overlay
- Prevented page scroll during timeline zoom with passive:false event listener
- File: TimelineCard.vue (modified)
- Commits: b39ba360 (wheel zoom), 13b3b37c (control relocation)

*State updated: 2026-01-22 (Plan 04.1-01 complete - Mouse Wheel Zoom)*

**Plan 04.1-02 Completed (2026-01-22):**

Single-select and request detail view:
- Replaced multi-select toggle with single-select that switches to request detail view
- Added viewMode ref ('rides' | 'requests') for view switching state
- Added detailRideId ref to track selected ride in detail view
- Implemented requestTimelineData computed for request timeline items
- Updated renderChart() to branch on viewMode (rides vs requests)
- Dynamic x-axis scaling for request view based on ride's constraint window
- Back button navigation returns to all-rides view and clears selection
- Removed inline expandable detail panel and slide-down transitions
- Request detail view is view-only (no hover/click cross-card events)
- Hide minimap when in request view
- File: TimelineCard.vue (modified)
- Commits: d3eda5ab (single-select), 191b2d18 (request view)

*State updated: 2026-01-22 (Phase 4.1 complete - Timeline Refinement)*

**Plan 04.2-02 Completed (2026-01-30):**

Export utilities for chart and map export:
- Installed JSZip ^3.10.1 for bulk ZIP export
- Created export type definitions (ExportFormat, ExportConfig, ExportResult, CardExportInfo)
- Implemented exportPlotlyChart() with Plotly.toImage for base64 PNG/SVG export
- Implemented exportMapCanvas() with tile loading wait via idle event
- Implemented exportAllChartsAsZip() with DEFLATE compression and unique filename handling
- Added sanitizeFilename() helper for safe filename generation
- Memory cleanup with URL.revokeObjectURL for blob downloads
- Files: types/export.ts, utils/exportUtils.ts
- Commits: 9ef01b44 (jszip), 0dedad03 (types), 3a54bab7 (utils)

*State updated: 2026-01-30 (Plan 04.2-02 complete - Export Utilities)*

**Plan 04.2-04 Completed (2026-01-30):**

Per-card export button in DashboardCard header:
- Extended CardConfig type with exportConfig, exportName, exportable fields
- Added export dropdown button with PNG/SVG options to DashboardCard header
- Implemented handleExport() function for both Plotly charts and MapLibre canvas
- Export uses card title for default filename via sanitizeFilename()
- Export button visible for 6 exportable chart types (histogram, scatter, pie, correlation-matrix, timeline, map)
- Dropdown menu with theme-aware styling (CSS variables)
- Map export PNG-only (WebGL canvas cannot produce SVG)
- Files: dashboardCard.ts, DashboardCard.vue
- Commits: 26541ee4 (types), 576c3ddc (component)

*State updated: 2026-01-30 (Plan 04.2-04 complete - Per-Card Export Button)*

**Plan 04.2-05 Completed (2026-01-30):**

Export All button for bulk dashboard export:
- Created ExportAllButton.vue component in components/controls/
- Finds all Plotly charts via document.querySelectorAll('.dashboard-card .js-plotly-plot')
- Exports each chart to PNG using existing exportPlotlyChart utility
- Bundles all exports into ZIP via exportAllChartsAsZip
- Integrated button into InteractiveDashboard header (between title and favorite star)
- Shows spinner progress indication during export
- ZIP filename based on dashboard title
- Files: ExportAllButton.vue (created), InteractiveDashboard.vue (modified)
- Commits: b5703f30 (component), 5917c59c (integration)

*State updated: 2026-01-30 (Plan 04.2-05 complete - Export All Button)*

**Plan 04.2-06 Completed (2026-01-30):**

MapCard scientific mode styling and export support:
- Added isScientificMode computed property linked to StyleManager.isScientificMode()
- Added data-exportable-map attribute for DashboardCard export detection
- Added scientific-mode CSS class binding to map container
- Hide MapLibre controls (zoom buttons, compass, attribution) in scientific mode via CSS :deep()
- Added colorScheme watcher to update styling when theme changes
- Files: MapCard.vue (modified)
- Commits: 6560a0b5

*State updated: 2026-01-30 (Plan 04.2-06 complete - MapCard Scientific Mode)*

**Plan 04.2-07 Completed (2026-01-30):**

End-to-end verification and fixes for Scientific Mode:
- Added theme toggle button to dashboard header (cycles Dark → Light → Scientific)
- Fixed per-card export: expanded isExportable types (scatter-plot, pie-chart, bar, line, area, heatmap)
- Simplified export UX: removed dropdown, direct PNG export button
- Fixed Export All: added map canvas detection via [data-exportable-map] selector
- All requirements verified: SCI-01 to SCI-05
- Files: InteractiveDashboard.vue, DashboardCard.vue, ExportAllButton.vue
- Commits: 13640312, 06b4cd69, 54030cae, 7187cb73, fafcf7f7, 7bc6e8bf, 5c5a3327

*State updated: 2026-01-30 (Phase 4.2 COMPLETE - Scientific Mode)*

**Plan 04.3-01 Completed (2026-02-16):**

ColorBySelector component and dashboard-level colorBy state:
- Created ColorBySelector.vue component in components/controls/
- Extracted color-by dropdown from MapCard pattern
- Props interface: modelValue (string) and options array
- Template: Pug with "None" option first, followed by configured attributes
- Styling: Reused MapCard control styles (control-item, control-label, control-select)
- Updated InteractiveDashboard.vue:
  - Imported and registered ColorBySelector component
  - Updated colorByOptions computed to prioritize yaml.colorBy over yaml.map.colorBy
  - Modified mounted() to initialize colorByAttribute from top-level yaml.colorBy
  - Added ColorBySelector to dashboard header before theme toggle button
  - Bound selector to colorByAttribute state with v-model pattern
  - Only shows selector when colorByOptions.length > 0
- colorByAttribute and colorByOptions already passed to all cards via existing template bindings
- Backward compatible: falls back to yaml.map.colorBy if yaml.colorBy not present
- First configured attribute selected by default (not "None")
- Files: ColorBySelector.vue (created), InteractiveDashboard.vue (modified)
- Commit: f6196beb
- Duration: 428 seconds (7 minutes)

*State updated: 2026-02-16 (Plan 04.3-01 complete - ColorBySelector component)*

**Plan 04.3-02 Completed (2026-02-16):**

ScatterCard and HistogramCard color-by attribute support:
- ScatterCard accepts colorByAttribute and colorByOptions props
- Categorical color-by creates per-category traces with StyleManager colors
- Numeric color-by uses Plotly Viridis colorscale with colorbar
- HistogramCard accepts colorByAttribute and colorByOptions props
- Categorical color-by creates stacked bar traces showing category distribution per bin
- Numeric color-by colors bars by average value of color-by attribute within each bin
- Auto-detection of attribute type from data values (not YAML config)
- Numeric attributes with <15 unique values treated as categorical (handles mode IDs)
- Comparison mode baseline stays gray (not split by category)
- Click-to-filter in histogram still filters by bin (not color-by category)
- Files: ScatterCard.vue (modified), HistogramCard.vue (modified)
- Commits: 79a43df3 (ScatterCard), 5bd934d2 (HistogramCard)
- Duration: 1352 seconds (22 minutes)

*State updated: 2026-02-16 (Plan 04.3-02 complete - ScatterCard and HistogramCard color-by)*

**Plan 04.3-03 Completed (2026-02-16):**

PieChartCard color-by, MapCard migration, dashboard legend:
- PieChartCard accepts colorByAttribute prop
- Detects categorical vs numeric color-by type (same logic as ScatterCard)
- effectiveColumn computed switches between configured column and colorByAttribute
- Categorical color-by: replaces pie grouping with color-by attribute
- Numeric color-by: ignored with debug warning (pie charts inherently categorical)
- Uses StyleManager.buildCategoricalColorMap for consistent cross-card colors
- MapCard per-card color-by dropdown removed from template
- MapCard continues to read colorByAttribute from prop for layer coloring
- Dashboard-level ColorLegend component added to InteractiveDashboard
- Legend appears after tabs, before rows with sticky positioning
- dashboardLegendData computed builds legend from colorByAttribute and displayData
- Auto-detects categorical vs numeric type, gets label from colorByOptions
- handleDashboardLegendClick toggles filter on colorByAttribute column
- Legend filter cleared when colorByAttribute changes (watcher)
- Files: PieChartCard.vue (modified), MapCard.vue (modified), InteractiveDashboard.vue (modified)
- Commits: 65b96d4e (PieChartCard + MapCard), dbd70ecd (dashboard legend)
- Duration: 1287 seconds (21 minutes)

*State updated: 2026-02-16 (Phase 4.3 COMPLETE - Cross-card color synchronization)*
