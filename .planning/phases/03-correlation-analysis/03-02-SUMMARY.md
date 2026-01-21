---
phase: 03-correlation-analysis
plan: 02
subsystem: ui
tags: [plotly, correlation, heatmap, statistics, vue, typescript]

# Dependency graph
requires:
  - phase: 03-01
    provides: statistics.ts with computeCorrelationMatrix and correlationWithPValue functions
provides:
  - CorrelationMatrixCard Vue component with Plotly heatmap visualization
  - Interactive correlation matrix with hover tooltips (r, p-value, sample size)
  - Click-to-select attribute pairs for scatter plot linkage
  - Conditional cell text display with significance markers
affects: [03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Debounced data recalculation pattern (200ms for filteredData changes)
    - Conditional cell annotations based on showValues prop (auto/always/never)
    - Significance markers (asterisk) for p < threshold

key-files:
  created:
    - src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue
  modified: []

key-decisions:
  - "Blue-white-red diverging colorscale centered at zero for correlation heatmap"
  - "Significance threshold configurable via pValueThreshold prop (default 0.05)"
  - "Auto mode for cell text: show values if ≤20 attributes, hide if >20"
  - "White text on dark cells (|r| > 0.5), black on light cells for readability"

patterns-established:
  - "CorrelationMatrixCard follows ScatterCard/HistogramCard pattern for theming and resize"
  - "attributePairSelected event emitted on cell click for scatter plot coordination"
  - "Custom hover template with r, p-value, and sample size from customdata"

# Metrics
duration: 25min
completed: 2026-01-21
---

# Phase 3 Plan 2: CorrelationMatrixCard Implementation Summary

**Interactive correlation matrix heatmap with Plotly showing r values, p-values, sample sizes, and significance markers**

## Performance

- **Duration:** 25 min
- **Started:** 2026-01-21T15:10:16Z
- **Completed:** 2026-01-21T15:35:00Z (approx)
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Correlation matrix heatmap with blue-white-red diverging colorscale
- Hover tooltips display correlation coefficient, p-value, and sample size
- Significant correlations marked with asterisk when cell text visible
- Matrix recalculates with 200ms debounce when filtered data changes
- Cell click emits attributePairSelected event for scatter plot linkage

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CorrelationMatrixCard component structure** - `3293bb1b` (feat)
2. **Task 2: Implement correlation calculation and Plotly rendering** - `b0e96634` (feat)
3. **Task 3: Add styles and resize handling** - `01f1b95b` (feat)

## Files Created/Modified
- `src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue` - Correlation matrix heatmap component with Plotly

## Component Features

### Props
- `attributes: string[]` - Columns to include in matrix (from YAML)
- `filteredData?: any[]` - Data from LinkableCardWrapper
- `showValues?: 'always' | 'never' | 'auto'` - Cell text display mode (default: auto)
- `pValueThreshold?: number` - Significance threshold (default: 0.05)
- `linkage?: { type: 'attributePair'; targetCard?: string }` - Linkage configuration

### Computed Properties
- `sampleSize` - Minimum sample size from matrix (excludes diagonal)
- `shouldShowValues` - Based on showValues prop and attribute count (auto = hide if > 20)

### Key Functions
- `calculateCorrelations()` - Computes correlation matrix using computeCorrelationMatrix from statistics.ts
- `debouncedCalculate()` - 200ms debounced version for filteredData changes
- `buildHoverTemplate()` - Creates Plotly hover template with r, p-value, and n
- `buildCustomData()` - Structures customdata array for hover tooltips
- `renderChart()` - Renders Plotly heatmap with theme-aware colors and conditional annotations
- `handleResize()` - Debounced resize handler for responsive chart sizing

### Plotly Configuration
- **Colorscale:** Blue (#3b4cc0) → White (#f7f7f7) → Red (#b40426)
- **zmid:** 0 (centers diverging scale at zero)
- **zmin/zmax:** -1 to 1 (correlation coefficient range)
- **Annotations:** Cell text with r value and asterisk (*) for significant correlations
- **Text color:** White on dark cells (|r| > 0.5), black on light cells

### Interactions
- **Cell click:** Emits `attributePairSelected(attrX, attrY)` for scatter plot coordination
- **Cell hover:** Updates `hoveredCell` state and shows tooltip
- **Cell unhover:** Clears `hoveredCell` state

### Responsive Behavior
- ResizeObserver monitors container size changes
- Window resize listener for fullscreen transitions
- Debounced resize handler (100ms) calls Plotly.Plots.resize()
- Cleanup in onUnmounted to prevent memory leaks

## Decisions Made

**1. Blue-white-red diverging colorscale centered at zero**
- Standard for correlation heatmaps (blue=negative, red=positive, white=zero)
- Colorblind-safe and widely recognized convention
- zmid: 0 ensures white aligns with r=0

**2. Significance threshold configurable via pValueThreshold prop**
- Default 0.05 (standard α level)
- Allows users to adjust threshold in YAML if needed
- Asterisk (*) marks significant correlations in cell text

**3. Auto mode for cell text display**
- Show values if ≤20 attributes (readable)
- Hide if >20 attributes (avoids clutter)
- Manual override via showValues prop (always/never)

**4. White text on dark cells, black on light cells**
- Ensures readability regardless of correlation strength
- Threshold: |r| > 0.5 switches to white text

**5. Debounced calculation (200ms) for filteredData changes**
- Avoids excessive recalculation during rapid filtering
- Balances responsiveness with performance
- Matches HistogramCard debounce pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed plan without issues.

## Next Phase Readiness

**Ready for Plan 03-03:** Dynamic axis update for ScatterCard
- CorrelationMatrixCard emits `attributePairSelected` event on cell click
- ScatterCard needs listener to update xColumn/yColumn props dynamically
- Pattern established for attribute pair linkage

**Ready for Plan 03-04:** Integration and testing
- Component structure complete and follows established patterns
- Resize handling matches ScatterCard/HistogramCard
- Theme-aware colors via StyleManager
- All must-haves verified (329 lines, proper imports, Plotly.newPlot)

**Blockers:** None

**Concerns:** None - component ready for integration into InteractiveDashboard

---
*Phase: 03-correlation-analysis*
*Completed: 2026-01-21*
