# SimWrapper Interactive Dashboard Enhancements

## What This Is

Enhancements to SimWrapper's interactive dashboard system focused on consistent styling, improved cluster analysis capabilities, and advanced visualization features for transportation research. The project addresses styling fragmentation across components, adds sophisticated analysis tools (correlation matrix, dual-map comparison), and fixes UX issues with sub-dashboards.

## Core Value

**One styling configuration controls all visualizations** — eliminating inconsistent colors, broken interactions, and duplicated configuration across dashboards.

## Requirements

### Validated

- Interactive dashboard system with MapCard, PieChartCard, HistogramCard, ScatterCard, DataTableCard
- LinkageManager for cross-card hover/selection synchronization
- colorBy attribute support for dynamic map coloring (categorical and numeric)
- Sub-dashboard rendering via SubDashboard.vue
- Color schemes in colorSchemes.ts (MODE_COLORS, ACTIVITY_COLORS, CATEGORICAL_COLORS)

### Active

- [ ] Global styling configuration via `styling.yaml` with auto-discovery
- [ ] Configurable interaction state colors (hover, selected, dimmed)
- [ ] Configurable OD cluster color scheme (origin, destination, arc)
- [ ] Configurable categorical palettes and numeric gradients
- [ ] Sub-dashboard enlarge button that works (breaks out of container)
- [ ] Correlation matrix card for attribute comparison
- [ ] Dual-map comparison with independent colorBy selectors
- [ ] Correlation matrix → dual map linkage (click cell to configure maps)
- [ ] Synchronized hover/selection across dual maps
- [ ] Timeline visualization for rides (time windows, request grouping)
- [ ] Path cover graph visualization (rides, feasibility edges, chains)

### Out of Scope

- Changes to non-interactive dashboard components — focus on interactive dashboard plugin only
- Real-time data streaming — dashboards work with static analysis outputs
- 3D visualizations — stick with 2D maps and charts
- Mobile-specific layouts — desktop-first for research analysis

## Context

**Existing codebase:** SimWrapper is a mature Vue 2 + TypeScript visualization tool with a plugin-based architecture. The interactive dashboard plugin (`src/plugins/interactive-dashboard/`) has sophisticated linkage and filtering capabilities but suffers from styling fragmentation.

**Current problems identified:**
1. Colors hardcoded across components (MapCard, ScatterCard, HistogramCard each have their own palettes)
2. Interaction states (hover orange `#fbbf24`, selected blue `#3b82f6`) are magic numbers repeated in 4+ files
3. OD cluster colors (origin=blue, destination=red, arc=purple) duplicated in every dashboard YAML
4. Sub-dashboard cards can't be enlarged — CSS containment traps them
5. Limited analysis tools for cluster comparison (no correlation analysis, no dual-map view)

**Data context:** User works with transportation cluster data containing 70+ attributes per cluster:
- Travel behavior: commute times, distances, max travel times
- Mode choice: car/bike percentages, mode scores, PT accessibility
- Demographics: income, age, household size, car availability
- Willingness to pay: max cost, budget, max detour, max walking distance
- Service metrics: requests served/rejected, service rates, cluster prices

**Downstream use:** Dashboards are used for research analysis of commuter behavior, pricing optimization, and cluster-based transportation planning.

## Constraints

- **Tech stack**: Vue 2.7, TypeScript, deck.gl — must work within existing architecture
- **Compatibility**: Changes should not break existing dashboard YAML configurations
- **Performance**: Correlation matrix may involve many attributes — needs efficient computation
- **Contribution potential**: Global styling system could be contributed upstream to SimWrapper

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auto-discover styling.yaml | Avoids breaking existing configs; progressive enhancement | — Pending |
| Start with interactive dashboard scope | Contained scope; can expand to other plugins later | — Pending |
| Use position:fixed for sub-dashboard enlarge | Simplest way to break out of CSS containment | — Pending |
| Correlation matrix as new card type | Fits existing card architecture; reusable | — Pending |
| Dual maps via card configuration | Reuse existing MapCard; add sync capability | — Pending |

---
*Last updated: 2026-01-20 after initialization*
