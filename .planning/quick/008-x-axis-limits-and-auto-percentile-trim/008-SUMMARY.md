---
phase: quick-008
plan: 01
status: complete
subsystem: interactive-dashboard
tags: [axis-limits, percentile-trim, histogram, scatter, plotly]
dependency-graph:
  requires: [simple-statistics]
  provides: [axisLimits utility, axis range YAML config for histogram and scatter cards]
  affects: []
tech-stack:
  added: []
  patterns: [shared utility module for axis computation, YAML-driven prop configuration]
key-files:
  created:
    - src/plugins/interactive-dashboard/utils/axisLimits.ts
    - src/plugins/interactive-dashboard/utils/__tests__/axisLimits.test.ts
  modified:
    - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
    - src/plugins/interactive-dashboard/InteractiveDashboard.vue
decisions:
  - Use simple-statistics quantileSorted for percentile computation (already a project dependency)
  - Baseline data used for range computation to keep axis stable during filtering
  - computeAxisRange returns undefined when nothing configured (preserves Plotly auto-range)
  - Explicit min/max always overrides autoTrim for that bound
metrics:
  duration: ~6 minutes
  completed: 2026-02-12
---

# Quick Task 008: X-Axis Limits and Auto-Percentile Trim Summary

Shared axis range utility with percentile-based outlier trimming for histogram and scatter cards, configurable via YAML.

## What Was Done

### Task 1: Shared axis range utility with tests

Created `axisLimits.ts` with two exported functions:

- **`computePercentileBounds(values, percentile)`** - Calculates lower/upper bounds for the central N% of data. For percentile=95, returns the 2.5th and 97.5th percentile values. Uses `quantileSorted` from `simple-statistics`. Returns `{-Infinity, Infinity}` for fewer than 2 valid values.

- **`computeAxisRange(config)`** - Resolves explicit min/max, autoTrim percentile, and padding into a `[lower, upper]` tuple for Plotly axis `range`. Priority: explicit bounds override autoTrim; autoTrim overrides data range; nothing specified returns `undefined` (Plotly auto-range).

Exported `AxisRangeConfig` interface for typed usage.

Created 20 unit tests covering:
- Percentile bounds: 95th, 99th, 100th percentile; empty/single/constant arrays; outlier handling; NaN filtering
- Axis range: explicit min/max only, autoTrim only, mixed bounds, padding, negative values, empty data, backward compatibility

### Task 2: Integration into HistogramCard and ScatterCard

**HistogramCard.vue:**
- Added `xMin`, `xMax`, `autoTrim` props
- Added `xAxisRange` computed property using baseline data for stable range
- Applied range to `xaxisConfig` before tick thinning logic

**ScatterCard.vue:**
- Added `xMin`, `xMax`, `yMin`, `yMax`, `xAutoTrim`, `yAutoTrim` props
- Applied configured ranges after existing baseline-derived range calculation
- Configured ranges override default only when specified

**InteractiveDashboard.vue:**
- Added prop bindings for all 7 axis limit properties
- YAML card config properties automatically passed through (`setupRows` already copies all YAML properties via `Object.assign`)

## YAML Configuration

### Histogram Card
```yaml
- type: histogram
  column: distance
  binSize: 1000
  xMin: 0           # Hard minimum
  xMax: 50000       # Hard maximum
  autoTrim: 95      # Or: keep central 95% of data
```

### Scatter Card
```yaml
- type: scatter-plot
  xColumn: distance
  yColumn: travel_time
  xMin: 0
  xMax: 50000
  yAutoTrim: 99     # Trim y-axis outliers beyond 99th percentile
  xAutoTrim: 95     # Mix: trim x outliers, explicit y bounds
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- All 20 new axisLimits tests pass
- All 135 existing tests pass (2 pre-existing failures in MapCard.test.ts and DataTableManager.test.ts unrelated to this change)
- Production build succeeds with no TypeScript errors
- Backward compatible: cards with no axis limit config behave identically to before

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e70401bf | Create shared axis range utility with percentile trimming |
| 2 | 17d1b9da | Integrate axis limits into HistogramCard and ScatterCard |
