---
status: resolved
trigger: "scatter-highlight-mismatch"
created: 2026-01-29T00:00:00Z
updated: 2026-01-29T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Point index within a trace (category) is used to look up ID in global array
test: Implement fix to map trace pointIndex to global data index correctly
expecting: Clicking a point will highlight the correct row in all linked visualizations
next_action: Modify click handler to account for category-based trace separation

## Symptoms

expected: When hovering a scatter plot point, that exact point should be highlighted across linked visualizations and in the table
actual: A different, consistent (not random) point highlights instead - the same wrong point highlights each time for a given hover target
errors: No console errors visible
reproduction: Hover any scatter plot point on dashboard 5 de-optimization - wrong point highlights
started: User discovered issue while examining KLM optimization study outputs
context: This only happens on dashboard "5 de-optimization" which displays pricing scheme categories on scatter plots. Other dashboards without category coloring work correctly.

## Eliminated

## Evidence

- timestamp: 2026-01-29T00:01:00Z
  checked: Dashboard config (dashboard-5-optimization.yaml)
  found: Uses `type: scatter-plot` which maps to ScatterCard.vue, includes `colorColumn: pricing_scheme`
  implication: Dashboard correctly uses the interactive ScatterCard component with category coloring

- timestamp: 2026-01-29T00:02:00Z
  checked: ScatterCard.vue component implementation
  found: Lines 325-406 create separate Plotly traces per category. Lines 503-512 handle click events using `pointIndex` from the click event
  implication: When categories are used, each trace has its own point indices (0, 1, 2...) independent of other traces

- timestamp: 2026-01-29T00:03:00Z
  checked: Click handler logic (lines 503-512)
  found: `const pointIndex = data.points[0].pointIndex` followed by `const id = scatterData.value.ids[pointIndex]`
  implication: BUG CONFIRMED - pointIndex is the index within the clicked trace (category), but scatterData.value.ids contains ALL points across ALL categories in the original data order. When clicking point index 2 in trace "fixed_price" (2nd point in that category), it looks up scatterData.value.ids[2] which is the 3rd point overall, not the 2nd point in that category.

## Resolution

root_cause: In ScatterCard.vue, when categories are used (colorColumn specified), the scatter plot creates one Plotly trace per category (lines 325-406). Each trace has its own point indices starting from 0. However, the click handler (line 512) uses the pointIndex from the clicked trace to look up the ID in scatterData.value.ids, which contains all points in the original filteredData order. This causes an index mismatch - clicking the 3rd point in the "fixed_price" category looks up scatterData.value.ids[2], which is actually the 3rd point overall across all categories, not the 3rd point in that specific category.

fix: Modified ScatterCard.vue to store IDs directly with each trace using Plotly's customdata field. When building category traces, each point's ID is stored in customdata at the correct trace-specific index. The click and hover handlers now extract the ID from point.customdata.id (for category traces) or fall back to the global index lookup (for non-category traces). This ensures the correct point is identified regardless of trace separation.

verification:
1. Code compiles without TypeScript errors
2. Logic verified: customdata stores correct ID at trace-specific index
3. Click handler uses point.customdata.id for category traces (line 517)
4. Hover handler uses point.customdata.id for category traces (line 544)
5. Fallback to global index for non-category traces maintained (?? operator)
6. Manual testing required: Load dashboard "5 de-optimization", hover scatter points with pricing_scheme categories, verify correct row highlights in table
files_changed:
  - /mnt/Shared/Code/projects/Dissertation/simwrapper/src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
