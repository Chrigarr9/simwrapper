# Requirements: SimWrapper Interactive Dashboard Enhancements

**Defined:** 2026-01-20
**Core Value:** One styling configuration controls all visualizations

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Theming

- [x] **THEME-01**: StyleManager class centralizes color definitions replacing hardcoded values across components
- [x] **THEME-02**: CSS variables system for theme colors accessible to all dashboard components
- [x] **THEME-03**: OD cluster color scheme configurable (origin, destination, arc default colors)

### Sub-Dashboard

- [~] **SUBD-01**: Enlarge button appears on sub-dashboard card headers (partial - issues found)
- [~] **SUBD-02**: Enlarged card breaks out of sub-dashboard container to full viewport (partial - issues found)

### Card Component Architecture

- [x] **CARD-01**: DashboardCard component handles card frame, header, title/description display
- [x] **CARD-02**: DashboardCard component handles enlarge/restore button and fullscreen state
- [x] **CARD-03**: DashboardCard component handles resize events and notifies child content
- [x] **CARD-04**: Content components (ScatterCard, HistogramCard, MapCard, DataTableCard) render only their visualization, not frame/buttons
- [x] **CARD-05**: DashboardCard works identically in main dashboard and sub-dashboards

### Correlation Analysis

- [x] **CORR-01**: Correlation matrix card showing pairwise Pearson correlations as heatmap
- [x] **CORR-02**: Attribute selector allows choosing which columns to include in correlation matrix

### Comparison Mode

- [x] **COMP-01**: ComparisonToggle control enables/disables comparison mode dashboard-wide
- [x] **COMP-02**: HistogramCard shows baseline bars (gray, low opacity) behind filtered bars when comparison mode active
- [x] **COMP-03**: PieChartCard shows baseline as outer ring around filtered inner ring when comparison mode active
- [x] **COMP-04**: ScatterCard shows baseline points (gray, low opacity) behind filtered points when comparison mode active
- [x] **COMP-05**: DataTableCard shows "Filtered / Baseline" count when comparison mode active
- [x] **COMP-06**: Comparison mode only activates when filters are active (no meaningless comparison of all vs all)

### Dual Maps

- [ ] **DMAP-01**: Dashboard layout supports side-by-side dual map configuration
- [ ] **DMAP-02**: Maps synchronize pan/zoom (move one map, other follows automatically)
- [ ] **DMAP-03**: Each map has independent colorBy attribute selector
- [ ] **DMAP-04**: Hover on one map highlights same feature(s) on other map and data table

### Timeline

- [ ] **TIME-01**: Timeline card shows time window bars (Gantt-style with earliest/latest constraints)
- [ ] **TIME-02**: Requests visually grouped by their parent ride in timeline

### Graph

- [ ] **GRPH-01**: Graph card displays path cover visualization (rides as nodes, feasibility edges between them)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Theming Enhancements

- **THEME-04**: styling.yaml auto-discovery by dashboards
- **THEME-05**: Configurable interaction state colors (hover, selected, dimmed)
- **THEME-06**: Per-dashboard style overrides

### Sub-Dashboard Enhancements

- **SUBD-03**: Vue teleport/portal pattern for true viewport fullscreen
- **SUBD-04**: Keyboard shortcuts (Escape to close fullscreen)

### Correlation Enhancements

- **CORR-03**: Click correlation cell to configure dual maps with those attributes
- **CORR-04**: Filter-aware correlation recalculation
- **CORR-05**: SPLOM (Scatter Plot Matrix) for multiple attributes

### Dual Maps Enhancements

- **DMAP-05**: Swipe comparison view
- **DMAP-06**: Difference map (showing attribute delta between views)

### Timeline Enhancements

- **TIME-03**: Time range filter (drag to select time window)
- **TIME-04**: Animation playback through time
- **TIME-05**: Vehicle assignment visualization

### Graph Enhancements

- **GRPH-02**: Request-to-ride matching graph
- **GRPH-03**: Interactive graph exploration (click nodes, expand/collapse, drag layout)

### Dashboard Unification

- **UNIF-01**: InteractiveDashboard works without `table` config (managers initialize with empty state)
- **UNIF-02**: InteractiveDashboard fully replaces standard DashBoard.vue as superset
- **UNIF-03**: Standard dashboard configs work unchanged in InteractiveDashboard
- **UNIF-04**: Remove DashBoard.vue after unification complete (single dashboard component)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 3D visualizations | Unnecessary complexity for analysis use case |
| Mobile-specific layouts | Desktop-first for research analysis workflows |
| Real-time data streaming | Dashboards work with static analysis outputs |
| Separate dashboard codebases | v2 goal: Unify to single InteractiveDashboard (UNIF-01 to UNIF-04) |
| Upstream SimWrapper contribution | Can be considered later after local validation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 1: Theming Foundation | Complete |
| THEME-02 | Phase 1: Theming Foundation | Complete |
| THEME-03 | Phase 1: Theming Foundation | Complete |
| SUBD-01 | Phase 2: Sub-Dashboard Fix | Partial (blocked by architecture) |
| SUBD-02 | Phase 2: Sub-Dashboard Fix | Partial (blocked by architecture) |
| CARD-01 | Phase 2.1: DashboardCard Component | Complete |
| CARD-02 | Phase 2.1: DashboardCard Component | Complete |
| CARD-03 | Phase 2.1: DashboardCard Component | Complete |
| CARD-04 | Phase 2.1: DashboardCard Component | Complete |
| CARD-05 | Phase 2.1: DashboardCard Component | Complete |
| CORR-01 | Phase 3: Correlation Analysis | Complete |
| CORR-02 | Phase 3: Correlation Analysis | Complete |
| COMP-01 | Phase 3.1: Comparison Mode | Complete |
| COMP-02 | Phase 3.1: Comparison Mode | Complete |
| COMP-03 | Phase 3.1: Comparison Mode | Complete |
| COMP-04 | Phase 3.1: Comparison Mode | Complete |
| COMP-05 | Phase 3.1: Comparison Mode | Complete |
| COMP-06 | Phase 3.1: Comparison Mode | Complete |
| DMAP-01 | Phase 4: Dual Maps | Pending |
| DMAP-02 | Phase 4: Dual Maps | Pending |
| DMAP-03 | Phase 4: Dual Maps | Pending |
| DMAP-04 | Phase 4: Dual Maps | Pending |
| TIME-01 | Phase 5: Timeline | Pending |
| TIME-02 | Phase 5: Timeline | Pending |
| GRPH-01 | Phase 6: Graph Visualization | Pending |

**Coverage:**
- v1 requirements: 25 total (including 5 CARD-*, 6 COMP-* requirements)
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-21 — Phase 3.1 complete (COMP-01 to COMP-06 verified)*
