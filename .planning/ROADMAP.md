# Roadmap: SimWrapper Interactive Dashboard Enhancements

**Created:** 2026-01-20
**Depth:** Standard (5-8 phases)
**Total Phases:** 6
**Total v1 Requirements:** 14

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

**Plans:** 4 plans ✓

Plans:
- [x] 01-01-PLAN.md — Create StyleManager class with color definitions and CSS variable generation
- [x] 01-02-PLAN.md — Migrate MapCard and ColorLegend to use centralized theme colors
- [x] 01-03-PLAN.md — Migrate chart cards (PieChart, Histogram, Scatter) to use StyleManager
- [x] 01-04-PLAN.md — Initialize StyleManager in dashboard and update remaining component styles

**Completed:** 2026-01-20

**Research Flag:** None - patterns well-documented in existing codebase

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

**Research Flag:** None - CSS portal pattern identified in research

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

**Research Flag:** Yes - Web Worker architecture and attribute limit optimization needed

---

## Phase 4: Dual Maps

**Goal:** User can compare two map visualizations side-by-side with synchronized navigation

**Dependencies:** Phase 1 (StyleManager provides consistent layer colors)

**Requirements:**
- DMAP-01: Dashboard layout supports side-by-side dual map configuration
- DMAP-02: Maps synchronize pan/zoom (move one map, other follows automatically)
- DMAP-03: Each map has independent colorBy attribute selector
- DMAP-04: Hover on one map highlights same feature(s) on other map and data table

**Success Criteria:**
1. User configures a dashboard with two MapCards side-by-side and both render correctly without overlap
2. User pans or zooms one map and the other map follows with matching center and zoom level
3. User selects different colorBy attributes on each map (e.g., "income" on left, "commute_time" on right) and sees distinct colorings
4. User hovers over a cluster on the left map and sees the same cluster highlighted on the right map and scrolled-to in the data table

**Research Flag:** Yes - deck.gl multi-view vs multiple MapLibre instances, WebGL context limits

---

## Phase 5: Timeline

**Goal:** User can visualize temporal patterns in ride requests with time window constraints

**Dependencies:** Phase 1 (StyleManager provides timeline colors), Phase 3 optional (correlation insights inform time analysis)

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

## Phase 6: Graph Visualization

**Goal:** User can visualize path cover structure showing rides as nodes and feasibility connections as edges

**Dependencies:** Phase 1 (StyleManager provides node/edge colors), Phase 4 optional (map linkage patterns inform graph linkage)

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
| 1 | Theming Foundation | THEME-01, THEME-02, THEME-03 | ✓ Complete | 100% |
| 2 | Sub-Dashboard Fix | SUBD-01, SUBD-02 | Not Started | 0% |
| 3 | Correlation Analysis | CORR-01, CORR-02 | Not Started | 0% |
| 4 | Dual Maps | DMAP-01, DMAP-02, DMAP-03, DMAP-04 | Not Started | 0% |
| 5 | Timeline | TIME-01, TIME-02 | Not Started | 0% |
| 6 | Graph Visualization | GRPH-01 | Not Started | 0% |

**Overall Progress:** 1/6 phases complete (17%)

---

## Coverage Validation

| Requirement | Phase | Mapped |
|-------------|-------|--------|
| THEME-01 | Phase 1 | Yes |
| THEME-02 | Phase 1 | Yes |
| THEME-03 | Phase 1 | Yes |
| SUBD-01 | Phase 2 | Yes |
| SUBD-02 | Phase 2 | Yes |
| CORR-01 | Phase 3 | Yes |
| CORR-02 | Phase 3 | Yes |
| DMAP-01 | Phase 4 | Yes |
| DMAP-02 | Phase 4 | Yes |
| DMAP-03 | Phase 4 | Yes |
| DMAP-04 | Phase 4 | Yes |
| TIME-01 | Phase 5 | Yes |
| TIME-02 | Phase 5 | Yes |
| GRPH-01 | Phase 6 | Yes |

**Coverage:** 14/14 requirements mapped (100%)

---

*Roadmap created: 2026-01-20*
*Last updated: 2026-01-20 — Phase 1 complete*
