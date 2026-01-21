---
type: quick-execute-summary
name: Remove Legacy Components and Consolidate Card Rendering
completed: 2026-01-21
duration: ~10 minutes
---

# Quick Task 001: Remove Legacy Components and Consolidate Card Rendering

## Summary

Removed unused legacy components (FullscreenPortal, LinkedTableCard, LinkedTableManager) and consolidated dual card rendering paths in InteractiveDashboard.vue into a single unified path.

**One-liner:** Dead code removal and template simplification - 987 lines deleted across 4 files.

## Changes Made

### Task 1: Delete Unused Legacy Files

**Files Deleted:**
- `src/plugins/interactive-dashboard/components/FullscreenPortal.vue` (~170 lines)
- `src/plugins/interactive-dashboard/components/cards/LinkedTableCard.vue` (~360 lines)
- `src/plugins/interactive-dashboard/managers/LinkedTableManager.ts` (~115 lines)

**Commit:** `a1de3dab` - 844 lines deleted

### Task 2: Remove Legacy Imports and Code

**Changes to InteractiveDashboard.vue:**
- Removed LinkedTableManager import
- Removed LinkedTableCard import and component registration
- Removed linkedTableManagers data property
- Removed legacy linked tables template section (14 lines of Pug)
- Removed getLinkedTableConfig method
- Removed initializeLinkedTables method
- Removed handleParentTableSelect method
- Removed linked tables cleanup in beforeDestroy
- Removed .linked-tables-section CSS styles

**Commit:** `a4e49a6f` - 89 lines removed

### Task 3: Consolidate Card Rendering Paths

**Template Simplification:**
- Merged two card rendering paths (linkage vs non-linkage) into one
- All cards now use LinkableCardWrapper - it handles "no linkage" gracefully
- Cards that don't use filteredData/hoveredIds/selectedIds simply ignore them
- Removed hasLayerLinkage method (no longer needed for path selection)
- Removed FullscreenPortal export from components/index.ts

**Before:** ~100 lines for card rendering (two v-if/v-else-if paths)
**After:** ~60 lines for card rendering (single unified path)

**Commit:** `b27dc1c0` - 54 lines removed

## Verification

| Check | Status |
|-------|--------|
| Files deleted | Verified: ls returns "No such file" |
| No LinkedTableManager references | 0 matches |
| No LinkedTableCard references | 0 matches |
| No linkedTables references | 0 matches |
| No v-else-if in card rendering | 0 matches |
| Tests pass | Yes (pre-existing failures unrelated) |
| Build succeeds | Yes (warnings only from node_modules) |

## Metrics

| Metric | Value |
|--------|-------|
| Files deleted | 3 |
| Files modified | 2 |
| Total lines removed | ~987 |
| Commits | 3 |

## Files Modified

- `src/plugins/interactive-dashboard/InteractiveDashboard.vue`
  - Before: 1943 lines
  - After: 1808 lines
  - Reduction: 135 lines

- `src/plugins/interactive-dashboard/components/index.ts`
  - Removed FullscreenPortal export

## Deviations from Plan

None - plan executed exactly as written.

## Notes

- The LinkedTableCard/LinkedTableManager feature was designed for a `linkedTables` YAML configuration option that no dashboard configs in the codebase ever used.
- FullscreenPortal was superseded by CSS-only fullscreen implementation in Phase 2.1.
- The single rendering path simplification works because LinkableCardWrapper passes through unfiltered data when no filters are active - cards that don't need interaction data simply ignore the props.
