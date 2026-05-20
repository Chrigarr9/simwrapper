import type { PlotlyFigure, ChartStyle, ReferenceLine } from '../types'
import { buildReferenceShape, buildReferenceAnnotation } from './_layout-helpers'

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface HistogramInput {
  filteredData: any[]
  baselineData?: any[]
  column: string
  idColumn?: string
  binSize?: number
  title?: string
  xMin?: number
  xMax?: number
  autoTrim?: number
  colorBy?: string
  colorByType?: 'categorical' | 'numeric'
  colorMap?: Map<string, string>
  showComparison?: boolean
  annotations?: any[]  // Plotly annotation objects, passthrough to layout.annotations
  referenceLines?: ReferenceLine[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface BinEntry {
  bin: number
  count: number
}

/** Bin an array of numeric values into fixed-width bins aligned to binSize. */
function binValues(rows: any[], column: string, binSize: number): BinEntry[] {
  const bins = new Map<number, number>()
  for (const row of rows) {
    const val = row[column]
    if (val !== null && val !== undefined && typeof val === 'number' && !isNaN(val)) {
      const bin = Math.floor(val / binSize) * binSize
      bins.set(bin, (bins.get(bin) || 0) + 1)
    }
  }
  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({ bin, count }))
}

/** Convert counts to percentages (density). */
function toDensity(entries: BinEntry[]): BinEntry[] {
  const total = entries.reduce((s, d) => s + d.count, 0)
  if (total === 0) return entries
  return entries.map(d => ({ bin: d.bin, count: (d.count / total) * 100 }))
}

/**
 * Build baseline-aligned bins for filtered data.
 * Ensures every baseline bin has an entry (0 if no filtered rows fall in it).
 */
function binValuesAligned(
  rows: any[],
  column: string,
  binSize: number,
  baselineBins: BinEntry[]
): BinEntry[] {
  const bins = new Map<number, number>()
  for (const b of baselineBins) bins.set(b.bin, 0)
  for (const row of rows) {
    const val = row[column]
    if (val !== null && val !== undefined && typeof val === 'number' && !isNaN(val)) {
      const bin = Math.floor(val / binSize) * binSize
      if (bins.has(bin)) {
        bins.set(bin, bins.get(bin)! + 1)
      }
    }
  }
  return Array.from(bins.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bin, count]) => ({ bin, count }))
}

/** Sort legend categories: numeric ascending, otherwise locale-compare. */
function sortCategories<T>(values: T[]): T[] {
  const sorted = [...values]
  const nums = sorted.map(Number)
  if (sorted.length > 0 && nums.every(v => Number.isFinite(v))) {
    sorted.sort((a, b) => Number(a) - Number(b))
  } else {
    sorted.sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
  }
  return sorted
}

/**
 * Compute a simple percentile-based axis range.
 * Mirrors the logic in axisLimits.ts but avoids importing the external
 * `simple-statistics` dependency so the trace builder stays self-contained.
 */
function computeSimpleAxisRange(
  values: number[],
  opts: { min?: number; max?: number; autoTrim?: number; padding?: number }
): [number, number] | undefined {
  const { min, max, autoTrim, padding = 0.02 } = opts
  const hasMin = min !== undefined
  const hasMax = max !== undefined
  const hasAutoTrim = autoTrim !== undefined && autoTrim > 0 && autoTrim <= 100

  if (!hasMin && !hasMax && !hasAutoTrim) return undefined

  const clean = values.filter(v => typeof v === 'number' && isFinite(v) && !isNaN(v)).sort((a, b) => a - b)
  if (clean.length === 0) return undefined

  let lower: number
  let upper: number

  if (hasAutoTrim) {
    const tail = (100 - autoTrim!) / 200
    const loIdx = Math.max(0, Math.floor(tail * clean.length))
    const hiIdx = Math.min(clean.length - 1, Math.ceil((1 - tail) * clean.length) - 1)
    lower = hasMin ? min! : clean[loIdx]
    upper = hasMax ? max! : clean[hiIdx]
  } else {
    lower = hasMin ? min! : clean[0]
    upper = hasMax ? max! : clean[clean.length - 1]
  }

  const range = upper - lower
  const pad = range * padding
  return [lower - pad, upper + pad]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Plotly figure for a histogram card.
 *
 * Pure function: no Vue reactivity, no DOM access, no StyleManager.
 * All visual parameters come from the `style` argument.
 */
export function buildHistogramFigure(
  input: HistogramInput,
  style: ChartStyle
): PlotlyFigure {
  const {
    filteredData,
    baselineData,
    column,
    binSize: rawBinSize,
    title,
    xMin,
    xMax,
    autoTrim,
    colorBy,
    colorByType,
    colorMap,
    showComparison = false,
    referenceLines,
  } = input

  const binSize = rawBinSize || 1

  // --- Compute bin data -------------------------------------------------

  const baselineSource = baselineData && baselineData.length > 0 ? baselineData : filteredData
  const baselineBins = binValues(baselineSource, column, binSize)

  let filteredBins: BinEntry[]
  if (showComparison && baselineBins.length > 0) {
    filteredBins = binValuesAligned(filteredData, column, binSize, baselineBins)
  } else {
    filteredBins = binValues(filteredData, column, binSize)
  }

  const usePercentage = showComparison
  const displayData = usePercentage ? toDensity(filteredBins) : filteredBins
  const baselineDisplayData = usePercentage ? toDensity(baselineBins) : baselineBins

  // --- Bar width --------------------------------------------------------

  const barWidth = binSize * 0.85

  // --- Style shortcuts --------------------------------------------------

  const {
    backgroundColor: bgColor,
    textColor,
    gridColor,
    barColor,
    fontFamily,
    axisTitleFontSize,
    axisTickFontSize,
    legendTitleFontSize,
    legendFontSize,
    isScientific,
  } = style

  // --- Traces -----------------------------------------------------------

  const traces: any[] = []

  // Baseline trace (comparison mode)
  if (showComparison && baselineDisplayData.length > 0) {
    traces.push({
      x: baselineDisplayData.map(d => d.bin),
      y: baselineDisplayData.map(d => d.count),
      type: 'bar',
      name: 'Baseline (All Data)',
      width: barWidth,
      marker: {
        color: 'rgba(180,180,180,0.5)',
        line: { color: 'rgba(120,120,120,0.7)', width: 1 },
      },
      hovertemplate: usePercentage
        ? '<b>%{x}</b><br>Baseline: %{y:.1f}%<extra></extra>'
        : '<b>%{x}</b><br>Baseline: %{y}<extra></extra>',
    })
  }

  // Color-by: categorical stacking
  const colorByActive = !!colorBy
  if (colorByActive && colorByType === 'categorical') {
    const categories = sortCategories(
      Array.from(
        new Set(
          filteredData
            .map(row => row[colorBy!])
            .filter(v => v !== null && v !== undefined)
        )
      )
    )

    for (const catValue of categories) {
      const catStr = String(catValue)
      const catRows = filteredData.filter(row => String(row[colorBy!]) === catStr)

      // Bin the category rows using the same bin boundaries as displayData
      const catBins = new Map<number, number>()
      for (const d of displayData) catBins.set(d.bin, 0)
      for (const row of catRows) {
        const val = row[column]
        if (val !== null && val !== undefined && typeof val === 'number' && !isNaN(val)) {
          const bin = Math.floor(val / binSize) * binSize
          if (catBins.has(bin)) {
            catBins.set(bin, catBins.get(bin)! + 1)
          }
        }
      }

      let catDisplayData = Array.from(catBins.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([bin, count]) => ({ bin, count }))

      if (usePercentage && catRows.length > 0) {
        const total = catRows.length
        catDisplayData = catDisplayData.map(d => ({
          bin: d.bin,
          count: (d.count / total) * 100,
        }))
      }

      traces.push({
        x: catDisplayData.map(d => d.bin),
        y: catDisplayData.map(d => d.count),
        type: 'bar',
        name: catStr,
        width: barWidth,
        marker: {
          color: colorMap?.get(catStr) || barColor,
          line: {
            color: showComparison ? 'rgba(120,120,120,0.7)' : gridColor,
            width: showComparison ? 1 : 0.6,
          },
        },
        hovertemplate: usePercentage
          ? `<b>%{x}</b><br>${catStr}: %{y:.1f}%<extra></extra>`
          : `<b>%{x}</b><br>${catStr}: %{y}<extra></extra>`,
      })
    }
  } else if (colorByActive && colorByType === 'numeric') {
    // Numeric color-by: Viridis colorscale
    const binAverages = displayData.map(d => {
      const binRows = filteredData.filter(row => {
        const val = row[column]
        if (val === null || val === undefined || typeof val !== 'number' || isNaN(val)) return false
        return Math.floor(val / binSize) * binSize === d.bin
      })
      if (binRows.length === 0) return null

      const colorValues = binRows
        .map(row => row[colorBy!])
        .filter(v => v !== null && v !== undefined && typeof v === 'number' && !isNaN(v))
      if (colorValues.length === 0) return null

      return colorValues.reduce((a, b) => a + b, 0) / colorValues.length
    })

    const colorByTitle = colorBy || ''

    traces.push({
      x: displayData.map(d => d.bin),
      y: displayData.map(d => d.count),
      type: 'bar',
      name: showComparison ? 'Filtered' : 'Count',
      width: barWidth,
      marker: {
        color: binAverages,
        colorscale: 'Viridis',
        showscale: true,
        colorbar: {
          title: {
            text: colorByTitle,
            font: { color: textColor, size: legendTitleFontSize, family: fontFamily },
            side: 'right',
          },
          tickfont: { color: textColor, size: axisTickFontSize, family: fontFamily },
        },
        line: {
          color: showComparison ? 'rgba(120,120,120,0.7)' : gridColor,
          width: showComparison ? 1 : 0.6,
        },
      },
      hovertemplate: usePercentage
        ? '<b>%{x}</b><br>Filtered: %{y:.1f}%<extra></extra>'
        : '<b>%{x}</b><br>Filtered: %{y}<extra></extra>',
    })
  } else {
    // Standard single-trace histogram (no color-by)
    traces.push({
      x: displayData.map(d => d.bin),
      y: displayData.map(d => d.count),
      type: 'bar',
      name: showComparison ? 'Filtered' : 'Count',
      width: barWidth,
      marker: {
        color: barColor,
        line: {
          color: showComparison ? 'rgba(120,120,120,0.7)' : gridColor,
          width: showComparison ? 1 : 0.6,
        },
      },
      hovertemplate: usePercentage
        ? '<b>%{x}</b><br>Filtered: %{y:.1f}%<extra></extra>'
        : '<b>%{x}</b><br>Filtered: %{y}<extra></extra>',
    })
  }

  // --- X-axis tick thinning ---------------------------------------------

  const tickvals = filteredBins.map(d => d.bin)
  const ticktext = tickvals.map(v => String(v))
  const numBins = tickvals.length
  const maxLabelLength = ticktext.length > 0 ? Math.max(...ticktext.map(t => t.length)) : 1
  const maxTicksToShow = maxLabelLength <= 4 ? 12 : maxLabelLength <= 6 ? 10 : 8
  const shouldRotate = maxLabelLength > 4 && numBins > 3

  // X-axis title: prefer column name; reserve `title` for the chart title above
  const xaxisConfig: any = {
    title: {
      text: column,
      font: { color: textColor, size: axisTitleFontSize, family: fontFamily },
    },
    tickfont: { color: textColor, size: axisTickFontSize, family: fontFamily },
    side: 'bottom',
    anchor: 'y',
    gridcolor: gridColor,
    linecolor: textColor,
    linewidth: 1.2,
    showline: true,
    mirror: false,                // hide top spine — matplotlib look
    zerolinecolor: gridColor,
    automargin: true,
    tickangle: shouldRotate ? -45 : 0,
  }

  // Apply axis range (from xMin/xMax or autoTrim)
  const rangeValues = baselineSource
    .map(row => row[column])
    .filter((v: any) => v !== null && v !== undefined && typeof v === 'number' && !isNaN(v))

  const axisRange = computeSimpleAxisRange(rangeValues, {
    min: xMin,
    max: xMax,
    autoTrim,
    padding: 0.02,
  })
  if (axisRange) {
    xaxisConfig.range = axisRange
    xaxisConfig.autorange = false
  }

  // Apply tick thinning when many bins
  if (numBins > maxTicksToShow) {
    const skipInterval = Math.max(1, Math.ceil(numBins / maxTicksToShow))
    const thinnedTickvals: number[] = []
    const thinnedTicktext: string[] = []

    tickvals.forEach((val, idx) => {
      if (idx === 0 || idx === tickvals.length - 1 || idx % skipInterval === 0) {
        thinnedTickvals.push(val)
        thinnedTicktext.push(ticktext[idx])
      }
    })

    xaxisConfig.tickmode = 'array'
    xaxisConfig.tickvals = thinnedTickvals
    xaxisConfig.ticktext = thinnedTicktext
  }

  // --- Layout -----------------------------------------------------------

  const titleFontSize = style.titleFontSize ?? axisTitleFontSize + 4
  // Dashboard passes margin {l:60,r:15,t:10,b:50}; export defaults add top
  // room for title since export renders titles inside the plot (no card frame).
  // marginScale inflates these proportionally for paper-width exports.
  const marginScale = style.marginScale ?? 1.0
  const ms = (n: number) => Math.round(n * marginScale)
  const margin = style.margin || { l: ms(60), r: ms(20), t: title ? ms(45) : ms(15), b: ms(55) }

  const layout: any = {
    title: title
      ? {
          text: title,
          font: { color: textColor, size: titleFontSize, family: fontFamily },
          x: 0.5,
          xanchor: 'center',
        }
      : undefined,
    font: { family: fontFamily, color: textColor, size: axisTickFontSize },
    xaxis: xaxisConfig,
    yaxis: {
      title: {
        text: usePercentage ? 'Percentage [%]' : 'Count',
        font: { color: textColor, size: axisTitleFontSize, family: fontFamily },
      },
      tickfont: { color: textColor, size: axisTickFontSize, family: fontFamily },
      side: 'left',
      anchor: 'x',
      gridcolor: gridColor,
      linecolor: textColor,
      linewidth: 1.2,
      showline: true,
      mirror: false,              // hide right spine — matplotlib look
      zerolinecolor: gridColor,
      automargin: true,
    },
    margin: { ...margin },
    autosize: true,
    paper_bgcolor: bgColor,
    plot_bgcolor: bgColor,
    bargap: 0.08,
    barmode: 'overlay',
    showlegend: showComparison,
    legend: {
      x: 1,
      xanchor: 'right',
      y: 1,
      font: { color: textColor, size: legendFontSize },
    },
    annotations: [
      ...(input.annotations ?? []),
      ...(referenceLines ?? []).filter(r => r.label).map(r => buildReferenceAnnotation(r, style)),
    ],
    shapes: referenceLines ? referenceLines.map(buildReferenceShape) : [],
  }

  // Override layout for categorical color-by
  if (colorByActive && colorByType === 'categorical') {
    layout.barmode = 'stack'
    layout.showlegend = true
    layout.legend = {
      title: {
        text: colorBy,
        font: { color: textColor, size: legendTitleFontSize, family: fontFamily },
      },
      x: 1.02,
      xanchor: 'left',
      y: 1,
      yanchor: 'top',
      font: { color: textColor, size: legendFontSize, family: fontFamily },
      bgcolor: 'rgba(0,0,0,0)',
      borderwidth: 0,
    }
    layout.margin.r = 100
  } else if (colorByActive && colorByType === 'numeric') {
    layout.margin.r = 80
  }

  // --- Config -----------------------------------------------------------

  const config = {
    displayModeBar: false,
    responsive: true,
  }

  return { traces, layout, config }
}
