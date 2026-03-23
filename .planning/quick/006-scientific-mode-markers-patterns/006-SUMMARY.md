---
phase: quick-006
plan: 006
subsystem: ui
tags: [plotly, scientific-mode, publication, accessibility, grayscale]

# Dependency graph
requires:
  - phase: 04.2-scientific-mode
    provides: Scientific mode styling profile and theme toggle
provides:
  - Marker shapes for categorical scatter plots in scientific mode
  - Bar fill patterns for histogram comparison mode in scientific mode
  - Pie slice patterns for categorical pie charts in scientific mode
  - StyleManager methods for accessing marker/pattern arrays
affects: [scientific-mode, chart-export, publication-figures]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Marker symbol arrays for print-friendly scatter plots
    - Pattern shape arrays for grayscale-accessible charts
    - Plotly marker.pattern API for bar and pie patterns

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/managers/StyleManager.ts
    - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
    - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue

key-decisions:
  - "Use 10 distinct Plotly marker symbols (circle, square, diamond, cross, x, triangle-up, triangle-down, star, hexagon, pentagon) for scatter plots"
  - "Use 8 pattern shapes ('', '/', '\\', 'x', '-', '|', '+', '.') for bars and pie slices"
  - "Apply patterns only in scientific mode to preserve clean web appearance in normal modes"
  - "Use hollow circle (circle-open) for baseline scatter points to distinguish from filtered data"
  - "Apply diagonal pattern (/) to filtered histogram bars when comparison mode active"
  - "Use text color for pattern foreground to ensure visibility on colored backgrounds"

patterns-established:
  - "Pattern 1: Marker symbols wrap around using modulo for unlimited categories (getScientificMarkerSymbol(index % length))"
  - "Pattern 2: Patterns are mode-aware - only applied when isScientificMode() returns true"
  - "Pattern 3: Baseline traces use distinct visual treatment (hollow markers, solid fill) to contrast with filtered data"

# Metrics
duration: 5min
completed: 2026-01-30
---

# Quick Task 006: Scientific Mode Markers and Patterns Summary

**Scatter plots, histograms, and pie charts now use distinct marker shapes and fill patterns in scientific mode for grayscale print accessibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-30T15:54:29Z
- **Completed:** 2026-01-30T15:59:45Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Scatter plots differentiate categories by marker shape (circle, square, diamond, etc.) in scientific mode
- Histogram bars use diagonal pattern for filtered data when comparison mode is active in scientific mode
- Pie chart slices use distinct patterns per category (solid, /, \, x, +, -, |, .) in scientific mode
- All patterns remain visible when exported as PNG for publication

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scientific marker/pattern arrays to StyleManager** - `284fd86a` (feat)
2. **Task 2: Add marker shapes to ScatterCard in scientific mode** - `12488355` (feat)
3. **Task 3: Add patterns to HistogramCard and PieChartCard in scientific mode** - `f7e399e6` (feat)

## Files Created/Modified
- `src/plugins/interactive-dashboard/managers/StyleManager.ts` - Added markerSymbols, barPatterns, piePatterns arrays to scientific config; added getter methods getScientificMarkerSymbol(), getScientificBarPattern(), getScientificPiePattern()
- `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue` - Added marker.symbol property to category traces using StyleManager.getScientificMarkerSymbol(categoryIndex); baseline trace uses 'circle-open' in scientific mode
- `src/plugins/interactive-dashboard/components/cards/HistogramCard.vue` - Added marker.pattern property to filtered bars in scientific mode when comparison active; diagonal pattern (/) with transparent background
- `src/plugins/interactive-dashboard/components/cards/PieChartCard.vue` - Added marker.pattern property to pie slices in scientific mode; each slice gets distinct pattern via StyleManager.getScientificPiePattern(index)

## Decisions Made

**1. Marker symbol palette:** Used 10 Plotly marker symbols (circle, square, diamond, cross, x, triangle-up, triangle-down, star, hexagon, pentagon) for scatter plots. This provides good visual distinction while remaining professional for academic publications.

**2. Pattern shape palette:** Used 8 pattern shapes ('', '/', '\', 'x', '-', '|', '+', '.') where '' = solid fill. First pattern is solid to preserve clean appearance for primary data, subsequent patterns add texture.

**3. Scientific mode conditional:** Patterns only apply when `styleManager.isScientificMode()` returns true. This preserves clean web appearance in dark/light modes while enabling print accessibility in scientific mode.

**4. Baseline visual distinction:** Baseline scatter points use hollow circle (circle-open) marker, baseline histogram bars remain solid. This creates clear visual hierarchy: baseline = background context, filtered = foreground focus.

**5. Pattern foreground color:** Pie chart patterns use text color for foreground to ensure visibility across colored backgrounds. Prevents patterns from being lost on dark category colors.

**6. Comparison mode patterns:** Histogram patterns only apply when both scientific mode AND comparison mode are active. Non-comparison histograms stay solid for simplicity.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward, Plotly marker.pattern API worked as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Scientific mode charts are now fully publication-ready:
- Scatter plots: Color + shape differentiation ensures categories remain distinguishable in grayscale
- Histograms: Patterns distinguish filtered from baseline when both are overlaid
- Pie charts: Each slice has unique pattern for grayscale accessibility
- All patterns visible in exported PNGs

**Ready for:** Dissertation figure generation, academic paper submissions, print publications

**Potential future enhancement:** Consider adding configurable pattern size/solidity via YAML config if users need finer control for specific publication formats.

---
*Phase: quick-006*
*Completed: 2026-01-30*
