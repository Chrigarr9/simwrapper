import type { ReferenceLine } from '../types'

/**
 * Convert a ReferenceLine to a Plotly layout.shapes entry.
 *
 * Y-axis lines span the full plot width (xref='paper', x0=0, x1=1).
 * X-axis lines span the full plot height (yref='paper', y0=0, y1=1).
 *
 * Returns a plain object rather than `Partial<Shape>` to avoid the
 * unresolvable type friction between Plotly's bundled types and a
 * structurally-equivalent literal.
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
 */
export function buildReferenceAnnotation(r: ReferenceLine): any {
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
