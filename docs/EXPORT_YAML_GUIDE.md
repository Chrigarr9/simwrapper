# SimWrapper Export YAML Reference

The export system enables batch generation of publication-ready figures from Interactive Dashboard data. An export YAML config defines a data source, plots, filter states, and output settings. The headless `ExportEngine` resolves the config into individual render tasks and produces images (PNG or SVG) via the export pipeline.

Source: `src/plugins/interactive-dashboard/export/` and `src/plugins/interactive-dashboard/types/exportConfig.ts`.

---

## Complete Annotated YAML Schema

Every possible key with type, default, and required/optional status.

```yaml
# ============================================================================
# TABLE (required) -- Data source
# ============================================================================
table:
  file: string              # (required) Path to CSV file, relative to YAML location
  idColumn: string          # (optional) Column with unique row identifiers

# ============================================================================
# DEFAULTS (optional) -- Global export settings (inherited by states and plots)
# ============================================================================
defaults:
  format: string            # (optional, default: "png") "png" | "svg"
  width: number             # (optional, default: 1200) Image width in pixels
  height: number            # (optional, default: 800) Image height in pixels
  scale: number             # (optional, default: 2) Resolution multiplier (2 = 2x DPI)
  scientific: boolean       # (optional, default: true) Enable grayscale-safe patterns and academic styling
  colorBy: string           # (optional, default: "") Default color-by attribute for all plots

# ============================================================================
# PLOTS (required) -- Named plot definitions
# ============================================================================
plots:
  <plotId>:                 # Any descriptive string key (e.g., "mode-pie", "dist-hist")
    type: string            # (required) Card type: "histogram" | "pie-chart" | "scatter-plot" | "map" | "correlation-matrix" | "timeline"
    title: string           # (optional) Plot title displayed on the exported figure

    # --- Histogram-specific ---
    column: string          # (required for histogram/pie-chart) CSV column to plot
    bins: number            # (optional) Number of bins (alternative to binSize)
    binSize: number         # (optional) Width of each bin (preferred over bins)
    autoTrim: boolean       # (optional) Auto-trim outliers from axis range
    xMin: number            # (optional) Explicit x-axis minimum
    xMax: number            # (optional) Explicit x-axis maximum

    # --- Scatter-specific ---
    xColumn: string         # (required for scatter-plot) Column for X axis
    yColumn: string         # (required for scatter-plot) Column for Y axis
    x: string               # (alternative to xColumn)
    y: string               # (alternative to yColumn)
    colorBy: string         # (optional) Color-by attribute for this plot
    xMin: number            # (optional) Explicit x-axis minimum
    xMax: number            # (optional) Explicit x-axis maximum
    yMin: number            # (optional) Explicit y-axis minimum
    yMax: number            # (optional) Explicit y-axis maximum

    # --- Map-specific ---
    layers: LayerConfig[]   # (required for map) Array of map layer configs
    center: [number, number] # (optional) Map center as [longitude, latitude]
    zoom: number            # (optional) Map zoom level
    mapStyle: string        # (optional) "light" | "dark" | "auto"

    # --- Correlation-specific ---
    attributes: string[]    # (required for correlation-matrix) Numeric column names

    # --- Per-plot export overrides ---
    format: string          # (optional) Override format for this plot ("png" | "svg")
    width: number           # (optional) Override width for this plot
    height: number          # (optional) Override height for this plot
    scale: number           # (optional) Override scale for this plot

# ============================================================================
# STATES (required) -- Named filter states, each producing one or more exports
# ============================================================================
states:
  <stateId>:                # Any descriptive string key (e.g., "all", "car-only", "compare-car")
    filters:                # (optional) Filter definitions for this state
      <columnName>: FilterDef  # See Filter Syntax Reference below
    colorBy: string         # (optional) Override color-by attribute for this state
    comparison: boolean     # (optional, default: false) Enable comparison mode (baseline + filtered overlay)
    export: [string]        # (required) List of plot IDs to export in this state

    # --- State-level export overrides ---
    format: string          # (optional) Override format for this state
    width: number           # (optional) Override width for this state
    height: number          # (optional) Override height for this state
    scale: number           # (optional) Override scale for this state

# ============================================================================
# OUTPUT (optional) -- Output file configuration
# ============================================================================
output:
  directory: string         # (optional, default: "./export") Output directory
  naming: string            # (optional, default: "{state}-{plot}") Filename pattern
```

---

## Filter Syntax Reference

Three filter types are supported, corresponding to the `FilterDef` union type:

### 1. Single Categorical Value (string)

Match rows where the column equals exactly this value. Case-sensitive.

```yaml
filters:
  base_mode: car           # Only rows where base_mode = "car"
```

### 2. Multiple Categorical Values (string[])

Match rows where the column equals any of these values (OR logic).

```yaml
filters:
  base_mode: [car, pt]     # Rows where base_mode = "car" OR "pt"
```

### 3. Numeric Range ({min, max})

Match rows where the column value falls within the range. Both `min` and `max` are optional.

```yaml
filters:
  distance: { min: 5000 }              # distance >= 5000
  distance: { max: 10000 }             # distance <= 10000
  distance: { min: 5000, max: 10000 }  # 5000 <= distance <= 10000
```

### Combining Filters

Multiple filters in the same state combine with AND logic:

```yaml
filters:
  base_mode: car
  distance: { min: 10000 }
# Only rows where base_mode = "car" AND distance >= 10000
```

---

## Settings Cascade

Export settings resolve through a cascade, most specific wins:

```
EXPORT_DEFAULTS → config.defaults → state-level → plot-level
```

| Setting | EXPORT_DEFAULTS | `defaults` | State | Plot |
|---------|-----------------|------------|-------|------|
| `format` | `"png"` | Yes | Yes | Yes |
| `width` | `1200` | Yes | Yes | Yes |
| `height` | `800` | Yes | Yes | Yes |
| `scale` | `2` | Yes | Yes | Yes |
| `scientific` | `true` | Yes | -- | -- |
| `colorBy` | `""` | Yes | Yes | Yes |

**Note:** `scientific` is resolved globally only (from `EXPORT_DEFAULTS` or `config.defaults`). It cannot be overridden per-state or per-plot.

---

## State Design Patterns

### Filter-Based States (one per category)

Export the same plots with different categorical filters to compare subgroups:

```yaml
states:
  all:
    export: [mode-pie, dist-hist]
  car-only:
    filters:
      base_mode: car
    export: [dist-hist]
  pt-only:
    filters:
      base_mode: pt
    export: [dist-hist]
  bike-only:
    filters:
      base_mode: bike
    export: [dist-hist]
```

### Numeric Threshold States

Split data by numeric ranges (e.g., quartiles or domain boundaries):

```yaml
states:
  short-trips:
    filters:
      distance: { max: 5000 }
    export: [mode-pie, time-hist]
  medium-trips:
    filters:
      distance: { min: 5000, max: 15000 }
    export: [mode-pie, time-hist]
  long-trips:
    filters:
      distance: { min: 15000 }
    export: [mode-pie, time-hist]
```

### Comparison States (baseline + filtered overlay)

Comparison mode renders all data as a gray baseline with the filtered subset overlaid in color. Requires at least one filter.

```yaml
states:
  compare-car:
    filters:
      base_mode: car
    comparison: true
    export: [dist-hist, time-hist]
  compare-pt:
    filters:
      base_mode: pt
    comparison: true
    export: [dist-hist, time-hist]
```

### Combined States

Mix filter types and comparison mode:

```yaml
states:
  compare-long-car:
    filters:
      base_mode: car
      distance: { min: 15000 }
    comparison: true
    export: [time-hist, budget-hist]
```

---

## Output Naming Patterns

The `output.naming` pattern supports two substitution variables:

| Variable | Replaced with | Example |
|----------|--------------|---------|
| `{state}` | State ID from `states` keys | `all`, `car-only`, `compare-pt` |
| `{plot}` | Plot ID from `plots` keys | `mode-pie`, `dist-hist` |

Default pattern: `{state}-{plot}`

Examples:

| Pattern | State | Plot | Filename |
|---------|-------|------|----------|
| `{state}-{plot}` | `all` | `dist-hist` | `all-dist-hist.png` |
| `{state}-{plot}` | `car-only` | `mode-pie` | `car-only-mode-pie.png` |
| `fig-{plot}-{state}` | `compare-pt` | `time-hist` | `fig-time-hist-compare-pt.png` |

The file extension is appended automatically from the resolved `format` setting.

---

## Format Presets

Recommended settings for common output targets:

| Target | format | width | height | scale | scientific | Effective resolution |
|--------|--------|-------|--------|-------|------------|---------------------|
| Dissertation (300 DPI) | png | 1200 | 800 | 2 | true | 2400 x 1600 px |
| Dissertation (vector) | svg | 1200 | 800 | 1 | true | Scalable |
| Presentation (16:9) | png | 1600 | 900 | 1.5 | false | 2400 x 1350 px |
| Web / screen | png | 800 | 600 | 1 | false | 800 x 600 px |

**`scientific: true`** enables:
- Grayscale-safe patterns and textures on chart elements
- Academic styling (serif axis labels, heavier grid lines, etc.)

---

## Worked Examples

### Example A: Minimal (1 plot, 1 state)

The simplest possible export config: one histogram, one unfiltered state.

```yaml
table:
  file: data.csv
  idColumn: id

plots:
  dist-hist:
    type: histogram
    column: distance
    binSize: 5000

states:
  all:
    export: [dist-hist]
```

**Produces:** 1 file — `all-dist-hist.png` (1200x800 @ 2x scale, scientific mode)

---

### Example B: Multi-State with Filters (2 plots, 4 states)

Multiple filter states for systematic comparison of subgroups.

```yaml
table:
  file: requests.csv
  idColumn: request_id

defaults:
  format: png
  width: 1200
  height: 800
  scale: 2
  scientific: true

plots:
  mode-pie:
    type: pie-chart
    column: base_mode
    title: "Mode Share"
  dist-hist:
    type: histogram
    column: distance
    binSize: 5000
    autoTrim: true
    title: "Distance Distribution"

states:
  all:
    export: [mode-pie, dist-hist]
  car-only:
    filters:
      base_mode: car
    export: [dist-hist]
  pt-only:
    filters:
      base_mode: pt
    export: [dist-hist]
  long-trips:
    filters:
      distance: { min: 15000 }
    export: [mode-pie, dist-hist]

output:
  naming: "{state}-{plot}"
```

**Produces:** 7 files:
- `all-mode-pie.png`, `all-dist-hist.png`
- `car-only-dist-hist.png`
- `pt-only-dist-hist.png`
- `long-trips-mode-pie.png`, `long-trips-dist-hist.png`

---

### Example C: Comparison Mode (2 plots, 3 states)

Baseline overlay for visual comparison of filtered subsets against the full dataset.

```yaml
table:
  file: trips.csv
  idColumn: trip_id

defaults:
  format: png
  width: 1200
  height: 800
  scale: 2
  scientific: true

plots:
  time-hist:
    type: histogram
    column: travel_time
    binSize: 600
    title: "Travel Time Distribution"
  budget-scatter:
    type: scatter-plot
    xColumn: distance
    yColumn: travel_time
    title: "Distance vs Travel Time"

states:
  all:
    export: [time-hist, budget-scatter]
  compare-car:
    filters:
      mode: car
    comparison: true
    export: [time-hist, budget-scatter]
  compare-pt:
    filters:
      mode: pt
    comparison: true
    export: [time-hist, budget-scatter]
```

**Produces:** 6 files:
- `all-time-hist.png`, `all-budget-scatter.png`
- `compare-car-time-hist.png` (gray baseline + colored car trips), `compare-car-budget-scatter.png`
- `compare-pt-time-hist.png` (gray baseline + colored PT trips), `compare-pt-budget-scatter.png`

---

## Common Patterns & Gotchas

1. **Filter values must match CSV data exactly.** Filters are case-sensitive. If the CSV contains `"Car"`, the filter must be `Car`, not `car`. Always verify filter values against actual data.

2. **`comparison: true` renders baseline behind filtered data.** All data appears as a gray baseline layer; the filtered subset appears in color on top. This only makes sense with at least one filter — `comparison: true` without filters produces identical baseline and overlay.

3. **Plot IDs in `states.*.export` must match keys in `plots`.** A typo like `dist_hist` (underscore) when the plot is defined as `dist-hist` (hyphen) will throw an error.

4. **`{state}-{plot}` produces filenames like `all-dist-hist.png`.** Ensure the naming pattern produces unique filenames across all state-plot combinations. Duplicate filenames will overwrite each other.

5. **Numeric range filter syntax:**
   - `{ min: 5000 }` means ">= 5000"
   - `{ max: 10000 }` means "<= 10000"
   - `{ min: 5000, max: 10000 }` means "between 5000 and 10000 (inclusive)"

6. **`scientific: true` enables grayscale-safe patterns and academic styling.** Use for dissertation/thesis figures. Use `false` for presentations where color is available.

7. **Settings cascade: `EXPORT_DEFAULTS` -> `defaults` -> state-level -> plot-level.** Most specific wins. This means you can set defaults globally and override per-state or per-plot. Exception: `scientific` is global only.

8. **File paths are relative to the YAML file location.** If the export YAML is at `output/export-config.yaml`, then `file: data.csv` looks for `output/data.csv`.

9. **Use descriptive plot IDs.** `mode-pie` and `dist-hist` are self-documenting; `plot1` and `plot2` are not. Plot IDs appear in output filenames.

10. **Use descriptive state IDs.** `car-only` and `compare-pt` are clear; `state1` and `state2` are not. State IDs appear in output filenames.

11. **The `all` state (unfiltered) should almost always be included** as a baseline reference for comparing against filtered states.

12. **Scatter plots accept both `xColumn`/`yColumn` and `x`/`y`** as property names. Either form works; `xColumn`/`yColumn` is preferred for clarity.

13. **`autoTrim: true` on histograms** trims outliers from the axis range, keeping charts focused on the meaningful data distribution. Recommended for most real-world datasets.
