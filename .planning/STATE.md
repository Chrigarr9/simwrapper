# Project State: SimWrapper Interactive Dashboard Enhancements

**Initialized:** 2026-01-20
**Last Updated:** 2026-01-20 (Phase 1.1 Testing - Bug fixes during integration testing)

---

## Project Reference

**Core Value:** One styling configuration controls all visualizations

**Current Focus:** Phase 1.1 (Adaptive Layer Coloring) - Plan 02 complete, 1 plan remaining

**Key Files:**
- PROJECT.md - Project definition and constraints
- REQUIREMENTS.md - v1 and v2 requirements with traceability
- ROADMAP.md - Phase structure and success criteria
- research/SUMMARY.md - Technical research synthesis

---

## Current Position

**Phase:** 1.1 of 7 (Adaptive Layer Coloring)
**Plan:** 2 of 3 plans complete + testing session
**Status:** In progress (testing discovered bugs, all fixed)
**Last activity:** 2026-01-20 - Integration testing with cluster visualization, multiple bug fixes

**Progress:**
```
Phase 1:   Theming Foundation       [####] 100% (4/4 plans) COMPLETE
Phase 1.1: Adaptive Layer Coloring  [##  ] 67% (2/3 plans)
Phase 2:   Sub-Dashboard Fix        [    ] 0%
Phase 3:   Correlation Analysis     [    ] 0%
Phase 4:   Dual Maps                [    ] 0%
Phase 5:   Timeline                 [    ] 0%
Phase 6:   Graph Visualization      [    ] 0%
```

**Overall:** Phase 1.1 Plan 02 complete. LayerColoringManager integrated into MapCard with role-aware coloring. Ready for Plan 03 (YAML config and documentation).

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 6 |
| Plans requiring revision | 0 |
| Requirements completed | 3/14 (REQ-1.1, REQ-1.2, REQ-1.3) |
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

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1: Adaptive Layer Coloring (URGENT) - 2026-01-20
  - Reason: Cluster visualization issues - colorBy not affecting clusters/arcs, need intelligent layer coloring based on visibility

### TODOs

- [x] Plan Phase 1: Theming Foundation
- [x] Execute Plan 01-01: Create StyleManager core
- [x] Execute Plan 01-02: Migrate MapCard/ColorLegend/InteractiveDashboard
- [x] Execute Plan 01-03: Migrate chart cards (Pie, Histogram, Scatter)
- [x] Execute Plan 01-04: Verification and cleanup
- [x] Plan Phase 1.1: Adaptive Layer Coloring
- [x] Execute Plan 01.1-01: Create LayerColoringManager
- [x] Execute Plan 01.1-02: Integrate into MapCard
- [ ] Execute Plan 01.1-03: YAML config and documentation (NEXT)
- [ ] Plan Phase 2: Sub-Dashboard Fix
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

---

## Session Continuity

### For Next Session

**Where we left off:** Integration testing of Phase 1.1 with cluster visualization. Multiple bugs found and fixed.

**Next action:** Execute Plan 01.1-03 - YAML configuration and documentation. All code fixes complete.

**Testing Session Summary (2026-01-20):**

**Bugs Found and Fixed:**
1. **isLayerVisible() didn't filter by geometryType** - Geometry type selector had no effect
2. **legendData didn't use dashboard-level colorByAttribute** - Legend showed wrong attribute
3. **GeoJSON missing colorBy attributes** - Need CSV data join, not just GeoJSON properties
4. **Data join mismatch** - GeoJSON `cluster_id='0'` didn't match CSV `unique_id='od_0'`
   - Fix: Created `getFeatureId()` helper to construct compound IDs
5. **getFeatureFillColor didn't call getBaseColor()** - Fill layers had no colorBy coloring
6. **OD boundary layers used `type: line`** - LineLayer expects LineString, not Polygon
   - Fix: Changed to `type: fill` with `fillOpacity: 0` for outline-only rendering
7. **Tooltip used hardcoded colors** - Should use StyleManager CSS variables

**Code Changes Made (MapCard.vue):**
- Added `getFeatureId()` helper function for compound ID construction
- Updated `getFeatureFillColor()` to delegate to `getBaseColor()`
- Increased default fill opacity from 0.5 to 0.7
- Added colorBy value display in tooltips with StyleManager CSS styling

**Adaptive Coloring Behavior (Verified):**
- Origin clusters alone: colorBy applied (primary)
- Origin + arcs visible: arcs get colorBy (primary), clusters get neutral styling
- Multiple geometries without arcs: all get colorBy (all primary)

### Recovery Commands

If context is lost:
```
Read .planning/STATE.md for current position
Read .planning/ROADMAP.md for phase structure
Read .planning/REQUIREMENTS.md for requirement details
Read .planning/phases/01.1-adaptive-layer-coloring/01.1-02-SUMMARY.md for latest execution
```

---

*State updated: 2026-01-20*
