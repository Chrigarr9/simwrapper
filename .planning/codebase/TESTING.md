# Testing Patterns

**Analysis Date:** 2026-01-19

## Test Framework

**Runner:**
- Vitest 4.x (configured inline in `vite.config.mts`)
- E2E: Playwright 1.56+

**Assertion Library:**
- Vitest built-in (`expect`)
- `@vue/test-utils` for component mounting

**Run Commands:**
```bash
npm run test:run          # Run all unit tests (vitest)
npm run test:ui           # Run tests with Vitest UI
npm run test              # Run E2E tests (playwright)
```

## Test File Organization

**Location:**
- Unit tests: Co-located in `__tests__/` directories adjacent to source
- E2E tests: Separate in `tests/e2e/`
- Legacy unit tests: `tests/unit/`

**Naming:**
- Unit tests: `{SourceFileName}.test.ts`
- E2E tests: `{feature-name}.spec.ts`
- Legacy: `{ComponentName}.spec.ts`

**Structure:**
```
src/plugins/interactive-dashboard/
├── managers/
│   ├── FilterManager.ts
│   ├── LinkageManager.ts
│   ├── DataTableManager.ts
│   └── __tests__/
│       ├── FilterManager.test.ts
│       ├── LinkageManager.test.ts
│       └── DataTableManager.test.ts
├── components/cards/
│   ├── MapCard.vue
│   └── __tests__/
│       └── MapCard.test.ts

tests/
├── e2e/
│   ├── atlantis.spec.ts
│   ├── flow-map.spec.ts
│   └── ... (plugin-specific E2E tests)
└── unit/
    ├── tile.test.ts
    └── BlankComponent.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, test, expect, beforeEach, vi } from 'vitest'
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

  test('notifies observers on filter change', () => {
    const observer = { onFilterChange: vi.fn() }
    fm.addObserver(observer)

    fm.setFilter('test', 'col', new Set([1]), 'categorical')
    expect(observer.onFilterChange).toHaveBeenCalled()
  })
})
```

**Patterns:**
- Use `describe()` blocks to group related tests
- Use `beforeEach()` for common setup (create fresh instance)
- Use descriptive test names that explain the behavior being tested
- Prefer `test()` over `it()` (both work, project uses both)

## Mocking

**Framework:** Vitest `vi` module

**Patterns:**
```typescript
import { vi } from 'vitest'

// Mock functions
const observer = {
  onFilterChange: vi.fn(),
  onHoveredIdsChange: vi.fn(),
  onSelectedIdsChange: vi.fn(),
}

// Verify mock was called
expect(observer.onFilterChange).toHaveBeenCalled()
expect(observer.onHoveredIdsChange).toHaveBeenCalledWith(new Set([1, 2, 3]))
expect(observer.onFilterChange).not.toHaveBeenCalled()

// Mock async functions
const mockFileService = {
  fetchFileAsBlob: vi.fn().mockResolvedValue(blob),
  getFileBlob: vi.fn().mockRejectedValue(new Error('File not found')),
}

// Global mocks (for fetch, etc.)
global.fetch = vi.fn().mockResolvedValue({
  status: 200,
  text: () => Promise.resolve(csvText),
  blob: () => Promise.resolve(blob),
})
```

**What to Mock:**
- External services (file system, network)
- Observer callbacks
- Browser APIs not available in jsdom

**What NOT to Mock:**
- The class/component being tested
- Pure functions with no side effects
- Internal logic of the unit under test

## Fixtures and Factories

**Test Data:**
```typescript
// Inline test data for simple cases
const mockConfig = {
  name: 'Test',
  dataset: 'test.csv',
  idColumn: 'id',
  visible: true,
}

const data = [
  { id: 1, name: 'Alice', mode: 'car' },
  { id: 2, name: 'Bob', mode: 'bike' },
  { id: 3, name: 'Charlie', mode: 'car' },
]

// CSV text for loading tests
const csvData = 'id,name,mode\n1,Alice,car\n2,Bob,bike'
const blob = new Blob([csvData], { type: 'text/csv' })

// Direct data injection for bypassing file loading
beforeEach(() => {
  dtm = new DataTableManager(mockConfig)
  // Directly set data for testing (skip actual file loading)
  ;(dtm as any).data = data
})
```

**Location:**
- Inline in test files for small datasets
- For larger fixtures, consider `__fixtures__/` directory (not currently used)

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
```bash
npm run test:run -- --coverage
```

**Coverage Tool:** `@vitest/coverage-v8` (installed in devDependencies)

## Test Types

**Unit Tests:**
- Test individual classes and functions in isolation
- Focus on manager classes: `FilterManager`, `LinkageManager`, `DataTableManager`
- Test observer pattern: add/remove observers, notification on state change
- Test data filtering logic: AND/OR logic, toggle behavior

**Integration Tests:**
- Component mounting with `@vue/test-utils`
- Test component props interface
- Test event emission

**E2E Tests:**
- Playwright-based
- Test full plugin visualization workflows
- Located in `tests/e2e/`
- Use `page.goto()`, `page.waitForSelector()`, assertions on DOM state

## Common Patterns

**Async Testing:**
```typescript
test('loads data from CSV file', async () => {
  const newDtm = new DataTableManager(mockConfig)
  const csvData = 'id,name,mode\n1,Alice,car\n2,Bob,bike'
  const blob = new Blob([csvData], { type: 'text/csv' })

  const mockFileService = {
    fetchFileAsBlob: vi.fn().mockResolvedValue(blob),
  }

  await newDtm.loadData(mockFileService, '/data')

  expect(mockFileService.fetchFileAsBlob).toHaveBeenCalledWith('/data/test.csv')
  expect(newDtm.getData()).toHaveLength(2)
})

test('rejects on file service error', async () => {
  const mockFileService = {
    fetchFileAsBlob: vi.fn().mockRejectedValue(new Error('File not found')),
  }

  await expect(newDtm.loadData(mockFileService, '/data')).rejects.toThrow('File not found')
})
```

**Error Testing:**
```typescript
test('rejects on file service error', async () => {
  const mockFileService = {
    fetchFileAsBlob: vi.fn().mockRejectedValue(new Error('File not found')),
  }

  await expect(newDtm.loadData(mockFileService, '/data')).rejects.toThrow('File not found')
})
```

**Component Mounting:**
```typescript
import { mount } from '@vue/test-utils'
import MapCard from '../MapCard.vue'

describe('MapCard.vue', () => {
  let props: any

  beforeEach(() => {
    props = {
      filteredData: [],
      hoveredIds: new Set(),
      selectedIds: new Set(),
      center: [11.57, 48.14],
      zoom: 10,
      layers: [],
    }
  })

  it('renders without errors', () => {
    const wrapper = mount(MapCard, { props })
    expect(wrapper.exists()).toBe(true)
  })

  it('displays title when provided', () => {
    props.title = 'Test Map'
    const wrapper = mount(MapCard, { props })
    expect(wrapper.text()).toContain('Test Map')
  })

  it('shows loading state initially', () => {
    const wrapper = mount(MapCard, { props })
    expect(wrapper.find('.loading-overlay').exists()).toBe(true)
  })
})
```

**Testing Immutability (Preventing External Mutations):**
```typescript
test('creates new Set instances to prevent external mutations', () => {
  const ids = new Set([1, 2])
  lm.setSelectedIds(ids)

  ids.add(3)  // Mutate original

  // LinkageManager should not be affected
  expect(lm.getSelectedIds().size).toBe(2)
})
```

## Interactive Dashboard Test Patterns

### Testing FilterManager

```typescript
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

  test('toggles filter values', () => {
    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.toggleFilterValue('mode', 'bike')

    let filter = fm.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(true)

    fm.toggleFilterValue('mode', 'bike')
    filter = fm.getFilters().get('mode')
    expect(filter?.values.has('bike')).toBe(false)
  })

  test('removes filter when all values toggled off', () => {
    fm.setFilter('mode', 'mode', new Set(['car']), 'categorical')
    fm.toggleFilterValue('mode', 'car')

    expect(fm.getFilters().size).toBe(0)
  })
})
```

### Testing LinkageManager

```typescript
describe('LinkageManager', () => {
  let lm: LinkageManager

  beforeEach(() => {
    lm = new LinkageManager()
  })

  test('notifies observers on hover change', () => {
    const observer = {
      onHoveredIdsChange: vi.fn(),
      onSelectedIdsChange: vi.fn(),
    }
    lm.addObserver(observer)

    lm.setHoveredIds(new Set([1, 2, 3]))
    expect(observer.onHoveredIdsChange).toHaveBeenCalledWith(new Set([1, 2, 3]))
  })

  test('toggles selection - deselects all when all selected', () => {
    lm.setSelectedIds(new Set([1, 2]))
    lm.toggleSelectedIds(new Set([1, 2]))
    expect(lm.getSelectedIds().size).toBe(0)
  })

  test('toggles selection - selects all when partially selected', () => {
    lm.setSelectedIds(new Set([1]))
    lm.toggleSelectedIds(new Set([1, 2]))
    expect(lm.getSelectedIds().size).toBe(2)
  })

  test('removes observer', () => {
    const observer = {
      onHoveredIdsChange: vi.fn(),
      onSelectedIdsChange: vi.fn(),
    }
    lm.addObserver(observer)
    lm.removeObserver(observer)

    lm.setHoveredIds(new Set([1]))
    expect(observer.onHoveredIdsChange).not.toHaveBeenCalled()
  })
})
```

### Testing DataTableManager

```typescript
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

  test('returns undefined for non-existent ID', () => {
    const row = dtm.getRowById(999)
    expect(row).toBeUndefined()
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

## Test Configuration

**Vitest Config (in `vite.config.mts`):**
```typescript
test: {
  globals: true,        // Use global test functions (no imports needed)
  environment: 'jsdom', // DOM environment for Vue components
},
```

**TypeScript Config (in `tsconfig.json`):**
```json
{
  "compilerOptions": {
    "types": ["vite/client", "@types/jest", "vitest/globals"]
  }
}
```

## Current Test Coverage

**Well-Tested Areas:**
- `FilterManager` - Filter logic, observer pattern, toggle behavior
- `LinkageManager` - Hover/select state, observer pattern, toggle behavior
- `DataTableManager` - Data access, ID lookups, file loading

**Needs More Tests (TODO markers in MapCard.test.ts):**
- Layer creation
- Color management
- Event emission
- State-based styling
- Legend rendering

---

*Testing analysis: 2026-01-19*
