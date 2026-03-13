import { describe, it, expect } from 'vitest'
import { buildCorrelationFigure, CorrelationInput } from '../correlation'
import type { ChartStyle } from '../../types'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEFAULT_STYLE: ChartStyle = {
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
  isScientific: true,
}

/** 5 rows with perfectly correlated a/b and inversely correlated a/c */
const BASIC_DATA = [
  { a: 1, b: 2, c: 10 },
  { a: 2, b: 4, c: 8 },
  { a: 3, b: 6, c: 6 },
  { a: 4, b: 8, c: 4 },
  { a: 5, b: 10, c: 2 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function heatmapTrace(fig: ReturnType<typeof buildCorrelationFigure>) {
  return fig.traces[0] as any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCorrelationFigure', () => {
  // --------------------------------------------------
  // Basic structure
  // --------------------------------------------------

  describe('output structure', () => {
    it('returns a PlotlyFigure with traces, layout, and config', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      expect(fig).toHaveProperty('traces')
      expect(fig).toHaveProperty('layout')
      expect(fig).toHaveProperty('config')
      expect(Array.isArray(fig.traces)).toBe(true)
    })

    it('produces exactly one heatmap trace', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      expect(fig.traces).toHaveLength(1)
      expect(heatmapTrace(fig).type).toBe('heatmap')
    })

    it('sets displayModeBar: false in config', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      expect(fig.config?.displayModeBar).toBe(false)
    })
  })

  // --------------------------------------------------
  // Correlation values
  // --------------------------------------------------

  describe('correlation computation', () => {
    it('computes diagonal as 1 (self-correlation)', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b', 'c'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // Diagonal: r(a,a)=1, r(b,b)=1, r(c,c)=1
      expect(z[0][0]).toBe(1)
      expect(z[1][1]).toBe(1)
      expect(z[2][2]).toBe(1)
    })

    it('computes positive correlation for perfectly linearly related columns', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // a and b: b = 2*a, so r should be ~1
      expect(z[0][1]).toBeGreaterThan(0.99)
      expect(z[1][0]).toBeGreaterThan(0.99)
    })

    it('computes negative correlation for inversely related columns', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'c'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // a and c: c = 12 - 2*a, so r should be ~-1
      expect(z[0][1]).toBeLessThan(-0.99)
      expect(z[1][0]).toBeLessThan(-0.99)
    })

    it('produces a symmetric matrix for square attribute list', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b', 'c'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(z[i][j]).toBeCloseTo(z[j][i], 10)
        }
      }
    })
  })

  // --------------------------------------------------
  // Colorscale and range
  // --------------------------------------------------

  describe('heatmap colorscale', () => {
    it('uses diverging blue-white-red colorscale', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )
      const trace = heatmapTrace(fig)

      expect(trace.colorscale).toEqual([
        [0, '#3b4cc0'],
        [0.5, '#f7f7f7'],
        [1, '#b40426'],
      ])
    })

    it('clamps range to zmin:-1, zmax:1', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )
      const trace = heatmapTrace(fig)

      expect(trace.zmin).toBe(-1)
      expect(trace.zmax).toBe(1)
    })
  })

  // --------------------------------------------------
  // Y-axis reversed (matrix convention)
  // --------------------------------------------------

  describe('axis configuration', () => {
    it('reverses y-axis (autorange: reversed)', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      expect((fig.layout as any).yaxis.autorange).toBe('reversed')
    })

    it('rotates x-axis tick labels to -45 degrees', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      expect((fig.layout as any).xaxis.tickangle).toBe(-45)
    })
  })

  // --------------------------------------------------
  // leftAttributes / bottomAttributes (rectangular matrix)
  // --------------------------------------------------

  describe('rectangular matrix (separate row/column attributes)', () => {
    it('uses leftAttributes for rows and bottomAttributes for columns', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          leftAttributes: ['a', 'b'],
          bottomAttributes: ['c'],
        },
        DEFAULT_STYLE,
      )
      const trace = heatmapTrace(fig)
      const z = trace.z as number[][]

      // 2 rows x 1 column
      expect(z).toHaveLength(2)
      expect(z[0]).toHaveLength(1)

      // y-axis = row labels, x-axis = column labels
      expect(trace.y).toHaveLength(2)
      expect(trace.x).toHaveLength(1)
    })

    it('falls back to attributes when leftAttributes/bottomAttributes are empty', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b'],
          leftAttributes: [],
          bottomAttributes: [],
        },
        DEFAULT_STYLE,
      )
      const trace = heatmapTrace(fig)
      const z = trace.z as number[][]

      // Should behave as if attributes: ['a', 'b'] => 2x2 matrix
      expect(z).toHaveLength(2)
      expect(z[0]).toHaveLength(2)
    })
  })

  // --------------------------------------------------
  // Lower-triangle masking
  // --------------------------------------------------

  describe('lower-triangle masking (matrixPart: lower)', () => {
    it('sets upper-triangle cells to NaN', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b', 'c'],
          matrixPart: 'lower',
        },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // Upper triangle (row < col) should be NaN
      expect(z[0][1]).toBeNaN()
      expect(z[0][2]).toBeNaN()
      expect(z[1][2]).toBeNaN()
    })

    it('preserves diagonal and lower-triangle values', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b', 'c'],
          matrixPart: 'lower',
        },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // Diagonal
      expect(z[0][0]).toBe(1)
      expect(z[1][1]).toBe(1)
      expect(z[2][2]).toBe(1)

      // Lower triangle
      expect(z[1][0]).toBeGreaterThan(0.99) // r(b,a) ~ 1
      expect(z[2][0]).toBeLessThan(-0.99)   // r(c,a) ~ -1
      expect(z[2][1]).toBeLessThan(-0.99)   // r(c,b) ~ -1
    })

    it('full mode keeps all values finite', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b', 'c'],
          matrixPart: 'full',
        },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(Number.isFinite(z[i][j])).toBe(true)
        }
      }
    })
  })

  // --------------------------------------------------
  // Cell value annotations
  // --------------------------------------------------

  describe('cell value annotations', () => {
    it('creates annotations when showValues is "always"', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b'],
          showValues: 'always',
        },
        DEFAULT_STYLE,
      )
      const annotations = (fig.layout as any).annotations

      // 2x2 matrix = 4 visible cells
      expect(annotations.length).toBe(4)
    })

    it('creates no annotations when showValues is "never"', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b'],
          showValues: 'never',
        },
        DEFAULT_STYLE,
      )
      const annotations = (fig.layout as any).annotations

      expect(annotations).toHaveLength(0)
    })

    it('auto mode shows values for small matrices (<= 20 attributes)', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b', 'c'],
          showValues: 'auto',
        },
        DEFAULT_STYLE,
      )
      const annotations = (fig.layout as any).annotations

      // 3x3 = 9 cells, auto mode should show
      expect(annotations.length).toBe(9)
    })

    it('uses compact format (.45 not 0.45) for matrices larger than 6x6', () => {
      // Build data with 7 attributes
      const data = Array.from({ length: 20 }, (_, i) => {
        const row: any = {}
        for (let j = 0; j < 7; j++) {
          row[`attr_${j}`] = i + j * 0.5
        }
        return row
      })
      const attrs = Array.from({ length: 7 }, (_, i) => `attr_${i}`)

      const fig = buildCorrelationFigure(
        { filteredData: data, attributes: attrs, showValues: 'always' },
        DEFAULT_STYLE,
      )
      const annotations = (fig.layout as any).annotations as any[]

      // Find a non-diagonal, non-trivial annotation
      const offDiag = annotations.find(
        (a: any) => a.text !== '1' && a.text !== '-1' && a.text !== ''
      )
      if (offDiag) {
        // Compact format: no leading zero
        expect(offDiag.text).not.toMatch(/^0\./)
        expect(offDiag.text).not.toMatch(/^-0\./)
      }
    })

    it('uses white text on dark cells (|r| > 0.5)', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b'],
          showValues: 'always',
        },
        DEFAULT_STYLE,
      )
      const annotations = (fig.layout as any).annotations as any[]

      // r(a,b) ~ 1, so should be white text
      const abAnnotation = annotations.find(
        (ann: any) => ann.text === '1' && ann.x !== ann.y
      )
      if (abAnnotation) {
        expect(abAnnotation.font.color).toBe('#ffffff')
      }
    })

    it('uses black text on light cells (|r| <= 0.5)', () => {
      // Create data with weak correlations
      const data = [
        { x: 1, y: 3 },
        { x: 2, y: 1 },
        { x: 3, y: 4 },
        { x: 4, y: 1 },
        { x: 5, y: 5 },
        { x: 6, y: 2 },
        { x: 7, y: 6 },
        { x: 8, y: 3 },
      ]

      const fig = buildCorrelationFigure(
        { filteredData: data, attributes: ['x', 'y'], showValues: 'always' },
        DEFAULT_STYLE,
      )
      const annotations = (fig.layout as any).annotations as any[]

      // Off-diagonal cells: r(x,y) is likely < 0.5 for this noisy data
      const offDiag = annotations.find((a: any) => a.text !== '1' && a.text !== '')
      if (offDiag) {
        // If |r| <= 0.5, text color should be black
        const rValue = parseFloat(offDiag.text.replace(/^\./, '0.').replace(/^-\./, '-0.'))
        if (Math.abs(rValue) <= 0.5) {
          expect(offDiag.font.color).toBe('#000000')
        }
      }
    })

    it('skips annotations for masked (NaN) cells in lower-triangle mode', () => {
      const fig = buildCorrelationFigure(
        {
          filteredData: BASIC_DATA,
          attributes: ['a', 'b', 'c'],
          matrixPart: 'lower',
          showValues: 'always',
        },
        DEFAULT_STYLE,
      )
      const annotations = (fig.layout as any).annotations as any[]

      // Lower triangle + diagonal of 3x3: (0,0), (1,0), (1,1), (2,0), (2,1), (2,2) = 6 cells
      expect(annotations).toHaveLength(6)
    })
  })

  // --------------------------------------------------
  // Dynamic margins
  // --------------------------------------------------

  describe('dynamic margins', () => {
    it('increases margins for longer attribute labels', () => {
      const shortData = [
        { a: 1, b: 2, c: 3 },
        { a: 2, b: 3, c: 4 },
        { a: 3, b: 4, c: 5 },
      ]
      const figShort = buildCorrelationFigure(
        { filteredData: shortData, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      const longData = [
        { very_long_attribute_name_one: 1, very_long_attribute_name_two: 2 },
        { very_long_attribute_name_one: 2, very_long_attribute_name_two: 3 },
        { very_long_attribute_name_one: 3, very_long_attribute_name_two: 4 },
      ]
      const figLong = buildCorrelationFigure(
        {
          filteredData: longData,
          attributes: ['very_long_attribute_name_one', 'very_long_attribute_name_two'],
        },
        DEFAULT_STYLE,
      )

      const marginShort = (figShort.layout as any).margin.l
      const marginLong = (figLong.layout as any).margin.l

      expect(marginLong).toBeGreaterThan(marginShort)
    })

    it('caps dynamic margin at 150px', () => {
      const data = [
        { extremely_long_column_name_that_should_be_capped_at_max: 1, b: 2 },
        { extremely_long_column_name_that_should_be_capped_at_max: 2, b: 3 },
        { extremely_long_column_name_that_should_be_capped_at_max: 3, b: 4 },
      ]
      const fig = buildCorrelationFigure(
        {
          filteredData: data,
          attributes: ['extremely_long_column_name_that_should_be_capped_at_max', 'b'],
        },
        DEFAULT_STYLE,
      )

      expect((fig.layout as any).margin.l).toBeLessThanOrEqual(150)
    })
  })

  // --------------------------------------------------
  // Style application
  // --------------------------------------------------

  describe('style application', () => {
    it('uses style.backgroundColor for paper and plot', () => {
      const style = { ...DEFAULT_STYLE, backgroundColor: '#f0f0f0' }
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        style,
      )

      expect((fig.layout as any).paper_bgcolor).toBe('#f0f0f0')
      expect((fig.layout as any).plot_bgcolor).toBe('#f0f0f0')
    })

    it('uses style.textColor for axis tick fonts', () => {
      const style = { ...DEFAULT_STYLE, textColor: '#333333' }
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        style,
      )

      expect((fig.layout as any).xaxis.tickfont.color).toBe('#333333')
      expect((fig.layout as any).yaxis.tickfont.color).toBe('#333333')
    })

    it('uses style.fontFamily for layout font', () => {
      const style = { ...DEFAULT_STYLE, fontFamily: 'Times New Roman' }
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        style,
      )

      expect((fig.layout as any).font.family).toBe('Times New Roman')
    })
  })

  // --------------------------------------------------
  // Title
  // --------------------------------------------------

  describe('title', () => {
    it('includes title in layout when specified', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'], title: 'My Correlations' },
        DEFAULT_STYLE,
      )

      expect((fig.layout as any).title.text).toBe('My Correlations')
    })

    it('omits title from layout when not specified', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      expect((fig.layout as any).title).toBeUndefined()
    })
  })

  // --------------------------------------------------
  // Label formatting
  // --------------------------------------------------

  describe('label formatting', () => {
    it('converts snake_case column names to Title Case', () => {
      const data = [
        { travel_time: 1, wait_time: 2 },
        { travel_time: 2, wait_time: 3 },
        { travel_time: 3, wait_time: 4 },
      ]
      const fig = buildCorrelationFigure(
        { filteredData: data, attributes: ['travel_time', 'wait_time'] },
        DEFAULT_STYLE,
      )
      const trace = heatmapTrace(fig)

      expect(trace.x).toContain('Travel Time')
      expect(trace.x).toContain('Wait Time')
      expect(trace.y).toContain('Travel Time')
      expect(trace.y).toContain('Wait Time')
    })

    it('uppercases known abbreviations (ID, DRT, KM)', () => {
      const data = [
        { trip_id: 1, vkt_km: 2 },
        { trip_id: 2, vkt_km: 3 },
        { trip_id: 3, vkt_km: 4 },
      ]
      const fig = buildCorrelationFigure(
        { filteredData: data, attributes: ['trip_id', 'vkt_km'] },
        DEFAULT_STYLE,
      )
      const trace = heatmapTrace(fig)

      expect(trace.x).toContain('Trip ID')
      expect(trace.x).toContain('VKT KM')
    })
  })

  // --------------------------------------------------
  // Edge cases
  // --------------------------------------------------

  describe('edge cases', () => {
    it('returns empty figure for empty data', () => {
      const fig = buildCorrelationFigure(
        { filteredData: [], attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )

      expect(fig.traces).toHaveLength(0)
    })

    it('returns empty figure for empty attributes', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: [] },
        DEFAULT_STYLE,
      )

      expect(fig.traces).toHaveLength(0)
    })

    it('returns empty figure when no attributes are provided at all', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA },
        DEFAULT_STYLE,
      )

      expect(fig.traces).toHaveLength(0)
    })

    it('handles single attribute (1x1 matrix)', () => {
      const fig = buildCorrelationFigure(
        { filteredData: BASIC_DATA, attributes: ['a'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      expect(z).toHaveLength(1)
      expect(z[0]).toHaveLength(1)
      expect(z[0][0]).toBe(1)
    })

    it('handles data with missing/null values gracefully', () => {
      const data = [
        { a: 1, b: 2 },
        { a: 2, b: null },
        { a: null, b: 6 },
        { a: 4, b: 8 },
        { a: 5, b: 10 },
      ]
      const fig = buildCorrelationFigure(
        { filteredData: data, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // Should still produce a valid matrix
      expect(z).toHaveLength(2)
      expect(z[0]).toHaveLength(2)
      // Diagonal should still be 1
      expect(z[0][0]).toBe(1)
      expect(z[1][1]).toBe(1)
      // Off-diagonal should be a valid correlation
      expect(Number.isFinite(z[0][1])).toBe(true)
    })

    it('handles constant column (zero variance) without crashing', () => {
      const data = [
        { a: 5, b: 1 },
        { a: 5, b: 2 },
        { a: 5, b: 3 },
        { a: 5, b: 4 },
      ]
      const fig = buildCorrelationFigure(
        { filteredData: data, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // r(a,b) should be NaN (zero variance in a), diagonal still 1
      expect(z[0][0]).toBe(1)
      expect(z[1][1]).toBe(1)
      // Off-diagonal: NaN because zero variance
      expect(Number.isNaN(z[0][1])).toBe(true)
      expect(Number.isNaN(z[1][0])).toBe(true)
    })

    it('handles fewer than 3 valid data points for a pair', () => {
      const data = [
        { a: 1, b: null },
        { a: null, b: 2 },
        { a: 3, b: 3 },
      ]
      const fig = buildCorrelationFigure(
        { filteredData: data, attributes: ['a', 'b'] },
        DEFAULT_STYLE,
      )
      const z = heatmapTrace(fig).z as number[][]

      // Only 1 valid pair => r should be NaN
      expect(Number.isNaN(z[0][1])).toBe(true)
    })
  })
})
