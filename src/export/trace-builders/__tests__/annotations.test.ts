import { describe, it, expect } from 'vitest'
import { buildScatterFigure } from '../scatter'
import { buildHistogramFigure } from '../histogram'
import { buildBarFigure } from '../bar'
import { PRINT_CHART_STYLE } from '../../defaults'

const style = PRINT_CHART_STYLE

describe('annotation passthrough — scatter', () => {
  it('merges input.annotations into layout.annotations', () => {
    const fig = buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x',
      yColumn: 'y',
      filteredData: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
      annotations: [{ x: 1, y: 2, text: 'Proof of concept', showarrow: true }],
    } as any, style)

    expect(fig.layout.annotations).toBeDefined()
    expect(Array.isArray(fig.layout.annotations)).toBe(true)
    const texts = (fig.layout.annotations as any[]).map(a => a.text)
    expect(texts).toContain('Proof of concept')
  })

  it('preserves any pre-existing internal annotations when input.annotations is provided', () => {
    // First, render without input.annotations to see what (if anything) the builder produces internally
    const baseline = buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x',
      yColumn: 'y',
      filteredData: [{ x: 1, y: 2 }],
    } as any, style)
    const baselineAnnotationCount = (baseline.layout.annotations ?? []).length

    // Now render with one input annotation; should be baseline + 1
    const withInput = buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x',
      yColumn: 'y',
      filteredData: [{ x: 1, y: 2 }],
      annotations: [{ x: 1, y: 2, text: 'Note' }],
    } as any, style)
    const inputAnnotationCount = (withInput.layout.annotations ?? []).length

    expect(inputAnnotationCount).toBe(baselineAnnotationCount + 1)
  })

  it('handles missing annotations field gracefully (no error)', () => {
    expect(() => buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x',
      yColumn: 'y',
      filteredData: [{ x: 1, y: 2 }],
    } as any, style)).not.toThrow()
  })
})

describe('annotation passthrough — histogram', () => {
  it('merges input.annotations into layout.annotations', () => {
    const fig = buildHistogramFigure({
      type: 'histogram',
      column: 'value',
      filteredData: [{ value: 1 }, { value: 2 }, { value: 3 }],
      annotations: [{ x: 2, y: 1, text: 'Mode' }],
    } as any, style)

    expect(fig.layout.annotations).toBeDefined()
    const texts = (fig.layout.annotations as any[]).map(a => a.text)
    expect(texts).toContain('Mode')
  })

  it('preserves any pre-existing internal annotations', () => {
    const baseline = buildHistogramFigure({
      type: 'histogram',
      column: 'value',
      filteredData: [{ value: 1 }, { value: 2 }],
    } as any, style)
    const baselineCount = (baseline.layout.annotations ?? []).length

    const withInput = buildHistogramFigure({
      type: 'histogram',
      column: 'value',
      filteredData: [{ value: 1 }, { value: 2 }],
      annotations: [{ x: 1.5, y: 1, text: 'Peak' }],
    } as any, style)
    const withInputCount = (withInput.layout.annotations ?? []).length

    expect(withInputCount).toBe(baselineCount + 1)
  })

  it('handles missing annotations field gracefully', () => {
    expect(() => buildHistogramFigure({
      type: 'histogram',
      column: 'value',
      filteredData: [{ value: 1 }],
    } as any, style)).not.toThrow()
  })
})

describe('reference-line passthrough — scatter', () => {
  it('renders y-axis reference line as shape + labeled annotation', () => {
    const fig = buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x', yColumn: 'y',
      filteredData: [{ x: 1, y: 50 }, { x: 2, y: 80 }],
      referenceLines: [{ axis: 'y', value: 59, label: 'Deutschlandticket', color: '#c0392b' }],
    } as any, style)

    const yShapes = (fig.layout.shapes ?? []).filter((s: any) => s.y0 === 59 && s.y1 === 59)
    expect(yShapes.length).toBeGreaterThanOrEqual(1)

    const labels = (fig.layout.annotations ?? []).map((a: any) => a.text)
    expect(labels).toContain('Deutschlandticket')
  })

  it('renders x-axis reference line as shape + labeled annotation', () => {
    const fig = buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x', yColumn: 'y',
      filteredData: [{ x: 1, y: 50 }],
      referenceLines: [{ axis: 'x', value: 300, label: 'Backbone target' }],
    } as any, style)

    const xShapes = (fig.layout.shapes ?? []).filter((s: any) => s.x0 === 300 && s.x1 === 300)
    expect(xShapes.length).toBeGreaterThanOrEqual(1)

    const labels = (fig.layout.annotations ?? []).map((a: any) => a.text)
    expect(labels).toContain('Backbone target')
  })

  it('renders unlabeled reference line as shape only (no annotation)', () => {
    const fig = buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x', yColumn: 'y',
      filteredData: [{ x: 1, y: 50 }],
      referenceLines: [{ axis: 'y', value: 100 }],  // no label
    } as any, style)

    expect(fig.layout.shapes?.length).toBe(1)
    const refLineLabels = (fig.layout.annotations ?? []).filter((a: any) => a.text)
    expect(refLineLabels.length).toBe(0)
  })

  it('preserves existing annotations when both annotations AND referenceLines provided', () => {
    const fig = buildScatterFigure({
      type: 'scatter-plot',
      xColumn: 'x', yColumn: 'y',
      filteredData: [{ x: 1, y: 50 }],
      annotations: [{ x: 1, y: 50, text: 'Direct annotation' }],
      referenceLines: [{ axis: 'y', value: 59, label: 'Reference label' }],
    } as any, style)

    const texts = (fig.layout.annotations ?? []).map((a: any) => a.text)
    expect(texts).toContain('Direct annotation')
    expect(texts).toContain('Reference label')
  })
})

describe('reference-line passthrough — bar (extracted helpers still wired)', () => {
  it('renders y-axis reference line on bar chart via shared helpers', () => {
    const fig = buildBarFigure({
      type: 'bar',
      xColumn: 'scheme',
      yColumns: ['service_rate'],
      filteredData: [{ scheme: 'equal', service_rate: 0.8 }],
      referenceLines: [{ axis: 'y', value: 0.75, label: 'Target' }],
    } as any, style)

    const yShapes = (fig.layout.shapes ?? []).filter((s: any) => s.y0 === 0.75 && s.y1 === 0.75)
    expect(yShapes.length).toBeGreaterThanOrEqual(1)
    const labels = (fig.layout.annotations ?? []).map((a: any) => a.text)
    expect(labels).toContain('Target')
  })
})
