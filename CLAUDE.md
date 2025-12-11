# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SimWrapper is an interactive data visualization tool for transportation simulations and analysis. Built as a Vue 2 SPA with TypeScript, it uses deck.gl/ThreeJS for WebGL visualizations and supports multiple file storage backends.

**Live Site:** https://simwrapper.app
**Documentation:** https://docs.simwrapper.app/docs

## Development Commands

```bash
# Install dependencies
npm ci

# Development server with hot reload (http://localhost:8080)
npm run dev

# Production build
npm run build

# Run tests (vitest)
npm run test:run

# Run tests with UI
npm run test:ui

# Build WASM modules (if needed)
npm run wasm
```

## Core Technologies

- **TypeScript** - All code must be TypeScript
- **Vue 2.7** - Component framework with Composition API support
- **Pug** - Template language (Python-style indentation instead of HTML tags)
- **Vite** - Build tool and dev server
- **Vuex** - Global state management (`src/store.ts`)
- **deck.gl** - WebGL visualization layers
- **MapLibre GL** - Base map rendering

## Architecture

### Plugin System

SimWrapper uses a plugin-based architecture. Each visualization type is a plugin:

- **Location:** `src/plugins/`
- **Registration:** `src/plugins/pluginRegistry.ts` - Register new plugins here
- **Pattern:** Each plugin is a self-contained folder with a main `.vue` component
- **Activation:** Plugins activate based on file patterns (e.g., `*.geojson`, `viz-*.yaml`)

### Dashboard System

Two dashboard types exist:

1. **Standard Dashboard** (`src/layout-manager/DashBoard.vue`)
   - Traditional independent visualization cards
   - No cross-card interaction

2. **Interactive Dashboard** (`src/plugins/interactive-dashboard/`)
   - **Activated when:** YAML config contains a `table` section
   - **Detection:** `TabbedDashboardView.vue:178` checks for `config.table`
   - Enables coordinated interactions between cards via centralized data management

### Interactive Dashboard Architecture

The Interactive Dashboard plugin (`src/plugins/interactive-dashboard/`) implements coordinated visualizations:

#### Three-Layer Architecture

**1. Data Management Layer** (`managers/`)
- `DataTableManager.ts` - Manages central data table and provides filtered views
- `FilterManager.ts` - Observer pattern for filter state across cards
- `LinkageManager.ts` - Coordinates card interactions based on linkage configs

**2. Component Layer** (`components/cards/`)
- `LinkableCardWrapper.vue` - Wraps cards to add interactive capabilities
- `HistogramCard.vue` - Interactive histogram with filtering
- `PieChartCard.vue` - Interactive pie chart
- `MapCard.vue` - Interactive map with deck.gl layers and linkage support

**3. Dashboard Layer**
- `InteractiveDashboard.vue` - Main component that initializes managers and orchestrates cards

#### Key Concepts

**Linkage Configuration:**
Cards connect to the central data table via linkage config:

```yaml
linkage:
  type: filter           # 'filter' or 'highlight'
  column: columnName     # Column in central table to link
  behavior: toggle       # 'toggle' or 'replace' for selections
  onHover: highlight     # Optional hover behavior
  onSelect: filter       # Optional selection behavior
```

**Map Layer Linkage:**
Map layers can also link to the central table:

```yaml
layers:
  - name: points
    file: points.geojson
    linkage:
      tableColumn: id       # Column in central data table
      geoProperty: id       # Property in GeoJSON features
      onHover: highlight
      onSelect: filter
```

**Data Flow:**
1. User interacts with a card (hover/click)
2. Card emits event through `LinkableCardWrapper`
3. Wrapper updates `FilterManager` or `LinkageManager`
4. Managers notify all observers
5. Cards receive updated `filteredData`, `hoveredIds`, `selectedIds` props
6. Cards re-render with filtered/highlighted data

### File System

- **HTTP/Subversion servers** - Most common data source
- **Local file handles** - Browser File System Access API
- **GitHub** - Direct repo browsing via Octokit
- **Implementation:** `src/js/HTTPFileSystem.ts` and related utilities

### State Management

Global state in Vuex store (`src/store.ts`):
- View state (camera position, zoom)
- UI state (dark mode, panels, breadcrumbs)
- File system configurations
- User favorites and credentials

## Project Structure

```
src/
├── plugins/               # Visualization plugins
│   ├── interactive-dashboard/
│   │   ├── managers/      # Data/filter/linkage managers
│   │   ├── components/    # Linkable cards (histogram, pie, map)
│   │   ├── InteractiveDashboard.vue
│   │   └── README.md      # Plugin-specific documentation
│   ├── shape-file/        # Map viewer for GeoJSON/shapefiles
│   ├── xy-hexagons/       # Hexbin aggregation
│   └── ...                # Other plugins
├── layout-manager/        # Main app layout and dashboard views
│   ├── TabbedDashboardView.vue  # Routes to correct dashboard type
│   ├── DashBoard.vue            # Standard dashboard
│   └── FolderBrowser.vue
├── dash-panels/           # Individual dashboard card types (bar, pie, etc.)
├── components/            # Shared Vue components
├── js/                    # TypeScript utilities
├── store.ts               # Vuex global state
└── router.ts              # Vue Router configuration
```

## Testing

Tests use **vitest** with jsdom environment:

- Test files: `**/__tests__/*.test.ts`
- Run with: `npm run test:run` or `npm run test:ui`
- Example tests in `src/plugins/interactive-dashboard/managers/__tests__/`

### Writing Tests for Interactive Dashboard

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { FilterManager } from '../FilterManager'

describe('FilterManager', () => {
  let manager: FilterManager

  beforeEach(() => {
    manager = new FilterManager()
  })

  it('should add and notify observers', () => {
    // Test implementation
  })
})
```

## Common Development Patterns

### Adding a New Card Type to Interactive Dashboard

1. Create component in `src/plugins/interactive-dashboard/components/cards/YourCard.vue`
2. Implement props interface:
   ```typescript
   interface Props {
     filteredData: any[]       // From LinkableCardWrapper
     hoveredIds?: Set<string>  // Items to highlight
     selectedIds?: Set<string> // Items to filter
     linkage?: LinkageConfig   // Linkage configuration
     // ... card-specific props
   }
   ```
3. Emit events for user interactions (via `LinkableCardWrapper`)
4. Add card type to `InteractiveDashboard.vue` component mapping
5. Document YAML configuration in plugin README

### Working with MapCard Layers

MapCard uses deck.gl layers rendered via MapLibre GL:

- **Supported layer types:** `polygon`, `line`, `arc`, `scatterplot`
- **Styling:** Static colors OR dynamic via `colorBy` attribute mapping
- **Linkage:** Connect layer features to central data table rows
- **File loading:** GeoJSON files loaded via `fileSystemConfig.getFileSystem()`

Example layer with linkage:
```yaml
layers:
  - name: zones
    file: zones.geojson
    type: polygon
    colorBy:
      attribute: population
      type: numeric
      scale: [0, 10000]
    linkage:
      tableColumn: zone_id
      geoProperty: id
      onHover: highlight
      onSelect: filter
```

### Reading YAML Configurations

Dashboard configs are YAML files that define layout and visualizations:

```typescript
// Configs are loaded by TabbedDashboardView and parsed as JavaScript objects
interface DashboardConfig {
  header: { tab: string; title: string; description?: string }
  table?: TableConfig  // Presence triggers InteractiveDashboard
  layout: {
    [rowKey: string]: CardConfig[]
  }
}
```

## Important Constraints

1. **All code must be TypeScript** - No JavaScript files except configs
2. **Use Pug templates** - Not HTML in `.vue` files
3. **Vue 2.7 syntax** - Composition API available but Options API is common
4. **No build-time `.env` files** - Configuration via `src/fileSystemConfig.ts`
5. **WebGL required** - deck.gl/ThreeJS need WebGL support
6. **Travis CI auto-deploys on master push** - Don't push to master until ready for production

## Path Aliases

Configured in `vite.config.mts` and `tsconfig.json`:

- `@/` → `src/`
- `~/` → `node_modules/`

Example: `import globalStore from '@/store'`

## Interactive Dashboard - Current Status

Recent work has implemented full dashboard interactivity:

**MapCard Features:**
- Core MapCard with polygon/line/arc/scatterplot layers
- Dynamic coloring via `colorBy` attribute mapping
- Layer linkage to central data table
- ColorLegend component with filtering support
- Hover/select interactions with highlight/filter behaviors
- Cluster type selector (origin/destination/spatial)
- Color-by attribute selector

**Table Features:**
- Sortable columns (click header to sort)
- Filtered rows highlighted and shown at top
- Auto-scroll to hovered row (map→table sync)
- Fullscreen toggle
- Filter reset button

**Chart Features:**
- PieChartCard with categorical colors (mode-aware colors)
- HistogramCard with binned filtering

### Map Controls Configuration

```yaml
map:
  controls:
    clusterType: true          # Show cluster type selector
    colorBy: true              # Show color-by selector
  clusterTypes:                # Custom cluster type options
    - value: origin
      label: Origin Clusters
    - value: destination
      label: Destination Clusters
  colorBy:
    default: main_mode
    attributes:
      - attribute: main_mode
        label: Transport Mode
        type: categorical
      - attribute: distance
        label: Distance
        type: numeric
```

### Layer Cluster Type Filtering

Layers can be filtered by cluster type:

```yaml
layers:
  - name: origin-clusters
    file: clusters_origin.geojson
    type: polygon
    clusterType: origin        # Only shown when cluster type = origin
  - name: destination-clusters
    file: clusters_dest.geojson
    type: polygon
    clusterType: destination   # Only shown when cluster type = destination
```

See these docs in `src/plugins/interactive-dashboard/`:
- `MAPCARD_TASKS_PART1_CORE_AND_LAYERS.md`
- `MAPCARD_TASKS_PART2_STYLING_AND_COLORS.md`
- `MAPCARD_TASKS_PART3_INTEGRATION_AND_TESTING.md`
- `MAPCARD_VALIDATION.md`

## Code Style

- **Prettier** enforces formatting - install VS Code extension
- **Indentation:** 2 spaces (Pug requires consistent indentation)
- **Imports:** Group by external, internal, relative
- **Naming:** camelCase for variables/functions, PascalCase for components/classes

## Resources

- **Main Docs:** https://docs.simwrapper.app/docs
- **Vue 2 Guide:** https://v2.vuejs.org/v2/guide/
- **deck.gl:** https://deck.gl/docs
- **Pug:** https://pugjs.org
