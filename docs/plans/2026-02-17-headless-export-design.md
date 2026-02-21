# Headless Export System - Design Document

**Date:** 2026-02-17
**Status:** Approved
**Branch:** feature/scientific-mode

## Problem

Interactive dashboards cannot be included directly in dissertations, papers, or presentations. When simulation results change, manually re-creating screenshots is tedious and error-prone. Researchers need a way to define plot configurations declaratively and batch-export all figures automatically, so updated results can be copied directly into LaTeX/presentation folders.

## Solution Overview

A self-contained YAML-driven export system that:

1. Defines plots, data sources, and filter states in a standalone YAML file
2. Renders plots using the existing card components (HistogramCard, PieChartCard, ScatterCard, MapCard)
3. Exports them as PNG/SVG files packaged in a ZIP
4. Works both interactively (from dashboard UI) and headlessly (via CLI with Playwright)

## Architecture

### Approach: Injected Export Route + Thin CLI

The export logic lives inside SimWrapper as a Vue route (`/#/export`). A Playwright-based CLI script provides headless automation. Both entry points share the same ExportEngine.

```
src/plugins/interactive-dashboard/
├── export/
│   ├── ExportView.vue          # Progress UI (visible rendering + status)
│   ├── ExportEngine.ts         # Core: YAML parsing, state management, capture
│   └── ExportButton.vue        # Dropdown button for dashboard toolbar
scripts/
├── export.ts                   # Playwright CLI wrapper
```

### Data Flow

```
Export YAML → ExportEngine.parseConfig()
                ↓
         Load CSV data → DataTableManager
         Initialize FilterManager + StyleManager
                ↓
         For each state:
           Apply filters/colorBy/comparison → FilterManager
                ↓
           For each plot:
             Mount card component (visible in ExportView)
             Wait for render completion
             Capture via exportPlotlyChart() / exportMapCanvas()
             Store result + unmount
                ↓
         Package all results → ZIP download
         Signal completion (window.__exportComplete = true)
```

## Export YAML Configuration Format

Self-contained - no reference to any dashboard YAML needed.

```yaml
# export-dissertation.yaml

# Data source
table:
  file: od_trips.csv

# Global defaults (inherited by all states unless overridden)
defaults:
  format: png
  width: 1200
  height: 800
  scale: 2                    # 2x = ~300 DPI
  scientific: true            # Force scientific styling
  colorBy: main_mode

# Plot definitions (reusable across states)
plots:
  histogram-distance:
    type: histogram
    title: "Distance Distribution"
    column: distance
    bins: 20

  pie-mode:
    type: pie
    title: "Mode Share"
    column: main_mode

  scatter-dist-dur:
    type: scatter
    title: "Distance vs Duration"
    x: distance
    y: duration
    colorBy: main_mode

  map-clusters:
    type: map
    title: "Cluster Map"
    layers:
      - name: zones
        file: clusters.geojson
        type: polygon
    width: 1600
    height: 1000

# States - each defines data context + which plots to export
states:
  all-trips:
    # No filters = full dataset
    export:
      - histogram-distance
      - pie-mode
      - map-clusters

  long-trips:
    filters:
      distance: { min: 5000 }
    colorBy: pt_chain_type
    export:
      - scatter-dist-dur
      - histogram-distance

  car-vs-pt:
    filters:
      main_mode: [car, pt]
    comparison: true
    export:
      - histogram-distance
      - pie-mode

# Output configuration
output:
  directory: ./export
  naming: "{state}-{plot}"     # e.g., all-trips-histogram-distance.png
```

### Configuration Cascade

Settings cascade: `defaults` → state-level → plot-level. More specific overrides less specific.

| Setting | defaults | state | plot | Winner |
|---------|----------|-------|------|--------|
| format | png | - | svg | svg |
| width | 1200 | - | 1600 | 1600 |
| scientific | true | - | - | true |
| colorBy | main_mode | pt_chain_type | - | pt_chain_type |

### Filter Syntax

Matches existing FilterManager API:

```yaml
filters:
  distance: { min: 5000 }           # Numeric range: distance > 5000
  distance: { min: 1000, max: 5000 } # Numeric range: 1000 < distance < 5000
  main_mode: [car, pt]              # Categorical: include only car and pt
  main_mode: car                    # Categorical: single value
```

## ExportView Component

Visible progress UI that shows what's being rendered:

```
┌─────────────────────────────────────────────────────┐
│          Exporting: all-trips                       │
│                                                     │
│  ┌─────────────────────────────────────┐            │
│  │   [Currently rendering plot]        │ ← Live     │
│  │   Histogram: Distance Distribution  │   render   │
│  └─────────────────────────────────────┘            │
│                                                     │
│  ✓ all-trips-histogram-distance.png                 │
│  ⟳ all-trips-pie-mode.png (rendering...)            │
│  ○ all-trips-map-clusters.png                       │
│                                                     │
│  Progress: 1 / 7 plots  ████░░░░░░  14%            │
│  [Cancel]                                           │
└─────────────────────────────────────────────────────┘
```

After completion shows download button + summary.

## CLI Script

```bash
# Usage
npm run export -- path/to/export-config.yaml

# With output directory override
npm run export -- path/to/export-config.yaml --output ./figures
```

### Script behavior (scripts/export.ts):

1. Parse CLI args (config path, optional output override)
2. Auto-start a Vite dev server on an available port
3. Launch headless Chromium via Playwright
4. Navigate to `http://localhost:<port>/#/export?config=<path>`
5. Wait for `window.__exportComplete === true`
6. Intercept ZIP download via Playwright download handler
7. Save to output directory
8. Kill browser + dev server, exit with code 0

### package.json addition:

```json
{
  "scripts": {
    "export": "tsx scripts/export.ts"
  }
}
```

## Dashboard Integration

### Dashboard YAML export section:

```yaml
# In any dashboard YAML
export:
  - file: export-dissertation.yaml
    label: "Dissertation Figures"
  - file: export-presentation.yaml
    label: "Presentation Slides"
```

### ExportButton in toolbar:

- Dropdown button in InteractiveDashboard toolbar
- Lists configured export configs from dashboard YAML
- "Upload export config..." option for ad-hoc configs
- Selecting one opens ExportView as a fullscreen overlay

## Output Structure

Flat file organization with state prefix:

```
export/
├── all-trips-histogram-distance.png
├── all-trips-pie-mode.png
├── all-trips-map-clusters.png
├── long-trips-scatter-dist-dur.png
├── long-trips-histogram-distance.png
├── car-vs-pt-histogram-distance.png
└── car-vs-pt-pie-mode.png
```

Naming pattern: `{state}-{plot}.{format}` (configurable via `output.naming`).

## Key Design Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Export YAML is self-contained | No dashboard reference needed | Portable, testable independently, works without any dashboard |
| Playwright for headless | Not pure Node.js | Plotly/deck.gl need browser engine; Playwright reuses 100% of rendering code |
| Visible rendering in ExportView | Not off-screen | Shows progress, easier to debug, user sees what's being exported |
| Flat output with prefix | Not subfolders | Simpler LaTeX `\includegraphics` paths, easy to reference |
| CLI auto-starts server | Not require running dev server | Fully self-contained CLI command |
| Shared ExportEngine | Not separate implementations | Same code for interactive and CLI, no drift |

## Dependencies

| Package | Purpose | Status |
|---------|---------|--------|
| Playwright | Headless browser for CLI | Need to add as dependency |
| JSZip | ZIP file generation | Already installed |
| tsx | TypeScript script runner | Need to check/add |
| Vite (createServer API) | Programmatic dev server start | Already installed |

## Existing Code Reused

- `exportPlotlyChart()` / `exportMapCanvas()` from `utils/exportUtils.ts`
- `ExportConfig` / `ExportResult` types from `types/export.ts`
- `exportAllChartsAsZip()` for ZIP packaging
- `FilterManager` for state application
- `StyleManager` for scientific mode
- `DataTableManager` for data loading
- All card components (HistogramCard, PieChartCard, ScatterCard, MapCard)

## Scope

**In scope:**
- Export YAML format parsing and validation
- ExportEngine (state management, card rendering, capture)
- ExportView with progress UI
- ExportButton in dashboard toolbar
- CLI script with auto-start server
- PNG and SVG export formats
- Scientific mode integration

**Out of scope (future):**
- PDF export format
- Animated/GIF exports
- Export config editor UI (visual builder for export YAML)
- Parallel rendering (multiple cards at once)
- Remote server export (export on a different machine)
