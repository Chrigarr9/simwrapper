/**
 * Track allocation utility for timeline visualization
 * Assigns timeline items (rides) to swim lanes using greedy interval partitioning
 *
 * The algorithm ensures:
 * 1. No overlapping items share the same track
 * 2. Minimum number of tracks are used (optimal)
 * 3. O(n log n) time complexity due to initial sort
 */

/**
 * Represents an item to be placed on the timeline
 */
export interface TimelineItem {
  id: string
  start: number  // seconds from midnight
  end: number    // seconds from midnight
}

/**
 * Result of track allocation for a single item
 */
export interface TrackAllocation {
  trackIndex: number
  totalTracks: number
}

/**
 * Allocate timeline items to tracks (swim lanes) using greedy interval partitioning.
 *
 * The algorithm works by:
 * 1. Sorting items by start time (ascending)
 * 2. Maintaining an array of track end times
 * 3. For each item: find first track where item fits (end <= item.start), or create new track
 * 4. Assign item to that track, update track end time
 *
 * This guarantees the minimum number of tracks needed (equal to max concurrent items).
 *
 * @param items - Array of timeline items with id, start, and end times
 * @returns Map from item ID to TrackAllocation (trackIndex and totalTracks)
 *
 * @example
 * const items = [
 *   { id: 'ride1', start: 21240, end: 23580 },
 *   { id: 'ride2', start: 22000, end: 24000 },  // Overlaps with ride1
 *   { id: 'ride3', start: 24000, end: 25000 },  // Can reuse ride1's track
 * ]
 * const allocation = allocateTracks(items)
 * // ride1 -> track 0
 * // ride2 -> track 1 (overlaps with ride1)
 * // ride3 -> track 0 (reuses track after ride1 ends)
 */
export function allocateTracks(items: TimelineItem[]): Map<string, TrackAllocation> {
  const allocation = new Map<string, TrackAllocation>()

  // Handle empty input
  if (items.length === 0) {
    return allocation
  }

  // Sort by start time (ascending)
  // Use a copy to avoid mutating input array
  const sorted = [...items].sort((a, b) => a.start - b.start)

  // Track end times - trackEndTimes[i] is when track i becomes available
  // Using a simple array is efficient for typical ride counts (<10K items)
  // A min-heap would be optimal for very large datasets
  const trackEndTimes: number[] = []

  for (const item of sorted) {
    // Find first track where this item fits (track ends before or when item starts)
    let assignedTrack = -1

    for (let i = 0; i < trackEndTimes.length; i++) {
      if (trackEndTimes[i] <= item.start) {
        // This track is available - item can start when track ends or later
        assignedTrack = i
        trackEndTimes[i] = item.end
        break
      }
    }

    // No existing track fits - create new track
    if (assignedTrack === -1) {
      assignedTrack = trackEndTimes.length
      trackEndTimes.push(item.end)
    }

    // Store allocation (we'll update totalTracks after processing all items)
    allocation.set(item.id, {
      trackIndex: assignedTrack,
      totalTracks: 0  // Placeholder, updated below
    })
  }

  // Update totalTracks in all allocations
  const totalTracks = trackEndTimes.length
  for (const [id, alloc] of allocation) {
    allocation.set(id, {
      trackIndex: alloc.trackIndex,
      totalTracks
    })
  }

  return allocation
}
