import type { ReferenceLine, ChartStyle } from '../types'

/**
 * Convert a ReferenceLine to a Plotly layout.shapes entry.
 *
 * Y-axis lines span the full plot width (xref='paper', x0=0, x1=1).
 * X-axis lines span the full plot height (yref='paper', y0=0, y1=1).
 */
export function buildReferenceShape(r: ReferenceLine): any {
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

/**
 * Convert a ReferenceLine with a label to a Plotly layout.annotations entry.
 * Caller is responsible for filtering out ReferenceLines without a label.
 * Optional style param drives label font; falls back to size 12 if absent.
 */
export function buildReferenceAnnotation(r: ReferenceLine, style?: ChartStyle): any {
  const font = {
    color: r.color ?? '#666',
    // Fall back to axisTickFontSize so ref-line labels scale with the canvas
    // (legacy fallback was a hardcoded 12px which got lost on paper exports).
    size: style?.annotationFontSize ?? style?.axisTickFontSize ?? 12,
    family: style?.fontFamily,
  }
  if (r.axis === 'y') {
    return {
      x: 0.98,
      xref: 'paper',
      y: r.value,
      yref: 'y',
      text: r.label,
      showarrow: false,
      xanchor: 'right',
      yanchor: 'bottom',
      bgcolor: 'rgba(255,255,255,0.85)',
      font,
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
    xanchor: 'left',
    bgcolor: 'rgba(255,255,255,0.85)',
    font,
  }
}
