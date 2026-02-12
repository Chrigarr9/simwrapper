---
phase: quick-008
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plugins/interactive-dashboard/utils/axisLimits.ts
  - src/plugins/interactive-dashboard/utils/__tests__/axisLimits.test.ts
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  - src/plugins/interactive-dashboard/InteractiveDashboard.vue
autonomous: true

must_haves:
  truths:
    - "Histogram card respects xMin/xMax YAML config to hard-limit x-axis range"
    - "Scatter card respects xMin/xMax/yMin/yMax YAML config to hard-limit axis ranges"
    - "autoTrim on histogram trims x-axis to central N% of data (e.g., 95% shows 2.5th-97.5th percentile)"
    - "xAutoTrim/yAutoTrim on scatter trims respective axes to central N% of data"
    - "Explicit min/max values override autoTrim when both are specified"
    - "When neither min/max nor autoTrim is set, behavior is unchanged (Plotly auto-range)"
  artifacts:
    - path: "src/plugins/interactive-dashboard/utils/axisLimits.ts"
      provides: "Shared percentile calculation and axis range resolution logic"
      exports: ["computeAxisRange", "computePercentileBounds"]
    - path: "src/plugins/interactive-dashboard/utils/__tests__/axisLimits.test.ts"
      provides: "Unit tests for axis range computation"
  key_links:
    - from: "src/plugins/interactive-dashboard/components/cards/HistogramCard.vue"
      to: "src/plugins/interactive-dashboard/utils/axisLimits.ts"
      via: "import computeAxisRange"
      pattern: "import.*computeAxisRange.*axisLimits"
    - from: "src/plugins/interactive-dashboard/components/cards/ScatterCard.vue"
      to: "src/plugins/interactive-dashboard/utils/axisLimits.ts"
      via: "import computeAxisRange"
      pattern: "import.*computeAxisRange.*axisLimits"
    - from: "src/plugins/interactive-dashboard/InteractiveDashboard.vue"
      to: "HistogramCard/ScatterCard"
      via: "prop bindings for axis limit configs"
      pattern: ":auto-trim|:x-auto-trim|:x-min|:x-max|:y-min|:y-max"
---

<objective>
Add x-axis min/max limits and auto-percentile trimming for scatter and histogram cards.

Purpose: Transportation simulation data often contains extreme outliers (e.g., a few trips with 500km distance when 95% are under 50km). This feature lets users control axis ranges via YAML config to produce clean, focused visualizations without outlier distortion.

Output: A shared utility for percentile-based axis range computation, updated HistogramCard and ScatterCard that honor xMin/xMax/yMin/yMax and autoTrim/xAutoTrim/yAutoTrim YAML config, and prop bindings in InteractiveDashboard.vue.
</objective>

<execution_context>
@C:\Users\VWAUCCY\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\VWAUCCY\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
@src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
@src/plugins/interactive-dashboard/InteractiveDashboard.vue
@src/plugins/interactive-dashboard/utils/statistics.ts
@src/plugins/interactive-dashboard/utils/__tests__/statistics.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create shared axis range utility with tests</name>
  <files>
    src/plugins/interactive-dashboard/utils/axisLimits.ts
    src/plugins/interactive-dashboard/utils/__tests__/axisLimits.test.ts
  </files>
  <action>
Create `src/plugins/interactive-dashboard/utils/axisLimits.ts` with two exported functions:

1. `computePercentileBounds(values: number[], percentile: number): { lower: number; upper: number }`
   - Takes an array of numeric values and a percentile (e.g., 95 means keep central 95%).
   - Calculates lower bound at `(100 - percentile) / 2` percentile and upper bound at `100 - (100 - percentile) / 2` percentile.
   - For percentile=95: lower=2.5th percentile, upper=97.5th percentile.
   - Use `quantileSorted` from `simple-statistics` (sort values first, filter out null/undefined/NaN).
   - If fewer than 2 valid values, return `{ lower: -Infinity, upper: Infinity }` (no trimming).

2. `computeAxisRange(config: AxisRangeConfig): [number, number] | undefined`
   - Config interface:
     ```typescript
     interface AxisRangeConfig {
       values: number[]       // Data values for the axis
       min?: number           // Explicit minimum (from YAML xMin/yMin)
       max?: number           // Explicit maximum (from YAML xMax/yMax)
       autoTrim?: number      // Percentile for auto-trimming (from YAML autoTrim/xAutoTrim/yAutoTrim)
       padding?: number       // Fractional padding (default 0.02 = 2%)
     }
     ```
   - Resolution priority:
     a. If both `min` AND `max` are specified, use them directly (add padding).
     b. If only `min` specified, use min + auto/data max.
     c. If only `max` specified, use auto/data min + max.
     d. If `autoTrim` specified (and no explicit override for that bound), compute percentile bounds.
     e. If nothing specified, return `undefined` (let Plotly auto-range).
   - Padding: Add `padding * (max - min)` to each side. Default padding is 0.02 (2%).
   - Return `[lower, upper]` tuple suitable for Plotly `range` property, or `undefined` for auto-range.

Export the `AxisRangeConfig` interface as well.

Create `src/plugins/interactive-dashboard/utils/__tests__/axisLimits.test.ts` with tests covering:
- `computePercentileBounds`: basic 95th percentile, 99th percentile, edge cases (empty array, single value, all same values)
- `computeAxisRange`: explicit min/max only, autoTrim only, mixed (min explicit + autoTrim for max), neither specified returns undefined, padding applied correctly
- Priority: explicit min/max override autoTrim bounds

Follow the same test style as `statistics.test.ts` (describe/it/expect pattern from vitest).
  </action>
  <verify>
Run `npx vitest run src/plugins/interactive-dashboard/utils/__tests__/axisLimits.test.ts` and confirm all tests pass.
  </verify>
  <done>
`axisLimits.ts` exports `computePercentileBounds`, `computeAxisRange`, and `AxisRangeConfig`. All tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate axis limits into HistogramCard and ScatterCard</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
    src/plugins/interactive-dashboard/InteractiveDashboard.vue
  </files>
  <action>
**HistogramCard.vue changes:**

1. Add new props to the `Props` interface:
   ```typescript
   xMin?: number          // Explicit x-axis minimum
   xMax?: number          // Explicit x-axis maximum
   autoTrim?: number      // Percentile for auto-trimming (e.g., 95)
   ```

2. Import `computeAxisRange` from `../../utils/axisLimits`.

3. Add a computed property `xAxisRange` that calls `computeAxisRange` with:
   - `values`: Extract all numeric values from `baselineData` (if available) or `filteredData` for the `props.column`. Use baseline data so the range stays stable when filtering.
   - `min`: `props.xMin`
   - `max`: `props.xMax`
   - `autoTrim`: `props.autoTrim`
   - `padding`: 0.02

4. In the `renderChart()` function, after building `xaxisConfig`, apply the range:
   ```typescript
   // Apply configured axis range (from xMin/xMax or autoTrim)
   const axisRange = xAxisRange.value
   if (axisRange) {
     xaxisConfig.range = axisRange
     xaxisConfig.autorange = false
   }
   ```
   Place this BEFORE the existing tick-thinning logic (around line 356) so the range is set before ticks are computed. The tick thinning already operates on `histogramData` bins, so it will naturally show only ticks within the visible range.

**ScatterCard.vue changes:**

1. Add new props to the `Props` interface:
   ```typescript
   xMin?: number          // Explicit x-axis minimum
   xMax?: number          // Explicit x-axis maximum
   yMin?: number          // Explicit y-axis minimum
   yMax?: number          // Explicit y-axis maximum
   xAutoTrim?: number     // X-axis percentile auto-trim (e.g., 95)
   yAutoTrim?: number     // Y-axis percentile auto-trim (e.g., 99)
   ```

2. Import `computeAxisRange` from `../../utils/axisLimits`.

3. In the `buildChartData()` function, after the existing axis range calculation block (lines 643-651 where `xMin`, `xMax`, `yMin`, `yMax` local variables and padding are computed), add axis limit override logic. IMPORTANT: The existing code already has local variables named `xMin`, `xMax`, `yMin`, `yMax` (lines 646-649). To avoid naming conflicts, compute the configured range AFTER the existing range calculation and apply it to the axis config objects:

   ```typescript
   // After existing axis config setup (around line 665):
   // Apply configured axis range overrides (from YAML xMin/xMax/xAutoTrim/yAutoTrim)
   const configuredXRange = computeAxisRange({
     values: xDataForRange,
     min: props.xMin,
     max: props.xMax,
     autoTrim: props.xAutoTrim,
     padding: 0.02,
   })
   if (configuredXRange) {
     xAxisConfig.range = configuredXRange
     xAxisConfig.autorange = false
   }

   const configuredYRange = computeAxisRange({
     values: yDataForRange,
     min: props.yMin,
     max: props.yMax,
     autoTrim: props.yAutoTrim,
     padding: 0.02,
   })
   if (configuredYRange) {
     yAxisConfig.range = configuredYRange
     yAxisConfig.autorange = false
   }
   ```

   Place this AFTER `xAxisConfig` and `yAxisConfig` objects are built (after line ~679) but BEFORE the `layout` object is constructed (line 681). This way, the configured range overrides the default baseline-derived range.

   NOTE: If NEITHER explicit min/max NOR autoTrim is specified, `computeAxisRange` returns `undefined` and the existing baseline-range logic remains unchanged. This is the desired backward-compatible behavior.

**InteractiveDashboard.vue template changes:**

Add prop bindings to the dynamic component block (around lines 88-95, after the existing `:bin-size` and before `:title`):

```pug
:x-min="card.xMin"
:x-max="card.xMax"
:y-min="card.yMin"
:y-max="card.yMax"
:auto-trim="card.autoTrim"
:x-auto-trim="card.xAutoTrim"
:y-auto-trim="card.yAutoTrim"
```

These values come directly from the YAML card config. The `setupRows` method already copies all YAML properties onto the card object via `Object.assign({}, card)` at line 1024, so no changes to `setupRows` are needed.
  </action>
  <verify>
1. Run `npm run build` to confirm no TypeScript errors.
2. Run `npx vitest run src/plugins/interactive-dashboard/` to confirm all existing tests still pass.
3. Manual verification: In a dashboard YAML, add `xMin: 0` and `xMax: 50000` to a histogram card and confirm the x-axis is limited. Add `autoTrim: 95` to another histogram and confirm outliers are trimmed. Add `xAutoTrim: 95` and `yAutoTrim: 99` to a scatter card.
  </verify>
  <done>
HistogramCard accepts xMin/xMax/autoTrim props and applies them to Plotly x-axis range. ScatterCard accepts xMin/xMax/yMin/yMax/xAutoTrim/yAutoTrim props and applies them to both axes. InteractiveDashboard.vue passes these props from YAML config. All existing tests pass. Build succeeds.
  </done>
</task>

</tasks>

<verification>
1. `npx vitest run src/plugins/interactive-dashboard/` -- all tests pass (existing + new axisLimits tests)
2. `npm run build` -- no TypeScript errors, production build succeeds
3. Histogram with `xMin: 0, xMax: 50000` shows only that range
4. Histogram with `autoTrim: 95` shows central 95% of data
5. Scatter with `xAutoTrim: 95, yAutoTrim: 99` trims both axes appropriately
6. Scatter with `xMin: 0, xMax: 50000` and `yAutoTrim: 99` mixes explicit and auto
7. Cards with NO axis limit config behave identically to before (backward compatible)
</verification>

<success_criteria>
- New utility `axisLimits.ts` with `computeAxisRange` and `computePercentileBounds` functions
- Unit tests for axis range computation pass
- HistogramCard supports `xMin`, `xMax`, `autoTrim` YAML config
- ScatterCard supports `xMin`, `xMax`, `yMin`, `yMax`, `xAutoTrim`, `yAutoTrim` YAML config
- Explicit min/max overrides autoTrim when both specified
- Existing behavior unchanged when no axis limit config present
- Build passes, all tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/008-x-axis-limits-and-auto-percentile-trim/008-SUMMARY.md`
</output>
