import { describe, it, expect } from 'vitest'
import { buildPieFigure, PieInput } from '../pie'
import type { ChartStyle } from '../../types'

/** Minimal ChartStyle for tests */
const baseStyle: ChartStyle = {
  axisTitleFontSize: 14,
  axisTickFontSize: 12,
  legendTitleFontSize: 13,
  legendFontSize: 12,
  lineWidth: 2,
  markerSizeMultiplier: 1,
  fontFamily: 'Arial',
  backgroundColor: '#ffffff',
  textColor: '#000000',
  gridColor: '#cccccc',
  barColor: '#0072B2',
  selectedColor: '#666666',
  isScientific: false,
}

const scientificStyle: ChartStyle = { ...baseStyle, isScientific: true }

/** Helper: generate rows with a given column value */
function makeRows(column: string, valueCounts: Record<string, number>): any[] {
  const rows: any[] = []
  for (const [val, count] of Object.entries(valueCounts)) {
    for (let i = 0; i < count; i++) {
      rows.push({ [column]: val })
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// Basic structure
// ---------------------------------------------------------------------------
describe('buildPieFigure — basic structure', () => {
  it('returns traces, layout, and config', () => {
    const input: PieInput = {
      filteredData: makeRows('mode', { car: 5, bike: 3 }),
      column: 'mode',
    }
    const fig = buildPieFigure(input, baseStyle)

    expect(fig).toHaveProperty('traces')
    expect(fig).toHaveProperty('layout')
    expect(fig).toHaveProperty('config')
    expect(Array.isArray(fig.traces)).toBe(true)
    expect(fig.traces.length).toBe(1) // single pie, no comparison
  })

  it('produces a donut with hole 0.3 (no comparison)', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 2, b: 3 }), column: 'x' },
      baseStyle
    )
    expect((fig.traces[0] as any).hole).toBe(0.3)
  })

  it('sets displayModeBar: false', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      baseStyle
    )
    expect(fig.config?.displayModeBar).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Category counting and sorting
// ---------------------------------------------------------------------------
describe('buildPieFigure — category counting', () => {
  it('counts category occurrences correctly', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('color', { red: 10, blue: 5, green: 3 }), column: 'color' },
      baseStyle
    )
    const trace = fig.traces[0] as any
    // Alphabetically sorted: blue, green, red
    expect(trace.labels).toEqual(['blue', 'green', 'red'])
    expect(trace.values).toEqual([5, 3, 10])
  })

  it('sorts numeric category keys numerically', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('zone', { '10': 2, '2': 4, '1': 1 }), column: 'zone' },
      baseStyle
    )
    const trace = fig.traces[0] as any
    expect(trace.labels).toEqual(['1', '2', '10'])
    expect(trace.values).toEqual([1, 4, 2])
  })

  it('ignores null and undefined values', () => {
    const data = [
      { col: 'a' },
      { col: null },
      { col: undefined },
      { col: 'b' },
      { col: 'a' },
    ]
    const fig = buildPieFigure({ filteredData: data, column: 'col' }, baseStyle)
    const trace = fig.traces[0] as any
    expect(trace.labels).toEqual(['a', 'b'])
    expect(trace.values).toEqual([2, 1])
  })
})

// ---------------------------------------------------------------------------
// Color map
// ---------------------------------------------------------------------------
describe('buildPieFigure — colorMap', () => {
  it('applies colorMap colors to slices', () => {
    const colorMap = new Map([
      ['bus', '#FF0000'],
      ['tram', '#00FF00'],
    ])
    const fig = buildPieFigure(
      { filteredData: makeRows('mode', { bus: 3, tram: 7 }), column: 'mode', colorMap },
      baseStyle
    )
    const trace = fig.traces[0] as any
    // Sorted: bus, tram
    expect(trace.marker.colors).toEqual(['#FF0000', '#00FF00'])
  })

  it('falls back to barColor when category is not in colorMap', () => {
    const colorMap = new Map([['known', '#111111']])
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { known: 1, unknown: 2 }), column: 'x', colorMap },
      baseStyle
    )
    const trace = fig.traces[0] as any
    // Sorted: known, unknown
    expect(trace.marker.colors[0]).toBe('#111111')
    expect(trace.marker.colors[1]).toBe(baseStyle.barColor)
  })
})

// ---------------------------------------------------------------------------
// Comparison mode
// ---------------------------------------------------------------------------
describe('buildPieFigure — comparison mode', () => {
  const filtered = makeRows('mode', { car: 5, bike: 3 })
  const baseline = makeRows('mode', { car: 10, bike: 6, walk: 4 })

  it('produces two traces (inner + outer)', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    expect(fig.traces.length).toBe(2)
  })

  it('inner ring has hole 0.4 and constrained domain', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    const inner = fig.traces[0] as any
    expect(inner.hole).toBe(0.4)
    expect(inner.domain).toEqual({ x: [0.15, 0.85], y: [0.15, 0.85] })
  })

  it('outer ring has hole 0.7 and full domain', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    const outer = fig.traces[1] as any
    expect(outer.hole).toBe(0.7)
    expect(outer.domain).toEqual({ x: [0, 1], y: [0, 1] })
  })

  it('outer ring has textinfo "none"', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    expect((fig.traces[1] as any).textinfo).toBe('none')
  })

  it('outer ring colors have alpha suffix (dimmed)', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    const outerColors = (fig.traces[1] as any).marker.colors as string[]
    // Each color should be longer than 7 chars (#RRGGBB + alpha)
    for (const c of outerColors) {
      expect(c.length).toBe(9) // #RRGGBB + 2 hex alpha digits
    }
  })

  it('inner ring hides legend in comparison mode', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    expect((fig.traces[0] as any).showlegend).toBe(false)
    expect((fig.traces[1] as any).showlegend).toBe(true)
  })

  it('center annotation shows "filtered of baseline" counts', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    const centerAnnotation = fig.layout.annotations[0]
    expect(centerAnnotation.text).toContain(String(filtered.length))
    expect(centerAnnotation.text).toContain(String(baseline.length))
  })

  it('adds ring legend annotation in comparison mode', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: true },
      baseStyle
    )
    expect(fig.layout.annotations.length).toBe(2)
    expect(fig.layout.annotations[1].text).toContain('Filtered')
    expect(fig.layout.annotations[1].text).toContain('Baseline')
  })

  it('no baseline trace without showComparison', () => {
    const fig = buildPieFigure(
      { filteredData: filtered, baselineData: baseline, column: 'mode', showComparison: false },
      baseStyle
    )
    expect(fig.traces.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Text positioning logic
// ---------------------------------------------------------------------------
describe('buildPieFigure — text positioning', () => {
  it('normal mode: inside >=10%, outside >=3%, none otherwise', () => {
    // 70 + 5 + 1 = 76 total; 70/76=92%, 5/76=6.6%, 1/76=1.3%
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { big: 70, mid: 5, tiny: 1 }), column: 'x' },
      baseStyle
    )
    const trace = fig.traces[0] as any
    // Labels sorted alphabetically: big, mid, tiny
    expect(trace.textposition).toEqual(['inside', 'outside', 'none'])
  })

  it('comparison mode: inside >=20%, none otherwise', () => {
    // 80 + 15 + 5 = 100; 80%=inside, 15%=none, 5%=none
    const fig = buildPieFigure(
      {
        filteredData: makeRows('x', { large: 80, medium: 15, small: 5 }),
        baselineData: makeRows('x', { large: 100, medium: 50, small: 20 }),
        column: 'x',
        showComparison: true,
      },
      baseStyle
    )
    const trace = fig.traces[0] as any
    // Sorted: large, medium, small
    expect(trace.textposition).toEqual(['inside', 'none', 'none'])
  })
})

// ---------------------------------------------------------------------------
// Center annotation
// ---------------------------------------------------------------------------
describe('buildPieFigure — center annotation', () => {
  it('shows total count in non-comparison mode', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 7, b: 3 }), column: 'x' },
      baseStyle
    )
    const annotation = fig.layout.annotations[0]
    expect(annotation.text).toContain('10')
    expect(annotation.x).toBe(0.5)
    expect(annotation.y).toBe(0.5)
  })

  it('only has one annotation in non-comparison mode', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      baseStyle
    )
    expect(fig.layout.annotations.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Scientific mode patterns
// ---------------------------------------------------------------------------
describe('buildPieFigure — scientific mode', () => {
  it('adds pattern marker in scientific mode', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 3, b: 2 }), column: 'x' },
      scientificStyle
    )
    const marker = (fig.traces[0] as any).marker
    expect(marker.pattern).toBeDefined()
    expect(marker.pattern.shape).toHaveLength(2)
    expect(marker.pattern.bgcolor).toHaveLength(2)
    expect(marker.pattern.solidity).toBe(0.4)
  })

  it('does not add pattern in non-scientific mode', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 3, b: 2 }), column: 'x' },
      baseStyle
    )
    expect((fig.traces[0] as any).marker.pattern).toBeUndefined()
  })

  it('uses custom scientificPatterns when provided', () => {
    const customPatterns = ['x', '+']
    const fig = buildPieFigure(
      {
        filteredData: makeRows('x', { alpha: 5, beta: 3 }),
        column: 'x',
        scientificPatterns: customPatterns,
      },
      scientificStyle
    )
    const shapes = (fig.traces[0] as any).marker.pattern.shape
    // alpha -> index 0 -> 'x', beta -> index 1 -> '+'
    expect(shapes).toEqual(['x', '+'])
  })

  it('applies patterns to both traces in scientific comparison mode', () => {
    const fig = buildPieFigure(
      {
        filteredData: makeRows('x', { a: 3 }),
        baselineData: makeRows('x', { a: 5, b: 2 }),
        column: 'x',
        showComparison: true,
      },
      scientificStyle
    )
    expect((fig.traces[0] as any).marker.pattern).toBeDefined()
    expect((fig.traces[1] as any).marker.pattern).toBeDefined()
  })

  it('assigns consistent pattern index from baseline categories', () => {
    // Baseline has a, b, c (sorted). Filtered only has b.
    // b should get index 1 from baseline ordering.
    const fig = buildPieFigure(
      {
        filteredData: makeRows('x', { b: 3 }),
        baselineData: makeRows('x', { a: 1, b: 3, c: 2 }),
        column: 'x',
        showComparison: true,
      },
      scientificStyle
    )
    const defaultPatterns = ['', '/', '\\', 'x', '+', '-', '|', '.']
    const innerShapes = (fig.traces[0] as any).marker.pattern.shape
    // b is at index 1 in [a, b, c]
    expect(innerShapes[0]).toBe(defaultPatterns[1]) // '/'
  })
})

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------
describe('buildPieFigure — legend', () => {
  it('legend is vertical and right-aligned', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      baseStyle
    )
    const legend = fig.layout.legend
    expect(legend.orientation).toBe('v')
    expect(legend.x).toBe(1.02)
    expect(legend.xanchor).toBe('left')
    expect(legend.y).toBe(0.5)
    expect(legend.yanchor).toBe('middle')
  })

  it('legend title is the column name', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('transport_mode', { car: 5 }), column: 'transport_mode' },
      baseStyle
    )
    expect(fig.layout.legend.title.text).toBe('transport_mode')
  })

  it('legend uses style font sizes', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      baseStyle
    )
    expect(fig.layout.legend.title.font.size).toBe(baseStyle.legendTitleFontSize)
    expect(fig.layout.legend.font.size).toBe(baseStyle.legendFontSize)
  })
})

// ---------------------------------------------------------------------------
// Layout styling
// ---------------------------------------------------------------------------
describe('buildPieFigure — layout styling', () => {
  it('uses style backgroundColor for paper and plot', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      baseStyle
    )
    expect(fig.layout.paper_bgcolor).toBe('#ffffff')
    expect(fig.layout.plot_bgcolor).toBe('#ffffff')
  })

  it('uses style fontFamily globally', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      baseStyle
    )
    expect(fig.layout.font.family).toBe('Arial')
  })

  it('applies custom margin from style', () => {
    const custom: ChartStyle = { ...baseStyle, margin: { l: 50, r: 50, t: 50, b: 50 } }
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      custom
    )
    expect(fig.layout.margin).toEqual({ l: 50, r: 50, t: 50, b: 50 })
  })

  it('sets title text when provided', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x', title: 'My Chart' },
      baseStyle
    )
    expect(fig.layout.title.text).toBe('My Chart')
  })

  it('sets empty title when none provided', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { a: 1 }), column: 'x' },
      baseStyle
    )
    expect(fig.layout.title.text).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('buildPieFigure — edge cases', () => {
  it('handles empty filteredData gracefully', () => {
    const fig = buildPieFigure({ filteredData: [], column: 'x' }, baseStyle)
    expect(fig.traces.length).toBe(1)
    const trace = fig.traces[0] as any
    expect(trace.labels).toEqual([])
    expect(trace.values).toEqual([])
  })

  it('handles single category', () => {
    const fig = buildPieFigure(
      { filteredData: makeRows('x', { only: 42 }), column: 'x' },
      baseStyle
    )
    const trace = fig.traces[0] as any
    expect(trace.labels).toEqual(['only'])
    expect(trace.values).toEqual([42])
  })

  it('handles comparison with empty baseline', () => {
    const fig = buildPieFigure(
      {
        filteredData: makeRows('x', { a: 1 }),
        baselineData: [],
        column: 'x',
        showComparison: true,
      },
      baseStyle
    )
    // No baseline trace when baselineData is empty
    expect(fig.traces.length).toBe(1)
  })

  it('handles comparison with undefined baseline', () => {
    const fig = buildPieFigure(
      {
        filteredData: makeRows('x', { a: 1 }),
        baselineData: undefined,
        column: 'x',
        showComparison: true,
      },
      baseStyle
    )
    expect(fig.traces.length).toBe(1)
  })

  it('stringifies non-string category values', () => {
    const data = [{ x: 1 }, { x: 2 }, { x: 1 }, { x: 3 }]
    const fig = buildPieFigure({ filteredData: data, column: 'x' }, baseStyle)
    const trace = fig.traces[0] as any
    // Numeric sort: 1, 2, 3
    expect(trace.labels).toEqual(['1', '2', '3'])
    expect(trace.values).toEqual([2, 1, 1])
  })
})
