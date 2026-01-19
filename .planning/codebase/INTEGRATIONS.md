# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**Map Tiles:**
- Mapbox - Map tile provider for base maps
  - Styles: `mapbox://styles/mapbox/light-v10`, `mapbox://styles/vsp-tu-berlin/*`
  - Token: Hardcoded in `src/Globals.ts` (`MAPBOX_TOKEN`)
  - Usage: Base map rendering via MapLibre GL

**GitHub API:**
- GitHub Contents API - Direct repository file browsing
  - SDK: `@octokit/rest` (used in `src/plugins/layer-map/SaveMapModal.vue`)
  - Auth: PAT token embedded in `src/js/HTTPFileSystem.ts` (lines 298-300, 370-372)
  - Endpoints: `api.github.com/repos/{owner}/{repo}/contents/`, `api.github.com/repos/{owner}/{repo}/git/blobs/{sha}`
  - Purpose: Browse GitHub repositories as file systems

## Data Storage

**Remote File Systems:**
- HTTP/WebDAV Servers - Primary data source
  - Implementation: `src/js/HTTPFileSystem.ts`
  - Parses directory listings from: SVN, Apache 2.4, NGINX, SimpleWebServer, npx-serve
  - Example endpoints configured in `src/fileSystemConfig.ts`:
    - `svn.vsp.tu-berlin.de/repos/public-svn/` - VSP public Subversion
    - Various localhost ports (8000-8048 for `simwrapper serve`, 8050-8098 for live folders)

- Flask Backend - Enhanced file server with OMX support
  - Endpoints: `/list/{slug}?prefix=`, `/file/{slug}?prefix=`
  - Auth: Custom `AZURETOKEN` header for protected endpoints
  - Token storage: `localStorage.getItem('auth-token-${slug}')`

**Browser Storage:**
- IndexedDB (via `idb-keyval`)
  - Key: `fs` - Stores local file system handles
  - Usage: Persists Chrome File System Access API handles between sessions
  - Implementation: `src/fileSystemConfig.ts` (lines 80-83)

- localStorage
  - `colorscheme` - Theme preference (light/dark)
  - `locale` - Language preference
  - `favoriteLocations` - User bookmarks (JSON)
  - `projectShortcuts` - Custom data source shortcuts (JSON)
  - `activeLeftSection` - UI state
  - `gamepadAxis` - Gamepad configuration
  - `auth-token-{slug}` - Per-server authentication tokens

**File Storage:**
- Chrome File System Access API
  - Implementation: `src/js/HTTPFileSystem.ts` (`_getDirectoryFromHandle`, `_getFileFromChromeFileSystem`)
  - Purpose: Direct access to local folders via browser API
  - Requires user permission grant per session

**Caching:**
- In-memory directory cache
  - Location: `src/js/HTTPFileSystem.ts` (line 30: `const CACHE`)
  - Structure: `{ [slug: string]: { [dir: string]: DirectoryEntry } }`
  - Cleared via `clearCache()` method

## Authentication & Identity

**Auth Provider:**
- Custom per-server authentication
  - Basic Auth: Stored in Vuex `state.credentials[url]` as base64-encoded `username:password`
  - Token Auth: Azure/Flask tokens stored in localStorage per slug
  - Implementation: Password prompt triggered via `store.commit('requestLogin', url)`

**No centralized auth** - Each data source handles its own authentication

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Rollbar, etc.)

**Logs:**
- Browser console only (`console.log`, `console.error`, `console.warn`)
- Debug utility: `src/plugins/interactive-dashboard/utils/debug.ts`
  - Uses localStorage flag to enable/disable debug output

## CI/CD & Deployment

**Hosting:**
- GitHub Pages - Primary deployment target
- Scripts in `package.json`:
  - `deploy-staging` - `simwrapper/staging` repo
  - `deploy-vsp` - `matsim-vsp/simwrapper` repo
  - `deploy-simwrapper-app` - `simwrapper/app` repo
  - `deploy-sandag`, `deploy-asim`, `deploy-bleeding` - Other deployment targets

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`)
  - `playwright.yml` - E2E tests on push/PR to main/master
  - `deploy-to-staging.yml` - Deploy to staging on push to staging branch
  - `deploy-to-bleeding.yml` - Deploy to bleeding edge
  - Node.js 22 used in CI

**Build Process:**
1. `npm ci` - Install dependencies
2. `npm run build` - Vite production build (8GB heap allocated)
3. Deploy static files to GitHub Pages

## Environment Configuration

**Required env vars:**
- None required for basic operation
- `VITE_COMMIT` / `VITE_TAG` - Build metadata (optional, defaults in `.env`)

**Runtime Configuration:**
- All configuration is runtime via:
  - `src/fileSystemConfig.ts` - Data source definitions
  - `src/Globals.ts` - Map tokens, styles, constants
  - YAML dashboard configs loaded from data sources

**Secrets:**
- Mapbox token: Hardcoded in `src/Globals.ts` (line 52-53)
- GitHub API token: Hardcoded in `src/js/HTTPFileSystem.ts` (lines 298-300)
- CI secrets: `secrets.BUILD_STAGING` for deployment triggers

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- GitHub repository dispatch (CI only)
  - Triggers deployment to staging/production repos
  - Endpoint: `api.github.com/repos/{target}/dispatches`

## External Data Formats Supported

**Transportation/Simulation:**
- MATSim XML (network, events, config, transit schedule, carriers)
- MATSim OMX (Open Matrix Format) - via Flask backend
- GMNS (General Modeling Network Specification) - `@simwrapper/gmns`

**Geospatial:**
- GeoJSON
- Shapefile (.shp, .dbf, .shx)
- GeoPackage (.gpkg)
- CSV with coordinates

**Data:**
- CSV / CSV.GZ
- JSON / JSON.GZ
- YAML
- HDF5 (.h5) - via h5wasm
- Avro
- XML / XML.GZ

**Configuration:**
- YAML dashboard configs (`dashboard*.yaml`, `viz*.yaml`, `topsheet*.yaml`)
- `simwrapper-config.yaml` - Project-level settings

## Web Workers

Heavy processing offloaded to Web Workers:
- `src/workers/DataFetcher.worker.ts` - Data loading
- `src/workers/GzipFetcher.worker.ts` - Gzip decompression
- `src/workers/MATSimEventStreamer.worker.ts` - Event file streaming
- `src/workers/NetworkHelper.worker.ts` - Network processing
- `src/workers/XmlFetcher.worker.ts` - XML fetching/parsing
- `src/workers/WasmXmlNetworkParser.worker.ts` - WASM XML parsing
- Plugin-specific workers in respective plugin directories

Communication via `comlink` library for RPC-style worker calls.

---

*Integration audit: 2026-01-19*
