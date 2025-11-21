# Interactive Dashboard - Implementation Tasks (Unified Format)
## Detailed Task Batches for Coding Agents

**Document Version**: 3.0 - UNIFIED FORMAT
**Created**: 2025-11-21
**Updated**: 2025-11-21 - Complete rewrite for unified format architecture
**Purpose**: Self-contained task batches with all context for autonomous implementation

---

## 🎯 Architecture: Unified Format

**CRITICAL**: This is NOT a separate plugin. We are enhancing SimWrapper's existing dashboard system:

- ✅ Use SimWrapper's existing row/card layout structure
- ✅ Add optional `table` section that triggers coordination layer
- ✅ Stats are card types (histogram, pie-chart) in layout with `linkage` config
- ✅ Parser detects `table` presence to enable FilterManager/LinkageManager
- ✅ Full backward compatibility (legacy dashboards unchanged)

**See**: `docs/UNIFIED_YAML_FORMAT.md` for complete format specification

---

## 🎯 Acceptance Criteria

**The implementation is complete when**:

1. ✅ **Unified Format**: Uses SimWrapper's dashboard structure
   - Legacy dashboards without `table` work unchanged
   - Adding `table` section enables interactive coordination
   - Stats are card types in layout (not separate section)

2. ✅ **Coordination Layer**: FilterManager + LinkageManager functional
   - Clicking stats filters table and map
   - Map selections filter table and stats
   - Hover highlights across all views

3. ✅ **Feature Parity**: Re-implement commuter-requests dashboard
   - Create `dashboard-commuter-requests-interactive.yaml`
   - Identical visualization to current plugin
   - All interactions work (filter, hover, select, comparison)

4. ✅ **Testing**: Comprehensive coverage
   - Unit tests for managers (>80%)
   - Integration tests (legacy vs interactive mode)
   - Side-by-side comparison passes

---

## Task Organization

Tasks are grouped into **batches** that can be assigned to different coding agents:

- **Batch A**: Core Coordination Layer (3 tasks)
- **Batch B**: Card Infrastructure (2 tasks)
- **Batch C**: Interactive Card Types (3 tasks)
- **Batch D**: Dashboard Integration (2 tasks)
- **Batch E**: Validation & Testing (2 tasks)

**Total**: 5 batches, 12 tasks

---

# BATCH A: Core Coordination Layer

**Summary**: Create the managers that coordinate filtering and linkage between cards.
**Effort**: Medium | **Dependencies**: None
**Output**: Three manager classes that form the coordination backbone

---

## TASK A1: Create FilterManager

**Objective**: Implement centralized filter coordination system

**Context Files to Read**:
- `src/plugins/commuter-requests/utils/filters.ts` - Current filter logic patterns
- `src/plugins/commuter-requests/CommuterRequests.vue` (lines 200-350) - Filter state management

**Key Patterns to Extract**:
```typescript
// From commuter-requests: Multiple filter types with OR logic within groups
activeTimeFilter: Set<number>(),    // OR logic: any matching bin
mainModeFilter: Set<string>(),      // OR logic: any matching mode
clusterFilter: Set<number>(),       // OR logic: any matching cluster

// Combined filtering: AND between filter types, OR within groups
const filtered = data.filter(row => {
  if (activeTimeFilter.size > 0 && !activeTimeFilter.has(row.timebin)) return false
  if (mainModeFilter.size > 0 && !mainModeFilter.has(row.mode)) return false
  if (clusterFilter.size > 0 && !clusterFilter.has(row.cluster)) return false
  return true
})
```

**Implementation**:

Create `src/managers/FilterManager.ts`:

```typescript
export type FilterType = 'categorical' | 'range' | 'time' | 'binned'

export interface Filter {
  id: string                    // Unique filter identifier
  column: string                // Table column to filter
  type: FilterType
  values: Set<any>              // Selected values (OR logic within set)
  behavior: 'toggle' | 'replace'  // How clicks behave
}

export interface FilterObserver {
  onFilterChange: (filters: Map<string, Filter>) => void
}

export class FilterManager {
  private filters: Map<string, Filter> = new Map()
  private observers: Set<FilterObserver> = new Set()

  /**
   * Register a component to receive filter updates
   */
  addObserver(observer: FilterObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: FilterObserver): void {
    this.observers.delete(observer)
  }

  /**
   * Add/update a filter (with OR logic for values)
   */
  setFilter(filterId: string, column: string, values: Set<any>, type: FilterType): void {
    this.filters.set(filterId, { id: filterId, column, type, values, behavior: 'toggle' })
    this.notifyObservers()
  }

  /**
   * Toggle a value in an existing filter (OR logic)
   */
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

  /**
   * Clear a specific filter
   */
  clearFilter(filterId: string): void {
    this.filters.delete(filterId)
    this.notifyObservers()
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.filters.clear()
    this.notifyObservers()
  }

  /**
   * Get current filters (readonly)
   */
  getFilters(): ReadonlyMap<string, Filter> {
    return this.filters
  }

  /**
   * Apply filters to dataset (AND between filters, OR within filter values)
   */
  applyFilters<T extends Record<string, any>>(data: T[]): T[] {
    if (this.filters.size === 0) return data

    return data.filter(row => {
      // AND logic between different filters
      for (const filter of this.filters.values()) {
        const cellValue = row[filter.column]

        // OR logic within filter values
        if (!filter.values.has(cellValue)) {
          return false  // Row doesn't match this filter
        }
      }
      return true  // Row matches all filters
    })
  }

  private notifyObservers(): void {
    this.observers.forEach(obs => obs.onFilterChange(this.filters))
  }
}
```

**Tests to Write**:

Create `src/managers/__tests__/FilterManager.test.ts`:

```typescript
import { FilterManager } from '../FilterManager'

describe('FilterManager', () => {
  let filterManager: FilterManager

  beforeEach(() => {
    filterManager = new FilterManager()
  })

  test('should notify observers when filter changes', () => {
    const observer = { onFilterChange: jest.fn() }
    filterManager.addObserver(observer)

    filterManager.setFilter('mode', 'mode', new Set(['car', 'bike']), 'categorical')

    expect(observer.onFilterChange).toHaveBeenCalledTimes(1)
  })

  test('should apply AND logic between different filters', () => {
    const data = [
      { mode: 'car', age: 25 },
      { mode: 'bike', age: 25 },
      { mode: 'car', age: 30 },
    ]

    filterManager.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    filterManager.setFilter('age', 'age', new Set([25]), 'categorical')

    const filtered = filterManager.applyFilters(data)
    expect(filtered).toEqual([{ mode: 'car', age: 25 }])
  })

  test('should apply OR logic within filter values', () => {
    const data = [
      { mode: 'car' },
      { mode: 'bike' },
      { mode: 'walk' },
    ]

    filterManager.setFilter('mode', 'mode', new Set(['car', 'bike']), 'categorical')

    const filtered = filterManager.applyFilters(data)
    expect(filtered).toHaveLength(2)
  })

  test('should toggle filter values', () => {
    filterManager.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    filterManager.toggleFilterValue('mode', 'bike')  // Add bike

    let filter = filterManager.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(true)

    filterManager.toggleFilterValue('mode', 'bike')  // Remove bike
    filter = filterManager.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(false)
  })
})
```

**Acceptance Criteria**:
- ✅ Observer pattern notifies cards of filter changes
- ✅ OR logic within filter values (Set-based)
- ✅ AND logic between different filters
- ✅ Toggle behavior adds/removes values
- ✅ Unit tests pass with >80% coverage

---

## TASK A2: Create LinkageManager

**Objective**: Implement map-to-table linkage coordination

**Context Files to Read**:
- `src/plugins/commuter-requests/RequestsMap.vue` (lines 400-500) - Hover and selection handling
- `src/plugins/commuter-requests/CommuterRequests.vue` (lines 600-700) - Selection state management

**Key Patterns to Extract**:
```typescript
// Multi-geometry linkage: Multiple map layers link to same table column
const hoveredFeatures = new Set<number>()  // Can be hovered in multiple layers
const selectedFeatures = new Set<number>() // Can be selected in multiple layers

// Bi-directional linking:
// Map click → filter table → update stats
// Table row click → highlight map feature
// Stats click → filter table → highlight map features
```

**Implementation**:

Create `src/managers/LinkageManager.ts`:

```typescript
export interface LinkageConfig {
  tableColumn: string           // Column in centralized table
  geoProperty: string          // Property in GeoJSON features
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

  /**
   * Register a component to receive linkage updates
   */
  addObserver(observer: LinkageObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: LinkageObserver): void {
    this.observers.delete(observer)
  }

  /**
   * Set hovered features (replaces existing)
   */
  setHoveredIds(ids: Set<any>): void {
    this.hoveredIds = new Set(ids)
    this.notifyHover()
  }

  /**
   * Set selected features (replaces existing)
   */
  setSelectedIds(ids: Set<any>): void {
    this.selectedIds = new Set(ids)
    this.notifySelection()
  }

  /**
   * Toggle selection for a set of IDs (for multi-select)
   */
  toggleSelectedIds(ids: Set<any>): void {
    const allSelected = Array.from(ids).every(id => this.selectedIds.has(id))

    if (allSelected) {
      // All selected: deselect all
      ids.forEach(id => this.selectedIds.delete(id))
    } else {
      // Some/none selected: select all
      ids.forEach(id => this.selectedIds.add(id))
    }

    this.notifySelection()
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedIds.clear()
    this.notifySelection()
  }

  /**
   * Get current state (readonly)
   */
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

**Tests to Write**:

Create `src/managers/__tests__/LinkageManager.test.ts`:

```typescript
import { LinkageManager } from '../LinkageManager'

describe('LinkageManager', () => {
  let linkageManager: LinkageManager

  beforeEach(() => {
    linkageManager = new LinkageManager()
  })

  test('should notify observers when hover changes', () => {
    const observer = {
      onHoveredIdsChange: jest.fn(),
      onSelectedIdsChange: jest.fn(),
    }
    linkageManager.addObserver(observer)

    linkageManager.setHoveredIds(new Set([1, 2, 3]))

    expect(observer.onHoveredIdsChange).toHaveBeenCalledTimes(1)
    expect(observer.onHoveredIdsChange).toHaveBeenCalledWith(new Set([1, 2, 3]))
  })

  test('should toggle selection (multi-select behavior)', () => {
    linkageManager.setSelectedIds(new Set([1, 2]))

    // Toggle with overlapping: should deselect
    linkageManager.toggleSelectedIds(new Set([1, 2]))
    expect(linkageManager.getSelectedIds().size).toBe(0)

    // Toggle with new: should select
    linkageManager.toggleSelectedIds(new Set([3, 4]))
    expect(linkageManager.getSelectedIds().size).toBe(2)
  })

  test('should clear all selections', () => {
    linkageManager.setSelectedIds(new Set([1, 2, 3]))
    linkageManager.clearSelection()

    expect(linkageManager.getSelectedIds().size).toBe(0)
  })
})
```

**Acceptance Criteria**:
- ✅ Observer pattern for hover/selection changes
- ✅ Multi-select toggle behavior (all selected → deselect all)
- ✅ Set-based storage (supports multiple layers)
- ✅ Unit tests pass with >80% coverage

---

## TASK A3: Create DataTableManager

**Objective**: Centralized data loading and state management

**Context Files to Read**:
- `src/plugins/commuter-requests/utils/dataLoader.ts` - CSV loading patterns
- `src/plugins/commuter-requests/CommuterRequests.vue` (lines 100-200) - Data initialization

**Implementation**:

Create `src/managers/DataTableManager.ts`:

```typescript
import Papa from 'papaparse'

export interface TableConfig {
  name: string
  dataset: string              // Path to CSV file
  idColumn: string             // Unique identifier column
  visible: boolean
  columns?: {
    hide?: string[]            // Columns to hide
    formats?: Record<string, any>  // Column formatting
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

  /**
   * Load CSV data from file
   */
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
          error: (error: any) => {
            reject(error)
          },
        })
      })
    })
  }

  /**
   * Get all data
   */
  getData(): DataRow[] {
    return this.data
  }

  /**
   * Get row by ID
   */
  getRowById(id: any): DataRow | undefined {
    return this.data.find(row => row[this.idColumn] === id)
  }

  /**
   * Get multiple rows by IDs
   */
  getRowsByIds(ids: Set<any>): DataRow[] {
    return this.data.filter(row => ids.has(row[this.idColumn]))
  }

  /**
   * Get column values (unique)
   */
  getColumnValues(column: string): any[] {
    return Array.from(new Set(this.data.map(row => row[column])))
  }

  /**
   * Get table configuration
   */
  getConfig(): TableConfig {
    return this.config
  }
}
```

**Tests to Write**:

Create `src/managers/__tests__/DataTableManager.test.ts`:

```typescript
import { DataTableManager } from '../DataTableManager'

describe('DataTableManager', () => {
  const mockConfig = {
    name: 'Test Table',
    dataset: 'test.csv',
    idColumn: 'id',
    visible: true,
  }

  let manager: DataTableManager

  beforeEach(() => {
    manager = new DataTableManager(mockConfig)
  })

  test('should get row by ID', () => {
    // Mock data
    ;(manager as any).data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]

    const row = manager.getRowById(2)
    expect(row).toEqual({ id: 2, name: 'Bob' })
  })

  test('should get multiple rows by IDs', () => {
    ;(manager as any).data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]

    const rows = manager.getRowsByIds(new Set([1, 3]))
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.name)).toEqual(['Alice', 'Charlie'])
  })

  test('should get unique column values', () => {
    ;(manager as any).data = [
      { mode: 'car' },
      { mode: 'bike' },
      { mode: 'car' },
    ]

    const values = manager.getColumnValues('mode')
    expect(values).toEqual(['car', 'bike'])
  })
})
```

**Acceptance Criteria**:
- ✅ Loads CSV data with Papa Parse
- ✅ Provides row lookup by ID
- ✅ Provides batch lookup by ID set
- ✅ Unit tests pass

---

# BATCH B: Card Infrastructure

**Summary**: Create wrapper components that add coordination to existing SimWrapper cards
**Effort**: Medium | **Dependencies**: Batch A (managers)
**Output**: Reusable wrapper components

---

## TASK B1: Create LinkableCardWrapper

**Objective**: Generic wrapper that adds FilterManager/LinkageManager to any card

**Context Files to Read**:
- `src/layout-manager/DashBoard.vue` - How SimWrapper renders cards
- `docs/UNIFIED_YAML_FORMAT.md` - Card linkage configuration

**Implementation**:

Create `src/components/interactive/LinkableCardWrapper.vue`:

```vue
<template>
  <div class="linkable-card-wrapper">
    <slot
      :filtered-data="filteredData"
      :hovered-ids="hoveredIds"
      :selected-ids="selectedIds"
      :on-hover="handleHover"
      :on-select="handleSelect"
      :on-filter="handleFilter"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { FilterManager, FilterObserver } from '@/managers/FilterManager'
import type { LinkageManager, LinkageObserver } from '@/managers/LinkageManager'
import type { DataTableManager } from '@/managers/DataTableManager'

interface Props {
  cardConfig: any
  filterManager: FilterManager
  linkageManager: LinkageManager
  dataTableManager: DataTableManager
}

const props = defineProps<Props>()

// Local state
const hoveredIds = ref<Set<any>>(new Set())
const selectedIds = ref<Set<any>>(new Set())
const filteredData = ref<any[]>([])

// Observer implementation
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

// Handlers passed to child card
const handleHover = (ids: Set<any>) => {
  props.linkageManager.setHoveredIds(ids)
}

const handleSelect = (ids: Set<any>) => {
  if (props.cardConfig.linkage?.behavior === 'toggle') {
    props.linkageManager.toggleSelectedIds(ids)
  } else {
    props.linkageManager.setSelectedIds(ids)
  }
}

const handleFilter = (filterId: string, column: string, values: Set<any>) => {
  props.filterManager.setFilter(filterId, column, values, 'categorical')
}

// Update filtered data
const updateFilteredData = () => {
  const allData = props.dataTableManager.getData()
  filteredData.value = props.filterManager.applyFilters(allData)
}

// Lifecycle
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

**Acceptance Criteria**:
- ✅ Wraps any child card component
- ✅ Provides filtered data, hover/selection state via slots
- ✅ Connects to managers via observer pattern
- ✅ Passes interaction handlers to child

---

## TASK B2: Enhance Dashboard Loader

**Objective**: Detect `table` section and initialize coordination layer

**Context Files to Read**:
- `src/layout-manager/DashBoard.vue` - Current dashboard loading
- Search codebase for dashboard YAML loading (`grep -r "loadYaml\|parseYaml" src/`)

**Implementation Steps**:

1. Find where dashboards are loaded from YAML
2. Add detection logic:

```typescript
import { FilterManager } from '@/managers/FilterManager'
import { LinkageManager } from '@/managers/LinkageManager'
import { DataTableManager } from '@/managers/DataTableManager'

interface DashboardConfig {
  title: string
  table?: {
    name: string
    dataset: string
    idColumn: string
    // ...
  }
  layout: any
}

async function loadDashboard(config: DashboardConfig, fileService: any, subfolder: string) {
  if (config.table) {
    // Interactive mode: Initialize coordination layer
    const filterManager = new FilterManager()
    const linkageManager = new LinkageManager()
    const dataTableManager = new DataTableManager(config.table)

    // Load centralized data
    await dataTableManager.loadData(fileService, subfolder)

    return {
      mode: 'interactive',
      config,
      filterManager,
      linkageManager,
      dataTableManager,
    }
  } else {
    // Legacy mode: Standard SimWrapper dashboard
    return {
      mode: 'legacy',
      config,
    }
  }
}
```

3. Update card rendering to wrap cards when in interactive mode:

```typescript
function renderCard(card: any, dashboardState: any) {
  if (dashboardState.mode === 'interactive' && card.linkage) {
    return (
      <LinkableCardWrapper
        card={card}
        filterManager={dashboardState.filterManager}
        linkageManager={dashboardState.linkageManager}
        dataTableManager={dashboardState.dataTableManager}
      >
        <CardComponent {...card} />
      </LinkableCardWrapper>
    )
  } else {
    return <CardComponent {...card} />
  }
}
```

**Tests to Write**:

```typescript
describe('Dashboard Loader', () => {
  test('should detect interactive mode when table present', async () => {
    const config = {
      title: 'Test',
      table: {
        dataset: 'data.csv',
        idColumn: 'id',
      },
      layout: {},
    }

    const result = await loadDashboard(config, mockFileService, '/')
    expect(result.mode).toBe('interactive')
    expect(result.filterManager).toBeDefined()
  })

  test('should use legacy mode when no table', async () => {
    const config = {
      title: 'Test',
      layout: {},
    }

    const result = await loadDashboard(config, mockFileService, '/')
    expect(result.mode).toBe('legacy')
  })
})
```

**Acceptance Criteria**:
- ✅ Detects `table` section presence
- ✅ Initializes managers in interactive mode
- ✅ Loads centralized data table
- ✅ Legacy dashboards work unchanged
- ✅ Tests verify both modes

---

# BATCH C: Interactive Card Types

**Summary**: Create new card types (histogram, pie-chart) with linkage support
**Effort**: Large | **Dependencies**: Batch A, B
**Output**: Clickable stat card components

---

## TASK C1: Create Histogram Card

**Objective**: Histogram card that acts as clickable filter

**Context Files to Read**:
- `src/plugins/commuter-requests/components/stats/ActiveTimeHistogramPlotly.vue` - Histogram implementation
- Lines 150-300: Plotly configuration
- Lines 350-400: Click handler with OR-logic toggle

**Key Patterns**:
```typescript
// OR-logic multi-select: Click bin toggles it in filter
const onHistogramClick = (bin: number) => {
  if (selectedBins.has(bin)) {
    selectedBins.delete(bin)  // Deselect
  } else {
    selectedBins.add(bin)      // Select
  }
  // Emit filter with all selected bins
  emit('filter', 'histogram-column', selectedBins)
}
```

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
  filteredData: any[]        // From LinkableCardWrapper
  selectedIds?: Set<any>     // From LinkableCardWrapper
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

// Compute histogram data
const histogramData = computed(() => {
  const values = props.filteredData.map(row => row[props.column])
  const binSize = props.binSize || 1

  // Create bins
  const bins = new Map<number, number>()
  values.forEach(val => {
    const bin = Math.floor(val / binSize) * binSize
    bins.set(bin, (bins.get(bin) || 0) + 1)
  })

  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({ bin, count }))
})

// Render Plotly chart
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

  // Add click handler
  plotContainer.value.on('plotly_click', (data: any) => {
    const bin = data.points[0].x

    // Toggle bin in selection
    if (selectedBins.value.has(bin)) {
      selectedBins.value.delete(bin)
    } else {
      selectedBins.value.add(bin)
    }

    // Emit filter with all selected bins
    if (props.linkage?.type === 'filter') {
      const filterId = `histogram-${props.column}`
      emit('filter', filterId, props.column, new Set(selectedBins.value))
    }

    renderChart()  // Re-render with new selection
  })
}

// Watch for data changes
watch(() => props.filteredData, renderChart, { deep: true })
watch(() => props.selectedIds, renderChart)

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

**Acceptance Criteria**:
- ✅ Renders histogram with Plotly
- ✅ Bins data based on binSize config
- ✅ Click toggles bin selection (OR logic)
- ✅ Emits filter event with selected bins
- ✅ Visual feedback for selected bins (color change)

---

## TASK C2: Create Pie Chart Card

**Objective**: Pie chart card that acts as clickable filter

**Context Files to Read**:
- `src/plugins/commuter-requests/components/stats/MainModePieChartPlotly.vue`

**Implementation**: Similar to histogram but for categorical data

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
  selectedIds?: Set<any>
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

// Compute pie data
const pieData = computed(() => {
  const counts = new Map<string, number>()
  props.filteredData.forEach(row => {
    const val = row[props.column]
    counts.set(val, (counts.get(val) || 0) + 1)
  })

  return Array.from(counts.entries()).map(([label, value]) => ({
    label,
    value,
  }))
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

  Plotly.newPlot(plotContainer.value, [trace], {
    title: props.title,
    margin: { t: 40, b: 20, l: 20, r: 20 },
  }, {
    displayModeBar: false,
    responsive: true,
  })

  // Add click handler
  plotContainer.value.on('plotly_click', (data: any) => {
    const category = data.points[0].label

    // Toggle category
    if (selectedCategories.value.has(category)) {
      selectedCategories.value.delete(category)
    } else {
      selectedCategories.value.add(category)
    }

    // Emit filter
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

**Acceptance Criteria**:
- ✅ Renders pie chart with Plotly
- ✅ Click toggles category selection
- ✅ Emits filter event
- ✅ Visual feedback for selected categories

---

## TASK C3: Register New Card Types

**Objective**: Register histogram and pie-chart as card types in SimWrapper

**Context Files to Search**:
- Search for card type registry: `grep -r "cardTypes\|registerCard" src/`
- Find where 'map', 'vega', 'table' are registered

**Implementation**:

In card type registry (location TBD from search):

```typescript
import HistogramCard from '@/components/interactive/HistogramCard.vue'
import PieChartCard from '@/components/interactive/PieChartCard.vue'

// Register new card types
cardRegistry.register('histogram', HistogramCard)
cardRegistry.register('pie-chart', PieChartCard)
```

**Acceptance Criteria**:
- ✅ histogram and pie-chart types available in YAML
- ✅ Cards render when specified in layout
- ✅ No breaking changes to existing card types

---

# BATCH D: Dashboard Integration

**Summary**: Wire everything together and create example dashboard
**Effort**: Medium | **Dependencies**: All previous batches
**Output**: Fully functional interactive dashboard system

---

## TASK D1: Create Example Dashboard YAML

**Objective**: Create a working example to validate the system

**Implementation**:

Create `public/example-data/dashboard-interactive-example.yaml`:

```yaml
title: "Interactive Dashboard Example"
description: "Demonstrates the unified format with interactive coordination"

# Centralized data table (triggers interactive mode)
table:
  name: "Sample Data"
  dataset: sample-data.csv
  idColumn: id
  visible: true
  columns:
    formats:
      timestamp: { type: time, unit: "HH:mm" }
      value: { type: number, decimals: 1 }

# Layout with interactive cards
layout:
  row1:
    - type: map
      title: "Geographic View"
      width: 2
      height: 8
      center: [13.4, 52.5]
      zoom: 10
      layers:
        - name: points
          file: points.geojson
          type: point
          visible: true
          linkage:
            tableColumn: id
            geoProperty: id
            onHover: highlight
            onSelect: filter

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

    - type: pie-chart
      title: "Category Share"
      column: category
      width: 1
      height: 4
      linkage:
        type: filter
        column: category
        behavior: toggle

  row2:
    - type: table
      title: "Data Table"
      width: 3
      height: 6
      source: table
```

Create sample data files:
- `public/example-data/sample-data.csv`
- `public/example-data/points.geojson`

**Acceptance Criteria**:
- ✅ Dashboard loads without errors
- ✅ All cards render correctly
- ✅ Clicking histogram filters table and map
- ✅ Clicking pie chart filters table and map
- ✅ Map selections filter table
- ✅ All interactions synchronized

---

## TASK D2: Update Documentation

**Objective**: Document the new card types and linkage system

**Implementation**:

Update `docs/UNIFIED_YAML_FORMAT.md` with:
- Card type reference (histogram, pie-chart)
- Linkage configuration options
- Complete working examples

Create `docs/CARD_TYPES_REFERENCE.md`:

```markdown
# Interactive Card Types Reference

## histogram

Displays a histogram with clickable bins for filtering.

### Configuration

\`\`\`yaml
type: histogram
title: "Distribution"
column: value              # Column to bin
binSize: 10                # Bin width
width: 1
height: 4
linkage:
  type: filter
  column: value
  behavior: toggle         # Click toggles bin selection
\`\`\`

### Behavior

- Click a bin to toggle selection
- Multiple bins can be selected (OR logic)
- Selected bins shown in different color
- Emits filter event to FilterManager

## pie-chart

Displays a pie chart with clickable slices for filtering.

### Configuration

\`\`\`yaml
type: pie-chart
title: "Category Share"
column: category           # Categorical column
width: 1
height: 4
linkage:
  type: filter
  column: category
  behavior: toggle
\`\`\`

### Behavior

- Click a slice to toggle selection
- Multiple slices can be selected (OR logic)
- Selected slices shown in different color
- Emits filter event to FilterManager
```

**Acceptance Criteria**:
- ✅ All card types documented
- ✅ Linkage options explained
- ✅ Working examples provided

---

# BATCH E: Validation & Testing

**Summary**: Re-implement commuter-requests and comprehensive testing
**Effort**: Large | **Dependencies**: All previous batches
**Output**: Validated system with proven feature parity

---

## TASK E1: Re-implement Commuter Requests Dashboard

**Objective**: Create `dashboard-commuter-requests-interactive.yaml` that recreates current plugin

**Context Files to Read**:
- `src/plugins/commuter-requests/CommuterRequests.vue` - Full component
- `src/plugins/commuter-requests/CommuterRequestsConfig.ts` - Configuration types
- All component files in `src/plugins/commuter-requests/components/`

**Expected YAML** (complete recreation):

```yaml
title: "Commuter Requests Dashboard"
description: "Interactive analysis of commuter travel requests (unified format)"

table:
  name: "Requests"
  dataset: commuter_requests.csv
  idColumn: request_id
  visible: true
  columns:
    hide: [pax_id, origin, destination]
    formats:
      treq: { type: time, unit: "HH:mm" }
      travel_time: { type: duration, unit: "min", convertFrom: seconds }
      distance: { type: number, decimals: 1, unit: "km" }

layout:
  row1:
    # Map (left side, 2/3 width)
    - type: map
      title: "Request Map"
      width: 2
      height: 12
      center: [13.391, 52.515]
      zoom: 10
      layers:
        - name: cluster_boundaries
          file: cluster_boundaries.geojson
          type: polygon
          visible: true
          fillOpacity: 0.2
          lineOpacity: 1.0
          linkage:
            tableColumn: cluster_id
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter

        - name: request_origins
          file: request_origins.geojson
          type: point
          visible: true
          radius: 5
          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight
            onSelect: filter

        - name: request_flows
          file: request_flows.geojson
          type: arc
          visible: false
          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight

    # Stats column (right side, 1/3 width)
    - type: histogram
      title: "Active Time Distribution"
      column: treq
      binSize: 900                        # 15-minute bins
      width: 1
      height: 6
      linkage:
        type: filter
        column: treq
        behavior: toggle

    - type: pie-chart
      title: "Main Mode Share"
      column: main_mode
      width: 1
      height: 6
      linkage:
        type: filter
        column: main_mode
        behavior: toggle

  row2:
    # Table (full width)
    - type: table
      title: "Requests"
      width: 3
      height: 8
      source: table
      features:
        - export
        - search
        - sort
        - pagination
```

**Validation Checklist** (20 points):

1. ✅ Dashboard loads without errors
2. ✅ Map displays all three layer types (polygon, point, arc)
3. ✅ Histogram shows time distribution with 15-min bins
4. ✅ Pie chart shows mode share
5. ✅ Table displays all requests with formatted columns
6. ✅ Clicking histogram bin filters table and map
7. ✅ Multiple histogram bins can be selected (OR logic)
8. ✅ Clicking pie slice filters table and map
9. ✅ Multiple pie slices can be selected (OR logic)
10. ✅ Clicking map feature filters table
11. ✅ Multi-select on map works (overlapping geometries)
12. ✅ Hover on map highlights table rows
13. ✅ Hover on table highlights map features
14. ✅ Filters combine with AND logic between types
15. ✅ Clear all filters button works
16. ✅ Comparison mode available (filtered vs baseline)
17. ✅ Layer visibility controls work
18. ✅ Export functionality works
19. ✅ Visual appearance matches current plugin
20. ✅ Performance is comparable (no lag)

**Side-by-side Comparison**:

Create test procedure to run both versions:
1. Open current plugin: `/commuter-requests`
2. Open new dashboard: `/dashboard-commuter-requests-interactive`
3. Perform identical interactions on both
4. Verify identical behavior

**Acceptance Criteria**:
- ✅ All 20 validation points pass
- ✅ Side-by-side comparison confirms feature parity
- ✅ Performance is acceptable
- ✅ No regression in functionality

---

## TASK E2: Comprehensive Testing

**Objective**: End-to-end tests for interactive dashboard system

**Implementation**:

Create `tests/e2e/interactive-dashboard.test.ts`:

```typescript
describe('Interactive Dashboard System', () => {
  describe('Legacy Mode', () => {
    test('should render legacy dashboard without table section', () => {
      // Load dashboard without table
      // Verify cards render
      // Verify no coordination layer initialized
    })

    test('should not break existing dashboards', () => {
      // Test with real legacy dashboard YAMLs
      // Verify they still work
    })
  })

  describe('Interactive Mode', () => {
    test('should initialize coordination layer when table present', () => {
      // Load dashboard with table section
      // Verify FilterManager initialized
      // Verify LinkageManager initialized
      // Verify DataTableManager loaded data
    })

    test('should coordinate filtering across cards', () => {
      // Click histogram bin
      // Verify table filtered
      // Verify map filtered
      // Verify stats updated
    })

    test('should handle multi-select with OR logic', () => {
      // Select multiple histogram bins
      // Verify table shows rows matching ANY bin
      // Add pie chart selection
      // Verify AND logic between filter types
    })

    test('should handle map-to-table linkage', () => {
      // Click map feature
      // Verify table row highlighted
      // Verify stats updated
    })

    test('should handle hover coordination', () => {
      // Hover over map feature
      // Verify table row highlighted
      // Hover over table row
      // Verify map feature highlighted
    })
  })

  describe('Performance', () => {
    test('should handle large datasets (10k+ rows)', () => {
      // Load large dataset
      // Perform filtering
      // Measure response time < 100ms
    })
  })
})
```

**Acceptance Criteria**:
- ✅ All tests pass
- ✅ >80% code coverage for managers
- ✅ E2E tests verify both modes
- ✅ Performance tests pass

---

## Summary of Batches

| Batch | Tasks | Effort | Dependencies | Output |
|-------|-------|--------|--------------|--------|
| **A** | 3 | Medium | None | Core managers (Filter, Linkage, DataTable) |
| **B** | 2 | Medium | Batch A | Card wrapper + dashboard loader |
| **C** | 3 | Large | Batch A, B | Interactive card types (histogram, pie) |
| **D** | 2 | Medium | All previous | Integration + example dashboard |
| **E** | 2 | Large | All previous | Validation + testing |

**Total**: 12 tasks across 5 batches

---

## Development Sequence

**Recommended order for coding agents**:

1. **Start with Batch A** (Core Managers) - Foundation layer
2. **Then Batch B** (Card Infrastructure) - Wiring layer
3. **Then Batch C** (Card Types) - UI layer
4. **Then Batch D** (Integration) - Assembly
5. **Finally Batch E** (Validation) - Proof

**Parallel Development**:
- Batches A1, A2, A3 can run in parallel (independent managers)
- Batches C1, C2, C3 can run in parallel after B is done
- Batches D1, D2 can run in parallel after C is done

**Estimated Timeline**:
- Batch A: 2-3 days
- Batch B: 2-3 days
- Batch C: 3-4 days
- Batch D: 1-2 days
- Batch E: 3-4 days

**Total**: ~11-16 days with sequential development, ~7-10 days with parallel agents

---

## Notes for Coding Agents

Each task includes:
- ✅ **Objective**: Clear goal
- ✅ **Context**: Files to read for patterns
- ✅ **Implementation**: Code examples and structure
- ✅ **Tests**: Verification criteria
- ✅ **Acceptance**: Definition of done

**Important**:
- Read context files to understand existing patterns
- Preserve multi-select and Set-based tracking from commuter-requests
- Maintain observer pattern for loose coupling
- Write tests as you implement (TDD encouraged)
- Verify backward compatibility at each step
