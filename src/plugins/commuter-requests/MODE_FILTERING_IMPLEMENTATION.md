# Mode Filtering Implementation

## Summary

Added complete mode filtering functionality to the commuter-requests plugin, allowing users to click on pie chart slices to filter requests by transportation mode.

## Changes Made

### 1. MainModePieChartPlotly.vue
**Location:** `src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`

**Changes:**
- Added `selectedModes` prop to receive current mode selections
- Added `@click` event handler to VuePlotly component
- Implemented visual feedback for selected modes:
  - Unselected modes are dimmed (25% opacity) when any mode is selected
  - Selected modes get a blue border (3px width)
- Added `onPlotClick()` method that emits `mode-clicked` event with the clicked mode name

**Code:**
```typescript
props: {
  selectedModes: { type: Set as PropType<Set<string>>, default: () => new Set() },
  // ... other props
}

methods: {
  onPlotClick(event: any) {
    if (event && event.points && event.points.length > 0) {
      const clickedMode = event.points[0].label
      this.$emit('mode-clicked', clickedMode)
    }
  }
}
```

### 2. StatsPanel.vue
**Location:** `src/plugins/commuter-requests/components/stats/StatsPanel.vue`

**Changes:**
- Added `selectedModes` prop
- Passed `selectedModes` to MainModePieChartPlotly
- Added `@mode-clicked` listener
- Implemented `onModeClicked()` method to bubble up the event

### 3. filters.ts
**Location:** `src/plugins/commuter-requests/utils/filters.ts`

**Changes:**
- Added `applyModeFilter()` function:
  ```typescript
  export function applyModeFilter(request: Request, selectedModes: Set<string>): boolean {
    if (selectedModes.size === 0) return true
    const mode = request.main_mode || request.mode || 'unknown'
    return selectedModes.has(mode)
  }
  ```
- Updated `filterRequests()` to include mode filtering:
  - Added `selectedModes` parameter
  - Added AND logic with `applyModeFilter()`

### 4. CommuterRequests.vue (Main Component)
**Location:** `src/plugins/commuter-requests/CommuterRequests.vue`

**Changes:**
- Added `selectedModes: new Set<string>()` to data()
- Updated `filteredRequests` computed to pass selectedModes to filterRequests()
- Updated `hasActiveFilters` to include selectedModes.size check
- Passed `selectedModes` prop to stats-panel
- Added `@mode-clicked="onModeClicked"` listener
- Implemented `onModeClicked()` method with toggle logic:
  ```typescript
  onModeClicked(mode: string) {
    if (this.selectedModes.has(mode)) {
      this.selectedModes.delete(mode)
    } else {
      this.selectedModes.add(mode)
    }
    this.selectedModes = new Set(this.selectedModes) // Trigger reactivity
  }
  ```
- Updated `resetFilters()` to clear selectedModes

### 5. RequestsMap.vue
**Location:** `src/plugins/commuter-requests/components/RequestsMap.vue`

**Changes:**
- Added watcher for `geometries` prop to update map layers when filtered geometries change
- This ensures the map displays only the filtered requests

## Filter Logic

### Combined Filtering (AND Logic Between Filter Types)
When multiple filter types are active, they use AND logic:
- Request must match cluster filter AND
- Request must match timebin filter AND
- Request must match mode filter

### Within-Type Filtering (OR Logic)
Within each filter type, multiple selections use OR logic:
- Any selected cluster OR any other selected cluster
- Any selected timebin OR any other selected timebin
- Any selected mode OR any other selected mode

## User Interaction Flow

1. **User clicks a pie chart slice** (e.g., "car")
2. **Pie chart updates visually:**
   - Selected slice gets blue border
   - Unselected slices are dimmed to 25% opacity
3. **Event bubbles up:**
   - MainModePieChartPlotly emits `mode-clicked`
   - StatsPanel forwards to parent
   - CommuterRequests toggles selection in `selectedModes` Set
4. **Filtering cascades down:**
   - `filteredRequests` computed recalculates
   - Table shows only matching requests
   - Map updates to show only matching request lines
   - Stats update to reflect filtered data
5. **User can:**
   - Click same slice again to deselect
   - Click additional slices to add more modes (OR logic)
   - Click "Reset Filters" to clear all selections

## Testing Checklist

### Mode Selection
- [ ] Click on a mode slice in pie chart
- [ ] Selected mode should get blue border
- [ ] Unselected modes should be dimmed
- [ ] Request count should update in controls bar
- [ ] Table should show only requests with that mode
- [ ] Map should show only lines for that mode

### Multiple Mode Selection
- [ ] Click multiple mode slices
- [ ] All selected modes should have blue borders
- [ ] Table should show requests matching ANY selected mode
- [ ] Map should show lines for ANY selected mode

### Mode Deselection
- [ ] Click selected mode again
- [ ] Blue border should disappear
- [ ] If last mode deselected, all modes should return to full opacity
- [ ] Requests should update accordingly

### Combined Filters
- [ ] Select a cluster + a mode
- [ ] Should show only requests in that cluster AND that mode
- [ ] Select a timebin + a mode
- [ ] Should show only requests active in that timebin AND that mode
- [ ] Select cluster + timebin + mode
- [ ] Should use AND logic across all three filter types

### Reset Filters
- [ ] Select some modes
- [ ] Click "Reset Filters" button
- [ ] All mode selections should clear
- [ ] Pie chart should return to normal appearance

### Comparison Mode
- [ ] Enable "Show Comparison" toggle
- [ ] Select a mode
- [ ] Pie chart should show baseline (outer ring) and filtered (inner)
- [ ] Click slices in comparison mode should still work

### Map Updates
- [ ] Select a mode
- [ ] Map should immediately update to show only matching requests
- [ ] Lines on map should disappear/reappear correctly
- [ ] No lag or performance issues

## Console Logging

When clicking a mode, you should see:
```
Mode clicked: car, Selected: Array [ "car" ]
```

## Known Limitations

None currently identified.

## Future Enhancements

- Add legend showing which modes are selected
- Add "Select All Modes" / "Deselect All Modes" buttons
- Add mode filter indicator in controls bar
- Persist mode selections in URL query params
