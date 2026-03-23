---
phase: 01-theming-foundation
plan: 02
subsystem: styling
tags: [theming, css-variables, color-migration, mapcard, colorlegend]

dependency-graph:
  requires: [01-01]
  provides: [theme-aware-map, theme-aware-legend, yaml-cluster-colors]
  affects: [01-03, 01-04]

tech-stack:
  added: []
  patterns: [css-custom-properties, singleton-access, yaml-configuration]

key-files:
  created: []
  modified:
    - src/plugins/interactive-dashboard/components/cards/MapCard.vue
    - src/plugins/interactive-dashboard/components/cards/ColorLegend.vue
    - src/plugins/interactive-dashboard/InteractiveDashboard.vue

decisions:
  - decision: "CSS variables with fallback chains"
    rationale: "Use var(--dashboard-X, var(--app-X, #fallback)) for graceful degradation"
  - decision: "Keep domain-specific colors static"
    rationale: "Transport mode colors (car=red, bike=green) are semantic, not theme-dependent"
  - decision: "Baseline comparison colors remain neutral gray"
    rationale: "Comparison layers need constant neutral color regardless of theme"

metrics:
  duration: "12 minutes"
  completed: "2026-01-20"
---

# Phase 01 Plan 02: Migrate MapCard and ColorLegend Summary

**One-liner:** MapCard and ColorLegend migrated to use CSS variables and StyleManager for consistent theme-aware styling with YAML cluster color configuration.

## What Was Built

### MapCard Theme Migration (`src/plugins/interactive-dashboard/components/cards/MapCard.vue`)

**Interaction Colors (deck.gl):**
- Replaced hardcoded `[59, 130, 246]` (selected blue) with `getInteractionColorRGBA('selected')`
- Replaced hardcoded `[251, 146, 60]` (hover orange) with `getInteractionColorRGBA('hover')`
- Colors applied consistently in:
  - `getFeatureFillColor()` - polygon fill states
  - `getFeatureLineColor()` - polygon outline states
  - `getFeatureColor()` - line/arc/scatterplot colors

**Tooltip Styling:**
- Updated `getTooltipStyle()` to use `StyleManager.getInstance().getColor()`:
  - `theme.background.secondary` for tooltip background
  - `theme.text.primary` for tooltip text

**UI Element CSS Variables (12 total):**
- `.map-controls` - background, border
- `.control-label` - text color
- `.control-select` - border, background, text, hover/focus states
- `.loading-overlay` - background, text
- `.spinner` - border colors

### ColorLegend Theme Migration (`src/plugins/interactive-dashboard/components/cards/ColorLegend.vue`)

**CSS Variables Applied (10 total):**
- `.color-legend` - background, text, border
- `.legend-title` - text color, bottom border
- `.legend-item:hover` - hover background
- `.legend-swatch` - border color
- `.legend-label` - text color
- `.legend-gradient` - border color
- `.legend-scale` - secondary text color

**Simplified Styling:**
- Removed redundant `.dark` class overrides
- CSS variables automatically handle light/dark theming

### YAML Cluster Color Configuration (`src/plugins/interactive-dashboard/InteractiveDashboard.vue`)

**Theme Initialization:**
- Added `initializeTheme()` call at coordination layer init
- Ensures CSS variables are injected before components render

**YAML Configuration Support:**
```yaml
colors:
  clusters:
    origin: "#2563eb"       # Custom origin cluster color
    destination: "#dc2626"  # Custom destination cluster color
```

**Implementation:**
- Parses `yaml.colors.clusters.origin` and `yaml.colors.clusters.destination`
- Calls `StyleManager.getInstance().setClusterColors()` with custom colors
- Falls back to colorblind-safe defaults when not specified

## Commits

| Commit | Message |
|--------|---------|
| b579470a | feat(01-02): replace hardcoded interaction colors in MapCard |
| b0854f49 | feat(01-02): update MapCard UI styles to use CSS variables |
| d3f63d99 | feat(01-02): update ColorLegend styles to use CSS variables |
| ec3b7b2b | feat(01-02): implement YAML cluster color configuration |

## Decisions Made

1. **CSS Variable Fallback Chains**: Used `var(--dashboard-X, var(--app-X, #fallback))` pattern to ensure graceful degradation when variables aren't defined.

2. **Static Domain Colors**: Transport mode colors (car=red, pt=blue, bike=green) remain hardcoded as they represent semantic meaning, not theme preference.

3. **Neutral Baseline Colors**: Comparison mode baseline layers use constant gray `[180, 180, 180, 80]` regardless of theme for visual contrast.

4. **StyleManager for Programmatic Colors**: deck.gl layers use `getInteractionColorRGBA()` helper for RGBA arrays since CSS variables can't be used in JavaScript.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. No remaining hardcoded `[59, 130, 246]` (selected blue) in MapCard.vue
2. No remaining hardcoded `[251, 146, 60]` (hover orange) in MapCard.vue
3. MapCard uses 12 CSS variables (`var(--dashboard-*`)
4. ColorLegend uses 10 CSS variables
5. All 23 StyleManager tests pass
6. TypeScript compiles without errors in modified files

## Next Phase Readiness

**Ready for Plan 03**: Components can now use StyleManager for colors. Remaining chart cards (PieChartCard, HistogramCard, ScatterCard, DataTableCard) follow the same migration pattern.

**Dependencies Provided:**
- MapCard fully theme-aware for map controls, tooltips, and feature styling
- ColorLegend fully theme-aware for legend display
- YAML cluster color configuration support via `colors.clusters`
- Theme initialized automatically when interactive dashboard loads

---

*Executed: 2026-01-20*
*Duration: 12 minutes*
