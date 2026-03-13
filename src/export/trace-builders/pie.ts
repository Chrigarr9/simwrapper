import type { PlotlyFigure, ChartStyle } from '../types'

export interface PieInput {
  filteredData: any[]
  baselineData?: any[]
  column: string
  idColumn?: string
  title?: string
  colorBy?: string
  colorMap?: Map<string, string>
  showComparison?: boolean
  scientificPatterns?: string[]
}

/** Default Plotly pattern shapes for scientific pie slices */
const DEFAULT_PIE_PATTERNS = ['', '/', '\\', 'x', '+', '-', '|', '.']

/** Default dimmed opacity for baseline / unselected slices */
const DIMMED_OPACITY = 0.35

/**
 * Count occurrences of each category value in data rows.
 * Returns a Map sorted by key (numeric ascending, else locale alphabetical).
 */
function countCategories(data: any[], column: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of data) {
    const val = row[column]
    if (val !== null && val !== undefined) {
      const key = String(val)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  return sortedMap(counts)
}

/**
 * Sort a Map's entries: if all keys parse as finite numbers, sort numerically;
 * otherwise sort by locale string comparison.
 */
function sortedMap(map: Map<string, number>): Map<string, number> {
  const keys = Array.from(map.keys())
  const numericValues = keys.map(Number)
  const allNumeric = keys.length > 0 && numericValues.every(v => Number.isFinite(v))

  const sorted = allNumeric
    ? [...keys].sort((a, b) => Number(a) - Number(b))
    : [...keys].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const result = new Map<string, number>()
  for (const k of sorted) {
    result.set(k, map.get(k)!)
  }
  return result
}

/**
 * Append a hex alpha channel to a hex color string.
 * Handles both 7-char (#RRGGBB) and 4-char (#RGB) inputs.
 */
function withAlpha(hexColor: string, opacity: number): string {
  const base = hexColor.startsWith('#') ? hexColor.slice(0, 7) : hexColor
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0')
  return base + alpha
}

/**
 * Determine text positioning for each slice.
 *
 * Comparison mode: inside if >=20%, else hidden (rely on legend).
 * Normal mode: inside if >=10%, outside if >=3%, else hidden.
 */
function getTextPositions(
  values: number[],
  total: number,
  comparison: boolean
): string[] {
  return values.map(v => {
    const pct = (v / total) * 100
    if (comparison) {
      return pct >= 20 ? 'inside' : 'none'
    }
    if (pct >= 10) return 'inside'
    if (pct >= 3) return 'outside'
    return 'none'
  })
}

/**
 * Build text templates matching the positioning logic.
 */
function getTextTemplates(
  values: number[],
  total: number,
  comparison: boolean
): string[] {
  return values.map(v => {
    const pct = (v / total) * 100
    if (comparison) {
      return pct >= 20 ? '%{percent}' : ''
    }
    if (pct >= 10) return '%{label}<br>%{percent}'
    if (pct >= 3) return '%{label} %{percent}'
    return ''
  })
}

/**
 * Build a publication-ready Plotly pie (donut) figure.
 *
 * Pure function -- no Vue, DOM, or StyleManager dependencies.
 * All styling comes from the ChartStyle parameter; all data from PieInput.
 */
export function buildPieFigure(input: PieInput, style: ChartStyle): PlotlyFigure {
  const {
    filteredData,
    baselineData,
    column,
    title,
    colorMap,
    showComparison = false,
    scientificPatterns,
  } = input

  const patterns = scientificPatterns ?? DEFAULT_PIE_PATTERNS

  // --- Aggregate categories ---
  const filteredCounts = countCategories(filteredData, column)
  const labels = Array.from(filteredCounts.keys())
  const values = Array.from(filteredCounts.values())
  const total = values.reduce((s, v) => s + v, 0)

  // --- Resolve colors per category ---
  const resolveColor = (label: string, fallback: string): string => {
    if (colorMap && colorMap.has(label)) return colorMap.get(label)!
    return fallback
  }

  const sliceColors = labels.map(l => resolveColor(l, style.barColor))

  // --- Scientific pattern fills ---
  const buildPatternMarker = (
    categoryLabels: string[],
    baseColors: string[],
    allCategoryKeys: string[]
  ) => {
    if (!style.isScientific) return undefined
    return {
      shape: categoryLabels.map(l => {
        const idx = allCategoryKeys.indexOf(l)
        return patterns[(idx >= 0 ? idx : 0) % patterns.length]
      }),
      bgcolor: baseColors,
      fgcolor: categoryLabels.map(() => style.textColor),
      size: 10,
      solidity: 0.4,
    }
  }

  // All known category keys (from baseline if available for consistent indexing)
  const allCategoryKeys =
    showComparison && baselineData && baselineData.length > 0
      ? Array.from(countCategories(baselineData, column).keys())
      : labels

  // --- Text positioning ---
  const textPositions = getTextPositions(values, total, showComparison)
  const textTemplates = getTextTemplates(values, total, showComparison)

  // --- Build traces ---
  const traces: any[] = []

  const mainTrace: any = {
    labels,
    values,
    type: 'pie',
    name: showComparison ? 'Filtered (inner)' : undefined,
    showlegend: !showComparison,
    marker: {
      colors: sliceColors,
      pattern: buildPatternMarker(labels, sliceColors, allCategoryKeys),
      line: {
        color: style.gridColor,
        width: style.isScientific ? 2 : 1,
      },
    },
    textposition: textPositions,
    texttemplate: textTemplates,
    textfont: {
      color: style.isScientific ? '#000000' : style.textColor,
      size: 11,
      family: style.fontFamily,
    },
    outsidetextfont: { color: style.textColor, size: 10, family: style.fontFamily },
    insidetextorientation: 'horizontal',
    hovertemplate: '%{label}: %{value} (%{percent})<extra></extra>',
    hole: showComparison ? 0.4 : 0.3,
    domain: showComparison ? { x: [0.15, 0.85], y: [0.15, 0.85] } : undefined,
  }
  traces.push(mainTrace)

  // --- Baseline outer ring (comparison mode) ---
  if (showComparison && baselineData && baselineData.length > 0) {
    const baselineCounts = countCategories(baselineData, column)
    const baselineLabels = Array.from(baselineCounts.keys())
    const baselineValues = Array.from(baselineCounts.values())
    const baselineColors = baselineLabels.map(l =>
      withAlpha(resolveColor(l, style.barColor), DIMMED_OPACITY)
    )

    traces.push({
      labels: baselineLabels,
      values: baselineValues,
      type: 'pie',
      name: 'Baseline (outer)',
      marker: {
        colors: baselineColors,
        pattern: buildPatternMarker(baselineLabels, baselineColors, allCategoryKeys),
        line: {
          color: style.gridColor,
          width: style.isScientific ? 2 : 1,
        },
      },
      textinfo: 'none',
      hovertemplate: '<b>Baseline: %{label}</b><br>%{value} (%{percent})<extra></extra>',
      hole: 0.7,
      domain: { x: [0, 1], y: [0, 1] },
      showlegend: true,
    })
  }

  // --- Layout ---
  const margin = style.margin ?? { t: 10, b: 15, l: 15, r: 100 }

  const centerText = showComparison
    ? `<b>${filteredData.length}</b><br><span style="font-size:10px">of ${baselineData?.length ?? 0}</span>`
    : `<b>${total}</b>`

  const annotations: any[] = [
    {
      text: centerText,
      x: 0.5,
      y: 0.5,
      xref: 'paper',
      yref: 'paper',
      showarrow: false,
      font: { size: 16, color: style.textColor, family: style.fontFamily },
    },
  ]

  if (showComparison) {
    annotations.push({
      text: '<span style="font-size:9px"><b>Inner:</b> Filtered<br><b>Outer:</b> Baseline</span>',
      x: 1.02,
      y: 0.05,
      xref: 'paper',
      yref: 'paper',
      xanchor: 'left',
      showarrow: false,
      font: { size: 9, color: style.textColor, family: style.fontFamily },
    })
  }

  const layout: any = {
    font: { family: style.fontFamily, color: style.textColor },
    title: title ? { text: title, font: { color: style.textColor, family: style.fontFamily } } : { text: '' },
    margin,
    autosize: true,
    paper_bgcolor: style.backgroundColor,
    plot_bgcolor: style.backgroundColor,
    uniformtext: { minsize: 9, mode: 'hide' },
    showlegend: true,
    legend: {
      title: {
        text: column,
        font: { color: style.textColor, size: style.legendTitleFontSize, family: style.fontFamily },
      },
      font: { color: style.textColor, size: style.legendFontSize, family: style.fontFamily },
      bgcolor: 'transparent',
      orientation: 'v',
      x: 1.02,
      xanchor: 'left',
      y: 0.5,
      yanchor: 'middle',
    },
    annotations,
  }

  return {
    traces,
    layout,
    config: { displayModeBar: false, responsive: true },
  }
}
