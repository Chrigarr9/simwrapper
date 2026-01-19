# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
simwrapper/
├── src/                    # Main source code
│   ├── plugins/            # Visualization plugins (one folder each)
│   ├── layout-manager/     # Main app layout and navigation
│   ├── dash-panels/        # Dashboard card components
│   ├── components/         # Shared Vue components
│   ├── js/                 # TypeScript utilities
│   ├── workers/            # Web Worker scripts
│   ├── layers/             # Custom deck.gl layer implementations
│   ├── assets/             # Images, icons, SVGs
│   ├── sim-runner/         # Simulation execution UI
│   ├── templates/          # Template files
│   ├── polyfills/          # Browser polyfills
│   ├── App.vue             # Root Vue component
│   ├── main.ts             # Application entry point
│   ├── router.ts           # Vue Router configuration
│   ├── store.ts            # Vuex state store
│   ├── Globals.ts          # Global types and constants
│   ├── fileSystemConfig.ts # File system definitions
│   └── styles.scss         # Global SCSS styles
├── public/                 # Static assets (copied to dist)
│   ├── colors/             # Color palette files
│   ├── data/               # Sample data files
│   ├── images/             # Static images
│   ├── map-styles/         # MapLibre style definitions
│   ├── webfonts/           # Font files
│   └── *.wasm              # WebAssembly modules
├── tests/                  # E2E tests (Playwright)
├── scripts/                # Build/utility scripts
├── wasm/                   # WASM source code
├── .planning/              # Planning documents
│   └── codebase/           # Architecture documentation
├── index.html              # HTML entry point
├── vite.config.mts         # Vite build configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # NPM dependencies
```

## Directory Purposes

**`src/plugins/`:**
- Purpose: Self-contained visualization implementations
- Contains: One folder per visualization type
- Key files:
  - `pluginRegistry.ts` - Plugin registration and file pattern matching
  - `interactive-dashboard/` - Coordinated dashboard system
  - `shape-file/` - GeoJSON/shapefile viewer
  - `xy-hexagons/` - Hexbin aggregation
  - `vehicle-animation/` - Animated trajectories
  - `layer-map/` - Multi-layer maps
  - `matrix/` - Matrix visualization
  - `sankey/` - Sankey diagrams

**`src/layout-manager/`:**
- Purpose: Main application layout, navigation, dashboard containers
- Contains: Split-panel layout, tabbed views, folder browsing
- Key files:
  - `LayoutManager.vue` - Main split-panel layout (37KB)
  - `TabbedDashboardView.vue` - Dashboard tab management (26KB)
  - `DashBoard.vue` - Standard dashboard renderer (27KB)
  - `FolderBrowser.vue` - File/folder navigation (27KB)
  - `SplashPage.vue` - Landing page
  - `SettingsPanel.vue` - User settings

**`src/dash-panels/`:**
- Purpose: Individual chart/visualization card components
- Contains: One file per chart type
- Key files:
  - `_allPanels.ts` - Panel registration and lookup
  - `bar.vue` - Bar charts
  - `pie.vue` - Pie charts
  - `scatter.vue` - Scatter plots
  - `line.vue` - Line charts
  - `table.vue` - Data tables
  - `heatmap.vue` - Heatmaps
  - `tile.vue` - Metric tiles
  - `text.vue` - Markdown text

**`src/plugins/interactive-dashboard/`:**
- Purpose: Coordinated visualizations with shared state
- Contains: Three-layer architecture
- Key files:
  - `InteractiveDashboard.vue` - Main orchestrating component (66KB)
  - `managers/FilterManager.ts` - Filter state coordination
  - `managers/DataTableManager.ts` - Central data table
  - `managers/LinkageManager.ts` - Card interaction linkage
  - `components/cards/MapCard.vue` - Interactive map (57KB)
  - `components/cards/HistogramCard.vue` - Interactive histogram
  - `components/cards/PieChartCard.vue` - Interactive pie chart
  - `components/cards/DataTableCard.vue` - Interactive data table
  - `components/cards/LinkableCardWrapper.vue` - Card coordination wrapper
  - `components/cards/ScatterCard.vue` - Interactive scatter plot

**`src/components/`:**
- Purpose: Shared reusable UI components
- Contains: Common widgets and utilities
- Key files:
  - `BreadCrumbs.vue` - Navigation breadcrumbs
  - `TimeSlider.vue` - Time selection slider
  - `PlaybackControls.vue` - Animation playback
  - `ZoomButtons.vue` - Map zoom controls
  - `MapScale.vue` - Map scale indicator
  - `ColorMapSelector/` - Color palette selection
  - `viz-configurator/` - Visualization configuration UI

**`src/js/`:**
- Purpose: TypeScript utility classes and functions
- Contains: File system, data processing, coordinates
- Key files:
  - `HTTPFileSystem.ts` - File access abstraction (24KB)
  - `DashboardDataManager.ts` - Data loading/caching (28KB)
  - `ColorsAndWidths.ts` - Color scale utilities (35KB)
  - `Coords.ts` - Coordinate transformations
  - `DeckMap.ts` - deck.gl map utilities
  - `util.ts` - General utilities

**`src/workers/`:**
- Purpose: Web Worker scripts for background processing
- Contains: Heavy data processing workers
- Key files:
  - `DataFetcher.worker.ts` - CSV parsing worker (13KB)
  - `RoadNetworkLoader.worker.ts` - Network loading (20KB)
  - `WasmXmlNetworkParser.worker.ts` - WASM XML parsing (12KB)
  - `MATSimEventStreamer.worker.ts` - Event file streaming

**`src/layers/`:**
- Purpose: Custom deck.gl layer implementations
- Contains: Extended layer classes
- Key files:
  - `GeojsonOffsetLayer.ts` - GeoJSON with offset
  - `LineOffsetLayer.ts` - Lines with offset
  - `PathOffsetLayer.ts` - Paths with offset
  - `PathTraceLayer.ts` - Path trace rendering

**`src/sim-runner/`:**
- Purpose: Simulation execution interface
- Contains: Simulation config and monitoring UI
- Key files:
  - `SimRunner.vue` - Main simulation runner
  - `SimRunDetails.vue` - Run details view
  - `LeftRunnerPanel.vue` - Runner navigation panel

**`public/`:**
- Purpose: Static assets copied directly to build output
- Contains: WASM modules, fonts, images, sample data
- Key files:
  - `sax-wasm.wasm` - XML parsing WASM
  - `sql-wasm.wasm` - SQLite WASM
  - `colors/` - Color palette definitions
  - `map-styles/` - MapLibre GL styles

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell with `#app` mount point
- `src/main.ts`: Vue app bootstrap, plugin registration
- `src/App.vue`: Root component, theme/auth setup

**Configuration:**
- `src/store.ts`: Vuex global state (view state, theme, credentials)
- `src/fileSystemConfig.ts`: File system backend definitions
- `src/Globals.ts`: TypeScript interfaces and constants
- `vite.config.mts`: Vite build configuration
- `tsconfig.json`: TypeScript compiler options

**Core Logic:**
- `src/router.ts`: URL routing to components
- `src/js/HTTPFileSystem.ts`: Multi-backend file access
- `src/js/DashboardDataManager.ts`: Dashboard data loading/caching
- `src/plugins/pluginRegistry.ts`: Plugin registration and matching

**Testing:**
- `src/plugins/interactive-dashboard/managers/__tests__/`: Manager unit tests
- `src/plugins/interactive-dashboard/components/cards/__tests__/`: Card tests
- `tests/`: E2E Playwright tests

## Naming Conventions

**Files:**
- Components: PascalCase `.vue` files (e.g., `MapCard.vue`, `HistogramCard.vue`)
- TypeScript utilities: PascalCase `.ts` (e.g., `FilterManager.ts`, `HTTPFileSystem.ts`)
- Workers: PascalCase with `.worker.ts` suffix (e.g., `DataFetcher.worker.ts`)
- Dash panels: lowercase `.vue` (e.g., `bar.vue`, `pie.vue`)
- Config files: lowercase with dots (e.g., `vite.config.mts`)

**Directories:**
- Plugins: kebab-case (e.g., `interactive-dashboard`, `shape-file`, `xy-hexagons`)
- Components: PascalCase subdirs or kebab-case (e.g., `ColorMapSelector`, `left-panels`)
- General: lowercase (e.g., `js`, `workers`, `assets`)

**Variables/Functions:**
- camelCase for variables and functions
- PascalCase for classes and Vue components
- UPPER_CASE for constants

## Where to Add New Code

**New Visualization Plugin:**
1. Create folder: `src/plugins/{plugin-name}/`
2. Add main component: `src/plugins/{plugin-name}/{PluginName}.vue`
3. Register in: `src/plugins/pluginRegistry.ts`
4. Add file patterns for automatic activation

**New Dashboard Card Type:**
1. Create component: `src/dash-panels/{type}.vue`
2. Register in: `src/dash-panels/_allPanels.ts`
3. Use in YAML configs with `type: {type}`

**New Interactive Card:**
1. Create component: `src/plugins/interactive-dashboard/components/cards/{CardName}.vue`
2. Implement props: `filteredData`, `hoveredIds`, `selectedIds`, `linkage`
3. Emit events: `filter`, `hover`, `select`
4. Register in `_allPanels.ts` if usable in standard dashboards

**New Utility Function:**
- Shared helpers: `src/js/util.ts`
- File system: `src/js/HTTPFileSystem.ts`
- Visualization: `src/js/ColorsAndWidths.ts`

**New Web Worker:**
1. Create: `src/workers/{Name}.worker.ts`
2. Export via Comlink if needed
3. Import with `?worker` suffix in consumer

**New Shared Component:**
- General: `src/components/{ComponentName}.vue`
- Left panels: `src/components/left-panels/`
- Interactive controls: `src/plugins/interactive-dashboard/components/controls/`

## Special Directories

**`.planning/`:**
- Purpose: Project planning and architecture documentation
- Generated: No (manually maintained)
- Committed: Yes

**`coverage/`:**
- Purpose: Test coverage reports
- Generated: Yes (by vitest)
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes (by npm install)
- Committed: No

**`dist/`:**
- Purpose: Production build output
- Generated: Yes (by npm run build)
- Committed: No

**`.venv/`:**
- Purpose: Python virtual environment (for local development tools)
- Generated: Yes
- Committed: No

**`test-results/` and `playwright-report/`:**
- Purpose: E2E test outputs
- Generated: Yes (by Playwright)
- Committed: No

---

*Structure analysis: 2026-01-19*
