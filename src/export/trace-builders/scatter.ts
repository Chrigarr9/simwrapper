/**
 * Pure-function scatter trace builder for the export pipeline.
 *
 * Mirrors the trace-building logic of ScatterCard.vue but has NO Vue, DOM,
 * or StyleManager dependencies. All style decisions come from the ChartStyle
 * parameter and the ScatterInput configuration.
 */

import type { PlotlyFigure, ChartStyle, ReferenceLine } from '../types'
import { buildReferenceShape, buildReferenceAnnotation } from './_layout-helpers'

// ── Input interface ──────────────────────────────────────────────────────────

export interface ScatterInput {
  filteredData: any[]
  baselineData?: any[]
  xColumn: string
  yColumn: string
  yColumnRight?: string
  xAxisTitle?: string
  yAxisTitle?: string
  yAxisRightTitle?: string
  idColumn?: string
  colorColumn?: string
  colorDecimals?: number
  colorBy?: string
  colorByType?: 'categorical' | 'numeric'
  colorMap?: Map<string, string>
  sizeColumn?: string
  markerSize?: number
  connectLines?: boolean
  showComparison?: boolean
  title?: string
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  xAutoTrim?: number
  yAutoTrim?: number
  scientificSymbols?: string[]
  scientificLinePatterns?: string[]
  annotations?: any[]  // Plotly annotation objects, passthrough to layout.annotations
  referenceLines?: ReferenceLine[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MARKER_SIZE = 8
const DEFAULT_SCIENTIFIC_SYMBOLS = [
  'circle', 'square', 'diamond', 'cross', 'x',
  'triangle-up', 'triangle-down', 'star', 'hexagon', 'pentagon',
]
const DEFAULT_SCIENTIFIC_LINE_PATTERNS = [
  'solid', 'dash', 'dot', 'dashdot', 'longdash', 'longdashdot',
]

// Basic categorical palette (Tableau 10-ish) used when no colorMap is provided
const DEFAULT_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function isFiniteNumeric(value: any): boolean {
  const n = Number(value)
  return Number.isFinite(n)
}

/** Sort parallel arrays by one of them (the key array) ascending. */
function sortByX(arrays: Record<string, any[]>, xKey = 'x'): void {
  const indices = arrays[xKey].map((_: any, i: number) => i)
  indices.sort((a: number, b: number) => arrays[xKey][a] - arrays[xKey][b])
  for (const key of Object.keys(arrays)) {
    arrays[key] = indices.map((i: number) => arrays[key][i])
  }
}

/** Sort legend categories: numerically if all values parse as numbers, else locale. */
function sortLegendCategories(values: string[]): string[] {
  const sorted = [...values]
  const nums = sorted.map(Number)
  if (sorted.length > 0 && nums.every(Number.isFinite)) {
    sorted.sort((a, b) => Number(a) - Number(b))
  } else {
    sorted.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }
  return sorted
}

/** Assign colors to categories using provided colorMap or default palette. */
function buildColorMap(categories: string[], colorMap?: Map<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  categories.forEach((cat, i) => {
    result[cat] = colorMap?.get(cat) ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
  })
  return result
}

/** Compute percentile (0-1) from a sorted array using linear interpolation. */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = p * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const frac = idx - lo
  return sorted[lo] * (1 - frac) + sorted[hi] * frac
}

/**
 * Compute axis range from data, explicit bounds, and/or percentile auto-trim.
 * Returns [lower, upper] with padding, or undefined if no constraints given.
 */
function computeAxisRange(
  values: number[],
  opts: { min?: number; max?: number; autoTrim?: number; padding?: number },
): [number, number] | undefined {
  const { min, max, autoTrim, padding = 0.02 } = opts

  const hasMin = min !== undefined
  const hasMax = max !== undefined
  const hasAutoTrim = autoTrim !== undefined && autoTrim > 0 && autoTrim <= 100

  if (!hasMin && !hasMax && !hasAutoTrim) return undefined

  const clean = values.filter(v => Number.isFinite(v))
  if (clean.length === 0) return undefined

  let autoLower: number | undefined
  let autoUpper: number | undefined
  if (hasAutoTrim) {
    const sorted = [...clean].sort((a, b) => a - b)
    const tail = (100 - autoTrim!) / 200
    autoLower = quantile(sorted, tail)
    autoUpper = quantile(sorted, 1 - tail)
  }

  let lower: number
  if (hasMin) lower = min!
  else if (autoLower !== undefined) lower = autoLower
  else lower = Math.min(...clean)

  let upper: number
  if (hasMax) upper = max!
  else if (autoUpper !== undefined) upper = autoUpper
  else upper = Math.max(...clean)

  const range = upper - lower
  const pad = range * padding
  return [lower - pad, upper + pad]
}

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildScatterFigure(input: ScatterInput, style: ChartStyle): PlotlyFigure {
  const {
    filteredData,
    baselineData,
    xColumn,
    yColumn,
    yColumnRight,
    xAxisTitle,
    yAxisTitle,
    yAxisRightTitle,
    colorColumn,
    colorDecimals,
    colorBy,
    colorByType,
    colorMap,
    sizeColumn,
    markerSize: markerSizeRaw,
    connectLines = false,
    showComparison = false,
    title,
    xMin, xMax, yMin, yMax,
    xAutoTrim, yAutoTrim,
    scientificSymbols = DEFAULT_SCIENTIFIC_SYMBOLS,
    scientificLinePatterns = DEFAULT_SCIENTIFIC_LINE_PATTERNS,
  } = input

  const isScientific = style.isScientific
  const markerSize = (markerSizeRaw ?? DEFAULT_MARKER_SIZE) * style.markerSizeMultiplier
  const fontFamily = style.fontFamily
  const textColor = style.textColor
  const gridColor = style.gridColor
  const bgColor = style.backgroundColor
  const defaultColor = style.barColor

  const traceMode = connectLines ? ('lines+markers' as const) : ('markers' as const)

  // ── Extract numeric XY data from filteredData ─────────────────────────

  const xVals: number[] = []
  const yVals: number[] = []

  for (const row of filteredData) {
    const xv = row[xColumn]
    const yv = row[yColumn]
    if (isFiniteNumeric(xv) && isFiniteNumeric(yv)) {
      xVals.push(Number(xv))
      yVals.push(Number(yv))
    }
  }

  // If no valid data, return empty figure
  if (xVals.length === 0) {
    return { traces: [], layout: {}, config: { displayModeBar: false } }
  }

  // ── Determine trace path ──────────────────────────────────────────────

  // Gather unique categories from colorColumn
  const fmtCat = (v: any): string =>
    colorDecimals !== undefined && typeof v === 'number' ? v.toFixed(colorDecimals) : String(v)

  const categorySet = new Set<string>()
  if (colorColumn) {
    for (const row of filteredData) {
      const v = row[colorColumn]
      if (v !== undefined && v !== null) categorySet.add(fmtCat(v))
    }
  }
  const categories = sortLegendCategories(Array.from(categorySet))
  const hasCategories = colorColumn !== undefined && colorColumn !== '' && categories.length > 0

  const colorByActive = !!colorBy && colorBy !== ''
  const effectiveColorByType = colorByType ?? 'categorical'

  // When colorColumn + connectLines are both set, colorColumn always drives grouping
  const forceColorColumnGrouping = hasCategories && connectLines

  const traces: any[] = []

  // ── 1. Baseline trace (comparison mode) ───────────────────────────────

  if (showComparison && baselineData && baselineData.length > 0) {
    const bx: number[] = []
    const by: number[] = []
    for (const row of baselineData) {
      const xv = row[xColumn]
      const yv = row[yColumn]
      if (isFiniteNumeric(xv) && isFiniteNumeric(yv)) {
        bx.push(Number(xv))
        by.push(Number(yv))
      }
    }
    if (bx.length > 0) {
      traces.push({
        x: bx,
        y: by,
        mode: 'markers' as const,
        type: 'scatter' as const,
        name: 'Baseline (All Data)',
        hoverinfo: 'none' as const,
        marker: {
          color: 'rgba(156,163,175,0.35)',
          size: markerSize * 0.8,
          symbol: isScientific ? 'circle-open' : undefined,
          line: {
            color: 'rgba(156,163,175,0.5)',
            width: isScientific ? 1 : 0.5,
          },
        },
        showlegend: true,
      })
    }
  }

  // ── 2. Categorical colorBy ────────────────────────────────────────────

  if (!forceColorColumnGrouping && colorByActive && effectiveColorByType === 'categorical') {
    const colorByCategories = sortLegendCategories(
      Array.from(new Set(
        filteredData.map(r => r[colorBy!]).filter(v => v !== null && v !== undefined).map(String)
      ))
    )
    const colors = buildColorMap(colorByCategories, colorMap)

    colorByCategories.forEach((cat, catIndex) => {
      const cx: number[] = []
      const cy: number[] = []
      const cSizes: number[] = []
      for (const row of filteredData) {
        if (String(row[colorBy!]) !== cat) continue
        const xv = row[xColumn]
        const yv = row[yColumn]
        if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
        cx.push(Number(xv))
        cy.push(Number(yv))
        if (sizeColumn && row[sizeColumn] !== undefined) {
          cSizes.push(Math.max(5, Math.min(25, Number(row[sizeColumn]))))
        } else {
          cSizes.push(markerSize)
        }
      }
      if (cx.length === 0) return

      const traceArrays: Record<string, any[]> = { x: cx, y: cy, sizes: cSizes }
      if (connectLines) sortByX(traceArrays)

      const catColor = colors[cat] ?? defaultColor
      const markerSymbol = isScientific
        ? scientificSymbols[catIndex % scientificSymbols.length]
        : 'circle'
      const lineDash = isScientific
        ? scientificLinePatterns[catIndex % scientificLinePatterns.length]
        : undefined

      traces.push({
        x: traceArrays.x,
        y: traceArrays.y,
        mode: traceMode,
        type: 'scatter' as const,
        name: cat,
        hoverinfo: 'text' as const,
        ...(connectLines ? {
          line: {
            width: style.lineWidth,
            dash: lineDash,
            color: catColor,
          },
        } : {}),
        marker: {
          color: catColor,
          size: traceArrays.sizes,
          symbol: markerSymbol,
          line: { color: textColor, width: 0.5 },
          opacity: 0.85,
        },
        legendgroup: cat,
      })
    })

  // ── 3. Numeric colorBy ──────────────────────────────────────────────

  } else if (!forceColorColumnGrouping && colorByActive && effectiveColorByType === 'numeric') {
    const colorValues: number[] = []
    const px: number[] = []
    const py: number[] = []
    const pSizes: number[] = []

    for (const row of filteredData) {
      const xv = row[xColumn]
      const yv = row[yColumn]
      if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
      px.push(Number(xv))
      py.push(Number(yv))
      colorValues.push(row[colorBy!] ?? null)
      if (sizeColumn && row[sizeColumn] !== undefined) {
        pSizes.push(Math.max(5, Math.min(25, Number(row[sizeColumn]))))
      } else {
        pSizes.push(markerSize)
      }
    }

    const colorbarTitle = title ?? colorBy!
    traces.push({
      x: px,
      y: py,
      mode: traceMode,
      type: 'scatter' as const,
      name: colorbarTitle,
      showlegend: false,
      hoverinfo: 'text' as const,
      ...(connectLines ? { line: { width: style.lineWidth, color: 'rgba(100,100,100,0.3)' } } : {}),
      marker: {
        color: colorValues,
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
          title: {
            text: colorbarTitle,
            font: { color: textColor, size: style.axisTitleFontSize, family: fontFamily },
            side: 'right',
          },
          tickfont: { color: textColor, size: style.axisTickFontSize, family: fontFamily },
        },
        size: pSizes,
        symbol: 'circle',
        line: { color: textColor, width: 0.5 },
        opacity: 0.85,
      },
    })

  // ── 4. colorColumn grouping (one trace per category) ──────────────

  } else if (hasCategories) {
    const colors = buildColorMap(categories, colorMap)

    categories.forEach((cat, catIndex) => {
      const cx: number[] = []
      const cy: number[] = []
      const cSizes: number[] = []

      for (const row of filteredData) {
        if (fmtCat(row[colorColumn!]) !== cat) continue
        const xv = row[xColumn]
        const yv = row[yColumn]
        if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
        cx.push(Number(xv))
        cy.push(Number(yv))
        if (sizeColumn && row[sizeColumn] !== undefined) {
          cSizes.push(Math.max(5, Math.min(25, Number(row[sizeColumn]))))
        } else {
          cSizes.push(markerSize)
        }
      }
      if (cx.length === 0) return

      const traceArrays: Record<string, any[]> = { x: cx, y: cy, sizes: cSizes }
      if (connectLines) sortByX(traceArrays)

      const catColor = colors[cat] ?? defaultColor
      const markerSymbol = isScientific
        ? scientificSymbols[catIndex % scientificSymbols.length]
        : 'circle'
      const lineDash = isScientific
        ? scientificLinePatterns[catIndex % scientificLinePatterns.length]
        : undefined

      traces.push({
        x: traceArrays.x,
        y: traceArrays.y,
        mode: traceMode,
        type: 'scatter' as const,
        name: cat,
        hoverinfo: 'text' as const,
        ...(connectLines ? {
          line: {
            width: style.lineWidth,
            dash: lineDash,
            color: catColor,
          },
        } : {}),
        marker: {
          color: catColor,
          size: traceArrays.sizes,
          symbol: markerSymbol,
          line: { color: textColor, width: 0.5 },
          opacity: 0.85,
        },
        legendgroup: cat,
      })
    })

  // ── 5. Single trace (no grouping) ─────────────────────────────────

  } else {
    const px: number[] = []
    const py: number[] = []
    const pSizes: number[] = []

    for (const row of filteredData) {
      const xv = row[xColumn]
      const yv = row[yColumn]
      if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
      px.push(Number(xv))
      py.push(Number(yv))
      if (sizeColumn && row[sizeColumn] !== undefined) {
        pSizes.push(Math.max(5, Math.min(25, Number(row[sizeColumn]))))
      } else {
        pSizes.push(markerSize)
      }
    }

    const traceArrays: Record<string, any[]> = { x: px, y: py, sizes: pSizes }
    if (connectLines) sortByX(traceArrays)

    traces.push({
      x: traceArrays.x,
      y: traceArrays.y,
      mode: traceMode,
      type: 'scatter' as const,
      hoverinfo: 'text' as const,
      ...(connectLines ? { line: { width: style.lineWidth, color: defaultColor } } : {}),
      marker: {
        color: defaultColor,
        size: traceArrays.sizes,
        symbol: 'circle',
        line: { color: textColor, width: 0.5 },
        opacity: 0.85,
      },
    })
  }

  // ── Secondary Y-axis traces ───────────────────────────────────────────

  const hasSecondaryY = !!yColumnRight && yColumnRight !== ''
  if (hasSecondaryY) {
    const secondaryCategories = hasCategories ? categories : ['_all']
    const secondaryCategoryColors = hasCategories
      ? buildColorMap(categories, colorMap)
      : { _all: defaultColor }

    secondaryCategories.forEach((cat, catIndex) => {
      const sx: number[] = []
      const sy: number[] = []
      const sSizes: number[] = []

      for (const row of filteredData) {
        if (hasCategories && String(row[colorColumn!]) !== cat) continue
        const xv = row[xColumn]
        const yv = row[yColumnRight!]
        if (!isFiniteNumeric(xv) || !isFiniteNumeric(yv)) continue
        sx.push(Number(xv))
        sy.push(Number(yv))
        if (sizeColumn && row[sizeColumn] !== undefined) {
          sSizes.push(Math.max(5, Math.min(25, Number(row[sizeColumn]))))
        } else {
          sSizes.push(markerSize)
        }
      }
      if (sx.length === 0) return

      const traceArrays: Record<string, any[]> = { x: sx, y: sy, sizes: sSizes }
      if (connectLines) sortByX(traceArrays)

      const catColor = secondaryCategoryColors[cat] ?? defaultColor
      const primarySymbol = isScientific
        ? scientificSymbols[catIndex % scientificSymbols.length]
        : undefined
      const defaultSecSymbol = primarySymbol
        ? `${primarySymbol}-open`
        : (isScientific ? 'circle-open' : 'diamond-open')

      // Secondary axis uses dashed lines by default
      const lineDash = isScientific
        ? scientificLinePatterns[catIndex % scientificLinePatterns.length]
        : 'dash'

      const legendName = hasCategories ? `${cat} (right)` : yColumnRight!

      traces.push({
        x: traceArrays.x,
        y: traceArrays.y,
        yaxis: 'y2',
        mode: traceMode,
        type: 'scatter' as const,
        name: legendName,
        hoverinfo: 'text' as const,
        ...(connectLines ? {
          line: {
            width: style.lineWidth,
            dash: lineDash,
            color: catColor,
          },
        } : {}),
        marker: {
          color: catColor,
          size: traceArrays.sizes,
          symbol: defaultSecSymbol,
          line: { color: textColor, width: 0.5 },
          opacity: 0.85,
        },
        legendgroup: hasCategories ? `${cat}_right` : '_right',
      })
    })
  }

  // ── Axis ranges ───────────────────────────────────────────────────────

  // Prefer baseline data for range (stable when filtering)
  const bx: number[] = []
  const by: number[] = []
  if (showComparison && baselineData && baselineData.length > 0) {
    for (const row of baselineData) {
      const xv = row[xColumn]
      const yv = row[yColumn]
      if (isFiniteNumeric(xv)) bx.push(Number(xv))
      if (isFiniteNumeric(yv)) by.push(Number(yv))
    }
  }
  const xDataForRange = bx.length > 0 ? bx : xVals
  const yDataForRange = by.length > 0 ? by : yVals

  const xMinData = Math.min(...xDataForRange)
  const xMaxData = Math.max(...xDataForRange)
  const yMinData = Math.min(...yDataForRange)
  const yMaxData = Math.max(...yDataForRange)
  const xPad = (xMaxData - xMinData) * 0.05 || 1
  const yPad = (yMaxData - yMinData) * 0.05 || 1

  // Start with 5% padding from data/baseline
  let xRange: [number, number] = [xMinData - xPad, xMaxData + xPad]
  let yRange: [number, number] = [yMinData - yPad, yMaxData + yPad]
  let xAutorange = true
  let yAutorange = true

  // Degenerate-axis guard: when all x or y values are identical, Plotly's autorange
  // produces a zero-width axis [v, v] which resvg renders as zero-height geometry
  // and panics with Option::unwrap() on a None value (geom.rs:27). Force autorange=false
  // so that the non-degenerate padded range computed above is respected by Plotly.
  if (xMinData === xMaxData) xAutorange = false
  if (yMinData === yMaxData) yAutorange = false

  // Reference-line inclusion guard: if any y-axis reference line value lies outside
  // the current yRange, resvg panics when rasterizing the out-of-bounds SVG path
  // (geom.rs:27 extreme coordinates like y=-38995 inside a 1400px canvas).
  // Expand yRange to include all y-axis reference line values, and force autorange=false
  // so Plotly doesn't override the explicit range we set.
  if (input.referenceLines) {
    for (const rl of input.referenceLines) {
      if (rl.axis === 'y' && typeof rl.value === 'number' && Number.isFinite(rl.value)) {
        if (rl.value < yRange[0] || rl.value > yRange[1]) {
          const lo = Math.min(yRange[0], rl.value)
          const hi = Math.max(yRange[1], rl.value)
          const pad = (hi - lo) * 0.08
          yRange = [lo - pad, hi + pad]
          yAutorange = false
        }
      }
      if (rl.axis === 'x' && typeof rl.value === 'number' && Number.isFinite(rl.value)) {
        if (rl.value < xRange[0] || rl.value > xRange[1]) {
          const lo = Math.min(xRange[0], rl.value)
          const hi = Math.max(xRange[1], rl.value)
          const pad = (hi - lo) * 0.08
          xRange = [lo - pad, hi + pad]
          xAutorange = false
        }
      }
    }
  }

  // Override with explicit/autoTrim ranges when specified
  const configuredXRange = computeAxisRange(xDataForRange, {
    min: xMin, max: xMax, autoTrim: xAutoTrim, padding: 0.02,
  })
  if (configuredXRange) {
    xRange = configuredXRange
    xAutorange = false
  }
  const configuredYRange = computeAxisRange(yDataForRange, {
    min: yMin, max: yMax, autoTrim: yAutoTrim, padding: 0.02,
  })
  if (configuredYRange) {
    yRange = configuredYRange
    yAutorange = false
  }

  // ── Layout ────────────────────────────────────────────────────────────

  const showLegend = hasCategories
    || showComparison
    || (colorByActive && effectiveColorByType === 'categorical')
    || hasSecondaryY
  const hasColorbar = colorByActive && effectiveColorByType === 'numeric'

  const rightMargin = hasSecondaryY
    ? (showLegend ? 160 : 70)
    : (showLegend ? 100 : (hasColorbar ? 80 : 15))

  // Dashboard passes margin {l:60,r:15,t:10,b:50}; export defaults add top room
  // for title since export renders titles inside the plot (no card frame).
  const layoutMargin = style.margin ?? { l: 60, r: rightMargin, t: title ? 45 : 15, b: 55 }
  // Override right margin even if style.margin is provided, based on trace content
  layoutMargin.r = rightMargin

  const xAxisConfig: Record<string, any> = {
    title: {
      text: xAxisTitle ?? xColumn,
      font: { color: textColor, size: style.axisTitleFontSize, family: fontFamily },
    },
    tickfont: { color: textColor, size: style.axisTickFontSize, family: fontFamily },
    side: 'bottom',
    anchor: 'y',
    gridcolor: gridColor,
    linecolor: textColor,
    linewidth: 1.2,
    showline: true,
    mirror: false,                // hide top spine — matplotlib look
    zerolinecolor: gridColor,
    automargin: true,
    nticks: 10,
    tickformat: '.5~g',
    range: xRange,
  }
  if (!xAutorange) {
    xAxisConfig.autorange = false
  }

  const yAxisConfig: Record<string, any> = {
    title: {
      text: yAxisTitle ?? yColumn,
      font: { color: textColor, size: style.axisTitleFontSize, family: fontFamily },
    },
    tickfont: { color: textColor, size: style.axisTickFontSize, family: fontFamily },
    side: 'left',
    anchor: 'x',
    gridcolor: gridColor,
    linecolor: textColor,
    linewidth: 1.2,
    showline: true,
    mirror: false,                // hide right spine — matplotlib look
    zerolinecolor: gridColor,
    automargin: true,
    nticks: 10,
    tickformat: '.5~g',
    range: yRange,
  }
  if (!yAutorange) {
    yAxisConfig.autorange = false
  }

  // Secondary Y-axis
  const yAxis2Config: Record<string, any> | undefined = hasSecondaryY ? {
    title: { text: yAxisRightTitle ?? yColumnRight!, font: { color: textColor, size: style.axisTitleFontSize, family: fontFamily } },
    tickfont: { color: textColor, size: style.axisTickFontSize, family: fontFamily },
    gridcolor: 'rgba(0,0,0,0)',
    linecolor: isScientific ? textColor : gridColor,
    linewidth: isScientific ? 1.5 : 1,
    showline: true,
    zerolinecolor: gridColor,
    automargin: true,
    nticks: 10,
    tickformat: '.5~g',
    overlaying: 'y',
    side: 'right',
  } : undefined

  // Legend title
  let legendTitle: string | undefined
  if (colorByActive && effectiveColorByType === 'categorical' && !forceColorColumnGrouping) {
    legendTitle = colorBy!
  } else if (hasCategories && colorColumn) {
    legendTitle = colorColumn
  }

  const titleFontSize = style.titleFontSize ?? style.axisTitleFontSize + 4

  const layout: Record<string, any> = {
    title: title
      ? {
          text: title,
          font: { color: textColor, size: titleFontSize, family: fontFamily },
          x: 0.5,
          xanchor: 'center',
        }
      : undefined,
    font: { family: fontFamily, color: textColor, size: style.axisTickFontSize },
    xaxis: xAxisConfig,
    yaxis: yAxisConfig,
    ...(yAxis2Config ? { yaxis2: yAxis2Config } : {}),
    margin: layoutMargin,
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    hovermode: 'closest',
    showlegend: showLegend,
    legend: showLegend ? {
      title: legendTitle
        ? { text: legendTitle, font: { color: textColor, size: style.legendTitleFontSize, family: fontFamily } }
        : undefined,
      x: 1.02,
      y: 1,
      xanchor: 'left',
      yanchor: 'top',
      font: { color: textColor, size: style.legendFontSize, family: fontFamily },
      bgcolor: 'rgba(0,0,0,0)',
      borderwidth: 0,
    } : undefined,
    shapes: [
      ...(input.referenceLines ?? []).map(buildReferenceShape),
    ],
    annotations: [
      ...(input.annotations ?? []),
      ...(input.referenceLines ?? []).filter(r => r.label).map(r => buildReferenceAnnotation(r, style)),
    ],
  }

  return {
    traces,
    layout,
    config: { displayModeBar: false },
  }
}
