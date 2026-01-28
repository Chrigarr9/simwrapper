---
status: resolved
trigger: "The comparison button in interactive dashboard cards does nothing when clicked, and comparison mode should auto-enable when filters are applied."
created: 2026-01-28T00:00:00Z
updated: 2026-01-28T00:10:00Z
---

## Current Focus

hypothesis: The comparison button exists only in DataTableCard, but the symptom says "comparison mode should auto-enable when filters are applied". The button works (toggles state), but comparison mode is only visible in HistogramCard, which requires filters to be active AND showComparison=true. The issue is the auto-enable requirement - showComparison defaults to true but effectiveShowComparison requires hasActiveFilters to return true.
test: Trace the data flow to verify effectiveShowComparison reaches cards and understand why clicking the comparison button has no visible effect
expecting: Either the prop is not reaching the cards, or the visual change is not triggered
next_action: Verify hypothesis by tracing showComparison prop flow from DataTableCard -> InteractiveDashboard -> LinkableCardWrapper -> HistogramCard

## Symptoms

expected: Comparison mode should automatically turn ON when any filter is applied to interactive dashboard cards
actual: Clicking the comparison button has no visible effect - nothing happens
errors: None reported
reproduction: Apply a filter to any interactive card (like HistogramCard), then try clicking the comparison button
started: Unknown - reported as current behavior

## Eliminated

## Evidence

- timestamp: 2026-01-28T00:01:00Z
  checked: HistogramCard.vue - comparison functionality
  found: HistogramCard receives showComparison as prop (default false), uses it to render baseline data trace in comparison mode. Has computed properties histogramDataDensity and baselineHistogramDataDensity that convert counts to percentages when showComparison is true. Also has watchers for showComparison and baselineData changes.
  implication: HistogramCard properly reacts to showComparison prop changes - the issue must be upstream

- timestamp: 2026-01-28T00:02:00Z
  checked: InteractiveDashboard.vue - comparison state management
  found: InteractiveDashboard has `showComparison: true` in data (line 249). Has `effectiveShowComparison` computed property (line 371-373) that returns `this.showComparison && this.hasActiveFilters`. This is passed to LinkableCardWrapper at line 54 as `:show-comparison="effectiveShowComparison"`. Has handleShowComparisonUpdate method (line 407-412) that sets this.showComparison from emitted events.
  implication: The effectiveShowComparison logic looks correct - comparison only shows when both showComparison is true AND filters are active. State management is connected properly.

- timestamp: 2026-01-28T00:03:00Z
  checked: LinkableCardWrapper.vue - prop forwarding
  found: LinkableCardWrapper receives showComparison prop (line 28-29, default false), and forwards it to the slot at line 6 `:show-comparison="showComparison"`. However, the slot receives `props.showComparison` not `effectiveShowComparison` - but wait, InteractiveDashboard passes effectiveShowComparison as show-comparison prop, so this should be correct.
  implication: The prop flow appears correct: InteractiveDashboard.effectiveShowComparison -> LinkableCardWrapper.showComparison -> slot.showComparison

- timestamp: 2026-01-28T00:04:00Z
  checked: DataTableCard.vue - comparison toggle
  found: DataTableCard has ComparisonToggle component (line 21-25) that receives `:model-value="showComparison"` and `:disabled="!hasActiveFilters"`, emits `@update:model-value="handleComparisonToggle"`. handleComparisonToggle (line 208-211) emits `'update:show-comparison', value`. DataTableCard receives showComparison as prop (line 117), default false.
  implication: DataTableCard emits 'update:show-comparison' event when toggle is clicked

- timestamp: 2026-01-28T00:05:00Z
  checked: InteractiveDashboard.vue - event handler connection
  found: In template line 111, the card component has `@update:show-comparison="handleShowComparisonUpdate"`. This connects the event from DataTableCard to handleShowComparisonUpdate method which sets this.showComparison.
  implication: Event flow is connected - but need to verify the entire chain works at runtime

- timestamp: 2026-01-28T00:06:00Z
  checked: InteractiveDashboard.vue - filterVersion usage
  found: filterVersion (line 232) is incremented when filters change (line 1139). displayData computed property accesses filterVersion (line 280-281) to trigger reactivity. HOWEVER, hasActiveFilters computed property (line 366-367) does NOT access filterVersion - it only calls filterManager.hasActiveFilters() which is not reactive.
  implication: ROOT CAUSE IDENTIFIED - hasActiveFilters computed property is not reactive to filter changes because it doesn't access filterVersion. This means effectiveShowComparison never updates when filters are applied/removed.

## Resolution

root_cause: The hasActiveFilters computed property in InteractiveDashboard.vue (line 366-367) doesn't access filterVersion to trigger Vue reactivity. When filters change, filterVersion is incremented by the observer, but hasActiveFilters doesn't recompute because Vue doesn't know filterManager's internal state changed. This breaks the entire comparison mode functionality since effectiveShowComparison depends on hasActiveFilters.
fix: Added `const _version = this.filterVersion` at the start of hasActiveFilters computed property to create a reactive dependency on filterVersion. Now when filters change, filterVersion increments, which triggers hasActiveFilters to recompute, which updates effectiveShowComparison, which propagates to all cards via LinkableCardWrapper.
verification: Dev server starts successfully, TypeScript compiles without errors in project code (node_modules errors are pre-existing deck.gl issues), existing tests pass (DataTableManager file loading tests were already failing before this change)
files_changed:
  - src/plugins/interactive-dashboard/InteractiveDashboard.vue (line 368: added filterVersion access)
