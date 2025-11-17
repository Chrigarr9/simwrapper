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
  spatial_cluster?: number
  temporal_cluster?: number
  cluster?: number

  // All other attributes from CSV (84 total)
  [key: string]: any
}

export interface ClusterBoundary {
  type: 'Feature'
  geometry: any
  properties: {
    cluster_id: number
    num_requests: number
    hull_type?: 'origin' | 'destination'  // For O-D clusters
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

export interface PluginConfig {
  files: {
    requestsTable: string
    requestsGeometry: string
    clusterBoundariesOrigin: string
    clusterBoundariesDest: string
    clusterBoundariesOD: string
  }
  display: {
    colorBy: 'mode' | 'activity' | 'detour'
    defaultClusterType: 'origin' | 'destination' | 'spatial'
    showComparison: boolean
  }
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
