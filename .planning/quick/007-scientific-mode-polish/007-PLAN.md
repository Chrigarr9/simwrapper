---
phase: quick
plan: 007
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
autonomous: true

must_haves:
  truths:
    - "ScatterCard comparison baseline uses distinct marker style in scientific mode"
    - "HistogramCard comparison baseline uses distinct pattern in scientific mode"
    - "PieChartCard labels remain readable when fill patterns are active"
    - "Legend entries display in Title Case format"
  artifacts:
    - path: "src/plugins/interactive-dashboard/components/cards/ScatterCard.vue"
      provides: "Consistent scientific styling for baseline trace"
    - path: "src/plugins/interactive-dashboard/components/cards/HistogramCard.vue"
      provides: "Distinct pattern for baseline bars in scientific mode"
    - path: "src/plugins/interactive-dashboard/components/cards/PieChartCard.vue"
      provides: "Improved label visibility with patterns"
  key_links:
    - from: "ScatterCard.vue"
      to: "StyleManager"
      via: "getScientificMarkerSymbol()"
    - from: "HistogramCard.vue"
      to: "StyleManager"
      via: "getScientificBarPattern()"
---

<objective>
Polish scientific mode comparison styling across chart components.

Purpose: Ensure comparison mode visualizations are publication-ready with consistent marker/pattern styling and readable labels when fill patterns are active.

Output: Updated ScatterCard, HistogramCard, and PieChartCard with polished scientific mode styling.
</objective>

<context>
@.planning/STATE.md
@src/plugins/interactive-dashboard/managers/StyleManager.ts
@src/plugins/interactive-dashboard/utils/labelFormatter.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply consistent scientific styling to comparison traces</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  </files>
  <action>
**ScatterCard.vue** - Baseline trace scientific styling:

1. Import toTitleCase from labelFormatter.ts (add to existing imports around line 14)
2. In the baseline trace section (~line 317-336), add marker styling for scientific mode:
   - In scientific mode, use `symbol: 'circle-open'` for baseline trace (already partially there)
   - Ensure baseline trace has distinct line width: `line.width: 1` in scientific mode
3. Apply toTitleCase() to legend labels:
   - Line 401 where `name: category` is set, change to `name: toTitleCase(category)`
   - This ensures legend entries like "main_mode" display as "Main Mode"

**HistogramCard.vue** - Baseline trace scientific styling:

1. Import toTitleCase from labelFormatter.ts (add to existing imports around line 12)
2. In the baseline trace section (~line 280-295), add pattern styling for scientific mode:
   - When isScientific is true, add a pattern different from the filtered trace:
   ```typescript
   pattern: isScientific ? {
     shape: '.',  // Dots for baseline (filtered uses '/')
     bgcolor: 'rgba(156, 163, 175, 0.3)',
     fgcolor: 'rgba(100, 100, 100, 0.5)',
     size: 6,
     solidity: 0.3
   } : undefined,
   ```
3. The legend labels "Baseline (All Data)" and "Filtered" are already descriptive - no toTitleCase needed.
  </action>
  <verify>
1. Open a dashboard with comparison mode active
2. Toggle to scientific mode using theme button
3. Verify ScatterCard baseline points use open circles
4. Verify HistogramCard baseline bars have dotted pattern, filtered bars have diagonal pattern
5. Verify legend entries in ScatterCard show "Main Mode" not "main_mode"
  </verify>
  <done>
- ScatterCard baseline uses circle-open marker in scientific mode
- ScatterCard legend labels use toTitleCase formatting
- HistogramCard baseline uses dot pattern distinct from filtered diagonal pattern
  </done>
</task>

<task type="auto">
  <name>Task 2: Improve PieChartCard label visibility with patterns</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
  </files>
  <action>
In PieChartCard.vue, improve label readability when scientific mode patterns are active:

1. Modify the textPositions logic (~line 135-139) to account for scientific mode:
   - In scientific mode, prefer 'outside' positioning for more labels since patterns can obscure inside text
   - Change threshold: Large slices (>=15%) inside, others outside
   ```typescript
   const textPositions = pieData.value.map(d => {
     const pct = (d.value / total) * 100
     if (isScientific) {
       // Scientific mode: be more aggressive about outside labels due to patterns
       if (pct >= 15) return 'inside'
       if (pct >= 2) return 'outside'
       return 'none'
     }
     // Standard mode
     if (pct >= 10) return 'inside'
     if (pct >= 3) return 'outside'
     return 'none'
   })
   ```

2. For inside labels in scientific mode, add a background for contrast:
   - Update insidetextfont to include a background or use darker color
   - Since Plotly doesn't support text backgrounds natively, use bolder font weight:
   ```typescript
   textfont: {
     color: isScientific ? '#000000' : textColor,  // Pure black for scientific
     size: 11,
     family: fontFamily
   },
   ```

3. Increase the margin.b to 40 to accommodate more outside labels:
   ```typescript
   margin: { t: 10, b: 40, l: 15, r: 15 }
   ```
  </action>
  <verify>
1. Open a dashboard with a pie chart
2. Toggle to scientific mode
3. Verify pie slice labels are readable over patterned fills
4. Verify smaller slices (3-15%) have labels positioned outside
5. Verify no label text is cut off at margins
  </verify>
  <done>
- PieChartCard uses more aggressive outside positioning in scientific mode
- Inside labels use pure black for maximum contrast against patterns
- Margins adjusted to accommodate outside labels
  </done>
</task>

<task type="auto">
  <name>Task 3: Apply toTitleCase to legend labels in all chart cards</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
  </files>
  <action>
Ensure all legend entries use consistent toTitleCase formatting:

**ScatterCard.vue** (if not done in Task 1):
- Already handled in Task 1: `name: toTitleCase(category)` for category traces

**HistogramCard.vue**:
- The fixed legend names "Baseline (All Data)" and "Filtered" are already properly formatted
- No changes needed

**PieChartCard.vue**:
- Line 158: `labels: pieData.value.map(d => toTitleCase(d.label))` - already using toTitleCase
- Line 201: `labels: baselinePieData.value.map(d => toTitleCase(d.label))` - already using toTitleCase
- No changes needed

**Verification only** - confirm toTitleCase is consistently applied:
- ScatterCard trace names (category labels)
- PieChartCard slice labels (confirmed present)
- HistogramCard uses static English strings (no conversion needed)
  </action>
  <verify>
1. Open a dashboard with ScatterCard showing categorical color column
2. Verify legend shows "Main Mode" not "main_mode"
3. Open PieChartCard - verify slice labels show "Main Mode" not "main_mode"
4. Verify HistogramCard legend shows "Baseline (All Data)" and "Filtered" (English strings)
  </verify>
  <done>
- All chart legend entries use human-readable formatting
- ScatterCard category legend uses toTitleCase
- PieChartCard slice labels use toTitleCase
- HistogramCard uses descriptive English strings
  </done>
</task>

</tasks>

<verification>
1. Scientific mode toggle works on dashboard
2. ScatterCard comparison:
   - Baseline points: gray, open circles, smaller size
   - Filtered points: colored, filled circles with distinct markers per category
   - Legend shows Title Case labels
3. HistogramCard comparison:
   - Baseline bars: gray with dot pattern
   - Filtered bars: colored with diagonal pattern
4. PieChartCard scientific mode:
   - Small slices have outside labels
   - Inside labels readable (pure black text)
   - Patterns visible on all slices
5. All legend entries human-readable (Title Case)
</verification>

<success_criteria>
- Comparison mode visualizations are print-ready in scientific mode
- Pattern differentiation between baseline and filtered data is clear
- Labels remain readable over patterned fills
- Legend entries consistently formatted across all chart types
</success_criteria>

<output>
After completion, update `.planning/STATE.md`:
- Add quick task 007 to completed list
- Note: Scientific mode polish for comparison styling
</output>
