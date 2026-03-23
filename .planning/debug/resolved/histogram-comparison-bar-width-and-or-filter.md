---
status: resolved
trigger: "histogram-comparison-bar-width-and-or-filter"
created: 2026-01-28T00:00:00Z
updated: 2026-01-28T00:00:00Z
---

## Current Focus

hypothesis: Two issues confirmed - (1) filtered bins computed from filtered data instead of using baseline bins, (2) baseline click handler explicitly returns early without allowing OR filter
test: Examined histogramData, baselineHistogramData computed properties and plotly_click handler
expecting: Fix needed in both areas
next_action: Design and implement fix for both issues

## Symptoms

expected:
1. In comparison mode, baseline and filtered histogram bars should have identical bin boundaries/widths so they overlay properly
2. Clicking on a baseline bar should ADD that range to the current filter (OR logic), allowing multi-range selection

actual:
1. Filtered histogram recalculates bins based on filtered data, causing different bar widths than baseline
2. Clicking baseline bars does nothing - can't extend the filter with additional ranges

errors: None reported

reproduction:
1. Open a histogram card with numeric data
2. Click on a bar to filter (comparison mode auto-enables)
3. Observe: baseline bars behind have different widths than filtered bars
4. Try clicking another baseline bar to add to filter - nothing happens

started: Current behavior - may have always been this way

## Eliminated

## Evidence

- timestamp: 2026-01-28T00:01:00Z
  checked: histogramData computed property (lines 144-168) vs baselineHistogramData (lines 182-207)
  found: Both use identical bin computation logic with props.binSize BUT they compute bins independently from their respective data sources. histogramData uses props.filteredData while baselineHistogramData uses props.baselineData. This means filtered histogram gets different bins if filtered data has different min/max range.
  implication: Root cause #1 confirmed - bins are NOT shared between baseline and filtered traces

- timestamp: 2026-01-28T00:02:00Z
  checked: plotly_click handler (lines 331-363)
  found: Lines 336-342 explicitly check if baseline trace was clicked (curveNumber === 0) and returns early without any action. The comment says "Don't respond to baseline trace clicks"
  implication: Root cause #2 confirmed - baseline clicks are intentionally blocked, preventing OR filter extension

## Resolution

root_cause: Two issues:
  1. histogramData and baselineHistogramData compute bins independently from their respective data sources. When filtered data has a different range, bins don't align because Math.floor(val / binSize) * binSize produces different bin boundaries for different value ranges.
  2. The plotly_click handler explicitly returns early when baseline trace (curveNumber === 0) is clicked, preventing OR filter functionality.

fix:
  1. Moved baselineHistogramData computed property BEFORE histogramData so baseline bins are available
  2. Modified histogramData to use baseline bins when in comparison mode - iterates over baselineHistogramData bins and counts filtered values into those same bins
  3. Removed the early return in plotly_click handler that was blocking baseline trace clicks

verification:
  - TypeScript compiles without errors (excluding pre-existing node_modules issues)
  - Logic verified: in comparison mode, histogramData now uses baselineHistogramData.value to get bin boundaries, ensuring perfect alignment
  - Click handler now processes both trace clicks (curveNumber 0 and 1) identically

files_changed:
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
