# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Plugin-based SPA with Two Dashboard Systems

**Key Characteristics:**
- Plugin architecture where visualizations self-register and activate based on file patterns
- Two distinct dashboard systems: Standard (independent cards) and Interactive (coordinated cards)
- Three-layer architecture in Interactive Dashboard: Data Management, Component, Dashboard
- Observer pattern for cross-component communication in Interactive Dashboard
- File system abstraction supporting HTTP, local files, and GitHub

## Dashboard System Comparison

### Standard Dashboard (`src/layout-manager/DashBoard.vue`)
- Cards render independently with no shared state
- Each card manages its own data loading and display
- No cross-card filtering, highlighting, or selection
- Cards communicate only through Vuex global store (for view state like zoom)

### Interactive Dashboard (`src/plugins/interactive-dashboard/InteractiveDashboard.vue`)
- Centralized data table feeds all visualization cards
- Cross-card coordination via three manager classes
- Cards receive filtered data, hovered IDs, and selected IDs as props
- YAML `table` section triggers Interactive Dashboard mode (detection in `TabbedDashboardView.vue:178-187`)

## Layers

**Dashboard Routing Layer:**
- Purpose: Determines which dashboard component to render
- Location: `src/layout-manager/TabbedDashboardView.vue`
- Contains: Dashboard selection logic, tab management, YAML parsing
- Detection: `getDashboardComponent()` checks for `config.table` to route to InteractiveDashboard

**Data Management Layer (Interactive Dashboard):**
- Purpose: Centralized state coordination across cards
- Location: `src/plugins/interactive-dashboard/managers/`
- Contains:
  - `DataTableManager.ts` - Loads and provides access to central CSV data
  - `FilterManager.ts` - Manages filter state with observer pattern (AND between filters, OR within values)
  - `LinkageManager.ts` - Manages hover/selection state with observer pattern
  - `LinkedTableManager.ts` - Manages secondary tables linked to parent selection
- Depends on: HTTPFileSystem, PapaParse
- Used by: InteractiveDashboard.vue, LinkableCardWrapper.vue

**Component Layer (Interactive Dashboard):**
- Purpose: Interactive visualization cards with linkage support
- Location: `src/plugins/interactive-dashboard/components/cards/`
- Contains:
  - `LinkableCardWrapper.vue` - HOC that injects filtered data and event handlers into cards
  - `MapCard.vue` - deck.gl map with polygon/line/arc/scatterplot layers
  - `HistogramCard.vue` - Binned histogram with click-to-filter
  - `PieChartCard.vue` - Categorical pie chart with click-to-filter
  - `ScatterCard.vue` - X/Y scatter plot with category coloring
  - `DataTableCard.vue` - Sortable, filterable data table
  - `SubDashboard.vue` - Nested dashboard filtered by parent selection
- Depends on: Manager layer via props
- Used by: InteractiveDashboard.vue

**Standard Dash Panels:**
- Purpose: Independent visualization components (no coordination)
- Location: `src/dash-panels/`
- Contains: bar.vue, pie.vue, line.vue, scatter.vue, map visualization wrappers
- Registration: `src/dash-panels/_allPanels.ts` exports `panelLookup` object
- Used by: Both DashBoard.vue and InteractiveDashboard.vue (for non-linkage cards)

**Plugin Layer:**
- Purpose: Full-page visualization plugins activated by file patterns
- Location: `src/plugins/`
- Contains: Self-contained plugin folders (agent-animation, flowmap, shape-file, etc.)
- Registration: `src/plugins/pluginRegistry.ts`

## Data Flow

**Interactive Dashboard Initialization:**

1. `TabbedDashboardView` parses YAML, detects `table` section, routes to `InteractiveDashboard`
2. `InteractiveDashboard.setupDashboard()` calls `initializeCoordinationLayer()`
3. Creates `FilterManager`, `LinkageManager`, `DataTableManager` instances
4. `DataTableManager.loadData()` fetches CSV via `HTTPFileSystem`
5. Managers register observers from `InteractiveDashboard` for table reactivity
6. Cards are wrapped in `LinkableCardWrapper` which observes managers
7. Initial `filteredData` computed and passed to all linkable cards

**User Interaction Flow (Filter):**

1. User clicks histogram bar in `HistogramCard`
2. `HistogramCard` emits `@filter` event with `{filterId, column, values, type, binSize}`
3. `LinkableCardWrapper.handleFilter()` calls `FilterManager.setFilter()`
4. `FilterManager.notifyObservers()` triggers all registered observers
5. `LinkableCardWrapper.updateFilteredData()` recomputes filtered data
6. New `filteredData` flows to all cards via slot props
7. Cards re-render with filtered dataset

**User Interaction Flow (Hover/Select):**

1. User hovers feature on `MapCard`
2. `MapCard` emits `@hover` with Set of IDs
3. `LinkableCardWrapper.handleHover()` calls `LinkageManager.setHoveredIds()`
4. `LinkageManager.notifyHover()` triggers observers
5. `InteractiveDashboard` updates `tableHoveredIds` reactive ref
6. Data table scrolls to and highlights hovered row
7. Other cards receive `hoveredIds` prop and highlight matching elements

**State Management:**
- Global UI state in Vuex (`src/store.ts`): theme, zoom, window state, file systems
- Dashboard coordination state in manager classes: filters, hover, selection
- Card-local state in component data/refs: loading, legend, internal calculations

## Key Abstractions

**LinkableCardWrapper:**
- Purpose: Injects coordination capabilities into any card component
- Location: `src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue`
- Pattern: Scoped slot that provides `filteredData`, `hoveredIds`, `selectedIds`, event handlers
- Cards emit raw events, wrapper translates to manager calls

**FilterManager:**
- Purpose: Multi-filter state with observer notifications
- Location: `src/plugins/interactive-dashboard/managers/FilterManager.ts`
- Pattern: Observer pattern with Set-based filter storage
- Filter logic: AND between different filters, OR within a filter's values
- Supports `categorical`, `range`, `time`, and `binned` filter types

**LinkageManager:**
- Purpose: Hover and selection state coordination
- Location: `src/plugins/interactive-dashboard/managers/LinkageManager.ts`
- Pattern: Observer pattern with Set-based ID storage
- Methods: `setHoveredIds`, `setSelectedIds`, `toggleSelectedIds`

**DataTableManager:**
- Purpose: Central data storage and access
- Location: `src/plugins/interactive-dashboard/managers/DataTableManager.ts`
- Pattern: Simple data container with CSV parsing
- Methods: `getData`, `getRowById`, `getColumnValues`

## Entry Points

**Main App Entry:**
- Location: `src/main.ts`
- Triggers: App startup
- Responsibilities: Vue app initialization, router setup, Vuex store creation

**Dashboard View Entry:**
- Location: `src/layout-manager/TabbedDashboardView.vue`
- Triggers: Route navigation to folder with dashboard YAML
- Responsibilities: Detect dashboard type, parse YAML, render appropriate dashboard component

**Interactive Dashboard Entry:**
- Location: `src/plugins/interactive-dashboard/InteractiveDashboard.vue`
- Triggers: YAML with `table` section detected by `TabbedDashboardView`
- Responsibilities: Initialize managers, load data, render layout with linkable cards

## Error Handling

**Strategy:** Graceful degradation with user-visible error messages

**Patterns:**
- File loading errors caught in managers, emitted as events to dashboard
- Card errors collected in `card.errors[]` array, displayed in error overlay
- Missing YAML properties default to sensible fallbacks
- Debug logging via `src/plugins/interactive-dashboard/utils/debug.ts`

## Cross-Cutting Concerns

**Logging:**
- `debugLog()` utility in Interactive Dashboard (`utils/debug.ts`)
- Controlled by environment or debug flag
- Prefixed with component name for traceability

**Validation:**
- YAML schema implicit - missing keys use defaults
- Type coercion in FilterManager for string/number ID matching
- Loose comparison for cross-type ID matching (`==` used intentionally)

**Authentication:**
- Handled at file system level via HTTPFileSystem
- Credentials stored in Vuex store
- Chrome file handle permissions requested via API

---

*Architecture analysis: 2026-01-19*
