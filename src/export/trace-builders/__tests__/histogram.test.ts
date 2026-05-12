import { describe, it, expect } from 'vitest'
import { buildHistogramFigure, HistogramInput } from '../histogram'
import { PRINT_CHART_STYLE } from '../../defaults'
import type { ChartStyle } from '../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const style: ChartStyle = { ...PRINT_CHART_STYLE }

/** Generate N rows with a numeric column. */
function makeRows(column: string, values: number[], extra?: Record<string, any>[]): any[] {
  return values.map((v, i) => ({
    [column]: v,
    ...(extra ? extra[i] : {}),
  }))
}

/** Shorthand for a minimal input. */
function input(overrides: Partial<HistogramInput> = {}): HistogramInput {
  return {
    filteredData: makeRows('distance', [1, 2, 3, 4, 5]),
    column: 'distance',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Basic trace output
// ---------------------------------------------------------------------------

describe('buildHistogramFigure', () => {
  describe('basic output', () => {
    it('returns traces, layout, and config', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig).toHaveProperty('traces')
      expect(fig).toHaveProperty('layout')
      expect(fig).toHaveProperty('config')
    })

    it('produces a single bar trace for simple data', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.traces).toHaveLength(1)
      expect(fig.traces[0].type).toBe('bar')
    })

    it('uses barColor from style for the default trace', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.traces[0].marker.color).toBe(style.barColor)
    })

    it('sets displayModeBar to false', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.config?.displayModeBar).toBe(false)
    })

    it('returns empty traces when filteredData is empty', () => {
      const fig = buildHistogramFigure(input({ filteredData: [] }), style)
      // With empty data, binning produces nothing so trace x/y are empty
      expect(fig.traces[0].x).toHaveLength(0)
      expect(fig.traces[0].y).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Binning
  // ---------------------------------------------------------------------------

  describe('binning', () => {
    it('aligns bin edges to binSize boundaries', () => {
      const data = makeRows('val', [0.5, 1.5, 2.5, 3.5, 4.5])
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val', binSize: 2 }),
        style
      )
      const xVals = fig.traces[0].x as number[]
      // floor(0.5/2)*2=0, floor(1.5/2)*2=0, floor(2.5/2)*2=2, floor(3.5/2)*2=2, floor(4.5/2)*2=4
      expect(xVals).toEqual([0, 2, 4])
    })

    it('counts correctly per bin', () => {
      const data = makeRows('val', [0.5, 1.5, 2.5, 3.5, 4.5])
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val', binSize: 2 }),
        style
      )
      const yVals = fig.traces[0].y as number[]
      // bins: 0 -> [0.5,1.5] = 2, 2 -> [2.5,3.5] = 2, 4 -> [4.5] = 1
      expect(yVals).toEqual([2, 2, 1])
    })

    it('uses binSize=1 by default', () => {
      const data = makeRows('val', [1, 1, 2, 3])
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val' }),
        style
      )
      // Each integer value is its own bin
      expect(fig.traces[0].x).toEqual([1, 2, 3])
      expect(fig.traces[0].y).toEqual([2, 1, 1])
    })

    it('skips null and undefined values', () => {
      const data = [
        { val: 1 },
        { val: null },
        { val: undefined },
        { val: 2 },
      ]
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val' }),
        style
      )
      expect(fig.traces[0].x).toEqual([1, 2])
      expect(fig.traces[0].y).toEqual([1, 1])
    })

    it('skips NaN values', () => {
      const data = makeRows('val', [1, NaN, 3])
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val' }),
        style
      )
      expect(fig.traces[0].x).toEqual([1, 3])
    })
  })

  // ---------------------------------------------------------------------------
  // Comparison mode
  // ---------------------------------------------------------------------------

  describe('comparison mode', () => {
    it('produces two traces: baseline + filtered', () => {
      const baseline = makeRows('d', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      const filtered = makeRows('d', [3, 4, 5])
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'd',
          showComparison: true,
        }),
        style
      )
      expect(fig.traces).toHaveLength(2)
      expect(fig.traces[0].name).toBe('Baseline (All Data)')
      expect(fig.traces[1].name).toBe('Filtered')
    })

    it('sets barmode to overlay in comparison mode', () => {
      const baseline = makeRows('d', [1, 2, 3])
      const filtered = makeRows('d', [2])
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'd',
          showComparison: true,
        }),
        style
      )
      expect(fig.layout.barmode).toBe('overlay')
    })

    it('shows percentage (density) y-axis label in comparison mode', () => {
      const baseline = makeRows('d', [1, 2])
      const filtered = makeRows('d', [1])
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'd',
          showComparison: true,
        }),
        style
      )
      expect(fig.layout.yaxis.title.text).toBe('Percentage [%]')
    })

    it('shows Count y-axis label without comparison', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.layout.yaxis.title.text).toBe('Count')
    })

    it('aligns filtered bins to baseline bins', () => {
      const baseline = makeRows('d', [1, 2, 3, 4, 5])
      // Filtered only has values in bins 2 and 4, but should show all baseline bins
      const filtered = makeRows('d', [2, 4])
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'd',
          showComparison: true,
        }),
        style
      )
      const filteredTrace = fig.traces[1]
      // Should have all 5 bins (1,2,3,4,5), not just the 2 with data
      expect(filteredTrace.x).toHaveLength(5)
    })

    it('uses baseline bar width at 85% of binSize', () => {
      const baseline = makeRows('d', [1, 2, 3])
      const filtered = makeRows('d', [2])
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'd',
          binSize: 10,
          showComparison: true,
        }),
        style
      )
      expect(fig.traces[0].width).toBeCloseTo(8.5) // 10 * 0.85
    })

    it('enables legend in comparison mode', () => {
      const baseline = makeRows('d', [1, 2, 3])
      const filtered = makeRows('d', [2])
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'd',
          showComparison: true,
        }),
        style
      )
      expect(fig.layout.showlegend).toBe(true)
    })

    it('disables legend without comparison or colorBy', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.layout.showlegend).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Categorical color-by (stacking)
  // ---------------------------------------------------------------------------

  describe('categorical colorBy', () => {
    const catData = [
      { val: 1, mode: 'car' },
      { val: 2, mode: 'car' },
      { val: 1, mode: 'bike' },
      { val: 3, mode: 'bike' },
      { val: 2, mode: 'walk' },
    ]

    it('creates one trace per category', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: catData,
          column: 'val',
          colorBy: 'mode',
          colorByType: 'categorical',
        }),
        style
      )
      // 3 categories: bike, car, walk (sorted alphabetically)
      expect(fig.traces).toHaveLength(3)
    })

    it('sets barmode to stack', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: catData,
          column: 'val',
          colorBy: 'mode',
          colorByType: 'categorical',
        }),
        style
      )
      expect(fig.layout.barmode).toBe('stack')
    })

    it('enables legend with title', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: catData,
          column: 'val',
          colorBy: 'mode',
          colorByType: 'categorical',
        }),
        style
      )
      expect(fig.layout.showlegend).toBe(true)
      expect(fig.layout.legend.title.text).toBe('mode')
    })

    it('sets right margin to 100 for legend space', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: catData,
          column: 'val',
          colorBy: 'mode',
          colorByType: 'categorical',
        }),
        style
      )
      expect(fig.layout.margin.r).toBe(100)
    })

    it('uses colors from colorMap when provided', () => {
      const colorMap = new Map([
        ['car', '#ff0000'],
        ['bike', '#00ff00'],
        ['walk', '#0000ff'],
      ])
      const fig = buildHistogramFigure(
        input({
          filteredData: catData,
          column: 'val',
          colorBy: 'mode',
          colorByType: 'categorical',
          colorMap,
        }),
        style
      )
      // Traces are sorted alphabetically: bike, car, walk
      expect(fig.traces[0].marker.color).toBe('#00ff00') // bike
      expect(fig.traces[1].marker.color).toBe('#ff0000') // car
      expect(fig.traces[2].marker.color).toBe('#0000ff') // walk
    })

    it('falls back to barColor when colorMap entry missing', () => {
      const colorMap = new Map([['car', '#ff0000']])
      const fig = buildHistogramFigure(
        input({
          filteredData: catData,
          column: 'val',
          colorBy: 'mode',
          colorByType: 'categorical',
          colorMap,
        }),
        style
      )
      // bike has no color map entry -> falls back to barColor
      expect(fig.traces[0].marker.color).toBe(style.barColor) // bike
      expect(fig.traces[1].marker.color).toBe('#ff0000') // car
    })

    it('sorts numeric-looking categories numerically', () => {
      const numCatData = [
        { val: 1, group: 10 },
        { val: 2, group: 2 },
        { val: 3, group: 1 },
      ]
      const fig = buildHistogramFigure(
        input({
          filteredData: numCatData,
          column: 'val',
          colorBy: 'group',
          colorByType: 'categorical',
        }),
        style
      )
      // Should sort numerically: 1, 2, 10 (not lexicographically: 1, 10, 2)
      expect(fig.traces.map(t => t.name)).toEqual(['1', '2', '10'])
    })

    it('stacks on top of baseline in comparison+categorical mode', () => {
      const baseline = [
        { val: 1, mode: 'car' },
        { val: 2, mode: 'car' },
        { val: 1, mode: 'bike' },
      ]
      const filtered = [{ val: 1, mode: 'car' }]
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'val',
          colorBy: 'mode',
          colorByType: 'categorical',
          showComparison: true,
        }),
        style
      )
      // 1 baseline trace + 1 category trace (only 'car' in filtered)
      expect(fig.traces).toHaveLength(2)
      expect(fig.traces[0].name).toBe('Baseline (All Data)')
      expect(fig.traces[1].name).toBe('car')
      // barmode is stack (categorical overrides overlay)
      expect(fig.layout.barmode).toBe('stack')
    })
  })

  // ---------------------------------------------------------------------------
  // Numeric color-by
  // ---------------------------------------------------------------------------

  describe('numeric colorBy', () => {
    const numData = [
      { val: 1, speed: 10 },
      { val: 1, speed: 20 },
      { val: 2, speed: 30 },
      { val: 3, speed: 40 },
    ]

    it('creates a single trace with Viridis colorscale', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: numData,
          column: 'val',
          colorBy: 'speed',
          colorByType: 'numeric',
        }),
        style
      )
      expect(fig.traces).toHaveLength(1)
      expect(fig.traces[0].marker.colorscale).toBe('Viridis')
    })

    it('includes a colorbar with formatted title', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: numData,
          column: 'val',
          colorBy: 'speed',
          colorByType: 'numeric',
        }),
        style
      )
      expect(fig.traces[0].marker.showscale).toBe(true)
      expect(fig.traces[0].marker.colorbar.title.text).toBe('speed')
    })

    it('computes average color-by value per bin', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: numData,
          column: 'val',
          colorBy: 'speed',
          colorByType: 'numeric',
        }),
        style
      )
      const colors = fig.traces[0].marker.color as (number | null)[]
      // bin 1: avg(10,20) = 15, bin 2: 30, bin 3: 40
      expect(colors[0]).toBeCloseTo(15)
      expect(colors[1]).toBeCloseTo(30)
      expect(colors[2]).toBeCloseTo(40)
    })

    it('sets right margin to 80 for colorbar space', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: numData,
          column: 'val',
          colorBy: 'speed',
          colorByType: 'numeric',
        }),
        style
      )
      expect(fig.layout.margin.r).toBe(80)
    })
  })

  // ---------------------------------------------------------------------------
  // Layout and style
  // ---------------------------------------------------------------------------

  describe('layout and style', () => {
    it('uses explicit margins from style', () => {
      const customStyle = { ...style, margin: { l: 70, r: 20, t: 15, b: 60 } }
      const fig = buildHistogramFigure(input(), customStyle)
      expect(fig.layout.margin.l).toBe(70)
      expect(fig.layout.margin.r).toBe(20)
      expect(fig.layout.margin.t).toBe(15)
      expect(fig.layout.margin.b).toBe(60)
    })

    it('uses default margins when style.margin is undefined', () => {
      const noMarginStyle = { ...style, margin: undefined }
      const fig = buildHistogramFigure(input(), noMarginStyle)
      // No title in this fixture → tight top margin matching dashboard scale
      expect(fig.layout.margin).toEqual({ l: 60, r: 20, t: 15, b: 55 })
    })

    it('uses larger top margin when title is present', () => {
      const noMarginStyle = { ...style, margin: undefined }
      const fig = buildHistogramFigure(input({ title: 'Foo' }), noMarginStyle)
      expect(fig.layout.margin.t).toBe(45)
    })

    it('applies font sizes from style', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.layout.xaxis.title.font.size).toBe(style.axisTitleFontSize)
      expect(fig.layout.xaxis.tickfont.size).toBe(style.axisTickFontSize)
      expect(fig.layout.yaxis.title.font.size).toBe(style.axisTitleFontSize)
      expect(fig.layout.yaxis.tickfont.size).toBe(style.axisTickFontSize)
    })

    it('applies colors from style', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.layout.paper_bgcolor).toBe(style.backgroundColor)
      expect(fig.layout.plot_bgcolor).toBe(style.backgroundColor)
      expect(fig.layout.xaxis.tickfont.color).toBe(style.textColor)
      expect(fig.layout.xaxis.gridcolor).toBe(style.gridColor)
    })

    it('applies fontFamily from style', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.layout.font.family).toBe(style.fontFamily)
      expect(fig.layout.xaxis.title.font.family).toBe(style.fontFamily)
    })

    it('uses textColor for axis lines regardless of scientific mode', () => {
      // Paper-quality figures use dark axis lines whether or not scientific
      // patterns are enabled — the visual distinction was confusing and the
      // gridColor variant produced washed-out, hard-to-read frames at PNG scale.
      const sciStyle = { ...style, isScientific: true }
      const figSci = buildHistogramFigure(input(), sciStyle)
      expect(figSci.layout.xaxis.linecolor).toBe(sciStyle.textColor)
      expect(figSci.layout.yaxis.linecolor).toBe(sciStyle.textColor)
      expect(figSci.layout.xaxis.linewidth).toBe(1.2)

      const plainStyle = { ...style, isScientific: false }
      const figPlain = buildHistogramFigure(input(), plainStyle)
      expect(figPlain.layout.xaxis.linecolor).toBe(plainStyle.textColor)
      expect(figPlain.layout.yaxis.linecolor).toBe(plainStyle.textColor)
    })

    it('uses title from input as the chart title (not x-axis title)', () => {
      const fig = buildHistogramFigure(input({ title: 'Trip Distance' }), style)
      expect(fig.layout.title.text).toBe('Trip Distance')
      // X-axis title still uses the column name so the axis is self-documenting
      expect(fig.layout.xaxis.title.text).toBe('distance')
    })

    it('falls back to column name as x-axis title', () => {
      const fig = buildHistogramFigure(input({ title: undefined }), style)
      expect(fig.layout.xaxis.title.text).toBe('distance')
    })
  })

  // ---------------------------------------------------------------------------
  // Adaptive tick thinning
  // ---------------------------------------------------------------------------

  describe('adaptive tick thinning', () => {
    it('does not thin ticks when bins <= maxTicksToShow', () => {
      const data = makeRows('val', [1, 2, 3, 4, 5])
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val' }),
        style
      )
      // 5 bins <= 12 maxTicks: no thinning, so no explicit tickmode
      expect(fig.layout.xaxis.tickmode).toBeUndefined()
    })

    it('thins ticks when bins exceed maxTicksToShow', () => {
      // Create 20 bins (each value is unique, binSize=1)
      const values = Array.from({ length: 20 }, (_, i) => i)
      const data = makeRows('val', values)
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val' }),
        style
      )
      // 20 bins > 12 maxTicks: thinning should activate
      expect(fig.layout.xaxis.tickmode).toBe('array')
      // Should have fewer ticks than 20
      expect(fig.layout.xaxis.tickvals.length).toBeLessThan(20)
      // Should still include first and last
      expect(fig.layout.xaxis.tickvals[0]).toBe(0)
      expect(fig.layout.xaxis.tickvals[fig.layout.xaxis.tickvals.length - 1]).toBe(19)
    })

    it('always includes first and last tick when thinning', () => {
      const values = Array.from({ length: 30 }, (_, i) => i * 100)
      const data = makeRows('val', values)
      const fig = buildHistogramFigure(
        input({ filteredData: data, column: 'val', binSize: 100 }),
        style
      )
      const ticks = fig.layout.xaxis.tickvals
      expect(ticks[0]).toBe(0)
      expect(ticks[ticks.length - 1]).toBe(2900)
    })
  })

  // ---------------------------------------------------------------------------
  // Axis range
  // ---------------------------------------------------------------------------

  describe('axis range', () => {
    it('applies xMin/xMax as axis range with padding', () => {
      const fig = buildHistogramFigure(
        input({ xMin: 0, xMax: 100 }),
        style
      )
      expect(fig.layout.xaxis.range).toBeDefined()
      expect(fig.layout.xaxis.autorange).toBe(false)
      // With 2% padding: [0 - 2, 100 + 2] = [-2, 102]
      expect(fig.layout.xaxis.range[0]).toBeCloseTo(-2)
      expect(fig.layout.xaxis.range[1]).toBeCloseTo(102)
    })

    it('returns no axis range when no limits specified', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.layout.xaxis.range).toBeUndefined()
      expect(fig.layout.xaxis.autorange).toBeUndefined()
    })

    it('uses baselineData for axis range when available', () => {
      const baseline = makeRows('d', [0, 50, 100])
      const filtered = makeRows('d', [50])
      const fig = buildHistogramFigure(
        input({
          filteredData: filtered,
          baselineData: baseline,
          column: 'd',
          xMin: 0,
          xMax: 100,
        }),
        style
      )
      // Range should be based on xMin/xMax, not filtered data extent
      expect(fig.layout.xaxis.range).toBeDefined()
      expect(fig.layout.xaxis.range[0]).toBeCloseTo(-2)
      expect(fig.layout.xaxis.range[1]).toBeCloseTo(102)
    })
  })

  // ---------------------------------------------------------------------------
  // Bar width
  // ---------------------------------------------------------------------------

  describe('bar width', () => {
    it('sets bar width to 85% of binSize', () => {
      const fig = buildHistogramFigure(
        input({ binSize: 10 }),
        style
      )
      expect(fig.traces[0].width).toBeCloseTo(8.5)
    })

    it('defaults to binSize=1 when not specified', () => {
      const fig = buildHistogramFigure(input(), style)
      expect(fig.traces[0].width).toBeCloseTo(0.85)
    })
  })

  // ---------------------------------------------------------------------------
  // referenceLines passthrough
  // ---------------------------------------------------------------------------

  describe('buildHistogramFigure — referenceLines', () => {
    it('adds shapes for each referenceLine (axis: x)', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: [{ distance: 0 }, { distance: 1 }, { distance: 2 }, { distance: 3 }],
          referenceLines: [
            { axis: 'x', value: 1.5, label: 'threshold', dash: 'dash' },
          ],
        }),
        style
      )
      expect(fig.layout.shapes?.length ?? 0).toBeGreaterThanOrEqual(1)
      const shape = (fig.layout.shapes as any[])[0]
      expect(shape.x0).toBe(1.5)
      expect(shape.x1).toBe(1.5)
    })

    it('adds an annotation when referenceLine has a label', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: [{ distance: 0 }, { distance: 1 }],
          referenceLines: [{ axis: 'x', value: 0.5, label: 'half' }],
        }),
        style
      )
      const annotations = (fig.layout.annotations ?? []) as any[]
      expect(annotations.some((a: any) => a.text === 'half')).toBe(true)
    })

    it('renders normally when referenceLines is undefined', () => {
      const fig = buildHistogramFigure(
        input({
          filteredData: [{ distance: 0 }, { distance: 1 }],
        }),
        style
      )
      // No shapes should be set, or shapes is empty array
      expect((fig.layout.shapes ?? []).length).toBe(0)
    })
  })
})
