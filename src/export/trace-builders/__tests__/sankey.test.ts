import { describe, it, expect } from 'vitest'
import { buildSankeyFigure } from '../sankey'
import { PRINT_CHART_STYLE } from '../../defaults'
import type { SankeyInput } from '../../types'

const style = PRINT_CHART_STYLE

describe('buildSankeyFigure', () => {
  it('produces a single sankey trace with deduplicated nodes in first-seen order', () => {
    const input: SankeyInput = {
      type: 'sankey',
      sourceColumn: 'source',
      targetColumn: 'target',
      valueColumn: 'value',
      filteredData: [
        { source: 'car', target: 'drt', value: 1000 },
        { source: 'pt', target: 'drt', value: 200 },
        { source: 'bike', target: 'drt', value: 50 },
      ],
    }
    const fig = buildSankeyFigure(input, style)
    expect(fig.traces).toHaveLength(1)
    expect(fig.traces[0].type).toBe('sankey')
    expect(fig.traces[0].node.label).toEqual(['car', 'drt', 'pt', 'bike'])
    expect(fig.traces[0].link.source).toEqual([0, 2, 3])  // car=0, pt=2, bike=3
    expect(fig.traces[0].link.target).toEqual([1, 1, 1])  // all → drt=1
    expect(fig.traces[0].link.value).toEqual([1000, 200, 50])
  })

  it('aggregates duplicate source-target pairs', () => {
    const input: SankeyInput = {
      type: 'sankey',
      sourceColumn: 'source',
      targetColumn: 'target',
      valueColumn: 'value',
      filteredData: [
        { source: 'car', target: 'drt', value: 600 },
        { source: 'car', target: 'drt', value: 400 },
      ],
    }
    const fig = buildSankeyFigure(input, style)
    expect(fig.traces[0].link.value).toEqual([1000])
    expect(fig.traces[0].link.source).toEqual([0])
    expect(fig.traces[0].link.target).toEqual([1])
  })

  it('applies nodeColorMap when provided', () => {
    const input: SankeyInput = {
      type: 'sankey',
      sourceColumn: 'source',
      targetColumn: 'target',
      valueColumn: 'value',
      nodeColorMap: { car: '#e74c3c', drt: '#9b59b6' },
      filteredData: [{ source: 'car', target: 'drt', value: 100 }],
    }
    const fig = buildSankeyFigure(input, style)
    expect(fig.traces[0].node.color).toEqual(['#e74c3c', '#9b59b6'])
  })

  it('falls back to style.barColor for nodes absent from nodeColorMap', () => {
    const input: SankeyInput = {
      type: 'sankey',
      sourceColumn: 'source',
      targetColumn: 'target',
      valueColumn: 'value',
      nodeColorMap: { car: '#e74c3c' },  // drt missing
      filteredData: [{ source: 'car', target: 'drt', value: 100 }],
    }
    const fig = buildSankeyFigure(input, style)
    expect(fig.traces[0].node.color[0]).toBe('#e74c3c')
    expect(fig.traces[0].node.color[1]).toBe(style.barColor)
  })

  it('skips rows with null/undefined value', () => {
    const input: SankeyInput = {
      type: 'sankey',
      sourceColumn: 'source',
      targetColumn: 'target',
      valueColumn: 'value',
      filteredData: [
        { source: 'car', target: 'drt', value: 100 },
        { source: 'pt', target: 'drt', value: null },
        { source: 'bike', target: 'drt', value: undefined },
        { source: 'walk', target: 'drt', value: 50 },
      ],
    }
    const fig = buildSankeyFigure(input, style)
    expect(fig.traces[0].link.value).toEqual([100, 50])
    expect(fig.traces[0].node.label).toEqual(['car', 'drt', 'walk'])
    // Confirm pt and bike never became nodes (no zero-value links either)
    expect(fig.traces[0].node.label).not.toContain('pt')
    expect(fig.traces[0].node.label).not.toContain('bike')
  })

  it('honors style.margin when provided', () => {
    const input: SankeyInput = {
      type: 'sankey',
      sourceColumn: 'source',
      targetColumn: 'target',
      valueColumn: 'value',
      filteredData: [{ source: 'car', target: 'drt', value: 100 }],
    }
    const customStyle = { ...style, margin: { l: 10, r: 10, t: 10, b: 10 } }
    const fig = buildSankeyFigure(input, customStyle)
    expect(fig.layout.margin).toEqual({ l: 10, r: 10, t: 10, b: 10 })
  })
})
