---
type: quick-execute
name: Remove Legacy Components and Consolidate Card Rendering
files_modified:
  - src/plugins/interactive-dashboard/InteractiveDashboard.vue
  - src/plugins/interactive-dashboard/components/index.ts
files_deleted:
  - src/plugins/interactive-dashboard/components/FullscreenPortal.vue
  - src/plugins/interactive-dashboard/components/cards/LinkedTableCard.vue
  - src/plugins/interactive-dashboard/managers/LinkedTableManager.ts
autonomous: true
---

<objective>
Remove unused legacy components (FullscreenPortal, LinkedTableCard, LinkedTableManager) and consolidate the dual card rendering paths in InteractiveDashboard.vue into a single unified path.

Purpose: Reduce code complexity, eliminate dead code, and simplify template maintenance.
Output: Cleaner InteractiveDashboard with single rendering path for all cards.
</objective>

<context>
@src/plugins/interactive-dashboard/InteractiveDashboard.vue
@src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
@src/plugins/interactive-dashboard/components/index.ts
</context>

<background>
Current state analysis:
1. **FullscreenPortal** - Completely unused. Not imported in InteractiveDashboard.vue. Only exported from components/index.ts. CSS-only fullscreen now used instead.
2. **LinkedTableCard + LinkedTableManager** - Legacy feature for `linkedTables` YAML config. No YAML files in the codebase use this feature. Marked as "Legacy: Linked Tables Section" in comments.
3. **Dual rendering paths** - Lines 48-150 have PATH A (with linkage wrapper) and PATH B (without wrapper). Both render the same component with identical props except PATH A adds filteredData, hoveredIds, selectedIds.

Consolidation approach:
- LinkableCardWrapper can handle "no linkage" gracefully - it passes through unfiltered data when no filters active
- Cards already handle missing filteredData/hoveredIds/selectedIds props
- Unifying to single path simplifies template from ~100 lines to ~50 lines
</background>

<tasks>

<task type="auto">
  <name>Task 1: Delete unused legacy files</name>
  <files>
    - src/plugins/interactive-dashboard/components/FullscreenPortal.vue (DELETE)
    - src/plugins/interactive-dashboard/components/cards/LinkedTableCard.vue (DELETE)
    - src/plugins/interactive-dashboard/managers/LinkedTableManager.ts (DELETE)
  </files>
  <action>
    Delete these three files - they are completely unused:
    1. FullscreenPortal.vue - Not imported anywhere, CSS-only fullscreen is now used
    2. LinkedTableCard.vue - Only used for `linkedTables` YAML feature which no configs use
    3. LinkedTableManager.ts - Only used by LinkedTableCard

    Use `rm` to delete each file.
  </action>
  <verify>
    Files no longer exist:
    - `ls src/plugins/interactive-dashboard/components/FullscreenPortal.vue` returns "No such file"
    - `ls src/plugins/interactive-dashboard/components/cards/LinkedTableCard.vue` returns "No such file"
    - `ls src/plugins/interactive-dashboard/managers/LinkedTableManager.ts` returns "No such file"
  </verify>
  <done>Three legacy files removed from codebase</done>
</task>

<task type="auto">
  <name>Task 2: Remove legacy imports and code from InteractiveDashboard.vue</name>
  <files>src/plugins/interactive-dashboard/InteractiveDashboard.vue</files>
  <action>
    1. Remove import of LinkedTableManager (line 264):
       `import { LinkedTableManager } from './managers/LinkedTableManager'`

    2. Remove import of LinkedTableCard (line 268):
       `import LinkedTableCard from './components/cards/LinkedTableCard.vue'`

    3. Remove LinkedTableCard from components registration (line 286):
       Remove `LinkedTableCard` from the Object.assign

    4. Remove data property `linkedTableManagers` (line 332):
       `linkedTableManagers: [] as LinkedTableManager[],`

    5. Remove the entire "Legacy: Linked Tables Section" template block (lines 225-238):
       ```pug
       //- Legacy: Linked Tables Section (simpler table+map pairs)
       .linked-tables-section(v-if="linkedTableManagers.length > 0 && tableSelectedIds.size > 0 && !yaml.subDashboards?.length")
         linked-table-card(...)
       ```

    6. Remove `getLinkedTableConfig` method (lines 674-679)

    7. Remove `initializeLinkedTables` method (lines 1499-1527)

    8. Remove call to `initializeLinkedTables()` in `initializeCoordinationLayer` (line 1321)

    9. Remove `handleParentTableSelect` method (lines 1531-1536)

    10. Remove call to `handleParentTableSelect` in `handleTableRowClick` (line 670)

    11. Remove cleanup of linkedTableManagers in beforeDestroy (line 1576):
        `this.linkedTableManagers = []`

    12. Remove `.linked-tables-section` styles (lines 1929-1941)
  </action>
  <verify>
    - `grep -c "LinkedTableManager" src/plugins/interactive-dashboard/InteractiveDashboard.vue` returns 0
    - `grep -c "LinkedTableCard" src/plugins/interactive-dashboard/InteractiveDashboard.vue` returns 0
    - `grep -c "linkedTables" src/plugins/interactive-dashboard/InteractiveDashboard.vue` returns 0
    - `npm run dev` starts without errors
  </verify>
  <done>All LinkedTable-related code removed from InteractiveDashboard.vue</done>
</task>

<task type="auto">
  <name>Task 3: Consolidate card rendering paths and update index.ts</name>
  <files>
    - src/plugins/interactive-dashboard/InteractiveDashboard.vue
    - src/plugins/interactive-dashboard/components/index.ts
  </files>
  <action>
    **In InteractiveDashboard.vue:**

    Replace the dual rendering paths (lines ~47-150) with a single unified path.
    ALL cards now go through LinkableCardWrapper. The wrapper handles the "no linkage" case gracefully.

    The new template structure should be:
    ```pug
    //- each card here - wrapped with DashboardCard for consistent chrome
    DashboardCard(
      v-for="card, j in row.cards"
      :key="`${i}/${j}/${cardRenderKey}`"
      :card="card"
      :is-fullscreen="fullScreenCardId === card.id"
      :another-card-fullscreen="!!fullScreenCardId && fullScreenCardId !== card.id"
      :is-panel-narrow="isPanelNarrow"
      :is-full-screen-dashboard="isFullScreenDashboard"
      :total-cards-in-row="row.cards.length"
      :total-rows="rows.length"
      @toggle-fullscreen="toggleZoom(card)"
      @clear-errors="card.errors = []"
      @card-resize="handleCardResize"
    )
      //- All cards use LinkableCardWrapper - handles both linkage and non-linkage cases
      linkable-card-wrapper(v-if="getCardComponent(card) && filterManager && linkageManager && dataTableManager"
        :card="card"
        :filter-manager="filterManager"
        :linkage-manager="linkageManager"
        :data-table-manager="dataTableManager"
      )
        template(v-slot="{ filteredData, hoveredIds, selectedIds, handleFilter, handleHover, handleSelect }")
          component.dash-card(v-if="card.visible"
            :is="getCardComponent(card)"
            :class="{'is-data-table': card.type === 'data-table'}"
            :fileSystemConfig="fileSystemConfig"
            :subfolder="row.subtabFolder || xsubfolder"
            :files="fileList"
            :yaml="(card.props && card.props.configFile) || ''"
            :config="card.props"
            :datamanager="datamanager"
            :split="split"
            :style="{opacity: opacity[card.id]}"
            :cardId="card.id"
            :cardTitle="card.title"
            :allConfigFiles="allConfigFiles"
            :column="card.column"
            :bin-size="card.binSize"
            :title="card.title"
            :x-column="card.xColumn"
            :y-column="card.yColumn"
            :color-column="card.colorColumn"
            :size-column="card.sizeColumn"
            :marker-size="card.markerSize"
            :id-column="yaml.table?.idColumn"
            :filtered-data="filteredData"
            :hovered-ids="hoveredIds"
            :selected-ids="selectedIds"
            :linkage="card.linkage"
            :layers="getCardLayers(card)"
            :center="card.center"
            :zoom="card.zoom"
            :map-style="card.mapStyle"
            :legend="card.legend"
            :tooltip="card.tooltip"
            :geometry-type="geometryType"
            :color-by-attribute="colorByAttribute"
            :map-controls-config="yaml.map?.controls"
            :geometry-type-options="geometryTypeOptions"
            :color-by-options="colorByOptions"
            :layer-strategy="layerStrategy"
            :table-config="yaml.table"
            :data-table-manager="dataTableManager"
            :filter-manager="filterManager"
            :linkage-manager="linkageManager"
            @update:geometry-type="geometryType = $event"
            @update:color-by-attribute="colorByAttribute = $event"
            @filter="handleFilter"
            @hover="handleHover"
            @select="handleSelect"
            @isLoaded="handleCardIsLoaded(card)"
            @dimension-resizer="setDimensionResizer"
            @titles="setCardTitles(card, $event)"
            @error="setCardError(card, $event)"
          )
    ```

    Key changes:
    - Remove the `v-if` condition that split linkage vs non-linkage cards
    - Remove the duplicate "Standard rendering" path (v-else-if block)
    - All cards now receive filteredData, hoveredIds, selectedIds (cards that don't use them simply ignore them)
    - Remove `hasLayerLinkage` method as it's no longer needed for path selection

    **In components/index.ts:**

    Remove the FullscreenPortal export:
    ```typescript
    /**
     * Interactive Dashboard Components
     *
     * This module exports reusable components for the Interactive Dashboard plugin.
     */

    // Card wrapper component
    export { default as DashboardCard } from './DashboardCard.vue'

    // Re-export types for convenient imports
    export * from '../types/dashboardCard'
    ```
  </action>
  <verify>
    - `npm run dev` starts without errors
    - Open a dashboard with cards that have linkage - verify filtering works
    - Open a dashboard with cards without linkage - verify cards render correctly
    - Template is now ~50 lines shorter (single path instead of two)
    - `grep -c "v-else-if" src/plugins/interactive-dashboard/InteractiveDashboard.vue` in card rendering section returns 0 (only inline-table should have else-if)
  </verify>
  <done>
    - Single unified card rendering path in InteractiveDashboard.vue
    - FullscreenPortal removed from exports
    - hasLayerLinkage method removed (no longer needed)
  </done>
</task>

</tasks>

<verification>
After all tasks:
1. `npm run dev` starts without errors
2. No TypeScript compilation errors
3. Dashboard renders with all card types:
   - Cards with linkage: filter/highlight interactions work
   - Cards without linkage: render correctly, receive filteredData (they ignore it)
   - DataTableCard: renders and interacts with other cards
4. No references to deleted files remain
5. Template is cleaner and easier to maintain
</verification>

<success_criteria>
- FullscreenPortal.vue deleted
- LinkedTableCard.vue deleted
- LinkedTableManager.ts deleted
- All imports/references to deleted code removed
- Single card rendering path in template
- All existing functionality preserved
- `npm run dev` runs without errors
</success_criteria>

<output>
After completion, report:
- Files deleted
- Lines of code removed (approximate)
- Any issues encountered
</output>
