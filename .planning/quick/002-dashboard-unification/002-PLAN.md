---
task: 002
name: Dashboard Unification - InteractiveDashboard without table config
type: quick
autonomous: true
files_modified:
  - src/plugins/interactive-dashboard/InteractiveDashboard.vue
  - src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
---

<objective>
Make InteractiveDashboard work without `table` config so it can function as a superset of the standard Dashboard.

Purpose: Enable gradual deprecation of DashBoard.vue by making InteractiveDashboard handle both interactive (with table) and standard (without table) dashboard configurations.

Output: InteractiveDashboard renders cards normally when no `yaml.table` exists - no filtering, no data table, just cards with their content.
</objective>

<context>
@.planning/STATE.md (Architectural Vision section documents this goal)
@src/plugins/interactive-dashboard/InteractiveDashboard.vue
@src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
</context>

<tasks>

<task type="auto">
  <name>Task 1: Always initialize FilterManager and LinkageManager</name>
  <files>src/plugins/interactive-dashboard/InteractiveDashboard.vue</files>
  <action>
In `initializeCoordinationLayer()` method (around line 1128):

1. Move the FilterManager and LinkageManager initialization and observer setup BEFORE the `if (!this.yaml.table)` check

2. Change the early return to only skip DataTableManager initialization:
   - Keep: `initializeTheme()`, cluster colors setup, FilterManager/LinkageManager initialization
   - Skip only: DataTableManager initialization when no table config
   - Remove the `return` statement - let method continue to observers setup

Current problematic code (lines 1199-1201):
```typescript
if (!this.yaml.table) {
  console.warn('[InteractiveDashboard] No table configuration found in YAML')
  return  // <-- This prevents managers from being set up
}
```

Change to:
```typescript
// Check if table config exists in YAML
if (!this.yaml.table) {
  console.log('[InteractiveDashboard] No table configuration - running in standard dashboard mode')
  // FilterManager and LinkageManager already initialized above
  // Skip DataTableManager - no centralized data to manage
  return
}
```

The FilterManager/LinkageManager init (lines 1164-1196) must execute BEFORE this check, not after.
  </action>
  <verify>
Search for FilterManager initialization and confirm it happens unconditionally:
`grep -n "this.filterManager = new FilterManager" src/plugins/interactive-dashboard/InteractiveDashboard.vue`
  </verify>
  <done>FilterManager and LinkageManager initialize regardless of yaml.table presence</done>
</task>

<task type="auto">
  <name>Task 2: Make dataTableManager optional in template and LinkableCardWrapper</name>
  <files>src/plugins/interactive-dashboard/InteractiveDashboard.vue, src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue</files>
  <action>
**In InteractiveDashboard.vue template (line 48):**

Change:
```pug
linkable-card-wrapper(v-if="getCardComponent(card) && filterManager && linkageManager && dataTableManager"
```

To:
```pug
linkable-card-wrapper(v-if="getCardComponent(card) && filterManager && linkageManager"
```

Remove the `&& dataTableManager` requirement - cards should render when filterManager and linkageManager exist.

**In LinkableCardWrapper.vue:**

1. Change the Props interface to make dataTableManager optional:
```typescript
interface Props {
  card: any
  filterManager: FilterManager
  linkageManager: LinkageManager
  dataTableManager?: DataTableManager | null  // Make optional
}
```

2. Update `updateFilteredData()` to handle null dataTableManager:
```typescript
const updateFilteredData = () => {
  // If no dataTableManager, pass empty array (no central data to filter)
  if (!props.dataTableManager) {
    filteredData.value = []
    return
  }
  const allData = props.dataTableManager.getData()
  const filtered = props.filterManager.applyFilters(allData)
  debugLog('[LinkableCardWrapper] updateFilteredData for', props.card.title || props.card.type,
    '- all:', allData.length, 'filtered:', filtered.length)
  filteredData.value = filtered
}
```

This allows cards to render without centralized data - they'll receive empty filteredData but can still render their own content (loaded from their own files).
  </action>
  <verify>
Run `npm run dev` and load a dashboard without `table` config - cards should render.
Check console for errors related to null dataTableManager.
  </verify>
  <done>
- Template no longer requires dataTableManager to render cards
- LinkableCardWrapper handles null dataTableManager gracefully
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify inline table section remains conditional</name>
  <files>src/plugins/interactive-dashboard/InteractiveDashboard.vue</files>
  <action>
Verify the inline table section (lines 111-162) only renders when table config exists.

Check `inlineTableCard` computed property (lines 412-423):
```typescript
inlineTableCard(): any {
  if (!this.yaml.table || !this.yaml.table.visible || this.yaml.table.position === 'layout' || !this.dataTableManager) {
    return null
  }
  // ...
}
```

This already returns null when:
- No yaml.table
- yaml.table.visible is false
- yaml.table.position === 'layout'
- No dataTableManager

The template uses `v-if="inlineTableCard"` (line 111), so this section already won't render without table config.

NO CHANGES NEEDED - just verify the logic is correct.
  </action>
  <verify>
Confirm template has: `.dash-row(v-if="inlineTableCard")`
Confirm computed returns null when `!this.yaml.table`
  </verify>
  <done>Inline table section confirmed to only render when table config exists</done>
</task>

<task type="auto">
  <name>Task 4: Test both modes work correctly</name>
  <files>none (testing only)</files>
  <action>
Create a minimal test dashboard YAML without table config to verify standard mode works:

1. Find or create a test dashboard YAML without `table` section
2. Load it in the browser via InteractiveDashboard
3. Verify:
   - Cards render normally
   - No console errors about null managers
   - No data table appears
   - Card interactions work (if any have their own data)

Also verify existing dashboards WITH table config still work:
- Load a dashboard with table config
- Verify filtering, hovering, selection all work
- Verify data table appears and is interactive
  </action>
  <verify>
Manual verification:
1. Dashboard without table: cards render, no errors
2. Dashboard with table: full interactivity preserved
  </verify>
  <done>
- Dashboards without table config render cards normally (standard mode)
- Dashboards with table config retain full interactivity
  </done>
</task>

</tasks>

<verification>
1. `npm run dev` starts without errors
2. Dashboard with `table` config: full interactivity (filtering, hovering, data table)
3. Dashboard without `table` config: cards render, no data table, no errors
4. No TypeScript errors in IDE
</verification>

<success_criteria>
- InteractiveDashboard works identically to before for dashboards WITH table config
- InteractiveDashboard renders cards normally for dashboards WITHOUT table config
- No null reference errors in console
- FilterManager and LinkageManager always available (even if unused in standard mode)
- DataTableManager only created when yaml.table exists
</success_criteria>
