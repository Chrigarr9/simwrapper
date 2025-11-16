# Commuter Clustering Plugin

Interactive visualization plugin for ExMas Commuter request and cluster analysis.

## Features

- **Three-Way Clustering**: Visualize origin, destination, and O-D spatial clusters
- **Interactive Map**: Request O-D flows with cluster boundaries
- **Time Filtering**: Slider to filter requests by departure time
- **Color Encoding**: Color requests by mode, activity type, price, or detour
- **Cluster Selection**: Click clusters to filter requests
- **Request Table**: Sortable, filterable table with all request attributes
- **Statistics Panel**: Charts showing mode, activity, and temporal distributions

## Configuration

Create a YAML file in your study output folder:

```yaml
type: commuter-clustering
title: "Trip Requests & Cluster Analysis"
description: "Interactive exploration of requests with spatial/temporal clustering"

files:
  requests: simwrapper/requests_od_lines.geojson
  requestsTable: simwrapper/requests_od_flows.csv
  clustersOrigin: simwrapper/cluster_boundaries_origin.geojson
  clustersDestination: simwrapper/cluster_boundaries_destination.geojson
  clustersOD: simwrapper/cluster_boundaries_od.geojson
  clusterStats: simwrapper/cluster_statistics.csv

mapSettings:
  center: [11.5, 48.15]  # [lon, lat]
  zoom: 10

timeBinSize: 15  # minutes

defaultColorBy: mode  # 'mode' | 'activity' | 'price' | 'detour'

defaultClusterType: spatial  # 'origin' | 'destination' | 'spatial'

activityColors:
  home: "#4477ff"
  work: "#ff4477"
  education: "#44ff77"
  shopping: "#ff7744"
  leisure: "#aa44ff"
  other: "#777777"

modeColors:
  car: "#ff4444"
  pt: "#4477ff"
  bike: "#44ff77"
  walk: "#ffbb44"

layers:
  showBoundaries: true
  showCentroids: false
  showOriginDestPoints: true
  showFlows: true
```

## Data Requirements

The plugin expects the following files (exported by ExMas Commuter):

### Required Files

1. **requests_od_flows.csv** - Request data with all attributes
   - Columns: pax_id, origin, destination, coordinates, time, mode, clusters, etc.

2. **requests_od_lines.geojson** - Request O-D flows as LineStrings
   - Geometry: LineString from origin to destination
   - Properties: All request attributes

3. **cluster_boundaries_*.geojson** - Cluster boundary polygons (3 files)
   - origin, destination, and O-D clusters
   - Properties: cluster_id, num_requests, hull_type

4. **cluster_statistics.csv** - Cluster metrics and demographics
   - Columns: type, cluster_id, num_requests, mean metrics, mode/activity counts

### Optional Files

5. **cluster_centroids_*.geojson** - Cluster center points (if showCentroids: true)
6. **cluster_flows_od.geojson** - Inter-cluster flows (if showFlows: true)

## Usage

1. Export data from ExMas Commuter using `export_exmas_for_simwrapper()`
2. Create YAML configuration file in study output folder
3. Open study folder in SimWrapper
4. Plugin will auto-load based on file pattern `**/viz-commuter*.y?(a)ml`

## Component Architecture

```
CommuterClustering.vue (root)
├── RequestsMap.vue - Map with Deck.gl layers
├── ClusterPanel.vue - Cluster type selector
├── StatsPanel.vue - Statistics charts
└── RequestTable.vue - Data table
```

## Interaction

- **Map Click**: Select request → highlight in table
- **Table Row Click**: Select request → highlight on map
- **Cluster Click**: Filter requests by cluster
- **Time Slider**: Filter requests by departure time
- **Color Selector**: Change request color encoding

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Credits

Developed for ExMas Commuter project.
Part of SimWrapper visualization framework.
