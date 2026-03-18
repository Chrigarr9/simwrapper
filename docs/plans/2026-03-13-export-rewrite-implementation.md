# Export System Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Playwright-based headless browser export with a pure Node.js rendering pipeline using shared trace-builder functions, jsdom+plotly for charts, and maplibre-gl-native for maps.

**Architecture:** Pure functions extract Plotly trace/layout building from Vue card components. Export CLI reads dashboard YAML, resolves config cascade, builds figures via trace builders, renders via jsdom (charts) or maplibre-native (maps). Cards are refactored to call the same trace builders.

**Tech Stack:** TypeScript, plotly.js, jsdom, resvg-js, @maplibre/maplibre-gl-native, sharp, papaparse, yaml

**Design Doc:** `docs/plans/2026-03-13-export-rewrite-design.md`

---

## Phase 1: Foundation (Types, Config Parser, Style Resolver)

### Task 1: Shared Types & Defaults

**Files:**
- Create: `src/export/types.ts`
- Create: `src/export/defaults.ts`

**Step 1: Create shared types**

```typescript
// src/export/types.ts
import type { Data as PlotlyData, Layout as PlotlyLayout, Config as PlotlyConfig } from 'plotly.js'

/** Output of any trace builder — ready for Plotly.react() or jsdom Plotly.toImage() */
export interface PlotlyFigure {
  traces: PlotlyData[]
  layout: Partial<PlotlyLayout>
  config?: Partial<PlotlyConfig>
}

/** Visual style resolved from the override cascade */
export interface ChartStyle {
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
  selectedColor: string
  margin?: { l: number; r: number; t: number; b: number }
  isScientific: boolean
}

/** MapLibre style layer definition for export */
export interface MapExportLayer {
  id: string
  type: 'fill' | 'line' | 'circle'
  source: string
  paint: Record<string, any>
  layout?: Record<string, any>
  filter?: any[]
}

/** Map rendering config resolved from dashboard YAML */
export interface MapRenderConfig {
  center: [number, number]
  zoom: number
  width: number
  height: number
  scale: number
  styleUrl: string
  layers: MapExportLayer[]
  sources: Record<string, { type: 'geojson'; data: any }>
  legend?: LegendData
}

export interface LegendData {
  type: 'numeric' | 'categorical'
  title: string
  minValue?: number
  maxValue?: number
  minColor?: string
  maxColor?: string
  items?: Array<{ label: string; color: string }>
}

/** Resolved export item — one plot in one state */
export interface ExportItem {
  plotId: string
  stateId: string
  filename: string
  format: 'png' | 'svg'
  width: number
  height: number
  scale: number
  style: ChartStyle
  plotDef: Record<string, any>
  filters: Record<string, any>
  comparison: boolean
}

/** Export result — rendered image data */
export interface ExportResult {
  filename: string
  format: 'png' | 'svg'
  data: Buffer   // PNG buffer or SVG string as Buffer
}

/** Dashboard YAML structure (relevant parts) */
export interface DashboardConfig {
  table: { file: string; idColumn?: string; columns?: any }
  layout: Record<string, any[]>
  export?: ExportSection
}

export interface ExportSection {
  defaults?: Partial<ExportDefaults>
  plots?: Record<string, Partial<ExportDefaults> & Record<string, any>>
  states: Record<string, ExportStateConfig>
  output?: { naming?: string; directory?: string }
}

export interface ExportStateConfig {
  export: string[]
  filters?: Record<string, any>
  comparison?: boolean
  plots?: Record<string, Partial<ExportDefaults> & Record<string, any>>
}

export interface ExportDefaults {
  format: 'png' | 'svg'
  width: number
  height: number
  scale: number
  axisTitleFontSize: number
  axisTickFontSize: number
  legendTitleFontSize: number
  legendFontSize: number
  lineWidth: number
  markerSizeMultiplier: number
}

/** Linked export YAML — references a dashboard file */
export interface LinkedExportConfig {
  dashboard: string
  defaults?: Partial<ExportDefaults>
  plots?: Record<string, Partial<ExportDefaults> & Record<string, any>>
  states: Record<string, ExportStateConfig>
  output?: { naming?: string; directory?: string }
}
```

**Step 2: Create defaults**

```typescript
// src/export/defaults.ts
import type { ExportDefaults, ChartStyle } from './types'

export const EXPORT_DEFAULTS: ExportDefaults = {
  format: 'png',
  width: 1200,
  height: 800,
  scale: 2,
  axisTitleFontSize: 14,
  axisTickFontSize: 12,
  legendTitleFontSize: 13,
  legendFontSize: 12,
  lineWidth: 2.4,
  markerSizeMultiplier: 1.35,
}

export const PRINT_CHART_STYLE: ChartStyle = {
  axisTitleFontSize: 14,
  axisTickFontSize: 12,
  legendTitleFontSize: 13,
  legendFontSize: 12,
  lineWidth: 2.4,
  markerSizeMultiplier: 1.35,
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  gridColor: '#cccccc',
  barColor: '#0072B2',
  selectedColor: '#666666',
  isScientific: true,
}

export const MAP_STYLES: Record<string, string> = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'dark-matter': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}
```

**Step 3: Commit**

```bash
git add src/export/types.ts src/export/defaults.ts
git commit -m "feat(export): add shared types and defaults for export rewrite"
```

---

### Task 2: Config Parser

**Files:**
- Create: `src/export/configParser.ts`
- Create: `src/export/__tests__/configParser.test.ts`

**Step 1: Write tests for config parsing**

Test cases:
- Parses inline export section from dashboard YAML
- Parses linked export YAML and resolves dashboard reference
- Resolves card definitions from dashboard layout by name
- Applies 3-level override cascade (defaults → per-plot → per-state per-plot)
- Errors on unknown card name reference
- Handles missing optional fields with defaults

```typescript
// src/export/__tests__/configParser.test.ts
import { describe, it, expect } from 'vitest'
import { parseExportConfig, resolveExportPlan } from '../configParser'

const DASHBOARD_YAML = `
table:
  file: trips.csv
  idColumn: trip_id
layout:
  row1:
    - type: histogram
      name: dist-hist
      column: distance
      binSize: 5000
      title: Distance
    - type: pie-chart
      name: mode-pie
      column: mode
export:
  defaults:
    format: png
    width: 1000
    axisTitleFontSize: 16
  plots:
    dist-hist:
      width: 800
      height: 500
  states:
    all:
      export: [dist-hist, mode-pie]
    car-only:
      filters:
        mode: car
      export: [dist-hist]
      plots:
        dist-hist:
          title: Car Distance
  output:
    naming: "{state}-{plot}"
`

describe('parseExportConfig', () => {
  it('parses inline export section', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    expect(config.table.file).toBe('trips.csv')
    expect(config.cards).toHaveProperty('dist-hist')
    expect(config.cards['dist-hist'].type).toBe('histogram')
    expect(config.exportSection.states).toHaveProperty('all')
  })

  it('resolves cards from layout by name', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    expect(config.cards['dist-hist'].column).toBe('distance')
    expect(config.cards['mode-pie'].column).toBe('mode')
  })

  it('errors on unknown card reference', () => {
    const yaml = DASHBOARD_YAML.replace('dist-hist, mode-pie', 'dist-hist, nonexistent')
    expect(() => parseExportConfig(yaml)).toThrow(/nonexistent/)
  })
})

describe('resolveExportPlan', () => {
  it('applies 3-level override cascade', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    const plan = resolveExportPlan(config)

    // all/dist-hist: defaults.width=1000, plots.dist-hist.width=800 → 800 wins
    const allDistHist = plan.find(p => p.stateId === 'all' && p.plotId === 'dist-hist')!
    expect(allDistHist.width).toBe(800)
    expect(allDistHist.height).toBe(500)
    expect(allDistHist.style.axisTitleFontSize).toBe(16)

    // car-only/dist-hist: state-level title override
    const carDistHist = plan.find(p => p.stateId === 'car-only' && p.plotId === 'dist-hist')!
    expect(carDistHist.plotDef.title).toBe('Car Distance')
  })

  it('generates correct filenames', () => {
    const config = parseExportConfig(DASHBOARD_YAML)
    const plan = resolveExportPlan(config)
    const filenames = plan.map(p => p.filename)
    expect(filenames).toContain('all-dist-hist')
    expect(filenames).toContain('car-only-dist-hist')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
cd simwrapper && npx vitest run src/export/__tests__/configParser.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement configParser**

```typescript
// src/export/configParser.ts
import YAML from 'yaml'
import { EXPORT_DEFAULTS, PRINT_CHART_STYLE } from './defaults'
import type {
  DashboardConfig, ExportSection, LinkedExportConfig,
  ExportItem, ChartStyle, ExportDefaults
} from './types'

export interface ParsedExportConfig {
  table: { file: string; idColumn?: string; columns?: any }
  cards: Record<string, Record<string, any>>
  exportSection: ExportSection
  outputNaming: string
}

/**
 * Parse export config from YAML string.
 * Handles both inline (dashboard with export: section) and linked (separate export YAML).
 */
export function parseExportConfig(
  yamlText: string,
  dashboardYamlText?: string
): ParsedExportConfig {
  const parsed = YAML.parse(yamlText)

  // Detect mode: linked (has `dashboard` field) or inline (has `layout` + `export`)
  if (parsed.dashboard && dashboardYamlText) {
    return parseLinkedConfig(parsed as LinkedExportConfig, dashboardYamlText)
  }

  return parseInlineConfig(parsed as DashboardConfig)
}

function parseInlineConfig(dashboard: DashboardConfig): ParsedExportConfig {
  if (!dashboard.export) throw new Error('Dashboard YAML has no export: section')
  if (!dashboard.layout) throw new Error('Dashboard YAML has no layout: section')
  if (!dashboard.table?.file) throw new Error('Dashboard YAML has no table.file')

  const cards = resolveCardsFromLayout(dashboard.layout)
  validateCardReferences(cards, dashboard.export)

  return {
    table: dashboard.table,
    cards,
    exportSection: dashboard.export,
    outputNaming: dashboard.export.output?.naming ?? '{state}-{plot}',
  }
}

function parseLinkedConfig(
  exportConfig: LinkedExportConfig,
  dashboardYamlText: string
): ParsedExportConfig {
  const dashboard = YAML.parse(dashboardYamlText) as DashboardConfig
  if (!dashboard.layout) throw new Error('Referenced dashboard has no layout: section')
  if (!dashboard.table?.file) throw new Error('Referenced dashboard has no table.file')

  const cards = resolveCardsFromLayout(dashboard.layout)
  const exportSection: ExportSection = {
    defaults: exportConfig.defaults,
    plots: exportConfig.plots,
    states: exportConfig.states,
    output: exportConfig.output,
  }
  validateCardReferences(cards, exportSection)

  return {
    table: dashboard.table,
    cards,
    exportSection,
    outputNaming: exportConfig.output?.naming ?? '{state}-{plot}',
  }
}

/** Flatten layout rows into a name→cardDef map */
function resolveCardsFromLayout(
  layout: Record<string, any[]>
): Record<string, Record<string, any>> {
  const cards: Record<string, Record<string, any>> = {}
  for (const rowCards of Object.values(layout)) {
    if (!Array.isArray(rowCards)) continue
    for (const card of rowCards) {
      if (card && typeof card === 'object' && card.name && card.type) {
        cards[card.name] = card
      }
    }
  }
  return cards
}

/** Validate all card references in export states exist */
function validateCardReferences(
  cards: Record<string, Record<string, any>>,
  exportSection: ExportSection
): void {
  for (const [stateId, state] of Object.entries(exportSection.states)) {
    for (const plotId of state.export) {
      if (!cards[plotId]) {
        throw new Error(
          `Export state "${stateId}" references card "${plotId}" which is not defined in layout. ` +
          `Available cards: ${Object.keys(cards).join(', ')}`
        )
      }
    }
  }
}

/**
 * Resolve the full export plan: one ExportItem per state+plot combination.
 * Applies 3-level override cascade: defaults → per-plot → per-state per-plot.
 */
export function resolveExportPlan(config: ParsedExportConfig): ExportItem[] {
  const plan: ExportItem[] = []
  const globalDefaults = { ...EXPORT_DEFAULTS, ...config.exportSection.defaults }

  for (const [stateId, stateDef] of Object.entries(config.exportSection.exportSection?.states ?? config.exportSection.states)) {
    for (const plotId of stateDef.export) {
      const cardDef = { ...config.cards[plotId] }
      const plotOverrides = config.exportSection.plots?.[plotId] ?? {}
      const stateOverrides = stateDef.plots?.[plotId] ?? {}

      // Cascade: globalDefaults → plotOverrides → stateOverrides
      const format = (stateOverrides.format ?? plotOverrides.format ?? globalDefaults.format) as 'png' | 'svg'
      const width = stateOverrides.width ?? plotOverrides.width ?? globalDefaults.width
      const height = stateOverrides.height ?? plotOverrides.height ?? globalDefaults.height
      const scale = stateOverrides.scale ?? plotOverrides.scale ?? globalDefaults.scale

      // Style cascade
      const style: ChartStyle = {
        ...PRINT_CHART_STYLE,
        axisTitleFontSize: stateOverrides.axisTitleFontSize ?? plotOverrides.axisTitleFontSize ?? globalDefaults.axisTitleFontSize,
        axisTickFontSize: stateOverrides.axisTickFontSize ?? plotOverrides.axisTickFontSize ?? globalDefaults.axisTickFontSize,
        legendTitleFontSize: stateOverrides.legendTitleFontSize ?? plotOverrides.legendTitleFontSize ?? globalDefaults.legendTitleFontSize,
        legendFontSize: stateOverrides.legendFontSize ?? plotOverrides.legendFontSize ?? globalDefaults.legendFontSize,
        lineWidth: stateOverrides.lineWidth ?? plotOverrides.lineWidth ?? globalDefaults.lineWidth,
        markerSizeMultiplier: stateOverrides.markerSizeMultiplier ?? plotOverrides.markerSizeMultiplier ?? globalDefaults.markerSizeMultiplier,
      }

      // Plot def: card base → plot overrides → state overrides (for title, binSize, etc.)
      const plotDef = { ...cardDef, ...plotOverrides, ...stateOverrides }
      // Remove export-only keys from plotDef
      delete plotDef.format
      delete plotDef.width
      delete plotDef.height
      delete plotDef.scale

      const filename = config.outputNaming
        .replace('{state}', stateId)
        .replace('{plot}', plotId)

      plan.push({
        plotId,
        stateId,
        filename,
        format,
        width,
        height,
        scale,
        style,
        plotDef,
        filters: stateDef.filters ?? {},
        comparison: stateDef.comparison ?? false,
      })
    }
  }

  return plan
}
```

**Step 4: Run tests to verify they pass**

```bash
cd simwrapper && npx vitest run src/export/__tests__/configParser.test.ts
```

**Step 5: Commit**

```bash
git add src/export/configParser.ts src/export/__tests__/configParser.test.ts
git commit -m "feat(export): config parser with 3-level override cascade"
```

---

## Phase 2: Trace Builders (Parallelizable — one agent per builder)

Each trace builder follows the same pattern:
1. Pure function: `(input, style) → PlotlyFigure`
2. No Vue, no DOM, no StyleManager dependency (colors passed in via ChartStyle)
3. Unit tested with sample data

### Task 3: Histogram Trace Builder

**Files:**
- Create: `src/export/trace-builders/histogram.ts`
- Create: `src/export/trace-builders/__tests__/histogram.test.ts`

**Context for implementer:** Read `src/plugins/interactive-dashboard/components/cards/HistogramCard.vue` for the current implementation. The trace builder must replicate:
- Bin computation: `Math.floor(val / binSize) * binSize`
- Comparison mode: baseline trace (gray, overlay) + filtered trace
- Categorical colorBy: stacked bar traces (one per category)
- Numeric colorBy: single trace with Viridis colorscale + colorbar
- Tick formatting and adaptive thinning
- Layout: bargap, barmode, legend positioning

**Input interface:**

```typescript
export interface HistogramInput {
  filteredData: any[]
  baselineData?: any[]
  column: string
  idColumn?: string
  binSize?: number
  title?: string
  xMin?: number
  xMax?: number
  autoTrim?: number
  colorBy?: string
  colorByType?: 'categorical' | 'numeric'
  colorMap?: Map<string, string>
  showComparison?: boolean
}
```

**Key behaviors to implement:**
- `buildHistogramFigure(input: HistogramInput, style: ChartStyle): PlotlyFigure`
- Bin edges aligned to `binSize` boundaries: `Math.floor(val / binSize) * binSize`
- Comparison mode: `barmode: 'overlay'`, baseline at 85% bar width, comparison line styling
- Categorical: `barmode: 'stack'`, legend with title, right margin 100px
- Numeric: Viridis colorscale, colorbar with formatted title
- Explicit margins, font sizes, colors from `style` parameter
- Adaptive tick thinning: max ~12 ticks, skip interval when >maxTicks bins
- `displayModeBar: false` in config

**Tests:** Verify trace count, trace types, layout properties, comparison overlay, categorical stacking.

**Commit:** `feat(export): histogram trace builder`

---

### Task 4: Scatter Trace Builder

**Files:**
- Create: `src/export/trace-builders/scatter.ts`
- Create: `src/export/trace-builders/__tests__/scatter.test.ts`

**Context:** Read `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue`. Most complex card. Must replicate:
- 5 trace paths: baseline, categorical colorBy, numeric colorBy, colorColumn grouping, single trace
- Secondary Y-axis (yColumnRight) with `yaxis: 'y2'`, `overlaying: 'y'`, `side: 'right'`
- connectLines: `mode: 'lines+markers'`, sorted by X, scientific dash patterns
- Scientific mode: distinct marker symbols per category, line dash patterns
- Per-point marker sizing via sizeColumn (clamped 5-25)
- Axis ranges from baseline data (stable on filter), with 5% padding
- xAutoTrim/yAutoTrim percentile-based range
- Legend: positioned right of plot, title from colorBy attribute
- Right margin varies: 160 (secondary+legend), 100 (legend), 80 (colorbar), 15 (none)

**Input interface:**

```typescript
export interface ScatterInput {
  filteredData: any[]
  baselineData?: any[]
  xColumn: string
  yColumn: string
  yColumnRight?: string
  idColumn?: string
  colorColumn?: string
  colorBy?: string
  colorByType?: 'categorical' | 'numeric'
  colorMap?: Map<string, string>
  sizeColumn?: string
  markerSize?: number
  connectLines?: boolean
  showComparison?: boolean
  title?: string
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  xAutoTrim?: number
  yAutoTrim?: number
  scientificSymbols?: string[]
  scientificLinePatterns?: string[]
}
```

**Key behaviors:**
- `buildScatterFigure(input: ScatterInput, style: ChartStyle): PlotlyFigure`
- Baseline trace: gray markers at 0.8x size, `circle-open` in scientific mode
- Categorical: one trace per category, sorted legend values
- Numeric: single trace with Viridis colorscale, colorbar
- Secondary Y: separate traces with `yaxis: 'y2'`, dashed lines, open symbols
- Scientific: `getScientificMarkerSymbol()` equivalent, `getScientificLinePattern()` equivalent
- Axis: `tickformat: '.5~g'`, `nticks: 10`
- For export: no hover/selection state (static output)

**Tests:** Verify trace count per mode, secondary axis config, legend, colorscale, scientific symbols.

**Commit:** `feat(export): scatter trace builder`

---

### Task 5: Pie Chart Trace Builder

**Files:**
- Create: `src/export/trace-builders/pie.ts`
- Create: `src/export/trace-builders/__tests__/pie.test.ts`

**Context:** Read `PieChartCard.vue`. Must replicate:
- Donut chart: `hole: 0.3` (or 0.4 for comparison inner ring)
- Comparison mode: inner ring (filtered, hole 0.4) + outer ring (baseline, hole 0.7)
- Text positioning: inside if >=20% (comparison), >=10% (normal); outside if >=3%; else hidden
- Scientific mode: pattern fills per category (`shape` array in `marker.pattern`)
- Category colors from colorMap, dimmed opacity for unselected/baseline
- Center annotation: count (or "filtered of baseline" in comparison)
- Legend: vertical, right-aligned, category title

**Input interface:**

```typescript
export interface PieInput {
  filteredData: any[]
  baselineData?: any[]
  column: string
  idColumn?: string
  title?: string
  colorBy?: string
  colorMap?: Map<string, string>
  showComparison?: boolean
  scientificPatterns?: string[]
}
```

**Tests:** Verify donut hole, comparison dual-ring, pattern fills, text positioning, center annotation.

**Commit:** `feat(export): pie chart trace builder`

---

### Task 6: Correlation Matrix Trace Builder

**Files:**
- Create: `src/export/trace-builders/correlation.ts`
- Create: `src/export/trace-builders/__tests__/correlation.test.ts`

**Context:** Read `CorrelationMatrixCard.vue`. Must replicate:
- Pearson correlation computation: `computeCorrelationGrid(data, attributes)`
- Heatmap trace: `type: 'heatmap'`, diverging colorscale (blue→white→red), `zmin: -1, zmax: 1`
- Lower triangle masking: `matrixPart: 'lower'` sets upper cells to NaN
- Cell value annotations: compact format (`.45` not `0.45`), white text on dark cells
- P-value and sample size in hover customdata
- Dynamic margins based on label length
- Reversed Y-axis (matrix convention)

**Input interface:**

```typescript
export interface CorrelationInput {
  filteredData: any[]
  attributes?: string[]
  leftAttributes?: string[]
  bottomAttributes?: string[]
  matrixPart?: 'full' | 'lower'
  showValues?: 'always' | 'never' | 'auto'
  pValueThreshold?: number
  title?: string
}
```

**Tests:** Verify correlation values, heatmap colorscale, lower triangle masking, annotations.

**Commit:** `feat(export): correlation matrix trace builder`

---

### Task 7: Timeline Trace Builder

**Files:**
- Create: `src/export/trace-builders/timeline.ts`
- Create: `src/export/trace-builders/__tests__/timeline.test.ts`

**Context:** Read `TimelineCard.vue`. Must replicate:
- Gantt-style horizontal bars: `type: 'bar', orientation: 'h'`
- Track allocation: greedy interval partitioning (no overlaps)
- Time axis: tick labels as HH:MM, range 0-86400 seconds
- Degree-based coloring (categorical palette)
- barmode: 'overlay' for constraint windows behind actual travel
- No Y-axis tick labels (swim lanes)

**Input interface:**

```typescript
export interface TimelineInput {
  filteredData: any[]
  idColumn?: string
  startColumn?: string
  endColumn?: string
  degreeColumn?: string
  title?: string
  colorBy?: string
  colorByType?: 'categorical' | 'numeric'
  colorMap?: Map<string, string>
}
```

**Tests:** Verify horizontal bar traces, track allocation, time formatting.

**Commit:** `feat(export): timeline trace builder`

---

### Task 8: Map Config Builder

**Files:**
- Create: `src/export/trace-builders/map.ts`
- Create: `src/export/trace-builders/__tests__/map.test.ts`

**Context:** Read `MapCard.vue`. Does NOT produce a PlotlyFigure — produces MapRenderConfig for the map renderer.

**Key behaviors:**
- `buildMapRenderConfig(input: MapInput, style: MapStyle): MapRenderConfig`
- Translate dashboard layer configs to MapLibre style layers:
  - `polygon` → `fill` layer + `line` layer (for borders)
  - `scatterplot` → `circle` layer
  - `line` → `line` layer
  - `arc` → Generate bezier curve LineString geometry + `line` layer
- Build GeoJSON sources from layer file data
- Resolve colorBy: categorical → data-driven `fill-color`/`circle-color` with `match` expression; numeric → interpolate expression
- Handle `widthBy`/`radiusBy` → data-driven `line-width`/`circle-radius` with `interpolate` expression
- Static property filters → MapLibre filter expressions

**Input interface:**

```typescript
export interface MapInput {
  layers: Array<{
    name: string
    type: 'polygon' | 'fill' | 'line' | 'arc' | 'scatterplot'
    geojsonData: GeoJSON.FeatureCollection
    fillColor?: string
    fillOpacity?: number
    lineColor?: string
    lineWidth?: number
    color?: string
    opacity?: number
    radius?: number
    colorBy?: any
    widthBy?: any
    radiusBy?: any
    arcHeight?: number
    arcTilt?: number
  }>
  center?: [number, number]
  zoom?: number
  mapStyle?: string
}
```

**Arc → LineString conversion:**

```typescript
function arcToLineString(
  source: [number, number],
  target: [number, number],
  height: number,
  segments: number = 20
): GeoJSON.Feature<GeoJSON.LineString> {
  // Quadratic bezier in projected space
  const midLng = (source[0] + target[0]) / 2
  const midLat = (source[1] + target[1]) / 2 + height * 2
  const coords: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const lng = (1-t)*(1-t)*source[0] + 2*(1-t)*t*midLng + t*t*target[0]
    const lat = (1-t)*(1-t)*source[1] + 2*(1-t)*t*midLat + t*t*target[1]
    coords.push([lng, lat])
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
}
```

**Tests:** Verify layer translation, arc geometry, color expressions, filter expressions.

**Commit:** `feat(export): map config builder with deck.gl → MapLibre translation`

---

### Task 9: Trace Builder Registry

**Files:**
- Create: `src/export/trace-builders/index.ts`

**Step 1: Create registry mapping card types to builders**

```typescript
// src/export/trace-builders/index.ts
import { buildHistogramFigure } from './histogram'
import { buildScatterFigure } from './scatter'
import { buildPieFigure } from './pie'
import { buildCorrelationFigure } from './correlation'
import { buildTimelineFigure } from './timeline'
import { buildMapRenderConfig } from './map'
import type { PlotlyFigure, ChartStyle, MapRenderConfig } from '../types'

export type ChartBuilder = (input: any, style: ChartStyle) => PlotlyFigure

export const CHART_BUILDERS: Record<string, ChartBuilder> = {
  histogram: buildHistogramFigure,
  'scatter-plot': buildScatterFigure,
  'pie-chart': buildPieFigure,
  'correlation-matrix': buildCorrelationFigure,
  timeline: buildTimelineFigure,
}

export const MAP_BUILDER = buildMapRenderConfig

export function isMapType(type: string): boolean {
  return type === 'map'
}

export { buildHistogramFigure, buildScatterFigure, buildPieFigure }
export { buildCorrelationFigure, buildTimelineFigure, buildMapRenderConfig }
```

**Commit:** `feat(export): trace builder registry`

---

## Phase 3: Renderers

### Task 10: Chart Renderer (jsdom + plotly → SVG → PNG)

**Files:**
- Create: `src/export/renderers/chartRenderer.ts`
- Create: `src/export/renderers/__tests__/chartRenderer.test.ts`

**Step 1: Install dependencies**

```bash
cd simwrapper && npm install --save-dev jsdom resvg-js @types/jsdom
```

**Step 2: Implement chart renderer**

```typescript
// src/export/renderers/chartRenderer.ts
import { JSDOM } from 'jsdom'
import { Resvg } from '@aspect-js/resvg-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { PlotlyFigure, ExportResult } from '../types'

const PLOTLY_JS_PATH = require.resolve('plotly.js-dist')

let plotlyJsSource: string | null = null

function getPlotlySource(): string {
  if (!plotlyJsSource) {
    plotlyJsSource = readFileSync(PLOTLY_JS_PATH, 'utf-8')
  }
  return plotlyJsSource
}

/**
 * Render a PlotlyFigure to SVG string using jsdom.
 */
export async function renderToSVG(
  figure: PlotlyFigure,
  width: number,
  height: number,
  scale: number
): Promise<string> {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="plot"></div></body></html>', {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  })
  const { window } = dom

  // Stub APIs that Plotly expects but jsdom doesn't have
  ;(window as any).HTMLCanvasElement.prototype.getContext = () => null
  ;(window as any).URL.createObjectURL = () => ''

  // Load plotly.js into jsdom
  window.eval(getPlotlySource())

  const plotDiv = window.document.getElementById('plot')!

  // Render the figure
  await (window as any).Plotly.newPlot(plotDiv, figure.traces, {
    ...figure.layout,
    width: width * scale,
    height: height * scale,
  }, { staticPlot: true, ...figure.config })

  // Export to SVG
  const svgData = await (window as any).Plotly.toImage(plotDiv, {
    format: 'svg',
    width: width * scale,
    height: height * scale,
  })

  // Clean up
  dom.window.close()

  // Strip data URL prefix
  const svgString = svgData.replace(/^data:image\/svg\+xml,/, '')
  return decodeURIComponent(svgString)
}

/**
 * Render a PlotlyFigure to PNG buffer via SVG → resvg.
 */
export async function renderToPNG(
  figure: PlotlyFigure,
  width: number,
  height: number,
  scale: number
): Promise<Buffer> {
  const svg = await renderToSVG(figure, width, height, scale)
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width * scale },
  })
  const rendered = resvg.render()
  return rendered.asPng()
}

/**
 * Render a PlotlyFigure to the requested format.
 */
export async function renderChart(
  figure: PlotlyFigure,
  filename: string,
  format: 'png' | 'svg',
  width: number,
  height: number,
  scale: number
): Promise<ExportResult> {
  if (format === 'svg') {
    const svg = await renderToSVG(figure, width, height, scale)
    return { filename, format: 'svg', data: Buffer.from(svg, 'utf-8') }
  }

  const png = await renderToPNG(figure, width, height, scale)
  return { filename, format: 'png', data: png }
}
```

**Step 3: Write integration test** (renders a simple histogram to SVG, checks it's valid SVG)

**Step 4: Commit**

```bash
git add src/export/renderers/chartRenderer.ts src/export/renderers/__tests__/chartRenderer.test.ts
git commit -m "feat(export): chart renderer with jsdom + plotly → SVG → resvg → PNG"
```

---

### Task 11: Map Renderer (maplibre-gl-native + sharp)

**Files:**
- Create: `src/export/renderers/mapRenderer.ts`
- Create: `src/export/renderers/__tests__/mapRenderer.test.ts`

**Step 1: Install dependencies**

```bash
cd simwrapper && npm install @maplibre/maplibre-gl-native sharp
```

**Step 2: Implement map renderer**

```typescript
// src/export/renderers/mapRenderer.ts
import mbgl from '@maplibre/maplibre-gl-native'
import sharp from 'sharp'
import type { MapRenderConfig, ExportResult, LegendData } from '../types'

/**
 * Fetch a remote resource (tile, sprite, glyph) for maplibre-gl-native.
 */
async function fetchResource(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Render a map to PNG using maplibre-gl-native.
 */
export async function renderMap(
  config: MapRenderConfig,
  filename: string
): Promise<ExportResult> {
  const { width, height, scale, center, zoom, styleUrl, sources, layers } = config

  const pixelWidth = Math.round(width * scale)
  const pixelHeight = Math.round(height * scale)

  // Load the base style
  const styleResponse = await fetch(styleUrl)
  const style = await styleResponse.json()

  // Add GeoJSON sources
  for (const [name, source] of Object.entries(sources)) {
    style.sources[name] = source
  }

  // Add data layers
  style.layers.push(...layers)

  return new Promise<ExportResult>((resolve, reject) => {
    const map = new mbgl.Map({
      request: (req: { url: string; kind: number }, callback: Function) => {
        fetchResource(req.url)
          .then(data => callback(null, { data }))
          .catch(err => {
            console.warn(`[mapRenderer] Failed to fetch ${req.url}: ${err.message}`)
            callback(err)
          })
      },
      ratio: scale,
    })

    map.load(style)

    map.render(
      { zoom, center: [center[0], center[1]], width: pixelWidth, height: pixelHeight },
      async (err: Error | null, buffer: Buffer) => {
        map.release()

        if (err) return reject(err)

        try {
          const png = await sharp(buffer, {
            raw: { width: pixelWidth, height: pixelHeight, channels: 4 },
          })
            .png()
            .toBuffer()

          // TODO: composite legend overlay if config.legend is set

          resolve({ filename, format: 'png', data: png })
        } catch (sharpErr) {
          reject(sharpErr)
        }
      }
    )
  })
}
```

**Step 3: Write test** (loads a simple style, renders to PNG buffer, checks buffer is valid PNG header)

**Step 4: Commit**

```bash
git add src/export/renderers/mapRenderer.ts src/export/renderers/__tests__/mapRenderer.test.ts
git commit -m "feat(export): map renderer with maplibre-gl-native + sharp"
```

---

## Phase 4: CLI

### Task 12: CLI Entry Point & Orchestration

**Files:**
- Create: `src/export/cli.ts`
- Modify: `package.json` (add bin + script)

**Step 1: Implement CLI**

```typescript
// src/export/cli.ts
import { resolve, dirname, basename } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import YAML from 'yaml'
import Papa from 'papaparse'

import { parseExportConfig, resolveExportPlan } from './configParser'
import { CHART_BUILDERS, MAP_BUILDER, isMapType } from './trace-builders'
import { renderChart } from './renderers/chartRenderer'
import { renderMap } from './renderers/mapRenderer'
import { FilterManager } from '../plugins/interactive-dashboard/managers/FilterManager'
import type { ExportResult } from './types'

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: simwrapper export <config.yaml> [--output <dir>] [--states <s1,s2>] [--format png|svg] [--scale N]')
    process.exit(0)
  }

  // Parse CLI args
  const configPath = resolve(args[0])
  if (!existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`)
    process.exit(1)
  }

  let outputDir = resolve(dirname(configPath), 'export')
  let statesFilter: string[] | null = null
  let formatOverride: 'png' | 'svg' | null = null
  let scaleOverride: number | null = null

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) { outputDir = resolve(args[++i]); continue }
    if (args[i] === '--states' && args[i + 1]) { statesFilter = args[++i].split(','); continue }
    if (args[i] === '--format' && args[i + 1]) { formatOverride = args[++i] as any; continue }
    if (args[i] === '--scale' && args[i + 1]) { scaleOverride = Number(args[++i]); continue }
  }

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

  // Parse config
  const yamlText = readFileSync(configPath, 'utf-8')
  const parsed = YAML.parse(yamlText)

  let dashboardYaml: string | undefined
  if (parsed.dashboard) {
    const dashboardPath = resolve(dirname(configPath), parsed.dashboard)
    if (!existsSync(dashboardPath)) {
      console.error(`Error: Referenced dashboard not found: ${dashboardPath}`)
      process.exit(1)
    }
    dashboardYaml = readFileSync(dashboardPath, 'utf-8')
  }

  const config = parseExportConfig(yamlText, dashboardYaml)
  let plan = resolveExportPlan(config)

  // Apply CLI overrides
  if (statesFilter) plan = plan.filter(p => statesFilter!.includes(p.stateId))
  if (formatOverride) plan.forEach(p => { p.format = formatOverride! })
  if (scaleOverride) plan.forEach(p => { p.scale = scaleOverride! })

  console.log(`simwrapper export`)
  console.log(`Config: ${basename(configPath)} (${plan.length} exports)`)
  console.log(`Output: ${outputDir}\n`)

  // Load CSV data
  const csvPath = resolve(dirname(configPath), config.table.file)
  const csvText = readFileSync(csvPath, 'utf-8')
  const allData: any[] = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true }).data as any[]

  // Build filter manager
  const filterManager = new FilterManager()
  filterManager.buildIndex(allData)

  // Group by state
  const stateGroups = new Map<string, typeof plan>()
  for (const item of plan) {
    const group = stateGroups.get(item.stateId) || []
    group.push(item)
    stateGroups.set(item.stateId, group)
  }

  // Process each state
  const results: ExportResult[] = []
  let completed = 0
  const startTime = Date.now()

  for (const [stateId, items] of stateGroups) {
    // Apply filters for this state
    filterManager.clearAllFilters()
    const filters = items[0].filters
    // (reuse applyFilters logic from ExportEngine)
    for (const [column, filterDef] of Object.entries(filters)) {
      if (typeof filterDef === 'string' || typeof filterDef === 'number') {
        filterManager.setFilter(`export-${column}`, column, new Set([filterDef]), 'categorical')
      } else if (Array.isArray(filterDef)) {
        filterManager.setFilter(`export-${column}`, column, new Set(filterDef), 'categorical')
      } else if (typeof filterDef === 'object' && filterDef !== null) {
        const { min, max } = filterDef as { min?: number; max?: number }
        const matching = new Set(allData.filter(r => {
          const v = r[column]; if (v == null) return false
          if (min !== undefined && v < min) return false
          if (max !== undefined && v > max) return false
          return true
        }).map(r => r[column]))
        if (matching.size > 0) filterManager.setFilter(`export-${column}`, column, matching, 'range')
      }
    }

    const idColumn = config.table.idColumn || 'id'
    const filteredData = filterManager.hasActiveFilters()
      ? filterManager.getFilteredData(allData, idColumn)
      : allData

    // Render each plot
    for (const item of items) {
      const itemStart = Date.now()
      completed++

      try {
        let result: ExportResult

        if (isMapType(item.plotDef.type)) {
          // Load GeoJSON files for map layers
          // Build MapRenderConfig via MAP_BUILDER
          // Render via mapRenderer
          const mapConfig = MAP_BUILDER(
            { ...item.plotDef, layers: await loadMapLayers(item.plotDef, dirname(configPath)) },
            item.style as any
          )
          result = await renderMap({ ...mapConfig, width: item.width, height: item.height, scale: item.scale }, item.filename)
        } else {
          const builder = CHART_BUILDERS[item.plotDef.type]
          if (!builder) throw new Error(`No trace builder for type: ${item.plotDef.type}`)

          const figure = builder(
            { ...item.plotDef, filteredData, baselineData: allData, showComparison: item.comparison },
            item.style
          )
          result = await renderChart(figure, item.filename, item.format, item.width, item.height, item.scale)
        }

        // Write output
        const ext = result.format
        const outPath = resolve(outputDir, `${result.filename}.${ext}`)
        writeFileSync(outPath, result.data)

        const elapsed = ((Date.now() - itemStart) / 1000).toFixed(1)
        const pad = `[${completed}/${plan.length}]`.padEnd(8)
        console.log(`${pad} ${stateId}/${item.plotId} ${'·'.repeat(30)} ${ext} ${item.width}x${item.height}  ${elapsed}s`)

        results.push(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[${completed}/${plan.length}] ${stateId}/${item.plotId} FAILED: ${msg}`)
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nDone! ${results.length} files written to ${outputDir} (${totalTime}s)`)
}

async function loadMapLayers(plotDef: any, baseDir: string): Promise<any[]> {
  // Load GeoJSON files for each layer
  const layers = []
  for (const layerDef of (plotDef.layers || [])) {
    const geojsonPath = resolve(baseDir, layerDef.file)
    if (existsSync(geojsonPath)) {
      const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8'))
      layers.push({ ...layerDef, geojsonData: geojson })
    } else {
      console.warn(`Warning: GeoJSON file not found: ${geojsonPath}`)
    }
  }
  return layers
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
```

**Step 2: Add to package.json**

```json
{
  "bin": {
    "simwrapper": "./bin/simwrapper.js"
  },
  "scripts": {
    "export": "tsx src/export/cli.ts"
  }
}
```

**Step 3: Commit**

```bash
git add src/export/cli.ts package.json
git commit -m "feat(export): CLI entry point with orchestration pipeline"
```

---

## Phase 5: Card Refactoring (Parallelizable — one agent per card)

Each card gets the same treatment:
1. Import the corresponding trace builder
2. Replace inline trace/layout building with a call to the builder
3. Keep all Vue-specific logic (event handlers, watches, DOM management)
4. Verify the interactive dashboard still works

### Task 13: Refactor HistogramCard to use trace builder

**Files:**
- Modify: `src/plugins/interactive-dashboard/components/cards/HistogramCard.vue`
- Test: Run dev server, verify histogram renders and interacts correctly

**Pattern:**

```typescript
// Before (in HistogramCard.vue):
const buildChartData = () => {
  // 200+ lines building traces and layout inline
}

// After:
import { buildHistogramFigure } from '@/export/trace-builders/histogram'

const buildChartData = () => {
  const styleManager = StyleManager.getInstance()
  const style: ChartStyle = {
    axisTitleFontSize: 11,
    axisTickFontSize: 10,
    // ... resolve from StyleManager for interactive mode
  }
  const input: HistogramInput = {
    filteredData: props.filteredData,
    baselineData: props.baselineData,
    column: props.column,
    binSize: props.binSize,
    // ... map props to input
  }
  const figure = buildHistogramFigure(input, style)

  // Apply interactive-specific overrides (hover, selection highlights)
  // These don't go in the trace builder since they're Vue-only concerns
  applyInteractiveHighlights(figure, props.hoveredIds, props.selectedIds)

  return figure
}
```

**Key: interactive highlights (hover/selection) are applied AFTER the trace builder call**, since the builder produces static output. The card applies per-point color/size overrides for hovered/selected state on top.

**Commit:** `refactor(histogram): use shared trace builder`

---

### Task 14: Refactor ScatterCard to use trace builder

**Files:**
- Modify: `src/plugins/interactive-dashboard/components/cards/ScatterCard.vue`

Same pattern as Task 13. Most complex refactoring due to 5 trace paths + secondary Y axis.

**Commit:** `refactor(scatter): use shared trace builder`

---

### Task 15: Refactor PieChartCard to use trace builder

**Files:**
- Modify: `src/plugins/interactive-dashboard/components/cards/PieChartCard.vue`

**Commit:** `refactor(pie): use shared trace builder`

---

### Task 16: Refactor CorrelationMatrixCard to use trace builder

**Files:**
- Modify: `src/plugins/interactive-dashboard/components/cards/CorrelationMatrixCard.vue`

**Commit:** `refactor(correlation): use shared trace builder`

---

### Task 17: Refactor TimelineCard to use trace builder

**Files:**
- Modify: `src/plugins/interactive-dashboard/components/cards/TimelineCard.vue`

**Commit:** `refactor(timeline): use shared trace builder`

---

## Phase 6: Cleanup

### Task 18: Remove old export system

**Files:**
- Delete: `scripts/export.ts`
- Delete: `src/plugins/interactive-dashboard/export/ExportView.vue`
- Delete: `src/plugins/interactive-dashboard/export/ExportButton.vue`
- Delete: `src/plugins/interactive-dashboard/export/ExportPage.vue`
- Delete: `src/plugins/interactive-dashboard/export/ExportEngine.ts`
- Modify: `src/router.ts` — remove `/export` route
- Modify: `package.json` — remove `playwright` from devDependencies
- Delete: `tests/e2e/export.spec.ts`

**Step 1: Remove files**

```bash
rm scripts/export.ts
rm src/plugins/interactive-dashboard/export/ExportView.vue
rm src/plugins/interactive-dashboard/export/ExportButton.vue
rm src/plugins/interactive-dashboard/export/ExportPage.vue
rm src/plugins/interactive-dashboard/export/ExportEngine.ts
rm tests/e2e/export.spec.ts
```

**Step 2: Remove /export route from router.ts**

Find and remove the export route entry.

**Step 3: Remove ExportButton references from dashboard components**

Search for `ExportButton` imports in dashboard files and remove them.

**Step 4: Remove playwright dependency**

```bash
npm uninstall playwright
```

**Step 5: Verify build**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove old Playwright-based export system"
```

---

## Dependency Graph

```
Phase 1 (Foundation)
  Task 1: Types & Defaults
  Task 2: Config Parser        ← depends on Task 1

Phase 2 (Trace Builders) — ALL PARALLEL, depend on Task 1 only
  Task 3: Histogram builder
  Task 4: Scatter builder
  Task 5: Pie builder
  Task 6: Correlation builder
  Task 7: Timeline builder
  Task 8: Map config builder
  Task 9: Registry             ← depends on Tasks 3-8

Phase 3 (Renderers) — PARALLEL with Phase 2
  Task 10: Chart renderer      ← depends on Task 1
  Task 11: Map renderer        ← depends on Task 1

Phase 4 (CLI)
  Task 12: CLI entry point     ← depends on Tasks 2, 9, 10, 11

Phase 5 (Card Refactoring) — ALL PARALLEL, depend on Tasks 3-8
  Task 13: HistogramCard       ← depends on Task 3
  Task 14: ScatterCard         ← depends on Task 4
  Task 15: PieChartCard        ← depends on Task 5
  Task 16: CorrelationCard     ← depends on Task 6
  Task 17: TimelineCard        ← depends on Task 7

Phase 6 (Cleanup)
  Task 18: Remove old system   ← depends on Tasks 12-17
```

## Agent Parallelization Strategy

**Wave 1:** Tasks 1 (types) — sequential, foundation
**Wave 2:** Tasks 2 (config parser) + 10 (chart renderer) + 11 (map renderer) — parallel
**Wave 3:** Tasks 3-8 (all trace builders) — 6 agents in parallel
**Wave 4:** Task 9 (registry) + Task 12 (CLI) — sequential
**Wave 5:** Tasks 13-17 (all card refactors) — 5 agents in parallel
**Wave 6:** Task 18 (cleanup) — sequential
