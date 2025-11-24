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
