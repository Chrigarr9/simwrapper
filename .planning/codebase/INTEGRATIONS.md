# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**GitHub:**
- SDK: @octokit/rest 20.1.1
- Purpose: Direct repository file browsing
- Auth: OAuth via `_github_oauth_server/` (Express + Passport)
- Config: FileSystemConfig with `isGithub: true`
- Files: `src/js/HTTPFileSystem.ts` handles GitHub file access

**Map Tile Services:**
- Carto Basemaps (primary, used by MapCard):
  - Light: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`
  - Dark: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
- Mapbox (legacy, via token in `src/Globals.ts`):
  - Token: `pk.eyJ1IjoidnNwLXR1LWJlcmxpbiIsImEi...`
  - Styles: `mapbox://styles/mapbox/light-v10`, etc.

## Data Storage

**Remote File Servers:**
- HTTP/HTTPS servers - Primary data source
- Subversion (SVN) servers - TU-Berlin data repositories
  - Example: `https://svn.vsp.tu-berlin.de/repos/public-svn/`
- Flask servers (optional) - Streaming large files, OMX slices
  - Config: `flask: true` in FileSystemConfig
  - Port pattern: `localhost:8050/_f_`

**Local File Access:**
- Browser File System Access API (`FileSystemAPIHandle`)
- IndexedDB via idb-keyval (persists file handles between sessions)
- Config stored in: `localStorage.projectShortcuts`
- Implementation: `src/fileSystemConfig.ts`

**Databases:**
- None (client-side only, data loaded from files)

**File Storage:**
- Local browser storage only (no cloud storage integration)
- Files cached in browser memory during session

**Caching:**
- Directory listings cached per slug/directory in `HTTPFileSystem.ts`
- No persistent server-side cache

## Authentication & Identity

**GitHub OAuth:**
- Implementation: `_github_oauth_server/` (Node.js/Express)
- Libraries: passport 0.7.0, passport-github2 0.1.12
- Deployment: Fly.io (see `fly.toml`)
- Purpose: Access private GitHub repositories

**Basic Auth (HTTP):**
- Stored in Vuex: `state.credentials = { [url]: password }`
- Per-URL password prompts for protected SVN/HTTP servers

**Custom Auth:**
- None (no custom user accounts)

## Monitoring & Observability

**Error Tracking:**
- None (console.error only)

**Logs:**
- Browser console via custom `debugLog()` utility
- Location: `src/plugins/interactive-dashboard/utils/debug.ts`
- Pattern: Conditional logging based on debug flag

**Analytics:**
- None detected

## CI/CD & Deployment

**Hosting:**
- GitHub Pages (primary)
- Multiple deployment targets:
  - `simwrapper.app` - Main production
  - `simwrapper/staging` - Staging
  - `simwrapper/bleeding` - Bleeding edge
  - `simwrapper/sandag` - SANDAG-specific build
  - `matsim-vsp/simwrapper` - VSP mirror
  - `ActivitySim/dashboard` - ActivitySim integration

**CI Pipeline:**
- GitHub Actions (`.github/workflows/`):
  - `deploy-to-staging.yml` - Deploy to staging on push
  - `deploy-to-bleeding.yml` - Deploy bleeding edge
  - `playwright.yml` - E2E tests
- Travis CI (mentioned in CLAUDE.md) - Auto-deploy on master push

**Build Scripts:**
- `scripts/deploy-ghpages.sh` - GitHub Pages deployment
- `scripts/deploy-simwrapper-app.sh` - simwrapper.app deployment
- `scripts/build-index.cjs` - Build public data index

## Environment Configuration

**Required env vars:**
- `VITE_COMMIT` - Git commit hash (build info)
- `VITE_TAG` - Git tag (build info)

**OAuth Server env vars (for `_github_oauth_server/`):**
- GitHub OAuth client ID/secret (configured on deployment)
- Express session secret

**Secrets location:**
- GitHub OAuth tokens - In Fly.io deployment config
- Mapbox token - Hardcoded in `src/Globals.ts` (public token, read-only)

## Webhooks & Callbacks

**Incoming:**
- None (static SPA, no backend)

**Outgoing:**
- GitHub OAuth callback to `_github_oauth_server/`

## File System Backends

SimWrapper supports multiple file system backends (`src/js/HTTPFileSystem.ts`):

**FETCH (default):**
- Standard HTTP/HTTPS file access
- CORS required for cross-origin

**CHROME:**
- Browser File System Access API
- Requires user permission grant
- Persisted handles in IndexedDB

**GITHUB:**
- Via @octokit/rest
- Binary detection by extension (avro, gz, shp, etc.)
- Rate-limited by GitHub API

**FLASK:**
- Custom Python backend support
- Streaming for large files
- OMX matrix slice access

## Interactive Dashboard Data Flow

The Interactive Dashboard loads data through:

1. **YAML Config** - Dashboard definition loaded via `fileApi.getFileText()`
2. **CSV Data** - Central table loaded by `DataTableManager.loadData()`
   - Uses PapaParse with `dynamicTyping: true`
   - Loaded via `fileService.getFileBlob()`
3. **GeoJSON** - Map layers loaded by `MapCard.loadGeoJSON()`
   - Via `fileApi.getFileText()`
   - Cached in component state
4. **Sub-Dashboard Data** - Pre-loaded by parent dashboard
   - Parsed inline with custom CSV parser

**Data Loading Pattern:**
```typescript
// From DataTableManager.ts
async loadData(fileService: any, subfolder: string): Promise<void> {
  const filepath = subfolder + '/' + this.config.dataset
  const blob = await fileService.getFileBlob(filepath)
  Papa.parse(blob, { header: true, dynamicTyping: true, ... })
}
```

---

*Integration audit: 2026-01-19*
