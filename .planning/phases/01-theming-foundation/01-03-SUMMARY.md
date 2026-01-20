---
phase: 01-theming-foundation
plan: 03
subsystem: styling
tags: [theming, plotly, charts, pie-chart, histogram, scatter-plot]

dependency-graph:
  requires:
    - phase: 01-01
      provides: StyleManager singleton with getColor() API
  provides:
    - Theme-aware PieChartCard using StyleManager
    - Theme-aware HistogramCard using StyleManager
    - Theme-aware ScatterCard using StyleManager
  affects: [01-04]

tech-stack:
  added: []
  patterns: [styleManager-getColor-in-renderChart, consistent-interaction-colors]

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
    - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue

decisions:
  - decision: "White border for selected pie slices"
    rationale: "Provides contrast against category colors regardless of theme"
  - decision: "ScatterCard uses interaction.hover and interaction.selected"
    rationale: "Consistent highlighting/selection behavior with MapCard"
  - decision: "D3 categorical palette kept as domain-specific"
    rationale: "Category colors are not theme-dependent, just documented"

metrics:
  duration: "8 minutes"
  completed: "2026-01-20"
---

# Phase 01 Plan 03: Migrate Chart Cards to StyleManager Summary

**Three Plotly chart cards (Pie, Histogram, Scatter) now use StyleManager for all theme-dependent colors with consistent interaction states.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-20T09:00:00Z
- **Completed:** 2026-01-20T09:08:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- PieChartCard uses StyleManager for background, text, and border colors
- HistogramCard uses StyleManager for all theme colors plus chart.bar.default/selected
- ScatterCard uses StyleManager for theme colors and consistent interaction.hover/selected
- All cards respond to theme changes via StyleManager (Vuex subscription)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate PieChartCard to use StyleManager** - `541ebf3a` (feat)
2. **Task 2: Migrate HistogramCard to use StyleManager** - `8bcf9b66` (feat)
3. **Task 3: Migrate ScatterCard to use StyleManager** - `bf9f2000` (feat)

## Files Modified

- `src/plugins/interactive-dashboard/components/cards/PieChartCard.vue` - Added StyleManager import, replaced 3 hardcoded theme colors with getColor() calls
- `src/plugins/interactive-dashboard/components/cards/HistogramCard.vue` - Added StyleManager import, replaced 5 hardcoded theme colors including chart bar colors
- `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue` - Added StyleManager import, replaced 6 hardcoded theme colors, consistent interaction states with MapCard

## Color Migrations

### PieChartCard

| Original | StyleManager Path |
|----------|-------------------|
| `#1e293b` / `#ffffff` | `theme.background.primary` |
| `#e2e8f0` / `#374151` | `theme.text.primary` |
| `#334155` / `#e5e7eb` | `theme.border.default` |

### HistogramCard

| Original | StyleManager Path |
|----------|-------------------|
| `#1e293b` / `#ffffff` | `theme.background.primary` |
| `#e2e8f0` / `#374151` | `theme.text.primary` |
| `#334155` / `#e5e7eb` | `theme.border.default` |
| `#60a5fa` / `#3b82f6` | `chart.bar.default` |
| `#f87171` / `#ef4444` | `chart.bar.selected` |

### ScatterCard

| Original | StyleManager Path |
|----------|-------------------|
| `#1e293b` / `#ffffff` | `theme.background.primary` |
| `#e2e8f0` / `#374151` | `theme.text.primary` |
| `#334155` / `#e5e7eb` | `theme.border.default` |
| `#60a5fa` / `#3b82f6` | `chart.bar.default` |
| `#fbbf24` / `#f59e0b` | `interaction.hover` |
| `#f87171` / `#ef4444` | `interaction.selected` |

## Decisions Made

1. **White border for selected pie slices**: Using `#ffffff` for selected slice borders provides consistent contrast against any category color, regardless of light/dark mode.

2. **ScatterCard interaction colors match MapCard**: Using `interaction.hover` (orange) and `interaction.selected` (blue) from StyleManager ensures visual consistency when both map and scatter plot are on the same dashboard.

3. **D3 categorical palette unchanged**: The 15-color D3 categorical palette in ScatterCard is domain-specific (distinguishing data categories) rather than theme-dependent. Added comment documenting this decision.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 04**: All chart cards now use StyleManager. Plan 04 (Verification and cleanup) can:
- Run visual tests across all cards
- Verify consistent colors in combined dashboards
- Clean up any remaining hardcoded colors
- Document the complete theming system

**Dependencies Provided:**
- PieChartCard.vue with StyleManager integration
- HistogramCard.vue with StyleManager integration
- ScatterCard.vue with StyleManager integration
- Consistent interaction colors (hover: orange, selected: blue) across scatter and map

---

*Phase: 01-theming-foundation*
*Completed: 2026-01-20*
