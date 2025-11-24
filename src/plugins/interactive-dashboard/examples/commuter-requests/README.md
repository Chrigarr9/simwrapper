# Commuter Requests - Interactive Dashboard Implementation

This is a re-implementation of the commuter-requests plugin using the new InteractiveDashboard approach with YAML configuration.

## Purpose

This dashboard serves as the **primary validation** that the generic InteractiveDashboard approach has full feature parity with specialized Vue plugins. It recreates all functionality from `src/plugins/commuter-requests/` using only declarative YAML configuration.

## Files in this Directory

- **`dashboard-commuter-requests-interactive.yaml`** - Main dashboard configuration
  - Defines all visualizations (map, histogram, pie chart, table, stats)
  - Configures linkages and interactions
  - Specifies color schemes and formatting
  - Declares controls (cluster type selector, color-by selector, etc.)

- **`VALIDATION_CHECKLIST.md`** - 20-point feature parity validation checklist
  - Comprehensive testing procedure
  - Point-by-point comparison with original plugin
  - Performance benchmarks

- **`README.md`** - This file

## Required Data Files

The dashboard expects the following data files in the same directory:

1. **`requests.csv`** - Main request data table
   - Columns: request_id, pax_id, origin, destination, origin_lon, origin_lat, dest_lon, dest_lat, treq, treq_time, mode, main_mode, travel_time, distance, origin_cluster, destination_cluster, od_cluster, temporal_cluster, cluster, and all other request attributes

2. **`requests_geometries.geojson`** - Request geometries (LineStrings from origin to destination)
   - Each feature has properties matching the request data
   - Used for map visualization of individual requests

3. **`cluster_geometries.geojson`** - Cluster boundaries and flows
   - Contains Polygon/MultiPolygon features for cluster boundaries
   - Contains LineString features for cluster flows (geometry_type="flow")
   - Properties include cluster_id, cluster_type, num_requests, etc.

## Comparison with Original Plugin

### Original Implementation
- **Location**: `src/plugins/commuter-requests/`
- **Type**: Specialized Vue component (~1,125 lines in main component)
- **Approach**: Hand-coded interactions, filtering, and state management
- **Components**: 10+ separate Vue components
- **Maintenance**: Requires Vue/TypeScript expertise

### New Interactive Dashboard
- **Location**: `public/commuter-requests-interactive/`
- **Type**: Generic YAML configuration (~300 lines)
- **Approach**: Declarative configuration interpreted by InteractiveDashboard
- **Components**: Zero custom components (uses generic ones)
- **Maintenance**: YAML editing only

### Feature Parity

Both implementations provide:
- ✅ Data table with dynamic columns, sorting, export
- ✅ Active time histogram with 15-minute bins
- ✅ Main mode pie chart
- ✅ Interactive map with multiple layers (clusters, requests, flows)
- ✅ Cross-component filtering (AND between types, OR within types)
- ✅ Hover highlighting across all components
- ✅ Toggle selection (click to select/deselect)
- ✅ Multi-select (overlapping clusters, multiple bins/modes)
- ✅ Comparison mode (baseline vs filtered)
- ✅ Cluster type switching (origin/destination/spatial)
- ✅ Color-by attribute switching
- ✅ Dark mode support
- ✅ Auto-scroll on hover

## Key Architectural Features Validated

This dashboard validates these critical InteractiveDashboard capabilities:

1. **Centralized Data Table**: Single `table` section triggering InteractiveDashboard mode
2. **Multi-layer Maps**: Polygons, arcs, points with different linkages
3. **Complex Filtering**: AND/OR logic, toggle behavior, multi-select
4. **Active Time Calculation**: Special histogram mode checking if requests are active during time bins
5. **Dynamic Controls**: Cluster type selector that updates layer visibility and linkages
6. **Color Schemes**: Both categorical (modes, activities) and numeric (detour, cost, time)
7. **Comparison Mode**: Baseline vs filtered visualization
8. **Hover Highlighting**: Cross-component with auto-scroll
9. **Column Formatting**: Time, duration, distance conversions with units

## How to Use

1. **Prepare Data Files**: Copy data files from original plugin or generate from simulation outputs
2. **Navigate to Folder**: Open SimWrapper and navigate to `commuter-requests-interactive/`
3. **View Dashboard**: The YAML file should auto-load and render the interactive dashboard
4. **Interact**: Click, hover, and filter to explore the data
5. **Compare**: Open original plugin side-by-side to verify feature parity

## Validation Procedure

See **`VALIDATION_CHECKLIST.md`** for the complete 20-point validation procedure.

**Quick validation**:
1. Load dashboard (should complete without errors)
2. Click a histogram bin (should filter table and map)
3. Click a pie slice (should filter table and map)
4. Click a cluster on map (should filter table)
5. Hover over map (should highlight table row)
6. Clear filters (should restore full dataset)

## Expected Behavior

The dashboard should behave **identically** to the original plugin:
- Same visualizations and layout
- Same filtering interactions
- Same hover behavior
- Same multi-select capabilities
- Same performance characteristics

## Development Notes

### Histogram "Active Time" Mode
The histogram uses a special `mode: active_time` configuration that:
- Creates bins based on `treq` column (request time)
- Checks if request is active during each bin using `travel_time` column
- A request is "active" in a bin if: `treq <= bin_end AND (treq + travel_time) >= bin_start`
- This matches the original plugin's `calculateBins()` logic exactly

### Cluster Type Switching
The `cluster-type-selector` control dynamically updates:
- **Layer linkages**: Changes which column is used for filtering (origin_cluster, destination_cluster, od_cluster)
- **Layer visibility**: Shows/hides cluster flow arrows (only visible for spatial/OD type)
- **Statistics**: Updates "Active Clusters" metric to count the correct cluster type

### Multi-Select on Overlapping Geometries
When clicking on the map where multiple clusters overlap:
- The map uses `pickMultipleObjects` to detect ALL geometries at cursor position
- All detected clusters are selected simultaneously
- Filters apply with OR logic within cluster type (match ANY selected cluster)

## Future Enhancements

Potential improvements that could be added via YAML:
- [ ] Temporal cluster flow visualization
- [ ] Request animation over time
- [ ] Heatmap layer for request density
- [ ] Custom aggregations in stats panel
- [ ] Saved filter presets
- [ ] URL parameter sharing for specific filters

## Troubleshooting

**Dashboard doesn't load:**
- Check browser console for errors
- Verify data files are in the same directory
- Ensure YAML syntax is valid

**Filtering doesn't work:**
- Verify `idColumn` matches actual column in CSV
- Check that GeoJSON `properties.request_id` matches CSV `request_id`
- Ensure column names in linkages match actual data

**Map layers not visible:**
- Check GeoJSON file structure
- Verify geometry types match layer configuration (polygon, arc, point)
- Check filter conditions (e.g., cluster_flows only visible for spatial type)

**Performance issues:**
- Large datasets (>10,000 requests) may require optimization
- Consider data sampling or aggregation for very large datasets
- Check browser memory usage

## Contributing

When modifying this dashboard:
1. Update `VALIDATION_CHECKLIST.md` if adding new features
2. Test against original plugin to maintain feature parity
3. Document any deviations or enhancements
4. Update this README with new capabilities

## References

- Original plugin: `src/plugins/commuter-requests/`
- InteractiveDashboard docs: `docs/interactive-dashboard.md` (if exists)
- SimWrapper main docs: https://simwrapper.github.io/
