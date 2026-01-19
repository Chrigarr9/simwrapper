# Coding Conventions

**Analysis Date:** 2026-01-19

## Naming Patterns

**Files:**
- Vue components: PascalCase (e.g., `MapCard.vue`, `LinkableCardWrapper.vue`, `InteractiveDashboard.vue`)
- TypeScript modules: PascalCase for classes (e.g., `FilterManager.ts`, `DataTableManager.ts`)
- Utility modules: camelCase (e.g., `colorSchemes.ts`, `debug.ts`)
- Test files: Same name as source + `.test.ts` (e.g., `FilterManager.test.ts`)
- Config files: kebab-case or camelCase (e.g., `vite.config.mts`, `.prettierrc.cjs`)

**Functions:**
- camelCase for all functions and methods
- Prefix with verb: `get`, `set`, `handle`, `on`, `apply`, `toggle`, `clear`, `build`
- Examples from Interactive Dashboard:
  ```typescript
  setFilter()
  toggleFilterValue()
  clearAllFilters()
  applyFilters()
  handleHover()
  handleSelect()
  buildColorMap()
  getCategoryColor()
  ```

**Variables:**
- camelCase for all variables
- Prefix with `is` or `has` for booleans: `isDarkMode`, `hasActiveFilters()`
- Use descriptive names: `filteredData`, `hoveredIds`, `selectedIds`

**Types/Interfaces:**
- PascalCase for all types and interfaces
- Suffix with purpose: `Config`, `Observer`, `Manager`
- Examples:
  ```typescript
  FilterObserver
  LinkageConfig
  TableConfig
  CardConfig
  FilterType
  ```

**Constants:**
- SCREAMING_SNAKE_CASE for module-level constants
- Examples from `colorSchemes.ts`:
  ```typescript
  MODE_COLORS
  ACTIVITY_COLORS
  CATEGORICAL_COLORS
  ```

## Code Style

**Formatting:**
- Prettier enforced via `.prettierrc.cjs`
- Key settings:
  - `printWidth: 100` - Line length limit
  - `semi: false` - No semicolons
  - `singleQuote: true` - Single quotes for strings
  - `trailingComma: 'es5'` - Trailing commas in ES5 contexts
  - `arrowParens: 'avoid'` - No parens for single-param arrows
- **Indentation:** 2 spaces (critical for Pug templates)

**Linting:**
- ESLint with Vue and TypeScript plugins
- Config: `.eslintrc.js`
- Key rules:
  - `no-console: 'off'` - Console allowed (but prefer `debugLog` in Interactive Dashboard)
  - `no-debugger: 'off'` - Debugger allowed in dev
  - Uses `@typescript-eslint/parser`

## Import Organization

**Order:**
1. Vue/framework imports
2. External library imports
3. Internal path alias imports (`@/`)
4. Relative imports (`./`, `../`)

**Examples from Interactive Dashboard:**
```typescript
// 1. Vue/framework
import Vue, { defineComponent } from 'vue'
import type { PropType } from 'vue'
import { ref, watch, onMounted, computed } from 'vue'

// 2. External libraries
import YAML from 'yaml'
import Plotly from 'plotly.js/dist/plotly'

// 3. Internal path alias imports
import globalStore from '@/store'
import { sleep } from '@/js/util'
import { FavoriteLocation, FileSystemConfig, Status, YamlConfigs } from '@/Globals'
import HTTPFileSystem from '@/js/HTTPFileSystem'

// 4. Relative imports (same plugin)
import { FilterManager } from './managers/FilterManager'
import { LinkageManager } from './managers/LinkageManager'
import { debugLog } from './utils/debug'
import LinkableCardWrapper from './components/cards/LinkableCardWrapper.vue'
```

**Path Aliases:**
- `@/` maps to `src/`
- `~/` maps to `node_modules/`
- Configured in `tsconfig.json` and `vite.config.mts`

## Error Handling

**Patterns:**
- Use try/catch for async operations
- Log errors with context: `console.error('[ComponentName] Error message:', e)`
- Emit errors to parent via `$emit('error', message)` for dashboard-level handling
- Return early on error conditions

**Example from InteractiveDashboard:**
```typescript
try {
  await this.dataTableManager.loadData(this.fileApi, this.xsubfolder)
  debugLog('[InteractiveDashboard] Data loaded successfully')
} catch (e) {
  console.error('[InteractiveDashboard] Failed to load centralized data:', e)
  this.$emit('error', `Failed to load data: ${e}`)
}
```

## Logging

**Framework:** Custom `debugLog` utility for Interactive Dashboard

**Pattern:**
- Use `debugLog()` instead of `console.log()` for development logging
- Enable via URL parameter `?debug=interactive-dashboard` or localStorage
- Prefix log messages with `[ComponentName]` for traceability

**Debug Utility Location:** `src/plugins/interactive-dashboard/utils/debug.ts`

**Usage:**
```typescript
import { debugLog } from '../utils/debug'

debugLog('[FilterManager] Setting filter:', filterId, 'column:', column)
debugLog('[LinkableCardWrapper] Filter event:', filterId, column, values)
```

## Comments

**When to Comment:**
- JSDoc for public interfaces and complex functions
- Inline comments for non-obvious logic
- `// NEW:` prefix for additions during development (remove before merge)
- `// TODO:` for future work

**JSDoc/TSDoc:**
- Use for exported functions and interfaces
- Document parameters and return types

**Example:**
```typescript
/**
 * Apply filters to dataset (AND between filters, OR within values)
 */
applyFilters<T extends Record<string, any>>(data: T[]): T[] {
  // ...
}

/**
 * Compare two values with flexible matching for common data mismatches
 */
private valuesMatch(cellValue: any, filterValue: any): boolean {
  // ...
}
```

## Function Design

**Size:** Keep functions focused - single responsibility principle

**Parameters:**
- Use interfaces for complex parameter objects
- Provide sensible defaults via `withDefaults()` in Vue 3-style components

**Return Values:**
- Return `ReadonlyMap` or `ReadonlySet` to prevent external mutation
- Return `undefined` for not-found cases, not `null`

**Example:**
```typescript
getFilters(): ReadonlyMap<string, Filter> {
  return this.filters
}

getRowById(id: any): DataRow | undefined {
  return this.data.find(row => row[this.idColumn] === id)
}
```

## Module Design

**Exports:**
- Named exports for utilities and types
- Default export for Vue components
- Export interfaces alongside implementations

**Pattern from managers:**
```typescript
// FilterManager.ts
export type FilterType = 'categorical' | 'range' | 'time' | 'binned'

export interface Filter {
  id: string
  column: string
  type: FilterType
  values: Set<any>
  behavior: 'toggle' | 'replace'
  binSize?: number
}

export interface FilterObserver {
  onFilterChange: (filters: Map<string, Filter>) => void
}

export class FilterManager {
  // ...
}
```

**Barrel Files:** Not used - import directly from source files

## Vue Component Conventions

**Template Language:** Pug (not HTML)
- Python-style indentation instead of HTML tags
- Critical: Maintain consistent 2-space indentation

**Script Setup (Composition API):**
- Use `<script setup lang="ts">` for new components
- Define props with `defineProps<Props>()` and `withDefaults()`
- Define emits with `defineEmits<{...}>()`

**Example from HistogramCard.vue:**
```typescript
<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'

interface Props {
  title?: string
  column: string
  binSize?: number
  filteredData?: any[]
  linkage?: { type: 'filter'; column: string; behavior: 'toggle' }
  tableConfig?: TableConfig
}

const props = withDefaults(defineProps<Props>(), {
  filteredData: () => []
})

const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>, filterType: string, binSize?: number]
}>()
```

**Options API (Legacy):**
- Use `defineComponent()` for Options API components
- Type props with `PropType<T>`

## Interactive Dashboard Specific Patterns

### Observer Pattern
Managers use observer pattern for cross-component communication:

```typescript
export interface FilterObserver {
  onFilterChange: (filters: Map<string, Filter>) => void
}

export class FilterManager {
  private observers: Set<FilterObserver> = new Set()

  addObserver(observer: FilterObserver): void {
    this.observers.add(observer)
  }

  removeObserver(observer: FilterObserver): void {
    this.observers.delete(observer)
  }

  private notifyObservers(): void {
    this.observers.forEach(obs => obs.onFilterChange(this.filters))
  }
}
```

### Linkable Card Props Interface
All linkable cards must accept these props:

```typescript
interface Props {
  filteredData: any[]           // Filtered data from LinkableCardWrapper
  hoveredIds?: Set<any>         // IDs to highlight on hover
  selectedIds?: Set<any>        // IDs that are selected
  linkage?: LinkageConfig       // Linkage configuration
  // ... card-specific props
}
```

### Event Emission Pattern
Cards emit events for user interactions:

```typescript
const emit = defineEmits<{
  filter: [filterId: string, column: string, values: Set<any>, filterType?: string, binSize?: number]
  hover: [ids: Set<any>]
  select: [ids: Set<any>]
}>()

// Usage
emit('filter', filterId, props.column, new Set(selectedBins.value), 'binned', binSize)
emit('hover', new Set([featureId]))
emit('select', new Set([featureId]))
```

### Defensive Data Handling
Always check for undefined/empty data:

```typescript
const histogramData = computed(() => {
  if (!props.filteredData || props.filteredData.length === 0) {
    debugLog('[HistogramCard] No filtered data available')
    return []
  }
  // ... process data
})
```

---

*Convention analysis: 2026-01-19*
