import type { BarInput, ChartStyle, PlotlyFigure } from '../types'

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
      },
      legend:
        traces.length > 1
          ? { font: { size: style.legendFontSize }, bgcolor: 'rgba(255,255,255,0)' }
          : undefined,
      margin: { l: 60, r: 20, t: title ? 50 : 20, b: 50 },
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

function buildReferenceShape(r: {
  axis: 'x' | 'y'
  value: number
  color?: string
  dash?: string
}) {
  if (r.axis === 'y') {
    return {
      type: 'line',
      xref: 'paper',
      yref: 'y',
      x0: 0,
      x1: 1,
      y0: r.value,
      y1: r.value,
      line: { color: r.color ?? '#666', dash: r.dash ?? 'dash', width: 1.5 },
    }
  }
  return {
    type: 'line',
    xref: 'x',
    yref: 'paper',
    x0: r.value,
    x1: r.value,
    y0: 0,
    y1: 1,
    line: { color: r.color ?? '#666', dash: r.dash ?? 'dash', width: 1.5 },
  }
}

function buildReferenceAnnotation(r: {
  axis: 'x' | 'y'
  value: number
  label?: string
  color?: string
}) {
  if (r.axis === 'y') {
    return {
      x: 0.98,
      xref: 'paper',
      y: r.value,
      yref: 'y',
      text: r.label,
      showarrow: false,
      xanchor: 'right',
      bgcolor: 'rgba(255,255,255,0.8)',
      font: { color: r.color ?? '#666', size: 10 },
    }
  }
  return {
    x: r.value,
    xref: 'x',
    y: 0.98,
    yref: 'paper',
    text: r.label,
    showarrow: false,
    yanchor: 'top',
    bgcolor: 'rgba(255,255,255,0.8)',
    font: { color: r.color ?? '#666', size: 10 },
  }
}
