# SimWrapper — CLAUDE.md

<!-- Keep under 200 lines. Vue/Plotly/reactivity gotchas and dashboard config traps live in
     <repo-root>/.claude/rules/vue-simwrapper.md and load when you touch .vue/.ts here. -->

## Memory & Planning

- `.project-memory/` (Dissertation root) is the git-tracked shared memory store. Protocol:
  root `CLAUDE.md`.
- `.planning/` holds the roadmap, phase plans, research notes, resolved debug sessions,
  and todos.
- **Code-level rules load automatically** from `.claude/rules/vue-simwrapper.md`: hard
  constraints (TypeScript, Pug, Vue 2.7, path aliases, master auto-deploy), Plotly handler
  lifecycle, Vue Set reactivity, event semantics, and dashboard config traps.

## Project Overview

Interactive data visualization for transportation simulations. Vue 2.7 SPA in TypeScript,
deck.gl / ThreeJS for WebGL, MapLibre GL base maps, Vuex global state (`src/store.ts`),
Vite build, Pug templates.

- Live site: https://simwrapper.app
- Docs: https://docs.simwrapper.app/docs

## Development Commands

```bash
npm ci                # install
npm run dev           # dev server, hot reload, http://localhost:8080
npm run build         # production build
npm run test:run      # vitest
npm run test:ui       # vitest with UI
npm run wasm          # rebuild WASM modules
npm run export <config.yaml> [--output <dir>] [--states <s1,s2>] [--format png|svg] [--scale N]
```

Tests are vitest + jsdom, in `**/__tests__/*.test.ts`.

## Architecture

### Plugin system

Each visualization type is a self-contained plugin folder under `src/plugins/` with a main
`.vue` component, registered in `src/plugins/pluginRegistry.ts`. Plugins activate on file
patterns (`*.geojson`, `viz-*.yaml`).

### Two dashboard types

| Type | Component | Activates when |
|---|---|---|
| Standard | `src/layout-manager/DashBoard.vue` | default; independent cards, no cross-card interaction |
| Interactive | `src/plugins/interactive-dashboard/` | the YAML config contains a `table` section |

`TabbedDashboardView.vue` routes between them by checking `config.table`.

### Interactive dashboard — three layers

1. **Data management** (`managers/`): `DataTableManager` (central table + filtered views),
   `FilterManager` (observer pattern for filter state), `LinkageManager` (coordinates card
   interactions).
2. **Components** (`components/cards/`): `LinkableCardWrapper` wraps each card to add
   interactive capability; `Histogram`/`PieChart`/`Scatter`/`CorrelationMatrix`/`Timeline`/
   `MapCard`.
3. **Dashboard**: `InteractiveDashboard.vue` initializes the managers and orchestrates cards.

**Data flow:** user interacts -> card emits through `LinkableCardWrapper` -> wrapper updates
`FilterManager`/`LinkageManager` -> managers notify observers -> cards receive updated
`filteredData`, `hoveredIds`, `selectedIds` -> cards re-render.

### Linkage configuration

```yaml
linkage:
  type: filter           # 'filter' or 'highlight'
  column: columnName     # column in the central table
  behavior: toggle       # 'toggle' or 'replace'
  onHover: highlight
  onSelect: filter
```

Map layers link the same way, but name both sides of the join:

```yaml
layers:
  - name: zones
    file: zones.geojson
    type: polygon          # polygon | line | arc | scatterplot
    clusterType: origin    # optional: only shown for this cluster type
    colorBy: { attribute: population, type: numeric, scale: [0, 10000] }
    linkage:
      tableColumn: zone_id   # central table column
      geoProperty: id        # GeoJSON feature property
      onHover: highlight
      onSelect: filter
```

Map controls are declared under `map.controls` (`clusterType`, `colorBy`), with the
selectable options under `map.clusterTypes` and `map.colorBy.attributes`.

### File system backends

HTTP/Subversion servers (most common), browser File System Access API handles, and GitHub
via Octokit. Implementation in `src/js/HTTPFileSystem.ts`.

## Export system (headless)

`src/export/` renders dashboard charts to PNG/SVG with no browser, pure Node.js.

```
YAML config -> configParser -> resolveExportPlan -> [ExportItem per state+plot]
                                           |
                        chart type?                     map type?
                   trace builder -> PlotlyFigure   map builder -> MapRenderConfig
                   chartRenderer (jsdom+plotly)    mapRenderer (maplibre-native)
                        SVG / PNG                          PNG
```

**Trace builders are the shared core.** Pure functions `(input, style) -> PlotlyFigure` with
zero Vue/DOM/StyleManager dependencies, in `src/export/trace-builders/`. Both the headless
CLI and the interactive Vue cards call them; cards then layer interactive-only overrides on
top. Builders exist for `histogram`, `scatter-plot`, `pie-chart`, `correlation-matrix`,
`timeline`, and `map`.

**Renderers:** `chartRenderer` runs jsdom + plotly.js, `Plotly.toImage()` to SVG, then
`@resvg/resvg-js` to PNG. `mapRenderer` uses `@maplibre/maplibre-gl-native` plus `sharp`.

**Config override cascade** — three levels, `defaults -> per-plot -> per-state per-plot`:

```yaml
export:
  defaults: { format: png, width: 1200 }
  plots:
    dist-hist: { width: 800 }
  states:
    car-only:
      filters: { mode: car }
      export: [dist-hist]
      plots:
        dist-hist: { title: Car Distance }
```

## Adding a card type to the interactive dashboard

1. Trace builder in `src/export/trace-builders/yourcard.ts` — a pure function.
2. Tests in `src/export/trace-builders/__tests__/yourcard.test.ts`.
3. Register it in `src/export/trace-builders/index.ts`.
4. Vue component in `src/plugins/interactive-dashboard/components/cards/YourCard.vue` that
   calls the builder, then applies hover/selection overrides.
5. Props: `filteredData`, `hoveredIds?`, `selectedIds?`, `linkage?`, plus card-specific.
6. Emit interaction events via `LinkableCardWrapper`.
7. Add the card type to the `InteractiveDashboard.vue` component mapping.
8. Document the YAML config in the plugin README.

## Code style

Prettier enforces formatting. 2-space indentation (Pug requires consistency). Imports
grouped external / internal / relative. camelCase for variables and functions, PascalCase
for components and classes.

## Further docs

- `src/plugins/interactive-dashboard/README.md`
- `MAPCARD_TASKS_PART{1,2,3}_*.md` and `MAPCARD_VALIDATION.md` in the same directory
- Vue 2: https://v2.vuejs.org/v2/guide/ · deck.gl: https://deck.gl/docs · Pug: https://pugjs.org
