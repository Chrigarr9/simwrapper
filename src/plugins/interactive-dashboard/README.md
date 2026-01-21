# Interactive Dashboard Plugin

A generalized dashboard system for SimWrapper that enables interactive coordination between visualization cards through a centralized data table and linkage system.

## Overview

The Interactive Dashboard plugin extends SimWrapper's standard dashboard capabilities by adding:

- **Centralized Data Management**: A single data table that feeds all visualization cards
- **Interactive Linkage**: Cards can filter, highlight, and interact with each other through the central data
- **Flexible Card Types**: Support for histograms, pie charts, maps, and other visualizations with interactive capabilities
- **YAML-Driven Configuration**: Simple, declarative configuration for complex interactive dashboards

## Architecture

The plugin consists of three main layers:

### 1. Data Management Layer (`managers/`)
- **DataTableManager**: Manages the central data table and provides filtered views to cards
- **FilterManager**: Handles filter state across cards with observer pattern
- **LinkageManager**: Coordinates interactions between cards based on linkage configurations

### 2. Component Layer (`components/cards/`)
- **LinkableCardWrapper**: Wraps any card to provide interactive capabilities
- **HistogramCard**: Interactive histogram with filtering
- **PieChartCard**: Interactive pie chart with filtering
- Additional cards can be added following the same pattern

### 3. Dashboard Layer
- **InteractiveDashboard.vue**: Main dashboard component that initializes managers and renders cards

## Usage

### Basic Configuration

Create a YAML file with a `table` section (which triggers the Interactive Dashboard):

```yaml
header:
  tab: "My Interactive Dashboard"
  title: "Interactive Analysis"
  description: "Explore the data interactively"

# Central data table (required - triggers InteractiveDashboard)
table:
  name: "Sample Data"
  dataset: data.csv
  idColumn: id
  visible: true

layout:
  row1:
    - type: histogram
      title: "Value Distribution"
      column: value
      binSize: 10
      linkage:
        type: filter
        column: value
        behavior: toggle

    - type: pie-chart
      title: "Category Breakdown"
      column: category
      linkage:
        type: filter
        column: category
        behavior: toggle
```

### Linkage Configuration

Cards can be linked to the central data table:

```yaml
linkage:
  type: filter           # 'filter' or 'highlight'
  column: columnName     # Column in central table
  behavior: toggle       # 'toggle' or 'replace' (for selection)
  onHover: highlight     # Behavior on hover
  onSelect: filter       # Behavior on click/selection
```

### Map Layer Linkage

Map layers can also be linked:

```yaml
- type: map
  layers:
    - name: points
      file: points.geojson
      linkage:
        tableColumn: id
        geoProperty: id
        onHover: highlight
        onSelect: filter
```

### Correlation Matrix Card

Displays a Pearson correlation matrix as an interactive heatmap, showing relationships between numeric attributes.

**YAML Configuration:**
```yaml
- type: correlation-matrix
  title: "Attribute Correlations"
  attributes:              # Required: list of columns to correlate
    - travel_time
    - distance
    - wait_time
    - detour_factor
  width: 2
  height: 4
  showValues: auto         # Optional: 'always', 'never', 'auto' (default: auto)
  pValueThreshold: 0.05    # Optional: significance threshold (default: 0.05)
  linkage:                 # Optional: link to ScatterCard
    type: attributePair
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `attributes` | string[] | (required) | Column names to include in correlation matrix |
| `showValues` | string | `'auto'` | When to show r values in cells: `'always'`, `'never'`, or `'auto'` (hide when >20 attributes) |
| `pValueThreshold` | number | `0.05` | Significance threshold; correlations with p < threshold marked with asterisk |
| `linkage.type` | string | - | Set to `'attributePair'` to enable clicking cells to update linked ScatterCard |

**Visual Features:**
- Blue-white-red diverging color scale (blue=negative, white=zero, red=positive)
- Asterisk (*) on significant correlations when cell values visible
- Hover tooltip shows: correlation (r), p-value, and sample size (n)
- Sample size displayed in header
- Loading indicator during calculation

**Linking to ScatterCard:**

To have clicking a correlation cell update a ScatterCard's axes:

1. Add `linkage.type: attributePair` to the correlation-matrix card
2. Add `listenToAttributePairSelection: true` to the ScatterCard

```yaml
layout:
  row1:
    - type: correlation-matrix
      attributes: [travel_time, distance, wait_time]
      linkage:
        type: attributePair

    - type: scatter-plot
      xColumn: travel_time
      yColumn: distance
      listenToAttributePairSelection: true
```

When user clicks a cell in the matrix, the ScatterCard updates to show that attribute pair.

## Examples

See the `examples/` directory for:
- `basic/`: Simple interactive dashboard with histogram, pie chart, and map
- `commuter-requests/`: Complex example with multiple linked visualizations

## Development

### Adding New Card Types

1. Create a new card component in `components/cards/`
2. Implement props for `filteredData`, `hoveredIds`, `selectedIds`, and `linkage`
3. Emit events when users interact with the card
4. Wrap it with `LinkableCardWrapper` in the dashboard

### Testing

Unit tests are provided for all managers in `managers/__tests__/`:
```bash
npm run test:unit
```

## Documentation

Additional documentation is available in the `docs/` directory:
- `UNIFIED_YAML_FORMAT.md`: Detailed YAML configuration reference
- `CARD_TYPES_REFERENCE.md`: Reference for all supported card types
- `PARALLEL_DEVELOPMENT_STRATEGY.md`: Development approach and architecture decisions

## Integration with SimWrapper

The Interactive Dashboard is triggered automatically when a dashboard YAML includes a `table` configuration. SimWrapper's `TabbedDashboardView` detects this and loads `InteractiveDashboard` instead of the standard `DashBoard` component.

No additional plugin registration is required - the dashboard system handles it automatically.
