# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Plugin-based Single Page Application with layered data management

**Key Characteristics:**
- Vue 2.7 SPA with TypeScript and Pug templates
- Plugin system for visualization types activated by file patterns
- Two dashboard systems: standard (independent cards) and interactive (coordinated cards)
- Multiple file system backends (HTTP, local Chrome FS, GitHub, Flask)
- WebGL-based map rendering via deck.gl and MapLibre GL
- Web Workers for heavy data processing

## Layers

**Application Shell Layer:**
- Purpose: Bootstrap app, manage global state, handle routing
- Location: `src/main.ts`, `src/App.vue`, `src/router.ts`, `src/store.ts`
- Contains: Vue app initialization, Vuex store, route definitions
- Depends on: Vue, Vuex, VueRouter
- Used by: All components via dependency injection

**Layout Management Layer:**
- Purpose: Manage view composition, navigation, split panels
- Location: `src/layout-manager/`
- Contains: Main layout components, dashboard routing, folder browsing
- Depends on: Vuex store, HTTP file system, Plugin registry
- Used by: Router as primary view containers
- Key files:
  - `src/layout-manager/LayoutManager.vue` - Main split-panel layout
  - `src/layout-manager/TabbedDashboardView.vue` - Dashboard tab routing
  - `src/layout-manager/FolderBrowser.vue` - File/folder navigation
  - `src/layout-manager/DashBoard.vue` - Standard dashboard renderer

**Plugin Layer:**
- Purpose: Self-contained visualization implementations
- Location: `src/plugins/`
- Contains: One folder per visualization type, each with main Vue component
- Depends on: File system utilities, deck.gl, global store
- Used by: Layout manager via dynamic component loading
- Registration: `src/plugins/pluginRegistry.ts`
- Key plugins:
  - `src/plugins/interactive-dashboard/` - Coordinated dashboard system
  - `src/plugins/shape-file/` - GeoJSON/shapefile map viewer
  - `src/plugins/xy-hexagons/` - Hexbin aggregation visualization
  - `src/plugins/vehicle-animation/` - Animated vehicle trajectories
  - `src/plugins/layer-map/` - Multi-layer map visualization

**Dashboard Panel Layer:**
- Purpose: Reusable chart/visualization components for dashboards
- Location: `src/dash-panels/`
- Contains: Individual chart types (bar, pie, scatter, etc.)
- Depends on: Plotly, data managers
- Used by: Dashboard components
- Registration: `src/dash-panels/_allPanels.ts`

**Interactive Dashboard Layer:**
- Purpose: Coordinated visualizations with shared data state
- Location: `src/plugins/interactive-dashboard/`
- Contains: Three sub-layers:
  - Managers (`managers/`) - Data, filter, linkage state
  - Cards (`components/cards/`) - Interactive visualization cards
  - Main component (`InteractiveDashboard.vue`) - Orchestration
- Depends on: FilterManager, DataTableManager, LinkageManager
- Used by: TabbedDashboardView when config has `table` section

**Data Management Layer:**
- Purpose: Load, cache, filter, and transform datasets
- Location: `src/js/DashboardDataManager.ts`, `src/plugins/interactive-dashboard/managers/`
- Contains: Data loading, caching, filtering logic
- Depends on: HTTPFileSystem, Web Workers
- Used by: Dashboard components, visualization plugins

**File System Layer:**
- Purpose: Abstract file access across multiple backends
- Location: `src/js/HTTPFileSystem.ts`, `src/fileSystemConfig.ts`
- Contains: File system implementations (HTTP, Chrome Local FS, GitHub, Flask)
- Depends on: Fetch API, Chrome File System Access API, Octokit
- Used by: All data-loading components

**Web Worker Layer:**
- Purpose: Offload heavy data processing from main thread
- Location: `src/workers/`
- Contains: Data fetching, XML parsing, network loading workers
- Depends on: Comlink for worker communication
- Used by: DashboardDataManager, visualization plugins
- Key workers:
  - `src/workers/DataFetcher.worker.ts` - CSV/data parsing
  - `src/workers/RoadNetworkLoader.worker.ts` - Network file parsing
  - `src/workers/WasmXmlNetworkParser.worker.ts` - WASM XML parsing

**Shared Components Layer:**
- Purpose: Reusable UI components
- Location: `src/components/`
- Contains: Breadcrumbs, color selectors, time sliders, modals
- Depends on: Buefy UI framework
- Used by: Layout and plugin components

## Data Flow

**Standard Dashboard Flow:**

1. User navigates to folder via URL or FolderBrowser
2. TabbedDashboardView detects `dashboard-*.yaml` files
3. YAML parsed; config passed to DashBoard component
4. DashBoard renders cards using panelLookup registry
5. Each card loads its own data via DashboardDataManager
6. Cards render independently (no cross-card interaction)

**Interactive Dashboard Flow:**

1. TabbedDashboardView detects `config.table` in YAML
2. InteractiveDashboard component instantiated instead of DashBoard
3. Managers initialized: FilterManager, DataTableManager, LinkageManager
4. Central data table loaded from config.table.dataset
5. Cards wrapped in LinkableCardWrapper for coordination
6. User interaction triggers manager updates
7. Managers notify observers; cards re-render with filtered data

**File Access Flow:**

1. Component requests file via HTTPFileSystem
2. HTTPFileSystem determines backend (HTTP/Chrome/GitHub/Flask)
3. Backend fetches file, applies caching
4. File returned as text, JSON, or Blob
5. Component parses/processes data

**State Management:**
- Global UI state via Vuex store (`src/store.ts`)
- Plugin state via component-local data/props
- Interactive dashboard state via manager classes (observer pattern)

## Key Abstractions

**VisualizationPlugin:**
- Purpose: Define a visualization type that activates on file patterns
- Examples: `src/plugins/shape-file/`, `src/plugins/xy-hexagons/`
- Pattern: Self-registration via pluginRegistry with kebab-name and file patterns

**FileSystemConfig:**
- Purpose: Define a data source (HTTP server, local folder, GitHub repo)
- Examples: See `src/fileSystemConfig.ts`
- Pattern: Configured at build time or runtime via localStorage

**DashboardDataManager:**
- Purpose: Central data loading and caching for dashboard components
- Examples: Instantiated per TabbedDashboardView
- Pattern: Singleton per dashboard with dataset caching

**FilterManager (Interactive):**
- Purpose: Coordinate filter state across cards
- Examples: `src/plugins/interactive-dashboard/managers/FilterManager.ts`
- Pattern: Observer pattern with Map-based filter storage

**LinkableCardWrapper:**
- Purpose: Add hover/select/filter capabilities to any card
- Examples: `src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue`
- Pattern: Scoped slot wrapper providing filteredData, hoveredIds, selectedIds

## Entry Points

**Browser Entry:**
- Location: `index.html` -> `src/main.ts`
- Triggers: Page load
- Responsibilities: Vue app mount, plugin registration, theme init

**Router Entry:**
- Location: `src/router.ts`
- Triggers: URL navigation
- Responsibilities: Route to LayoutManager (catch-all) or specific plugins

**LayoutManager Entry:**
- Location: `src/layout-manager/LayoutManager.vue`
- Triggers: All non-specific routes
- Responsibilities: Parse URL path, load file system, render panels

**Plugin Activation:**
- Location: `src/plugins/pluginRegistry.ts`
- Triggers: File pattern match (e.g., `*.geojson` activates shape-file plugin)
- Responsibilities: Return appropriate plugin component

**Dashboard Detection:**
- Location: `src/layout-manager/TabbedDashboardView.vue:178`
- Triggers: `config.table` presence in YAML
- Responsibilities: Route to InteractiveDashboard vs DashBoard

## Error Handling

**Strategy:** Graceful degradation with user-visible error messages

**Patterns:**
- File load errors: Display error message in panel, continue rendering other content
- Network errors: Check online/offline mode, fall back to offline map styles
- Parse errors: Log to console, show error text in card frame
- Authentication: Prompt for credentials when 401/403 received

## Cross-Cutting Concerns

**Logging:** Console-based with debug utility (`src/plugins/interactive-dashboard/utils/debug.ts`)
**Validation:** YAML config validation at parse time
**Authentication:** HTTP Basic auth via Vuex credentials store, prompted on demand
**Theming:** Light/dark mode via Vuex state, CSS classes, localStorage persistence
**Internationalization:** vue-i18n with en/de locale support

---

*Architecture analysis: 2026-01-19*
