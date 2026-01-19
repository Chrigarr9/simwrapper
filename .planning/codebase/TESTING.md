# Testing Patterns

**Analysis Date:** 2026-01-19

## Test Framework

**Runner:**
- Vitest (unit tests) - `vitest@^4.0.12`
- Playwright (E2E tests) - `@playwright/test@^1.56.1`
- Config: `vite.config.mts` (vitest), `playwright.config.ts` (E2E)

**Assertion Library:**
- Vitest built-in assertions (`expect`)
- Playwright assertions for E2E

**Run Commands:**
```bash
npm run test:run          # Run vitest unit tests once
npm run test:ui           # Run vitest with interactive UI
npm run test              # Run Playwright E2E tests
```

## Test File Organization

**Location:**
- Unit tests: `src/**/__tests__/*.test.ts` (co-located with source)
- Legacy unit tests: `tests/unit/*.test.ts` and `tests/unit/*.spec.ts`
- E2E tests: `tests/e2e/*.spec.ts`

**Naming:**
- Unit tests: `*.test.ts` (newer pattern) or `*.spec.ts` (older pattern)
- E2E tests: `*.spec.ts`

**Structure:**
```
src/
├── plugins/
│   └── interactive-dashboard/
│       ├── managers/
│       │   ├── FilterManager.ts
│       │   └── __tests__/
│       │       └── FilterManager.test.ts
│       └── components/
│           └── cards/
│               └── __tests__/
│                   └── MapCard.test.ts
tests/
├── e2e/
│   ├── atlantis.spec.ts
│   ├── carrier-viewer.spec.ts
│   └── ...
└── unit/
    ├── BlankComponent.spec.ts
    └── tile.test.ts
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
- `describe()` blocks for grouping related tests
- `beforeEach()` for test setup/reset
- `test()` or `it()` for individual test cases
- Single assertion per test when possible
- Descriptive test names explaining expected behavior

## Mocking

**Framework:** Vitest `vi` utilities

**Patterns:**
```typescript
import { vi } from 'vitest'

// Mock function
const observer = { onFilterChange: vi.fn() }
fm.addObserver(observer)
expect(observer.onFilterChange).toHaveBeenCalled()

// Mock resolved value
const mockFileService = {
  fetchFileAsBlob: vi.fn().mockResolvedValue(blob),
}

// Mock rejected value
const mockFileService = {
  fetchFileAsBlob: vi.fn().mockRejectedValue(new Error('File not found')),
}

// Global fetch mock
global.fetch = vi.fn().mockResolvedValue({
  status: 200,
  text: () => new Promise(resolve => { resolve(csvText) }),
  blob: () => new Promise(resolve => { resolve(blob) }),
})
```

**What to Mock:**
- External API calls (fetch)
- File system operations
- Service dependencies passed via props/injection
- Browser APIs not available in jsdom

**What NOT to Mock:**
- Core class logic being tested
- Simple utility functions
- Internal state management

## Fixtures and Factories

**Test Data:**
```typescript
// Inline test data
const data = [
  { id: 1, name: 'Alice', mode: 'car' },
  { id: 2, name: 'Bob', mode: 'bike' },
  { id: 3, name: 'Charlie', mode: 'car' },
]

// Mock config objects
const mockConfig = {
  name: 'Test',
  dataset: 'test.csv',
  idColumn: 'id',
  visible: true,
}

// CSV content as string
const csvData = 'id,name,mode\n1,Alice,car\n2,Bob,bike'
const blob = new Blob([csvData], { type: 'text/csv' })
```

**Location:**
- Fixtures defined inline within test files
- Complex fixtures imported from shared test utilities when needed

## Coverage

**Requirements:** None enforced

**Coverage tool:** `@vitest/coverage-v8`

**View Coverage:**
```bash
# Coverage is generated in ./coverage directory
# Open ./coverage/index.html in browser
```

## Test Types

**Unit Tests:**
- Manager classes (`FilterManager`, `DataTableManager`, `LinkageManager`)
- Utility functions
- Focus on business logic, not Vue component rendering
- Located in `__tests__/` directories next to source

**Component Tests:**
- Vue component mounting with `@vue/test-utils`
- Props validation and basic rendering
- Limited in scope (WebGL components difficult to test)

**E2E Tests:**
- Playwright browser automation
- Full page loads and interactions
- Canvas/WebGL visualization validation
- Cross-browser testing (Chromium, Firefox, WebKit)

## E2E Test Patterns

**Structure:**
```typescript
import { test, expect } from '@playwright/test'

test('atlantis network loads', async ({ page }) => {
  page.on('dialog', async dialog => {
    await dialog.dismiss()
  })

  await page.goto('e2e-tests/atlantis/minibus/input/network.xml')
  await page.waitForSelector('canvas')
  await expect(page.locator('canvas')).toBeVisible()
})
```

**Configuration (`playwright.config.ts`):**
- Test directory: `./tests/e2e`
- Base URL: `http://localhost:5173/`
- Dev server: Auto-started via `npm run dev`
- Browsers: Chromium, Firefox, WebKit
- Device emulation: Desktop Chrome, Pixel 5, iPad Pro
- Timeouts: 60s for actions and navigation

## Common Patterns

**Async Testing:**
```typescript
test('loads data from CSV file', async () => {
  const newDtm = new DataTableManager(mockConfig)
  const blob = new Blob([csvData], { type: 'text/csv' })

  const mockFileService = {
    fetchFileAsBlob: vi.fn().mockResolvedValue(blob),
  }

  await newDtm.loadData(mockFileService, '/data')

  expect(mockFileService.fetchFileAsBlob).toHaveBeenCalledWith('/data/test.csv')
  expect(newDtm.getData()).toHaveLength(2)
})
```

**Error Testing:**
```typescript
test('rejects on file service error', async () => {
  const newDtm = new DataTableManager(mockConfig)
  const mockFileService = {
    fetchFileAsBlob: vi.fn().mockRejectedValue(new Error('File not found')),
  }

  await expect(newDtm.loadData(mockFileService, '/data')).rejects.toThrow('File not found')
})
```

**Observer/Callback Testing:**
```typescript
test('notifies observers on selection change', () => {
  const observer = {
    onHoveredIdsChange: vi.fn(),
    onSelectedIdsChange: vi.fn(),
  }
  lm.addObserver(observer)

  lm.setSelectedIds(new Set([1, 2]))
  expect(observer.onSelectedIdsChange).toHaveBeenCalledWith(new Set([1, 2]))
})
```

**Vue Component Testing:**
```typescript
import { mount } from '@vue/test-utils'
import Component from '@/components/BlankComponent.vue'

describe('BlankComponent.vue', () => {
  it('should display header text', () => {
    const msg = 'Hello'
    const wrapper = mount(Component, { props: {} })
    expect(wrapper.find('h1').text()).toEqual(msg)
  })
})
```

## Test Environment

**Vitest Configuration (in `vite.config.mts`):**
```typescript
test: {
  globals: true,        // Allow describe/test/expect without imports
  environment: 'jsdom', // Browser-like environment
}
```

**TypeScript Types:**
```json
// tsconfig.json
"types": ["vite/client", "@types/jest", "vitest/globals"]
```

## Known Limitations

**WebGL/Canvas:**
- WebGL visualizations (deck.gl, Three.js) difficult to unit test
- E2E tests verify canvas presence but not visual correctness
- Component tests limited to non-WebGL functionality

**Vue 2 Testing:**
- Using `@vue/test-utils` for Vue 2.7
- Some limitations with Composition API testing

**Broken Tests:**
- Some E2E tests marked with `.BROKEN.ts` suffix (e.g., `aggregate-od.BROKEN.ts`, `video-player.BROKEN.ts`)
- These are excluded from test runs

---

*Testing analysis: 2026-01-19*
