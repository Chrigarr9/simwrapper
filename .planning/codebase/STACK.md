# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- TypeScript 4.2+ - All application code in `src/`
- Pug - Template language for Vue components (instead of HTML)
- SCSS/Sass 1.55 - Styling

**Secondary:**
- Rust (2021 edition) - WASM modules in `wasm/`
- JavaScript - Legacy/config files (babel, eslint, jest configs)

## Runtime

**Environment:**
- Node.js 22.x (verified from CI workflows, `lts/*` in Playwright config)
- Browser (SPA targeting modern browsers with WebGL support)

**Package Manager:**
- npm with `package-lock.json`
- Lockfile: present
- Workspaces: `packages/*` (monorepo structure)
- Post-install: `patch-package` for dependency patches

## Frameworks

**Core:**
- Vue 2.7.16 - Component framework with Composition API support
- Vuex 3.1.3 - Global state management (`src/store.ts`)
- Vue Router 3.5.3 - Client-side routing (`src/router.ts`)
- Buefy 0.9.29 - Vue UI component library (based on Bulma)
- Bulma 1.0.0 - CSS framework

**Build/Dev:**
- Vite 6.4.1 - Build tool and dev server (`vite.config.mts`)
- esbuild - Bundler (via Vite, target: `esnext`)
- wasm-pack - Rust to WASM compilation (`npm run wasm`)

**Testing:**
- Vitest 4.0.12 - Unit test runner with jsdom environment
- Playwright 1.56.1 - E2E testing
- Coverage: `@vitest/coverage-v8`

## Key Dependencies

**Visualization (Critical):**
- deck.gl 9.1.14 - WebGL visualization layers
- @deck.gl/mapbox 9.1.14 - Mapbox/MapLibre integration
- @deck.gl/extensions 9.1.14 - Data filter, etc.
- maplibre-gl 5.6.2 - Base map rendering (open-source Mapbox GL)
- three 0.127.0 - 3D graphics for agent animations
- plotly.js 3.1.0 - Interactive charts
- vega 5.21.0 / vega-lite 5.2.0 - Declarative visualization grammar

**Data Processing:**
- @simwrapper/papaparse 5.3.2-2 - CSV parsing (forked)
- csvtojson 2.0.10 - CSV to JSON conversion
- fast-xml-parser 4.5.3 - XML parsing
- sax-wasm 2.2.4 - SAX XML streaming parser
- pako 2.0.4 - Gzip compression/decompression
- @turf/turf 5.1.6 - Geospatial analysis
- proj4 2.6.2 - Coordinate projection transformations
- @h5web/h5wasm 14.0.1 - HDF5 file reading (matrix data)

**GIS/Geo:**
- shapefile 0.6.6 - Shapefile parsing
- @ngageoint/geopackage 4.2.6 - GeoPackage support
- geojson 0.5.0 - GeoJSON utilities
- reproject 1.2.6 - Coordinate reprojection
- epsg-index 1.3.0 - EPSG projection definitions

**UI Components:**
- @fortawesome/vue-fontawesome 2.0.10 - Icon library
- vue-good-table 2.21.11 - Data tables
- vuedraggable 2.24.3 - Drag-and-drop
- medium-zoom 1.0.5 - Image zoom
- lil-gui 0.17.0 - Debug GUI controls
- katex 0.16.11 - LaTeX math rendering

**Utilities:**
- lodash 4.17.21 - General utilities
- d3-array/scale/scale-chromatic 3.x/4.x - D3 utilities
- moment 2.24.0 - Date handling
- js-yaml 4.1.0 / yaml 2.8.0 - YAML parsing
- nanoid 5.0.6 - ID generation
- comlink 4.4.2 - Web Worker communication
- threads 1.7.0 - Threading abstraction

**WASM Modules (Custom):**
- matsim-event-streamer - Rust WASM for streaming MATSim event files
- xml-network-parser - Rust WASM for parsing MATSim network XML

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Target: `esnext`
- Module: `esnext` with Node resolution
- Strict mode: enabled
- JSX: react (for deck.gl React components)
- Path aliases: `@/` -> `src/`, `~/` -> `node_modules/`

**Vite:**
- Config: `vite.config.mts`
- Base URL: `/`
- Build target: `esnext`
- Source maps: disabled in production
- Test environment: jsdom (vitest)
- Custom plugin: `redirectAll()` for handling paths ending in extensions

**Code Quality:**
- ESLint: `plugin:vue/essential`, `@vue/typescript`
- Prettier: single quotes, no semicolons, trailing commas (ES5)
- Config files: `.eslintrc.js`, `.prettierrc.cjs`

**Environment Variables:**
- `VITE_COMMIT` - Build commit hash
- `VITE_TAG` - Build tag
- No `.env` files for secrets (runtime configuration via `src/fileSystemConfig.ts`)

## Platform Requirements

**Development:**
- Node.js 22.x
- npm
- wasm-pack (for Rust WASM modules)
- WebGL-capable browser

**Production:**
- Static file hosting (GitHub Pages, any web server)
- CORS-enabled data sources
- WebGL support required

**Browser APIs Used:**
- File System Access API (Chrome) - Local folder access
- Web Workers - Background processing
- IndexedDB (via idb-keyval) - Persistent storage
- localStorage - User preferences
- Fetch API - HTTP requests
- ReadableStream - File streaming

## Build Commands

```bash
npm ci                    # Install dependencies
npm run dev               # Development server (localhost:8080)
npm run build             # Production build
npm run test:run          # Run unit tests
npm run test:ui           # Vitest UI
npm run wasm              # Build WASM modules
```

---

*Stack analysis: 2026-01-19*
