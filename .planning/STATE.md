# Project State: SimWrapper Interactive Dashboard Enhancements

**Initialized:** 2026-01-20
**Last Updated:** 2026-01-21 (Plan 02.1-02 Complete - Fullscreen/Resize Management)

---

## Project Reference

**Core Value:** One styling configuration controls all visualizations

**Current Focus:** Phase 2.1 in progress (DashboardCard Component Architecture)

**Key Files:**
- PROJECT.md - Project definition and constraints
- REQUIREMENTS.md - v1 and v2 requirements with traceability
- ROADMAP.md - Phase structure and success criteria
- research/SUMMARY.md - Technical research synthesis

---

## Current Position

**Phase:** 2.1 of 8 (DashboardCard Component Architecture)
**Plan:** 2/4 complete
**Status:** Plan 02.1-02 COMPLETE - Fullscreen/resize management added
**Last activity:** 2026-01-21 - Completed Plan 02.1-02 (ResizeObserver, Escape key, window resize dispatch)

**Progress:**
```
Phase 1:   Theming Foundation       [####] 100% (4/4 plans) COMPLETE
Phase 1.1: Adaptive Layer Coloring  [###] 100% (3/3 plans) COMPLETE
Phase 2:   Sub-Dashboard Fix        [#--] 50% (partial - issues discovered)
Phase 2.1: DashboardCard Component  [##--] 50% (2/4 plans)
Phase 3:   Correlation Analysis     [    ] 0%
Phase 4:   Dual Maps                [    ] 0%
Phase 5:   Timeline                 [    ] 0%
Phase 6:   Graph Visualization      [    ] 0%
```

**Overall:** Phase 2.1 50% complete. DashboardCard now has fullscreen/resize management.

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 10 |
| Plans requiring revision | 0 |
| Requirements completed | 8/18 (THEME-01, THEME-02, THEME-03, ALYR-01, ALYR-02, ALYR-03, ALYR-04, SUBD-01) |
| Research phases triggered | 0 |

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
- [ ] Execute Plan 02.1-03: Refactor existing cards (NEXT)
- [ ] Execute Plan 02.1-04: Verify behavior
- [ ] Plan Phase 3: Correlation Analysis
- [ ] Research Phase 3 before planning (Web Worker architecture)
- [ ] Research Phase 4 before planning (deck.gl multi-view tradeoffs)
- [ ] Research Phase 6 before planning (vue-cytoscape integration)

### Blockers

None currently.

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

---

## Session Continuity

### For Next Session

**Where we left off:** Plan 02.1-02 complete. DashboardCard has fullscreen/resize management.

**Next action:** Execute Plan 02.1-03 (Refactor existing cards to use DashboardCard wrapper).

**Plan 02.1-02 Completed (2026-01-21):**

Added to DashboardCard:
- ResizeObserver for container size changes
- `card-resize` event emitted with dimensions when container resizes
- `window.dispatchEvent(new Event('resize'))` on fullscreen exit for Plotly charts
- Escape key handler to exit fullscreen mode
- Cleanup in onUnmounted for ResizeObserver and keydown listener

Key modifications:
- `src/plugins/interactive-dashboard/components/DashboardCard.vue` (+81 lines)
- `src/plugins/interactive-dashboard/types/dashboardCard.ts` (+9 lines)

### Recovery Commands

If context is lost:
```
Read .planning/STATE.md for current position
Read .planning/ROADMAP.md for phase structure
Read .planning/REQUIREMENTS.md for requirement details
Read .planning/phases/02.1-dashboard-card-component/ for Phase 2.1 plans
Read .planning/phases/02.1-dashboard-card-component/02.1-02-SUMMARY.md for Plan 02 summary
```

---

*State updated: 2026-01-21*
