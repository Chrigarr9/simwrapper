import { describe, it, expect } from 'vitest'
import { renderToSVG, renderToPNG, renderChart } from '../chartRenderer'
import type { PlotlyFigure } from '../../types'

const simpleFigure: PlotlyFigure = {
  traces: [
    {
      type: 'bar',
      x: ['A', 'B', 'C'],
      y: [10, 20, 15],
    } as any,
  ],
  layout: {
    title: { text: 'Test Chart' },
    margin: { l: 50, r: 20, t: 40, b: 40 },
  },
  config: { displayModeBar: false },
}

describe('chartRenderer', () => {
  it('renders a simple bar chart to SVG', async () => {
    const svg = await renderToSVG(simpleFigure, 400, 300, 1)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  }, 30000)

  it('renders to PNG with valid header', async () => {
    const png = await renderToPNG(simpleFigure, 400, 300, 1)
    expect(png).toBeInstanceOf(Buffer)
    expect(png.length).toBeGreaterThan(100)
    // PNG magic bytes
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50) // P
    expect(png[2]).toBe(0x4e) // N
    expect(png[3]).toBe(0x47) // G
  }, 30000)

  it('renderChart returns correct format for SVG', async () => {
    const result = await renderChart(simpleFigure, 'test-chart', 'svg', 400, 300, 1)
    expect(result.filename).toBe('test-chart')
    expect(result.format).toBe('svg')
    expect(result.data.toString('utf-8')).toContain('<svg')
  }, 30000)

  it('renderChart returns correct format for PNG', async () => {
    const result = await renderChart(simpleFigure, 'test-chart', 'png', 400, 300, 1)
    expect(result.filename).toBe('test-chart')
    expect(result.format).toBe('png')
    expect(result.data[0]).toBe(0x89) // PNG header
  }, 30000)
})
