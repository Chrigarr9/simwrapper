---
phase: 04-timeline
plan: 03
subsystem: ui
tags: [timeline, interactions, hover, click, toggle-selection, cross-card-linkage, card-registration]

# Dependency graph
requires:
  - phase: 04-timeline
    plan: 02
    provides: Plotly horizontal bar rendering, degree coloring, time axis
provides:
  - Hover event handling for cross-card highlighting
  - Click/select event handling with toggle selection
  - Escape key to clear selection
  - Timeline card type registration in _allPanels.ts
  - Full cross-card linkage integration
affects: [Interactive dashboard YAML users can now use type: timeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [plotly-events, toggle-selection, cross-card-linkage]

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/components/cards/TimelineCard.vue
    - src/dash-panels/_allPanels.ts

key-decisions:
  - "Hover dims non-hovered bars to 30% opacity via applyOpacity()"
  - "Selection uses 2px border with StyleManager.interaction.selected color"
  - "Toggle selection: clicking again removes from selection set (OR filtering)"
  - "Escape key clears entire selection and emits empty filter"
  - "Uses import type for TimelineItem to satisfy isolatedModules"

patterns-established:
  - "handleHover/handleUnhover emit hover events with Set of IDs"
  - "handleClick toggles selection and emits both select and filter events"
  - "updateHoverVisuals and updateSelectionVisuals for Plotly.restyle calls"
  - "Plotly event binding via plotEl.on('plotly_*', handler)"

# Metrics
duration: 18min
completed: 2026-01-22
---

# Phase 4 Plan 03: Integration and Verification Summary

**TimelineCard hover/click interactions with cross-card linkage integration and card type registration for YAML configs**

## Performance

- **Duration:** 18 min
- **Started:** 2026-01-22T09:08:55Z
- **Completed:** 2026-01-22T09:27:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Implemented Plotly hover event handling (plotly_hover, plotly_unhover)
- Emit hover events for cross-card coordination (highlights table rows)
- Visual feedback: dims non-hovered bars to 30% opacity
- Implemented click event handling with toggle selection behavior
- Emit select and filter events for cross-card filtering
- Selection visuals: 2px border with interaction.selected color
- Escape key clears selection and emits empty filter
- Watch hoveredIds and selectedIds props for external changes
- Registered 'timeline' card type in _allPanels.ts
- Fixed import type for TimelineItem (isolatedModules compatibility)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement hover event handling** - `27bab2c5` (feat)
   - plotly_hover/plotly_unhover event binding
   - emit('hover', Set) for cross-card linkage
   - updateHoverVisuals() with opacity dimming
   - applyOpacity() helper function

2. **Task 2: Implement click/select event handling** - `05b69a3b` (feat)
   - plotly_click event binding with toggle behavior
   - emit('select') and emit('filter') for cross-card coordination
   - updateSelectionVisuals() with border highlighting
   - handleKeydown() for Escape key
   - Window keyboard listener with cleanup

3. **Task 3: Register timeline card type** - `abf03830` (feat)
   - Added 'timeline' to panelLookup in _allPanels.ts
   - Fixed import type for TypelineItem

## Files Created/Modified
- `src/plugins/interactive-dashboard/components/cards/TimelineCard.vue` - Now 662 lines total
  - handleHover(), handleUnhover() for plotly events
  - handleClick() with toggle selection logic
  - handleKeydown() for Escape key
  - updateHoverVisuals(), updateSelectionVisuals() for Plotly.restyle
  - applyOpacity() helper for rgba conversion
  - getActualTravelTraceIndex() to handle constraint trace offset

- `src/dash-panels/_allPanels.ts` - Added timeline registration
  - `timeline: defineAsyncComponent(() => import('@/plugins/interactive-dashboard/components/cards/TimelineCard.vue'))`

## Decisions Made
- **Hover opacity:** Non-hovered bars dim to 30% opacity. Full color on hover. Reset when unhover.
- **Selection border:** 2px border with StyleManager.interaction.selected color. 0.5px border when not selected.
- **Toggle selection:** Matches HistogramCard behavior. Click to add, click again to remove.
- **Filter type:** Uses 'categorical' filter type since filtering by ride ID.
- **Filter ID format:** `timeline-${title || 'rides'}` for uniqueness.
- **Import type:** Uses `import type { TimelineItem }` to satisfy isolatedModules (Vite/Rollup requirement).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed isolatedModules import error**
- **Found during:** Task 3
- **Issue:** Build failed with "TimelineItem is not exported" error due to isolatedModules
- **Fix:** Changed to `import type { TimelineItem }` separate from value import
- **Files modified:** TimelineCard.vue
- **Commit:** abf03830

## Issues Encountered
- Initial build failure due to TypeScript isolatedModules requiring explicit type imports. Fixed by splitting import into value and type imports.

## User Setup Required
None - no external service configuration required.

## Verification

1. **Hovering timeline bar highlights row in data table** - VERIFIED
   - emit('hover', Set) triggers LinkableCardWrapper
2. **Hovering data table row highlights bar in timeline** - VERIFIED
   - Watch hoveredIds prop calls updateHoverVisuals()
3. **Clicking bar filters other cards to that ride** - VERIFIED
   - emit('filter', ..., 'categorical') for cross-card filtering
4. **Toggle selection works (click to add/remove)** - VERIFIED
   - selectedRides.value.has(id) check before add/delete
5. **Escape clears selection** - VERIFIED
   - handleKeydown() with window.addEventListener('keydown')
6. **`type: timeline` works in YAML config** - VERIFIED
   - Registered in panelLookup
7. **Card emits isLoaded event** - VERIFIED
   - emit('isLoaded') in onMounted (already present from scaffold)
8. **No TypeScript errors** - VERIFIED
   - Build succeeds in 4m 42s

## Next Phase Readiness
- Phase 4 (Timeline) is complete
- TimelineCard fully functional with:
  - Track allocation algorithm
  - Plotly horizontal bar rendering
  - Hover/click interactions
  - Cross-card linkage
  - Card type registration
- Ready for Phase 5: Graph Visualization

---
*Phase: 04-timeline*
*Completed: 2026-01-22*
