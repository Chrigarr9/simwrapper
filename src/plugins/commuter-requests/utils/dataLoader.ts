import Papa from '@simwrapper/papaparse'
import type { Request, ClusterBoundary, ClusterData, PluginConfig } from '../CommuterRequestsConfig'

/**
 * Load request data from CSV and GeoJSON files
 */
export async function loadRequestData(
  fileApi: any,
  config: PluginConfig,
  subfolder: string
): Promise<{ requests: Request[]; geometries: any[] }> {
  // Load CSV (all attributes)
  const csvPath = subfolder + '/' + config.files.requestsTable
  const csvText = await fileApi.getFileText(csvPath)

  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  })

  const requests = parsed.data as Request[]

  // Load GeoJSON (geometries)
  const geojsonPath = subfolder + '/' + config.files.requestsGeometry
  const geojsonText = await fileApi.getFileText(geojsonPath)
  const geojson = JSON.parse(geojsonText)

  return {
    requests,
    geometries: geojson.features || [],
  }
}

/**
 * Load cluster boundary GeoJSON files
 */
export async function loadClusterData(
  fileApi: any,
  config: PluginConfig,
  subfolder: string
): Promise<ClusterData> {
  const loadGeoJSON = async (filename: string): Promise<ClusterBoundary[]> => {
    try {
      const path = subfolder + '/' + filename
      const text = await fileApi.getFileText(path)
      const geojson = JSON.parse(text)
      return geojson.features || []
    } catch (error) {
      console.warn(`Failed to load ${filename}:`, error)
      return []
    }
  }

  const [origin, destination, spatial] = await Promise.all([
    loadGeoJSON(config.files.clusterBoundariesOrigin),
    loadGeoJSON(config.files.clusterBoundariesDest),
    loadGeoJSON(config.files.clusterBoundariesOD),
  ])

  return { origin, destination, spatial }
}

/**
 * Parse timebin label to get start and end times in seconds
 * Example: "13:00-13:15" → {start: 46800, end: 47700}
 * Also handles single time like "13:00" by assuming 15-minute bin
 */
export function parseTimeBin(label: string, binSizeMinutes: number = 15): { start: number; end: number } {
  if (!label) {
    throw new Error('Bin label is required')
  }

  const parseTime = (timeStr: string): number => {
    if (!timeStr) throw new Error('Time string is required')
    const [hours, minutes] = timeStr.trim().split(':').map(Number)
    return hours * 3600 + minutes * 60
  }

  // Check if it has a range (e.g., "08:00-08:15")
  if (label.includes('-')) {
    const [startStr, endStr] = label.split('-')
    return {
      start: parseTime(startStr),
      end: parseTime(endStr),
    }
  } else {
    // Single time like "08:00", calculate end based on bin size
    const start = parseTime(label)
    const end = start + binSizeMinutes * 60
    return { start, end }
  }
}

/**
 * Generate timebin labels for a given bin size (in minutes)
 */
export function generateTimeBins(binSizeMinutes: number = 15): string[] {
  const bins: string[] = []
  const totalMinutes = 24 * 60

  for (let minutes = 0; minutes < totalMinutes; minutes += binSizeMinutes) {
    const startHours = Math.floor(minutes / 60)
    const startMinutes = minutes % 60
    const endMinutes = minutes + binSizeMinutes
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60

    const start = `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`
    const end = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`

    bins.push(`${start}-${end}`)
  }

  return bins
}
