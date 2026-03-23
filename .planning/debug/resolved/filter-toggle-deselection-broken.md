---
status: resolved
trigger: "Filter toggle/deselection doesn't work correctly"
created: 2026-01-28T12:00:00Z
updated: 2026-01-28T12:35:00Z
---

## Current Focus

hypothesis: HistogramCard sends ALL selected bins on every click, but LinkableCardWrapper only removes if ALL values are already in filter (line 80-88) - causing "replace with just this one" behavior
test: Trace the exact data flow when clicking an already-selected bar
expecting: Confirm LinkableCardWrapper.handleFilter toggle logic is flawed
next_action: Verify hypothesis by reading the exact toggle logic in LinkableCardWrapper lines 76-93

## Symptoms

expected:
- Click bar → adds to filter (works)
- Click same bar again → removes from filter (toggle off)
- With multiple selections, clicking one should remove just that one from the OR set
- With single selection, clicking it again should clear the filter entirely

actual:
- With multiple selections: clicking an already-selected item makes it the ONLY selection (replaces instead of removes)
- With single selection: clicking again causes "weird behavior" instead of clearing

errors: None reported

reproduction:
1. Click a histogram bar → it filters (correct)
2. Click another bar → both are now in filter (OR logic, correct)
3. Click the first bar again → WRONG: it becomes the only filter instead of being removed
4. Alternative: with only one bar selected, click it again → weird behavior instead of clearing

started: Current behavior across all interactive cards

## Eliminated

## Evidence

- timestamp: 2026-01-28T12:15:00Z
  checked: HistogramCard.vue lines 357-377 (click handler)
  found: Card does LOCAL toggle on selectedBins, then emits the RESULTING set
  implication: Card sends {remaining bins} not {clicked bin}

- timestamp: 2026-01-28T12:16:00Z
  checked: LinkableCardWrapper.vue lines 76-93 (handleFilter)
  found: Wrapper checks if ALL emitted values are already in filter, then removes them
  implication: When user clicks selected bar A with {A,B} selected, card sends {B}, wrapper sees {B} is in filter and removes it -> leaving {A}

- timestamp: 2026-01-28T12:17:00Z
  checked: PieChartCard.vue lines 216-226
  found: Same pattern - local toggle then emit remaining
  implication: Bug affects all chart cards with toggle behavior

- timestamp: 2026-01-28T12:18:00Z
  checked: Full data flow trace
  found: TWO levels of toggle logic conflicting - card toggles locally then wrapper tries to toggle again
  implication: The wrapper toggle is designed for cards that emit CLICKED items, but cards emit REMAINING items

## Resolution

root_cause: Cards (HistogramCard, PieChartCard) do local toggle and emit the RESULTING set of selected items. LinkableCardWrapper then tries to apply its own toggle logic, checking if ALL emitted values are in the current filter. This creates a conflict: when user clicks to DESELECT bar A from {A,B}, the card sends {B} (the remaining selection), and the wrapper sees "B is in the filter, let me remove it", resulting in {A} - the exact opposite of what user wanted.

fix:
1. Removed redundant toggle logic from LinkableCardWrapper.handleFilter(). Cards (HistogramCard, PieChartCard) manage their own selection state internally and emit the complete set of selected values. The wrapper now simply passes this through to FilterManager.setFilter(). When the set is empty, FilterManager automatically removes the filter.

2. Added justEmittedFilter flag to PieChartCard (matching HistogramCard pattern) to prevent incorrect clearing of selection during multi-select OR operations.

verification: TypeScript compiles successfully (only node_modules/@deck.gl errors which are pre-existing). Logic trace confirms:
- Click bar A -> local selectedBins={A}, emit {A} -> filter={A} CORRECT
- Click bar B -> local selectedBins={A,B}, emit {A,B} -> filter={A,B} CORRECT
- Click bar A (deselect) -> local selectedBins={B}, emit {B} -> filter={B} CORRECT
- Click bar B (deselect) -> local selectedBins={}, emit {} -> filter removed CORRECT

files_changed:
- src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
- src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
