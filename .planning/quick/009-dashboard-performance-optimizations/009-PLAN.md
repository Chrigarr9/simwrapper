---
phase: quick-009
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  - src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  - src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
  - src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue
  - src/plugins/interactive-dashboard/components/cards/TimelineCard.vue
  - src/plugins/interactive-dashboard/components/cards/MapCard.vue
  - src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
  - src/plugins/interactive-dashboard/managers/FilterManager.ts
  - src/plugins/interactive-dashboard/managers/__tests__/FilterManager.test.ts
  - src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
  - src/plugins/interactive-dashboard/InteractiveDashboard.vue
autonomous: true

must_haves:
  truths:
    - "Filter click on 10k-row dataset responds in under 100ms (single filter computation, not N per card)"
    - "DataTable scrolls smoothly with 10k+ rows (only ~50-80 DOM nodes rendered at a time)"
    - "Rapid filter changes produce a single debounced chart re-render, not one per change"
    - "All existing dashboards work unchanged with no configuration changes"
    - "All existing tests pass without modification"
  artifacts:
    - path: "src/plugins/interactive-dashboard/managers/FilterManager.ts"
      provides: "Centralized filtered data cache and column indexes"
      exports: ["FilterManager", "Filter", "FilterType", "FilterObserver"]
    - path: "src/plugins/interactive-dashboard/components/cards/DataTableCard.vue"
      provides: "Virtual scrolling table with windowed row rendering"
    - path: "src/plugins/interactive-dashboard/components/cards/HistogramCard.vue"
      provides: "Debounced Plotly rendering using react() instead of newPlot()"
  key_links:
    - from: "FilterManager.ts"
      to: "LinkableCardWrapper.vue"
      via: "centralized filteredData/filteredIds consumed by wrapper instead of per-card applyFilters"
      pattern: "getFilteredData|getFilteredIds"
    - from: "FilterManager.ts"
      to: "DataTableCard.vue"
      via: "centralized filteredIds replaces per-card applyFilters call in filteredRowIds computed"
      pattern: "getFilteredIds"
    - from: "DataTableCard.vue"
      to: "virtual scrolling"
      via: "offset-based windowed rendering replaces full v-for"
      pattern: "visibleRows|scrollTop|rowHeight"
---

<objective>
Implement the top 5 dashboard performance optimizations from PERFORMANCE_PLAN.md to make 10k+ row datasets perform smoothly.

Purpose: Current architecture has multiplicative performance problems - N cards each doing O(n) filter scans, deep watchers walking entire arrays, full DOM rendering of all table rows, and undebounced chart re-renders. These compound to create >500ms filter response times with large datasets.

Output: Optimized FilterManager with column indexes and centralized filtering, debounced chart rendering, shallow watchers on all cards, and virtual scrolling for DataTableCard.
</objective>

<execution_context>
@C:\Users\VWAUCCY\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\VWAUCCY\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/009-dashboard-performance-optimizations/PERFORMANCE_PLAN.md
@src/plugins/interactive-dashboard/managers/FilterManager.ts
@src/plugins/interactive-dashboard/managers/DataTableManager.ts
@src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
@src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
@src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
@src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
@src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
@src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue
@src/plugins/interactive-dashboard/components/cards/TimelineCard.vue
@src/plugins/interactive-dashboard/components/cards/MapCard.vue
@src/plugins/interactive-dashboard/InteractiveDashboard.vue
@src/plugins/interactive-dashboard/managers/__tests__/FilterManager.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Debounce HistogramCard and shallow watchers on all cards</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
    src/plugins/interactive-dashboard/components/cards/PieChartCard.vue
    src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue
    src/plugins/interactive-dashboard/components/cards/TimelineCard.vue
    src/plugins/interactive-dashboard/components/cards/MapCard.vue
    src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
    src/plugins/interactive-dashboard/components/cards/ScatterCard.vue
  </files>
  <action>
    Two independent, low-risk changes with zero dependencies on other tasks.

    **Part A: Debounce HistogramCard rendering (matches ScatterCard pattern)**

    In `HistogramCard.vue`:
    1. Add a `renderTimeout` ref (like ScatterCard's existing pattern):
       ```typescript
       let renderTimeout: ReturnType<typeof setTimeout> | null = null
       let chartInitialized = false
       ```
    2. Create `debouncedRenderChart()` with 50ms debounce (same as ScatterCard):
       ```typescript
       const debouncedRenderChart = () => {
         if (renderTimeout) clearTimeout(renderTimeout)
         renderTimeout = setTimeout(() => {
           renderChart()
           renderTimeout = null
         }, 50)
       }
       ```
    3. Switch the `renderChart()` inside `onMounted` to use `initializeChart()` pattern:
       - First render uses `Plotly.newPlot()` + registers click handler ONCE
       - Subsequent renders use `Plotly.react()` to preserve event handlers
       - This fixes the existing pattern where `renderChart()` re-registers `plotly_click` on every call via `newPlot()`
    4. Replace all `renderChart()` calls in watchers with `debouncedRenderChart()`
    5. Replace the direct `renderChart()` call after click handler toggle with `debouncedRenderChart()`
    6. Clean up `renderTimeout` in `onUnmounted`

    The `initializeChart` / `updateChart` pattern should mirror ScatterCard exactly:
    ```typescript
    const initializeChart = () => {
      // ... build traces, layout, config ...
      Plotly.newPlot(plotContainer.value, traces, layout, config)
      chartInitialized = true
      // Register click handler ONCE here
      plotContainer.value.on('plotly_click', handleClick)
    }

    const updateChart = () => {
      if (!plotContainer.value) return
      const { traces, layout, config } = buildChartData()
      if (chartInitialized) {
        Plotly.react(plotContainer.value, traces, layout, config)
      } else {
        initializeChart()
      }
    }
    ```

    Extract the chart data building logic into a `buildChartData()` function (returning `{ traces, layout, config }`) and extract the click handler into a named `handleClick` function. The `renderChart()` function becomes `updateChart()` called from the debouncer.

    **Part B: Remove `{ deep: true }` from filteredData/baselineData/hoveredIds/selectedIds watchers across ALL cards**

    Since LinkableCardWrapper already creates NEW array/Set references on every change (via `filteredData.value = filtered` and `hoveredIds.value = new Set(ids)`), deep watching is unnecessary overhead - Vue will detect the reference change.

    Cards to update and their specific changes:

    1. **HistogramCard.vue** (lines 475-488, 502-507):
       - `watch(() => props.filteredData, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.baselineData, ..., { deep: true })` -> remove `{ deep: true }`

    2. **PieChartCard.vue** (lines 369-382, 396-401):
       - `watch(() => props.filteredData, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.baselineData, ..., { deep: true })` -> remove `{ deep: true }`

    3. **ScatterCard.vue** (line 779-782):
       - `watch(() => props.filteredData, ..., { deep: true })` -> remove `{ deep: true }`
       - hoveredIds/selectedIds watcher already watches reference + size (correct pattern, no change needed)

    4. **CorrelationMatrixCard.vue** (line 369):
       - `watch(() => props.filteredData, debouncedCalculate, { deep: true })` -> remove `{ deep: true }`

    5. **TimelineCard.vue** (lines 1093-1096, 1099-1102, 1105-1112, 1133-1138):
       - `watch(() => props.filteredData, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.hoveredIds, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.selectedIds, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.baselineData, ..., { deep: true })` -> remove `{ deep: true }`

    6. **MapCard.vue** (lines 302-321):
       - `watch(() => props.filteredData, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.hoveredIds, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.selectedIds, ..., { deep: true })` -> remove `{ deep: true }`
       - `watch(() => props.layers, ..., { deep: true })` -> KEEP `{ deep: true }` (layers is a config array, not reactive data - its contents change but reference may not)

    7. **DataTableCard.vue** (line 415-436):
       - `watch(() => props.hoveredIds, ..., { deep: true })` -> remove `{ deep: true }`

    Do NOT change watchers for: `globalStore.state.colorScheme`, `viewMode`, `props.layers` (MapCard), `props.showComparison`, `props.xColumn`/`props.yColumn` - these are scalar/config values that don't have the deep walking problem.
  </action>
  <verify>
    1. `npm run test:run` - all existing tests pass
    2. `npm run build` - no TypeScript errors
    3. Grep for remaining `{ deep: true }` on filteredData/baselineData/hoveredIds/selectedIds watchers - should find NONE (except MapCard's props.layers which is intentionally kept)
  </verify>
  <done>
    HistogramCard uses Plotly.react() for updates with 50ms debounce (matching ScatterCard pattern). Click handler registered once, not on every render. All card watchers for reactive data arrays/Sets use shallow comparison (reference-only). MapCard.layers retains deep watching (config object).
  </done>
</task>

<task type="auto">
  <name>Task 2: Column indexes for O(1) filter lookup in FilterManager</name>
  <files>
    src/plugins/interactive-dashboard/managers/FilterManager.ts
    src/plugins/interactive-dashboard/managers/__tests__/FilterManager.test.ts
  </files>
  <action>
    Add column indexing to FilterManager so filter application is O(k) per filter (where k = number of filter values) instead of O(n) per row.

    **In FilterManager.ts:**

    1. Add a private field for the column index:
       ```typescript
       private columnIndex: Map<string, Map<string, Set<number>>> = new Map()
       private indexedData: Record<string, any>[] = []
       ```
       The index structure is: `column name -> normalized value -> Set of row indices`.

    2. Add a `buildIndex(data)` method that builds the column index:
       ```typescript
       buildIndex<T extends Record<string, any>>(data: T[]): void {
         this.indexedData = data
         this.columnIndex.clear()
         // Build index for all columns
         const columns = data.length > 0 ? Object.keys(data[0]) : []
         for (const col of columns) {
           const colMap = new Map<string, Set<number>>()
           for (let i = 0; i < data.length; i++) {
             const val = data[i][col]
             if (val !== null && val !== undefined) {
               const normalizedVal = String(val).toLowerCase()
               let indices = colMap.get(normalizedVal)
               if (!indices) {
                 indices = new Set()
                 colMap.set(normalizedVal, indices)
               }
               indices.add(i)
             }
           }
           this.columnIndex.set(col, colMap)
         }
       }
       ```

    3. Modify `applyFilters()` to USE the index when available:
       - If `this.indexedData.length > 0` and input `data` reference matches `this.indexedData`, use index-based lookup
       - For categorical filters: union all row indices matching filter values from the column index
       - For binned filters: fall back to linear scan (bin ranges can't be indexed with exact-value maps)
       - AND across filters by intersecting the row index Sets
       - Return `data.filter((_, i) => resultSet.has(i))`
       - If data doesn't match indexed data (e.g., different array), fall back to existing linear scan

       ```typescript
       applyFilters<T extends Record<string, any>>(data: T[]): T[] {
         if (this.filters.size === 0) return data

         // Use indexed path when data matches our indexed data
         if (data === this.indexedData && this.columnIndex.size > 0) {
           return this.applyFiltersIndexed(data)
         }

         // Fall back to existing linear scan
         return this.applyFiltersLinear(data)
       }
       ```

    4. Add `applyFiltersIndexed()` private method:
       ```typescript
       private applyFiltersIndexed<T extends Record<string, any>>(data: T[]): T[] {
         let resultIndices: Set<number> | null = null

         for (const filter of this.filters.values()) {
           if (filter.type === 'binned') {
             // Binned filters can't use index, compute matching indices linearly
             const matchingIndices = new Set<number>()
             for (let i = 0; i < data.length; i++) {
               const numericValue = Number(data[i][filter.column])
               if (!isNaN(numericValue)) {
                 for (const binStart of filter.values) {
                   const binStartNum = Number(binStart)
                   if (numericValue >= binStartNum && numericValue < binStartNum + (filter.binSize || 1)) {
                     matchingIndices.add(i)
                     break
                   }
                 }
               }
             }
             resultIndices = resultIndices ? intersectSets(resultIndices, matchingIndices) : matchingIndices
           } else {
             // Categorical: use column index for O(1) per value lookup
             const colIndex = this.columnIndex.get(filter.column)
             if (!colIndex) {
               // Column not indexed, no matches
               return []
             }
             const matchingIndices = new Set<number>()
             for (const filterValue of filter.values) {
               const normalizedVal = String(filterValue).toLowerCase()
               const indices = colIndex.get(normalizedVal)
               if (indices) {
                 for (const idx of indices) matchingIndices.add(idx)
               }
               // Also check prefix patterns (origin_55 -> 55)
               const prefixMatch = normalizedVal.match(/^([a-z]+_)(\d+)$/)
               if (prefixMatch) {
                 const numericPart = prefixMatch[2]
                 const numericIndices = colIndex.get(numericPart)
                 if (numericIndices) {
                   for (const idx of numericIndices) matchingIndices.add(idx)
                 }
               }
             }
             resultIndices = resultIndices ? intersectSets(resultIndices, matchingIndices) : matchingIndices
           }
         }

         if (!resultIndices || resultIndices.size === 0) return []
         return data.filter((_, i) => resultIndices!.has(i))
       }
       ```

    5. Add helper function (module-level or private):
       ```typescript
       function intersectSets(a: Set<number>, b: Set<number>): Set<number> {
         const result = new Set<number>()
         const smaller = a.size <= b.size ? a : b
         const larger = a.size <= b.size ? b : a
         for (const val of smaller) {
           if (larger.has(val)) result.add(val)
         }
         return result
       }
       ```

    6. Rename existing `applyFilters` body to `applyFiltersLinear` as private fallback method (preserve all existing logic including valuesMatch, prefix patterns, etc.).

    7. Add `getFilteredData()` and `getFilteredIds()` methods for centralized caching (used in Task 3):
       ```typescript
       private cachedFilteredData: any[] | null = null
       private cachedFilteredIds: Set<any> | null = null
       private filterVersion = 0

       getFilteredData<T extends Record<string, any>>(data: T[], idColumn: string): T[] {
         // Invalidate cache on filter change (filterVersion incremented in notifyObservers)
         if (this.cachedFilteredData === null) {
           this.cachedFilteredData = this.applyFilters(data)
         }
         return this.cachedFilteredData as T[]
       }

       getFilteredIds(data: any[], idColumn: string): Set<any> {
         if (this.cachedFilteredIds === null) {
           const filtered = this.getFilteredData(data, idColumn)
           this.cachedFilteredIds = new Set(filtered.map(row => row[idColumn]))
         }
         return this.cachedFilteredIds
       }
       ```

    8. In `notifyObservers()`, invalidate the cache:
       ```typescript
       private notifyObservers(): void {
         this.cachedFilteredData = null
         this.cachedFilteredIds = null
         this.filterVersion++
         this.observers.forEach(obs => obs.onFilterChange(this.filters))
       }
       ```

    **In FilterManager.test.ts:**

    Add tests for the new index functionality while preserving all existing tests:

    ```typescript
    describe('Column Indexing', () => {
      test('buildIndex creates lookup structure', () => {
        const data = [{ mode: 'car', age: 25 }, { mode: 'bike', age: 30 }]
        fm.buildIndex(data)
        // Index exists internally - verify via applyFilters behavior
        fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
        expect(fm.applyFilters(data)).toHaveLength(1)
      })

      test('indexed filter matches non-indexed filter results', () => {
        const data = Array.from({ length: 100 }, (_, i) => ({
          mode: ['car', 'bike', 'walk'][i % 3],
          age: 20 + (i % 5),
        }))
        // Non-indexed
        fm.setFilter('mode', 'mode', new Set(['car', 'bike']), 'categorical')
        const linearResult = fm.applyFilters(data)
        // Indexed
        fm.buildIndex(data)
        const indexedResult = fm.applyFilters(data)
        expect(indexedResult).toEqual(linearResult)
      })

      test('indexed filter handles AND across columns', () => {
        const data = [
          { mode: 'car', age: 25 },
          { mode: 'bike', age: 25 },
          { mode: 'car', age: 30 },
        ]
        fm.buildIndex(data)
        fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
        fm.setFilter('age', 'age', new Set([25]), 'categorical')
        expect(fm.applyFilters(data)).toEqual([{ mode: 'car', age: 25 }])
      })

      test('binned filters work with index (falls back to linear)', () => {
        const data = [
          { distance: 5 }, { distance: 15 }, { distance: 25 },
        ]
        fm.buildIndex(data)
        fm.setFilter('dist', 'distance', new Set([10]), 'binned', 10)
        expect(fm.applyFilters(data)).toEqual([{ distance: 15 }])
      })

      test('getFilteredData caches results', () => {
        const data = [{ mode: 'car' }, { mode: 'bike' }]
        fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
        const result1 = fm.getFilteredData(data, 'mode')
        const result2 = fm.getFilteredData(data, 'mode')
        expect(result1).toBe(result2) // Same reference = cached
      })

      test('cache invalidated on filter change', () => {
        const data = [{ mode: 'car' }, { mode: 'bike' }]
        fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
        const result1 = fm.getFilteredData(data, 'mode')
        fm.setFilter('mode', 'mode', new Set(['bike']), 'categorical')
        const result2 = fm.getFilteredData(data, 'mode')
        expect(result1).not.toBe(result2) // Different reference = cache invalidated
      })
    })
    ```
  </action>
  <verify>
    1. `npm run test:run` - all existing FilterManager tests pass unchanged, new index tests pass
    2. `npm run build` - no TypeScript errors
  </verify>
  <done>
    FilterManager supports column indexes via `buildIndex(data)`. When indexed data is passed to `applyFilters()`, categorical filters use O(1) hash lookup per value instead of O(n) linear scan. Binned filters fall back to linear scan. `getFilteredData()` and `getFilteredIds()` provide cached centralized results invalidated on filter change. All existing applyFilters behavior preserved via `applyFiltersLinear` fallback.
  </done>
</task>

<task type="auto">
  <name>Task 3: Centralized filtered data (eliminate N-times multiplier)</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
    src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
    src/plugins/interactive-dashboard/InteractiveDashboard.vue
  </files>
  <action>
    Currently each LinkableCardWrapper calls `filterManager.applyFilters(allData)` independently. With 6 cards and 10k rows, that's 60k row evaluations per filter click. Centralize so filtering happens ONCE.

    **In InteractiveDashboard.vue:**

    After DataTableManager loads data, call `filterManager.buildIndex(data)` to enable indexed filtering:
    ```typescript
    // After data loading completes (look for where dataTableManager.loadData is called)
    // Add after loadData resolves:
    if (filterManager && dataTableManager) {
      filterManager.buildIndex(dataTableManager.getData())
    }
    ```

    **In LinkableCardWrapper.vue:**

    Replace `updateFilteredData()` to use centralized cache instead of per-card `applyFilters()`:

    Current code (line 108-120):
    ```typescript
    const updateFilteredData = () => {
      if (!props.dataTableManager) {
        filteredData.value = []
        return
      }
      const allData = props.dataTableManager.getData()
      const filtered = props.filterManager.applyFilters(allData)
      filteredData.value = filtered
    }
    ```

    Replace with:
    ```typescript
    const updateFilteredData = () => {
      if (!props.dataTableManager) {
        filteredData.value = []
        return
      }
      const allData = props.dataTableManager.getData()
      const idColumn = props.dataTableManager.getIdColumn()
      // Use centralized cached filtering instead of per-card applyFilters
      filteredData.value = props.filterManager.getFilteredData(allData, idColumn)
    }
    ```

    This means all N wrappers now get the SAME cached array reference from `getFilteredData()` - filter computation happens exactly once per filter change.

    **In DataTableCard.vue:**

    Replace the `filteredRowIds` computed property (line 163-171) that currently calls `applyFilters()` independently:

    Current code:
    ```typescript
    const filteredRowIds = computed(() => {
      const _ = filterVersion.value
      if (!props.filterManager || displayData.value.length === 0) return new Set()
      const filtered = props.filterManager.applyFilters(displayData.value)
      const idColumn = props.tableConfig?.idColumn || 'id'
      return new Set(filtered.map((row: any) => row[idColumn]))
    })
    ```

    Replace with:
    ```typescript
    const filteredRowIds = computed(() => {
      const _ = filterVersion.value
      if (!props.filterManager || !props.dataTableManager || displayData.value.length === 0) return new Set()
      const idColumn = props.tableConfig?.idColumn || 'id'
      // Use centralized cached filtered IDs instead of per-card applyFilters
      return props.filterManager.getFilteredIds(displayData.value, idColumn)
    })
    ```

    This eliminates DataTableCard's SEPARATE call to `applyFilters()` (which was an additional O(n) scan on top of the N wrapper scans).

    **Important backward compatibility note:** The `applyFilters()` public method remains fully functional. Any code that calls it directly (outside the wrapper/table pattern) will still work. The centralization is opt-in via `getFilteredData()`/`getFilteredIds()`.
  </action>
  <verify>
    1. `npm run test:run` - all tests pass
    2. `npm run build` - no TypeScript errors
    3. Verify in LinkableCardWrapper.vue that `applyFilters` is no longer called directly (grep for `applyFilters` - should only appear in FilterManager.ts itself and tests)
  </verify>
  <done>
    Filter computation happens exactly ONCE per filter change regardless of card count. LinkableCardWrapper uses `getFilteredData()` (cached). DataTableCard uses `getFilteredIds()` (cached). Both share the same underlying cached filter result from FilterManager. Eliminates N-times multiplier entirely.
  </done>
</task>

<task type="auto">
  <name>Task 4: Virtual scrolling for DataTableCard</name>
  <files>
    src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
  </files>
  <action>
    Replace the full `v-for` rendering of all rows with windowed virtual scrolling. Only render visible rows (~50) plus buffer, using CSS padding to maintain scroll position. No new npm dependencies.

    **Implementation approach - offset-based virtual scrolling:**

    1. Add constants and refs for virtual scrolling state:
       ```typescript
       const ROW_HEIGHT = 32 // Fixed row height in pixels (matches current td padding)
       const BUFFER_ROWS = 10 // Extra rows above/below viewport

       const scrollTop = ref(0)
       const containerHeight = ref(400) // Will be measured from DOM
       ```

    2. Add computed properties for windowed data:
       ```typescript
       const totalRows = computed(() => sortedDisplayData.value.length)
       const totalHeight = computed(() => totalRows.value * ROW_HEIGHT)

       const startIndex = computed(() => {
         const start = Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER_ROWS
         return Math.max(0, start)
       })

       const endIndex = computed(() => {
         const visibleCount = Math.ceil(containerHeight.value / ROW_HEIGHT)
         const end = Math.floor(scrollTop.value / ROW_HEIGHT) + visibleCount + BUFFER_ROWS
         return Math.min(totalRows.value, end)
       })

       const visibleRows = computed(() => {
         return sortedDisplayData.value.slice(startIndex.value, endIndex.value)
       })

       const topPadding = computed(() => startIndex.value * ROW_HEIGHT)
       const bottomPadding = computed(() => (totalRows.value - endIndex.value) * ROW_HEIGHT)
       ```

    3. Add scroll handler:
       ```typescript
       function handleScroll(event: Event) {
         const target = event.target as HTMLElement
         scrollTop.value = target.scrollTop
       }
       ```

    4. Update template - replace `v-for="(row, rowIndex) in sortedDisplayData"` with windowed rendering:

       In the table-wrapper div, add `@scroll="handleScroll"`.

       Replace the tbody content:
       ```pug
       //- Template changes (written in HTML since DataTableCard uses HTML template):
       ```

       In the `<tbody>`, replace the current `v-for`:
       ```html
       <tbody>
         <!-- Top spacer for virtual scroll -->
         <tr v-if="topPadding > 0" :style="{ height: topPadding + 'px' }">
           <td :colspan="visibleColumns.length"></td>
         </tr>
         <tr
           v-for="(row, idx) in visibleRows"
           :key="getUniqueRowKey(row, startIndex + idx)"
           :data-row-id="getRowId(row)"
           :class="getRowClasses(row)"
           :style="{ height: ROW_HEIGHT + 'px' }"
           @mouseenter="handleRowHover(row)"
           @mouseleave="handleRowLeave"
           @click="handleRowClick(row)"
         >
           <td v-for="col in visibleColumns" :key="col">
             {{ formatCellValue(row[col], col) }}
           </td>
         </tr>
         <!-- Bottom spacer for virtual scroll -->
         <tr v-if="bottomPadding > 0" :style="{ height: bottomPadding + 'px' }">
           <td :colspan="visibleColumns.length"></td>
         </tr>
       </tbody>
       ```

    5. Measure container height on mount and resize:
       ```typescript
       onMounted(() => {
         // ... existing mount code ...
         if (tableWrapper.value) {
           containerHeight.value = tableWrapper.value.clientHeight
           // Re-measure on resize
           const ro = new ResizeObserver((entries) => {
             containerHeight.value = entries[0].contentRect.height
           })
           ro.observe(tableWrapper.value)
           // Store for cleanup
           tableResizeObserver = ro
         }
       })
       ```
       Add `let tableResizeObserver: ResizeObserver | null = null` and clean up in `onUnmounted`.

    6. Update the auto-scroll-to-hovered-row watcher (line 415-436). The current approach uses `querySelector` which won't work for virtualized rows that aren't in the DOM. Replace with index-based scrolling:
       ```typescript
       watch([() => props.hoveredIds, () => props.hoveredIds?.size ?? 0], async () => {
         if (props.hoveredIds.size === 0) return
         if (!enableScrollOnHover.value) return
         if (isHoverFromTable.value) return

         const firstId = Array.from(props.hoveredIds)[0]
         const idColumn = props.tableConfig?.idColumn || 'id'
         // Find row index in sorted data
         const rowIndex = sortedDisplayData.value.findIndex(row => row[idColumn] === firstId)
         if (rowIndex >= 0 && tableWrapper.value) {
           const targetScrollTop = rowIndex * ROW_HEIGHT - (containerHeight.value / 2) + (ROW_HEIGHT / 2)
           tableWrapper.value.scrollTo({
             top: Math.max(0, targetScrollTop),
             behavior: 'smooth'
           })
         }
       })
       ```
       This also removes the `{ deep: true }` from the hoveredIds watcher (already done in Task 1 but reinforced here).

    7. Add CSS for fixed row height to ensure virtual scrolling works:
       ```css
       .data-table tbody tr {
         height: 32px;  /* Must match ROW_HEIGHT constant */
         box-sizing: border-box;
       }
       .data-table td {
         padding: 0.4rem 0.75rem;
         /* ... existing styles ... */
         overflow: hidden;
         text-overflow: ellipsis;
         max-width: 200px;  /* Prevent extremely wide columns */
       }
       ```

    8. Expose `ROW_HEIGHT` as a const in the script section (not a prop - fixed value).

    **Important:** The spacer rows use a single `<td>` with `colspan` to avoid rendering many empty cells. The spacer rows have no interactivity.

    **Backward compatibility:** For small datasets (< 100 rows), the virtual scroll still works fine - it just renders all rows (startIndex=0, endIndex=N) with zero padding, identical to the current behavior.
  </action>
  <verify>
    1. `npm run build` - no TypeScript errors
    2. `npm run test:run` - all tests pass
    3. In the browser with a 10k-row dataset: table scrolls smoothly, filtered rows still highlighted at top, hover scrolling still works, sort still works
    4. DOM inspection: should see ~50-80 `<tr>` elements instead of 10,000
  </verify>
  <done>
    DataTableCard uses offset-based virtual scrolling. Only visible rows plus 10-row buffer are rendered as DOM nodes. Spacer `<tr>` elements maintain correct scroll height. Auto-scroll-to-hovered-row uses index-based calculation instead of DOM query. Small datasets (< 100 rows) behave identically to before. DOM nodes reduced from 10k to ~80 for large datasets.
  </done>
</task>

<task type="auto">
  <name>Task 5: Final verification and commit</name>
  <files>
    src/plugins/interactive-dashboard/managers/FilterManager.ts
    src/plugins/interactive-dashboard/managers/__tests__/FilterManager.test.ts
    src/plugins/interactive-dashboard/components/cards/LinkableCardWrapper.vue
    src/plugins/interactive-dashboard/components/cards/DataTableCard.vue
    src/plugins/interactive-dashboard/components/cards/HistogramCard.vue
  </files>
  <action>
    Cross-cutting verification that all 5 optimizations work together correctly.

    1. Run the full test suite: `npm run test:run`
       - All existing FilterManager tests pass (OR logic, AND logic, toggle, clear)
       - All new index tests pass
       - All other test files pass (statistics, trackAllocator, axisLimits, StyleManager, etc.)

    2. Run the build: `npm run build`
       - No TypeScript errors
       - No warnings about unused imports or variables

    3. Verify no regressions in key patterns:
       - Grep for `{ deep: true }` in card files - should only remain on MapCard's `props.layers` watcher
       - Grep for `Plotly.newPlot` in HistogramCard - should only be in `initializeChart()`, not in `updateChart()`
       - Grep for `applyFilters` in LinkableCardWrapper - should NOT appear (replaced with `getFilteredData`)
       - Grep for `applyFilters` in DataTableCard - should NOT appear (replaced with `getFilteredIds`)

    4. Review the data flow end-to-end:
       - DataTableManager loads CSV -> FilterManager.buildIndex(data) called
       - User clicks histogram bin -> FilterManager.setFilter() -> cache invalidated -> observers notified
       - Each LinkableCardWrapper.onFilterChange() calls updateFilteredData()
       - updateFilteredData() calls filterManager.getFilteredData() -> returns cached result (computed once)
       - All N wrappers get same array reference -> shallow watchers detect reference change -> debounced re-render

    5. If any issues found, fix them. Common issues to watch for:
       - TypeScript type errors from new methods (getFilteredData, getFilteredIds, buildIndex)
       - Missing imports if code was restructured
       - Event handler registration in HistogramCard's new initializeChart pattern
  </action>
  <verify>
    1. `npm run test:run` - 0 failures
    2. `npm run build` - 0 errors
    3. No remaining `{ deep: true }` on data watchers (except MapCard layers)
    4. No remaining direct `applyFilters` calls in wrapper or table card
  </verify>
  <done>
    All 5 performance optimizations verified working together. Test suite passes. Build succeeds. No deep watchers on reactive data. Centralized filtering with column indexes. Debounced chart rendering. Virtual scrolling for table. Ready for manual testing with large datasets.
  </done>
</task>

</tasks>

<verification>
1. `npm run test:run` - All existing and new tests pass
2. `npm run build` - Clean build with no errors
3. Manual test with a dashboard YAML + CSV with 10k+ rows:
   - Click histogram bin: filter response should be noticeably faster
   - Scroll data table: should be smooth, not janky
   - Rapid filter changes: charts should not flicker (debounced)
   - All card interactions (hover, select, filter) work as before
4. Manual test with a small dashboard (< 100 rows): behavior identical to before
</verification>

<success_criteria>
- All existing tests pass without modification
- New FilterManager index tests pass
- Build completes with zero errors
- No `{ deep: true }` on filteredData/hoveredIds/selectedIds/baselineData watchers (except MapCard.layers)
- FilterManager.applyFilters called once per filter change (not N times)
- HistogramCard uses Plotly.react() for updates (not newPlot())
- DataTableCard renders ~50-80 DOM rows regardless of dataset size
- All existing dashboard YAML configurations work unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/009-dashboard-performance-optimizations/009-SUMMARY.md`
</output>
