// Cluster filtering utilities

import type { Request, ClusterType } from '../CommuterClusteringConfig'

/**
 * Filter requests by cluster
 */
export function filterByCluster(
  requests: Request[],
  clusterId: number | string,
  clusterType: ClusterType
): Request[] {
  const columnMap: Record<ClusterType, keyof Request> = {
    origin: 'origin_cluster',
    destination: 'destination_cluster',
    spatial: 'spatial_cluster',
  }

  const column = columnMap[clusterType]
  // Convert both to strings for comparison to handle mixed types
  const targetId = String(clusterId)
  return requests.filter(r => String(r[column]) === targetId)
}

/**
 * Get unique cluster IDs from requests
 */
export function getClusterIds(
  requests: Request[],
  clusterType: ClusterType
): Array<number | string> {
  const columnMap: Record<ClusterType, keyof Request> = {
    origin: 'origin_cluster',
    destination: 'destination_cluster',
    spatial: 'spatial_cluster',
  }

  const column = columnMap[clusterType]
  const ids = requests
    .map(r => r[column])
    .filter(id => id !== undefined && id !== null && id !== -1)

  // Sort numerically if all are numbers, otherwise sort as strings
  const uniqueIds = Array.from(new Set(ids))
  const allNumbers = uniqueIds.every(id => typeof id === 'number')

  if (allNumbers) {
    return (uniqueIds as number[]).sort((a, b) => a - b)
  } else {
    return uniqueIds.sort((a, b) => String(a).localeCompare(String(b)))
  }
}

/**
 * Get request counts per cluster
 */
export function getClusterRequestCounts(
  requests: Request[],
  clusterType: ClusterType
): Map<number | string, number> {
  const columnMap: Record<ClusterType, keyof Request> = {
    origin: 'origin_cluster',
    destination: 'destination_cluster',
    spatial: 'spatial_cluster',
  }

  const column = columnMap[clusterType]
  const counts = new Map<number | string, number>()

  requests.forEach(r => {
    const clusterId = r[column]
    if (clusterId !== undefined && clusterId !== null && clusterId !== -1) {
      counts.set(clusterId, (counts.get(clusterId) || 0) + 1)
    }
  })

  return counts
}
