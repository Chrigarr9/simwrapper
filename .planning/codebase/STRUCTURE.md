# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
simwrapper/
├── src/
│   ├── plugins/                    # Visualization plugins (self-contained)
│   │   ├── interactive-dashboard/  # NEW: Coordinated dashboard system
│   │   ├── commuter-requests/      # Reference impl (to be deprecated)
│   │   ├── shape-file/             # GeoJSON/Shapefile viewer
│   │   ├── agent-animation/        # MATSim agent animation
│   │   └── ...                     # Other visualization plugins
│   ├── layout-manager/             # Main app layout and routing
│   │   ├── TabbedDashboardView.vue # Dashboard router (chooses Standard vs Interactive)
│   │   ├── DashBoard.vue           # Standard dashboard (no coordination)
│   │   └── FolderBrowser.vue       # File system navigation
│   ├── dash-panels/                # Reusable chart components
│   │   ├── _allPanels.ts           # Panel type registry
│   │   ├── bar.vue                 # Bar chart
│   │   ├── pie.vue                 # Pie chart
│   │   └── ...                     # Other chart types
│   ├── components/                 # Shared Vue components
│   ├── js/                         # TypeScript utilities
│   │   ├── HTTPFileSystem.ts       # File system abstraction
│   │   └── DashboardDataManager.ts # Data caching for dashboards
│   ├── layers/                     # deck.gl layer implementations
│   ├── store.ts                    # Vuex global state
│   ├── router.ts                   # Vue Router configuration
│   └── Globals.ts                  # TypeScript interfaces and constants
├── public/                         # Static assets
├── scripts/                        # Build/deployment scripts
├── .planning/                      # GSD planning documents
│   └── codebase/                   # Codebase analysis docs
├── vite.config.mts                 # Vite configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies and scripts
```

## Directory Purposes

**`src/plugins/interactive-dashboard/`**
- Purpose: Coordinated visualization system with cross-card interactivity
- Contains: Main component, manager classes, linkable card components
- Key files:
  - `InteractiveDashboard.vue` - Main dashboard orchestrator
  - `managers/FilterManager.ts` - Filter state management
  - `managers/LinkageManager.ts` - Hover/selection coordination
  - `managers/DataTableManager.ts` - Central data storage
  - `components/cards/LinkableCardWrapper.vue` - HOC for card coordination
  - `components/cards/MapCard.vue` - Interactive map with deck.gl
  - `components/cards/HistogramCard.vue` - Binned histogram
  - `components/cards/PieChartCard.vue` - Categorical pie chart
  - `components/cards/ScatterCard.vue` - XY scatter plot
  - `components/cards/DataTableCard.vue` - Sortable/filterable table

**`src/layout-manager/`**
- Purpose: Top-level dashboard routing and layout management
- Contains: Dashboard view components, folder browser
- Key files:
  - `TabbedDashboardView.vue` - Detects dashboard type, manages tabs
  - `DashBoard.vue` - Standard dashboard (independent cards)
  - `FolderBrowser.vue` - File system navigation UI

**`src/dash-panels/`**
- Purpose: Reusable chart components for both dashboard types
- Contains: Chart components and registry
- Key files:
  - `_allPanels.ts` - Maps YAML `type` to Vue components
  - Chart types: `bar.vue`, `pie.vue`, `line.vue`, `scatter.vue`, `heatmap.vue`, etc.

**`src/js/`**
- Purpose: Core TypeScript utilities and services
- Contains: File system, data loading, helpers
- Key files:
  - `HTTPFileSystem.ts` - Abstraction over HTTP/local/GitHub file access
  - `DashboardDataManager.ts` - Caches loaded data for dashboard lifetime

**`src/plugins/commuter-requests/`**
- Purpose: Reference implementation for Interactive Dashboard (to be deprecated)
- Contains: Tightly-coupled implementation that inspired Interactive Dashboard
- Note: Use as reference, but new features should go in `interactive-dashboard/`

## Key File Locations

**Entry Points:**
- `src/main.ts`: Vue app initialization
- `src/App.vue`: Root component
- `src/router.ts`: Route definitions

**Configuration:**
- `vite.config.mts`: Build configuration, path aliases
- `tsconfig.json`: TypeScript compiler options
- `src/fileSystemConfig.ts`: Default file system sources
- `src/Globals.ts`: Shared TypeScript types and constants

**Core Logic:**
- `src/store.ts`: Vuex global state (theme, zoom, file systems)
- `src/js/HTTPFileSystem.ts`: File loading abstraction
- `src/layout-manager/TabbedDashboardView.vue`: Dashboard type routing

**Interactive Dashboard:**
- `src/plugins/interactive-dashboard/InteractiveDashboard.vue`: Main component
- `src/plugins/interactive-dashboard/managers/*.ts`: State managers
- `src/plugins/interactive-dashboard/components/cards/*.vue`: Linkable cards

**Testing:**
- `src/plugins/interactive-dashboard/managers/__tests__/*.test.ts`: Manager unit tests
- `src/plugins/interactive-dashboard/components/cards/__tests__/*.test.ts`: Component tests

## Naming Conventions

**Files:**
- Vue components: `PascalCase.vue` (e.g., `MapCard.vue`, `InteractiveDashboard.vue`)
- TypeScript utilities: `PascalCase.ts` (e.g., `FilterManager.ts`)
- Test files: `ComponentName.test.ts` (e.g., `FilterManager.test.ts`)
- Config files: `kebab-case` (e.g., `vite.config.mts`)

**Directories:**
- Plugins: `kebab-case` (e.g., `interactive-dashboard`, `shape-file`)
- Nested component folders: `kebab-case` (e.g., `components/cards`)

**YAML Dashboard Types:**
- Chart types: `kebab-case` (e.g., `pie-chart`, `scatter-plot`, `data-table`)
- Maps to `panelLookup` keys in `src/dash-panels/_allPanels.ts`

## Where to Add New Code

**New Interactive Card Type:**
1. Create component: `src/plugins/interactive-dashboard/components/cards/YourCard.vue`
2. Implement props interface:
   ```typescript
   interface Props {
     filteredData?: any[]
     hoveredIds?: Set<any>
     selectedIds?: Set<any>
     linkage?: LinkageConfig
     // ... card-specific props
   }
   ```
3. Emit events: `@filter`, `@hover`, `@select` for coordination
4. Register in `src/dash-panels/_allPanels.ts`:
   ```typescript
   'your-card': defineAsyncComponent(() => import('@/plugins/interactive-dashboard/components/cards/YourCard.vue'))
   ```
5. Add tests: `src/plugins/interactive-dashboard/components/cards/__tests__/YourCard.test.ts`

**New Manager Type:**
1. Create class: `src/plugins/interactive-dashboard/managers/YourManager.ts`
2. Implement observer pattern (see `FilterManager.ts` for template)
3. Initialize in `InteractiveDashboard.vue:initializeCoordinationLayer()`
4. Add tests: `src/plugins/interactive-dashboard/managers/__tests__/YourManager.test.ts`

**New Dash Panel (Non-Interactive):**
1. Create component: `src/dash-panels/your-panel.vue`
2. Register in `src/dash-panels/_allPanels.ts`

**New Full Plugin:**
1. Create folder: `src/plugins/your-plugin/`
2. Create main component: `YourPlugin.vue`
3. Register in `src/plugins/pluginRegistry.ts` with file pattern triggers

**Utilities:**
- Interactive Dashboard utils: `src/plugins/interactive-dashboard/utils/`
- Global utils: `src/js/`

## Special Directories

**`node_modules/`**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No

**`dist/`**
- Purpose: Production build output
- Generated: Yes (by `npm run build`)
- Committed: No

**`.planning/`**
- Purpose: GSD planning and analysis documents
- Generated: By GSD commands
- Committed: Yes (project documentation)

**`public/`**
- Purpose: Static assets copied to build output
- Generated: No
- Committed: Yes

**`scripts/`**
- Purpose: Build and deployment automation
- Generated: No
- Committed: Yes

## Path Aliases

Configured in `vite.config.mts` and `tsconfig.json`:

| Alias | Target | Example |
|-------|--------|---------|
| `@/` | `src/` | `import globalStore from '@/store'` |
| `~/` | `node_modules/` | `import '~/maplibre-gl/dist/maplibre-gl.css'` |

## Interactive Dashboard File Tree

```
src/plugins/interactive-dashboard/
├── InteractiveDashboard.vue        # Main component (~1600 lines)
├── InteractiveDashboardConfig.ts   # TypeScript interfaces for YAML config
├── README.md                       # Plugin documentation
├── managers/
│   ├── DataTableManager.ts         # Central data store (~100 lines)
│   ├── FilterManager.ts            # Filter state + observer (~170 lines)
│   ├── LinkageManager.ts           # Hover/select state (~70 lines)
│   ├── LinkedTableManager.ts       # Secondary table linkage (~170 lines)
│   └── __tests__/
│       ├── DataTableManager.test.ts
│       ├── FilterManager.test.ts
│       └── LinkageManager.test.ts
├── components/
│   └── cards/
│       ├── LinkableCardWrapper.vue # HOC for coordination (~130 lines)
│       ├── MapCard.vue             # deck.gl map (~700 lines)
│       ├── HistogramCard.vue       # Binned histogram
│       ├── PieChartCard.vue        # Categorical pie chart
│       ├── ScatterCard.vue         # XY scatter plot
│       ├── DataTableCard.vue       # Sortable table
│       ├── ColorLegend.vue         # Shared legend component
│       ├── LinkedTableCard.vue     # Secondary table display
│       ├── SubDashboard.vue        # Nested dashboard
│       └── __tests__/
│           └── MapCard.test.ts
├── utils/
│   ├── debug.ts                    # Debug logging utility
│   └── colorSchemes.ts             # Color palette definitions
├── docs/                           # Additional documentation
└── examples/                       # Example YAML configurations
    ├── basic/
    ├── commuter-requests/
    └── mapcard/
```

---

*Structure analysis: 2026-01-19*
