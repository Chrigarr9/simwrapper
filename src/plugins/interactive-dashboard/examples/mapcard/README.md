# MapCard Examples

This directory contains example configurations for the MapCard component.

## Files

- `dashboard-mapcard-example.yaml` - Comprehensive example showing all features
- `dashboard-mapcard-minimal.yaml` - Minimal working example
- Sample data files (create as needed)

## Features Demonstrated

### Full Example (`dashboard-mapcard-example.yaml`)

1. **Multiple Layer Types**
   - Polygon layer (cluster boundaries)
   - Arc layer (flows between clusters)
   - Line layer (request OD pairs) with automatic destination markers
   - Scatterplot layer (stops)

2. **Dynamic Coloring**
   - Categorical: By mode, cluster type
   - Numeric: By number of requests (Viridis gradient)

3. **Attribute-Based Sizing**
   - Arc width scales with num_requests
   - Point radius scales with num_boardings

4. **Interactive Features**
   - Hover highlighting
   - Click to filter
   - Coordinated with histogram and pie chart

5. **Color Legend**
   - Categorical legend with click-to-filter
   - Positioned at bottom-right

6. **Custom Tooltips**
   - Template-based with property substitution

### Minimal Example (`dashboard-mapcard-minimal.yaml`)

Shows the absolute minimum configuration needed for a working map.

## Usage

Open in SimWrapper by navigating to this directory or by adding to a project's `viz-*.yaml` file:

```yaml
plugins:
  interactive-dashboard:
    - examples/mapcard/dashboard-mapcard-example.yaml
```

## Data Requirements

Each example requires corresponding GeoJSON and CSV files. See the commuter-requests example for sample data structure.
