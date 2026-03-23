---
phase: 03-correlation-analysis
plan: 03
subsystem: interactive-dashboard-linkage
type: feature
status: complete
tags: [linkage-manager, scatter-card, correlation-matrix, event-system, observer-pattern]

dependencies:
  requires: [03-01]
  provides:
    - "LinkageManager attribute pair event system"
    - "ScatterCard dynamic axis update capability"
  affects: [03-04]

tech-stack:
  added: []
  patterns:
    - "Observer pattern extension for attribute pair events"
    - "Optional observer method pattern"
    - "Dynamic axis rebinding in ScatterCard"

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/managers/LinkageManager.ts
    - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue

decisions:
  - key: "optional-observer-method"
    decision: "onAttributePairSelected is optional in LinkageObserver interface"
    rationale: "Not all observers need this method - existing cards don't use it"
    alternatives: ["Separate observer interface", "Required empty implementation"]

  - key: "dynamic-axis-state"
    decision: "currentXColumn/currentYColumn refs track axes separately from props"
    rationale: "Allows prop defaults to be overridden by events without changing props"
    alternatives: ["Emit event to parent to change props", "Direct prop mutation"]

  - key: "attribute-validation"
    decision: "Validate attribute names exist in data before updating axes"
    rationale: "Prevents runtime errors from invalid attribute names"
    alternatives: ["Trust caller to provide valid names", "Silent failure"]

metrics:
  duration: 6m 12s
  commits: 2
  tests-added: 0
  tests-modified: 0
  completed: 2026-01-21
---

# Phase 3 Plan 3: Attribute Pair Event System Summary

**One-liner:** Extended LinkageManager with attribute pair selection events, enabling correlation matrix to control ScatterCard axes dynamically.

---

## Objective Achieved

Extended LinkageManager with attribute pair selection events and updated ScatterCard to listen for axis changes. This creates the communication channel for the correlation matrix (Plan 03-04) to send attribute pair selections to ScatterCard, enabling users to click a correlation cell and see that attribute pair visualized in the scatter plot.

---

## Tasks Completed

### Task 1: Extend LinkageManager with attribute pair events
**Files:** `src/plugins/interactive-dashboard/managers/LinkageManager.ts`

Extended the existing LinkageManager to support attribute pair selection events:

1. **Updated LinkageObserver interface:**
   - Added optional `onAttributePairSelected?: (attrX: string, attrY: string) => void` method
   - Maintains backwards compatibility - existing observers don't need to implement it

2. **Added state to LinkageManager:**
   - `private selectedAttributePair: { x: string; y: string } | null = null`
   - Tracks currently selected attribute pair

3. **Added public methods:**
   - `setSelectedAttributePair(attrX, attrY)`: Called by CorrelationMatrixCard to broadcast selection
   - `getSelectedAttributePair()`: Returns current attribute pair
   - `clearAttributePairSelection()`: Clears selection

4. **Added notification method:**
   - `private notifyAttributePairSelection()`: Broadcasts to all observers with the method implemented

**Result:** LinkageManager now supports attribute pair events without breaking existing hover/select functionality.

**Commit:** `9612df78` - feat(03-03): extend LinkageManager with attribute pair events

---

### Task 2: Update ScatterCard to support dynamic axis updates
**Files:** `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue`

Updated ScatterCard to optionally listen for attribute pair selection events:

1. **Added new props:**
   - `listenToAttributePairSelection?: boolean` (default: false)
   - `linkageManager?: LinkageManager` (optional)

2. **Added reactive axis state:**
   - `currentXColumn` and `currentYColumn` refs
   - Watch props to reset defaults when props change
   - Replace all uses of `props.xColumn/yColumn` with `currentXColumn/currentYColumn.value`

3. **Added LinkageObserver:**
   - Implements `onAttributePairSelected` handler
   - Validates attributes exist in data before updating
   - Updates `currentXColumn` and `currentYColumn` on valid selection
   - Logs warning if attributes not found

4. **Added lifecycle management:**
   - Register observer in `onMounted` (if enabled)
   - Unregister observer in `onUnmounted`
   - Watch `currentXColumn` and `currentYColumn` to re-render chart

5. **Updated chart rendering:**
   - Axis titles use `currentXColumn.value` and `currentYColumn.value`
   - Hover text uses current axes
   - scatterData computed uses current axes

**Result:** ScatterCard can now dynamically update its axes when LinkageManager broadcasts attribute pair events.

**Commit:** `102c7262` - feat(03-03): add dynamic axis updates to ScatterCard

---

## Implementation Details

### Observer Pattern Extension

The LinkageManager already used the observer pattern for hover/select events. We extended it consistently:

```typescript
export interface LinkageObserver {
  onHoveredIdsChange: (ids: Set<any>) => void
  onSelectedIdsChange: (ids: Set<any>) => void
  // NEW: Optional handler for attribute pair selection
  onAttributePairSelected?: (attrX: string, attrY: string) => void
}
```

The optional method pattern allows existing observers (MapCard, PieChartCard, HistogramCard) to continue working without modification.

### Dynamic Axis Rebinding

ScatterCard maintains two sources of axis configuration:

1. **Props (xColumn, yColumn):** Default axes specified in YAML config
2. **Reactive state (currentXColumn, currentYColumn):** Current axes (may be overridden by events)

When attribute pair event arrives:
1. Validate attributes exist in data
2. Update reactive state (`currentXColumn.value = attrX`)
3. Watch triggers re-render
4. Chart displays with new axes

When props change (e.g., switching dashboards):
1. Watch on props updates reactive state
2. Axes reset to prop defaults

This pattern maintains the declarative YAML config as the source of truth while allowing runtime overrides.

### Validation and Error Handling

The ScatterCard validates attribute names before updating:

```typescript
const sampleRow = props.filteredData[0]
const hasX = attrX in sampleRow
const hasY = attrY in sampleRow

if (hasX && hasY) {
  currentXColumn.value = attrX
  currentYColumn.value = attrY
} else {
  console.warn(`[ScatterCard] Attributes not found in data: ${attrX}, ${attrY}`)
}
```

This prevents runtime errors if the correlation matrix passes invalid attribute names.

---

## Testing Notes

### Manual Testing Scenarios

To test this implementation (after Plan 03-04 implements CorrelationMatrixCard):

1. **Default behavior (listenToAttributePairSelection: false):**
   - ScatterCard displays with xColumn/yColumn from YAML config
   - Clicking correlation matrix cells has no effect
   - ScatterCard axes remain static

2. **Dynamic behavior (listenToAttributePairSelection: true):**
   - ScatterCard displays with default xColumn/yColumn
   - Click correlation matrix cell
   - ScatterCard axes update to show clicked attribute pair
   - Click another cell
   - ScatterCard axes update to new pair

3. **Invalid attribute handling:**
   - Manually call `linkageManager.setSelectedAttributePair('invalid_x', 'invalid_y')`
   - ScatterCard logs warning
   - ScatterCard axes remain unchanged

4. **Prop changes:**
   - Switch to different dashboard with different xColumn/yColumn
   - ScatterCard resets to new prop defaults
   - Dynamic state cleared

### Automated Testing

No unit tests added (consistent with existing interactive-dashboard cards). The observer pattern and reactive state are tested through integration.

---

## Verification

- [x] TypeScript compiles without errors in modified files
- [x] LinkageManager has `setSelectedAttributePair()` method
- [x] LinkageManager has `getSelectedAttributePair()` method
- [x] LinkageObserver interface has optional `onAttributePairSelected` method
- [x] ScatterCard has `listenToAttributePairSelection` prop (default: false)
- [x] ScatterCard has `linkageManager` prop
- [x] ScatterCard registers/unregisters observer based on prop
- [x] ScatterCard validates attributes before updating
- [x] ScatterCard uses `currentXColumn`/`currentYColumn` throughout
- [x] Watch on current axes triggers re-render
- [x] Existing ScatterCard functionality unchanged when prop is false

---

## Next Phase Readiness

### Enables Plan 03-04: CorrelationMatrixCard Component

Plan 03-03 provides the complete communication infrastructure for the correlation matrix:

**Ready for use:**
- LinkageManager can broadcast attribute pair selections
- ScatterCard can listen and update axes dynamically
- Validation ensures robust handling of attribute names
- Observer pattern integrates seamlessly with existing system

**CorrelationMatrixCard needs to:**
1. Receive `linkageManager` prop from InteractiveDashboard
2. Call `linkageManager.setSelectedAttributePair(attrX, attrY)` on cell click
3. ScatterCard receives event and updates axes automatically

**Configuration example (Plan 03-04):**
```yaml
correlation-matrix:
  type: correlation-matrix
  attributes: [distance, duration, main_mode_distance]

scatter:
  type: scatter
  xColumn: distance
  yColumn: duration
  listenToAttributePairSelection: true  # Enable dynamic axes
```

### No Blockers

All functionality implemented as planned. No architectural concerns or technical debt introduced.

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Files Modified

### `src/plugins/interactive-dashboard/managers/LinkageManager.ts`
- Added `onAttributePairSelected` to LinkageObserver interface (optional)
- Added `selectedAttributePair` state
- Added `setSelectedAttributePair()`, `getSelectedAttributePair()`, `clearAttributePairSelection()` methods
- Added `notifyAttributePairSelection()` private method
- Total changes: +29 lines

### `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue`
- Added `listenToAttributePairSelection` and `linkageManager` props
- Added `currentXColumn` and `currentYColumn` reactive state
- Updated all axis references to use current state instead of props
- Added LinkageObserver with attribute pair handler
- Added watch on current axes for re-rendering
- Added observer registration/cleanup in lifecycle hooks
- Total changes: +61 lines, -8 lines (refactored axis references)

---

## Performance Impact

Negligible performance impact:

- **LinkageManager:** Added one field and three methods. No overhead when not used.
- **ScatterCard:** Added two reactive refs. No overhead when `listenToAttributePairSelection: false`.
- **Observer notifications:** Only when `setSelectedAttributePair()` called (rare user action).
- **Re-rendering:** Only when axes change (rare user action). Plotly already re-renders efficiently.

---

## Lessons Learned

1. **Optional interface methods scale well:** Adding `onAttributePairSelected?` to LinkageObserver maintains backwards compatibility without requiring all observers to implement empty methods.

2. **Reactive state for runtime overrides:** Using `currentXColumn`/`currentYColumn` refs separate from props cleanly handles the "default from config, override from events" pattern.

3. **Validation at event receiver:** ScatterCard validates attribute names rather than trusting LinkageManager, providing defense in depth.

4. **Watch on refs triggers computed:** The pattern `watch([currentXColumn, currentYColumn], () => renderChart())` ensures scatterData computed re-evaluates when axes change, maintaining reactivity chain.

---

*Summary complete: 2026-01-21*
