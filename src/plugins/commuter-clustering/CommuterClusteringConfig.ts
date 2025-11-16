// Configuration types for CommuterClustering plugin

export interface CommuterClusteringConfig {
  title?: string
  description?: string

  // Data file paths (relative to study folder)
  files: {
    requests: string                    // requests_od_lines.geojson
    requestsTable: string               // requests_od_flows.csv
    clustersOrigin: string              // cluster_boundaries_origin.geojson
    clustersDestination: string         // cluster_boundaries_destination.geojson
    clustersOD: string                  // cluster_boundaries_od.geojson
    centroidsOrigin: string             // cluster_centroids_origin.geojson
    centroidsDestination: string        // cluster_centroids_destination.geojson
    centroidsOD: string                 // cluster_centroids_od.geojson
    clusterStats: string                // cluster_statistics.csv
  }

  // Map display settings
  mapSettings?: {
    center?: [number, number]          // [lon, lat]
    zoom?: number
    bearing?: number
    pitch?: number
  }

  // Time slider settings
  timeBinSize?: number                  // Minutes (default: 15)

  // Display defaults
  defaultColorBy?: 'mode' | 'activity' | 'price' | 'detour'
  defaultClusterType?: 'origin' | 'destination' | 'spatial'

  // Color schemes (optional overrides)
  activityColors?: { [key: string]: string }
  modeColors?: { [key: string]: string }

  // Layer visibility defaults
  layers?: {
    showBoundaries?: boolean
    showCentroids?: boolean
    showOriginDestPoints?: boolean
    showFlows?: boolean
  }
}

// Request data structure (from CSV)
export interface Request {
  request_id: string                        // Unique request ID (from index)
  pax_id: string
  origin: string
  destination: string
  origin_lon: number
  origin_lat: number
  dest_lon: number
  dest_lat: number
  treq: number                          // Request time (seconds)
  treq_time: string                     // Formatted time (HH:MM:SS)
  mode: string
  main_mode: string
  travel_time: number
  distance: number

  // Clustering
  origin_cluster?: number
  destination_cluster?: number
  spatial_cluster?: number
  temporal_cluster?: number
  cluster?: number

  // Flexibility preferences
  max_detour?: number
  max_cost?: number
  max_price?: number
  max_walking_distance?: number
  max_absolute_detour?: number
  max_travel_time?: number

  // Time windows
  earliest_departure?: number
  latest_departure?: number
  earliest_arrival?: number
  latest_arrival?: number

  // Activities
  start_activity_type?: string
  end_activity_type?: string
  trip_number?: number

  // Person attributes (dynamic - from population XML)
  [key: string]: any                    // Allow additional columns
}

// Cluster boundary feature (from GeoJSON)
export interface ClusterBoundary {
  type: 'Feature'
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
  properties: {
    cluster_id: string | number
    num_requests: number
    centroid?: [number, number]  // [lon, lat] of cluster centroid
    hull_type?: 'origin' | 'destination'  // For O-D clusters
    origin_cluster?: number
    destination_cluster?: number
    spatial_cluster?: number
  }
}

// Cluster statistics (from CSV)
export interface ClusterStatistics {
  type: 'origin_cluster' | 'destination_cluster' | 'spatial_cluster' | 'cluster'
  cluster_id: string | number
  num_requests: number

  // Mode counts
  [key: `mode_${string}_count`]: number

  // Activity counts
  [key: `activity_${string}_count`]: number

  // Mean metrics
  mean_travel_time?: number
  mean_distance?: number
  mean_base_score?: number
  mean_max_detour?: number
  mean_max_cost?: number

  // Person demographics (dynamic)
  [key: string]: any
}

// Cluster data structure (grouped by type)
export interface ClusterData {
  origin: ClusterBoundary[]
  destination: ClusterBoundary[]
  spatial: ClusterBoundary[]
}

// Color encoding mode
export type ColorByMode = 'mode' | 'activity' | 'price' | 'detour'

// Cluster type
export type ClusterType = 'origin' | 'destination' | 'spatial'
