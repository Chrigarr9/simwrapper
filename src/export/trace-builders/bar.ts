import type { BarInput, ChartStyle, PlotlyFigure } from '../types'
import { buildReferenceShape, buildReferenceAnnotation } from './_layout-helpers'

// Pattern shapes for scientific (B&W-safe) multi-trace bar charts.
// All entries are non-empty so that every trace in scientific mode gets a
// distinct fill pattern — Plotly renders '' as no pattern (solid fill only).
const BAR_PATTERNS = ['/', '\\', 'x', '-', '|', '+', '.', '/\\']

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Plotly figure for a bar chart card.
 *
 * Pure function: no Vue reactivity, no DOM access, no StyleManager.
 * All visual parameters come from the `style` argument.
 */
export function buildBarFigure(input: BarInput, style: ChartStyle): PlotlyFigure {
  const {
    title,
    xColumn,
    yColumns,
    colorByColumn,
    barmode = 'group',
    yAxisTitle,
    xAxisTitle,
    filteredData,
    annotations,
    referenceLines,
  } = input

  const traces: any[] = []

  if (colorByColumn) {
    // Split single yColumn into one trace per category value
    const yCol = yColumns[0]
    const cats = Array.from(new Set(filteredData.map(r => r[colorByColumn])))
    const xVals = Array.from(new Set(filteredData.map(r => r[xColumn])))
    cats.forEach((cat, i) => {
      const rows = filteredData.filter(r => r[colorByColumn] === cat)
      const lookup = new Map(rows.map(r => [r[xColumn], r[yCol]]))
      traces.push(
        buildSingleTrace({
          name: String(cat),
          x: xVals,
          // null → Plotly renders no bar for this x; 0 would imply a measured zero
          y: xVals.map(x => lookup.get(x) ?? null),
          traceIndex: i,
          totalTraces: cats.length,
          style,
        })
      )
    })
  } else {
    // One trace per yColumn
    const xVals = filteredData.map(r => r[xColumn])
    yColumns.forEach((col, i) => {
      traces.push(
        buildSingleTrace({
          name: col,
          x: xVals,
          y: filteredData.map(r => r[col]),
          traceIndex: i,
          totalTraces: yColumns.length,
          style,
        })
      )
    })
  }

  const shapes = referenceLines ? referenceLines.map(buildReferenceShape) : []
  const layoutAnnotations: any[] = [
    ...(annotations ?? []),
    ...(referenceLines ?? []).filter(r => r.label).map(buildReferenceAnnotation),
  ]

  // Degenerate-axis guard: when all y values across all traces are identical,
  // Plotly's autorange produces a zero-height axis which resvg panics on (geom.rs:27).
  // Detect constant-value y data and force a non-degenerate explicit range.
  const allYNumeric = traces
    .flatMap((t: any) => (t.y as any[]) ?? [])
    .filter((v: any) => typeof v === 'number' && Number.isFinite(v))
  const yMin = allYNumeric.length > 0 ? Math.min(...allYNumeric) : 0
  const yMax = allYNumeric.length > 0 ? Math.max(...allYNumeric) : 0
  const yDegenerate = allYNumeric.length > 0 && yMin === yMax
  // Pad by 1 absolute unit (or 10% of the value) so the axis is always visible
  const yPad = Math.abs(yMin * 0.1) + 1
  let yAxisRange: [number, number] | undefined = yDegenerate
    ? [yMin - yPad, yMax + yPad]
    : undefined

  // Reference-line inclusion guard: if any y-axis reference line value lies outside
  // the data range (or degenerate-padded range), resvg panics when rasterizing the
  // out-of-bounds SVG path (same root cause as the degenerate-axis case above).
  // Expand yAxisRange to include all y-axis ref line values.
  if (referenceLines) {
    let lo = yAxisRange ? yAxisRange[0] : yMin
    let hi = yAxisRange ? yAxisRange[1] : yMax
    let expanded = false
    for (const rl of referenceLines) {
      if (rl.axis === 'y' && typeof rl.value === 'number' && Number.isFinite(rl.value)) {
        if (rl.value < lo || rl.value > hi) {
          lo = Math.min(lo, rl.value)
          hi = Math.max(hi, rl.value)
          expanded = true
        }
      }
    }
    if (expanded) {
      const pad = (hi - lo) * 0.08
      yAxisRange = [lo - pad, hi + pad]
    }
  }

  return {
    traces,
    layout: {
      title: title ? { text: title } : undefined,
      barmode,
      paper_bgcolor: style.backgroundColor,
      plot_bgcolor: style.backgroundColor,
      font: { family: style.fontFamily, color: style.textColor, size: style.axisTickFontSize },
      xaxis: {
        title: xAxisTitle ? { text: xAxisTitle, font: { size: style.axisTitleFontSize } } : undefined,
        showgrid: false,
        linecolor: style.textColor,
        ticks: 'outside',
      },
      yaxis: {
        title: yAxisTitle ? { text: yAxisTitle, font: { size: style.axisTitleFontSize } } : undefined,
        gridcolor: style.gridColor,
        linecolor: style.textColor,
        ticks: 'outside',
        zeroline: true,
        zerolinecolor: style.textColor,
        ...(yAxisRange ? { range: yAxisRange, autorange: false } : {}),
      },
      legend:
        traces.length > 1
          ? { font: { size: style.legendFontSize }, bgcolor: 'rgba(255,255,255,0)' }
          : undefined,
      margin: style.margin ?? { l: 60, r: 20, t: title ? 50 : 20, b: 50 },
      shapes,
      annotations: layoutAnnotations,
    },
    config: {
      displayModeBar: false,
      responsive: true,
    },
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSingleTrace(opts: {
  name: string
  x: any[]
  y: any[]
  traceIndex: number
  totalTraces: number
  style: ChartStyle
}) {
  const { name, x, y, traceIndex, totalTraces, style } = opts
  const isMulti = totalTraces > 1
  const trace: any = {
    type: 'bar',
    name,
    x,
    y,
    marker: {
      color: style.barColor,
      line: { color: style.textColor, width: 0.5 },
    },
  }
  if (style.isScientific && isMulti) {
    trace.marker.pattern = {
      shape: BAR_PATTERNS[traceIndex % BAR_PATTERNS.length],
      fgcolor: style.textColor,
      bgcolor: style.barColor,
      size: 8,
      solidity: 0.3,
    }
  }
  return trace
}

