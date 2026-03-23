# Phase 1: Theming Foundation - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Centralized color configuration system for all dashboard components. Replace hardcoded color values with CSS variables managed by a StyleManager class. Scope is limited to interactive dashboard components (cards and managers); other plugins retain existing color handling for now.

</domain>

<decisions>
## Implementation Decisions

### Color API design
- CSS variables only for color access in components
- Master color definitions in a single TypeScript file (StyleManager.ts or similar)
- TS file generates CSS variables at app initialization
- No dashboard-level YAML overrides — all dashboards use the global theme
- JS reads computed styles when needed (no separate JS API)

### Dark/light mode handling
- Manual toggle only — no automatic OS preference detection
- Mode state lives in existing Vuex store (globalStore.state.colorScheme)
- Interaction state colors (hover orange, selected blue) stay constant in both modes
- Map base layer switches to dark style variant in dark mode

### OD cluster color scheme
- Default: blue for origin clusters, red for destination clusters
- Default palette must be colorblind-safe (choose shades that work for common colorblindness types)
- Arc colors use colorBy attribute coloring (same as other data-driven elements)
- Arc direction indicated by small filled circle at destination end

### Migration strategy
- Scope: interactive dashboard components only (MapCard, HistogramCard, PieChartCard, ScatterCard, and manager classes)
- Other plugins and 152 files outside interactive dashboard are not touched in this phase
- No deprecation warnings for direct colorSchemes.ts imports — document the new pattern instead

### Claude's Discretion
- Color scale approach for numeric data (heatmaps, etc.) — pick what works well with CSS variables
- CSS variable naming convention — semantic vs component-scoped, based on best practices
- Exact colorblind-safe shades for blue origin / red destination defaults

</decisions>

<specifics>
## Specific Ideas

- Arcs should show colorBy attribute coloring like other data layers; direction is shown with small circles at arc ends, not gradient colors
- Keep interaction states (hover orange #fbbf24, selected blue #3b82f6) the same across light/dark modes for simplicity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-theming-foundation*
*Context gathered: 2026-01-20*
