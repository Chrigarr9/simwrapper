import type { Request } from '../CommuterRequestsConfig'
import { parseTimeBin } from './dataLoader'

/**
 * Apply cluster filter to requests
 * Returns true if request passes filter (OR logic within selected clusters)
 */
export function applyClusterFilter(
  request: Request,
  selectedClusters: Set<string | number>,
  clusterType: 'origin' | 'destination' | 'spatial'
): boolean {
  if (selectedClusters.size === 0) return true

  const clusterColumn =
    clusterType === 'origin'
      ? 'origin_cluster'
      : clusterType === 'destination'
      ? 'destination_cluster'
      : 'od_cluster'  // Updated from spatial_cluster to match Python export

  const clusterValue = request[clusterColumn]
  if (clusterValue === undefined || clusterValue === -1) return false

  // Check each selected cluster ID
  for (const selectedId of selectedClusters) {
    // Handle string IDs from GeoJSON like "origin_55" or "destination_45"
    if (typeof selectedId === 'string') {
      // Extract numeric part from "origin_55" -> 55
      const numericMatch = selectedId.match(/\d+$/)
      if (numericMatch) {
        const numericId = parseInt(numericMatch[0], 10)
        if (clusterValue === numericId) return true
      }
    }
    // Handle direct numeric comparison
    if (clusterValue === selectedId) return true
  }

  return false
}

/**
 * Apply timebin filter to requests
 * Returns true if request is active during any selected timebin (OR logic)
 * Active if: treq <= bin_end AND (treq + travel_time) >= bin_start
 */
export function applyTimebinFilter(
  request: Request,
  selectedTimebins: Set<string>
): boolean {
  if (selectedTimebins.size === 0) return true

  const requestStart = request.treq
  const requestEnd = request.treq + request.travel_time

  // Check if request is active in ANY selected timebin
  for (const binLabel of selectedTimebins) {
    const { start, end } = parseTimeBin(binLabel)

    // Request is active if it overlaps with this timebin
    if (requestStart <= end && requestEnd >= start) {
      return true
    }
  }

  return false
}

/**
 * Apply mode filter to requests
 * Returns true if request passes filter (OR logic within selected modes)
 */
export function applyModeFilter(request: Request, selectedModes: Set<string>): boolean {
  if (selectedModes.size === 0) return true

  const mode = request.main_mode || request.mode || 'unknown'
  return selectedModes.has(mode)
}

/**
 * Apply request ID filter
 * Returns true if request passes filter (OR logic within selected IDs)
 */
export function applyRequestIdFilter(
  request: Request,
  selectedRequestIds: Set<string>
): boolean {
  if (selectedRequestIds.size === 0) return true
  return selectedRequestIds.has(String(request.request_id))
}

/**
 * Apply all filters to requests (AND logic between filter types)
 */
export function filterRequests(
  allRequests: Request[],
  selectedClusters: Set<string | number>,
  selectedTimebins: Set<string>,
  selectedModes: Set<string>,
  selectedRequestIds: Set<string>,
  clusterType: 'origin' | 'destination' | 'spatial'
): Request[] {
  return allRequests.filter(
    (request) =>
      applyClusterFilter(request, selectedClusters, clusterType) &&
      applyTimebinFilter(request, selectedTimebins) &&
      applyModeFilter(request, selectedModes) &&
      applyRequestIdFilter(request, selectedRequestIds)
  )
}
