# SimWrapper Interactive Dashboard YAML Reference

The Interactive Dashboard plugin enables coordinated, filterable visualizations from a central CSV data table. A dashboard YAML config containing a `table:` key triggers interactive mode (detected in `TabbedDashboardView.vue:178`). Source: `src/plugins/interactive-dashboard/`.

---

## Complete Annotated YAML Schema

Every possible key with type, default, and required/optional status.

```yaml
# ============================================================================
# HEADER (required)
# ============================================================================
header:
  tab: string             # (required) Tab name displayed in navigation
  title: string           # (required) Dashboard title
  description: string     # (optional) Dashboard subtitle/description
  fullScreen: boolean     # (optional, default: false) Fill available viewport height

# ============================================================================
# TABLE (required -- presence triggers InteractiveDashboard)
# ============================================================================
table:
  name: string            # (optional, default: "Items") Display name for the table
  dataset: string         # (required) Path to CSV file, relative to YAML location
  idColumn: string        # (required) Column with unique row identifiers
  visible: boolean        # (optional, default: false) Show data table in dashboard
  position: string        # (optional) "layout" to render table in layout; omit for default
  columns:                # (optional) Column visibility and formatting
    show: [string]        # (optional) Explicit whitelist of columns to show
    hide: [string]        # (optional) Columns to hide from table display
    formats:              # (optional) Per-column formatting rules
      <columnName>:
        type: string      # "string" | "number" | "decimal" | "time" | "duration" | "distance" | "boolean"
        unit: string      # Display unit (e.g., "km", "min", "s")
        decimals: number  # Decimal places for numeric types
        convertFrom: string  # Source unit: "seconds" | "meters"

# ============================================================================
# LAYOUT (required) -- Row-based card arrangement
# ============================================================================
layout:
  <rowName>:              # Any string key (e.g., "row1", "charts", "map-row")
    - type: string        # (required) Card type -- see Card Type Reference below
      title: string       # (optional) Card title
      description: string # (optional) Card description
      width: number       # (optional, default: 1) Relative flex width within row
      height: number      # (optional, default: 4) Height multiplier (~60px per unit)
      linkage: LinkageConfig  # (optional) Connect card to central data table
      # ... card-type-specific props (see Card Type Reference)

# ============================================================================
# MAP (optional) -- Dashboard-level map controls configuration
# ============================================================================
map:
  controls:
    geometryType: boolean   # (optional) Show geometry type selector dropdown
    colorBy: boolean        # (optional) Show color-by attribute selector dropdown

  geometryTypes:            # (optional) Options for geometry type selector
    - value: string         # Internal value (e.g., "origin", "destination", "od", "all")
      label: string         # Display label (e.g., "Origin Clusters")

  colorBy:
    default: string         # (optional) Default color-by attribute name
    layerStrategy: string   # (optional, default: "auto") "auto" | "explicit" | "all"
    attributes:             # (optional) List of color-by attributes for selector
      - attribute: string   # Column name in CSV data
        label: string       # Display label
        type: string        # "categorical" | "numeric"
        colorScheme: string # (optional) Named color scale: "YlOrRd", "Blues", "Greens", "Oranges", "Reds", "Purples", "YlGnBu"

# ============================================================================
# COLOR SCHEMES (optional) -- Categorical color maps for data attributes
# ============================================================================
colorSchemes:
  <attributeName>:
    type: categorical
    colors:
      <value>: "#hexcolor"  # One entry per categorical value
      default: "#hexcolor"  # Fallback color for unmapped values

# ============================================================================
# CONTROLS (optional) -- Dashboard-level UI controls
# ============================================================================
controls:
  - type: string            # Control type (see Controls Reference below)
    label: string           # Display label
    # ... control-type-specific props

# ============================================================================
# INTERACTIONS (optional) -- Global interaction behavior
# ============================================================================
interactions:
  filterLogic:
    betweenTypes: string    # (default: "AND") Logic between different filter cards
    withinType: string      # (default: "OR") Logic within one filter card's values

  hover:
    enabled: boolean        # (default: true) Enable cross-component hover highlighting
    crossHighlight: boolean # (default: true) Hover in one card highlights in others

  selection:
    mode: string            # (default: "toggle") "toggle" for click to select/deselect
    multiSelect: boolean    # (default: true) Allow multiple selections

# ============================================================================
# SUB-DASHBOARDS (optional) -- Child dashboards filtered by parent selection
# ============================================================================
subDashboards:
  - file: string            # (optional) External YAML file to load as sub-dashboard
    title: string           # (optional) Sub-dashboard title
    table:                  # (required) Sub-dashboard table config
      dataset: string       # CSV file for sub-dashboard data
      linkColumn: string    # Column to filter by parent selection (default: "trial_id")
      idColumn: string      # Unique ID column for sub-dashboard table
    layout: {}              # Layout config (same structure as top-level layout)
```

---

## Card Type Reference

Valid card type strings are registered in `src/dash-panels/_allPanels.ts`. The interactive dashboard cards are:

### `histogram`

Distribution chart with interactive bin filtering.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `column` | string | yes | -- | CSV column to histogram |
| `binSize` | number | no | auto | Width of each bin |
| `xMin` | number | no | -- | Explicit x-axis minimum |
| `xMax` | number | no | -- | Explicit x-axis maximum |
| `autoTrim` | number | no | -- | Percentile for auto-trimming outliers (e.g., 95 = show central 95% of data) |
| `linkage` | LinkageConfig | no | -- | Filter linkage config |

**Axis range options:**
- `xMin`/`xMax`: Hard-limit the x-axis to specific values. Useful when you know the meaningful data range.
- `autoTrim`: Auto-calculate axis bounds from data percentiles. `autoTrim: 95` shows the 2.5th to 97.5th percentile, trimming extreme outliers. Range is computed from baseline (unfiltered) data so it stays stable during filtering.
- If both `xMin`/`xMax` and `autoTrim` are set, explicit values override the auto-trimmed bounds.
- If nothing is set, Plotly auto-ranges as before (backward compatible).

```yaml
- type: histogram
  title: "Travel Time Distribution"
  column: travel_time
  binSize: 5
  autoTrim: 95
  width: 1
  height: 5
  linkage:
    type: filter
    column: travel_time
    behavior: toggle

# Or with explicit bounds:
- type: histogram
  title: "Distance Distribution"
  column: distance
  binSize: 5000
  xMin: 0
  xMax: 50000
  width: 1
  height: 5
  linkage:
    type: filter
    column: distance
    behavior: toggle
```

### `pie-chart`

Categorical breakdown with interactive slice filtering.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `column` | string | yes | -- | CSV column for pie slices |
| `linkage` | LinkageConfig | no | -- | Filter linkage config |

```yaml
- type: pie-chart
  title: "Mode Share"
  column: main_mode
  width: 1
  height: 5
  linkage:
    type: filter
    column: main_mode
    behavior: toggle
```

### `scatter-plot`

Two-axis point plot with optional color/size encoding. Supports dynamic axis updates from correlation matrix.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `xColumn` | string | yes | -- | Column for X axis |
| `yColumn` | string | yes | -- | Column for Y axis |
| `colorColumn` | string | no | -- | Column for categorical point colors |
| `sizeColumn` | string | no | -- | Column for point size scaling |
| `markerSize` | number | no | 8 | Default marker size in pixels |
| `idColumn` | string | no | -- | Column for linkage ID matching |
| `listenToAttributePairSelection` | boolean | no | false | Update axes when correlation matrix cell is clicked |
| `xMin` | number | no | -- | Explicit x-axis minimum |
| `xMax` | number | no | -- | Explicit x-axis maximum |
| `yMin` | number | no | -- | Explicit y-axis minimum |
| `yMax` | number | no | -- | Explicit y-axis maximum |
| `xAutoTrim` | number | no | -- | X-axis percentile auto-trim (e.g., 95 = central 95%) |
| `yAutoTrim` | number | no | -- | Y-axis percentile auto-trim (e.g., 99 = central 99%) |

**Axis range options:**
- `xMin`/`xMax`/`yMin`/`yMax`: Hard-limit axes to specific values.
- `xAutoTrim`/`yAutoTrim`: Auto-trim outliers per axis. `xAutoTrim: 95` shows the 2.5th to 97.5th percentile on the x-axis. Computed from baseline (unfiltered) data.
- Explicit bounds override auto-trim when both are specified for the same axis.
- If nothing is set, the existing baseline-range behavior is preserved (backward compatible).

```yaml
- type: scatter-plot
  title: "Budget vs Travel Time"
  xColumn: budget
  yColumn: travel_time
  colorColumn: base_mode
  idColumn: request_id
  markerSize: 6
  xAutoTrim: 95
  yAutoTrim: 95
  width: 1
  height: 8
  listenToAttributePairSelection: true

# Or mix explicit and auto-trim:
- type: scatter-plot
  title: "Distance vs Duration"
  xColumn: distance
  yColumn: travel_time
  xMin: 0
  xMax: 50000
  yAutoTrim: 99
  markerSize: 6
  width: 1
  height: 8
```

### `correlation-matrix`

Heatmap of Pearson correlations between numeric attributes. Clicking a cell emits an attribute pair selection event.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `attributes` | string[] | yes | -- | List of numeric column names |
| `showValues` | string | no | "auto" | "always" \| "never" \| "auto" |
| `pValueThreshold` | number | no | 0.05 | Significance threshold |

```yaml
- type: correlation-matrix
  title: "Attribute Correlations"
  width: 1
  height: 8
  attributes:
    - travel_time
    - distance
    - budget
    - max_cost
    - person_income
  showValues: auto
  pValueThreshold: 0.05
```

**Linkage with scatter-plot:** Clicking a cell in the correlation matrix updates a scatter-plot that has `listenToAttributePairSelection: true` -- the scatter plot's X and Y axes change to the clicked attribute pair.

### `map`

Interactive map with deck.gl layers, tooltips, and legend.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `center` | [number, number] | no | auto | Map center as **[longitude, latitude]** |
| `zoom` | number | no | auto | Initial zoom level |
| `mapStyle` | string | no | "auto" | "light" \| "dark" \| "auto" |
| `layers` | LayerConfig[] | no | [] | Array of map layers (see Map Layer Reference) |
| `legend` | object | no | -- | Legend configuration |
| `legend.enabled` | boolean | no | false | Show color legend |
| `legend.position` | string | no | "bottom-right" | Legend position |
| `legend.clickToFilter` | boolean | no | true | Click legend items to filter |
| `tooltip` | object | no | -- | Tooltip configuration |
| `tooltip.enabled` | boolean | no | false | Show tooltips on hover |
| `tooltip.template` | string | no | -- | HTML template with `{properties.X}` placeholders |

```yaml
- type: map
  title: "Geographic View"
  width: 2
  height: 10
  center: [11.57, 48.14]   # [longitude, latitude] -- NOT [lat, lon]!
  zoom: 10
  legend:
    enabled: true
    position: bottom-right
    clickToFilter: true
  tooltip:
    enabled: true
  layers:
    - name: zones
      file: zones.geojson
      type: fill
      # ... see Map Layer Reference
```

### `data-table`

Interactive data table connected to the central `DataTableManager`. Automatically displays the CSV data with sorting, filtering highlights, hover sync, and comparison mode.

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| (none required) | -- | -- | -- | Auto-connects to central table |

```yaml
- type: data-table
  title: "Requests"
  width: 1
  height: 10
```

Built-in features (no configuration needed):
- Sortable columns (click header)
- Filtered rows highlighted and shown at top
- Auto-scroll to hovered row (map/chart to table sync)
- Hover sync (table to map/charts)
- Click to select rows
- Comparison mode toggle (baseline vs filtered)
- Filter reset button

### `timeline`

Gantt-style timeline visualization. Supports ride/request detail views with minimap navigation.

```yaml
- type: timeline
  title: "Ride Timeline"
  width: 2
  height: 8
```

### `text`

Markdown text card for annotations.

```yaml
- type: text
  title: "Notes"
  file: notes.md
  width: 1
  height: 3
```

### Other valid card types

These are standard SimWrapper panel types that can be used in interactive dashboard layouts but do not participate in the linkage/filter coordination system:

`area`, `bar`, `bubble`, `csv`, `gridmap`, `heatmap`, `hexagons`, `line`, `pie`, `plotly`, `sankey`, `scatter`, `slideshow`, `tile`, `transit`, `vega`, `vehicles`, `video`, `xml`

---

## Map Layer Reference

Each layer in a map card's `layers` array has the following structure:

### Common Properties (all layer types)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | string | yes | -- | Unique layer identifier |
| `file` | string | yes | -- | Path to GeoJSON file (relative to YAML) |
| `type` | string | yes | -- | `"fill"` \| `"polygon"` \| `"line"` \| `"arc"` \| `"circle"` \| `"scatterplot"` |
| `visible` | boolean | no | true | Initial layer visibility |
| `zIndex` | number | no | -- | Rendering order (higher = on top) |
| `geometryType` | string | no | -- | Only show when geometry type selector matches this value |
| `filter` | object \| object[] | no | -- | GeoJSON property filter(s) |
| `linkage` | LayerLinkageConfig | no | -- | Connect layer features to table rows |
| `colorBy` | string \| ColorByConfig | no | -- | Data-driven coloring |
| `colorByRole` | string | no | "auto" | `"primary"` \| `"secondary"` \| `"neutral"` \| `"auto"` |

### Fill / Polygon Layer (`type: "fill"` or `type: "polygon"`)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fillColor` | string | -- | Static fill color (hex) |
| `fillOpacity` | number | 0.2 | Fill opacity (0-1) |
| `lineColor` | string | -- | Outline color (hex) |
| `lineWidth` | number | 1 | Outline width in pixels |
| `lineOpacity` | number | 1.0 | Outline opacity (0-1) |

```yaml
- name: cluster_boundaries
  file: clusters.geojson
  type: fill
  fillColor: "#9b59b6"
  fillOpacity: 0.15
  lineColor: "#8e44ad"
  lineWidth: 2
  filter:
    - property: cluster_type
      value: origin
    - property: geometry_type
      value: boundary
  linkage:
    tableColumn: origin_cluster
    geoProperty: cluster_id
    onHover: highlight
    onSelect: filter
```

### Line Layer (`type: "line"`)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `color` | string | -- | Static line color (hex) |
| `width` | number | 1 | Line width in pixels |
| `opacity` | number | 1.0 | Line opacity (0-1) |

```yaml
- name: request_lines
  file: requests.geojson
  type: line
  color: "#3498db"
  width: 2
  opacity: 0.6
  filter:
    property: geometry_type
    value: od_line
  linkage:
    tableColumn: request_id
    geoProperty: request_id
    onHover: highlight
    onSelect: filter
```

### Arc Layer (`type: "arc"`)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `color` | string | -- | Static arc color (hex) |
| `opacity` | number | 1.0 | Arc opacity (0-1) |
| `arcHeight` | number | 0.5 | Arc curve height multiplier |
| `arcTilt` | number | 0 | Arc tilt angle in degrees |
| `widthBy` | object | -- | Data-driven width scaling |
| `widthBy.attribute` | string | -- | GeoJSON property for width |
| `widthBy.scale` | [number, number] | -- | [minWidth, maxWidth] pixel range |

```yaml
- name: flow_arcs
  file: flows.geojson
  type: arc
  color: "#9b59b6"
  opacity: 0.7
  arcHeight: 0.2
  arcTilt: 25
  widthBy:
    attribute: num_requests
    scale: [4, 14]
  linkage:
    tableColumn: od_cluster
    geoProperty: cluster_id
    onHover: highlight
    onSelect: filter
```

### Circle / Scatterplot Layer (`type: "circle"` or `type: "scatterplot"`)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fillColor` | string | -- | Static fill color (hex) |
| `color` | string | -- | Alternative to fillColor |
| `fillOpacity` | number | 1.0 | Point fill opacity (0-1) |
| `radius` | number | 5 | Static point radius in pixels |
| `radiusBy` | object | -- | Data-driven radius scaling |
| `radiusBy.attribute` | string | -- | GeoJSON property for radius |
| `radiusBy.scale` | [number, number] | -- | [minRadius, maxRadius] pixel range |

```yaml
- name: stops
  file: stops.geojson
  type: scatterplot
  color: "#f39c12"
  opacity: 0.8
  radiusBy:
    attribute: num_boardings
    scale: [3, 12]
  linkage:
    tableColumn: stop_id
    geoProperty: stop_id
    onHover: highlight
    onSelect: filter
```

### Layer Property Filter

Filter GeoJSON features before rendering. Single filter or array of filters (AND logic).

```yaml
# Single filter
filter:
  property: geometry_type
  value: od_line

# Multiple filters (all must match)
filter:
  - property: cluster_type
    value: origin
  - property: geometry_type
    value: boundary
```

---

## Linkage System

Linkage connects user interactions (hover, click) on one card to state changes in other cards.

### Card Linkage (histogram, pie-chart)

Applies to charts that filter the central data table.

```yaml
linkage:
  type: filter         # "filter" | "highlight" (default: "filter")
  column: column_name  # Column in central CSV to filter on
  behavior: toggle     # "toggle" | "replace" (default: "toggle")
```

- **toggle**: Clicking a bar/slice toggles that value in/out of the active filter set
- **replace**: Clicking a bar/slice replaces the current filter with that value

### Map Layer Linkage

Connects GeoJSON features to central table rows.

```yaml
linkage:
  tableColumn: request_id    # Column in CSV table
  geoProperty: request_id    # Property in GeoJSON features
  onHover: highlight          # "highlight" | "none" (default: "none")
  onSelect: filter            # "filter" | "highlight" | "none" (default: "filter")
```

- **tableColumn + geoProperty**: Defines the join. When a GeoJSON feature with `geoProperty=X` is interacted with, the system finds table rows where `tableColumn=X`.
- **onHover: highlight**: Hovering a feature highlights matching table rows (and vice versa)
- **onSelect: filter**: Clicking a feature filters the table to matching rows

### Correlation Matrix to Scatter Plot Linkage

Special cross-card linkage using attribute pair selection:

1. Correlation matrix emits `attribute-pair-selected` event when a cell is clicked
2. LinkageManager broadcasts the pair to all observers
3. Scatter plot with `listenToAttributePairSelection: true` updates its X/Y axes

```yaml
# Correlation matrix (emitter)
- type: correlation-matrix
  attributes: [travel_time, distance, budget]

# Scatter plot (receiver)
- type: scatter-plot
  xColumn: budget            # Initial X axis (overridden by correlation clicks)
  yColumn: travel_time       # Initial Y axis (overridden by correlation clicks)
  listenToAttributePairSelection: true
```

### Filter Logic

- **OR within same card**: Selecting bins [0-10] and [20-30] in a histogram shows rows matching either bin
- **AND between different cards**: A histogram filter AND a pie chart filter must both match for a row to pass
- Implemented in `FilterManager.applyFilters()`: iterates all filters with AND logic; within each filter, values are checked with OR logic.

### Selection Threshold

Single selection = highlight only. Two or more selections = comparison mode (selection-to-filter promotion). This threshold is hardcoded at 2 in `InteractiveDashboard.vue`.

---

## Column Format Reference

Applied via `table.columns.formats.<columnName>`.

| Type | convertFrom | unit | Result Example |
|------|-------------|------|----------------|
| `time` | `seconds` | -- | `08:30:00` (auto HH:MM:SS) |
| `duration` | `seconds` | `min` | `12.5 min` |
| `distance` | `meters` | `km` | `3.45 km` |
| `decimal` | -- | -- | `1.23` (uses `decimals`) |
| `number` | -- | -- | `42` |
| `string` | -- | -- | raw value |
| `boolean` | -- | -- | raw value |

### Common Patterns

```yaml
columns:
  formats:
    # Seconds to HH:MM:SS
    departure_time:
      type: time
      convertFrom: seconds

    # Seconds to minutes with 1 decimal
    travel_time:
      type: duration
      convertFrom: seconds
      unit: min
      decimals: 1

    # Meters to km with 2 decimals
    distance:
      type: distance
      convertFrom: meters
      unit: km
      decimals: 2

    # Generic decimal formatting
    detour_factor:
      type: decimal
      decimals: 2

    # Number with specific decimals
    latitude:
      type: number
      decimals: 5
```

---

## ColorBy & Data-Driven Styling

### Layer-Level colorBy

Apply to individual map layers for data-driven coloring.

```yaml
# Simple: just an attribute name (uses auto-detection for type)
colorBy: main_mode

# Full config: categorical
colorBy:
  attribute: main_mode
  type: categorical
  colors:
    car: "#e74c3c"
    pt: "#3498db"
    bike: "#2ecc71"
    walk: "#f39c12"

# Full config: numeric with scale
colorBy:
  attribute: travel_time
  type: numeric
  scale: [0, 3600]     # min/max values for color scale
```

### Dashboard-Level colorBy (via `map.colorBy`)

Configures the color-by attribute selector dropdown. The selected attribute applies to layers with `colorByRole: primary` (or auto-detected primary layers).

```yaml
map:
  colorBy:
    default: base_mode          # Initially selected attribute
    layerStrategy: auto         # How to assign coloring roles
    attributes:
      - attribute: base_mode
        label: Transport Mode
        type: categorical
      - attribute: travel_time
        label: Travel Time
        type: numeric
        colorScheme: YlOrRd     # Named D3 color scale
```

### colorByRole & layerStrategy

Controls which layers receive data-driven coloring vs neutral styling.

**colorByRole** (per-layer):
- `primary`: Layer always receives colorBy coloring
- `secondary`: Subdued coloring (reserved for future use)
- `neutral`: Layer always gets neutral/gray styling, ignoring colorBy
- `auto` (default): Role assigned automatically by LayerColoringManager

**layerStrategy** (dashboard-level, via `map.colorBy.layerStrategy`):
- `auto` (default): Arcs and detail layers get primary coloring; cluster boundaries become neutral when arcs are visible
- `explicit`: Only layers with explicit `colorByRole: primary` get coloring
- `all`: All layers receive colorBy coloring

### widthBy & radiusBy

Data-driven sizing for arc and circle layers.

```yaml
# Arc width based on attribute
widthBy:
  attribute: num_requests
  scale: [4, 14]         # [minWidth, maxWidth] in pixels

# Circle radius based on attribute
radiusBy:
  attribute: num_boardings
  scale: [3, 12]         # [minRadius, maxRadius] in pixels
```

### Top-Level colorSchemes

Define named color maps for categorical attributes. Referenced by the coloring system when rendering charts and map layers.

```yaml
colorSchemes:
  main_mode:
    type: categorical
    colors:
      car: "#e74c3c"
      pt: "#3498db"
      bike: "#2ecc71"
      walk: "#f39c12"
      drt: "#9b59b6"
      default: "#95a5a6"    # Fallback for unknown values
```

---

## Controls Reference

Controls are dashboard-level UI elements defined in the top-level `controls:` array.

### `cluster-type-selector`

Dropdown that dynamically updates layer properties (linkage columns, visibility) based on selected cluster type.

```yaml
- type: cluster-type-selector
  label: "Cluster Type"
  options:
    - value: origin
      label: "Origin"
      updates:
        layers:
          cluster_boundaries:           # Layer name
            linkage:
              tableColumn: origin_cluster   # Override linkage column
          cluster_flows:
            visible: false              # Hide this layer
    - value: destination
      label: "Destination"
      updates:
        layers:
          cluster_boundaries:
            linkage:
              tableColumn: destination_cluster
          cluster_flows:
            visible: false
    - value: spatial
      label: "Spatial (OD)"
      updates:
        layers:
          cluster_boundaries:
            linkage:
              tableColumn: od_cluster
          cluster_flows:
            visible: true
            linkage:
              tableColumn: od_cluster
```

### `color-by-selector`

Dropdown that changes which attribute is used for color coding on target layers.

```yaml
- type: color-by-selector
  label: "Color By"
  target: [request_flows, request_destinations]  # Layer names to update
  options:
    - value: main_mode
      label: "Transport Mode"
      type: categorical
    - value: travel_time
      label: "Travel Time"
      type: numeric
      scale: [0, 3600]
```

### `comparison-toggle`

Toggle to show/hide baseline data comparison mode.

```yaml
- type: comparison-toggle
  label: "Show Comparison"
  default: true
  description: "Show baseline (all data) vs filtered data"
  affects: [histogram, pie-chart]
```

### `filter-reset`

Button to clear all active filters and selections.

```yaml
- type: filter-reset
  label: "Clear Filters"
  position: header         # "header" to place in dashboard header
```

### `scroll-toggle`

Toggle auto-scroll behavior for the data table.

```yaml
- type: scroll-toggle
  label: "Auto-scroll on Hover"
  default: true
  description: "Automatically scroll table to hovered row"
```

### Geometry Type Selector (via `map.controls`)

Not a `controls:` array item -- configured in the `map:` section. Uses `map.geometryTypes` for options and layer `geometryType` property for filtering.

```yaml
map:
  controls:
    geometryType: true
  geometryTypes:
    - value: all
      label: All Geometries
    - value: origin
      label: Origin Clusters
    - value: destination
      label: Destination Clusters

layout:
  row1:
    - type: map
      layers:
        - name: origin_clusters
          geometryType: origin     # Only shown when "origin" is selected
        - name: dest_clusters
          geometryType: destination  # Only shown when "destination" is selected
        - name: request_lines
          # No geometryType -- always visible regardless of selector
```

---

## Worked Examples

### Example 1: Minimal -- Histogram + Pie + Data Table

A basic dashboard with a CSV, two filter charts, and a data table.

```yaml
header:
  tab: "Basic Dashboard"
  title: "Sample Data Analysis"

table:
  dataset: data.csv
  idColumn: id
  visible: true
  columns:
    formats:
      value: { type: number, decimals: 1 }

layout:
  row1:
    - type: histogram
      title: "Value Distribution"
      column: value
      binSize: 10
      autoTrim: 95
      width: 1
      height: 5
      linkage:
        type: filter
        column: value
        behavior: toggle

    - type: pie-chart
      title: "Category Breakdown"
      column: category
      width: 1
      height: 5
      linkage:
        type: filter
        column: category
        behavior: toggle

  row2:
    - type: data-table
      title: "All Data"
      width: 2
      height: 8
```

### Example 2: Map-Focused -- Multi-Layer Map with Linkage

A dashboard with a map showing points and polygons, linked to a histogram and pie chart.

```yaml
header:
  tab: "Map Dashboard"
  title: "Geographic Data Explorer"

table:
  dataset: requests.csv
  idColumn: request_id
  visible: true
  columns:
    hide: [geometry_wkt, start_x, start_y, end_x, end_y]
    formats:
      travel_time:
        type: duration
        convertFrom: seconds
        unit: min
        decimals: 1
      distance:
        type: distance
        convertFrom: meters
        unit: km
        decimals: 2

layout:
  row1:
    - type: map
      title: "Request Map"
      width: 2
      height: 10
      center: [11.57, 48.14]
      zoom: 10
      legend:
        enabled: true
        position: bottom-right
        clickToFilter: true
      tooltip:
        enabled: true
      layers:
        - name: cluster_boundaries
          file: clusters.geojson
          type: fill
          fillColor: "#9b59b6"
          fillOpacity: 0.15
          lineColor: "#8e44ad"
          lineWidth: 2
          filter:
            - property: cluster_type
              value: origin
            - property: geometry_type
              value: boundary
          linkage:
            tableColumn: origin_cluster
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter

        - name: request_lines
          file: requests_geometries.geojson
          type: line
          color: "#3498db"
          width: 2
          opacity: 0.6
          filter:
            property: geometry_type
            value: od_line
          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight
            onSelect: filter

        - name: destinations
          file: requests_geometries.geojson
          type: circle
          fillColor: "#e74c3c"
          fillOpacity: 0.7
          radius: 5
          filter:
            property: geometry_type
            value: destination
          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight
            onSelect: filter

    - type: data-table
      title: "Requests"
      width: 1
      height: 10

  row2:
    - type: histogram
      title: "Travel Time"
      column: travel_time
      binSize: 300
      autoTrim: 95
      width: 1
      height: 5
      linkage:
        type: filter
        column: travel_time
        behavior: toggle

    - type: histogram
      title: "Distance"
      column: distance
      binSize: 1000
      autoTrim: 95
      width: 1
      height: 5
      linkage:
        type: filter
        column: distance
        behavior: toggle

    - type: pie-chart
      title: "Mode Share"
      column: base_mode
      width: 1
      height: 5
      linkage:
        type: filter
        column: base_mode
        behavior: toggle
```

### Example 3: Full-Featured -- Map Controls, Correlation, Color Schemes

A production dashboard with geometry type filtering, color-by selector, correlation-scatter linkage, and categorical color schemes.

```yaml
header:
  tab: "Requests Analysis"
  title: "Requests Analysis"
  description: "Interactive visualization of commuter requests"

map:
  controls:
    geometryType: true
    colorBy: true
  geometryTypes:
    - value: origin
      label: Origin Clusters
    - value: destination
      label: Destination Clusters
    - value: od
      label: Origin-Destination (Flows)
  colorBy:
    default: base_mode
    layerStrategy: auto
    attributes:
      - attribute: base_mode
        label: Transport Mode
        type: categorical
      - attribute: travel_time
        label: Travel Time
        type: numeric
        colorScheme: YlOrRd
      - attribute: distance
        label: Distance
        type: numeric
        colorScheme: YlOrRd
      - attribute: person_income
        label: Income
        type: numeric
        colorScheme: Purples

table:
  name: "Requests"
  dataset: requests.csv
  idColumn: request_id
  visible: true
  columns:
    hide: [geometry_wkt, pax_id, origin, destination]
    formats:
      treq:
        type: time
        convertFrom: seconds
      travel_time:
        type: duration
        convertFrom: seconds
        unit: min
        decimals: 1
      distance:
        type: distance
        convertFrom: meters
        unit: km
        decimals: 2
      max_detour:
        type: decimal
        decimals: 2

colorSchemes:
  base_mode:
    type: categorical
    colors:
      car: "#e74c3c"
      pt: "#3498db"
      bike: "#2ecc71"
      walk: "#f39c12"
      drt: "#9b59b6"
      default: "#95a5a6"

layout:
  row1:
    - type: map
      title: "Requests Map"
      width: 1
      height: 10
      center: [11.57, 48.14]
      zoom: 10
      legend:
        enabled: true
        position: bottom-right
        clickToFilter: true
      tooltip:
        enabled: true
      layers:
        - name: origin_boundaries
          file: cluster_geometries.geojson
          type: fill
          geometryType: origin
          fillColor: "#9b59b6"
          fillOpacity: 0.15
          lineColor: "#8e44ad"
          lineWidth: 2
          filter:
            - property: cluster_type
              value: origin
            - property: geometry_type
              value: boundary
          linkage:
            tableColumn: origin_cluster
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter

        - name: dest_boundaries
          file: cluster_geometries.geojson
          type: fill
          geometryType: destination
          fillColor: "#27ae60"
          fillOpacity: 0.15
          lineColor: "#1e8449"
          lineWidth: 2
          filter:
            - property: cluster_type
              value: destination
            - property: geometry_type
              value: boundary
          linkage:
            tableColumn: destination_cluster
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter

        - name: od_flow_arcs
          file: cluster_geometries.geojson
          type: arc
          geometryType: od
          color: "#9b59b6"
          opacity: 0.7
          arcHeight: 0.2
          arcTilt: 25
          widthBy:
            attribute: num_requests
            scale: [4, 14]
          filter:
            - property: cluster_type
              value: od
            - property: geometry_type
              value: flow
          linkage:
            tableColumn: od_cluster
            geoProperty: cluster_id
            onHover: highlight
            onSelect: filter

        - name: request_lines
          file: requests_geometries.geojson
          type: line
          width: 2
          opacity: 0.6
          color: "#3498db"
          filter:
            property: geometry_type
            value: od_line
          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight
            onSelect: filter

        - name: request_destinations
          file: requests_geometries.geojson
          type: circle
          radius: 5
          fillColor: "#e74c3c"
          fillOpacity: 0.7
          filter:
            property: geometry_type
            value: destination
          linkage:
            tableColumn: request_id
            geoProperty: request_id
            onHover: highlight
            onSelect: filter

    - type: data-table
      title: "Requests"
      width: 1
      height: 10

  row2:
    - type: histogram
      title: "Origin Time"
      column: treq
      binSize: 3600
      autoTrim: 95
      width: 1
      height: 5
      linkage:
        type: filter
        column: treq
        behavior: toggle

    - type: histogram
      title: "Distance"
      column: distance
      binSize: 10000
      autoTrim: 95
      width: 1
      height: 5
      linkage:
        type: filter
        column: distance
        behavior: toggle

    - type: pie-chart
      title: "Mode Share"
      column: base_mode
      width: 1
      height: 5
      linkage:
        type: filter
        column: base_mode
        behavior: toggle

  row3:
    - type: correlation-matrix
      title: "Attribute Correlations"
      width: 1
      height: 8
      attributes:
        - travel_time
        - distance
        - budget
        - max_cost
        - person_income
        - person_age
      showValues: auto
      pValueThreshold: 0.05

    - type: scatter-plot
      title: "Attribute Explorer"
      width: 1
      height: 8
      xColumn: budget
      yColumn: travel_time
      colorColumn: base_mode
      idColumn: request_id
      markerSize: 6
      xAutoTrim: 95
      yAutoTrim: 95
      listenToAttributePairSelection: true
```

---

## Common Patterns & Gotchas

1. **File paths are relative to the YAML file location.** If your YAML is at `output/dashboard.yaml`, then `dataset: requests.csv` looks for `output/requests.csv`.

2. **CSV must have headers** matching the column names used in cards. PapaParse is used with `header: true` and `dynamicTyping: true` (numbers are auto-parsed).

3. **GeoJSON must be EPSG:4326 (WGS84).** All coordinates must be in longitude/latitude.

4. **`center` is [longitude, latitude]**, NOT [latitude, longitude]. This is the most common mistake. Berlin is `[13.4, 52.5]`, not `[52.5, 13.4]`.

5. **`idColumn` must have unique values.** Duplicate IDs will cause unpredictable linkage behavior.

6. **`width` is relative flex** within a row. In a row with cards of width 1, 2, 1, the middle card gets 50% of the width.

7. **`height` is a multiplier** affecting the card's vertical size. Each unit is approximately 60px. Height also sets flex weight in fullscreen mode.

8. **Layer `type` mapping to deck.gl:**
   - `fill` / `polygon` → `PolygonLayer`
   - `line` → `LineLayer`
   - `arc` → `ArcLayer`
   - `circle` / `scatterplot` → `ScatterplotLayer`

9. **`filter` on layers** filters GeoJSON features at load time by their `properties`. Only features matching all filter conditions are rendered.

10. **`geometryType` on layers** is NOT a GeoJSON filter -- it controls visibility based on the geometry type selector dropdown. A layer with `geometryType: origin` is only visible when the user selects "Origin" in the selector.

11. **Comparison mode** shows baseline (all data) alongside filtered data in histograms and pie charts. It activates automatically when 2+ items are selected or filters are applied.

12. **Linkage column values** are matched with flexible type coercion: string `"45"` matches number `45`. Prefix patterns like `"origin_55"` also match `"55"`.

13. **Multiple filters on different cards combine with AND.** If you filter by mode=car AND distance bin [0-5km], only rows matching BOTH appear.

14. **colorSchemes are optional.** If not defined, the system uses default categorical colors from the StyleManager's theme palette.

15. **The `data-table` card type** is the interactive table connected to DataTableManager. The `table` card type (without `data-`) is a legacy TopSheet component that requires a `configFile` prop.
