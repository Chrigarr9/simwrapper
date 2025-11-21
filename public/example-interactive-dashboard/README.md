# Interactive Dashboard Example

This folder contains an example interactive dashboard that demonstrates the coordination features.

## Files

- `dashboard-interactive-example.yaml` - Dashboard configuration
- `sample-data.csv` - Sample tabular data (10 records)
- `points.geojson` - Sample geographic data (10 points in Berlin)

## Features Demonstrated

1. **Centralized Data Table** - All data loaded from `sample-data.csv`
2. **Interactive Histogram** - Click bins to filter by value range
3. **Interactive Pie Chart** - Click slices to filter by category
4. **Linked Map** - Map points linked to table data, highlight on hover
5. **Data Table** - Shows filtered data based on selections

## How to Use

1. Open SimWrapper and navigate to this folder
2. The dashboard will auto-detect the `dashboard-interactive-example.yaml` file
3. Click histogram bins or pie chart slices to filter the data
4. Observe how the map and table update automatically
5. Hover over map points to see linkage highlighting

## Coordination Logic

- **OR logic within filters**: Multiple bins/categories can be selected
- **AND logic between filters**: Histogram and pie chart filters combine
- **Bi-directional linking**: Map selections filter table, stats update accordingly
