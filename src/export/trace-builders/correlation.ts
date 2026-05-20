/**
 * Correlation matrix trace builder for the export system.
 *
 * Pure function: computes Pearson correlation coefficients from raw data
 * and produces a Plotly heatmap figure with annotations.
 *
 * Mirrors the rendering logic of CorrelationMatrixCard.vue but without
 * any Vue/DOM dependencies.
 */

import type { PlotlyFigure, ChartStyle } from '../types'

// ---------------------------------------------------------------------------
// Public input interface
// ---------------------------------------------------------------------------

export interface CorrelationInput {
  filteredData: any[]
  attributes?: string[]
  leftAttributes?: string[]
  bottomAttributes?: string[]
  matrixPart?: 'full' | 'lower'
  showValues?: 'always' | 'never' | 'auto'
  pValueThreshold?: number
  title?: string
}

// ---------------------------------------------------------------------------
// Internal statistics helpers (self-contained, no external deps)
// ---------------------------------------------------------------------------

/** Pearson correlation between two numeric arrays (pairwise-complete). */
function pearsonCorrelation(xRaw: any[], yRaw: any[]): { r: number; n: number } {
  // Build pairwise-complete numeric pairs
  const xs: number[] = []
  const ys: number[] = []
  const len = Math.min(xRaw.length, yRaw.length)

  for (let i = 0; i < len; i++) {
    const xv = toNumber(xRaw[i])
    const yv = toNumber(yRaw[i])
    if (Number.isFinite(xv) && Number.isFinite(yv)) {
      xs.push(xv)
      ys.push(yv)
    }
  }

  const n = xs.length
  if (n < 3) return { r: NaN, n }

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
    sumXY += xs[i] * ys[i]
    sumX2 += xs[i] * xs[i]
    sumY2 += ys[i] * ys[i]
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (denom === 0) return { r: NaN, n }

  const r = (n * sumXY - sumX * sumY) / denom
  return { r, n }
}

/** Coerce a value to a finite number, returning NaN on failure. */
function toNumber(v: any): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() !== '') return Number(v)
  return NaN
}

// ---------------------------------------------------------------------------
// Label formatting (minimal, no external deps)
// ---------------------------------------------------------------------------

const ABBREVIATIONS = new Set([
  'id', 'od', 'pt', 'drt', 'km', 'vkt', 'pkm', 'pmt', 'vmt', 'num', 'cnt',
])

/** Convert snake_case / camelCase column name to Title Case. */
function formatLabel(str: string): string {
  if (!str) return ''
  const parts = str
    .split('_')
    .flatMap(p => p.split(/(?=[A-Z])/))
    .filter(w => w.trim())
  return parts
    .map(w => {
      const lower = w.toLowerCase()
      if (ABBREVIATIONS.has(lower)) return lower.toUpperCase()
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

// ---------------------------------------------------------------------------
// Correlation grid computation
// ---------------------------------------------------------------------------

interface CorrelationGrid {
  matrix: number[][]
  rowLabels: string[]
  colLabels: string[]
}

function computeCorrelationGrid(
  data: any[],
  rowAttrs: string[],
  colAttrs: string[],
): CorrelationGrid {
  const rowCount = rowAttrs.length
  const colCount = colAttrs.length
  const matrix: number[][] = []

  for (let i = 0; i < rowCount; i++) {
    matrix[i] = []
    for (let j = 0; j < colCount; j++) {
      if (rowAttrs[i] === colAttrs[j]) {
        matrix[i][j] = 1
      } else {
        const xValues = data.map(row => row[rowAttrs[i]])
        const yValues = data.map(row => row[colAttrs[j]])
        const { r } = pearsonCorrelation(xValues, yValues)
        matrix[i][j] = Number.isFinite(r) ? r : NaN
      }
    }
  }

  return {
    matrix,
    rowLabels: rowAttrs.map(formatLabel),
    colLabels: colAttrs.map(formatLabel),
  }
}

// ---------------------------------------------------------------------------
// Lower-triangle masking
// ---------------------------------------------------------------------------

function applyLowerMask(matrix: number[][]): number[][] {
  return matrix.map((row, i) =>
    row.map((val, j) => (i >= j ? val : NaN))
  )
}

// ---------------------------------------------------------------------------
// Annotation helpers
// ---------------------------------------------------------------------------

function shouldShowValues(
  mode: 'always' | 'never' | 'auto',
  rowCount: number,
  colCount: number,
): boolean {
  if (mode === 'always') return true
  if (mode === 'never') return false
  // auto: hide when matrix is too large to read
  return Math.max(rowCount, colCount) <= 20
}

/** Compact format: .45 instead of 0.45, -.45 instead of -0.45 */
function formatCorrelation(r: number, compact: boolean): string {
  if (!Number.isFinite(r)) return ''
  if (Math.abs(r) === 1) return r === 1 ? '1' : '-1'
  const formatted = r.toFixed(2)
  if (compact) return formatted.replace(/^(-?)0\./, '$1.')
  return formatted
}

interface Annotation {
  x: string
  y: string
  text: string
  showarrow: boolean
  font: { color: string; size: number; family: string }
}

function buildAnnotations(
  matrix: number[][],
  displayMatrix: number[][],
  rowLabels: string[],
  colLabels: string[],
  fontFamily: string,
): Annotation[] {
  const rowCount = matrix.length
  const colCount = rowCount > 0 ? matrix[0].length : 0
  const compact = Math.max(rowCount, colCount) > 6
  const annotations: Annotation[] = []

  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < colCount; j++) {
      // Skip masked (NaN in display) cells
      if (!Number.isFinite(displayMatrix[i][j])) continue

      const r = matrix[i][j]
      if (!Number.isFinite(r)) continue

      const text = formatCorrelation(r, compact)
      if (!text) continue

      // White text on dark cells (|r| > 0.5), black on light cells
      const fontColor = Math.abs(r) > 0.5 ? '#ffffff' : '#000000'

      annotations.push({
        x: colLabels[j],
        y: rowLabels[i],
        text,
        showarrow: false,
        font: { color: fontColor, size: 10, family: fontFamily },
      })
    }
  }

  return annotations
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildCorrelationFigure(
  input: CorrelationInput,
  style: ChartStyle,
): PlotlyFigure {
  // Resolve attribute lists (leftAttributes/bottomAttributes take precedence over attributes)
  const leftAttrs =
    input.leftAttributes && input.leftAttributes.length > 0
      ? input.leftAttributes
      : input.attributes ?? []
  const bottomAttrs =
    input.bottomAttributes && input.bottomAttributes.length > 0
      ? input.bottomAttributes
      : input.attributes ?? []

  // Guard: nothing to compute
  if (leftAttrs.length === 0 || bottomAttrs.length === 0 || !input.filteredData?.length) {
    return emptyFigure(style)
  }

  // Compute correlation grid
  const grid = computeCorrelationGrid(input.filteredData, leftAttrs, bottomAttrs)

  // Apply lower-triangle mask if requested
  const isLower = input.matrixPart === 'lower'
  const displayMatrix = isLower ? applyLowerMask(grid.matrix) : grid.matrix

  // Determine value display mode
  const showMode = input.showValues ?? 'auto'
  const showVals = shouldShowValues(showMode, leftAttrs.length, bottomAttrs.length)

  // Annotations
  const annotations = showVals
    ? buildAnnotations(grid.matrix, displayMatrix, grid.rowLabels, grid.colLabels, style.fontFamily)
    : []

  // Dynamic margin based on longest label
  const allLabels = [...grid.rowLabels, ...grid.colLabels]
  const maxLen = allLabels.length > 0 ? Math.max(...allLabels.map(l => l.length)) : 0
  const marginScale = style.marginScale ?? 1.0
  const dynamicMargin = Math.round(Math.min(150, 80 + Math.max(0, maxLen - 10) * 5) * marginScale)

  // Build trace
  const trace = {
    z: displayMatrix,
    x: grid.colLabels,
    y: grid.rowLabels,
    type: 'heatmap' as const,
    colorscale: [
      [0, '#3b4cc0'],
      [0.5, '#f7f7f7'],
      [1, '#b40426'],
    ],
    zmid: 0,
    zmin: -1,
    zmax: 1,
    showscale: true,
    colorbar: {
      title: { text: 'r', font: { color: style.textColor, family: style.fontFamily } },
      tickfont: { color: style.textColor, family: style.fontFamily },
    },
  }

  // Build layout
  const layout: Record<string, any> = {
    font: {
      family: style.fontFamily,
      color: style.textColor,
    },
    xaxis: {
      tickfont: { color: style.textColor, size: style.axisTickFontSize, family: style.fontFamily },
      tickangle: -45,
      side: 'bottom',
      automargin: true,
    },
    yaxis: {
      tickfont: { color: style.textColor, size: style.axisTickFontSize, family: style.fontFamily },
      autorange: 'reversed',
      automargin: true,
    },
    margin: { l: dynamicMargin, r: Math.round(60 * marginScale), t: Math.round(20 * marginScale), b: dynamicMargin },
    paper_bgcolor: style.backgroundColor,
    plot_bgcolor: style.backgroundColor,
    annotations,
  }

  if (input.title) {
    layout.title = {
      text: input.title,
      font: { size: style.axisTitleFontSize, color: style.textColor, family: style.fontFamily },
    }
  }

  return {
    traces: [trace as any],
    layout,
    config: { displayModeBar: false },
  }
}

// ---------------------------------------------------------------------------
// Empty / error figure
// ---------------------------------------------------------------------------

function emptyFigure(style: ChartStyle): PlotlyFigure {
  return {
    traces: [],
    layout: {
      paper_bgcolor: style.backgroundColor,
      plot_bgcolor: style.backgroundColor,
      annotations: [
        {
          text: 'No data available',
          showarrow: false,
          font: { color: style.textColor, size: 14, family: style.fontFamily },
          xref: 'paper',
          yref: 'paper',
          x: 0.5,
          y: 0.5,
        } as any,
      ],
    },
    config: { displayModeBar: false },
  }
}
