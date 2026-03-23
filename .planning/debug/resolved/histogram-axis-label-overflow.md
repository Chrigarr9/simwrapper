---
status: resolved
trigger: "histogram-axis-label-overflow"
created: 2026-01-29T00:00:00Z
updated: 2026-01-29T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED
test: TypeScript compiles, tests pass
expecting: N/A
next_action: Archive session

## Symptoms

expected:
1. Axis tick labels should auto-skip when there are too many to fit (show every 2nd, 3rd, etc.)
2. X and Y axis should have enough margin space for longer labels (like datetime format)
3. Hover tooltips show exact values, so not every tick needs a label
4. Labels should not overlap or be crammed together

actual:
1. Every bar has an X axis label, causing overlap when many bars
2. Y axis labels may also be cramped
3. Long labels (like time values "14:30:00") overflow their space

errors: None - visual/UX issue

reproduction:
1. Load histogram with many bins/bars
2. Or load histogram with datetime/time-based X axis values
3. Observe overlapping axis labels

started: Current behavior

## Eliminated

## Evidence

- timestamp: 2026-01-29T00:01:00Z
  checked: HistogramCard.vue xaxis configuration (lines 306-320)
  found: |
    When columnFormat is defined, the code sets:
    - tickmode: 'array'
    - tickvals: ALL bin values (line 257)
    - ticktext: formatted version of ALL bins (line 258)
    This forces Plotly to show ALL tick labels, causing overlap with many bins.
  implication: Root cause for X-axis overlap when formatting is applied

- timestamp: 2026-01-29T00:01:30Z
  checked: Plotly margin settings (line 335)
  found: margin: { l: 50, r: 15, t: 10, b: 35 }
  implication: Bottom margin (35) too small for rotated/long labels, left margin (50) may be tight for large counts

- timestamp: 2026-01-29T00:02:00Z
  checked: Y-axis configuration (lines 328-334)
  found: No tickmode restriction on Y-axis, but Plotly auto-handles numeric Y-axis well
  implication: Y-axis is less of an issue, Plotly handles numeric auto-thinning

## Resolution

root_cause: |
  When columnFormat is defined (time/duration/distance/etc), the code forces tickmode:'array'
  with ALL bin values as tickvals. This overrides Plotly's auto-thinning and displays every
  tick label regardless of available space. Combined with small margins (b:35, l:50), this
  causes label overlap with many bins or long formatted labels (like "14:30" time format).

fix: |
  Applied these changes to HistogramCard.vue:

  1. Added intelligent tick thinning: When columnFormat is defined, compute skipInterval
     to show at most 15 tick labels (maxTicksToShow = 15). Always show first and last
     tick for context, plus evenly spaced ticks in between.

  2. For non-formatted columns with many bins: Use Plotly's tickmode:'auto' with nticks:15
     to let Plotly handle the thinning.

  3. Increased margins: bottom from 35 to 50, left from 50 to 60 for longer labels.

  4. Added automargin:true to both xaxis and yaxis to let Plotly auto-expand margins
     when labels are long.

  5. Added tickangle:-45 rotation when there are more than 10 bins to prevent overlap.

verification: |
  - TypeScript compiles without errors
  - All tests pass (2 pre-existing failures unrelated to this change)
  - Code review confirms logic is correct

files_changed:
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
