import { describe, it, expect } from 'vitest'
import { allocateTracks, TimelineItem, TrackAllocation } from '../trackAllocator'

describe('trackAllocator', () => {
  describe('allocateTracks', () => {
    it('should return empty map for empty array', () => {
      const items: TimelineItem[] = []

      const result = allocateTracks(items)

      expect(result.size).toBe(0)
    })

    it('should assign single item to track 0', () => {
      const items: TimelineItem[] = [
        { id: 'ride1', start: 21240, end: 23580 }
      ]

      const result = allocateTracks(items)

      expect(result.size).toBe(1)
      expect(result.get('ride1')).toEqual({ trackIndex: 0, totalTracks: 1 })
    })

    it('should reuse tracks for non-overlapping items', () => {
      // Two items that don't overlap should share track 0
      const items: TimelineItem[] = [
        { id: 'ride1', start: 21240, end: 23580 },  // 05:54 - 06:33
        { id: 'ride2', start: 24000, end: 25000 },  // 06:40 - 06:56 (starts after ride1 ends)
      ]

      const result = allocateTracks(items)

      expect(result.size).toBe(2)
      expect(result.get('ride1')?.trackIndex).toBe(0)
      expect(result.get('ride2')?.trackIndex).toBe(0)  // Reuses track 0
      expect(result.get('ride1')?.totalTracks).toBe(1)
      expect(result.get('ride2')?.totalTracks).toBe(1)
    })

    it('should assign overlapping items to different tracks', () => {
      // Two items that overlap must be on different tracks
      const items: TimelineItem[] = [
        { id: 'ride1', start: 21240, end: 23580 },  // 05:54 - 06:33
        { id: 'ride2', start: 22000, end: 24000 },  // 06:06 - 06:40 (overlaps with ride1)
      ]

      const result = allocateTracks(items)

      expect(result.size).toBe(2)
      expect(result.get('ride1')?.trackIndex).toBe(0)
      expect(result.get('ride2')?.trackIndex).toBe(1)  // Must use new track
      expect(result.get('ride1')?.totalTracks).toBe(2)
      expect(result.get('ride2')?.totalTracks).toBe(2)
    })

    it('should produce track count equal to max concurrent items', () => {
      // Three items where max 2 overlap at any point
      const items: TimelineItem[] = [
        { id: 'ride1', start: 1000, end: 3000 },   // 00:16 - 00:50
        { id: 'ride2', start: 2000, end: 4000 },   // 00:33 - 01:06 (overlaps ride1)
        { id: 'ride3', start: 3500, end: 5000 },   // 00:58 - 01:23 (overlaps ride2, not ride1)
      ]

      const result = allocateTracks(items)

      // Max concurrent is 2 (ride1+ride2 or ride2+ride3)
      expect(result.get('ride1')?.totalTracks).toBe(2)

      // ride1 gets track 0
      expect(result.get('ride1')?.trackIndex).toBe(0)
      // ride2 overlaps ride1, gets track 1
      expect(result.get('ride2')?.trackIndex).toBe(1)
      // ride3 starts after ride1 ends, can reuse track 0
      expect(result.get('ride3')?.trackIndex).toBe(0)
    })

    it('should handle input sorted by start time correctly', () => {
      const items: TimelineItem[] = [
        { id: 'ride1', start: 1000, end: 2000 },
        { id: 'ride2', start: 1500, end: 2500 },
        { id: 'ride3', start: 2000, end: 3000 },
      ]

      const result = allocateTracks(items)

      // ride1 and ride2 overlap -> different tracks
      expect(result.get('ride1')?.trackIndex).toBe(0)
      expect(result.get('ride2')?.trackIndex).toBe(1)
      // ride3 starts when ride1 ends -> can reuse track 0
      expect(result.get('ride3')?.trackIndex).toBe(0)
    })

    it('should handle unsorted input correctly', () => {
      // Input in reverse order should produce same allocation
      const items: TimelineItem[] = [
        { id: 'ride3', start: 2000, end: 3000 },
        { id: 'ride1', start: 1000, end: 2000 },
        { id: 'ride2', start: 1500, end: 2500 },
      ]

      const result = allocateTracks(items)

      // Same allocation as sorted input
      expect(result.get('ride1')?.trackIndex).toBe(0)
      expect(result.get('ride2')?.trackIndex).toBe(1)
      expect(result.get('ride3')?.trackIndex).toBe(0)
    })

    it('should handle items with same start time', () => {
      // Items starting at the same time must be on different tracks
      const items: TimelineItem[] = [
        { id: 'ride1', start: 1000, end: 2000 },
        { id: 'ride2', start: 1000, end: 2500 },
        { id: 'ride3', start: 1000, end: 1500 },
      ]

      const result = allocateTracks(items)

      // All start at same time -> all need different tracks
      const tracks = new Set([
        result.get('ride1')?.trackIndex,
        result.get('ride2')?.trackIndex,
        result.get('ride3')?.trackIndex,
      ])
      expect(tracks.size).toBe(3)
      expect(result.get('ride1')?.totalTracks).toBe(3)
    })

    it('should handle items with zero duration (start === end)', () => {
      const items: TimelineItem[] = [
        { id: 'ride1', start: 1000, end: 1000 },  // Zero duration (instant event)
        { id: 'ride2', start: 1000, end: 2000 },  // Starts at same time
      ]

      const result = allocateTracks(items)

      // Zero-duration item finishes immediately, so ride2 can reuse the track
      // This is correct: an instant event at t=1000 doesn't block an interval [1000, 2000]
      expect(result.get('ride1')?.trackIndex).toBe(0)
      expect(result.get('ride2')?.trackIndex).toBe(0)  // Can share track
      expect(result.get('ride1')?.totalTracks).toBe(1)
    })

    it('should handle item starting exactly when another ends', () => {
      // Items that touch at boundaries should share tracks
      const items: TimelineItem[] = [
        { id: 'ride1', start: 1000, end: 2000 },
        { id: 'ride2', start: 2000, end: 3000 },  // Starts exactly when ride1 ends
      ]

      const result = allocateTracks(items)

      // Should share the same track (end <= start condition)
      expect(result.get('ride1')?.trackIndex).toBe(0)
      expect(result.get('ride2')?.trackIndex).toBe(0)
      expect(result.get('ride1')?.totalTracks).toBe(1)
    })

    it('should handle many concurrent items', () => {
      // 5 items all overlapping
      const items: TimelineItem[] = [
        { id: 'ride1', start: 1000, end: 5000 },
        { id: 'ride2', start: 1500, end: 5500 },
        { id: 'ride3', start: 2000, end: 6000 },
        { id: 'ride4', start: 2500, end: 6500 },
        { id: 'ride5', start: 3000, end: 7000 },
      ]

      const result = allocateTracks(items)

      // All overlap at some point -> need 5 tracks
      expect(result.get('ride1')?.totalTracks).toBe(5)

      // Each should get a unique track
      const tracks = new Set([
        result.get('ride1')?.trackIndex,
        result.get('ride2')?.trackIndex,
        result.get('ride3')?.trackIndex,
        result.get('ride4')?.trackIndex,
        result.get('ride5')?.trackIndex,
      ])
      expect(tracks.size).toBe(5)
    })

    it('should handle sequential non-overlapping items efficiently', () => {
      // Many items that don't overlap should all use track 0
      const items: TimelineItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `ride${i}`,
        start: i * 1000,
        end: i * 1000 + 500,  // Each ends before next starts
      }))

      const result = allocateTracks(items)

      expect(result.size).toBe(100)
      // All should be on track 0
      for (let i = 0; i < 100; i++) {
        expect(result.get(`ride${i}`)?.trackIndex).toBe(0)
      }
      expect(result.get('ride0')?.totalTracks).toBe(1)
    })

    it('should handle real-world ride data pattern', () => {
      // Simulating typical ride data: varying durations, some overlap
      const items: TimelineItem[] = [
        { id: 'r1', start: 21240, end: 22800 },  // 05:54 - 06:20
        { id: 'r2', start: 21600, end: 23400 },  // 06:00 - 06:30 (overlaps r1)
        { id: 'r3', start: 22200, end: 23100 },  // 06:10 - 06:25 (overlaps r1, r2)
        { id: 'r4', start: 23000, end: 24600 },  // 06:23 - 06:50 (overlaps r2, r3)
        { id: 'r5', start: 23500, end: 24500 },  // 06:31 - 06:48 (overlaps r4)
      ]

      const result = allocateTracks(items)

      // Max concurrent = 3 (r1, r2, r3 overlap around 06:10-06:20)
      expect(result.get('r1')?.totalTracks).toBe(3)

      // Verify no overlaps on same track
      const trackItems: Map<number, Array<{start: number, end: number}>> = new Map()
      for (const item of items) {
        const track = result.get(item.id)?.trackIndex!
        if (!trackItems.has(track)) {
          trackItems.set(track, [])
        }
        trackItems.get(track)!.push({ start: item.start, end: item.end })
      }

      // For each track, verify no overlaps
      for (const [_, trackRides] of trackItems) {
        trackRides.sort((a, b) => a.start - b.start)
        for (let i = 1; i < trackRides.length; i++) {
          expect(trackRides[i].start).toBeGreaterThanOrEqual(trackRides[i-1].end)
        }
      }
    })

    it('should not mutate input array', () => {
      const items: TimelineItem[] = [
        { id: 'ride3', start: 3000, end: 4000 },
        { id: 'ride1', start: 1000, end: 2000 },
        { id: 'ride2', start: 2000, end: 3000 },
      ]
      const originalOrder = items.map(i => i.id)

      allocateTracks(items)

      // Input array should be unchanged
      expect(items.map(i => i.id)).toEqual(originalOrder)
    })
  })
})
