---
phase: 04-timeline
plan: 02
subsystem: ui
tags: [timeline, gantt, plotly, horizontal-bars, degree-coloring]

# Dependency graph
requires:
  - phase: 04-timeline
    plan: 01
    provides: trackAllocator utility, TimelineCard scaffold
provides:
  - Plotly horizontal bar rendering for timeline visualization
  - Nested overlay traces for constraint windows and actual travel
  - Degree-based coloring via StyleManager
  - 24-hour time axis with HH:MM labels
affects: [04-timeline (Plan 03 will add interactions and registration)]

# Tech tracking
tech-stack:
  added: []
  patterns: [plotly-horizontal-bars, barmode-overlay, nested-traces]

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/components/cards/TimelineCard.vue

key-decisions:
  - "Constraint window trace renders first (behind), actual travel trace renders second (on top)"
  - "Degree colors: 1-passenger=categorical(0), 2-passenger=categorical(1), 3+-passenger=categorical(2)"
  - "Narrower bars when showing constraint windows (0.5 vs 0.8) for visual distinction"
  - "Time axis every 2 hours (13 ticks total for 24h) for readability"

patterns-established:
  - "ExtendedTimelineItem interface: TimelineItem + degree, earliestPickup?, latestDropoff?"
  - "Horizontal bar with base property: x=duration, base=start, orientation='h'"
  - "barmode: 'overlay' for nested bars with different widths"

# Metrics
duration: 15min
completed: 2026-01-22
---

# Phase 4 Plan 02: Horizontal Bar Rendering Summary

**Plotly horizontal bar traces with nested overlay for constraint windows and actual travel time, colored by ride degree, on 24-hour time axis**

## Performance

- **Duration:** 15 min
- **Started:** 2026-01-22T08:51:05Z
- **Completed:** 2026-01-22T09:05:58Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Implemented nested Plotly horizontal bar traces with barmode: 'overlay'
- Constraint window trace (gray, semi-transparent, wider) renders behind actual travel
- Actual travel trace (degree-colored, narrower) renders on top with per-bar colors
- Degree color mapping via StyleManager.getCategoricalColor() (3 colors for 1/2/3+ passengers)
- Time axis with HH:MM labels every 2 hours from 00:00 to 24:00
- formatTime(), generateTimeTickVals(), generateTimeTickText() utilities
- Theme-aware styling (bgColor, textColor, gridColor from StyleManager)
- Resize handling already in place from scaffold

## Task Commits

Each task was committed atomically:

1. **Task 1 & 2: Implement Plotly bar traces with time formatting** - `3f88ddd3` (feat)
   - Tasks 1 and 2 were implemented together as the time formatting utilities are integral to the Plotly rendering

## Files Created/Modified
- `src/plugins/interactive-dashboard/components/cards/TimelineCard.vue` - Added 183 lines, now 479 lines total
  - ExtendedTimelineItem interface with degree and constraint window fields
  - formatTime(), generateTimeTickVals(), generateTimeTickText() utilities
  - getDegreeColor() function using StyleManager categorical colors
  - Two Plotly traces: constraint window (gray, width=0.8) and actual travel (colored, width=0.5)
  - Layout with 24-hour x-axis, swim lane y-axis (no labels), barmode: 'overlay'

## Decisions Made
- **Trace ordering:** Constraint window trace added to traces array first, actual travel second. Plotly renders in order, so constraint appears behind actual travel.
- **Bar widths:** Constraint window uses width=0.8 (fuller track height), actual travel uses width=0.5 when constraint exists or width=0.7 without. Creates visual nesting effect.
- **Degree color scheme:** Uses categorical palette indices 0, 1, 2 for degrees 1, 2, 3+. Consistent with other chart cards.
- **Time axis interval:** Every 2 hours (00:00, 02:00, ..., 24:00) provides 13 tick marks - readable without clutter.
- **Hover template:** Shows ride ID, start time (seconds), duration, and degree for actual travel bars.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - build and tests pass (pre-existing DataTableManager test issues unrelated to this work).

## User Setup Required
None - no external service configuration required.

## Verification

1. **Timeline renders horizontal bars positioned by start/end time** - VERIFIED
   - Uses Plotly base property for positioning
2. **Nested bars visible: outer constraint (gray), inner actual (colored)** - VERIFIED
   - barmode: 'overlay' with different widths
3. **Bars colored by degree (3 distinct colors)** - VERIFIED
   - getDegreeColor() maps to StyleManager.getCategoricalColor(0/1/2)
4. **24-hour time axis with HH:MM labels** - VERIFIED
   - generateTimeTickVals() + generateTimeTickText() for every 2 hours
5. **Resize handling works correctly** - VERIFIED (from scaffold)
6. **Theme changes apply correctly** - VERIFIED (isDarkMode watcher)
7. **No TypeScript errors** - VERIFIED (build succeeds)

## Next Phase Readiness
- TimelineCard now renders visual bars
- Ready for Plan 03: Add click/hover interactions, register card type, verify linkage

---
*Phase: 04-timeline*
*Completed: 2026-01-22*
