# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Excessive `any` Type Usage:**
- Issue: TypeScript's `any` type is used extensively throughout the codebase (~100+ occurrences), defeating type safety
- Files: `src/Globals.ts`, `src/store.ts`, `src/layout-manager/LayoutManager.vue`, `src/js/HTTPFileSystem.ts`, `src/plugins/shape-file/ShapeFile.vue`
- Impact: Runtime errors may slip through, IDE autocomplete is less useful, refactoring is risky
- Fix approach: Gradually replace `any` with proper interfaces, starting with core modules (`Globals.ts`, `store.ts`)

**Monolithic Vue Components:**
- Issue: Several plugin components exceed 2000+ lines, mixing UI, data loading, and business logic
- Files:
  - `src/plugins/shape-file/ShapeFile.vue` (3312 lines)
  - `src/plugins/logistics/LogisticsViewer.vue` (2713 lines)
  - `src/plugins/transit-demand/TransitDemand.vue` (2308 lines)
  - `src/plugins/interactive-dashboard/InteractiveDashboard.vue` (2012 lines)
  - `src/plugins/interactive-dashboard/components/cards/MapCard.vue` (1959 lines)
- Impact: Difficult to test, maintain, and reason about; high cognitive load for developers
- Fix approach: Extract data loading into composables, split UI into smaller components, create dedicated state managers

**Incomplete TODO Comments:**
- Issue: 45+ TODO/FIXME comments scattered across codebase indicating unfinished work
- Files: `src/plugins/layer-map/layers/PolygonsLayer.worker.ts` (12 TODOs), `src/plugins/shape-file/ShapeFile.vue` (6 TODOs), `src/workers/DataFetcher.worker.ts`, `src/js/ColorsAndWidths.ts`
- Impact: Technical debt accumulates, edge cases may not be handled, features incomplete
- Fix approach: Triage TODOs by severity, create issues for important ones, remove obsolete comments

**Console Logging in Production:**
- Issue: 943 console.log/warn/error statements across 149 files
- Files: `src/plugins/shape-file/ShapeFile.vue` (55), `src/plugins/interactive-dashboard/InteractiveDashboard.vue` (47), `src/plugins/commuter-requests/CommuterRequests.vue` (35)
- Impact: Performance overhead, cluttered browser console, potential information leakage
- Fix approach: Use the existing `debugLog` utility from `src/plugins/interactive-dashboard/utils/debug.ts`, create centralized logging with log levels

**Vue 2 Legacy Code:**
- Issue: Project uses Vue 2.7 while Vue 3 has been stable for years; mix of Options API and Composition API
- Files: All `.vue` files, `src/store.ts` (Vuex 3)
- Impact: Missing Vue 3 features, ecosystem moving away, harder to hire developers familiar with Vue 2
- Fix approach: Plan migration to Vue 3 + Pinia, start with new components using Composition API

## Known Bugs

**Memory Leak Concerns:**
- Symptoms: Potential memory leaks when navigating between visualizations
- Files: `src/plugins/transit-demand/TransitDemand.vue:980` (commented: "TODO remove for now until we research whether this causes a memory leak")
- Trigger: Repeatedly navigating between transit demand visualizations
- Workaround: Key listeners disabled to prevent leak

**Empty Returns Masking Errors:**
- Symptoms: Functions return empty arrays/objects instead of throwing, hiding problems
- Files: 150+ instances across codebase returning `[]`, `{}`, or `null` on error conditions
- Trigger: Invalid input or missing data
- Workaround: None - errors silently swallowed

## Security Considerations

**Token Storage in localStorage:**
- Risk: Authentication tokens stored in localStorage are vulnerable to XSS attacks
- Files:
  - `src/js/HTTPFileSystem.ts:162-165` (auth tokens)
  - `src/plugins/layer-map/SaveMapModal.vue:147` (GitHub OAuth token)
  - `src/plugins/matrix/MatrixViewer.vue:442-443`
- Current mitigation: Tokens are per-slug, limiting scope
- Recommendations: Consider using httpOnly cookies or session storage with shorter expiry; implement token refresh

**Hardcoded API Keys:**
- Risk: Mapbox token is hardcoded in source
- Files: `src/Globals.ts:52` (MAPBOX_TOKEN), `src/App.vue:48`
- Current mitigation: Token appears to be a public token with usage limits
- Recommendations: Move to environment variable or backend proxy for production

**URL Path Sanitization:**
- Risk: Path traversal attacks possible if user-controlled paths not properly sanitized
- Files: `src/js/HTTPFileSystem.ts:90-106` (`cleanURL` function)
- Current mitigation: Some sanitization exists but regex is incomplete (line 92 has typo in character class)
- Recommendations: Review and strengthen path sanitization, add tests for edge cases

## Performance Bottlenecks

**Large File Processing in Main Thread:**
- Problem: Some data processing happens in main thread causing UI freezes
- Files: `src/plugins/shape-file/ShapeFile.vue`, `src/plugins/transit-demand/TransitDemand.vue`
- Cause: Not all data processing offloaded to web workers
- Improvement path: Extend worker usage, use streaming for large files

**Unoptimized Watchers:**
- Problem: Vue watchers on large arrays/objects can cause performance issues
- Files: `src/plugins/layer-map/layers/PolygonsLayerConfig.vue:286` (TODO comment: "this should happen on load not on watch")
- Cause: Watching complex reactive objects triggers frequent re-renders
- Improvement path: Use `watchEffect` with explicit dependencies, debounce expensive watchers

**Directory Listing Cache:**
- Problem: Cache has no expiration, can grow unbounded
- Files: `src/js/HTTPFileSystem.ts:30` (CACHE object)
- Cause: Entries never expire or get evicted
- Improvement path: Implement LRU cache or time-based expiration

## Fragile Areas

**Plugin Registration:**
- Files: `src/plugins/pluginRegistry.ts`
- Why fragile: File pattern matching determines which plugin loads; overlapping patterns can cause conflicts
- Safe modification: Test thoroughly with various file types, ensure patterns don't overlap
- Test coverage: No dedicated tests for plugin matching logic

**Dashboard Configuration Parsing:**
- Files: `src/layout-manager/TabbedDashboardView.vue:474-528`, `src/plugins/interactive-dashboard/InteractiveDashboard.vue`
- Why fragile: YAML configs loosely validated; missing fields cause runtime errors
- Safe modification: Add YAML schema validation, handle missing fields gracefully
- Test coverage: Minimal - no comprehensive config validation tests

**State Synchronization (Interactive Dashboard):**
- Files:
  - `src/plugins/interactive-dashboard/managers/FilterManager.ts`
  - `src/plugins/interactive-dashboard/managers/LinkageManager.ts`
  - `src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue`
- Why fragile: Observer pattern for cross-card communication can have race conditions
- Safe modification: Ensure proper cleanup in `onUnmounted`, test with rapid interactions
- Test coverage: Basic tests exist but edge cases untested

## Scaling Limits

**In-Memory Data Tables:**
- Current capacity: Works well up to ~100K rows
- Limit: Browser memory limits (~2GB); larger datasets may crash or freeze
- Scaling path: Implement pagination, server-side filtering, or use IndexedDB for large datasets

**Number of Visualization Plugins:**
- Current capacity: 23 plugins registered
- Limit: Bundle size grows with each plugin (~3MB+ current build)
- Scaling path: Implement code splitting, lazy load plugins only when needed

## Dependencies at Risk

**Vue 2 End of Life:**
- Risk: Vue 2 reached EOL December 2023; no more updates
- Impact: Security patches may not be available
- Migration plan: Migrate to Vue 3 + Pinia; vue-demi can help with transition

**Outdated Major Dependencies:**
- Risk: Several dependencies significantly outdated:
  - `@turf/turf`: 5.1.6 -> 7.3.2 (major version behind)
  - `@fortawesome/vue-fontawesome`: 2.x -> 3.x (Vue 3 version)
  - `eslint`: 7.x -> 9.x (multiple major versions)
  - `typescript`: 4.2 -> 5.x
- Impact: Missing features, security fixes, ecosystem compatibility
- Migration plan: Prioritize updating TypeScript and Turf; Font Awesome requires Vue 3

**Local WASM Packages:**
- Risk: Two packages reference local `wasm/` folder builds
- Files: `package.json` lines 100, 138 (`matsim-event-streamer`, `xml-network-parser`)
- Impact: Build depends on pre-compiled WASM; may break in CI
- Migration plan: Publish to npm or include build step in CI

## Missing Critical Features

**No Input Validation:**
- Problem: YAML dashboard configs not validated before use
- Blocks: Helpful error messages for users, prevents runtime crashes from malformed configs

**No Automated E2E Tests:**
- Problem: Playwright tests exist but minimal coverage
- Blocks: Confidence in refactoring, catching visual regressions

**No Error Boundaries:**
- Problem: Component errors can crash entire dashboard
- Blocks: Graceful degradation when one visualization fails

## Test Coverage Gaps

**Plugin Components Untested:**
- What's not tested: Most visualization plugins have no unit tests
- Files: `src/plugins/shape-file/`, `src/plugins/transit-demand/`, `src/plugins/logistics/`, etc.
- Risk: Regressions in complex visualization logic go undetected
- Priority: High

**Data Processing Workers:**
- What's not tested: Web workers that process large datasets
- Files: `src/workers/DataFetcher.worker.ts`, `src/workers/RoadNetworkLoader.worker.ts`, `src/plugins/layer-map/layers/PolygonsLayer.worker.ts`
- Risk: Data transformation bugs, edge cases not handled
- Priority: Medium

**HTTPFileSystem:**
- What's not tested: Core file system abstraction
- Files: `src/js/HTTPFileSystem.ts` (complex class with multiple backends)
- Risk: File loading failures in specific backends (GitHub, Flask, Chrome FS API)
- Priority: High

**Only 4 Test Files Exist:**
- What's covered: `FilterManager`, `DataTableManager`, `LinkageManager`, `MapCard` (basic)
- Files: `src/plugins/interactive-dashboard/managers/__tests__/*.test.ts`, `src/plugins/interactive-dashboard/components/cards/__tests__/MapCard.test.ts`
- Risk: 95%+ of codebase has no automated tests
- Priority: Critical

---

*Concerns audit: 2026-01-19*
