---
id: "006"
type: quick
title: "Scientific Mode Markers and Patterns"
status: planned
autonomous: true
files_modified:
  - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
  - src/plugins/interactive-dashboard/managers/StyleManager.ts

must_haves:
  truths:
    - "Scatter plots use distinct marker shapes per category in scientific mode"
    - "Bar charts use distinct fill patterns per trace in scientific mode"
    - "Pie charts use distinct slice patterns in scientific mode"
  artifacts:
    - path: "src/plugins/interactive-dashboard/components/cards/ScatterCard.vue"
      provides: "Marker symbols for categorical data in scientific mode"
    - path: "src/plugins/interactive-dashboard/components/cards/HistogramCard.vue"
      provides: "Bar fill patterns in scientific mode"
    - path: "src/plugins/interactive-dashboard/components/cards/PieChartCard.vue"
      provides: "Slice patterns in scientific mode"
    - path: "src/plugins/interactive-dashboard/managers/StyleManager.ts"
      provides: "Marker symbol and pattern configuration arrays"
  key_links:
    - from: "ScatterCard.vue"
      to: "StyleManager.ts"
      via: "getScientificMarkerSymbol(index)"
    - from: "HistogramCard.vue"
      to: "Plotly marker.pattern"
      via: "pattern shape property in scientific mode"
    - from: "PieChartCard.vue"
      to: "Plotly marker.pattern"
      via: "pattern shape property in scientific mode"
---

<objective>
Add marker shapes, line styles, and bar/pie patterns to scientific mode for print accessibility.

Purpose: When scientific mode is active, charts should differentiate data series not just by color but also by marker shape (scatter), bar fill patterns (histograms), and slice patterns (pie charts). This ensures print-friendly visualizations that remain distinguishable in grayscale.

Output: Charts that use distinct visual markers beyond color when in scientific mode.
</objective>

<execution_context>
@/home/christoph/.claude/get-shit-done/workflows/execute-plan.md
@/home/christoph/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/plugins/interactive-dashboard/managers/StyleManager.ts
@src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
@src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
@src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add scientific marker/pattern arrays to StyleManager</name>
  <files>src/plugins/interactive-dashboard/managers/StyleManager.ts</files>
  <action>
Add to the `scientific` configuration object in StyleManager.ts:

1. Add a `markerSymbols` array with Plotly marker symbols for scatter plots:
   ```typescript
   markerSymbols: ['circle', 'square', 'diamond', 'cross', 'x', 'triangle-up', 'triangle-down', 'star', 'hexagon', 'pentagon']
   ```

2. Add a `barPatterns` array with Plotly pattern shapes for bars:
   ```typescript
   barPatterns: ['', '/', '\\', 'x', '-', '|', '+', '.']  // '' means solid fill
   ```

3. Add a `piePatterns` array with Plotly pattern shapes for pie slices:
   ```typescript
   piePatterns: ['', '/', '\\', 'x', '+', '-', '|', '.']
   ```

4. Add getter methods to the StyleManager class:
   - `getScientificMarkerSymbol(index: number): string` - returns symbol from markerSymbols array (wraps around)
   - `getScientificBarPattern(index: number): string` - returns pattern from barPatterns array
   - `getScientificPiePattern(index: number): string` - returns pattern from piePatterns array

5. Update the `getScientificConfig()` method return type to include the new arrays.
  </action>
  <verify>TypeScript compiles without errors: `npm run build` passes</verify>
  <done>StyleManager exposes marker symbols and pattern arrays for scientific mode</done>
</task>

<task type="auto">
  <name>Task 2: Add marker shapes to ScatterCard in scientific mode</name>
  <files>src/plugins/interactive-dashboard/components/cards/ScatterCard.vue</files>
  <action>
Modify the `renderChart()` function in ScatterCard.vue to apply marker symbols when scientific mode is active:

1. When building traces for categorical data (hasCategories = true):
   - In scientific mode, add `marker.symbol` property to each trace
   - Get symbol from `StyleManager.getInstance().getScientificMarkerSymbol(categoryIndex)`
   - Each category trace gets a distinct symbol (circle, square, diamond, etc.)

2. For the main trace section (line ~463-480) when hasCategories is false:
   - In scientific mode, use 'circle' as default marker symbol (or omit since Plotly defaults to circle)

3. For baseline trace in comparison mode:
   - Use 'circle-open' (hollow circle) in scientific mode to distinguish from filtered data

Implementation pattern:
```typescript
// Inside the category trace loop (around line 400-423):
if (isScientific) {
  trace.marker.symbol = styleManager.getScientificMarkerSymbol(categoryIndex)
}

// For baseline trace (around line 317-336):
if (isScientific) {
  trace.marker.symbol = 'circle-open'
}
```

Note: Keep existing color logic intact. Marker symbols ADD to color differentiation, they don't replace it.
  </action>
  <verify>
1. Run app with `npm run dev`
2. Open a dashboard with a scatter plot that has colorColumn set (categorical coloring)
3. Toggle to scientific mode using the theme button
4. Verify each category shows a distinct marker shape (circle, square, diamond, etc.)
5. If comparison mode is enabled, verify baseline points show hollow circles
  </verify>
  <done>Scatter plots display distinct marker shapes per category when in scientific mode</done>
</task>

<task type="auto">
  <name>Task 3: Add bar patterns to HistogramCard and slice patterns to PieChartCard</name>
  <files>src/plugins/interactive-dashboard/components/cards/HistogramCard.vue, src/plugins/interactive-dashboard/components/cards/PieChartCard.vue</files>
  <action>
**HistogramCard.vue:**

In `renderChart()`, add pattern to the filtered trace when in scientific mode and comparison mode is active:

1. Locate the filtered trace creation (around line 298-317)
2. In scientific mode with comparison active, add `marker.pattern` property:
   ```typescript
   marker: {
     color: displayData.map(d => selectedBins.value.has(d.bin) ? selectedColor : barColor),
     pattern: isScientific && props.showComparison ? {
       shape: '/',  // diagonal lines for filtered trace
       bgcolor: 'transparent',
       fgcolor: barColor,
       size: 8,
       solidity: 0.5
     } : undefined,
     line: { ... }
   }
   ```

3. The baseline trace remains solid (no pattern) as the "background" reference

**PieChartCard.vue:**

In `renderChart()`, add patterns to pie slices when in scientific mode:

1. Locate the main trace creation (around line 152-178)
2. In scientific mode, add `marker.pattern` with distinct patterns per slice:
   ```typescript
   const slicePatterns = isScientific
     ? pieData.value.map((_, i) => styleManager.getScientificPiePattern(i))
     : undefined

   // Inside mainTrace marker:
   marker: {
     colors,
     pattern: isScientific ? {
       shape: slicePatterns,
       bgcolor: colors,
       fgcolor: pieData.value.map(() => textColor),  // Pattern lines in text color
       size: 10,
       solidity: 0.4
     } : undefined,
     line: { ... }
   }
   ```

3. For baseline ring in comparison mode, use different patterns or solid fill to distinguish from filtered
  </action>
  <verify>
1. Run app with `npm run dev`
2. Open a dashboard with histogram and pie chart cards
3. Toggle to scientific mode
4. For histogram: enable comparison mode (filter some data) - filtered bars should show diagonal pattern
5. For pie chart: each slice should show a distinct pattern (solid, diagonal, cross-hatch, etc.)
6. Verify patterns are visible and distinguishable
  </verify>
  <done>Histogram bars show patterns in comparison mode, pie slices show distinct patterns per category when in scientific mode</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npm run build` passes without errors
2. Visual verification:
   - ScatterCard: categories have distinct marker shapes in scientific mode
   - HistogramCard: comparison mode shows patterned bars for filtered data
   - PieChartCard: slices have distinct patterns in scientific mode
3. Non-scientific mode unchanged: charts render normally in dark/light modes
4. Export test: Download PNG in scientific mode - patterns visible in exported image
</verification>

<success_criteria>
- Scatter plots differentiate categories by marker shape (circle, square, diamond, etc.) in scientific mode
- Histogram bars use fill patterns when comparison mode is active in scientific mode
- Pie chart slices use distinct patterns per category in scientific mode
- All patterns remain visible when exported as PNG
- Normal (non-scientific) mode rendering is unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/006-scientific-mode-markers-patterns/006-SUMMARY.md`
</output>
