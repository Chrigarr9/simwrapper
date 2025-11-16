// Time filtering utilities

import type { Request } from '../CommuterClusteringConfig'

/**
 * Filter requests by time range
 */
export function filterByTimeRange(
  requests: Request[],
  timeRange: [number, number]
): Request[] {
  const [minTime, maxTime] = timeRange
  return requests.filter(r => r.treq >= minTime && r.treq <= maxTime)
}

/**
 * Create time bins for time slider
 * @param requests All requests
 * @param binSize Bin size in seconds (default: 900 = 15 minutes)
 * @returns Array of bin start times in seconds
 */
export function createTimeBins(
  requests: Request[],
  binSize: number = 900
): number[] {
  if (requests.length === 0) {
    return []
  }

  const times = requests.map(r => r.treq).filter(t => t !== null && t !== undefined)

  if (times.length === 0) {
    return []
  }

  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)

  const bins: number[] = []
  for (let t = minTime; t <= maxTime; t += binSize) {
    bins.push(t)
  }

  return bins
}

/**
 * Format seconds to HH:MM:SS
 */
export function formatTimeSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format seconds to HH:MM
 */
export function formatTimeMinutes(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Get time bin label
 */
export function getTimeBinLabel(startSeconds: number, binSize: number): string {
  const startTime = formatTimeMinutes(startSeconds)
  const endTime = formatTimeMinutes(startSeconds + binSize)
  return `${startTime} - ${endTime}`
}
