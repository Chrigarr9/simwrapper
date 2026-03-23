# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- TypeScript 4.2.x - All source code in `src/`

**Secondary:**
- Rust (WASM) - High-performance parsers in `wasm/matsim-event-streamer/` and `wasm/xml-network-parser/`
- Pug - Template language for Vue components (Python-style indentation instead of HTML)
- SCSS/Sass 1.55.0 - Styling in component `<style>` blocks

## Runtime

**Environment:**
- Node.js (ES modules, `"type": "module"` in package.json)
- Browser (modern, WebGL required)

**Package Manager:**
- npm with workspaces (`packages/*`)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Vue 2.7.16 - Component framework (supports Composition API but Options API common)
- Vuex 3.1.3 - Global state management (`src/store.ts`)
- Vue Router 3.5.3 - Client-side routing (`src/router.ts`)

**Testing:**
- Vitest 4.0.12 - Unit tests (`npm run test:run`)
- Playwright 1.56.1 - E2E tests (`npm run test`)

**Build/Dev:**
- Vite 6.4.1 - Build tool and dev server (`vite.config.mts`)
- ESLint 7.x with @typescript-eslint - Linting
- Prettier 2.4.1 - Code formatting (`.prettierrc.cjs`)

## Key Dependencies

### Visualization (Critical for Interactive Dashboard)

**Maps:**
- MapLibre GL 5.6.2 - Base map rendering (`src/plugins/interactive-dashboard/components/cards/MapCard.vue`)
- deck.gl 9.1.14 - WebGL visualization layers
  - `@deck.gl/mapbox` - MapLibre integration
  - `@deck.gl/layers` - PolygonLayer, LineLayer, ArcLayer, ScatterplotLayer
  - `@deck.gl/core` - Position types
  - `@deck.gl/extensions` - Layer extensions
- @luma.gl/core 9.1.9 - Low-level WebGL (deck.gl dependency)

**Charts:**
- Plotly.js 3.1.0 - Interactive charts (HistogramCard, PieChartCard, ScatterCard)
- Vega 5.21.0 / Vega-Lite 5.2.0 - Declarative visualizations
- @simwrapper/d3-sankey-diagram 0.9.1 - Sankey diagrams
- d3 modules (d3-array, d3-scale, d3-scale-chromatic, d3-hexbin) - Data manipulation and colors

**3D:**
- Three.js 0.127.0 - 3D WebGL rendering

### Data Processing

**CSV/Tabular:**
- @simwrapper/papaparse 5.3.2-2 - CSV parsing (used by DataTableManager, LinkedTableManager)
- crossfilter2 1.5.4 - Fast multidimensional filtering

**Geospatial:**
- @turf/turf 5.1.6 - Geospatial analysis
- @math.gl/polygon 3.6.3 - Polygon math
- proj4 2.6.2 - Coordinate transformations
- reproject 1.2.6 - GeoJSON reprojection
- shapefile 0.6.6 - Shapefile parsing
- @ngageoint/geopackage 4.2.6 - GeoPackage format

**Matrix/HDF5:**
- @h5web/app 14.0.1 / @h5web/h5wasm 14.0.1 - HDF5 file viewing
- ndarray 1.0.19 - N-dimensional arrays
- numcodecs 0.3.2 - Compression codecs

**XML:**
- fast-xml-parser 4.5.3 - Fast XML parsing
- sax-wasm 2.2.4 - Streaming XML (WebAssembly)
- libxml2-wasm 0.4.1 - XML validation

**Compression:**
- pako 2.0.4 - Gzip compression/decompression

### UI Components

**Framework:**
- Buefy 0.9.29 - Vue UI components (based on Bulma)
- Bulma 1.0.0 - CSS framework

**Icons:**
- @fortawesome/fontawesome-svg-core 6.4.0 + free icon sets
- Font Awesome 4.7.0 (legacy)

**Utilities:**
- vue-good-table 2.21.11 - Data tables
- vue-virtual-scroll-list 2.3.5 - Virtual scrolling
- vuedraggable 2.24.3 - Drag and drop
- vueperslides 2.15.2 - Carousels
- vue-slide-bar 1.2.0 - Sliders
- medium-zoom 1.0.5 - Image zoom
- lil-gui 0.17.0 - Debug GUI

### Infrastructure

**File Access:**
- @octokit/rest 20.1.1 - GitHub API client
- idb-keyval 6.1.0 - IndexedDB wrapper (local file handles)

**Networking:**
- @flowmap.gl/data 8.0.2 - Flow map data utilities

**Internationalization:**
- vue-i18n 8.22.1 - Multi-language support

**Markdown/Math:**
- markdown-it 12.2.0 - Markdown rendering
- katex 0.16.11 - LaTeX math rendering
- markdown-it-texmath 1.0.0 - Math in markdown
- mathjs 10.0.0 - Math expression parsing
- nerdamer 1.1.11 - Symbolic math

**Utilities:**
- lodash 4.17.21 - General utilities
- moment 2.24.0 - Date/time handling
- js-yaml 4.1.0 / yaml 2.8.0 - YAML parsing
- nanoid 5.0.6 - ID generation
- debounce 1.2.0 - Function debouncing
- colormap 2.3.1 - Color gradient generation

### React Interop

**For H5 viewer components:**
- React 18.3.1 / React DOM 18.3.1 - Used by @h5web components

## Configuration

**Environment:**
- `.env` contains build info: `VITE_COMMIT`, `VITE_TAG`
- Runtime config via `src/fileSystemConfig.ts` (no build-time .env files for sensitive data)

**Build:**
- `vite.config.mts` - Vite configuration with Vue 2 plugin
- `tsconfig.json` - TypeScript config (strict mode, ESNext target)

**Path Aliases:**
- `@/` -> `src/`
- `~/` -> `node_modules/`

## Platform Requirements

**Development:**
- Node.js (modern LTS)
- npm 7+ (for workspaces support)

**Production:**
- Modern browser with WebGL support
- No server-side rendering (static SPA)
- Deployed to GitHub Pages via Travis CI (auto-deploy on master push)

## Interactive Dashboard Specific Stack

The Interactive Dashboard (`src/plugins/interactive-dashboard/`) relies on:

**Managers (TypeScript classes):**
- `FilterManager.ts` - Observer pattern for cross-card filter state
- `LinkageManager.ts` - Coordinates hover/select interactions
- `DataTableManager.ts` - Central data table with CSV parsing via PapaParse
- `LinkedTableManager.ts` - Secondary linked tables

**Cards (Vue components with Composition API):**
- `MapCard.vue` - MapLibre + deck.gl layers
- `HistogramCard.vue` - Plotly.js histograms
- `PieChartCard.vue` - Plotly.js pie/donut charts
- `ScatterCard.vue` - Plotly.js scatter plots
- `DataTableCard.vue` - Central data table display
- `ColorLegend.vue` - Categorical/numeric legends
- `LinkableCardWrapper.vue` - HOC for card coordination

**Key Patterns:**
- Composition API (`<script setup>`) in card components
- Options API with defineComponent in main dashboard
- Deep Vue reactivity for filter/linkage state propagation
- Loose type comparison for ID matching (string "45" vs number 45)

---

*Stack analysis: 2026-01-19*
