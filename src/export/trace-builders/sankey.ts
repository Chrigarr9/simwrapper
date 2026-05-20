import type { SankeyInput, ChartStyle, PlotlyFigure } from '../types'

/**
 * Build a Plotly figure for a Sankey diagram.
 *
 * Pure function: no Vue reactivity, no DOM access, no StyleManager.
 * All visual parameters come from the `style` argument.
 *
 * Source rows are aggregated by (source, target) — duplicate pairs are summed.
 * Nodes are deduplicated in first-seen order. Rows with null/undefined value
 * are skipped silently (they neither contribute to a link nor create a node).
 */
export function buildSankeyFigure(input: SankeyInput, style: ChartStyle): PlotlyFigure {
  const { title, sourceColumn, targetColumn, valueColumn, nodeColorMap, filteredData } = input

  // 1. Aggregate by (source, target) — skip nulls, non-finite values, and self-loops
  const linkMap = new Map<string, { s: any; t: any; v: number }>()
  for (const row of filteredData) {
    const s = row[sourceColumn]
    const t = row[targetColumn]
    const v = row[valueColumn]
    // Number.isFinite (post-coerce) excludes null/undefined, NaN, Infinity, and "" (Number("")===0 with isFinite=true is the one gotcha; explicit empty-string check below)
    if (s == null || t == null || v == null || v === '' || !Number.isFinite(Number(v))) continue
    // Plotly sankey does not support self-loops; skip them silently
    if (String(s) === String(t)) continue
    const key = `${s}\x00${t}`  // null-byte delimiter prevents collisions
    const existing = linkMap.get(key)
    if (existing) {
      existing.v += Number(v)
    } else {
      linkMap.set(key, { s, t, v: Number(v) })
    }
  }

  // 2. Deduplicate nodes (first-seen order across both source and target columns)
  const nodeIndex = new Map<string, number>()
  const nodeLabels: string[] = []
  const addNode = (label: string): number => {
    if (!nodeIndex.has(label)) {
      nodeIndex.set(label, nodeLabels.length)
      nodeLabels.push(label)
    }
    return nodeIndex.get(label)!
  }

  const sources: number[] = []
  const targets: number[] = []
  const values: number[] = []
  for (const { s, t, v } of linkMap.values()) {
    sources.push(addNode(String(s)))
    targets.push(addNode(String(t)))
    values.push(v)
  }

  const nodeColors = nodeColorMap
    ? nodeLabels.map(l => nodeColorMap[l] ?? style.barColor)
    : nodeLabels.map(() => style.barColor)

  const titleFontSize = style.titleFontSize ?? style.axisTitleFontSize + 4

  return {
    traces: [{
      type: 'sankey',
      arrangement: 'snap',
      node: {
        label: nodeLabels,
        color: nodeColors,
        // Tuned for paper-column 1200×800 PNG: thicker bars + larger pad reduce
        // visual emptiness when one node dominates volume.
        pad: 25,
        thickness: 24,
        line: { color: style.textColor, width: 0.5 },
        // Node label font matches axis-tick scale so labels read at the same
        // visual weight as other charts in the figure series.
        font: { color: style.textColor, size: style.axisTitleFontSize, family: style.fontFamily },
      },
      link: {
        source: sources,
        target: targets,
        value: values,
        // Slightly darker + more opaque than the previous rgba(150,150,150,0.4):
        // pure pale gray ribbons disappeared against white background.
        color: 'rgba(120,120,120,0.45)',
      },
    }],
    layout: {
      title: title
        ? {
            text: title,
            font: { color: style.textColor, size: titleFontSize, family: style.fontFamily },
            x: 0.5,
            xanchor: 'center',
            y: 0.96,
            yanchor: 'top',
          }
        : undefined,
      paper_bgcolor: style.backgroundColor,
      plot_bgcolor: style.backgroundColor,
      font: { family: style.fontFamily, color: style.textColor, size: style.axisTickFontSize },
      margin: style.margin ?? (() => {
        const ms = (n: number) => Math.round(n * (style.marginScale ?? 1.0))
        return { l: ms(35), r: ms(35), t: title ? ms(70) : ms(25), b: ms(25) }
      })(),
    },
    config: {
      displayModeBar: false,
      responsive: true,
    },
  }
}
