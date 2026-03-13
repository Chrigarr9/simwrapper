import { describe, it, expect } from 'vitest'
import { buildScatterFigure, ScatterInput } from '../scatter'
import type { ChartStyle } from '../../types'

// ── Shared fixtures ──────────────────────────────────────────────────────────

const baseStyle: ChartStyle = {
  axisTitleFontSize: 14,
  axisTickFontSize: 12,
  legendTitleFontSize: 13,
  legendFontSize: 12,
  lineWidth: 2.4,
  markerSizeMultiplier: 1.35,
  fontFamily: 'Arial, Helvetica, sans-serif',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  gridColor: '#cccccc',
  barColor: '#0072B2',
  selectedColor: '#666666',
  isScientific: false,
}

const scientificStyle: ChartStyle = { ...baseStyle, isScientific: true }

function makeRows(n: number, extra?: (i: number) => Record<string, any>) {
  return Array.from({ length: n }, (_, i) => ({
    x: i + 1,
    y: (i + 1) * 10,
    ...(extra ? extra(i) : {}),
  }))
}

// ── Empty / minimal data ─────────────────────────────────────────────────────

describe('buildScatterFigure — empty data', () => {
  it('returns empty traces when filteredData is empty', () => {
    const fig = buildScatterFigure(
      { filteredData: [], xColumn: 'x', yColumn: 'y' },
      baseStyle,
    )
    expect(fig.traces).toHaveLength(0)
    expect(fig.config).toEqual({ displayModeBar: false })
  })

  it('returns empty traces when all values are non-numeric', () => {
    const fig = buildScatterFigure(
      {
        filteredData: [{ x: 'a', y: 'b' }, { x: null, y: undefined }],
        xColumn: 'x',
        yColumn: 'y',
      },
      baseStyle,
    )
    expect(fig.traces).toHaveLength(0)
  })
})

// ── Single trace (path 5) ────────────────────────────────────────────────────

describe('buildScatterFigure — single trace', () => {
  const input: ScatterInput = {
    filteredData: makeRows(5),
    xColumn: 'x',
    yColumn: 'y',
  }

  it('produces exactly 1 trace', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces).toHaveLength(1)
  })

  it('trace type is scatter with markers mode', () => {
    const fig = buildScatterFigure(input, baseStyle)
    const t = fig.traces[0]
    expect(t.type).toBe('scatter')
    expect(t.mode).toBe('markers')
  })

  it('uses barColor as default marker color', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].marker.color).toBe('#0072B2')
  })

  it('marker sizes use markerSizeMultiplier from style', () => {
    const fig = buildScatterFigure(input, baseStyle)
    // default marker 8 * 1.35 = 10.8
    const sizes = fig.traces[0].marker.size as number[]
    expect(sizes.every((s: number) => s === 8 * 1.35)).toBe(true)
  })

  it('layout has displayModeBar: false', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.config?.displayModeBar).toBe(false)
  })

  it('layout shows no legend for single trace', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.showlegend).toBe(false)
  })

  it('axis titles match xColumn/yColumn', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.xaxis.title.text).toBe('x')
    expect(fig.layout.yaxis.title.text).toBe('y')
  })

  it('tickformat is .5~g and nticks is 10', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.xaxis.tickformat).toBe('.5~g')
    expect(fig.layout.xaxis.nticks).toBe(10)
    expect(fig.layout.yaxis.tickformat).toBe('.5~g')
    expect(fig.layout.yaxis.nticks).toBe(10)
  })
})

// ── Baseline trace (path 1) ─────────────────────────────────────────────────

describe('buildScatterFigure — baseline trace', () => {
  const input: ScatterInput = {
    filteredData: makeRows(3),
    baselineData: makeRows(5),
    xColumn: 'x',
    yColumn: 'y',
    showComparison: true,
  }

  it('adds baseline trace as first trace when showComparison is true', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces.length).toBeGreaterThanOrEqual(2)
    expect(fig.traces[0].name).toBe('Baseline (All Data)')
  })

  it('baseline markers are gray with 0.8x size', () => {
    const fig = buildScatterFigure(input, baseStyle)
    const baseline = fig.traces[0]
    expect(baseline.marker.color).toContain('156')
    expect(baseline.marker.size).toBeCloseTo(8 * 1.35 * 0.8, 1)
  })

  it('baseline uses circle-open in scientific mode', () => {
    const fig = buildScatterFigure(input, scientificStyle)
    expect(fig.traces[0].marker.symbol).toBe('circle-open')
  })

  it('baseline uses undefined symbol in non-scientific mode', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].marker.symbol).toBeUndefined()
  })

  it('baseline mode is always markers (never lines)', () => {
    const fig = buildScatterFigure(
      { ...input, connectLines: true },
      baseStyle,
    )
    expect(fig.traces[0].mode).toBe('markers')
  })

  it('shows legend when comparison mode is active', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.showlegend).toBe(true)
  })

  it('axis range is computed from baseline data with 5% padding', () => {
    const fig = buildScatterFigure(input, baseStyle)
    // baseline x: [1,2,3,4,5], range = 4, padding = 0.2
    expect(fig.layout.xaxis.range[0]).toBeCloseTo(0.8, 1)
    expect(fig.layout.xaxis.range[1]).toBeCloseTo(5.2, 1)
    // baseline y: [10,20,30,40,50], range = 40, padding = 2
    expect(fig.layout.yaxis.range[0]).toBeCloseTo(8, 1)
    expect(fig.layout.yaxis.range[1]).toBeCloseTo(52, 1)
  })
})

// ── Categorical colorBy (path 2) ────────────────────────────────────────────

describe('buildScatterFigure — categorical colorBy', () => {
  const input: ScatterInput = {
    filteredData: [
      { x: 1, y: 10, mode: 'car' },
      { x: 2, y: 20, mode: 'car' },
      { x: 3, y: 30, mode: 'bike' },
      { x: 4, y: 40, mode: 'bike' },
    ],
    xColumn: 'x',
    yColumn: 'y',
    colorBy: 'mode',
    colorByType: 'categorical',
  }

  it('creates one trace per category', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces).toHaveLength(2)
  })

  it('trace names are sorted legend values', () => {
    const fig = buildScatterFigure(input, baseStyle)
    const names = fig.traces.map((t: any) => t.name)
    expect(names).toEqual(['bike', 'car'])
  })

  it('shows legend when categorical colorBy is active', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.showlegend).toBe(true)
  })

  it('legend title matches colorBy field', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.legend.title.text).toBe('mode')
  })

  it('uses provided colorMap colors when available', () => {
    const colorMap = new Map([['car', '#ff0000'], ['bike', '#00ff00']])
    const fig = buildScatterFigure({ ...input, colorMap }, baseStyle)
    const carTrace = fig.traces.find((t: any) => t.name === 'car')
    const bikeTrace = fig.traces.find((t: any) => t.name === 'bike')
    expect(carTrace.marker.color).toBe('#ff0000')
    expect(bikeTrace.marker.color).toBe('#00ff00')
  })

  it('uses scientific marker symbols per category in scientific mode', () => {
    const fig = buildScatterFigure(input, scientificStyle)
    const symbols = fig.traces.map((t: any) => t.marker.symbol)
    // Default scientific symbols: circle, square, ...
    expect(symbols[0]).toBe('circle')
    expect(symbols[1]).toBe('square')
  })

  it('right margin is 100 when legend is shown', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.margin.r).toBe(100)
  })
})

// ── Numeric colorBy (path 3) ────────────────────────────────────────────────

describe('buildScatterFigure — numeric colorBy', () => {
  const input: ScatterInput = {
    filteredData: [
      { x: 1, y: 10, score: 0.1 },
      { x: 2, y: 20, score: 0.5 },
      { x: 3, y: 30, score: 0.9 },
    ],
    xColumn: 'x',
    yColumn: 'y',
    colorBy: 'score',
    colorByType: 'numeric',
  }

  it('creates exactly 1 trace with colorscale', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces).toHaveLength(1)
    expect(fig.traces[0].marker.colorscale).toBe('Viridis')
  })

  it('marker.showscale is true', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].marker.showscale).toBe(true)
  })

  it('marker.color is the array of numeric values', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].marker.color).toEqual([0.1, 0.5, 0.9])
  })

  it('showlegend is false for numeric colorBy', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].showlegend).toBe(false)
  })

  it('has a colorbar with title text', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].marker.colorbar.title.text).toBe('score')
  })

  it('right margin is 80 for colorbar without legend', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.margin.r).toBe(80)
  })
})

// ── colorColumn grouping (path 4) ───────────────────────────────────────────

describe('buildScatterFigure — colorColumn grouping', () => {
  const input: ScatterInput = {
    filteredData: [
      { x: 1, y: 10, group: 'A' },
      { x: 2, y: 20, group: 'B' },
      { x: 3, y: 30, group: 'A' },
    ],
    xColumn: 'x',
    yColumn: 'y',
    colorColumn: 'group',
  }

  it('creates one trace per colorColumn category', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces).toHaveLength(2)
  })

  it('trace names are sorted categories', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces.map((t: any) => t.name)).toEqual(['A', 'B'])
  })

  it('trace A has 2 points, trace B has 1', () => {
    const fig = buildScatterFigure(input, baseStyle)
    const traceA = fig.traces.find((t: any) => t.name === 'A')
    const traceB = fig.traces.find((t: any) => t.name === 'B')
    expect(traceA.x).toHaveLength(2)
    expect(traceB.x).toHaveLength(1)
  })

  it('legend title is colorColumn name', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.legend.title.text).toBe('group')
  })

  it('sets legendgroup on each trace', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].legendgroup).toBe('A')
    expect(fig.traces[1].legendgroup).toBe('B')
  })
})

// ── connectLines ─────────────────────────────────────────────────────────────

describe('buildScatterFigure — connectLines', () => {
  const input: ScatterInput = {
    filteredData: [
      { x: 3, y: 30 },
      { x: 1, y: 10 },
      { x: 2, y: 20 },
    ],
    xColumn: 'x',
    yColumn: 'y',
    connectLines: true,
  }

  it('uses lines+markers mode', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].mode).toBe('lines+markers')
  })

  it('sorts data by X ascending', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].x).toEqual([1, 2, 3])
    expect(fig.traces[0].y).toEqual([10, 20, 30])
  })

  it('has line property with configured width', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].line.width).toBe(baseStyle.lineWidth)
  })

  it('applies scientific dash patterns per category', () => {
    const catInput: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, cat: 'A' },
        { x: 2, y: 20, cat: 'A' },
        { x: 3, y: 30, cat: 'B' },
        { x: 4, y: 40, cat: 'B' },
      ],
      xColumn: 'x',
      yColumn: 'y',
      colorColumn: 'cat',
      connectLines: true,
    }
    const fig = buildScatterFigure(catInput, scientificStyle)
    expect(fig.traces[0].line.dash).toBe('solid')
    expect(fig.traces[1].line.dash).toBe('dash')
  })
})

// ── Secondary Y-axis ────────────────────────────────────────────────────────

describe('buildScatterFigure — secondary Y-axis (yColumnRight)', () => {
  const input: ScatterInput = {
    filteredData: [
      { x: 1, y: 10, y2: 100 },
      { x: 2, y: 20, y2: 200 },
      { x: 3, y: 30, y2: 300 },
    ],
    xColumn: 'x',
    yColumn: 'y',
    yColumnRight: 'y2',
  }

  it('adds secondary traces with yaxis: y2', () => {
    const fig = buildScatterFigure(input, baseStyle)
    const secondaryTraces = fig.traces.filter((t: any) => t.yaxis === 'y2')
    expect(secondaryTraces).toHaveLength(1)
  })

  it('secondary axis config has overlaying:y and side:right', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.yaxis2).toBeDefined()
    expect(fig.layout.yaxis2.overlaying).toBe('y')
    expect(fig.layout.yaxis2.side).toBe('right')
  })

  it('secondary trace uses open markers', () => {
    const fig = buildScatterFigure(input, baseStyle)
    const sec = fig.traces.find((t: any) => t.yaxis === 'y2')
    expect(sec.marker.symbol).toBe('diamond-open')
  })

  it('secondary trace uses circle-open in scientific mode', () => {
    const fig = buildScatterFigure(input, scientificStyle)
    const sec = fig.traces.find((t: any) => t.yaxis === 'y2')
    expect(sec.marker.symbol).toBe('circle-open')
  })

  it('right margin is 160 when secondary axis + legend', () => {
    const withCat: ScatterInput = {
      ...input,
      filteredData: [
        { x: 1, y: 10, y2: 100, g: 'A' },
        { x: 2, y: 20, y2: 200, g: 'B' },
      ],
      colorColumn: 'g',
    }
    const fig = buildScatterFigure(withCat, baseStyle)
    expect(fig.layout.margin.r).toBe(160)
  })

  it('secondary trace legend name is yColumnRight when no categories', () => {
    const fig = buildScatterFigure(input, baseStyle)
    const sec = fig.traces.find((t: any) => t.yaxis === 'y2')
    expect(sec.name).toBe('y2')
  })

  it('secondary trace legend name includes "(right)" with categories', () => {
    const withCat: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, y2: 100, g: 'A' },
        { x: 2, y: 20, y2: 200, g: 'A' },
      ],
      xColumn: 'x',
      yColumn: 'y',
      yColumnRight: 'y2',
      colorColumn: 'g',
    }
    const fig = buildScatterFigure(withCat, baseStyle)
    const sec = fig.traces.find((t: any) => t.yaxis === 'y2')
    expect(sec.name).toBe('A (right)')
  })
})

// ── sizeColumn ──────────────────────────────────────────────────────────────

describe('buildScatterFigure — sizeColumn', () => {
  it('uses per-point sizes clamped between 5 and 25', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, sz: 2 },    // below 5 -> clamped to 5
        { x: 2, y: 20, sz: 15 },   // within range
        { x: 3, y: 30, sz: 50 },   // above 25 -> clamped to 25
      ],
      xColumn: 'x',
      yColumn: 'y',
      sizeColumn: 'sz',
    }
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.traces[0].marker.size).toEqual([5, 15, 25])
  })

  it('falls back to markerSize * multiplier when sizeColumn row is missing', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, sz: 12 },
        { x: 2, y: 20 }, // sz missing
      ],
      xColumn: 'x',
      yColumn: 'y',
      sizeColumn: 'sz',
      markerSize: 10,
    }
    const fig = buildScatterFigure(input, baseStyle)
    const sizes = fig.traces[0].marker.size as number[]
    expect(sizes[0]).toBe(12)
    expect(sizes[1]).toBeCloseTo(10 * 1.35)
  })
})

// ── Axis range overrides ────────────────────────────────────────────────────

describe('buildScatterFigure — axis range configuration', () => {
  const input: ScatterInput = {
    filteredData: makeRows(10), // x: 1..10, y: 10..100
    xColumn: 'x',
    yColumn: 'y',
  }

  it('applies explicit xMin/xMax', () => {
    const fig = buildScatterFigure({ ...input, xMin: 0, xMax: 15 }, baseStyle)
    const [lo, hi] = fig.layout.xaxis.range
    // padding = (15-0)*0.02 = 0.3
    expect(lo).toBeCloseTo(-0.3, 1)
    expect(hi).toBeCloseTo(15.3, 1)
    expect(fig.layout.xaxis.autorange).toBe(false)
  })

  it('applies xAutoTrim percentile-based range', () => {
    // With 10 points 1..10, autoTrim=80 keeps central 80%
    // tail = (100-80)/200 = 0.1, so lower = quantile(0.1), upper = quantile(0.9)
    const fig = buildScatterFigure({ ...input, xAutoTrim: 80 }, baseStyle)
    expect(fig.layout.xaxis.autorange).toBe(false)
    const [lo, hi] = fig.layout.xaxis.range
    // quantile(0.1) of [1..10] ~ 1.9, quantile(0.9) ~ 9.1
    // padding ~ (9.1-1.9)*0.02 = 0.144
    expect(lo).toBeGreaterThan(1)
    expect(hi).toBeLessThan(10)
  })

  it('does not set autorange:false when no range overrides', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.xaxis.autorange).toBeUndefined()
    expect(fig.layout.yaxis.autorange).toBeUndefined()
  })
})

// ── Scientific mode styling ─────────────────────────────────────────────────

describe('buildScatterFigure — scientific mode', () => {
  it('axis linecolor is textColor in scientific mode', () => {
    const input: ScatterInput = { filteredData: makeRows(3), xColumn: 'x', yColumn: 'y' }
    const fig = buildScatterFigure(input, scientificStyle)
    expect(fig.layout.xaxis.linecolor).toBe(scientificStyle.textColor)
    expect(fig.layout.yaxis.linecolor).toBe(scientificStyle.textColor)
  })

  it('axis linewidth is 1.5 in scientific mode', () => {
    const input: ScatterInput = { filteredData: makeRows(3), xColumn: 'x', yColumn: 'y' }
    const fig = buildScatterFigure(input, scientificStyle)
    expect(fig.layout.xaxis.linewidth).toBe(1.5)
  })

  it('axis linecolor is gridColor in non-scientific mode', () => {
    const input: ScatterInput = { filteredData: makeRows(3), xColumn: 'x', yColumn: 'y' }
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.xaxis.linecolor).toBe(baseStyle.gridColor)
  })

  it('accepts custom scientificSymbols', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, g: 'A' },
        { x: 2, y: 20, g: 'B' },
      ],
      xColumn: 'x',
      yColumn: 'y',
      colorColumn: 'g',
      scientificSymbols: ['star', 'hexagon'],
    }
    const fig = buildScatterFigure(input, scientificStyle)
    expect(fig.traces[0].marker.symbol).toBe('star')
    expect(fig.traces[1].marker.symbol).toBe('hexagon')
  })

  it('accepts custom scientificLinePatterns with connectLines', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, g: 'A' },
        { x: 2, y: 20, g: 'A' },
        { x: 3, y: 30, g: 'B' },
        { x: 4, y: 40, g: 'B' },
      ],
      xColumn: 'x',
      yColumn: 'y',
      colorColumn: 'g',
      connectLines: true,
      scientificLinePatterns: ['longdash', 'longdashdot'],
    }
    const fig = buildScatterFigure(input, scientificStyle)
    expect(fig.traces[0].line.dash).toBe('longdash')
    expect(fig.traces[1].line.dash).toBe('longdashdot')
  })
})

// ── Layout details ──────────────────────────────────────────────────────────

describe('buildScatterFigure — layout details', () => {
  const input: ScatterInput = { filteredData: makeRows(3), xColumn: 'x', yColumn: 'y' }

  it('paper_bgcolor and plot_bgcolor match style', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.paper_bgcolor).toBe('#ffffff')
    expect(fig.layout.plot_bgcolor).toBe('#ffffff')
  })

  it('right margin is 15 for single trace without colorbar', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.margin.r).toBe(15)
  })

  it('hovermode is closest', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.hovermode).toBe('closest')
  })

  it('font family from style is applied to layout', () => {
    const fig = buildScatterFigure(input, baseStyle)
    expect(fig.layout.font.family).toBe(baseStyle.fontFamily)
  })
})

// ── colorColumn + connectLines forces colorColumn grouping over colorBy ─────

describe('buildScatterFigure — forceColorColumnGrouping', () => {
  it('uses colorColumn grouping even when colorBy is active if connectLines is true', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, cat: 'A', mode: 'car' },
        { x: 2, y: 20, cat: 'B', mode: 'bike' },
        { x: 3, y: 30, cat: 'A', mode: 'car' },
      ],
      xColumn: 'x',
      yColumn: 'y',
      colorColumn: 'cat',
      colorBy: 'mode',
      colorByType: 'categorical',
      connectLines: true,
    }
    const fig = buildScatterFigure(input, baseStyle)
    // Should group by colorColumn (A, B), not colorBy (bike, car)
    const names = fig.traces.map((t: any) => t.name)
    expect(names).toEqual(['A', 'B'])
  })
})

// ── Mixed scenario: baseline + categorical + secondary ──────────────────────

describe('buildScatterFigure — complex combined scenario', () => {
  it('produces baseline + 2 category traces + 2 secondary traces', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, y2: 100, g: 'A' },
        { x: 2, y: 20, y2: 200, g: 'A' },
        { x: 3, y: 30, y2: 300, g: 'B' },
      ],
      baselineData: [
        { x: 1, y: 10, y2: 100, g: 'A' },
        { x: 2, y: 20, y2: 200, g: 'A' },
        { x: 3, y: 30, y2: 300, g: 'B' },
        { x: 4, y: 40, y2: 400, g: 'B' },
      ],
      xColumn: 'x',
      yColumn: 'y',
      yColumnRight: 'y2',
      colorColumn: 'g',
      showComparison: true,
    }
    const fig = buildScatterFigure(input, baseStyle)

    // 1 baseline + 2 categories (A,B) + 2 secondary (A right, B right)
    expect(fig.traces).toHaveLength(5)
    expect(fig.traces[0].name).toBe('Baseline (All Data)')
    expect(fig.traces.filter((t: any) => t.yaxis === 'y2')).toHaveLength(2)
    expect(fig.layout.yaxis2).toBeDefined()
    expect(fig.layout.margin.r).toBe(160)
  })
})

// ── Skips NaN / non-numeric data points ─────────────────────────────────────

describe('buildScatterFigure — data filtering', () => {
  it('skips rows where x or y is non-numeric', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10 },
        { x: 'bad', y: 20 },
        { x: 3, y: NaN },
        { x: 4, y: 40 },
        { x: Infinity, y: 50 },
      ],
      xColumn: 'x',
      yColumn: 'y',
    }
    const fig = buildScatterFigure(input, baseStyle)
    // Only rows with both finite x and y: row 0 (1,10) and row 3 (4,40)
    expect(fig.traces[0].x).toEqual([1, 4])
    expect(fig.traces[0].y).toEqual([10, 40])
  })
})

// ── Numeric legend sorting ──────────────────────────────────────────────────

describe('buildScatterFigure — numeric category sorting', () => {
  it('sorts numeric categories numerically, not lexicographically', () => {
    const input: ScatterInput = {
      filteredData: [
        { x: 1, y: 10, cat: '10' },
        { x: 2, y: 20, cat: '2' },
        { x: 3, y: 30, cat: '1' },
      ],
      xColumn: 'x',
      yColumn: 'y',
      colorColumn: 'cat',
    }
    const fig = buildScatterFigure(input, baseStyle)
    const names = fig.traces.map((t: any) => t.name)
    expect(names).toEqual(['1', '2', '10'])
  })
})
