# Roadmap: SimWrapper Interactive Dashboard Enhancements

**Created:** 2026-01-20
**Depth:** Standard (5-8 phases)
**Total Phases:** 8 (including 3 inserted)
**Total v1 Requirements:** 18

---

## Overview

This roadmap delivers enhanced visualization capabilities for SimWrapper's interactive dashboard system. The phases are ordered by dependency: theming foundation enables consistent colors across all subsequent features, sub-dashboard fixes enable testing in nested contexts, then analysis tools (correlation, dual maps, timeline, graph) build on the established foundation. Each phase delivers a complete, verifiable capability.

---

## Phase 1: Theming Foundation

**Goal:** All dashboard components use centralized color configuration instead of hardcoded values

**Dependencies:** None (foundation phase)

**Requirements:**
- THEME-01: StyleManager class centralizes color definitions replacing hardcoded values across components
- THEME-02: CSS variables system for theme colors accessible to all dashboard components
- THEME-03: OD cluster color scheme configurable (origin, destination, arc default colors)

**Success Criteria:**
1. User changes a color in StyleManager and all cards (MapCard, PieChartCard, HistogramCard, ScatterCard) reflect the change
2. User toggles dark/light mode and interaction states (hover, selected) remain visually distinct with WCAG-compliant contrast
3. User configures OD cluster colors once in dashboard YAML and sees those colors in both map layers and legends
4. Developer can add a new card type and access theme colors via CSS variables without importing colorSchemes.ts directly

**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Create StyleManager class with color definitions and CSS variable generation
- [x] 01-02-PLAN.md — Migrate MapCard and ColorLegend to use centralized theme colors
- [x] 01-03-PLAN.md — Migrate chart cards (PieChart, Histogram, Scatter) to use StyleManager
- [x] 01-04-PLAN.md — Initialize StyleManager in dashboard and update remaining component styles

**Completed:** 2026-01-20

**Research Flag:** None - patterns well-documented in existing codebase

---

## Phase 1.1: Adaptive Layer Coloring (INSERTED)

**Goal:** Color-by system automatically adapts based on visible layer relationships - single geometry gets colored, multiple geometries with arc colors the arc while others become neutral

**Dependencies:** Phase 1 (StyleManager provides color infrastructure)

**Requirements:**
- ALYR-01: Layer relationship detection via shared geoProperty identifies connected layers at runtime
- ALYR-02: Automatic coloring strategy applies colorBy to primary layer (arc when multiple geometries visible, geometry when single)
- ALYR-03: Neutral styling mode for secondary layers (subtle boundaries without data coloring)
- ALYR-04: YAML configuration for layerStrategy (auto/explicit/all) and per-layer colorByRole overrides

**Success Criteria:**
1. User views origin clusters only and sees clusters colored by the selected colorBy attribute
2. User views destination clusters only and sees clusters colored by the selected colorBy attribute
3. User switches to OD view (origin + destination + arcs) and arcs become colored by attribute while cluster boundaries become neutral/subtle
4. User configures `layerStrategy: explicit` in YAML and only layers with `colorByRole: primary` receive colorBy coloring
5. Developer can override auto-detection with `colorByRole: primary|secondary|neutral` per-layer in YAML

**Plans:** 3 plans

Plans:
- [x] 01.1-01-PLAN.md — Create LayerColoringManager with types and role computation logic
- [x] 01.1-02-PLAN.md — Integrate into MapCard and InteractiveDashboard with YAML config support
- [x] 01.1-03-PLAN.md — Verification and edge case handling

**Completed:** 2026-01-20

**Details:**
Implementation approach: Detect layers sharing same `geoProperty` (e.g., cluster_id), count visible geometry layers and arc layers per group, apply coloring rule automatically. Configurable via `map.colorBy.layerStrategy` and per-layer `colorByRole` properties.

**Research Flag:** None - layer linkage architecture already well-understood from Phase 1

---

## Phase 2: Sub-Dashboard Fix

**Goal:** Cards within sub-dashboards can be enlarged to full viewport like top-level cards

**Dependencies:** Phase 1 (StyleManager provides consistent styling for enlarged view)

**Requirements:**
- SUBD-01: Enlarge button appears on sub-dashboard card headers
- SUBD-02: Enlarged card breaks out of sub-dashboard container to full viewport

**Success Criteria:**
1. User sees an enlarge button on every card header within a sub-dashboard
2. User clicks enlarge on a sub-dashboard card and the card expands to cover the full browser viewport
3. User clicks close/escape and the card returns to its original position within the sub-dashboard
4. User can interact with the enlarged card (hover, select, zoom) exactly as with top-level cards

**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Create FullscreenPortal component and integrate with sub-dashboard card rendering
- [ ] 02-02-PLAN.md — Verify and polish fullscreen behavior across all card types

**Research Flag:** None - CSS portal pattern identified in research (Pitfall #4)

---

## Phase 2.1: DashboardCard Component Architecture (INSERTED)

**Goal:** Create a unified DashboardCard wrapper component that consolidates all card frame logic (header, buttons, fullscreen, resize) so content components only handle their visualization

**Dependencies:** Phase 2 (reveals architectural issues with scattered card logic)

**Requirements:**
- CARD-01: DashboardCard component handles card frame, header, title/description display
- CARD-02: DashboardCard component handles enlarge/restore button and fullscreen state
- CARD-03: DashboardCard component handles resize events and notifies child content
- CARD-04: Content components (ScatterCard, HistogramCard, MapCard, DataTableCard) render only their visualization, not frame/buttons
- CARD-05: DashboardCard works identically in main dashboard and sub-dashboards

**Success Criteria:**
1. User sees consistent card frame appearance across all card types (scatter, histogram, map, table)
2. User clicks enlarge on any card type and it expands to fullscreen correctly
3. User exits fullscreen and all cards resize properly (no scatter plot overflow, no missing buttons)
4. Developer adds a new card type by creating content-only component and wrapping with DashboardCard
5. Cards in sub-dashboards behave identically to cards in main dashboard
6. Fullscreen state is managed by DashboardCard, not duplicated in individual cards

**Plans:** 4 plans

Plans:
- [x] 02.1-01-PLAN.md — Create DashboardCard component with frame, header, buttons, and TypeScript interfaces
- [x] 02.1-02-PLAN.md — Add fullscreen CSS management and resize event propagation
- [x] 02.1-03-PLAN.md — Refactor InteractiveDashboard to use DashboardCard wrapper
- [x] 02.1-04-PLAN.md — Verify content components and fullscreen behavior across all card types

**Completed:** 2026-01-21

**Details:**
The current architecture has card frame/header/buttons rendered inline in InteractiveDashboard.vue template, with fullscreen logic in getCardStyle(). Individual cards (DataTableCard, ScatterCard) have tried to implement their own fullscreen/resize handling, causing:
- Duplicate enlarge buttons (DataTableCard had its own)
- Inconsistent resize behavior (scatter plots scaling incorrectly after fullscreen toggle)
- Buttons disappearing in certain state transitions
- Scattered, hard-to-maintain code

The DashboardCard component will:
1. Render the card frame (.dash-card-frame equivalent)
2. Render the header with title, description, info button, enlarge button
3. Manage fullscreen state and apply appropriate CSS
4. Dispatch resize events to children when exiting fullscreen
5. Provide a slot for card-specific content

Content components will:
1. Receive filteredData, hoveredIds, selectedIds via props (unchanged)
2. Render only their visualization (chart, map, table)
3. Listen for resize events from parent DashboardCard
4. NOT handle their own frame, header, buttons, or fullscreen

This is the composition pattern that enables future features like card reordering.

**Research Flag:** None - Vue slot/composition patterns well-documented

---

## Phase 3: Correlation Analysis

**Goal:** User can visualize pairwise correlations between cluster attributes to identify relationships

**Dependencies:** Phase 1 (StyleManager provides heatmap color scales)

**Requirements:**
- CORR-01: Correlation matrix card showing pairwise Pearson correlations as heatmap
- CORR-02: Attribute selector allows choosing which columns to include in correlation matrix

**Success Criteria:**
1. User sees a heatmap where each cell shows the Pearson correlation coefficient between two attributes
2. User hovers over a cell and sees a tooltip with the exact correlation value and attribute names
3. User opens the attribute selector and toggles which of the 70+ available attributes appear in the matrix
4. User applies a filter via another card (e.g., HistogramCard) and the correlation matrix recalculates for filtered rows only

**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Create statistics utilities and install simple-statistics dependency
- [x] 03-02-PLAN.md — Create CorrelationMatrixCard component with Plotly heatmap
- [x] 03-03-PLAN.md — Extend LinkageManager and integrate ScatterCard axis updates
- [x] 03-04-PLAN.md — Register card type and verification

**Completed:** 2026-01-21

**Research Flag:** Completed - Web Worker architecture deferred, Plotly.js + simple-statistics selected

---

## Phase 3.1: Comparison Mode (INSERTED)

**Goal:** User can toggle comparison mode to see filtered data overlaid against baseline (all data), enabling visual assessment of filter impact across all cards

**Dependencies:** Phase 3 (Correlation Analysis - comparison works with filtered correlation calculations)

**Requirements:**
- COMP-01: ComparisonToggle control enables/disables comparison mode dashboard-wide
- COMP-02: HistogramCard shows baseline bars (gray, low opacity) behind filtered bars when comparison mode active
- COMP-03: PieChartCard shows baseline as outer ring around filtered inner ring when comparison mode active
- COMP-04: ScatterCard shows baseline points (gray, low opacity) behind filtered points when comparison mode active
- COMP-05: DataTableCard shows "Filtered / Baseline" count when comparison mode active
- COMP-06: Comparison mode only activates when filters are active (no meaningless comparison of all vs all)

**Success Criteria:**
1. User toggles comparison mode ON and sees baseline data (gray/transparent) behind filtered data in all chart cards
2. User applies a histogram filter and sees filtered bars overlaid on baseline bars (Plotly barmode: 'overlay')
3. User applies a filter and sees pie chart with inner ring (filtered) and outer ring (baseline, semi-transparent)
4. User applies a filter and sees scatter plot with gray baseline points behind colored filtered points
5. User sees "15 / 48" style ratio in table header showing filtered vs baseline count
6. Comparison mode toggle is disabled (or does nothing) when no filters are active

**Plans:** 4 plans

Plans:
- [x] 03.1-01-PLAN.md — Create ComparisonToggle component and wire comparison state through dashboard
- [x] 03.1-02-PLAN.md — Add comparison mode to HistogramCard with overlay bars
- [x] 03.1-03-PLAN.md — Add comparison mode to PieChartCard with concentric rings
- [x] 03.1-04-PLAN.md — Add comparison mode to ScatterCard and DataTableCard count display

**Completed:** 2026-01-21

**Details:**
Generalizes the comparison mode pattern from commuter-requests plugin to the interactive dashboard:

**Reference Implementation:** `src/plugins/commuter-requests/`
- `components/controls/ComparisonToggle.vue` - Toggle UI component
- `CommuterRequests.vue` - `effectiveShowComparison = showComparison && hasActiveFilters`
- `components/stats/ActiveTimeHistogramPlotly.vue` - Overlay bar pattern
- `components/stats/MainModePieChartPlotly.vue` - Concentric ring pattern

**Key Patterns to Generalize:**
1. **Dual-dataset architecture**: Pass both `baselineData` and `filteredData` to all visualization cards
2. **Conditional display**: `effectiveShowComparison = showComparison && hasActiveFilters`
3. **Overlay histograms**: Plotly `barmode: 'overlay'`, baseline with 0.3 opacity
4. **Concentric pies**: Inner ring (filtered, hole: 0.4), outer ring (baseline, hole: 0.7, transparent)
5. **Scatter overlay**: Baseline points rendered first (gray), filtered points rendered on top
6. **Summary stats**: "Filtered / Baseline" ratio display

**Research Flag:** None - pattern already implemented in commuter-requests plugin, just needs generalization

---

## Phase 4: Timeline

**Goal:** User can visualize temporal patterns in ride requests with time window constraints

**Dependencies:** Phase 1 (StyleManager provides timeline colors)

**Requirements:**
- TIME-01: Timeline card shows time window bars (Gantt-style with earliest/latest constraints)
- TIME-02: Requests visually grouped by their parent ride in timeline

**Success Criteria:**
1. User sees a Gantt-style chart with horizontal bars representing ride time windows (earliest pickup to latest dropoff)
2. User identifies time window constraints at a glance (bar start = earliest, bar end = latest, marker = scheduled time)
3. User sees requests grouped under their parent ride with visual hierarchy (ride header, indented requests)
4. User hovers over a timeline bar and sees the corresponding ride/request highlighted in the data table

**Research Flag:** Partial - data volume assessment needed for aggregation strategy

---

## Phase 5: Graph Visualization

**Goal:** User can visualize path cover structure showing rides as nodes and feasibility connections as edges

**Dependencies:** Phase 1 (StyleManager provides node/edge colors)

**Requirements:**
- GRPH-01: Graph card displays path cover visualization (rides as nodes, feasibility edges between them)

**Success Criteria:**
1. User sees a node-link diagram where each node represents a ride and edges represent feasibility connections
2. User can pan and zoom the graph to explore different regions of the network
3. User hovers over a node and sees the corresponding ride highlighted in the data table
4. User hovers over an edge and sees both connected rides highlighted on the map (if MapCard present)

**Research Flag:** Yes - vue-cytoscape integration, D3 vs vis-network comparison, large graph performance

---

## Progress

| Phase | Name | Requirements | Status | Completion |
|-------|------|--------------|--------|------------|
| 1 | Theming Foundation | THEME-01, THEME-02, THEME-03 | Complete | 100% |
| 1.1 | Adaptive Layer Coloring (INSERTED) | ALYR-01, ALYR-02, ALYR-03, ALYR-04 | Complete | 100% |
| 2 | Sub-Dashboard Fix | SUBD-01, SUBD-02 | Partial | 50% |
| 2.1 | DashboardCard Component Architecture (INSERTED) | CARD-01 to CARD-05 | Complete | 100% |
| 3 | Correlation Analysis | CORR-01, CORR-02 | Complete | 100% |
| 3.1 | Comparison Mode (INSERTED) | COMP-01 to COMP-06 | Complete | 100% |
| 4 | Timeline | TIME-01, TIME-02 | Not Started | 0% |
| 5 | Graph Visualization | GRPH-01 | Not Started | 0% |

**Overall Progress:** 5/8 phases complete (63%)

---

## Coverage Validation

| Requirement | Phase | Mapped |
|-------------|-------|--------|
| THEME-01 | Phase 1 | Yes |
| THEME-02 | Phase 1 | Yes |
| THEME-03 | Phase 1 | Yes |
| ALYR-01 | Phase 1.1 | Yes |
| ALYR-02 | Phase 1.1 | Yes |
| ALYR-03 | Phase 1.1 | Yes |
| ALYR-04 | Phase 1.1 | Yes |
| SUBD-01 | Phase 2 | Yes |
| SUBD-02 | Phase 2 | Yes |
| CARD-01 | Phase 2.1 | Yes |
| CARD-02 | Phase 2.1 | Yes |
| CARD-03 | Phase 2.1 | Yes |
| CARD-04 | Phase 2.1 | Yes |
| CARD-05 | Phase 2.1 | Yes |
| CORR-01 | Phase 3 | Yes |
| CORR-02 | Phase 3 | Yes |
| COMP-01 | Phase 3.1 | Yes |
| COMP-02 | Phase 3.1 | Yes |
| COMP-03 | Phase 3.1 | Yes |
| COMP-04 | Phase 3.1 | Yes |
| COMP-05 | Phase 3.1 | Yes |
| COMP-06 | Phase 3.1 | Yes |
| TIME-01 | Phase 4 | Yes |
| TIME-02 | Phase 4 | Yes |
| GRPH-01 | Phase 5 | Yes |

**Coverage:** 25/25 requirements mapped (100%)

---

*Roadmap created: 2026-01-20*
*Last updated: 2026-01-22 — Phase 4 (Dual Maps) removed, renumbered*
