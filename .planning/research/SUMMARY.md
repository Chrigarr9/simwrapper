# Research Summary: SimWrapper Interactive Dashboard Enhancements

**Synthesized:** 2026-01-20
**Overall Confidence:** HIGH

---

## Executive Summary

SimWrapper's Interactive Dashboard enhancement project involves adding five major feature areas to an existing, well-structured Vue 2.7 + TypeScript + deck.gl codebase: global theming configuration, correlation analysis tools, dual-map synchronization, timeline visualizations, and graph/network visualizations. The existing three-layer architecture (managers, wrapper, cards) provides a solid foundation that new features should extend rather than replace.

The recommended approach leverages existing dependencies wherever possible. Plotly.js (already at v3.1.0) handles correlation matrices and timelines. Deck.gl and MapLibre (already integrated) handle dual-map synchronization through a new MapSyncManager. Only graph visualization requires a new dependency (vue-cytoscape). The critical path involves establishing a theming foundation first--the codebase has 1,034 hardcoded hex colors across 152 files that must be systematically migrated to prevent "half-themed" inconsistencies.

Key risks include: dual-map synchronization loops (mitigate with single-leader pattern), O(n^2) correlation computation with 70+ attributes (mitigate with Web Workers and attribute limits), and CSS containment blocking fullscreen in sub-dashboards (mitigate with portal pattern). All new card types should follow the established pattern: receive `filteredData`, `hoveredIds`, `selectedIds` as props; emit `filter`, `hover`, `select` events through LinkableCardWrapper; register in `_allPanels.ts`.

---

## Key Findings

### From STACK.md: Technology Recommendations

| Component | Recommendation | Rationale |
|-----------|---------------|-----------|
| **Theming** | CSS Custom Properties + Vuex | Already implemented; extend with dashboard-level overrides via new StyleManager |
| **Correlation Matrix** | Plotly.js heatmap | Already in codebase (v3.1.0); use mathjs (v10.0.0) for Pearson calculation |
| **Dual Maps** | deck.gl multi-view OR two MapLibre instances with manual sync | Avoid polling; use single-leader event pattern |
| **Timeline** | Plotly.js with rangeslider | Use existing dependency; only add vis-timeline if drag-drop editing needed |
| **Graph Viz** | Cytoscape.js + vue-cytoscape | Industry standard; MIT licensed; tested to 10k nodes |

**New dependencies required:** vue-cytoscape (~400KB gzipped)
**Optional:** vis-timeline (~150KB gzipped) only if complex scheduling UI needed

**What NOT to use:**
- Vuetify (Vue 3 focused, incompatible with Buefy)
- Tailwind CSS (conflicts with existing Bulma/SCSS)
- D3.js for charts (Plotly already handles use cases)
- Leaflet/OpenLayers (redundant with MapLibre/deck.gl)

### From FEATURES.md: Feature Prioritization

**Table Stakes (Must Have):**
- Dark/light mode toggle with persistence and system preference detection
- WCAG contrast compliance (4.5:1 minimum)
- Correlation matrix heatmap with interactive tooltips
- Synchronized pan/zoom for dual maps with linked hover
- Time range slider for temporal filtering
- Node-link diagram with pan/zoom for network visualization

**Differentiators (Should Have):**
- CSS variable architecture for nested themes
- Attribute selector panel for choosing which of 70+ attributes to correlate
- Click-to-scatter-plot drill-down from correlation cells
- Swipe comparison mode for maps
- Brushable time selection integrated with filter system
- OD flow visualization with arc/chord representation

**Defer to v2+:**
- Gantt-style time windows (high complexity)
- Full network analysis features (filtering by centrality, edge bundling)
- Adaptive UI themes (time-of-day switching)
- Difference maps (requires computational layer)
- Dendrograms for hierarchical clustering

**Complexity Estimates:**
- Theming: 2-3 weeks
- Correlation: 3-4 weeks
- Multi-view Maps: 3-4 weeks
- Timeline: 2-3 weeks
- Network/Graph: 4-6 weeks
- **Total MVP (theming + correlation + maps):** 8-12 weeks

### From ARCHITECTURE.md: Integration Patterns

**New Components to Create:**

| Component | Location | Purpose |
|-----------|----------|---------|
| StyleManager | `managers/StyleManager.ts` | Centralized color/theme configuration |
| MapSyncManager | `managers/MapSyncManager.ts` | Coordinate camera/hover across multiple maps |
| CorrelationMatrixCard | `cards/CorrelationMatrixCard.vue` | Heatmap of attribute correlations |
| TimelineCard | `cards/TimelineCard.vue` | Temporal aggregation and filtering |
| GraphCard | `cards/GraphCard.vue` | Network visualization |

**Critical Integration Points:**
1. All cards must follow LinkableCardWrapper pattern (receive slot props, emit events)
2. Register new cards in `_allPanels.ts`
3. Add type definitions in `InteractiveDashboardConfig.ts`
4. StyleManager replaces direct imports of `colorSchemes.ts`

**Anti-Patterns to Avoid:**
- Direct Vuex mutations from cards (use events through wrapper)
- Bypassing LinkableCardWrapper (cards should not subscribe to managers directly)
- Tight coupling between cards (communicate via managers only)
- Duplicating color logic (centralize in StyleManager)

### From PITFALLS.md: Critical Risks

**Critical Pitfalls (cause significant rework):**

| # | Pitfall | Impact | Prevention |
|---|---------|--------|------------|
| 1 | Incomplete theming migration | Half-themed UI in dark/light modes | Create color registry first; audit all contexts; migrate by context type not by component |
| 2 | Dual-map sync via polling | Infinite loops, janky animation, race conditions | Single-leader pattern; consider deck.gl multi-view; debounce sync events |
| 3 | O(n^2) correlation computation | UI freeze with 70+ attributes | Web Worker; progressive computation; limit default attributes to 10-15 |
| 4 | CSS containment blocking fullscreen | Cards clipped in sub-dashboards | Use portal pattern (teleport to body) for fullscreen |

**Moderate Pitfalls (cause delays):**

| # | Pitfall | Impact | Prevention |
|---|---------|--------|------------|
| 5 | D3/Vue DOM conflicts | Lost interactivity after re-render | Isolate D3 in dedicated SVG; use refs not selectors; explicit lifecycle management |
| 6 | Timeline data volume | Freeze with large temporal datasets | Time-window fetching; pre-aggregated resolutions; debounce scrubber |
| 7 | Magic numbers for interaction states | Inconsistent hover/select feedback | Create interaction tokens alongside color registry |
| 8 | Observer memory leaks | Growing memory, ghost updates | WeakRef for observers; return unsubscribe functions; cleanup on unmount |

---

## Implications for Roadmap

### Suggested Phase Structure

**Phase 1: Theming Foundation** (2-3 weeks)
- **Rationale:** All other features depend on consistent color handling; prevents "half-themed" bugs
- **Delivers:** StyleManager, color registry, interaction tokens, dark/light mode parity
- **Features:** CSS variable architecture, theme persistence, WCAG compliance audit
- **Pitfalls to avoid:** #1 (incomplete migration), #7 (magic numbers)
- **Research needed:** No - patterns are well-documented in existing codebase

**Phase 2: Correlation Analysis** (3-4 weeks)
- **Rationale:** High-value analysis capability; uses existing Plotly dependency
- **Delivers:** CorrelationMatrixCard, attribute selector, scatter drill-down
- **Features:** Correlation matrix heatmap, clickable cells, filter-aware recalculation
- **Pitfalls to avoid:** #3 (O(n^2) performance), #9 (Plotly re-renders)
- **Research needed:** Yes - determine optimal attribute limits and Web Worker architecture

**Phase 3: Map Comparison** (3-4 weeks)
- **Rationale:** Spatial comparison is core to transportation analysis; extends existing MapCard
- **Delivers:** MapSyncManager, synchronized dual maps, swipe comparison
- **Features:** Side-by-side layout, linked hover, sync toggle
- **Pitfalls to avoid:** #2 (sync loops), #8 (observer leaks)
- **Research needed:** Yes - deck.gl multi-view vs multiple instances tradeoffs

**Phase 4: Timeline Visualization** (2-3 weeks)
- **Rationale:** Temporal analysis needed for ride request patterns; uses existing Plotly
- **Delivers:** TimelineCard, time range filtering, brushable selection
- **Features:** Time aggregation histogram, range slider, animation controls
- **Pitfalls to avoid:** #6 (data volume), #10 (loading states)
- **Research needed:** Partial - need to assess data volume expectations

**Phase 5: Network Visualization** (4-6 weeks)
- **Rationale:** OD flow analysis is valuable but requires new dependency; highest complexity
- **Delivers:** GraphCard, node-link diagram, OD flow arcs
- **Features:** Force-directed layout, node/edge styling, graph-table linkage
- **Pitfalls to avoid:** #5 (DOM conflicts), #8 (observer leaks)
- **Research needed:** Yes - vue-cytoscape integration patterns, performance with large graphs

### Dependency Graph

```
Phase 1: Theming Foundation
    |
    +---> Phase 2: Correlation Analysis (depends on StyleManager)
    |
    +---> Phase 3: Map Comparison (depends on StyleManager)
    |         |
    |         +---> Phase 4: Timeline (can start parallel to Phase 3)
    |
    +---> Phase 5: Network (depends on StyleManager, can start after Phase 2)
```

### Research Flags

| Phase | Research Requirement | Why |
|-------|---------------------|-----|
| Phase 1 | Skip research | Patterns well-documented in existing codebase and CSS specs |
| Phase 2 | `/gsd:research-phase` | Web Worker architecture, optimal attribute limits for performance |
| Phase 3 | `/gsd:research-phase` | deck.gl multi-view vs multiple MapLibre instances, WebGL context limits |
| Phase 4 | Light research | Data volume assessment, aggregation strategy |
| Phase 5 | `/gsd:research-phase` | vue-cytoscape integration, D3 vs vis-network comparison, large graph handling |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack well-established; additions verified against package.json and docs |
| Features | MEDIUM-HIGH | Based on industry best practices and domain analysis; some complexity estimates uncertain |
| Architecture | HIGH | Thorough codebase analysis; patterns clearly documented in existing code |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls have direct codebase evidence; moderate pitfalls from pattern analysis |

### Gaps to Address During Planning

1. **Exact attribute limits for correlation matrix** - Need performance testing to determine practical upper bound (suggested starting point: 15-20)
2. **Data volume for timeline features** - How many timestamped events in typical datasets? Determines windowing strategy
3. **WebGL context budget** - How many simultaneous maps can browser/hardware support? Affects dual-map architecture
4. **Graph size expectations** - How many nodes/edges in OD flow data? Affects library choice (cytoscape vs sigma.js)
5. **Sub-dashboard fullscreen requirements** - Confirm portal pattern acceptable or if CSS containment removal is preferred

---

## Sources

### Stack Research
- Plotly.js Heatmaps Documentation
- deck.gl Views and Projections Documentation
- Cytoscape.js Official Documentation
- vue-cytoscape GitHub Repository
- vis-timeline Documentation

### Feature Research
- Smashing Magazine - Inclusive Dark Mode Design
- ArcGIS Dashboards 2025 Review
- Cambridge Intelligence - Network Visualization
- Grafana State Timeline Documentation
- Transportation OD Flow Visualization (LinkedIn)

### Architecture Sources
- Direct codebase analysis: InteractiveDashboard.vue, MapCard.vue, FilterManager.ts, LinkageManager.ts, DataTableManager.ts
- CLAUDE.md project documentation

### Pitfalls Research
- deck.gl MapLibre Integration Documentation
- MapLibre Sync Movement Examples
- CSS contain property guides
- Vue 2 to Vue 3 Migration Guide
- D3.js graph visualization guides
