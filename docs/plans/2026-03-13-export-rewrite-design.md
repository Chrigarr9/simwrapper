# Export System Rewrite — Design Document

**Date:** 2026-03-13
**Status:** Approved
**Supersedes:** 2026-02-17-headless-export-design.md, 2026-02-17-headless-export-plan.md

## Motivation

The existing export system uses a headless Chromium browser (Playwright) + Vite dev server to
capture screenshots of Vue card components. This is:

- **Over-engineered** — 8-layer indirection (CLI → Playwright → Vite → Vue → card → Plotly → DOM → capture)
- **Unreliable** — fragile polling-based capture with arbitrary timeouts, race conditions
- **Visually inconsistent** — most cards ignore `exportMode`, producing interactive-style output
- **Hard to manipulate** — raster screenshots require full pipeline re-run to tweak fonts/colors
- **Slow** — ~30s+ per plot with browser overhead

## Design Goals

1. Zero browser dependency — pure Node.js rendering
2. Visual parity — shared trace-building logic between dashboard and export
3. Publication-ready output — SVG and PNG with proper fonts, line widths, margins
4. Simple CLI — `npx simwrapper export dashboard.yaml --output ./figures`
5. Dashboard-driven workflow — design your dashboard, export it when happy
6. Flexible overrides — 3-level cascade: global → per-plot → per-state per-plot

## Architecture

```
                    Export CLI
                        |
         +--------------+--------------+
         v              v              v
   Config Parser    Data Loader    Style Resolver
         |              |              |
         +------+-------+              |
                v                      |
         Render Planner <--------------+
                |
        +-------+-------+
        v               v
  Chart Renderer    Map Renderer
  (jsdom+plotly->   (maplibre-native
   SVG->resvg->PNG)  +sharp->PNG)
        |               |
        +-------+-------+
                v
         Output Writer
         (individual files)
```

### Key Components

- **Config Parser** — Reads dashboard YAML (inline `export:` section or linked export YAML).
  Resolves card references from dashboard `layout`. Applies override cascade.
- **Data Loader** — Loads CSV via PapaParse, applies filters per state (reuses FilterManager).
- **Style Resolver** — Builds ChartStyle/MapStyle from the override cascade.
- **Chart Renderer** — Takes PlotlyFigure objects, renders via jsdom + plotly.js -> SVG -> resvg-js -> PNG.
- **Map Renderer** — Takes MapLibre style + GeoJSON layers, renders via maplibre-gl-native -> sharp -> PNG.
- **Output Writer** — Writes individual files to output directory.

## Config Format

### Override Cascade (most specific wins)

```
Dashboard card config (base)
  -> export.defaults (global print overrides)
    -> export.plots.<name> (per-plot overrides)
      -> export.states.<state>.plots.<name> (per-state per-plot overrides)
```

### Mode 1: Inline (export section in dashboard YAML)

```yaml
table:
  file: trips.csv
  idColumn: trip_id

layout:
  row1:
    - type: histogram
      name: dist-histogram
      column: distance
      binSize: 5000
      title: "Trip Distance"
    - type: pie-chart
      name: mode-pie
      column: main_mode
  row2:
    - type: map
      name: trip-map
      layers:
        - name: zones
          file: zones.geojson
          type: polygon

export:
  defaults:
    format: png
    width: 1200
    height: 800
    scale: 2
    axisTitleFontSize: 16
    axisTickFontSize: 13

  plots:
    dist-histogram:
      width: 1000
      height: 600
    trip-map:
      zoom: 11

  states:
    all:
      export: [dist-histogram, mode-pie, trip-map]
    car-only:
      filters:
        mode: car
      export: [dist-histogram, trip-map]
      plots:
        dist-histogram:
          title: "Car Trip Distance"

  output:
    naming: "{state}-{plot}"
```

### Mode 2: Linked (separate export YAML)

```yaml
dashboard: dashboard.yaml

defaults:
  format: png
  scale: 3
  axisTitleFontSize: 18

plots:
  dist-histogram:
    width: 1400

states:
  all:
    export: [dist-histogram, mode-pie, trip-map]
```

### Properties That Cascade

`format`, `width`, `height`, `scale`, `axisTitleFontSize`, `axisTickFontSize`,
`legendTitleFontSize`, `legendFontSize`, `lineWidth`, `markerSizeMultiplier`,
`title`, and any plot-type-specific props (e.g., `zoom`, `binSize`, `center`).

## Trace Builders (Shared Pure Functions)

The core of the rewrite: extract Plotly trace/layout building from Vue card components
into pure functions with zero Vue/DOM dependency.

### Interface

```typescript
// Input: data + plot config
interface HistogramInput {
  filteredData: any[]
  baselineData?: any[]
  column: string
  binSize?: number
  title?: string
  colorBy?: string
  colorMap?: Map<string, string>
  showComparison?: boolean
  // ...
}

// Style: visual properties (from cascade)
interface ChartStyle {
  axisTitleFontSize: number
  axisTickFontSize: number
  legendTitleFontSize: number
  legendFontSize: number
  lineWidth: number
  markerSizeMultiplier: number
  fontFamily: string
  backgroundColor: string
  textColor: string
  gridColor: string
  barColor: string
  margin?: { l: number; r: number; t: number; b: number }
}

// Output: ready for Plotly.react() or jsdom Plotly.toImage()
interface PlotlyFigure {
  traces: Plotly.Data[]
  layout: Partial<Plotly.Layout>
  config?: Partial<Plotly.Config>
}

function buildHistogramFigure(input: HistogramInput, style: ChartStyle): PlotlyFigure
```

### One builder per chart type

- `histogram.ts` -> `buildHistogramFigure()`
- `scatter.ts` -> `buildScatterFigure()`
- `pie.ts` -> `buildPieFigure()`
- `correlation.ts` -> `buildCorrelationFigure()`
- `timeline.ts` -> `buildTimelineFigure()`
- `map.ts` -> `buildMapLibreStyle()` + `parseMapConfig()`

### Style Resolution

```
Interactive (Vue card):
  StyleManager.getInstance() -> theme (dark/light/scientific)
  -> ChartStyle with interactive defaults

Export (CLI):
  EXPORT_DEFAULTS -> config.defaults -> per-plot -> per-state cascade
  -> ChartStyle with print defaults (large fonts, white bg)
```

Same builder, different style input = visual parity for data, appropriate styling per context.

### Card Refactoring

Each Vue card is refactored to call the trace builder:

```
Before: HistogramCard.vue builds traces in computed properties
After:  HistogramCard.vue calls buildHistogramFigure(input, style)
        and passes result to Plotly.react()
```

Card becomes a thin shell: calls builder, renders via Plotly, handles interactivity (click/hover).

## Chart Rendering Pipeline

```
TraceBuilder(data, config, style) -> { traces, layout }
    |
Apply export style overrides (fonts, margins)
    |
jsdom + plotly.js -> Plotly.toImage(figure, { format: 'svg' })
    |
SVG string
    |
  +----------+----------+
  v                     v
format: svg          format: png
Save .svg            resvg-js -> PNG buffer -> Save .png
```

### jsdom Text-Sizing Limitation

jsdom's `getBoundingClientRect` returns zeros, affecting Plotly's auto-margin calculation.
Solved by always setting explicit margins and font sizes via the override cascade.
Export defaults provide sensible print margins; user overrides per-plot as needed.
This turns the limitation into a non-issue for export use cases.

## Map Rendering Pipeline

```
Dashboard YAML (map card config)
    |
1. Load base style JSON (Positron, OSM Liberty, etc.)
    |
2. For each layer in config:
   - Load GeoJSON file
   - Apply filters
   - Translate to MapLibre style layer:
     polygon -> fill + line layer
     line -> line layer
     scatterplot -> circle layer
     arc -> curved LineString geometry + line layer
    |
3. Apply colorBy (data-driven paint properties)
    |
4. Render via maplibre-gl-native:
   map.load(style)
   map.addSource(name, { type: 'geojson', data })
   map.addLayer({ id, type, source, paint })
   map.render({ center, zoom, width, height })
    |
5. Raw RGBA buffer -> sharp -> PNG
    |
6. Optionally draw legend overlay via sharp composite
```

### deck.gl -> MapLibre Layer Translation

| deck.gl layer      | MapLibre equivalent      | Notes                                    |
|---------------------|--------------------------|------------------------------------------|
| PolygonLayer        | fill + line              | Direct mapping                           |
| ScatterplotLayer    | circle                   | radius -> circle-radius                  |
| LineLayer           | line                     | Direct mapping                           |
| ArcLayer            | line + curved geometry   | Bezier interpolation, 2D projected       |

### MapCard Exception

MapCard is where interactive and export renderers diverge:
- Interactive: deck.gl (WebGL)
- Export: maplibre-gl-native (server-side)

They share config parsing via `trace-builders/map.ts`:
- `buildMapLibreStyle()` — for export
- `parseMapConfig()` — shared config normalization

## CLI Interface

### Invocation

```bash
npx simwrapper export dashboard.yaml
npx simwrapper export dashboard.yaml --output ./figures
npx simwrapper export export-dissertation.yaml
npx simwrapper export dashboard.yaml --states car-only,pt-only
npx simwrapper export dashboard.yaml --format svg
npx simwrapper export dashboard.yaml --scale 3
```

### Output Structure

Flat directory, configurable via `output.naming` (default: `{state}-{plot}`):

```
figures/
  all-dist-histogram.png
  all-mode-pie.png
  all-trip-map.png
  car-only-dist-histogram.png
  car-only-trip-map.png
```

### Console Output

```
simwrapper export v1.0
Config: dashboard.yaml (5 plots x 2 states = 10 exports)

[1/10] all/dist-histogram ............ png 1200x800  0.8s
[2/10] all/mode-pie .................. png 1200x800  0.6s
[3/10] all/trip-map .................. png 1200x800  2.1s
...

Done! 10 files written to ./figures (8.4s)
```

### Error Handling

- Missing CSV/GeoJSON file -> clear error with path, skip plot, continue
- Invalid YAML -> fail fast with parse error and line number
- Card name not found in layout -> warn and skip
- Map tile fetch failure -> warn, render without basemap
- All errors collected and summarized at end

## File Structure

### New files

```
src/export/
  cli.ts                          # CLI entry point
  configParser.ts                 # YAML parsing, card resolution, cascade
  styleResolver.ts                # Builds ChartStyle/MapStyle
  renderers/
    chartRenderer.ts              # jsdom + plotly.js -> SVG -> resvg-js -> PNG
    mapRenderer.ts                # maplibre-gl-native + sharp -> PNG
  trace-builders/
    index.ts                      # Registry: card type -> builder function
    histogram.ts                  # buildHistogramFigure()
    scatter.ts                    # buildScatterFigure()
    pie.ts                        # buildPieFigure()
    correlation.ts                # buildCorrelationFigure()
    timeline.ts                   # buildTimelineFigure()
    map.ts                        # buildMapLibreStyle() + parseMapConfig()
  types.ts                        # Shared types
  defaults.ts                     # EXPORT_DEFAULTS, default map styles
```

### Refactored files

```
src/plugins/interactive-dashboard/components/cards/
  HistogramCard.vue               # calls buildHistogramFigure()
  ScatterCard.vue                 # calls buildScatterFigure()
  PieChartCard.vue                # calls buildPieFigure()
  CorrelationMatrixCard.vue       # calls buildCorrelationFigure()
  TimelineCard.vue                # calls buildTimelineFigure()
```

### Deleted files

```
scripts/export.ts                 # old Playwright CLI
src/.../export/ExportView.vue     # old browser export UI
src/.../export/ExportButton.vue   # old in-browser button
src/.../export/ExportPage.vue     # old route wrapper
src/router.ts                     # /export route removed
```

## Dependencies

### Added

| Package                          | Purpose                    |
|----------------------------------|----------------------------|
| `@maplibre/maplibre-gl-native`   | Server-side map rendering  |
| `sharp`                          | RGBA buffer -> PNG (maps)  |
| `resvg-js`                       | SVG -> PNG (charts)        |
| `jsdom`                          | Headless DOM for Plotly    |

### Removed (from export path)

| Package      | Reason                      |
|--------------|-----------------------------|
| `playwright` | No more headless browser    |

## Execution Phases

1. **Trace builders** — pure functions for 5 chart types + map config parser
2. **Chart renderer** — jsdom + plotly.js -> SVG/PNG pipeline
3. **Map renderer** — maplibre-gl-native + sharp pipeline
4. **Config parser** — dashboard YAML reading, card resolution, override cascade
5. **CLI** — argument parsing, orchestration, progress output
6. **Card refactoring** — all 5 Plotly cards refactored to use trace builders (parallelizable via agents)
7. **Cleanup** — remove old Playwright export system, ExportView, ExportButton, ExportPage, /export route
