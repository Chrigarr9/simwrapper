import { describe, it, expect } from 'vitest'
import { buildTimelineFigure, allocateTracks, type TimelineInput } from '../timeline'
import type { ChartStyle } from '../../types'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const STYLE: ChartStyle = {
  axisTitleFontSize: 14,
  axisTickFontSize: 12,
  legendTitleFontSize: 13,
  legendFontSize: 12,
  lineWidth: 2.4,
  markerSizeMultiplier: 1.35,
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  gridColor: '#cccccc',
  barColor: '#0072B2',
  selectedColor: '#666666',
  isScientific: true,
}

function makeRows(
  overrides?: Partial<Record<string, unknown>>[],
): any[] {
  const defaults = [
    { ride_id: 'r1', start_time: 21600, end_time: 23400, degree: 1 }, // 06:00 - 06:30
    { ride_id: 'r2', start_time: 28800, end_time: 32400, degree: 2 }, // 08:00 - 09:00
    { ride_id: 'r3', start_time: 22000, end_time: 24000, degree: 3 }, // overlaps r1
  ]
  if (overrides) {
    return defaults.map((d, i) => ({ ...d, ...(overrides[i] ?? {}) }))
  }
  return defaults
}

// ---------------------------------------------------------------------------
// allocateTracks (unit)
// ---------------------------------------------------------------------------

describe('allocateTracks', () => {
  it('returns empty map for empty input', () => {
    const result = allocateTracks([])
    expect(result.size).toBe(0)
  })

  it('assigns non-overlapping items to the same track', () => {
    const items = [
      { id: 'a', start: 0, end: 100, degree: 1 },
      { id: 'b', start: 200, end: 300, degree: 1 },
      { id: 'c', start: 400, end: 500, degree: 1 },
    ]
    const alloc = allocateTracks(items)
    expect(alloc.get('a')!.trackIndex).toBe(0)
    expect(alloc.get('b')!.trackIndex).toBe(0)
    expect(alloc.get('c')!.trackIndex).toBe(0)
    expect(alloc.get('a')!.totalTracks).toBe(1)
  })

  it('assigns overlapping items to separate tracks', () => {
    const items = [
      { id: 'a', start: 0, end: 200, degree: 1 },
      { id: 'b', start: 100, end: 300, degree: 1 }, // overlaps a
    ]
    const alloc = allocateTracks(items)
    expect(alloc.get('a')!.trackIndex).toBe(0)
    expect(alloc.get('b')!.trackIndex).toBe(1)
    expect(alloc.get('a')!.totalTracks).toBe(2)
  })

  it('reuses tracks once they become free', () => {
    const items = [
      { id: 'a', start: 0, end: 100, degree: 1 },
      { id: 'b', start: 50, end: 150, degree: 1 },  // overlaps a -> track 1
      { id: 'c', start: 100, end: 200, degree: 1 },  // a finishes at 100, c starts at 100 -> track 0
    ]
    const alloc = allocateTracks(items)
    expect(alloc.get('a')!.trackIndex).toBe(0)
    expect(alloc.get('b')!.trackIndex).toBe(1)
    expect(alloc.get('c')!.trackIndex).toBe(0) // reuses track 0
    expect(alloc.get('c')!.totalTracks).toBe(2)
  })

  it('handles items that touch (end == next start) on same track', () => {
    const items = [
      { id: 'a', start: 0, end: 100, degree: 1 },
      { id: 'b', start: 100, end: 200, degree: 1 },
    ]
    const alloc = allocateTracks(items)
    expect(alloc.get('a')!.trackIndex).toBe(0)
    expect(alloc.get('b')!.trackIndex).toBe(0)
    expect(alloc.get('b')!.totalTracks).toBe(1)
  })

  it('handles three fully concurrent items', () => {
    const items = [
      { id: 'a', start: 0, end: 100, degree: 1 },
      { id: 'b', start: 0, end: 100, degree: 1 },
      { id: 'c', start: 0, end: 100, degree: 1 },
    ]
    const alloc = allocateTracks(items)
    const tracks = new Set([
      alloc.get('a')!.trackIndex,
      alloc.get('b')!.trackIndex,
      alloc.get('c')!.trackIndex,
    ])
    expect(tracks.size).toBe(3)
    expect(alloc.get('a')!.totalTracks).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// buildTimelineFigure – basic structure
// ---------------------------------------------------------------------------

describe('buildTimelineFigure', () => {
  it('returns valid PlotlyFigure shape', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    expect(fig).toHaveProperty('traces')
    expect(fig).toHaveProperty('layout')
    expect(fig).toHaveProperty('config')
    expect(Array.isArray(fig.traces)).toBe(true)
  })

  it('produces horizontal bar trace', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    expect(fig.traces.length).toBeGreaterThanOrEqual(1)
    const trace = fig.traces[0] as any
    expect(trace.type).toBe('bar')
    expect(trace.orientation).toBe('h')
  })

  it('uses barmode overlay', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)
    expect((fig.layout as any).barmode).toBe('overlay')
  })

  it('sets displayModeBar to false in config', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)
    expect((fig.config as any).displayModeBar).toBe(false)
  })

  it('hides Y-axis tick labels', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)
    expect((fig.layout as any).yaxis.showticklabels).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Empty / invalid data
  // -----------------------------------------------------------------------

  it('returns empty traces for empty filteredData', () => {
    const input: TimelineInput = { filteredData: [] }
    const fig = buildTimelineFigure(input, STYLE)
    expect(fig.traces).toHaveLength(0)
  })

  it('skips rows with missing start/end', () => {
    const rows = [
      { ride_id: 'r1', start_time: 1000, end_time: 2000, degree: 1 },
      { ride_id: 'r2', start_time: null, end_time: 3000, degree: 1 },
      { ride_id: 'r3', start_time: 4000, end_time: undefined, degree: 1 },
    ]
    const input: TimelineInput = { filteredData: rows }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    expect(trace.y).toHaveLength(1)
  })

  it('skips rows with missing id', () => {
    const rows = [
      { ride_id: null, start_time: 1000, end_time: 2000, degree: 1 },
      { ride_id: 'r2', start_time: 1000, end_time: 2000, degree: 1 },
    ]
    const input: TimelineInput = { filteredData: rows }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    expect(trace.y).toHaveLength(1)
  })

  it('defaults degree to 1 when missing or NaN', () => {
    const rows = [
      { ride_id: 'r1', start_time: 1000, end_time: 2000, degree: 'bad' },
      { ride_id: 'r2', start_time: 3000, end_time: 4000 }, // no degree key
    ]
    const input: TimelineInput = { filteredData: rows }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    // Both items present (degree defaults to 1)
    expect(trace.y).toHaveLength(2)
    expect(trace.customdata[0][1]).toBe(1)
    expect(trace.customdata[1][1]).toBe(1)
  })

  // -----------------------------------------------------------------------
  // Time axis
  // -----------------------------------------------------------------------

  it('sets x-axis range to 0-86400', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)
    expect((fig.layout as any).xaxis.range).toEqual([0, 86400])
  })

  it('generates HH:MM tick labels every 2 hours', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    const ticktext = (fig.layout as any).xaxis.ticktext as string[]
    expect(ticktext[0]).toBe('00:00')
    expect(ticktext[1]).toBe('02:00')
    expect(ticktext[ticktext.length - 1]).toBe('24:00')
    expect(ticktext).toHaveLength(13) // 0, 2, 4, ... 24 = 13 ticks
  })

  // -----------------------------------------------------------------------
  // Track allocation integration
  // -----------------------------------------------------------------------

  it('allocates overlapping items to different Y positions', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    const yValues = trace.y as number[]

    // r1 (21600-23400) and r3 (22000-24000) overlap, so different tracks
    // r2 (28800-32400) doesn't overlap with either, can reuse a track
    const uniqueTracks = new Set(yValues)
    expect(uniqueTracks.size).toBe(2) // Need 2 tracks due to r1/r3 overlap
  })

  it('Y range covers all tracks', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    const yRange = (fig.layout as any).yaxis.range as [number, number]
    expect(yRange[0]).toBe(-0.5)
    expect(yRange[1]).toBeGreaterThanOrEqual(0.5) // at least 1 track
  })

  // -----------------------------------------------------------------------
  // Coloring
  // -----------------------------------------------------------------------

  it('assigns different colors for different degrees', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    const colors = trace.marker.color as string[]
    // degrees 1, 2, 3 -> three distinct colors
    const uniqueColors = new Set(colors)
    expect(uniqueColors.size).toBe(3)
  })

  it('uses colorMap when provided with colorBy', () => {
    const rows = [
      { ride_id: 'r1', start_time: 0, end_time: 100, degree: 1, mode: 'car' },
      { ride_id: 'r2', start_time: 200, end_time: 300, degree: 1, mode: 'bike' },
    ]
    const colorMap = new Map([
      ['car', '#ff0000'],
      ['bike', '#00ff00'],
    ])
    const input: TimelineInput = {
      filteredData: rows,
      colorBy: 'mode',
      colorMap,
    }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    const colors = trace.marker.color as string[]
    expect(colors[0]).toBe('#ff0000')
    expect(colors[1]).toBe('#00ff00')
  })

  it('falls back to degree color when colorMap entry missing', () => {
    const rows = [
      { ride_id: 'r1', start_time: 0, end_time: 100, degree: 2, mode: 'unknown' },
    ]
    const colorMap = new Map([['car', '#ff0000']])
    const input: TimelineInput = {
      filteredData: rows,
      colorBy: 'mode',
      colorMap,
    }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    const colors = trace.marker.color as string[]
    // Should NOT be the car color — should be a degree color
    expect(colors[0]).not.toBe('#ff0000')
    expect(typeof colors[0]).toBe('string')
    expect(colors[0].length).toBeGreaterThan(0)
  })

  // -----------------------------------------------------------------------
  // Custom columns
  // -----------------------------------------------------------------------

  it('respects custom column names', () => {
    const rows = [
      { trip: 'T1', dep: 3600, arr: 7200, pool: 4 },
    ]
    const input: TimelineInput = {
      filteredData: rows,
      idColumn: 'trip',
      startColumn: 'dep',
      endColumn: 'arr',
      degreeColumn: 'pool',
    }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    expect(trace.y).toHaveLength(1)
    expect(trace.base[0]).toBe(3600)
    expect(trace.x[0]).toBe(3600) // width = 7200 - 3600
    expect(trace.customdata[0][0]).toBe('T1')
    expect(trace.customdata[0][1]).toBe(4)
  })

  // -----------------------------------------------------------------------
  // Style integration
  // -----------------------------------------------------------------------

  it('uses style colors for background and text', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    expect((fig.layout as any).paper_bgcolor).toBe('#ffffff')
    expect((fig.layout as any).plot_bgcolor).toBe('#ffffff')
    expect((fig.layout as any).font.color).toBe('#000000')
    expect((fig.layout as any).font.family).toBe('Arial, Helvetica, sans-serif')
  })

  it('uses scientific axis line styling when isScientific is true', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    expect((fig.layout as any).xaxis.linecolor).toBe('#000000') // textColor
    expect((fig.layout as any).xaxis.linewidth).toBe(1.5)
  })

  it('uses grid color for axis line when not scientific', () => {
    const nonSciStyle = { ...STYLE, isScientific: false }
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, nonSciStyle)

    expect((fig.layout as any).xaxis.linecolor).toBe('#cccccc') // gridColor
    expect((fig.layout as any).xaxis.linewidth).toBe(1)
  })

  // -----------------------------------------------------------------------
  // Title
  // -----------------------------------------------------------------------

  it('sets title when provided', () => {
    const input: TimelineInput = {
      filteredData: makeRows(),
      title: 'Ride Timeline',
    }
    const fig = buildTimelineFigure(input, STYLE)
    expect((fig.layout as any).title.text).toBe('Ride Timeline')
  })

  it('uses empty string title when not provided', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)
    expect((fig.layout as any).title.text).toBe('')
  })

  // -----------------------------------------------------------------------
  // Trace data integrity
  // -----------------------------------------------------------------------

  it('customdata contains [id, degree] tuples', () => {
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    for (const entry of trace.customdata) {
      expect(Array.isArray(entry)).toBe(true)
      expect(entry).toHaveLength(2)
      expect(typeof entry[0]).toBe('string') // id
      expect(typeof entry[1]).toBe('number') // degree
    }
  })

  it('base array contains start times, x array contains durations', () => {
    const rows = [
      { ride_id: 'r1', start_time: 1000, end_time: 2500, degree: 1 },
    ]
    const input: TimelineInput = { filteredData: rows }
    const fig = buildTimelineFigure(input, STYLE)

    const trace = fig.traces[0] as any
    expect(trace.base[0]).toBe(1000)
    expect(trace.x[0]).toBe(1500) // 2500 - 1000
  })

  // -----------------------------------------------------------------------
  // Margin with custom style
  // -----------------------------------------------------------------------

  it('uses style.margin when provided', () => {
    const customStyle = { ...STYLE, margin: { l: 50, r: 50, t: 60, b: 60 } }
    const input: TimelineInput = { filteredData: makeRows() }
    const fig = buildTimelineFigure(input, customStyle)
    expect((fig.layout as any).margin).toEqual({ l: 50, r: 50, t: 60, b: 60 })
  })
})
