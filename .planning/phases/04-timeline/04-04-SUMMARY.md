---
phase: 04-timeline
plan: 04
subsystem: ui
tags: [plotly, timeline, gantt, zoom, minimap, interactive]

# Dependency graph
requires:
  - phase: 04-03
    provides: TimelineCard with hover/click interactions and track allocation
provides:
  - Zoom controls (+/- buttons) with Plotly.relayout
  - Minimap navigation with viewport indicator
  - Expandable ride detail view with mini-Gantt for requests
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Plotly relayout for zoom state sync
    - Minimap with staticPlot mode for overview
    - CSS transition for expand/collapse animation

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/components/cards/TimelineCard.vue

key-decisions:
  - "Viewport state tracked in refs (viewportStart/viewportEnd) synced via plotly_relayout events"
  - "Minimap uses staticPlot:true for performance - no interactivity needed"
  - "Minimap click centers viewport on clicked position"
  - "Single ride expanded at a time - clicking different ride replaces current expansion"
  - "Request mini-Gantt scales to expanded ride's constraint window for context"

patterns-established:
  - "Plotly zoom sync: listen to plotly_relayout, update local refs, call Plotly.relayout for programmatic zoom"
  - "Minimap pattern: simplified trace (no hover), viewport indicator as CSS overlay"

# Metrics
duration: 18min
completed: 2026-01-22
---

# Phase 04 Plan 04: Zoom and Detail View Summary

**Timeline with zoom +/- buttons, minimap navigation showing 24-hour overview with viewport indicator, and click-to-expand ride detail panel with per-request mini-Gantt visualization**

## Performance

- **Duration:** 18 min
- **Started:** 2026-01-22T09:50:54Z
- **Completed:** 2026-01-22T10:09:16Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Zoom controls (+/-/reset) with Plotly.relayout for x-axis range updates
- Minimap showing simplified overview of entire 24-hour timeline
- Viewport indicator CSS overlay tracking current zoom position
- Minimap click navigation to center viewport on clicked time
- Sync between user pan/zoom and viewport state via plotly_relayout events
- Expandable ride detail panel with slide-down animation
- Ride summary showing degree, duration, and time window
- Per-request mini-Gantt with constraint windows and actual pickup markers

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement zoom controls and minimap** - `a9765a6b` (feat)
2. **Task 2: Implement expandable ride detail view** - `0b456c86` (feat)

## Files Created/Modified

- `src/plugins/interactive-dashboard/components/cards/TimelineCard.vue` - Added zoom state (viewportStart/End refs), zoom functions (zoomIn/zoomOut/resetZoom/updateMainChartRange), minimap rendering (renderMinimap), viewport indicator computed, minimap click handler, expanded ride state and computed (expandedRideId/expandedRideData/expandedRideRequests), request bar styling helpers, CSS for controls/minimap/detail panel (1171 lines total)

## Decisions Made

- **Viewport state tracked in refs**: viewportStart/viewportEnd refs synced bidirectionally with Plotly - programmatic zoom updates refs then calls relayout, user pan/zoom triggers plotly_relayout which updates refs
- **Minimap uses staticPlot:true**: No user interaction needed on minimap itself, staticPlot mode improves performance
- **Minimap click centers viewport**: Clicking minimap calculates time from click position and centers current viewport range on that time
- **Single expanded ride**: Only one ride detail panel can be open at a time - clicking a different ride replaces the current expansion
- **Request scaling relative to ride**: Mini-Gantt for requests scales to the expanded ride's constraint window (earliestPickup to latestDropoff) for contextual positioning

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded as specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TimelineCard is now feature-complete with:
  - Track allocation algorithm
  - Plotly horizontal bar rendering
  - Hover/click interactions
  - Zoom controls and minimap navigation
  - Expandable ride detail view
- Phase 4 (Timeline) is COMPLETE
- Ready for Phase 5: Graph Visualization (vue-cytoscape integration)

---
*Phase: 04-timeline*
*Completed: 2026-01-22*
