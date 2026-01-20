---
phase: 01-theming-foundation
plan: 01
subsystem: styling
tags: [theming, css-variables, color-management, singleton]

dependency-graph:
  requires: []
  provides: [StyleManager, CSS-variables, theme-aware-colors]
  affects: [01-02, 01-03, all-interactive-dashboard-components]

tech-stack:
  added: []
  patterns: [singleton, vuex-subscription, css-custom-properties]

key-files:
  created:
    - src/plugins/interactive-dashboard/managers/StyleManager.ts
    - src/plugins/interactive-dashboard/managers/__tests__/StyleManager.test.ts
  modified:
    - src/plugins/interactive-dashboard/utils/colorSchemes.ts

decisions:
  - decision: "Singleton pattern for StyleManager"
    rationale: "Ensures single source of truth for theme state"
  - decision: "CSS variables with --dashboard- prefix"
    rationale: "Namespaces variables to avoid conflicts with app-level styles"
  - decision: "Interaction colors constant across modes"
    rationale: "Per CONTEXT.md - hover orange and selected blue remain same in light/dark"
  - decision: "Backward compatibility in colorSchemes.ts"
    rationale: "Existing components continue working during migration"

metrics:
  duration: "15 minutes"
  completed: "2026-01-20"
---

# Phase 01 Plan 01: Create StyleManager Core Summary

**One-liner:** Centralized theme manager singleton with CSS variable injection for light/dark mode support and deck.gl RGBA conversion.

## What Was Built

### StyleManager Class (`src/plugins/interactive-dashboard/managers/StyleManager.ts`)

A singleton class that serves as the single source of truth for all dashboard colors:

**Color Definitions:**
- Theme colors (background, text, border) with light/dark variants
- Interaction state colors (hover: #fbbf24, selected: #3b82f6, dimmed: 0.3 alpha)
- OD cluster colors (origin: #2563eb blue, destination: #dc2626 red)
- Chart colors for Plotly visualizations
- Categorical, mode, and activity color palettes (from existing colorSchemes.ts)

**Key Methods:**
- `getColor(path)` - Get hex color by dot-notation path (e.g., 'theme.background.primary')
- `getColorRGBA(path, alpha)` - Get [R,G,B,A] array for deck.gl
- `getDimmedColorRGBA(path)` - Get color with dimmed alpha for non-selected items
- `setClusterColors({origin, destination})` - Override cluster colors via YAML config
- `setMode('light'|'dark')` - Manually switch theme mode
- `initialize()` - Subscribe to Vuex store and inject CSS variables

**CSS Variable Injection:**
Injects semantic CSS variables into document.head on initialization:
```css
:root {
  --dashboard-bg-primary: #1e293b;
  --dashboard-text-primary: #e2e8f0;
  --dashboard-interaction-hover: #fbbf24;
  --dashboard-cluster-origin: #2563eb;
  /* ... */
}
```

### Test Suite (`src/plugins/interactive-dashboard/managers/__tests__/StyleManager.test.ts`)

Comprehensive tests covering:
- Singleton pattern behavior
- Color retrieval for all paths (theme, interaction, cluster, chart, categorical)
- Mode switching (light/dark)
- RGBA conversion for deck.gl
- Cluster color overrides
- Categorical color indexing with wraparound

### colorSchemes.ts Integration

Added StyleManager-aware helper functions:
- `getInteractionColor('hover'|'selected')` - Get interaction state color
- `getClusterColor('origin'|'destination')` - Get cluster color
- `getInteractionColorRGBA()` - For deck.gl layers
- `getClusterColorRGBA()` - For deck.gl cluster layers
- `getThemeColor(path)` - For theme colors
- `getChartColor(path)` - For chart colors

Existing exports (MODE_COLORS, CATEGORICAL_COLORS, etc.) remain unchanged with deprecation comments.

## Commits

| Commit | Message |
|--------|---------|
| 4dd8fc8d | feat(01-01): create StyleManager class with color definitions |
| 2adc2d65 | test(01-01): add comprehensive StyleManager tests |
| 8f8126c8 | feat(01-01): add StyleManager helper functions to colorSchemes.ts |

## Decisions Made

1. **Singleton Pattern**: StyleManager uses singleton pattern to ensure all components access the same theme state.

2. **CSS Variable Naming**: Used `--dashboard-` prefix with semantic names (e.g., `--dashboard-bg-primary`) to namespace dashboard styles.

3. **Constant Interaction Colors**: Per CONTEXT.md, hover (#fbbf24) and selected (#3b82f6) colors remain constant across light/dark modes for consistency.

4. **Vuex Subscription**: StyleManager subscribes to `globalStore.state.colorScheme` using Vuex watch pattern for automatic theme updates.

5. **Colorblind-Safe Defaults**: Cluster colors use blue (#2563eb) and red (#dc2626) that are distinguishable for common colorblindness types.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. Dev server starts without errors
2. TypeScript compiles successfully (Vite build)
3. All 22 StyleManager tests pass
4. Existing colorSchemes.ts imports continue working

## Next Phase Readiness

**Ready for Plan 02**: StyleManager is available for component migration. Components can now:
- Use `StyleManager.getInstance().getColor()` for programmatic access
- Use CSS variables `var(--dashboard-*)` in styles
- Use helper functions from colorSchemes.ts

**Dependencies Provided:**
- StyleManager singleton exported from `managers/StyleManager.ts`
- CSS variables injected via `initializeTheme()`
- Helper functions in colorSchemes.ts for common color access patterns

---

*Executed: 2026-01-20*
*Duration: 15 minutes*
