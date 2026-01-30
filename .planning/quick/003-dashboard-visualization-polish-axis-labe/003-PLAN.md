---
phase: quick
plan: 003
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
  - src/plugins/interactive-dashboard/components/cards/MapCard.vue
  - src/plugins/interactive-dashboard/components/cards/ColorLegend.vue
  - src/plugins/interactive-dashboard/managers/FilterManager.ts
autonomous: true

must_haves:
  truths:
    - "Axis titles and legends display units (e.g., 'Distance [km]', 'Duration [min]')"
    - "Histogram allows selecting multiple bins within the same attribute (OR logic)"
    - "Comparison mode histograms show relative density, not absolute counts"
    - "Selected/highlighted map features render on top with dimmed non-selected features"
    - "Scatter legend shows formatted numeric values, not raw floats like 0.0029"
  artifacts:
    - path: "src/plugins/interactive-dashboard/components/cards/HistogramCard.vue"
      provides: "Scientific axis labels, multi-select bins, relative density mode"
    - path: "src/plugins/interactive-dashboard/components/cards/ScatterCard.vue"
      provides: "Scientific axis labels with units"
    - path: "src/plugins/interactive-dashboard/managers/FilterManager.ts"
      provides: "Multi-select within same dimension (OR logic)"
    - path: "src/plugins/interactive-dashboard/components/cards/MapCard.vue"
      provides: "Z-ordering for selected features, opacity dimming"
    - path: "src/plugins/interactive-dashboard/components/cards/ColorLegend.vue"
      provides: "Formatted numeric legend values"
  key_links:
    - from: "HistogramCard.vue"
      to: "tableConfig.columns.formats"
      via: "formatAxisLabel()"
      pattern: "unit.*\\[.*\\]"
---

<objective>
Polish dashboard visualizations for scientific publication readiness - 5 targeted improvements.

Purpose: Improve visual quality and usability for dissertation figures and analysis
Output: Enhanced axis labels, multi-select filtering, relative histograms, z-ordered maps, formatted legends
</objective>

<execution_context>
@/home/christoph/.claude/get-shit-done/workflows/execute-plan.md
@/home/christoph/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
@src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
@src/plugins/interactive-dashboard/components/cards/MapCard.vue
@src/plugins/interactive-dashboard/components/cards/ColorLegend.vue
@src/plugins/interactive-dashboard/managers/FilterManager.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add scientific axis labels with units</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
    src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
  </files>
  <action>
Add unit suffixes to axis titles based on tableConfig.columns.formats.

For HistogramCard.vue:
1. Create `formatAxisLabel(column: string): string` helper that:
   - Reads format from `columnFormat.value`
   - Returns `"{ColumnName} [{unit}]"` format, e.g., "Distance [km]", "Duration [min]"
   - Falls back to just column name if no unit defined
2. Update xaxis.title in layout to use `formatAxisLabel(props.column)`
3. Keep yaxis.title as "Count" (or "Density" in relative mode - Task 3)

For ScatterCard.vue:
1. Create similar `formatAxisLabel(column: string): string` helper
2. Update xaxis.title to use `formatAxisLabel(currentXColumn.value)`
3. Update yaxis.title to use `formatAxisLabel(currentYColumn.value)`

Unit mapping from ColumnFormat:
- type: 'distance', unit: 'km' -> "[km]"
- type: 'distance', unit: 'm' -> "[m]"
- type: 'duration', unit: 'min' -> "[min]"
- type: 'duration', unit: 's' -> "[s]"
- type: 'time' -> "[hh:mm]"
- type: 'percent' -> "[%]"
- type: 'decimal' + custom unit -> "[{unit}]" (support adding unit field to decimal type)

For PieChartCard.vue:
- No axis labels needed, but ensure legend title uses column name with unit if available
  </action>
  <verify>
Run `npm run dev`, load a dashboard with configured column formats (e.g., distance in km).
Verify histogram x-axis shows "Distance [km]" not just "Distance".
Verify scatter axes show units when configured.
  </verify>
  <done>
Axis titles display units from tableConfig in format "Column Name [unit]"
  </done>
</task>

<task type="auto">
  <name>Task 2: Enable multi-select histogram bins (OR within dimension)</name>
  <files>
    src/plugins/interactive-dashboard/managers/FilterManager.ts
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  </files>
  <action>
Enable selecting multiple bins within a histogram (e.g., income=1000 AND income=2000 both selected).

The FilterManager already has `values: Set<any>` which supports multiple values with OR logic.
The histogram's `selectedBins` ref already stores multiple bins.

Current issue: Clicking a new bin replaces the selection instead of adding to it.

In HistogramCard.vue, verify the click handler:
1. Current behavior: `selectedBins.value.add(bin)` / `.delete(bin)` - this should work
2. Check if emit is correct: `emit('filter', filterId, props.column, new Set(selectedBins.value), 'binned', binSize)`
3. The Set should contain all selected bins, and FilterManager's `applyFilters` already uses OR logic within values

If the issue is in FilterManager.setFilter():
- Line 36-37: It creates a new filter with the provided values Set
- This should preserve multiple values

Debug: Add console.log in HistogramCard click handler to verify `selectedBins.value` contains multiple bins after multiple clicks. The behavior should already work - test and verify.

If not working, the issue might be in how InteractiveDashboard handles the filter event. Check that it passes the values Set correctly to FilterManager.setFilter().
  </action>
  <verify>
1. Click histogram bin A -> highlights bin A
2. Click histogram bin B -> both A and B highlighted, table shows rows matching A OR B
3. Click bin A again -> only B highlighted
4. Click bin B -> no selection, all rows shown
  </verify>
  <done>
Multiple histogram bins can be selected simultaneously with OR logic within the dimension
  </done>
</task>

<task type="auto">
  <name>Task 3: Add relative density mode for comparison histograms</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  </files>
  <action>
In comparison mode, show relative frequency (density) instead of absolute counts.

When `props.showComparison` is true:
1. Compute total counts for baseline and filtered data
2. Convert counts to percentages (count / total * 100)
3. Update y-axis label from "Count" to "Percentage [%]"

Implementation:
1. Add computed `histogramDataDensity` that transforms `histogramData`:
   ```typescript
   const histogramDataDensity = computed(() => {
     if (!props.showComparison) return histogramData.value
     const total = histogramData.value.reduce((sum, d) => sum + d.count, 0)
     if (total === 0) return histogramData.value
     return histogramData.value.map(d => ({
       bin: d.bin,
       count: (d.count / total) * 100
     }))
   })
   ```

2. Add similar computed for baseline:
   ```typescript
   const baselineHistogramDataDensity = computed(() => {
     if (!props.showComparison) return baselineHistogramData.value
     const total = baselineHistogramData.value.reduce((sum, d) => sum + d.count, 0)
     if (total === 0) return baselineHistogramData.value
     return baselineHistogramData.value.map(d => ({
       bin: d.bin,
       count: (d.count / total) * 100
     }))
   })
   ```

3. In renderChart(), use density data when showComparison is true
4. Update yaxis.title: `props.showComparison ? 'Percentage [%]' : 'Count'`
5. Update hovertemplate to show percentage symbol when in comparison mode
  </action>
  <verify>
1. Enable comparison mode toggle
2. Apply a filter to reduce data
3. Histogram should show both traces as percentages (summing to ~100% each)
4. Y-axis should read "Percentage [%]"
5. Hover should show "X%" not "X"
  </verify>
  <done>
Comparison mode histograms display relative density (percentages) enabling meaningful shape comparison between filtered and baseline distributions
  </done>
</task>

<task type="auto">
  <name>Task 4: Z-order selected features on top with dimmed background</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/MapCard.vue
  </files>
  <action>
Selected/highlighted features should render on top of non-selected features with reduced opacity on others.

The `sortFeaturesByState()` function already sorts features for z-ordering (lines 1275-1299), but deck.gl may not respect this for all layer types.

Enhancement approach:
1. For PolygonLayer/ScatterplotLayer: The data array order determines z-order (already done via sortFeaturesByState)
2. Add opacity reduction for non-filtered features when selection is active

In getFeatureFillColor() (line 1301):
- Current: Returns dimmed color when `hasActiveFilters && !isFiltered && !hasActiveSelection`
- Change condition to also dim when `hasActiveSelection && !isSelected && !isHovered`
- This ensures non-selected features are dimmed when ANY selection exists

Add new logic after line 1323 (before the final return):
```typescript
// Dim non-selected features when there's an active selection
if (hasActiveSelection && !isSelected && !isHovered) {
  const baseColor = getBaseColor(feature, layerConfig)
  return [baseColor[0], baseColor[1], baseColor[2], 80] // 30% opacity
}
```

Similarly update getFeatureColor() (line 1515) and getFeatureWidth() (line 1452):
- Non-selected features get reduced opacity/width when selection is active

This creates visual hierarchy: selected features pop, everything else fades.
  </action>
  <verify>
1. Click a polygon on the map to select it
2. Selected polygon should be fully visible with selection color
3. Other polygons should be dimmed (reduced opacity)
4. Hover over a non-selected polygon -> it brightens temporarily
5. Clear selection -> all polygons return to normal opacity
  </verify>
  <done>
Selected map features render prominently on top with non-selected features dimmed to 30% opacity
  </done>
</task>

<task type="auto">
  <name>Task 5: Format numeric legend values in ColorLegend and ScatterCard</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/ColorLegend.vue
    src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  </files>
  <action>
Numeric legend shows raw floats like 0.0029 instead of formatted values.

In ColorLegend.vue, improve formatNumber() function (line 73):
```typescript
function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null) return '0'

  // Handle very small numbers (scientific notation threshold)
  if (Math.abs(value) > 0 && Math.abs(value) < 0.01) {
    return value.toExponential(2) // e.g., 2.9e-3
  }

  // Handle very large numbers
  if (Math.abs(value) >= 10000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  // Handle numbers between 0.01 and 10000
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toFixed(3) // Small numbers like 0.123
}
```

For ScatterCard.vue legend, the legend items use category labels directly.
Check if any numeric formatting is needed for the legend - if colorColumn values are numeric, they should be formatted.

In ScatterCard's generateCategoryColors(), add numeric formatting for labels:
- If the category is a number, format it appropriately
- The legend shows category names, not numeric scales, so this may not be the issue

Actually review where "0.0029" appears:
- If it's in axis labels: use formatValue() which already handles this
- If it's in hover text: update hovertemplate
- If it's in legend: unlikely for scatter (categorical legends)

Most likely issue is in ColorLegend for MapCard numeric legends (Viridis scale).
The minValue/maxValue formatting is the target - already addressed above.
  </action>
  <verify>
1. Configure a map with numeric colorBy (e.g., population)
2. Legend should show formatted min/max values (not 0.0029432)
3. Verify small numbers show as "2.9e-3" or similar scientific notation
4. Verify large numbers show with commas (e.g., "10,000")
  </verify>
  <done>
Numeric legend values are human-readable with appropriate precision and formatting
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. npm run dev - no console errors
2. Load a dashboard with:
   - Histogram with distance/duration columns -> verify axis labels show units
   - Scatter plot -> verify both axis labels show units
   - Comparison mode -> verify histogram shows percentages
   - Map with selection -> verify z-ordering and dimming
   - Numeric colorBy on map -> verify legend formatting
3. Multi-select histogram bins -> verify OR filtering works
</verification>

<success_criteria>
- Axis labels show scientific units: "Distance [km]", "Duration [min]"
- Multiple histogram bins selectable with OR logic
- Comparison histograms use relative density (percentages)
- Map selections create visual hierarchy (selected on top, others dimmed)
- Numeric legends show formatted values, not raw floats
</success_criteria>

<output>
After completion, create `.planning/quick/003-dashboard-visualization-polish-axis-labe/003-SUMMARY.md`
</output>
