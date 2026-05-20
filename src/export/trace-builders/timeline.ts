import type { PlotlyFigure, ChartStyle } from '../types'

/**
 * Input for the timeline trace builder.
 * All fields mirror the TimelineCard props relevant to static export.
 */
export interface TimelineInput {
  filteredData: any[]
  idColumn?: string
  startColumn?: string
  endColumn?: string
  degreeColumn?: string
  title?: string
  colorBy?: string
  colorByType?: 'categorical' | 'numeric'
  colorMap?: Map<string, string>
}

/**
 * Minimal item used internally for track allocation.
 */
interface TimelineItem {
  id: string
  start: number
  end: number
  degree: number
  colorValue?: unknown
}

// ---------------------------------------------------------------------------
// Default categorical palette (matches interactive-dashboard StyleManager)
// ---------------------------------------------------------------------------
const DEFAULT_PALETTE = [
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#009E73', // green
  '#CC79A7', // pink
  '#E69F00', // amber
  '#56B4E9', // sky blue
  '#F0E442', // yellow
  '#000000', // black
]

// ---------------------------------------------------------------------------
// Track allocation – greedy interval partitioning (no overlaps in a lane)
// ---------------------------------------------------------------------------

interface TrackAllocation {
  trackIndex: number
  totalTracks: number
}

/**
 * Allocate items to swim-lane tracks using greedy interval partitioning.
 *
 * Sorts by start time, then for each item finds the first track whose end
 * time is <= item.start (i.e. the track is free). If none found, opens a
 * new track. Guarantees minimum number of tracks = max concurrency.
 *
 * Exported for testing.
 */
export function allocateTracks(items: TimelineItem[]): Map<string, TrackAllocation> {
  const allocation = new Map<string, TrackAllocation>()
  if (items.length === 0) return allocation

  const sorted = [...items].sort((a, b) => a.start - b.start)
  const trackEndTimes: number[] = []

  for (const item of sorted) {
    let assigned = -1
    for (let i = 0; i < trackEndTimes.length; i++) {
      if (trackEndTimes[i] <= item.start) {
        assigned = i
        trackEndTimes[i] = item.end
        break
      }
    }
    if (assigned === -1) {
      assigned = trackEndTimes.length
      trackEndTimes.push(item.end)
    }
    allocation.set(item.id, { trackIndex: assigned, totalTracks: 0 })
  }

  const totalTracks = trackEndTimes.length
  for (const [, alloc] of allocation) {
    alloc.totalTracks = totalTracks
  }

  return allocation
}

// ---------------------------------------------------------------------------
// Time axis helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function generateTimeTickVals(): number[] {
  const ticks: number[] = []
  for (let hour = 0; hour <= 24; hour += 2) {
    ticks.push(hour * 3600)
  }
  return ticks
}

function generateTimeTickText(): string[] {
  return generateTimeTickVals().map(formatTime)
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function resolveColor(
  item: TimelineItem,
  input: TimelineInput,
  degreeColorMap: Map<number, string>,
): string {
  // If an explicit colorMap is provided and we have a colorBy attribute, use it
  if (input.colorMap && input.colorBy) {
    const key = String(item.colorValue ?? '')
    const mapped = input.colorMap.get(key)
    if (mapped) return mapped
  }

  // Fall back to degree-based coloring
  return degreeColorMap.get(item.degree) ?? DEFAULT_PALETTE[0]
}

function buildDegreeColorMap(items: TimelineItem[]): Map<number, string> {
  const uniqueDegrees = Array.from(
    new Set(items.map(i => i.degree).filter(Number.isFinite)),
  ).sort((a, b) => a - b)

  const map = new Map<number, string>()
  uniqueDegrees.forEach((deg, idx) => {
    map.set(deg, DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length])
  })
  return map
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Plotly figure for a Gantt-style timeline chart.
 *
 * Pure function — no Vue, no DOM. Produces horizontal bar traces with
 * greedy-interval-partitioned swim lanes and HH:MM tick labels.
 */
export function buildTimelineFigure(
  input: TimelineInput,
  style: ChartStyle,
): PlotlyFigure {
  const {
    filteredData,
    idColumn = 'ride_id',
    startColumn = 'start_time',
    endColumn = 'end_time',
    degreeColumn = 'degree',
    title = '',
  } = input

  // --- 1. Transform raw rows into TimelineItems ---
  const colorAttribute = input.colorBy ?? degreeColumn
  const items: TimelineItem[] = []

  for (const row of filteredData) {
    const id = row[idColumn]
    const start = row[startColumn]
    const end = row[endColumn]
    const degree = row[degreeColumn]
    const numericDegree = typeof degree === 'number' ? degree : Number(degree)

    if (
      id !== null &&
      id !== undefined &&
      typeof start === 'number' &&
      !isNaN(start) &&
      typeof end === 'number' &&
      !isNaN(end)
    ) {
      items.push({
        id: String(id),
        start,
        end,
        degree: Number.isNaN(numericDegree) ? 1 : numericDegree,
        colorValue: row[colorAttribute],
      })
    }
  }

  // --- 2. Track allocation ---
  const allocation = allocateTracks(items)
  const totalTracks =
    allocation.size > 0
      ? [...allocation.values()][0]?.totalTracks ?? 0
      : 0

  // --- 3. Build degree-based color map ---
  const degreeColorMap = buildDegreeColorMap(items)

  // --- 4. Build trace arrays ---
  const travelY: number[] = []
  const travelBase: number[] = []
  const travelWidth: number[] = []
  const travelColors: string[] = []
  const travelCustomdata: [string, number][] = []

  for (const item of items) {
    const track = allocation.get(item.id)
    if (track) {
      travelY.push(track.trackIndex)
      travelBase.push(item.start)
      travelWidth.push(item.end - item.start)
      travelColors.push(resolveColor(item, input, degreeColorMap))
      travelCustomdata.push([item.id, item.degree])
    }
  }

  const traces: any[] = []

  if (travelY.length > 0) {
    traces.push({
      x: travelWidth,
      y: travelY,
      base: travelBase,
      type: 'bar',
      orientation: 'h',
      name: 'Actual Travel',
      marker: {
        color: travelColors,
        line: { color: style.backgroundColor, width: 0 },
      },
      width: 0.7,
      hovertemplate:
        '<b>Ride %{customdata[0]}</b><br>' +
        'Start: %{base:.0f}s<br>' +
        'Duration: %{x:.0f}s<br>' +
        'Degree: %{customdata[1]}<extra></extra>',
      customdata: travelCustomdata,
    })
  }

  // --- 5. Layout ---
  const tickVals = generateTimeTickVals()
  const tickText = generateTimeTickText()

  const layout: any = {
    font: {
      family: style.fontFamily,
      color: style.textColor,
    },
    title: title
      ? {
          text: title,
          font: {
            color: style.textColor,
            size: style.axisTitleFontSize,
            family: style.fontFamily,
          },
        }
      : { text: '' },
    xaxis: {
      title: {
        text: 'Time of Day',
        font: {
          color: style.textColor,
          size: style.axisTitleFontSize,
          family: style.fontFamily,
        },
      },
      tickfont: {
        color: style.textColor,
        size: style.axisTickFontSize,
        family: style.fontFamily,
      },
      gridcolor: style.gridColor,
      linecolor: style.isScientific ? style.textColor : style.gridColor,
      linewidth: style.isScientific ? 1.5 : 1,
      showline: true,
      zerolinecolor: style.gridColor,
      range: [0, 86400],
      tickmode: 'array' as const,
      tickvals: tickVals,
      ticktext: tickText,
    },
    yaxis: {
      title: { text: '' },
      tickfont: {
        color: style.textColor,
        size: style.axisTickFontSize,
        family: style.fontFamily,
      },
      gridcolor: style.gridColor,
      linecolor: style.isScientific ? style.textColor : style.gridColor,
      linewidth: style.isScientific ? 1.5 : 1,
      showline: true,
      showticklabels: false,
      range: totalTracks > 0 ? [-0.5, totalTracks - 0.5] : [-0.5, 0.5],
    },
    margin: style.margin ?? (() => {
      const ms = (n: number) => Math.round(n * (style.marginScale ?? 1.0))
      return { l: ms(15), r: ms(15), t: title ? ms(40) : ms(10), b: ms(35) }
    })(),
    autosize: true,
    paper_bgcolor: style.backgroundColor,
    plot_bgcolor: style.backgroundColor,
    barmode: 'overlay',
    showlegend: false,
    bargap: 0.1,
  }

  // --- 6. Config ---
  const config = {
    displayModeBar: false,
    responsive: true,
  }

  return { traces, layout, config }
}
