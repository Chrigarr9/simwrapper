// Data loading utilities for CommuterClustering plugin

import Papa from '@simwrapper/papaparse'
import type { FileSystem } from '@/Globals'
import type {
  Request,
  ClusterBoundary,
  ClusterStatistics,
  ClusterData,
} from '../CommuterClusteringConfig'

/**
 * Load request data from CSV file
 */
export async function loadRequestData(
  fileApi: FileSystem,
  subfolder: string,
  filePath: string
): Promise<Request[]> {
  try {
    const fullPath = `${subfolder}/${filePath}`
    const csvText = await fileApi.getFileText(fullPath)

    const parsed = Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      console.warn('CSV parsing errors:', parsed.errors)
    }

    return parsed.data as Request[]
  } catch (error) {
    console.error(`Error loading request data from ${filePath}:`, error)
    throw error
  }
}

/**
 * Load GeoJSON file
 */
async function loadGeoJSON(
  fileApi: FileSystem,
  subfolder: string,
  filePath: string
): Promise<any> {
  try {
    const fullPath = `${subfolder}/${filePath}`
    const jsonText = await fileApi.getFileText(fullPath)
    return JSON.parse(jsonText)
  } catch (error) {
    console.error(`Error loading GeoJSON from ${filePath}:`, error)
    throw error
  }
}

/**
 * Load cluster boundary data (all three types) with centroids
 */
export async function loadClusterData(
  fileApi: FileSystem,
  subfolder: string,
  files: {
    clustersOrigin: string
    clustersDestination: string
    clustersOD: string
    centroidsOrigin: string
    centroidsDestination: string
    centroidsOD: string
  }
): Promise<ClusterData> {
  try {
    const [
      originGeoJSON,
      destinationGeoJSON,
      spatialGeoJSON,
      originCentroids,
      destinationCentroids,
      spatialCentroids,
    ] = await Promise.all([
      loadGeoJSON(fileApi, subfolder, files.clustersOrigin),
      loadGeoJSON(fileApi, subfolder, files.clustersDestination),
      loadGeoJSON(fileApi, subfolder, files.clustersOD),
      loadGeoJSON(fileApi, subfolder, files.centroidsOrigin),
      loadGeoJSON(fileApi, subfolder, files.centroidsDestination),
      loadGeoJSON(fileApi, subfolder, files.centroidsOD),
    ])

    // Merge centroids into boundary features
    const origin = mergeCentroids(originGeoJSON.features, originCentroids.features)
    const destination = mergeCentroids(destinationGeoJSON.features, destinationCentroids.features)
    const spatial = mergeCentroids(spatialGeoJSON.features, spatialCentroids.features)

    return {
      origin,
      destination,
      spatial,
    }
  } catch (error) {
    console.error('Error loading cluster data:', error)
    throw error
  }
}

/**
 * Merge centroid coordinates into cluster boundary features
 */
function mergeCentroids(boundaries: any[], centroids: any[]): ClusterBoundary[] {
  const centroidMap = new Map<string, [number, number]>()

  // Build map of cluster_id -> centroid coordinates
  centroids.forEach((centroid: any) => {
    const clusterId = String(centroid.properties.cluster_id)
    const coords = centroid.geometry.coordinates as [number, number]
    centroidMap.set(clusterId, coords)
  })

  // Merge centroids into boundaries
  return boundaries.map((boundary: any) => {
    const clusterId = String(boundary.properties.cluster_id)
    const centroid = centroidMap.get(clusterId)

    return {
      ...boundary,
      properties: {
        ...boundary.properties,
        centroid: centroid || undefined,
      },
    } as ClusterBoundary
  })
}

/**
 * Load cluster statistics from CSV
 */
export async function loadClusterStatistics(
  fileApi: FileSystem,
  subfolder: string,
  filePath: string
): Promise<ClusterStatistics[]> {
  try {
    const fullPath = `${subfolder}/${filePath}`
    const csvText = await fileApi.getFileText(fullPath)

    const parsed = Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0) {
      console.warn('CSV parsing errors:', parsed.errors)
    }

    return parsed.data as ClusterStatistics[]
  } catch (error) {
    console.error(`Error loading cluster statistics from ${filePath}:`, error)
    throw error
  }
}

/**
 * Load request O-D lines GeoJSON (optional - for map visualization)
 */
export async function loadRequestLines(
  fileApi: FileSystem,
  subfolder: string,
  filePath: string
): Promise<any> {
  try {
    return await loadGeoJSON(fileApi, subfolder, filePath)
  } catch (error) {
    console.error(`Error loading request lines from ${filePath}:`, error)
    throw error
  }
}
