# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Duplicate Card Implementations:**
- Issue: Standard Dashboard (`src/layout-manager/DashBoard.vue`) and Interactive Dashboard (`src/plugins/interactive-dashboard/InteractiveDashboard.vue`) share ~70% identical code for card rendering, row layout, and component loading logic
- Files: `src/layout-manager/DashBoard.vue`, `src/plugins/interactive-dashboard/InteractiveDashboard.vue`
- Impact: Bug fixes must be applied twice; features diverge over time; maintenance burden doubles
- Fix approach: Extract shared layout logic into a base component or composable; make InteractiveDashboard extend/wrap standard Dashboard with coordination layer added

**Console.log Statements in Production Code:**
- Issue: 34 `console.log` calls scattered throughout InteractiveDashboard files (visible in `grep -c` results), many are debugging statements that should use debugLog utility
- Files: `src/plugins/interactive-dashboard/InteractiveDashboard.vue` (34 occurrences)
- Impact: Console noise in production; performance impact from string interpolation
- Fix approach: Replace with `debugLog()` from `src/plugins/interactive-dashboard/utils/debug.ts` or remove entirely

**Hardcoded Map Center Coordinates:**
- Issue: Map defaults to Berlin coordinates `[13.4, 52.52]` in multiple places
- Files: `src/plugins/commuter-requests/components/RequestsMap.vue:183`, similar patterns in MapCard
- Impact: Users outside Berlin must always specify center in config
- Fix approach: Auto-calculate bounds from loaded data; make default configurable per project

**CommuterRequests Plugin Not Fully Migrated:**
- Issue: CommuterRequests plugin has unique features not yet available in Interactive Dashboard
- Files:
  - `src/plugins/commuter-requests/components/RequestsMap.vue` (1075 lines) - cluster flow arrows, OD cluster visualization
  - `src/plugins/commuter-requests/components/controls/` - ClusterTypeSelector, ColorBySelector, ComparisonToggle, ScrollToggle, FilterResetButton
  - `src/plugins/commuter-requests/components/stats/` - ActiveTimeHistogramPlotly, MainModePieChartPlotly
- Impact: Cannot deprecate CommuterRequests until all features migrated; users must choose between plugins
- Fix approach: Port cluster flow visualization to MapCard; implement comparison mode; add control components as reusable controls

## Known Bugs

**Filter Reset Leaves Visual State Inconsistent:**
- Symptoms: When clearing filters via reset button, histogram bins may remain visually selected
- Files: `src/plugins/interactive-dashboard/components/cards/HistogramCard.vue:224-227`
- Trigger: Clear filters when histogram has selections, then filter from another card
- Workaround: Manual re-render on data length increase attempts to fix, but race conditions possible

## Security Considerations

**No Input Sanitization for YAML-Driven Content:**
- Risk: YAML configs can specify arbitrary HTML in titles/descriptions; no XSS protection
- Files: `src/layout-manager/DashBoard.vue:40-41`, `src/plugins/interactive-dashboard/InteractiveDashboard.vue`
- Current mitigation: Configs are trusted (from same origin or project files)
- Recommendations: Sanitize HTML content if configs can come from untrusted sources

## Performance Bottlenecks

**Large Dataset Filtering on Every Interaction:**
- Problem: FilterManager.applyFilters runs on full dataset for every hover/selection event
- Files: `src/plugins/interactive-dashboard/managers/FilterManager.ts:79-129`
- Cause: No caching; filtering iterates all rows and all filters on every change
- Improvement path: Add memoization based on filter state hash; consider Web Workers for >10K rows

**Reactive Data Table Re-renders:**
- Problem: Entire table re-renders on any filter/hover change due to Vue reactivity
- Files: `src/plugins/interactive-dashboard/InteractiveDashboard.vue:211-234`
- Cause: `v-for` over `sortedDisplayData` triggers full reconciliation
- Improvement path: Use virtual scrolling (vue-virtual-scroller); limit visible rows; debounce hover events

**MapCard Layer Rebuilds:**
- Problem: All deck.gl layers rebuild on any data change, even if only hover state changed
- Files: `src/plugins/interactive-dashboard/components/cards/MapCard.vue`
- Cause: Layer arrays recreated in computed properties; deck.gl diffing limited
- Improvement path: Use `updateTriggers` more precisely; separate layer data from styling triggers

## Fragile Areas

**InteractiveDashboard Component:**
- Files: `src/plugins/interactive-dashboard/InteractiveDashboard.vue` (900+ lines)
- Why fragile: Monolithic component handling layout, data loading, filtering, table rendering, sub-dashboards, and map controls; many interdependent computed properties
- Safe modification: Split into smaller components; extract table as separate DataTableCard (partially done); extract map controls
- Test coverage: No unit tests for InteractiveDashboard.vue itself

**LinkableCardWrapper Slot Interface:**
- Files: `src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue`
- Why fragile: Complex slot props interface; changes affect all wrapped cards
- Safe modification: Add new props additively; never remove existing slot props
- Test coverage: None

**Dashboard Type Detection:**
- Files: `src/layout-manager/TabbedDashboardView.vue:178-188`
- Why fragile: Simple `config.table` check determines Dashboard vs InteractiveDashboard; false positives possible
- Safe modification: Add explicit `type: 'interactive'` field for clarity
- Test coverage: None

## Scaling Limits

**Data Table Row Limit:**
- Current capacity: Performance degrades noticeably at ~5000 rows
- Limit: Browser tab may freeze at ~50000 rows
- Scaling path: Implement virtual scrolling; server-side pagination for very large datasets

**Concurrent Layer Count:**
- Current capacity: ~10 layers with <1000 features each
- Limit: deck.gl performance degrades with many layers or >100K features
- Scaling path: Layer aggregation; LOD (level of detail); clustering

## Dependencies at Risk

**Vue 2.7 End of Life:**
- Risk: Vue 2 is in maintenance mode; no new features; security patches only until end of 2023
- Impact: Cannot use modern Vue 3 ecosystem; performance improvements unavailable
- Migration plan: Codebase uses Composition API (via Vue 2.7) which eases migration; migrate when deck.gl Vue 3 support stabilizes

**Plotly.js Bundle Size:**
- Risk: Full Plotly import adds ~3MB to bundle
- Impact: Slow initial load; high memory usage
- Migration plan: Switch to plotly.js-dist-min or cherry-pick only needed chart types

## Missing Critical Features

**No Undo/Redo for Filters:**
- Problem: Users cannot step back through filter history
- Blocks: Complex exploratory analysis workflows

**No Export Functionality:**
- Problem: Cannot export filtered data or charts
- Blocks: Reporting workflows; data extraction for external tools

**No URL State Persistence:**
- Problem: Filter/selection state not persisted in URL
- Blocks: Sharing specific views; bookmarking analysis states

**Standard Dashboard Card Types Not All Linkable:**
- Problem: Only histogram, pie-chart, scatter-plot, and map cards support linkage
- Files: `src/dash-panels/_allPanels.ts` - 20+ card types, only 4 in interactive-dashboard
- Blocks: Cannot use bar, line, sankey, heatmap, etc. with coordination

## Test Coverage Gaps

**InteractiveDashboard Core:**
- What's not tested: Main InteractiveDashboard.vue component, data loading, YAML parsing, layout rendering
- Files: `src/plugins/interactive-dashboard/InteractiveDashboard.vue`
- Risk: Regressions in core dashboard rendering go undetected
- Priority: High

**Card Components:**
- What's not tested: HistogramCard, PieChartCard, ScatterCard, LinkedTableCard, SubDashboard - all have 0 tests
- Files: `src/plugins/interactive-dashboard/components/cards/*.vue`
- Risk: Filter/selection logic changes break card behavior
- Priority: High

**MapCard Integration:**
- What's not tested: Layer creation, color management, event emission, hover/select state styling (per TODO in test file)
- Files: `src/plugins/interactive-dashboard/components/cards/__tests__/MapCard.test.ts` (only 3 basic tests)
- Risk: deck.gl layer configuration regressions; linkage integration bugs
- Priority: High

**Manager Classes:**
- What's not tested: DataTableManager.loadData, LinkedTableManager entirely
- Files: `src/plugins/interactive-dashboard/managers/__tests__/` (only FilterManager and LinkageManager have tests)
- Risk: Data loading bugs; linked table filtering bugs
- Priority: Medium

**Integration Tests:**
- What's not tested: End-to-end filter flow from card click to table update; map<->table hover synchronization
- Files: No integration test files exist
- Risk: Component interactions break; filter propagation fails
- Priority: Medium

## Integration Gaps for Full Dashboard Replacement

**Subtab Support:**
- Status: Standard Dashboard supports subtabs via `subtabs:` YAML; InteractiveDashboard does not
- Files: `src/layout-manager/DashBoard.vue:424-522` (subtab logic not in InteractiveDashboard)
- Impact: Cannot replace dashboards that use subtabs

**Full-Screen Dashboard Mode:**
- Status: Standard Dashboard supports `fullScreen: true` header option; InteractiveDashboard partially supports
- Files: `src/layout-manager/DashBoard.vue:659-671`
- Impact: Full-screen layouts may not render identically

**Dashboard Favorites:**
- Status: Standard Dashboard integrates with favorites system; InteractiveDashboard copies this but may diverge
- Files: Both files have similar clickedFavorite methods
- Impact: Minor - both work, but code duplication

**Dimension Resizer Interface:**
- Status: Standard Dashboard cards can register dimension resizers; InteractiveDashboard passes through but not all cards use
- Files: `src/layout-manager/DashBoard.vue:293-296`
- Impact: Some cards may not resize properly in InteractiveDashboard

---

*Concerns audit: 2026-01-19*
