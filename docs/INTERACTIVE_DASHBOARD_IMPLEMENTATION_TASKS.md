# Interactive Dashboard - Implementation Tasks (Parallel Development)
## Pure Additive - Zero Modifications to Existing Code

**Document Version**: 4.0 - PARALLEL DEVELOPMENT
**Created**: 2025-11-21
**Updated**: 2025-11-21 - Pure additive approach, no refactoring
**Purpose**: Self-contained task batches for autonomous implementation

---

## 🎯 Architecture: Parallel Development

**CRITICAL**: This is **pure additive** development:

- ✅ Create `InteractiveDashboard.vue` **alongside** `DashBoard.vue`
- ✅ **DO NOT modify** any existing files
- ✅ **DO NOT create** shared folders or refactor existing code
- ✅ **Copy** patterns from existing files directly
- ✅ **Reference** existing utilities by their current paths
- ✅ Detection logic switches between old and new components

**See**: `docs/PARALLEL_DEVELOPMENT_STRATEGY.md` for complete strategy

---

## 🎯 Acceptance Criteria

**The implementation is complete when**:

1. ✅ **Zero Modifications**: No existing files changed
   - `DashBoard.vue` untouched
   - All existing dashboards work exactly as before
   - No risk of regression

2. ✅ **Parallel Component**: InteractiveDashboard.vue functional
   - Loads when `table` section present
   - Uses FilterManager/LinkageManager for coordination
   - Copies layout logic from DashBoard.vue

3. ✅ **Feature Parity**: Re-implement commuter-requests
   - Create `dashboard-commuter-requests-interactive.yaml`
   - Identical functionality to current plugin
   - Side-by-side comparison passes

4. ✅ **Easy Rollback**: Simple switch to disable
   - Flag to revert to DashBoard.vue
   - No code changes needed
   - Instant rollback capability

---

## Task Organization

**5 Batches, 10 Tasks** (reduced from 12 - simpler with no refactoring):

- **Batch A**: Core Coordination Layer (3 tasks)
- **Batch B**: InteractiveDashboard Component (2 tasks)
- **Batch C**: Interactive Card Types (2 tasks)
- **Batch D**: Integration & Discovery (2 tasks)
- **Batch E**: Validation (1 task)

---

# BATCH A: Core Coordination Layer

**Summary**: Create the managers that coordinate filtering and linkage
**Effort**: Medium | **Dependencies**: None
**Impact on existing code**: ZERO (all new files)

---

## TASK A1: Create FilterManager

**Objective**: Implement centralized filter coordination system

**Context Files to Read**:
- `src/plugins/commuter-requests/utils/filters.ts` - Filter logic patterns
- `src/plugins/commuter-requests/CommuterRequests.vue` (lines 200-350) - Filter state

**Key Patterns to Extract**:
```typescript
// OR logic within filter groups
activeTimeFilter: Set<number>()    // Any matching bin
mainModeFilter: Set<string>()      // Any matching mode

// AND logic between filter types
const filtered = data.filter(row => {
  if (activeTimeFilter.size > 0 && !activeTimeFilter.has(row.timebin)) return false
  if (mainModeFilter.size > 0 && !mainModeFilter.has(row.mode)) return false
  return true
})
```

**Implementation**:

Create `src/managers/FilterManager.ts`:

```typescript
export type FilterType = 'categorical' | 'range' | 'time' | 'binned'

export interface Filter {
  id: string
  column: string
  type: FilterType
  values: Set<any>              // Selected values (OR logic within set)
  behavior: 'toggle' | 'replace'
}

export interface FilterObserver {
  onFilterChange: (filters: Map<string, Filter>) => void
}

export class FilterManager {
  private filters: Map<string, Filter> = new Map()
  private observers: Set<FilterObserver> = new Set()

  addObserver(observer: FilterObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: FilterObserver): void {
    this.observers.delete(observer)
  }

  setFilter(filterId: string, column: string, values: Set<any>, type: FilterType): void {
    this.filters.set(filterId, { id: filterId, column, type, values, behavior: 'toggle' })
    this.notifyObservers()
  }

  toggleFilterValue(filterId: string, value: any): void {
    const filter = this.filters.get(filterId)
    if (!filter) return

    if (filter.values.has(value)) {
      filter.values.delete(value)
      if (filter.values.size === 0) {
        this.filters.delete(filterId)
      }
    } else {
      filter.values.add(value)
    }

    this.notifyObservers()
  }

  clearFilter(filterId: string): void {
    this.filters.delete(filterId)
    this.notifyObservers()
  }

  clearAllFilters(): void {
    this.filters.clear()
    this.notifyObservers()
  }

  getFilters(): ReadonlyMap<string, Filter> {
    return this.filters
  }

  /**
   * Apply filters to dataset (AND between filters, OR within values)
   */
  applyFilters<T extends Record<string, any>>(data: T[]): T[] {
    if (this.filters.size === 0) return data

    return data.filter(row => {
      // AND logic between different filters
      for (const filter of this.filters.values()) {
        const cellValue = row[filter.column]

        // OR logic within filter values
        if (!filter.values.has(cellValue)) {
          return false
        }
      }
      return true
    })
  }

  private notifyObservers(): void {
    this.observers.forEach(obs => obs.onFilterChange(this.filters))
  }
}
```

**Tests**:

Create `src/managers/__tests__/FilterManager.test.ts`:

```typescript
import { FilterManager } from '../FilterManager'

describe('FilterManager', () => {
  let fm: FilterManager

  beforeEach(() => {
    fm = new FilterManager()
  })

  test('applies OR logic within filter values', () => {
    const data = [{ mode: 'car' }, { mode: 'bike' }, { mode: 'walk' }]
    fm.setFilter('mode', 'mode', new Set(['car', 'bike']), 'categorical')

    const filtered = fm.applyFilters(data)
    expect(filtered).toHaveLength(2)
  })

  test('applies AND logic between different filters', () => {
    const data = [
      { mode: 'car', age: 25 },
      { mode: 'bike', age: 25 },
      { mode: 'car', age: 30 },
    ]

    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.setFilter('age', 'age', new Set([25]), 'categorical')

    const filtered = fm.applyFilters(data)
    expect(filtered).toEqual([{ mode: 'car', age: 25 }])
  })

  test('notifies observers on filter change', () => {
    const observer = { onFilterChange: jest.fn() }
    fm.addObserver(observer)

    fm.setFilter('test', 'col', new Set([1]), 'categorical')
    expect(observer.onFilterChange).toHaveBeenCalled()
  })

  test('toggles filter values', () => {
    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.toggleFilterValue('mode', 'bike')

    let filter = fm.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(true)

    fm.toggleFilterValue('mode', 'bike')
    filter = fm.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(false)
  })
})
```

**Files Created**:
- ✅ `src/managers/FilterManager.ts`
- ✅ `src/managers/__tests__/FilterManager.test.ts`

**Files Modified**: NONE

**Acceptance**:
- ✅ Tests pass (>80% coverage)
- ✅ Observer pattern works
- ✅ OR/AND logic correct

---

## TASK A2: Create LinkageManager

**Objective**: Implement map-to-table linkage coordination

**Context Files to Read**:
- `src/plugins/commuter-requests/components/RequestsMap.vue` (lines 400-500) - Hover/selection
- `src/plugins/commuter-requests/CommuterRequests.vue` (lines 600-700) - Selection state

**Key Patterns**:
```typescript
// Multi-geometry linkage: Multiple layers link to same table column
const hoveredFeatures = new Set<number>()
const selectedFeatures = new Set<number>()

// Toggle selection for stacked geometries
const allSelected = ids.every(id => selectedFeatures.has(id))
if (allSelected) {
  ids.forEach(id => selectedFeatures.delete(id))
} else {
  ids.forEach(id => selectedFeatures.add(id))
}
```

**Implementation**:

Create `src/managers/LinkageManager.ts`:

```typescript
export interface LinkageConfig {
  tableColumn: string
  geoProperty: string
  onHover?: 'highlight' | 'none'
  onSelect?: 'filter' | 'highlight' | 'none'
}

export interface LinkageObserver {
  onHoveredIdsChange: (ids: Set<any>) => void
  onSelectedIdsChange: (ids: Set<any>) => void
}

export class LinkageManager {
  private hoveredIds: Set<any> = new Set()
  private selectedIds: Set<any> = new Set()
  private observers: Set<LinkageObserver> = new Set()

  addObserver(observer: LinkageObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: LinkageObserver): void {
    this.observers.delete(observer)
  }

  setHoveredIds(ids: Set<any>): void {
    this.hoveredIds = new Set(ids)
    this.notifyHover()
  }

  setSelectedIds(ids: Set<any>): void {
    this.selectedIds = new Set(ids)
    this.notifySelection()
  }

  /**
   * Toggle selection for multiple IDs (for stacked geometries)
   */
  toggleSelectedIds(ids: Set<any>): void {
    const allSelected = Array.from(ids).every(id => this.selectedIds.has(id))

    if (allSelected) {
      ids.forEach(id => this.selectedIds.delete(id))
    } else {
      ids.forEach(id => this.selectedIds.add(id))
    }

    this.notifySelection()
  }

  clearSelection(): void {
    this.selectedIds.clear()
    this.notifySelection()
  }

  getHoveredIds(): ReadonlySet<any> {
    return this.hoveredIds
  }

  getSelectedIds(): ReadonlySet<any> {
    return this.selectedIds
  }

  private notifyHover(): void {
    this.observers.forEach(obs => obs.onHoveredIdsChange(this.hoveredIds))
  }

  private notifySelection(): void {
    this.observers.forEach(obs => obs.onSelectedIdsChange(this.selectedIds))
  }
}
```

**Tests**:

Create `src/managers/__tests__/LinkageManager.test.ts`:

```typescript
import { LinkageManager } from '../LinkageManager'

describe('LinkageManager', () => {
  let lm: LinkageManager

  beforeEach(() => {
    lm = new LinkageManager()
  })

  test('notifies observers on hover change', () => {
    const observer = {
      onHoveredIdsChange: jest.fn(),
      onSelectedIdsChange: jest.fn(),
    }
    lm.addObserver(observer)

    lm.setHoveredIds(new Set([1, 2, 3]))
    expect(observer.onHoveredIdsChange).toHaveBeenCalledWith(new Set([1, 2, 3]))
  })

  test('toggles selection (multi-select behavior)', () => {
    lm.setSelectedIds(new Set([1, 2]))

    // Toggle with overlapping: deselect all
    lm.toggleSelectedIds(new Set([1, 2]))
    expect(lm.getSelectedIds().size).toBe(0)

    // Toggle with new: select all
    lm.toggleSelectedIds(new Set([3, 4]))
    expect(lm.getSelectedIds().size).toBe(2)
  })

  test('clears all selections', () => {
    lm.setSelectedIds(new Set([1, 2, 3]))
    lm.clearSelection()
    expect(lm.getSelectedIds().size).toBe(0)
  })
})
```

**Files Created**:
- ✅ `src/managers/LinkageManager.ts`
- ✅ `src/managers/__tests__/LinkageManager.test.ts`

**Files Modified**: NONE

**Acceptance**:
- ✅ Tests pass
- ✅ Multi-select toggle works
- ✅ Observer pattern works

---

## TASK A3: Create DataTableManager

**Objective**: Centralized data loading

**Context Files to Read**:
- `src/plugins/commuter-requests/utils/dataLoader.ts` - CSV loading

**Implementation**:

Create `src/managers/DataTableManager.ts`:

```typescript
import Papa from 'papaparse'

export interface TableConfig {
  name: string
  dataset: string
  idColumn: string
  visible: boolean
  columns?: {
    hide?: string[]
    formats?: Record<string, any>
  }
}

export interface DataRow {
  [key: string]: any
}

export class DataTableManager {
  private data: DataRow[] = []
  private config: TableConfig
  private idColumn: string

  constructor(config: TableConfig) {
    this.config = config
    this.idColumn = config.idColumn
  }

  async loadData(fileService: any, subfolder: string): Promise<void> {
    const filepath = subfolder + '/' + this.config.dataset

    return new Promise((resolve, reject) => {
      fileService.fetchFileAsBlob(filepath).then((blob: Blob) => {
        Papa.parse(blob, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results: any) => {
            this.data = results.data
            resolve()
          },
          error: reject,
        })
      })
    })
  }

  getData(): DataRow[] {
    return this.data
  }

  getRowById(id: any): DataRow | undefined {
    return this.data.find(row => row[this.idColumn] === id)
  }

  getRowsByIds(ids: Set<any>): DataRow[] {
    return this.data.filter(row => ids.has(row[this.idColumn]))
  }

  getColumnValues(column: string): any[] {
    return Array.from(new Set(this.data.map(row => row[column])))
  }

  getConfig(): TableConfig {
    return this.config
  }
}
```

**Tests**:

Create `src/managers/__tests__/DataTableManager.test.ts`:

```typescript
import { DataTableManager } from '../DataTableManager'

describe('DataTableManager', () => {
  const mockConfig = {
    name: 'Test',
    dataset: 'test.csv',
    idColumn: 'id',
    visible: true,
  }

  let dtm: DataTableManager

  beforeEach(() => {
    dtm = new DataTableManager(mockConfig)
    ;(dtm as any).data = [
      { id: 1, name: 'Alice', mode: 'car' },
      { id: 2, name: 'Bob', mode: 'bike' },
      { id: 3, name: 'Charlie', mode: 'car' },
    ]
  })

  test('gets row by ID', () => {
    const row = dtm.getRowById(2)
    expect(row).toEqual({ id: 2, name: 'Bob', mode: 'bike' })
  })

  test('gets multiple rows by IDs', () => {
    const rows = dtm.getRowsByIds(new Set([1, 3]))
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.name)).toEqual(['Alice', 'Charlie'])
  })

  test('gets unique column values', () => {
    const values = dtm.getColumnValues('mode')
    expect(values).toEqual(['car', 'bike'])
  })
})
```

**Files Created**:
- ✅ `src/managers/DataTableManager.ts`
- ✅ `src/managers/__tests__/DataTableManager.test.ts`

**Files Modified**: NONE

**Acceptance**:
- ✅ Tests pass
- ✅ CSV loading works
- ✅ Row lookup works

---

# BATCH B: InteractiveDashboard Component

**Summary**: Create parallel component alongside DashBoard.vue
**Effort**: Medium | **Dependencies**: Batch A
**Impact on existing code**: Detection logic only (minimal, non-breaking)

---

## TASK B1: Create InteractiveDashboard.vue

**Objective**: Create parallel dashboard component with coordination layer

**Context Files to Read**:
- `src/layout-manager/DashBoard.vue` - COPY layout structure from here
- Read the entire file to understand row/card rendering

**Implementation Steps**:

**Step 1**: Read `DashBoard.vue` and document:
- How rows are structured
- How cards are rendered
- What styles are used
- What props the component receives
- How card components are resolved

**Step 2**: Create `src/layout-manager/InteractiveDashboard.vue`

Copy the structure from DashBoard.vue but add coordination layer:

```vue
<template>
  <div class="interactive-dashboard">
    <!-- Copy row/card structure from DashBoard.vue -->
    <div v-for="row in rows" :key="row.id" class="dashboard-row">
      <div
        v-for="(card, i) in row.cards"
        :key="i"
        :style="getCardStyle(card)"
        class="dashboard-card"
      >
        <!-- NEW: Wrap cards that have linkage config -->
        <LinkableCardWrapper
          v-if="card.linkage"
          :card="card"
          :filter-manager="filterManager"
          :linkage-manager="linkageManager"
          :data-table-manager="dataTableManager"
        >
          <component :is="getCardComponent(card.type)" v-bind="cardProps(card)" />
        </LinkableCardWrapper>

        <!-- Existing: Standard card rendering (copy from DashBoard.vue) -->
        <component v-else :is="getCardComponent(card.type)" v-bind="cardProps(card)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LinkableCardWrapper from '@/components/interactive/LinkableCardWrapper.vue'
import { FilterManager } from '@/managers/FilterManager'
import { LinkageManager } from '@/managers/LinkageManager'
import { DataTableManager } from '@/managers/DataTableManager'

// Copy interface from DashBoard.vue props
interface Props {
  config: any
  fileService: any
  subfolder: string
  // Copy any other props that DashBoard.vue receives
}

const props = defineProps<Props>()

// Coordination layer (NEW)
const filterManager = new FilterManager()
const linkageManager = new LinkageManager()
const dataTableManager = new DataTableManager(props.config.table)

// Layout state (copy from DashBoard.vue)
const rows = ref<any[]>([])

// Copy these functions directly from DashBoard.vue:

function getCardStyle(card: any) {
  // Copy implementation from DashBoard.vue
  const height = card.height ? card.height * 60 : 300
  const flex = card.width || 1
  return { flex, minHeight: `${height}px` }
}

function getCardComponent(type: string) {
  // Copy implementation from DashBoard.vue
  // This function resolves card type to component
  // Find where DashBoard.vue does this and copy it
}

function cardProps(card: any) {
  // Copy implementation from DashBoard.vue
  // This prepares props for card components
  return {
    ...card,
    // Copy any standard props DashBoard.vue adds
  }
}

onMounted(async () => {
  // Load centralized data (NEW)
  await dataTableManager.loadData(props.fileService, props.subfolder)

  // Parse layout (copy from DashBoard.vue)
  rows.value = Object.entries(props.config.layout).map(([id, cards]) => ({
    id,
    cards: Array.isArray(cards) ? cards : [cards],
  }))
})
</script>

<style scoped>
/* Copy all styles from DashBoard.vue */
.dashboard-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dashboard-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Copy any other styles */
</style>
```

**Step 3**: Create LinkableCardWrapper

Create `src/components/interactive/LinkableCardWrapper.vue`:

```vue
<template>
  <div class="linkable-card-wrapper">
    <slot
      :filtered-data="filteredData"
      :hovered-ids="hoveredIds"
      :selected-ids="selectedIds"
      @filter="handleFilter"
      @hover="handleHover"
      @select="handleSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { FilterManager, FilterObserver } from '@/managers/FilterManager'
import type { LinkageManager, LinkageObserver } from '@/managers/LinkageManager'
import type { DataTableManager } from '@/managers/DataTableManager'

interface Props {
  card: any
  filterManager: FilterManager
  linkageManager: LinkageManager
  dataTableManager: DataTableManager
}

const props = defineProps<Props>()

const hoveredIds = ref<Set<any>>(new Set())
const selectedIds = ref<Set<any>>(new Set())
const filteredData = ref<any[]>([])

const filterObserver: FilterObserver = {
  onFilterChange: () => {
    updateFilteredData()
  },
}

const linkageObserver: LinkageObserver = {
  onHoveredIdsChange: (ids: Set<any>) => {
    hoveredIds.value = ids
  },
  onSelectedIdsChange: (ids: Set<any>) => {
    selectedIds.value = ids
  },
}

const handleFilter = (filterId: string, column: string, values: Set<any>) => {
  props.filterManager.setFilter(filterId, column, values, 'categorical')
}

const handleHover = (ids: Set<any>) => {
  props.linkageManager.setHoveredIds(ids)
}

const handleSelect = (ids: Set<any>) => {
  if (props.card.linkage?.behavior === 'toggle') {
    props.linkageManager.toggleSelectedIds(ids)
  } else {
    props.linkageManager.setSelectedIds(ids)
  }
}

const updateFilteredData = () => {
  const allData = props.dataTableManager.getData()
  filteredData.value = props.filterManager.applyFilters(allData)
}

onMounted(() => {
  props.filterManager.addObserver(filterObserver)
  props.linkageManager.addObserver(linkageObserver)
  updateFilteredData()
})

onUnmounted(() => {
  props.filterManager.removeObserver(filterObserver)
  props.linkageManager.removeObserver(linkageObserver)
})
</script>

<style scoped>
.linkable-card-wrapper {
  height: 100%;
  width: 100%;
}
</style>
```

**Files Created**:
- ✅ `src/layout-manager/InteractiveDashboard.vue`
- ✅ `src/components/interactive/LinkableCardWrapper.vue`

**Files Modified**: NONE (yet - detection comes in B2)

**Acceptance**:
- ✅ Component compiles
- ✅ Can load with test config
- ✅ Layout renders correctly
- ✅ Managers initialized

---

## TASK B2: Add Dashboard Detection Logic

**Objective**: Switch between DashBoard and InteractiveDashboard based on config

**Context Files to Search**:
```bash
# Find where dashboards are loaded
grep -r "DashBoard" src/ --include="*.vue" --include="*.ts"
grep -r "import.*DashBoard" src/
grep -r "dashboard.*yaml" src/
```

**Implementation**:

**Step 1**: Find the file that imports and uses `DashBoard.vue`

**Step 2**: Add detection logic:

```typescript
// In the file that loads dashboards
import DashBoard from '@/layout-manager/DashBoard.vue'
import InteractiveDashboard from '@/layout-manager/InteractiveDashboard.vue'  // NEW

// Add detection function
function getDashboardComponent(config: any) {
  if (config.table) {
    console.log('[Interactive] Loading InteractiveDashboard')
    return InteractiveDashboard
  } else {
    console.log('[Standard] Loading DashBoard')
    return DashBoard
  }
}

// Use dynamic component
<component :is="getDashboardComponent(config)" :config="config" ... />
```

**Files Modified**:
- ✅ 1 file (dashboard loader) - minimal additive changes

**Acceptance**:
- ✅ Legacy dashboards use DashBoard.vue
- ✅ Interactive dashboards use InteractiveDashboard.vue
- ✅ Console logs show which component loaded
- ✅ No breaking changes

---

# BATCH C: Interactive Card Types

**Summary**: Create histogram and pie-chart cards
**Effort**: Medium | **Dependencies**: Batch A, B
**Impact on existing code**: Card registry only (additive)

---

## TASK C1: Create Interactive Card Components

**Objective**: Build histogram and pie-chart with filtering

**Context Files to Read**:
- `src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue`
- `src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`

**Implementation**:

Create `src/components/interactive/HistogramCard.vue`:

```vue
<template>
  <div class="histogram-card">
    <h3 v-if="title">{{ title }}</h3>
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import Plotly from 'plotly.js-dist-min'

interface Props {
  title?: string
  column: string
  binSize?: number
  filteredData: any[]
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
}>()

const plotContainer = ref<HTMLElement>()
const selectedBins = ref<Set<number>>(new Set())

const histogramData = computed(() => {
  const values = props.filteredData.map(row => row[props.column])
  const binSize = props.binSize || 1

  const bins = new Map<number, number>()
  values.forEach(val => {
    const bin = Math.floor(val / binSize) * binSize
    bins.set(bin, (bins.get(bin) || 0) + 1)
  })

  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({ bin, count }))
})

const renderChart = () => {
  if (!plotContainer.value) return

  const trace = {
    x: histogramData.value.map(d => d.bin),
    y: histogramData.value.map(d => d.count),
    type: 'bar',
    marker: {
      color: histogramData.value.map(d =>
        selectedBins.value.has(d.bin) ? '#ff6b6b' : '#4dabf7'
      ),
    },
  }

  const layout = {
    title: props.title,
    xaxis: { title: props.column },
    yaxis: { title: 'Count' },
    margin: { l: 40, r: 20, t: 40, b: 40 },
  }

  Plotly.newPlot(plotContainer.value, [trace], layout, {
    displayModeBar: false,
    responsive: true,
  })

  plotContainer.value.on('plotly_click', (data: any) => {
    const bin = data.points[0].x

    if (selectedBins.value.has(bin)) {
      selectedBins.value.delete(bin)
    } else {
      selectedBins.value.add(bin)
    }

    if (props.linkage?.type === 'filter') {
      const filterId = `histogram-${props.column}`
      emit('filter', filterId, props.column, new Set(selectedBins.value))
    }

    renderChart()
  })
}

watch(() => props.filteredData, renderChart, { deep: true })
onMounted(renderChart)
</script>

<style scoped>
.histogram-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plot-container {
  flex: 1;
  min-height: 0;
}
</style>
```

Create `src/components/interactive/PieChartCard.vue`:

```vue
<template>
  <div class="pie-chart-card">
    <h3 v-if="title">{{ title }}</h3>
    <div ref="plotContainer" class="plot-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import Plotly from 'plotly.js-dist-min'

interface Props {
  title?: string
  column: string
  filteredData: any[]
  linkage?: {
    type: 'filter'
    column: string
    behavior: 'toggle'
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>]
}>()

const plotContainer = ref<HTMLElement>()
const selectedCategories = ref<Set<string>>(new Set())

const pieData = computed(() => {
  const counts = new Map<string, number>()
  props.filteredData.forEach(row => {
    const val = row[props.column]
    counts.set(val, (counts.get(val) || 0) + 1)
  })

  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }))
})

const renderChart = () => {
  if (!plotContainer.value) return

  const trace = {
    labels: pieData.value.map(d => d.label),
    values: pieData.value.map(d => d.value),
    type: 'pie',
    marker: {
      colors: pieData.value.map(d =>
        selectedCategories.value.has(d.label) ? '#ff6b6b' : '#4dabf7'
      ),
    },
  }

  Plotly.newPlot(
    plotContainer.value,
    [trace],
    { title: props.title, margin: { t: 40, b: 20, l: 20, r: 20 } },
    { displayModeBar: false, responsive: true }
  )

  plotContainer.value.on('plotly_click', (data: any) => {
    const category = data.points[0].label

    if (selectedCategories.value.has(category)) {
      selectedCategories.value.delete(category)
    } else {
      selectedCategories.value.add(category)
    }

    if (props.linkage?.type === 'filter') {
      const filterId = `pie-${props.column}`
      emit('filter', filterId, props.column, new Set(selectedCategories.value))
    }

    renderChart()
  })
}

watch(() => props.filteredData, renderChart, { deep: true })
onMounted(renderChart)
</script>

<style scoped>
.pie-chart-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.plot-container {
  flex: 1;
}
</style>
```

**Files Created**:
- ✅ `src/components/interactive/HistogramCard.vue`
- ✅ `src/components/interactive/PieChartCard.vue`

**Files Modified**: NONE

**Acceptance**:
- ✅ Components compile
- ✅ Histogram bins correctly
- ✅ Click toggles selection
- ✅ Emits filter events

---

## TASK C2: Register New Card Types

**Objective**: Add histogram and pie-chart to card registry

**Context Files to Search**:
```bash
# Find card type registry
grep -r "cardTypes" src/ --include="*.ts" --include="*.vue"
grep -r "'map'" src/ --include="*.ts"
```

**Implementation**:

Find where card types are registered, then add:

```typescript
// In card registry file
import HistogramCard from '@/components/interactive/HistogramCard.vue'
import PieChartCard from '@/components/interactive/PieChartCard.vue'

// Add to registry
cardTypes.set('histogram', HistogramCard)
cardTypes.set('pie-chart', PieChartCard)
```

**Files Modified**:
- ✅ 1 file (card registry) - additive only

**Acceptance**:
- ✅ Can use `type: histogram` in YAML
- ✅ Can use `type: pie-chart` in YAML
- ✅ No breaking changes

---

# BATCH D: Integration & Discovery

**Summary**: Examples and documentation
**Effort**: Small | **Dependencies**: All previous
**Impact on existing code**: ZERO

---

## TASK D1: Create Example Dashboard

**Objective**: Working example

**Implementation**:

Create `public/example-data/dashboard-interactive-example.yaml`:

```yaml
title: "Interactive Dashboard Example"

table:
  name: "Sample Data"
  dataset: sample-data.csv
  idColumn: id
  visible: true

layout:
  row1:
    - type: map
      width: 2
      height: 8
      layers:
        - file: points.geojson
          linkage:
            tableColumn: id
            geoProperty: id

    - type: histogram
      title: "Value Distribution"
      column: value
      binSize: 10
      width: 1
      height: 4
      linkage:
        type: filter
        column: value
        behavior: toggle

  row2:
    - type: table
      width: 3
      source: table
```

**Files Created**:
- ✅ Example YAML + data files

**Files Modified**: NONE

---

## TASK D2: Documentation

**Objective**: Document card types

Create `docs/CARD_TYPES_REFERENCE.md` with histogram and pie-chart docs.

**Files Created**:
- ✅ Documentation

**Files Modified**: NONE

---

# BATCH E: Validation

**Summary**: Re-implement commuter-requests
**Effort**: Large | **Dependencies**: All previous
**Impact**: ZERO

---

## TASK E1: Recreate Commuter Requests

**Objective**: Feature parity validation

Create `dashboard-commuter-requests-interactive.yaml` that recreates the plugin.

**Validation**: 20-point checklist for side-by-side comparison

**Files Created**:
- ✅ Interactive dashboard YAML

**Files Modified**: NONE

---

## Summary

### Files Created: 15 | Files Modified: 2

| Batch | Created | Modified | Impact |
|-------|---------|----------|--------|
| A | 6 | 0 | ZERO |
| B | 2 | 1 | Minimal |
| C | 2 | 1 | Additive |
| D | 4 | 0 | ZERO |
| E | 1 | 0 | ZERO |
| **Total** | **15** | **2** | **Safe** |

### Timeline

- Sequential: 9-13 days
- Parallel: 6-8 days

### Rollback

Change one line:
```typescript
const USE_INTERACTIVE = false  // Instant rollback
```

All changes are **pure additive** - zero risk! ✅
