# Coding Conventions

**Analysis Date:** 2026-01-19

## Naming Patterns

**Files:**
- Vue components: PascalCase (e.g., `MapCard.vue`, `BlankComponent.vue`, `InteractiveDashboard.vue`)
- TypeScript utilities: camelCase or PascalCase (e.g., `util.ts`, `HTTPFileSystem.ts`, `FilterManager.ts`)
- Worker files: `*.worker.ts` suffix (e.g., `DataFetcher.worker.ts`, `TransitSupplyHelper.worker.ts`)
- Test files: `*.test.ts` or `*.spec.ts` in `__tests__/` directories or `tests/` folder

**Functions:**
- camelCase for all functions and methods
- Async functions prefixed implicitly (no special naming convention)
- Event handlers: `handle*` or verb prefix (e.g., `handleCardIsLoaded`, `toggleZoom`, `getFileText`)
- Getters: `get*` prefix (e.g., `getDirectory`, `getRowById`, `getCardComponent`)

**Variables:**
- camelCase for local variables and component data
- SCREAMING_SNAKE_CASE for constants (e.g., `DEFAULT_PROJECTION`, `MAP_STYLES_ONLINE`, `MAPBOX_TOKEN`)
- Private class properties: no prefix convention (TypeScript `private` keyword used)

**Types/Interfaces:**
- PascalCase for all types and interfaces
- Interfaces often suffixed with descriptive names (e.g., `FileSystemConfig`, `FilterObserver`, `DataTableColumn`)
- Enums use PascalCase with PascalCase members (e.g., `ColorScheme.DarkMode`, `Status.ERROR`)

**CSS Classes:**
- kebab-case for CSS class names (e.g., `dash-card-frame`, `is-panel-narrow`, `table-wrapper`)
- BEM-like modifiers with `is-*` prefix for state (e.g., `is-active`, `is-hovered`, `is-filtered`)

## Code Style

**Formatting:**
- Prettier configured in `.prettierrc.cjs`
- No semicolons (semi: false)
- Single quotes for strings
- Arrow function parentheses avoided when possible (`arrowParens: 'avoid'`)
- Trailing commas in ES5 contexts
- Print width: 100 characters

**Linting:**
- ESLint with Vue and TypeScript plugins
- Console and debugger statements allowed (`'no-console': 'off'`)
- No strict var rule (`'no-var': 'off'`)
- TypeScript parser with Vue essential rules

## Import Organization

**Order:**
1. External library imports (vue, vuex, third-party packages)
2. Alias imports (`@/` for src directory)
3. Relative imports (`./`, `../`)

**Path Aliases:**
- `@/` maps to `src/`
- `~/` maps to `node_modules/`

**Example pattern from `InteractiveDashboard.vue`:**
```typescript
import Vue, { defineComponent } from 'vue'
import type { PropType } from 'vue'

import YAML from 'yaml'

import globalStore from '@/store'
import { sleep } from '@/js/util'

import { FavoriteLocation, FileSystemConfig, Status, YamlConfigs } from '@/Globals'
import HTTPFileSystem from '@/js/HTTPFileSystem'

import { FilterManager } from './managers/FilterManager'
import LinkableCardWrapper from './components/cards/LinkableCardWrapper.vue'
```

## Error Handling

**Patterns:**
- "Throw early, catch late" philosophy (see `HTTPFileSystem.ts` comments)
- Errors thrown with `throw Error('message')` or `throw response` for HTTP errors
- Try/catch at component boundaries with `$emit('error', message)` for user feedback
- Console.error for debugging, console.warn for recoverable issues

**Example from `HTTPFileSystem.ts`:**
```typescript
async getFileText(scaryPath: string): Promise<string> {
  // This can throw lots of errors; we are not going to catch them
  // here so the code further up can deal with errors properly.
  // "Throw early, catch late."
  const response = await this._getFileResponse(scaryPath)
  return response.text()
}
```

**HTTP Error Handling:**
```typescript
const response = await fetch(myRequest).then(response => {
  if (response.status >= 300) {
    console.warn('Status:', response.status)
    throw response
  }
  return response
})
```

## Logging

**Framework:** Browser console (console.log, console.warn, console.error)

**Patterns:**
- Debug logging via custom `debugLog()` utility (see `src/plugins/interactive-dashboard/utils/debug.ts`)
- Component-prefixed log messages: `[ComponentName] message` format
- Console statements are allowed in development (ESLint rule disabled)

**Example:**
```typescript
debugLog('[FilterManager] Setting filter:', filterId, 'column:', column)
console.log('[InteractiveDashboard] setupRows called with layout:', layout)
console.error('[InteractiveDashboard] Failed to load centralized data:', e)
```

## Comments

**When to Comment:**
- Complex logic or non-obvious behavior
- TODO/FIXME markers for future work
- Section headers for long files (e.g., `// NEW: Initialize coordination layer`)
- API documentation for public methods

**JSDoc/TSDoc:**
- Used sparingly, primarily for utility functions and class methods
- Focus on describing purpose, not parameters when types are clear

**Example from `Globals.ts`:**
```typescript
/**
 * DataTableColumn represents one column of a loaded dataset. Numerical data will always be
 * stored as a Float32Array, while other data such as strings will be stored as regular
 * arrays.
 *
 * @property type - is one of the DataType enumeration, and is used to decode factors
 */
export interface DataTableColumn {
  values: Float64Array | Float32Array | any[]
  name: string
  type: DataType
  max?: number
}
```

## Function Design

**Size:** No strict limit, but larger functions are broken into helper methods

**Parameters:**
- Destructuring used for options objects
- Default values provided in parameter definitions
- TypeScript interfaces for complex parameter types
- PropType<T> used for Vue prop definitions

**Return Values:**
- Promises for async operations
- Explicit return types in TypeScript
- Void returns common for event handlers and observers

**Example:**
```typescript
setFilter(
  filterId: string,
  column: string,
  values: Set<any>,
  type: FilterType,
  binSize?: number
): void {
  if (values.size === 0) {
    this.filters.delete(filterId)
  } else {
    this.filters.set(filterId, { id: filterId, column, type, values, behavior: 'toggle', binSize })
  }
  this.notifyObservers()
}
```

## Module Design

**Exports:**
- Named exports for most utilities and types
- Default exports for Vue components and main classes
- Re-exports through index files in some directories

**Barrel Files:**
- Used in some plugin directories (e.g., `src/layers/flowmap/index.ts`)
- Panel lookup in `src/dash-panels/_allPanels.ts`

## Vue Component Structure

**Template Language:** Pug (Python-style indentation)
- No HTML tags, use indentation-based syntax
- Vue directives as Pug attributes

**Script Structure (Options API with defineComponent):**
```typescript
export default defineComponent({
  name: 'ComponentName',
  components: {},
  props: {},
  data: () => {
    return {}
  },
  computed: {},
  watch: {},
  methods: {},
  mounted() {},
  beforeDestroy() {},
})
```

**Style:**
- Scoped SCSS with `<style scoped lang="scss">`
- Global styles imported via `@import '@/styles.scss'`
- CSS custom properties for theming (e.g., `var(--bgCardFrame)`, `var(--text)`)

## Observer Pattern

**Manager Classes:**
- Used extensively in interactive dashboard coordination layer
- `addObserver(observer)` / `removeObserver(observer)` pattern
- Observers implement specific interfaces (e.g., `FilterObserver`, `LinkageObserver`)

**Example from `FilterManager.ts`:**
```typescript
export interface FilterObserver {
  onFilterChange: (filters: Map<string, Filter>) => void
}

export class FilterManager {
  private observers: Set<FilterObserver> = new Set()

  addObserver(observer: FilterObserver): void {
    this.observers.add(observer)
  }

  private notifyObservers(): void {
    this.observers.forEach(obs => obs.onFilterChange(this.filters))
  }
}
```

## State Management

**Vuex Store:**
- Single store in `src/store.ts`
- Mutations for synchronous state changes
- Actions for async operations (rarely used)
- State accessed via `this.$store.state` or imported `globalStore`

**Component State:**
- Vue.set() used for reactive property additions in Vue 2
- Data returned as arrow function `data: () => { return {} }`

---

*Convention analysis: 2026-01-19*
