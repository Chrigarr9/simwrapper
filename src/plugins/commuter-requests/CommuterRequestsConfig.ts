// Type definitions for Commuter Requests Plugin

export interface Request {
  request_id: string
  pax_id: string
  origin: string
  destination: string
  origin_lon: number
  origin_lat: number
  dest_lon: number
  dest_lat: number
  treq: number
  treq_time: string
  mode: string
  main_mode: string
  travel_time: number
  distance: number

  // Clustering
  origin_cluster?: number
  destination_cluster?: number
  od_cluster?: number  // Updated from spatial_cluster to match Python export
  temporal_cluster?: number
  cluster?: number

  // All other attributes from CSV (84 total)
  [key: string]: any
}

export interface ClusterBoundary {
  type: 'Feature'
  geometry: any
  properties: {
    cluster_id: number | string
    cluster_type: 'origin' | 'destination' | 'od' | 'spatial' | 'temporal'
    geometry_type?: 'boundary' | 'centroid' | 'flow'
    num_requests: number
    hull_type?: 'origin' | 'destination'  // For O-D clusters
    boundary_part?: 'origin' | 'destination'  // Which part of OD cluster boundary
    centroid_type?: 'origin' | 'destination' | 'od'  // For centroid points
    mean_travel_time?: number  // For flow features (seconds)
    mean_distance?: number  // For flow features (meters)
  }
}

export interface ClusterData {
  origin: ClusterBoundary[]
  destination: ClusterBoundary[]
  spatial: ClusterBoundary[]
}

export interface PluginState {
  // Data
  allRequests: Request[]
  requestGeometries: any[]  // GeoJSON features
  clusterBoundaries: ClusterData

  // Filters
  selectedClusters: Set<number>
  selectedTimebins: Set<string>
  clusterType: 'origin' | 'destination' | 'spatial'

  // UI
  showComparison: boolean
  colorBy: 'mode' | 'activity' | 'detour'
  loadingText: string
}

export interface ColorByAttribute {
  attribute: string
  label: string
  type: 'categorical' | 'numeric'
  scale?: [number, number]  // Optional min/max for numeric types
}

export interface ColorByConfig {
  default: string
  attributes: ColorByAttribute[]
}

export interface ColumnFormat {
  type?: 'string' | 'number' | 'decimal' | 'time' | 'duration' | 'distance' | 'boolean'
  unit?: string  // Display unit (e.g., 'km', 'h', 'min', 's', 'm')
  decimals?: number  // Number of decimal places for numeric types
  convertFrom?: 'seconds' | 'meters'  // Source unit for automatic conversion
}

export interface TableColumnConfig {
  show?: string[]  // Explicit list of columns to show (empty = show all)
  hide?: string[]  // Columns to hide (applied after show filter)
  formats?: { [columnKey: string]: ColumnFormat }  // Column-specific formatting
}

export interface TableConfig {
  name?: string  // Table display name (default: "Items")
  columns?: TableColumnConfig  // Column visibility config
}

export interface PluginConfig {
  files: {
    requestsTable: string
    requestsGeometry: string
    clusterGeometries: string  // Unified cluster geometries file
  }
  display: {
    colorBy?: string  // Made optional for backwards compatibility
    defaultClusterType: 'origin' | 'destination' | 'spatial'
    showComparison: boolean
  }
  table?: TableConfig  // NEW: Table configuration
  colorBy?: ColorByConfig  // NEW: YAML-driven color-by configuration
  stats: StatConfig[]
}

export interface StatConfig {
  type: 'active-time-histogram' | 'main-mode-pie'
  binSize?: number  // For histogram
  title?: string
}

export interface TimeBin {
  start: number  // Seconds since midnight
  end: number
  label: string  // e.g., "13:00-13:15"
}
